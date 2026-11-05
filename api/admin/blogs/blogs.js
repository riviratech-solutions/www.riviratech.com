/**
 * API routes for src/pages/panel/admin/Blogs.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, md5, verifyAccount, moveS3File, deleteS3File, addactivity } = ctx;

    router.post("/blogs", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { q, s, n } = req.body;

            /* 1️⃣ Query Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort */
            let orderBy = "id DESC";

            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Search */

            let where = "WHERE status='1' OR status='1S' OR status='1D'";
            let params = [];

            if (search) {
                where = "WHERE (title ILIKE ?) AND (status='1' OR status='1S' OR status='1D')";
                params.push(`%${search}%`);
            }

            /* 4️⃣ Pagination */

            const limit = 10;
            const offset = (page - 1) * limit;

            /* 5️⃣ Count */

            const countSql = `
            SELECT COUNT(id) AS total
            FROM blogs
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
                FROM blogs
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
                            message: "No data found"
                        });
                    }

                    return res.json({
                        success: true,
                        data: rows,
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

    router.post("/add-blog", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut, id: ustatus } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            /* 1️⃣ Get Data */
            const { title, html, css, thumbnail, category_id, slug: rawSlug } = req.body;

            /* 2️⃣ Validation */
            if (!title || title.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter blog title"
                });
            }

            if (!html || html.trim().length <= 5) {
                return res.json({
                    success: false,
                    message: "Blog HTML content required"
                });
            }

            /* Normalise slug — auto-generate from title if blank */
            const toSlug = (s) => s.toLowerCase().trim()
                .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const blogSlug = (rawSlug && rawSlug.trim())
                ? toSlug(rawSlug.trim())
                : toSlug(title.trim());

            /* Thumbnail: move a freshly-uploaded temp file into the blogs/ folder */
            let thumbKey = "";
            if (thumbnail && thumbnail.startsWith("riviratech/temp/")) {
                const newKey = "riviratech/blogs/" + thumbnail.split("/").pop();
                thumbKey = (await moveS3File(thumbnail, newKey)) || "";
            } else if (thumbnail && thumbnail.startsWith("riviratech/blogs/")) {
                thumbKey = thumbnail;
            }

            /* 3️⃣ Check Duplicate title + slug */

            const checkSql = `
            SELECT id
            FROM blogs
            WHERE LOWER(title) = LOWER(?)
            LIMIT 1
        `;

            db.query(checkSql, [title.trim()], (err, rows) => {

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
                        message: "Title already exists.. try another"
                    });
                }

                /* Check slug uniqueness */
                db.query(
                    "SELECT id FROM blogs WHERE slug = ? LIMIT 1",
                    [blogSlug],
                    (slugErr, slugRows) => {
                        if (slugErr) return res.json({ success: false, message: "Database error" });
                        if (slugRows.length > 0) {
                            return res.json({
                                success: false,
                                message: "Page link (slug) already exists — choose a different one"
                            });
                        }

                /* 4️⃣ Generate Blog ID */

                const datetime = Math.floor(Date.now() / 1000);

                const random = crypto
                    .randomBytes(32)
                    .toString("hex");

                const req_id = "b" + md5(random + Date.now());

                /* 5️⃣ Insert */

                const insertSql = `
                INSERT INTO blogs (req_id, title, html, css, thumbnail, datetime, status, category_id, slug)
                VALUES (?, ?, ?, ?, ?, ?, '1', ?, ?)
            `;

                db.query(
                    insertSql,
                    [req_id, title.trim(), html, css || "", thumbKey, datetime, category_id || null, blogSlug],
                    (err2, result) => {

                        if (err2) {
                            console.error(err2);
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again"
                            });
                        }

                        if (result.affectedRows === 1) {

                            let info = "New blog added '" + title.trim() + "'";
                            let fromtxt = "";
                            let totxt = "";

                            addactivity(ukey, req_id, "blogs", info, fromtxt, totxt);

                            /* Fetch Inserted Row */

                            const selectSql = `
                            SELECT * FROM blogs
                            WHERE req_id = ?
                            LIMIT 1
                            `;

                            db.query(selectSql, [req_id], (err3, rows) => {

                                if (err3) {
                                    console.error(err3);
                                    return res.json({
                                        success: false,
                                        message: "Inserted but fetch failed"
                                    });
                                }

                                return res.json({
                                    success: true,
                                    data: rows[0],
                                    message: "Blog successfully created"
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

                    } // end slug-unique check
                ); // end slug db.query

            }); // end title duplicate check

        } catch (err) {

            console.error(err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    router.post("/update-blog", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            /* Get Data */
            const { req_id, title, html, css, thumbnail, category_id, slug: rawSlug } = req.body;

            /* Validate Blog ID */
            if (!req_id || req_id.length <= 10) {
                return res.json({
                    success: false,
                    message: "Invalid blog ID"
                });
            }

            /* Validate Title */
            if (!title || title.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter blog title"
                });
            }

            if (!html || html.trim().length <= 5) {
                return res.json({
                    success: false,
                    message: "Blog HTML content required"
                });
            }

            /* Normalise slug */
            const toSlugU = (s) => s.toLowerCase().trim()
                .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const blogSlug = (rawSlug && rawSlug.trim())
                ? toSlugU(rawSlug.trim())
                : toSlugU(title.trim());

            /* Duplicate title check (case-insensitive), excluding this blog (audit BE-12) */
            const [dups] = await db.promise().query(
                "SELECT id FROM blogs WHERE LOWER(title) = LOWER(?) AND req_id != ? LIMIT 1",
                [title.trim(), req_id]
            );
            if (dups.length > 0) {
                return res.json({
                    success: false,
                    message: "Title already exists.. try another"
                });
            }

            /* Duplicate slug check, excluding self */
            const [slugDups] = await db.promise().query(
                "SELECT id FROM blogs WHERE slug = ? AND req_id != ? LIMIT 1",
                [blogSlug, req_id]
            );
            if (slugDups.length > 0) {
                return res.json({
                    success: false,
                    message: "Page link (slug) already exists — choose a different one"
                });
            }

            /* Current thumbnail — so a replaced image can be cleaned up from S3
               instead of being orphaned forever (audit BE-08). */
            const [existingRows] = await db.promise().query(
                "SELECT thumbnail FROM blogs WHERE req_id = ? LIMIT 1",
                [req_id]
            );
            const oldThumb = (existingRows[0] && existingRows[0].thumbnail) || "";

            /* Thumbnail: move a freshly-uploaded temp file into blogs/, otherwise
               keep whatever key was passed (existing image or empty). */
            let thumbKey = thumbnail || "";
            if (thumbKey.startsWith("riviratech/temp/")) {
                const newKey = "riviratech/blogs/" + thumbKey.split("/").pop();
                thumbKey = (await moveS3File(thumbKey, newKey)) || "";
            }

            /* Update Blog */

            const updateSql = `
            UPDATE blogs
            SET title = ?, html = ?, css = ?, thumbnail = ?, category_id = ?, slug = ?
            WHERE req_id = ?
            LIMIT 1
            `;

            db.query(updateSql, [title.trim(), html, css || "", thumbKey, category_id || null, blogSlug, req_id], (err, result) => {

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
                        message: "No blog found or no change made"
                    });
                }

                /* If the thumbnail was replaced, delete the previous S3 object so
                   it doesn't leak (audit BE-08). Fire-and-forget; failure to
                   clean up must not fail the update response. */
                if (oldThumb && oldThumb.startsWith("riviratech/blogs/") && oldThumb !== thumbKey) {
                    deleteS3File(oldThumb).catch((e) =>
                        console.error("Old thumbnail cleanup failed:", e && e.message)
                    );
                }

                /* Activity Log */

                let info = "Blog updated '" + title.trim() + "'";
                let fromtxt = "";
                let totxt = "";

                addactivity(ukey, req_id, "blogs", info, fromtxt, totxt);

                /* Fetch Updated Row */

                const selectSql = `
                SELECT *
                FROM blogs
                WHERE req_id = ?
                LIMIT 1
                 `;

                db.query(selectSql, [req_id], (err2, rows) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "Updated but fetch failed"
                        });
                    }

                    return res.json({
                        success: true,
                        data: rows[0],
                        message: "Blog successfully updated"
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

    router.post("/disable-blog", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* Validate ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* Check Blog Exists */

            const sql = `
            SELECT req_id, title
            FROM blogs
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

                /* Verify ID */

                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* Disable Blog */

                const updateSql = `
                UPDATE blogs
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

                        let info = "Blog disabled '" + title + "'";
                        let fromtxt = "";
                        let totxt = "";

                        addactivity(ukey, id, "blogs", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Blog successfully disabled"
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

    router.post("/enable-blog", async (req, res) => {

        const { key: ukey, token: utoken, aut: uaut } = req.cookies;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id } = req.body;

            /* Validate ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* Check Blog Exists & Disabled */

            const sql = `
            SELECT req_id, title
            FROM blogs
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

                /* Enable Blog */

                const updateSql = `
                UPDATE blogs
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

                        let info = "Blog enabled '" + title + "'";
                        let fromtxt = "";
                        let totxt = "";

                        addactivity(ukey, id, "blogs", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Blog successfully enabled"
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

    router.post("/delete-blog", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id } = req.body;
            if (!id || String(id).trim().length <= 2) {
                return res.json({ success: false, message: "Invalid blog ID" });
            }

            const cleanId = String(id).trim();
            const isNumericId = /^\d+$/.test(cleanId);

            const [rows] = await db.promise().query(
                isNumericId
                    ? "SELECT req_id, title, thumbnail FROM blogs WHERE id = ? OR req_id = ? LIMIT 1"
                    : "SELECT req_id, title, thumbnail FROM blogs WHERE req_id = ? LIMIT 1",
                isNumericId ? [parseInt(cleanId, 10), cleanId] : [cleanId]
            );

            if (!rows.length) {
                return res.json({ success: false, message: "Blog not found or already deleted" });
            }

            const blog = rows[0];
            const blogId = blog.req_id;
            const blogTitle = blog.title || "";

            await db.promise().query(
                "DELETE FROM blogs WHERE req_id = ?",
                [blogId]
            );

            if (blog.thumbnail && blog.thumbnail.startsWith("riviratech/blogs/")) {
                deleteS3File(blog.thumbnail).catch((e) =>
                    console.error("Blog thumbnail deletion failed:", e && e.message)
                );
            }

            addactivity(ukey, blogId, "blogs", "Blog deleted '" + blogTitle + "'", "", "");

            return res.json({
                success: true,
                message: "Blog successfully deleted"
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
// the category "admin/blogs" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "blogs" },
];
