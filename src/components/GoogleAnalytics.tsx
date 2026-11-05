import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export const GA_MEASUREMENT_ID: string =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ||
  "G-C4K3TRJFNC";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Checks whether the given pathname belongs to the public website.
 * Returns false for admin panel, student/trainer panels, and authentication routes.
 */
export function isWebsitePath(pathname: string): boolean {
  const p = pathname.toLowerCase().replace(/\/$/, "") || "/";
  if (
    p === "/signin" ||
    p === "/logout" ||
    p === "/dashboard" ||
    p.startsWith("/panel") ||
    p.startsWith("/admin") ||
    p.startsWith("/student") ||
    p.startsWith("/trainer")
  ) {
    return false;
  }
  return true;
}

/**
 * Custom event helper to track user interactions (conversions, button clicks, form submissions)
 * only on website pages.
 */
export function trackGAEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    if (isWebsitePath(window.location.pathname)) {
      window.gtag("event", eventName, params);
    }
  }
}

export default function GoogleAnalytics() {
  const location = useLocation();
  const scriptInjected = useRef(false);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    const isWeb = isWebsitePath(location.pathname);

    // Only load and track on public website pages
    if (!isWeb) return;

    // Dynamically inject the gtag script tag if not already injected
    if (!scriptInjected.current) {
      const existingScript = document.getElementById("ga-gtag-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "ga-gtag-script";
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(...args: any[]) {
          window.dataLayer?.push(args);
        }
        window.gtag = gtag;

        gtag("js", new Date());
        gtag("config", GA_MEASUREMENT_ID, {
          send_page_view: false, // Managed manually per route
        });
      }
      scriptInjected.current = true;
    }

    // Trigger page_view event on website route change
    // Using setTimeout(0) to allow document.title from <Head> to update first
    const timer = setTimeout(() => {
      if (typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_title: document.title,
          page_location: window.location.href,
          page_path: location.pathname + location.search,
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
}

