/**
 * API routes for src/pages/panel/admin/Courses.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, md5, verifyAccount, addactivity } = ctx;
    const { checkSecurityToken } = require("../../security/backup-token");

    router.post("/courses", async (req, res) => {

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
                     COUNT(c.id) AS total,
                     COUNT(CASE WHEN c.status = '1' THEN 1 END) AS active,
                     COUNT(CASE WHEN c.status = '1S' THEN 1 END) AS disabled,
                     (SELECT COUNT(m.id) FROM members m
                     WHERE m.status = '1') AS students
                     FROM courses c
                     WHERE c.status IN ('1','1S','1D')`,
                    []
                );
                if (statsRows && statsRows[0]) {
                    const r = statsRows[0];
                    stats = { 
                total:    Number(r.total || 0),
                active:   Number(r.active || 0),
                disabled: Number(r.disabled || 0),
                students: Number(r.students || 0),
             };
                }
            } catch (statErr) {
                console.error("courses stats error:", statErr);
            }

            let where = "WHERE (status='1' OR status='1S' OR status='1D')";
            let params = [];

            if (search) {
                where =
                    /* total is an integer column, so it needs a cast before ILIKE */
                    "WHERE (CAST(total AS TEXT) ILIKE ? OR title ILIKE ?) AND (status='1' OR status='1S' OR status='1D')";
                params.push(`%${search}%`);
                params.push(`%${search}%`);
            }

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(id) AS total
                FROM courses
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
                /*
                const dataSql = `
                            SELECT *
                            FROM courses
                            ${where}
                            ORDER BY ${orderBy}
                            LIMIT ? OFFSET ?
                            `;

                const dataParams = [...params, limit, offset];
                */

                /* 6️⃣ Fetch Data */
                const dataSql = `
                    SELECT 
                        b.*,
                        COUNT(DISTINCT m.id) AS students_count
                    FROM courses b
                    LEFT JOIN member_courses mc
                        ON mc.c_id = b.req_id AND mc.status = '1'
                    LEFT JOIN members m
                        ON m.mem_id = mc.mem_id AND m.status = '1'
                    ${where.replaceAll("title", "b.title").replaceAll("total", "b.total").replaceAll("status", "b.status")}

                    GROUP BY b.id
                    ORDER BY ${orderBy.replaceAll("id", "b.id")}

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
                        total: u.total,
                        title: u.title,
                        fees: u.fees,
                        students_count: u.students_count,
                        datetime: u.datetime,
                        status: u.status,
                        enrollable: u.enrollable === "0" ? "0" : "1",
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

    router.post("/add-course", async (req, res) => {
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* 2️⃣ Body */
            const {
                title,
                total,
                fees,
            } = req.body;
            // "0" = not enrollable: shown only in certificate-request course lists
            const enrollable = String(req.body.enrollable ?? "1") === "0" ? "0" : "1";

            /* 5️⃣ Validations */

            if (!title || title.length <= 2) {
                return res.json({ success: false, message: "Please enter title name" });
            }

            if (!total || isNaN(total)) {
                return res.json({ success: false, message: "Please enter total number of classes" });
            }

            if (!fees || isNaN(fees)) {
                return res.json({ success: false, message: "Please fee details" });
            }

            const req_id =
                "a" + md5(Math.random() + Date.now() + title + total);

            /* Insert Member */
            const insertSql = `
                    INSERT INTO courses
                    (req_id,title,total,fees,datetime,status,enrollable)
                    VALUES (?,?,?,?,?,1,?)
                `;
            db.query(
                insertSql,
                [req_id,
                    title,
                    total,
                    fees,
                    Math.floor(Date.now() / 1000),
                    enrollable],
                async (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "New course added '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, req_id, "courses", info, fromtxt, totxt);

                        const dataSql = `
                            SELECT *
                            FROM courses WHERE req_id=?
                            LIMIT 1
                            `;
                        db.query(
                            dataSql,
                            [req_id], (err2, rows) => {

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
                                    total: u.total,
                                    title: u.title,
                                    fees: u.fees,
                                    datetime: u.datetime,
                                    status: u.status,
                        enrollable: u.enrollable === "0" ? "0" : "1",
                                }));

                                /* 8️⃣ Send Data */
                                return res.json({
                                    success: true,
                                    data: cleanRows[0],
                                    message: "Trainer details was successfully added"
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

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }
    });

    router.post("/update-course", async (req, res) => {
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* 2️⃣ Body */
            const {
                req_id,
                title,
                total,
                fees,
            } = req.body;
            const enrollable = String(req.body.enrollable ?? "1") === "0" ? "0" : "1";

            /* 3️⃣ Session Tokens */

            if (!req_id || req_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 5️⃣ Validations */

            if (!title || title.length <= 2) {
                return res.json({ success: false, message: "Please enter title name" });
            }

            if (!total || isNaN(total)) {
                return res.json({ success: false, message: "Please enter total number of classes" });
            }

            if (!fees || isNaN(fees)) {
                return res.json({ success: false, message: "Please fee details" });
            }

            /* 6️⃣ Duplicate Check */

            const checkSql = `
                SELECT *
                FROM courses
                WHERE title = ?
                AND req_id != ?
                LIMIT 1
                `;

            db.query(
                checkSql,
                [title.toLowerCase(), req_id],
                (err, rows) => {

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
                            message: "Course name already added..try with another.."
                        });

                    }

                    /* 8️⃣ Update Member */

                    const updateSql = `
                        UPDATE courses
                        SET
                            title = ?,
                            total = ?,
                            fees = ?,
                            enrollable = ?
                        WHERE req_id = ?
                        LIMIT 1
                        `;

                    db.query(
                        updateSql,
                        [
                            title.trim(),
                            total,
                            fees,
                            enrollable,
                            req_id
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

                                let info = "Course info updated '" + title.trim() + "'";
                                let fromtxt = "";
                                let totxt = "";
                                addactivity(ukey, req_id, "courses", info, fromtxt, totxt);

                                /* 6️⃣ Fetch Data */
                                const dataSql = `
                                    SELECT * 
                                    FROM courses WHERE 
                                    req_id = ? 
                                    LIMIT 1
                                    `;
                                db.query(dataSql, [req_id], (err2, rows) => {

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

                                    const cleanRows = rows.map((u) => ({
                                        id: u.id,
                                        req_id: u.req_id,
                                        total: u.total,
                                        title: u.title,
                                        fees: u.fees,
                                        datetime: u.datetime,
                                        status: u.status,
                        enrollable: u.enrollable === "0" ? "0" : "1",
                                    }));

                                    /* 8️⃣ Send Data */
                                    return res.json({
                                        success: true,
                                        data: cleanRows,
                                        message: `${title} details was successfully updated`
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

    router.post("/disable-course", async (req, res) => {

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
            FROM courses 
            WHERE req_id = ? AND status = '1'
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
                const title = rows[0].title;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Disable Batch */
                const updateSql = `
                    UPDATE courses 
                    SET status = '1S' 
                    WHERE req_id = ? AND status = '1'
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

                        let info = "Course info disabled to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "courses", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Course details was successfully disabled"
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

    router.post("/enable-course", async (req, res) => {

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
                FROM courses
                WHERE req_id = ? AND status = '1S'
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
                const title = rows[0].title;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE courses
                    SET status = '1'
                    WHERE req_id = ? AND status = '1S'
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

                        let info = "Course info enabled to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "courses", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Course details was successfully enabled"
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

    router.post("/delete-course", async (req, res) => {

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
                FROM courses
                WHERE req_id = ? AND (status = '1' OR status = '1S')
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
                const title = rows[0].title;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE courses
                    SET status = '1D'
                    WHERE req_id = ? AND (status = '1' OR status = '1S')
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

                        let info = "Course info deleted to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "courses", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Course details was successfully deleted"
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

    /* Delete a course for good. Only a course already in the Deleted list
       (status 1D), and only with the security token (BACKUP_SECURITY_TOKEN in
       .env). The row is copied to deleted_records by the delete trigger. */
    router.post("/purge-course", async (req, res) => {

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

            const rows = await q("SELECT req_id, title FROM courses WHERE req_id = ? AND status = '1D' LIMIT 1", [id]);
            if (rows.length !== 1 || rows[0].req_id !== id) {
                return res.json({ success: false, message: "Only a course in the Deleted list can be deleted permanently." });
            }

            // nothing may still point at it
            const [b] = await q("SELECT COUNT(*) AS n FROM batches WHERE c_id = ? AND status <> '1D'", [id]);
            const [s] = await q(
                `SELECT COUNT(DISTINCT m.id) AS n FROM member_courses mc
                 JOIN members m ON m.mem_id = mc.mem_id AND m.status = '1'
                 WHERE mc.c_id = ? AND mc.status = '1'`,
                [id]
            );
            const nb = Number(b.n) || 0, ns = Number(s.n) || 0;
            if (nb || ns) {
                const parts = [];
                if (nb) parts.push(nb + " batch" + (nb === 1 ? "" : "es"));
                if (ns) parts.push(ns + " enrolled student" + (ns === 1 ? "" : "s"));
                return res.json({ success: false, message: "This course still has " + parts.join(" and ") + ". Delete or move them first." });
            }

            const result = await q("DELETE FROM courses WHERE req_id = ? AND status = '1D'", [id]);
            if (!result || result.affectedRows !== 1) {
                return res.json({ success: false, message: "There was something wrong, Please try again" });
            }

            addactivity(ukey, id, "courses", "Course '" + String(rows[0].title || "").trim() + "' deleted permanently", "", "");
            return res.json({ success: true, message: "Course deleted permanently" });

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/courses" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "courses" },
];
