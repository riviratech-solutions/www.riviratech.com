import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { anim, useCountUp } from "../utils/riviraReveal";

/* Shared pieces of the Rivira modern design system (styles: public/css/rivira-design.css). */

/** Rivira Tech logo (mark + "RIVIRA TECH" wordmark). */
export function BrandLogo({ light = false }: { light?: boolean }) {
  return (
    <span className={`rv-brand${light ? " rv-brand--light" : ""}`}>
      <img className="rv-brand__mark" src="/images/rivira-logo.png" alt="Rivira Technologies" width={68} height={40} />
      <span className="rv-brand__word">RIVIRA TECH</span>
    </span>
  );
}

/** Base tab with curved shoulders sitting on the bottom or top edge of its parent. */
export function RiseTab({ className, bodyClass, children }: { className: string; bodyClass: string; children: ReactNode }) {
  return (
    <div className={className}>
      <span className="rv-shoulder rv-shoulder--rise-l" aria-hidden="true" />
      <div className={bodyClass}>{children}</div>
      <span className="rv-shoulder rv-shoulder--rise-r" aria-hidden="true" />
    </div>
  );
}

/** Inner-page banner: "Title | subtitle" on the soft modern gradient wash. */
export function PageHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="rv-page-hero">
      <div className="rv-page-hero__inner">
        <h1 className="rv-h1 rv-page-hero__title" {...anim("fadeInLeft", 200)}>{title}</h1>
        {subtitle && (
          <>
            <span className="rv-page-hero__sep" aria-hidden="true" />
            <p className="rv-page-hero__sub" {...anim("fadeInRight", 300)}>{subtitle}</p>
          </>
        )}
      </div>
    </section>
  );
}

/** Animated statistic: prefix + counted number + suffix, with a caption. */
export function Counter({ to, prefix = "", suffix = "", label }: { to: number; prefix?: string; suffix?: string; label: string }) {
  const { ref, value } = useCountUp(to);
  return (
    <div className="rv-counter">
      <div className="rv-counter__num">
        {prefix}
        <span ref={ref}>{value.toLocaleString("en-US")}</span>
        {suffix}
      </div>
      <p className="rv-counter__label">{label}</p>
    </div>
  );
}

export function VideoModal({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="rv-modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="rv-modal__frame" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rv-modal__close" onClick={onClose} aria-label="Close video" autoFocus>
          <X size={20} />
        </button>
        <div className="rv-modal__box">
          <iframe
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

