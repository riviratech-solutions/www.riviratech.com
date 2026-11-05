/**
 * API routes for src/pages/panel/admin/CustomForms.tsx.
 *
 * custom_form_submissions.referrer: who referred the person, from a referral link
 * (/form/<slug>?r=<name>, made with the link button on the forms list); "" when
 * the form was opened without one.
 *
 * custom_forms.banner: the image shown beside the form on the website
 * (src/pages/website/PublicForm.tsx) — an upload key under riviratech/forms/, or
 * "" for the default illustration.
 *
 * custom_forms.success_msg: shown after a submit; HTML with optional <style>
 * blocks (security/markup-clean.js on save; utils/richMessage.ts on the website).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

const { cleanHtmlWithStyle } = require("../../security/markup-clean");

module.exports = (router, ctx) => {
    const { db, verifyAccount, safeParse, moveS3File, deleteS3File } = ctx;

    // a fresh banner upload (temp key) moved to its final place; "" when it can't be
    const keepBanner = async (fileKey) => {
        if (typeof fileKey !== "string" || !fileKey.startsWith("riviratech/temp/")) return "";
        return moveS3File(fileKey, "riviratech/forms/" + fileKey.split("/").pop());
    };
    const dropBanner = (key) => {
        if (key && String(key).startsWith("riviratech/forms/")) deleteS3File(key);
    };

    const slugify = (s) => String(s || "").toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    // ---- Admin: list forms (+ submission counts) ----
    router.post("/forms/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(
                `SELECT f.id, f.slug, f.title, f.description, f.fields, f.status, f.datetime,
                        (SELECT COUNT(*) FROM custom_form_submissions s WHERE s.form_slug = f.slug) AS submissions
                 FROM custom_forms f ORDER BY f.id DESC`
            );
            const data = rows.map((r) => ({ ...r, fields: safeParse(r.fields, []) }));
            return res.json({ success: true, data });
        } catch (err) { console.error("forms/list:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: get one form (for editing) ----
    router.post("/forms/get", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(`SELECT * FROM custom_forms WHERE id = ? LIMIT 1`, [req.body.id]);
            if (!rows.length) return res.json({ success: false, message: "Form not found" });
            const f = rows[0]; f.fields = safeParse(f.fields, []);
            return res.json({ success: true, data: f });
        } catch (err) { console.error("forms/get:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: create / update a form ----
    router.post("/forms/save", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { id, title, description, fields, submit_text, success_msg, status } = req.body;
            if (!title || !String(title).trim()) return res.json({ success: false, message: "Please enter a form title" });
            const slug = slugify(req.body.slug || title);
            if (!slug) return res.json({ success: false, message: "Invalid form link (slug)" });
            const fieldsArr = Array.isArray(fields) ? fields : [];
            if (!fieldsArr.length) return res.json({ success: false, message: "Add at least one field" });
            const fieldsJson = JSON.stringify(fieldsArr);
            const st = String(status == null ? "1" : status);
            const sub = submit_text || "Submit";
            // HTML + CSS (<style> blocks) allowed; scripts and handlers removed here, and
            // the website cleans it again and keeps its CSS inside the message
            const succ = cleanHtmlWithStyle(success_msg).trim() || "Thank you! Your response has been recorded.";

            const [dup] = await db.promise().query(`SELECT id FROM custom_forms WHERE slug = ? AND id != ? LIMIT 1`, [slug, id || 0]);
            if (dup.length) return res.json({ success: false, message: "That form link (slug) is already in use" });

            // banner: banner_key = a new upload, banner_remove = "1" to go back to
            // the default image; neither keeps the current one
            const newKey = req.body.banner_key;
            let newBanner = null;
            if (newKey) {
                newBanner = await keepBanner(newKey);
                if (!newBanner) return res.json({ success: false, message: "The banner image could not be saved, please upload it again" });
            }
            const removeBanner = !newBanner && String(req.body.banner_remove || "") === "1";

            if (id && Number(id) > 0) {
                const [cur] = await db.promise().query(`SELECT banner FROM custom_forms WHERE id = ? LIMIT 1`, [id]);
                const oldBanner = (cur[0] && cur[0].banner) || "";
                const banner = newBanner !== null ? newBanner : removeBanner ? "" : oldBanner;
                await db.promise().query(
                    `UPDATE custom_forms SET slug=?, title=?, description=?, fields=?, submit_text=?, success_msg=?, status=?, banner=? WHERE id=?`,
                    [slug, title.trim(), description || "", fieldsJson, sub, succ, st, banner, id]
                );
                await db.promise().query(`UPDATE custom_form_submissions SET form_slug=? WHERE form_id=?`, [slug, id]);
                if (oldBanner && oldBanner !== banner) dropBanner(oldBanner); // replaced or removed
                return res.json({ success: true, message: "Form updated", id: Number(id), slug });
            }
            const datetime = Math.floor(Date.now() / 1000);
            const [ins] = await db.promise().query(
                `INSERT INTO custom_forms (slug, title, description, fields, submit_text, success_msg, status, datetime, banner)
                 VALUES (?,?,?,?,?,?,?,?,?)`,
                [slug, title.trim(), description || "", fieldsJson, sub, succ, st, datetime, newBanner || ""]
            );
            return res.json({ success: true, message: "Form created", id: ins.insertId, slug });
        } catch (err) { console.error("forms/save:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: delete a form (+ its submissions) ----
    router.post("/forms/delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(`SELECT slug FROM custom_forms WHERE id=? LIMIT 1`, [req.body.id]);
            if (!rows.length) return res.json({ success: false, message: "Form not found" });
            await db.promise().query(`DELETE FROM custom_form_submissions WHERE form_id=? OR form_slug=?`, [req.body.id, rows[0].slug]);
            await db.promise().query(`DELETE FROM custom_forms WHERE id=?`, [req.body.id]);
            return res.json({ success: true, message: "Form deleted" });
        } catch (err) { console.error("forms/delete:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: submissions for one form ----
    router.post("/forms/submissions", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(
                `SELECT id, answers, datetime, referrer FROM custom_form_submissions WHERE form_slug=? ORDER BY id DESC`, [req.body.slug]
            );
            const data = rows.map((r) => ({ id: r.id, datetime: r.datetime, referrer: r.referrer || "", answers: safeParse(r.answers, {}) }));
            return res.json({ success: true, data });
        } catch (err) { console.error("forms/submissions:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/custom-forms" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "custom_forms" },
    { table: "custom_form_submissions" },
];
