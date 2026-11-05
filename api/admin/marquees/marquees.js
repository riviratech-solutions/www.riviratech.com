/**
 * API routes for src/pages/panel/admin/Marquees.tsx — scrolling messages shown
 * in the website header (under the navigation bar) and/or footer (above it).
 *
 *   marquees(id, req_id, title, html, css, placement 'header'|'footer'|'both',
 *            pages JSON ["*"] or page keys (src/utils/marqueePages.ts),
 *            speed 'slow'|'normal'|'fast', direction 'left'|'right',
 *            pause_hover '1'|'0', closable '1'|'0', start_at / end_at (epoch
 *            seconds, 0 = none), sortno, status '1' active | '1S' hidden,
 *            datetime, updated)
 *
 * Admin: POST /marquees-list, /marquees-save (add or update), /marquees-toggle,
 *        /marquees-reorder, /marquees-delete
 * Website: GET /public/marquees — active messages inside their schedule.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

const PLACEMENTS = ["header", "footer", "both"];
const SPEEDS = ["slow", "normal", "fast"];
const PAGE_KEY = /^[a-z0-9*-]{1,40}$/;

/* Stored HTML/CSS is cleaned again in the browser (sanitizeHtml / scoped CSS);
   this first pass keeps scripts and the obvious tricks out of the database. */
const { cleanHtml, cleanCss } = require("../../security/markup-clean");
const toEpoch = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

let ready = null;
function ensureTable(db) {
    if (!ready) {
        ready = db.pool
            .query(`
                CREATE TABLE IF NOT EXISTS marquees (
                    id SERIAL PRIMARY KEY,
                    req_id TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    html TEXT NOT NULL DEFAULT '',
                    css TEXT NOT NULL DEFAULT '',
                    placement TEXT NOT NULL DEFAULT 'header',
                    pages TEXT NOT NULL DEFAULT '["*"]',
                    speed TEXT NOT NULL DEFAULT 'normal',
                    direction TEXT NOT NULL DEFAULT 'left',
                    pause_hover CHAR(1) NOT NULL DEFAULT '1',
                    closable CHAR(1) NOT NULL DEFAULT '0',
                    start_at BIGINT NOT NULL DEFAULT 0,
                    end_at BIGINT NOT NULL DEFAULT 0,
                    sortno INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT '1',
                    datetime BIGINT,
                    updated BIGINT
                );
                CREATE INDEX IF NOT EXISTS marquees_status_idx ON marquees (status, sortno);`)
            .catch((err) => {
                ready = null; // try again on the next call
                throw err;
            });
    }
    return ready;
}

module.exports = (router, ctx) => {
    const { db, verifyAccount, nextSortNo, applyReorder, addactivity } = ctx;
    ensureTable(db).catch((err) => console.error("marquees table:", err.message));

    const fail = (res, err, msg = "Something went wrong") => {
        console.error("marquees:", err && err.message ? err.message : err);
        res.json({ success: false, message: msg });
    };

    /* ---- admin ---- */
    router.post("/marquees-list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await ensureTable(db);
            const [rows] = await db.promise().query(`SELECT * FROM marquees ORDER BY sortno ASC, id ASC`);
            res.json({ success: true, data: rows, now: Math.floor(Date.now() / 1000) });
        } catch (err) { fail(res, err, "Failed to load messages"); }
    });

    router.post("/marquees-save", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await ensureTable(db);
            const b = req.body || {};
            const title = String(b.title || "").trim().slice(0, 150);
            const html = cleanHtml(b.html);
            const css = cleanCss(b.css);
            const placement = PLACEMENTS.includes(b.placement) ? b.placement : "";
            let pages = Array.isArray(b.pages) ? b.pages.map(String).filter((p) => PAGE_KEY.test(p)) : [];
            if (pages.includes("*")) pages = ["*"];
            const speed = SPEEDS.includes(b.speed) ? b.speed : "normal";
            const direction = b.direction === "right" ? "right" : "left";
            const pauseHover = b.pause_hover === false || b.pause_hover === "0" ? "0" : "1";
            const closable = b.closable === true || b.closable === "1" ? "1" : "0";
            const startAt = toEpoch(b.start_at);
            const endAt = toEpoch(b.end_at);

            if (title.length < 2) return res.json({ success: false, message: "Please enter a title" });
            if (html.replace(/<[^>]*>/g, "").trim().length < 1) return res.json({ success: false, message: "Please enter the message" });
            if (!placement) return res.json({ success: false, message: "Choose where to show it: header, footer or both" });
            if (!pages.length) return res.json({ success: false, message: "Choose at least one page" });
            if (startAt && endAt && endAt <= startAt) return res.json({ success: false, message: "The expiry must be after the start" });

            const now = Math.floor(Date.now() / 1000);
            const ukey = req.cookies.key;
            const fields = [title, html, css, placement, JSON.stringify(pages), speed, direction, pauseHover, closable, startAt, endAt];
            let id = Number(b.id) || 0;
            if (id) {
                const [r] = await db.promise().query(
                    `UPDATE marquees SET title = ?, html = ?, css = ?, placement = ?, pages = ?, speed = ?, direction = ?,
                        pause_hover = ?, closable = ?, start_at = ?, end_at = ?, updated = ? WHERE id = ?`,
                    [...fields, now, id]
                );
                if (!r.affectedRows) return res.json({ success: false, message: "Message not found" });
                addactivity(ukey, String(id), "marquees", "Marquee message updated '" + title + "'", "", "");
            } else {
                const sortno = await nextSortNo("marquees");
                const reqId = "mq" + crypto.randomBytes(12).toString("hex");
                const [r] = await db.promise().query(
                    `INSERT INTO marquees (req_id, title, html, css, placement, pages, speed, direction, pause_hover, closable,
                        start_at, end_at, sortno, status, datetime, updated)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?)`,
                    [reqId, ...fields, sortno, now, now]
                );
                id = r.insertId;
                addactivity(ukey, String(id), "marquees", "Marquee message added '" + title + "'", "", "");
            }
            const [rows] = await db.promise().query(`SELECT * FROM marquees WHERE id = ?`, [id]);
            res.json({ success: true, data: rows[0], message: b.id ? "Message updated" : "Message added" });
        } catch (err) { fail(res, err); }
    });

    router.post("/marquees-toggle", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const active = !!req.body.active;
            await db.promise().query(`UPDATE marquees SET status = ?, updated = ? WHERE id = ?`,
                [active ? "1" : "1S", Math.floor(Date.now() / 1000), req.body.id]);
            res.json({ success: true, message: active ? "Shown on the website" : "Hidden from the website" });
        } catch (err) { fail(res, err); }
    });

    router.post("/marquees-reorder", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try { await applyReorder("marquees", req.body.ids, res); }
        catch (err) { fail(res, err); }
    });

    router.post("/marquees-delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(`SELECT title FROM marquees WHERE id = ?`, [req.body.id]);
            if (!rows.length) return res.json({ success: false, message: "Message not found" });
            await db.promise().query(`DELETE FROM marquees WHERE id = ?`, [req.body.id]);
            addactivity(req.cookies.key, String(req.body.id), "marquees", "Marquee message deleted '" + rows[0].title + "'", "", "");
            res.json({ success: true, message: "Message deleted" });
        } catch (err) { fail(res, err); }
    });

    /* ---- website: what to show now ---- */
    router.get("/public/marquees", async (req, res) => {
        try {
            await ensureTable(db);
            const now = Math.floor(Date.now() / 1000);
            const [rows] = await db.promise().query(
                `SELECT req_id, html, css, placement, pages, speed, direction, pause_hover, closable, start_at, end_at
                 FROM marquees
                 WHERE status = '1' AND (start_at = 0 OR start_at <= ?) AND (end_at = 0 OR end_at > ?)
                 ORDER BY sortno ASC, id ASC`,
                [now, now]
            );
            res.set("Cache-Control", "public, max-age=60");
            res.json({ success: true, data: rows.map((r) => ({ ...r, pages: JSON.parse(r.pages || '["*"]') })) });
        } catch (err) {
            console.error("public marquees:", err.message);
            res.json({ success: true, data: [] });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/marquees" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "marquees" },
];

// Creates the table; routes.js runs this before installing deleted_records
// triggers, so the new table is covered from the first start.
module.exports.init = ensureTable;
