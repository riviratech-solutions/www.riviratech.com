/**
 * The footer newsletter sign-up (components/Includes.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, validateSecurity } = ctx;

    /* ---- Public: newsletter subscribe (footer "Stay in the Loop") ---- */
    router.post("/newsletter/subscribe", async (req, res) => {
        // CSRF token check (same as the contact form flow).
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        try {
            const email = (req.body.email || "").trim();
            if (!/^\S+@\S+\.\S+$/.test(email)) return res.json({ success: false, message: "Please enter a valid email" });
            const [dup] = await db.promise().query("SELECT id FROM newsletter WHERE LOWER(email)=LOWER(?) LIMIT 1", [email]);
            if (dup.length) return res.json({ success: true, message: "You're already subscribed — thank you!" });
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query("INSERT INTO newsletter (email, datetime, status) VALUES (?,?, '1')", [email, datetime]);
            return res.json({ success: true, message: "Subscribed! You'll get AI tips and updates." });
        } catch (err) { console.error("newsletter/subscribe:", err.message); return res.json({ success: false, message: "Server error" }); }
    });
};
