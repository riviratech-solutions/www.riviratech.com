import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ScrollText, RotateCw, Download, Globe, Server, Bot, AlertTriangle, TerminalSquare } from "lucide-react";
import ListSearch from "../../../components/ListSearch";
import { InlineLoader } from "../../../components/loading";

const seo = getSeoByPath("");

/* Admin → Server Logs: the systemd journal of the website, API and assistant
   services (api/admin/server-logs/server-logs.js), always loaded fresh. */

type UnitKey = "web" | "api" | "assistant";
type Status = { loaded: boolean; active: string; sub: string; since: string; pid: number; memory: number; restarts: number } | null;

const TABS: { key: UnitKey; label: string; icon: React.ReactNode }[] = [
  { key: "web", label: "Website", icon: <Globe size={15} /> },
  { key: "api", label: "API", icon: <Server size={15} /> },
  { key: "assistant", label: "Assistant", icon: <Bot size={15} /> },
];
const LINE_CHOICES = [200, 500, 1000, 2000];
const AUTO_MS = 10000;

// "2026-10-11T10:22:33+0530 host proc[123]: message"
const LINE_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:?\d{2}|Z)?)\s+(\S+)\s+([^\s:[]+)(?:\[(\d+)\])?:\s?(.*)$/;
const ERR_RE = /\b(error|errors|err|fatal|exception|traceback|crit(?:ical)?|panic|uncaught|unhandled|econnrefused|eaddrinuse)\b|❌/i;
const WARN_RE = /\b(warn(?:ing)?|deprecat\w*|timeout|timed out|retry(?:ing)?)\b|⚠/i;

type Parsed = { raw: string; time: string; proc: string; msg: string; level: "error" | "warn" | "info" | "meta" };
function parse(raw: string): Parsed {
  const m = raw.match(LINE_RE);
  if (!m) return { raw, time: "", proc: "", msg: raw, level: raw.startsWith("--") ? "meta" : ERR_RE.test(raw) ? "error" : WARN_RE.test(raw) ? "warn" : "info" };
  const msg = m[5];
  const d = new Date(m[1].replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  const time = isNaN(d.getTime())
    ? m[1]
    : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return { raw, time, proc: m[3] + (m[4] ? `[${m[4]}]` : ""), msg, level: ERR_RE.test(msg) ? "error" : WARN_RE.test(msg) ? "warn" : "info" };
}

function statusPill(s: Status) {
  if (!s) return ["Unknown", "sl-pill-gray"];
  if (!s.loaded) return ["Not installed", "sl-pill-gray"];
  if (s.active === "active") return [s.sub === "running" ? "Running" : "Active", "sl-pill-green"];
  if (s.active === "failed") return ["Failed", "sl-pill-red"];
  if (s.active === "activating" || s.active === "reloading") return ["Starting", "sl-pill-amber"];
  return ["Stopped", "sl-pill-gray"];
}
const mb = (bytes: number) => (bytes >= 1024 ** 3 ? (bytes / 1024 ** 3).toFixed(2) + " GB" : Math.round(bytes / 1024 ** 2) + " MB");

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

export default function ServerLogs() {
  const navigate = useNavigate();
  const [unit, setUnit] = useState<UnitKey>("web");
  const [lines, setLines] = useState(1000);
  const [show, setShow] = useState<"all" | "problems" | "errors">("all");
  const [search, setSearch] = useState("");
  const [wrap, setWrap] = useState(true);
  const [newestFirst, setNewestFirst] = useState(true); // newest lines at the top by default
  const [auto, setAuto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ lines: string[]; via: string; status: Status; fetchedAt: number; unit: string } | null>(null);
  const [failure, setFailure] = useState<any>(null);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const reqSeq = useRef(0);

  const post = async (path: string, body: any = {}) => {
    const s = (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;
    return (await axios.post(SERVER_URL + path, { ...body, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true })).data;
  };

  const loadStatuses = async () => {
    try {
      const r = await post("api/server-logs/status");
      if (r.success) setStatuses(Object.fromEntries(Object.entries(r.data).map(([k, v]: any) => [k, v.status])));
    } catch { /* tabs just show no dot */ }
  };

  const load = async (quiet = false) => {
    const seq = ++reqSeq.current;
    const box = boxRef.current;
    // keep following the end of the log only if the reader is already there
    const atEnd = !box || (newestFirst ? box.scrollTop < 40 : box.scrollHeight - box.scrollTop - box.clientHeight < 40);
    if (!quiet) setLoading(true);
    try {
      const r = await post("api/server-logs/read", { unit, lines });
      if (seq !== reqSeq.current) return; // a newer request (other tab / count) won
      if (r.success) {
        setData({ lines: r.lines || [], via: r.via, status: r.status, fetchedAt: r.fetchedAt, unit: r.unit });
        setStatuses((s) => ({ ...s, [unit]: r.status }));
        setFailure(null);
        if (atEnd || !quiet) {
          requestAnimationFrame(() => {
            const b = boxRef.current;
            if (b) b.scrollTop = newestFirst ? 0 : b.scrollHeight;
          });
        }
      } else {
        setData(null);
        setFailure(r);
      }
    } catch {
      if (seq !== reqSeq.current) return;
      if (!quiet) toast.error("Could not load the logs");
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  };

  // Requests go one after another: security tokens are tied to the browser's
  // session, and a browser without a session cookie yet (first visit, or after
  // the API restarted) gets a new session per token request — two in parallel
  // and one of them belongs to the session that lost.
  const [ready, setReady] = useState(false);
  const initchecklogin = async () => {
    try {
      const d = (await axios.get(SERVER_URL + "api/check-login", { withCredentials: true })).data;
      if (!(d.loggedIn && (d.id == "X" || d.id == "Y"))) navigate("/logout");
      else setReady(true);
    } catch {
      navigate("/logout");
    }
  };
  useEffect(() => {
    initchecklogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // signed in / a new service or line count: load it (the tab dots after the first load)
  const statusesLoaded = useRef(false);
  useEffect(() => {
    if (!ready) return;
    load().then(() => {
      if (!statusesLoaded.current) {
        statusesLoaded.current = true;
        loadStatuses();
      }
    });
  }, [ready, unit, lines]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto refresh every 10 s while the tab is visible
  useEffect(() => {
    if (!auto || !ready) return;
    const t = window.setInterval(() => {
      if (!document.hidden) load(true);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [auto, unit, lines, newestFirst]); // eslint-disable-line react-hooks/exhaustive-deps

  // switching the order: jump to where the newest lines now are
  useEffect(() => {
    requestAnimationFrame(() => {
      const b = boxRef.current;
      if (b) b.scrollTop = newestFirst ? 0 : b.scrollHeight;
    });
  }, [newestFirst]);

  const parsed = useMemo(() => (data ? data.lines.map(parse) : []), [data]);
  const counts = useMemo(() => {
    const c = { error: 0, warn: 0 };
    parsed.forEach((p) => {
      if (p.level === "error") c.error++;
      else if (p.level === "warn") c.warn++;
    });
    return c;
  }, [parsed]);
  const q = search.trim();
  const shown = useMemo(() => {
    const ql = q.toLowerCase();
    const out = parsed.filter((p) => {
      if (show === "errors" && p.level !== "error") return false;
      if (show === "problems" && p.level !== "error" && p.level !== "warn") return false;
      return !ql || p.raw.toLowerCase().includes(ql);
    });
    return newestFirst ? out.slice().reverse() : out;
  }, [parsed, show, q, newestFirst]);

  const download = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const blob = new Blob([shown.map((p) => p.raw).join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data?.unit || unit}-logs-${stamp}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const st = data?.status ?? statuses[unit] ?? null;
  const [pillText, pillCls] = statusPill(st);
  const unitName = `riviratech-${unit}`;

  return (
    <>
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="content">
        <style>{`
          .si-page-wrapper { background-color: #f8fafc; min-height: calc(100vh - 80px); padding: 24px 28px; }
          @media (max-width: 576px) { .si-page-wrapper { padding: 16px; } }
          .si-header-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; flex-wrap: wrap; gap: 16px; }
          .si-header-left { display: flex; align-items: center; gap: 14px; }
          .si-header-icon-box { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25); flex-shrink: 0; }
          .si-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
          .si-header-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
          .si-filter-bar { background: #fff; border-radius: 14px; padding: 14px 18px; border: 1px solid #e2e8f0; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
          .si-select-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 4px 10px; }
          .si-select-label { font-size: 12.5px; font-weight: 600; color: #64748b; }
          .si-select { border: none; background: transparent; font-size: 13px; font-weight: 600; color: #0f172a; outline: none; cursor: pointer; }

          .sl-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
          .sl-tab { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; color: #334155; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; }
          .sl-tab:hover { border-color: #c7d2fe; }
          .sl-tab.on { background: var(--ad-brand); border-color: var(--ad-brand); color: #fff; box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb),.25); }
          .sl-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
          .sl-dot.green { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.18); }
          .sl-dot.red { background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.18); }
          .sl-dot.amber { background: #f59e0b; }
          .sl-tab.on .sl-dot { box-shadow: 0 0 0 3px rgba(255,255,255,.25); }

          .sl-statusbar { display: flex; align-items: center; gap: 10px 18px; flex-wrap: wrap; font-size: 12.5px; color: #64748b; margin-bottom: 12px; }
          .sl-statusbar b { color: #0f172a; font-weight: 700; }
          .sl-unit { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #334155; background: #eef2ff; padding: 2px 8px; border-radius: 6px; }
          .sl-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
          .sl-pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
          .sl-pill-green { background: #dcfce7; color: #15803d; }
          .sl-pill-red { background: #fee2e2; color: #b91c1c; }
          .sl-pill-amber { background: #fef3c7; color: #b45309; }
          .sl-pill-gray { background: #f1f5f9; color: #64748b; }
          .sl-count { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; }
          .sl-count-err { background: #fef2f2; color: #b91c1c; }
          .sl-count-warn { background: #fffbeb; color: #b45309; }
          .sl-count.on { box-shadow: 0 0 0 2px currentColor; }

          .sl-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; user-select: none; }
          .sl-toggle input { accent-color: var(--ad-brand); cursor: pointer; }
          .sl-btn { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; color: #334155; font-size: 13px; font-weight: 600; cursor: pointer; }
          .sl-btn:hover { border-color: #c7d2fe; color: var(--ad-brand); }
          .sl-btn:disabled { opacity: .5; cursor: default; }

          .sl-console { position: relative; background: #0b1020; border-radius: 16px; border: 1px solid #1e293b; box-shadow: 0 8px 24px rgba(15,23,42,.18); overflow: hidden; }
          .sl-console-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 14px; background: #111830; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 12px; }
          .sl-console-bar .lights { display: flex; gap: 6px; }
          .sl-console-bar .lights i { width: 10px; height: 10px; border-radius: 50%; background: #334155; display: block; }
          .sl-console-bar .lights i:nth-child(1) { background: #ef4444; } .sl-console-bar .lights i:nth-child(2) { background: #f59e0b; } .sl-console-bar .lights i:nth-child(3) { background: #22c55e; }
          .sl-box { height: max(420px, calc(100vh - 430px)); overflow: auto; padding: 10px 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12.5px; line-height: 1.6; color: #e2e8f0; }
          .sl-line { display: grid; grid-template-columns: 128px 1fr; gap: 12px; padding: 1px 16px; border-left: 3px solid transparent; }
          .sl-line:hover { background: rgba(148,163,184,.08); }
          .sl-line .t { color: #64748b; white-space: nowrap; }
          .sl-line .m { min-width: 0; }
          .sl-line .p { color: #818cf8; margin-right: 8px; }
          .sl-box.wrap .sl-line .m { white-space: pre-wrap; word-break: break-word; }
          .sl-box.nowrap .sl-line .m { white-space: pre; }
          .sl-line.error { background: rgba(239,68,68,.09); border-left-color: #ef4444; }
          .sl-line.error .m { color: #fecaca; }
          .sl-line.warn { background: rgba(245,158,11,.07); border-left-color: #f59e0b; }
          .sl-line.warn .m { color: #fde68a; }
          .sl-line.meta .m { color: #64748b; font-style: italic; }
          .sl-box mark { background: #facc15; color: #0b1020; padding: 0 1px; border-radius: 2px; }
          .sl-empty { color: #64748b; text-align: center; padding: 60px 20px; font-family: inherit; }
          @media (max-width: 640px) { .sl-line { grid-template-columns: 1fr; gap: 0; } }

          .sl-loading { position: absolute; inset: 41px 0 0 0; background: rgba(11,16,32,.55); display: flex; align-items: center; justify-content: center; z-index: 2; }
          .sl-loading .inline-loader { color: #e2e8f0; }
          .sl-loading .inline-loader .btn-spin { color: #c4b5fd; }

          .sl-help { background: #fff; border: 1px solid #fde68a; border-radius: 16px; padding: 22px 24px; color: #334155; }
          .sl-help h4 { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; color: #92400e; margin: 0 0 8px; }
          .sl-help p { font-size: 13.5px; margin: 0 0 10px; }
          .sl-help pre { background: #0b1020; color: #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 12.5px; margin: 0 0 10px; white-space: pre-wrap; }
          .sl-help small { color: #64748b; }
        `}</style>

        <div className="si-page-wrapper">
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box"><ScrollText size={24} /></div>
              <div>
                <h3 className="si-header-title">Server Logs</h3>
                <p className="si-header-subtitle">Live service logs from the server (journalctl) — website, API and assistant</p>
              </div>
            </div>
          </div>

          <div className="sl-tabs" role="tablist">
            {TABS.map((t) => {
              const s = statuses[t.key];
              const dot = !s || !s.loaded ? "" : s.active === "active" ? "green" : s.active === "failed" ? "red" : s.active === "activating" ? "amber" : "";
              return (
                <button key={t.key} type="button" role="tab" aria-selected={unit === t.key}
                  className={`sl-tab ${unit === t.key ? "on" : ""}`} onClick={() => setUnit(t.key)}>
                  {t.icon} {t.label} <span className={`sl-dot ${dot}`} />
                </button>
              );
            })}
          </div>

          <div className="si-filter-bar">
            <div className="si-select-wrap">
              <span className="si-select-label">Lines:</span>
              <select className="si-select" value={lines} onChange={(e) => setLines(Number(e.target.value))}>
                {LINE_CHOICES.map((n) => <option key={n} value={n}>Last {n}</option>)}
              </select>
            </div>
            <div className="si-select-wrap">
              <span className="si-select-label">Show:</span>
              <select className="si-select" value={show} onChange={(e) => setShow(e.target.value as any)}>
                <option value="all">All lines</option>
                <option value="problems">Errors & warnings</option>
                <option value="errors">Errors only</option>
              </select>
            </div>
            <ListSearch placeholder="Search the log…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="sl-toggle"><input type="checkbox" checked={newestFirst} onChange={(e) => setNewestFirst(e.target.checked)} /> Newest first</label>
            <label className="sl-toggle"><input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} /> Wrap lines</label>
            <label className="sl-toggle" title="Reload every 10 seconds while this tab is open">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto refresh
            </label>
            <div className="ms-auto d-flex align-items-center gap-2">
              <button type="button" className="sl-btn" onClick={download} disabled={!shown.length} title="Download the lines shown as a .txt file">
                <Download size={15} /> Download
              </button>
              <button data-refresh type="button" className="reload-btn" title="Refresh" disabled={loading}
                onClick={async () => { await load(); loadStatuses(); }}>
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          {failure ? (
            <div className="sl-help">
              <h4><AlertTriangle size={18} /> {failure.message || "Could not read the logs"}</h4>
              {failure.code === "noaccess" ? (
                <>
                  <p>
                    The API runs as <b>{failure.user}</b>, which may not read the system journal. On the server, add that
                    user to the <b>systemd-journal</b> group and restart the API once:
                  </p>
                  <pre>{`sudo usermod -aG systemd-journal ${failure.user}\nsudo systemctl restart riviratech-api`}</pre>
                  <small>
                    That only grants reading logs. (A password-free sudo rule for journalctl would also work, but it is
                    broader than needed.){failure.detail ? ` journalctl said: ${failure.detail}` : ""}
                  </small>
                </>
              ) : failure.code === "notfound" ? (
                <p>On the Linux server this page shows the output of <code>journalctl -u {unitName} -n {lines} --no-pager</code>.</p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="sl-statusbar">
                <span className="sl-unit">{unitName}</span>
                <span className={`sl-pill ${pillCls}`}>{pillText}</span>
                {st?.since && st.active === "active" && <span>since <b>{st.since}</b></span>}
                {!!st?.pid && <span>PID <b>{st.pid}</b></span>}
                {!!st?.memory && <span>Memory <b>{mb(st.memory)}</b></span>}
                {!!st?.restarts && <span>Restarts <b>{st.restarts}</b></span>}
                <span className="ms-auto d-flex align-items-center gap-2">
                  <button type="button" className={`sl-count sl-count-err ${show === "errors" ? "on" : ""}`}
                    onClick={() => setShow(show === "errors" ? "all" : "errors")} title="Show only errors">
                    {counts.error} errors
                  </button>
                  <button type="button" className={`sl-count sl-count-warn ${show === "problems" ? "on" : ""}`}
                    onClick={() => setShow(show === "problems" ? "all" : "problems")} title="Show errors and warnings">
                    {counts.warn} warnings
                  </button>
                </span>
              </div>

              <div className="sl-console">
                <div className="sl-console-bar">
                  <span className="lights"><i /><i /><i /></span>
                  <span className="d-flex align-items-center gap-2">
                    <TerminalSquare size={14} />
                    {data
                      ? `${shown.length === parsed.length ? `${parsed.length} lines` : `${shown.length} of ${parsed.length} lines`} · loaded ${new Date(data.fetchedAt).toLocaleTimeString()}${auto ? " · auto refresh on" : ""}`
                      : "Loading…"}
                  </span>
                </div>
                {loading && (
                  <div className="sl-loading">
                    <InlineLoader label="Loading logs…" />
                  </div>
                )}
                <div ref={boxRef} className={`sl-box ${wrap ? "wrap" : "nowrap"}`}>
                  {data && shown.length === 0 ? (
                    <div className="sl-empty">
                      {parsed.length === 0 ? "No log lines for this service yet." : "No lines match the filter."}
                    </div>
                  ) : (
                    shown.map((p, i) => (
                      <div key={i} className={`sl-line ${p.level}`}>
                        <span className="t">{p.time}</span>
                        <span className="m">
                          {p.proc && <span className="p">{p.proc}</span>}
                          <Highlight text={p.msg} q={q} />
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
