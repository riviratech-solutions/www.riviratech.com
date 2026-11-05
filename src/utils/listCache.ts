import axios from "axios";
import { useEffect, useState } from "react";
import { SERVER_URL } from "../components/Includes";
import { getCachedUser } from "./currentUser";
import { clearSiteCache } from "./siteCache";

/* Saved panel lists.

   listFetch() runs a panel list request (page, filter, sort, search, ...) and
   saves the answer, so opening the same list again shows instantly with no
   server call. A saved list is used for 10 minutes, and is dropped sooner when:
     - the page's refresh button calls refreshLists() for its endpoints,
     - any change goes through (add / update / delete / enable / ...): the
       axios interceptor below clears every saved list on a successful POST
       that isn't a known read,
     - the user signs out (clearListCache()).

   Lists are kept per signed-in account in sessionStorage: they survive a page
   reload but go when the tab closes, so student contact details don't stay on
   the computer. */

const PREFIX = "kkr.list:";
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 1500;
const EVENT = "rt-list-saved";

type Entry = { at: number; body: any };
const memory = new Map<string, Entry>();

// POSTs that only read, so they never clear saved lists. Anything else that
// succeeds is treated as a change.
const reads = new Set<string>([
  "security/token", "check-login", "my-permissions", "me", "panel-notifications", "panel-search",
  "get-upload-url", "get-upload-urls", "check-assignment", "check-student-account", "students/search",
  "dashboard-snapshot", // the admin's own "last seen" counts, not list data
  // class video viewing (class-views.js): saved often while a video plays, and no list shows it
  "class-view/start", "class-view/progress", "class-view/my-progress", "class-views/report", "class-view/lock-status",
  // list endpoints whose names don't say "list"
  "activities", "activities-actor", "adminers", "class-overview", "class-schedules", "course-resources", "student/class-schedule", "student/my-referrals", "aichatbot", "assignments", "batches", "blog-categories", "blogimgs",
  "blogs", "certificates", "courses", "dashboard-stats", "enrollees", "events", "feedbacks", "galleryimgs",
  "inquiries-received", "live-classes", "load-month-classes", "load-month-trainer-classes", "my-feedbacks", "my-stats",
  "my-tickets", "pages", "surveys", "qa-list", "qa-trainers", "raised-tickets", "refers", "student/trainer-contacts",
  "student/trainers-list", "students", "sub-assignments", "subscriptions", "trainer-contacts", "trainer-stats",
  "trainer/trainer-contacts", "trainers", "web-contacts", "stripe/coupons", "stripe/promotion-codes",
  // website lists (utils/siteCache.ts) and other reads sent as POST
  "gallery/images", "blogs/latest", "blogs/categories", "my-notices", "notice-student", "event-latest", "public/jobs", "public/job", "public/open-survey",
]);
const READ_PATTERN = /^(get-|backup\/|blogs\/by-slug\/)|\/(list|get|responses|submissions|applications|students|notifies|pending)$|-list$/;

// "api/events", "/api/events" or a full URL -> "events"
const endpointOf = (url: string) =>
  (url || "").replace(/^.*?\/api\//, "").replace(/^\/?(api\/)?/, "").split("?")[0].replace(/\/+$/, "");
const isRead = (ep: string) => reads.has(ep) || READ_PATTERN.test(ep);

const account = () => getCachedUser()?.mem_id || "guest";
const stable = (v: any): string =>
  v && typeof v === "object" && !Array.isArray(v)
    ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}"
    : JSON.stringify(v ?? null);
const keyOf = (ep: string, params: Record<string, any>) => {
  const { key, token, aut, ...rest } = params || {}; // eslint-disable-line @typescript-eslint/no-unused-vars
  return `${PREFIX}${account()}:${ep}:${stable(rest)}`;
};

function read(k: string): Entry | null {
  let e = memory.get(k) || null;
  if (!e) {
    try { e = JSON.parse(sessionStorage.getItem(k) || "null"); } catch { e = null; }
    if (e) memory.set(k, e);
  }
  if (e && Date.now() - e.at > TTL_MS) { forget(k); return null; }
  return e;
}

function forget(k: string) {
  memory.delete(k);
  try { sessionStorage.removeItem(k); } catch { /* storage unavailable */ }
}

function storedKeys(): string[] {
  const keys = new Set(memory.keys());
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.add(k);
    }
  } catch { /* storage unavailable */ }
  return [...keys];
}

function write(k: string, e: Entry) {
  memory.set(k, e);
  const json = JSON.stringify(e);
  for (let tries = 0; tries < 5; tries++) {
    try { sessionStorage.setItem(k, json); break; } catch {
      // storage full: drop the oldest saved lists and try again
      const old = storedKeys()
        .map((key) => ({ key, at: read(key)?.at ?? 0 }))
        .sort((a, b) => a.at - b.at)
        .slice(0, 10);
      if (!old.length) break;
      old.forEach((o) => { try { sessionStorage.removeItem(o.key); } catch { /* ignore */ } });
    }
  }
  const all = storedKeys();
  if (all.length > MAX_ENTRIES) {
    all.map((key) => ({ key, at: read(key)?.at ?? 0 })).sort((a, b) => a.at - b.at)
      .slice(0, all.length - MAX_ENTRIES).forEach((o) => forget(o.key));
  }
}

/* Endpoints each panel page (by path) has loaded through listFetch, so its
   refresh button can drop exactly those. */
const pageEndpoints: Record<string, Set<string>> = {};

/* When the list now on screen was saved, per endpoint, for <SavedAgo>. */
const shownAt: Record<string, number> = {};
const announce = (ep: string, at: number) => {
  shownAt[ep] = at;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: ep }));
};

async function securityToken() {
  const res = await axios.get(SERVER_URL + "api/security/token", { withCredentials: true });
  return res.data || {};
}

/**
 * POST a list request, or answer it from the saved copy.
 *   const res = await listFetch("api/events", { q, s, n: page });
 *   res.data -> the response body, as with axios
 */
// An empty list is an answer too ("No data found", "No Courses", ...): saving
// it spares a request on every visit. Errors (sign-in, security) are not saved.
const isEmptyAnswer = (body: any) =>
  body.success === false &&
  /^no\b/i.test(String(body.message || "").trim()) &&
  (body.data === undefined || (Array.isArray(body.data) && body.data.length === 0));

// The filters each list was last loaded with (search, dates, status, ...), so
// an export of "all matching rows" asks for exactly what the page shows.
const lastParams: Record<string, Record<string, any>> = {};

export async function listFetch(url: string, params: Record<string, any> = {}, opts: { fresh?: boolean } = {}) {
  const ep = endpointOf(url);
  reads.add(ep);
  lastParams[ep] = params;
  (pageEndpoints[location.pathname] ||= new Set()).add(ep);
  const k = keyOf(ep, params);
  if (!opts.fresh) {
    const hit = read(k);
    if (hit) { announce(ep, hit.at); return { data: hit.body, savedAt: hit.at, cached: true }; }
  }
  const sec = await securityToken();
  const res = await axios.post(SERVER_URL + "api/" + ep, { ...params, key: sec.key, token: sec.token, aut: sec.aut }, { withCredentials: true });
  const at = Date.now();
  if (res.data && (res.data.success !== false || isEmptyAnswer(res.data))) write(k, { at, body: res.data });
  announce(ep, at);
  return { data: res.data, savedAt: at, cached: false };
}

/** Drop the saved copies of these endpoints (every page/filter), e.g. on refresh. */
export function refreshLists(...urls: string[]) {
  const eps = urls.map(endpointOf);
  const mine = `${PREFIX}${account()}:`;
  storedKeys().filter((k) => k.startsWith(mine) && eps.some((ep) => k.startsWith(mine + ep + ":"))).forEach(forget);
}

/** Drop every saved list (all accounts) — after a change and on sign-out.
    Also drops the saved website lists, so an admin's edit shows on the site. */
export function clearListCache() {
  storedKeys().forEach(forget);
  clearSiteCache();
  try { sessionStorage.removeItem("kkr.activityProfiles"); } catch { /* ignore */ }
}

/* Refresh buttons carry data-refresh. A click first drops everything this page
   has saved (its list and lookups such as courses or batches); the button's own
   handler then reloads, which now goes to the server. Capture phase, so this
   runs before React's onClick. */
document.addEventListener(
  "click",
  (e) => {
    const btn = (e.target as Element | null)?.closest?.("[data-refresh]");
    if (!btn || (btn as HTMLButtonElement).disabled) return;
    const eps = pageEndpoints[location.pathname];
    if (eps && eps.size) refreshLists(...eps);
  },
  true,
);

// Any successful change clears saved lists, so nothing stale is shown after an edit.
axios.interceptors.response.use((res) => {
  const cfg = res.config || {};
  const method = (cfg.method || "get").toLowerCase();
  const url = cfg.url || "";
  const ep = url.includes("/api/") ? endpointOf(url) : "";
  if (ep && method !== "get" && !isRead(ep) && res.data?.success !== false) clearListCache();
  if (ep === "logout" || ep === "signin") clearListCache();
  return res;
});

/** "Saved 3 min ago" for the list now shown from an endpoint. */
export function useSavedAt(url: string) {
  const ep = endpointOf(url);
  const [at, setAt] = useState<number | undefined>(shownAt[ep]);
  const [, tick] = useState(0);
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail === ep) setAt(shownAt[ep]); };
    window.addEventListener(EVENT, on);
    const t = window.setInterval(() => tick((n) => n + 1), 30000);
    return () => { window.removeEventListener(EVENT, on); window.clearInterval(t); };
  }, [ep]);
  return at;
}

export function savedAgoText(at?: number) {
  if (!at) return "";
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 45) return "Updated just now";
  const m = Math.round(s / 60);
  return m < 60 ? `Saved ${m} min ago` : "Saved over an hour ago";
}

/**
 * Every row matching the list's current filters, for an export: the list's
 * last request again, as one page with export_all (the API then returns up to
 * EXPORT_MAX rows instead of 10). Never saved as a list page.
 *   const { rows, total } = await fetchAllRows("api/web-contacts");
 */
export const EXPORT_MAX = 5000;
export async function fetchAllRows(url: string): Promise<{ rows: any[]; total: number }> {
  const ep = endpointOf(url);
  const { n, ...filters } = lastParams[ep] || {}; // eslint-disable-line @typescript-eslint/no-unused-vars
  const sec = await securityToken();
  const res = await axios.post(
    SERVER_URL + "api/" + ep,
    { ...filters, n: 1, export_all: "1", key: sec.key, token: sec.token, aut: sec.aut },
    { withCredentials: true },
  );
  const body = res.data || {};
  const rows = Array.isArray(body.data) ? body.data : [];
  if (body.success === false && rows.length === 0 && !/no (data|record)/i.test(String(body.message || ""))) {
    throw new Error(body.message || "Could not load the rows to export");
  }
  const total = Number(body.total ?? body.listTotal ?? rows.length) || rows.length;
  return { rows, total };
}
