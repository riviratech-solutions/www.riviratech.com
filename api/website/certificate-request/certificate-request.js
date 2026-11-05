/**
 * API routes for src/pages/website/CertificateRequest.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const { verifyTurnstile } = require("../../security/turnstile");
const { rejectIfHoneypot } = require("../../security/honeypot");
const certIntake = require("./certificate-intake");

module.exports = (router, ctx) => {
    const { db } = ctx;

    /* =====================================
       Public Certificate Request & Courses
    ====================================== */

    router.post("/public/certificate-request", async (req, res) => {
        try {
            /* 1. Honeypot check */
            if (rejectIfHoneypot(req, res, "/api/public/certificate-request")) return;

            /* 2. Captcha verification */
            if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
                return res.json({
                    success: false,
                    message: "Captcha verification failed, please try again",
                });
            }

            /* 3. Validation */
            const checked = certIntake.validate(req.body);
            if (!checked.ok) {
                return res.json({ success: false, message: checked.message });
            }
            const value = checked.value;

            /* 4. Course exists */
            if (!(await certIntake.courseExists(db, value.course))) {
                return res.json({ success: false, message: "Please select a valid course" });
            }

            /* 5. Prevent duplicate pending requests */
            if (await certIntake.pendingDuplicate(db, value.email, value.course)) {
                return res.json({
                    success: false,
                    message: "You already have a pending request for this course. Please wait for approval.",
                });
            }

            const reqId = await certIntake.insertRequest(db, value);

            return res.json({
                success: true,
                id: reqId,
                message:
                    "Thanks — your request has been received. We'll review it and email your certificate once it's approved.",
            });
        } catch (err) {
            console.error("public/certificate-request failed:", err.message);
            return res.json({
                success: false,
                message: "There was something wrong, Please try again",
            });
        }
    });
};
