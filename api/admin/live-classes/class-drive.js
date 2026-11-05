/**
 * Google Drive storage for class recordings and documents (Live Classes →
 * Storage: Google Drive). Used by class-video.js and live-classes.js; nothing
 * else in the project stores files on Drive.
 *
 * Files keep the server's layout, under the Drive folder GOOGLE_DRIVE_FOLDER_ID /
 * GOOGLE_DRIVE_VIDEO_FOLDER_ID:
 *   classes/<course>/<batch>/<class>/<file>                 original video / document
 *   classes/<course>/<batch>/<class>/hls/<version>/…        encrypted HLS: index.m3u8,
 *                                                           seg_*.ts, key.bin (wrapped key)
 *   temp/<file>                                             a browser upload not yet saved
 *                                                           (moved into its class on save;
 *                                                           trashed after a day otherwise)
 * In the database a Drive file is "gdrive:<file id>" (liveclasses.file / doc /
 * video_private); HLS pieces are listed in liveclass_drive_files.
 *
 * Drive files are never shared publicly: everything is streamed through the API
 * after the same viewer checks as server files. The HLS key on Drive is wrapped
 * (AES-256-GCM) with VIDEO_KEY_WRAP_SECRET, so the Drive folder alone can't play
 * a video; the server keeps a plain copy as a cache.
 *
 * Sign-in: Uses Google OAuth2 (GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
 * GOOGLE_DRIVE_OAUTH_REDIRECT_URI, and refresh_token from GOOGLE_DRIVE_TOKEN_PATH or
 * GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN), falling back to GOOGLE_APPLICATION_CREDENTIALS if needed.
 * Uploads use googleapis `drive.files.create` with `uploadType: "resumable"`.
 */
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { google } = require("googleapis");
const mime = require("mime-types");

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const API_DIR = path.resolve(__dirname, "../..");
const ROOT = String(
    process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_VIDEO_FOLDER_ID || ""
).trim();
const MAX_BYTES = Number(process.env.GOOGLE_DRIVE_VIDEO_MAX_BYTES) || 5 * 1024 ** 3;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/* ---------------- OAuth2 / Service-Account authentication (backend only) ---------------- */

function resolveTokenPath() {
    const raw = String(
        process.env.GOOGLE_DRIVE_TOKEN_PATH || "./.secrets/google-drive-token.json"
    ).trim();
    if (!raw) return "";
    if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
    const fromApi = path.resolve(API_DIR, raw);
    if (fs.existsSync(fromApi)) return fromApi;
    const fromCwd = path.resolve(raw);
    if (fs.existsSync(fromCwd)) return fromCwd;
    return "";
}

function resolveRefreshToken() {
    const tokenPath = resolveTokenPath();
    if (tokenPath) {
        try {
            const saved = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
            if (saved && saved.refresh_token) {
                return String(saved.refresh_token).trim();
            }
        } catch (_) {}
    }
    return String(process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN || "").trim();
}

function resolveKeyFile() {
    const cred = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
    if (!cred) return "";
    if (path.isAbsolute(cred) && fs.existsSync(cred)) return cred;
    const fromApi = path.resolve(API_DIR, cred);
    if (fs.existsSync(fromApi)) return fromApi;
    if (fs.existsSync(cred)) return path.resolve(cred);
    return "";
}

let authClient = null;
let authSignature = "";
let driveClient = null;

function auth() {
    const id = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || "").trim();
    const secret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || "").trim();
    const redirect = String(process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || "").trim();
    const refresh = resolveRefreshToken();
    const sig = `${id}|${secret}|${redirect}|${refresh}`;

    if (id && secret && refresh) {
        if (!authClient || authSignature !== sig) {
            const oauth2Client = new google.auth.OAuth2(id, secret, redirect || undefined);
            oauth2Client.setCredentials({ refresh_token: refresh });
            authClient = oauth2Client;
            authSignature = sig;
            driveClient = null;
        }
        return authClient;
    }

    const keyFile = resolveKeyFile();
    if (!keyFile) {
        throw new Error(
            "Google Drive credentials not found. Configure GOOGLE_DRIVE_TOKEN_PATH (.secrets/google-drive-token.json) with OAuth credentials or GOOGLE_APPLICATION_CREDENTIALS."
        );
    }
    if (!authClient || authSignature !== `sa|${keyFile}`) {
        authClient = new google.auth.GoogleAuth({
            keyFile,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });
        authSignature = `sa|${keyFile}`;
        driveClient = null;
    }
    return authClient;
}

function getDriveClient() {
    const a = auth();
    if (!driveClient) {
        driveClient = google.drive({ version: "v3", auth: a });
    }
    return driveClient;
}

const usesOAuth = () =>
    !!(
        process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET &&
        resolveRefreshToken()
    );

/** Drive storage is enabled when folder ID and OAuth or service-account credentials are present. */
const enabled = () => !!ROOT && (usesOAuth() || !!resolveKeyFile());

/** Verify that the configured Drive folder and account quota can accept an upload of `requiredBytes`. */
let storageCheckMemo = null;
async function verifyStorage(requiredBytes = 1) {
    if (!enabled()) {
        return {
            ok: false,
            error: "Google Drive is not configured (missing GOOGLE_DRIVE_FOLDER_ID / GOOGLE_DRIVE_VIDEO_FOLDER_ID or OAuth token).",
        };
    }
    try {
        const nowMs = Date.now();
        if (!storageCheckMemo || storageCheckMemo.until < nowMs) {
            const a = auth();
            if (a.getAccessToken) {
                const { token: accessToken } = await a.getAccessToken();
                if (!accessToken) throw new Error("Google did not return an access token.");
            }
            const d = getDriveClient();
            const [aboutRes, folderRes] = await Promise.all([
                d.about.get({ fields: "user(emailAddress,displayName),storageQuota" }),
                d.files.get({
                    fileId: ROOT,
                    supportsAllDrives: true,
                    fields: "id,name,mimeType,driveId,ownedByMe,owners(emailAddress,displayName),capabilities(canAddChildren),trashed",
                }),
            ]);
            storageCheckMemo = {
                until: nowMs + 60 * 1000,
                about: aboutRes.data || {},
                folder: folderRes.data || {},
            };
        }
        const { about, folder: fld } = storageCheckMemo;
        if (!fld || !fld.id || fld.trashed) {
            return { ok: false, error: "Configured Google Drive folder was not found or is in the trash." };
        }
        if (fld.mimeType && fld.mimeType !== FOLDER) {
            return { ok: false, error: "The configured Drive ID is not a folder." };
        }
        if (fld.capabilities && fld.capabilities.canAddChildren === false) {
            return { ok: false, error: "The configured Google account does not have permission to add files to the Drive folder." };
        }
        const isSharedDrive = Boolean(fld.driveId);
        const quota = about.storageQuota || {};
        const hasLimit = quota.limit !== undefined && quota.limit !== null && String(quota.limit) !== "";
        const limitBytes = hasLimit ? Number(quota.limit) : Infinity;
        const usageBytes = Number(quota.usage || 0);
        const remainingBytes = hasLimit ? Math.max(0, limitBytes - usageBytes) : Infinity;
        const saEmail = (about.user && about.user.emailAddress) || "drive-account";
        const ownerEmail = (fld.owners && fld.owners[0] && fld.owners[0].emailAddress) || saEmail;

        if (!isSharedDrive && !usesOAuth() && hasLimit && limitBytes === 0) {
            return {
                ok: false,
                isSharedDrive: false,
                saEmail,
                ownerEmail,
                folderName: fld.name || ROOT,
                limitBytes,
                usageBytes,
                remainingBytes: 0,
                error:
                    `Google Drive 403 (storageQuotaExceeded): Service account (${saEmail}) has 0 bytes of storage quota. Configure OAuth token in GOOGLE_DRIVE_TOKEN_PATH (.secrets/google-drive-token.json).`,
            };
        }
        if (!isSharedDrive && hasLimit && requiredBytes > remainingBytes) {
            return {
                ok: false,
                isSharedDrive,
                saEmail,
                ownerEmail,
                folderName: fld.name || ROOT,
                limitBytes,
                usageBytes,
                remainingBytes,
                error: `Insufficient Google Drive storage quota (${Math.round(remainingBytes / 1024 ** 2)} MB available, ${Math.round(requiredBytes / 1024 ** 2)} MB required).`,
            };
        }
        return {
            ok: true,
            isSharedDrive,
            saEmail,
            ownerEmail,
            folderName: fld.name || ROOT,
            limitBytes: Number.isFinite(limitBytes) ? limitBytes : null,
            usageBytes,
            remainingBytes: Number.isFinite(remainingBytes) ? remainingBytes : null,
        };
    } catch (err) {
        const msg = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || String(err);
        return {
            ok: false,
            error: "Google Drive verification failed: " + msg,
        };
    }
}

async function token() {
    const a = auth();
    const t = a.getAccessToken ? await a.getAccessToken() : null;
    const v = t && (t.token || t);
    if (!v || typeof v !== "string") throw new Error("Google Drive sign-in failed");
    return v;
}

// Drive answers rate limits with 403 (not only 429): these reasons are worth a retry.
const RETRY_403 = /rateLimitExceeded|userRateLimitExceeded|backendError|sharingRateLimitExceeded/i;

// fetch with the Drive token, retried on rate limits / server errors / an expired
// token (used for byte-range streaming)
async function gfetch(url, opts = {}, tries = 4) {
    const streamingBody = !!(opts.body && typeof opts.body.pipe === "function");
    for (let i = 0; ; i++) {
        let r;
        try {
            r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + (await token()), ...(opts.headers || {}) } });
        } catch (e) {
            // network reset / DNS hiccup between this server and Google
            if (i < tries - 1 && !streamingBody) {
                await new Promise((s) => setTimeout(s, 500 * 2 ** i + Math.random() * 300));
                continue;
            }
            throw e;
        }
        const last = i >= tries - 1 || streamingBody;
        if (!last && r.status === 401) {
            // access token rejected: drop the cached client so the next try refreshes it
            authClient = null;
            authSignature = "";
            driveClient = null;
            await r.arrayBuffer().catch(() => {});
            continue;
        }
        if (!last && r.status === 403) {
            const body = await r.clone().text().catch(() => "");
            if (RETRY_403.test(body)) {
                await r.arrayBuffer().catch(() => {});
                await new Promise((s) => setTimeout(s, 800 * 2 ** i + Math.random() * 400));
                continue;
            }
        }
        if (!last && (r.status === 429 || r.status >= 500)) {
            await r.arrayBuffer().catch(() => {});
            await new Promise((s) => setTimeout(s, 500 * 2 ** i + Math.random() * 300));
            continue;
        }
        return r;
    }
}
const enc = encodeURIComponent;
const ALL = "supportsAllDrives=true";

/* ---------------- folders ---------------- */

const folderCache = new Map(); // "a/b/c" -> Promise<folder id>
async function child(parentId, name) {
    const drive = getDriveClient();
    const q = `'${parentId}' in parents and name = '${String(name).replace(/'/g, "\\'")}' and mimeType = '${FOLDER}' and trashed = false`;
    const found = await drive.files.list({
        q,
        fields: "files(id,name)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });
    if (found.data.files && found.data.files[0]) return found.data.files[0].id;
    const made = await drive.files.create({
        requestBody: {
            name,
            mimeType: FOLDER,
            parents: [parentId],
        },
        fields: "id,name,mimeType",
        supportsAllDrives: true,
    });
    return made.data.id;
}

/** The folder at `parts` under the root (made as needed), e.g. ["classes", c, b, req]. */
function folder(parts) {
    let parent = Promise.resolve(ROOT);
    let pathKey = "";
    for (const p of parts) {
        pathKey += "/" + p;
        if (!folderCache.has(pathKey)) {
            const key = pathKey;
            const pr = parent.then((id) => child(id, p));
            pr.catch(() => folderCache.delete(key));
            folderCache.set(key, pr);
        }
        parent = folderCache.get(pathKey);
    }
    return parent;
}
const classParts = (c, b, req) => {
    if (![c, b, req].every((x) => SAFE_ID.test(String(x || "")))) throw new Error("Unexpected class ids");
    return ["classes", c, b, req];
};
const classFolder = (c, b, req) => folder(classParts(c, b, req));
const hlsFolder = (c, b, req, ver) => folder([...classParts(c, b, req), "hls", ver]);
const tempFolder = () => folder(["temp"]);

/* ---------------- uploads (using googleapis drive.files.create + resumable) ---------------- */

/** Verify that this account can access the destination folder. */
async function ensureFolder(folderId) {
    const drive = getDriveClient();
    const folderRes = await drive.files.get({
        fileId: folderId,
        fields: "id,name,mimeType",
        supportsAllDrives: true,
    });
    if (folderRes.data.mimeType !== FOLDER) {
        throw new Error("The configured Drive ID is not a folder.");
    }
    return folderRes.data;
}

/**
 * Upload a local file on the server to Google Drive using googleapis OAuth2 +
 * `drive.files.create` with `uploadType: "resumable"` (matching test/upload-to-drive-oauth.js).
 * Returns the uploaded Drive file ID.
 */
async function uploadFile(abs, { name, mimeType, parentId, onProgress } = {}) {
    const filePath = path.resolve(abs);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new Error("The specified file does not exist: " + filePath);
    }
    const size = (await fsp.stat(filePath)).size;
    const targetFolderId = parentId || ROOT;
    const uploadName = name || path.basename(filePath);
    const resolvedMime = mimeType || mime.lookup(uploadName) || mime.lookup(filePath) || "application/octet-stream";

    await ensureFolder(targetFolderId);
    const drive = getDriveClient();

    const maxTries = 3;
    let lastErr = null;
    for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
            const result = await drive.files.create(
                {
                    requestBody: {
                        name: uploadName,
                        parents: [targetFolderId],
                    },
                    media: {
                        mimeType: resolvedMime,
                        body: fs.createReadStream(filePath),
                    },
                    fields: "id,name,mimeType,size",
                    uploadType: "resumable",
                    supportsAllDrives: true,
                },
                onProgress
                    ? {
                          onUploadProgress: (evt) => {
                              if (evt && typeof evt.bytesRead === "number") {
                                  onProgress(Math.min(evt.bytesRead, size), size);
                              }
                          },
                      }
                    : undefined
            );
            if (!result.data || !result.data.id) {
                throw new Error("Google Drive did not return a file ID.");
            }
            if (onProgress) onProgress(size, size);
            return result.data.id;
        } catch (err) {
            lastErr = err;
            if (attempt < maxTries) {
                await new Promise((r) => setTimeout(r, 1000 * attempt));
            }
        }
    }
    const errMsg = lastErr?.response?.data?.error?.message || lastErr?.message || "Upload failed";
    throw new Error(`Google Drive upload failed: ${errMsg}`);
}

/** A small buffer → Drive using googleapis `drive.files.create` (`uploadType: "resumable"`). */
async function uploadBuffer(buf, { name, mimeType, parentId } = {}) {
    const targetFolderId = parentId || ROOT;
    const resolvedMime = mimeType || mime.lookup(name || "") || "application/octet-stream";
    const dataBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || "");
    const drive = getDriveClient();

    const result = await drive.files.create({
        requestBody: {
            name,
            parents: [targetFolderId],
        },
        media: {
            mimeType: resolvedMime,
            body: Readable.from(dataBuf),
        },
        fields: "id,name,mimeType,size",
        uploadType: "resumable",
        supportsAllDrives: true,
    });
    if (!result.data || !result.data.id) {
        throw new Error(`Google Drive: upload of ${name} failed`);
    }
    return result.data.id;
}

/** Starts a resumable upload session URL if needed. */
async function uploadSession({ name, mimeType, size, parentId, origin }) {
    const r = await gfetch(`${UPLOAD}/files?uploadType=resumable&fields=id,name,size,mimeType&${ALL}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType || "application/octet-stream",
            ...(size ? { "X-Upload-Content-Length": String(size) } : {}),
            ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({ name, parents: [parentId] }),
    });
    const loc = r.headers.get("location");
    if (!r.ok || !loc) {
        const body = await r.json().catch(() => ({}));
        const reason = (body.error && body.error.message) || "";
        throw new Error(`Google Drive: could not start the upload (${r.status}${reason ? " - " + reason : ""})`);
    }
    return loc;
}

/* ---------------- files ---------------- */

async function meta(id, fields = "id,name,size,mimeType,parents,trashed") {
    const drive = getDriveClient();
    const res = await drive.files.get({
        fileId: id,
        fields,
        supportsAllDrives: true,
    });
    return res.data;
}

async function move(id, toParent) {
    const m = await meta(id, "parents");
    const from = (m.parents || []).join(",");
    const drive = getDriveClient();
    const res = await drive.files.update({
        fileId: id,
        addParents: toParent,
        ...(from ? { removeParents: from } : {}),
        fields: "id,name,size,mimeType",
        supportsAllDrives: true,
        requestBody: {},
    });
    return res.data;
}

/** Moves a file or folder to the Drive trash (kept 30 days); quiet if it's gone. */
async function trash(id) {
    if (!id) return;
    try {
        const drive = getDriveClient();
        await drive.files.update({
            fileId: id,
            supportsAllDrives: true,
            requestBody: { trashed: true },
        });
    } catch (_) {}
}

async function download(id) {
    const drive = getDriveClient();
    const res = await drive.files.get(
        { fileId: id, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data);
}

/** Streams a Drive file to an Express response, passing byte ranges through. */
async function stream(id, req, res, { type, disposition, cache = "private, no-store" } = {}) {
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const r = await gfetch(`${API}/files/${enc(id)}?alt=media&${ALL}`, { headers });
    if (r.status === 416) return res.status(416).end();
    if (!r.ok && r.status !== 206) {
        const reason = await r.text().catch(() => "");
        console.error(`drive.stream ${id}: Google Drive answered ${r.status} ${reason.slice(0, 300).replace(/\s+/g, " ")}`);
        // 503 + Retry-After lets the player retry instead of giving up
        if (r.status !== 404) res.setHeader("Retry-After", "2");
        res.setHeader("Cache-Control", "no-store");
        return res.status(r.status === 404 ? 404 : 503).end();
    }
    res.status(r.status);
    res.setHeader("Content-Type", type || r.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", cache);
    if (disposition) res.setHeader("Content-Disposition", disposition);
    const expected = Number(r.headers.get("content-length")) || 0;
    for (const h of ["content-length", "content-range"]) if (r.headers.get(h)) res.setHeader(h, r.headers.get(h));
    const body = Readable.fromWeb(r.body);
    let sent = 0;
    body.on("data", (c) => { sent += c.length; });
    req.on("close", () => body.destroy());
    // A dropped Drive connection must reach the browser as a failed request: ending
    // the response "normally" would hand the player (and the browser cache) a cut-off
    // segment, which then fails to decrypt / decode on every reload.
    body.on("error", (e) => {
        if (!req.destroyed) console.error(`drive.stream ${id}: Drive connection dropped after ${sent}/${expected || "?"} bytes (${e.message})`);
        res.destroy(e);
    });
    body.on("end", () => {
        if (expected && sent < expected) {
            console.error(`drive.stream ${id}: short read ${sent}/${expected} bytes`);
            res.destroy(new Error("short read from Google Drive"));
        }
    });
    body.pipe(res);
}

/* ---------------- validation & uploads ---------------- */

const VIDEO_EXTS = new Set(["mp4", "m4v", "mov", "avi", "mkv", "webm"]);
const DOC_EXTS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv"]);
const VIDEO_TYPES = /^video\/(mp4|x-m4v|quicktime|x-msvideo|avi|x-matroska|webm|mpeg|ogg)$/i;
const DOC_TYPES = new Set([
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
]);
const EXT_MIMES = {
    mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska", webm: "video/webm",
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain", csv: "text/csv",
};
const DOC_MAX = 100 * 1024 * 1024;
const extOf = (name) => String(name || "").split(".").pop().toLowerCase();
const mimeFromExt = (name) => EXT_MIMES[extOf(name)] || mime.lookup(String(name || "")) || "";
const okType = (kind, type, fileName) => {
    const ext = extOf(fileName);
    const t = String(type || "").trim() || mimeFromExt(fileName);
    if (kind === "video") {
        return VIDEO_EXTS.has(ext) && (VIDEO_TYPES.test(t) || /^video\//i.test(t));
    }
    return DOC_EXTS.has(ext) && DOC_TYPES.has(t);
};
function validateFile(kind, fileName, fileType, size) {
    const ext = extOf(fileName);
    const resolvedType = String(fileType || "").trim() || mimeFromExt(fileName);
    if (kind === "video") {
        if (!VIDEO_EXTS.has(ext)) {
            return { error: `Invalid video file extension (.${ext || "unknown"}). Allowed: MP4, MOV, MKV, WEBM, AVI, M4V.` };
        }
        if (!VIDEO_TYPES.test(resolvedType) && !/^video\//i.test(resolvedType)) {
            return { error: `Invalid video MIME type (${resolvedType || "unknown"}).` };
        }
    } else {
        if (!DOC_EXTS.has(ext) || !DOC_TYPES.has(resolvedType)) {
            return { error: "Invalid document file type. Allowed: PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, TXT, CSV." };
        }
    }
    const max = kind === "video" ? MAX_BYTES : DOC_MAX;
    if (!(size > 0)) return { error: "Selected file is empty (0 bytes)." };
    if (size > max) {
        return { error: `File size (${(size / 1024 ** 2).toFixed(1)} MB) exceeds maximum allowed limit (${Math.round(max / 1024 ** 2)} MB).` };
    }
    return { ok: true, mimeType: resolvedType };
}
const safeName = (n) => String(n || "file").split(/[\\/]/).pop().replace(/[^\w.\- ]/g, "_").slice(-120) || "file";

/** Starts a resumable upload session into temp/ after validating file & Drive quota. */
async function browserUpload({ kind, fileName, fileType, size, origin }) {
    const v = validateFile(kind, fileName, fileType, size);
    if (v.error) return { error: v.error };
    const quotaCheck = await verifyStorage(size);
    if (!quotaCheck.ok) return { error: quotaCheck.error };
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}-${safeName(fileName)}`;
    const uploadURL = await uploadSession({ name, mimeType: v.mimeType, size, parentId: await tempFolder(), origin });
    return { uploadURL };
}

/** A browser upload being saved with a class: checked (in temp/, right kind and
    size), then moved into the class's folder. Returns "gdrive:<id>" or "". */
async function claim(fileId, kind, c, b, req) {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(fileId || ""))) return "";
    const m = await meta(fileId).catch(() => null);
    if (!m || m.trashed || !(m.parents || []).includes(await tempFolder())) return "";
    if (!okType(kind, m.mimeType, m.name) || Number(m.size) > (kind === "video" ? MAX_BYTES : DOC_MAX)) return "";
    await move(fileId, await classFolder(c, b, req));
    return "gdrive:" + fileId;
}

/** Upload a local file on the server directly into the class's Google Drive folder
    using googleapis OAuth2 (`drive.files.create` resumable) and return "gdrive:<id>". */
async function storeServerFile(abs, fileName, kind, c, b, req, onProgress) {
    const stat = await fsp.stat(abs);
    const cleanName = String(fileName || path.basename(abs)).replace(/^\d+-[a-z0-9_]+-/, "");
    const v = validateFile(kind, cleanName, "", stat.size);
    if (v.error) throw new Error(v.error);
    const quotaCheck = await verifyStorage(stat.size);
    if (!quotaCheck.ok) throw new Error(quotaCheck.error);
    const targetFolder = await classFolder(c, b, req);
    const id = await uploadFile(abs, {
        name: safeName(cleanName),
        mimeType: v.mimeType,
        parentId: targetFolder,
        onProgress,
    });
    return "gdrive:" + id;
}

/* ---------------- the HLS key, wrapped for Drive ---------------- */

function wrapSecret() {
    const s = Buffer.from(String(process.env.VIDEO_KEY_WRAP_SECRET || ""), "base64");
    if (s.length !== 32) throw new Error("VIDEO_KEY_WRAP_SECRET is missing (32 bytes, base64)");
    return s;
}
/** key → [iv 12][tag 16][ciphertext] (AES-256-GCM). */
function wrapKey(key) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", wrapSecret(), iv);
    const ct = Buffer.concat([c.update(key), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), ct]);
}
function unwrapKey(blob) {
    const d = crypto.createDecipheriv("aes-256-gcm", wrapSecret(), blob.subarray(0, 12));
    d.setAuthTag(blob.subarray(12, 28));
    return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}

const isDrive = (v) => String(v || "").startsWith("gdrive:");
const idOf = (v) => (isDrive(v) ? String(v).slice(7) : "");

/* ---------------- Admin Panel OAuth Management & Testing ---------------- */

const ENV_FILE = path.join(API_DIR, ".env");

function saveEnvVar(key, value) {
    try {
        if (!fs.existsSync(ENV_FILE)) return;
        let s = fs.readFileSync(ENV_FILE, "utf8");
        const nl = s.includes("\r\n") ? "\r\n" : "\n";
        const line = `${key}=${value}`;
        const re = new RegExp(`^${key}=.*$`, "m");
        if (re.test(s)) s = s.replace(re, line);
        else s = s.replace(/\s*$/, "") + nl + line + nl;
        fs.writeFileSync(ENV_FILE, s, "utf8");
    } catch (_) {}
}

function saveRefreshToken(refreshToken) {
    const rawPath = String(
        process.env.GOOGLE_DRIVE_TOKEN_PATH || "./.secrets/google-drive-token.json"
    ).trim();
    const targetPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(API_DIR, rawPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify({ refresh_token: refreshToken }, null, 2) + "\n", "utf8");
    saveEnvVar("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN", refreshToken);
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN = refreshToken;
    authClient = null;
    authSignature = "";
    driveClient = null;
    storageCheckMemo = null;
}

function getAuthInfo(defaultRedirectUri = "") {
    const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || "").trim();
    const refreshToken = resolveRefreshToken();
    const tokenPath = String(
        process.env.GOOGLE_DRIVE_TOKEN_PATH || "./.secrets/google-drive-token.json"
    ).trim();
    const redirectUri = String(
        defaultRedirectUri || process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || ""
    ).trim();
    return {
        clientIdConfigured: !!clientId && !!clientSecret,
        clientIdPreview: clientId ? clientId.slice(0, 18) + "…" : "",
        hasRefreshToken: !!refreshToken,
        tokenPath,
        folderId: ROOT,
        redirectUri,
        maxBytes: MAX_BYTES,
    };
}

function generateOAuthUrl(redirectUri) {
    const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || "").trim();
    const finalRedirect = String(
        redirectUri || process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || ""
    ).trim();
    if (!clientId || !clientSecret || !ROOT) {
        throw new Error(
            "Set GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET and GOOGLE_DRIVE_FOLDER_ID in api/.env first."
        );
    }
    if (!finalRedirect) {
        throw new Error("Missing OAuth redirect URI.");
    }
    saveEnvVar("GOOGLE_DRIVE_OAUTH_REDIRECT_URI", finalRedirect);
    process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI = finalRedirect;

    const client = new google.auth.OAuth2(clientId, clientSecret, finalRedirect);
    const authUrl = client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/drive"],
    });
    return { authUrl, redirectUri: finalRedirect };
}

async function exchangeOAuthCode(rawCodeOrUrl, redirectUri) {
    const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || "").trim();
    const finalRedirect = String(
        redirectUri || process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || ""
    ).trim();
    if (!clientId || !clientSecret || !ROOT) {
        throw new Error(
            "Set GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET and GOOGLE_DRIVE_FOLDER_ID in api/.env first."
        );
    }
    let code = String(rawCodeOrUrl || "").trim();
    if (/^https?:\/\//i.test(code) || code.includes("code=")) {
        try {
            const parsed = new URL(code.startsWith("http") ? code : "http://localhost/?" + code.replace(/^\?/, ""));
            code = parsed.searchParams.get("code") || code;
        } catch (_) {}
    }
    if (!code) {
        throw new Error("Authorization code is missing.");
    }

    const client = new google.auth.OAuth2(clientId, clientSecret, finalRedirect);
    const { tokens } = await client.getToken(code);
    const refreshToken = tokens.refresh_token || resolveRefreshToken();
    if (!refreshToken) {
        throw new Error(
            "Google sent no refresh token. Remove this app's access at https://myaccount.google.com/permissions and try again."
        );
    }
    saveRefreshToken(refreshToken);

    // Perform a real 1-byte upload and delete check in the folder
    client.setCredentials({ refresh_token: refreshToken });
    const drive = google.drive({ version: "v3", auth: client });
    const checkFile = (
        await drive.files.create({
            requestBody: { name: "zz-drive-auth-check.txt", parents: [ROOT] },
            media: { mimeType: "text/plain", body: Readable.from(["x"]) },
            fields: "id,name,mimeType,size",
            uploadType: "resumable",
            supportsAllDrives: true,
        })
    ).data;
    await drive.files.delete({ fileId: checkFile.id, supportsAllDrives: true });

    storageCheckMemo = null;
    const quota = await verifyStorage(1);
    return {
        ok: true,
        message: "Signed in! Refresh token saved to .secrets/google-drive-token.json and api/.env. Upload check passed (1-byte test file created and deleted).",
        quota,
    };
}

async function testRefreshToken() {
    const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || "").trim();
    const redirectUri = String(process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || "").trim();
    const refreshToken = resolveRefreshToken();
    if (!refreshToken) {
        throw new Error("Refresh token not found. Authorize Google Drive first.");
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri || undefined);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { token: accessToken } = await oauth2Client.getAccessToken();
    if (!accessToken) {
        throw new Error("Google did not return an access token.");
    }
    storageCheckMemo = null;
    const quota = await verifyStorage(1);
    return {
        ok: true,
        message: "Success! A fresh access token was obtained from your existing refresh token without interactive Google login.",
        quota,
    };
}

async function testUploadCheck(localFilePath = "", fileName = "", keepFile = false) {
    const folderData = await ensureFolder(ROOT);
    const drive = getDriveClient();

    if (localFilePath && fs.existsSync(localFilePath)) {
        const cleanName = safeName(String(fileName || path.basename(localFilePath)).replace(/^\d+-[a-z0-9_]+-/, ""));
        const resolvedMime = mime.lookup(cleanName) || mime.lookup(localFilePath) || "application/octet-stream";
        const result = await drive.files.create({
            requestBody: {
                name: cleanName,
                parents: [ROOT],
            },
            media: {
                mimeType: resolvedMime,
                body: fs.createReadStream(localFilePath),
            },
            fields: "id,name,mimeType,size",
            uploadType: "resumable",
            supportsAllDrives: true,
        });
        const uploaded = result.data || {};
        if (!keepFile && uploaded.id) {
            await trash(uploaded.id);
        }
        return {
            ok: true,
            kept: !!keepFile,
            folderName: folderData.name || ROOT,
            file: {
                id: uploaded.id,
                name: uploaded.name,
                mimeType: uploaded.mimeType,
                size: Number(uploaded.size || 0),
            },
            message: keepFile
                ? `Uploaded "${uploaded.name}" (${uploaded.id}) to "${folderData.name}" using resumable OAuth upload.`
                : `Uploaded "${uploaded.name}" (${uploaded.id}) to "${folderData.name}" and moved test file to trash.`,
        };
    }

    const f = (
        await drive.files.create({
            requestBody: { name: "zz-drive-auth-check.txt", parents: [ROOT] },
            media: { mimeType: "text/plain", body: Readable.from(["x"]) },
            fields: "id,name,mimeType,size",
            uploadType: "resumable",
            supportsAllDrives: true,
        })
    ).data;
    await drive.files.delete({ fileId: f.id, supportsAllDrives: true });
    return {
        ok: true,
        kept: false,
        folderName: folderData.name || ROOT,
        file: { id: f.id, name: f.name, mimeType: f.mimeType, size: 1 },
        message: `Upload check: OK (1-byte test file created in "${folderData.name}" and deleted).`,
    };
}

module.exports = {
    enabled, verifyStorage, validateFile, MAX_BYTES,
    folder, classFolder, hlsFolder, tempFolder,
    uploadFile, uploadBuffer, browserUpload, claim, storeServerFile,
    meta, move, trash, download, stream,
    wrapKey, unwrapKey, isDrive, idOf,
    getAuthInfo, generateOAuthUrl, exchangeOAuthCode, testRefreshToken, testUploadCheck,
};
