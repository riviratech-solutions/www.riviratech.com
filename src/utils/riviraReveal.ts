import { useEffect, useRef, useState, type RefObject } from "react";

/* Rivira entrance animations & scroll reveal engine (public/css/rivira-design.css).

   Mark an element with {...anim("fadeInUp", 200)}: it plays once, after the
   given delay, when it scrolls into view. anim() only adds data attributes, so
   it never overrides an element's own style. The page root carries
   data-reveal, which keeps the generic site-wide reveal (utils/autoReveal.ts)
   away from it. Elements are only hidden while this hook is running
   (.rv-anim-on), so content stays visible if JS fails; reduced-motion
   visitors see everything immediately (CSS). */

export type RvAnim = "fadeIn" | "fadeInUp" | "fadeInDown" | "fadeInLeft" | "fadeInRight" | "zoomIn";

/** Spread onto an element: {...anim("fadeInUp", 200)} */
export function anim(name: RvAnim, delayMs = 0): Record<string, string> {
  return delayMs ? { "data-rv-anim": name, "data-rv-delay": String(delayMs) } : { "data-rv-anim": name };
}

export function useRiviraReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const watched = new Set<HTMLElement>();
    const reveal = (el: HTMLElement) => {
      el.style.setProperty("--rv-delay", (el.dataset.rvDelay || "0") + "ms");
      el.classList.add("rv-in");
      io?.unobserve(el);
    };

    // How far BELOW the fold an element may be and still reveal. A positive buffer
    // means content reveals just before it scrolls into view, so there is never a
    // blank strip at the bottom of the screen that only fills in after you scroll
    // further ("loads only after scrolling"). In px for the sweep below.
    const AHEAD = 0.25; // a quarter of a viewport

    // The IntersectionObserver gives the nice staggered entrance as elements
    // scroll into view during normal, smooth scrolling.
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                const el = e.target as HTMLElement;
                const viewportH = e.rootBounds ? e.rootBounds.height : window.innerHeight;
                // reveal when intersecting, or when already at/above the viewport
                if (!e.isIntersecting && e.boundingClientRect.top > viewportH) continue;
                reveal(el);
              }
            },
            // positive bottom margin → reveal content a little before it is reached
            { rootMargin: `0px 0px ${Math.round(AHEAD * 100)}% 0px` },
          );

    const scan = () =>
      root.querySelectorAll<HTMLElement>("[data-rv-anim]").forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io?.observe(el);
      });

    // Failsafe sweep. An INSTANT scroll jump (an anchor link, the back button or
    // the browser restoring scroll) can move an element from below the viewport
    // straight to above it: the intersection ratio goes 0 -> 0 with no crossing,
    // so IntersectionObserver never fires and the element would stay
    // visibility:hidden forever — the empty gap above the curriculum modules.
    // This reveals anything that has reached the viewport, whether IO fired or
    // not. If IntersectionObserver is unavailable it is the whole engine.
    let raf = 0;
    const sweep = () => {
      raf = 0;
      const limit = window.innerHeight * (1 + AHEAD);
      watched.forEach((el) => {
        if (el.classList.contains("rv-in")) return;
        if (el.getBoundingClientRect().top < limit) reveal(el);
      });
    };
    const onScrollOrResize = () => {
      if (!raf) raf = requestAnimationFrame(sweep);
    };

    scan();
    root.classList.add("rv-anim-on");
    onScrollOrResize(); // catch content already in view on mount (e.g. a hash jump)
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    // content that arrives later (API data, slider pages) is picked up too
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      cancelAnimationFrame(raf);
      root.classList.remove("rv-anim-on");
    };
  }, [rootRef]);
}

/** Counts up from 0 to `target` once it scrolls into view. */
export function useCountUp(target: number, durationMs = 1600) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [reduced] = useState(() => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [counted, setValue] = useState(0);
  const value = reduced ? target : counted;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / durationMs);
          setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, reduced]);

  return { ref, value };
}
