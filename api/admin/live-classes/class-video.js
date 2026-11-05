/**
 * Class recordings: storage, FFmpeg HLS (AES-128) processing, and playback for the
 * people allowed to watch. Used by live-classes.js.
 *
 * An uploaded recording is moved to its class's folder:
 *   uploads/riviratech/classes/<course>/<batch>/<class>/<file>
 * where the original is NOT served to the public: server.js refuses /uploads
 * requests for video files at that depth, so it is only ever played through the
 * checks below. The class gets a delivery mode:
 *   "mp4"  the original, streamed by GET /api/class-video/<class>
 *          (signed-in viewers only, byte ranges for seeking)
 *   "hls"  a background job (liveclass_hls_queue) runs FFmpeg into 6-second HLS segments,
 *          each encrypted with AES-128 under a fresh random key:
 *            segments  uploads/riviratech/classes/<course>/<batch>/<class>/hls/<version>/
 *                      (public, useless without the key)
 *            key       PRIVATE_MEDIA_DIR/keys/<class>/<version>.key — kept apart
 *                      from the videos, outside the project
 *          The playlist points at GET /api/hls-key/<class>/<version>, which hands
 *          the key only to an admin, the class's trainer, or an enrolled student.
 *   ""     older classes: the recording stays a public upload (unchanged).
 *
 * Storage (liveclasses.video_storage): "server" as above, or "gdrive" — Google
 * Drive through class-drive.js, same folder layout. An Original (MP4) and a
 * document go straight from the browser to Drive; a Secure stream is converted
 * here first, then the playlist, segments, wrapped key and (unless "delete the
 * original" was ticked) the original are uploaded, and the local copies go.
 * Drive files are streamed through the API (class-video, class-hls, class-doc)
 * after the same viewer checks.
 *
 * Jobs: retried up to 3 times (1 min, then 5 min later), partial output and
 * temp files removed after every failed try; then "failed" with a Retry button.
 * Each job is tagged with the machine that holds the file (VIDEO_QUEUE_ORIGIN,
 * default the host name): the API instances sharing this database never pick
 * up a job whose file is on another machine.
 *
 * Settings (api/.env or the service environment):
 *   PRIVATE_MEDIA_DIR        default ~/.riviratech-private (keys + FFmpeg temp files)
 *   FFMPEG_PATH, FFPROBE_PATH default "ffmpeg", "ffprobe" (on PATH)
 *   VIDEO_QUEUE_ORIGIN       default the host name
 *   VIDEO_JOB_TIMEOUT_MIN    default 180
 *   VIDEO_RETRY_DELAYS       default "60,300" (seconds before the 2nd / 3rd try)
 */
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const startup = require("../../shared/startup");
const drive = require("./class-drive");
const adminPerms = require("../../security/admin-permissions");

const PRIVATE_DIR = path.resolve(process.env.PRIVATE_MEDIA_DIR || path.join(os.homedir(), ".riviratech-private"));
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const ORIGIN = String(process.env.VIDEO_QUEUE_ORIGIN || os.hostname()).slice(0, 120);
const JOB_TIMEOUT_MS = (Number(process.env.VIDEO_JOB_TIMEOUT_MIN) || 180) * 60 * 1000;
const MAX_ATTEMPTS = 3;
// seconds before the 2nd and 3rd try (VIDEO_RETRY_DELAYS="60,300")
const RETRY_DELAY_S = String(process.env.VIDEO_RETRY_DELAYS || "60,300").split(",").map((x) => Math.max(1, Number(x) || 60));
const VIDEO_EXT = ["mp4", "mov", "mkv", "webm", "avi", "m4v"];
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const now = () => Math.floor(Date.now() / 1000);
const randHex = (n) => crypto.randomBytes(n).toString("hex");

// A path inside PRIVATE_DIR, or null if `rel` would leave it.
function privatePath(rel) {
    const abs = path.resolve(PRIVATE_DIR, String(rel || "").replace(/^[\\/]+/, ""));
    return abs.startsWith(PRIVATE_DIR + path.sep) ? abs : null;
}

// rename, or copy + delete when source and target are on different drives
async function moveFile(src, dest) {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try {
        await fsp.rename(src, dest);
    } catch (err) {
        if (err.code !== "EXDEV") throw err;
        await fsp.copyFile(src, dest);
        await fsp.unlink(src);
    }
}
async function moveDir(src, dest) {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try {
        await fsp.rename(src, dest);
    } catch (err) {
        if (err.code !== "EXDEV") throw err;
        await fsp.cp(src, dest, { recursive: true });
        await fsp.rm(src, { recursive: true, force: true });
    }
}
const isVideoFile = (rel) => VIDEO_EXT.includes(String(rel || "").split(".").pop().toLowerCase());
const rmQuiet = (abs) => (abs ? fsp.rm(abs, { recursive: true, force: true }).catch(() => {}) : Promise.resolve());

// Programs still running (FFmpeg); stopped with the API so none is left converting
// with no one to finish its job.
const children = new Set();
process.on("exit", () => {
    for (const c of children) try { c.kill("SIGKILL"); } catch { /* gone */ }
});

// Run a program; resolves { code, out, err } (err = the last part of stderr).
// onOut, if given, gets each piece of stdout as it arrives.
function run(cmd, args, timeoutMs, onOut) {
    return new Promise((resolve) => {
        let out = "", err = "", done = false;
        const child = spawn(cmd, args, { windowsHide: true });
        children.add(child);
        child.on("close", () => children.delete(child));
        const timer = setTimeout(() => {
            err += "\n[timed out]";
            try { child.kill("SIGKILL"); } catch { /* gone */ }
        }, timeoutMs);
        child.stdout.on("data", (d) => { out += d; if (out.length > 200000) out = out.slice(-200000); if (onOut) onOut(String(d)); });
        child.stderr.on("data", (d) => { err += d; if (err.length > 8000) err = err.slice(-8000); });
        const finish = (code) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, out, err: err.trim() }); };
        child.on("error", (e) => { err += "\n" + e.message; finish(-1); });
        child.on("close", finish);
    });
}

module.exports = function classVideo(ctx) {
    const { db, resolveUploadPath, checkStatus } = ctx;
    const q = (sql, params) => db.pool.query(sql, params).then((r) => r.rows);
    // what students watched, and the lock on the next recording (class-views.js)
    const views = require("./class-views")(ctx);

    const ready = startup.setup("liveclass_hls_queue table", async () => {
        await db.pool.query(`CREATE TABLE IF NOT EXISTS liveclass_hls_queue (
            id BIGSERIAL PRIMARY KEY,
            req_id TEXT NOT NULL,
            source TEXT NOT NULL,
            origin TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            attempts INTEGER NOT NULL DEFAULT 0,
            run_at BIGINT NOT NULL DEFAULT 0,
            locked_at BIGINT NOT NULL DEFAULT 0,
            last_error TEXT NOT NULL DEFAULT '',
            stage TEXT NOT NULL DEFAULT '',
            work TEXT NOT NULL DEFAULT '',
            created BIGINT NOT NULL DEFAULT 0,
            updated BIGINT NOT NULL DEFAULT 0
        )`);
        await db.pool.query("ALTER TABLE liveclass_hls_queue ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT ''");
        await db.pool.query("ALTER TABLE liveclass_hls_queue ADD COLUMN IF NOT EXISTS work TEXT NOT NULL DEFAULT ''");
        await db.pool.query("CREATE INDEX IF NOT EXISTS liveclass_hls_queue_pick_idx ON liveclass_hls_queue (status, origin, run_at)");
        await db.pool.query("ALTER TABLE liveclasses ADD COLUMN IF NOT EXISTS video_storage TEXT NOT NULL DEFAULT 'server'");
        await db.pool.query("ALTER TABLE liveclasses ADD COLUMN IF NOT EXISTS video_name TEXT NOT NULL DEFAULT ''");
        await db.pool.query("ALTER TABLE liveclasses ADD COLUMN IF NOT EXISTS video_size BIGINT NOT NULL DEFAULT 0");
        await db.pool.query("ALTER TABLE liveclasses ADD COLUMN IF NOT EXISTS video_duration INTEGER NOT NULL DEFAULT 0"); // seconds, 0 = not known yet
        await db.pool.query(`CREATE TABLE IF NOT EXISTS liveclass_drive_files (
            req_id TEXT NOT NULL,
            ver TEXT NOT NULL,
            name TEXT NOT NULL,
            drive_id TEXT NOT NULL,
            size BIGINT NOT NULL DEFAULT 0,
            created BIGINT NOT NULL DEFAULT 0,
            PRIMARY KEY (req_id, ver, name)
        )`);
    });

    /* ---------------- upload → private storage ---------------- */

    // A stored recording on disk: "riviratech/classes/..." in uploads, or an older
    // "videos/..." path in the private folder.
    const mediaPath = (rel) =>
        drive.isDrive(rel) ? null : String(rel || "").startsWith("riviratech/") ? resolveUploadPath(rel) : privatePath(rel);
    // a stored file, on this server or on Drive ("gdrive:<id>")
    const removeMedia = (rel) => (drive.isDrive(rel) ? drive.trash(drive.idOf(rel)) : rmQuiet(mediaPath(rel)));

    // Move a fresh upload (riviratech/temp/...) into its class's folder; returns
    // "riviratech/classes/<course>/<batch>/<class>/<file>", or "" when the key /
    // ids / type aren't acceptable. Throws an Error with a user-facing message
    // when Google Drive quota or upload fails.
    async function storeUpload(tempKey, cid, bid, reqId, storage, delivery) {
        const key = String(tempKey || "");
        // already uploaded to Google Drive by the browser: checked and moved into the class's Drive folder
        if (drive.isDrive(key)) {
            if (!drive.enabled()) throw new Error("Google Drive is not configured on the server.");
            return await drive.claim(drive.idOf(key), "video", cid, bid, reqId);
        }
        if (!key.startsWith("riviratech/temp/")) return "";
        if (![cid, bid, reqId].every((x) => SAFE_ID.test(String(x || "")))) return "";
        if (!isVideoFile(key)) return "";
        const src = resolveUploadPath(key);
        if (!src || !fs.existsSync(src)) return "";
        if (storage === "gdrive" && delivery === "mp4") {
            if (!drive.enabled()) throw new Error("Google Drive is not configured on the server.");
            const driveKey = await drive.storeServerFile(src, key.split("/").pop(), "video", cid, bid, reqId);
            await rmQuiet(src);
            return driveKey;
        }
        if (storage === "gdrive" && delivery !== "mp4") {
            // Verify Drive quota upfront before queuing HLS conversion for Drive
            const st = await fsp.stat(src);
            const qCheck = await drive.verifyStorage(st.size);
            if (!qCheck.ok) throw new Error(qCheck.error);
        }
        const rel = `riviratech/classes/${cid}/${bid}/${reqId}/${key.split("/").pop()}`;
        const dest = resolveUploadPath(rel);
        if (!dest) return "";
        await moveFile(src, dest);
        return rel;
    }

    // Remove a class's encrypted copies + keys (all versions).
    async function removeHls(reqId, playlist) {
        // ".../<class>/hls/<version>/index.m3u8" → ".../<class>/hls"
        if (playlist && playlist.startsWith("riviratech/") && playlist.includes("/hls/")) {
            await rmQuiet(resolveUploadPath(path.dirname(path.dirname(playlist))));
        }
        // a Drive copy: its hls/<version> folders go to the Drive trash
        if (playlist && playlist.startsWith("api/class-hls/") && SAFE_ID.test(String(reqId || ""))) {
            for (const r of await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND name = '_folder'", [reqId])) await drive.trash(r.drive_id);
            await q("DELETE FROM liveclass_drive_files WHERE req_id = $1", [reqId]);
        }
        if (SAFE_ID.test(String(reqId || ""))) await rmQuiet(privatePath("keys/" + reqId));
    }

    // After the class row has its new recording (file = the private path):
    // set the delivery mode, clear what the old recording left, queue HLS work.
    // deleteOriginal "1" (Secure stream only): remove the upload once the encrypted
    // copy is ready; anything else keeps it.
    // storage "gdrive": an Original already on Drive (rel = "gdrive:<id>"), or a
    // Secure stream converted here and then uploaded to Drive.
    async function afterSave(reqId, rel, delivery, deleteOriginal, storage, metaInfo = {}) {
        await ready;
        const onDrive = storage === "gdrive" || drive.isDrive(rel);
        // a file already on Drive can be streamed as Original or converted to Secure stream
        const mode = delivery === "mp4" ? "mp4" : "hls"; // Secure stream unless Original is chosen
        const delOrig = mode === "hls" && String(deleteOriginal) === "1" ? 1 : 0;
        const [prev] = await q("SELECT video_private, hls_playlist FROM liveclasses WHERE req_id = $1", [reqId]);
        if (!prev) return;

        let vName = String(metaInfo.name || "").trim();
        let vSize = Number(metaInfo.size) || 0;
        if (!vName || !vSize) {
            if (drive.isDrive(rel)) {
                const dm = await drive.meta(drive.idOf(rel), "name,size").catch(() => null);
                if (dm) {
                    if (!vName && dm.name) vName = String(dm.name).replace(/^[a-z0-9]+-[a-f0-9]{6}-/, "");
                    if (!vSize && dm.size) vSize = Number(dm.size) || 0;
                }
            } else {
                const abs = mediaPath(rel);
                if (abs) {
                    if (!vName) vName = path.basename(abs).replace(/^\d+-[a-z0-9_]+-/, "");
                    if (!vSize) {
                        const st = await fsp.stat(abs).catch(() => null);
                        if (st) vSize = Number(st.size) || 0;
                    }
                }
            }
        }

        await q("DELETE FROM liveclass_hls_queue WHERE req_id = $1 AND status IN ('queued', 'failed')", [reqId]); // replaced by the new one
        await q(
            `UPDATE liveclasses SET video_mode = $2, video_status = $3, video_private = $4, hls_playlist = '', hls_key_id = '',
             video_error = '', video_progress = 0, video_delete_original = $6, video_storage = $7, video_name = $8, video_size = $9, video_duration = 0, video_updated = $5, type = '1' WHERE req_id = $1`,
            [reqId, mode, mode === "hls" ? "pending" : "ready", rel, now(), delOrig, onDrive ? "gdrive" : "server", vName, vSize]
        );
        if (prev.video_private && prev.video_private !== rel) await removeMedia(prev.video_private);
        await removeHls(reqId, prev.hls_playlist);
        if (mode === "hls") await enqueue(reqId, rel);
    }

    async function enqueue(reqId, source) {
        await ready;
        const t = now();
        await q("INSERT INTO liveclass_hls_queue (req_id, source, origin, status, attempts, run_at, created, updated) VALUES ($1, $2, $3, 'queued', 0, $4, $4, $4)", [reqId, source, ORIGIN, t]);
        if (startup.runsSetup) setImmediate(tick);
    }

    /* ---------------- the worker (one job at a time, leader process) ---------------- */

    let busy = false;
    let recovered = false;
    async function tick() {
        if (busy) return;
        busy = true;
        try {
            await ready;
            if (!recovered) {
                // This process has just started, so none of this machine's jobs can
                // still be converting: a "running" one was cut off by a restart or
                // crash. Start it again now (that try doesn't count) instead of
                // after the time-out below, and drop its half-made files.
                const back = await q(
                    `UPDATE liveclass_hls_queue SET status = 'queued', run_at = $1, attempts = GREATEST(attempts - 1, 0), updated = $1
                     WHERE status = 'running' AND origin = $2 RETURNING req_id`, [now(), ORIGIN]);
                // (drive-out/ is kept: a job cut off while uploading to Drive resumes from it)
                if (back.length) console.log(`video jobs: restarting ${back.length} cut off by a restart`);
                for (const d of await fsp.readdir(privatePath("tmp")).catch(() => [])) await rmQuiet(privatePath("tmp/" + d));
                recovered = true;
            }
            const t = now();
            // a job still "running" long after it should have finished (its process hung)
            await q("UPDATE liveclass_hls_queue SET status = 'queued', run_at = $1, updated = $1 WHERE status = 'running' AND origin = $2 AND locked_at < $3",
                [t, ORIGIN, t - Math.ceil(JOB_TIMEOUT_MS / 1000) - 600]);
            for (;;) {
                const [job] = await q(
                    `UPDATE liveclass_hls_queue SET status = 'running', locked_at = $1, attempts = attempts + 1, updated = $1
                     WHERE id = (SELECT id FROM liveclass_hls_queue WHERE status = 'queued' AND origin = $2 AND run_at <= $1
                                 ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
                     RETURNING *`, [now(), ORIGIN]);
                if (!job) break;
                await processJob(job);
            }
        } catch (err) {
            console.error("video jobs:", err.message);
        } finally {
            busy = false;
        }
    }

    async function probe(abs) {
        const r = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name", "-of", "json", abs], 2 * 60 * 1000);
        if (r.code !== 0) throw new Error("Not a readable video (" + (r.err.split("\n").pop() || "ffprobe failed") + ")");
        const json = JSON.parse(r.out || "{}");
        const streams = json.streams || [];
        const v = streams.find((s) => s.codec_type === "video");
        const a = streams.find((s) => s.codec_type === "audio");
        if (!v) throw new Error("The file has no video stream");
        const duration = Number(json.format && json.format.duration) || 0; // seconds, 0 if unknown
        return { videoCopy: v.codec_name === "h264", audio: !!a, audioCopy: !a || a.codec_name === "aac", duration };
    }

    // How far FFmpeg has got, saved as liveclasses.video_progress (0-99 while it runs;
    // 100 when ready) at most every 3 seconds, for the "Preparing video… 45%" display.
    function progressSaver(reqId, source, duration) {
        if (!(duration > 0)) return undefined;
        let saved = 0, lastAt = 0, rest = "";
        return (chunk) => {
            const lines = (rest + chunk).split("\n");
            rest = lines.pop();
            for (const line of lines) {
                const m = /^out_time_us=(\d+)/.exec(line.trim());
                if (!m) continue;
                const pct = Math.min(99, Math.floor((Number(m[1]) / 1e6 / duration) * 100));
                const t = Date.now();
                if (pct <= saved || t - lastAt < 3000) continue;
                saved = pct;
                lastAt = t;
                q("UPDATE liveclasses SET video_progress = $2 WHERE req_id = $1 AND video_private = $3 AND video_status = 'processing'",
                    [reqId, pct, source]).catch(() => {});
            }
        };
    }

    // Upload a converted Secure stream (and the original) to Drive. outDir holds
    // index.m3u8 + seg_*.ts; pieces already uploaded (liveclass_drive_files) are skipped,
    // so a retry after a failure or restart carries on where it stopped.
    async function publishToDrive(job, cls, ver, outDir, key) {
        const reqId = cls.req_id;
        await q("UPDATE liveclass_hls_queue SET stage = 'upload', work = $2, updated = $3 WHERE id = $1", [job.id, ver, now()]);
        await q("UPDATE liveclasses SET video_status = 'uploading', video_progress = 0, video_updated = $2 WHERE req_id = $1 AND video_private = $3",
            [reqId, now(), job.source]);
        const folderId = await drive.hlsFolder(cls.c_id, cls.b_id, reqId, ver);
        const rec = (name, id, size) =>
            q(`INSERT INTO liveclass_drive_files (req_id, ver, name, drive_id, size, created) VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (req_id, ver, name) DO UPDATE SET drive_id = EXCLUDED.drive_id, size = EXCLUDED.size`, [reqId, ver, name, id, size, now()]);
        await rec("_folder", folderId, 0);
        const have = new Map((await q("SELECT name, drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2", [reqId, ver])).map((r) => [r.name, r.drive_id]));

        const pieces = [];
        for (const name of await fsp.readdir(outDir)) {
            if (name === "index.m3u8" || /^seg_\d+\.ts$/.test(name)) pieces.push({ name, size: (await fsp.stat(path.join(outDir, name))).size });
        }
        const src = drive.isDrive(job.source) ? null : mediaPath(job.source);
        const keepOriginal = !Number(cls.video_delete_original);
        const origSize = Number(cls.video_size) || (src && fs.existsSync(src) ? (await fsp.stat(src)).size : 0);
        const total = pieces.reduce((t, p) => t + p.size, 0) + (keepOriginal ? origSize : 0) || 1;
        let sent = pieces.filter((p) => have.has(p.name)).reduce((t, p) => t + p.size, 0) + (have.has("_original") ? origSize : 0);
        let lastAt = 0;
        const report = (extra = 0) => {
            const t = Date.now();
            if (t - lastAt < 3000) return;
            lastAt = t;
            const pct = Math.min(99, Math.floor(((sent + extra) / total) * 100));
            q("UPDATE liveclasses SET video_progress = $2 WHERE req_id = $1 AND video_private = $3 AND video_status = 'uploading'", [reqId, pct, job.source]).catch(() => {});
        };

        // the pieces, four at a time
        const todo = pieces.filter((p) => !have.has(p.name));
        let next = 0;
        const worker = async () => {
            while (next < todo.length) {
                const p = todo[next++];
                const id = await drive.uploadFile(path.join(outDir, p.name), {
                    name: p.name,
                    mimeType: p.name.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t",
                    parentId: folderId,
                });
                await rec(p.name, id, p.size);
                sent += p.size;
                report();
            }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        // the key, wrapped (the server keeps its plain copy as a cache)
        if (!have.has("key.bin")) {
            const id = await drive.uploadBuffer(drive.wrapKey(key), { name: "key.bin", mimeType: "application/octet-stream", parentId: folderId });
            await rec("key.bin", id, 44);
        }
        // the original, beside the class's other files
        let originalId = have.get("_original") || "";
        if (drive.isDrive(job.source)) {
            if (keepOriginal) {
                originalId = drive.idOf(job.source);
                if (!have.has("_original")) {
                    await rec("_original", originalId, origSize);
                }
            } else {
                await drive.trash(drive.idOf(job.source)).catch(() => {});
            }
        } else if (keepOriginal && !originalId && src && fs.existsSync(src)) {
            originalId = await drive.uploadFile(src, {
                name: path.basename(src),
                mimeType: "video/" + (path.extname(src).slice(1).toLowerCase().replace("mov", "quicktime").replace("mkv", "x-matroska") || "mp4"),
                parentId: await drive.classFolder(cls.c_id, cls.b_id, reqId),
                onProgress: (done) => report(done),
            });
            await rec("_original", originalId, origSize);
        }
        return originalId;
    }

    async function processJob(job) {
        const reqId = job.req_id;
        let tmpDir = null, keyAbs = null, published = null, outDir = null, driveTemp = null;
        try {
            const [cls] = await q("SELECT req_id, c_id, b_id, video_mode, video_private, video_storage, video_delete_original, video_size FROM liveclasses WHERE req_id = $1", [reqId]);
            if (!cls || cls.video_mode !== "hls" || cls.video_private !== job.source) {
                await q("DELETE FROM liveclass_hls_queue WHERE id = $1", [job.id]); // not needed any more
                return;
            }
            if (![cls.c_id, cls.b_id, reqId].every((x) => SAFE_ID.test(String(x || "")))) throw new Error("Unexpected class ids");
            const onDrive = cls.video_storage === "gdrive" || drive.isDrive(cls.video_private);
            if (onDrive && !drive.enabled()) throw new Error("Google Drive isn't set up on this server");

            // a Drive upload that stopped part-way: carry on from its saved output
            const resumeDir = job.stage === "upload" && /^[a-f0-9]{16}$/.test(job.work) ? privatePath(`drive-out/${reqId}/${job.work}`) : null;
            const resumeKey = resumeDir ? privatePath(`keys/${reqId}/${job.work}.key`) : null;
            if (onDrive && resumeDir && fs.existsSync(path.join(resumeDir, "index.m3u8")) && fs.existsSync(resumeKey)) {
                outDir = resumeDir;
                keyAbs = resumeKey;
                return await finishDrive(job, cls, job.work, outDir, keyAbs, await fsp.readFile(keyAbs));
            }
            await q("UPDATE liveclasses SET video_status = 'processing', video_progress = 0, video_updated = $2 WHERE req_id = $1", [reqId, now()]);

            let src = null;
            if (drive.isDrive(job.source)) {
                const driveId = drive.idOf(job.source);
                driveTemp = privatePath(`tmp/drive-src-${job.id}-${randHex(6)}.mp4`);
                await fsp.mkdir(path.dirname(driveTemp), { recursive: true });
                const buf = await drive.download(driveId);
                await fsp.writeFile(driveTemp, buf);
                src = driveTemp;
            } else {
                src = mediaPath(job.source);
                if (!src || !fs.existsSync(src)) throw new Error("The uploaded file is missing");
            }
            const info = await probe(src);
            if (info.duration > 0)
                await q("UPDATE liveclasses SET video_duration = $2 WHERE req_id = $1 AND video_private = $3", [reqId, Math.round(info.duration), job.source]);

            const ver = randHex(8);
            const key = crypto.randomBytes(16);
            const iv = randHex(16);
            keyAbs = privatePath(`keys/${reqId}/${ver}.key`);
            await fsp.mkdir(path.dirname(keyAbs), { recursive: true });
            await fsp.writeFile(keyAbs, key, { mode: 0o600 });

            // on Drive the output is kept in drive-out/ until every piece is uploaded
            tmpDir = onDrive ? privatePath(`drive-out/${reqId}/${ver}`) : privatePath(`tmp/job-${job.id}-${ver}`);
            await fsp.mkdir(tmpDir, { recursive: true });
            const keyInfo = path.join(tmpDir, "key.info");
            // line 1: the key's URL in the playlist; 2: the key file; 3: the IV
            await fsp.writeFile(keyInfo, `/api/hls-key/${reqId}/${ver}\n${keyAbs}\n${iv}\n`, { mode: 0o600 });

            // "-progress pipe:1": FFmpeg writes key=value lines (out_time_us=...) to stdout as it goes
            const args = ["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y", "-i", src, "-map", "0:v:0", "-map", "0:a:0?"];
            args.push(...(info.videoCopy ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p"]));
            if (info.audio) args.push(...(info.audioCopy ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "128k"]));
            args.push("-f", "hls", "-hls_time", onDrive ? "10" : "6", "-hls_playlist_type", "vod", "-hls_key_info_file", keyInfo,
                "-hls_segment_filename", path.join(tmpDir, "seg_%04d.ts"), path.join(tmpDir, "index.m3u8"));
            const r = await run(FFMPEG, args, JOB_TIMEOUT_MS, progressSaver(reqId, job.source, info.duration));
            if (r.code !== 0) throw new Error("FFmpeg failed: " + (r.err.split("\n").slice(-2).join(" ") || "exit " + r.code));

            const playlistText = await fsp.readFile(path.join(tmpDir, "index.m3u8"), "utf8").catch(() => "");
            if (!/#EXT-X-KEY:METHOD=AES-128/.test(playlistText) || !/\.ts/.test(playlistText)) throw new Error("FFmpeg made no encrypted playlist");
            await fsp.rm(keyInfo, { force: true });

            if (onDrive) {
                outDir = tmpDir;
                tmpDir = null;
                const ret = await finishDrive(job, cls, ver, outDir, keyAbs, key);
                if (driveTemp) await rmQuiet(driveTemp);
                return ret;
            }

            const destRel = `riviratech/classes/${cls.c_id}/${cls.b_id}/${reqId}/hls/${ver}`;
            const destAbs = resolveUploadPath(destRel);
            if (!destAbs) throw new Error("Unsafe output path");
            await moveDir(tmpDir, destAbs);
            tmpDir = null;
            published = destAbs;

            // the class may have had its video replaced while this ran
            const done = await q(
                `UPDATE liveclasses SET video_status = 'ready', hls_playlist = $2, hls_key_id = $3, video_error = '', video_progress = 100, video_updated = $4
                 WHERE req_id = $1 AND video_mode = 'hls' AND video_private = $5 RETURNING req_id, video_delete_original`,
                [reqId, destRel + "/index.m3u8", ver, now(), job.source]);
            if (!done.length) {
                await rmQuiet(published);
                await rmQuiet(keyAbs);
                if (driveTemp) await rmQuiet(driveTemp);
                await q("DELETE FROM liveclass_hls_queue WHERE id = $1", [job.id]); // not needed any more
                return;
            }
            // older versions of this class's encrypted copy, and their keys
            const classDir = path.dirname(destAbs);
            for (const d of await fsp.readdir(classDir).catch(() => [])) if (d !== ver) await rmQuiet(path.join(classDir, d));
            const keyDir = path.dirname(keyAbs);
            for (const f of await fsp.readdir(keyDir).catch(() => [])) if (f !== ver + ".key") await rmQuiet(path.join(keyDir, f));
            // the admin chose not to keep the original once the secure stream is ready
            if (Number(done[0].video_delete_original) === 1 && !drive.isDrive(job.source)) await rmQuiet(mediaPath(job.source));
            if (driveTemp) await rmQuiet(driveTemp);
            await q("DELETE FROM liveclass_hls_queue WHERE id = $1", [job.id]); // finished: the class itself now says ready
        } catch (err) {
            if (driveTemp) await rmQuiet(driveTemp);
            // no server paths in what admins see
            const msg = String(err && err.message ? err.message : err)
                .split(PRIVATE_DIR).join("[private]")
                .split(resolveUploadPath("")).join("[private]")
                .replace(/\[private\][^:()\n]*:\s*/g, "")
                .slice(0, 500);
            console.error(`video job ${job.id} (${reqId}) try ${job.attempts}:`, msg);
            await rmQuiet(tmpDir);
            const last = job.attempts >= MAX_ATTEMPTS;
            if (outDir) {
                // a Drive upload: the converted output and its key stay for the next try
                if (last) {
                    await rmQuiet(outDir);
                    await rmQuiet(keyAbs);
                    const ver = path.basename(outDir);
                    for (const r of await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2 AND name IN ('_folder', '_original')", [reqId, ver]).catch(() => [])) await drive.trash(r.drive_id);
                    await q("DELETE FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2", [reqId, ver]).catch(() => {});
                    await q("UPDATE liveclass_hls_queue SET stage = '', work = '' WHERE id = $1", [job.id]).catch(() => {});
                }
            } else if (!published) await rmQuiet(keyAbs);
            await q("UPDATE liveclass_hls_queue SET status = $2, run_at = $3, last_error = $4, updated = $5 WHERE id = $1",
                [job.id, last ? "failed" : "queued", now() + (RETRY_DELAY_S[job.attempts - 1] || 300), msg, now()]).catch(() => {});
            await q("UPDATE liveclasses SET video_status = $2, video_error = $3, video_progress = 0, video_updated = $4 WHERE req_id = $1 AND video_private = $5",
                [reqId, last ? "failed" : "pending", msg, now(), job.source]).catch(() => {});
        }
    }

    // A Secure stream converted for Drive: upload it, then switch the class over.
    // If Google Drive rejects the upload with 403 (e.g., Service Account has 0 bytes
    // of storage quota on a personal Gmail Drive), publish the converted HLS stream
    // on the server so the class video is immediately playable instead of failing.
    async function finishDrive(job, cls, ver, outDir, keyAbs, key) {
        const reqId = cls.req_id;
        let originalId = "";
        try {
            originalId = await publishToDrive(job, cls, ver, outDir, key);
        } catch (driveErr) {
            const msg = String((driveErr && driveErr.message) || driveErr);
            if (/403|storageQuotaExceeded|quota/i.test(msg)) {
                console.warn(`video job ${job.id} (${reqId}): Drive upload rejected (${msg}); publishing converted HLS stream on server instead.`);
                for (const r of await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2 AND name IN ('_folder', '_original')", [reqId, ver]).catch(() => [])) await drive.trash(r.drive_id);
                await q("DELETE FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2", [reqId, ver]).catch(() => {});
                const destRel = `riviratech/classes/${cls.c_id}/${cls.b_id}/${reqId}/hls/${ver}`;
                const destAbs = resolveUploadPath(destRel);
                if (!destAbs) throw driveErr;
                await moveDir(outDir, destAbs);
                const doneLocal = await q(
                    `UPDATE liveclasses SET video_status = 'ready', hls_playlist = $2, hls_key_id = $3, video_error = $6, video_progress = 100, video_storage = 'server', video_updated = $4
                     WHERE req_id = $1 AND video_mode = 'hls' AND video_private = $5 RETURNING req_id, video_delete_original`,
                    [reqId, destRel + "/index.m3u8", ver, now(), job.source, msg]
                );
                if (doneLocal.length && Number(doneLocal[0].video_delete_original) === 1) await rmQuiet(mediaPath(job.source));
                await q("DELETE FROM liveclass_hls_queue WHERE id = $1", [job.id]); // finished: the class itself now says ready
                return;
            }
            throw driveErr;
        }
        const playlist = `api/class-hls/${reqId}/${ver}/index.m3u8`;
        const stored = originalId ? "gdrive:" + originalId : "";
        const done = await q(
            `UPDATE liveclasses SET video_status = 'ready', hls_playlist = $2, hls_key_id = $3, video_error = '', video_progress = 100,
               video_private = $5, file = $6, video_updated = $4
             WHERE req_id = $1 AND video_mode = 'hls' AND video_storage = 'gdrive' AND video_private = $7 RETURNING req_id`,
            [reqId, playlist, ver, now(), stored, stored || "gdrive-hls:" + ver, job.source]);
        if (!done.length) {
            // replaced or changed while uploading: this copy isn't needed
            for (const r of await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2 AND name IN ('_folder', '_original')", [reqId, ver])) await drive.trash(r.drive_id);
            await q("DELETE FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2", [reqId, ver]);
            await rmQuiet(outDir);
            await rmQuiet(keyAbs);
            await q("DELETE FROM liveclass_hls_queue WHERE id = $1", [job.id]); // not needed any more
            return;
        }
        // older Drive versions, the local output and the local original go; the key stays as a cache
        for (const r of await q("SELECT ver, drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver <> $2 AND name = '_folder'", [reqId, ver])) await drive.trash(r.drive_id);
        await q("DELETE FROM liveclass_drive_files WHERE req_id = $1 AND ver <> $2", [reqId, ver]);
        const keyDir = path.dirname(keyAbs);
        for (const kf of await fsp.readdir(keyDir).catch(() => [])) if (kf !== ver + ".key") await rmQuiet(path.join(keyDir, kf));
        await rmQuiet(outDir);
        if (!drive.isDrive(job.source)) await rmQuiet(mediaPath(job.source));
        await q("DELETE FROM liveclass_hls_queue WHERE id = $1", [job.id]); // finished: the class itself now says ready
    }

    // Remove a ready secure stream's uploaded original (an admin's choice later on);
    // the encrypted stream and its key stay. Returns an error message, or "".
    async function deleteOriginal(reqId) {
        const [cls] = await q("SELECT video_mode, video_status, video_private FROM liveclasses WHERE req_id = $1", [reqId]);
        if (!cls || cls.video_mode !== "hls") return "This class has no secure stream";
        if (cls.video_status !== "ready") return "The secure stream isn't ready yet, so the original is still needed";
        if (cls.video_private) await removeMedia(cls.video_private);
        await q("UPDATE liveclasses SET video_delete_original = 1, video_updated = $3 WHERE req_id = $1 AND video_private = $2", [reqId, cls.video_private, now()]);
        return "";
    }

    // A failed (or stuck) HLS conversion, or an MP4 to HLS conversion, from the private original.
    async function retry(reqId) {
        const [cls] = await q("SELECT video_mode, video_private, video_status FROM liveclasses WHERE req_id = $1", [reqId]);
        if (!cls || !cls.video_private) return "This class has no recording to prepare";
        if (cls.video_status === "ready" && cls.video_mode === "hls") return "This video is already ready";
        const isDrive = drive.isDrive(cls.video_private);
        if (!isDrive && (!mediaPath(cls.video_private) || !fs.existsSync(mediaPath(cls.video_private)))) {
            return "The original upload is missing (or was deleted) — please upload the video again";
        }
        await q("DELETE FROM liveclass_hls_queue WHERE req_id = $1 AND status IN ('queued', 'failed')", [reqId]); // replaced by the new one
        await q("UPDATE liveclasses SET video_mode = 'hls', video_status = 'pending', video_error = '', video_progress = 0, video_updated = $2 WHERE req_id = $1", [reqId, now()]);
        await enqueue(reqId, cls.video_private);
        return "";
    }

    startup.leaderInterval("video jobs", tick, 15 * 1000, 5 * 1000);
    // Daily: what the queue and the Drive map no longer need. Finished / cancelled jobs
    // are deleted at once; this catches the rest. A class still in deleted_records
    // (a delete that can be undone) keeps everything.
    const QUEUED_DAYS = 7;
    async function tidy() {
        await ready;
        const t = now();
        const kept = `EXISTS (SELECT 1 FROM deleted_records d WHERE d.table_name = 'liveclasses' AND d.deleted_data->>'req_id' = %s)`;
        // jobs of a class that's gone for good
        await q(`DELETE FROM liveclass_hls_queue j WHERE status <> 'running'
                 AND NOT EXISTS (SELECT 1 FROM liveclasses l WHERE l.req_id = j.req_id) AND NOT ${kept.replace("%s", "j.req_id")}`);
        // jobs whose class has moved on: another video, not a Secure stream now, or already ready
        await q(`DELETE FROM liveclass_hls_queue j USING liveclasses l WHERE l.req_id = j.req_id AND j.status IN ('queued', 'failed')
                 AND (l.video_private <> j.source OR l.video_mode <> 'hls' OR l.video_status = 'ready')`);
        // waiting a week and no server took it (the machine that has the file is gone or
        // off): the class shows "Video failed" with Retry instead of "Preparing" for ever
        const stale = await q(`DELETE FROM liveclass_hls_queue WHERE status = 'queued' AND created < $1 RETURNING req_id, source, origin`, [t - QUEUED_DAYS * 86400]);
        for (const j of stale) {
            await q(`UPDATE liveclasses SET video_status = 'failed', video_progress = 0, video_updated = $3,
                     video_error = $4 WHERE req_id = $1 AND video_private = $2 AND video_status IN ('pending', 'processing', 'uploading')`,
                [j.req_id, j.source, t, `No server prepared this video within ${QUEUED_DAYS} days (it was waiting on "${j.origin}"). Upload it again, or press Retry on the server that has the file.`]);
        }
        // failed jobs: kept a month for their error message
        await q("DELETE FROM liveclass_hls_queue WHERE status IN ('done', 'cancelled', 'failed') AND updated < $1", [t - 30 * 86400]);
        // Drive pieces of a class that's gone for good: its Drive folders to the trash
        const lost = await q(`SELECT DISTINCT f.req_id FROM liveclass_drive_files f
                              WHERE NOT EXISTS (SELECT 1 FROM liveclasses l WHERE l.req_id = f.req_id) AND NOT ${kept.replace("%s", "f.req_id")}`);
        for (const { req_id } of lost) {
            if (!drive.enabled()) break;
            for (const r of await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND name IN ('_folder', '_original')", [req_id])) await drive.trash(r.drive_id);
            await q("DELETE FROM liveclass_drive_files WHERE req_id = $1", [req_id]);
        }
        // Drive pieces of an older version the class no longer plays: that version's
        // folder to the trash, then its rows (its original, if any, is the class's own)
        const old = await q(`SELECT f.req_id, f.ver, f.drive_id FROM liveclass_drive_files f JOIN liveclasses l ON l.req_id = f.req_id
                             WHERE l.video_status = 'ready' AND l.hls_key_id <> '' AND f.ver <> l.hls_key_id AND f.name = '_folder'`);
        for (const r of old) {
            if (!drive.enabled()) break;
            await drive.trash(r.drive_id);
            await q("DELETE FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2 AND name <> '_original'", [r.req_id, r.ver]);
        }
        if (stale.length || lost.length) console.log(`video tidy: ${stale.length} unclaimed job(s) closed, ${lost.length} deleted class(es) cleared from Drive`);
    }
    startup.leaderInterval("video tidy", tidy, 24 * 60 * 60 * 1000, 2 * 60 * 1000);

    /* ---------------- who may watch ---------------- */

    // The signed-in viewer's role ("X", "Y", "2", "1") if they may watch this class's
    // recording, else "".
    async function canWatch(req, cls) {
        const st = await checkStatus(req, "X,Y,1,2");
        if (!st.success) return false;
        const u = st.user[0];
        if (u.status === "X") return "X";
        if (u.status === "Y") {
            const perms = adminPerms.parsePermissions(u.permissions);
            return perms == null || (perms["live-classes"] || []).includes("view") ? "Y" : "";
        }
        if (u.status === "2") {
            if (cls.trainer === u.mem_id) return "2";
            const [m] = await q("SELECT 1 FROM member_courses WHERE mem_id = $1 AND c_id = $2 AND status = '1' LIMIT 1", [u.mem_id, cls.c_id]);
            return m ? "2" : "";
        }
        if (u.status === "1") {
            if (cls.status !== "2") return ""; // not completed, or disabled ("2S")
            const [m] = await q("SELECT 1 FROM member_courses WHERE mem_id = $1 AND c_id = $2 AND COALESCE(b_id, '') = $3 AND status = '1' LIMIT 1",
                [u.mem_id, cls.c_id, cls.b_id || ""]);
            if (!m) return "";
            // closed until the batch's previous recording is watched
            return (await views.isLocked(u.mem_id, cls)) ? "" : "1";
        }
        return "";
    }
    const watchMemo = new Map(); // "<cookie hash>|<class>" -> { role, until }
    async function canWatchCached(req, cls) {
        const k = crypto.createHash("sha1").update(String(req.headers.cookie || "")).digest("hex") + "|" + cls.req_id;
        const hit = watchMemo.get(k);
        if (hit && hit.until > Date.now()) return hit.role;
        const role = await canWatch(req, cls);
        if (watchMemo.size > 5000) watchMemo.clear();
        // only a "yes" is kept: a "no" (e.g. still locked) is asked again next time
        if (role) watchMemo.set(k, { role, until: Date.now() + 60 * 1000 });
        return role;
    }

    // A class's document: anyone who can see the class (students: enrolled,
    // and not a disabled class), not only once it's completed.
    async function canSeeDoc(req, cls) {
        if (cls.status === "2S" || cls.status === "2") return canWatch(req, cls);
        return canWatch(req, { ...cls, status: "2" });
    }

    // a class's HLS key: the server's copy, or the wrapped one on Drive (cached again here)
    async function hlsKey(cls, ver) {
        const local = privatePath(`keys/${cls.req_id}/${ver}.key`);
        const k = await fsp.readFile(local).catch(() => null);
        if (k && k.length === 16) return k;
        if (!String(cls.hls_playlist || "").startsWith("api/class-hls/")) return null;
        const [row] = await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2 AND name = 'key.bin'", [cls.req_id, ver]);
        if (!row) return null;
        const key = drive.unwrapKey(await drive.download(row.drive_id));
        await fsp.mkdir(path.dirname(local), { recursive: true });
        await fsp.writeFile(local, key, { mode: 0o600 });
        return key;
    }

    const pieceMemo = new Map(); // "<class>|<ver>|<name>" -> drive id
    const classRow = async (id) => {
        if (!SAFE_ID.test(String(id || ""))) return null;
        const [row] = await q("SELECT req_id, c_id, b_id, trainer, status, video_mode, video_status, video_private, hls_playlist, hls_key_id, video_progress, video_error, video_storage, doc FROM liveclasses WHERE req_id = $1", [id]);
        return row || null;
    };

    // A class recording's length in seconds (0 = unknown), for the edit form's
    // end time: saved when the video is converted; for older classes read once
    // from the secure stream's playlist (its #EXTINF pieces) or the original
    // file, then saved.
    async function videoLength(reqId) {
        await ready;
        if (!SAFE_ID.test(String(reqId || ""))) return 0;
        const [cls] = await q("SELECT video_mode, video_status, video_private, hls_playlist, hls_key_id, video_duration, file FROM liveclasses WHERE req_id = $1", [reqId]);
        if (!cls) return 0;
        if (Number(cls.video_duration) > 0) return Number(cls.video_duration);
        let sec = 0;
        try {
            if (cls.video_mode === "hls" && cls.video_status === "ready" && cls.hls_playlist) {
                let text = "";
                if (String(cls.hls_playlist).startsWith("api/class-hls/")) {
                    const [row] = await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2 AND name = 'index.m3u8'", [reqId, cls.hls_key_id]);
                    if (row) text = Buffer.from(await drive.download(row.drive_id)).toString("utf8");
                } else {
                    const abs = resolveUploadPath(cls.hls_playlist);
                    if (abs) text = await fsp.readFile(abs, "utf8").catch(() => "");
                }
                for (const m of text.matchAll(/#EXTINF:([\d.]+)/g)) sec += Number(m[1]) || 0;
            }
            if (!sec) {
                const src = String(cls.video_private || cls.file || "");
                if (drive.isDrive(src)) {
                    const m = await drive.meta(drive.idOf(src), "videoMediaMetadata").catch(() => null);
                    sec = (Number(m && m.videoMediaMetadata && m.videoMediaMetadata.durationMillis) || 0) / 1000;
                } else if (src && !/^[a-z-]+:/i.test(src)) {
                    const abs = mediaPath(src);
                    if (abs && fs.existsSync(abs)) sec = (await probe(abs)).duration;
                }
            }
        } catch (err) {
            console.error("videoLength:", err.message);
            sec = 0;
        }
        sec = Math.round(sec);
        if (sec > 0) await q("UPDATE liveclasses SET video_duration = $2 WHERE req_id = $1 AND video_duration = 0", [reqId, sec]);
        return sec;
    }

    function register(router) {
        views.register(router); // class-view/start, /progress, /my-progress, class-views/report

        // the original MP4 ("mp4" delivery), with byte ranges for seeking
        router.get("/class-video/:id", async (req, res) => {
            try {
                const cls = await classRow(req.params.id);
                if (!cls || cls.video_mode !== "mp4" || !cls.video_private) return res.status(404).end();
                if (!(await canWatch(req, cls))) return res.status(403).end();
                if (drive.isDrive(cls.video_private)) {
                    return await drive.stream(drive.idOf(cls.video_private), req, res, { disposition: "inline" });
                }
                const abs = mediaPath(cls.video_private);
                const st = abs && (await fsp.stat(abs).catch(() => null));
                if (!st || !st.isFile()) return res.status(404).end();
                const ext = abs.split(".").pop().toLowerCase();
                const type = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo" }[ext] || "application/octet-stream";
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Content-Type", type);
                res.setHeader("Cache-Control", "private, no-store");
                res.setHeader("Content-Disposition", "inline");
                const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
                if (m) {
                    let start = m[1] === "" ? Math.max(0, st.size - Number(m[2])) : Number(m[1]);
                    let end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
                    if (!(start <= end) || start >= st.size) {
                        res.setHeader("Content-Range", `bytes */${st.size}`);
                        return res.status(416).end();
                    }
                    res.status(206);
                    res.setHeader("Content-Range", `bytes ${start}-${end}/${st.size}`);
                    res.setHeader("Content-Length", end - start + 1);
                    return fs.createReadStream(abs, { start, end }).pipe(res);
                }
                res.setHeader("Content-Length", st.size);
                fs.createReadStream(abs).pipe(res);
            } catch (err) {
                console.error("class-video:", err.message);
                if (!res.headersSent) res.status(500).end();
            }
        });

        // the AES-128 key of an HLS stream
        router.get("/hls-key/:id/:ver", async (req, res) => {
            try {
                const cls = await classRow(req.params.id);
                const ver = String(req.params.ver || "");
                if (!cls || cls.video_mode !== "hls" || cls.video_status !== "ready" || cls.hls_key_id !== ver || !/^[a-f0-9]{16}$/.test(ver)) return res.status(404).end();
                if (!(await canWatch(req, cls))) return res.status(403).end();
                const key = await hlsKey(cls, ver).catch((e) => { console.error("hls-key (drive):", e.message); return null; });
                if (!key || key.length !== 16) return res.status(404).end();
                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Cache-Control", "private, no-store");
                res.end(key);
            } catch (err) {
                console.error("hls-key:", err.message);
                if (!res.headersSent) res.status(500).end();
            }
        });

        // a Secure stream stored on Drive: its playlist and segments, after the viewer checks
        router.get("/class-hls/:id/:ver/:name", async (req, res) => {
            try {
                const { ver, name } = req.params;
                if (!/^[a-f0-9]{16}$/.test(ver) || !/^(index\.m3u8|seg_\d{3,6}\.ts)$/.test(name)) return res.status(404).end();
                const cls = await classRow(req.params.id);
                if (!cls || cls.video_mode !== "hls" || cls.video_status !== "ready" || cls.hls_key_id !== ver || !String(cls.hls_playlist).startsWith("api/class-hls/")) return res.status(404).end();
                if (!(await canWatchCached(req, cls))) return res.status(403).end();
                const mk = cls.req_id + "|" + ver + "|" + name;
                let id = pieceMemo.get(mk);
                if (!id) {
                    const [row] = await q("SELECT drive_id FROM liveclass_drive_files WHERE req_id = $1 AND ver = $2 AND name = $3", [cls.req_id, ver, name]);
                    if (!row) return res.status(404).end();
                    id = row.drive_id;
                    if (pieceMemo.size > 20000) pieceMemo.clear();
                    pieceMemo.set(mk, id);
                }
                const playlist = name === "index.m3u8";
                return await drive.stream(id, req, res, {
                    type: playlist ? "application/vnd.apple.mpegurl" : "video/mp2t",
                    cache: playlist ? "private, no-store" : "private, max-age=3600",
                });
            } catch (err) {
                console.error("class-hls:", err.message);
                if (!res.headersSent) res.status(503).setHeader("Retry-After", "2").end();
                else res.destroy(err); // never leave a cut-off segment looking complete
            }
        });

        // a class's document stored on Drive, for whoever can see the class
        router.get("/class-doc/:id", async (req, res) => {
            try {
                const cls = await classRow(req.params.id);
                if (!cls || !drive.isDrive(cls.doc)) return res.status(404).end();
                if (!(await canSeeDoc(req, cls))) return res.status(403).end();
                const m = await drive.meta(drive.idOf(cls.doc), "name,mimeType").catch(() => null);
                if (!m) return res.status(404).end();
                const name = String(m.name || "document").replace(/^[a-z0-9]+-[a-f0-9]{6}-/, "");
                return await drive.stream(drive.idOf(cls.doc), req, res, {
                    type: m.mimeType,
                    disposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
                });
            } catch (err) {
                console.error("class-doc:", err.message);
                if (!res.headersSent) res.status(502).end();
            }
        });

        // processing state and progress, for a player waiting on "being prepared" and the admin cards
        router.get("/class-video-status/:id", async (req, res) => {
            try {
                const cls = await classRow(req.params.id);
                if (!cls) return res.json({ success: false, message: "Class not found" });
                const role = await canWatch(req, cls);
                if (!role) return res.json({ success: false, message: "Not allowed" });
                res.setHeader("Cache-Control", "no-store");
                return res.json({
                    success: true,
                    mode: cls.video_mode,
                    status: cls.video_status,
                    progress: Number(cls.video_progress) || 0,
                    playlist: cls.video_status === "ready" ? cls.hls_playlist : "",
                    // why it failed: for staff only
                    error: role === "1" ? "" : cls.video_error || "",
                });
            } catch (err) {
                console.error("class-video-status:", err.message);
                return res.json({ success: false, message: "Server error" });
            }
        });
    }

    return { storeUpload, afterSave, retry, deleteOriginal, videoLength, register, PRIVATE_DIR, removeMedia, removeHls };
};
