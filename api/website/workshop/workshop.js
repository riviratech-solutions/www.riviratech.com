/**
 * API routes for src/pages/website/Workshop.tsx.
 * /workshop-register is the sign-up form (modals/WorkshopRegisterModal.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const sendMail = require("../../shared/mail");
const { verifyTurnstile } = require("../../security/turnstile");

module.exports = (router, ctx) => {
    const { db, escapeHtml, validateSecurity } = ctx;

    /* ===================== Workshop Registrations =====================
       The "Reserve your seat" form on /workshop (WorkshopRegisterModal.tsx).
       Admins (X,Y) review them at /panel/workshop-registrations.
       Table: docs/workshop_registrations.sql */

    /* ---- Public: reserve a seat ---- */
    router.post("/workshop-register", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }
        try {
            const name = String(req.body.name || "").trim();
            const email = String(req.body.email || "").trim();
            const phone = String(req.body.phone || "").trim();
            const fullphone = String(req.body.fullphone || "").trim();
            const topic = String(req.body.topic || "").trim().slice(0, 200);
            if (name.length < 3 || name.length > 120) return res.json({ success: false, message: "Please enter your full name" });
            if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return res.json({ success: false, message: "Please enter a valid email" });
            if (!/^[0-9]{10}$/.test(phone) || fullphone.length <= 10 || fullphone.length > 20) {
                return res.json({ success: false, message: "Please enter a valid 10-digit phone number" });
            }

            // Same person, same workshop, still open → don't store (or email) twice.
            const [dup] = await db.promise().query(
                "SELECT id FROM workshop_registrations WHERE LOWER(email)=LOWER(?) AND topic=? AND status='1' LIMIT 1",
                [email, topic]
            );
            if (dup.length) return res.json({ success: true, message: "You're already registered — we'll email you the details." });

            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                "INSERT INTO workshop_registrations (name, email, phone, topic, datetime, status) VALUES (?,?,?,?,?, '1')",
                [name, email, fullphone, topic, datetime]
            );

            const workshop = topic || "Next free AI workshop";
            try {
                await sendMail(
                    process.env.EMAIL_RECEIVER,
                    "New workshop registration — " + workshop,
                    `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color:#2c7be5;">New Workshop Registration</h2>
                        <table cellpadding="6">
                            <tr><td><b>Workshop:</b></td><td>${escapeHtml(workshop)}</td></tr>
                            <tr><td><b>Name:</b></td><td>${escapeHtml(name)}</td></tr>
                            <tr><td><b>Email:</b></td><td>${escapeHtml(email)}</td></tr>
                            <tr><td><b>Phone:</b></td><td>${escapeHtml(fullphone)}</td></tr>
                        </table>
                        <p style="font-size: 13px; color: #777;">📌 Sent from the "Reserve your seat" form on <b>riviratech.com/workshop</b>. Manage it in Admin → Workshop Registrations.</p>
                    </div>`
                );
                await sendMail(
                    email,
                    "Your seat is reserved – Rivira Technologies",
                    `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color:#2c7be5;">You're on the list!</h2>
                        <p>Dear <b>${escapeHtml(name)}</b>,</p>
                        <p>Thank you for registering for <b>${escapeHtml(workshop)}</b> with <b>Rivira Technologies</b>.</p>
                        <p>We'll email you the date and the joining link before the next session. No payment is needed.</p>
                        <hr>
                        <p><b>Contact Information</b><br>📧 support@riviratech.com<br>🌐 www.riviratech.com</p>
                    </div>`
                );
            } catch (mailErr) { console.error("workshop-register mail:", mailErr.message); }

            return res.json({ success: true, message: "Thanks for registering — we'll email you the details." });
        } catch (err) { console.error("workshop-register:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    router.post("/get-workshop", async (req, res) => {
      try {

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
          return res.json(security);
        }

        // the live bootcamp, unless its expiry has passed (start_at drives the
        // "Next session: <Month Year>" line while it is still ahead)
        const [rows] = await db.promise().query(
          `SELECT badge, title, cadence, times, duration,
                        zoom_label, zoom_url, whatsapp_label, whatsapp_url,
                        learn_items, mentor, teach_tags, join_text, join_tags,
                        start_at, expire_at
                   FROM workshop_bootcamps
                  WHERE status = '1' AND (expire_at IS NULL OR expire_at > ?)
                  ORDER BY sortno ASC, id DESC
                  LIMIT 1`,
          [Math.floor(Date.now() / 1000)]
        );
        res.json({ success: true, data: rows[0] || null });
      } catch (err) {
        console.error("get-workshop error:", err);
        res.json({ success: false, data: null });
      }
    });
};
