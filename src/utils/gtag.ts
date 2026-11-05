import { useEffect } from "react";
import { isWebsitePath } from "../components/GoogleAnalytics";

/**
 * Report a virtual page view to GA4 (gtag is loaded by components/GoogleAnalytics).
 *
 * The site-wide component already counts every route change. Use this for views
 * that change WITHOUT a route change — e.g. the Course Plan tabs — so each gets
 * its own row in the Pages report. Pass null to send nothing (the route itself
 * has already been counted).
 */
export function useGoogleAnalytics(virtualPath: string | null) {
  useEffect(() => {
    if (!virtualPath) return;
    const timer = setTimeout(() => {
      if (typeof window.gtag === "function" && isWebsitePath(window.location.pathname)) {
        window.gtag("event", "page_view", {
          page_title: document.title,
          page_location: window.location.origin + virtualPath,
          page_path: virtualPath,
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [virtualPath]);
}
