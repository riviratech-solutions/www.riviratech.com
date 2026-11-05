/**
 * API routes for src/pages/panel/admin/Trainers.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { hashPassword } = require("../../security/passwords");
const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails

module.exports = (router, ctx) => {
    const { db, md5, randomId, formatDate, verifyAccount, addactivity } = ctx;

    router.post("/trainers", async (req, res) => {

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
            /* Full-table stats for the cards above the table (whole table, not this page) */
            let stats = null;
            try {
                const [statsRows] = await db.promise().query(
                    `SELECT
                     COUNT(id) AS total,
                     COUNT(CASE WHEN status = '2' THEN 1 END) AS active,
                     COUNT(CASE WHEN status = '2S' THEN 1 END) AS disabled,
                     (SELECT COUNT(id) FROM courses WHERE status = '1') AS courses
                     FROM members
                     WHERE status IN ('2','2S','2D')`,
                    []
                );
                if (statsRows && statsRows[0]) {
                    const r = statsRows[0];
                    stats = { 
                total:    Number(r.total || 0),
                active:   Number(r.active || 0),
                disabled: Number(r.disabled || 0),
                courses:  Number(r.courses || 0),
             };
                }
            } catch (statErr) {
                console.error("trainers stats error:", statErr);
            }

            let where = "WHERE (status='2' OR status='2S' OR status='2D')";
            let params = [];

            if (search) {
                where =
                    "WHERE (name ILIKE ? OR email ILIKE ? OR number ILIKE ? OR address ILIKE ? OR qualification ILIKE ?) AND (status='2' OR status='2S' OR status='2D')";
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
            }

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(id) AS total
                FROM members
                ${where}
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
                // the page of trainers first, then their courses: joining before the
                // LIMIT counted one row per course, so fewer trainers fit on a page
                const dataSql = `
                        SELECT
                            m.*,
                            mc.c_id
                        FROM (
                            SELECT * FROM members
                            ${where}
                            ORDER BY ${orderBy}
                            LIMIT ? OFFSET ?
                        ) m
                        LEFT JOIN member_courses mc
                            ON mc.mem_id = m.mem_id
                        ORDER BY ${orderBy.replaceAll("id", "m.id")}
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
                            stats,
                            message: "No data found"
                        });

                    }

                    const map = new Map();

                    rows.forEach(u => {

                        if (!map.has(u.mem_id)) {

                            map.set(u.mem_id, {
                                id: u.id,
                                mem_id: u.mem_id,

                                name: u.name,
                                gender: u.gender,
                                email: u.email,
                                number: u.number,
                                qualification: u.qualification,

                                address: u.address,
                                city: u.city,
                                pincode: u.pincode,
                                state: u.state,

                                profile: u.profile,
                                datetime: u.datetime,
                                lastdatetime: u.lastdatetime,
                                status: u.status,

                                courses: [],
                            });
                        }

                        // Push course if exists
                        if (u.c_id) {
                            map.get(u.mem_id).courses.push({
                                c_id: u.c_id
                            });
                        }

                    });

                    const cleanRows = Array.from(map.values());

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

    router.post("/add-trainer", async (req, res) => {
        // Prefer the phoneinput.js full international number when the client sends it.
        if (req.body.fullphone && String(req.body.fullphone).trim()) req.body.number = String(req.body.fullphone).trim();
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* 2️⃣ Body */
            const {
                coursenames,
                name,
                number,
                email,
                gender,
                address,
                city,
                pincode,
                state,
                qualification,
                cid,
                course,
                password,
                rpassword,
            } = req.body;

            /* 3️⃣ Session Tokens */

            /* 5️⃣ Validations */

            if (!name || name.length <= 2) {
                return res.json({ success: false, message: "Please enter full name" });
            }

            // Accept international numbers from phoneinput.js: optional leading "+"
            // and 7–15 digits (E.164). Replaces the old 10-digit-national-only rule.
            {
                const numDigits = String(number || "").replace(/\D/g, "");
                if (!numDigits || numDigits.length < 7 || numDigits.length > 15) {
                    return res.json({ success: false, message: "Please enter a valid contact number" });
                }
            }

            if (!email || email.length <= 7) {
                return res.json({ success: false, message: "Please enter email" });
            }

            if (!/^\S+@\S+\.\S+$/.test(email)) {
                return res.json({ success: false, message: "Please enter valid email" });
            }

            if (!gender || isNaN(gender)) {
                return res.json({ success: false, message: "Please select gender" });
            }

            if (!qualification || qualification.length <= 1) {
                return res.json({
                    success: false,
                    message: "Please enter qualification details"
                });
            }

            if (!course || course.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please select preferred course"
                });
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

            /* Hash Password */
            const pwd3 = await hashPassword(password);

            const mem_id =
                "a" + md5(Math.random() + Date.now() + email + pwd3);
            // the token / aut sign-in secrets: random, not guessable
            const pwd1 = randomId();
            const pwd2 = randomId();

            const datetime = Math.floor(Date.now() / 1000);

            /* Insert Member */
            const insertSql = `
                    INSERT INTO members
                    (mem_id,name,email,number,gender,address,city,pincode,state,pwd1,pwd2,pwd3,
                    qualification,datetime,lastdatetime,status)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,2)
                `;
            db.query(
                insertSql,
                [mem_id,
                    name,
                    email,
                    number,
                    gender,
                    address,
                    city,
                    pincode,
                    state,
                    pwd1,
                    pwd2,
                    pwd3,
                    qualification,
                    datetime,
                    ""],
                async (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "New trainer added to '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, mem_id, "members", info, fromtxt, totxt);

                        const html = `
                                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width:600px; margin:auto;">

                                <h2 style="color:#2c7be5;">Welcome to Rivira Tech!</h2>

                                <p>Dear <b>${name}</b>,</p>

                                <p>
                                    We are pleased to inform you that you have been
                                    <b style="color:green;">successfully added as a Trainer</b>
                                    to our platform.
                                </p>

                                <hr>

                                <h3>👨‍🏫 Trainer Assignment Details</h3>

                                <table cellpadding="6" width="100%">
                                    <tr>
                                    <td width="35%"><b>Assigned Course(s)</b></td>
                                    <td>: ${coursenames}</td>
                                    </tr>

                                    <tr>
                                    <td><b>Joining Date</b></td>
                                    <td>: ${formatDate(Math.floor(Date.now() / 1000))}</td>
                                    </tr>
                                </table>

                                <hr>

                                <h3>🔐 Login Credentials</h3>

                                <p>Please use the following details to access your Trainer dashboard:</p>

                                <table cellpadding="6" width="100%">
                                    <tr>
                                    <td width="35%"><b>Login URL</b></td>
                                    <td>:
                                        <a href="https://www.riviratech.com/signin" target="_blank">
                                        https://www.riviratech.com/signin
                                        </a>
                                    </td>
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

                                <p style="color:red; margin-top:10px;">
                                    ⚠️ For security reasons, please change your password after your first login.
                                </p>

                                <hr>

                                <h3>📌 Trainer Responsibilities</h3>

                                <ul>
                                    <li>Conduct classes as per schedule</li>
                                    <li>Prepare training materials</li>
                                    <li>Evaluate student performance</li>
                                    <li>Submit regular reports</li>
                                    <li>Maintain professional conduct</li>
                                </ul>

                                <hr>

                                <h3>📞 Support & Assistance</h3>

                                <p>
                                    If you need any help, feel free to contact us:
                                    <br>
                                    📧 <a href="mailto:info@riviratech.com">
                                    info@riviratech.com
                                    </a>
                                </p>

                                <br>

                                <p>
                                    We look forward to your valuable contribution to our organization.
                                </p>

                                <br>

                                <p>
                                    Best Regards,<br>
                                    <b>Rivira Tech Team</b><br>
                                    🌐 <a href="https://www.riviratech.com">
                                    www.riviratech.com
                                    </a>
                                </p>

                                </div>
                                `;

                        const subject =
                            `Hi ${name}, Welcome to Rivira Tech – Trainer Details 🎉`;

                        // Send Mail
                        const sent = await queueMail(
                            email,
                            subject,
                            html
                        );
                        if (!sent) {

                        }

                        /* 🔁 Insert courses into member_courses */
                        const courseIds = course.split(",").map(c => c.trim());
                        let pending = courseIds.length;

                        courseIds.forEach(c_id => {

                            db.query(
                                `INSERT INTO member_courses
                                (mem_id, c_id, b_id, expires, datetime, status)
                                VALUES (?, ?, ?, ?, ?, ?)`,
                                [mem_id, c_id, "", "", datetime, "1"],
                                (err3) => {

                                    if (err3) {
                                        console.error("Course insert error:", err3);
                                    }

                                    pending--;

                                    // When all inserts done → fetch user
                                    if (pending === 0) {
                                        fetchTrainer(res, mem_id, "added");
                                    }
                                }
                            );

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

    router.post("/update-trainer", async (req, res) => {
        // Prefer the phoneinput.js full international number when the client sends it.
        if (req.body.fullphone && String(req.body.fullphone).trim()) req.body.number = String(req.body.fullphone).trim();
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* 2️⃣ Body */
            const {
                mem_id,
                name,
                number,
                email,
                gender,
                address,
                city,
                pincode,
                state,
                qualification,
                cid,
                course
            } = req.body;

            /* 3️⃣ Session Tokens */

            if (!mem_id || mem_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            if (!name || name.length <= 2) {
                return res.json({ success: false, message: "Please enter full name" });
            }

            // Accept international numbers from phoneinput.js: optional leading "+"
            // and 7–15 digits (E.164). Replaces the old 10-digit-national-only rule.
            {
                const numDigits = String(number || "").replace(/\D/g, "");
                if (!numDigits || numDigits.length < 7 || numDigits.length > 15) {
                    return res.json({ success: false, message: "Please enter a valid contact number" });
                }
            }

            if (!email || email.length <= 7) {
                return res.json({ success: false, message: "Please enter email" });
            }

            if (!/^\S+@\S+\.\S+$/.test(email)) {
                return res.json({ success: false, message: "Please enter valid email" });
            }

            if (!gender || isNaN(gender)) {
                return res.json({ success: false, message: "Please select gender" });
            }

            if (!qualification || qualification.length <= 1) {
                return res.json({
                    success: false,
                    message: "Please enter qualification details"
                });
            }

            if (!course || course.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please select preferred course"
                });
            }

            /* 6️⃣ Duplicate Check */

            const checkSql = `
                SELECT email, number
                FROM members
                WHERE (email = ? OR number = ?)
                AND mem_id != ?
                LIMIT 1
                `;

            db.query(
                checkSql,
                [email.toLowerCase(), number, mem_id],
                (err, rows) => {

                    if (err) {
                        console.error(err);
                        return res.json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (rows.length > 0) {

                        if (rows[0].number === number) {
                            return res.json({
                                success: false,
                                message: "Your phone number already registered..try with another.."
                            });
                        }

                        if (rows[0].email === email) {
                            return res.json({
                                success: false,
                                message: "Your email already registered..try with another.."
                            });
                        }
                    }

                    /* 8️⃣ Update Member */

                    const updateSql = `
                        UPDATE members
                        SET
                            name = ?,
                            email = ?,
                            number = ?,
                            gender = ?,
                            address = ?,
                            city = ?,
                            pincode = ?,
                            state = ?,
                            qualification = ?
                        WHERE mem_id = ?
                        LIMIT 1
                        `;

                    db.query(
                        updateSql,
                        [
                            name.trim(),
                            email.toLowerCase(),
                            number,
                            gender,
                            address,
                            city,
                            pincode,
                            state,
                            qualification.trim(),
                            mem_id
                        ],
                        (err2, result) => {

                            if (err2) {
                                console.error(err2);
                                return res.json({
                                    success: false,
                                    message: "Database error"
                                });
                            }

                            if (result.affectedRows === 1) {

                                let info = "Trainer info updated '" + email.trim() + "'";
                                let fromtxt = "";
                                let totxt = "";
                                addactivity(ukey, mem_id, "members", info, fromtxt, totxt);

                                const courseIds = course.split(",").map(c => c.trim()); // new courses

                                db.query(
                                    `SELECT c_id FROM member_courses WHERE mem_id=?`,
                                    [mem_id],
                                    (err3, rows3) => {

                                        if (err3) {
                                            console.error(err3);
                                            return res.json({
                                                success: false,
                                                message: "Database error (course fetch)",
                                            });
                                        }

                                        const dbCourses = rows3.map(r => r.c_id); // existing

                                        /* 2️⃣ Find deleted courses */
                                        const toDelete = dbCourses.filter(
                                            c => !courseIds.includes(c)
                                        );

                                        /* 3️⃣ Find new courses */
                                        const toInsert = courseIds.filter(
                                            c => !dbCourses.includes(c)
                                        );

                                        const datetime = Math.floor(Date.now() / 1000);

                                        let pending =
                                            toDelete.length + toInsert.length;

                                        // If nothing to sync
                                        if (pending === 0) {
                                            return fetchTrainer(res, mem_id, "updated"); // continue
                                        }

                                        /* 4️⃣ DELETE removed courses */
                                        toDelete.forEach(c_id => {

                                            db.query(
                                                `DELETE FROM member_courses
                                                     WHERE mem_id=? AND c_id=?`,
                                                [mem_id, c_id],
                                                (err4) => {

                                                    if (err4) console.error(err4);

                                                    pending--;

                                                    if (pending === 0) {
                                                        fetchTrainer(res, mem_id, "updated");
                                                    }
                                                }
                                            );
                                        });

                                        /* 5️⃣ INSERT new courses */
                                        toInsert.forEach(c_id => {

                                            db.query(
                                                `INSERT INTO member_courses
                                                    (mem_id, c_id, b_id, expires, datetime, status)
                                                    VALUES (?, ?, ?, ?, ?, ?)`,
                                                [mem_id, c_id, "", "", datetime, "1"],
                                                (err5) => {

                                                    if (err5) console.error(err5);

                                                    pending--;

                                                    if (pending === 0) {
                                                        fetchTrainer(res, mem_id, "updated");
                                                    }
                                                }
                                            );
                                        });

                                    });

                            } else {

                                return res.json({
                                    success: false,
                                    message: "No changes made"
                                });

                            }

                        }
                    );

                });

        } catch (err) {

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }
    });

    function fetchTrainer(res, mem_id, msg) {

        /* 6️⃣ Fetch Data */
        const dataSql = `
                SELECT 
                    m.*,
                    mc.c_id 
                FROM members m
                LEFT JOIN member_courses mc
                    ON mc.mem_id = m.mem_id
                 WHERE m.mem_id=?
                ORDER BY m.id DESC
                `;

        db.query(dataSql, [mem_id], (err2, rows) => {

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
                    message: "No data found"
                });

            }

            const map = new Map();

            rows.forEach(u => {

                if (!map.has(u.mem_id)) {

                    map.set(u.mem_id, {
                        id: u.id,
                        mem_id: u.mem_id,

                        name: u.name,
                        gender: u.gender,
                        email: u.email,
                        number: u.number,
                        qualification: u.qualification,

                        address: u.address,
                        city: u.city,
                        pincode: u.pincode,
                        state: u.state,

                        profile: u.profile,
                        datetime: u.datetime,
                        lastdatetime: u.lastdatetime,
                        status: u.status,

                        courses: [],
                    });
                }

                // Push course if exists
                if (u.c_id) {
                    map.get(u.mem_id).courses.push({
                        c_id: u.c_id
                    });
                }

            });

            const cleanRows = Array.from(map.values());

            return res.json({
                success: true,
                data: cleanRows,
                message: `${cleanRows[0].name} details was successfully ${msg}`,
            });
        });
    }

    router.post("/disable-trainer", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Active */
            const sql = `
            SELECT * 
            FROM members 
            WHERE mem_id = ? AND status = '2'
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

                const dbId = rows[0].mem_id;
                const name = rows[0].name;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Disable Batch */
                const updateSql = `
                    UPDATE members 
                    SET status = '2S' 
                    WHERE mem_id = ? AND status = '2'
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

                        let info = "Trainer info disabled to '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "members", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Trainer details was successfully disabled"
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

    router.post("/enable-trainer", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT *
                FROM members
                WHERE mem_id = ? AND status = '2S'
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

                const dbId = rows[0].mem_id;
                const name = rows[0].name;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE members
                    SET status = '2'
                    WHERE mem_id = ? AND status = '2S'
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

                        let info = "Trainer info enabled to '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "members", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Trainer details was successfully enabled"
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

    router.post("/delete-trainer", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT *
                FROM members
                WHERE mem_id = ? AND (status = '2' OR status = '2S')
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

                const dbId = rows[0].mem_id;
                const name = rows[0].name;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE members
                    SET status = '1D'
                    WHERE mem_id = ? AND (status = '2' OR status = '2S')
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

                        let info = "Trainer info deleted to '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "members", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Trainer details was successfully deleted"
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
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/trainers" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "members", when: "left(OLD.status, 1) = '2'" },
];
