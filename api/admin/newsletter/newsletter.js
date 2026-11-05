/**
 * API routes for src/pages/panel/admin/Newsletter.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, dateRangeFilter, verifyAccount, addactivity } = ctx;

    /* ---- Admin: list newsletter subscribers (paginated) ---- */
    router.post("/newsletter/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const search = req.body.q ? String(req.body.q).trim() : "";
            const sortby = req.body.s ? String(req.body.s).trim() : "";
            let page = req.body.n ? parseInt(req.body.n) : 1;
            const orderBy = sortby === "Old" ? "id ASC" : "id DESC";
            let where = "WHERE 1=1";
            const params = [];
            if (search) { where += " AND email ILIKE ?"; params.push(`%${search}%`); }
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const [countRows] = await db.promise().query(`SELECT COUNT(id) AS total FROM newsletter ${where} ${dr.clause("datetime::text")}`, params);
            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
            if (page > lastPage && lastPage > 0) page = lastPage;
            const offset = (page - 1) * limit;
            const [rows] = await db.promise().query(
                `SELECT id, email, datetime, status FROM newsletter ${where} ${dr.clause("datetime::text")} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            return res.json({ success: true, data: rows, total, page, lastPage });
        } catch (err) { console.error("newsletter/list:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* ---- Admin: remove a newsletter subscriber ---- */
    router.post("/newsletter/delete", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Invalid subscriber" });
            const [rows] = await db.promise().query("SELECT email FROM newsletter WHERE id=? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Subscriber not found" });
            await db.promise().query("DELETE FROM newsletter WHERE id=?", [id]);
            addactivity(ukey, String(id), "newsletter", "Newsletter subscriber removed '" + rows[0].email + "'", "", "");
            return res.json({ success: true, message: "Subscriber removed" });
        } catch (err) { console.error("newsletter/delete:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/newsletter" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "newsletter" },
];
