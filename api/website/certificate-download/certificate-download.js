/**
 * API routes for src/pages/website/CertificateDownload.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, checkStatus } = ctx;

    /* =====================================
       Certificate Download & Verification Details
    ====================================== */
    router.all(["/certificate/details", "/certificate/download-details"], async (req, res) => {
        try {
            // A GET has no body (req.body is undefined), so an empty ?m= used to
            // fall through to req.body.m and crash with a 500 — every guest
            // certificate link (no member account, so m is empty) failed that way.
            const body = req.body || {};
            const req_id = String(req.query.req_id || body.req_id || "").trim();
            const mem_id = String(req.query.m || body.m || req.query.mem_id || body.mem_id || "").trim();

            if (!req_id && !mem_id) {
                return res.status(400).json({
                    success: false,
                    message: "Certificate request ID or Member ID is required",
                });
            }

            let sql = `
                SELECT 
                    cr.id,
                    cr.req_id,
                    cr.mem_id,
                    cr.name,
                    cr.email,
                    cr.number,
                    cr.gender,
                    cr.ac_type,
                    cr.type,
                    cr.course,
                    cr.batch,
                    COALESCE(NULLIF(cr.sdate, ''), bt.sdate) AS sdate,
                    COALESCE(NULLIF(cr.edate, ''), bt.edate) AS edate,
                    cr.datetime,
                    cr.updatetime,
                    cr.status,
                    bt.name AS batch_name,
                    bt.c_type AS c_type,
                    bt.sdate AS batch_sdate,
                    bt.edate AS batch_edate,
                    c.title AS course_name,
                    c.title AS program_name
                FROM certificate_requests cr
                LEFT JOIN batches bt 
                    ON LOWER(TRIM(bt.b_id)) = LOWER(TRIM(cr.batch)) OR LOWER(TRIM(bt.name)) = LOWER(TRIM(cr.batch)) OR CAST(bt.id AS TEXT) = cr.batch
                LEFT JOIN courses c 
                    ON LOWER(TRIM(c.req_id)) = LOWER(TRIM(cr.course)) OR LOWER(TRIM(c.title)) = LOWER(TRIM(cr.course))
            `;

            /* Who may open which certificate:
               - a signed-in admin: any status (they preview requests before approving)
               - everyone else: approved certificates only (status '2'). A member's
                 certificate also needs its matching m (every link the site builds
                 carries it); a guest request (no member account) opens by req_id. */
            let isAdmin = false;
            try {
                isAdmin = !!(await checkStatus(req, "X,Y")).success;
            } catch {
                isAdmin = false;
            }
            const approved = isAdmin ? "" : ` AND cr.status = '2' `;

            const params = [];
            if (req_id && mem_id) {
                sql += ` WHERE cr.req_id = ? ${approved} AND (cr.mem_id = ? OR cr.mem_id IS NULL OR cr.mem_id = '' OR LOWER(TRIM(cr.email)) = (SELECT LOWER(TRIM(email)) FROM members WHERE mem_id = ? LIMIT 1)) `;
                params.push(req_id, mem_id, mem_id);
            } else if (req_id) {
                sql += isAdmin
                    ? ` WHERE cr.req_id = ? `
                    : ` WHERE cr.req_id = ? ${approved} AND (cr.mem_id IS NULL OR cr.mem_id = '') `;
                params.push(req_id);
            } else {
                sql += ` WHERE cr.mem_id = ? AND cr.status = '2' `;
                params.push(mem_id);
            }

            sql += ` ORDER BY cr.id DESC LIMIT 1 `;

            db.query(sql, params, (err, rows) => {
                if (err) {
                    console.error("Fetch certificate details error:", err);
                    return res.status(500).json({ success: false, message: "Database error" });
                }

                if (!rows || rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Certificate not found" });
                }

                const row = rows[0];

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

                let finalBatch = row.batch_name || "";
                if (!finalBatch && row.batch && !isHashId(row.batch)) finalBatch = row.batch;

                let finalCourse = row.course_name || "";
                if (!finalCourse && row.course && !isHashId(row.course)) finalCourse = row.course;

                return res.json({
                    success: true,
                    data: {
                        id: row.id,
                        req_id: row.req_id,
                        mem_id: row.mem_id || mem_id,
                        name: decodeHtml(row.name),
                        // Certificate links are shared publicly (they're how a
                        // certificate is verified), so the holder's contact
                        // details go to admins only.
                        email: isAdmin ? row.email : "",
                        number: isAdmin ? row.number : "",
                        gender: row.gender,
                        ac_type: row.ac_type || "ELDER",
                        // which certificate: the batch's type (1 Kids Completion,
                        // 2 Completion, 3 Bootcamp Participation); batches from
                        // before that setting go by the account type
                        c_type: ["1", "2", "3"].includes(String(row.c_type || ""))
                            ? String(row.c_type)
                            : (row.ac_type === "KID" ? "1" : "2"),
                        type: row.type || "course",
                        course: decodeHtml(finalCourse || row.course || "AI Launchpad Program"),
                        course_name: decodeHtml(finalCourse || row.course || "AI Launchpad Program"),
                        program_name: decodeHtml(finalCourse || row.course || "AI Launchpad Program"),
                        batch: decodeHtml(finalBatch || ""),
                        batch_name: decodeHtml(finalBatch || ""),
                        sdate: row.sdate || row.batch_sdate || "",
                        edate: row.edate || row.batch_edate || "",
                        datetime: row.datetime,
                        updatetime: row.updatetime,
                        status: row.status, // "2" = Approved, "1" = Pending, "0" = Rejected
                    },
                });
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ success: false, message: "Server error" });
        }
    });
};
