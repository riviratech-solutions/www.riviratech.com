/* Pagination: after choosing another page, bring the list's table header back
   into view (just below the fixed panel header), instead of leaving the reader
   at the bottom of the old page.

   One click listener for every page, so each page's own pagination markup
   (si-pagination, dt-paging, sq-pagination, ... or anything marked
   data-pagination) needs no change. Imported once in main.tsx. */

const PAGINATION = ".si-pagination, .si-pagination-bar, .si-pagination-controls, .dt-paging, .sq-pagination-container, [data-pagination]";
const HEADER_GAP = 84; // fixed panel header + a little air

// The list a pagination bar belongs to: walking up from the bar, the nearest
// block before it that holds a table (or is a card grid, e.g. Gallery's grid view).
function listFor(bar: Element): HTMLElement | null {
  for (let node: Element | null = bar; node && node !== document.body; node = node.parentElement) {
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      const table = sib.matches("table") ? sib : sib.querySelector("table");
      if (table) {
        const card = table.closest(".si-table-card, .table-responsive, .card");
        return (card && !card.contains(bar) ? card : sib) as HTMLElement;
      }
      const cls = typeof sib.className === "string" ? sib.className : "";
      if (/grid|list/i.test(cls) && !/stat/i.test(cls) && (sib as HTMLElement).offsetHeight > 120) return sib as HTMLElement;
    }
  }
  return null;
}

function scrollToList(list: HTMLElement) {
  // Where the list starts on the page. Read now: the page's own click handler may
  // swap the table for a loader, but nothing above the list moves between pages.
  const target = Math.max(0, Math.round(list.getBoundingClientRect().top + window.scrollY - HEADER_GAP));
  window.scrollTo({ top: target, behavior: "smooth" });

  // While the old page is short (or the new one still loading) the browser can't
  // reach the spot yet; finish once it can, unless the reader has scrolled.
  let touched = false;
  const stop = () => (touched = true);
  const events = ["wheel", "touchstart", "keydown"] as const;
  events.forEach((ev) => window.addEventListener(ev, stop, { passive: true, once: true }));
  [700, 1600, 3000].forEach((ms, i, all) =>
    window.setTimeout(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (!touched && Math.abs(window.scrollY - target) > 8 && max >= target - 8) window.scrollTo({ top: target, behavior: "auto" });
      if (i === all.length - 1) events.forEach((ev) => window.removeEventListener(ev, stop));
    }, ms),
  );
}

// Capture phase: runs before React's onClick, while the old list is still on screen.
document.addEventListener(
  "click",
  (e) => {
    const target = e.target as Element | null;
    const btn = target?.closest?.("button, a, [role='button']");
    const bar = btn?.closest(PAGINATION);
    if (!btn || !bar) return;
    if ((btn as HTMLButtonElement).disabled || btn.getAttribute("aria-disabled") === "true" || btn.classList.contains("disabled")) return;
    const list = listFor(bar);
    if (list) scrollToList(list);
  },
  true,
);

export {};
