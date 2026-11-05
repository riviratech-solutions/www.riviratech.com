import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { X } from "lucide-react";
import { SERVER_URL } from "./Includes";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { scopeCss } from "../utils/scopeCss";
import { marqueeShowsOn } from "../utils/marqueePages";
import "../styles/site-marquee.css";

/* Scrolling messages from the admin Marquee Messages page.

   <SiteMarquee placement="header" /> sits right under the fixed navigation bar
   (positioned at the bar's measured height, with a spacer of its own height so
   the page below moves down instead of being covered); placement="footer" is a
   normal strip just above the footer. Several messages for the same place run
   one after another in one strip, in the admin's order; the strip takes speed,
   direction and pause-on-hover from the first of them. */

export type MarqueeItem = {
  req_id: string;
  html: string;
  css?: string;
  placement: "header" | "footer" | "both";
  pages: string[];
  speed?: "slow" | "normal" | "fast";
  direction?: "left" | "right";
  pause_hover?: string;
  closable?: string;
  start_at?: number;
  end_at?: number;
};

const PX_PER_SEC = { slow: 40, normal: 70, fast: 110 };
const CLOSED_KEY = "kkr.marquee.closed";

/* ---------- one strip (also used for the admin preview) ---------- */

export function MarqueeStrip({ items, placement, onClose, className = "" }: {
  items: MarqueeItem[];
  placement: "header" | "footer";
  onClose?: (ids: string[]) => void;
  className?: string;
}) {
  const first = items[0];
  const boxRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  const [reps, setReps] = useState(1);
  const [duration, setDuration] = useState(20);

  const clean = useMemo(
    () => items.map((m) => ({ id: m.req_id, html: sanitizeHtml(m.html, { keepClassStyle: true }), css: scopeCss(m.css || "", `.smq-item-${m.req_id}`) })),
    [items],
  );

  // Each half of the track is at least as wide as the strip, so the loop never shows a gap.
  useLayoutEffect(() => {
    const box = boxRef.current, half = halfRef.current;
    if (!box || !half) return;
    const measure = () => {
      const one = half.scrollWidth / reps || 1;
      const need = Math.max(1, Math.ceil(box.clientWidth / one));
      if (need !== reps) setReps(need);
      const speed = PX_PER_SEC[first?.speed || "normal"] || 70;
      setDuration(Math.max(6, (one * need) / speed));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [clean, reps, first?.speed]);

  if (!items.length) return null;
  const closable = items.some((m) => m.closable === "1");
  const run = Array.from({ length: reps }, (_, r) =>
    clean.map((m) => (
      <span key={`${r}-${m.id}`} className={`smq-item smq-item-${m.id}`} dangerouslySetInnerHTML={{ __html: m.html }} />
    )),
  );

  return (
    <div
      className={`smq smq-${placement}${first.pause_hover !== "0" ? " smq-pause" : ""}${first.direction === "right" ? " smq-right" : ""} ${className}`}
      role="region"
      aria-label={placement === "header" ? "Announcements" : "Notices"}
    >
      {clean.map((m) => m.css && <style key={m.id}>{m.css}</style>)}
      <div className="smq-box" ref={boxRef}>
        <div className="smq-track" style={{ animationDuration: `${duration}s` }}>
          <div className="smq-half" ref={halfRef}>{run}</div>
          <div className="smq-half" aria-hidden="true">{run}</div>
        </div>
      </div>
      {closable && onClose && (
        <button
          type="button"
          className="smq-close"
          aria-label="Hide this message"
          onClick={() => onClose(items.filter((m) => m.closable === "1").map((m) => m.req_id))}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

/* ---------- the website strips ---------- */

let loaded: Promise<MarqueeItem[]> | null = null;
const loadMarquees = () => {
  if (!loaded) {
    loaded = axios
      .get(SERVER_URL + "api/public/marquees")
      .then((r) => (r.data && r.data.success && Array.isArray(r.data.data) ? r.data.data : []))
      .catch(() => {
        loaded = null; // try again on the next page
        return [];
      });
  }
  return loaded;
};

const readClosed = (): string[] => {
  try { return JSON.parse(sessionStorage.getItem(CLOSED_KEY) || "[]"); } catch { return []; }
};

export default function SiteMarquee({ placement }: { placement: "header" | "footer" }) {
  const { pathname } = useLocation();
  const [all, setAll] = useState<MarqueeItem[]>([]);
  const [closed, setClosed] = useState<string[]>(readClosed);
  const [navH, setNavH] = useState(64);
  const [stripH, setStripH] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    loadMarquees().then((rows) => live && setAll(rows));
    return () => { live = false; };
  }, []);

  const now = Math.floor(Date.now() / 1000);
  const items = all.filter(
    (m) =>
      (m.placement === placement || m.placement === "both") &&
      marqueeShowsOn(m.pages, pathname) &&
      !closed.includes(m.req_id) &&
      (!m.start_at || m.start_at <= now) &&
      (!m.end_at || m.end_at > now),
  );

  // Header strip: follow the fixed navigation bar's height (it changes on small screens).
  useEffect(() => {
    if (placement !== "header" || !items.length) return;
    const nav = document.querySelector(".rv-header__bar") as HTMLElement | null;
    if (!nav) return;
    const set = () => setNavH(nav.offsetHeight || 64);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [placement, items.length]);

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) { setStripH(0); return; }
    const set = () => setStripH(el.offsetHeight);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  if (!items.length) return null;

  const close = (ids: string[]) => {
    const next = [...new Set([...closed, ...ids])];
    setClosed(next);
    try { sessionStorage.setItem(CLOSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  if (placement === "footer") {
    return (
      <div ref={stripRef}>
        <MarqueeStrip items={items} placement="footer" onClose={close} />
      </div>
    );
  }
  return (
    <>
      <div ref={stripRef} className="smq-header-wrap" style={{ top: navH }}>
        <MarqueeStrip items={items} placement="header" onClose={close} />
      </div>
      {/* keeps the page from sliding under the strip */}
      <div aria-hidden="true" style={{ height: stripH }} />
    </>
  );
}
