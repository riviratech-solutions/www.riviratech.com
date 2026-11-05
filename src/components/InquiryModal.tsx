import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles } from "lucide-react";
import InquiryForm from "./InquiryForm";

export default function InquiryModal({
  open,
  onClose,
  title = "Ask us anything",
  intro = "Send us your question and we'll get back to you personally.",
  source = "home-faq",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  intro?: string;
  source?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* max-h + overflow-y so a long form on a short viewport scrolls inside
          the dialog rather than pushing its own submit button off screen. */}
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-2xl"
        style={{ backgroundColor: "#ffffff" }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="relative flex-shrink-0 overflow-hidden rounded-t-3xl px-7 pb-6 pt-6"
          style={{ background: "var(--color-ink)" }}
        >
          <div
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30"
            style={{ background: "var(--color-cyan-soft)", filter: "blur(40px)" }}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">
                <Sparkles className="h-3 w-3" style={{ color: "var(--color-cyan-soft)" }} />
                Ask us
              </span>
              <h2
                className="mt-3 text-xl font-bold text-white sm:text-2xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h2>
              <p className="mt-1.5 text-sm text-white/70">{intro}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="contact-page min-h-0 flex-1 overflow-y-auto bg-transparent px-6 py-6">
          <InquiryForm source={source} />
        </div>
      </div>
    </div>,
    document.body
  );
}
