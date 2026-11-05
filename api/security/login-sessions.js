/* Sign-in sessions ("Remember this device" on the sign-in page).

   One login_sessions row per successful sign-in:
     mem_id      members.id (numeric)
     uid         this sign-in's UID (generateUID below)
     token       sha256 hex of mem_id + uid + pwd3 (the sid cookie)
     device      JSON: browser, OS, device type, user agent + what the page
                 reports (time zone, language, screen, platform) + country /
                 city when the site runs behind Cloudflare
     type        "R" = Remember this device (30 days), "N" = normal (1 day)
     status      'active' → 'logged_out' on logout
   The sign-in cookies follow the same choice: R keeps them for 30 days, N
   makes them browser-session cookies (gone when the browser closes). */

const crypto = require("crypto");

const REMEMBER_DAYS = 30;
const NORMAL_DAYS = 1;

async function ensureTable(db) {
    const q = (sql) => db.promise().query(sql);
    await q(`CREATE TABLE IF NOT EXISTS login_sessions (
        id BIGSERIAL PRIMARY KEY,
        mem_id BIGINT NOT NULL,
        token TEXT NOT NULL,
        device TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        ip_address INET,
        type TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'active'
    )`);
    await q(`CREATE INDEX IF NOT EXISTS login_sessions_member_idx ON login_sessions (mem_id, status)`);
    await q(`CREATE INDEX IF NOT EXISTS login_sessions_token_idx ON login_sessions (token)`);
}

// Small user-agent reader — enough to say "Chrome 130 on Windows (Desktop)".
function parseUserAgent(ua = "") {
    const pick = (re) => { const m = ua.match(re); return m ? m[1] : ""; };
    let browser = "Unknown", version = "";
    if (/Edg\//.test(ua)) { browser = "Edge"; version = pick(/Edg\/([\d.]+)/); }
    else if (/OPR\/|Opera/.test(ua)) { browser = "Opera"; version = pick(/(?:OPR|Opera)\/([\d.]+)/); }
    else if (/SamsungBrowser\//.test(ua)) { browser = "Samsung Internet"; version = pick(/SamsungBrowser\/([\d.]+)/); }
    else if (/Firefox\//.test(ua)) { browser = "Firefox"; version = pick(/Firefox\/([\d.]+)/); }
    else if (/Chrome\//.test(ua)) { browser = "Chrome"; version = pick(/Chrome\/([\d.]+)/); }
    else if (/Safari\//.test(ua)) { browser = "Safari"; version = pick(/Version\/([\d.]+)/); }

    let os = "Unknown";
    if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
    else if (/Windows/.test(ua)) os = "Windows";
    else if (/Android/.test(ua)) os = "Android " + pick(/Android ([\d.]+)/);
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS " + pick(/OS ([\d_]+)/).replace(/_/g, ".");
    else if (/Mac OS X/.test(ua)) os = "macOS";
    else if (/CrOS/.test(ua)) os = "ChromeOS";
    else if (/Linux/.test(ua)) os = "Linux";

    const deviceType = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
        ? "Tablet" : /Mobi|iPhone|Android/.test(ua) ? "Mobile" : "Desktop";

    return { browser, version: version.split(".")[0] || "", os: os.trim(), deviceType };
}

// What gets stored in login_sessions.device (JSON text).
function describeDevice(req, client = {}) {
    const ua = String(req.headers["user-agent"] || "").slice(0, 400);
    const clip = (v, n = 80) => (typeof v === "string" ? v.slice(0, n) : "");
    const h = (name) => clip(String(req.headers[name] || ""), 80);
    const info = {
        ...parseUserAgent(ua),
        userAgent: ua,
        timezone: clip(client.timezone),
        language: clip(client.language, 20),
        screen: clip(client.screen, 20),
        platform: clip(client.platform, 40),
        // filled when the site runs behind Cloudflare (it adds these headers)
        country: h("cf-ipcountry"),
        city: h("cf-ipcity"),
        region: h("cf-region"),
    };
    Object.keys(info).forEach((k) => { if (info[k] === "") delete info[k]; });
    return info;
}

/* A UID for each sign-in, e.g. UID3K7Q10A10-9F2C4E1A7B3D5068:
   UID + digit + letter + digit + letter + day + "A" + month, then 16 random hex
   characters. Everything random comes from crypto (Math.random() can be
   predicted), and the hex part makes the sid — a hash that includes the UID —
   impossible to guess even for someone who knew the rest of its inputs. Older
   UIDs without the hex part keep working until their session ends. */
function generateUID() {
    const digit = () => crypto.randomInt(10);
    const letter = () => String.fromCharCode(65 + crypto.randomInt(26));

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");

    return `UID${digit()}${letter()}${digit()}${letter()}${day}A${month}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

/* The sid cookie: sha256(mem_id + uid + pwd3). Sign-in also sets a "uid"
   cookie with the UID, and the UID is stored with the session: the check needs
   the uid cookie to match the session's UID and the sid to be the hash of this
   member + that UID + the current password — a password change ends every
   session. It is not tied to the IP
   (providers hand out new IPv6 addresses several times a day, which used to
   sign people out); the IP is still stored for the Login Sessions page. */
const makeToken = (memId, uid, pwd3) =>
    crypto.createHash("sha256").update(String(memId) + String(uid || "") + String(pwd3 || "")).digest("hex");

// Sessions started before the UID: sha256(id + ip + pwd3) (the same formula
// with the IP), or a random key + fingerprint. They keep working until they
// expire — at most 30 days — and new sign-ins always get a UID.
const nonceSign = (nonce, memId, pwd3) =>
    crypto.createHash("sha256").update(nonce + "|" + String(memId) + "|" + String(pwd3 || "")).digest("hex").slice(0, 32);
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// New session row; returns { token, uid, days }.
async function start(db, { memberId, ip, pwd3, remember, device }) {
    // Two sign-ins of one member on the same day could draw the same UID; draw again then.
    let uid = generateUID(), token = makeToken(memberId, uid, pwd3);
    for (let tries = 0; tries < 5; tries++) {
        const [dup] = await db.promise().query("SELECT 1 FROM login_sessions WHERE token = ? LIMIT 1", [token]);
        if (!dup.length) break;
        uid = generateUID(); token = makeToken(memberId, uid, pwd3);
    }
    const days = remember ? REMEMBER_DAYS : NORMAL_DAYS;
    // INET won't take an empty string / odd value — store NULL then
    const inet = /^[0-9a-fA-F:.]{3,45}$/.test(String(ip || "")) ? String(ip) : null;
    await db.promise().query(
        `INSERT INTO login_sessions (mem_id, uid, token, device, expires_at, ip_address, type, status)
         VALUES (?, ?, ?, ?, NOW() + (? || ' days')::interval, ?, ?, 'active')`,
        [memberId, uid, token, JSON.stringify(device || {}), String(days), inet, remember ? "R" : "N"]
    );
    return { token, uid, days };
}

/* Is this browser's sign-in still valid? `sid` and `uid` are the session
   cookies, `key` the mem_id cookie; memberId / pwd3 come from the members row. True only for
   an 'active', unexpired session of that member whose cookie still fits
   (the uid cookie is the session's UID, and sid = makeToken(member, uid, pwd3)). checkStatus()
   and /check-login both use it, so a session that was logged out, expired,
   ended from Login Sessions or outlived a password change stops working. */
async function verify(db, { sid, uid, key, memberId, pwd3, ip }) {
    if (typeof sid !== "string" || !/^[0-9a-f]{64}$/.test(sid) || !key) return false;
    const [rows] = await db.promise().query(
        `SELECT ls.uid
         FROM login_sessions ls
         JOIN members m ON m.id = ls.mem_id
         WHERE ls.token = ? AND m.mem_id = ? AND ls.status = 'active'
           AND (ls.expires_at IS NULL OR ls.expires_at > NOW())
         LIMIT 1`,
        [sid, key]
    );
    if (!rows.length) return false;
    const sessionUid = rows[0].uid;
    if (sessionUid) {
        return typeof uid === "string" && same(uid, sessionUid) && same(sid, makeToken(memberId, uid, pwd3));
    }
    // sessions from before the UID
    if (same(sid.slice(32), nonceSign(sid.slice(0, 32), memberId, pwd3))) return true;
    return same(sid, makeToken(memberId, ip, pwd3));
}

async function end(db, token) {
    if (!token) return;
    await db.promise().query(
        "UPDATE login_sessions SET status = 'logged_out' WHERE token = ? AND status = 'active'", [token]
    );
}

module.exports = { REMEMBER_DAYS, NORMAL_DAYS, ensureTable, describeDevice, parseUserAgent, start, end, verify, makeToken, generateUID };
