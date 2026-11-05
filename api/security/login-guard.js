/* Sign-in protection: failed-attempt counting and IP / account blocks.

   - Every wrong sign-in is recorded in login_attempts (IP, what was typed,
     and the account's mem_id when the email / number exists).
   - MAX_FAILS wrong attempts within WINDOW seconds — from one IP, or against
     one account from anywhere — block that IP and that account for
     BLOCK_SECONDS (a "temp" row in login_blocks), and the account owner is
     emailed.
   - Admins can add blocks by hand (temporary for N hours, or permanent),
     revoke them, or delete them (Panel → Login Blocks).
   - Blocks only stop NEW sign-ins. Sessions that are already signed in are
     never touched.

   login_blocks.kind: "ip" | "account"; btype: "temp" | "perm";
   status: "1" active, "0" revoked; expires: unix seconds (0 = permanent). */

const crypto = require("crypto");

const MAX_FAILS = 3;
const WINDOW = 3 * 60 * 60;        // failures counted over the last 3 hours
const BLOCK_SECONDS = 3 * 60 * 60; // automatic block length: 3 hours

const now = () => Math.floor(Date.now() / 1000);
const newId = () => "b" + crypto.randomBytes(16).toString("hex");

async function ensureTables(db) {
    const q = (sql) => db.promise().query(sql);
    await q(`CREATE TABLE IF NOT EXISTS login_attempts (
        id BIGSERIAL PRIMARY KEY,
        ip TEXT NOT NULL DEFAULT '',
        ident TEXT NOT NULL DEFAULT '',
        mem_id TEXT NOT NULL DEFAULT '',
        datetime BIGINT NOT NULL DEFAULT 0
    )`);
    await q(`CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip, datetime)`);
    await q(`CREATE INDEX IF NOT EXISTS login_attempts_mem_idx ON login_attempts (mem_id, datetime)`);
    await q(`CREATE TABLE IF NOT EXISTS login_blocks (
        id BIGSERIAL PRIMARY KEY,
        b_id TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        value TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        btype TEXT NOT NULL DEFAULT 'temp',
        datetime BIGINT NOT NULL DEFAULT 0,
        expires BIGINT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT '1',
        created_by TEXT NOT NULL DEFAULT 'system',
        attempts INTEGER NOT NULL DEFAULT 0
    )`);
    await q(`CREATE INDEX IF NOT EXISTS login_blocks_lookup_idx ON login_blocks (kind, value, status)`);
}

// The active block for this IP / account, or null.
async function activeBlock(db, kind, value) {
    if (!value) return null;
    const [rows] = await db.promise().query(
        `SELECT * FROM login_blocks
         WHERE kind = ? AND value = ? AND status = '1' AND (btype = 'perm' OR expires > ?)
         ORDER BY (btype = 'perm') DESC, expires DESC LIMIT 1`,
        [kind, value, now()]
    );
    return rows[0] || null;
}

// What the sign-in page is told about a block.
function describe(block, kind) {
    const perm = block.btype === "perm";
    return {
        scope: kind,
        type: perm ? "perm" : "temp",
        until: perm ? 0 : Number(block.expires),
        remaining: perm ? 0 : Math.max(0, Number(block.expires) - now()),
        reason: block.reason || "",
    };
}

async function recordFailure(db, { ip, ident, mem_id }) {
    await db.promise().query(
        "INSERT INTO login_attempts (ip, ident, mem_id, datetime) VALUES (?, ?, ?, ?)",
        [ip || "", (ident || "").toLowerCase().slice(0, 200), mem_id || "", now()]
    );
    const since = now() - WINDOW;
    const [[byIp]] = await db.promise().query(
        "SELECT COUNT(id)::int AS n FROM login_attempts WHERE ip = ? AND datetime > ?", [ip || "", since]
    );
    let n = byIp.n;
    if (mem_id) {
        const [[byAcct]] = await db.promise().query(
            "SELECT COUNT(id)::int AS n FROM login_attempts WHERE mem_id = ? AND datetime > ?", [mem_id, since]
        );
        n = Math.max(n, byAcct.n);
    }
    return n; // failures in the window, including this one
}

async function clearFailures(db, { ip = "", mem_id = "" }) {
    if (ip) await db.promise().query("DELETE FROM login_attempts WHERE ip = ?", [ip]);
    if (mem_id) await db.promise().query("DELETE FROM login_attempts WHERE mem_id = ?", [mem_id]);
}

// Insert a block; any earlier active block on the same target is retired so
// there is exactly one live row per IP / account.
async function addBlock(db, { kind, value, label = "", reason = "", btype = "temp", seconds = BLOCK_SECONDS, by = "system", attempts = 0 }) {
    const t = now();
    await db.promise().query(
        "UPDATE login_blocks SET status = '0' WHERE kind = ? AND value = ? AND status = '1'", [kind, value]
    );
    const row = {
        b_id: newId(), kind, value, label, reason, btype,
        datetime: t, expires: btype === "perm" ? 0 : t + seconds, status: "1", created_by: by, attempts,
    };
    await db.promise().query(
        `INSERT INTO login_blocks (b_id, kind, value, label, reason, btype, datetime, expires, status, created_by, attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?)`,
        [row.b_id, kind, value, label, reason, btype, row.datetime, row.expires, by, attempts]
    );
    return row;
}

function fmtTime(ts) {
    return new Date(ts * 1000).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
    }) + " IST";
}

function blockEmail({ name, ip, until, perm, attempts }) {
    const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const when = fmtTime(now());
    const line = perm
        ? "Sign-in to your account has been <b>blocked</b>. Please contact our support team to restore access."
        : `Sign-in to your account is <b>blocked until ${esc(fmtTime(until))}</b> (3 hours). You can sign in again after that.`;
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <h2 style="color:#0a0f1e;margin:0 0 12px">Sign-in blocked on your Rivira Tech account</h2>
  <p>Hi ${esc(name || "there")},</p>
  <p>We noticed <b>${attempts || 3} incorrect password attempts</b> on your account, so we've temporarily stopped new sign-ins to keep it safe.</p>
  <p>${line}</p>
  <table style="border-collapse:collapse;margin:14px 0;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">Time</td><td>${esc(when)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">IP address</td><td>${esc(ip)}</td></tr>
    ${perm ? "" : `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Blocked until</td><td>${esc(fmtTime(until))}</td></tr>`}
  </table>
  <p>If this was you, wait for the block to end and use <b>Forgot Password</b> if you can't remember your password.
     If it wasn't you, someone may be trying to get into your account — reset your password once the block ends
     and contact us. Devices where you're already signed in are not affected.</p>
  <p style="color:#64748b;font-size:13px">— Rivira Tech</p>
</div>`;
}

module.exports = {
    MAX_FAILS, WINDOW, BLOCK_SECONDS,
    ensureTables, activeBlock, describe, recordFailure, clearFailures, addBlock, blockEmail, fmtTime, now,
};
