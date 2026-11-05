/**
 * API routes for src/pages/website/PublicForm.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { verifyTurnstile } = require("../../security/turnstile");

module.exports = (router, ctx) => {
    const { db, validateSecurity, safeParse } = ctx;

    // ---- Public: fetch an active form by slug (for /form/:slug) ----
    router.post("/public/form", async (req, res) => {
        try {
            const [rows] = await db.promise().query(
                `SELECT id, slug, title, description, fields, submit_text, success_msg, banner FROM custom_forms WHERE slug=? AND status='1' LIMIT 1`,
                [req.body.slug]
            );
            if (!rows.length) return res.json({ success: false, message: "Form not found" });
            const f = rows[0]; f.fields = safeParse(f.fields, []);
            return res.json({ success: true, data: f });
        } catch (err) { console.error("public/form:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Public: submit a form response ----
    router.post("/public/form-submit", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        // Captcha: verifyTurnstile fails-open when TURNSTILE_SECRET_KEY is unset,
        // and fails-closed (rejects) once configured — same as the contact form.
        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }
        try {
            const { slug, answers } = req.body;
            const [rows] = await db.promise().query(`SELECT id, fields FROM custom_forms WHERE slug=? AND status='1' LIMIT 1`, [slug]);
            if (!rows.length) return res.json({ success: false, message: "Form not found or closed" });
            const form = rows[0];
            const fields = safeParse(form.fields, []);
            const ans = (answers && typeof answers === "object") ? answers : {};
            for (const fld of fields) {
                if (fld.required) {
                    const v = ans[fld.id];
                    const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
                    if (empty) return res.json({ success: false, message: `Please fill "${fld.label}"` });
                }
            }
            // who referred them (?r=<name> on the link): plain text, at most 80 characters
            const referrer = String(req.body.referrer == null ? "" : req.body.referrer)
                .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                `INSERT INTO custom_form_submissions (form_id, form_slug, answers, datetime, referrer) VALUES (?,?,?,?,?)`,
                [form.id, slug, JSON.stringify(ans), datetime, referrer]
            );
            return res.json({ success: true, message: "Submitted" });
        } catch (err) { console.error("public/form-submit:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};
