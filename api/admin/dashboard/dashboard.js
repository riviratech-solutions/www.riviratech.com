/**
 * API routes for src/pages/panel/admin/Dashboard.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const adminPerms = require("../../security/admin-permissions");

module.exports = (router, ctx) => {
    const { db, verifyAccount, safeParse } = ctx;

    router.post("/dashboard-stats", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {

            // Get today's start & end (in seconds)
            const start = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
            const end = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);

            const sql = `
                SELECT
                (SELECT COUNT(*) FROM members WHERE status = '1') AS "totalStudents",
                (SELECT COUNT(*) AS total FROM members WHERE status = '1' AND NULLIF(datetime,'')::bigint BETWEEN ${start} AND ${end}) AS "todayStudents",
                (SELECT COUNT(*) FROM courses WHERE status='1') AS "activeCourses",
                (SELECT COUNT(*) FROM batches WHERE status='1') AS "activeBatches",
                (SELECT COUNT(*) FROM refers WHERE status IN ('1','2','3')) AS "refers",
                (SELECT COUNT(*) FROM contacts WHERE COALESCE(type, 'contacts') = 'contacts') AS "webContacts",
                (SELECT COUNT(*) FROM qa_sessions) AS "qaSessions",
                (SELECT COUNT(*) FROM feedbacks WHERE type = 'f') AS "feedbacks",
                (SELECT COUNT(*) FROM custom_form_submissions) AS "customForms",
                (SELECT COUNT(*) FROM survey_responses WHERE skipped='0') AS "surveys",
                (SELECT COUNT(*) FROM feedbacks WHERE type = 's') AS "siteFeedback",
                (SELECT COUNT(*) FROM workshop_registrations) AS "workshopRegistrations",
                (SELECT COUNT(*) FROM newsletter) AS "newsletter",
                (SELECT COUNT(*) FROM tickets) AS "raisedTickets",
                (SELECT COUNT(*) FROM enrollees WHERE status IN ('0', '1')) AS "studentInquiries",
                (SELECT COUNT(*) FROM enrollees WHERE status IN ('2', '3')) AS "enrolleesCount",
                (SELECT COUNT(*) FROM certificate_requests WHERE status IN ('0', '1', '2')) AS "certificateRequests"
            `;

            db.query(sql, (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length === 0) {
                    return res.json({
                        success: false,
                        message: "No Stats"
                    });
                }

                const stats = rows[0];

                // Today end
                const todayEnd = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);

                // 29 days ago start (30 days including today) — the dashboard
                // chart shows the last 7 / 14 / 30 days of this
                const sevenDaysAgoStart = Math.floor(
                    new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
                        .setHours(0, 0, 0, 0) / 1000
                );

                const sql = `
                    SELECT 
                        to_char(to_timestamp(NULLIF(datetime,'')::bigint), 'YYYY-MM-DD') AS day,
                        COUNT(*) AS total
                    FROM members
                    WHERE status = '1' AND NULLIF(datetime,'')::bigint BETWEEN ? AND ?
                    GROUP BY day
                    ORDER BY day ASC
                    `;

                db.query(sql, [sevenDaysAgoStart, todayEnd], async (err, results) => {
                    if (err) return res.json({ success: false, error: err });

                    const sql = `
                        SELECT 
                            to_char(to_timestamp(NULLIF(datetime,'')::bigint), 'YYYY-MM') AS month,
                            COUNT(*) AS total
                        FROM enrollees
                        WHERE NULLIF(datetime,'')::bigint >= extract(epoch from (date_trunc('month', current_date) - interval '11 month'))
                        GROUP BY month
                        ORDER BY month ASC
                        `;

                    db.query(sql, async (err, rows) => {

                        if (err) {
                            console.error(err);
                            return res.json({
                                success: false,
                                message: "Database error"
                            });
                        }

                        let studentsinquiries = {
                            pending: 0,
                            completed: 0,
                            total: 0,
                        };
                        const [studentsinquiriescheck] = await db.promise().query(
                            `SELECT COUNT(id) AS total, status FROM enrollees  GROUP BY status`,
                            []
                        );
                        studentsinquiriescheck.forEach((row) => {
                            if (row.status === "1") {
                                studentsinquiries.pending = row.total;
                            }
                            if (row.status === "2") {
                                studentsinquiries.completed = row.total;
                            }
                            studentsinquiries.total += row.total;
                        });

                        let assignments = {
                            pending: 0,
                            completed: 0,
                            ratio: 0,
                            total: 0,
                        };
                        const [assignmentscheck] = await db.promise().query(
                            `SELECT cr.id AS assignment_id, COUNT(DISTINCT ass.mem_id) AS total_submitted, COUNT(DISTINCT mc.mem_id) AS total_students, ROUND( (COUNT(DISTINCT ass.mem_id)::numeric / NULLIF(COUNT(DISTINCT mc.mem_id),0)) * 100, 2 ) AS submission_rate FROM assignments cr LEFT JOIN member_courses mc ON mc.c_id = cr.course LEFT JOIN assignmentsubs ass ON ass.req_id = cr.req_id AND ass.mem_id = mc.mem_id GROUP BY cr.id;`,
                            []
                        );
                        assignmentscheck.forEach((row) => {
                            assignments.pending = row.total_students;
                            assignments.completed = row.total_submitted;
                            assignments.ratio = row.submission_rate;
                            assignments.total += row.total;
                        });

                        const [coursepopularity] = await db.promise().query(
                            `SELECT cr.title AS name, COUNT(mc.id) AS total FROM courses AS cr
                        LEFT JOIN member_courses mc
                         ON mc.c_id = cr.req_id
                         WHERE cr.status = '1' GROUP BY cr.req_id, cr.title ORDER BY total DESC LIMIT 7`,
                            []
                        );

                        const [batchpopularity] = await db.promise().query(
                            `SELECT cr.name AS name, COUNT(mc.id) AS total FROM batches AS cr
                        LEFT JOIN member_courses mc
                         ON mc.b_id = cr.b_id
                         WHERE cr.status = '1' GROUP BY cr.b_id, cr.name ORDER BY total DESC LIMIT 7`,
                            []
                        );

                        const [recentactivities] = await db.promise().query(
                            `SELECT * FROM activities ORDER BY id DESC LIMIT 10`,
                            []
                        );

                        let certificaterequests = {
                            pending: 0,
                            rejected: 0,
                            approved: 0,
                            total: 0,
                        };
                        const [certificaterequestscheck] = await db.promise().query(
                            `SELECT COUNT(id) AS total, status FROM certificate_requests GROUP BY status`,
                            []
                        );
                        certificaterequestscheck.forEach((row) => {
                            if (row.status === "0") {
                                certificaterequests.rejected = row.total;
                            }
                            if (row.status === "1") {
                                certificaterequests.pending = row.total;
                            }
                            if (row.status === "2") {
                                certificaterequests.approved = row.total;
                            }
                            certificaterequests.total += row.total;
                        });

                        let paymentstats = {
                            pending: 0,
                            success: 0,
                            failed: 0,
                            revenue: 0,
                            total: 0
                        };

                        const [paymentstatscheck] = await db.promise().query(
                            `SELECT COUNT(id) AS total, SUM(CASE WHEN fees ~ '^[0-9.]+$' THEN fees::numeric ELSE 0 END) AS fees, status
                FROM payments WHERE (status='0' OR status='1' OR status='2' OR status='1D') GROUP BY status`,
                            []
                        );
                        paymentstatscheck.forEach((row) => {
                            if (row.status === "0") {
                                paymentstats.failed = row.total;
                            }
                            if (row.status === "1") {
                                paymentstats.pending = row.total;
                            }
                            if (row.status === "2") {
                                paymentstats.success = row.total;
                                paymentstats.revenue += row.fees;
                            }

                            paymentstats.total += row.total;
                        });

                        // an Admin (Y) only gets the figures of pages they may view
                        res.json(adminPerms.filterDashboard({
                            success: true,
                            stats: stats,
                            enrollees: rows,
                            studentsinquiries: studentsinquiries,
                            assignments: assignments,
                            coursepopularity: coursepopularity,
                            batchpopularity: batchpopularity,
                            recentactivities: recentactivities,
                            certificaterequests: certificaterequests,
                            paymentstats: paymentstats,
                            last7days: results
                        }, req.adminPerms));
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

    /* ---- Admin dashboard trend baseline (per user, cross-device) ----
       Each metric's baseline is the value it had when the admin last VIEWED that
       metric's page. A plain call returns the stored baselines (used on load to
       draw the pills). A call with `merge:{key:value}` updates only those keys —
       fired when a card is clicked — so viewing a page resets just that metric to
       0. Persisted by mem_id so it follows the user across devices. */
    router.post("/dashboard-snapshot", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const mem_id = req.cookies.key;
            const [rows] = await db.promise().query("SELECT data FROM dashboard_snapshots WHERE mem_id=? LIMIT 1", [mem_id]);
            const existing = rows.length ? safeParse(rows[0].data, {}) : {};

            const merge = (req.body.merge && typeof req.body.merge === "object") ? req.body.merge : null;
            if (merge) {
                const merged = { ...existing, ...merge };
                const dataJson = JSON.stringify(merged);
                const datetime = Math.floor(Date.now() / 1000);
                if (rows.length) await db.promise().query("UPDATE dashboard_snapshots SET data=?, datetime=? WHERE mem_id=?", [dataJson, datetime, mem_id]);
                else await db.promise().query("INSERT INTO dashboard_snapshots (mem_id, data, datetime) VALUES (?,?,?)", [mem_id, dataJson, datetime]);
            }
            // `prev` = baselines BEFORE this merge (what the pills compare against).
            return res.json({ success: true, prev: existing });
        } catch (err) { console.error("dashboard-snapshot:", err.message); return res.json({ success: false, message: "Server error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/dashboard" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "dashboard_snapshots" },
];
