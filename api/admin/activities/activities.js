/**
 * API routes for src/pages/panel/admin/Activities.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const adminPerms = require("../../security/admin-permissions");

module.exports = (router, ctx) => {
    const { db, verifyAccount } = ctx;

    /* ===================== Activity log =====================
       Super admin (X) sees every adminer's activity; a plain admin (Y) sees only
       their own. Paginated, 100 rows per page. Role comes from the validated
       cookie (verifyAccount already tied it to the account). */
    router.post("/activities", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const isSuper = req.cookies.id === "X";
            const mem_id = req.cookies.key;
            const search = req.body.q ? String(req.body.q).trim() : "";
            let page = req.body.n ? parseInt(req.body.n) : 1;
            const limit = 100;

            let where = "WHERE 1=1";
            const params = [];
            if (!isSuper) { where += " AND a.mem_id = ?"; params.push(mem_id); }
            if (search) { where += " AND a.info ILIKE ?"; params.push(`%${search}%`); }

            const [countRows] = await db.promise().query(`SELECT COUNT(a.id) AS total FROM activities a ${where}`, params);
            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
            if (page > lastPage && lastPage > 0) page = lastPage;
            const offset = (page - 1) * limit;

            const [rows] = await db.promise().query(
                `SELECT a.id, a.mem_id, a.to_id, a.ntable, a.info, a.fromtxt, a.totxt, a.datetime,
                        (SELECT name FROM members m WHERE m.mem_id = a.mem_id LIMIT 1) AS actor
                 FROM activities a ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            return res.json({ success: true, data: rows, total, page, lastPage, isSuper });
        } catch (err) { console.error("activities:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    /* Profile behind an Activities row (the "Adminer" name popup). A super admin
       can open anyone's; other adminers only their own (they only see their own
       rows). Password fields are never selected. */
    router.post("/activities-actor", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const isSuper = req.cookies.id === "X";
            const target = String(req.body.mem_id || "").trim();
            if (!target) return res.json({ success: false, message: "Missing member" });
            if (!isSuper && target !== req.cookies.key) {
                return res.json({ success: false, message: "You can only view your own profile" });
            }
            // One round trip: the database is remote, so each extra query costs ~250ms.
            const [rows] = await db.promise().query(
                `SELECT m.mem_id, m.name, m.email, m.number, m.gender, m.address, m.city, m.state, m.pincode,
                        m.qualification, m.profile, m.ac_type, m.datetime, m.lastdatetime, m.status, m.permissions,
                        (SELECT COUNT(*) FROM activities a WHERE a.mem_id = m.mem_id)::int AS activity_count,
                        (SELECT MAX(a.datetime) FROM activities a WHERE a.mem_id = m.mem_id) AS last_activity,
                        (SELECT COUNT(*) FROM login_sessions ls
                          WHERE ls.mem_id = m.id AND ls.status = 'active'
                            AND (ls.expires_at IS NULL OR ls.expires_at > NOW()))::int AS active_sessions,
                        (SELECT string_agg(DISTINCT c.title, '||') FROM member_courses mc
                           JOIN courses c ON c.req_id = mc.c_id
                          WHERE mc.mem_id = m.mem_id AND mc.status = '1') AS course_titles
                 FROM members m WHERE m.mem_id = ? LIMIT 1`,
                [target]
            );
            if (!rows.length) return res.json({ success: false, message: "This account no longer exists" });
            const m = rows[0];
            const courses = m.course_titles ? String(m.course_titles).split("||") : [];
            const stats = { total: m.activity_count || 0, last: m.last_activity };
            const sessions = m.active_sessions || 0;
            delete m.course_titles; delete m.activity_count; delete m.last_activity; delete m.active_sessions;

            let pages = null; // null = full access
            if (m.status === "Y") {
                const perms = adminPerms.parsePermissions(m.permissions);
                pages = perms ? Object.keys(perms).filter((k) => (perms[k] || []).length).length : null;
            }
            delete m.permissions;
            return res.json({ success: true, data: { ...m, courses, pages, activityCount: stats.total, lastActivity: stats.last, activeSessions: sessions } });
        } catch (err) {
            console.error("activities-actor:", err.message);
            return res.json({ success: false, message: "Database error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/activities" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "activities" },
];
