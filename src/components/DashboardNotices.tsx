import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { listFetch } from "../utils/listCache";
import { toast } from "react-toastify";
import { Info, AlertTriangle, Siren, MessageSquareReply, Check, Send, X, ChevronDown, BellRing } from "lucide-react";
import { SERVER_URL } from "./Includes";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import "../styles/dashboard-notices.css";
import { ButtonLoader } from "./loading";

/* Dashboard notices (api/admin/dashboard-notices): the Notices section of the
   student dashboard, and the card the admin form previews. A new notice pulses
   until the student opens it; a reply "In progress" blinks until it is done.
   Newest notices come first, and each one can be minimised to a one-line row
   (remembered in this browser). */

export type NoticeReply = {
  id: number;
  message: string;
  status: string; // 1 sent / new, 2 in progress, 3 completed
  progress_note?: string;
  progress_at?: number;
  done_note?: string;
  done_at?: number;
  datetime?: number;
};
export type Notice = {
  id: number;
  title: string;
  html: string;
  style: string;
  allow_reply: string;
  datetime?: number;
  updated?: number;
  read?: boolean;
  replies?: NoticeReply[];
};

export const NOTICE_STYLES: Record<string, { label: string; icon: any }> = {
  info: { label: "Info", icon: Info },
  important: { label: "Important", icon: AlertTriangle },
  urgent: { label: "Urgent", icon: Siren },
};
export const REPLY_STATUS: Record<string, string> = { "1": "Sent", "2": "In progress", "3": "Completed" };

const when = (epoch?: number) =>
  epoch
    ? new Date(epoch * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

const post = async (path: string, body: any = {}) => {
  const s = (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;
  return (await axios.post(SERVER_URL + path, { ...body, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true })).data;
};

export function NoticeCard({
  notice,
  preview = false,
  onRead,
  onReplied,
  collapsed = false,
  onToggle,
}: {
  notice: Notice;
  preview?: boolean;
  onRead?: (id: number) => void;
  onReplied?: (id: number, reply: NoticeReply) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const style = NOTICE_STYLES[notice.style] ? notice.style : "info";
  const Icon = NOTICE_STYLES[style].icon;
  const unread = !preview && !notice.read;
  const canReply = notice.allow_reply === "1";

  const markRead = () => {
    if (unread) onRead?.(notice.id);
  };
  // a minimised notice: one line with the start of the message and the latest reply status
  const summary = String(notice.html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const lastReply = notice.replies?.length ? notice.replies[notice.replies.length - 1] : null;

  const send = async () => {
    const message = text.trim();
    if (message.length < 2) return toast.error("Please write your reply");
    setSending(true);
    try {
      const r = await post("api/my-notices-reply", { id: notice.id, message });
      if (r.success) {
        toast.success(r.message || "Reply sent");
        onReplied?.(notice.id, r.data);
        setText("");
        setComposing(false);
      } else toast.error(r.message || "Could not send your reply");
    } catch {
      toast.error("Could not send your reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <article
      className={`dn-card dn-${style}${unread ? " dn-unread" : ""}${collapsed ? " dn-collapsed" : ""}`}
      onClick={() => { markRead(); if (collapsed) onToggle?.(); }}
      title={collapsed ? "Click to open" : unread ? "New notice — click to mark it as read" : undefined}
    >
      <div className="dn-head">
        <span className="dn-icon"><Icon size={collapsed ? 17 : 20} /></span>
        <div className="dn-titles">
          <h4 className="dn-title">{notice.title || "Notice title"}</h4>
          {collapsed ? (
            <div className="dn-summary">
              {summary}
            </div>
          ) : (
            !!notice.datetime && <div className="dn-meta">{when(notice.updated || notice.datetime)}</div>
          )}
        </div>
        {collapsed && lastReply && <span className={`dn-status s${lastReply.status}`}>{REPLY_STATUS[lastReply.status] || "Sent"}</span>}
        {unread ? <span className="dn-new">New</span> : <span className="dn-tag">{NOTICE_STYLES[style].label}</span>}
        {onToggle && (
          <button
            type="button"
            className="dn-collapse-btn"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Open this notice" : "Minimise this notice"}
            title={collapsed ? "Open" : "Minimise"}
            onClick={(e) => { e.stopPropagation(); if (collapsed) markRead(); onToggle(); }}
          >
            <ChevronDown size={18} />
          </button>
        )}
      </div>
      {!collapsed && (<>

      <div className="dn-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(notice.html || "") }} />

      <div className="dn-actions" onClick={(e) => e.stopPropagation()}>
        {unread && (
          <button type="button" className="dn-btn" onClick={markRead}>
            <Check size={14} /> Got it
          </button>
        )}
        {canReply && !composing && (
          <button
            type="button"
            className="dn-btn primary"
            disabled={preview}
            onClick={() => { setComposing(true); markRead(); }}
          >
            <MessageSquareReply size={14} /> Reply
          </button>
        )}
      </div>

      {composing && (
        <div className="dn-compose" onClick={(e) => e.stopPropagation()}>
          <textarea
            autoFocus
            maxLength={2000}
            placeholder="Write your reply…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
            <button type="button" className="dn-btn primary" disabled={sending || text.trim().length < 2} onClick={send}>
              <Send size={14} /> {sending ? <ButtonLoader label="Sending…" /> : "Send reply"}
            </button>
            <button type="button" className="dn-btn" disabled={sending} onClick={() => { setComposing(false); setText(""); }}>
              <X size={14} /> Cancel
            </button>
            <span className="dn-count ms-auto">{text.length}/2000</span>
          </div>
        </div>
      )}

      {!!notice.replies?.length && (
        <div className="dn-replies" onClick={(e) => e.stopPropagation()}>
          {notice.replies.map((r) => (
            <div key={r.id} className="dn-reply">
              <div className="dn-reply-top">
                <span className="dn-reply-label">Your reply · {when(r.datetime)}</span>
                <span className={`dn-status s${r.status}`}>{REPLY_STATUS[r.status] || "Sent"}</span>
              </div>
              <div className="dn-reply-msg">{r.message}</div>
              {r.status !== "1" && !!r.progress_note && (
                <div className="dn-note dn-note-progress"><b>In progress</b>{r.progress_note}</div>
              )}
              {r.status === "3" && !!r.done_note && (
                <div className="dn-note dn-note-done"><b>Completed</b>{r.done_note}</div>
              )}
            </div>
          ))}
        </div>
      )}
      </>)}
    </article>
  );
}

/* The Notices section of the student dashboard. `reloadKey` changes when the
   dashboard's refresh button is pressed. */
const COLLAPSE_KEY = "kkr.notices.collapsed";
const readCollapsed = (): number[] => {
  try { const v = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]"); return Array.isArray(v) ? v.map(Number) : []; }
  catch { return []; }
};

export default function StudentNotices({ reloadKey = 0 }: { reloadKey?: number }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set(readCollapsed()));
  const saveCollapsed = (next: Set<number>) => {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch { /* per-visit only */ }
  };
  const toggle = (id: number) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    saveCollapsed(next);
  };

  useEffect(() => {
    let alive = true;
    // saved for 10 minutes; the refresh button (reloadKey) loads it fresh
    listFetch("api/my-notices", {}, { fresh: reloadKey > 0 })
      .then((r) => { if (alive && r.data.success) setNotices(r.data.data || []); })
      .catch(() => { /* the dashboard still works without notices */ });
    return () => { alive = false; };
  }, [reloadKey]);

  const onRead = (id: number) => {
    setNotices((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    post("api/my-notices-read", { id }).catch(() => { /* it blinks again next visit */ });
  };
  const onReplied = (id: number, reply: NoticeReply) =>
    setNotices((list) => list.map((n) => (n.id === id ? { ...n, read: true, replies: [...(n.replies || []), reply] } : n)));

  // new (unread) first, then the newest
  const ordered = useMemo(
    () => [...notices].sort((a, b) =>
      Number(!!a.read) - Number(!!b.read) || Number(b.datetime || 0) - Number(a.datetime || 0) || b.id - a.id),
    [notices]
  );
  const newCount = notices.filter((n) => !n.read).length;
  const allCollapsed = ordered.every((n) => collapsed.has(n.id));

  if (!notices.length) return null;
  return (
    <section className="dn-list" aria-label="Notices">
      <div className="dn-section-head">
        <span className="dn-section-title"><BellRing size={16} /> Notices</span>
        {newCount > 0 && <span className="dn-section-new">{newCount} new</span>}
        {ordered.length > 1 && (
          <button
            type="button"
            className="dn-section-toggle"
            onClick={() => saveCollapsed(allCollapsed ? new Set() : new Set(ordered.map((n) => n.id)))}
          >
            <ChevronDown size={15} className={allCollapsed ? "" : "up"} /> {allCollapsed ? "Expand all" : "Minimise all"}
          </button>
        )}
      </div>
      {ordered.map((n) => (
        <NoticeCard key={n.id} notice={n} onRead={onRead} onReplied={onReplied}
          collapsed={collapsed.has(n.id)} onToggle={() => toggle(n.id)} />
      ))}
    </section>
  );
}
