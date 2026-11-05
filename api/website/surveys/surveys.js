/**
 * The survey popup website visitors see (components/SurveyPopup.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

const { verifyLink } = require("../../security/link-signature");
const { verifyTurnstile } = require("../../security/turnstile");

module.exports = (router, ctx) => {
    const { db, safeParse, checkStatus, validateSecurity } = ctx;

    /* ---- Public: answer a survey via an emailed one-click link (?r=survey&u=member&s=sig) ----
       No login required. The member id (u) comes from the emailed link, which the
       server signed (s): member ids alone aren't secret (certificates show them),
       so an unsigned link — e.g. one emailed before links were signed — works only
       for that member when signed in. We still verify the survey is live and that
       the member belongs to the target batch. */

    // Validate the (survey r, member u) pair. Returns { survey, member } or an error string.
    const publicSurveyCheck = async (req) => {
        const { r, u, s } = req.body || {};
        if (!r || !u || typeof r !== "string" || typeof u !== "string") return { error: "Invalid link" };
        if (!verifyLink(s, "survey", r, u)) {
            const me = await checkStatus(req, "1");
            if (!me.success || !me.user || me.user[0].mem_id !== u) {
                return { error: "This survey link isn't valid. Please sign in to answer the survey." };
            }
        }
        const [prows] = await db.promise().query(
            "SELECT req_id, title, description, allow_skip, questions, target_bid FROM surveys WHERE req_id=? AND status='1' LIMIT 1", [r]
        );
        if (!prows.length) return { error: "Survey not found or closed" };
        const [mrows] = await db.promise().query("SELECT mem_id, name FROM members WHERE mem_id=? AND status='1' LIMIT 1", [u]);
        if (!mrows.length) return { error: "We couldn't find your account" };

        if (prows[0].target_bid) {
            const [courseRows] = await db.promise().query(
                `SELECT 1
                FROM member_courses
                WHERE mem_id = ?
                AND b_id = ?
                AND status = '1'
                LIMIT 1`,
                [u, prows[0].target_bid]
            );

            if (!courseRows.length) {
                return { error: "This survey is not for you" };
            }
        }

        return { survey: prows[0], member: mrows[0] };
    };

    // ---- Public: fetch a survey for the link popup ----
    router.post("/public/survey", async (req, res) => {
        try {
            const { survey, member, error } = await publicSurveyCheck(req);
            if (error) return res.json({ success: false, message: error });
            const [ans] = await db.promise().query(
                "SELECT skipped FROM survey_responses WHERE survey_req_id=? AND mem_id=? LIMIT 1", [survey.req_id, member.mem_id]
            );
            return res.json({
                success: true,
                name: member.name || "",
                answered: !!(ans.length && ans[0].skipped === "0"),
                data: {
                    req_id: survey.req_id, title: survey.title, description: survey.description,
                    allow_skip: survey.allow_skip, questions: safeParse(survey.questions, []),
                },
            });
        } catch (err) { console.error("public/survey:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Public: submit a survey answer via the link ----
    router.post("/public/survey-submit", async (req, res) => {
        try {
            const { survey, member, error } = await publicSurveyCheck(req);
            if (error) return res.json({ success: false, message: error });
            const questions = safeParse(survey.questions, []);
            const ans = (req.body.answers && typeof req.body.answers === "object") ? req.body.answers : {};
            for (const q of questions) {
                if (q.required) {
                    const v = ans[q.id];
                    const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
                    if (empty) return res.json({ success: false, message: `Please answer "${q.label}"` });
                }
            }
            const datetime = Math.floor(Date.now() / 1000);
            const [exist] = await db.promise().query("SELECT id FROM survey_responses WHERE survey_req_id=? AND mem_id=? LIMIT 1", [survey.req_id, member.mem_id]);
            if (exist.length) await db.promise().query("UPDATE survey_responses SET answers=?, skipped='0', datetime=? WHERE id=?", [JSON.stringify(ans), datetime, exist[0].id]);
            else await db.promise().query("INSERT INTO survey_responses (survey_req_id, mem_id, answers, skipped, datetime) VALUES (?,?,?, '0', ?)", [survey.req_id, member.mem_id, JSON.stringify(ans), datetime]);
            return res.json({ success: true, message: "Response recorded" });
        } catch (err) { console.error("public/survey-submit:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    /* ---- Public surveys (audience "public"): /survey/<req_id> on the website ----
       Anyone answers, no account: first their name, email and (optional) phone,
       then the questions. One response per person — the website keeps a cookie,
       and here a second response from the same browser (visitor id) or the same
       email is refused. Saved under mem_id "public:<visitor id>". A survey is a
       "survey" (/survey/<id>) or "feedback" (/feedback/<id>); the link must match. */
    const visitorId = (v) => (typeof v === "string" && /^[a-f0-9]{16,40}$/.test(v) ? v : "");
    const openSurvey = async (req_id, kind) => {
        if (!req_id || typeof req_id !== "string") return null;
        const [rows] = await db.promise().query(
            "SELECT req_id, title, description, questions, kind FROM surveys WHERE req_id=? AND status='1' AND audience='public' AND kind=? LIMIT 1",
            [req_id, kind === "feedback" ? "feedback" : "survey"]
        );
        return rows[0] || null;
    };
    const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

    router.post("/public/open-survey", async (req, res) => {
        try {
            const survey = await openSurvey(req.body.id, req.body.kind);
            if (!survey) return res.json({ success: false, message: "This survey is closed or doesn't exist" });
            const vid = visitorId(req.body.visitor);
            let answered = false;
            if (vid) {
                const [a] = await db.promise().query("SELECT 1 FROM survey_responses WHERE survey_req_id=? AND mem_id=? LIMIT 1", [survey.req_id, "public:" + vid]);
                answered = a.length > 0;
            }
            return res.json({
                success: true,
                answered,
                data: { req_id: survey.req_id, kind: survey.kind, title: survey.title, description: survey.description, allow_skip: "0", questions: safeParse(survey.questions, []) },
            });
        } catch (err) { console.error("public/open-survey:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    router.post("/public/open-survey-submit", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        if (!(await verifyTurnstile(req.body.captcha, req.ip)))
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        try {
            const survey = await openSurvey(req.body.id, req.body.kind);
            if (!survey) return res.json({ success: false, message: "This survey is closed or doesn't exist" });
            const vid = visitorId(req.body.visitor);
            if (!vid) return res.json({ success: false, message: "Please reload the page and try again" });

            // who is answering
            const name = clean(req.body.name, 80);
            const email = clean(req.body.email, 120).toLowerCase();
            const phoneRaw = clean(req.body.phone, 24);
            const phoneDigits = phoneRaw.replace(/\D/g, "");
            if (name.length < 2) return res.json({ success: false, message: "Please enter your name" });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.json({ success: false, message: "Please enter a valid email address" });
            if (phoneRaw && (phoneDigits.length < 6 || phoneDigits.length > 15 || /[^\d+\-\s()]/.test(phoneRaw)))
                return res.json({ success: false, message: "Please enter a valid phone number (or leave it empty)" });
            const phone = phoneRaw ? (phoneRaw.trim().startsWith("+") ? "+" : "") + phoneDigits : "";
            const questions = safeParse(survey.questions, []);
            const ans = (req.body.answers && typeof req.body.answers === "object" && !Array.isArray(req.body.answers)) ? req.body.answers : {};
            for (const q of questions) {
                if (q.required) {
                    const v = ans[q.id];
                    const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
                    if (empty) return res.json({ success: false, message: `Please answer "${q.label}"` });
                }
            }
            const json = JSON.stringify(ans);
            if (json.length > 20000) return res.json({ success: false, message: "Your answers are too long" });
            const memId = "public:" + vid;
            // one response per person: this browser, or this email
            const [exist] = await db.promise().query(
                "SELECT 1 FROM survey_responses WHERE survey_req_id=? AND (mem_id=? OR LOWER(resp_email)=?) LIMIT 1", [survey.req_id, memId, email]
            );
            if (exist.length) return res.json({ success: false, already: true, message: "You have already responded. Thank you!" });
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                "INSERT INTO survey_responses (survey_req_id, mem_id, answers, skipped, datetime, resp_name, resp_email, resp_phone) VALUES (?,?,?, '0', ?, ?, ?, ?)",
                [survey.req_id, memId, json, datetime, name, email, phone]
            );
            return res.json({ success: true, message: "Response recorded" });
        } catch (err) { console.error("public/open-survey-submit:", err.message); return res.json({ success: false, message: "Server error" }); }
    });

    // ---- Public: skip a survey via the link ----
    router.post("/public/survey-skip", async (req, res) => {
        try {
            const { survey, member, error } = await publicSurveyCheck(req);
            if (error) return res.json({ success: false, message: error });
            const [exist] = await db.promise().query("SELECT id, skipped FROM survey_responses WHERE survey_req_id=? AND mem_id=? LIMIT 1", [survey.req_id, member.mem_id]);
            if (!exist.length) {
                const datetime = Math.floor(Date.now() / 1000);
                await db.promise().query("INSERT INTO survey_responses (survey_req_id, mem_id, answers, skipped, datetime) VALUES (?,?, '{}', '1', ?)", [survey.req_id, member.mem_id, datetime]);
            }
            return res.json({ success: true, message: "Skipped" });
        } catch (err) { console.error("public/survey-skip:", err.message); return res.json({ success: false, message: "Server error" }); }
    });
};
