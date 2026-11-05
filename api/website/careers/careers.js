/**
 * API routes for src/pages/website/Careers.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");
const { verifyTurnstile } = require("../../security/turnstile");
const { RESUME_UPLOAD_BYTES } = require("../../shared/uploads");

module.exports = (router, ctx) => {
    const { db, UPLOAD_TTL_MS, signUpload, publicBase, md5, validateSecurity, moveS3File } = ctx;

    // ---- Public: active jobs list (website careers page) ----
    router.post("/public/jobs", async (req, res) => {
        try {
            const [rows] = await db.promise().query(
                "SELECT req_id, slug, title, location, jtype, department, experience, salary, short_desc, datetime FROM jobs WHERE status='1' ORDER BY id DESC"
            );
            return res.json({ success: true, data: rows });
        } catch (err) { console.error("public/jobs:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Public: single active job by slug ----
    router.post("/public/job", async (req, res) => {
        try {
            const [rows] = await db.promise().query("SELECT * FROM jobs WHERE slug=? AND status='1' LIMIT 1", [req.body.slug]);
            if (!rows.length) return res.json({ success: false, message: "Job not found" });
            return res.json({ success: true, data: rows[0] });
        } catch (err) { console.error("public/job:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Public: signed upload URL for a resume (PDF/Word only) ----
    router.post("/public/resume-url", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        try {
            const { fileName, fileType } = req.body;
            const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
            const ext = String(fileName || "").split(".").pop().toLowerCase();
            if (!allowedTypes.includes(fileType) || !["pdf", "doc", "docx"].includes(ext)) {
                return res.json({ success: false, message: "Only PDF or Word (.pdf, .doc, .docx) files are allowed" });
            }
            const n = "a" + md5(Math.random() + Date.now() + crypto.randomBytes(16).toString("hex"));
            const safeName = String(fileName).split(/[\\/]/).pop().replace(/[^\w.\-]/g, "_").slice(-100);
            // Upload into the temp prefix (the only one the signed PUT accepts);
            // job-apply promotes it into riviratech/resumes/ once the form submits.
            const filekey = `riviratech/temp/${n}-${safeName}`;
            const exp = Date.now() + UPLOAD_TTL_MS;
            // a public upload: at most 10 MB (shared/uploads.js checks the signed limit)
            const max = RESUME_UPLOAD_BYTES;
            const sig = signUpload(filekey, exp, max);
            const base = publicBase(req);
            return res.json({
                success: true,
                uploadURL: `${base}/api/upload-file?key=${encodeURIComponent(filekey)}&exp=${exp}&max=${max}&sig=${sig}`,
                key: filekey,
                fileURL: `${base}/uploads/${filekey}`,
            });
        } catch (err) { console.error("public/resume-url:", err.message); return res.json({ success: false, message: "Upload init failed" }); }
    });

    // ---- Public: submit a job application ----
    router.post("/public/job-apply", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }
        try {
            const { slug, name, email, phone, cover, resume } = req.body;
            if (!name || !String(name).trim()) return res.json({ success: false, message: "Please enter your name" });
            if (!email || !/^\S+@\S+\.\S+$/.test(String(email))) return res.json({ success: false, message: "Please enter a valid email" });
            if (!resume) return res.json({ success: false, message: "Please upload your resume (PDF or Word)" });
            // "+<country code><number>" from the form's country picker — keep only that
            const cleanPhone = String(phone || "").replace(/[^\d+]/g, "").slice(0, 20);
            const [jr] = await db.promise().query("SELECT req_id, title FROM jobs WHERE slug=? AND status='1' LIMIT 1", [slug]);
            if (!jr.length) return res.json({ success: false, message: "This job is no longer open" });
            // Promote the freshly-uploaded resume out of the temp prefix into its
            // permanent home. moveS3File refuses any non-temp source key.
            const safe = String(resume).split(/[\\/]/).pop();
            const resumeKey = await moveS3File(resume, `riviratech/resumes/${safe}`);
            if (!resumeKey) return res.json({ success: false, message: "Could not save your resume, please re-upload and try again" });
            const req_id = "app" + md5(crypto.randomBytes(16).toString("hex") + Date.now());
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                `INSERT INTO job_applications (req_id, job_req_id, job_title, name, email, phone, cover, resume, status, datetime)
                 VALUES (?,?,?,?,?,?,?,?, '1', ?)`,
                [req_id, jr[0].req_id, jr[0].title, name.trim(), email.trim(), cleanPhone, cover || "", resumeKey, datetime]
            );
            return res.json({ success: true, message: "Application submitted — we'll be in touch!" });
        } catch (err) { console.error("public/job-apply:", err.message); return res.json({ success: false, message: "Server error" }); }
    });
};
