import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

/**
 * Cloudflare Turnstile CAPTCHA widget for the public forms
 * (contact, enrol, sign in).
 *
 * The widget only renders when a site key is available, so the pages keep
 * working unchanged if Turnstile is not configured. The site key is public and
 * safe to ship; the SECRET key lives only on the server (admin/.env).
 */

const SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
  "0x4AAAAAADuJjSzMXFH0Sa9v";

/** True when a site key is configured — forms then require a captcha token. */
export const captchaEnabled = Boolean(SITE_KEY);

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () =>
        window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to load"));
      s.onerror = () => reject(new Error("Turnstile failed to load"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export interface TurnstileHandle {
  /** Issue a fresh token — Turnstile tokens are single-use, so call after every attempt. */
  reset: () => void;
}

interface Props {
  onToken: (token: string | null) => void;
  /** Turnstile widget size. Defaults to "flexible": full width of the form (min 300px). */
  size?: "flexible" | "normal" | "compact";
  /** Widget colours. Defaults to "auto" (follows the device light/dark setting). */
  theme?: "auto" | "light" | "dark";
}

const TurnstileWidget = forwardRef<TurnstileHandle, Props>(function TurnstileWidget(
  { onToken, size = "flexible", theme = "auto" },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
      onTokenRef.current(null);
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !containerRef.current || widgetIdRef.current !== null) return;
        widgetIdRef.current = ts.render(containerRef.current, {
          sitekey: SITE_KEY,
          size,
          theme,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} style={{ width: "100%" }} />;
});

export default TurnstileWidget;
