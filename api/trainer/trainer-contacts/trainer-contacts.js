/**
 * API routes for src/pages/panel/trainer/TrainerContacts.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, statusFilter, dateRangeFilter, verifyAccount, addactivity } = ctx;

    /* =====================================================================
       TRAINER: STUDENT QUERIES (STUDENTS -> TRAINER RECEIVED MESSAGES)
       ===================================================================== */
    router.post("/trainer/trainer-contacts", async (req, res) => {
        if (!(await verifyAccount(req, res, "2"))) return;
        const { key: ukey } = req.cookies;

        try {
            const { q, s, n } = req.body;

            /* 1️⃣ Query Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort */
            let orderBy = "cr.id DESC";
            if (sortby === "Old") {
                orderBy = "cr.id ASC";
            }

            /* 3️⃣ Search Filter */
            let where = "WHERE cr.type = 'trainer_queries' AND cr.to_id = ? AND (cr.status='1' OR cr.status='2')";
            let params = [ukey];

            if (search) {
                where = "WHERE cr.type = 'trainer_queries' AND cr.to_id = ? AND (COALESCE(s.name, cr.name) ILIKE ? OR COALESCE(s.email, cr.email) ILIKE ? OR COALESCE(s.number, cr.number) ILIKE ? OR cr.msg ILIKE ?) AND (cr.status='1' OR cr.status='2')";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            /* 3️⃣.5 Date Filter */
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* 3️⃣.6 Status Filter */
            const sf = statusFilter(req.body.st);

            /* 4️⃣ Pagination */
            const limit = 10;
            const offset = (page - 1) * limit;

            let stats = {
                pending: 0,
                viewed: 0,
                total: 0
            };

            /* 5️⃣ Count Total grouped by status */
            const countSql = `
                SELECT COUNT(cr.id) AS total, cr.status as status
                FROM contacts cr
                LEFT JOIN members s ON s.mem_id = cr.mem_id
                ${where} ${dr.clause("cr.datetime")}
                GROUP BY cr.status
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
                    const rowTotal = parseInt(row.total, 10) || 0;
                    if (row.status === "1") {
                        stats.pending = rowTotal;
                    }
                    if (row.status === "2") {
                        stats.viewed = rowTotal;
                    }
                    stats.total += rowTotal;
                });

                if (sf.value === "1") stats.total = stats.pending;
                else if (sf.value === "2") stats.total = stats.viewed;

                const lastPage = stats.total === 0 ? 0 : Math.ceil(stats.total / limit);
                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSql = `
                    SELECT
                        cr.id, cr.mem_id, cr.to_id, cr.msg, cr.datetime, cr.status,
                        COALESCE(s.name, cr.name) AS sname,
                        COALESCE(s.email, cr.email) AS semail,
                        COALESCE(s.number, cr.number) AS sphone
                    FROM contacts cr
                    LEFT JOIN members s ON s.mem_id = cr.mem_id
                    ${where} ${dr.clause("cr.datetime")} ${sf.clause("cr.status")}
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

    router.post("/trainer/viewed-trainer-contact", async (req, res) => {
        if (!(await verifyAccount(req, res, "2"))) return;
        const { key: ukey } = req.cookies;

        try {
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Missing contact ID" });

            const updateSql = `
                UPDATE contacts
                SET status = '2'
                WHERE id = ? AND to_id = ? AND type = 'trainer_queries' AND status = '1'
            `;

            db.query(updateSql, [id, ukey], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.json({ success: false, message: "Database error" });
                }
                if (result.affectedRows === 1) {
                    addactivity(ukey, id, "contacts", "Viewed student query", "", "");
                    return res.json({ success: true, message: "Marked as viewed" });
                }
                return res.json({ success: true, message: "Already viewed" });
            });
        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });
};
