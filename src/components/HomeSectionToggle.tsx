import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { SERVER_URL } from "./Includes";

/**
 * The whole-section "show on home page" switch for the YouTube and Testimonials
 * admin pages (api/home-sections.js). Off hides the section from the website
 * home page, whatever the individual items say. It also warns when the switch is
 * on but every item is hidden — the home page drops the section then too.
 */
type Props = {
  section: "youtube" | "testimonials" | "partners";
  /** items currently set to show (status "1") */
  visibleCount: number;
  /** "Show / hide" permission on this page */
  canChange: boolean;
};

const getSecurity = async () =>
  (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

export default function HomeSectionToggle({ section, canChange }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // A second try: on the first page of a new browser session this request
      // and the page's own list request each start the session at once, and
      // the token of one of them is then refused.
      for (let attempt = 0; attempt < 2 && alive; attempt++) {
        try {
          if (attempt) await new Promise((r) => setTimeout(r, 700));
          const s = await getSecurity();
          const res = await axios.post(
            SERVER_URL + `api/${section}-section-get`,
            { key: s.key, token: s.token, aut: s.aut },
            { withCredentials: true },
          );
          if (res.data.success) {
            if (alive) setEnabled(!!res.data.enabled);
            return;
          }
        } catch {
          /* try again, else leave it unknown; the switch stays disabled */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [section]);

  const toggle = async () => {
    if (enabled === null || busy || !canChange) return;
    const next = !enabled;
    setBusy(true);
    setEnabled(next);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + `api/${section}-section-set`,
        { enabled: next, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (res.data.success) toast.success(res.data.message);
      else {
        setEnabled(!next);
        toast.error(res.data.message || "Could not save the setting");
      }
    } catch {
      setEnabled(!next);
      toast.error("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const label = enabled === null ? "Loading…" : enabled ? "Shown on home page" : "Hidden from home page";

  return (
    <div className="hst-wrap">
      <style>{CSS}</style>
      <button
        type="button"
        role="switch"
        aria-checked={!!enabled}
        className={"hst-btn" + (enabled ? " is-on" : enabled === false ? " is-off" : "")}
        onClick={toggle}
        disabled={enabled === null || busy || !canChange}
        title={canChange ? "Show or hide this whole section on the website home page" : "You don't have the Show / hide permission"}
      >
        <span className="hst-switch" aria-hidden="true" />
        <span>{label}</span>
      </button>
    </div>
  );
}

const CSS = `
.hst-wrap { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.hst-btn {
  display: inline-flex; align-items: center; gap: 10px; height: 40px; padding: 0 14px;
  border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #334155;
  font-size: 13.5px; font-weight: 600; cursor: pointer; transition: border-color .15s, background .15s;
}
.hst-btn:hover:not(:disabled) { border-color: #a5b4fc; }
.hst-btn:disabled { opacity: .6; cursor: not-allowed; }
.hst-btn.is-on { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
.hst-btn.is-off { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.hst-switch {
  position: relative; width: 34px; height: 20px; border-radius: 999px; background: #cbd5e1;
  transition: background .15s; flex: none;
}
.hst-switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
  border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s;
}
.hst-btn.is-on .hst-switch { background: #10b981; }
.hst-btn.is-on .hst-switch::after { transform: translateX(14px); }
.hst-btn.is-off .hst-switch { background: #ef4444; }
.hst-note { font-size: 11.5px; color: #0B3D7A; max-width: 260px; text-align: right; }
.panel-dark .hst-btn { background: #1e293b; border-color: #334155; color: #cbd5e1; }
.panel-dark .hst-btn.is-on { background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.4); color: #6ee7b7; }
.panel-dark .hst-btn.is-off { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.4); color: #fca5a5; }
`;
