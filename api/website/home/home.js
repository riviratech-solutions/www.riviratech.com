/**
 * API routes for src/pages/website/Home.tsx.
 * Also registers the YouTube / Testimonials section on-off switches
 * (./home-sections.js).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const homeSections = require("./home-sections");

module.exports = (router, ctx) => {
    const { db, verifyAccount } = ctx;

    /* ---- Whole-section on/off for YouTube + Testimonials (home-sections.js) ---- */
    homeSections.register(router, db, verifyAccount);

    /* ---- Public reads for the home page (no auth) ---- */
    // A section switched off in the admin panel returns enabled:false and no rows.
    router.get("/get-testimonials", async (req, res) => {
        try {
            if (!(await homeSections.isEnabled(db, "testimonials"))) {
                return res.json({ success: true, enabled: false, data: [] });
            }
            const [rows] = await db.promise().query(
                `SELECT id, name, role, feedback, built, rating, image
                 FROM testimonials WHERE status = '1' ORDER BY sortno ASC, id ASC`
            );
            res.json({ success: true, enabled: true, data: rows });
        } catch (err) {
            console.error(err);
            res.json({ success: false, data: [] });
        }
    });

    router.get("/get-youtube", async (req, res) => {
        try {
            if (!(await homeSections.isEnabled(db, "youtube"))) {
                return res.json({ success: true, enabled: false, data: [] });
            }
            const [rows] = await db.promise().query(
                `SELECT id, title, url FROM youtube_videos WHERE status = '1' ORDER BY sortno ASC, id ASC`
            );
            res.json({ success: true, enabled: true, data: rows });
        } catch (err) {
            console.error(err);
            res.json({ success: false, data: [] });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "website/home" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "home_sections" },
];
