/**
 * File uploads used by several pages (Assignments, Blogs, Gallery, Live
 * Classes, Blog Images, student Assignments).
 *
 * Mounted by ../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../shared/core.js.
 */
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const startup = require("./startup");

// File types a single upload may have — checked when the upload URL is asked
// for (/get-upload-url) and again on the upload itself (/upload-file).
const allowedTypes = [

    // 🎬 Videos
    "video/mp4",
    "video/quicktime",        // .mov
    "video/x-msvideo",        // .avi
    "video/x-matroska",       // .mkv
    "video/webm",

    // 🖼️ Images  (SVG intentionally excluded — can carry script, audit SEC-16)
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",

    // 📄 Documents
    "application/pdf",

    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    "text/plain",
    "text/csv"
];
/*
    "application/zip",
    "application/x-zip-compressed"
    */

// Largest upload (class videos), and the smaller caps the other upload URLs carry.
// A big upload must also get through nginx (docs/nginx.conf, /api/upload-file)
// and Node's request timeout (server.js).
const VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 600 * 1024 * 1024;
const IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const RESUME_UPLOAD_BYTES = 10 * 1024 * 1024;

// Uploads that were never saved stay in riviratech/temp/; anything older than a
// day there is removed (a form saves its upload within minutes).
const TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// File extensions an upload may be stored under (/uploads serves a file with the
// type its extension says). No svg / html / xml / js: opened from the API's own
// address they could run script there.
const SAFE_EXT = [
    "mp4", "mov", "avi", "mkv", "webm",
    "jpg", "jpeg", "png", "webp", "gif",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
    "zip",
];

module.exports = (router, ctx) => {
    const { UPLOAD_TTL_MS, UPLOADS_DIR, signUpload, resolveUploadPath, publicBase, md5, verifyAccount } = ctx;

    // Hourly: remove temp uploads that were never saved (older than a day).
    const tempDir = path.join(UPLOADS_DIR, "riviratech", "temp");
    const cleanTemp = async () => {
        try {
            const cutoff = Date.now() - TEMP_MAX_AGE_MS;
            for (const name of await fsp.readdir(tempDir)) {
                const file = path.join(tempDir, name);
                const st = await fsp.stat(file).catch(() => null);
                if (st && st.isFile() && st.mtimeMs < cutoff) await fsp.unlink(file).catch(() => {});
            }
        } catch (err) {
            if (err.code !== "ENOENT") console.error("temp upload cleanup:", err.message);
        }
    };
    // one process only (the cluster's leader copy): see startup.js
    startup.leaderInterval("temp upload cleanup", cleanTemp, 60 * 60 * 1000, 60 * 1000);

    /* Local replacement for the S3 presigned PUT. The browser PUTs the raw file
       bytes here after /get-upload-url; they are streamed straight to disk (a
       class video can be several GB, too big to hold in memory). Authorised by
       the HMAC signature in the query string (not a cookie), and only ever
       writes into the `riviratech/temp/` prefix.

       The URL is checked BEFORE the body is read, and the body may be no larger
       than the URL's signed size limit: otherwise anyone could fill the disk
       without a valid URL at all. */
    const checkUploadUrl = (req, res, next) => {
        const { key, exp, sig, max } = req.query;

        if (!key || !exp || !sig) {
            return res.status(400).json({ success: false, message: "Missing upload params" });
        }
        if (!Number.isFinite(Number(exp)) || Date.now() > Number(exp)) {
            return res.status(403).json({ success: false, message: "Upload URL expired" });
        }

        // Constant-time signature check.
        const expected = signUpload(key, exp, max);
        const a = Buffer.from(String(sig));
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return res.status(403).json({ success: false, message: "Invalid upload signature" });
        }

        // Signature only ever authorises a temp-prefix write.
        if (!String(key).startsWith("riviratech/temp/")) {
            return res.status(403).json({ success: false, message: "Bad upload key" });
        }
        // ...under a safe extension (the upload URL routes only sign those)
        if (!SAFE_EXT.includes(String(key).split(".").pop().toLowerCase())) {
            return res.status(400).json({ success: false, message: "File type not allowed" });
        }

        const limit = Math.min(Number(max) || MAX_UPLOAD_BYTES, VIDEO_UPLOAD_BYTES);
        if (Number(req.headers["content-length"] || 0) > limit) {
            return res.status(413).json({ success: false, message: "File is too large" });
        }
        req.uploadLimit = limit;
        next();
    };

    router.put("/upload-file", checkUploadUrl, async (req, res) => {
        const { key } = req.query;

        const abs = resolveUploadPath(key);
        if (!abs) {
            return res.status(400).json({ success: false, message: "Bad upload path" });
        }

        // 🔒 Validate file type (the browser sends the file's type as
        // Content-Type; any "; charset=..." part is ignored)
        const fileType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        if (!allowedTypes.includes(fileType)) {
            return res.status(400).json({
                success: false,
                message: "File type not allowed",
            });
        }

        // Handle chunked uploads (Content-Range: bytes start-end/total)
        // Allows large files (> 100 MB) to pass through Cloudflare in 20 MB chunks without hitting the 100 MB proxy limit.
        const rangeHeader = req.headers["content-range"];
        const rangeMatch = rangeHeader && String(rangeHeader).match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);

        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            const total = parseInt(rangeMatch[3], 10);

            if (total > req.uploadLimit) {
                return res.status(413).json({ success: false, message: "File is too large" });
            }

            const safeKeyHash = crypto.createHash("sha256").update(String(key)).digest("hex").slice(0, 16);
            const chunkPart = `${abs}.chunk-${safeKeyHash}`;
            await fsp.mkdir(path.dirname(abs), { recursive: true });

            if (start === 0 && fs.existsSync(chunkPart)) {
                await fsp.unlink(chunkPart).catch(() => {});
            }

            if (start > 0) {
                let curSize = 0;
                try {
                    const st = await fsp.stat(chunkPart);
                    curSize = st.size;
                } catch {
                    return res.status(400).json({ success: false, message: "Chunk out of sequence" });
                }
                if (curSize !== start) {
                    return res.status(400).json({ success: false, message: `Chunk offset mismatch (expected ${curSize}, got ${start})` });
                }
            }

            let bytes = 0;
            let failed = null;
            try {
                await new Promise((resolve, reject) => {
                    const out = fs.createWriteStream(chunkPart, { flags: start === 0 ? "w" : "a" });
                    const stop = (status, message) => {
                        if (failed) return;
                        failed = [status, message];
                        req.unpipe(out);
                        out.destroy();
                        reject(new Error(message));
                    };
                    req.on("data", (chunk) => {
                        bytes += chunk.length;
                        if (start + bytes > req.uploadLimit) stop(413, "File is too large");
                    });
                    req.on("aborted", () => stop(400, "Chunk upload was interrupted"));
                    req.on("error", (err) => stop(400, "Chunk upload error: " + err.message));
                    out.on("error", (err) => stop(500, "Disk write error: " + err.message));
                    out.on("finish", resolve);
                    req.pipe(out);
                });

                const finalSize = start + bytes;
                const isComplete = finalSize >= total;
                if (isComplete) {
                    await fsp.rename(chunkPart, abs);
                    return res.json({ success: true, complete: true, size: finalSize });
                }
                return res.json({ success: true, complete: false, nextByte: finalSize });
            } catch (err) {
                const [status, message] = failed || [500, "Chunk write failed"];
                if (status === 500) console.error("upload-file chunk error:", err.message);
                if (res.headersSent || req.destroyed) return;
                return res.status(status).json({ success: false, message });
            }
        }

        // Written to a ".part" file first and renamed when complete, so a
        // broken-off upload never leaves a half file under the real key.
        const part = `${abs}.part-${crypto.randomBytes(6).toString("hex")}`;
        let bytes = 0;
        let failed = null; // [status, message]
        try {
            await fsp.mkdir(path.dirname(abs), { recursive: true });
            await new Promise((resolve, reject) => {
                const out = fs.createWriteStream(part, { flags: "wx" });
                const stop = (status, message) => {
                    if (failed) return;
                    failed = [status, message];
                    req.unpipe(out);
                    out.destroy();
                    reject(new Error(message));
                };
                req.on("data", (chunk) => {
                    bytes += chunk.length;
                    if (bytes > req.uploadLimit) stop(413, "File is too large");
                });
                req.on("aborted", () => stop(400, "Upload was interrupted"));
                req.on("error", (err) => stop(400, "Upload was interrupted: " + err.message));
                out.on("error", (err) => stop(500, "Upload failed: " + err.message));
                out.on("finish", resolve);
                req.pipe(out);
            });

            if (!bytes) {
                await fsp.unlink(part).catch(() => {});
                return res.status(400).json({ success: false, message: "Empty file" });
            }
            await fsp.rename(part, abs);

            return res.json({ success: true });
        } catch (err) {
            await fsp.unlink(part).catch(() => {});
            const [status, message] = failed || [500, "Upload failed"];
            if (status === 500) console.error("upload-file error:", err.message);
            if (res.headersSent || req.destroyed) return;
            // the rest of a refused body isn't read: close the connection after replying
            if (status === 413) res.set("Connection", "close");
            return res.status(status).json({ success: false, message: status === 500 ? "Upload failed" : message });
        }
    });

    router.post("/get-upload-url", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y,1,2,3"))) return;

        const {
            fileName,
            fileType
        } = req.body;

        // 🔒 Validate file type
        if (!allowedTypes.includes(fileType)) {
            return res.status(400).json({
                success: false,
                message: "File type not allowed",
            });
        }

        const ext = fileName.split(".").pop().toLowerCase();

        const allowedExt = [
            "mp4", "mov", "avi", "mkv", "webm",
            "jpg", "jpeg", "png", "webp", "gif",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
            "zip"
        ];

        if (!allowedExt.includes(ext)) {
            return res.json({
                success: false,
                message: "Invalid file extension",
            });
        }

        const random = crypto
            .randomBytes(32)
            .toString("hex");
        // Generate S3 Key
        const n =
            "a" + md5(Math.random() + Date.now() + random);

        // Sanitize the client filename before using it in the object key: strip
        // any path components and unsafe characters (audit SEC-16).
        const safeName = String(fileName)
            .split(/[\\/]/).pop()
            .replace(/[^\w.\-]/g, "_")
            .slice(-100);

        // Files always land in the temp prefix first, then moveS3File() promotes
        // them to their final key on save (unchanged from the S3 flow).
        const s3Key = `riviratech/temp/${n}-${safeName}`;

        try {

            // Short-lived, HMAC-signed local upload URL (the PUT itself carries no
            // cookies, so the signature is what authorises the write).
            const exp = Date.now() + UPLOAD_TTL_MS;
            const max = String(fileType).startsWith("video/") ? VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
            const sig = signUpload(s3Key, exp, max);
            const base = publicBase(req);
            const uploadURL = `${base}/api/upload-file?key=${encodeURIComponent(s3Key)}&exp=${exp}&max=${max}&sig=${sig}`;

            // ✅ Public URL (for open/download) — served by the Node server.
            const fileURL = `${base}/uploads/${s3Key}`;

            res.json({
                success: true,
                uploadURL, // for upload
                uploadUrl: uploadURL,
                key: s3Key, // for DB
                fileKey: s3Key,
                fileURL,   // 🔥 for open/download
                fileUrl: fileURL,
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false,
                message: err.message
            });

        }
    });

    router.post("/get-upload-urls", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y,1,2,3"))) return;

        const { files } = req.body;

        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.json({
                success: false,
                message: "No files provided"
            });
        }

        // No SVG: it can carry script (audit SEC-16), and /upload-file refuses
        // it anyway — offering it here only produced uploads that then failed.
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        const allowedExt = [
            "jpg", "jpeg", "png", "webp", "gif"
        ];

        const uploadList = [];

        try {

            for (const file of files) {

                const { fileName, fileType } = file;

                if (!allowedTypes.includes(fileType)) {
                    continue;
                }

                const ext = fileName.split(".").pop().toLowerCase();

                if (!allowedExt.includes(ext)) {
                    continue;
                }

                const random = crypto.randomBytes(32).toString("hex");

                const n = "a" + md5(Math.random() + Date.now() + random);

                // Sanitize the client filename before it becomes part of a key /
                // on-disk path: strip path components and unsafe characters.
                const safeName = String(fileName)
                    .split(/[\\/]/).pop()
                    .replace(/[^\w.\-]/g, "_")
                    .slice(-100);

                const s3Key = `riviratech/temp/${n}-${safeName}`;

                const exp = Date.now() + UPLOAD_TTL_MS;
                const sig = signUpload(s3Key, exp, IMAGE_UPLOAD_BYTES);
                const base = publicBase(req);
                const uploadURL = `${base}/api/upload-file?key=${encodeURIComponent(s3Key)}&exp=${exp}&max=${IMAGE_UPLOAD_BYTES}&sig=${sig}`;
                const fileURL = `${base}/uploads/${s3Key}`;

                uploadList.push({
                    uploadURL,
                    key: s3Key,
                    fileURL
                });

            }

            return res.json({
                success: true,
                files: uploadList
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                message: err.message
            });

        }

    });
};

// the resume upload URL (website/careers) uses this cap
module.exports.RESUME_UPLOAD_BYTES = RESUME_UPLOAD_BYTES;
