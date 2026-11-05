/**
 * Enquiry forms (components/InquiryForm.tsx, modals/DecideCareerModal.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const sendMail = require("../../shared/mail");
const { verifyTurnstile } = require("../../security/turnstile");

module.exports = (router, ctx) => {
    const { db, escapeHtml, validateSecurity } = ctx;

    function validatePhone(phone) {
      // ✅ Check first
      if (!phone) {
        return false;
      }

      phone = String(phone).replace(/[^\d+ ]/g, "");

      const num = phone.replace(/\s/g, "");

      if (num.length !== 10) {
        return false;
      }

      return num;
    }

    router.post("/contacts/add", async (req, res) => {

      const {
        name,
        email,
        phone,
        fullphone,
        msg,
        topic,
        company,
        key,
        token,
        aut,
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

      if (!name || name.length < 3) {
        return res.json({ message: "Please enter full name" });
      }

      const phoneValid = validatePhone(phone);

      if (!phoneValid) {
        return res.json({ message: "Please enter valid number" });
      }

      if (!phone || phone.length !== 10 || !fullphone || fullphone.length <= 10) {
        return res.json({ success: false, message: "Please enter valid contact number" });
      }

      if (!email || email.length < 7) {
        return res.json({ message: "Please enter email" });
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.json({ message: "Invalid email" });
      }

      if (name !== "Enquiry") {
        if (!msg || msg.length < 3) {
          return res.json({ message: "Please enter message" });
        }
      }

      // Fold the Interest / Company fields into the stored message so they're kept
      // without a schema change (the contacts table has no dedicated columns).
      const composedMsg = [
        topic ? `Interest: ${topic}, ` : null,
        company ? `Company: ${company}, ` : null,
        msg,
      ].filter(Boolean).join("\n");

      // ---------------- SAVE TO DB ----------------

      const sql = `
    INSERT INTO contacts
    (name,email,number,msg,type,datetime,status)
    VALUES (?,?,?,?,'contacts',?,'1')
  `;
      const datetime = Math.floor(Date.now() / 1000);
      db.query(
        sql,
        [name, email, fullphone, composedMsg, datetime],
        async (err) => {
          if (err) {
            console.error(err);
            return res.json({
              message: "DB Error",
            });
          }

          if (name == "Enquiry") {

            const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

              <h2 style="color:#2c7be5;">Consultation Request Received</h2>

              <p>Dear,</p>

              <p>
                Thank you for requesting a consultation with
                <b>Rivira Technologies</b>.
              </p>

              <p>
                We have successfully received your consultation request.
                Our experts will review your requirements and contact you shortly to discuss your needs and schedule a consultation.
              </p>

              <hr>

              <h3>📋 Consultation Details</h3>

              <table cellpadding="6">
                <tr>
                  <td><b>Email Address</b></td>
                  <td>: ${escapeHtml(email)}</td>
                </tr>
                <tr>
                  <td><b>Phone Number</b></td>
                  <td>: ${escapeHtml(fullphone)}</td>
                </tr>
              </table>

              <hr>

              <h3>🚀 What Happens Next?</h3>

              <ul>
                <li>Our consultants will review your request.</li>
                <li>We may contact you to understand your requirements in more detail.</li>
                <li>We'll schedule a consultation at a convenient time.</li>
                <li>You can expect a response within 24–48 business hours.</li>
              </ul>

              <p>
                If you have any additional information to share before the consultation, feel free to reply to this email.
              </p>

              <hr>

              <p>
                <b>Contact Us</b><br>
                📧 support@riviratech.com<br>
                🌐 www.riviratech.com
              </p>

              <br>

              <p>
                Best Regards,<br>
                <b>Rivira Technologies Team</b>
              </p>

            </div>
            `;

            const subject = `Consultation Request Received – Rivira Technologies`;
            // Send Mail
            const sent = await sendMail(
              process.env.EMAIL_RECEIVER,
              subject,
              html
            );

          } else {
            const html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

                  <h2 style="color: #2c3e50;">📩 New Contact Form Enquiry</h2>

                  <p>You have received a new message from riviratech innovations.</p>

                  <hr />

                  <table cellpadding="8" cellspacing="0" border="0">

                    <tr>
                      <td><b>Name:</b></td>
                      <td>${escapeHtml(name)}</td>
                    </tr>

                    <tr>
                      <td><b>Email:</b></td>
                      <td>${escapeHtml(email)}</td>
                    </tr>

                    <tr>
                      <td><b>Phone:</b></td>
                      <td>${escapeHtml(fullphone || "Not Provided")}</td>
                    </tr>

                  </table>

                  <hr />

                  <h4>Message:</h4>

                  <p style="background:#f9f9f9; padding:15px; border-left:4px solid #3498db;">
                    ${escapeHtml(composedMsg).replace(/\n/g, "<br>")}
                  </p>

                  <br />

                  <p style="font-size: 13px; color: #777;">
                    📌 This message was sent from the contact form on  
                    <b>riviratech.com</b>
                  </p>

                </div>
              `;

            // Send Mail
            const sent = await sendMail(
              process.env.EMAIL_RECEIVER,
              "You have received a new message from riviratech innovations.",
              html
            );

            const html2 = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

      <h2 style="color:#2c7be5;">Thank You for Contacting Us!</h2>

      <p>Dear <b>${escapeHtml(name)}</b>,</p>

      <p>
        Thank you for contacting <b>Rivira Technologies</b>.
        We have successfully received your message and appreciate your interest in our services.
      </p>

      <p>
        Our team will review your inquiry and get back to you as soon as possible. We typically respond within
        <b>24–48 business hours</b>.
      </p>

      <hr>

      <h3>📋 Contact Details Received</h3>

      <table cellpadding="6">
        <tr>
          <td><b>Name</b></td>
          <td>: ${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td><b>Email Address</b></td>
          <td>: ${escapeHtml(email)}</td>
        </tr>
        <tr>
          <td><b>Phone Number</b></td>
          <td>: ${escapeHtml(fullphone)}</td>
        </tr>
      </table>

      <hr>

      <h3>📞 What Happens Next?</h3>

      <ul>
        <li>Our team will review your message.</li>
        <li>We'll contact you if we need any additional information.</li>
        <li>You can expect a response within 24–48 business hours.</li>
      </ul>

      <p>
        If your inquiry is urgent, please don't hesitate to contact us directly.
      </p>

      <hr>

      <p>
        <b>Contact Information</b><br>
        📧 support@riviratech.com<br>
        🌐 www.riviratech.com
      </p>

      <br>

      <p>
        Best Regards,<br>
        <b>Rivira Technologies Team</b>
      </p>

    </div>
    `;

            const subject2 = `Thank You for Contacting Rivira Technologies, ${name}!`;

            try {
              const sent2 = await sendMail(email, subject2, html2);

              if (!sent2) {
                // Handle email send failure
              }

            } catch (err) {
              console.error(err);
            }

          }

          res.json({
            success: true,
            message:
              "Your message was submitted successfully. We will contact you shortly.",
          });
        }
      );
    });
};
