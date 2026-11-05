/**
 * API routes for src/pages/panel/student/MyFeedback.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, addactivity } = ctx;

    /* ===================== Student course feedback =====================
       Students rate the courses they are enrolled in (Panel → My Feedback).
       Stored in feedbacks with type 'f' — admins read them at Panel →
       Feedbacks. One feedback per student per course: sending it again
       updates the earlier one. */

    // the student's active courses (with titles) + their feedback so far
    router.post("/my-feedbacks", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "1"))) return;
            const { key: ukey } = req.cookies;
            const [courses] = await db.promise().query(
                `SELECT DISTINCT c.req_id, c.title
                 FROM member_courses mc
                 JOIN courses c ON c.req_id = mc.c_id
                 WHERE mc.mem_id = ? AND mc.status = '1'
                 ORDER BY c.title`, [ukey]
            );
            const [rows] = await db.promise().query(
                `SELECT f.id, f.course_id, c.title AS course, f.feedback, f.rating, f.datetime, f.status
                 FROM feedbacks f
                 LEFT JOIN courses c ON c.req_id = f.course_id
                 WHERE f.mem_id = ? AND f.type = 'f'
                 ORDER BY f.id DESC LIMIT 50`, [ukey]
            );
            return res.json({ success: true, courses, data: rows });
        } catch (err) {
            console.error("my-feedbacks:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    router.post("/add-feedback", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "1"))) return;
            const { key: ukey } = req.cookies;
            const course_id = String(req.body.course_id || "").trim();
            const rating = parseInt(req.body.rating, 10);
            const feedback = String(req.body.feedback || "").trim();
            if (!course_id) return res.json({ success: false, message: "Please choose a course" });
            if (!(rating >= 1 && rating <= 5)) return res.json({ success: false, message: "Please choose a rating" });
            if (feedback.length < 10) return res.json({ success: false, message: "Please write a little more (at least 10 characters)" });
            if (feedback.length > 2000) return res.json({ success: false, message: "Please keep it under 2000 characters" });

            // only courses the student is enrolled in
            const [enrolled] = await db.promise().query(
                "SELECT 1 FROM member_courses WHERE mem_id = ? AND c_id = ? AND status = '1' LIMIT 1", [ukey, course_id]
            );
            if (!enrolled.length) return res.json({ success: false, message: "You can only give feedback on your own courses" });

            const [[member]] = await db.promise().query("SELECT name FROM members WHERE mem_id = ? LIMIT 1", [ukey]);
            const datetime = Math.floor(Date.now() / 1000);
            const [existing] = await db.promise().query(
                "SELECT id FROM feedbacks WHERE mem_id = ? AND course_id = ? AND type = 'f' ORDER BY id DESC LIMIT 1", [ukey, course_id]
            );
            if (existing.length) {
                await db.promise().query(
                    "UPDATE feedbacks SET feedback = ?, rating = ?, name = ?, datetime = ?, status = '1' WHERE id = ?",
                    [feedback, rating, (member && member.name) || "", datetime, existing[0].id]
                );
                addactivity(ukey, String(existing[0].id), "feedbacks", "Course feedback updated (" + rating + "★)", "", "");
                return res.json({ success: true, message: "Your feedback was updated — thank you!" });
            }
            await db.promise().query(
                `INSERT INTO feedbacks (mem_id, course_id, name, feedback, rating, type, datetime, status)
                 VALUES (?, ?, ?, ?, ?, 'f', ?, '1')`,
                [ukey, course_id, (member && member.name) || "", feedback, rating, datetime]
            );
            addactivity(ukey, course_id, "feedbacks", "Course feedback given (" + rating + "★)", "", "");
            return res.json({ success: true, message: "Thank you for your feedback!" });
        } catch (err) {
            console.error("add-feedback:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });
};
