/**
 * The SMTP side of sending mail: hands one message to the mail server.
 * Used by the mail sender (mail-queue.js); routes call shared/mail.js instead.
 *
 * Up to four accounts (EMAIL_USER / EMAIL_USER1..3 in the env). When one has
 * reached its sending limit the next is tried; any other error stops there.
 */
const nodemailer = require("nodemailer");
require("dotenv").config();

const emailAccounts = [
    {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    {
        user: process.env.EMAIL_USER1,
        pass: process.env.EMAIL_PASS1,
    },
    {
        user: process.env.EMAIL_USER2,
        pass: process.env.EMAIL_PASS2,
    },
    {
        user: process.env.EMAIL_USER3,
        pass: process.env.EMAIL_PASS3,
    },
].filter(acc => acc.user && acc.pass);

const transporters = emailAccounts.map(account =>
    nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth: {
            user: account.user,
            pass: account.pass,
        },
    })
);

function isLimitError(err) {
    if (!err) return false;

    const msg = (err.message || "").toLowerCase();

    return (
        msg.includes("quota") ||
        msg.includes("daily") ||
        msg.includes("rate limit") ||
        msg.includes("too many") ||
        msg.includes("limit exceeded") ||
        msg.includes("sending limit") ||
        err.responseCode === 421 ||
        err.responseCode === 450 ||
        err.responseCode === 451 ||
        err.responseCode === 452 ||
        err.responseCode === 550
    );
}

/**
 * Send one message now.
 * @returns {Promise<{ ok: boolean, from?: string, error?: string }>}
 */
async function deliver(to, subject, html, cc = []) {

    if (!transporters.length) return { ok: false, error: "No mail account is set up (EMAIL_USER / EMAIL_PASS)" };

    let lastError = "";

    for (let i = 0; i < transporters.length; i++) {

        const transporter = transporters[i];
        const account = emailAccounts[i];

        try {

            const info = await transporter.sendMail({
                from: `"Rivira Technologies" <${account.user}>`,
                to,
                bcc: cc,
                subject,
                html,
            });

            console.log(`Mail sent using ${account.user}`);
            console.log(info.messageId);

            return { ok: true, from: account.user };

        } catch (err) {

            console.error(`Failed using ${account.user}`);
            console.error(err.message);
            lastError = err.message || String(err);

            // Try next account only for sending-limit errors
            if (isLimitError(err)) {
                console.log("Switching to next email account...");
                continue;
            }

            // Other errors (invalid recipient, auth failure, etc.)
            return { ok: false, error: lastError };
        }
    }

    console.error("All email accounts reached their sending limits.");
    return { ok: false, error: "All email accounts reached their sending limits. " + lastError };
}

module.exports = { deliver };
