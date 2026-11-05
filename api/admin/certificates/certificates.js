/**
 * API routes for src/pages/panel/admin/Certificates.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails

module.exports = (router, ctx) => {
    const { db, formatDate, dateRangeFilter, verifyAccount, addactivity } = ctx;

    router.post("/certificates", async (req, res) => {

        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1"))) return;

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

            /* 2️⃣.5 Full-table stats */
            let stats = null;
            try {
                const s7 = String(Math.floor(Date.now() / 1000) - 7 * 86400);
                const [statsRows] = await db.promise().query(
                    `SELECT
                        COUNT(id)                                       AS total,
                        COUNT(CASE WHEN status = '2' THEN 1 END)       AS approved,
                        COUNT(CASE WHEN status = '1' THEN 1 END)       AS pending,
                        COUNT(CASE WHEN status = '0' THEN 1 END)       AS rejected,
                        COUNT(CASE WHEN datetime >= ? THEN 1 END)      AS recent
                     FROM certificate_requests
                     WHERE status = '0' OR status = '1' OR status = '2'`,
                    [s7]
                );
                if (statsRows && statsRows[0]) {
                    stats = {
                        total:    Number(statsRows[0].total    || 0),
                        approved: Number(statsRows[0].approved || 0),
                        pending:  Number(statsRows[0].pending  || 0),
                        rejected: Number(statsRows[0].rejected || 0),
                        recent:   Number(statsRows[0].recent   || 0),
                    };
                }
            } catch (statErr) {
                console.error("certificates stats error:", statErr);
            }

            // Parameterize the mem_id filter instead of string-concatenating the
            // cookie value (audit SEC-15). ukey is bound as the parameter.
            let setid = "";
            const baseParams = [];
            if (ustatus === "1") {
                setid = " (cr.mem_id = ? OR LOWER(TRIM(cr.email)) = (SELECT LOWER(TRIM(email)) FROM members WHERE mem_id = ? LIMIT 1)) AND ";
                baseParams.push(ukey, ukey);
            }

            /* 3️⃣ Search Filter */
            let where = "WHERE " + setid + " (cr.status='0' OR cr.status='1' OR cr.status='2')";
            let params = [...baseParams];

            if (search) {
                where =
                    "WHERE " + setid + " (cr.name ILIKE ? OR cr.email ILIKE ? OR cr.number ILIKE ?) AND (cr.status='0' OR cr.status='1' OR cr.status='2')";
                params.push(`%${search}%`);
                params.push(`%${search}%`);
                params.push(`%${search}%`);
            }

            /* 3️⃣.5 Date Filter — `datetime` is the certificate's requested date. */
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(cr.id) AS total
                FROM certificate_requests cr
                ${where} ${dr.clause("cr.datetime")}
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
                    SELECT 
                        cr.*, 
                        bt.name AS batch_name,
                        bt.sdate AS batch_sdate,
                        bt.edate AS batch_edate,
                        COALESCE(
                            NULLIF(NULLIF(cr.sdate, ''), '-'),
                            NULLIF(NULLIF(bt.sdate, ''), '-')
                        ) AS effective_sdate,
                        COALESCE(
                            NULLIF(NULLIF(cr.edate, ''), '-'),
                            NULLIF(NULLIF(bt.edate, ''), '-')
                        ) AS effective_edate,
                        c.title AS course_name,
                        COALESCE(
                            NULLIF(cr.mem_id, ''),
                            m.mem_id,
                            (SELECT prev.mem_id FROM certificate_requests prev WHERE LOWER(TRIM(prev.email)) = LOWER(TRIM(cr.email)) AND prev.mem_id IS NOT NULL AND prev.mem_id != '' LIMIT 1)
                        ) AS effective_mem_id
                    FROM certificate_requests cr
                    LEFT JOIN courses c 
                        ON c.req_id = cr.course  
                    LEFT JOIN batches bt
                        ON (bt.b_id = cr.batch OR CAST(bt.id AS TEXT) = cr.batch OR LOWER(TRIM(bt.name)) = LOWER(TRIM(cr.batch)))
                    LEFT JOIN members m
                        ON LOWER(TRIM(m.email)) = LOWER(TRIM(cr.email))
                    ${where} ${dr.clause("cr.datetime")}
                    ORDER BY cr.${orderBy}

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

                    const cleanRows = rows.map((u) => {
                        const finalMemId = u.effective_mem_id || u.mem_id || "";
                        if ((!u.mem_id || String(u.mem_id).trim() === "") && finalMemId) {
                            db.query("UPDATE certificate_requests SET mem_id = ? WHERE id = ? AND (mem_id IS NULL OR mem_id = '')", [finalMemId, u.id], () => {});
                        }
                        return {
                            id: u.id,
                            req_id: u.req_id,
                            mem_id: finalMemId,
                            name: u.name,
                            gender: u.gender,
                            ac_type: u.ac_type || "ELDER",
                            email: u.email,
                            number: u.number,
                            type: u.type,
                            course: u.course,
                            batch: u.batch,
                            course_name: u.course_name,
                            batch_name: u.batch_name,
                            sdate: u.effective_sdate || u.sdate || u.batch_sdate || "",
                            edate: u.effective_edate || u.edate || u.batch_edate || "",
                            batch_sdate: u.batch_sdate || "",
                            batch_edate: u.batch_edate || "",
                            reason: u.reason,
                            datetime: u.datetime,
                            updatetime: u.updatetime,
                            status: u.status,
                        };
                    });

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

    router.post("/reject-certificate", async (req, res) => {

        const { key: ukey} = req.cookies;
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
                SELECT req_id, name, email
                FROM certificate_requests
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
                const resolvedName = (rows[0].name || name || "Learner").trim();
                const resolvedEmail = rows[0].email || email;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE certificate_requests
                    SET status = '0', reason = ?, updatetime = ? 
                    WHERE req_id = ? AND (status = '0' OR status = '1' OR status = '2')
                    LIMIT 1
                `;

                db.query(updateSql, [reason, Math.floor(Date.now() / 1000), id], async (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Certificate request rejected to '" + resolvedName + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "certificate_requests", info, fromtxt, totxt);

                        const html = `
                            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                            <h2 style="color:#dc3545;">Certificate Request Update</h2>

                            <p>Dear <b>${resolvedName}</b>,</p>

                            <p>
                                Thank you for submitting your certificate request to Rivira Tech.
                            </p>

                            <p>
                                After careful review, we regret to inform you that your certificate request
                                has <b style="color:red;">not been approved</b> at this time.
                            </p>

                            <hr>

                            <h3>📌 Reason (If Applicable)</h3>

                            <p style="color:#555;">
                                ${reason}
                            </p>

                            <p>
                                (If no reason is mentioned, you may contact us for further clarification.)
                            </p>

                            <hr>

                            <h3>🔁 Reapply for Certificate</h3>

                            <p>
                                You may submit a new request once the required details or documents
                                have been updated.
                            </p>

                            <p>
                                We appreciate your interest and encourage you to continue your learning
                                journey with us.
                            </p>

                            <hr>

                            <p>
                                For any questions or assistance, please contact:
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
                            `Hi ${resolvedName}, Certificate Request Not Approved – Rivira Tech`;

                        // Send Mail
                        const sent = await queueMail(
                            resolvedEmail,
                            subject,
                            html
                        );
                        if (!sent) {

                        }

                        return res.json({
                            success: true,
                            message: "Certificate details was successfully rejected"
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

    router.post("/accept-certificate", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id, name, email, batch, course, reason } = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT 
                    cr.*,
                    bt.name AS batch_name,
                    bt.sdate AS batch_sdate,
                    bt.edate AS batch_edate,
                    c.title AS course_name
                FROM certificate_requests cr
                LEFT JOIN batches bt 
                    ON LOWER(TRIM(bt.b_id)) = LOWER(TRIM(cr.batch)) OR LOWER(TRIM(bt.name)) = LOWER(TRIM(cr.batch)) OR CAST(bt.id AS TEXT) = cr.batch
                LEFT JOIN courses c 
                    ON LOWER(TRIM(c.req_id)) = LOWER(TRIM(cr.course)) OR LOWER(TRIM(c.title)) = LOWER(TRIM(cr.course))
                WHERE cr.req_id = ? AND (cr.status = '0' OR cr.status = '1' OR cr.status = '2')
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

                const row = rows[0];
                const dbId = row.req_id;
                const certificateType = row.type || "course";
                const sdate = row.sdate || row.batch_sdate || "";
                const edate = row.edate || row.batch_edate || "";

                const decodeHtml = (str) => {
                    if (!str || typeof str !== "string") return str || "";
                    return str
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&#039;/g, "'")
                        .replace(/&#39;/g, "'");
                };

                const isHashId = (val) => typeof val === "string" && /^[a-f0-9]{16,}$/i.test(val.trim());

                // Resolve clean Batch name (avoid leaking raw internal hex hash into emails)
                let resolvedBatch = row.batch_name || "";
                if (!resolvedBatch && batch && !isHashId(batch)) {
                    resolvedBatch = batch;
                }
                if (!resolvedBatch && row.batch && !isHashId(row.batch)) {
                    resolvedBatch = row.batch;
                }
                resolvedBatch = decodeHtml(resolvedBatch || "").trim();

                // Resolve clean Course name
                let resolvedCourse = row.course_name || "";
                if (!resolvedCourse && course && !isHashId(course)) {
                    resolvedCourse = course;
                }
                if (!resolvedCourse && row.course && !isHashId(row.course)) {
                    resolvedCourse = row.course;
                }
                resolvedCourse = decodeHtml(resolvedCourse || "").trim();

                const resolvedName = (row.name || name || "Learner").trim();
                const resolvedEmail = row.email || email;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE certificate_requests
                    SET status = '2', reason = ?, 
                        sdate = COALESCE(NULLIF(sdate, ''), ?),
                        edate = COALESCE(NULLIF(edate, ''), ?),
                        updatetime = ? 
                    WHERE req_id = ? AND (status = '0' OR status = '1' OR status = '2')
                    LIMIT 1
                `;

                db.query(updateSql, [reason, sdate, edate, Math.floor(Date.now() / 1000), id], async (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Certificate request approved to '" + resolvedName + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "certificate_requests", info, fromtxt, totxt);

                        const html = `
                            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                            <h2 style="color:#28a745;">Certificate Request Approved</h2>

                            <p>Dear <b>${resolvedName}</b>,</p>

                            <p>
                                Thank you for submitting your certificate request to Rivira Tech.
                            </p>

                            <p>
                                We are pleased to inform you that your certificate request has been
                                <b style="color:green;">successfully approved</b>.
                            </p>

                            <hr>

                            <h3>📄 Certificate Details</h3>

                            <p style="color:#555;">
                                <b>Certificate Type:</b> ${certificateType}<br>
                                ${resolvedBatch ? `<b>Batch:</b> ${resolvedBatch}<br>` : ""}
                                <b>Course:</b> ${resolvedCourse || "-"}<br>
                                <b>Duration:</b> ${formatDate(sdate)} to ${formatDate(edate)}
                            </p>

                            <hr>

                            <h3>📥 Certificate Access</h3>

                            <p>
                                Your certificate is ready! You can view and download your official certificate in PDF format here:
                            </p>

                            <p style="margin: 22px 0;">
                                <a href="https://www.riviratech.com/certificate/download?m=${encodeURIComponent(row.mem_id || "")}&req_id=${encodeURIComponent(row.req_id)}"
                                   style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">
                                    🎓 Download Certificate PDF
                                </a>
                            </p>

                            <p style="font-size: 13px; color: #64748b;">
                                Direct Link: <a href="https://www.riviratech.com/certificate/download?m=${encodeURIComponent(row.mem_id || "")}&req_id=${encodeURIComponent(row.req_id)}" style="color: #2563eb;">
                                https://www.riviratech.com/certificate/download?m=${encodeURIComponent(row.mem_id || "")}&req_id=${encodeURIComponent(row.req_id)}
                                </a>
                            </p>

                            <hr>

                            <p>
                                If you have any questions or need assistance, feel free to contact us:
                                <br>
                                📧 info@riviratech.com
                            </p>

                            <br>

                            <p>
                                Congratulations on your achievement, and we wish you continued success!
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
                            `Hi ${resolvedName}, Certificate Request Approved – Rivira Tech`;

                        // Send Mail
                        const sent = await queueMail(
                            resolvedEmail,
                            subject,
                            html
                        );
                        if (!sent) {

                        }

                        return res.json({
                            success: true,
                            message: "Certificate details was successfully approved"
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
