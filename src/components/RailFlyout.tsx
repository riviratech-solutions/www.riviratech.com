import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

/* The submenu of the collapsed sidebar (icon rail). Clicking a section tile
   opens a panel beside it listing that section's pages — icon + name — instead
   of dropping unlabelled icon tiles into the rail.

   Which pages belong to which section is read from the same panel.css rules
   that collapse the sections in the full menu (".admin-nav.col-<group> li:has(
   a[href="…"])"), so the two never drift apart. Pages the account may not open
   (admin permissions) are left out via `canOpen`. */

type Matcher = { href?: string; cls?: string };
let groupCache: Map<string, Matcher[]> | null = null;

function sectionPages(): Map<string, Matcher[]> {
  if (groupCache) return groupCache;
  const map = new Map<string, Matcher[]>();
  const add = (g: string, m: Matcher) => {
    const list = map.get(g) || [];
    if (!list.some((x) => x.href === m.href && x.cls === m.cls)) list.push(m);
    map.set(g, list);
  };
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules && !(rule instanceof CSSStyleRule)) {
        walk((rule as CSSGroupingRule).cssRules);
        continue;
      }
      const text = (rule as CSSStyleRule).selectorText;
      if (!text || !text.includes(".col-")) continue;
      for (const part of text.split(",")) {
        const byHref = part.match(/\.col-([\w-]+)\s+li:has\(a\[href="([^"]+)"\]\)/);
        if (byHref) { add(byHref[1], { href: byHref[2] }); continue; }
        const byClass = part.match(/\.col-([\w-]+)\s+li\.([\w-]+)\s*$/);
        if (byClass) add(byClass[1], { cls: byClass[2] });
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules); } catch { /* another origin's sheet */ }
  }
  if (map.size) groupCache = map; // stylesheet not loaded yet: try again next time
  return map;
}

type Item = { href: string; label: string; svg: string; active: boolean; external: boolean; order: number };
type Open = { group: string; title: string; top: number; heading: HTMLElement; items: Item[] };

const labelOf = (el: Element) =>
  Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export default function RailFlyout({ enabled, canOpen }: { enabled: boolean; canOpen: (href: string) => boolean }) {
  const [open, setOpen] = useState<Open | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const close = useCallback((focusHeading = false) => {
    setOpen((cur) => {
      if (cur) {
        cur.heading.classList.remove("rail-open");
        if (focusHeading) cur.heading.focus?.();
      }
      return null;
    });
  }, []);

  // a section tile in the rail opens this panel instead of expanding in place
  useEffect(() => {
    if (!enabled) { close(); return; }
    const onClick = (e: MouseEvent) => {
      if (!window.matchMedia("(min-width: 769px)").matches) return;
      const heading = (e.target as Element)?.closest?.(".sidebar .menu-heading") as HTMLElement | null;
      if (!heading) return;
      e.preventDefault();
      e.stopPropagation(); // keep the full menu's open/closed sections as they are
      const group = Array.from(heading.classList).find((c) => c.startsWith("mh-"))?.slice(3) || "";
      if (open && open.group === group) { close(); return; }
      const sidebar = heading.closest(".sidebar");
      if (!sidebar) return;
      const matchers: Matcher[] = group === "dashboard" ? [{ href: "/dashboard" }] : sectionPages().get(group) || [];
      const items: Item[] = [];
      sidebar.querySelectorAll<HTMLLIElement>("li:not(.menu-heading)").forEach((li) => {
        const a = li.querySelector<HTMLAnchorElement>("a[href]");
        const href = a?.getAttribute("href") || "";
        const member = matchers.some((m) => (m.href && m.href === href) || (m.cls && li.classList.contains(m.cls)));
        if (!member || !a || !canOpen(href)) return;
        const svg = li.querySelector("svg");
        items.push({
          href,
          label: labelOf(a) || li.title || href,
          svg: svg ? svg.outerHTML : "",
          active: li.classList.contains("active"),
          external: a.target === "_blank" || /^https?:/i.test(href),
          order: Number(getComputedStyle(li).order) || 0,
        });
      });
      items.sort((x, y) => x.order - y.order);
      open?.heading.classList.remove("rail-open");
      heading.classList.add("rail-open");
      const r = heading.getBoundingClientRect();
      setOpen({ group, title: labelOf(heading) || group, top: r.top, heading, items });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, open, canOpen, close]);

  // close: navigation, outside click, Escape, the rail scrolling
  useEffect(() => { close(); }, [location.pathname, close]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      if (panelRef.current?.contains(t) || t.closest?.(".sidebar .menu-heading")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(true); };
    const onScroll = (e: Event) => { if ((e.target as Element)?.closest?.(".sidebar")) close(); };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, true);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a")?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  if (!open) return null;
  // keep the whole panel on screen
  const height = 52 + open.items.length * 42;
  const top = Math.max(72, Math.min(open.top, window.innerHeight - height - 12));
  // the little pointer stays level with the tile that opened it, even when the panel had to move up
  const pointer = Math.max(14, Math.min(open.top + 21 - top, height - 26));
  return (
    <div ref={panelRef} className="rail-flyout" style={{ top, ["--rf-pointer" as any]: pointer + "px" }} role="dialog" aria-label={open.title}>
      <div className="rail-flyout-title">{open.title}</div>
      {open.items.length === 0 ? (
        <div className="rail-flyout-empty">No pages here.</div>
      ) : (
        <ul>
          {open.items.map((it) => {
            const body = (
              <>
                <span className="rail-flyout-ico" dangerouslySetInnerHTML={{ __html: it.svg }} />
                <span>{it.label}</span>
              </>
            );
            return (
              <li key={it.href} className={it.active ? "active" : ""}>
                {it.external ? (
                  <a href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => close()}>{body}</a>
                ) : (
                  <Link to={it.href} onClick={() => close()}>{body}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
