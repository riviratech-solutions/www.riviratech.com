/**
 * The survey popup students see in the panel (components/SurveyPopup.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, safeParse } = ctx;

    /* ---- Student: pending surveys, submit, skip ---- */

    // The logged-in student's batch id (cookie-derived, never from the body).
    const studentBid = async (req) => {
        // the student's batches (member_courses), as a list
        const [rows] = await db.promise().query(
            "SELECT DISTINCT b_id FROM member_courses WHERE mem_id = ? AND status = '1' AND COALESCE(b_id, '') <> ''",
            [req.cookies.key]
        );
        return rows.map((r) => r.b_id);
    };

    // ---- Student: active surveys for my batch I haven't answered or skipped ----
    router.post("/student/surveys/pending", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        try {
            const bid = await studentBid(req);
            const mem_id = req.cookies.key;
            const [surveys] = await db.promise().query("SELECT * FROM surveys WHERE status='1' ORDER BY id DESC");
            const [answered] = await db.promise().query("SELECT survey_req_id FROM survey_responses WHERE mem_id=?", [mem_id]);
            const done = new Set(answered.map((a) => a.survey_req_id));
            // Whole-batch targeting: the survey's batch id must appear in the student's bid.
            const mine = surveys
                .filter((p) => p.target_bid && bid.includes(p.target_bid) && !done.has(p.req_id))
                .map((p) => ({ req_id: p.req_id, title: p.title, description: p.description, allow_skip: p.allow_skip, questions: safeParse(p.questions, []) }));
            return res.json({ success: true, data: mine });
        } catch (err) { console.error("student/surveys/pending:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Student: submit answers to one survey (upsert) ----
    router.post("/student/surveys/submit", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        try {
            const mem_id = req.cookies.key;
            const bid = await studentBid(req);
            const { req_id, answers } = req.body;
            const [prows] = await db.promise().query("SELECT questions, target_bid FROM surveys WHERE req_id=? AND status='1' LIMIT 1", [req_id]);
            if (!prows.length) return res.json({ success: false, message: "Survey not found or closed" });
            if (!prows[0].target_bid || !bid.includes(prows[0].target_bid))
                return res.json({ success: false, message: "This survey is not for your batch" });
            const questions = safeParse(prows[0].questions, []);
            const ans = (answers && typeof answers === "object") ? answers : {};
            for (const q of questions) {
                if (q.required) {
                    const v = ans[q.id];
                    const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
                    if (empty) return res.json({ success: false, message: `Please answer "${q.label}"` });
                }
            }
            const datetime = Math.floor(Date.now() / 1000);
            const [exist] = await db.promise().query("SELECT id FROM survey_responses WHERE survey_req_id=? AND mem_id=? LIMIT 1", [req_id, mem_id]);
            if (exist.length) {
                await db.promise().query("UPDATE survey_responses SET answers=?, skipped='0', datetime=? WHERE id=?", [JSON.stringify(ans), datetime, exist[0].id]);
            } else {
                await db.promise().query("INSERT INTO survey_responses (survey_req_id, mem_id, answers, skipped, datetime) VALUES (?,?,?, '0', ?)", [req_id, mem_id, JSON.stringify(ans), datetime]);
            }
            return res.json({ success: true, message: "Response recorded" });
        } catch (err) { console.error("student/surveys/submit:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Student: skip one or more surveys (skip-all sends every pending req_id) ----
    router.post("/student/surveys/skip", async (req, res) => {
        if (!(await verifyAccount(req, res, "1"))) return;
        try {
            const mem_id = req.cookies.key;
            const ids = Array.isArray(req.body.req_ids) ? req.body.req_ids : (req.body.req_id ? [req.body.req_id] : []);
            const datetime = Math.floor(Date.now() / 1000);
            for (const id of ids) {
                const [exist] = await db.promise().query("SELECT id, skipped FROM survey_responses WHERE survey_req_id=? AND mem_id=? LIMIT 1", [id, mem_id]);
                if (exist.length) {
                    // Don't overwrite a real answer with a skip.
                    if (exist[0].skipped === "1") continue;
                } else {
                    await db.promise().query("INSERT INTO survey_responses (survey_req_id, mem_id, answers, skipped, datetime) VALUES (?,?, '{}', '1', ?)", [id, mem_id, datetime]);
                }
            }
            return res.json({ success: true, message: "Skipped" });
        } catch (err) { console.error("student/surveys/skip:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};
