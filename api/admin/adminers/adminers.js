/**
 * API routes for src/pages/panel/admin/Adminers.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { hashPassword } = require("../../security/passwords");
const crypto = require("crypto");
const adminPerms = require("../../security/admin-permissions");

module.exports = (router, ctx) => {
    const { db, md5, randomId, checkStatus, verifyAccount, addactivity } = ctx;

    /* ===================== Adminers (panel accounts) =====================
       Adminers are members with status "X" (super admin) or "Y" (admin). Both
       roles can VIEW the list; only a super admin (X) may add / edit / delete. */

    // ---- List adminers (X + Y may view) ----
    router.post("/adminers", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [rows] = await db.promise().query(
                `SELECT id, mem_id, name, email, number, status, datetime, permissions
                 FROM members WHERE status IN ('X','Y') ORDER BY (status='X') DESC, id DESC`
            );
            // Only a super admin sees (and edits) other adminers' permissions.
            const isSuper = req.cookies.id === "X";
            const data = rows.map(({ permissions, ...r }) => (isSuper
                ? { ...r, permissions: adminPerms.parsePermissions(permissions) }
                : r));
            return res.json({ success: true, data, me: req.cookies.key, catalogue: isSuper ? adminPerms.CATALOGUE : undefined });
        } catch (err) { console.error("adminers:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- Create / update an adminer (super admin X only) ----
    router.post("/adminers/save", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X"))) return;
        try {
            const { mem_id, name, email, number, password, status } = req.body;
            // Page permissions apply to Admins (Y); a super admin (X) has everything.
            if (!name || !String(name).trim()) return res.json({ success: false, message: "Please enter a name" });
            if (!email || !/^\S+@\S+\.\S+$/.test(String(email))) return res.json({ success: false, message: "Please enter a valid email" });
            const st = status === "X" ? "X" : status === "Y" ? "Y" : "";
            if (!st) return res.json({ success: false, message: "Please choose a role" });
            const perms = st === "Y" ? JSON.stringify(adminPerms.sanitizePermissions(req.body.permissions)) : null;
            if (mem_id && mem_id === ukey && st !== "X") return res.json({ success: false, message: "You can't remove super admin from your own account" });

            // Email must be unique across all members.
            const [dup] = await db.promise().query("SELECT mem_id FROM members WHERE LOWER(email)=LOWER(?) AND mem_id != ? LIMIT 1", [email.trim(), mem_id || ""]);
            if (dup.length) return res.json({ success: false, message: "That email is already in use" });

            if (mem_id) {
                // Update — only touch adminer rows (X/Y), never a student/trainer.
                const [rows] = await db.promise().query("SELECT status FROM members WHERE mem_id=? AND status IN ('X','Y') LIMIT 1", [mem_id]);
                if (!rows.length) return res.json({ success: false, message: "Adminer not found" });
                if (password && String(password).length >= 4) {
                    await db.promise().query("UPDATE members SET name=?, email=?, number=?, status=?, permissions=?, pwd3=? WHERE mem_id=?",
                        [name.trim(), email.trim(), number || "", st, perms, await hashPassword(password), mem_id]);
                } else {
                    await db.promise().query("UPDATE members SET name=?, email=?, number=?, status=?, permissions=? WHERE mem_id=?",
                        [name.trim(), email.trim(), number || "", st, perms, mem_id]);
                }
                addactivity(ukey, mem_id, "adminers", "Adminer updated '" + name.trim() + "'", "", "");
                return res.json({ success: true, message: "Adminer updated" });
            }

            // Create.
            if (!password || String(password).length < 4) return res.json({ success: false, message: "Password must be at least 4 characters" });
            const newId = "a" + md5(crypto.randomBytes(16).toString("hex") + Date.now() + email);
            // the token / aut sign-in secrets: random, not guessable
            const pwd1 = randomId();
            const pwd2 = randomId();
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                `INSERT INTO members (mem_id, name, email, number, pwd1, pwd2, pwd3, datetime, lastdatetime, status, permissions)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [newId, name.trim(), email.trim(), number || "", pwd1, pwd2, await hashPassword(password), datetime, "", st, perms]
            );
            addactivity(ukey, newId, "adminers", "New adminer added '" + name.trim() + "'", "", "");
            return res.json({ success: true, message: "Adminer added" });
        } catch (err) { console.error("adminers/save:", err.message); return res.json({ success: false, message: "Database error" }); }
    });

    // ---- The signed-in adminer's own page permissions (sidebar + page guard) ----
    // Cookie check only (no one-time token), so it never races the page's own calls.
    router.get("/my-permissions", async (req, res) => {
        const ok = await checkStatus(req, "X,Y");
        // students / trainers have no adminer permissions — a plain "no", not
        // a 401, so their panel pages don't log an error on every navigation
        if (!ok.success) return res.json({ success: false, message: ok.message });
        const user = ok.user[0];
        const perms = user.status === "Y" ? adminPerms.parsePermissions(user.permissions) : null;
        return res.json({
            success: true,
            role: user.status,
            full: perms == null,
            permissions: perms == null ? adminPerms.fullPermissions() : perms,
            catalogue: adminPerms.CATALOGUE,
        });
    });

    // ---- Delete an adminer (super admin X only) ----
    router.post("/adminers/delete", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X"))) return;
        try {
            const { mem_id } = req.body;
            if (!mem_id) return res.json({ success: false, message: "Invalid adminer" });
            if (mem_id === ukey) return res.json({ success: false, message: "You can't delete your own account" });
            const [rows] = await db.promise().query("SELECT name FROM members WHERE mem_id=? AND status IN ('X','Y') LIMIT 1", [mem_id]);
            if (!rows.length) return res.json({ success: false, message: "Adminer not found" });
            await db.promise().query("DELETE FROM members WHERE mem_id=? AND status IN ('X','Y')", [mem_id]);
            addactivity(ukey, mem_id, "adminers", "Adminer deleted '" + rows[0].name + "'", "", "");
            return res.json({ success: true, message: "Adminer deleted" });
        } catch (err) { console.error("adminers/delete:", err.message); return res.json({ success: false, message: "Database error" }); }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/adminers" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "members", when: "left(OLD.status, 1) IN ('X', 'Y')" },
];
