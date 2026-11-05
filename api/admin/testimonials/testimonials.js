/**
 * API routes for src/pages/panel/admin/Testimonials.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, nextSortNo, applyReorder } = ctx;

    /* ---- Testimonials (admin) ---- */
    router.post("/testimonials-list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(
                `SELECT * FROM testimonials WHERE status != '1D' ORDER BY sortno ASC, id ASC`
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Failed to load testimonials" });
        }
    });

    router.post("/testimonials-add", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { name, role, feedback, built, rating } = req.body;
            if (!name || name.trim().length < 2)
                return res.json({ success: false, message: "Please enter a name" });
            if (!feedback || feedback.trim().length < 5)
                return res.json({ success: false, message: "Please enter the feedback" });

            const datetime = Math.floor(Date.now() / 1000);
            const sortno = await nextSortNo("testimonials");
            const [r] = await db.promise().query(
                `INSERT INTO testimonials (name, role, feedback, built, rating, sortno, datetime, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, '1')`,
                [name.trim(), role || "", feedback.trim(), built || "", String(rating || "5"), sortno, datetime]
            );
            const [rows] = await db.promise().query(`SELECT * FROM testimonials WHERE id = ?`, [r.insertId]);
            res.json({ success: true, data: rows[0], message: "Testimonial added" });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/testimonials-update", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id, name, role, feedback, built, rating } = req.body;
            if (!id) return res.json({ success: false, message: "Invalid id" });
            if (!name || name.trim().length < 2)
                return res.json({ success: false, message: "Please enter a name" });
            if (!feedback || feedback.trim().length < 5)
                return res.json({ success: false, message: "Please enter the feedback" });

            await db.promise().query(
                `UPDATE testimonials SET name = ?, role = ?, feedback = ?, built = ?, rating = ? WHERE id = ?`,
                [name.trim(), role || "", feedback.trim(), built || "", String(rating || "5"), id]
            );
            const [rows] = await db.promise().query(`SELECT * FROM testimonials WHERE id = ?`, [id]);
            res.json({ success: true, data: rows[0], message: "Testimonial updated" });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/testimonials-delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await db.promise().query(`UPDATE testimonials SET status = '1D' WHERE id = ?`, [req.body.id]);
            res.json({ success: true, message: "Testimonial deleted" });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/testimonials-reorder", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try { await applyReorder("testimonials", req.body.ids, res); }
        catch (err) { console.error(err); res.json({ success: false, message: "Something went wrong" }); }
    });

    router.post("/testimonials-toggle", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const active = !!req.body.active;
            await db.promise().query(
                `UPDATE testimonials SET status = ? WHERE id = ?`,
                [active ? "1" : "1S", req.body.id]
            );
            res.json({ success: true, message: active ? "Activated" : "Deactivated" });
        } catch (err) { console.error(err); res.json({ success: false, message: "Something went wrong" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/testimonials" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "testimonials" },
];
