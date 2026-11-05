/**
 * API routes for src/pages/panel/admin/Students.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, dateRangeFilter, verifyAccount, addactivity } = ctx;
    const { checkSecurityToken } = require("../../security/backup-token");

    /* student start */
    router.post("/students", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

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

            /* 2️⃣.5 Full-table stats */
            let stats = null;
            try {
                const s7 = String(Math.floor(Date.now() / 1000) - 7 * 86400);
                const [statsRows] = await db.promise().query(
                    `SELECT
                        COUNT(id)                                          AS total,
                        COUNT(CASE WHEN status = '1'  THEN 1 END)         AS active,
                        COUNT(CASE WHEN status = '1S' OR status = '1D' THEN 1 END) AS disabled,
                        COUNT(CASE WHEN datetime >= ? THEN 1 END)         AS recent
                     FROM members
                     WHERE status = '1' OR status = '1S' OR status = '1D'`,
                    [s7]
                );
                if (statsRows && statsRows[0]) {
                    stats = {
                        total:    Number(statsRows[0].total    || 0),
                        active:   Number(statsRows[0].active   || 0),
                        disabled: Number(statsRows[0].disabled || 0),
                        recent:   Number(statsRows[0].recent   || 0),
                    };
                }
            } catch (statErr) {
                console.error("students stats error:", statErr);
            }

            /* 3️⃣ Search Filter */
            let where = "WHERE (status='1' OR status='1D' OR status='1S')";
            let params = [];

            if (search) {
                where =
                    "WHERE (name ILIKE ? OR email ILIKE ? OR number ILIKE ? OR address ILIKE ? OR qualification ILIKE ?) AND (status='1' OR status='1D' OR status='1S')";
                params.push(`%${search}%`);
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
            const offset = (page - 1) * limit;

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(id) AS total
                FROM members
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

                /* 6️⃣ Fetch Data
                   DISTINCT ON (m.id) collapses the member_courses LEFT JOIN to
                   one row per member, so a student enrolled in N courses no
                   longer appears N times and consumes N of the LIMIT slots —
                   keeping the row count aligned with the members-based total
                   (audit BE-09). ORDER BY already leads with m.id, as DISTINCT ON
                   requires. */
                const dataSql = `
                        SELECT DISTINCT ON (m.id)
                            m.*,
                            mc.c_id,
                            mc.b_id,
                            mc.expires
                        FROM members m
                        LEFT JOIN member_courses mc
                            ON mc.mem_id = m.mem_id
                        ${where.replaceAll("name", "m.name").replaceAll("email", "m.email").replaceAll("qualification", "m.qualification").replaceAll("address", "m.address").replaceAll("status", "m.status")} ${dr.clause("m.datetime")}
                        ORDER BY ${orderBy.replaceAll("id", "m.id")}
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

                    const cleanRowsx = rows.map((u) => (
                        {
                            id: u.id,
                            mem_id: u.mem_id,
                            bid: u.b_id,
                            name: u.name,
                            gender: u.gender,
                            email: u.email,
                            number: u.number,
                            qualification: u.qualification,
                            address: u.address,
                            city: u.city,
                            pincode: u.pincode,
                            state: u.state,
                            cid: u.c_id,
                            profile: u.profile,
                            datetime: u.datetime,
                            expires: u.expires,
                            lastdatetime: u.lastdatetime,
                            status: u.status,
                        }));

                    /*
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
                            expires: u.expires,
                            lastdatetime: u.lastdatetime,
                            status: u.status,

                            courses: [],
                        });
                    }

                    // Push course if exists
                    if (u.c_id && u.b_id) {
                        map.get(u.mem_id).courses.push({
                            c_id: u.c_id,
                            b_id: u.b_id,
                            expires: u.expires,
                        });
                    }

                });

                const cleanRows = Array.from(map.values());
                */

                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: cleanRowsx,
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

    router.post("/update-student", async (req, res) => {
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
                qualification,
                cid: course,
                bid: batch,
                expires
            } = req.body;

            /* 3️⃣ Session Tokens */

            /* 5️⃣ Validations */
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

            if (!batch || batch.length <= 2) {
                return res.json({
                    success: false,
                    message: "Please select preferred batch"
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
                            qualification = ?,
                            expires = ?
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
                            qualification.trim(),
                            expires,
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




                                let info = "Student info Updated '" + email.trim() + "'";
                                let fromtxt = "";
                                let totxt = "";
                                addactivity(ukey, mem_id, "members", info, fromtxt, totxt);

                                // 🔁 Keep member_courses in sync with the student's
                                // single course/batch: update the existing row, or
                                // insert it when none exists yet.
                                const mcDatetime = Math.floor(Date.now() / 1000);

                                const sendUpdated = () => {

                                    /* 6️⃣ Fetch Data */
                                    const dataSql = `
                                    SELECT *
                                    FROM members WHERE
                                    mem_id = ?
                                    LIMIT 1
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

                                        const cleanRows = rows.map((u) => ({
                                            id: u.id,
                                            mem_id: u.mem_id,
                                            name: u.name,
                                            gender: u.gender,
                                            email: u.email,
                                            number: u.number,
                                            qualification: u.qualification,
                                            cid: course,
                                            bid: batch,
                                            profile: u.profile,
                                            datetime: u.datetime,
                                            expires: u.expires,
                                            lastdatetime: u.lastdatetime,
                                            status: u.status,
                                        }));

                                        /* 8️⃣ Send Data */
                                        return res.json({
                                            success: true,
                                            data: cleanRows,
                                            message: `${name} details was successfully updated`
                                        });

                                    });

                                }; // end sendUpdated


                               // Upsert the student's course row in member_courses.
                                db.query(
                                    `SELECT id FROM member_courses WHERE mem_id=? LIMIT 1`,
                                    [mem_id],
                                    (errmc, mcrows) => {
                                        if (errmc) { console.error(errmc); return sendUpdated(); }

                                        if (mcrows && mcrows.length > 0) {
                                            // Exists → update batch / expiry, keep it active.
                                            db.query(
                                                `UPDATE member_courses SET c_id=?, b_id=?, expires=?, status='1' WHERE mem_id=?`,
                                                [course, batch, expires, mem_id],
                                                (erru) => { if (erru) console.error(erru); sendUpdated(); }
                                            );
                                        } else {
                                            // Not exists → insert it.
                                            db.query(
                                                `INSERT INTO member_courses (mem_id, c_id, b_id, expires, datetime, status) VALUES (?, ?, ?, ?, ?, ?)`,
                                                [mem_id, course, batch, expires, mcDatetime, "1"],
                                                (erri) => { if (erri) console.error(erri); sendUpdated(); }
                                            );
                                        }
                                    }
                                );


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

    router.post("/disable-student", async (req, res) => {

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
            WHERE mem_id = ? AND status = '1'
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
                    SET status = '1S' 
                    WHERE mem_id = ? AND status = '1'
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

                        let info = "Student info disabled '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "members", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Student details was successfully disabled"
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

    router.post("/enable-student", async (req, res) => {

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
                WHERE mem_id = ? AND status = '1S'
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
                    SET status = '1'
                    WHERE mem_id = ? AND status = '1S'
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

                        let info = "Student info enabled '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "members", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Student details was successfully enabled"
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

    router.post("/delete-student", async (req, res) => {

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
                WHERE mem_id = ? AND (status = '1' OR status = '1S')
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
                    WHERE mem_id = ? AND (status = '1' OR status = '1S')
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

                        let info = "Student info deleted '" + name.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "members", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Student details was successfully deleted"
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

    /* Delete a student account for good. Only a student already deleted
       (status 1D), and only with the security token (BACKUP_SECURITY_TOKEN in
       .env). Removes the account, its course enrolments and its sign-in data;
       records such as payments, certificates and activity stay as history.
       The members / member_courses rows are copied to deleted_records. */
    router.post("/purge-student", async (req, res) => {

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

            const rows = await q("SELECT id, mem_id, name FROM members WHERE mem_id = ? AND status = '1D' LIMIT 1", [id]);
            if (rows.length !== 1 || rows[0].mem_id !== id) {
                return res.json({ success: false, message: "Only a deleted student can be deleted permanently." });
            }

            const result = await q("DELETE FROM members WHERE mem_id = ? AND status = '1D'", [id]);
            if (!result || result.affectedRows !== 1) {
                return res.json({ success: false, message: "There was something wrong, Please try again" });
            }

            // the account's own data (login_sessions keys on members.id)
            const cleanup = [
                ["DELETE FROM member_courses WHERE mem_id = ?", [id]],
                ["DELETE FROM login_sessions WHERE mem_id::text = ?", [String(rows[0].id)]],
                ["DELETE FROM otps WHERE mem_id = ?", [id]],
            ];
            for (const [sql, p] of cleanup) {
                await q(sql, p).catch((e) => console.error("purge-student cleanup:", e.message));
            }

            addactivity(ukey, id, "students", "Student '" + String(rows[0].name || "").trim() + "' deleted permanently", "", "");
            return res.json({ success: true, message: "Student deleted permanently" });

        } catch (err) {
            console.error(err);
            return res.json({ success: false, message: "Server error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/students" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "members", when: "left(OLD.status, 1) = '1'" },
    { table: "member_courses" },
];

