/* Admin panel header (src/components/AdminMenu.tsx → Topbar):
     GET /me                  the signed-in user (name, email, role…) — the
                              header caches it in localStorage at sign-in and
                              asks here only when that copy is missing / stale
     GET /panel-search?q=     students, trainers, inquiries, enrollees, courses
                              and batches matching q (admins only)
     GET /panel-notifications counts of items waiting for an admin's action

   All three are cookie-only GETs (checkStatus) on purpose: the header runs
   them alongside the page's own calls, and the page's one-time security
   tokens (validateSecurity) must not be consumed by it.

   An Admin (Y) only gets the groups of pages they may view; members.permissions
   NULL / super admin (X) = everything. */

const adminPerms = require("../security/admin-permissions");

function register(router, db, checkStatus) {
    const q = (sql, p = []) => db.promise().query(sql, p).then(([r]) => r);

    // permission check for a signed-in adminer row
    const viewerOf = (user) => {
        const perms = user.status === "Y" ? adminPerms.parsePermissions(user.permissions) : null;
        return (page) => perms == null || (perms[page] || []).includes("view");
    };

    /* ---- the signed-in user ---- */
    router.get("/me", async (req, res) => {
        const ok = await checkStatus(req, "X,Y,1,2,3");
        if (!ok.success) return res.json({ success: false, message: ok.message });
        const u = ok.user[0];
        const role = u.status === "X" ? "Super Admin" : u.status === "Y" ? "Admin" : u.status === "2" ? "Trainer" : "Student";
        return res.json({
            success: true,
            data: { mem_id: u.mem_id, name: u.name || "", email: u.email || "", number: u.number || "", status: u.status, role },
        });
    });

    /* ---- global search ---- */
    router.get("/panel-search", async (req, res) => {
        const ok = await checkStatus(req, "X,Y");
        if (!ok.success) return res.json({ success: false, message: ok.message, groups: [] });
        const can = viewerOf(ok.user[0]);
        const term = String(req.query.q || "").trim().slice(0, 60);
        if (term.length < 2) return res.json({ success: true, groups: [] });
        const like = `%${term}%`;
        const enc = encodeURIComponent;

        const groups = [];
        const run = async (page, label, sql, params, map) => {
            if (!can(page)) return;
            try {
                const rows = await q(sql, params);
                if (rows.length) groups.push({ key: page, label, items: rows.map(map) });
            } catch (err) { console.error("panel-search " + page + ":", err.message); }
        };
        const person = (link) => (r) => ({
            title: r.name || r.email || r.number || "—",
            sub: [r.email, r.number].filter(Boolean).join(" · "),
            link: link + "?q=" + enc(r.email || r.name || r.number || ""),
        });

        await run("students", "Students",
            `SELECT name, email, number FROM members WHERE status IN ('1','1S')
             AND (name ILIKE ? OR email ILIKE ? OR number ILIKE ?) ORDER BY id DESC LIMIT 5`,
            [like, like, like], person("/panel/students"));
        await run("trainers", "Trainers",
            `SELECT name, email, number FROM members WHERE status IN ('2','2S')
             AND (name ILIKE ? OR email ILIKE ? OR number ILIKE ?) ORDER BY id DESC LIMIT 5`,
            [like, like, like], person("/panel/trainers"));
        await run("students-inquiries", "Student inquiries",
            `SELECT name, email, number FROM enrollees WHERE status IN ('0','1')
             AND (name ILIKE ? OR email ILIKE ? OR number ILIKE ?) ORDER BY id DESC LIMIT 5`,
            [like, like, like], person("/panel/students-inquiries"));
        await run("enrollees", "Enrollees",
            `SELECT name, email, number FROM enrollees WHERE status IN ('2','3')
             AND (name ILIKE ? OR email ILIKE ? OR number ILIKE ?) ORDER BY id DESC LIMIT 5`,
            [like, like, like], person("/panel/enrollees"));
        await run("courses", "Courses",
            `SELECT title FROM courses WHERE status IN ('1','0') AND title ILIKE ? ORDER BY id DESC LIMIT 5`,
            [like], (r) => ({ title: r.title, sub: "Course", link: "/panel/courses?q=" + enc(r.title) }));
        await run("batches", "Batches",
            `SELECT b.name, b.c_id, c.title FROM batches b LEFT JOIN courses c ON c.req_id = b.c_id
             WHERE b.status IN ('1','0') AND b.name ILIKE ? ORDER BY b.id DESC LIMIT 5`,
            [like], (r) => ({ title: r.name, sub: r.title ? "Batch · " + r.title : "Batch", link: "/panel/batches?id=" + enc(r.c_id) + "&q=" + enc(r.name) }));

        return res.json({ success: true, groups });
    });

    /* ---- items waiting for action ---- */
    const NOTIFY = [
        ["students-inquiries", "Student inquiries to review", "/panel/students-inquiries", `SELECT COUNT(*)::int AS n FROM enrollees WHERE status = '1'`],
        ["certificate-requests", "Certificate requests pending", "/panel/certificate-requests", `SELECT COUNT(*)::int AS n FROM certificate_requests WHERE status = '1'`],
        ["web-contacts", "New web contacts", "/panel/web-contacts", `SELECT COUNT(*)::int AS n FROM contacts WHERE COALESCE(type, 'contacts') = 'contacts' AND status = '1'`],
        ["trainer-contacts", "New trainer contacts", "/panel/trainer-contacts", `SELECT COUNT(*)::int AS n FROM contacts WHERE type = 'trainer_queries' AND status = '1'`],
        ["qa-session", "Questions to answer", "/panel/qa-session", `SELECT COUNT(*)::int AS n FROM qa_sessions WHERE status = '1'`],
        ["raised-tickets", "Open support tickets", "/panel/raised-tickets", `SELECT COUNT(*)::int AS n FROM tickets WHERE status = '1'`],
        ["site-feedback", "New site feedback", "/panel/site-feedback", `SELECT COUNT(*)::int AS n FROM feedbacks WHERE type = 's' AND status = '1'`],
        ["workshop-registrations", "New workshop registrations", "/panel/workshop-registrations", `SELECT COUNT(*)::int AS n FROM workshop_registrations WHERE status = '1'`],
        ["dashboard-notices", "Notice replies to review", "/panel/dashboard-notices?open=new", `SELECT COUNT(*)::int AS n FROM dashboard_notice_replies WHERE status = '1'`],
    ];
    router.get("/panel-notifications", async (req, res) => {
        const ok = await checkStatus(req, "X,Y");
        if (!ok.success) return res.json({ success: false, message: ok.message, items: [], total: 0 });
        const can = viewerOf(ok.user[0]);
        const items = [];
        for (const [page, label, link, sql] of NOTIFY) {
            if (!can(page)) continue;
            try {
                const [{ n }] = await q(sql);
                if (n > 0) items.push({ key: page, label, link, count: n });
            } catch (err) { console.error("panel-notifications " + page + ":", err.message); }
        }
        return res.json({ success: true, items, total: items.reduce((t, i) => t + i.count, 0) });
    });
}

module.exports = { register };
