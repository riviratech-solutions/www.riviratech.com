import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { Head, SERVER_URL, AWS_UPLOADS } from "../../components/Includes";
import NotFound from "./NotFound";
import { safeMarkup } from "../../utils/sanitizeHtml";

type PageData = { title: string; html: string; css: string };
type Cached = { t: number; found: boolean; data: PageData | null };

// Cache each slug's rendered page for an hour. First hit fetches + stores; any
// reload within the window renders straight from localStorage with no network
// call. A stale (or absent) entry falls through to a fresh fetch.
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cacheKey = (slug: string) => "custompage:" + slug;

const readCache = (slug: string): Cached | null => {
  try {
    const raw = localStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (!c || typeof c.t !== "number" || Date.now() - c.t > CACHE_TTL) return null;
    return c;
  } catch { return null; }
};

const writeCache = (slug: string, found: boolean, data: PageData | null) => {
  try { localStorage.setItem(cacheKey(slug), JSON.stringify({ t: Date.now(), found, data })); } catch { /* quota/full — ignore */ }
};

/**
 * Renders an admin-built Custom Page for any URL that no static route claimed.
 * The full path (minus the leading slash) is the page slug — so it covers both
 * "/about-us" and "/services/ai-consulting". Falls back to <NotFound /> when no
 * active page matches, keeping real 404s intact.
 *
 * Fetched pages are cached in localStorage for an hour (see CACHE_TTL): the
 * first visit hits the API, later reloads within the window read from cache.
 */
export default function CustomPage() {
  const location = useLocation();
  const slug = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  // Seed synchronously from a fresh cache entry so a reload paints instantly
  // (no loading flash, no request).
  const cached = readCache(slug);
  const [state, setState] = useState<"loading" | "found" | "notfound">(
    cached ? (cached.found ? "found" : "notfound") : "loading"
  );
  const [data, setData] = useState<PageData | null>(cached?.data ?? null);

  useEffect(() => {
    let alive = true;

    // Serve from a still-fresh cache entry without touching the network.
    const hit = readCache(slug);
    if (hit) {
      setData(hit.data);
      setState(hit.found ? "found" : "notfound");
      return;
    }

    setState("loading");
    setData(null);

    (async () => {
      try {
        const res = await axios.post(SERVER_URL + "api/public/page", { slug }, { withCredentials: true });
        if (!alive) return;
        if (res.data.success) {
          setData(res.data.data);
          setState("found");
          writeCache(slug, true, res.data.data);
        } else {
          setState("notfound");
          writeCache(slug, false, null);
        }
      } catch {
        // Network/server error: don't cache — let the next visit retry.
        if (alive) setState("notfound");
      }
    })();

    return () => { alive = false; };
  }, [slug]);

  if (state === "loading") {
    return (
      <div style={{ display: "grid", minHeight: "60vh", placeItems: "center", color: "#64748b" }}>
        Loading…
      </div>
    );
  }

  if (state === "notfound" || !data) {
    return <NotFound />;
  }

  return (
    <>
      <Head pageTitle={data.title} pageDesc={data.title} pageKeywords={data.title} />
      <div className="custompage">
        <style>{data.css}</style>
        {/* the page's own markup, minus anything that could run script (safeMarkup) */}
        <div className="tailwind" data-aos="fade-in" dangerouslySetInnerHTML={{ __html: safeMarkup((data.html || "").replaceAll("AWSPATH/", AWS_UPLOADS)) }} />
      </div>
    </>
  );
}
