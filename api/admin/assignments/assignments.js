/**
 * API routes for src/pages/panel/admin/Assignments.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, md5, checkStatus, verifyAccount, moveS3File, deleteS3File, addactivity } = ctx;

    router.post("/assignments", async (req, res) => {

        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

        const ok = await checkStatus(req, "X,Y,1,2");

        const usercourse = ok.courses;

        try {
            const { q, s, n} = req.body;

            /* 1️⃣ Get Query Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort */
            let orderBy = "id DESC";

            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            let where = "WHERE status='00'";
            let params = [];
            /* 3️⃣ Search Filter */
            if (ustatus === "X") {
                where = "WHERE (status='1' OR status='1S' OR status='1D' OR status='2')";

                if (search) {
                    where =
                        "WHERE (title ILIKE ? OR note ILIKE ?) AND (status='1' OR status='1D' OR status='1S' OR status='2')";
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                }

            } else {

                if (ustatus === "1") {

                    where = "WHERE (cr.status='1' OR cr.status='1S' OR cr.status='2') AND mc.mem_id = ?";
                    if (search) {
                        where =
                            "WHERE (cr.title ILIKE ? OR cr.note ILIKE ?) AND (cr.status='1' OR cr.status='1S' OR cr.status='2') AND mc.mem_id = ?";
                        params.push(`%${search}%`);
                        params.push(`%${search}%`);
                    }
                    params.push(`${ukey}`);

                } else if (ustatus === "2") {

                    where = "WHERE mem_id = ? AND (status='1' OR status='1S' OR status='1D' OR status='2')";
                    params.push(`${ukey}`);
                    if (search) {
                        where =
                            "WHERE mem_id = ? AND (title ILIKE ? OR note ILIKE ?) AND (status='1' OR status='1D' OR status='1S' OR status='2')";
                        params.push(`%${search}%`);
                        params.push(`%${search}%`);
                    }

                }

            }
            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */
            let countSql = "";
            if (ustatus === "X" || ustatus === "2") {
                countSql = `
                SELECT COUNT(id) AS total
                FROM assignments
                ${where}
                `;
            } else if (ustatus === "1") {
                countSql = `
                SELECT COUNT(cr.id) AS total
                FROM assignments AS cr
                INNER JOIN member_courses mc
                         ON mc.b_id = cr.batch
                ${where}
                `;
            }

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
                let dataSql = "";
                if (ustatus === "X" || ustatus === "2") {
                    dataSql = `
                    SELECT 
                        cr.*, MAX(bt.name) AS batch_name,
                        MAX(c.title) AS course_name,
                        MAX(m.name) AS tname,
                        COUNT(m.id) AS students_count, 
                        COUNT(crs.id) AS subs_count
                    FROM assignments cr 
                    LEFT JOIN courses c 
                        ON c.req_id = cr.course   
                    LEFT JOIN batches bt
                        ON bt.b_id = cr.batch 
                    LEFT JOIN member_courses mc 
                        ON mc.b_id = cr.batch 
                        AND mc.status = '1' 
                    LEFT JOIN members m 
                        ON m.mem_id = cr.mem_id 
                    LEFT JOIN assignmentsubs crs 
                        ON cr.req_id = crs.req_id 

                    ${where.replaceAll("mem_id", "cr.mem_id").replaceAll("title", "cr.title").replaceAll("note", "cr.note").replaceAll("status", "cr.status")}

                    GROUP BY cr.id
                    ORDER BY ${orderBy.replaceAll("id", "cr.id")}
                    LIMIT ? OFFSET ?
                    `;
                } else {
                    dataSql = `
                    SELECT 
                        cr.*, MAX(bt.name) AS batch_name,
                        MAX(c.title) AS course_name,
                        MAX(crs.status) AS sub_status,
                        MAX(m.name) AS tname
                    FROM assignments cr 
                    LEFT JOIN courses c 
                        ON c.req_id = cr.course   
                    LEFT JOIN batches bt
                        ON bt.b_id = cr.batch  
                    LEFT JOIN members m
                        ON m.mem_id = cr.mem_id
                    LEFT JOIN assignmentsubs crs
                        ON crs.id = (
                            SELECT MAX(id)
                            FROM assignmentsubs
                            WHERE req_id = cr.req_id
                            AND mem_id = ?
                        )
                    INNER JOIN member_courses mc
                        ON mc.b_id = cr.batch
                    ${where}
                    GROUP BY cr.id
                    ORDER BY ${orderBy.replaceAll("id", "cr.id")}, MAX(crs.id) DESC
                    LIMIT ? OFFSET ?
                    `;
                    params.push(`${ukey}`);

                }

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
                        mem_id: u.mem_id,
                        tname: u.tname,
                        title: u.title,
                        note: u.note,
                        course: u.course,
                        batch: u.batch,
                        course_name: u.course_name,
                        batch_name: u.batch_name,
                        sdate: u.start,
                        edate: u.end,
                        file: u.file,
                        students_count: u.students_count,
                        subs_count: u.subs_count,
                        sub_status: u.sub_status,
                        datetime: u.datetime,
                        updatetime: u.updatetime,
                        status: u.status,
                    }));
                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: cleanRows,
                        total,
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

    router.post("/add-assignment", async (req, res) => {
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,2"))) return;

            /* 2️⃣ Body */
            const {
                title,
                mem_id,
                course,
                course_name,
                batch,
                batch_name,
                tname,
                note,
                sdate,
                edate,
                file_key,
                file_name,
                file_type,
            } = req.body;

            /* ---------- VALIDATION ---------- */

            if (!mem_id || mem_id.length <= 2) {
                return res.json({ success: false, message: "Select trainer" });
            }

            if (!title || title.trim().length <= 2) {
                return res.json({ success: false, message: "Enter title" });
            }
            if (!course || course.length <= 2) {
                return res.json({ success: false, message: "Invalid course" });
            }
            if (!batch || batch.length <= 2) {
                return res.json({ success: false, message: "Invalid batch" });
            }

            const startx = new Date(sdate).getTime() / 1000;
            const endx = new Date(edate + " 23:59:59").getTime() / 1000;

            if (!startx || !endx || startx >= endx) {
                return res.json({ success: false, message: "Please select end date more than start date" });
            }

            if (!file_key) {
                return res.json({ success: false, message: "File missing" });
            }
            const newKey = "riviratech/assignments/" + file_key.split("/").pop();
            const nfile_key = await moveS3File(file_key, newKey);
            if (!nfile_key || nfile_key.length <= 0) {
                return res.json({ success: false, message: "File missing" });
            }

            /* ---------- INSERT ---------- */
            const req_id =
                "a" + crypto.createHash("md5").update(Date.now().toString()).digest("hex");

            const datetime = Math.floor(Date.now() / 1000);
            const insertSql = `
                    INSERT INTO assignments
                    (req_id, mem_id, course, batch, title, note, start, "end",
                    file, datetime, updatetime, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '1')
                    `;

            db.query(
                insertSql,
                [req_id,
                    mem_id,
                    course,
                    batch,
                    title,
                    note,
                    startx,
                    endx,
                    nfile_key,
                    datetime],
                async (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "New assignment added '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, req_id, "assignments", info, fromtxt, totxt);

                        const dataSql = `
                            SELECT *
                            FROM assignments WHERE req_id=?
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
                                    mem_id: u.mem_id,
                                    title: u.title,
                                    note: u.note,
                                    course: u.course,
                                    batch: u.batch,
                                    course_name: course_name,
                                    batch_name: batch_name,
                                    tname: tname,
                                    sdate: u.start,
                                    edate: u.end,
                                    file: u.file,
                                    students_count: 0,
                                    subs_count: 0,
                                    datetime: u.datetime,
                                    updatetime: u.updatetime,
                                    status: u.status,
                                }));
                                /* 8️⃣ Send Data */
                                return res.json({
                                    success: true,
                                    data: cleanRows[0],
                                    message: "Assignment details was successfully added"
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

    router.post("/update-assignment", async (req, res) => {
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,2"))) return;

            /* 2️⃣ Body */
            const {
                req_id,
                title,
                mem_id,
                course,
                course_name,
                batch,
                batch_name,
                tname,
                note,
                sdate,
                edate,
                file_key,
                file_name,
                file_type,
            } = req.body;

            /* ---------- VALIDATION ---------- */

            if (!mem_id || mem_id.length <= 2) {
                return res.json({ success: false, message: "Select trainer" });
            }

            if (!title || title.trim().length <= 2) {
                return res.json({ success: false, message: "Enter title" });
            }
            if (!course || course.length <= 2) {
                return res.json({ success: false, message: "Invalid course" });
            }
            if (!batch || batch.length <= 2) {
                return res.json({ success: false, message: "Invalid batch" });
            }

            const startx = new Date(sdate).getTime() / 1000;
            const endx = new Date(edate + " 23:59:59").getTime() / 1000;

            if (!startx || !endx || startx >= endx) {
                return res.json({ success: false, message: "Please select end date more than start date" });
            }

            // const oldKey = "assignments/tmp/1770730144288-enrollees_list.xlsx";
            //const newKey = "assignments/final/1770730144288-enrollees_list.xlsx";
            //const newFileUrl = await moveS3File(oldKey, newKey);
            //const newFileUrl = await deleteS3File(oldKey);

            if (!req_id || req_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Active */
            const sql = `
            SELECT * 
            FROM assignments 
            WHERE req_id = ?
            LIMIT 1
            `;

            db.query(sql, [req_id], async (err, rows) => {

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

                const dbreqId = rows[0].req_id;

                /* 4️⃣ Verify ID */
                if (md5(dbreqId) !== md5(req_id)) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                let nfile_key = rows[0].file;
                if (file_key) {
                    const newKey = "riviratech/assignments/" + file_key.split("/").pop();
                    nfile_key = await moveS3File(file_key, newKey);
                    if (!nfile_key || nfile_key.length <= 0) {
                        return res.json({ success: false, message: "File missing" });
                    } else {
                        if (rows[0].file.length >= 10) {
                            deleteS3File(rows[0].file);
                        }
                    }
                }

                /* ---------- INSERT ---------- */
                const updateSql = `
                    UPDATE assignments
                    SET
                        mem_id = ?,
                        course = ?,
                        batch = ?,
                        title = ?,
                        note = ?,
                        start = ?,
                        "end" = ?,
                        file = ?
                    WHERE req_id = ?
                    `;

                db.query(
                    updateSql,
                    [
                        mem_id,
                        course,
                        batch,
                        title,
                        note,
                        startx,
                        endx,
                        nfile_key,
                        req_id, // WHERE condition
                    ],
                    async (err2, result) => {

                        if (err2) {
                            console.error(err2);
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
                            });
                        }

                        if (result.affectedRows === 1) {

                            let info = "Assignment info updated '" + title.trim() + "'";
                            let fromtxt = "";
                            let totxt = "";
                            addactivity(ukey, req_id, "assignments", info, fromtxt, totxt);

                            const dataSql = `
                            SELECT *
                            FROM assignments WHERE req_id=?
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
                                        mem_id: u.mem_id,
                                        title: u.title,
                                        note: u.note,
                                        course: u.course,
                                        batch: u.batch,
                                        course_name: course_name,
                                        batch_name: batch_name,
                                        tname: tname,
                                        sdate: u.start,
                                        edate: u.end,
                                        file: u.file,
                                        students_count: 0,
                                        subs_count: 0,
                                        datetime: u.datetime,
                                        updatetime: u.updatetime,
                                        status: u.status,
                                    }));
                                    /* 8️⃣ Send Data */
                                    return res.json({
                                        success: true,
                                        data: cleanRows[0],
                                        message: "Assignment details was successfully updated"
                                    });

                                });

                        } else {
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
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

    router.post("/disable-assignment", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

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
            FROM assignments 
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
                    UPDATE assignments 
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

                        let info = "Assignment info disabled to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "assignments", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Assignment details was successfully disabled"
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

    router.post("/enable-assignment", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

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
                FROM assignments
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
                    UPDATE assignments
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

                        let info = "Assignment info enabled to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "assignments", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Assignment details was successfully enabled"
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

    router.post("/complete-assignment", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

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
                FROM assignments
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

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE assignments
                    SET status = '2'
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

                        let info = "Assignment info saved as completed to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "assignments", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Assignment details was successfully saved as completed"
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

    router.post("/delete-assignment", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

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
                FROM assignments
                WHERE req_id = ? AND status != '2'
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
                    UPDATE assignments
                    SET status = '1D'
                    WHERE req_id = ? AND status != '2'
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

                        let info = "Assignment deleted to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "assignments", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Assignment details was successfully deleted"
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

    router.post("/sub-assignments", async (req, res) => {

        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

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
            let where = "";
            let params = [];
            if (ustatus === "X" || ustatus === "2") {
                where = "WHERE req_id = ? AND (status='0' OR status='1' OR status='2')";
                params.push(`${id}`);
                if (search) {
                    where =
                        "WHERE req_id = ? AND (name ILIKE ? OR email ILIKE ? OR number ILIKE ? OR tnote ILIKE ? OR note ILIKE ?) AND (status='0' OR status='1' OR status='2')";
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                }
            } else if (ustatus === "1") {
                where = "WHERE req_id = ? AND mem_id = ? AND (status='0' OR status='1' OR status='2')";
                params.push(`${id}`);
                params.push(`${ukey}`);
                if (search) {
                    where =
                        "WHERE req_id = ? AND mem_id = ? AND (name ILIKE ? OR email ILIKE ? OR number ILIKE ? OR tnote ILIKE ? OR note ILIKE ?) AND (status='0' OR status='1' OR status='2')";
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                    params.push(`%${search}%`);
                }
            }

            /* 4️⃣ Pagination */
            const limit = 10;
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */

            let countSql = `
                SELECT COUNT(id) AS total
                FROM assignmentsubs
                ${where}`;
            if (search) {
                countSql = `
                SELECT COUNT(id) AS total
                FROM assignmentsubs cr 
                    LEFT JOIN members m
                        ON cr.mem_id = m.mem_id
                ${where.replaceAll("mem_id", "cr.mem_id").replaceAll("req_id", "cr.req_id").replaceAll("name", "m.name").replaceAll("email", "m.email").replaceAll("number", "m.number").replaceAll("tnote", "cr.tnote").replaceAll("note", "cr.note").replaceAll("status", "cr.status")}`;
            }

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
                let dataSql = `
                    SELECT 
                        cr.*, MAX(m.name) AS name,
                        MAX(m.email) AS email,
                        MAX(m.number) AS number
                    FROM assignmentsubs cr 
                    LEFT JOIN members m
                        ON cr.mem_id = m.mem_id

                    ${where.replaceAll("mem_id", "cr.mem_id").replaceAll("req_id", "cr.req_id").replaceAll("name", "m.name").replaceAll("email", "m.email").replaceAll("number", "m.number").replaceAll("tnote", "cr.tnote").replaceAll("note", "cr.note").replaceAll("status", "cr.status")}

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
                            total,
                            page,
                            lastPage,
                            message: "No data found"
                        });

                    }

                    const cleanRows = rows.map((u) => ({
                        id: u.id,
                        req_id: u.req_id,
                        mem_id: u.mem_id,
                        file: u.file,
                        note: u.note,
                        name: u.name,
                        email: u.email,
                        number: u.number,
                        reason: u.reason,
                        datetime: u.datetime,
                        updatetime: u.updatetime,
                        status: u.status,
                    }));
                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: cleanRows,
                        total,
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

    router.post("/reject-subassignment", async (req, res) => {

        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

        try {

            const { id, req_id, mem_id, reason} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 0 || !req_id || req_id.length <= 10 || !mem_id || mem_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Active */
            const sql = `
            SELECT * 
            FROM assignmentsubs 
            WHERE id = ? AND req_id = ? AND mem_id = ? AND status = '1'
            LIMIT 1
            `;

            db.query(sql, [id, req_id, mem_id], (err, rows) => {

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
                const dbreqId = rows[0].req_id;
                const dbmemId = rows[0].mem_id;

                /* 4️⃣ Verify ID */
                if (md5(dbId) !== md5(id) || md5(dbreqId) !== md5(req_id) || md5(dbmemId) !== md5(mem_id)) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                const datetime = Math.floor(new Date().getTime() / 1000)
                /* 5️⃣ Disable Batch */
                const updateSql = `
                    UPDATE assignmentsubs 
                    SET reason = ?, updatetime = ?, status = '0' 
                    WHERE id = ? AND req_id = ? AND mem_id = ? AND status = '1'
                    LIMIT 1
                `;

                db.query(updateSql, [reason, datetime, id, req_id, mem_id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Student assignment rejected";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "assignmentsubs", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            datetime: datetime,
                            message: "Assignment submission details was successfully rejected"
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

    router.post("/approve-subassignment", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

        try {

            const { id, req_id, mem_id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 0 || !req_id || req_id.length <= 10 || !mem_id || mem_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Active */
            const sql = `
            SELECT * 
            FROM assignmentsubs 
            WHERE id = ? AND req_id = ? AND mem_id = ? AND status = '1'
            LIMIT 1
            `;

            db.query(sql, [id, req_id, mem_id], (err, rows) => {

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
                const dbreqId = rows[0].req_id;
                const dbmemId = rows[0].mem_id;

                /* 4️⃣ Verify ID */
                if (md5(dbId) !== md5(id) || md5(dbreqId) !== md5(req_id) || md5(dbmemId) !== md5(mem_id)) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                const datetime = Math.floor(new Date().getTime() / 1000)

                /* 5️⃣ Disable Batch */
                const updateSql = `
                    UPDATE assignmentsubs 
                    SET status = '2', updatetime = ? 
                    WHERE id = ? AND req_id = ? AND mem_id = ? AND status = '1'
                    LIMIT 1
                `;

                db.query(updateSql, [datetime, id, req_id, mem_id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Student assignment approved";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "assignmentsubs", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            datetime: datetime,
                            message: "Assignment submission details was successfully approved"
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
// the category "admin/assignments" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "assignments" },
];
