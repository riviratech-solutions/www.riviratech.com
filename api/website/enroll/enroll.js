/**
 * API routes for src/pages/website/Enroll.tsx.
 * Also used by the program and course-plan pages' enrol buttons.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");
const sendMail = require("../../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails
const { verifyTurnstile } = require("../../security/turnstile");
const { isFullProgramPlan, fullProgramFee } = require("../../shared/program-prices");
const referralLink = require("../../shared/referral-link");

// Course titles are saved HTML-escaped (&amp;); decode before escaping for the email.
const decodeEntities = (v) => String(v == null ? "" : v).replace(/&(amp|lt|gt|quot|#39);/g,
  (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[m]);

module.exports = (router, ctx) => {
    const { db, md5, escapeHtml, validateSecurity } = ctx;

    router.post("/enroll", async (req, res) => {

      const {
        name,
        email,
        phone,
        fullphone,
        gender,
        qualification,
        course,
        referby,
        addon,
        plan,
        fees,
        currency,
        ref // a referral link's code (?r=…): the student who referred them
      } = req.body;

      // Session Tokens
      const security = validateSecurity(req);
      if (!security.success) {
        return res.json(security);
      }

      if (!req.body.captcha) {
        return res.json({
          success: false,
          message: "Captcha token is missing."
        });
      }

      // ---------------- CAPTCHA ----------------
      if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
        return res.json({ success: false, message: "Captcha verification failed, please try again" });
      }

      // ---------------- VALIDATION ----------------
      // text fields only, of a sensible length (this form is public)
      const tooLong = { name: 100, email: 254, phone: 20, fullphone: 24, gender: 2, qualification: 200,
        course: 64, referby: 100, addon: 100, plan: 200, currency: 8 };
      for (const [field, max] of Object.entries(tooLong)) {
        const v = req.body[field];
        if (v != null && (typeof v !== "string" || v.length > max))
          return res.json({ success: false, message: "Please check the " + field + " field" });
      }

      if (!name || name.length < 3)
        return res.json({ success: false, message: "Please enter full name" });

      if (!phone || phone.length !== 10 || !fullphone || fullphone.length <= 10)
        return res.json({ success: false, message: "Please enter valid contact number" });

      if (!email || !/^\S+@\S+\.\S+$/.test(email))
        return res.json({ success: false, message: "Please enter valid email" });

      if (!gender || !["1", "2", "3"].includes(gender))
        return res.json({ success: false, message: "Please select gender" });

      if (!qualification || qualification.length < 2)
        return res.json({ success: false, message: "Please enter qualification details" });

      if (!course)
        return res.json({ success: false, message: "Please select preferred course" });
      // a course marked "not enrollable" in Admin → Courses can't be enrolled in
      try {
        const [[c] = []] = await db.promise().query("SELECT enrollable FROM courses WHERE req_id = ? LIMIT 1", [course]);
        if (c && String(c.enrollable) === "0")
          return res.json({ success: false, message: "This course is not open for enrolment" });
      } catch (e) { console.error("enroll course check:", e.message); }

      // ---------------- DUPLICATE CHECK ----------------
      db.query(
        "SELECT * FROM enrollees WHERE email=? OR number=? LIMIT 1",
        [email, fullphone],
        (err, rows) => {
          if (err) return res.json({ success: false, message: "DB Error" });

          if (rows.length > 0) {

            const emailExists = rows.some(row => row.email === email);
            const phoneExists = rows.some(row => row.number === fullphone);

            if (emailExists && phoneExists) {
              return res.json({
                success: false,
                message: "Email and Phone already registered"
              });
            }

            if (emailExists) {
              return res.json({
                success: false,
                message: "Email already registered"
              });
            }

            if (phoneExists) {
              return res.json({
                success: false,
                message: "Phone already registered"
              });
            }
          }

          // ---------------- INSERT ----------------
          // req_id is the student's payment-link token (/payment?t=…): random, not guessable
          const req_id = "a" + crypto.randomBytes(16).toString("hex");
          // The Full Program is charged at the server's price; any other plan's
          // fee is only a note for the admin, who confirms the amount before a
          // payment link is sent (website/payment/payment.js).
          const submittedFee = Number(fees);
          const fee = isFullProgramPlan(plan)
            ? fullProgramFee(addon, plan)
            : (Number.isFinite(submittedFee) && submittedFee >= 0 && submittedFee <= 100000 ? submittedFee : 0);
          const datetime = Math.floor(Date.now() / 1000);
          db.query(
            `
              INSERT INTO enrollees
              (req_id,name,email,number,gender,qualification,course,referby,addon,plan,fees,currency,datetime,status,prs)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,'0')
            `,
            [
              req_id,
              name,
              email,
              fullphone,
              gender,
              qualification,
              course,
              referby,
              addon || "",
              plan || "",
              fee,
              currency || "USD",
              datetime
            ],
            async (err2) => {

              if (err2)
                return res.json({
                  success: false,
                  req_id: "",
                  message: "Insert failed",
                });

              const query = (sql, params) => {
                return new Promise((resolve, reject) => {
                  db.query(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                  });
                });
              };

              let coursename = "";
              /* Get Course */
              if (course && course.length >= 10) {
                const courseRows = await query(
                  "SELECT title FROM courses WHERE req_id = ? LIMIT 1",
                  [course]
                );

                if (courseRows.length > 0) {
                  coursename = courseRows[0].title;
                }
              }

              const html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                  <h2 style="color:#2c7be5;">Enroll Request Received</h2>

                  <p>Dear <b>${escapeHtml(name)}</b>,</p>

                  <p>
                    Thank you for submitting your enroll request with
                    <b>Rivira Technologies</b>.
                  </p>

                  <p>
                    We have successfully received your application and it is currently
                    <b>under review</b> by our team.
                  </p>

                  <hr>

                  <h3>📘 Submitted Details</h3>

                  <table cellpadding="6">
                    <tr>
                      <td><b>Preferred Course</b></td>
                      <td>: ${escapeHtml(decodeEntities(coursename))}</td>
                    </tr>
                    <tr>
                      <td><b>Registered Email</b></td>
                      <td>: ${escapeHtml(email)}</td>
                    </tr>
                    <tr>
                      <td><b>Contact Number</b></td>
                      <td>: ${escapeHtml(fullphone)}</td>
                    </tr>
                    <tr>
                      <td><b>Plan</b></td>
                      <td>: ${escapeHtml(plan)}</td>
                    </tr>
                  </table>
                  <hr>
                  <h3>⏳ What Happens Next?</h3>

                  <ul>
                    <li>Our team will review your request</li>
                    <li>We may contact you for verification</li>
                    <li>You will receive approval/rejection within 24–48 hours</li>
                  </ul>

                  <p>
                    Please ensure that your contact details are active and correct.
                  </p>

                  <hr>

                  <p>
                    If you have any questions, feel free to reach us at:
                    <br>
                    📧 support@riviratech.com
                  </p>
                  <br>
                  <p>
                    Best Regards,<br>
                    <b>Rivira Technologies Team</b><br>
                    🌐 www.riviratech.com
                  </p>
                </div>
                  `;
              const subject =
                `Hi ${name}, Enroll Request Received – Rivira Technologies`;

              try {
                // Send Mail
                const sent = await queueMail(
                  email,
                  subject,
                  html
                );
                if (!sent) {

                }

              } catch (err) {
                console.error(err);
              }

              // enrolled through a student's referral link: added to their referrals + they're emailed
              if (ref) await referralLink.recordEnrollment(db, { code: ref, name, email, phone: fullphone, courseId: course });

              res.json({
                success: true,
                req_id: req_id,
                message: "Thank you, Your enrolment details was successfully submitted",
              });
            }
          );
        }
      );
    });
};
