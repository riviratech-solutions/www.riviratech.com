/**
 * A student's referral link: https://www.riviratech.com/enroll?r=<code>
 * (Share referral link on src/pages/panel/student/MyReferrals.tsx).
 *
 * members.refer_code holds a short random code (e.g. "K7Q2MX") made the first
 * time the student asks for their link; the link carries the code, never the
 * member id. Opening it fills "Refer By" on the website's enroll form
 * (src/pages/website/Enroll.tsx, GET /api/public/referrer); enrolling through it
 * adds the friend to the student's referrals (the refers table, so My Referrals
 * shows them as Applied, then Joined) and emails the student.
 */
const crypto = require("crypto");
const { queueMail } = require("./mail");

const SITE = "https://www.riviratech.com";
// no I / L / O / 0 / 1: easy to read out or type
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE = /^[A-Z2-9]{6}$/;

const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const titleCase = (v) => String(v || "").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const tail = (v) => String(v || "").replace(/\D/g, "").slice(-10);

const newCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");

/** The student's code, made (and saved) the first time. */
async function codeFor(db, memId) {
    const q = (s, p) => db.pool.query(s, p).then((r) => r.rows);
    const [m] = await q("SELECT refer_code FROM members WHERE mem_id = $1 LIMIT 1", [memId]);
    if (!m) return "";
    if (CODE.test(m.refer_code || "")) return m.refer_code;
    for (let i = 0; i < 8; i++) {
        const code = newCode();
        try {
            const [set] = await q("UPDATE members SET refer_code = $2 WHERE mem_id = $1 AND COALESCE(refer_code, '') = '' RETURNING refer_code", [memId, code]);
            if (set) return set.refer_code;
            // another request set it meanwhile
            const [again] = await q("SELECT refer_code FROM members WHERE mem_id = $1", [memId]);
            if (again && CODE.test(again.refer_code || "")) return again.refer_code;
        } catch (err) {
            if (err.code !== "23505") throw err; // taken by another student: try another
        }
    }
    throw new Error("Could not make a referral code");
}

/** The active student a code belongs to, or null. */
async function referrerOf(db, code) {
    const c = String(code || "").trim().toUpperCase();
    if (!CODE.test(c)) return null;
    const [m] = (await db.pool.query(
        "SELECT mem_id, name, email, number FROM members WHERE refer_code = $1 AND status = '1' LIMIT 1", [c])).rows;
    return m || null;
}

/** A website enrollment made through a referral link: the friend is added to the
    student's referrals (not twice, not themselves) and the student is emailed.
    Never throws: the enrollment itself is already saved. */
async function recordEnrollment(db, { code, name, email, phone, courseId }) {
    try {
        const ref = await referrerOf(db, code);
        if (!ref) return;
        const q = (s, p) => db.pool.query(s, p).then((r) => r.rows);
        const mail = String(email || "").trim().toLowerCase();
        if (!mail) return;
        // using their own link doesn't count
        if (mail === String(ref.email || "").trim().toLowerCase() || (tail(phone) && tail(phone) === tail(ref.number))) return;
        // already referred by this student (same email or phone)
        const dup = await q(
            `SELECT 1 FROM refers WHERE mem_id = $1 AND status IN ('1','2','3')
               AND (LOWER(TRIM(email)) = $2 OR ($3 <> '' AND RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $3)) LIMIT 1`,
            [ref.mem_id, mail, tail(phone)]);
        if (dup.length) return;
        const now = Math.floor(Date.now() / 1000);
        await q("INSERT INTO refers (mem_id, course_id, name, email, phone, datetime, status) VALUES ($1, $2, $3, $4, $5, $6, '1')",
            [ref.mem_id, String(courseId || ""), String(name || "").trim(), mail, String(phone || ""), now]);

        // tell the student
        let course = "";
        if (courseId) {
            const [c] = await q("SELECT title FROM courses WHERE req_id = $1 LIMIT 1", [String(courseId)]);
            course = c ? String(c.title || "").trim() : "";
        }
        if (!ref.email) return;
        const friend = titleCase(name) || "A friend";
        const html = `
            <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
              <h2 style="color:#2c3e50;">🎉 ${esc(friend)} enrolled through your referral link</h2>
              <p>Hi ${esc(titleCase(ref.name) || "there")},</p>
              <p>Good news! <b>${esc(friend)}</b> has just applied${course ? ` for <b>${esc(course)}</b>` : ""} at
                 <b>Rivira Technologies</b> using your referral link.</p>
              <p>You can follow their progress — Applied, then Joined — on your
                 <a href="${SITE}/panel/my-referrals">My Referrals</a> page.</p>
              <p>Thank you for spreading the word!</p>
              <br>
              <p>Best Regards,<br><b>Rivira Technologies Team</b><br>🌐 www.riviratech.com</p>
            </div>`;
        await queueMail(String(ref.email).trim().toLowerCase(), `${friend} enrolled through your referral link – Rivira Technologies`, html);
    } catch (err) {
        console.error("referral link enrollment:", err.message);
    }
}

module.exports = { SITE, codeFor, referrerOf, recordEnrollment, CODE };
