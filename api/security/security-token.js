/**
 * Per-request security tokens (the key / token / aut trio every form and admin
 * call sends in its body).
 *
 * The old scheme kept ONE token in the session and validateSecurity() returned
 * success even on a mismatch — it had been switched off because two requests in
 * flight at once overwrite each other's token in that single session slot, so
 * honest parallel calls failed. (Security audit, Finding 4.)
 *
 * Here the token is signed instead of stored: key is a timestamp + random nonce,
 * token/aut are HMACs of that nonce bound to this visitor's session id. Nothing is
 * written per token, so any number of requests can be in flight; a token is only
 * valid for the session that fetched it and expires after TOKEN_TTL_MS.
 */
const crypto = require("crypto");

const TOKEN_TTL_MS = 10 * 60 * 1000; // a form can sit open a while before submit
const CLOCK_SKEW_MS = 60 * 1000;

function signingSecret() {
  return process.env.SESSION_SECRET || process.env.ENCRYPT_KEY || "";
}

function sign(sessionId, nonce, part) {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(part + "|" + sessionId + "|" + nonce)
    .digest("hex");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** A fresh token trio for this request's session. */
function issueToken(req) {
  const nonce = Date.now().toString(36) + "." + crypto.randomBytes(12).toString("hex");
  return {
    key: nonce,
    token: sign(req.sessionID, nonce, "token"),
    aut: sign(req.sessionID, nonce, "aut"),
  };
}

const FAILED = { success: false, message: "Security validation failed. Please refresh the page and try again." };

/** Checks the key / token / aut sent in the request body. */
function validateSecurity(req) {
  const { key, token, aut } = req.body || {};
  if (!req.sessionID || !signingSecret()) return FAILED;
  if (typeof key !== "string" || typeof token !== "string" || typeof aut !== "string") return FAILED;

  const issued = parseInt(key.split(".")[0], 36);
  const age = Date.now() - issued;
  if (!issued || age > TOKEN_TTL_MS || age < -CLOCK_SKEW_MS) return FAILED;

  if (!safeEqual(token, sign(req.sessionID, key, "token"))) return FAILED;
  if (!safeEqual(aut, sign(req.sessionID, key, "aut"))) return FAILED;
  return { success: true };
}

module.exports = { issueToken, validateSecurity, TOKEN_TTL_MS };
