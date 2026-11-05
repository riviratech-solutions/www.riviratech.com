/**
 * API routes for src/pages/panel/student/Dashboard.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, checkStatus, verifyAccount } = ctx;

    router.post("/my-stats", async (req, res) => {
        try {
            const {
                key: ukey
            } = req.cookies;

            if (!(await verifyAccount(req, res, "1"))) return;

            const ok = await checkStatus(req, "1");

            let b_id = ok.courses[0]?.b_id;
            let c_id = ok.courses[0]?.c_id;

            const datetime = Math.floor(Date.now() / 1000);

            // 📊 Get Stats
            const statsSql = `
            SELECT 
                (SELECT COUNT(*) 
                FROM assignments 
                WHERE course = ? AND batch = ? 
                AND status IN ('1','2')) AS "totalAssignments",

                (SELECT COUNT(*) 
                FROM assignments 
                WHERE course = ? AND batch = ? 
                AND status = '1') AS "activeAssignments",

                (SELECT COUNT(DISTINCT req_id) 
                FROM assignmentsubs 
                WHERE mem_id = ? 
                AND status IN ('1','2')) AS "appliedAssignments",

                (SELECT COUNT(*) 
                FROM liveclasses 
                WHERE c_id = ? AND b_id = ? 
                AND status = '1' 
                AND stimings >= extract(epoch from now())) AS "upcomingClasses"
            `;

            const [statsRows] = await db.promise().query(statsSql, [
                c_id,
                b_id,
                c_id,
                b_id,
                ukey,
                c_id,
                b_id,
            ]);

            const stats = statsRows[0] || {
                totalAssignments: 0,
                activeAssignments: 0,
                appliedAssignments: 0,
                upcomingClasses: 0,
            };

            // 1️⃣ Get Upcoming Live Class
            const upcomingSql = `
                SELECT *
                FROM liveclasses
                WHERE stimings >= ?
                    AND c_id = ? AND b_id = ?
                    AND status = '1'
                ORDER BY stimings ASC
                LIMIT 1
                `;

            let [classRows] = await db.promise().query(
                upcomingSql,
                [datetime, c_id, b_id]
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
                    AND c_id = ? AND b_id = ?
                    AND status = '1'
                    ORDER BY etimings DESC
                    LIMIT 1
                `;

                const [pastRows] = await db.promise().query(
                    pastSql,
                    [datetime, c_id, b_id]
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

    router.post("/load-month-classes", async (req, res) => {
        try {

            if (!(await verifyAccount(req, res, "1,2"))) return;

            const { month, cid } = req.body;
            let { bid } = req.body;
            const { key: ukey, id: role } = req.cookies;

            if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
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

            // 🔎 Which batch: a student sees only the batch they are enrolled in for
            // this course (whatever the page sends); a trainer their given batch,
            // or every class of theirs in the course when none is given.
            let batchSql = "lc.b_id = ?";
            let batchParams = [bid];
            if (role === "1") {
                const [enrolled] = await db.promise().query(
                    "SELECT b_id FROM member_courses WHERE mem_id = ? AND c_id = ? AND status = '1'",
                    [ukey, cid]
                );
                const mine = enrolled.map((r) => r.b_id).filter(Boolean);
                if (!mine.length) return res.json({ success: true, month, data: [] });
                if (!mine.includes(bid)) {
                    batchSql = `lc.b_id IN (${mine.map(() => "?").join(",")})`;
                    batchParams = mine;
                }
            } else if (!bid) {
                batchSql = "lc.trainer = ?";
                batchParams = [ukey];
            }

            let where = `
            WHERE lc.c_id = ?
                AND ${batchSql}
                AND lc.status IN ('0','1','2','3')
                AND lc.stimings BETWEEN ? AND ?
            `;

            const params = [
                cid,
                ...batchParams,
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
