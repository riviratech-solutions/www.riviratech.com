/**
 * API routes for src/pages/panel/admin/Subscriptions.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, md5, dateRangeFilter, verifyAccount, addactivity } = ctx;

    router.post("/subscriptions", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id, q, s, n} = req.body;

            /* 1️⃣ Get Query Params */
            const search = q ? q.trim() : "";
            const st = ["0", "1", "2", "1D"].includes(String(req.body.st || "")) ? String(req.body.st) : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort */
            let orderBy = "id DESC";

            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Search Filter */
            let where = "WHERE (status='0' OR status='1' OR status='2' OR status='1D')";
            let params = [];

            if (search) {
                where =
                    "WHERE (sname ILIKE ? OR semail ILIKE ? OR snumber ILIKE ?) AND (status='0' OR status='1' OR status='2' OR status='1D')";
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
            }
            // the list (not the per-status counts) narrows to one status
            const searchParams = params.slice();
            const listWhere = st ? where + " AND status = ?" : where;

            /* 3️⃣.5 Date Filter */
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            let stats = {
                pending: 0,
                success: 0,
                failed: 0,
                revenue: 0,
                total: 0
            };

            /* 5️⃣ Count Total */
            let countSql = `
                SELECT COUNT(id) AS total, SUM(CASE WHEN fees ~ '^[0-9.]+$' THEN fees::numeric ELSE 0 END) AS fees, status
                FROM payments
                  ${where} ${dr.clause()}
                GROUP BY status
                `;
            if (search) {
                countSql = `
                SELECT COUNT(cr.id) AS total, cr.status as status
                FROM payments cr
                    LEFT JOIN members s
                        ON s.mem_id = cr.mem_id
                    LEFT JOIN enrollees e
                        ON e.req_id = cr.mem_id
                  ${where.replaceAll("sname", "COALESCE(s.name, e.name)").replaceAll("semail", "COALESCE(s.email, e.email)").replaceAll("snumber", "COALESCE(s.number, e.number)")
                        .replaceAll("status", "cr.status")
                    } ${dr.clause("cr.datetime")}
                GROUP BY cr.status
                `;
            }

            db.query(countSql, params, (err, countRows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                const byStatus = {};
                countRows.forEach((row) => {
                    byStatus[row.status] = Number(row.total) || 0;

                    if (row.status === "0") {
                        stats.failed = row.total;
                    }
                    if (row.status === "1") {
                        stats.pending = row.total;
                    }
                    if (row.status === "2") {
                        stats.success = row.total;
                        stats.revenue += row.fees;
                    }

                    stats.total += row.total;

                });

                const listTotal = st ? (byStatus[st] || 0) : stats.total;
                const lastPage = listTotal === 0
                    ? 0
                    : Math.ceil(listTotal / limit);

                /* Fix Page Overflow */
                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSqlx = `
                    SELECT
                        *
                    FROM payments
                    ${where} ${dr.clause()}
                    ORDER BY ${orderBy}
                    LIMIT ? OFFSET ?
                    `;

                /* 6️⃣ Fetch Data */
                const dataSql = `
                    SELECT
                        cr.*,
                        COALESCE(NULLIF(MAX(s.name),''),   MAX(e.name))   AS sname,
                        COALESCE(NULLIF(MAX(s.email),''),  MAX(e.email))  AS semail,
                        COALESCE(NULLIF(MAX(s.number),''), MAX(e.number)) AS sphone,
                        MAX(c.title) AS course_name
                    FROM payments cr
                    LEFT JOIN members s
                        ON s.mem_id = cr.mem_id
                    LEFT JOIN enrollees e
                        ON e.req_id = cr.mem_id
                  LEFT JOIN courses c
                        ON c.req_id = cr.crs_id

                    ${listWhere.replaceAll("sname", "COALESCE(s.name, e.name)").replaceAll("semail", "COALESCE(s.email, e.email)").replaceAll("snumber", "COALESCE(s.number, e.number)")
                        .replaceAll("status", "cr.status")
                    } ${dr.clause("cr.datetime")}

                    GROUP BY cr.id
                    ORDER BY ${orderBy.replaceAll("id", "cr.id")}
                    LIMIT ? OFFSET ?
                    `;

                const dataParams = [...searchParams, ...(st ? [st] : []), ...dr.params, limit, offset];

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
                            listTotal,
                            message: "No data found"
                        });

                    }

                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: rows,
                        stats,
                        page,
                        lastPage,
                        listTotal
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

    /* ---- Search students by email / number / name (for the manual-subscription picker) ---- */
    router.post("/students/search", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const q = (req.body.q || "").trim();
            if (q.length < 2) return res.json({ success: true, data: [] });
            // Also surface the student's LATEST member_courses row (course + batch).
            const [rows] = await db.promise().query(
                `SELECT m.mem_id, m.name, m.email, m.number,
                        lc.c_id AS crs_id,
                        (SELECT title FROM courses WHERE req_id = lc.c_id LIMIT 1) AS course_name,
                        lc.b_id,
                        (SELECT name FROM batches WHERE b_id = lc.b_id LIMIT 1) AS batch_name
                 FROM members m
                 LEFT JOIN LATERAL (
                     SELECT c_id, b_id FROM member_courses mc WHERE mc.mem_id = m.mem_id ORDER BY mc.id DESC LIMIT 1
                 ) lc ON true
                 WHERE (m.email ILIKE ? OR m.number ILIKE ? OR m.name ILIKE ?) AND m.status NOT IN ('X','Y')
                 ORDER BY m.id DESC LIMIT 10`,
                [`%${q}%`, `%${q}%`, `%${q}%`]
            );
            return res.json({ success: true, data: rows });
        } catch (err) { console.error("students/search:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* ---- Add a MANUAL subscription (payments row, type='1') for a real student ---- */
    router.post("/subscriptions/add", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { mem_id, semail, crs_id, pay_id, pay_intent, paydate, currency, fees, status } = req.body;
            if (!mem_id) return res.json({ success: false, message: "Please select a student" });
            const st = ["0", "1", "2"].includes(String(status)) ? String(status) : "2";
            // Batch picked in the Student Inquiries popup — must belong to the course.
            const b_id = String(req.body.b_id || "");
            if (b_id) {
                const [bRows] = await db.promise().query("SELECT b_id FROM batches WHERE b_id = ? AND c_id = ? LIMIT 1", [b_id, crs_id || ""]);
                if (!bRows.length) return res.json({ success: false, message: "That batch doesn't belong to the selected course" });
            }
            const req_id = "m" + md5(crypto.randomBytes(16).toString("hex") + Date.now());
            const datetime = paydate ? Math.floor(new Date(paydate).getTime() / 1000) : Math.floor(Date.now() / 1000);
            await db.promise().query(
                `INSERT INTO payments (req_id, mem_id, crs_id, pay_id, pay_intent, currency, fees, datetime, status, type)
                 VALUES (?,?,?,?,?,?,?,?,?, '1')`,
                [req_id, mem_id, crs_id || "", pay_id || "", pay_intent || "MANUAL", currency || "USD", String(fees || "0"), datetime, st]
            );

            // Only when added from the Student Inquiries page: approve that inquiry
            // (enrollees → '2', keyed by req_id = mem_id) and record the course +
            // batch chosen there. Never revives a rejected ('0') one.
            let enrolled = false;
            if (req.body.fromInquiry) {
                const [enrRes] = b_id
                    ? await db.promise().query(
                        `UPDATE enrollees SET status = ?, course = ?, bid = ? WHERE req_id = ? AND status <> '0'`,
                        ["2", crs_id, b_id, mem_id]
                    )
                    : await db.promise().query(
                        `UPDATE enrollees SET status = ? WHERE req_id = ? AND status <> '0'`,
                        ["2", mem_id]
                    );
                enrolled = (enrRes.affectedRows || 0) >= 1;
            }

            addactivity(ukey, req_id, "payments", "Manual subscription added for '" + semail + "'" + (b_id ? " (batch " + b_id + ")" : ""), "", "");
            return res.json({ success: true, message: "Subscription added", enrolled });
        } catch (err) { console.error("subscriptions/add:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* ---- Update a MANUAL subscription only (type='1') ---- */
    router.post("/subscriptions/update", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { req_id, crs_id, pay_id, pay_intent, paydate, currency, fees, status } = req.body;
            if (!req_id) return res.json({ success: false, message: "Invalid subscription" });
            const st = ["0", "1", "2"].includes(String(status)) ? String(status) : "2";
            const [rows] = await db.promise().query("SELECT id FROM payments WHERE req_id=? AND type='1' LIMIT 1", [req_id]);
            if (!rows.length) return res.json({ success: false, message: "Only manually-added subscriptions can be edited" });
            const datetime = paydate ? Math.floor(new Date(paydate).getTime() / 1000) : Math.floor(Date.now() / 1000);
            await db.promise().query(
                `UPDATE payments SET crs_id=?, pay_id=?, pay_intent=?, currency=?, fees=?, datetime=?, status=? WHERE req_id=? AND type='1'`,
                [crs_id || "", pay_id || "", pay_intent || "MANUAL", currency || "USD", String(fees || "0"), datetime, st, req_id]
            );
            addactivity(ukey, req_id, "payments", "Manual subscription updated '" + req_id + "'", "", "");
            return res.json({ success: true, message: "Subscription updated" });
        } catch (err) { console.error("subscriptions/update:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/subscriptions" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "payments" },
];
