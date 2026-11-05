/**
 * API routes for src/pages/panel/trainer/Dashboard.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, checkStatus, verifyAccount } = ctx;

    router.post("/trainer-stats", async (req, res) => {
        try {
            const {
                key: ukey
            } = req.cookies;

            if (!(await verifyAccount(req, res, "2"))) return;

            const ok = await checkStatus(req, "2");

            const { tc_id } = req.body;

            /* The client sends the course it last had selected, cached in
               localStorage. On a fresh session (or incognito) that cache is
               empty, so fall back to the trainer's first enrolled course.

               This used to assign straight to `tc_id`, which is destructured
               above with `const` — so the fallback threw "Assignment to constant
               variable", the catch turned it into a 500, and the whole trainer
               dashboard rendered zeros for anyone without that cache. */
            const firstCourse = ok.courses?.[0]?.c_id || "";
            const courseId = tc_id && tc_id.length > 10 ? tc_id : firstCourse;

            const datetime = Math.floor(Date.now() / 1000);

            // 📊 Get Stats
            const statsSql = `
            SELECT 
                (SELECT COUNT(*) 
                FROM assignments 
                WHERE mem_id = ? AND course = ? 
                AND status IN ('1','2')) AS "totalAssignments",

                (SELECT COUNT(*) 
                FROM assignments 
                WHERE mem_id = ? AND course = ? 
                AND status = '1') AS "activeAssignments",

                (SELECT COUNT(*) 
                FROM liveclasses 
                WHERE trainer = ? AND c_id = ?) AS "totalClasses",

                (SELECT COUNT(*) 
                FROM liveclasses 
                WHERE trainer = ? AND c_id = ? 
                AND status = '1' 
                AND stimings >= extract(epoch from now())) AS "upcomingClasses"
            `;

            const [statsRows] = await db.promise().query(statsSql, [
                ukey,
                courseId,
                ukey,
                courseId,
                ukey,
                courseId,
                ukey,
                courseId,
            ]);

            const stats = statsRows[0] || {
                totalAssignments: 0,
                activeAssignments: 0,
                totalClasses: 0,
                upcomingClasses: 0,
            };

            // 1️⃣ Get Upcoming Live Class
            const upcomingSql = `
                SELECT *
                FROM liveclasses
                WHERE stimings >= ?
                    AND trainer = ? AND c_id = ?
                    AND status = '1'
                ORDER BY stimings ASC
                LIMIT 1
                `;

            let [classRows] = await db.promise().query(
                upcomingSql,
                [datetime, ukey, courseId]
            );

            let classtype = "";

            if (classRows.length > 0) {
                classtype = "upcoming";
            } else {
                // 2️⃣ Get Previous Class
                const pastSql = `
                    SELECT *
                    FROM liveclasses
                    WHERE etimings <= ?
                    AND trainer = ? AND c_id = ?
                    AND status = '1'
                    ORDER BY etimings DESC
                    LIMIT 1
                `;

                const [pastRows] = await db.promise().query(
                    pastSql,
                    [datetime, ukey, courseId]
                );

                if (pastRows.length > 0) {
                    classRows = pastRows;
                    classtype = "previous";
                }
            }

            const userrow = ok.user.map((u) => ({
                id: u.id,
                mem_id: u.mem_id,
                name: u.name,
                email: u.email,
                number: u.number
            }));

            return res.json({
                success: true,
                stats,
                user: userrow,
                classrows: classRows,
                classtype: classtype,
                courses: ok.courses,
            });

        } catch (err) {

            console.error("My Stats Error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });

    router.post("/load-month-trainer-classes", async (req, res) => {
        try {
            const { key: ukey } = req.cookies;

            if (!(await verifyAccount(req, res, "1,2"))) return;

            const { month, cid, bid } = req.body;

            if (!month) {
                return res.json({
                    success: false,
                    message: "Please select month",
                });
            }

            // 📅 Calculate month range
            const [year, mon] = month.split("-");

            const startDate = new Date(year, mon - 1, 1, 0, 0, 0);
            const endDate = new Date(year, mon, 0, 23, 59, 59);

            const startMonth = Math.floor(startDate.getTime() / 1000);
            const endMonth = Math.floor(endDate.getTime() / 1000);

            // 🔎 Build query
            let where = `
            WHERE lc.c_id = ? AND lc.trainer = ?
                AND lc.status IN ('0','1','2','3')
                AND lc.stimings BETWEEN ? AND ?
            `;

            const params = [
                cid,
                ukey,
                startMonth,
                endMonth,
            ];

            const dataSql = `
                SELECT 
                    lc.*, 
                    s.name AS tname, 
                    s.email AS temail, 
                    s.number AS tphone
                FROM liveclasses lc
                LEFT JOIN members s
                    ON s.mem_id = lc.trainer
                ${where}
                ORDER BY lc.stimings ASC
                `;

            const [rows] = await db.promise().query(dataSql, params);

            return res.json({
                success: true,
                month,
                data: rows, // always return array
            });

        } catch (err) {
            console.error("Load month classes error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });
};
