/**
 * API routes for src/pages/panel/admin/WorkshopRegistrations.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, dateRangeFilter, verifyAccount, addactivity } = ctx;

    /* ---- Admin: list workshop registrations (paginated) ---- */
    router.post("/workshop-registrations/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const search = req.body.q ? String(req.body.q).trim() : "";
            const sortby = req.body.s ? String(req.body.s).trim() : "";
            const topic = typeof req.body.t === "string" ? req.body.t : null;
            const status = req.body.st ? String(req.body.st).trim() : "";
            let page = req.body.n ? parseInt(req.body.n) : 1;
            const orderBy = sortby === "Old" ? "id ASC" : "id DESC";
            let where = "WHERE 1=1";
            const params = [];
            if (search) {
                where += " AND (name ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR topic ILIKE ?)";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (topic !== null && topic !== "__all") { where += " AND topic = ?"; params.push(topic); }
            if (status === "1" || status === "2") { where += " AND status = ?"; params.push(status); }
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const [countRows] = await db.promise().query(
                `SELECT COUNT(id) AS total, COUNT(id) FILTER (WHERE status = '1') AS "newCount"
                 FROM workshop_registrations ${where} ${dr.clause("datetime::text")}`,
                params
            );
            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
            if (page > lastPage && lastPage > 0) page = lastPage;
            const offset = (page - 1) * limit;
            const [rows] = await db.promise().query(
                `SELECT id, name, email, phone, topic, datetime, status FROM workshop_registrations
                 ${where} ${dr.clause("datetime::text")} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            // Every topic registered so far, for the filter dropdown.
            const [topics] = await db.promise().query(
                `SELECT topic, COUNT(id) AS n FROM workshop_registrations GROUP BY topic ORDER BY topic ASC`
            );
            return res.json({
                success: true, data: rows, total, page, lastPage,
                newCount: Number(countRows[0]?.newCount) || 0,
                topics: topics.map((t) => ({ topic: t.topic, count: Number(t.n) || 0 })),
            });
        } catch (err) { console.error("workshop-registrations/list:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* ---- Admin: mark a registration contacted / new ---- */
    router.post("/workshop-registrations/status", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id, status } = req.body;
            if (!id || (status !== "1" && status !== "2")) return res.json({ success: false, message: "Invalid request" });
            const [rows] = await db.promise().query("SELECT name FROM workshop_registrations WHERE id=? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Registration not found" });
            await db.promise().query("UPDATE workshop_registrations SET status=? WHERE id=?", [status, id]);
            addactivity(ukey, String(id), "workshop_registrations", "Workshop registration '" + rows[0].name + "' marked " + (status === "2" ? "contacted" : "new"), "", "");
            return res.json({ success: true, message: status === "2" ? "Marked as contacted" : "Marked as new" });
        } catch (err) { console.error("workshop-registrations/status:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* ---- Admin: delete a registration ---- */
    router.post("/workshop-registrations/delete", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Invalid registration" });
            const [rows] = await db.promise().query("SELECT name FROM workshop_registrations WHERE id=? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Registration not found" });
            await db.promise().query("DELETE FROM workshop_registrations WHERE id=?", [id]);
            addactivity(ukey, String(id), "workshop_registrations", "Workshop registration '" + rows[0].name + "' deleted", "", "");
            return res.json({ success: true, message: "Registration deleted" });
        } catch (err) { console.error("workshop-registrations/delete:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/workshop-registrations" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "workshop_registrations" },
];
