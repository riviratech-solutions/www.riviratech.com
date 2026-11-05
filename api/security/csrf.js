/**
 * CSRF protection: double-submit cookie (csrf-csrf).
 *
 *   GET /api/csrf-token  -> { csrfToken } and sets the CSRF cookie
 *   every POST / PUT / PATCH / DELETE under /api must send that token in the
 *   "x-csrf-token" header; the cookie is sent by the browser on its own.
 *
 * The token is an HMAC tied to the express-session ID, so it only fits this
 * browser's session, and a page on another site can neither read the cookie
 * nor set the header. The frontend adds the header to every axios request in
 * one place (src/utils/csrf.ts) and fetches a fresh token when it is refused.
 *
 * This sits on top of the per-request security token (security-token.js).
 * Secret: CSRF_SECRET, else derived from SESSION_SECRET.
 */
const crypto = require("crypto");
const { doubleCsrf } = require("csrf-csrf");

// "__Host-" cookies must be Secure (HTTPS only); plain-http hosts get a plain name.
const secure = process.env.NODE_ENV === "production" || process.env.NODE_SECURE === "true";
const cookieName = secure ? "__Host-psifi.x-csrf-token" : "psifi.x-csrf-token";
const secret =
    process.env.CSRF_SECRET ||
    crypto.createHash("sha256").update("csrf|" + (process.env.SESSION_SECRET || process.env.ENCRYPT_KEY || "")).digest("hex");

// Requests that are authorised another way and carry no session cookie.
const SKIP = new Set([
    "/upload-file", // HMAC-signed upload URL (shared/uploads.js)
]);

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: (req) => req.sessionID || "anonymous",
    cookieName,
    cookieOptions: { httpOnly: true, secure, sameSite: "strict", path: "/" },
    getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"],
    skipCsrfProtection: (req) => SKIP.has(req.path),
});

// GET /api/csrf-token — save the session first, so its ID (which the token is
// tied to) stays the same on the next request.
function tokenRoute(req, res) {
    if (!req.session.csrf) req.session.csrf = 1;
    const csrfToken = generateCsrfToken(req, res);
    req.session.save((err) => {
        if (err) console.error("csrf session save:", err.message);
        res.set("Cache-Control", "no-store");
        res.json({ csrfToken });
    });
}

// app.use("/api", protect): refuses a state-changing request without a valid token.
function protect(req, res, next) {
    doubleCsrfProtection(req, res, (err) => {
        if (err && err.code === "EBADCSRFTOKEN") {
            return res.status(403).json({
                success: false,
                code: "EBADCSRFTOKEN",
                message: "Your session check failed, please try again",
            });
        }
        next(err);
    });
}

module.exports = { tokenRoute, protect };
