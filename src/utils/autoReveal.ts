import { useEffect } from "react";

/* Professional scroll-reveal for the public website (never the panels).

   Rather than hand-marking hundreds of elements, this tags the content blocks
   of each page for the existing reveal engine (public/js/wow.js) — section
   headings, the intro line under them, cards in grids (staggered) and larger
   images — with one calm effect: a short rise + fade, played once.

   Left alone: the hero (first section), anything the visitor has already
   been looking at (never hidden again), the header / footer / dialogs, carousels and horizontal
   scrollers, content inside closed accordions or tabs, and anything that
   already has its own data-aos / data-wow animation.

   Once a block has appeared, all reveal styling is removed from it, so the
   page's own hover transitions stay crisp. Reduced-motion visitors get nothing
   hidden or moved (wow.js never activates for them). */

const EFFECT = "rise";
const DURATION = 700;
const EASING = "cubic-bezier(.22, 1, .36, 1)";
const STAGGER = 90;
const DONE = "data-reveal-done";

// never touch these, or anything inside them
const SKIP_INSIDE = [
  "header", "nav", "footer", "[role=dialog]", ".modal", ".custom-nav",
  "[data-aos]", "[data-wow]", ".wow", "[data-reveal]", "[" + DONE + "]",
  ".krousel", ".owl-carousel", "[class*=carousel]", "[class*=marquee]", "[class*=swiper]",
  "[class*=slider]", ".smq", "form", "table", "iframe", "video",
].join(",");

function skippable(el: Element): boolean {
  if (el.closest(SKIP_INSIDE)) return true;
  // already contains its own animation: animating the wrapper too would double it
  if (el.querySelector("[data-aos],[data-wow],.wow")) return true;
  // inside a horizontal scroller: it may never intersect, and would stay hidden
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.position === "fixed" || cs.position === "sticky") return true;
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.overflowX === "hidden") && p.scrollWidth > p.clientWidth + 4) return true;
  }
  return false;
}

function tag(el: HTMLElement, delay = 0) {
  el.setAttribute("data-reveal", "auto");
  el.setAttribute("data-wow", EFFECT);
  el.setAttribute("data-wow-duration", String(DURATION));
  el.setAttribute("data-wow-easing", EASING);
  el.setAttribute("data-wow-once", "true");
  if (delay) el.setAttribute("data-wow-delay", String(delay));
  // after it has appeared, drop every trace of the reveal so the element is
  // exactly as the page styled it (hover transitions, transforms …)
  const cleanup = () => {
    el.removeEventListener("transitionend", onEnd);
    ["data-reveal", "data-wow", "data-aos", "data-wow-duration", "data-wow-easing", "data-wow-once", "data-wow-delay"].forEach((a) => el.removeAttribute(a));
    el.classList.remove("wow", "aos-animate", "wow-in");
    el.style.removeProperty("transition-duration");
    el.style.removeProperty("transition-delay");
    el.style.removeProperty("transition-timing-function");
    el.setAttribute(DONE, "");
  };
  const onEnd = (e: TransitionEvent) => {
    if (e.target === el && e.propertyName === "opacity" && el.classList.contains("wow-in")) cleanup();
  };
  el.addEventListener("transitionend", onEnd);
  // failsafe in case transitionend never fires (tab hidden, interrupted …)
  const watch = new MutationObserver(() => {
    if (el.classList.contains("wow-in")) {
      watch.disconnect();
      window.setTimeout(() => { if (el.isConnected && el.hasAttribute("data-reveal")) cleanup(); }, DURATION + delay + 400);
    }
  });
  watch.observe(el, { attributes: true, attributeFilter: ["class"] });
}

const isBig = (img: HTMLImageElement) => {
  const r = img.getBoundingClientRect();
  return r.width >= 120 && r.height >= 90;
};

// Elements that already existed at an earlier check of this page. One that is
// on screen now must not be re-hidden (the visitor has been looking at it);
// new content, or content further down, still rises in. Reset per navigation.
let seenPath = "";
let seen = new WeakSet<Element>();

/** Tags the reveal targets on the current page. Safe to call repeatedly. */
export function autoReveal(pathname = location.pathname): number {
  const root = document.getElementById("root");
  if (!root) return 0;
  if (seenPath !== pathname) {
    seenPath = pathname;
    seen = new WeakSet<Element>();
  }
  // the hero: the first top-level section of the page, however tall it is
  const hero = Array.from(root.querySelectorAll<HTMLElement>("section")).find(
    (s) => !s.closest("header, nav, footer, [role=dialog], .modal") && !s.parentElement?.closest("section"),
  );
  const headerEl = root.querySelector("header, nav");

  // in scope: outside the hero, with a size (an element inside a closed
  // accordion / tab is left out — tagging it would keep it hidden until it
  // scrolls into view), and not something already on screen at an earlier check
  const inScope = (el: HTMLElement) => {
    if (hero && hero.contains(el)) return false;
    if (headerEl && headerEl.contains(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const onScreen = r.top < window.innerHeight && r.bottom > 0;
    return !(onScreen && seen.has(el));
  };
  // not already revealing, and never one that has already appeared (DONE): a
  // card off screen when new content arrives (a form's "thank you") was
  // otherwise tagged again, and wow.js — which watches an element only once —
  // left it hidden for good
  const free = (el: HTMLElement) =>
    !el.closest("[data-reveal],[" + DONE + "]") && !el.querySelector("[data-reveal],[data-aos],[data-wow],.wow");

  const all = Array.from(root.querySelectorAll<HTMLElement>("*"));
  let count = 0;

  // 1) cards in grids / wrapping rows: each card rises, one after another
  for (const box of all) {
    const kids = Array.from(box.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
    if (kids.length < 2 || kids.length > 24) continue;
    const cs = getComputedStyle(box);
    const grid = cs.display === "grid" || cs.display === "inline-grid";
    const wrapRow = cs.display === "flex" && cs.flexWrap === "wrap" && cs.flexDirection.startsWith("row");
    if (!grid && !wrapRow) continue;
    // a "card" grid: the children are real blocks, not inline bits or tiny chips
    const blocks = kids.filter((k) => { const r = k.getBoundingClientRect(); return r.height >= 60 && r.width >= 120; });
    if (blocks.length < 2 || skippable(box)) continue;
    let n = 0;
    for (const k of kids) {
      if (!free(k) || !inScope(k) || k.getBoundingClientRect().height < 30) continue;
      tag(k, Math.min(n, 8) * STAGGER);
      n++; count++;
    }
  }

  // 2) standalone cards / panels
  root.querySelectorAll<HTMLElement>('[class*="card"], [class*="panel-box"], article').forEach((c) => {
    if (!free(c) || !inScope(c) || skippable(c)) return;
    const r = c.getBoundingClientRect();
    if (r.height < 60 || r.width < 160) return;
    tag(c); count++;
  });

  // 3) headings, and the intro line right under them
  root.querySelectorAll<HTMLElement>("h2, h3").forEach((h) => {
    if (!free(h) || !inScope(h) || skippable(h)) return;
    tag(h); count++;
    const next = h.nextElementSibling as HTMLElement | null;
    if (next && next.tagName === "P" && free(next) && inScope(next)) { tag(next, 90); count++; }
  });

  // 4) larger images that are not part of something already revealing
  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (!free(img) || !isBig(img) || !inScope(img) || skippable(img)) return;
    tag(img); count++;
  });

  all.forEach((el) => seen.add(el));
  if (count) {
    const engine = (window as any).Wow || (window as any).AOS;
    engine?.refresh?.();
  }
  return count;
}

/** Runs autoReveal for website pages: after each navigation, and again as
    content loaded from the API arrives. */
export function useAutoReveal(enabled: boolean, pathname: string) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // wow.js loads deferred: on the very first visit it may not be ready yet —
    // wait for it (html.wow-ready) instead of giving up on this page
    const ready = () => document.documentElement.classList.contains("wow-ready") && !!((window as any).Wow || (window as any).AOS);
    const go = () => { if (ready()) autoReveal(pathname); };
    let timer = 0;
    const run = () => { window.clearTimeout(timer); timer = window.setTimeout(go, 120); };
    const timers = [60, 300, 700, 1200, 1800, 3000].map((ms) => window.setTimeout(go, ms));
    const root = document.getElementById("root");
    // only new elements matter (typewriter text and counters change constantly)
    const mo = root
      ? new MutationObserver((list) => {
          if (list.some((m) => Array.from(m.addedNodes).some((n) => n.nodeType === Node.ELEMENT_NODE))) run();
        })
      : null;
    mo?.observe(root!, { childList: true, subtree: true });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(timer);
      mo?.disconnect();
    };
  }, [enabled, pathname]);
}
