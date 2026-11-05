/**
 * API routes for src/pages/panel/admin/YouTube.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, nextSortNo, applyReorder } = ctx;

    /* ---- YouTube videos (admin) ---- */
    router.post("/youtube-list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(
                `SELECT * FROM youtube_videos WHERE status != '1D' ORDER BY sortno ASC, id ASC`
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Failed to load videos" });
        }
    });

    router.post("/youtube-add", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { title, url } = req.body;
            if (!url || url.trim().length < 8)
                return res.json({ success: false, message: "Please enter a YouTube URL" });

            const datetime = Math.floor(Date.now() / 1000);
            const sortno = await nextSortNo("youtube_videos");
            const [r] = await db.promise().query(
                `INSERT INTO youtube_videos (title, url, sortno, datetime, status) VALUES (?, ?, ?, ?, '1')`,
                [title || "", url.trim(), sortno, datetime]
            );
            const [rows] = await db.promise().query(`SELECT * FROM youtube_videos WHERE id = ?`, [r.insertId]);
            res.json({ success: true, data: rows[0], message: "Video added" });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/youtube-update", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id, title, url } = req.body;
            if (!id) return res.json({ success: false, message: "Invalid id" });
            if (!url || url.trim().length < 8)
                return res.json({ success: false, message: "Please enter a YouTube URL" });

            await db.promise().query(
                `UPDATE youtube_videos SET title = ?, url = ? WHERE id = ?`,
                [title || "", url.trim(), id]
            );
            const [rows] = await db.promise().query(`SELECT * FROM youtube_videos WHERE id = ?`, [id]);
            res.json({ success: true, data: rows[0], message: "Video updated" });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/youtube-delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await db.promise().query(`UPDATE youtube_videos SET status = '1D' WHERE id = ?`, [req.body.id]);
            res.json({ success: true, message: "Video deleted" });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/youtube-reorder", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try { await applyReorder("youtube_videos", req.body.ids, res); }
        catch (err) { console.error(err); res.json({ success: false, message: "Something went wrong" }); }
    });

    router.post("/youtube-toggle", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const active = !!req.body.active;
            await db.promise().query(
                `UPDATE youtube_videos SET status = ? WHERE id = ?`,
                [active ? "1" : "1S", req.body.id]
            );
            res.json({ success: true, message: active ? "Activated" : "Deactivated" });
        } catch (err) { console.error(err); res.json({ success: false, message: "Something went wrong" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/youtube" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "youtube_videos" },
];
