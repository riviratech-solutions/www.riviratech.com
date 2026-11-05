/**
 * Sending mail from a route. Both go through the mail queue (mail-queue.js),
 * which a separate sender process works through (../cluster.js).
 *
 *   const sendMail = require("../../shared/mail");
 *   const { queueMail } = sendMail;
 *
 *   await sendMail(to, subject, html[, bcc])   true / false once the mail has
 *       gone out or failed (waits up to 25 s). For mail whose result the user
 *       is told: OTP, password changed, contact form, payment link, ...
 *
 *   await queueMail(to, subject, html[, bcc])  true as soon as it is queued;
 *       retried automatically if it fails. For notices nobody waits on: new
 *       survey, referral, account created, certificate approved, ...
 */
const queue = require("./mail-queue");

const sendMail = (to, subject, html, cc = []) => queue.send({ to, subject, html, cc, wait: true });

sendMail.queueMail = (to, subject, html, cc = []) => queue.send({ to, subject, html, cc, wait: false });

module.exports = sendMail;
