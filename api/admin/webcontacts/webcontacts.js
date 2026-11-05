/**
 * API routes for src/pages/panel/admin/Webcontacts.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, statusFilter, dateRangeFilter, verifyAccount, addactivity } = ctx;

    router.post("/web-contacts", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id, q, s, n} = req.body;

            /* 1️⃣ Get Query Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort */
            let orderBy = "id DESC";

            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Search Filter */
            let where = "WHERE COALESCE(type, 'contacts') = 'contacts' AND (status='1' OR status='2' OR status='1D')";
            let params = [];

            if (search) {
                where =
                    "WHERE COALESCE(type, 'contacts') = 'contacts' AND (name ILIKE ? OR email ILIKE ? OR number ILIKE ? OR msg ILIKE ?) AND (status='1' OR status='2' OR status='1D')";
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
            }

            /* 3️⃣.5 Date Filter */
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* 3️⃣.6 Status Filter (All / Pending / Viewed) — list rows only, so
               `sf.params` stays out of `params` and is appended to dataParams. */
            const sf = statusFilter(req.body.st);

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            let stats = {
                pending: 0,
                viewed: 0,
                total: 0
            };

            /* 5️⃣ Count Total — every status, so the stats card keeps the split */
            const countSql = `
                SELECT COUNT(id) AS total, status
                FROM contacts
                ${where} ${dr.clause()}
                GROUP BY status
                `;

            db.query(countSql, params, (err, countRows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                countRows.forEach((row) => {

                    if (row.status === "1") {
                        stats.pending = row.total;
                    }

                    if (row.status === "2") {
                        stats.viewed = row.total;
                    }

                    stats.total += row.total;

                });

                /* The list shows only the selected status, so paginate over that
                   subset. It is already in the grouped count above — no second
                   query needed — while stats.pending/viewed stay the full split. */
                if (sf.value === "1") stats.total = stats.pending;
                else if (sf.value === "2") stats.total = stats.viewed;

                const lastPage = stats.total === 0
                    ? 0
                    : Math.ceil(stats.total / limit);

                /* Fix Page Overflow */
                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSql = `
                    SELECT
                        *
                    FROM contacts
                    ${where} ${dr.clause()} ${sf.clause()}
                    ORDER BY ${orderBy}
                    LIMIT ? OFFSET ?
                    `;

                const dataParams = [...params, ...sf.params, limit, offset];

                db.query(dataSql, dataParams, (err2, rows) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    /* 7️⃣ No Data */
                    if (rows.length === 0) {

                        return res.json({
                            success: false,
                            data: [],
                            stats,
                            page,
                            lastPage,
                            message: "No data found"
                        });

                    }

                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: rows,
                        stats,
                        page,
                        lastPage
                    });

                });

            });

        } catch (err) {

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    router.post("/viewed-web-contact", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 0) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT id
                FROM contacts
                WHERE id = ? AND COALESCE(type, 'contacts') = 'contacts' AND (status = '1' OR status = '1D' OR status = '2')
                LIMIT 1
                `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                const dbId = rows[0].id;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE contacts
                    SET status = '2'
                    WHERE id = ? AND COALESCE(type, 'contacts') = 'contacts' AND (status = '1' OR status = '1D' OR status = '2')
                    LIMIT 1
                `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Web contact info saved as viewed to '" + id + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "contacts", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Contact details was successfully saved as viewed"
                        });

                    } else {

                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });

                    }

                });

            });

        } catch (err) {

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    router.post("/delete-web-contact", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Missing contact ID" });

            const [rows] = await db.promise().query(
                "SELECT id, name, msg FROM contacts WHERE id = ? AND COALESCE(type, 'contacts') = 'contacts' LIMIT 1",
                [id]
            );

            if (!rows.length) {
                return res.json({ success: false, message: "Contact inquiry not found" });
            }

            await db.promise().query(
                "DELETE FROM contacts WHERE id = ? AND COALESCE(type, 'contacts') = 'contacts'",
                [id]
            );

            addactivity(ukey, id, "contacts", "Deleted web contact inquiry ID " + id, "", "");
            return res.json({ success: true, message: "Web contact inquiry deleted successfully" });
        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/webcontacts" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "contacts", when: "COALESCE(OLD.type, 'contacts') <> 'trainer_queries'" },
];
