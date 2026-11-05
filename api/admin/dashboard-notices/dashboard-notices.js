/**
 * API routes for src/pages/panel/admin/DashboardNotices.tsx (admin) and the
 * Notices section of src/pages/panel/student/Dashboard.tsx (students).
 *
 * An admin posts a notice to the student dashboard — to every student, or to
 * chosen courses / batches — optionally letting students reply. Replies move
 * New -> In progress -> Completed, each step with an optional note the student
 * sees under their reply.
 *
 *   dashboard_notices(id, req_id, title, html, style 'info'|'important'|'urgent',
 *       audience 'all'|'select', courses JSON [c_id], batches JSON [b_id],
 *       allow_reply '1'|'0', start_at / end_at (epoch s, 0 = none), sortno,
 *       status '1' shown | '1S' hidden, created_by, datetime, updated)
 *   dashboard_notice_replies(id, req_id, notice_id, mem_id, message,
 *       status '1' new | '2' in progress | '3' completed,
 *       progress_note, progress_at, done_note, done_at, handled_by, datetime, updated)
 *   dashboard_notice_reads(notice_id, mem_id, read_at)  -- a notice blinks until read
 *       (no id column: its INSERTs carry their own RETURNING, see shared/pgdb.js)
 *
 * Admin:   POST /notices-list, /notices-save, /notices-toggle, /notices-reorder,
 *          /notices-delete, /notice-replies-list, /notice-replies-status,
 *          /notice-replies-delete, /notice-student (a replying student's details)
 * Student: POST /my-notices, /my-notices-read, /my-notices-reply
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

const STYLES = ["info", "important", "urgent"];
const ID_RE = /^[A-Za-z0-9_-]{4,80}$/;
const MAX_OPEN_REPLIES = 5; // per student per notice, still waiting (New)

/* Stored HTML is sanitised again in the browser (utils/sanitizeHtml.ts); this
   first pass keeps scripts and the obvious tricks out of the database. */
function cleanHtml(html) {
    return String(html || "")
        .slice(0, 20000)
        .replace(/<\s*(script|style|iframe|object|embed|form|link|meta|base|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
        .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|link|meta|base|svg|math)\b[^>]*>/gi, "")
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\b(href|src)\s*=\s*(["'])\s*(javascript|vbscript|data:text)[^"']*\2/gi, '$1="#"');
}
const cleanText = (v, max) => String(v || "").replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const toEpoch = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const idList = (v) => (Array.isArray(v) ? [...new Set(v.map(String).filter((x) => ID_RE.test(x)))].slice(0, 200) : []);
const parseList = (v) => {
    try {
        const a = JSON.parse(v || "[]");
        return Array.isArray(a) ? a.map(String) : [];
    } catch {
        return [];
    }
};
const now = () => Math.floor(Date.now() / 1000);

let ready = null;
function ensureTables(db) {
    if (!ready) {
        ready = db.pool
            .query(`
                CREATE TABLE IF NOT EXISTS dashboard_notices (
                    id SERIAL PRIMARY KEY,
                    req_id TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    html TEXT NOT NULL DEFAULT '',
                    style TEXT NOT NULL DEFAULT 'info',
                    audience TEXT NOT NULL DEFAULT 'all',
                    courses TEXT NOT NULL DEFAULT '[]',
                    batches TEXT NOT NULL DEFAULT '[]',
                    allow_reply CHAR(1) NOT NULL DEFAULT '1',
                    start_at BIGINT NOT NULL DEFAULT 0,
                    end_at BIGINT NOT NULL DEFAULT 0,
                    sortno INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT '1',
                    created_by TEXT,
                    datetime BIGINT,
                    updated BIGINT
                );
                CREATE INDEX IF NOT EXISTS dashboard_notices_status_idx ON dashboard_notices (status, sortno);
                CREATE TABLE IF NOT EXISTS dashboard_notice_replies (
                    id SERIAL PRIMARY KEY,
                    req_id TEXT NOT NULL UNIQUE,
                    notice_id INTEGER NOT NULL,
                    mem_id TEXT NOT NULL,
                    message TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT '1',
                    progress_note TEXT NOT NULL DEFAULT '',
                    progress_at BIGINT NOT NULL DEFAULT 0,
                    done_note TEXT NOT NULL DEFAULT '',
                    done_at BIGINT NOT NULL DEFAULT 0,
                    handled_by TEXT,
                    datetime BIGINT,
                    updated BIGINT
                );
                CREATE INDEX IF NOT EXISTS dashboard_notice_replies_notice_idx ON dashboard_notice_replies (notice_id);
                CREATE INDEX IF NOT EXISTS dashboard_notice_replies_mem_idx ON dashboard_notice_replies (mem_id);
                CREATE INDEX IF NOT EXISTS dashboard_notice_replies_status_idx ON dashboard_notice_replies (status);
                CREATE TABLE IF NOT EXISTS dashboard_notice_reads (
                    notice_id INTEGER NOT NULL,
                    mem_id TEXT NOT NULL,
                    read_at BIGINT NOT NULL,
                    PRIMARY KEY (notice_id, mem_id)
                );`)
            .catch((err) => {
                ready = null; // try again on the next call
                throw err;
            });
    }
    return ready;
}

module.exports = (router, ctx) => {
    const { db, verifyAccount, nextSortNo, applyReorder, addactivity } = ctx;
    ensureTables(db).catch((err) => console.error("dashboard notices tables:", err.message));

    const fail = (res, err, msg = "Something went wrong") => {
        console.error("dashboard notices:", err && err.message ? err.message : err);
        res.json({ success: false, message: msg });
    };

    /* ================= admin: notices ================= */
    router.post("/notices-list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await ensureTables(db);
            const [rows] = await db.promise().query(
                `SELECT n.*,
                    (SELECT COUNT(*)::int FROM dashboard_notice_replies r WHERE r.notice_id = n.id) AS replies,
                    (SELECT COUNT(*)::int FROM dashboard_notice_replies r WHERE r.notice_id = n.id AND r.status = '1') AS replies_new,
                    (SELECT COUNT(*)::int FROM dashboard_notice_replies r WHERE r.notice_id = n.id AND r.status = '2') AS replies_progress,
                    (SELECT COUNT(*)::int FROM dashboard_notice_reads d WHERE d.notice_id = n.id) AS reads
                 FROM dashboard_notices n ORDER BY n.sortno ASC, n.id ASC`
            );
            res.json({ success: true, data: rows, now: now() });
        } catch (err) { fail(res, err, "Failed to load notices"); }
    });

    router.post("/notices-save", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await ensureTables(db);
            const b = req.body || {};
            const title = cleanText(b.title, 150);
            const html = cleanHtml(b.html);
            const style = STYLES.includes(b.style) ? b.style : "info";
            const audience = b.audience === "select" ? "select" : "all";
            const courses = audience === "select" ? idList(b.courses) : [];
            const batches = audience === "select" ? idList(b.batches) : [];
            const allowReply = b.allow_reply === false || b.allow_reply === "0" ? "0" : "1";
            const startAt = toEpoch(b.start_at);
            const endAt = toEpoch(b.end_at);

            if (title.length < 2) return res.json({ success: false, message: "Please enter a title" });
            if (html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length < 1)
                return res.json({ success: false, message: "Please enter the message" });
            if (audience === "select" && !courses.length && !batches.length)
                return res.json({ success: false, message: "Choose at least one course or batch, or show it to all students" });
            if (startAt && endAt && endAt <= startAt) return res.json({ success: false, message: "The expiry must be after the start" });

            const t = now();
            const ukey = req.cookies.key;
            const fields = [title, html, style, audience, JSON.stringify(courses), JSON.stringify(batches), allowReply, startAt, endAt];
            let id = Number(b.id) || 0;
            if (id) {
                const [r] = await db.promise().query(
                    `UPDATE dashboard_notices SET title = ?, html = ?, style = ?, audience = ?, courses = ?, batches = ?,
                        allow_reply = ?, start_at = ?, end_at = ?, updated = ? WHERE id = ?`,
                    [...fields, t, id]
                );
                if (!r.affectedRows) return res.json({ success: false, message: "Notice not found" });
                addactivity(ukey, String(id), "dashboard_notices", "Dashboard notice updated '" + title + "'", "", "");
            } else {
                const sortno = await nextSortNo("dashboard_notices");
                const reqId = "dn" + crypto.randomBytes(12).toString("hex");
                const [r] = await db.promise().query(
                    `INSERT INTO dashboard_notices (req_id, title, html, style, audience, courses, batches, allow_reply,
                        start_at, end_at, sortno, status, created_by, datetime, updated)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?, ?)`,
                    [reqId, ...fields, sortno, ukey || "", t, t]
                );
                id = r.insertId;
                addactivity(ukey, String(id), "dashboard_notices", "Dashboard notice added '" + title + "'", "", "");
            }
            const [rows] = await db.promise().query(
                `SELECT n.*,
                    (SELECT COUNT(*)::int FROM dashboard_notice_replies r WHERE r.notice_id = n.id) AS replies,
                    (SELECT COUNT(*)::int FROM dashboard_notice_replies r WHERE r.notice_id = n.id AND r.status = '1') AS replies_new,
                    (SELECT COUNT(*)::int FROM dashboard_notice_replies r WHERE r.notice_id = n.id AND r.status = '2') AS replies_progress,
                    (SELECT COUNT(*)::int FROM dashboard_notice_reads d WHERE d.notice_id = n.id) AS reads
                 FROM dashboard_notices n WHERE n.id = ?`,
                [id]
            );
            res.json({ success: true, data: rows[0], message: b.id ? "Notice updated" : "Notice added" });
        } catch (err) { fail(res, err); }
    });

    router.post("/notices-toggle", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const active = !!req.body.active;
            const [r] = await db.promise().query(`UPDATE dashboard_notices SET status = ?, updated = ? WHERE id = ?`,
                [active ? "1" : "1S", now(), Number(req.body.id) || 0]);
            if (!r.affectedRows) return res.json({ success: false, message: "Notice not found" });
            res.json({ success: true, message: active ? "Shown on the student dashboard" : "Hidden from students" });
        } catch (err) { fail(res, err); }
    });

    router.post("/notices-reorder", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try { await applyReorder("dashboard_notices", req.body.ids, res); }
        catch (err) { fail(res, err); }
    });

    router.post("/notices-delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id) || 0;
            const [rows] = await db.promise().query(`SELECT title FROM dashboard_notices WHERE id = ?`, [id]);
            if (!rows.length) return res.json({ success: false, message: "Notice not found" });
            // the notice and everything hanging off it — every student's replies
            // (the chats) and the read markers — go together or not at all
            const chats = await db.withTransaction(async (tx) => {
                const [r] = await tx.query(`DELETE FROM dashboard_notice_replies WHERE notice_id = ?`, [id]);
                await tx.query(`DELETE FROM dashboard_notice_reads WHERE notice_id = ?`, [id]);
                await tx.query(`DELETE FROM dashboard_notices WHERE id = ?`, [id]);
                return r.affectedRows || 0;
            });
            addactivity(req.cookies.key, String(id), "dashboard_notices",
                "Dashboard notice deleted '" + rows[0].title + "'" + (chats ? " with " + chats + " " + (chats === 1 ? "reply" : "replies") : ""), "", "");
            res.json({
                success: true,
                chats,
                message: chats ? `Notice and its ${chats} ${chats === 1 ? "reply" : "replies"} deleted` : "Notice deleted",
            });
        } catch (err) { fail(res, err); }
    });

    /* ================= admin: replies ================= */
    router.post("/notice-replies-list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await ensureTables(db);
            const conds = [];
            const params = [];
            const noticeId = Number(req.body.notice_id) || 0;
            if (noticeId) { conds.push("r.notice_id = ?"); params.push(noticeId); }
            if (["1", "2", "3"].includes(String(req.body.status))) { conds.push("r.status = ?"); params.push(String(req.body.status)); }
            const q = cleanText(req.body.q, 100);
            if (q) {
                conds.push("(m.name ILIKE ? OR m.email ILIKE ? OR m.number ILIKE ? OR r.message ILIKE ? OR n.title ILIKE ?)");
                const like = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
                params.push(like, like, like, like, like);
            }
            const [rows] = await db.promise().query(
                `SELECT r.id, r.req_id, r.notice_id, r.mem_id, r.message, r.status, r.progress_note, r.progress_at,
                        r.done_note, r.done_at, r.datetime, r.updated,
                        n.title AS notice_title, n.style AS notice_style,
                        m.name, m.email, m.number, m.profile
                 FROM dashboard_notice_replies r
                 LEFT JOIN dashboard_notices n ON n.id = r.notice_id
                 LEFT JOIN members m ON m.mem_id = r.mem_id
                 ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
                 ORDER BY CASE r.status WHEN '1' THEN 0 WHEN '2' THEN 1 ELSE 2 END, r.id DESC
                 LIMIT 2000`,
                params
            );
            const [[counts]] = await db.promise().query(
                `SELECT COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE status = '1')::int AS new,
                        COUNT(*) FILTER (WHERE status = '2')::int AS progress,
                        COUNT(*) FILTER (WHERE status = '3')::int AS done
                 FROM dashboard_notice_replies`
            );
            res.json({ success: true, data: rows, counts });
        } catch (err) { fail(res, err, "Failed to load replies"); }
    });

    // status "2" = in progress, "3" = completed, "1" = back to new; note optional
    router.post("/notice-replies-status", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id) || 0;
            const status = String(req.body.status || "");
            if (!["1", "2", "3"].includes(status)) return res.json({ success: false, message: "Invalid status" });
            const note = cleanText(req.body.note, 1000);
            const [rows] = await db.promise().query(
                `SELECT r.id, r.status, r.progress_at, m.name FROM dashboard_notice_replies r
                 LEFT JOIN members m ON m.mem_id = r.mem_id WHERE r.id = ?`, [id]);
            if (!rows.length) return res.json({ success: false, message: "Reply not found" });
            const t = now();
            const ukey = req.cookies.key;
            if (status === "2") {
                await db.promise().query(
                    `UPDATE dashboard_notice_replies SET status = '2', progress_note = ?, progress_at = ?,
                        done_note = '', done_at = 0, handled_by = ?, updated = ? WHERE id = ?`,
                    [note, t, ukey || "", t, id]);
            } else if (status === "3") {
                // completing straight from New also stamps the progress time
                await db.promise().query(
                    `UPDATE dashboard_notice_replies SET status = '3', done_note = ?, done_at = ?,
                        progress_at = CASE WHEN progress_at = 0 THEN ? ELSE progress_at END,
                        handled_by = ?, updated = ? WHERE id = ?`,
                    [note, t, t, ukey || "", t, id]);
            } else {
                await db.promise().query(
                    `UPDATE dashboard_notice_replies SET status = '1', progress_note = '', progress_at = 0,
                        done_note = '', done_at = 0, updated = ? WHERE id = ?`, [t, id]);
            }
            const label = status === "2" ? "In progress" : status === "3" ? "Completed" : "New";
            addactivity(ukey, String(id), "dashboard_notice_replies", "Notice reply from '" + (rows[0].name || "") + "' marked " + label, "", "");
            const [out] = await db.promise().query(`SELECT * FROM dashboard_notice_replies WHERE id = ?`, [id]);
            res.json({ success: true, data: out[0], message: "Marked " + label });
        } catch (err) { fail(res, err); }
    });

    // A replying student's details for the admin popup. Only answers for students
    // who have replied to a notice, and never returns password columns.
    router.post("/notice-student", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const memId = cleanText(req.body.mem_id, 80);
            if (!memId) return res.json({ success: false, message: "Student not found" });
            const [[has]] = await db.promise().query(
                `SELECT COUNT(*)::int AS n FROM dashboard_notice_replies WHERE mem_id = ?`, [memId]);
            if (!has.n) return res.json({ success: false, message: "Student not found" });
            const [rows] = await db.promise().query(
                `SELECT mem_id, name, gender, email, number, address, city, pincode, state, qualification,
                        profile, datetime, lastdatetime, status
                 FROM members WHERE mem_id = ? LIMIT 1`, [memId]);
            if (!rows.length) return res.json({ success: false, message: "This student's account no longer exists" });
            const [courses] = await db.promise().query(
                `SELECT mc.c_id, mc.b_id, mc.expires, mc.datetime, mc.status, c.title AS course, b.name AS batch
                 FROM member_courses mc
                 LEFT JOIN courses c ON c.req_id = mc.c_id
                 LEFT JOIN batches b ON b.b_id = mc.b_id
                 WHERE mc.mem_id = ? ORDER BY mc.id DESC`, [memId]);
            const [[replies]] = await db.promise().query(
                `SELECT COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE status = '1')::int AS new,
                        COUNT(*) FILTER (WHERE status = '2')::int AS progress,
                        COUNT(*) FILTER (WHERE status = '3')::int AS done,
                        COUNT(DISTINCT notice_id)::int AS notices
                 FROM dashboard_notice_replies WHERE mem_id = ?`, [memId]);
            res.json({ success: true, data: { ...rows[0], courses, replies } });
        } catch (err) { fail(res, err, "Could not load the student"); }
    });

    router.post("/notice-replies-delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id) || 0;
            const [r] = await db.promise().query(`DELETE FROM dashboard_notice_replies WHERE id = ?`, [id]);
            if (!r.affectedRows) return res.json({ success: false, message: "Reply not found" });
            addactivity(req.cookies.key, String(id), "dashboard_notice_replies", "Notice reply deleted", "", "");
            res.json({ success: true, message: "Reply deleted" });
        } catch (err) { fail(res, err); }
    });

    /* ================= student ================= */

    // The notices this student may see right now: shown, inside the schedule,
    // and for everyone or for one of their active courses / batches.
    async function visibleNotices(memId) {
        const t = now();
        const [enr] = await db.promise().query(
            `SELECT c_id, b_id FROM member_courses WHERE mem_id = ? AND status = '1'`, [memId]);
        const myCourses = new Set(enr.map((e) => String(e.c_id || "")));
        const myBatches = new Set(enr.map((e) => String(e.b_id || "")));
        const [rows] = await db.promise().query(
            `SELECT id, req_id, title, html, style, audience, courses, batches, allow_reply, start_at, end_at, datetime, updated
             FROM dashboard_notices
             WHERE status = '1' AND (start_at = 0 OR start_at <= ?) AND (end_at = 0 OR end_at > ?)
             ORDER BY sortno ASC, id ASC`,
            [t, t]
        );
        return rows.filter((n) =>
            n.audience !== "select" ||
            parseList(n.courses).some((c) => myCourses.has(c)) ||
            parseList(n.batches).some((b) => myBatches.has(b))
        );
    }

    router.post("/my-notices", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        try {
            await ensureTables(db);
            const memId = req.cookies.key;
            const notices = await visibleNotices(memId);
            if (!notices.length) return res.json({ success: true, data: [] });
            const ids = notices.map((n) => n.id);
            const marks = ids.map(() => "?").join(",");
            const [reads] = await db.promise().query(
                `SELECT notice_id FROM dashboard_notice_reads WHERE mem_id = ? AND notice_id IN (${marks})`, [memId, ...ids]);
            const [replies] = await db.promise().query(
                `SELECT id, notice_id, message, status, progress_note, progress_at, done_note, done_at, datetime
                 FROM dashboard_notice_replies WHERE mem_id = ? AND notice_id IN (${marks}) ORDER BY id ASC`, [memId, ...ids]);
            const readSet = new Set(reads.map((r) => r.notice_id));
            res.json({
                success: true,
                data: notices.map((n) => ({
                    id: n.id,
                    title: n.title,
                    html: n.html,
                    style: n.style,
                    allow_reply: n.allow_reply,
                    datetime: n.datetime,
                    updated: n.updated,
                    read: readSet.has(n.id),
                    replies: replies.filter((r) => r.notice_id === n.id),
                })),
            });
        } catch (err) { fail(res, err, "Failed to load notices"); }
    });

    router.post("/my-notices-read", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        try {
            const memId = req.cookies.key;
            const id = Number(req.body.id) || 0;
            const notices = await visibleNotices(memId);
            if (!notices.some((n) => n.id === id)) return res.json({ success: false, message: "Notice not found" });
            await db.promise().query(
                `INSERT INTO dashboard_notice_reads (notice_id, mem_id, read_at) VALUES (?, ?, ?)
                 ON CONFLICT (notice_id, mem_id) DO NOTHING RETURNING notice_id`, [id, memId, now()]);
            res.json({ success: true });
        } catch (err) { fail(res, err); }
    });

    router.post("/my-notices-reply", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        try {
            await ensureTables(db);
            const memId = req.cookies.key;
            const id = Number(req.body.id) || 0;
            const message = cleanText(req.body.message, 2000);
            const notice = (await visibleNotices(memId)).find((n) => n.id === id);
            if (!notice) return res.json({ success: false, message: "This notice is no longer available" });
            if (notice.allow_reply !== "1") return res.json({ success: false, message: "Replies are turned off for this notice" });
            if (message.length < 2) return res.json({ success: false, message: "Please write your reply" });
            const [[open]] = await db.promise().query(
                `SELECT COUNT(*)::int AS n FROM dashboard_notice_replies WHERE notice_id = ? AND mem_id = ? AND status = '1'`, [id, memId]);
            if (open.n >= MAX_OPEN_REPLIES)
                return res.json({ success: false, message: "You already have replies waiting on this notice — please wait for the team to respond" });
            const t = now();
            const [r] = await db.promise().query(
                `INSERT INTO dashboard_notice_replies (req_id, notice_id, mem_id, message, status, datetime, updated)
                 VALUES (?, ?, ?, ?, '1', ?, ?)`,
                ["dr" + crypto.randomBytes(12).toString("hex"), id, memId, message, t, t]
            );
            // replying counts as having read it
            await db.promise().query(
                `INSERT INTO dashboard_notice_reads (notice_id, mem_id, read_at) VALUES (?, ?, ?)
                 ON CONFLICT (notice_id, mem_id) DO NOTHING RETURNING notice_id`, [id, memId, t]);
            addactivity(memId, String(r.insertId), "dashboard_notice_replies", "Replied to the notice '" + notice.title + "'", "", "");
            const [out] = await db.promise().query(
                `SELECT id, notice_id, message, status, progress_note, progress_at, done_note, done_at, datetime
                 FROM dashboard_notice_replies WHERE id = ?`, [r.insertId]);
            res.json({ success: true, data: out[0], message: "Reply sent" });
        } catch (err) { fail(res, err, "Could not send your reply"); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/dashboard-notices" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "dashboard_notices" },
    { table: "dashboard_notice_replies" },
];

// Creates the tables; routes.js runs this before installing deleted_records
// triggers, so the new tables are covered from the first start.
module.exports.init = ensureTables;
