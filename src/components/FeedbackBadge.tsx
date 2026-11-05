import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Star, X, MessageSquareHeart } from "lucide-react";
import { SERVER_URL } from "./Includes";
import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "./TurnstileWidget";

/**
 * The sticky "Share Your Feedback" tab on the right edge of every public page
 * (WhatsApp and the chatbot already hold both bottom corners). Submissions go
 * to api/site-feedback and are reviewed in admin → Site Feedback.
 */

const STAR_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

export default function FeedbackBadge() {

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [liked, setLiked] = useState("");
  const [improve, setImprove] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const tabRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes, and focus goes back to the tab that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); tabRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Clicking away closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !tabRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) window.setTimeout(() => panelRef.current?.focus(), 20);
  }, [open]);

  const reset = () => {
    setDone(false); setRating(0); setHover(0);
    setName(""); setLiked(""); setImprove(""); setError("");
    setCaptchaToken(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");

    if (rating < 1) { setError("Please choose a rating first."); return; }
    if (name.trim().length < 2) { setError("Please tell us your name."); return; }
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the verification first.");
      return;
    }

    setBusy(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/site-feedback",
        {
          name: name.trim(),
          rating,
          liked: liked.trim(),
          improve: improve.trim(),
          // Path only — never href, which would carry the query string.
          page: window.location.pathname,
          captcha: captchaToken,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        setDone(true);
        window.setTimeout(() => { setOpen(false); reset(); }, 2200);
      } else {
        setError(res.data.message || "Could not send that. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
      // Turnstile tokens are single-use — every attempt needs a fresh one.
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  return (
    <div className="rt-fb">
      <button
        ref={tabRef}
        type="button"
        className="rt-fb__tab"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => { setOpen((v) => !v); if (done) reset(); }}
      >
        <MessageSquareHeart size={15} aria-hidden="true" />
        <span>Feedback</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="rt-fb__panel"
          role="dialog"
          aria-modal="false"
          aria-label="Share your feedback"
          tabIndex={-1}
        >
          <button
            type="button"
            className="rt-fb__close"
            onClick={() => { setOpen(false); tabRef.current?.focus(); }}
            aria-label="Close feedback"
          >
            <X size={16} />
          </button>

          {done ? (
            <div className="rt-fb__done" role="status">
              <strong>Thank you.</strong>
              <p>We read every one of these.</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 className="rt-fb__title">Share Your Feedback</h2>
              <p className="rt-fb__sub">How is your experience of the site so far?</p>

              <div
                className="rt-fb__stars"
                role="radiogroup"
                aria-label="Rating, 1 to 5 stars"
                onMouseLeave={() => setHover(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""} — ${STAR_LABELS[n - 1]}`}
                    className={`rt-fb__star${n <= (hover || rating) ? " on" : ""}`}
                    onMouseEnter={() => setHover(n)}
                    onFocus={() => setHover(n)}
                    onBlur={() => setHover(0)}
                    onClick={() => setRating(n)}
                  >
                    <Star size={26} strokeWidth={1.75} />
                  </button>
                ))}
              </div>
              <p className="rt-fb__starlabel" aria-live="polite">
                {(hover || rating) ? STAR_LABELS[(hover || rating) - 1] : " "}
              </p>

              <label className="rt-fb__label" htmlFor="rt-fb-name">
                Your name
              </label>
              <input
                id="rt-fb-name" className="rt-fb__input" type="text"
                required minLength={2} maxLength={120}
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="So we know who to thank"
                autoComplete="name"
              />

              <label className="rt-fb__label" htmlFor="rt-fb-liked">
                What worked well? <span>optional</span>
              </label>
              <textarea
                id="rt-fb-liked" className="rt-fb__area" rows={2} maxLength={2000}
                value={liked} onChange={(e) => setLiked(e.target.value)}
                placeholder="Anything you found useful"
              />

              <label className="rt-fb__label" htmlFor="rt-fb-improve">
                What could be better? <span>optional</span>
              </label>
              <textarea
                id="rt-fb-improve" className="rt-fb__area" rows={2} maxLength={2000}
                value={improve} onChange={(e) => setImprove(e.target.value)}
                placeholder="Anything confusing or missing"
              />

              {captchaEnabled && (
                <div className="rt-fb__captcha">
                  <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
                </div>
              )}

              {error && <p className="rt-fb__error" role="alert">{error}</p>}

              <button type="submit" className="rt-fb__submit" disabled={busy}>
                {busy ? "Sending…" : "Share Your Feedback"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
