import axios from "axios";
import { SERVER_URL } from "../components/Includes";

/* Saved public website lists — the website's counterpart of listCache.ts.

   siteFetch() runs a public list request (gallery, blogs, testimonials,
   YouTube …) and keeps the answer for 10 minutes, so opening the page again,
   going back and forth between its pages, or reloading shows it instantly with
   no server call. Every request is saved on its own — each gallery / blog page
   number and category separately.

   This data is public (the same for every visitor), so it lives in
   localStorage: it survives reloads and new tabs, and expires after 10 minutes.
   The saved copy holds no database ids (see withoutIds below).
   An admin change in this browser clears it (listCache.ts → clearListCache),
   so the admin sees their edit on the website straight away. */

const PREFIX = "kkr.site:";
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;

type Entry = { at: number; body: any };
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<any>>();

const stable = (v: any): string =>
  v && typeof v === "object" && !Array.isArray(v)
    ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}"
    : JSON.stringify(v ?? null);
const endpointOf = (url: string) =>
  (url || "").replace(/^.*?\/api\//, "").replace(/^\/?(api\/)?/, "").split("?")[0].replace(/\/+$/, "");

function storedKeys(): string[] {
  const keys = new Set(memory.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.add(k);
    }
  } catch { /* storage unavailable */ }
  return [...keys];
}

function forget(k: string) {
  memory.delete(k);
  try { localStorage.removeItem(k); } catch { /* ignore */ }
}

function read(k: string): Entry | null {
  let e = memory.get(k) || null;
  if (!e) {
    try { e = JSON.parse(localStorage.getItem(k) || "null"); } catch { e = null; }
    if (e) memory.set(k, e);
  }
  if (e && Date.now() - e.at > TTL_MS) { forget(k); return null; }
  return e;
}

// Database ids never go into storage: id, uid, req_id and anything ending in
// "_id" / "Id" are removed (at any depth) from the saved copy. This tab keeps
// the full answer in memory; pages work from the saved copy without ids.
const ID_KEY = /^(id|uid|.+_id|.+Id)$/;
function withoutIds(v: any): any {
  if (Array.isArray(v)) return v.map(withoutIds);
  if (v && typeof v === "object") {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(v)) if (!ID_KEY.test(key)) out[key] = withoutIds(val);
    return out;
  }
  return v;
}

function write(k: string, e: Entry) {
  memory.set(k, e);
  const json = JSON.stringify({ at: e.at, body: withoutIds(e.body) });
  for (let tries = 0; tries < 5; tries++) {
    try { localStorage.setItem(k, json); break; } catch {
      // storage full: drop the oldest saved lists and try again
      const old = storedKeys().map((key) => ({ key, at: read(key)?.at ?? 0 })).sort((a, b) => a.at - b.at).slice(0, 10);
      if (!old.length) break;
      old.forEach((o) => forget(o.key));
    }
  }
  const all = storedKeys();
  if (all.length > MAX_ENTRIES) {
    all.map((key) => ({ key, at: read(key)?.at ?? 0 })).sort((a, b) => a.at - b.at)
      .slice(0, all.length - MAX_ENTRIES).forEach((o) => forget(o.key));
  }
}

async function securityToken() {
  const res = await axios.get(SERVER_URL + "api/security/token", { withCredentials: true });
  return res.data || {};
}

/**
 * A public list request, answered from the saved copy when there is one.
 *   const res = await siteFetch("api/gallery/images", { method: "post", params: { n: page } });
 *   const res = await siteFetch("api/get-youtube");
 *   res.data -> the response body, as with axios
 */
export async function siteFetch(
  url: string,
  opts: { method?: "get" | "post"; params?: Record<string, any>; fresh?: boolean } = {},
): Promise<{ data: any; savedAt: number; cached: boolean }> {
  const method = opts.method || "get";
  const params = opts.params || {};
  const k = `${PREFIX}${method}:${endpointOf(url)}:${stable(params)}`;
  if (!opts.fresh) {
    const hit = read(k);
    if (hit) return { data: hit.body, savedAt: hit.at, cached: true };
    const pending = inflight.get(k);
    if (pending) return pending; // the same request is already on its way
  }
  const p = (async () => {
    let res;
    if (method === "post") {
      const sec = await securityToken();
      res = await axios.post(SERVER_URL + "api/" + endpointOf(url), { ...params, key: sec.key, token: sec.token, aut: sec.aut }, { withCredentials: true });
    } else {
      res = await axios.get(SERVER_URL + "api/" + endpointOf(url), { params });
    }
    const at = Date.now();
    if (res.data && res.data.success !== false) write(k, { at, body: res.data });
    return { data: res.data, savedAt: at, cached: false };
  })();
  inflight.set(k, p);
  try { return await p; } finally { inflight.delete(k); }
}

/** Drop every saved website list (e.g. after an admin change). */
export function clearSiteCache() {
  storedKeys().forEach(forget);
}
