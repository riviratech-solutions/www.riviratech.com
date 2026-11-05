import axios from "axios";

/* How many API requests are on their way right now, for the panel's top progress
   line (components/loading/PageLoader). Counted by an axios interceptor, so it is
   the real loading state of every request (listFetch included; a list served from
   its cache sends nothing and counts nothing).

   Requests that run in the background or have their own progress display are
   not counted: the session check, the bell, search-as-you-type, video status
   polls, HLS keys and file uploads. */

const QUIET = /\/api\/(check-login|panel-notifications|panel-search|class-video-status|hls-key|upload-file|class-view\/progress)(\/|\?|$)|\/uploads\//;

let active = 0;
const listeners = new Set<(n: number) => void>();
const emit = () => listeners.forEach((fn) => fn(active));

export function onActiveRequests(fn: (n: number) => void) {
  listeners.add(fn);
  fn(active);
  return () => {
    listeners.delete(fn);
  };
}

type Marked = { __counted?: boolean };
const done = (cfg?: Marked) => {
  if (!cfg || !cfg.__counted) return;
  cfg.__counted = false;
  active = Math.max(0, active - 1);
  emit();
};

axios.interceptors.request.use((cfg) => {
  if (!QUIET.test(cfg.url || "")) {
    (cfg as Marked).__counted = true;
    active++;
    emit();
  }
  return cfg;
});
axios.interceptors.response.use(
  (res) => {
    done(res.config as Marked);
    return res;
  },
  (err) => {
    done(err?.config as Marked);
    return Promise.reject(err);
  },
);
