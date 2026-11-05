/**
 * API routes for src/pages/panel/admin/Enrollees.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { hashPassword } = require("../../security/passwords");
const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails

module.exports = (router, ctx) => {
    const { db, md5, randomId, dateRangeFilter, verifyAccount, addactivity } = ctx;

    router.post("/enrollees", async (req, res) => {

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

            /* 2️⃣.5 Full-table stats — runs once, ignores search/sort/date filter */
            let stats = null;
            try {
                const s7 = String(Math.floor(Date.now() / 1000) - 7 * 86400);
                const [statsRows] = await db.promise().query(
                    `SELECT
                        COUNT(id)                                        AS total,
                        COUNT(CASE WHEN status = '3' THEN 1 END)        AS approved,
                        COUNT(CASE WHEN status = '0' THEN 1 END)        AS rejected,
                        COUNT(CASE WHEN datetime >= ?  THEN 1 END)      AS recent
                     FROM enrollees
                     WHERE status = '2' OR status = '3' OR status = '0'`,
                    [s7]
                );
                if (statsRows && statsRows[0]) {
                    stats = {
                        total:    Number(statsRows[0].total    || 0),
                        approved: Number(statsRows[0].approved || 0),
                        rejected: Number(statsRows[0].rejected || 0),
                        recent:   Number(statsRows[0].recent   || 0),
                    };
                }
            } catch (statErr) {
                console.error("enrollees stats error:", statErr);
            }

            /* 3️⃣ Search Filter */
            let where = "WHERE (status='2' OR status='3')";
            let params = [];

            if (search) {
                where =
                    "WHERE (name ILIKE ? OR email ILIKE ? OR number ILIKE ? OR qualification ILIKE ?) AND (status='2' OR status='3')";
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
            }

            /* 3️⃣.5 Date Filter */
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(id) AS total
                FROM enrollees
                ${where} ${dr.clause()}
                `;

            db.query(countSql, params, (err, countRows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                const total = countRows[0]?.total || 0;

                const lastPage = total === 0
                    ? 0
                    : Math.ceil(total / limit);

                /* Fix Page Overflow */
                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSql = `
                            SELECT *
                            FROM enrollees
                            ${where} ${dr.clause()}
                            ORDER BY ${orderBy}
                            LIMIT ? OFFSET ?
                            `;

                const dataParams = [...params, limit, offset];

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
                            total,
                            page,
                            lastPage,
                            message: "No data found"
                        });

                    }

                    const cleanRows = rows.map((u) => ({
                        id: u.id,
                        req_id: u.req_id,
                        name: u.name,
                        gender: u.gender,
                        email: u.email,
                        number: u.number,
                        qualification: u.qualification,
                        cid: u.course,
                        bid: u.bid,
                        course: u.course,
                        addon: u.addon,
                        plan: u.plan,
                        currency: u.currency,
                        fees: u.fees,
                        referby: u.referby,
                        datetime: u.datetime,
                        status: u.status,
                    }));

                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: cleanRows,
                        total,
                        page,
                        lastPage,
                        stats,
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

    router.post("/reject-enroll", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id, name, email, reason} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT req_id
                FROM enrollees
                WHERE req_id = ? AND (status = '0' OR status = '1' OR status = '2')
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

                const dbId = rows[0].req_id;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE enrollees
                    SET status = '0', reason = ?
                    WHERE req_id = ? AND (status = '0' OR status = '1' OR status = '2')
                    LIMIT 1
                `;

                db.query(updateSql, [reason, id], async (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Student enroll rejected of '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "enrollees", info, fromtxt, totxt);

                        const html = `
                                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                                <h2 style="color:#dc3545;">Enrollment Update</h2>

                                <p>Dear <b>${name}</b>,</p>

                                <p>
                                    Thank you for your interest in Rivira Tech.
                                </p>

                                <p>
                                    After careful review, we regret to inform you that your enrollment
                                    request has <b style="color:red;">not been approved</b> at this time.
                                </p>

                                <hr>

                                <h3>📌 Reason (If Applicable)</h3>

                                <p style="color:#555;">
                                    ${reason}
                                </p>

                                <p>
                                    (If no reason is mentioned, you may contact us for further details.)
                                </p>

                                <hr>

                                <h3>🔁 Apply Again</h3>

                                <p>
                                    You are welcome to apply again in the future once the requirements
                                    are fulfilled.
                                </p>

                                <p>
                                    We appreciate your interest and encourage you to continue learning
                                    and growing with us.
                                </p>

                                <hr>

                                <p>
                                    For any questions, please contact:
                                    <br>
                                    📧 info@riviratech.com
                                </p>

                                <br>

                                <p>
                                    Best Regards,<br>
                                    <b>Rivira Tech Team</b><br>
                                    🌐 www.riviratech.com
                                </p>

                                </div>

                        `;
                        const subject =
                            `Hi ${name}, Update on Your Enrollment Request – Rivira Tech`;

                        // Send Mail
                        const sent = await queueMail(
                            email,
                            subject,
                            html
                        );
                        if (!sent) {

                        }

                        return res.json({
                            success: true,
                            message: "Enrollee details was successfully rejected"
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

    router.post("/accept-enroll", async (req, res) => {
        // Prefer the phoneinput.js full international number when the client sends it.
        if (req.body.fullphone && String(req.body.fullphone).trim()) req.body.number = String(req.body.fullphone).trim();

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const {
                req_id,
                bid,
                name,
                number,
                email,
                gender,
                qualification,
                cid,
                course,
                expires,
                password,
                rpassword
            } = req.body;

            /* 2️⃣ check ID */
            if (!req_id || req_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }
            /* Validation */
            if (!bid || bid.length < 10)
                return res.json({ success: false, message: "Select batch" });

            if (!name || name.length < 3)
                return res.json({ success: false, message: "Enter full name" });

            const numDigits = String(number || "").replace(/\D/g, "");
            if (!numDigits || numDigits.length < 7 || numDigits.length > 15) {
                return res.json({ success: false, message: "Please enter a valid contact number" });
            }

            if (!password || password.length < 8)
                return res.json({ success: false, message: "Min 8 char password" });

            if (password !== rpassword)
                return res.json({ success: false, message: "Password mismatch" });

            /* Check Existing User */
            const [memberRows] = await db.promise().query(
                "SELECT id FROM members WHERE email=? OR number=?",
                [email, number]
            );

            if (memberRows.length)
                return res.json({
                    success: false,
                    message: "Email / Phone already exists"
                });

            /* Verify Enrollee */
            const [enrollee] = await db.promise().query(
                "SELECT req_id FROM enrollees WHERE req_id=?",
                [req_id]
            );

            if (!enrollee.length)
                return res.json({ success: false, message: "Invalid request" });

            /* Verify Batch */
            const [batchcheck] = await db.promise().query(
                "SELECT * FROM batches WHERE b_id=?",
                [bid]
            );

            if (!batchcheck.length)
                return res.json({ success: false, message: "Invalid batch" });

            const batchName = batchcheck[0].name;

            /* Verify Course */
            const [coursecheck] = await db.promise().query(
                "SELECT * FROM courses WHERE req_id=?",
                [cid]
            );

            if (!coursecheck.length)
                return res.json({ success: false, message: "Invalid course" });

            const CourseName = coursecheck[0].title;

            /* Hash Password */
            const pwd3 = await hashPassword(password);

            /* Convert Expiry */
            const expiresTs = Math.floor(
                new Date(expires).getTime() / 1000
            );
            // the token / aut sign-in secrets: random, not guessable
            const pwd1 = randomId();
            const pwd2 = randomId();

            /* Insert Member */
            const insertSql = `
                    INSERT INTO members
                        (mem_id,name,email,number,gender,pwd1,pwd2,pwd3,
                        qualification,datetime,lastdatetime,status)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
                `;

            let mem_id = enrollee[0].req_id;

            let datetime = Math.floor(Date.now() / 1000);
            db.query(
                insertSql,
                [mem_id,
                    name,
                    email,
                    number,
                    gender,
                    pwd1,
                    pwd2,
                    pwd3,
                    qualification,
                    datetime,
                    ""],
                (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        /* Update Enrollee */
                        const updateSql = `
                            UPDATE enrollees
                            SET course=?, bid=?, status=3 WHERE req_id=? 
                            LIMIT 1
                        `;

                        db.query(updateSql, [cid, bid, req_id], async (err2, result) => {

                            if (err2) {
                                console.error(err2);

                                await db.promise().query(
                                    "DELETE FROM members WHERE mem_id = ? LIMIT 1",
                                    [req_id]
                                );

                                return res.json({
                                    success: false,
                                    message: "There was something wrong, Please try again"
                                });
                            }

                            if (result.affectedRows === 1) {

                                await db.promise().query(
                                    "DELETE FROM member_courses WHERE mem_id = ? AND c_id = ? AND b_id = ? LIMIT 1",
                                    [mem_id, cid, bid]
                                );

                                db.query(
                                    `INSERT INTO member_courses
                                        (mem_id, c_id, b_id, expires, datetime, status)
                                        VALUES (?, ?, ?, ?, ?, ?)`,
                                    [mem_id, cid, bid, expiresTs, datetime, "1"],
                                    async (err3, result) => {

                                        if (err3) {

                                            await db.promise().query(
                                                "DELETE FROM members WHERE mem_id = ? LIMIT 1",
                                                [req_id]
                                            );
                                            console.error(err3);
                                            return res.json({
                                                success: false,
                                                message: "Insert failed",
                                            });
                                        }

                                        if (result.affectedRows === 1) {

                                            let info = "Student enroll approved to '" + email.trim() + "'";
                                            let fromtxt = "";
                                            let totxt = "";
                                            addactivity(ukey, mem_id, "enrollees", info, fromtxt, totxt);

                                            const html = `
                                                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                                                    <h2 style="color:#2c7be5;">Welcome to Rivira Tech!</h2>

                                                    <p>Dear <b>${name}</b>,</p>

                                                    <p>
                                                        We are happy to inform you that your enrollment has been
                                                        <b style="color:green;">successfully approved</b>.
                                                    </p>

                                                    <hr>

                                                    <h3>📘 Course & Batch Details</h3>

                                                    <table cellpadding="6">
                                                        <tr>
                                                        <td><b>Course</b></td>
                                                        <td>: ${CourseName}</td>
                                                        </tr>
                                                        <tr>
                                                        <td><b>Batch</b></td>
                                                        <td>: ${batchName}</td>
                                                        </tr>
                                                        <tr>
                                                        <td><b>End Date</b></td>
                                                        <td>: ${expires}</td>
                                                        </tr>
                                                    </table>

                                                    <hr>

                                                    <h3>🔐 Login Details</h3>

                                                    <p>Please use the following credentials to access your account:</p>

                                                    <table cellpadding="6">
                                                        <tr>
                                                        <td><b>Login URL</b></td>
                                                        <td>: <a href="https://www.riviratech.com/signin">
                                                            https://www.riviratech.com/signin</a></td>
                                                        </tr>
                                                        <tr>
                                                        <td><b>Email / Mobile</b></td>
                                                        <td>: ${email}</td>
                                                        </tr>
                                                        <tr>
                                                        <td><b>Password</b></td>
                                                        <td>: ${password}</td>
                                                        </tr>
                                                    </table>

                                                    <p style="color:red;">
                                                        ⚠️ For security reasons, please change your password after first login.
                                                    </p>

                                                    <hr>

                                                    <h3>📌 Important Instructions</h3>

                                                    <ul>
                                                        <li>Attend classes regularly</li>
                                                        <li>Complete assignments on time</li>
                                                        <li>Contact support for any issues</li>
                                                    </ul>

                                                    <p>
                                                        If you have any questions, feel free to contact us at:
                                                        <br>
                                                        📧 info@riviratech.com
                                                    </p>

                                                    <br>

                                                    <p>
                                                        Best Regards,<br>
                                                        <b>Rivira Tech Team</b><br>
                                                        🌐 www.riviratech.com
                                                    </p>

                                                    </div>
                                                `;
                                            const subject =
                                                `Hi ${name}, Welcome to Rivira Tech – Enrollment Confirmed 🎉`;

                                            // Send Mail
                                            const sent = await queueMail(
                                                email,
                                                subject,
                                                html
                                            );
                                            if (!sent) {

                                            }

                                            return res.json({
                                                success: true,
                                                message: "Enroll details was successfully approved"
                                            });

                                        } else {

                                            await db.promise().query(
                                                "DELETE FROM members WHERE mem_id = ? LIMIT 1",
                                                [req_id]
                                            );
                                            return res.json({
                                                success: false,
                                                message: "There was something wrong, Please try again"
                                            });

                                        }

                                    });

                            } else {

                                await db.promise().query(
                                    "DELETE FROM members WHERE mem_id = ? LIMIT 1",
                                    [req_id]
                                );

                                return res.json({
                                    success: false,
                                    message: "There was something wrong, Please try again"
                                });

                            }

                        });

                    } else {
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

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

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/enrollees" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "enrollees" },
];
