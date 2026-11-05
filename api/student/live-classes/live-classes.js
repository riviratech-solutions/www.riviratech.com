/**
 * API routes for src/pages/panel/student/LiveClasses.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount } = ctx;

    router.post("/live-class-join", async (req, res) => {
        try {
            const {
                key: ukey
            } = req.cookies;

            if (!(await verifyAccount(req, res, "1"))) return;

            const { req_id } = req.body;

            if (!req_id || typeof req_id !== "string") {
                return res.json({
                    success: false,
                    message: "Please select class",
                });
            }

            // Attendance only for a class of a course / batch this student is in.
            const [cls] = await db.promise().query(
                `SELECT 1 FROM liveclasses lc
                 JOIN member_courses mc
                   ON mc.c_id = lc.c_id AND COALESCE(mc.b_id, '') = COALESCE(lc.b_id, '')
                 WHERE lc.req_id = ? AND mc.mem_id = ? AND mc.status = '1'
                 LIMIT 1`,
                [req_id, ukey]
            );
            if (!cls.length) {
                return res.json({
                    success: false,
                    message: "This class is not part of your course",
                });
            }

            // ✅ Check Attendance
            const sql = `
                SELECT id 
                FROM attendance
                WHERE req_id = ? AND mem_id = ?
                LIMIT 1
                `;

            db.query(sql, [req_id, ukey], async (err, rows) => {
                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error",
                    });
                }

                // Already exists
                if (rows.length > 0) {
                    return res.json({
                        success: true,
                        message: "Already joined",
                    });
                }

                // Insert new
                const insertSql = `
                    INSERT INTO attendance
                    (req_id, mem_id, datetime)
                    VALUES (?, ?, ?)
                `;

                const datetime = Math.floor(Date.now() / 1000);

                await db.promise().query(insertSql, [
                    req_id,
                    ukey,
                    datetime,
                ]);

                return res.json({
                    success: true,
                    message: "Attendance submitted successfully",
                });
            });

        } catch (err) {
            console.error("Live class join error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });
};
