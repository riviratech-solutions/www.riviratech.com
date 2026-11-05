import axios, { type InternalAxiosRequestConfig } from "axios";
import { SERVER_URL } from "../components/Includes";

/* CSRF token for the API (api/security/csrf.js), in one place for every page.

   Every POST / PUT / PATCH / DELETE to the API gets the "x-csrf-token" header,
   with cookies included (the token is checked against the CSRF cookie). The
   token comes from GET api/csrf-token once and is reused; if the server
   refuses it — the session changed, e.g. after signing out — a fresh one is
   fetched and the request is sent once more. Imported once in main.tsx. */

const UNSAFE = new Set(["post", "put", "patch", "delete"]);
const isApi = (url = "") => url.includes("/api/") && !/\/api\/upload-file(\?|$)/.test(url); // uploads use a signed URL

let token: Promise<string> | null = null;
let current = ""; // the last token received, for requests that can't wait (see csrfTokenNow)
function csrfToken(): Promise<string> {
  if (!token) {
    token = axios
      .get(SERVER_URL + "api/csrf-token", { withCredentials: true })
      .then((r) => (current = String(r.data?.csrfToken || "")))
      .catch((err) => {
        token = null;
        throw err;
      });
  }
  return token;
}

axios.interceptors.request.use(async (cfg: InternalAxiosRequestConfig) => {
  if (!UNSAFE.has((cfg.method || "get").toLowerCase()) || !isApi(cfg.url)) return cfg;
  cfg.withCredentials = true;
  cfg.headers.set("x-csrf-token", await csrfToken());
  return cfg;
});

axios.interceptors.response.use(undefined, async (err) => {
  const cfg = err?.config as (InternalAxiosRequestConfig & { _csrfRetry?: boolean }) | undefined;
  if (cfg && !cfg._csrfRetry && err.response?.status === 403 && err.response?.data?.code === "EBADCSRFTOKEN") {
    cfg._csrfRetry = true;
    token = null;
    cfg.headers.set("x-csrf-token", await csrfToken());
    return axios.request(cfg);
  }
  throw err;
});

/** The CSRF token already received ("" if none yet), for a request sent while the
    page is closing (fetch keepalive), which can't wait for one. */
export const csrfTokenNow = () => current;
