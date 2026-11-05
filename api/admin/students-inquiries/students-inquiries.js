/**
 * API routes for src/pages/panel/admin/StudentsInquiries.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails

module.exports = (router, ctx) => {
    const { db, escapeHtml, dateRangeFilter, verifyAccount, addactivity } = ctx;

    // Email text: values from the public enroll form are escaped, and the
    // subject stays one line. Course titles are saved HTML-escaped (&amp;),
    // so text is decoded first, then escaped once.
    const decodeEntities = (v) => String(v == null ? "" : v).replace(/&(amp|lt|gt|quot|#39);/g,
        (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[m]);
    const mailText = (v) => escapeHtml(decodeEntities(v));
    const oneLine = (v) => decodeEntities(v).replace(/[\r\n]+/g, " ").trim();

    // A fee a payment link can ask for: more than 0, up to MAX_FEE, 2 decimals.
    // null when none was given, NaN when it isn't a valid amount.
    const MAX_FEE = 100000;
    const cleanFee = (v) => {
        if (v == null || String(v).trim() === "") return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0 || n > MAX_FEE) return NaN;
        return Math.round(n * 100) / 100;
    };

    router.post("/inquiries-received", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { q, s, n } = req.body;

            /* 1️⃣ Get Query Params */
            const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
            const sortby = typeof s === "string" ? s.trim() : "";
            let page = Math.max(1, parseInt(n, 10) || 1);

            /* 2️⃣ Sort */
            let orderBy = "id DESC";

            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Status & Search Filter */
            let statusCondition = "(status='0' OR status='1')";
            if (sortby === "Approved") {
                statusCondition = "status='2'";
            } else if (sortby === "Rejected") {
                statusCondition = "status='0'";
            }

            let where = `WHERE ${statusCondition}`;
            let params = [];

            if (search) {
                where =
                    `WHERE (name ILIKE ? OR email ILIKE ? OR number ILIKE ? OR qualification ILIKE ?) AND ${statusCondition}`;
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

            /* 4️⃣.5 Full Table Stats */
            let stats = null;
            try {
                const s7 = String(Math.floor(Date.now() / 1000) - 7 * 86400);
                const statsSql = `SELECT 
                    COUNT(id) AS total, 
                    COUNT(CASE WHEN status = '2' THEN 1 END) AS approved, 
                    COUNT(CASE WHEN status = '0' THEN 1 END) AS rejected, 
                    COUNT(CASE WHEN datetime >= ? THEN 1 END) AS recent 
                    FROM enrollees 
                    WHERE (status='0' OR status='1' OR status='2')`;
                const [statsRows] = await db.promise().query(statsSql, [s7]);
                if (statsRows && statsRows[0]) {
                    stats = {
                        total: Number(statsRows[0].total || 0),
                        approved: Number(statsRows[0].approved || 0),
                        rejected: Number(statsRows[0].rejected || 0),
                        recent: Number(statsRows[0].recent || 0),
                    };
                }
            } catch (statErr) {
                console.error("inquiries-received stats error:", statErr);
            }

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
                // after the clamp, so a page past the end (e.g. after deleting its
                // last row) shows the last page instead of nothing
                const offset = (page - 1) * limit;

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
                            stats,
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
                        course: u.course,
                        bid: u.bid,
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
                        stats
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

    /* Delete a rejected inquiry for good. Only rejected ones (status '0') can be
       deleted; the row is copied to deleted_records first (admin/enrollees). */
    router.post("/delete-inquiry", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id } = req.body;
            if (!id || String(id).length <= 10) {
                return res.json({ success: false, message: "There was something wrong, Please try again" });
            }

            const [rows] = await db.promise().query(
                "SELECT req_id, name FROM enrollees WHERE req_id = ? LIMIT 1", [id]);
            if (rows.length !== 1) {
                return res.json({ success: false, message: "Inquiry not found" });
            }

            const [result] = await db.promise().query(
                "DELETE FROM enrollees WHERE req_id = ? AND status = '0'", [id]);
            if (result.affectedRows !== 1) {
                return res.json({ success: false, message: "Only rejected inquiries can be deleted" });
            }

            const name = String(rows[0].name || "").trim();
            addactivity(ukey, id, "enrollees", "Student Inquiry deleted '" + name + "'", "", "");
            return res.json({ success: true, message: "Inquiry deleted" });

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });

    router.post("/reject-inquiry", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const id = typeof req.body.id === "string" ? req.body.id : "";
            // the reason goes into the student's email; keep it a sensible length
            const reason = String(req.body.reason || "").trim().slice(0, 1000);

            /* 2️⃣ check ID */
            if (id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ The inquiry: its own name and email, never ones sent with the
                  request, so the email only ever goes to the student who applied */
            const [rows] = await db.promise().query(
                "SELECT req_id, name, email FROM enrollees WHERE req_id = ? LIMIT 1", [id]);
            if (rows.length !== 1 || rows[0].req_id !== id) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }
            const { name, email } = rows[0];

            /* 4️⃣ Reject — only a new inquiry, so the email is never sent twice */
            const [result] = await db.promise().query(
                "UPDATE enrollees SET status = '0', reason = ? WHERE req_id = ? AND status = '1'",
                [reason, id]
            );
            if (result.affectedRows !== 1) {
                return res.json({
                    success: false,
                    message: "Only new inquiries can be rejected"
                });
            }

            addactivity(ukey, id, "enrollees", "Student Inquiry info rejected of '" + oneLine(name) + "'", "", "");

            const html = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                    <h2 style="color:#dc3545;">Enrollment Update</h2>

                    <p>Dear <b>${mailText(name)}</b>,</p>

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
                        ${mailText(reason)}
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
                `Hi ${oneLine(name)}, Update on Your Enrollment Request – Rivira Tech`;

            // Send Mail (the inquiry stays rejected either way)
            const sent = await queueMail(email, subject, html).catch(() => false);

            return res.json({
                success: true,
                message: sent
                    ? "Inquiry details was successfully rejected"
                    : "Inquiry rejected, but the email to the student could not be sent"
            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }

    });

    router.post("/payment-request", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const id = typeof req.body.id === "string" ? req.body.id : "";

            /* 2️⃣ check ID */
            if (id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ A new inquiry only */
            const [rows] = await db.promise().query(
                "SELECT * FROM enrollees WHERE req_id = ? AND status = '1' LIMIT 1", [id]);
            if (rows.length !== 1 || rows[0].req_id !== id) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }
            const enr = rows[0];

            // Admin may adjust the fee in the send-payment-link popup; fall
            // back to the fee already saved on the enrollee if none was sent.
            // Either way it must be a real amount: the student is charged it.
            let fee = cleanFee(req.body.fees);
            if (fee === null) fee = cleanFee(enr.fees);
            if (!fee) {
                return res.json({
                    success: false,
                    message: "Please enter a valid fee amount (more than 0, up to " + MAX_FEE + ")"
                });
            }

            /* 4️⃣ The course */
            const [courseRows] = await db.promise().query(
                "SELECT title FROM courses WHERE req_id = ? AND status = '1' LIMIT 1", [enr.course]);
            if (courseRows.length !== 1) {
                return res.json({
                    success: false,
                    message: "The course of this inquiry is not available"
                });
            }
            const coursename = courseRows[0].title;

            /* 5️⃣ Save the (possibly edited) fee + mark payment requested */
            const [result] = await db.promise().query(
                "UPDATE enrollees SET fees = ?, prs = '1' WHERE req_id = ? AND status = '1'",
                [fee, id]
            );
            if (result.affectedRows !== 1) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            addactivity(ukey, id, "enrollees", "Student Inquiry sent payment link to '" + oneLine(enr.name) + "'", "", "");

            const paymentLink = process.env.DOMAIN + "payment?t=" + encodeURIComponent(id);

            const html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                <h2 style="color:#2c7be5;">💳 Payment Request - Rivira Tech</h2>

                <p>Dear <b>${mailText(enr.name)}</b>,</p>

                <p>
                    Greetings from <b>Rivira Tech</b>!
                </p>

                <p>
                    We are pleased to inform you that your enrollment for the course
                    <b>${mailText(coursename)}</b> has been confirmed.
                </p>

                <p>
                    To complete your registration, we kindly request you to proceed with the payment.
                </p>

                <hr>

                <h3>📘 Course & Payment Details</h3>

                <table cellpadding="6">
                    <tr>
                    <td><b>Course Name</b></td>
                    <td>: ${mailText(coursename)}</td>
                    </tr>
                    <tr>
                    <td><b>Plan</b></td>
                    <td>: ${mailText(enr.plan)}</td>
                    </tr>
                    <tr>
                    <td><b>Amount</b></td>
                    <td>: $${fee}</td>
                    </tr>
                    <tr>
                    <td><b>Reference ID</b></td>
                    <td>: ${mailText(enr.id)}</td>
                    </tr>
                </table>

                <hr>

                <h3>🔗 Make Payment</h3>

                <p>
                    Please click the button below to complete your payment securely:
                </p>

                <p style="text-align:center; margin: 20px 0;">
                    <a href="${mailText(paymentLink)}"
                    style="
                        background:#28a745;
                        color:#fff;
                        padding:12px 20px;
                        text-decoration:none;
                        border-radius:6px;
                        font-weight:bold;
                        display:inline-block;
                    ">
                    Pay Now
                    </a>
                </p>

                <p style="color:#555;">
                    Or copy and paste this link in your browser:
                    <br>
                    <a href="${mailText(paymentLink)}">${mailText(paymentLink)}</a>
                </p>

                <hr>

                <h3>⚠️ Important Notes</h3>

                <ul>
                    <li>Please complete the payment within <b>48 hours</b>.</li>
                    <li>Access to classes will be enabled after successful payment.</li>
                    <li>Keep your transaction details for future reference.</li>
                </ul>

                <p style="color:red;">
                    ⚠️ Do not share your payment link with anyone.
                </p>

                <hr>

                <p>
                    If you have any questions or need assistance, feel free to contact us:
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
                `Hi ${oneLine(enr.name)}, Payment Request for Your Course Enrollment – Rivira Tech`;

            // Send Mail
            const sent = await sendMail(enr.email, subject, html).catch(() => false);
            if (!sent) {
                return res.json({
                    success: false,
                    message: "The fee was saved, but the payment email could not be sent. Please try again."
                });
            }
            return res.json({
                success: true,
                message: "Payment request was successfully sent"
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
