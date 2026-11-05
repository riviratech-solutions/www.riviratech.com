/**
 * One-time migration for audit finding N2: protect every remaining unsalted MD5
 * password hash right away, without waiting for each person to sign in.
 *
 * Each 32-hex md5(password) in members.pwd3 becomes "bcmd5$" + bcrypt(md5),
 * which passwords.js still verifies; the next successful sign-in then re-hashes
 * it to plain bcrypt. Nobody's password changes.
 *
 * Side effect: sign-in sessions are bound to the stored hash, so affected
 * accounts are signed out once and sign in again as normal.
 *
 *   node scripts/wrap-md5-passwords.js            dry run — only counts (run from api/)
 *   node scripts/wrap-md5-passwords.js --apply    wrap them
 *
 * Run it against each database (local and staging). Safe to run again.
 */
require("dotenv").config({ quiet: true });
const db = require("../shared/pgdb");
const { wrapMd5Hash } = require("../security/passwords");

const q = (sql, params = []) => db.promise().query(sql, params).then(([rows]) => rows);

(async () => {
  const apply = process.argv.includes("--apply");
  const rows = await q("SELECT id, pwd3 FROM members WHERE pwd3 ~* '^[a-f0-9]{32}$'");
  const [{ n: total }] = await q("SELECT COUNT(*)::int AS n FROM members");
  console.log(`${rows.length} of ${total} accounts still have an unsalted MD5 password hash.`);

  if (!apply) {
    console.log(rows.length ? "Dry run — nothing changed. Re-run with --apply to wrap them." : "Nothing to do.");
    process.exit(0);
  }

  let done = 0;
  for (const r of rows) {
    const wrapped = await wrapMd5Hash(r.pwd3);
    // only if it hasn't changed since we read it (e.g. the person just signed in)
    const res = await q("UPDATE members SET pwd3 = ? WHERE id = ? AND pwd3 = ?", [wrapped, r.id, r.pwd3]);
    if (res && res.affectedRows !== 0) done++;
  }
  console.log(`Wrapped ${done} hash(es). They now verify through bcrypt.`);
  process.exit(0);
})().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
