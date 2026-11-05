/**
 * API routes for src/pages/panel/admin/BlogCategories.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, verifyAccount } = ctx;

    /* ================================================================
       BLOG CATEGORIES
    ================================================================ */

    // List (with optional search, sort, pagination; all=1 returns every active row for dropdowns)
    router.post("/blog-categories", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { q, s, n, all } = req.body;

            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            let orderBy = "id DESC";
            if (sortby === "Old") orderBy = "id ASC";
            if (sortby === "A-Z") orderBy = "name ASC";

            /* Full-table stats for the cards above the table (whole table, not this page) */
            let stats = null;
            try {
                const [statsRows] = await db.promise().query(
                    `SELECT
                     COUNT(id) AS total,
                     COUNT(CASE WHEN status = '1' THEN 1 END) AS active,
                     COUNT(CASE WHEN status <> '1' THEN 1 END) AS inactive,
                     COUNT(CASE WHEN slug IS NOT NULL AND slug <> '' THEN 1 END) AS slugs
                     FROM blog_categories`,
                    []
                );
                if (statsRows && statsRows[0]) {
                    const r = statsRows[0];
                    stats = { 
                total:    Number(r.total || 0),
                active:   Number(r.active || 0),
                inactive: Number(r.inactive || 0),
                slugs:    Number(r.slugs || 0),
             };
                }
            } catch (statErr) {
                console.error("blog categories stats error:", statErr);
            }

            let where = "WHERE 1=1";
            let params = [];

            if (search) {
                where += " AND name ILIKE ?";
                params.push(`%${search}%`);
            }

            // all=1 → return every active category (for dropdowns), no paging
            if (all === "1") {
                where += " AND status='1'";
                const sql = `SELECT * FROM blog_categories ${where} ORDER BY ${orderBy}`;
                db.query(sql, params, (err, rows) => {
                    if (err) return res.json({ success: false, message: "Database error" });
                    return res.json({ success: true, data: rows || [], total: rows.length, lastPage: 1, stats });
                });
                return;
            }

            const limit = 20;
            const offset = (page - 1) * limit;

            const countSql = `SELECT COUNT(id) AS total FROM blog_categories ${where}`;
            db.query(countSql, params, (err, countRows) => {
                if (err) return res.json({ success: false, message: "Database error" });

                const total = countRows[0]?.total || 0;
                const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
                if (page > lastPage && lastPage > 0) page = lastPage;

                const dataSql = `SELECT * FROM blog_categories ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
                db.query(dataSql, [...params, limit, offset], (err2, rows) => {
                    if (err2) return res.json({ success: false, message: "Database error" });
                    return res.json({ success: true, data: rows || [], total, lastPage, stats });
                });
            });

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // Add
    router.post("/add-blog-category", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { name, slug, status } = req.body;

            if (!name || name.trim().length < 1) {
                return res.json({ success: false, message: "Please enter category name" });
            }

            const catName = name.trim();
            const catSlug = (slug && slug.trim())
                ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                : catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const catStatus = status === "0" ? "0" : "1";

            // Check duplicate slug
            db.query("SELECT id FROM blog_categories WHERE slug = ?", [catSlug], (err, existing) => {
                if (err) return res.json({ success: false, message: "Database error" });
                if (existing && existing.length > 0) {
                    return res.json({ success: false, message: "A category with this slug already exists" });
                }

                const req_id = crypto.randomBytes(16).toString("hex");
                const datetime = Math.floor(Date.now() / 1000);

                const insertSql = `
                    INSERT INTO blog_categories (req_id, name, slug, status, datetime)
                    VALUES (?, ?, ?, ?, ?)
                `;
                db.query(insertSql, [req_id, catName, catSlug, catStatus, datetime], (err2, result) => {
                    if (err2) return res.json({ success: false, message: "Database error" });

                    db.query("SELECT * FROM blog_categories WHERE req_id = ?", [req_id], (err3, rows) => {
                        if (err3 || !rows || rows.length === 0) {
                            return res.json({ success: true, message: "Category added successfully", data: { req_id, name: catName, slug: catSlug, status: catStatus, datetime } });
                        }
                        return res.json({ success: true, message: "Category added successfully", data: rows[0] });
                    });
                });
            });

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // Update
    router.post("/update-blog-category", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { req_id, name, slug, status } = req.body;

            if (!req_id || req_id.length <= 10) {
                return res.json({ success: false, message: "Invalid category ID" });
            }
            if (!name || name.trim().length < 1) {
                return res.json({ success: false, message: "Please enter category name" });
            }

            const catName = name.trim();
            const catSlug = (slug && slug.trim())
                ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                : catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const catStatus = status === "0" ? "0" : "1";

            // Check duplicate slug (exclude self)
            db.query(
                "SELECT id FROM blog_categories WHERE slug = ? AND req_id != ?",
                [catSlug, req_id],
                (err, existing) => {
                    if (err) return res.json({ success: false, message: "Database error" });
                    if (existing && existing.length > 0) {
                        return res.json({ success: false, message: "A category with this slug already exists" });
                    }

                    const updateSql = `
                        UPDATE blog_categories SET name = ?, slug = ?, status = ? WHERE req_id = ?
                    `;
                    db.query(updateSql, [catName, catSlug, catStatus, req_id], (err2) => {
                        if (err2) return res.json({ success: false, message: "Database error" });
                        return res.json({ success: true, message: "Category updated successfully" });
                    });
                }
            );

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // Delete
    router.post("/delete-blog-category", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id } = req.body;

            if (!id || id.length <= 10) {
                return res.json({ success: false, message: "Invalid category ID" });
            }

            db.query("DELETE FROM blog_categories WHERE req_id = ?", [id], (err) => {
                if (err) return res.json({ success: false, message: "Database error" });
                return res.json({ success: true, message: "Category deleted successfully" });
            });

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/blog-categories" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "blog_categories" },
];
