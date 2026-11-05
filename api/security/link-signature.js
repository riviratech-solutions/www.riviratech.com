/* Signatures for one-click links sent by email (e.g. a survey: ?r=<survey id>&u=member&s=…).

   A link that acts for a member without a sign-in must not be forgeable from
   ids alone: member ids are not secret (the certificate page prints them). The
   signature is an HMAC of the link's parts with the server secret, so only links
   the server itself built are accepted. */
const crypto = require("crypto");

const secret = () => process.env.SESSION_SECRET || process.env.ENCRYPT_KEY || "";

function signLink(...parts) {
    return crypto.createHmac("sha256", secret()).update(parts.map(String).join("|")).digest("hex").slice(0, 32);
}

function verifyLink(sig, ...parts) {
    if (typeof sig !== "string" || !secret()) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(signLink(...parts));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { signLink, verifyLink };
