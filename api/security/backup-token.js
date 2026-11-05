/* The admin "security token" (BACKUP_SECURITY_TOKEN in api/.env) — asked for
   before a database backup download and before a course is deleted for good.

   It is checked here on the server only; the panel never has the value.
   A member gets MAX_TRIES wrong tries per WINDOW_MS, then has to wait. The
   wrong tries are counted in the database (security_token_fails), so every API
   copy of the cluster (../cluster.js) shares the count. */
const crypto = require("crypto");
const db = require("../shared/pgdb");
const startup = require("../shared/startup");

const MAX_TRIES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const ready = startup.setup("security_token_fails table", () =>
    db.pool.query(`CREATE TABLE IF NOT EXISTS security_token_fails (
        mem_id TEXT PRIMARY KEY,
        n INTEGER NOT NULL,
        until TIMESTAMPTZ NOT NULL
    )`)
);
startup.leaderInterval(
    "security_token_fails clean-up",
    () => db.pool.query("DELETE FROM security_token_fails WHERE until < now()"),
    60 * 60 * 1000
);

// tolerant of a .env line written as  KEY = "value";  (dotenv then keeps the
// quotes and the semicolon as part of the value)
const configured = () =>
    String(process.env.BACKUP_SECURITY_TOKEN || "")
        .trim()
        .replace(/;+$/, "")
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2")
        .trim();

const waitText = (until) => {
    const mins = Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60000));
    return `Too many wrong security tokens. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
};

/** Resolves to { ok: true } or { ok: false, message } */
async function checkSecurityToken(memId, given) {
    const secret = configured();
    if (!secret) return { ok: false, message: "The security token is not set up on the server (BACKUP_SECURITY_TOKEN)." };

    const key = String(memId || "");
    await ready;
    const { rows } = await db.pool.query(
        "SELECT n, until FROM security_token_fails WHERE mem_id = $1 AND until > now()",
        [key]
    );
    const f = rows[0];
    if (f && f.n >= MAX_TRIES) return { ok: false, message: waitText(f.until) };

    const a = Buffer.from(String(given || "").trim());
    const b = Buffer.from(secret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        await db.pool.query("DELETE FROM security_token_fails WHERE mem_id = $1", [key]);
        return { ok: true };
    }

    // count this wrong try: a new window if the last one has ended
    const { rows: [next] } = await db.pool.query(
        `INSERT INTO security_token_fails (mem_id, n, until)
         VALUES ($1, 1, now() + make_interval(secs => $2::double precision))
         ON CONFLICT (mem_id) DO UPDATE SET
            n = CASE WHEN security_token_fails.until <= now() THEN 1 ELSE security_token_fails.n + 1 END,
            until = CASE WHEN security_token_fails.until <= now() THEN EXCLUDED.until ELSE security_token_fails.until END
         RETURNING n, until`,
        [key, WINDOW_MS / 1000]
    );
    const left = MAX_TRIES - next.n;
    return { ok: false, message: left > 0 ? `Invalid security token (${left} tr${left === 1 ? "y" : "ies"} left).` : "Invalid security token. Try again in 15 minutes." };
}

module.exports = { checkSecurityToken };
