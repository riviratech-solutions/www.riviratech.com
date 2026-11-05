/**
 * Cloudflare Turnstile server-side verification. FAILS CLOSED.
 *
 * Set TURNSTILE_SECRET_KEY in api/.env (Cloudflare dashboard → Turnstile → your
 * widget). Without it every captcha check is REJECTED — previously a missing
 * secret silently let every request through, so any made-up token passed
 * (security audit, Finding 3).
 *
 * Local development without a secret: add TURNSTILE_SKIP=true to your LOCAL
 * api/.env. It is ignored when NODE_ENV=production, and must never be set on a
 * server reachable from the internet.
 *
 * A missing token or any verification/network error also returns false, so the
 * captcha can't be bypassed by dropping the token or blocking siteverify.
 */
function skipAllowed() {
  // trim: cmd's `set X=true && ...` stores "true " with a trailing space
  const skip = String(process.env.TURNSTILE_SKIP || "").trim().toLowerCase() === "true";
  return skip && String(process.env.NODE_ENV || "").trim() !== "production";
}

if (!process.env.TURNSTILE_SECRET_KEY) {
  console.warn(
    skipAllowed()
      ? "⚠️  Turnstile: TURNSTILE_SECRET_KEY is empty and TURNSTILE_SKIP=true — captcha checks are SKIPPED (local development only)."
      : "⚠️  Turnstile: TURNSTILE_SECRET_KEY is empty — every captcha check will be REJECTED until it is set."
  );
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return skipAllowed(); // not configured — reject, unless explicitly skipped in dev
  if (!token) return false; // secret set but no token — reject

  try {
    const body = new URLSearchParams();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);

    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body }
    );
    const data = await r.json();
    return !!data.success;
  } catch (err) {
    // Secret IS configured, so the operator opted into captcha enforcement —
    // fail CLOSED on a network/Cloudflare error rather than letting requests
    // through unverified. Legit users retry; bots can't bypass by killing the
    // siteverify request.
    console.error("⚠️  Turnstile verify error (rejected):", err.message);
    return false;
  }
}

module.exports = { verifyTurnstile };
