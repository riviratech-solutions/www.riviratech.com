/**
 * API routes for src/pages/panel/admin/Jobs.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");

module.exports = (router, ctx) => {
    const { db, publicBase, md5, verifyAccount, addactivity } = ctx;

    /* ===================== Careers / Jobs =====================
       Admin posts jobs (X,Y); the website lists active jobs and visitors apply
       with a PDF/Word resume. */
    const jobSlugify = (s) => String(s || "").toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    // ---- Admin: list jobs (paginated) ----
    router.post("/jobs/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const search = req.body.q ? String(req.body.q).trim() : "";
            const sortby = req.body.s ? String(req.body.s).trim() : "";
            let page = req.body.n ? parseInt(req.body.n) : 1;
            const orderBy = sortby === "Old" ? "id ASC" : "id DESC";
            let where = "WHERE (status='1' OR status='1S')";
            const params = [];
            if (search) { where = "WHERE (title ILIKE ? OR location ILIKE ? OR department ILIKE ?) AND (status='1' OR status='1S')"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
            const limit = 10;
            const [countRows] = await db.promise().query(`SELECT COUNT(id) AS total FROM jobs ${where}`, params);
            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
            if (page > lastPage && lastPage > 0) page = lastPage;
            const offset = (page - 1) * limit;
            const [rows] = await db.promise().query(
                `SELECT j.*, (SELECT COUNT(*) FROM job_applications a WHERE a.job_req_id = j.req_id) AS applications
                 FROM jobs j ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            return res.json({ success: true, data: rows, total, page, lastPage });
        } catch (err) { console.error("jobs/list:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: get one job ----
    router.post("/jobs/get", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query("SELECT * FROM jobs WHERE req_id=? LIMIT 1", [req.body.req_id]);
            if (!rows.length) return res.json({ success: false, message: "Job not found" });
            return res.json({ success: true, data: rows[0] });
        } catch (err) { console.error("jobs/get:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: create / update a job ----
    router.post("/jobs/save", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { req_id, title, location, jtype, department, experience, salary, short_desc, description, status } = req.body;
            if (!title || !String(title).trim()) return res.json({ success: false, message: "Please enter a job title" });
            const slug = jobSlugify(req.body.slug || title);
            if (!slug) return res.json({ success: false, message: "Invalid job link (slug)" });
            const st = String(status == null ? "1" : status);
            const [dup] = await db.promise().query("SELECT req_id FROM jobs WHERE slug=? AND req_id != ? LIMIT 1", [slug, req_id || ""]);
            if (dup.length) return res.json({ success: false, message: "That job link (slug) is already in use" });

            if (req_id) {
                const [r] = await db.promise().query(
                    `UPDATE jobs SET slug=?, title=?, location=?, jtype=?, department=?, experience=?, salary=?, short_desc=?, description=?, status=? WHERE req_id=?`,
                    [slug, title.trim(), location || "", jtype || "", department || "", experience || "", salary || "", short_desc || "", description || "", st, req_id]
                );
                if (r.affectedRows !== 1) return res.json({ success: false, message: "Job not found" });
                addactivity(ukey, req_id, "jobs", "Job updated '" + title.trim() + "'", "", "");
                const [rows] = await db.promise().query("SELECT * FROM jobs WHERE req_id=? LIMIT 1", [req_id]);
                return res.json({ success: true, message: "Job updated", data: rows[0] });
            }
            const newId = "job" + md5(crypto.randomBytes(16).toString("hex") + Date.now());
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                `INSERT INTO jobs (req_id, slug, title, location, jtype, department, experience, salary, short_desc, description, status, datetime)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [newId, slug, title.trim(), location || "", jtype || "", department || "", experience || "", salary || "", short_desc || "", description || "", st, datetime]
            );
            addactivity(ukey, newId, "jobs", "New job posted '" + title.trim() + "'", "", "");
            const [rows] = await db.promise().query("SELECT * FROM jobs WHERE req_id=? LIMIT 1", [newId]);
            return res.json({ success: true, message: "Job posted", data: rows[0] });
        } catch (err) { console.error("jobs/save:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: enable / disable / delete ----
    router.post("/jobs/toggle", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query("SELECT title, status FROM jobs WHERE req_id=? LIMIT 1", [req.body.req_id]);
            if (!rows.length) return res.json({ success: false, message: "Job not found" });
            const next = rows[0].status === "1" ? "1S" : "1";
            await db.promise().query("UPDATE jobs SET status=? WHERE req_id=?", [next, req.body.req_id]);
            addactivity(ukey, req.body.req_id, "jobs", `Job ${next === "1" ? "enabled" : "disabled"} '${rows[0].title}'`, "", "");
            return res.json({ success: true, message: next === "1" ? "Job enabled" : "Job disabled", status: next });
        } catch (err) { console.error("jobs/toggle:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    router.post("/jobs/delete", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query("SELECT title FROM jobs WHERE req_id=? LIMIT 1", [req.body.req_id]);
            if (!rows.length) return res.json({ success: false, message: "Job not found" });
            await db.promise().query("DELETE FROM job_applications WHERE job_req_id=?", [req.body.req_id]);
            await db.promise().query("DELETE FROM jobs WHERE req_id=?", [req.body.req_id]);
            addactivity(ukey, req.body.req_id, "jobs", "Job deleted '" + rows[0].title + "'", "", "");
            return res.json({ success: true, message: "Job deleted" });
        } catch (err) { console.error("jobs/delete:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: applications for a job ----
    router.post("/jobs/applications", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(
                "SELECT id, name, email, phone, cover, resume, status, datetime FROM job_applications WHERE job_req_id=? ORDER BY id DESC", [req.body.req_id]
            );
            return res.json({ success: true, data: rows, base: publicBase(req) });
        } catch (err) { console.error("jobs/applications:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/jobs" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "jobs" },
    { table: "job_applications" },
];
