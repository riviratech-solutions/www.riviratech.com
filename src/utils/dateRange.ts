/* A bootcamp's dates for display, from its start and expiry (Unix seconds,
   set in Admin → Workshops), in the style the Workshop page has always used:
     same month   "October 1 – 31, 2026"
     same year    "November 2 – December 2, 2026"
     other years  "December 20, 2026 – January 5, 2027"
     start only   "Starts November 2, 2026"
     expiry only  "Until December 2, 2026"
   Used by the website's Workshop page and the admin preview. */

const MONTH = (d: Date) => d.toLocaleDateString("en-US", { month: "long" });
const FULL = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const toDate = (sec: unknown): Date | null => {
  const n = Number(sec);
  return n > 0 ? new Date(n * 1000) : null;
};

export function bootcampDates(startAt: unknown, expireAt: unknown): string {
  const s = toDate(startAt);
  const e = toDate(expireAt);
  if (s && e && e > s) {
    if (s.getFullYear() !== e.getFullYear()) return `${FULL(s)} – ${FULL(e)}`;
    if (s.getMonth() !== e.getMonth()) return `${MONTH(s)} ${s.getDate()} – ${MONTH(e)} ${e.getDate()}, ${e.getFullYear()}`;
    if (s.getDate() !== e.getDate()) return `${MONTH(s)} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
    return FULL(s); // a one-day event
  }
  if (s) return `Starts ${FULL(s)}`;
  if (e) return `Until ${FULL(e)}`;
  return "";
}
