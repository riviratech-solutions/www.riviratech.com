/**
 * API routes for src/pages/panel/admin/Blogimgs.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, moveS3File, deleteS3File, addactivity } = ctx;

    router.post("/blogimgs", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut, id: ustatus } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { s, n } = req.body;

            /* 1️⃣ Params */

            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            const q = req.body.q ? String(req.body.q).trim() : "";

            /* 2️⃣ Sort */

            let orderBy = "id DESC";

            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Search */
            /* Full-table stats for the cards above the table (whole table, not this page) */
            let stats = null;
            try {
                const [statsRows] = await db.promise().query(
                    `SELECT
                     COUNT(id) AS total,
                     COUNT(CASE WHEN file IS NOT NULL AND file <> '' THEN 1 END) AS files
                     FROM blogimgs`,
                    []
                );
                if (statsRows && statsRows[0]) {
                    const r = statsRows[0];
                    stats = { 
                total: Number(r.total || 0),
                files: Number(r.files || 0),
             };
                }
            } catch (statErr) {
                console.error("blogimgs stats error:", statErr);
            }

            let where = "";
            let params = [];
            if (q) {
                where = "WHERE file ILIKE ?";
                params.push(`%${q}%`);
            }

            /* 4️⃣ Pagination */

            const limit = 12;
            const offset = (page - 1) * limit;

            /* 5️⃣ Count */

            const countSql = `
            SELECT COUNT(id) AS total
            FROM blogimgs
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

                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */

                const dataSql = `
                SELECT *
                FROM blogimgs
                ${where}
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
                        file: u.file,
                    }));

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

    router.post("/add-blogimg", async (req, res) => {

        try {

            /* 1️⃣ Cookies */
            const { key: ukey, token: utoken, aut: uaut } = req.cookies;

            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* 2️⃣ Body */
            const {
                file_key
            } = req.body;

            if (!file_key) {
                return res.json({
                    success: false,
                    message: "Image missing"
                });
            }

            /* ---------- MOVE IMAGE ---------- */

            const newKey = "riviratech/blogs/" + file_key.split("/").pop();

            const img_key = await moveS3File(file_key, newKey);

            if (!img_key) {
                return res.json({
                    success: false,
                    message: "Image upload failed"
                });
            }

            /* ---------- INSERT ---------- */
            const insertSql = `
            INSERT INTO blogimgs
            (file)
            VALUES (?)
            `;

            db.query(
                insertSql,
                [img_key],
                (err, result) => {

                    if (err) {
                        console.error(err);
                        return res.json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (result.affectedRows === 1) {

                        const id = result.insertId; // ⭐ inserted ID

                        let info = "New blog image added";
                        addactivity(ukey, id + "", "blogimgs", info, "", "");

                        const data = {
                            id,
                            file: img_key,
                        };

                        return res.json({
                            success: true,
                            data,
                            message: "Blog image successfully added"
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

    router.post("/add-blogimgs", async (req, res) => {

        try {

            const { key: ukey, token: utoken, aut: uaut } = req.cookies;

            if (!(await verifyAccount(req, res, "X,Y"))) return;

            const {
                file_keys
            } = req.body;

            if (!Array.isArray(file_keys) || file_keys.length === 0) {
                return res.json({
                    success: false,
                    message: "Images missing"
                });
            }

            const inserted = [];

            for (let file_key of file_keys) {

                const newKey = "riviratech/blogs/" + file_key.split("/").pop();

                const img_key = await moveS3File(file_key, newKey);

                if (!img_key) continue;

                const sql = "INSERT INTO blogimgs (file) VALUES (?)";

                const result = await new Promise((resolve, reject) => {

                    db.query(sql, [img_key], (err, r) => {

                        if (err) reject(err);
                        else resolve(r);

                    });

                });

                const id = result.insertId;

                inserted.push({
                    id,
                    file: img_key
                });

            }

            let message = "Image successfully uploaded";
            if (file_keys.length === 1) {
                addactivity(ukey, "", "blogimgs", "New blog image added", "", "");
            } else {
                addactivity(ukey, "", "blogimgs", "New blog images added", "", "");
                message = "Images successfully uploaded";
            }

            return res.json({
                success: true,
                data: inserted,
                message
            });

        } catch (err) {

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    /* ================================================================
       END BLOG CATEGORIES
    ================================================================ */

    router.post("/delete-blogimg", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut, id: ustatus } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* Check ID */
            if (!id || id.length <= 0) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* Check Image Exists */

            const sql = `
                SELECT *
                FROM blogimgs
                WHERE id = ? 
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
                const img = rows[0].file;

                /* Verify ID */

                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* Soft Delete Image */

                const updateSql = `
                DELETE FROM blogimgs WHERE id = ?
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

                        let info = "Blog image deleted";
                        let fromtxt = "";
                        let totxt = "";

                        addactivity(ukey, id, "blogimgs", info, fromtxt, totxt);

                        if (img && img.length >= 10) {
                            deleteS3File(img);
                        }

                        return res.json({
                            success: true,
                            message: "Blog image successfully deleted"
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
// the category "admin/blogimgs" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "blogimgs" },
];
