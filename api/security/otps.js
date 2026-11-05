/* One-time passwords, kept in their own table instead of members.otp.

   otps: id (auto), mem_id, otp, type, datetime, expires
   `type` says what the code is for — "reset" (forgot password), "activate"
   (account activation), … Each member has at most one live code per type:
   issuing a new one replaces the old, and a code is deleted once used.
   Codes expire after `ttl` seconds (10 minutes by default), and a code is
   deleted after MAX_ATTEMPTS wrong guesses, so it can't be guessed by trying
   many numbers (a new code has to be requested then). */

const crypto = require("crypto");

const DEFAULT_TTL = 10 * 60;
const MAX_ATTEMPTS = 5;
const now = () => Math.floor(Date.now() / 1000);

async function ensureTable(db) {
    const q = (sql) => db.promise().query(sql);
    await q(`CREATE TABLE IF NOT EXISTS otps (
        id BIGSERIAL PRIMARY KEY,
        mem_id TEXT NOT NULL,
        otp TEXT NOT NULL,
        type TEXT NOT NULL,
        datetime BIGINT NOT NULL DEFAULT 0,
        expires BIGINT NOT NULL DEFAULT 0
    )`);
    await q(`CREATE INDEX IF NOT EXISTS otps_member_type_idx ON otps (mem_id, type)`);
}

// A new 6-digit code for this member + purpose (replaces any earlier one).
async function issue(db, { mem_id, type, ttl = DEFAULT_TTL }) {
    const otp = String(crypto.randomInt(100000, 1000000));
    const t = now();
    await db.promise().query("DELETE FROM otps WHERE mem_id = ? AND type = ?", [mem_id, type]);
    await db.promise().query(
        "INSERT INTO otps (mem_id, otp, type, datetime, expires) VALUES (?, ?, ?, ?, ?)",
        [mem_id, otp, type, t, t + ttl]
    );
    return otp;
}

// "ok" | "expired" | "invalid"
async function check(db, { mem_id, type, otp }) {
    const [rows] = await db.promise().query(
        "SELECT id, otp, expires FROM otps WHERE mem_id = ? AND type = ? ORDER BY id DESC LIMIT 1",
        [mem_id, type]
    );
    const row = rows[0];
    if (!row) return "invalid";
    const given = String(otp || "");
    if (given.length !== row.otp.length ||
        !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(row.otp))) {
        await countWrongGuess(db, row.id);
        return "invalid";
    }
    return Number(row.expires) > now() ? "ok" : "expired";
}

// One more wrong guess at this code; the last allowed one deletes it.
async function countWrongGuess(db, id) {
    try {
        await db.promise().query("UPDATE otps SET attempts = attempts + 1 WHERE id = ?", [id]);
        await db.promise().query("DELETE FROM otps WHERE id = ? AND attempts >= ?", [id, MAX_ATTEMPTS]);
    } catch (err) {
        console.error("otps attempts:", err.message);
    }
}

// Used up: remove every code of this purpose for the member.
async function consume(db, { mem_id, type }) {
    await db.promise().query("DELETE FROM otps WHERE mem_id = ? AND type = ?", [mem_id, type]);
}

module.exports = { DEFAULT_TTL, MAX_ATTEMPTS, ensureTable, issue, check, consume };
