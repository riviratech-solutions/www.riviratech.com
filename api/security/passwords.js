/**
 * Password hashing for members.pwd3 (security audit retest, finding N2).
 *
 * Passwords used to be stored as unsalted md5(password), which is fast to crack
 * from any database dump or backup. New and changed passwords are now bcrypt
 * (salted, slow). Three formats can be in pwd3, and verifyPassword() accepts all:
 *
 *   "$2b$..."          bcrypt(password)        — current
 *   "bcmd5$$2b$..."    bcrypt(md5(password))   — an old MD5 hash wrapped by
 *                                               scripts/wrap-md5-passwords.js
 *   32 hex characters  md5(password)           — legacy, unsalted
 *
 * A successful sign-in with either legacy format re-hashes the password with
 * plain bcrypt (needsRehash), so accounts migrate as people sign in.
 */
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const ROUNDS = 12;
const WRAP_PREFIX = "bcmd5$";
const md5 = (s) => crypto.createHash("md5").update(String(s)).digest("hex");

// A real bcrypt hash to compare against when no account matched, so a wrong
// address takes as long as a wrong password (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync("kkr-timing-equaliser", ROUNDS);

function hashPassword(password) {
  return bcrypt.hash(String(password), ROUNDS);
}

async function verifyPassword(password, stored) {
  const s = String(stored || "");
  const p = String(password);
  if (s.startsWith("$2")) return bcrypt.compare(p, s);
  if (s.startsWith(WRAP_PREFIX)) return bcrypt.compare(md5(p), s.slice(WRAP_PREFIX.length));
  if (/^[a-f0-9]{32}$/i.test(s)) {
    const a = Buffer.from(md5(p));
    const b = Buffer.from(s.toLowerCase());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return false;
}

/** Spend the same time as a real check when there was no account to check. */
async function burnVerifyTime() {
  await bcrypt.compare("not-the-password", DUMMY_HASH);
}

/** True when pwd3 should be replaced with a fresh plain-bcrypt hash. */
function needsRehash(stored) {
  return !String(stored || "").startsWith("$2");
}

/** Wrap a legacy MD5 hash without knowing the password (used by the migration script). */
async function wrapMd5Hash(md5hex) {
  return WRAP_PREFIX + (await bcrypt.hash(String(md5hex).toLowerCase(), ROUNDS));
}

module.exports = { hashPassword, verifyPassword, burnVerifyTime, needsRehash, wrapMd5Hash, md5 };
