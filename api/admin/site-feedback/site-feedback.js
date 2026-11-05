/**
 * API routes for src/pages/panel/admin/SiteFeedback.tsx.
 * /site-feedback is the website feedback badge (components/FeedbackBadge.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { verifyTurnstile } = require("../../security/turnstile");

module.exports = (router, ctx) => {
    const { db, dateRangeFilter, validateSecurity, verifyAccount, addactivity } = ctx;

    /* ===================== Site Feedback =====================
       The "Share Your Feedback" tab on every public page (FeedbackBadge.tsx).
       Visitors rate the site 1-5 and leave optional notes; admins (X,Y) review
       them at /panel/site-feedback. Stored in feedbacks with type 's' (see docs/feedbacks_merge.sql). */

    /* ---- Public: submit site feedback ---- */
    router.post("/site-feedback", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }
        try {
            const rating = parseInt(req.body.rating, 10);
            const name = String(req.body.name || "").trim();
            const liked = String(req.body.liked || "").trim();
            const improve = String(req.body.improve || "").trim();
            let page = String(req.body.page || "").trim();
            if (!(rating >= 1 && rating <= 5)) return res.json({ success: false, message: "Please choose a rating first." });
            if (name.length < 2 || name.length > 120) return res.json({ success: false, message: "Please tell us your name." });
            if (liked.length > 2000 || improve.length > 2000) return res.json({ success: false, message: "Please keep each answer under 2000 characters." });
            // Path only (e.g. "/courses") — anything else is dropped.
            if (!page.startsWith("/") || page.length > 300) page = "";
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                "INSERT INTO feedbacks (mem_id, course_id, name, feedback, rating, liked, improve, page, type, datetime, status) VALUES ('', '', ?, '', ?, ?, ?, ?, 's', ?, '1')",
                [name, rating, liked, improve, page, datetime]
            );
            return res.json({ success: true, message: "Thank you for your feedback!" });
        } catch (err) { console.error("site-feedback:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    /* ---- Admin: list site feedback (paginated) ---- */
    router.post("/site-feedback/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const search = req.body.q ? String(req.body.q).trim() : "";
            const sortby = req.body.s ? String(req.body.s).trim() : "";
            const rating = parseInt(req.body.r, 10);
            const status = req.body.st ? String(req.body.st).trim() : "";
            let page = req.body.n ? parseInt(req.body.n) : 1;
            const orderBy = sortby === "Old" ? "id ASC" : sortby === "Low" ? "rating ASC, id DESC" : sortby === "High" ? "rating DESC, id DESC" : "id DESC";
            let where = "WHERE type = 's'";
            const params = [];
            if (search) {
                where += " AND (name ILIKE ? OR liked ILIKE ? OR improve ILIKE ? OR page ILIKE ?)";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (rating >= 1 && rating <= 5) { where += " AND rating = ?"; params.push(rating); }
            if (status === "1" || status === "2") { where += " AND status = ?"; params.push(status); }
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const [countRows] = await db.promise().query(
                `SELECT COUNT(id) AS total, COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS "avgRating",
                        COUNT(id) FILTER (WHERE status = '1') AS "newCount"
                 FROM feedbacks ${where} ${dr.clause("datetime::text")}`,
                params
            );
            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
            if (page > lastPage && lastPage > 0) page = lastPage;
            const offset = (page - 1) * limit;
            const [rows] = await db.promise().query(
                `SELECT id, name, rating, liked, improve, page, datetime, status FROM feedbacks
                 ${where} ${dr.clause("datetime::text")} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            return res.json({
                success: true, data: rows, total, page, lastPage,
                avgRating: Number(countRows[0]?.avgRating) || 0,
                newCount: Number(countRows[0]?.newCount) || 0,
            });
        } catch (err) { console.error("site-feedback/list:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* ---- Admin: mark site feedback as reviewed / new ---- */
    router.post("/site-feedback/status", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id, status } = req.body;
            if (!id || (status !== "1" && status !== "2")) return res.json({ success: false, message: "Invalid request" });
            const [rows] = await db.promise().query("SELECT name FROM feedbacks WHERE id=? AND type='s' LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Feedback not found" });
            await db.promise().query("UPDATE feedbacks SET status=? WHERE id=? AND type='s'", [status, id]);
            addactivity(ukey, String(id), "feedbacks", "Site feedback from '" + rows[0].name + "' marked " + (status === "2" ? "reviewed" : "new"), "", "");
            return res.json({ success: true, message: status === "2" ? "Marked as reviewed" : "Marked as new" });
        } catch (err) { console.error("site-feedback/status:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* ---- Admin: delete site feedback ---- */
    router.post("/site-feedback/delete", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Invalid feedback" });
            const [rows] = await db.promise().query("SELECT name FROM feedbacks WHERE id=? AND type='s' LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Feedback not found" });
            await db.promise().query("DELETE FROM feedbacks WHERE id=? AND type='s'", [id]);
            addactivity(ukey, String(id), "feedbacks", "Site feedback from '" + rows[0].name + "' deleted", "", "");
            return res.json({ success: true, message: "Feedback deleted" });
        } catch (err) { console.error("site-feedback/delete:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/site-feedback" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "feedbacks", when: "OLD.type = 's'" },
];
