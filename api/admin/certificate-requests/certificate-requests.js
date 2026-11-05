/**
 * API routes for src/pages/panel/admin/CertificateRequests.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { hashPassword } = require("../../security/passwords");
const crypto = require("crypto");
const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails
const { accountCreatedMail, certificateApprovedMail } = require("../../shared/student-mails");

// course titles / batch names are stored HTML-encoded; the mail escapes them again
const decodeEntities = (v) => String(v == null ? "" : v).replace(/&(amp|lt|gt|quot|#0?39);/g,
    (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#039;": "'" })[m]);

module.exports = (router, ctx) => {
    const { db, md5, randomId, verifyAccount, addactivity } = ctx;

    // Admins only: it looks a member up by email (id, name, phone, …), which a
    // student must not be able to do for other people.
    router.post("/check-student-account", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const email = String(req.body.email || "").trim().toLowerCase();
            if (!email) {
                return res.json({ success: false, exists: false, message: "Email required" });
            }
            const [rows] = await db.promise().query(
                "SELECT id, mem_id, name, email, number, status FROM members WHERE LOWER(TRIM(email)) = ? LIMIT 1",
                [email]
            );
            if (rows && rows.length > 0) {
                return res.json({
                    success: true,
                    exists: true,
                    member: rows[0],
                });
            }
            const [crRows] = await db.promise().query(
                "SELECT mem_id, name, email, number FROM certificate_requests WHERE LOWER(TRIM(email)) = ? AND mem_id IS NOT NULL AND mem_id != '' LIMIT 1",
                [email]
            );
            if (crRows && crRows.length > 0) {
                return res.json({
                    success: true,
                    exists: true,
                    member: crRows[0],
                });
            }
            return res.json({ success: true, exists: false });
        } catch (err) {
            console.error("check-student-account error:", err);
            return res.json({ success: false, exists: false, message: "Database error" });
        }
    });

    router.post("/create-student-from-request", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const {
                req_id,
                name,
                email,
                number,
                gender,
                qualification,
                course,
                batch,
                password,
                auto_approve,
                reason,
                ac_type,
            } = req.body;

            const cleanEmail = String(email || "").trim().toLowerCase();
            const cleanName = String(name || "").trim();
            const cleanNumber = String(number || "").trim();
            const cleanAcType = String(ac_type || "").trim().toUpperCase() || "ELDER";

            if (!cleanEmail || !cleanName) {
                return res.json({ success: false, message: "Name and email are required" });
            }

            // Look up batch sdate and edate if batch provided
            let bSdate = "";
            let bEdate = "";
            if (batch) {
                try {
                    const [bRows] = await db.promise().query(
                        "SELECT sdate, edate FROM batches WHERE b_id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
                        [batch, batch]
                    );
                    if (bRows && bRows.length > 0) {
                        bSdate = bRows[0].sdate ? String(bRows[0].sdate) : "";
                        bEdate = bRows[0].edate ? String(bRows[0].edate) : "";
                    }
                } catch (bErr) {
                    console.error("Batch date lookup error:", bErr);
                }
            }

            // Check if member already exists
            const [existing] = await db.promise().query(
                "SELECT id, mem_id, email, number FROM members WHERE LOWER(TRIM(email)) = ? LIMIT 1",
                [cleanEmail]
            );

            let finalMemId = "";
            let createdPassword = ""; // set only when a new account is made (for its email)

            if (existing && existing.length > 0) {
                finalMemId = existing[0].mem_id;
            } else {

                const pwd = String(password || "").trim();
                createdPassword = pwd;
                if (!pwd || pwd.length < 6) {
                    return res.json({ success: false, message: "Password must be at least 6 characters" });
                }
                finalMemId = "a" + crypto.randomBytes(16).toString("hex");
                const pwd3 = await hashPassword(pwd);
                // the token / aut sign-in secrets: random, not guessable
                const pwd1 = randomId();
                const pwd2 = randomId();
                const now = Math.floor(Date.now() / 1000);

                await db.promise().query(
                    `INSERT INTO members
                        (mem_id, name, email, number, gender, ac_type, pwd1, pwd2, pwd3,
                         qualification, datetime, lastdatetime, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '1')`,
                    [
                        finalMemId,
                        cleanName,
                        cleanEmail,
                        cleanNumber,
                        gender || "1",
                        cleanAcType,
                        pwd1,
                        pwd2,
                        pwd3,
                        qualification || "Graduate",
                        now,
                    ]
                );

            }
            
            // Upsert the student's row for THIS course in member_courses (their
            // other courses are left alone).
            if (course) {
                const [mcrows] = await db.promise().query(
                    `SELECT id
                    FROM member_courses
                    WHERE mem_id = ? AND c_id = ?
                    LIMIT 1`,
                    [finalMemId, course]
                );

                if (mcrows.length > 0) {
                    // Exists → update the batch, keep it active.
                    await db.promise().query(
                        `UPDATE member_courses
                        SET b_id = ?, status = '1'
                        WHERE id = ?`,
                        [batch || "", mcrows[0].id]
                    );
                } else {
                    // Not exists → insert it.
                    await db.promise().query(
                        `INSERT INTO member_courses
                        (mem_id, c_id, b_id, expires, datetime, status)
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [finalMemId, course, batch || "", "", Math.floor(Date.now() / 1000), "1"]
                    );
                }
            }

            // Link to certificate_requests
            const nowTs = Math.floor(Date.now() / 1000);
            let approved = false;

            if (auto_approve) {
                approved = true;
                await db.promise().query(
                    `UPDATE certificate_requests
                     SET mem_id = ?, course = ?, batch = ?, 
                         sdate = COALESCE(NULLIF(sdate, ''), ?),
                         edate = COALESCE(NULLIF(edate, ''), ?),
                         ac_type = COALESCE(NULLIF(ac_type, ''), ?),
                         status = '2', reason = ?, updatetime = ?
                     WHERE req_id = ?`,
                    [finalMemId, course || "", batch || "", bSdate, bEdate, cleanAcType, reason || "Student account created and approved", nowTs, req_id]
                );
            } else {
                await db.promise().query(
                    `UPDATE certificate_requests
                     SET mem_id = ?, course = ?, batch = ?, 
                         sdate = COALESCE(NULLIF(sdate, ''), ?),
                         edate = COALESCE(NULLIF(edate, ''), ?),
                         ac_type = COALESCE(NULLIF(ac_type, ''), ?),
                         updatetime = ?
                     WHERE req_id = ?`,
                    [finalMemId, course || "", batch || "", bSdate, bEdate, cleanAcType, nowTs, req_id]
                );
            }

            addactivity(ukey, req_id, "certificate_requests", "Created/linked student account for '" + cleanName + "'", "", "");

            /* Emails (as /accept-enroll and /accept-certificate): the new
               account's sign-in details, and the approved certificate. A mail
               failure doesn't undo anything — the message says what was sent. */
            const mailed = [];
            try {
                const [[c] = []] = await db.promise().query("SELECT title FROM courses WHERE req_id = ? LIMIT 1", [course || ""]);
                const [[b] = []] = await db.promise().query("SELECT name, edate FROM batches WHERE b_id = ? LIMIT 1", [batch || ""]);
                const courseName = decodeEntities(c && c.title);
                const batchName = decodeEntities(b && b.name);

                if (createdPassword) {
                    const m = accountCreatedMail({
                        name: cleanName, email: cleanEmail, password: createdPassword,
                        courseName, batchName, endDate: b && b.edate,
                    });
                    if (await queueMail(cleanEmail, m.subject, m.html)) mailed.push("account");
                }

                if (approved) {
                    const [[r] = []] = await db.promise().query(
                        "SELECT req_id, mem_id, name, email, type, sdate, edate FROM certificate_requests WHERE req_id = ? LIMIT 1",
                        [req_id]
                    );
                    if (r) {
                        const m = certificateApprovedMail({
                            name: r.name || cleanName, type: r.type, courseName, batchName,
                            sdate: r.sdate, edate: r.edate, memId: r.mem_id, reqId: r.req_id,
                        });
                        if (await queueMail(r.email || cleanEmail, m.subject, m.html)) mailed.push("certificate");
                    }
                }
            } catch (mailErr) {
                console.error("create-student-from-request mail error:", mailErr.message);
            }

            const wanted = (createdPassword ? 1 : 0) + (approved ? 1 : 0);
            const mailNote = !wanted ? ""
                : mailed.length === wanted ? " Email is being sent to " + cleanEmail + "."
                : " (Email could not be sent — please inform the student.)";

            return res.json({
                success: true,
                message: (approved ? "Account linked and certificate request approved successfully!" : "Account linked successfully!") + mailNote,
                mem_id: finalMemId,
                approved,
                mailed,
            });
        } catch (err) {
            console.error("create-student-from-request error:", err);
            return res.json({ success: false, message: "Failed to create student account: " + err.message });
        }
    });

    /* =====================================
       Admin: Update Certificate Request Details
    ====================================== */
    // Admins only: it edits any request by id — a student could otherwise change
    // someone else's request, or the course / dates on their own approved certificate.
    router.post("/update-certificate-request", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { req_id, batch, course, sdate, edate, ac_type } = req.body;
            if (!req_id) {
                return res.json({ success: false, message: "Request ID is required" });
            }

            let finalSdate = sdate ? String(sdate).trim() : "";
            let finalEdate = edate ? String(edate).trim() : "";

            // If dates are blank and a batch is selected, pull start and end dates from batch
            if (batch && (!finalSdate || !finalEdate)) {
                try {
                    const [bRows] = await db.promise().query(
                        "SELECT sdate, edate FROM batches WHERE b_id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
                        [batch, batch]
                    );
                    if (bRows && bRows.length > 0) {
                        if (!finalSdate && bRows[0].sdate) finalSdate = String(bRows[0].sdate);
                        if (!finalEdate && bRows[0].edate) finalEdate = String(bRows[0].edate);
                    }
                } catch (bErr) {
                    console.error("Batch date lookup error:", bErr);
                }
            }

            const nowTs = Math.floor(Date.now() / 1000);
            await db.promise().query(
                `UPDATE certificate_requests
                 SET batch = COALESCE(NULLIF(?, ''), batch),
                     course = COALESCE(NULLIF(?, ''), course),
                     sdate = COALESCE(NULLIF(?, ''), sdate),
                     edate = COALESCE(NULLIF(?, ''), edate),
                     ac_type = COALESCE(NULLIF(?, ''), ac_type),
                     updatetime = ?
                 WHERE req_id = ?`,
                [batch || "", course || "", finalSdate, finalEdate, ac_type || "", nowTs, req_id]
            );

            addactivity(ukey, req_id, "certificate_requests", "Updated certificate request details", "", "");

            return res.json({
                success: true,
                message: "Certificate request details updated successfully",
                sdate: finalSdate,
                edate: finalEdate,
            });
        } catch (err) {
            console.error("Update certificate request error:", err);
            return res.json({ success: false, message: "Server error" });
        }
    });

    /* ===============================
       Certificate Request API
    ================================ */
    router.post("/certificate-request", async (req, res) => {

        try {
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "1"))) return;

            const {
                name,
                phone,
                fullphone,
                email,
                gender,
                type,
                course,
                batch,
            } = req.body;

            const datetime = Math.floor(Date.now() / 1000);

            /* ===============================
               Input Validation
            ================================ */

            if (!name || name.length <= 2)
                return res.json({ success: false, message: "Please enter full name" });

            // the country-code picker sends "+<code><digits>" as fullphone
            const full = typeof fullphone === "string" ? fullphone.trim() : "";
            const number = /^\+\d{6,15}$/.test(full) ? full : String(phone || "").replace(/\D/g, "");
            const numberDigits = number.replace(/\D/g, "");
            if (numberDigits.length < 6 || numberDigits.length > 15)
                return res.json({ success: false, message: "Please enter valid contact number" });

            if (!email || email.length <= 7)
                return res.json({ success: false, message: "Please enter email" });

            if (!/^\S+@\S+\.\S+$/.test(email))
                return res.json({ success: false, message: "Please enter valid email" });

            if (!gender || !["1", "2", "3"].includes(gender))
                return res.json({ success: false, message: "Please select gender" });

            // same choices as the website form (CertificateRequest.tsx)
            if (!["course", "internship", "project", "bootcamp"].includes(String(type || "")))
                return res.json({ success: false, message: "Please select certificate type" });

            if (typeof course !== "string" || course.length <= 2)
                return res.json({ success: false, message: "Please select course" });

            if (batch !== undefined && batch !== "" && (typeof batch !== "string" || batch.length > 100))
                return res.json({ success: false, message: "Please select a valid batch" });

            /* ===============================
               Check Existing Request
            ================================ */

            const [exists] = await db.promise().query(
                `SELECT id FROM certificate_requests
                    WHERE mem_id = ? AND course = ? AND status = '1'
                    ORDER BY id DESC LIMIT 1`,
                [ukey, course]
            );

            if (exists.length > 0) {
                return res.json({
                    success: false,
                    message: "You already have a pending request. Please wait for approval."
                });
            }

            /* Verify the student is on the course */
            const [getbatach] = await db.promise().query(
                "SELECT * FROM member_courses WHERE mem_id=? AND c_id=?",
                [ukey, course]
            );

            if (!getbatach.length)
                return res.json({ success: false, message: "You are not assigned to select a course." });

            /* Batch: the one picked (must belong to this course), else the
               student's own batch for the course. Its dates are the request's. */
            let b_id = getbatach[0].b_id || "";
            if (batch) {
                const [picked] = await db.promise().query(
                    "SELECT b_id FROM batches WHERE b_id = ? AND c_id = ? AND status <> '1D' LIMIT 1",
                    [batch, course]
                );
                if (!picked.length)
                    return res.json({ success: false, message: "Please select a batch of this course" });
                b_id = picked[0].b_id;
            }

            let startDate = "";
            let endDate = "";
            if (b_id) {
                const [bRows] = await db.promise().query(
                    "SELECT sdate, edate FROM batches WHERE b_id = ? LIMIT 1",
                    [b_id]
                );
                if (bRows.length) {
                    startDate = bRows[0].sdate ? String(bRows[0].sdate) : "";
                    endDate = bRows[0].edate ? String(bRows[0].edate) : "";
                }
            }

            /* ===============================
               Insert Request
            ================================ */
            const req_id =
                "a" + md5(Math.random() + Date.now() + ukey + endDate);
            /* Insert Member */
            const insertSql = `
                  INSERT INTO certificate_requests
                (req_id, mem_id, name, email, number, gender, type, course, batch,
                sdate, edate, datetime, updatetime, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
            db.query(
                insertSql,
                [req_id, ukey,
                    name.trim(),
                    email.toLowerCase(),
                    number,
                    gender,
                    type,
                    course,
                    b_id,
                    startDate,
                    endDate,
                    datetime,
                    "",
                    "1"],
                async (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        const dataSql = `
                    SELECT 
                            cr.*, bt.name AS batch_name,
                            c.title AS course_name
                        FROM certificate_requests cr
                        LEFT JOIN courses c 
                            ON c.req_id = cr.course  
                        LEFT JOIN batches bt
                            ON bt.b_id = cr.batch WHERE cr.req_id=? AND cr.mem_id=?
                                LIMIT 1
                                `;
                        db.query(
                            dataSql,
                            [req_id, ukey], (err2, rows) => {

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
                                        message: "No data found"
                                    });

                                }

                                const cleanRows = rows.map((u) => ({
                                    id: u.id,
                                    req_id: u.req_id,
                                    mem_id: u.mem_id,
                                    name: u.name,
                                    gender: u.gender,
                                    email: u.email,
                                    number: u.number,
                                    type: u.type,
                                    course: u.course,
                                    batch: u.batch,
                                    course_name: u.course_name,
                                    batch_name: u.batch_name,
                                    sdate: u.sdate,
                                    edate: u.edate,
                                    reason: u.reason,
                                    datetime: u.datetime,
                                    updatetime: u.updatetime,
                                    status: u.status,
                                }));

                                /* 8️⃣ Send Data */
                                return res.json({
                                    success: true,
                                    data: cleanRows[0],
                                    message: "Thank you, your certificate request was successfully submitted"
                                });

                            });

                    } else {
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                });

        } catch (err) {

            console.log(err + "");

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/certificate-requests" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "certificate_requests" },
];
