/**
 * API routes for src/pages/panel/admin/LoginSessions.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, addactivity, sendSessions } = ctx;

    // admin: any member (Panel → Login Sessions, from Adminers / Trainers / Students)
    router.post("/login-sessions/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        return sendSessions(req, res, String(req.body.m || "").trim());
    });

    // Sign a device out: that session can no longer be used.
    router.post("/login-sessions/end", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { key: ukey } = req.cookies;
            const id = parseInt(req.body.id, 10);
            if (!id) return res.json({ success: false, message: "Invalid session" });
            const [rows] = await db.promise().query(
                "SELECT ls.id, m.name, m.mem_id FROM login_sessions ls LEFT JOIN members m ON m.id = ls.mem_id WHERE ls.id = ? LIMIT 1", [id]
            );
            if (!rows.length) return res.json({ success: false, message: "Session not found" });
            const [upd] = await db.promise().query(
                "UPDATE login_sessions SET status = 'revoked' WHERE id = ? AND status = 'active'", [id]
            );
            if (!(upd.affectedRows >= 1)) return res.json({ success: false, message: "That session has already ended" });
            addactivity(ukey, rows[0].mem_id || String(id), "login_sessions", "Signed out a session of '" + (rows[0].name || "") + "'", "", "");
            return res.json({ success: true, message: "Session signed out" });
        } catch (err) {
            console.error("login-sessions/end:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });
};
