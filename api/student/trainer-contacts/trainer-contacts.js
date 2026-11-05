/**
 * API routes for src/pages/panel/student/TrainerContacts.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, statusFilter, dateRangeFilter, verifyAccount, addactivity } = ctx;

    /* =====================================================================
       STUDENT: TRAINER CONTACTS (STUDENT -> TRAINER QUERIES)
       ===================================================================== */
    router.post("/student/trainer-contacts", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
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
            let where = "WHERE cr.type = 'trainer_queries' AND cr.mem_id = ? AND (cr.status='1' OR cr.status='2')";
            let params = [ukey];

            if (search) {
                where = "WHERE cr.type = 'trainer_queries' AND cr.mem_id = ? AND (t.name ILIKE ? OR t.email ILIKE ? OR t.number ILIKE ? OR cr.msg ILIKE ?) AND (cr.status='1' OR cr.status='2')";
                params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            /* 3️⃣.5 Date Filter */
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* 3️⃣.6 Status Filter (All / Pending / Viewed) */
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
                LEFT JOIN members t ON t.mem_id = cr.to_id
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
                        cr.*,
                        t.name AS tname, t.email AS temail, t.number AS tphone
                    FROM contacts cr
                    LEFT JOIN members t ON t.mem_id = cr.to_id
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

    router.post("/student/contact-trainer", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        const { key: ukey } = req.cookies;

        try {
            const { to_id, msg } = req.body;
            if (!to_id || !String(to_id).trim()) {
                return res.json({ success: false, message: "Please select a trainer" });
            }
            if (!msg || !String(msg).trim()) {
                return res.json({ success: false, message: "Please enter your query message" });
            }

            db.query("SELECT name, email, number FROM members WHERE mem_id = ? LIMIT 1", [ukey], (err, srows) => {
                if (err) {
                    console.error(err);
                    return res.json({ success: false, message: "Database error" });
                }
                const sname = srows[0]?.name || "";
                const semail = srows[0]?.email || "";
                const snumber = srows[0]?.number || "";
                const now = Math.floor(Date.now() / 1000).toString();

                const insSql = `INSERT INTO contacts (mem_id, to_id, name, email, number, msg, type, datetime, status)
                                VALUES (?, ?, ?, ?, ?, ?, 'trainer_queries', ?, '1')`;
                db.query(insSql, [ukey, String(to_id).trim(), sname, semail, snumber, String(msg).trim(), now], (err2) => {
                    if (err2) {
                        console.error(err2);
                        return res.json({ success: false, message: "Failed to send query" });
                    }
                    addactivity(ukey, "", "contacts", "Sent query to trainer", "", "");
                    return res.json({ success: true, message: "Your query has been sent to the trainer successfully" });
                });
            });
        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });

    router.post("/student/trainers-list", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;

        try {
            const sql = `SELECT mem_id, name, email, number FROM members WHERE status = '2' ORDER BY name ASC`;
            db.query(sql, [], (err, rows) => {
                if (err) {
                    console.error(err);
                    return res.json({ success: false, message: "Database error" });
                }
                return res.json({ success: true, trainers: rows });
            });
        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });

    router.post("/student/delete-trainer-contact", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        const { key: ukey } = req.cookies;

        try {
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Missing contact ID" });

            const deltime = Math.floor(Date.now() / 1000).toString();
            const sql = `UPDATE contacts SET status = '1D', deltime = ? WHERE id = ? AND mem_id = ? AND status = '1'`;
            db.query(sql, [deltime, id, ukey], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.json({ success: false, message: "Database error" });
                }
                if (result.affectedRows === 1) {
                    addactivity(ukey, id, "contacts", "Deleted query to trainer", "", "");
                    return res.json({ success: true, message: "Query deleted successfully" });
                } else {
                    return res.json({ success: false, message: "Query not found or already viewed" });
                }
            });
        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });
};
