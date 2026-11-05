/**
 * Small lookup lists many pages load (trainers, a member, my profile, courses,
 * batches).
 *
 * Mounted by ../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount } = ctx;

    router.post("/get-course-batch", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { course, bid } = req.body;

            if (!course && !bid) {
                return res.json({
                    success: false,
                    message: "Invalid data"
                });
            }

            /* Helper: Promise Query */
            const query = (sql, params) => {
                return new Promise((resolve, reject) => {
                    db.query(sql, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            };

            let batchname = "";
            let coursename = "";

            /* Get Batch */
            if (bid && bid.length >= 10) {

                const batchRows = await query(
                    "SELECT name FROM batches WHERE b_id = ? LIMIT 1",
                    [bid]
                );

                if (batchRows.length > 0) {
                    batchname = batchRows[0].name;
                }
            }

            /* Get Course */
            if (course && course.length >= 10) {

                const courseRows = await query(
                    "SELECT title FROM courses WHERE req_id = ? LIMIT 1",
                    [course]
                );

                if (courseRows.length > 0) {
                    coursename = courseRows[0].title;
                }
            }

            /* Send After Queries Finish */
            return res.json({
                success: true,
                course: coursename,
                batch: batchname
            });

        } catch (err) {

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    router.post("/get-trainers", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

        try {

            const { status, course } = req.body;

            // SQL with JOIN (Best way)
            // Parameterized to prevent SQL injection via `course` (audit SEC-02).
            let where = "";
            const params = [];
            if (course && course.length >= 10) {
                where = "mc.c_id = ? AND ";
                params.push(course);
            }
            // Without a course this is every trainer with each of their courses
            // (one row per trainer and course), loaded once by the admin
            // Assignments / Live Classes pages (src/utils/trainers.ts) — so the
            // cap is higher than for one course.
            let sql = `
                SELECT m.*, mc.c_id
                    FROM members m
                    INNER JOIN member_courses mc
                        ON mc.mem_id = m.mem_id
                    WHERE ${where} m.status = '2'
                    ORDER BY m.name, mc.c_id
                    LIMIT ${params.length ? 100 : 2000}
                `;
            db.query(sql, params, (err, rows) => {

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
                        message: "No Trainers"
                    });
                }
                const cleanRows = rows.map((u) => ({
                    mem_id: u.mem_id,
                    name: u.name,
                    email: u.email,
                    qualification: u.qualification,
                    course: u.c_id
                }));
                /* 8️⃣ Send Data */
                return res.json({
                    success: true,
                    data: cleanRows
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

    router.post("/get-member", async (req, res) => {
        try {

            /* Auth Check */
            if (!(await verifyAccount(req, res, "X,Y"))) return;

            const { mem_id } = req.body;

            /* Get Member + Courses */
            const [rows] = await db.promise().query(
                `
                SELECT 
                    m.*,
                    mc.c_id,
                    mc.b_id,
                    mc.expires
                FROM members m
                LEFT JOIN member_courses mc
                    ON mc.mem_id = m.mem_id
                WHERE m.mem_id = ?
                ORDER BY m.id DESC
                LIMIT 100
                `,
                [mem_id]
            );

            if (!rows.length) {
                return res.json({
                    success: false,
                    message: "No Members",
                });
            }

            const map = new Map();

            /* Loop Members */
            for (const u of rows) {

                if (!map.has(u.mem_id)) {

                    map.set(u.mem_id, {
                        name: u.name,
                        email: u.email,
                        number: u.number,
                        gender: u.gender,
                        qualification: u.qualification,
                        courses: [],
                    });
                }

                /* Get Course + Batch */
                if (u.c_id && u.b_id) {

                    const [courseRows] = await db.promise().query(
                        `
                        SELECT 
                            c.title AS course_name,
                            bt.name AS batch_name
                        FROM courses c
                        LEFT JOIN batches bt
                            ON bt.c_id = c.req_id AND bt.b_id = ? 
                        WHERE c.req_id = ?
                        LIMIT 1
                        `,
                        [u.b_id, u.c_id]
                    );

                    let course_name = "";
                    let batch_name = "";

                    if (courseRows.length) {
                        course_name = courseRows[0].course_name;
                        batch_name = courseRows[0].batch_name;
                    }

                    map.get(u.mem_id).courses.push({
                        c_id: u.c_id,
                        course_name,
                        b_id: u.b_id,
                        batch_name,
                        expires: u.expires,
                    });
                }
            }

            const cleanRows = Array.from(map.values());

            /* Send Response */
            return res.json({
                success: true,
                data: cleanRows,
            });

        } catch (err) {

            console.error("Get Member Error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });

    router.post("/get-myprofile", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

        try {

            // SQL with JOIN (Best way)
            let sql = `
                SELECT 
                *
                FROM members WHERE mem_id = ? 
                LIMIT 1
            `;
            db.query(sql, [ukey], async (err, rows) => {

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
                        message: "No Profile Info Found"
                    });
                }

                // the same enrolments as before (c_id, b_id), with the course and
                // batch names for the student's ID card
                const [loadcourses] = await db.promise().query(
                    `SELECT mc.c_id, mc.b_id, mc.status, c.title AS course_name, b.name AS batch_name
                     FROM member_courses mc
                     LEFT JOIN courses c ON c.req_id = mc.c_id
                     LEFT JOIN batches b ON b.b_id = mc.b_id AND COALESCE(mc.b_id, '') <> ''
                     WHERE mc.mem_id = ?
                     ORDER BY mc.id
                     LIMIT 10`,
                    [ukey]
                );

                const cleanRows = rows.map((u) => ({
                    name: u.name,
                    email: u.email,
                    number: u.number,
                    gender: u.gender,
                    city: u.city,
                    address: u.address,
                    qualification: u.qualification,
                }));

                /* 8️⃣ Send Data */
                return res.json({
                    success: true,
                    data: cleanRows,
                    courses: loadcourses
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

    router.post("/get-batches", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

        try {

            const { c_id, status } = req.body;

            // SQL with JOIN (Best way)
            let sql = `
                SELECT *
                FROM batches
                WHERE 1=1
            `;
            const params = [];

            if (status === "1") {
                sql += ` AND status = ?`;
                params.push("1");
            }

            if (c_id.length >= 10) {
                sql += ` AND c_id = ?`;
                params.push(c_id);
            }

            sql += ` LIMIT 100`;

            db.query(sql, params, (err, rows) => {

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
                        message: "No Batches"
                    });
                }

                return res.json({
                    success: true,
                    data: rows,
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

    router.post("/get-courses", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

        try {

            const {status} = req.body;
            // Courses marked "not enrollable" (Admin → Courses) are left out unless
            // the page asks for all of them (all: "1") — the certificate-request
            // pages, and pages that only show course names (batches, profile)
            const onlyEnrollable = String(req.body.all || "") !== "1"
                ? " AND COALESCE(enrollable, '1') <> '0'"
                : "";

            // SQL with JOIN (Best way)
            let sql = `
                SELECT *
                FROM courses WHERE 1=1${onlyEnrollable}
                LIMIT 100
            `;

            if (status == "1") {
                sql = `
                SELECT *
                FROM courses WHERE status='1'${onlyEnrollable}
                LIMIT 100
            `;
            }

            db.query(sql, [], (err, rows) => {

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
                        message: "No Courses"
                    });
                }

                return res.json({
                    success: true,
                    data: rows,
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

    router.post("/get-mem-courses", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

        try {

            // SQL with JOIN (Best way)
            let sql = `
                SELECT 
                *
                FROM member_courses WHERE mem_id=? AND status='1' 
                LIMIT 100
            `;
            db.query(sql, [ukey], (err, rows) => {

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
                        message: "No Member Courses"
                    });
                }

                return res.json({
                    success: true,
                    data: rows,
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
};
