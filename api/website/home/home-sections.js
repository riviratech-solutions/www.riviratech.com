/**
 * Whole-section on/off switches for home-page sections that are managed in the
 * admin panel (YouTube videos, Testimonials).
 *
 *   home_sections(section TEXT PK, enabled CHAR(1) '1'|'0', updated BIGINT, id)
 *
 * A section with no row is ON, so existing sites keep showing everything until
 * someone switches a section off. Each item still has its own show/hide; the
 * home page drops the section when it's switched off OR has no visible items.
 *
 * Admin routes (permission keys = the page keys in admin-permissions.js):
 *   POST /youtube-section-get        POST /youtube-section-set       {enabled}
 *   POST /testimonials-section-get   POST /testimonials-section-set  {enabled}
 */
const SECTIONS = ["youtube", "testimonials", "partners"];

let ready = null;
function ensureTable(db) {
    if (!ready) {
        // `id` is required: pgdb.js appends RETURNING id to every INSERT (to mimic
        // mysql's insertId), which fails on a table without one.
        ready = db
            .promise()
            .query(
                `CREATE TABLE IF NOT EXISTS home_sections (
                    section TEXT PRIMARY KEY,
                    enabled CHAR(1) NOT NULL DEFAULT '1',
                    updated BIGINT
                )`
            )
            .catch((err) => {
                ready = null; // try again on the next call
                throw err;
            });
    }
    return ready;
}

/** True unless the section has been switched off. Errors read as "on". */
async function isEnabled(db, section) {
    try {
        await ensureTable(db);
        const [rows] = await db.promise().query(`SELECT enabled FROM home_sections WHERE section = ?`, [section]);
        return !rows.length || rows[0].enabled !== "0";
    } catch (err) {
        console.error("home_sections read:", err.message);
        return true;
    }
}

function register(router, db, verifyAccount) {
    for (const section of SECTIONS) {
        router.post(`/${section}-section-get`, async (req, res) => {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            res.json({ success: true, enabled: await isEnabled(db, section) });
        });

        router.post(`/${section}-section-set`, async (req, res) => {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const enabled = req.body.enabled === true || req.body.enabled === "1" || req.body.enabled === 1;
            try {
                await ensureTable(db);
                await db.promise().query(
                    `INSERT INTO home_sections (section, enabled, updated) VALUES (?, ?, ?)
                     ON CONFLICT (section) DO UPDATE SET enabled = EXCLUDED.enabled, updated = EXCLUDED.updated`,
                    [section, enabled ? "1" : "0", Math.floor(Date.now() / 1000)]
                );
                res.json({
                    success: true,
                    enabled,
                    message: enabled ? "Section is shown on the home page" : "Section is hidden from the home page",
                });
            } catch (err) {
                console.error("home_sections write:", err.message);
                res.json({ success: false, message: "Could not save the setting" });
            }
        });
    }
}

module.exports = { register, isEnabled, SECTIONS };
