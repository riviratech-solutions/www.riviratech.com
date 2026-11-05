/**
 * API routes for src/pages/panel/admin/Batches.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, md5, verifyAccount, addactivity } = ctx;
    const { checkSecurityToken } = require("../../security/backup-token");

    // Certificate the batch's students get (website CertificateDownload.tsx):
    // 1 Kids Completion, 2 Completion, 3 Bootcamp Participation.
    const C_TYPES = ["1", "2", "3"];

    /* batch start */
    router.post("/batches", async (req, res) => {

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
            /* Full-table stats for the cards above the table (whole table, not this page) */
            let stats = null;
            try {
                const [statsRows] = await db.promise().query(
                    `SELECT
                     COUNT(CASE WHEN b.status IN ('1','0') THEN 1 END) AS total,
                     COUNT(CASE WHEN b.status = '1' THEN 1 END) AS active,
                     COUNT(CASE WHEN b.status = '0' THEN 1 END) AS disabled,
                     COUNT(CASE WHEN b.status = '1D' THEN 1 END) AS deleted,
                     (SELECT COUNT(id) FROM courses WHERE status = '1') AS courses
                     FROM batches b
                     WHERE b.c_id = ? AND b.status IN ('1','0','1D')`,
                    [`${id}`]
                );
                if (statsRows && statsRows[0]) {
                    const r = statsRows[0];
                    stats = { 
                total:    Number(r.total || 0),
                active:   Number(r.active || 0),
                disabled: Number(r.disabled || 0),
                deleted:  Number(r.deleted || 0),
                courses:  Number(r.courses || 0),
             };
                }
            } catch (statErr) {
                console.error("batches stats error:", statErr);
            }

            let where = "WHERE c_id = ? AND (status='1' OR status='0' OR status='1D')";
            let params = [];

            if (search) {
                where =
                    "WHERE c_id = ? AND (name ILIKE ?) AND (status='1' OR status='0' OR status='1D')";
                params.push(`${id}`);
                params.push(`%${search}%`);
            } else {
                params.push(`${id}`);
            }

            /* 4️⃣ Pagination */
            const limit = 10;
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(id) AS total
                FROM batches
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
                const dataSql = `
                    SELECT 
                        b.*,
                        COUNT(DISTINCT m.id) AS students_count
                    FROM batches b
                    LEFT JOIN member_courses mc
                        ON mc.b_id = b.b_id AND mc.status = '1'
                    LEFT JOIN members m
                        ON m.mem_id = mc.mem_id AND m.status = '1'
                    ${where.replaceAll("name", "b.name").replaceAll("c_id", "b.c_id").replaceAll("status", "b.status")}
                    GROUP BY b.id
                    ORDER BY (b.status = '1D'), ${orderBy.replaceAll("id", "b.id")}

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

                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: rows,
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

    router.post("/add-batch", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            /* 2️⃣ Get Tokens */
            const { c_id, name, sdate, edate } = req.body;
            const c_type = String(req.body.c_type || "");

            /* 4️⃣ Validates */
            if (!C_TYPES.includes(c_type)) {
                return res.json({
                    success: false,
                    message: "Please select the certificate type"
                });
            }
            if (!name || name.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter batch name"
                });
            }
            if (!sdate || sdate.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please select start date"
                });
            }
            if (!edate || edate.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please select end date"
                });
            }
            if (edate <= sdate) {
                return res.json({
                    success: false,
                    message: "End date must be after start date"
                });
            }

            /* no new batches for a missing or deleted course */
            const [courseRows] = await db.promise().query(
                "SELECT status FROM courses WHERE req_id = ? LIMIT 1",
                [String(c_id || "")]
            );
            if (courseRows.length !== 1 || courseRows[0].status === "1D") {
                return res.json({
                    success: false,
                    message: "Please select an active course"
                });
            }

            /* 5️⃣ Check Duplicate */
            const checkSql = `
                SELECT id 
                FROM batches 
                WHERE name = ? and c_id = ?
                LIMIT 1
                `;

            db.query(checkSql, [name, c_id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length > 0) {
                    return res.json({
                        success: false,
                        message: "Name already registered..try with another.."
                    });
                }

                /* 6️⃣ Generate Batch ID */
                const datetime = Math.floor(new Date().getTime() / 1000)

                const random = crypto
                    .randomBytes(32)
                    .toString("hex");

                const b_id = "a" + md5(random + Date.now());

                /* 7️⃣ Insert */
                const insertSql = `
                    INSERT INTO batches (b_id, c_id, name, sdate, edate, c_type, datetime, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, '1')
                `;

                db.query(
                    insertSql,
                    [b_id, c_id, name.trim(), sdate, edate, c_type, datetime],
                    (err2, result) => {

                        if (err2) {
                            console.error(err2);
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
                            });
                        }

                        if (result.affectedRows === 1) {

                            let info = "New batch added '" + name.trim() + "'";
                            let fromtxt = "";
                            let totxt = "";
                            addactivity(ukey, b_id, "batches", info, fromtxt, totxt);

                            // ✅ Fetch inserted row
                            const selectSql = `
                                    SELECT * FROM batches WHERE b_id = ? LIMIT 1
                                `;

                            db.query(selectSql, [b_id], (err3, rows) => {

                                if (err3) {
                                    console.error(err3);
                                    return res.json({
                                        success: false,
                                        message: "Inserted but fetch failed"
                                    });
                                }

                                // ✅ Return inserted row
                                return res.json({
                                    success: true,
                                    data: rows[0],   // 👈 full row
                                    message: "Batch details was successfully submitted"
                                });

                            });

                        } else {

                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
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

    router.post("/update-batch", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            /* Get Data */
            const { id, name, sdate, edate } = req.body;
            const c_type = String(req.body.c_type || "");

            /* Validate ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "Invalid batch ID"
                });
            }

            /* Validate Name */
            if (!name || name.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter batch name"
                });
            }
            if (!sdate || sdate.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please select start date"
                });
            }
            if (!edate || edate.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please select end date"
                });
            }
            if (edate <= sdate) {
                return res.json({
                    success: false,
                    message: "End date must be after start date"
                });
            }
            if (!C_TYPES.includes(c_type)) {
                return res.json({
                    success: false,
                    message: "Please select the certificate type"
                });
            }

            /* Update */
            const updateSql = `
                    UPDATE batches
                    SET name = ?, sdate = ?, edate = ?, c_type = ?
                    WHERE b_id = ?
                    LIMIT 1
                    `;

            db.query(updateSql, [name.trim(), sdate, edate, c_type, id], (err, result) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (result.affectedRows !== 1) {
                    return res.json({
                        success: false,
                        message: "No batch found or no change made"
                    });
                }

                let info = "Batch info Updated '" + name.trim() + "'";
                let fromtxt = "";
                let totxt = "";
                addactivity(ukey, id, "batches", info, fromtxt, totxt);

                /* Fetch Updated Row */
                const selectSql = `
                    SELECT * FROM batches
                    WHERE b_id = ?
                    LIMIT 1
                `;

                db.query(selectSql, [id], (err2, rows) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Updated but fetch failed"
                        });
                    }

                    return res.json({
                        success: true,
                        data: rows[0], // ✅ updated row
                        message: "Batch details was successfully updated"
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

    /* A batch's progress: "running" while its classes go on, "completed" once it
       has finished (batches.progress). Students can ask questions and review the
       course on the Classes page until their batch is completed. */
    router.post("/batch-progress", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = String(req.body.id || "");
            const progress = req.body.progress === "completed" ? "completed" : req.body.progress === "running" ? "running" : "";
            if (id.length <= 10 || !progress) return res.json({ success: false, message: "There was something wrong, Please try again" });
            const [rows] = await db.promise().query("SELECT b_id, name FROM batches WHERE b_id = ? AND status <> '1D' LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Batch not found" });
            await db.promise().query("UPDATE batches SET progress = ? WHERE b_id = ?", [progress, id]);
            addactivity(ukey, id, "batches", "Batch marked " + progress + " '" + rows[0].name + "'", "", "");
            return res.json({ success: true, message: progress === "completed" ? "Batch marked as completed" : "Batch marked as running", progress });
        } catch (err) {
            console.error("batch-progress:", err.message);
            return res.json({ success: false, message: "Database error" });
        }
    });

    router.post("/disable-batch", async (req, res) => {

        const { key: ukey} = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Active */
            const sql = `
            SELECT b_id, name 
            FROM batches 
            WHERE b_id = ? AND status = '1'
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

                const dbId = rows[0].b_id;
                const name = rows[0].name || "";

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Disable Batch */
                const updateSql = `
                    UPDATE batches 
                    SET status = '0' 
                    WHERE b_id = ? AND status = '1'
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

                        let info = "Batch info disabled '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "batches", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Batch details was successfully disabled"
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

    router.post("/enable-batch", async (req, res) => {

        const { key: ukey} = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {

            /* 1️⃣ Check Login */

            const { id } = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT b_id, name
                FROM batches
                WHERE b_id = ? AND status = '0'
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

                const dbId = rows[0].b_id;
                const name = rows[0].name || "";

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE batches
                    SET status = '1'
                    WHERE b_id = ? AND status = '0'
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

                        let info = "Batch info enabled '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "batches", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Batch details was successfully enabled"
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

    router.post("/delete-batch", async (req, res) => {

        const { key: ukey} = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists */
            const sql = `
                SELECT b_id, name
                FROM batches
                WHERE b_id = ? AND (status = '0' OR status = '1')
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
                        message: "Batch not found or already deleted"
                    });
                }

                const dbId = rows[0].b_id;
                const name = rows[0].name || "";

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Soft Delete Batch */
                const updateSql = `
                    UPDATE batches
                    SET status = '1D'
                    WHERE b_id = ? AND (status = '0' OR status = '1')
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

                        let info = "Batch info deleted '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "batches", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Batch details was successfully deleted"
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

    /* Delete a batch for good. Only a batch already deleted (status 1D), and
       only with the security token (BACKUP_SECURITY_TOKEN in .env). The row
       is copied to deleted_records by the delete trigger. */
    router.post("/purge-batch", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id, security_token } = req.body;
            if (typeof id !== "string" || id.length <= 10 || id.length > 100) {
                return res.json({ success: false, message: "There was something wrong, Please try again" });
            }

            const tok = await checkSecurityToken(ukey, security_token);
            if (!tok.ok) return res.json({ success: false, message: tok.message, token: false });

            const q = async (sql, p) => (await db.promise().query(sql, p))[0];

            const rows = await q("SELECT b_id, name FROM batches WHERE b_id = ? AND status = '1D' LIMIT 1", [id]);
            if (rows.length !== 1 || rows[0].b_id !== id) {
                return res.json({ success: false, message: "Only a deleted batch can be deleted permanently." });
            }

            // nothing may still point at it
            const [s] = await q(
                `SELECT COUNT(DISTINCT m.id) AS n FROM member_courses mc
                 JOIN members m ON m.mem_id = mc.mem_id AND m.status = '1'
                 WHERE mc.b_id = ? AND mc.status = '1'`,
                [id]
            );
            const [l] = await q("SELECT COUNT(*) AS n FROM liveclasses WHERE b_id = ? AND status NOT LIKE '%D'", [id]);
            const [a] = await q("SELECT COUNT(*) AS n FROM assignments WHERE batch = ? AND status NOT LIKE '%D'", [id]);
            const ns = Number(s.n) || 0, nl = Number(l.n) || 0, na = Number(a.n) || 0;
            if (ns || nl || na) {
                const parts = [];
                if (ns) parts.push(ns + " enrolled student" + (ns === 1 ? "" : "s"));
                if (nl) parts.push(nl + " live class" + (nl === 1 ? "" : "es"));
                if (na) parts.push(na + " assignment" + (na === 1 ? "" : "s"));
                return res.json({ success: false, message: "This batch still has " + parts.join(", ") + ". Delete or move them first." });
            }

            const result = await q("DELETE FROM batches WHERE b_id = ? AND status = '1D'", [id]);
            if (!result || result.affectedRows !== 1) {
                return res.json({ success: false, message: "There was something wrong, Please try again" });
            }

            addactivity(ukey, id, "batches", "Batch '" + String(rows[0].name || "").trim() + "' deleted permanently", "", "");
            return res.json({ success: true, message: "Batch deleted permanently" });

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/batches" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "batches" },
];
