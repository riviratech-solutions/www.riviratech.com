/**
 * API routes for src/pages/panel/student/Assignments.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, moveS3File } = ctx;

    router.post("/apply-assignment", async (req, res) => {
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "1"))) return;

            /* 2️⃣ Body */
            const {
                note,
                req_id,
                file_key,
                file_name,
                file_type,
            } = req.body;

            /* ---------- VALIDATION ---------- */
            if (!req_id || req_id.length <= 2) {
                return res.json({ success: false, message: "Select assignment" });
            }

            if (!file_key) {
                return res.json({ success: false, message: "File missing" });
            }
            const newKey = "riviratech/assignment/apply/" + file_key.split("/").pop();
            const nfile_key = await moveS3File(file_key, newKey);
            if (!nfile_key || nfile_key.length <= 0) {
                return res.json({ success: false, message: "File missing" });
            }

            /* ---------- INSERT ---------- */

            const datetime = Math.floor(Date.now() / 1000);
            const insertSql = `
                    INSERT INTO assignmentsubs
                    (req_id, mem_id, file, note,
                     datetime, reason, updatetime, status)
                    VALUES (?, ?, ?, ?, ?, '', '', '1')
                    `;

            db.query(
                insertSql,
                [req_id,
                    ukey,
                    nfile_key,
                    note,
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

                        let where = "WHERE req_id = ? AND mem_id = ? AND (status='0' OR status='1' OR status='2')";

                        let dataSql = `
                    SELECT 
                        cr.*, MAX(m.name) AS name,
                        MAX(m.email) AS email,
                        MAX(m.number) AS number
                    FROM assignmentsubs cr 
                    LEFT JOIN members m
                        ON cr.mem_id = m.mem_id
                    ${where.replaceAll("mem_id", "cr.mem_id").replaceAll("req_id", "cr.req_id").replaceAll("status", "cr.status")}
                    GROUP BY cr.id
                    ORDER BY cr.id DESC
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

    router.post("/check-assignment", async (req, res) => {
        try {
            const { key: ukey} = req.cookies;
            /* Auth Check */
            if (!(await verifyAccount(req, res, "1"))) return;

            const { req_id } = req.body;

            if (!req_id || req_id.length <= 2) {
                return res.json({ success: false, message: "Select assignment" });
            }

            let where = "WHERE req_id = ? AND mem_id = ? AND (status='0' OR status='1' OR status='2')";

            let dataSql = `
                    SELECT 
                        cr.*, MAX(m.name) AS name,
                        MAX(m.email) AS email,
                        MAX(m.number) AS number
                    FROM assignmentsubs cr 
                    LEFT JOIN members m
                        ON cr.mem_id = m.mem_id
                    ${where.replaceAll("mem_id", "cr.mem_id").replaceAll("req_id", "cr.req_id").replaceAll("status", "cr.status")}
                    GROUP BY cr.id
                    ORDER BY cr.id DESC
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
                            message: "not applied"
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
                    let msg = "pending";
                    let status = rows[0].status;
                    if (status === "2") {
                        msg = "approved";
                    }
                    if (status === "0") {
                        msg = "rejected";
                    }
                    return res.json({
                        success: true,
                        data: cleanRows,
                        message: msg
                    });

                });

        } catch (err) {

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "student/assignments" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "assignmentsubs" },
];
