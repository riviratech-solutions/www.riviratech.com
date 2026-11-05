/**
 * API routes for src/pages/panel/admin/CustomPages.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, md5, verifyAccount, addactivity, pageSlugify } = ctx;

    // ---- Admin: list pages (paginated, like /blogs) ----
    router.post("/pages", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const search = req.body.q ? String(req.body.q).trim() : "";
            const sortby = req.body.s ? String(req.body.s).trim() : "";
            let page = req.body.n ? parseInt(req.body.n) : 1;
            const orderBy = sortby === "Old" ? "id ASC" : "id DESC";
            let where = "WHERE (status='1' OR status='1S')";
            const params = [];
            if (search) {
                where = "WHERE (title ILIKE ? OR slug ILIKE ?) AND (status='1' OR status='1S')";
                params.push(`%${search}%`, `%${search}%`);
            }
            const limit = 10;
            const [countRows] = await db.promise().query(`SELECT COUNT(id) AS total FROM custom_pages ${where}`, params);
            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
            if (page > lastPage && lastPage > 0) page = lastPage;
            const offset = (page - 1) * limit;
            const [rows] = await db.promise().query(
                `SELECT * FROM custom_pages ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]
            );
            return res.json({ success: true, data: rows, total, page, lastPage });
        } catch (err) { console.error("pages:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: create a page ----
    router.post("/add-page", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { title, html, css } = req.body;
            const slug = pageSlugify(req.body.slug || title);
            if (!title || title.trim().length <= 2) return res.json({ success: false, message: "Please enter page title" });
            if (!slug) return res.json({ success: false, message: "Invalid page link (slug)" });
            if (!html || html.trim().length <= 5) return res.json({ success: false, message: "Page HTML content required" });
            const [dup] = await db.promise().query("SELECT id FROM custom_pages WHERE slug = ? LIMIT 1", [slug]);
            if (dup.length) return res.json({ success: false, message: "That page link (slug) is already in use" });
            const datetime = Math.floor(Date.now() / 1000);
            const req_id = "p" + md5(crypto.randomBytes(32).toString("hex") + Date.now());
            await db.promise().query(
                "INSERT INTO custom_pages (req_id, slug, title, html, css, datetime, status) VALUES (?,?,?,?,?,?, '1')",
                [req_id, slug, title.trim(), html, css || "", datetime]
            );
            const [rows] = await db.promise().query("SELECT * FROM custom_pages WHERE req_id = ? LIMIT 1", [req_id]);
            addactivity(ukey, req_id, "pages", "New page added '" + title.trim() + "'", "", "");
            return res.json({ success: true, data: rows[0], message: "Page successfully created" });
        } catch (err) { console.error("add-page:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Admin: update a page ----
    router.post("/update-page", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { req_id, title, html, css } = req.body;
            const slug = pageSlugify(req.body.slug || title);
            if (!req_id || req_id.length <= 10) return res.json({ success: false, message: "Invalid page ID" });
            if (!title || title.trim().length <= 2) return res.json({ success: false, message: "Please enter page title" });
            if (!slug) return res.json({ success: false, message: "Invalid page link (slug)" });
            if (!html || html.trim().length <= 5) return res.json({ success: false, message: "Page HTML content required" });
            const [dups] = await db.promise().query("SELECT id FROM custom_pages WHERE slug = ? AND req_id != ? LIMIT 1", [slug, req_id]);
            if (dups.length) return res.json({ success: false, message: "That page link (slug) is already in use" });
            const [r] = await db.promise().query(
                "UPDATE custom_pages SET slug=?, title=?, html=?, css=? WHERE req_id=?",
                [slug, title.trim(), html, css || "", req_id]
            );
            if (r.affectedRows !== 1) return res.json({ success: false, message: "No page found or no change made" });
            addactivity(ukey, req_id, "pages", "Page updated '" + title.trim() + "'", "", "");
            const [rows] = await db.promise().query("SELECT * FROM custom_pages WHERE req_id = ? LIMIT 1", [req_id]);
            return res.json({ success: true, data: rows[0], message: "Page successfully updated" });
        } catch (err) { console.error("update-page:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Admin: disable a page ----
    router.post("/disable-page", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id } = req.body;
            if (!id || id.length <= 10) return res.json({ success: false, message: "There was something wrong, Please try again" });
            const [rows] = await db.promise().query("SELECT title FROM custom_pages WHERE req_id=? AND status='1' LIMIT 1", [id]);
            if (rows.length !== 1) return res.json({ success: false, message: "There was something wrong, Please try again" });
            await db.promise().query("UPDATE custom_pages SET status='1S' WHERE req_id=? AND status='1'", [id]);
            addactivity(ukey, id, "pages", "Page disabled '" + rows[0].title + "'", "", "");
            return res.json({ success: true, message: "Page successfully disabled" });
        } catch (err) { console.error("disable-page:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Admin: enable a page ----
    router.post("/enable-page", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id } = req.body;
            if (!id || id.length <= 10) return res.json({ success: false, message: "There was something wrong, Please try again" });
            const [rows] = await db.promise().query("SELECT title FROM custom_pages WHERE req_id=? AND status='1S' LIMIT 1", [id]);
            if (rows.length !== 1) return res.json({ success: false, message: "There was something wrong, Please try again" });
            await db.promise().query("UPDATE custom_pages SET status='1' WHERE req_id=? AND status='1S'", [id]);
            addactivity(ukey, id, "pages", "Page enabled '" + rows[0].title + "'", "", "");
            return res.json({ success: true, message: "Page successfully enabled" });
        } catch (err) { console.error("enable-page:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Admin: delete a page ----
    router.post("/delete-page", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id } = req.body;
            if (!id || id.length <= 10) return res.json({ success: false, message: "There was something wrong, Please try again" });
            const [rows] = await db.promise().query("SELECT title FROM custom_pages WHERE req_id=? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Page not found" });
            await db.promise().query("DELETE FROM custom_pages WHERE req_id=?", [id]);
            addactivity(ukey, id, "pages", "Page deleted '" + rows[0].title + "'", "", "");
            return res.json({ success: true, message: "Page successfully deleted" });
        } catch (err) { console.error("delete-page:", err.message); return res.json({ success: false, message: "Server error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/custom-pages" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "custom_pages" },
];
