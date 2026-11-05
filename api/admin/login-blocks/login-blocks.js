/**
 * API routes for src/pages/panel/admin/LoginBlocks.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const loginGuard = require("../../security/login-guard");

module.exports = (router, ctx) => {
    const { db, verifyAccount, addactivity } = ctx;

    /* ===================== Login blocks (Panel → Login Blocks) =====================
       Automatic blocks come from 3 failed sign-ins (login-guard.js); admins can
       add temporary / permanent blocks, revoke them, or delete the record. */
    const blockState = (b, t) =>
        b.status !== "1" ? "revoked" : b.btype === "perm" ? "active" : Number(b.expires) > t ? "active" : "expired";

    router.post("/login-blocks/list", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const t = loginGuard.now();
            const q = String(req.body.q || "").trim();
            const kind = ["ip", "account"].includes(req.body.kind) ? req.body.kind : "";
            const st = ["active", "expired", "revoked"].includes(req.body.st) ? req.body.st : "";
            const old = String(req.body.s || "") === "Old";
            const limit = 10;
            let page = Math.max(1, parseInt(req.body.n, 10) || 1);

            const conds = [];
            const params = [];
            if (q) {
                const like = "%" + q + "%";
                conds.push("(value ILIKE ? OR label ILIKE ? OR reason ILIKE ?)");
                params.push(like, like, like);
            }
            if (kind) { conds.push("kind = ?"); params.push(kind); }
            if (st === "active") { conds.push("status = '1' AND (btype = 'perm' OR expires > ?)"); params.push(t); }
            else if (st === "expired") { conds.push("status = '1' AND btype = 'temp' AND expires <= ?"); params.push(t); }
            else if (st === "revoked") { conds.push("status = '0'"); }
            const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

            const [[cnt]] = await db.promise().query(`SELECT COUNT(id)::int AS total FROM login_blocks ${where}`, params);
            const lastPage = Math.max(1, Math.ceil(cnt.total / limit));
            if (page > lastPage) page = lastPage;
            const [rows] = await db.promise().query(
                `SELECT id, b_id, kind, value, label, reason, btype, datetime, expires, status, created_by, attempts
                 FROM login_blocks ${where} ORDER BY id ${old ? "ASC" : "DESC"} LIMIT ? OFFSET ?`,
                [...params, limit, (page - 1) * limit]
            );
            // who added a manual block
            const adminIds = [...new Set(rows.map((r) => r.created_by).filter((v) => v && v !== "system"))];
            let names = {};
            if (adminIds.length) {
                const [admins] = await db.promise().query(
                    `SELECT mem_id, name FROM members WHERE mem_id IN (${adminIds.map(() => "?").join(",")})`, adminIds
                );
                names = Object.fromEntries(admins.map((a) => [a.mem_id, a.name]));
            }
            const data = rows.map((r) => ({
                ...r,
                state: blockState(r, t),
                remaining: r.btype === "temp" && r.status === "1" ? Math.max(0, Number(r.expires) - t) : 0,
                by: r.created_by === "system" ? "Automatic" : (names[r.created_by] || "Admin"),
            }));

            const [[stats]] = await db.promise().query(
                `SELECT
                    COUNT(*) FILTER (WHERE status = '1' AND (btype = 'perm' OR expires > ?))::int AS active,
                    COUNT(*) FILTER (WHERE status = '1' AND btype = 'perm')::int AS permanent,
                    COUNT(*) FILTER (WHERE status = '1' AND btype = 'temp' AND expires > ?)::int AS temporary,
                    COUNT(*)::int AS total
                 FROM login_blocks`, [t, t]
            );
            const [[recent]] = await db.promise().query(
                "SELECT COUNT(id)::int AS n FROM login_attempts WHERE datetime > ?", [t - 24 * 3600]
            );
            stats.failed24h = recent.n;

            return res.json({ success: true, data, stats, total: cnt.total, lastPage });
        } catch (err) {
            console.error("login-blocks/list:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // Add a block by hand: an IP address, or an account (email / phone number).
    router.post("/login-blocks/add", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { key: ukey } = req.cookies;
            const kind = req.body.kind === "account" ? "account" : req.body.kind === "ip" ? "ip" : "";
            const btype = req.body.btype === "perm" ? "perm" : "temp";
            const hours = Math.min(24 * 365, Math.max(1, parseInt(req.body.hours, 10) || 3));
            const reason = String(req.body.reason || "").trim().slice(0, 300) || "Blocked by admin";
            const target = String(req.body.value || "").trim();
            if (!kind) return res.json({ success: false, message: "Choose IP address or account" });
            if (!target) return res.json({ success: false, message: kind === "ip" ? "Enter an IP address" : "Enter the account's email or phone number" });

            let value = target, label = target;
            if (kind === "ip") {
                if (!/^[0-9a-fA-F:.]{3,45}$/.test(target)) return res.json({ success: false, message: "Enter a valid IP address" });
            } else {
                const byNumber = /^\d{9,15}$/.test(target);
                const [rows] = await db.promise().query(
                    `SELECT mem_id, name, email, number, status FROM members WHERE ${byNumber ? "number" : "LOWER(email)"} = ? ORDER BY id ASC LIMIT 1`,
                    [byNumber ? target : target.toLowerCase()]
                );
                if (!rows.length) return res.json({ success: false, message: "No account found with that email / phone number" });
                if (rows[0].mem_id === ukey) return res.json({ success: false, message: "You can't block your own account" });
                value = rows[0].mem_id;
                label = rows[0].email || rows[0].number || target;
            }
            const row = await loginGuard.addBlock(db, { kind, value, label, reason, btype, seconds: hours * 3600, by: ukey });
            addactivity(ukey, row.b_id, "login_blocks",
                "Login block added: " + kind + " " + label + " (" + (btype === "perm" ? "permanent" : hours + "h") + ")", "", "");
            return res.json({ success: true, message: btype === "perm" ? "Permanent block added" : "Blocked for " + hours + " hour" + (hours > 1 ? "s" : "") });
        } catch (err) {
            console.error("login-blocks/add:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // Revoke: the block stops now and the failed-attempt count starts over.
    router.post("/login-blocks/revoke", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { key: ukey } = req.cookies;
            const [rows] = await db.promise().query("SELECT * FROM login_blocks WHERE b_id = ? LIMIT 1", [req.body.id || ""]);
            if (!rows.length) return res.json({ success: false, message: "Block not found" });
            const b = rows[0];
            await db.promise().query("UPDATE login_blocks SET status = '0' WHERE b_id = ?", [b.b_id]);
            await loginGuard.clearFailures(db, b.kind === "ip" ? { ip: b.value } : { mem_id: b.value });
            addactivity(ukey, b.b_id, "login_blocks", "Login block revoked: " + b.kind + " " + (b.label || b.value), "", "");
            return res.json({ success: true, message: "Block revoked" });
        } catch (err) {
            console.error("login-blocks/revoke:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    router.post("/login-blocks/delete", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { key: ukey } = req.cookies;
            const [rows] = await db.promise().query("SELECT kind, value, label FROM login_blocks WHERE b_id = ? LIMIT 1", [req.body.id || ""]);
            if (!rows.length) return res.json({ success: false, message: "Block not found" });
            await db.promise().query("DELETE FROM login_blocks WHERE b_id = ?", [req.body.id]);
            addactivity(ukey, req.body.id, "login_blocks", "Login block deleted: " + rows[0].kind + " " + (rows[0].label || rows[0].value), "", "");
            return res.json({ success: true, message: "Block deleted" });
        } catch (err) {
            console.error("login-blocks/delete:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/login-blocks" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "login_blocks" },
];
