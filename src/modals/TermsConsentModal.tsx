import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck, Check } from "lucide-react";

// Set to false to temporarily switch the terms popup off site-wide. While off
// it never shows and hands straight over to the next popup (ModalsController).
export const TERMS_CONSENT_ENABLED = false;

// Bump this when the terms change materially — visitors who accepted the old
// version will then be asked to accept again.
const ACCEPTED_KEY = "kkr_terms_accepted_v1";
// Accepting is remembered forever; merely dismissing is remembered only for the
// current tab session, so we ask again on their next visit without nagging on
// every page view in this one.
const DISMISSED_KEY = "kkr_terms_dismissed_v1";

// Storage throws in some privacy modes (Safari private, blocked cookies). A
// consent notice must never take the site down, so every access is guarded.
function readFlag(storage: "local" | "session", key: string): boolean {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    return s.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(storage: "local" | "session", key: string) {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    s.setItem(key, new Date().toISOString());
  } catch {
    /* ignore — visitor just gets asked again next time */
  }
}

export function hasAcceptedTerms(): boolean {
  return readFlag("local", ACCEPTED_KEY);
}

// Layout is written as inline styles rather than Tailwind utilities on purpose:
// bootstrap.min.css is loaded globally and unlayered, so it overrides Tailwind's
// layered utilities on any shared name (.mt-5, .gap-3, …) and on element
// defaults (label{display:inline-block} beats .flex). Inline styles sidestep it.

// Keyframes can't be expressed inline, and for the same cascade reason above we
// keep them local to the component rather than trusting a utility class.
//
// The design tokens below (--color-*, --shadow-cta, --font-*) are defined HERE,
// scoped to .rt-consent-root, because this project has no global design-token
// layer — without them every var() in the inline styles resolves to nothing,
// which left the header white, the white title invisible and the gold CTA
// unfilled. Concrete values matched to the site brand: dark header, gold CTA,
// green accents.
const ANIMATION_CSS = `
.rt-consent-root {
  --color-ink: #0b1220;
  --color-ink-soft: #334155;
  --color-muted: #64748b;
  --color-cloud: #f8fafc;
  --color-border: #e2e8f0;
  --color-brand-50: #edf7f1;
  --color-brand-500: #34a06b;
  --color-brand-600: #2d8f5f;
  --color-brand-700: #256f52;
  --color-brand-900: #12203f;
  --color-cyan-soft: #67e8f9;
  --color-gold: #ffc107;
  --color-gold-soft: #ffd451;
  --shadow-cta: 0 12px 26px -8px rgba(255, 193, 7, 0.55);
  --font-display: inherit;
  --font-body: inherit;
}
@keyframes rt-consent-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes rt-consent-rise {
  from { opacity: 0; transform: translateY(16px) scale(0.97) }
  to   { opacity: 1; transform: translateY(0) scale(1) }
}
.rt-consent-backdrop { animation: rt-consent-fade 220ms ease-out both }
.rt-consent-panel { animation: rt-consent-rise 300ms cubic-bezier(0.22, 1, 0.36, 1) both }
@media (prefers-reduced-motion: reduce) {
  .rt-consent-backdrop, .rt-consent-panel { animation: none }
}
`;

const linkStyle: React.CSSProperties = {
  color: "var(--color-brand-700)",
  fontWeight: 600,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  textDecorationThickness: 1,
  // Keep each policy name on one line — a link broken mid-phrase reads as two
  // separate links. Both names are short enough to fit the card on mobile.
  whiteSpace: "nowrap",
};


interface Props {
  onClose: () => void;
}

export default function TermsConsentModal({ onClose }: Props) {


  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!TERMS_CONSENT_ENABLED) { onClose(); return; }   // switched off: skip to the next popup
    if (hasAcceptedTerms() || readFlag("session", DISMISSED_KEY)) return;
    setOpen(true);
  }, []);

  const close = () => {
    writeFlag("session", DISMISSED_KEY);
    setOpen(false);
    onClose();
  };

  const accept = () => {
    if (!checked) return;
    writeFlag("local", ACCEPTED_KEY);
    setOpen(false);
    onClose(); 
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="rt-consent-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-consent-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <style>{ANIMATION_CSS}</style>

      <div
        className="rt-consent-backdrop"
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(6, 11, 25, 0.72)",
          backdropFilter: "blur(8px)",
        }}
      />

      <div
        className="rt-consent-panel"
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 420,
          overflow: "hidden",
          borderRadius: 20,
          backgroundColor: "#ffffff",
          border: "none",
          boxShadow: "0 32px 64px -16px rgba(2, 6, 23, 0.6)",
        }}
      >
        {/* Dark brand header */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "24px 26px 26px",
            textAlign: "center",
            background: "linear-gradient(135deg, var(--color-ink) 0%, #12203f 55%, var(--color-brand-900) 100%)",
          }}
        >
          {/* Ambient glows — cyan top-right, gold bottom-left, echoing the site hero */}
          <div
            style={{
              position: "absolute",
              top: -56,
              right: -40,
              height: 150,
              width: 150,
              borderRadius: "50%",
              opacity: 0.28,
              background: "var(--color-cyan-soft)",
              filter: "blur(44px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -70,
              left: -30,
              height: 130,
              width: 130,
              borderRadius: "50%",
              opacity: 0.22,
              background: "var(--color-gold)",
              filter: "blur(46px)",
            }}
          />

          {/* Close — pinned to the corner so the logo can sit centered */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 2,
              display: "flex",
              height: 30,
              width: 30,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.45)",
              cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.14)";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            <X style={{ height: 15, width: 15 }} />
          </button>

          <div style={{ position: "relative" }}>
            {/* Logo centered on its own row at the top */}
            <img
              src="/images/flogo.png"
              alt="Rivira Technologies"
              style={{ height: 38, width: "auto", display: "block", margin: "2px auto 16px" }}
            />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                border: "1px solid rgba(103, 232, 249, 0.25)",
                background: "rgba(103, 232, 249, 0.08)",
                padding: "4px 10px",
                fontSize: 9.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--color-cyan-soft)",
              }}
            >
              <ShieldCheck style={{ height: 11, width: 11 }} />
              Terms of Use
            </span>
            <h2
              id="terms-consent-title"
              style={{
                margin: "10px 0 0",
                fontSize: 24,
                lineHeight: 1.2,
                fontWeight: 700,
                color: "#ffffff",
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.02em",
              }}
            >
              Before you continue
            </h2>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 26px 24px" }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--color-muted)" }}>
            By using the Rivira Technologies website, you agree to how we handle your data and what
            you can expect from us.
          </p>

          {/* Consent row reads as a card so the choice looks deliberate, and
              lights up once ticked to confirm the action landed. */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 11,
              marginTop: 16,
              padding: "13px 14px",
              borderRadius: 12,
              cursor: "pointer",
              border: `1px solid ${checked ? "var(--color-brand-500)" : "var(--color-border)"}`,
              background: checked ? "var(--color-brand-50)" : "var(--color-cloud)",
              transition: "border-color 0.2s, background 0.2s",
            }}
          >
            {/* Native input is visually replaced but kept in the DOM for
                keyboard, screen readers and form semantics. */}
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{
                position: "absolute",
                opacity: 0,
                height: 1,
                width: 1,
                margin: 0,
                pointerEvents: "none",
              }}
            />
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 18,
                width: 18,
                flexShrink: 0,
                marginTop: 1,
                borderRadius: 5,
                border: `1.5px solid ${checked ? "var(--color-brand-600)" : "#cbd5e1"}`,
                background: checked ? "var(--color-brand-600)" : "#ffffff",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {checked && <Check style={{ height: 12, width: 12, color: "#ffffff", strokeWidth: 3.5 }} />}
            </span>
            <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-ink-soft)" }}>
              I agree to the{" "}
              {/* New tab: navigating in place would leave this modal sitting on top
                  of the very document the visitor is trying to read. */}
              <a
                href="/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
                onClick={(e) => e.stopPropagation()}
              >
                Terms and Conditions
              </a>{" "}
              and{" "}
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </a>
            </span>
          </label>

          {/* Gold CTA + lift on hover mirrors the site's primary buttons
              (.rt-cta-primary), which we can't reuse directly: it's scoped to
              body.rt-home and this dialog renders on every route. */}
          <button
            type="button"
            onClick={accept}
            disabled={!checked}
            style={{
              marginTop: 16,
              width: "100%",
              borderRadius: 999,
              border: "none",
              padding: "13px 0",
              fontSize: 14.5,
              fontWeight: 600,
              fontFamily: "var(--font-body)",
              color: checked ? "var(--color-ink)" : "#94a3b8",
              background: checked ? "var(--color-gold)" : "#e2e8f0",
              boxShadow: checked ? "var(--shadow-cta)" : "none",
              cursor: checked ? "pointer" : "not-allowed",
              transition: "transform 180ms ease, box-shadow 180ms ease, background 180ms ease",
            }}
            onMouseOver={(e) => {
              if (!checked) return;
              e.currentTarget.style.background = "var(--color-gold-soft)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              if (!checked) return;
              e.currentTarget.style.background = "var(--color-gold)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Accept &amp; Continue
          </button>

          <p
            style={{
              margin: "12px 0 0",
              textAlign: "center",
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "#94a3b8",
            }}
          >
            You can review these anytime from the footer.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
