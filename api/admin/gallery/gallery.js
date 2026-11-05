/**
 * API routes for src/pages/panel/admin/Gallery.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, md5, verifyAccount, moveS3File, deleteS3File, addactivity } = ctx;

    router.post("/galleryimgs", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { s, n } = req.body;

            /* 1️⃣ Params */

            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort */

            let orderBy = "sorting ASC, id DESC";

            if (sortby === "Old") {
                orderBy = "sorting DESC, id ASC";
            }

            /* 3️⃣ Search */

            /* Full-table stats for the cards above the table (whole table, not this page) */
            let stats = null;
            try {
                const [statsRows] = await db.promise().query(
                    `SELECT
                     COUNT(id) AS total,
                     COUNT(CASE WHEN type = 'video' THEN 1 END) AS videos,
                     COUNT(CASE WHEN type IS NULL OR type <> 'video' THEN 1 END) AS images,
                     COUNT(CASE WHEN status = '1' THEN 1 END) AS active
                     FROM gallaryimgs
                     WHERE status IN ('1','1S','1D')`,
                    []
                );
                if (statsRows && statsRows[0]) {
                    const r = statsRows[0];
                    stats = { 
                total:  Number(r.total || 0),
                videos: Number(r.videos || 0),
                images: Number(r.images || 0),
                active: Number(r.active || 0),
             };
                }
            } catch (statErr) {
                console.error("gallery stats error:", statErr);
            }

            let where = "WHERE (status='1' OR status='1S' OR status='1D')";
            let params = [];

            /* 4️⃣ Pagination */

            const limit = 12;
            const offset = (page - 1) * limit;

            /* 5️⃣ Count */

            const countSql = `
            SELECT COUNT(id) AS total
            FROM gallaryimgs
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
                FROM gallaryimgs
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
                        req_id: u.req_id,
                        title: u.title,
                        img: u.img,
                        type: u.type || "image",
                        datetime: u.datetime,
                        status: u.status
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

    router.post("/add-galleryimg", async (req, res) => {

        try {

            const { key: ukey} = req.cookies;

            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* 2️⃣ Body */
            const title = String(req.body.title || "").trim();
            const file_key = String(req.body.file_key || req.body.img || req.body.key || "").trim();
            const file_type = String(req.body.file_type || req.body.type || "");

            // image vs video (from the uploaded file's MIME type or extension)
            const isVideo = file_type.startsWith("video") || /\.(mp4|mov|avi|mkv|webm)$/i.test(file_key);
            const mediaType = isVideo ? "video" : "image";

            /* 3️⃣ Session Tokens */

            /* ---------- VALIDATION ---------- */

            if (!title || title.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Enter title"
                });
            }

            if (!file_key) {
                return res.json({
                    success: false,
                    message: "Image missing"
                });
            }

            /* ---------- MOVE IMAGE ---------- */

            const newKey = "riviratech/gallery/" + file_key.split("/").pop();

            const img_key = await moveS3File(file_key, newKey);

            if (!img_key) {
                return res.json({
                    success: false,
                    message: "Image upload failed"
                });
            }

            /* ---------- INSERT ---------- */

            const req_id =
                "g" + crypto.createHash("md5")
                    .update(Date.now().toString())
                    .digest("hex");

            const datetime = Math.floor(Date.now() / 1000);

            const insertSql = `
            INSERT INTO gallaryimgs
            (req_id, title, img, type, datetime, status)
            VALUES (?, ?, ?, ?, ?, '1')
            `;

            db.query(
                insertSql,
                [req_id, title, img_key, mediaType, datetime],
                (err, result) => {

                    if (err) {
                        console.error(err);
                        return res.json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "New gallery image added '" + title.trim() + "'";
                        addactivity(ukey, req_id, "gallaryimgs", info, "", "");

                        const data = {
                            req_id,
                            title,
                            img: img_key,
                            type: mediaType,
                            datetime,
                            status: "1"
                        };

                        return res.json({
                            success: true,
                            data,
                            message: "Gallery image successfully added"
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

    router.post("/update-galleryimg", async (req, res) => {
        try {

            /* 1️⃣ Cookies */
            const { key: ukey} = req.cookies;

            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* 2️⃣ Body */
            const title = String(req.body.title || "").trim();
            const req_id = String(req.body.req_id || req.body.id || "").trim();
            const file_key = String(req.body.file_key || req.body.img || req.body.key || "").trim();

            /* ---------- VALIDATION ---------- */

            if (!title || title.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Enter title"
                });
            }

            if (!req_id || req_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "Invalid gallery image"
                });
            }

            /* ---------- CHECK IMAGE EXISTS ---------- */

            const sql = `
            SELECT *
            FROM gallaryimgs
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
                        message: "Invalid gallery image"
                    });
                }

                const dbreqId = rows[0].req_id;

                if (md5(dbreqId) !== md5(req_id)) {
                    return res.json({
                        success: false,
                        message: "Invalid gallery image"
                    });
                }

                /* ---------- HANDLE IMAGE UPDATE ---------- */

                let nfile_key = rows[0].img;

                if (file_key) {

                    const newKey =
                        "riviratech/gallery/" + file_key.split("/").pop();

                    nfile_key = await moveS3File(file_key, newKey);

                    if (!nfile_key) {
                        return res.json({
                            success: false,
                            message: "Image upload failed"
                        });
                    }

                    if (rows[0].img && rows[0].img.length >= 10) {
                        deleteS3File(rows[0].img);
                    }

                }

                /* ---------- UPDATE ---------- */

                const updateSql = `
                UPDATE gallaryimgs
                SET
                    title = ?,
                    img = ?
                WHERE req_id = ?
               `;

                db.query(
                    updateSql,
                    [title, nfile_key, req_id],
                    (err2, result) => {

                        if (err2) {
                            console.error(err2);
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
                            });
                        }

                        if (result.affectedRows === 1) {

                            let info =
                                "Gallery image updated '" + title.trim() + "'";

                            addactivity(
                                ukey,
                                req_id,
                                "gallaryimgs",
                                info,
                                "",
                                ""
                            );

                            const data = {
                                req_id,
                                title,
                                img: nfile_key
                            };

                            return res.json({
                                success: true,
                                data,
                                message:
                                    "Gallery image successfully updated"
                            });

                        } else {

                            return res.json({
                                success: false,
                                message:
                                    "Something went wrong, try again"
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

    router.post("/disable-galleryimg", async (req, res) => {

        const { key: ukey} = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* Check Image Exists */

            const sql = `
            SELECT *
            FROM gallaryimgs
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

                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* Disable Image */

                const updateSql = `
                UPDATE gallaryimgs
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

                        let info = "Gallery image disabled '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";

                        addactivity(ukey, id, "gallaryimgs", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Gallery image successfully disabled"
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

    router.post("/enable-galleryimg", async (req, res) => {

        const { key: ukey} = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* Check Image Exists & Disabled */

            const sql = `
            SELECT *
            FROM gallaryimgs
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

                /* Verify ID */

                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* Enable Image */

                const updateSql = `
                UPDATE gallaryimgs
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

                        let info = "Gallery image enabled '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";

                        addactivity(ukey, id, "gallaryimgs", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Gallery image successfully enabled"
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

    router.post("/delete-galleryimg", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut, id: ustatus } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* Check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* Check Image Exists */

            const sql = `
            SELECT *
            FROM gallaryimgs
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
                const img = rows[0].img;

                /* Verify ID */

                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* Soft Delete Image */

                const updateSql = `
                DELETE FROM gallaryimgs WHERE req_id = ? AND (status = '1' OR status = '1S')
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

                        let info = "Gallery image deleted '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";

                        addactivity(ukey, id, "gallaryimgs", info, fromtxt, totxt);

                        if (img && img.length >= 10) {
                            deleteS3File(img);
                        }

                        return res.json({
                            success: true,
                            message: "Gallery image successfully deleted"
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

    router.post("/update-gallery-order", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { items } = req.body;

            if (!items || !Array.isArray(items)) {
                return res.json({
                    success: false,
                    message: "Invalid items"
                });
            }

            /* Update order */

            const promises = items.map(item => {

                return new Promise((resolve, reject) => {

                    db.query(
                        "UPDATE gallaryimgs SET sorting=? WHERE req_id=?",
                        [item.order, item.req_id],
                        (err, result) => {

                            if (err) {
                                console.error(err);
                                return reject(err);
                            }

                            resolve(result);

                        }
                    );

                });

            });

            await Promise.all(promises);

            return res.json({
                success: true,
                message: "Gallery order updated"
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
// the category "admin/gallery" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "gallaryimgs" },
];
