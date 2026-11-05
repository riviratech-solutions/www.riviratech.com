/**
 * Class video viewing: what each student watched of each class recording, and
 * the lock that keeps a recording closed until the one before it is watched.
 *
 * One row per student per batch (liveclasses_video_views, UNIQUE (b_id, mem_id)),
 * everything in `views` (JSONB):
 *   { classes: { <class req_id>: { completed, videos: { <video id>: {
 *       views, duration, watched, covered, ranges: [[from, to], ...], position,
 *       percent, completed, completed_at, last_viewed,
 *       sessions: [{ id, n, ck, start, end, duration, watched, from, to, seq }] } } } } }
 *   watched  seconds actually played (re-watching counts again)
 *   covered  seconds of the video played at least once (the merged `ranges`);
 *            completion is covered / duration, so skipping to the end doesn't count
 *
 * The player (src/components/ClassVideo.tsx) calls class-view/start when a
 * student opens a recording, then class-view/progress every 15 s and on pause,
 * seek, end and leaving. Each change locks the student's row (SELECT ... FOR
 * UPDATE), merges, and writes it back in one transaction; a per-session `seq`
 * drops repeated / out-of-order saves.
 *
 * The lock: a batch's completed classes with a recording (an uploaded video that
 * can be played, or a link), by start time; a student can open one only when the
 * one before it is completed. Checked here for the panels and in class-video.js
 * canWatch() for the stream itself. Staff are never locked.
 *
 * Per batch: batches.view_lock ("1" on, the default; "0" off), switched by admins
 * in Classes.tsx (class-view/lock-set). Off: every recording of the batch is open.
 *
 * Settings (.env):
 *   CLASS_VIEW_COMPLETE_PCT  default 90 — % of a video watched to count as completed
 *   CLASS_VIEW_LOCK          "off" turns the lock off everywhere (tracking stays on)
 *   CLASS_VIEW_LOCK_FROM     Unix seconds; classes that started before it are never locked
 *                            and don't lock others (default 0: every class)
 */
const crypto = require("crypto");
const startup = require("../../shared/startup");

const COMPLETE_PCT = Math.min(100, Math.max(1, Number(process.env.CLASS_VIEW_COMPLETE_PCT) || 90));
const LOCK_ON = String(process.env.CLASS_VIEW_LOCK || "").toLowerCase() !== "off";
const LOCK_FROM = Number(process.env.CLASS_VIEW_LOCK_FROM) || 0;
const SESSIONS_KEPT = 50; // per video; totals always count every session
const MAX_RANGES = 400;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const nowIso = () => new Date().toISOString();
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r1 = (v) => Math.round(v * 10) / 10;

// a class's recording: an uploaded video, a web link, or nothing
function recordingOf(cls) {
    const rec = String(cls.file || "").trim();
    const isLink = String(cls.type) === "2" || /^https?:\/\//i.test(rec);
    if (isLink) return /^https?:\/\//i.test(rec) ? "link" : "";
    if (rec.length < 10) return "";
    // a secure stream that isn't ready yet can't be watched, so it doesn't lock anything
    if (cls.video_mode === "hls" && cls.video_status !== "ready") return "";
    return "video";
}

// the id of a class's current recording: its secure-stream version, else the upload
function videoIdOf(cls) {
    if (recordingOf(cls) === "link") return "link";
    if (cls.video_mode === "hls" && cls.hls_key_id) return String(cls.hls_key_id);
    if (num(cls.video_updated) > 0) return "v" + num(cls.video_updated);
    return "f" + crypto.createHash("md5").update(String(cls.file || "")).digest("hex").slice(0, 12);
}

// [[a, b], ...] sorted and joined where they touch (1 s apart counts as touching)
function mergeRanges(list) {
    const xs = list.filter((x) => x[1] > x[0]).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [a, b] of xs) {
        const last = out[out.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else out.push([a, b]);
    }
    // a very long list (lots of small jumps): close the smallest gaps
    while (out.length > MAX_RANGES) {
        let gi = 0;
        for (let i = 1; i < out.length - 1; i++) if (out[i + 1][0] - out[i][1] < out[gi + 1][0] - out[gi][1]) gi = i;
        out[gi][1] = out[gi + 1][1];
        out.splice(gi + 1, 1);
    }
    return out.map(([a, b]) => [r1(a), r1(b)]);
}
const coveredOf = (ranges, duration) =>
    ranges.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, duration || b) - Math.max(0, a)), 0);

const emptyVideo = () => ({
    views: 0, duration: 0, watched: 0, covered: 0, ranges: [], position: 0,
    percent: 0, completed: false, completed_at: null, last_viewed: null, sessions: [],
});

module.exports = function classViews(ctx) {
    const { db, checkStatus, verifyAccount, addactivity } = ctx;
    const q = (sql, params) => db.pool.query(sql, params).then((r) => r.rows);

    const ready = startup.setup("liveclasses_video_views table", async () => {
        await db.pool.query(`CREATE TABLE IF NOT EXISTS liveclasses_video_views (
            id BIGSERIAL PRIMARY KEY,
            b_id TEXT NOT NULL,
            mem_id TEXT NOT NULL,
            views JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT liveclasses_video_views_b_mem_key UNIQUE (b_id, mem_id)
        )`);
        await db.pool.query("CREATE INDEX IF NOT EXISTS liveclasses_video_views_mem_idx ON liveclasses_video_views (mem_id)");
        await db.pool.query("CREATE INDEX IF NOT EXISTS liveclasses_video_views_views_idx ON liveclasses_video_views USING GIN (views jsonb_path_ops)");
        await db.pool.query("ALTER TABLE batches ADD COLUMN IF NOT EXISTS view_lock TEXT NOT NULL DEFAULT '1'");
    });

    // the batch's own switch (on unless an admin turned it off)
    const batchLockOn = async (bid) => {
        if (!LOCK_ON) return false;
        await ready;
        const [b] = await q("SELECT view_lock FROM batches WHERE b_id = $1", [bid || ""]);
        return !b || String(b.view_lock) !== "0";
    };

    const classRow = async (id) => {
        if (!SAFE_ID.test(String(id || ""))) return null;
        const [row] = await q(
            `SELECT req_id, c_id, b_id, title, trainer, status, file, type, video_mode, video_status, hls_key_id,
                    video_updated, video_duration, stimings
             FROM liveclasses WHERE req_id = $1`, [id]);
        return row || null;
    };
    const enrolled = async (memId, cid, bid) =>
        (await q("SELECT 1 FROM member_courses WHERE mem_id = $1 AND c_id = $2 AND COALESCE(b_id, '') = $3 AND status = '1' LIMIT 1",
            [memId, cid, bid || ""])).length > 0;

    // the student's row, locked for this transaction (made first if missing)
    async function withRow(bid, memId, fn) {
        await ready;
        const client = await db.pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                "INSERT INTO liveclasses_video_views (b_id, mem_id) VALUES ($1, $2) ON CONFLICT (b_id, mem_id) DO NOTHING", [bid, memId]);
            const { rows } = await client.query(
                "SELECT views FROM liveclasses_video_views WHERE b_id = $1 AND mem_id = $2 FOR UPDATE", [bid, memId]);
            const views = rows[0] && rows[0].views && typeof rows[0].views === "object" ? rows[0].views : {};
            if (!views.classes || typeof views.classes !== "object") views.classes = {};
            const out = await fn(views);
            if (out && out.save !== false)
                await client.query(
                    "UPDATE liveclasses_video_views SET views = $3::jsonb, updated_at = now() WHERE b_id = $1 AND mem_id = $2",
                    [bid, memId, JSON.stringify(views)]);
            await client.query("COMMIT");
            return out;
        } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    /* ---------------- the lock ---------------- */

    // the batch's classes that take part, in order
    async function chainOf(cid, bid) {
        const rows = await q(
            `SELECT req_id, title, file, type, video_mode, video_status, stimings, id
             FROM liveclasses WHERE c_id = $1 AND COALESCE(b_id, '') = $2 AND status = '2'
             ORDER BY stimings ASC, id ASC`, [cid, bid || ""]);
        return rows.filter((r) => recordingOf(r) && (!LOCK_FROM || num(r.stimings) >= LOCK_FROM));
    }
    async function completedSet(bid, memId) {
        const [row] = await q("SELECT views FROM liveclasses_video_views WHERE b_id = $1 AND mem_id = $2", [bid || "", memId]);
        const classes = (row && row.views && row.views.classes) || {};
        return new Set(Object.keys(classes).filter((k) => classes[k] && classes[k].completed));
    }
    // { <req_id>: { locked, prev: { req_id, title } | null } } for the batch
    async function lockMap(memId, cid, bid) {
        const on = await batchLockOn(bid);
        const chain = await chainOf(cid, bid);
        const done = on ? await completedSet(bid, memId) : new Set();
        const out = {};
        chain.forEach((c, i) => {
            const prev = i > 0 ? chain[i - 1] : null;
            out[c.req_id] = {
                locked: on && !!prev && !done.has(prev.req_id),
                prev: prev ? { req_id: prev.req_id, title: prev.title } : null,
            };
        });
        return out;
    }
    // for the stream's many requests (byte ranges, pieces): an unlocked answer is kept
    // a few minutes (a class never locks again once open); a locked one is asked again
    const openMemo = new Map();
    async function lockOf(memId, cls) {
        if (!LOCK_ON) return { locked: false, prev: null };
        const k = memId + "|" + cls.req_id;
        const hit = openMemo.get(k);
        if (hit && hit > Date.now()) return { locked: false, prev: null };
        const m = (await lockMap(memId, cls.c_id, cls.b_id))[cls.req_id] || { locked: false, prev: null };
        if (!m.locked) {
            if (openMemo.size > 20000) openMemo.clear();
            openMemo.set(k, Date.now() + 5 * 60 * 1000);
        }
        return m;
    }
    /** For class-video.js canWatch(): is this recording still locked for this student? */
    const isLocked = async (memId, cls) => (await lockOf(memId, cls)).locked;

    /* ---------------- merging a save ---------------- */

    function videoEntry(views, cls, vid) {
        const c = (views.classes[cls.req_id] ||= { completed: false, videos: {} });
        if (!c.videos || typeof c.videos !== "object") c.videos = {};
        const v = (c.videos[vid] ||= emptyVideo());
        if (!Array.isArray(v.sessions)) v.sessions = [];
        if (!Array.isArray(v.ranges)) v.ranges = [];
        return { c, v };
    }
    function finish(c, v) {
        v.covered = r1(coveredOf(v.ranges, v.duration));
        v.percent = v.duration > 0 ? Math.min(100, Math.floor((v.covered / v.duration) * 100)) : v.completed ? 100 : 0;
        if (!v.completed && v.duration > 0 && v.percent >= COMPLETE_PCT) {
            v.completed = true;
            v.completed_at = nowIso();
        }
        if (v.completed) c.completed = true;
    }
    const summary = (c, v) => ({
        percent: v.percent, completed: !!v.completed, class_completed: !!c.completed, complete_pct: COMPLETE_PCT,
        position: v.position, duration: v.duration, watched: r1(v.watched), views: v.views,
    });

    /* ---------------- routes ---------------- */

    // the signed-in student (status "1"), or null with the answer already sent
    async function student(req, res) {
        const st = await checkStatus(req, "1");
        if (!st.success) {
            res.status(401).json({ success: false, message: st.message || "Please sign in" });
            return null;
        }
        return st.user[0];
    }

    function register(router) {
        // POST /api/class-view/start { class_id, ck } — a student opens a recording:
        // the lock, the row, a new session (one per player: `ck` repeats are the
        // same session) and where to resume
        router.post("/class-view/start", async (req, res) => {
            try {
                const u = await student(req, res);
                if (!u) return;
                const cls = await classRow(req.body.class_id);
                if (!cls || cls.status !== "2" || !recordingOf(cls)) return res.json({ success: false, message: "This recording isn't available" });
                if (!(await enrolled(u.mem_id, cls.c_id, cls.b_id))) return res.json({ success: false, message: "Not allowed" });
                // worked out fresh (not the stream's memo), so it always matches my-progress
                const lock = LOCK_ON ? (await lockMap(u.mem_id, cls.c_id, cls.b_id))[cls.req_id] : null;
                if (lock && lock.locked) return res.json({ success: true, locked: true, prev: lock.prev });

                const vid = videoIdOf(cls);
                const ck = String(req.body.ck || "").slice(0, 40);
                const out = await withRow(cls.b_id || "", u.mem_id, (views) => {
                    const { c, v } = videoEntry(views, cls, vid);
                    if (num(cls.video_duration) > 0) v.duration = num(cls.video_duration);
                    const t = nowIso();
                    // the same player asking again (e.g. a re-render): its session
                    let s = ck && v.sessions.find((x) => x.ck === ck && Date.now() - Date.parse(x.start) < 6 * 3600 * 1000);
                    if (!s) {
                        v.views = num(v.views) + 1;
                        s = { id: "s" + crypto.randomBytes(8).toString("hex"), n: v.views, ck, start: t, end: t, duration: 0, watched: 0, from: v.position, to: v.position, seq: 0 };
                        v.sessions.push(s);
                        if (v.sessions.length > SESSIONS_KEPT) v.sessions.splice(0, v.sessions.length - SESSIONS_KEPT);
                    }
                    v.last_viewed = t;
                    if (vid === "link") {
                        // a link can't be followed: opening it counts as watching it
                        v.completed = true;
                        v.completed_at ||= t;
                        v.percent = 100;
                        c.completed = true;
                    }
                    finish(c, v);
                    // resume: not in the first few seconds, and from the start after the end
                    const near = v.duration > 0 && v.position >= v.duration - 10;
                    return { session_id: s.id, video_id: vid, resume: near || v.position < 5 ? 0 : v.position, ...summary(c, v) };
                });
                return res.json({ success: true, locked: false, ...out });
            } catch (err) {
                console.error("class-view/start:", err.message);
                return res.json({ success: false, message: "Server error" });
            }
        });

        // POST /api/class-view/progress { class_id, video_id, session_id, seq, position,
        // duration, ranges: [[from, to], ...] played since the last save, played (s), event }
        router.post("/class-view/progress", async (req, res) => {
            try {
                const u = await student(req, res);
                if (!u) return;
                const b = req.body || {};
                const cls = await classRow(b.class_id);
                if (!cls || !(await enrolled(u.mem_id, cls.c_id, cls.b_id))) return res.json({ success: false, message: "Not allowed" });
                const vid = String(b.video_id || "");
                const sid = String(b.session_id || "");
                const seq = Math.floor(num(b.seq));
                if (!vid || vid !== videoIdOf(cls) || !/^s[a-f0-9]{16}$/.test(sid) || seq < 1) return res.json({ success: false, message: "Bad request" });

                const out = await withRow(cls.b_id || "", u.mem_id, (views) => {
                    const { c, v } = videoEntry(views, cls, vid);
                    const s = v.sessions.find((x) => x.id === sid);
                    if (!s) return { save: false, ignored: true, ...summary(c, v) };
                    if (seq <= num(s.seq)) return { save: false, ignored: true, ...summary(c, v) }; // a repeat / older save
                    const wasDone = !!c.completed;

                    const duration = num(cls.video_duration) > 0 ? num(cls.video_duration) : Math.max(0, Math.min(num(b.duration), 24 * 3600));
                    if (duration > 0) v.duration = r1(duration);
                    const cap = v.duration || 24 * 3600;
                    // what was played since the last save can't be more than the time that passed
                    // (at up to 2x speed, plus a little slack)
                    const elapsed = Math.max(0, (Date.now() - Date.parse(s.end)) / 1000);
                    const limit = elapsed * 2 + 10;
                    let played = Math.max(0, Math.min(num(b.played), limit));
                    const ranges = (Array.isArray(b.ranges) ? b.ranges : []).slice(0, 200)
                        .map((x) => (Array.isArray(x) ? [Math.max(0, num(x[0])), Math.min(cap, num(x[1]))] : [0, 0]))
                        .filter(([a2, b2]) => b2 > a2 && b2 - a2 <= limit);
                    const rangeTotal = ranges.reduce((t, [a2, b2]) => t + (b2 - a2), 0);
                    if (rangeTotal > limit) ranges.length = 0; // more than could have been played: ignore
                    played = Math.min(played, Math.max(rangeTotal, 0) + 2);

                    v.ranges = mergeRanges([...v.ranges, ...ranges]);
                    v.watched = r1(num(v.watched) + played);
                    v.position = r1(Math.max(0, Math.min(num(b.position), cap)));
                    v.last_viewed = nowIso();
                    s.seq = seq;
                    s.end = v.last_viewed;
                    s.duration = Math.round((Date.parse(s.end) - Date.parse(s.start)) / 1000);
                    s.watched = r1(num(s.watched) + played);
                    s.to = v.position;
                    finish(c, v);
                    return { just_completed: !wasDone && !!c.completed, ...summary(c, v) };
                });
                return res.json({ success: true, ...out });
            } catch (err) {
                console.error("class-view/progress:", err.message);
                return res.json({ success: false, message: "Server error" });
            }
        });

        // POST /api/class-view/my-progress { c_id, b_id } — the student's own progress
        // and locks for a batch (the class list in Classes.tsx)
        router.post("/class-view/my-progress", async (req, res) => {
            try {
                const u = await student(req, res);
                if (!u) return;
                const cid = String(req.body.c_id || ""), bid = String(req.body.b_id || "");
                if (!SAFE_ID.test(cid) || !SAFE_ID.test(bid) || !(await enrolled(u.mem_id, cid, bid))) return res.json({ success: false, message: "Not allowed" });
                const locks = await lockMap(u.mem_id, cid, bid);
                const [row] = await q("SELECT views FROM liveclasses_video_views WHERE b_id = $1 AND mem_id = $2", [bid, u.mem_id]);
                const classes = {};
                for (const [id, c] of Object.entries((row && row.views && row.views.classes) || {})) {
                    const vids = Object.values(c.videos || {});
                    const best = vids.sort((a, b) => num(b.percent) - num(a.percent))[0] || emptyVideo();
                    classes[id] = {
                        completed: !!c.completed,
                        percent: c.completed ? 100 : num(best.percent),
                        started: !!c.completed || num(best.watched) > 0 || num(best.position) > 0,
                        position: num(best.position),
                        last_viewed: best.last_viewed,
                    };
                }
                res.setHeader("Cache-Control", "no-store");
                return res.json({ success: true, lock: await batchLockOn(bid), complete_pct: COMPLETE_PCT, locks, classes });
            } catch (err) {
                console.error("class-view/my-progress:", err.message);
                return res.json({ success: false, message: "Server error" });
            }
        });

        // POST /api/class-view/lock-status { b_id } — is the batch's lock on (Classes.tsx switch)
        router.post("/class-view/lock-status", async (req, res) => {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            try {
                await ready;
                const bid = String(req.body.b_id || "");
                if (!SAFE_ID.test(bid)) return res.json({ success: false, message: "Bad request" });
                const [b] = await q("SELECT view_lock FROM batches WHERE b_id = $1", [bid]);
                if (!b) return res.json({ success: false, message: "Batch not found" });
                res.setHeader("Cache-Control", "no-store");
                return res.json({ success: true, enabled: String(b.view_lock) !== "0", global: LOCK_ON });
            } catch (err) {
                console.error("class-view/lock-status:", err.message);
                return res.json({ success: false, message: "Server error" });
            }
        });

        // POST /api/class-view/lock-set { b_id, enabled } — turn a batch's lock on / off
        // (admins; sub-admins with Live Classes "edit")
        router.post("/class-view/lock-set", async (req, res) => {
            const { key: ukey } = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            try {
                await ready;
                const bid = String(req.body.b_id || "");
                const on = req.body.enabled === true || req.body.enabled === "1" || req.body.enabled === 1;
                if (!SAFE_ID.test(bid)) return res.json({ success: false, message: "Bad request" });
                const rows = await q("UPDATE batches SET view_lock = $2 WHERE b_id = $1 RETURNING name", [bid, on ? "1" : "0"]);
                if (!rows.length) return res.json({ success: false, message: "Batch not found" });
                openMemo.clear(); // the streams ask again
                addactivity(ukey, bid, "batches", `Class video lock turned ${on ? "on" : "off"} for '${String(rows[0].name || "").trim()}'`, on ? "0" : "1", on ? "1" : "0");
                return res.json({
                    success: true,
                    enabled: on,
                    message: on ? "Lock on: students watch the recordings in order" : "Lock off: students can watch any recording",
                });
            } catch (err) {
                console.error("class-view/lock-set:", err.message);
                return res.json({ success: false, message: "Server error" });
            }
        });

        // POST /api/class-views/report { b_id, mem_id, class_id, video_id } — viewing per
        // student / batch / class / video. Students: their own only. Trainers: batches of
        // the courses they teach. Sub-admins: Live Classes "view" (admin-permissions.js).
        router.post("/class-views/report", async (req, res) => {
            const { key: ukey, id: ustatus } = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;
            try {
                await ready;
                let bid = String(req.body.b_id || "");
                let memId = String(req.body.mem_id || "");
                const classId = String(req.body.class_id || "");
                const videoId = String(req.body.video_id || "");
                for (const v of [bid, memId, classId, videoId]) if (v && !SAFE_ID.test(v)) return res.json({ success: false, message: "Bad request" });
                if (ustatus === "1") memId = ukey; // students: only their own

                let cls = null;
                if (classId) {
                    cls = await classRow(classId);
                    if (!cls) return res.json({ success: false, message: "Class not found" });
                    bid = bid || cls.b_id || "";
                }
                if (!bid && !memId && !classId) return res.json({ success: false, message: "Choose a batch, a student or a class" });
                if (ustatus === "2") {
                    // a trainer: the batch (or the class's batch) of a course they teach
                    if (!bid) return res.json({ success: false, message: "Choose a batch or a class" });
                    const [bt] = await q("SELECT c_id FROM batches WHERE b_id = $1", [bid]);
                    const cid = (cls && cls.c_id) || (bt && bt.c_id) || "";
                    const teaches = (cls && cls.trainer === ukey) ||
                        (await q("SELECT 1 FROM member_courses WHERE mem_id = $1 AND c_id = $2 AND status = '1' LIMIT 1", [ukey, cid])).length > 0 ||
                        (await q("SELECT 1 FROM liveclasses WHERE trainer = $1 AND COALESCE(b_id, '') = $2 LIMIT 1", [ukey, bid])).length > 0;
                    if (!teaches) return res.json({ success: false, message: "Not allowed" });
                }

                const rows = await q(
                    `SELECT v.b_id, v.mem_id, m.name, m.email, v.views, v.created_at, v.updated_at
                     FROM liveclasses_video_views v LEFT JOIN members m ON m.mem_id = v.mem_id
                     WHERE ($1 = '' OR v.b_id = $1) AND ($2 = '' OR v.mem_id = $2)
                       AND ($3 = '' OR v.views @> jsonb_build_object('classes', jsonb_build_object($3::text, '{}'::jsonb)))
                     ORDER BY m.name NULLS LAST, v.id LIMIT 2000`,
                    [bid, memId, classId]);

                const detail = !!memId || !!videoId; // sessions only for one student or one video
                const students = rows.map((r) => {
                    const all = (r.views && r.views.classes) || {};
                    const classes = {};
                    for (const [cid2, c] of Object.entries(all)) {
                        if (classId && cid2 !== classId) continue;
                        const videos = {};
                        for (const [vid, v] of Object.entries(c.videos || {})) {
                            if (videoId && vid !== videoId) continue;
                            const { sessions, ranges, ...rest } = v;
                            videos[vid] = detail ? { ...rest, ranges, sessions } : { ...rest, sessions_count: (sessions || []).length };
                        }
                        if (videoId && !Object.keys(videos).length) continue;
                        const vs = Object.values(videos);
                        classes[cid2] = {
                            completed: !!c.completed,
                            percent: c.completed ? 100 : Math.max(0, ...vs.map((v) => num(v.percent))),
                            views: vs.reduce((s, v) => s + num(v.views), 0),
                            watched: r1(vs.reduce((s, v) => s + num(v.watched), 0)),
                            last_viewed: vs.map((v) => v.last_viewed).filter(Boolean).sort().pop() || null,
                            videos,
                        };
                    }
                    return { b_id: r.b_id, mem_id: r.mem_id, name: r.name || "", email: r.email || "", created_at: r.created_at, updated_at: r.updated_at, classes };
                }).filter((s) => !videoId || Object.keys(s.classes).length);

                // per class: how many students started / completed it, and the average %
                const perClass = {};
                for (const s of students)
                    for (const [cid2, c] of Object.entries(s.classes)) {
                        const p = (perClass[cid2] ||= { students: 0, completed: 0, percent_sum: 0, views: 0, watched: 0 });
                        p.students++;
                        if (c.completed) p.completed++;
                        p.percent_sum += c.percent;
                        p.views += c.views;
                        p.watched = r1(p.watched + c.watched);
                    }
                for (const p of Object.values(perClass)) {
                    p.avg_percent = p.students ? Math.round(p.percent_sum / p.students) : 0;
                    delete p.percent_sum;
                }
                res.setHeader("Cache-Control", "no-store");
                return res.json({ success: true, complete_pct: COMPLETE_PCT, filters: { b_id: bid, mem_id: memId, class_id: classId, video_id: videoId }, classes: perClass, students });
            } catch (err) {
                console.error("class-views/report:", err.message);
                return res.json({ success: false, message: "Server error" });
            }
        });
    }

    return { register, isLocked, recordingOf, videoIdOf };
};
