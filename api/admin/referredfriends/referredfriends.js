/**
 * API routes for src/pages/panel/admin/Referredfriends.tsx.
 * /add-refer is the "Refer a friend" form in the panel menu
 * (components/AdminMenu.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails
const referralLink = require("../../shared/referral-link");

// Names in the referral mail are typed by students: HTML-escaped
const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const titleCase = (v) => String(v || "").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

module.exports = (router, ctx) => {
    const { db, md5, verifyAccount, addactivity } = ctx;

    router.post("/refers", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id, q, s, n } = req.body;

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
            let where = "WHERE (status='1' OR status='2' OR status='3')";
            let params = [];

            if (search) {
                where =
                    "WHERE msg ILIKE ? AND (status='1' OR status='2' OR status='3')";
                params.push(`%${search}%`);
            }

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            let stats = {
                pending: 0,
                enrolled: 0,
                total: 0
            };

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(cr.id) AS total, cr.status, COUNT(fm.id) AS mtotal
                FROM refers cr 
                LEFT JOIN members fm 
                    ON (fm.email = cr.email OR fm.number = cr.phone)
                ${where.replaceAll("msg", "cr.msg").replaceAll("status", "cr.status")}
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

                    if (row.status === "1") {
                        stats.pending = row.total;
                    }
                    stats.enrolled = row.mtotal;
                    stats.total += row.total;

                });

                const lastPage = stats.total === 0
                    ? 0
                    : Math.ceil(stats.total / limit);

                /* Fix Page Overflow */
                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSql = `
                    SELECT 
                        cr.*,
                        MAX(m.name) AS rname,
                        MAX(fm.name) AS frname,
                        MAX(fm.mem_id) AS frmem_id
                    FROM refers cr 
                    LEFT JOIN members m 
                         ON m.mem_id = cr.mem_id 
                    LEFT JOIN members fm 
                        ON (fm.email = cr.email OR fm.number = cr.phone)
                    ${where.replaceAll("msg", "cr.msg").replaceAll("status", "cr.status")}
                    GROUP BY cr.id
                    ORDER BY ${orderBy.replaceAll("id", "cr.id")}
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
                            stats,
                            page,
                            lastPage,
                            message: "No data found"
                        });

                    }

                    const cleanRows = rows.map((u) => ({
                        id: u.id,
                        mem_id: u.mem_id,
                        course_id: u.course_id,
                        name: u.name,
                        email: u.email,
                        phone: u.phone,
                        datetime: u.datetime,

                        // Status: 2 if frname exists, else 1
                        status: u.frname && u.frname.trim() !== "" ? "2" : "1",

                        rname: u.rname,
                        frname: u.frname,
                        frmem_id: u.frmem_id,
                    }));

                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: cleanRows,
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

    router.post("/delete-refer", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 0) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT id, status
                FROM refers
                WHERE id = ? AND (status = '1' OR status = '2' OR status = '3')
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

                const dbId = rows[0].id;
                const status = rows[0].status;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE refers
                    SET status = ?
                    WHERE id = ? AND (status = '1' OR status = '2' OR status = '3')
                    LIMIT 1
                `;

                db.query(updateSql, [status + "D", id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Refer details deleted";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "refers", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Refer details was successfully deleted"
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

    // POST /api/add-refer
    router.post("/add-refer", async (req, res) => {
        try {

            if (!(await verifyAccount(req, res, "1"))) return;

            const { key: userid } = req.cookies; // the signed-in student's mem_id
            const { course_id, name, email, phone, fullphone } = req.body;

            if (!course_id || typeof course_id !== "string" || course_id.length <= 2)
                return res.json({ success: false, message: "Please select a course" });

            // an active course; its name goes in the friend's mail
            const [[course]] = await db.promise().query(
                "SELECT title FROM courses WHERE req_id = ? AND status = '1' AND COALESCE(enrollable, '1') <> '0' LIMIT 1", [course_id]);
            if (!course)
                return res.json({ success: false, message: "Please select a course" });
            const courseName = String(course.title || "").trim();

            if (!name || name.trim().length <= 2)
                return res.json({ success: false, message: "Please enter full name" });

            // the country-code picker sends "+<code><digits>" as fullphone; that is
            // the number stored, so that is the one checked (7–15 digits)
            const full = typeof fullphone === "string" ? fullphone.trim() : "";
            const local = String(phone || "").replace(/\D/g, "");
            if (!local)
                return res.json({ success: false, message: "Please enter contact number" });
            const number = /^\+\d{7,15}$/.test(full) ? full : local;
            const digits = number.replace(/\D/g, "");
            if (local.length < 6 || local.length > 15 || digits.length < 7 || digits.length > 15)
                return res.json({ success: false, message: "Please enter valid contact number" });

            if (!email || email.length <= 7)
                return res.json({ success: false, message: "Please enter email" });

            if (!/^\S+@\S+\.\S+$/.test(email))
                return res.json({ success: false, message: "Please enter valid email" });

            /* ===========================
               3️⃣ Insert Data
            =========================== */
            const datetime = Math.floor(Date.now() / 1000);

            const req_id =
                "a" + md5(Math.random() + Date.now() + email + datetime);

            const insertSql = `
                INSERT INTO refers
                (mem_id, course_id, name, email, phone, datetime, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

            await db.promise().query(insertSql, [
                userid,
                course_id,
                name.trim(),
                email.toLowerCase(),
                number,
                datetime,
                "1"
            ]);

            /* ===========================
               4️⃣ Mail the friend
            =========================== */
            // The referral is saved either way; a failed mail is only logged.
            try {
                const [[referrer]] = await db.promise().query(
                    "SELECT name FROM members WHERE mem_id = ? LIMIT 1", [userid]);
                const friendName = titleCase(name) || "there";
                const referrerName = titleCase(referrer && referrer.name) || "A friend";

                const html = `
                    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">

                        <h2 style="color:#2c3e50;">
                        🎉 You’ve Been Referred to Rivira Tech
                        </h2>

                        <p>Hi ${esc(friendName)},</p>

                        <p>
                        Great news! 🎉 <b>${esc(referrerName)}</b> has referred you to
                        <b>Rivira Tech</b> to explore our
                        <b>${esc(courseName)}</b>.
                        </p>

                        <p>
                        Take this opportunity to learn Artificial Intelligence and Generative AI,
                        gain practical skills, and work toward exciting career opportunities
                        in the AI field.
                        </p>

                        <div style="
                        background:#f3f6fa;
                        padding:16px 20px;
                        margin:20px 0;
                        border-radius:8px;
                        border:1px dashed #3498db;
                        ">
                            <h3 style="margin:0 0 10px; color:#2c3e50;">Your Referral Details</h3>
                            <table cellpadding="4" style="border-collapse:collapse;">
                                <tr>
                                <td><b>Referred By</b></td>
                                <td>: ${esc(referrerName)}</td>
                                </tr>
                                <tr>
                                <td><b>Recommended Course</b></td>
                                <td>: ${esc(courseName)}</td>
                                </tr>
                            </table>
                        </div>

                        <p><b>Interested in starting your AI journey?</b></p>

                        <p>
                        Explore our program and learn more about the course and enrollment process:
                        </p>

                        <p style="margin:22px 0;">
                        <a href="https://www.riviratech.com/course-plan"
                           style="background-color:#ffffff; color:#2563eb; border:2px solid #2563eb; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; font-size:15px; margin:0 8px 8px 0;">
                            📘 Know More About the Course
                        </a>
                        <a href="https://www.riviratech.com/enroll"
                           style="background-color:#16a34a; color:#ffffff; border:2px solid #16a34a; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; font-size:15px; margin:0 8px 8px 0;">
                            🎓 Enroll Now
                        </a>
                        </p>

                        <p style="font-size:13px; color:#64748b;">
                        Course details: <a href="https://www.riviratech.com/course-plan" style="color:#2563eb;">https://www.riviratech.com/course-plan</a><br />
                        Enroll: <a href="https://www.riviratech.com/enroll" style="color:#2563eb;">https://www.riviratech.com/enroll</a>
                        </p>

                        <p>
                        We look forward to helping you take the next step in your AI learning journey!
                        </p>

                        <hr />

                        <p style="font-size:13px; color:#777;">
                        Best Regards,<br />
                        <b>Rivira Tech Team</b><br />
                        🌐 www.riviratech.com
                        </p>

                    </div>
                    `;
                const subject =
                    `You’ve Been Referred to Rivira Tech – ${courseName}`;

                const queued = await queueMail(email.trim().toLowerCase(), subject, html);
                if (!queued) console.error("add-refer: referral mail could not be queued");
            } catch (mailErr) {
                console.error("add-refer: referral mail failed:", mailErr.message);
            }

            return res.json({
                success: true,
                message: "Refer details was successfully submitted"
            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }
    });

    // POST /api/student/referral-code — the signed-in student's referral code for
    // their link (made the first time; shared/referral-link.js)
    router.post("/student/referral-code", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "1"))) return;
            const code = await referralLink.codeFor(db, req.cookies.key);
            if (!code) return res.json({ success: false, message: "Account not found" });
            return res.json({ success: true, code });
        } catch (err) {
            console.error("student/referral-code:", err.message);
            return res.json({ success: false, message: "Couldn't make your link, please try again" });
        }
    });

    // GET /api/public/referrer?r=<code> — who a referral link belongs to, so the
    // website's enroll form can fill "Refer By". Nothing for a wrong / old code.
    router.get("/public/referrer", async (req, res) => {
        try {
            res.setHeader("Cache-Control", "no-store");
            const ref = await referralLink.referrerOf(db, req.query.r);
            if (!ref) return res.json({ success: false });
            return res.json({ success: true, code: String(req.query.r).trim().toUpperCase(), name: titleCase(ref.name), email: String(ref.email || "").trim().toLowerCase() });
        } catch (err) {
            console.error("public/referrer:", err.message);
            return res.json({ success: false });
        }
    });

    // POST /api/student/my-referrals — the signed-in student's own referrals
    // (src/pages/panel/student/MyReferrals.tsx), each with how far the friend
    // got: enrolment request on the website, student account, courses / batches.
    // A friend is matched by email, or by phone: the same digits, or the same
    // last 10 digits (older rows hold "9876543210", newer "+919876543210").
    router.post("/student/my-referrals", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        try {
            const me = req.cookies.key;
            const q = async (sql, p = []) => (await db.promise().query(sql, p))[0];
            const digits = (v) => String(v || "").replace(/\D/g, "");
            const tail = (v) => { const d = digits(v); return d.length >= 7 ? d.slice(-10) : ""; };
            const mail = (v) => String(v || "").trim().toLowerCase();
            const sec = (v) => (/^\d{9,10}$/.test(String(v || "")) ? Number(v) : null);

            const refs = await q(
                `SELECT cr.id, cr.course_id, cr.name, cr.email, cr.phone, cr.datetime, c.title AS course_name
                 FROM refers cr
                 LEFT JOIN courses c ON c.req_id = cr.course_id
                 WHERE cr.mem_id = ? AND cr.status IN ('1','2','3')
                 ORDER BY cr.id DESC
                 LIMIT 500`,
                [me]
            );
            if (refs.length === 0)
                return res.json({ success: true, data: [], stats: { total: 0, joined: 0, applied: 0, waiting: 0 } });

            const emails = [...new Set(refs.map((r) => mail(r.email)).filter(Boolean))];
            const tails = [...new Set(refs.map((r) => tail(r.phone)).filter(Boolean))];
            const PHONE_TAIL = (col) => `RIGHT(regexp_replace(COALESCE(${col}, ''), '[^0-9]', '', 'g'), 10)`;

            // student accounts (not the referrer's own)
            const members = await q(
                `SELECT mem_id, name, email, number, datetime FROM members
                 WHERE status = '1' AND mem_id <> ?
                   AND (LOWER(TRIM(email)) = ANY(?) OR ${PHONE_TAIL("number")} = ANY(?))`,
                [me, emails, tails]
            );
            // enrolment requests from the website (1/2 in progress, 3 approved; 0 rejected is left out)
            const enrollees = await q(
                `SELECT e.email, e.number, e.course, e.datetime, e.status, c.title AS course_name
                 FROM enrollees e
                 LEFT JOIN courses c ON c.req_id = e.course
                 WHERE e.status IN ('1','2','3')
                   AND (LOWER(TRIM(e.email)) = ANY(?) OR ${PHONE_TAIL("e.number")} = ANY(?))
                 ORDER BY e.id DESC`,
                [emails, tails]
            );
            const courses = members.length
                ? await q(
                    `SELECT mc.mem_id, mc.c_id, mc.datetime, c.title AS course_name,
                            b.name AS batch_name, b.sdate AS batch_sdate, b.edate AS batch_edate
                     FROM member_courses mc
                     LEFT JOIN courses c ON c.req_id = mc.c_id
                     LEFT JOIN batches b ON b.b_id = mc.b_id AND COALESCE(b.status, '') NOT LIKE '%D'
                     WHERE mc.mem_id = ANY(?) AND mc.status = '1'
                     ORDER BY mc.id`,
                    [members.map((m) => m.mem_id)]
                )
                : [];

            const matches = (r, email, phone) =>
                (mail(email) && mail(email) === mail(r.email)) || (tail(phone) && tail(phone) === tail(r.phone));

            const stats = { total: refs.length, joined: 0, applied: 0, waiting: 0 };
            const data = refs.map((r) => {
                const referredAt = sec(r.datetime);
                // email match first, then phone
                const friend =
                    members.find((m) => mail(m.email) && mail(m.email) === mail(r.email)) ||
                    members.find((m) => matches(r, "", m.number)) ||
                    null;
                const request = enrollees.find((e) => matches(r, e.email, e.number)) || null;

                const enrolled = friend
                    ? courses.filter((c) => c.mem_id === friend.mem_id).map((c) => ({
                        course_name: c.course_name || "",
                        batch_name: c.batch_name || "",
                        batch_sdate: c.batch_sdate || "",
                        batch_edate: c.batch_edate || "",
                        enrolled_at: sec(c.datetime),
                        referred_course: c.c_id === r.course_id,
                    }))
                    : [];

                const joinedAt = friend ? sec(friend.datetime) : null;
                const status = friend ? "joined" : request ? "applied" : "waiting";
                stats[status]++;

                return {
                    id: r.id,
                    name: r.name,
                    email: r.email,
                    phone: r.phone,
                    course_name: r.course_name || "",
                    referred_at: referredAt,
                    status,
                    // already had an account when they were referred
                    already_member: !!(friend && joinedAt && referredAt && joinedAt < referredAt),
                    joined_at: joinedAt,
                    joined_course: enrolled.some((c) => c.referred_course),
                    courses: enrolled,
                    request: request && !friend
                        ? {
                            at: sec(request.datetime),
                            course_name: request.course_name || "",
                            approved: request.status === "3",
                        }
                        : null,
                };
            });

            return res.json({ success: true, data, stats });
        } catch (err) {
            console.error("student/my-referrals:", err.message);
            return res.json({ success: false, message: "Could not load your referrals" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/referredfriends" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "refers" },
];
