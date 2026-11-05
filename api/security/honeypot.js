/**
 * Form honeypot — a decoy field no human ever sees or fills.
 * Complements Turnstile rather than replacing it.
 */

const HONEYPOT_FIELD = "company_fax";

// req.ip follows the server's trust-proxy setting; raw forwarding headers are
// whatever the client chose to send.
function clientIp(req) {
    return req?.ip || req?.socket?.remoteAddress || "";
}

function honeypotEnabled() {
    return String(process.env.HONEYPOT_ENABLED ?? "true").toLowerCase() !== "false";
}

function isHoneypotTripped(req) {
    if (!honeypotEnabled()) return false;
    const v = req?.body?.[HONEYPOT_FIELD];
    if (v === undefined || v === null) return false;
    return String(v).trim() !== "";
}

function rejectIfHoneypot(req, res, label) {
    if (!isHoneypotTripped(req)) return false;
    console.warn(
        `🍯 honeypot tripped on ${label} from ${clientIp(req) || "unknown"} ` +
        `(ua: ${String(req.headers?.["user-agent"] || "").slice(0, 120)})`
    );
    res.json({
        success: false,
        message: "We couldn't process this submission. Please refresh the page and try again.",
    });
    return true;
}

module.exports = {
    HONEYPOT_FIELD,
    isHoneypotTripped,
    rejectIfHoneypot,
    clientIp,
    honeypotEnabled,
};
