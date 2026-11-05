/**
 * API routes for src/pages/panel/admin/Surveys.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");
const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails
const { signLink } = require("../../security/link-signature");

module.exports = (router, ctx) => {
    const { db, md5, verifyAccount, addactivity, safeParse } = ctx;

    /* ===================== Surveys (admin builds; students answer in the panel) =====================
       Any panel admin (status "X") manages surveys. A survey targets a whole batch; every active student
       of that batch sees it as a popup in the student panel. Questions/answers are JSON.
       audience "public" instead: no batch — anyone answers it on the website at /survey/<req_id>
       (website/surveys/surveys.js); those answers are saved under mem_id "public:<visitor id>". */

    const surveyReqId = () => "survey" + md5(crypto.randomBytes(16).toString("hex") + Date.now());

    // Active students of a batch (their member_courses row for it).
    const batchMembers = async (bid) => {
        if (!bid) return [];
        const [rows] = await db.promise().query(
            `SELECT DISTINCT m.mem_id, m.name, m.email FROM members m
             JOIN member_courses mc ON mc.mem_id = m.mem_id AND mc.b_id = ? AND mc.status = '1'
             WHERE m.status = '1' AND m.email <> ''`,
            [bid]
        );
        return rows;
    };

    // Fire-and-forget notification e-mail to a batch about a live survey. Never throws.
    // The button is a one-click link (?r=survey&u=member) that opens the survey popup
    // WITHOUT a login (see /public/survey); students may answer with or without login.
    // A "feedback" survey gets the feedback wording; a "survey" the survey wording.
    const sendSurveyEmails = async (survey, onlyMemIds = null) => {
        try {
            let members = await batchMembers(survey.target_bid);
            // Optional filter: send only to the given member ids (individual / multi-select).
            if (Array.isArray(onlyMemIds) && onlyMemIds.length) {
                const set = new Set(onlyMemIds.map((x) => String(x)));
                members = members.filter((m) => set.has(String(m.mem_id)));
            }
            const fb = survey.kind === "feedback";
            const subject = fb ? `We'd love your feedback: ${survey.title}` : `New survey: ${survey.title}`;
            const base = (process.env.DOMAIN || "").replace(/\/+$/, "");
            for (const m of members) {
                // signed (s), so the link can't be made up from a member id
                const sig = signLink("survey", survey.req_id || "", m.mem_id);
                const link = `${base}/?r=${encodeURIComponent(survey.req_id || "")}&u=${encodeURIComponent(m.mem_id)}&s=${sig}`;
                const html = `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
                      <h2 style="color:#4a1d96">${survey.title}</h2>
                      ${survey.description ? `<p>${survey.description}</p>` : ""}
                      <p>Hi ${m.name || "there"}, ${fb
                        ? "we'd love to hear your feedback. Click below to share it (it only takes a minute)"
                        : "a new survey is waiting for you. Click below to answer it"} — no login required.</p>
                      <p><a href="${link}"
                         style="background:#4a1d96;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
                         ${fb ? "Give Feedback" : "Take the Survey"}</a></p>
                      <p style="color:#64748b;font-size:12px">Or sign in to your student panel any time to ${fb ? "share your feedback" : "respond"}.</p>
                    </div>`;
                try { await queueMail(m.email, subject, html); } catch (e) { console.error("survey mail fail:", m.email, e.message); }
            }
            return members.length;
        } catch (err) { console.error("sendSurveyEmails:", err.message); return 0; }
    };

    // ---- Admin: list surveys (paginated) with response/skip counts + batch name ----
    router.post("/surveys", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const search = req.body.q ? String(req.body.q).trim() : "";
            const sortby = req.body.s ? String(req.body.s).trim() : "";
            let page = req.body.n ? parseInt(req.body.n) : 1;
            const orderBy = sortby === "Old" ? "p.id ASC" : "p.id DESC";
            let where = "WHERE (p.status='1' OR p.status='1S')";
            const params = [];
            if (search) { where = "WHERE p.title ILIKE ? AND (p.status='1' OR p.status='1S')"; params.push(`%${search}%`); }
            const limit = 10;
            const [countRows] = await db.promise().query(`SELECT COUNT(id) AS total FROM surveys p ${where}`, params);
            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);
            if (page > lastPage && lastPage > 0) page = lastPage;
            const offset = (page - 1) * limit;
            const [rows] = await db.promise().query(
                `SELECT p.*,
                        (SELECT name FROM batches b WHERE b.b_id = p.target_bid LIMIT 1) AS batch_name,
                        (SELECT title FROM courses c WHERE c.req_id = p.target_cid LIMIT 1) AS course_name,
                        (SELECT COUNT(*) FROM survey_responses r WHERE r.survey_req_id = p.req_id AND r.skipped='0') AS responses,
                        (SELECT COUNT(*) FROM survey_responses r WHERE r.survey_req_id = p.req_id AND r.skipped='1') AS skips
                 FROM surveys p ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            const data = rows.map((r) => ({ ...r, questions: safeParse(r.questions, []) }));
            return res.json({ success: true, data, total, page, lastPage });
        } catch (err) { console.error("surveys:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: get one survey (for editing) ----
    router.post("/surveys/get", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query("SELECT * FROM surveys WHERE req_id=? LIMIT 1", [req.body.req_id]);
            if (!rows.length) return res.json({ success: false, message: "Survey not found" });
            const p = rows[0]; p.questions = safeParse(p.questions, []);
            return res.json({ success: true, data: p });
        } catch (err) { console.error("surveys/get:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: create / update a survey ----
    router.post("/surveys/save", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { req_id, title, description, questions, allow_skip, status } = req.body;
            // "public": a link anyone can answer (no course / batch); else students of one batch
            const audience = req.body.audience === "public" ? "public" : "students";
            // "feedback" or "survey": the wording, and the public link (/feedback/<id> or /survey/<id>)
            const kind = req.body.kind === "feedback" ? "feedback" : "survey";
            const target_bid = audience === "public" ? "" : String(req.body.target_bid || "").slice(0, 64);
            const target_cid = audience === "public" ? "" : String(req.body.target_cid || "").slice(0, 64);
            if (!title || !String(title).trim()) return res.json({ success: false, message: "Please enter a survey title" });
            if (audience === "students" && !target_bid) return res.json({ success: false, message: "Please choose a batch" });
            const qArr = Array.isArray(questions) ? questions : [];
            if (!qArr.length) return res.json({ success: false, message: "Add at least one question" });
            for (const q of qArr) {
                if (!q.label || !String(q.label).trim()) return res.json({ success: false, message: "Every question needs a label" });
                if (["single", "multi", "dropdown", "ranking"].includes(q.type) && !(q.options || []).filter(Boolean).length)
                    return res.json({ success: false, message: `"${q.label}" needs at least one option` });
            }
            const qJson = JSON.stringify(qArr);
            const st = String(status == null ? "1" : status);
            const skip = String(allow_skip == null ? "1" : allow_skip);

            if (req_id) {
                const [prev] = await db.promise().query("SELECT status FROM surveys WHERE req_id=? LIMIT 1", [req_id]);
                if (!prev.length) return res.json({ success: false, message: "Survey not found" });
                await db.promise().query(
                    "UPDATE surveys SET title=?, description=?, target_bid=?, target_cid=?, audience=?, kind=?, questions=?, allow_skip=?, status=? WHERE req_id=?",
                    [title.trim(), description || "", target_bid, target_cid, audience, kind, qJson, skip, st, req_id]
                );
                addactivity(ukey, req_id, "surveys", "Survey updated '" + title.trim() + "'", "", "");
                // Auto-email when a survey transitions into the active state.
                let emailed = 0;
                if (st === "1" && prev[0].status !== "1") emailed = await sendSurveyEmails({ req_id, title: title.trim(), description, target_bid, kind });
                return res.json({ success: true, message: "Survey updated", req_id, emailed });
            }

            const req_new = surveyReqId();
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                "INSERT INTO surveys (req_id, title, description, target_bid, target_cid, audience, kind, questions, allow_skip, status, created_by, datetime) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                [req_new, title.trim(), description || "", target_bid, target_cid, audience, kind, qJson, skip, st, ukey || "", datetime]
            );
            addactivity(ukey, req_new, "surveys", "New survey created '" + title.trim() + "'", "", "");
            let emailed = 0;
            if (st === "1") emailed = await sendSurveyEmails({ req_id: req_new, title: title.trim(), description, target_bid, kind });
            return res.json({ success: true, message: "Survey created", req_id: req_new, emailed });
        } catch (err) { console.error("surveys/save:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: delete a survey (+ its responses) ----
    router.post("/surveys/delete", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { req_id } = req.body;
            const [rows] = await db.promise().query("SELECT title FROM surveys WHERE req_id=? LIMIT 1", [req_id]);
            if (!rows.length) return res.json({ success: false, message: "Survey not found" });
            await db.promise().query("DELETE FROM survey_responses WHERE survey_req_id=?", [req_id]);
            await db.promise().query("DELETE FROM surveys WHERE req_id=?", [req_id]);
            addactivity(ukey, req_id, "surveys", "Survey deleted '" + rows[0].title + "'", "", "");
            return res.json({ success: true, message: "Survey deleted" });
        } catch (err) { console.error("surveys/delete:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: disable / enable (enable re-notifies the batch) ----
    router.post("/surveys/disable", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query("SELECT title FROM surveys WHERE req_id=? AND status='1' LIMIT 1", [req.body.req_id]);
            if (!rows.length) return res.json({ success: false, message: "There was something wrong, Please try again" });
            await db.promise().query("UPDATE surveys SET status='1S' WHERE req_id=? AND status='1'", [req.body.req_id]);
            addactivity(ukey, req.body.req_id, "surveys", "Survey disabled '" + rows[0].title + "'", "", "");
            return res.json({ success: true, message: "Survey disabled" });
        } catch (err) { console.error("surveys/disable:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    router.post("/surveys/enable", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query("SELECT req_id, title, description, target_bid, kind FROM surveys WHERE req_id=? AND status='1S' LIMIT 1", [req.body.req_id]);
            if (!rows.length) return res.json({ success: false, message: "There was something wrong, Please try again" });
            await db.promise().query("UPDATE surveys SET status='1' WHERE req_id=? AND status='1S'", [req.body.req_id]);
            addactivity(ukey, req.body.req_id, "surveys", "Survey enabled '" + rows[0].title + "'", "", "");
            const emailed = await sendSurveyEmails(rows[0]);
            return res.json({ success: true, message: "Survey enabled", emailed });
        } catch (err) { console.error("surveys/enable:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Admin: raw responses for one survey (+ questions + batch info) ----
    router.post("/surveys/responses", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [prows] = await db.promise().query("SELECT * FROM surveys WHERE req_id=? LIMIT 1", [req.body.req_id]);
            if (!prows.length) return res.json({ success: false, message: "Survey not found" });
            const survey = prows[0]; survey.questions = safeParse(survey.questions, []);
            const [rows] = await db.promise().query(
                `SELECT r.id, r.mem_id, r.answers, r.skipped, r.datetime, r.resp_name, r.resp_email, r.resp_phone,
                        (SELECT name FROM members m WHERE m.mem_id = r.mem_id LIMIT 1) AS name
                 FROM survey_responses r WHERE r.survey_req_id=? ORDER BY r.id DESC`,
                [req.body.req_id]
            );
            const data = rows.map((r) => ({
                ...r,
                // a public answer carries the name / email / phone typed before the questions
                name: r.name || r.resp_name || (String(r.mem_id).startsWith("public:") ? "Public visitor" : ""),
                email: r.resp_email || "",
                phone: r.resp_phone || "",
                answers: safeParse(r.answers, {}),
            }));
            const totalStudents = (await batchMembers(survey.target_bid)).length; // 0 for a public survey
            return res.json({ success: true, survey, data, totalStudents });
        } catch (err) { console.error("surveys/responses:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Admin: students of a survey's batch (for the email picker) ----
    router.post("/surveys/students", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [prows] = await db.promise().query("SELECT req_id, target_bid FROM surveys WHERE req_id=? LIMIT 1", [req.body.req_id]);
            if (!prows.length) return res.json({ success: false, message: "Survey not found" });
            const members = await batchMembers(prows[0].target_bid);
            const [ans] = await db.promise().query("SELECT mem_id, skipped FROM survey_responses WHERE survey_req_id=?", [prows[0].req_id]);
            const state = new Map(ans.map((a) => [String(a.mem_id), a.skipped === "1" ? "skipped" : "answered"]));
            const data = members.map((m) => ({ mem_id: m.mem_id, name: m.name || "", email: m.email || "", status: state.get(String(m.mem_id)) || "pending" }));
            return res.json({ success: true, data });
        } catch (err) { console.error("surveys/students:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Admin: (re-)send the notification email — to all, or a chosen subset ----
    router.post("/surveys/send-email", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query("SELECT req_id, title, description, target_bid, kind FROM surveys WHERE req_id=? LIMIT 1", [req.body.req_id]);
            if (!rows.length) return res.json({ success: false, message: "Survey not found" });
            // Cap a targeted send at 10 recipients (the client batches larger lists 10-by-10).
            const memIds = Array.isArray(req.body.mem_ids) ? req.body.mem_ids.slice(0, 10) : null;
            const emailed = await sendSurveyEmails(rows[0], memIds);
            return res.json({ success: true, message: `Email sent to ${emailed} student(s)`, emailed });
        } catch (err) { console.error("surveys/send-email:", err.message); return res.json({ success: false, message: "Server error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/surveys" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "surveys" },
    { table: "survey_responses" },
];
