import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { getCachedUser } from "./currentUser";

/* GET api/check-login, made robust in one place (imported once in main.tsx).

   The menu, the top bar and each page ask it on every navigation, and every
   panel page signs the user out when the answer is "not logged in". Two things
   used to turn a hiccup into a sign-out:
     - a failed check (network blip, the API's rate limit, a database error)
       was handled as "logged out" on several pages;
     - the burst of identical checks per navigation counts against the API's
       per-minute limit.
   So here: identical checks within a few seconds share one request, and a
   check that fails for a temporary reason is retried, then answered with the
   last known sign-in (role and member ID — pages need the role, e.g. X / Y for
   admin pages), so the user stays signed in. That is safe: check-login only
   decides what the panel shows; every data request is checked on the server
   on its own. Only a real "loggedIn: false" answer signs the user out. */

const SHARE_MS = 3000;
const RETRY_MS = [700, 2000];
const isCheck = (cfg: InternalAxiosRequestConfig) =>
  (cfg.method || "get").toLowerCase() === "get" && /\/api\/check-login(\?|$)/.test(cfg.url || "");
const temporary = (err: any) => !err?.response || err.response.status === 429 || err.response.status >= 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let recent: { at: number; answer: Promise<AxiosResponse> } | null = null;

// Last good answer: role and member ID only (kept in memory; no tokens).
let lastGood: { id?: string; key?: string } | null = null;
const stillSignedIn = () => {
  const u = getCachedUser();
  return { loggedIn: true, uncertain: true, id: lastGood?.id || u?.status || "", key: lastGood?.key || u?.mem_id || "" };
};

axios.interceptors.request.use((cfg) => {
  // signing in or out changes the answer: never reuse one from before
  if (/\/api\/(signin|logout|verify-otp|reset-password)(\?|$)/.test(cfg.url || "")) { recent = null; lastGood = null; }
  if (!isCheck(cfg)) return cfg;
  if (recent && Date.now() - recent.at < SHARE_MS) {
    const shared = recent.answer;
    cfg.adapter = () => shared.then((res) => ({ ...res, config: cfg }));
    return cfg;
  }
  const send = axios.getAdapter(axios.defaults.adapter);
  const answer = (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await send(cfg);
        // raw adapter output: the body may still be a JSON string here
        let d: any = res.data;
        if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } }
        if (d?.loggedIn === true) lastGood = { id: d.id, key: d.key };
        else if (d?.loggedIn === false) lastGood = null;
        return res;
      } catch (err) {
        if (!temporary(err)) throw err;
        if (attempt < RETRY_MS.length) { await sleep(RETRY_MS[attempt]); continue; }
        // Still unreachable: don't sign the user out over it.
        if (!lastGood && !getCachedUser()) throw err; // never signed in here: nothing to keep
        return { data: stillSignedIn(), status: 200, statusText: "OK", headers: {}, config: cfg } as AxiosResponse;
      }
    }
  })();
  recent = { at: Date.now(), answer };
  answer.catch(() => { if (recent?.answer === answer) recent = null; });
  cfg.adapter = () => answer;
  return cfg;
});

export {};
