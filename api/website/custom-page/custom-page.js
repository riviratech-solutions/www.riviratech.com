/**
 * API routes for src/pages/website/CustomPage.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, pageSlugify } = ctx;

    // ---- Public: fetch an active page by its slug/path (for /:slug rendering) ----
    router.post("/public/page", async (req, res) => {
        try {
            const slug = pageSlugify(req.body.slug);
            if (!slug) return res.json({ success: false, message: "Page not found" });
            const [rows] = await db.promise().query(
                "SELECT title, html, css, datetime FROM custom_pages WHERE slug=? AND status='1' LIMIT 1", [slug]
            );
            if (!rows.length) return res.json({ success: false, message: "Page not found" });
            return res.json({ success: true, data: rows[0] });
        } catch (err) { console.error("public/page:", err.message); return res.json({ success: false, message: "Server error" }); }
    });
};
