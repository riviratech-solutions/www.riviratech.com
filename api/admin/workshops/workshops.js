/**
 * API routes for src/pages/panel/admin/Workshops.tsx.
 *
 * start_at / expire_at (Unix seconds, NULL = not set): when the bootcamp starts —
 * the website shows "Next session: <Month Year>" until then — and when it stops
 * being shown on the website at all, even while it is the live one.
 *
 * The old free-text `dates` column is no longer used (start_at replaces it);
 * it is kept in the table so nothing saved is lost.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, nextSortNo } = ctx;

    /* ================= WORKSHOP: FEATURED BOOTCAMP =================
       Drives the dark featured panel on the public /workshop page. The layout
       lives in src/pages/website/Workshop.tsx and does not change; these rows
       carry only the copy that differs between bootcamps.

       Exactly one row is live ('1') at a time — see workshop-activate. The
       public page falls back to its built-in defaults if this returns nothing,
       so an empty table or a down API can never blank the panel. */

    const WORKSHOP_COLS = `id, badge, title, cadence, times, duration,
                           zoom_label, zoom_url, whatsapp_label, whatsapp_url,
                           learn_items, mentor, teach_tags, join_text, join_tags,
                           start_at, expire_at, sortno, datetime, status`;

    /** Shared field validation + normalisation for add/update. */
    function readWorkshopBody(b) {
        const s = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
        const title = s(b.title, 255);
        if (title.length < 2) return { error: "Please enter the bootcamp title" };

        // A CTA with a label but no URL renders a dead button — reject rather
        // than ship one. An empty label AND empty URL simply hides that button.
        const zoomUrl = s(b.zoom_url, 2000);
        const waUrl = s(b.whatsapp_url, 2000);
        for (const [label, url, name] of [
            [s(b.zoom_label, 120), zoomUrl, "Zoom"],
            [s(b.whatsapp_label, 120), waUrl, "WhatsApp"],
        ]) {
            if (label && !url) return { error: `Please add the ${name} link (or clear its button label)` };
            if (url && !/^https?:\/\//i.test(url)) return { error: `The ${name} link must start with http:// or https://` };
        }

        // start / expire: Unix seconds from the form ("" = not set)
        const when = (v) => {
            if (v === "" || v == null) return null;
            const n = Math.floor(Number(v));
            return Number.isFinite(n) && n > 0 && n < 4102444800 ? n : NaN; // before 2100
        };
        const startAt = when(b.start_at);
        const expireAt = when(b.expire_at);
        if (Number.isNaN(startAt)) return { error: "Please enter a valid start date and time" };
        if (Number.isNaN(expireAt)) return { error: "Please enter a valid expiry date and time" };
        if (startAt && expireAt && expireAt <= startAt) return { error: "The expiry must be after the start" };

        return {
            values: {
                start_at: startAt,
                expire_at: expireAt,
                badge: s(b.badge, 80) || "Upcoming bootcamp",
                title,
                cadence: s(b.cadence, 120),
                times: s(b.times, 160),
                duration: s(b.duration, 80),
                zoom_label: s(b.zoom_label, 120),
                zoom_url: zoomUrl,
                whatsapp_label: s(b.whatsapp_label, 120),
                whatsapp_url: waUrl,
                // One bullet per line — stored verbatim, split on read.
                learn_items: s(b.learn_items, 4000),
                mentor: s(b.mentor, 1000),
                teach_tags: s(b.teach_tags, 255),
                join_text: s(b.join_text, 2000),
                join_tags: s(b.join_tags, 255),
            },
        };
    }

    router.post("/workshop-list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(
                `SELECT ${WORKSHOP_COLS} FROM workshop_bootcamps ORDER BY status DESC, sortno ASC, id DESC`
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            console.error("workshop-list error:", err);
            res.json({ success: false, message: "Failed to load bootcamps" });
        }
    });

    router.post("/workshop-add", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const parsed = readWorkshopBody(req.body);
            if (parsed.error) return res.json({ success: false, message: parsed.error });
            const v = parsed.values;

            const datetime = Math.floor(Date.now() / 1000);
            const sortno = await nextSortNo("workshop_bootcamps");
            // Added as a DRAFT ('0'). Publishing is a separate, deliberate click,
            // so a half-written bootcamp can never replace the live one.
            const [r] = await db.promise().query(
                `INSERT INTO workshop_bootcamps
                   (badge, title, cadence, times, duration,
                    zoom_label, zoom_url, whatsapp_label, whatsapp_url,
                    learn_items, mentor, teach_tags, join_text, join_tags,
                    start_at, expire_at, sortno, datetime, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0')`,
                [v.badge, v.title, v.cadence, v.times, v.duration,
                v.zoom_label, v.zoom_url, v.whatsapp_label, v.whatsapp_url,
                v.learn_items, v.mentor, v.teach_tags, v.join_text, v.join_tags,
                v.start_at, v.expire_at, sortno, datetime]
            );
            const [rows] = await db.promise().query(
                `SELECT ${WORKSHOP_COLS} FROM workshop_bootcamps WHERE id = ?`, [r.insertId]
            );
            res.json({ success: true, data: rows[0], message: "Bootcamp saved as a draft" });
        } catch (err) {
            console.error("workshop-add error:", err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/workshop-update", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id);
            if (!Number.isInteger(id) || id <= 0)
                return res.json({ success: false, message: "Invalid id" });

            const parsed = readWorkshopBody(req.body);
            if (parsed.error) return res.json({ success: false, message: parsed.error });
            const v = parsed.values;

            const [upd] = await db.promise().query(
                `UPDATE workshop_bootcamps
                    SET badge = ?, title = ?, cadence = ?, times = ?, duration = ?,
                        zoom_label = ?, zoom_url = ?, whatsapp_label = ?, whatsapp_url = ?,
                        learn_items = ?, mentor = ?, teach_tags = ?, join_text = ?, join_tags = ?,
                        start_at = ?, expire_at = ?
                  WHERE id = ?`,
                [v.badge, v.title, v.cadence, v.times, v.duration,
                v.zoom_label, v.zoom_url, v.whatsapp_label, v.whatsapp_url,
                v.learn_items, v.mentor, v.teach_tags, v.join_text, v.join_tags,
                v.start_at, v.expire_at, id]
            );
            if (!upd.affectedRows)
                return res.json({ success: false, message: "Bootcamp not found" });

            const [rows] = await db.promise().query(
                `SELECT ${WORKSHOP_COLS} FROM workshop_bootcamps WHERE id = ?`, [id]
            );
            res.json({ success: true, data: rows[0], message: "Bootcamp updated" });
        } catch (err) {
            console.error("workshop-update error:", err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    /* A copy of a bootcamp, as a new DRAFT ("<title> (copy)") — a quick start
       for the next run of the same bootcamp. */
    router.post("/workshop-duplicate", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id);
            if (!Number.isInteger(id) || id <= 0)
                return res.json({ success: false, message: "Invalid id" });

            const [src] = await db.promise().query(`SELECT ${WORKSHOP_COLS} FROM workshop_bootcamps WHERE id = ?`, [id]);
            if (!src.length) return res.json({ success: false, message: "Bootcamp not found" });
            const o = src[0];
            const title = (String(o.title || "").slice(0, 248) + " (copy)").trim();

            const datetime = Math.floor(Date.now() / 1000);
            const sortno = await nextSortNo("workshop_bootcamps");
            const [r] = await db.promise().query(
                `INSERT INTO workshop_bootcamps
                   (badge, title, cadence, times, duration,
                    zoom_label, zoom_url, whatsapp_label, whatsapp_url,
                    learn_items, mentor, teach_tags, join_text, join_tags,
                    start_at, expire_at, sortno, datetime, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0')`,
                [o.badge, title, o.cadence, o.times, o.duration,
                o.zoom_label, o.zoom_url, o.whatsapp_label, o.whatsapp_url,
                o.learn_items, o.mentor, o.teach_tags, o.join_text, o.join_tags,
                o.start_at, o.expire_at, sortno, datetime]
            );
            const [rows] = await db.promise().query(
                `SELECT ${WORKSHOP_COLS} FROM workshop_bootcamps WHERE id = ?`, [r.insertId]
            );
            res.json({ success: true, data: rows[0], message: "Copy saved as a draft" });
        } catch (err) {
            console.error("workshop-duplicate error:", err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    /* Publish one bootcamp and retire every other, in ONE transaction — so the
       site can never be caught with two live bootcamps or, worse, none. */
    router.post("/workshop-activate", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id);
            if (!Number.isInteger(id) || id <= 0)
                return res.json({ success: false, message: "Invalid id" });

            const [exists] = await db.promise().query(
                `SELECT id, expire_at FROM workshop_bootcamps WHERE id = ?`, [id]
            );
            if (!exists.length)
                return res.json({ success: false, message: "Bootcamp not found" });
            // an expired bootcamp isn't shown on the website, so publishing it
            // would leave the panel on its built-in default
            if (exists[0].expire_at && Number(exists[0].expire_at) <= Math.floor(Date.now() / 1000))
                return res.json({ success: false, message: "This bootcamp has expired. Change its expiry date first, then publish it." });

            await db.withTransaction(async (tx) => {
                await tx.query(`UPDATE workshop_bootcamps SET status = '0' WHERE status = '1'`);
                await tx.query(`UPDATE workshop_bootcamps SET status = '1' WHERE id = ?`, [id]);
            });

            const [rows] = await db.promise().query(
                `SELECT ${WORKSHOP_COLS} FROM workshop_bootcamps ORDER BY status DESC, sortno ASC, id DESC`
            );
            res.json({ success: true, data: rows, message: "This bootcamp is now live on the website" });
        } catch (err) {
            console.error("workshop-activate error:", err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/workshop-deactivate", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id);
            if (!Number.isInteger(id) || id <= 0)
                return res.json({ success: false, message: "Invalid id" });

            const [exists] = await db.promise().query(
                `SELECT id FROM workshop_bootcamps WHERE id = ?`, [id]
            );
            if (!exists.length)
                return res.json({ success: false, message: "Bootcamp not found" });

            await db.withTransaction(async (tx) => {
                await tx.query(`UPDATE workshop_bootcamps SET status = '0' WHERE id = ?`, [id]);
            });

            const [rows] = await db.promise().query(
                `SELECT ${WORKSHOP_COLS} FROM workshop_bootcamps ORDER BY status DESC, sortno ASC, id DESC`
            );
            res.json({ success: true, data: rows, message: "This bootcamp is not live on the website" });
        } catch (err) {
            console.error("workshop-activate error:", err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });

    router.post("/workshop-delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = Number(req.body.id);
            if (!Number.isInteger(id) || id <= 0)
                return res.json({ success: false, message: "Invalid id" });

            // Deleting the live bootcamp would silently strip the panel off the
            // public page. Make them publish a replacement first.
            const [rows] = await db.promise().query(
                `SELECT status FROM workshop_bootcamps WHERE id = ?`, [id]
            );
            if (!rows.length)
                return res.json({ success: false, message: "Bootcamp not found" });
            if (rows[0].status === "1")
                return res.json({
                    success: false,
                    message: "This bootcamp is live. Publish another one first, then delete this.",
                });

            await db.promise().query(`DELETE FROM workshop_bootcamps WHERE id = ?`, [id]);
            res.json({ success: true, message: "Bootcamp deleted" });
        } catch (err) {
            console.error("workshop-delete error:", err);
            res.json({ success: false, message: "Something went wrong" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/workshops" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "workshop_bootcamps" },
];
