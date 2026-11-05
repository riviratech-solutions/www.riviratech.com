import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CHATBOT_URL } from "./Includes";

/**
 * WebAIChatbot — the public-site floating chat widget.
 *
 * A faithful React port of the Python project's static/messenger.html, wired to
 * the FastAPI chatbot server (CHATBOT_URL → /chat, /feedback, /health, /config,
 * /history). It replaces the old keyword-matching bot that hit the Node backend.
 *
 * Two deliberate differences from the standalone HTML:
 *  - All styles are scoped under `.rtchat-root`, and the light/dark theme is set
 *    on THIS widget's own container — the original wrote CSS variables to :root
 *    and `data-theme` to <html>, which would repaint the whole website.
 *  - The launcher's open/close icon is a React conditional rather than a CSS
 *    `body.chat-open` toggle.
 *
 * The server identifies a visitor by the `session_id` sent in each request body /
 * query (the cookie is only client-side persistence), so the widget works
 * cross-origin without credentials — the chatbot server just has to allow this
 * site's origin in its CORS list.
 */

/* ---------------- server payload shapes ---------------- */
type BotData = {
  answer?: string;
  answered?: boolean;
  source?: string;
  entry_id?: number | null;
  confidence?: number;
  similarity?: number;
  category?: string;
  created_at?: string;
  log_id?: number;
  feedback_rating?: number;
  suggestions?: string[];
  question?: string; // history rows carry the original question
  // Conversational-form driver (matches messenger.html). `intro` is a lead-in
  // bubble sent before the first question; `offer` is a "would you like to…"
  // bubble sent after a KB answer; `buttons` are quick-reply chips.
  flow?: { intro?: string; offer?: string; buttons?: string[] };
};

type VoteState = "idle" | "sending" | "done" | "error";

type Msg =
  | { id: number; kind: "user"; text: string; time: string }
  | { id: number; kind: "bot"; data: BotData; rating: number; vote: VoteState }
  | { id: number; kind: "welcome"; text: string }
  // A form intro / offer bubble: plain bot text with optional quick-reply chips.
  | { id: number; kind: "flow"; text: string; buttons?: string[] }
  // A centred pill marking a lifecycle event ("New chat", "All chats cleared").
  | { id: number; kind: "notice"; text: string }
  | { id: number; kind: "system"; text: string; retry?: string };

type ChatConfig = {
  show_confidence: boolean;
  // show the badge only when it warns (best guess / no match), not on every good answer
  hide_confident_badge: boolean;
  // false: the server leaves its notice line off AI-composed answers, so the
  // widget marks them with an "AI Base" pill instead
  ai_notice: boolean;
  show_category: boolean;
  show_feedback: boolean;
  history: boolean;
  ai_fallback: boolean;
};

type Status = "connecting" | "online" | "offline" | "degraded";

/* Visitor preferences from the two header menus (Customize chat / End chat).
   Same storage key and shape as messenger.html, so the standalone page and this
   widget read each other's settings. */
type ChatStyle = "default" | "compact" | "spacious";
type FontSize = "small" | "medium" | "large";
type Prefs = {
  style: ChatStyle;
  font: FontSize;
  sound: boolean;
  anim: boolean;
  autoClear: number; // minutes of inactivity before the chat resets; 0 = never
};

// which header menu is open, and which page of it is showing
type MenuId = "prefs" | "end";
type MenuPage = "root" | "style" | "font" | "export" | "auto";

/* ---------------- constants ---------------- */
const BASE = CHATBOT_URL.replace(/\/+$/, "");
const API = {
  chat: BASE + "/chat",
  feedback: BASE + "/feedback",
  health: BASE + "/health",
  config: BASE + "/config",
  history: BASE + "/history",
};

/* CSRF token for the chatbot server (assistant/app/csrf.py): every POST needs the
   X-CSRF-Token header. Fetched once from /csrf-token and reused; a refused token
   (expired, server restarted) is replaced and the request sent once more. */
let csrfToken: Promise<string> | null = null;
const getCsrf = (fresh = false): Promise<string> => {
  if (fresh || !csrfToken) {
    const p = fetch(BASE + "/csrf-token", { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("csrf-token " + r.status);
        return r.json();
      })
      .then((d) => String(d?.csrfToken || ""));
    p.catch(() => {
      if (csrfToken === p) csrfToken = null;
    });
    csrfToken = p;
  }
  return csrfToken;
};
const postJson = async (url: string, body: unknown, signal?: AbortSignal): Promise<Response> => {
  const send = async (fresh: boolean) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": await getCsrf(fresh) },
      body: JSON.stringify(body),
      signal,
    });
  const res = await send(false);
  if (res.status !== 403) return res;
  const d = await res.clone().json().catch(() => null);
  return d && d.code === "EBADCSRFTOKEN" ? send(true) : res;
};

const SESSION_KEY = "riviratech-chatbot.session_id"; // shared with the full-page chat
const COOKIE_KEY = "riviratech_uid"; // so history follows the visitor
const THEME_KEY = "riviratech.chat.theme";
const PREFS_KEY = "riviratech.chat.prefs"; // same key/shape as messenger.html
const LAST_KEY = "riviratech.chat.last_activity";

const DISPLAY_HIGH = 0.75;
const DISPLAY_MID = 0.55;
const SEP_GAP_MS = 60 * 60 * 1000;
const CHAT_TIMEOUT_MS = 25000;
// Hold the "typing…" indicator at least this long before a reply lands, so a fast
// server response doesn't snap in instantly (reads as more natural).
const MIN_REPLY_MS = 2100;

const DEFAULT_CONFIG: ChatConfig = {
  show_confidence: true,
  hide_confident_badge: false,
  ai_notice: true,
  show_category: true,
  show_feedback: true,
  history: false, // an unreachable /config must never try to load a transcript
  ai_fallback: false,
};

/* ---------------- pure helpers ---------------- */
// "13:43" for a message stamp; "" for a missing/unparseable value so a bad
// timestamp renders nothing rather than "Invalid Date".
function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.*+?^${}()|[\]\\])/g, "\\$1") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name: string, val: string, days: number) {
  document.cookie =
    name + "=" + encodeURIComponent(val) + "; max-age=" + Math.round(days * 86400) + "; path=/; SameSite=Lax";
}
function newId(): string {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  if (window.crypto && window.crypto.getRandomValues) {
    const b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    let out = "";
    for (let i = 0; i < b.length; i++) out += (b[i] + 0x100).toString(16).slice(1);
    return out;
  }
  const t = typeof performance !== "undefined" && performance.now ? performance.now() : 0;
  let r = "";
  for (let k = 0; k < 4; k++) r += Math.random().toString(36).slice(2, 10);
  return "s-" + Date.now().toString(36) + "-" + Math.floor(t * 1000).toString(36) + "-" + r;
}
// Same cookie/key as the full-page chat, so a visitor's history carries across both.
function loadSessionId(): string {
  let id = getCookie(COOKIE_KEY);
  if (!id) {
    try {
      id = window.localStorage.getItem(SESSION_KEY);
    } catch {
      id = null;
    }
    if (!id) id = newId();
  }
  setCookie(COOKIE_KEY, id, 365);
  try {
    window.localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/* ---------------- preferences (Customize chat / End chat menus) ---------------- */
const DEFAULT_PREFS: Prefs = { style: "default", font: "medium", sound: true, anim: true, autoClear: 0 };
const FONT_PX: Record<FontSize, string> = { small: "13.5px", medium: "15px", large: "17px" };
const STYLE_LABEL: Record<ChatStyle, string> = { default: "Default", compact: "Compact", spacious: "Spacious" };
const FONT_LABEL: Record<FontSize, string> = { small: "Small", medium: "Medium", large: "Large" };
const AUTO_CHOICES: { value: number; label: string; sub?: string }[] = [
  { value: 0, label: "Off", sub: "Keep the chat until I end it" },
  { value: 15, label: "After 15 minutes" },
  { value: 60, label: "After 1 hour" },
  { value: 1440, label: "After 24 hours" },
];
const AUTO_LABEL: Record<string, string> = { "0": "Off", "15": "15 min", "60": "1 hour", "1440": "24 hours" };

function store(k: string, v: string) {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* private mode / blocked storage — prefs just won't persist */
  }
}
function recall(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function loadPrefs(): Prefs {
  const out = { ...DEFAULT_PREFS };
  let p: any = null;
  try {
    const raw = recall(PREFS_KEY);
    p = raw ? JSON.parse(raw) : null;
  } catch {
    p = null;
  }
  if (p && typeof p === "object") {
    if (STYLE_LABEL[p.style as ChatStyle]) out.style = p.style;
    if (FONT_PX[p.font as FontSize]) out.font = p.font;
    if (typeof p.sound === "boolean") out.sound = p.sound;
    if (typeof p.anim === "boolean") out.anim = p.anim;
    if (AUTO_LABEL[String(p.autoClear)]) out.autoClear = Number(p.autoClear);
  }
  return out;
}
function savePrefs(p: Prefs) {
  store(PREFS_KEY, JSON.stringify(p));
}

// Short two-note chime for an arriving reply. WebAudio, so there is no asset to
// ship; wrapped because a browser may block it until the first interaction.
let actx: AudioContext | null = null;
function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    actx = actx || new Ctx();
    if (actx.state === "suspended") actx.resume();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(620, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + 0.3);
  } catch {
    /* audio is optional */
  }
}

function loadStoredTheme(): "light" | "dark" {
  try {
    return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, Math.max(0, ms)));

// Form intro/offer/field replies already pace themselves inside addBotMessage;
// don't stack the MIN_REPLY_MS floor on top of their own typing stagger.
function selfPaced(d: BotData): boolean {
  return !!(d && ((d.flow && (d.flow.intro || d.flow.offer)) || d.source === "form"));
}

function detailOf(body: any, status: number): string {
  if (body && typeof body === "object") {
    const d = body.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((e: any) => (e && e.msg ? e.msg : JSON.stringify(e))).join("; ");
  }
  return "HTTP " + status;
}

// Confidence badge class + label, mirroring the standalone widget's thresholds.
function badgeInfo(d: BotData): { cls: string; text: string; title?: string } {
  const c = typeof d.confidence === "number" ? d.confidence : 0;
  const pct = Math.round(Math.max(0, Math.min(1, c)) * 100);
  let cls = "badge badge-low";
  let text = pct + "% confident";
  // Answered from the model's general knowledge, with no KB entry behind it: its
  // own badge rather than a confidence score, which would imply a match.
  if (d.source === "general") {
    cls = "badge badge-mid";
    text = "General info — not Rivira Technologies-specific";
  } else if (d.source === "fallback" || d.entry_id === null || d.entry_id === undefined) {
    cls = "badge badge-low";
    text = "No confirmed match";
  } else if (c >= DISPLAY_HIGH) {
    cls = "badge badge-high";
    text = pct + "% confident";
  } else if (c >= DISPLAY_MID) {
    cls = "badge badge-mid";
    text = pct + "% — best guess";
  }
  const det: string[] = [];
  if (typeof d.similarity === "number") det.push("similarity " + d.similarity.toFixed(3));
  if (typeof d.confidence === "number") det.push("confidence " + d.confidence.toFixed(3));
  if (d.source) det.push("source " + d.source);
  return { cls, text, title: det.length ? det.join(" · ") : undefined };
}

// Bare URLs, email addresses and international ("+") phone numbers in a message
// become real links. Built as React elements, never HTML: answers are
// author-written and user messages are echoed back, so neither may inject markup.
// Phones match only in "+" form (how every number in the knowledge base is
// written), which keeps "9:00 AM-6:00 PM" or "16-Week Program" from being dialled.
const LINK_RE = /(https?:\/\/[^\s<>()"']+|www\.[^\s<>()"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\+\d{1,3}(?:[\s-]?\(?\d{2,5}\)?){2,4})/g;
function linkify(text: unknown): React.ReactNode[] {
  const s = String(text === null || text === undefined ? "" : text);
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(s)) !== null) {
    // trailing punctuation belongs to the sentence: "visit www.example.com." keeps its full stop
    const link = m[0].replace(/[.,;:!?)\]}>'"]+$/, "");
    if (!link) continue;
    if (m.index > last) out.push(s.slice(last, m.index));
    const isTel = link.charAt(0) === "+";
    const isMail = !isTel && link.indexOf("@") !== -1 && link.indexOf("/") === -1;
    const href = isTel
      ? "tel:" + link.replace(/[^\d+]/g, "")
      : isMail
        ? "mailto:" + link
        : /^https?:/i.test(link)
          ? link
          : "https://" + link;
    // only a web link opens elsewhere; tel: and mailto: hand off to the device
    out.push(
      isTel || isMail ? (
        <a key={k++} href={href}>{link}</a>
      ) : (
        <a key={k++} href={href} target="_blank" rel="noopener noreferrer">{link}</a>
      )
    );
    last = m.index + link.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/* ---------------- icons ---------------- */
const Ico = {
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-2.9-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  theme: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  ),
  thumb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10H7z" />
      <path d="M7 10l4.2-6.6a2 2 0 0 1 3.6 1.5L14 9h4.6a2 2 0 0 1 2 2.5l-1.6 6.6a2 2 0 0 1-2 1.4H7" />
    </svg>
  ),
  /* ---- header menus ---- */
  sliders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h2M10 12h10" />
      <circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /><circle cx="8" cy="12" r="2" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.4 4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.7 1.2Z" />
    </svg>
  ),
  palette: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" />
      <circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" />
      <path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.7-.4-.5-.7-1-.7-1.7a2.5 2.5 0 0 1 2.5-2.5H18a4 4 0 0 0 4-4c0-4.4-4.5-7.6-10-7.6Z" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 18 9 6l5 12M5.6 14.5h6.8M15 18l3.5-8 3.5 8M16 15.7h5" />
    </svg>
  ),
  sound: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5ZM15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </svg>
  ),
  endChat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-2.9-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
      <path d="m10 9 4 4M14 9l-4 4" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
    </svg>
  ),
  chevron: (
    <svg className="mi-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  ),
};

export default function WebAIChatbot() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => loadStoredTheme());
  const [config, setConfig] = useState<ChatConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<Status>("connecting");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(false);
  // screen-reader announcements (the polite live region at the bottom)
  const [liveMsg, setLiveMsg] = useState("");
  const announce = (t: string) => setLiveMsg(t);
  // quick-reply / "did you mean" chips already clicked: only that chip stays off
  // (disabling its siblings left them dead after a failed request)
  const [usedChips, setUsedChips] = useState<Set<string>>(() => new Set());
  // the textarea stays read-only until tapped / focused: keeps mobile autofill
  // bars and password managers off it
  const [inputArmed, setInputArmed] = useState(false);

  // "End current chat" swaps in a fresh id, so this has to be re-assignable.
  const [sessionId, setSessionId] = useState<string>(() => loadSessionId());
  const sessionRef = useRef(sessionId);
  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  /* ---- header menus (Customize chat / End chat) ---- */
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [menu, setMenu] = useState<MenuId | null>(null);
  const [page, setPage] = useState<MenuPage>("root");
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Write a change through to localStorage as well as state.
  const updatePrefs = (patch: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      savePrefs(next);
      return next;
    });

  const openMenu = (id: MenuId) => {
    setMenu((cur) => (cur === id ? null : id));
    setPage("root"); // a menu always reopens on its first page
  };
  const closeMenus = () => {
    setMenu(null);
    setPage("root");
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  // sizes the panel to the visible viewport (set by the viewport effect)
  const fitRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  const bootedRef = useRef(false);
  const openRef = useRef(false);
  // A conversational-form reply is staggering in (intro→question, or answer→offer):
  // keep the composer disabled until the follow-up bubble lands.
  const staggerRef = useRef(false);
  const stickRef = useRef(true); // is the reader pinned to the bottom?
  const prependRef = useRef<{ prevH: number; prevTop: number } | null>(null);

  // history paging
  const histRef = useRef({ oldestId: null as number | null, hasMore: false, loading: false, loaded: false });
  // typing dots while a history page loads: "initial" in the empty chat, "older" at the top
  const [histLoading, setHistLoading] = useState<"" | "initial" | "older">("");

  // ids of bot messages whose feedback is in flight or already recorded — a
  // synchronous guard against double-votes (see vote()).
  const votingRef = useRef<Set<number>>(new Set());

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /* ---------------- scrolling ---------------- */
  // After every render that changed the transcript, either hold position (older
  // history was just prepended) or stick to the bottom.
  useLayoutEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    if (prependRef.current) {
      const { prevH, prevTop } = prependRef.current;
      el.scrollTop = prevTop + (el.scrollHeight - prevH);
      prependRef.current = null;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
    // also after a font size / chat style change (as messenger.html's applyPrefs):
    // bigger text grows the rows, and a pinned reader stays on the newest message
  }, [messages, typing, prefs.font, prefs.style]);

  const scrollEndSoon = () => {
    stickRef.current = true;
    const el = transcriptRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    });
  };

  /* ---------------- message adders ---------------- */
  const addUser = (text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), kind: "user", text, time: new Date().toISOString() }]);
    scrollEndSoon();
  };
  const addBot = (data: BotData) => {
    if (!data.created_at) data.created_at = new Date().toISOString();
    const rating = data.feedback_rating === 1 || data.feedback_rating === -1 ? data.feedback_rating : 0;
    setMessages((prev) => [...prev, { id: nextId(), kind: "bot", data, rating, vote: rating ? "done" : "idle" }]);
    scrollEndSoon();
    if (!openRef.current) setUnread(true); // reply landed while closed
  };
  const addSystem = (text: string, retry?: string) => {
    setMessages((prev) => [...prev, { id: nextId(), kind: "system", text, retry }]);
    scrollEndSoon();
  };
  const addWelcome = (c: ChatConfig) => {
    const text =
      "Hi! I'm the Rivira Technologies assistant. Ask me about our Generative AI training programs, courses, " +
      "workshops, corporate training, or POC development. " +
      (c.ai_fallback
        ? "I answer from our official knowledge base, and I'll clearly flag anything I'm not certain about."
        : "I answer only from our official knowledge base, and I'll say so when I don't have a confirmed answer.");
    setMessages((prev) => [...prev, { id: nextId(), kind: "welcome", text }]);
    scrollEndSoon();
  };
  // A form intro / offer bubble (plain bot text + optional quick-reply chips).
  const addFlow = (text: string, buttons?: string[]) => {
    setMessages((prev) => [...prev, { id: nextId(), kind: "flow", text, buttons }]);
    scrollEndSoon();
    if (!openRef.current) setUnread(true);
  };

  // Route a /chat reply to the transcript, replicating messenger.html's
  // conversational-form staggering:
  //  - flow.intro  → lead-in bubble, then (after a typing pause) the question
  //  - flow.offer  → KB answer, then (after a pause) the "would you like to…" + Yes/No
  //  - source form → a short typing pause before the field prompt / validation
  //  - otherwise   → the answer lands immediately
  // While a stagger is pending the composer stays disabled (staggerRef); the
  // timer re-enables it once the follow-up bubble is in.
  const addBotMessage = (d: BotData) => {
    touchActivity(); // a reply counts as activity for "Auto Clear"
    if (prefsRef.current.sound) beep(); // "Sound" in the Customize menu — once per reply
    if (d.flow && d.flow.intro) {
      addFlow(d.flow.intro);
      setTyping(true);
      staggerRef.current = true;
      window.setTimeout(() => {
        setTyping(false);
        addBot(d);
        staggerRef.current = false;
        setBusy(false);
        if (openRef.current) inputRef.current?.focus();
      }, 750);
      return;
    }
    if (d.flow && d.flow.offer) {
      addBot(d);
      setTyping(true);
      staggerRef.current = true;
      const offer = d.flow.offer;
      const btns = d.flow.buttons && d.flow.buttons.length ? d.flow.buttons : ["Yes", "No"];
      window.setTimeout(() => {
        setTyping(false);
        addFlow(offer, btns);
        staggerRef.current = false;
        setBusy(false);
        if (openRef.current) inputRef.current?.focus();
      }, 750);
      return;
    }
    if (d.source === "form") {
      setTyping(true);
      staggerRef.current = true;
      window.setTimeout(() => {
        setTyping(false);
        addBot(d);
        staggerRef.current = false;
        setBusy(false);
        if (openRef.current) inputRef.current?.focus();
      }, 1100);
      return;
    }
    addBot(d);
  };

  /* ---------------- network ---------------- */
  const checkHealth = async () => {
    try {
      const r = await fetch(API.health, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("health");
      const d = await r.json();
      setStatus(d && d.db === false ? "degraded" : "online");
    } catch {
      setStatus("offline");
    }
  };

  const loadConfig = async (): Promise<ChatConfig> => {
    const next = { ...DEFAULT_CONFIG };
    try {
      const r = await fetch(API.config, { headers: { Accept: "application/json" } });
      const c = r.ok ? await r.json() : null;
      if (c && typeof c === "object") {
        if (typeof c.chat_show_confidence === "boolean") next.show_confidence = c.chat_show_confidence;
        if (typeof c.chat_hide_confident_badge === "boolean") next.hide_confident_badge = c.chat_hide_confident_badge;
        if (typeof c.ai_notice === "boolean") next.ai_notice = c.ai_notice;
        if (typeof c.chat_show_category === "boolean") next.show_category = c.chat_show_category;
        if (typeof c.chat_show_feedback === "boolean") next.show_feedback = c.chat_show_feedback;
        if (typeof c.chat_history === "boolean") next.history = c.chat_history;
        if (typeof c.ai_fallback === "boolean") next.ai_fallback = c.ai_fallback;
      }
    } catch {
      /* keep defaults */
    }
    setConfig(next);
    return next;
  };

  const loadInitialHistory = async () => {
    setHistLoading("initial");
    try {
      const r = await fetch(API.history + "?session_id=" + encodeURIComponent(sessionRef.current) + "&limit=20", {
        headers: { Accept: "application/json" },
      });
      const d = r.ok ? await r.json() : null;
      histRef.current.loaded = true;
      const items: BotData[] = d && Array.isArray(d.items) ? d.items : [];
      if (!items.length) {
        addWelcome(configRef.current);
        return;
      }
      items.reverse(); // API is newest-first
      const rows: Msg[] = [];
      items.forEach((it) => {
        rows.push({ id: nextId(), kind: "user", text: String(it.question || ""), time: it.created_at || "" });
        const rating = it.feedback_rating === 1 || it.feedback_rating === -1 ? it.feedback_rating : 0;
        rows.push({ id: nextId(), kind: "bot", data: it, rating, vote: rating ? "done" : "idle" });
      });
      histRef.current.oldestId = (items[0] as any).log_id ?? null;
      histRef.current.hasMore = !!(d && d.has_more);
      setMessages((prev) => [...prev, ...rows]);
      scrollEndSoon();
    } catch {
      if (!histRef.current.loaded) {
        histRef.current.loaded = true;
        addWelcome(configRef.current);
      }
    } finally {
      setHistLoading("");
    }
  };

  const loadOlderHistory = async () => {
    const h = histRef.current;
    if (h.loading || !h.hasMore || h.oldestId == null) return;
    h.loading = true;
    setHistLoading("older");
    const el = transcriptRef.current;
    try {
      const r = await fetch(
        API.history +
          "?session_id=" +
          encodeURIComponent(sessionRef.current) +
          "&before_id=" +
          encodeURIComponent(String(h.oldestId)) +
          "&limit=20",
        { headers: { Accept: "application/json" } }
      );
      const d = r.ok ? await r.json() : null;
      const items: BotData[] = d && Array.isArray(d.items) ? d.items : [];
      if (items.length) {
        items.reverse();
        const rows: Msg[] = [];
        items.forEach((it) => {
          rows.push({ id: nextId(), kind: "user", text: String(it.question || ""), time: it.created_at || "" });
          const rating = it.feedback_rating === 1 || it.feedback_rating === -1 ? it.feedback_rating : 0;
          rows.push({ id: nextId(), kind: "bot", data: it, rating, vote: rating ? "done" : "idle" });
        });
        h.oldestId = (items[0] as any).log_id ?? h.oldestId;
        // Capture geometry so the layout effect can hold the reader's position
        // when these rows are prepended above what they're looking at.
        if (el) prependRef.current = { prevH: el.scrollHeight, prevTop: el.scrollTop };
        stickRef.current = false;
        setMessages((prev) => [...rows, ...prev]);
      }
      h.hasMore = !!(d && d.has_more);
    } catch {
      /* ignore */
    } finally {
      h.loading = false;
      setHistLoading("");
    }
  };

  /* ---------------- ask ---------------- */
  const ask = (question: string, echo = true) => {
    const text = String(question || "").trim();
    if (!text || busy) return;
    touchActivity(); // feeds the "Auto Clear after inactivity" setting
    if (echo) addUser(text);
    setBusy(true);
    setTyping(true);
    scrollEndSoon();
    announce("Assistant is looking that up.");
    const startedAt = Date.now(); // for the MIN_REPLY_MS floor below

    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timedOut = false;
    const deadline = window.setTimeout(() => {
      timedOut = true;
      if (ctl) ctl.abort();
    }, CHAT_TIMEOUT_MS);

    postJson(API.chat, { question: text, session_id: sessionRef.current }, ctl ? ctl.signal : undefined)
      .then(async (res) => {
        const raw = await res.text();
        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }
        if (!res.ok) throw new Error(detailOf(data, res.status));
        if (!data || typeof data !== "object") throw new Error("The server returned an unreadable response.");
        return data as BotData;
      })
      .then((data) => {
        setStatus("online");
        // Hold the typing indicator to the MIN_REPLY_MS floor before the reply
        // lands. Returning the promise makes the composer re-enable (finally) wait.
        const wait = selfPaced(data) ? 0 : MIN_REPLY_MS - (Date.now() - startedAt);
        return delay(wait).then(() => {
          setTyping(false);
          addBotMessage(data);
          announce("Assistant replied.");
        });
      })
      .catch((err: any) => {
        setTyping(false);
        setStatus("offline");
        const offline = err instanceof TypeError || !navigator.onLine;
        addSystem(
          timedOut
            ? "That is taking longer than expected. Please try again, or rephrase your question."
            : offline
              ? "I could not reach the assistant service. Please check your connection and try again."
              : "Something went wrong while answering that (" + ((err && err.message) || "unknown error") + ").",
          text
        );
        announce("The assistant could not be reached.");
        checkHealth();
      })
      .finally(() => {
        window.clearTimeout(deadline);
        // A form intro/offer is staggering in — keep the composer disabled until
        // the follow-up bubble lands (its timer re-enables it).
        if (!staggerRef.current) setBusy(false);
        if (openRef.current && !staggerRef.current) inputRef.current?.focus();
      });
  };

  /* ---------------- feedback voting ---------------- */
  const vote = (msgId: number, logId: number, rating: number) => {
    // Guard synchronously via a ref. The previous version set a flag INSIDE a
    // setMessages() updater and read it on the next line — but React runs that
    // updater later, not synchronously, so the flag was always still false, the
    // function returned before fetch(), and the row stuck on "Sending…" forever
    // (the queued "sending" state still applied). The ref is set and checked in
    // the same tick, so the request actually fires.
    if (votingRef.current.has(msgId)) return; // in flight or already recorded
    votingRef.current.add(msgId);

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId && m.kind === "bot" ? { ...m, rating, vote: "sending" } : m))
    );

    postJson(API.feedback, { log_id: logId, rating, comment: null })
      .then((r) => {
        if (!r.ok) throw new Error("feedback " + r.status);
        setMessages((prev) => prev.map((m) => (m.id === msgId && m.kind === "bot" ? { ...m, vote: "done" } : m)));
        announce("Feedback recorded.");
      })
      .catch(() => {
        votingRef.current.delete(msgId); // let them retry after a failure
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId && m.kind === "bot" ? { ...m, rating: 0, vote: "error" } : m))
        );
      });
  };

  // A chip sends its text as the next question; only that chip is then disabled.
  const chipClick = (key: string, text: string) => {
    if (busy) return;
    setUsedChips((prev) => new Set(prev).add(key));
    ask(text);
  };

  /* ---------------- chat lifecycle: new chat / clear all / export ---------------- */
  const touchActivity = () => store(LAST_KEY, String(Date.now()));

  // Swap in a fresh session id. /history and the server-side form + memory state
  // are both keyed by it, so a new id IS a new chat — nothing else to reset.
  const rotateSession = () => {
    const id = newId();
    setCookie(COOKIE_KEY, id, 365);
    store(SESSION_KEY, id);
    sessionRef.current = id;
    setSessionId(id);
    touchActivity();
  };

  const startNewChat = (notice?: string) => {
    rotateSession();
    setTyping(false);
    staggerRef.current = false;
    setBusy(false);
    votingRef.current.clear();
    histRef.current = { oldestId: null, hasMore: false, loading: false, loaded: true };

    const c = configRef.current;
    const intro =
      "Hi! I'm the Rivira Technologies assistant. Ask me about our Generative AI training programs, courses, " +
      "workshops, corporate training, or POC development. " +
      (c.ai_fallback
        ? "I answer from our official knowledge base, and I'll clearly flag anything I'm not certain about."
        : "I answer only from our official knowledge base, and I'll say so when I don't have a confirmed answer.");

    const fresh: Msg[] = [];
    if (notice) fresh.push({ id: nextId(), kind: "notice", text: notice });
    fresh.push({ id: nextId(), kind: "welcome", text: intro });
    setMessages(fresh);
    setUsedChips(new Set());
    scrollEndSoon();
    announce(notice || "Started a new chat.");
    if (openRef.current) window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const clearAllChats = () => {
    if (!window.confirm("Remove all conversation history from this browser and start a new chat?")) return;
    // Forget every id this browser has used, so no past transcript can be
    // re-fetched here, then start clean.
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setCookie(COOKIE_KEY, "", -1);
    startNewChat("All chats cleared");
  };

  // Flatten the transcript to plain text / Markdown and hand it over as a download.
  const exportChat = (fmt: "txt" | "md") => {
    const lines: string[] = [];
    for (const m of messages) {
      if (m.kind === "notice") {
        lines.push(fmt === "md" ? "**— " + m.text + " —**" : "--- " + m.text + " ---");
        continue;
      }
      let who = "Assistant";
      let text = "";
      let stamp = "";
      if (m.kind === "user") {
        who = "You";
        text = m.text;
        stamp = fmtTime(m.time);
      } else if (m.kind === "system") {
        who = "System";
        text = m.text;
      } else if (m.kind === "welcome" || m.kind === "flow") {
        text = m.text;
      } else {
        text = String(m.data.answer || "");
        stamp = fmtTime(m.data.created_at);
      }
      if (!text.trim()) continue;
      lines.push(
        fmt === "md"
          ? "**" + who + "**" + (stamp ? " · " + stamp : "") + "  \n" + text
          : who + (stamp ? " (" + stamp + ")" : "") + ": " + text
      );
    }
    if (!lines.length) {
      announce("Nothing to export yet.");
      return;
    }

    const now = new Date();
    const head =
      fmt === "md"
        ? "# Rivira Technologies — chat transcript\n\n_" + now.toLocaleString() + "_\n\n"
        : "Rivira Technologies — chat transcript\n" + now.toLocaleString() + "\n\n";
    const blob = new Blob([head + lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "riviratech-chat-" + now.toISOString().slice(0, 10) + "." + fmt;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("Transcript downloaded.");
  };

  // Has the chat sat idle past the visitor's "Auto Clear" window?
  const autoClearDue = () => {
    const mins = prefsRef.current.autoClear;
    if (!mins) return false;
    const last = Number(recall(LAST_KEY) || 0);
    if (!last) return false;
    return Date.now() - last >= mins * 60000;
  };

  /* ---------------- boot (lazy: first open only) ---------------- */
  const boot = async () => {
    // Rotate the id BEFORE the first /history call, so an expired chat never
    // flashes its old transcript on the way to being cleared.
    if (autoClearDue()) rotateSession();
    touchActivity();
    await checkHealth();
    const c = await loadConfig();
    if (c.history) loadInitialHistory();
    else addWelcome(c);
  };

  const openChat = () => {
    setOpen(true);
    setUnread(false);
    stickRef.current = true;
    if (!bootedRef.current) {
      bootedRef.current = true;
      boot();
    } else if (autoClearDue()) {
      // Idle past the visitor's "Auto Clear" window — start fresh instead of
      // dropping them back into a stale conversation.
      startNewChat("New chat — previous one cleared after inactivity");
    }
    touchActivity();
    fitRef.current?.(); // phones: fit the panel above the keyboard right away

  // Focus only on desktop
  if (window.innerWidth > 768) {
    
  }
  setTimeout(() => inputRef.current?.focus(), 700);
    
  };
  const closeChat = () => {
    closeMenus();
    setOpen(false);
    launcherRef.current?.focus();
  };

  /* ---------------- composer ---------------- */
  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    if (!el.value) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 110) + "px";
  };
  const submit = () => {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "";
    ask(t);
  };

  // Picked from the Dark / Light pair in the Customize menu.
  const setThemeTo = (next: "light" | "dark") => {
    setTheme(next);
    store(THEME_KEY, next);
  };

  /* ---------------- effects: body class, escape, viewport, connectivity ---------------- */
  // Mobile: lock page scroll + hide launcher while the full-screen panel is open.
  useEffect(() => {
    document.body.classList.toggle("rtchat-open", open);
    return () => document.body.classList.remove("rtchat-open");
  }, [open]);

  // Escape backs out of an open header menu first, then closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menu) {
        closeMenus();
        return;
      }
      if (openRef.current) closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  // A click anywhere outside an open menu dismisses it.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && typeof t.closest === "function" && t.closest(".hmenu")) return; // the menu's own handlers
      closeMenus();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  useEffect(() => {
    const onOnline = () => {
      if (bootedRef.current) checkHealth();
    };
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Phones: track the visual viewport so the composer stays above the on-screen
  // keyboard, and keep the newest message visible while it opens.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      const root = rootRef.current;
      const h = Math.round(vv.height);
      const winH = Math.round(window.innerHeight || h);
      if (root) {
        if (winH - h > 120) root.style.setProperty("--panel-h", h + "px");
        else root.style.removeProperty("--panel-h");
      }
      if (openRef.current && stickRef.current) {
        const el = transcriptRef.current;
        if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
      }
    };
    fitRef.current = fit;
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    fit();
    return () => {
      fitRef.current = null;
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);

  const onTranscriptScroll = () => {
    const el = transcriptRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (configRef.current.history && histRef.current.loaded && el.scrollTop < 60) loadOlderHistory();
  };

  const statusText =
    status === "online"
      ? "Online"
      : status === "degraded"
        ? "Degraded"
        : status === "offline"
          ? "Service unavailable"
          : "Connecting…";
  const statusState = status === "degraded" ? "online" : status; // dot colour: degraded still reads as up

  /* ---------------- render messages (+ day separators) ---------------- */
  const rows: React.ReactNode[] = [];
  let prevUserDate: Date | null = null;
  for (const m of messages) {
    if (m.kind === "user") {
      const d = new Date(m.time);
      if (!isNaN(d.getTime())) {
        let label: string | null = null;
        if (!prevUserDate || d.toDateString() !== prevUserDate.toDateString()) label = d.toLocaleDateString();
        else if (d.getTime() - prevUserDate.getTime() >= SEP_GAP_MS)
          label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (label) rows.push(<div className="day-sep" key={"sep" + m.id}><span>{label}</span></div>);
        prevUserDate = d;
      }
    }

    if (m.kind === "user") {
      const stamp = fmtTime(m.time);
      rows.push(
        <div className="msg msg-user" key={m.id}>
          <div className="avatar" aria-hidden="true">You</div>
          <div className="msg-body">
            <div className="bubble"><span className="sr-only">You said: </span>{linkify(m.text)}</div>
            {stamp && <div className="meta"><span className="msg-time">{stamp}</span></div>}
          </div>
        </div>
      );
    } else if (m.kind === "welcome") {
      rows.push(
        <div className="msg msg-bot" key={m.id}>
          <div className="avatar" aria-hidden="true">AI</div>
          <div className="msg-body"><div className="bubble">{linkify(m.text)}</div></div>
        </div>
      );
    } else if (m.kind === "system") {
      rows.push(
        <div className="msg msg-system" key={m.id}>
          <div className="avatar" aria-hidden="true">!</div>
          <div className="msg-body">
            <div className="bubble">{linkify(m.text)}</div>
            {m.retry && (
              <button
                type="button"
                className="retry-btn"
                onClick={() => {
                  // the error row goes; the question is asked again (not echoed)
                  const q = m.retry!;
                  setMessages((prev) => prev.filter((x) => x.id !== m.id));
                  ask(q, false);
                }}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      );
    } else if (m.kind === "flow") {
      rows.push(
        <div className="msg msg-bot" key={m.id}>
          <div className="avatar" aria-hidden="true">AI</div>
          <div className="msg-body">
            <div className="bubble">{linkify(m.text)}</div>
            {m.buttons && m.buttons.length > 0 && (
              <div className="suggestions">
                <div className="chips">
                  {m.buttons.map((t, i) => (
                    <button type="button" className="chip" key={i} disabled={busy || usedChips.has(m.id + ":f" + i)} onClick={() => chipClick(m.id + ":f" + i, String(t))}>
                      {String(t)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (m.kind === "notice") {
      rows.push(
        <div className="day-sep" key={m.id}><span>{m.text}</span></div>
      );
    } else {
      const d = m.data;
      // A form prompt or a "did you mean" disambiguation isn't a knowledge answer:
      // no match badge, no category and no thumbs up/down (they don't apply).
      const isForm = d.source === "form" || d.source === "clarify";
      const isFallback = !isForm && (d.source === "fallback" || !d.answered);
      const hasEntry = d.entry_id !== null && d.entry_id !== undefined;
      const hideBadge =
        config.hide_confident_badge &&
        d.source !== "fallback" &&
        hasEntry &&
        (typeof d.confidence === "number" ? d.confidence : 0) >= DISPLAY_HIGH;
      const bi = config.show_confidence && !isForm && !hideBadge ? badgeInfo(d) : null;
      // An AI-composed answer whose notice line is switched off still has to say
      // so: a provenance label, shown whatever show_confidence / show_category say
      // (as in messenger.html).
      const aiBase = !isForm && d.source === "ai" && config.ai_notice === false;
      const stamp = fmtTime(d.created_at);
      const showVote = config.show_feedback && !isForm && typeof d.log_id === "number";
      const sugg = Array.isArray(d.suggestions) ? d.suggestions.filter(Boolean) : [];
      // Conversational-form quick replies (Confirm/Edit/Cancel, dropdown/radio
      // options). An OFFER turn keeps its Yes/No on the separate offer bubble.
      const flowBtns = d.flow && Array.isArray(d.flow.buttons) && !d.flow.offer ? d.flow.buttons.filter(Boolean) : [];
      const metaHasContent =
        aiBase || bi || (config.show_category && !isForm && d.category && hasEntry) || stamp || showVote;

      rows.push(
        <div className={"msg msg-bot" + (isFallback ? " is-fallback" : "")} key={m.id}>
          <div className="avatar" aria-hidden="true">AI</div>
          <div className="msg-body">
            <div className="bubble"><span className="sr-only">Assistant replied: </span>{linkify(d.answer || "")}</div>

            {metaHasContent && (
              <div className="meta">
                {aiBase && <span className="cat">AI Base</span>}
                {bi && <span className={bi.cls} title={bi.title}>{bi.text}</span>}
                {config.show_category && !isForm && d.category && hasEntry && <span className="cat">{String(d.category)}</span>}
                {stamp && <span className="msg-time">{stamp}</span>}
                {showVote && (
                  <span className="vote">
                    <button
                      type="button"
                      className="vote-btn vote-up"
                      aria-label="Helpful"
                      title="Helpful"
                      aria-pressed={m.rating === 1}
                      disabled={m.vote === "sending" || m.vote === "done"}
                      onClick={() => vote(m.id, d.log_id as number, 1)}
                    >
                      {Ico.thumb}
                    </button>
                    <button
                      type="button"
                      className="vote-btn vote-down"
                      aria-label="Not helpful"
                      title="Not helpful"
                      aria-pressed={m.rating === -1}
                      disabled={m.vote === "sending" || m.vote === "done"}
                      onClick={() => vote(m.id, d.log_id as number, -1)}
                    >
                      {Ico.thumb}
                    </button>
                  </span>
                )}
              </div>
            )}

            {(m.vote === "sending" || m.vote === "done" || m.vote === "error") && (
              <div className={"vote-note" + (m.vote === "error" ? " is-error" : "")}>
                {m.vote === "sending"
                  ? "Sending…"
                  : m.vote === "done"
                    ? "Thanks for the feedback."
                    : "Could not save that — try again."}
              </div>
            )}

            {sugg.length > 0 && (
              <div className="suggestions">
                <div className="suggestions-label">Did you mean</div>
                <div className="chips">
                  {sugg.map((t, i) => (
                    <button type="button" className="chip" key={i} disabled={busy || usedChips.has(m.id + ":s" + i)} onClick={() => chipClick(m.id + ":s" + i, String(t))}>
                      {String(t)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {flowBtns.length > 0 && (
              <div className="suggestions">
                <div className="chips">
                  {flowBtns.map((t, i) => (
                    <button type="button" className="chip" key={i} disabled={busy || usedChips.has(m.id + ":b" + i)} onClick={() => chipClick(m.id + ":b" + i, String(t))}>
                      {String(t)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <div
      className="rtchat-root"
      data-theme={theme}
      data-chat-style={prefs.style}
      data-anim={prefs.anim ? "on" : "off"}
      style={{ ["--fs" as any]: FONT_PX[prefs.font] }}
      ref={rootRef}
    >
      <style>{CSS}</style>

      {/* ============ PANEL ============ */}
      <section
        className={"panel" + (open ? " open" : "")}
        role="dialog"
        aria-modal="false"
        aria-label="Chat with Rivira Technologies"
        aria-hidden={!open}
      >
        <header className="app-header">
          <div className="brand-mark" aria-hidden="true">AI</div>
          <div className="brand">
            <div className="title">Rivira Technologies</div>
            <div className="status" data-state={statusState}>
              <span className="dot"></span>
              <span>{statusText}</span>
            </div>
          </div>
          {/* ---- Customize menu ---- */}
          <div className="hmenu">
            <button
              className="hbtn"
              id="rtchat-prefs-btn"
              type="button"
              title="Customize chat"
              aria-label="Customize chat"
              aria-haspopup="true"
              aria-expanded={menu === "prefs"}
              onClick={() => openMenu("prefs")}
            >
              {Ico.sliders}
            </button>

            <div className={"menu" + (menu === "prefs" ? " open" : "")} role="menu" aria-label="Customize chat">
              {/* page 1 */}
              <div className={"menu-page" + (page === "root" ? " active" : "")}>
                <div className="menu-title">{Ico.gear}Customize Chat</div>

                <div className="menu-item" aria-hidden="true" style={{ cursor: "default", background: "none" }}>
                  {Ico.palette}
                  <div className="mi-text"><span className="mi-label">Theme</span></div>
                </div>
                <div className="seg" role="group" aria-label="Theme">
                  <button type="button" aria-pressed={theme === "dark"} onClick={() => setThemeTo("dark")}>
                    {Ico.moon}Dark
                  </button>
                  <button type="button" aria-pressed={theme === "light"} onClick={() => setThemeTo("light")}>
                    {Ico.theme}Light
                  </button>
                </div>
                <div className="menu-sep"></div>

                <button className="menu-item" type="button" role="menuitem" onClick={() => setPage("style")}>
                  {Ico.chat}
                  <div className="mi-text"><span className="mi-label">Chat Style</span></div>
                  <span className="mi-val">{STYLE_LABEL[prefs.style]}</span>
                  {Ico.chevron}
                </button>

                <button className="menu-item" type="button" role="menuitem" onClick={() => setPage("font")}>
                  {Ico.text}
                  <div className="mi-text"><span className="mi-label">Font Size</span></div>
                  <span className="mi-val">{FONT_LABEL[prefs.font]}</span>
                  {Ico.chevron}
                </button>

                <button
                  className="menu-item warn"
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={prefs.sound}
                  onClick={() => {
                    updatePrefs({ sound: !prefs.sound });
                    if (!prefs.sound) beep(); // preview the chime when switching it on
                  }}
                >
                  {Ico.sound}
                  <div className="mi-text"><span className="mi-label">Sound</span></div>
                  <span className="sw" aria-hidden="true"></span>
                </button>

                <button
                  className="menu-item"
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={prefs.anim}
                  onClick={() => updatePrefs({ anim: !prefs.anim })}
                >
                  {Ico.sparkle}
                  <div className="mi-text"><span className="mi-label">Animations</span></div>
                  <span className="sw" aria-hidden="true"></span>
                </button>
              </div>

              {/* page: chat style */}
              <div className={"menu-page" + (page === "style" ? " active" : "")}>
                <button className="menu-back" type="button" onClick={() => setPage("root")}>
                  {Ico.back}Chat Style
                </button>
                {([
                  { v: "default", label: "Default", sub: "Comfortable spacing" },
                  { v: "compact", label: "Compact", sub: "More messages on screen" },
                  { v: "spacious", label: "Spacious", sub: "Roomier bubbles" },
                ] as { v: ChatStyle; label: string; sub: string }[]).map((o) => (
                  <button
                    key={o.v}
                    className="menu-item"
                    type="button"
                    role="menuitemradio"
                    aria-checked={prefs.style === o.v}
                    onClick={() => updatePrefs({ style: o.v })}
                  >
                    <div className="mi-text">
                      <span className="mi-label">{o.label}</span>
                      <div className="mi-sub">{o.sub}</div>
                    </div>
                    <span className="mi-val">✓</span>
                  </button>
                ))}
              </div>

              {/* page: font size */}
              <div className={"menu-page" + (page === "font" ? " active" : "")}>
                <button className="menu-back" type="button" onClick={() => setPage("root")}>
                  {Ico.back}Font Size
                </button>
                {(["small", "medium", "large"] as FontSize[]).map((f) => (
                  <button
                    key={f}
                    className="menu-item"
                    type="button"
                    role="menuitemradio"
                    aria-checked={prefs.font === f}
                    onClick={() => {
                      updatePrefs({ font: f });
                      autoGrow();
                    }}
                  >
                    <div className="mi-text"><span className="mi-label">{FONT_LABEL[f]}</span></div>
                    <span className="mi-val">✓</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---- End-chat menu ---- */}
          <div className="hmenu">
            <button
              className="hbtn danger"
              id="rtchat-end-btn"
              type="button"
              title="End chat"
              aria-label="End chat"
              aria-haspopup="true"
              aria-expanded={menu === "end"}
              onClick={() => openMenu("end")}
            >
              {Ico.endChat}
            </button>

            <div className={"menu" + (menu === "end" ? " open" : "")} role="menu" aria-label="End chat">
              {/* page 1 */}
              <div className={"menu-page" + (page === "root" ? " active" : "")}>
                <div className="menu-title">{Ico.endChat}End Chat</div>

                <button
                  className="menu-item danger"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenus();
                    startNewChat("New chat");
                  }}
                >
                  {Ico.endChat}
                  <div className="mi-text">
                    <span className="mi-label">End Current Chat</span>
                    <div className="mi-sub">Clear this conversation only</div>
                  </div>
                </button>

                <button
                  className="menu-item danger"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenus();
                    clearAllChats();
                  }}
                >
                  {Ico.trash}
                  <div className="mi-text">
                    <span className="mi-label">Clear All Chats</span>
                    <div className="mi-sub">Remove all conversation history</div>
                  </div>
                </button>

                <button className="menu-item" type="button" role="menuitem" onClick={() => setPage("export")}>
                  {Ico.download}
                  <div className="mi-text">
                    <span className="mi-label">Export Chat</span>
                    <div className="mi-sub">Download this chat as TXT/MD</div>
                  </div>
                </button>

                <button className="menu-item warn" type="button" role="menuitem" onClick={() => setPage("auto")}>
                  {Ico.trash}
                  <div className="mi-text">
                    <span className="mi-label">Auto Clear</span>
                    <div className="mi-sub">Set auto clear after inactivity</div>
                  </div>
                  <span className="mi-val">{AUTO_LABEL[String(prefs.autoClear)]}</span>
                  {Ico.chevron}
                </button>
              </div>

              {/* page: export */}
              <div className={"menu-page" + (page === "export" ? " active" : "")}>
                <button className="menu-back" type="button" onClick={() => setPage("root")}>
                  {Ico.back}Export Chat
                </button>
                {([
                  { v: "txt", label: "Plain text", sub: "chat.txt" },
                  { v: "md", label: "Markdown", sub: "chat.md" },
                ] as { v: "txt" | "md"; label: string; sub: string }[]).map((o) => (
                  <button
                    key={o.v}
                    className="menu-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeMenus();
                      exportChat(o.v);
                    }}
                  >
                    <div className="mi-text">
                      <span className="mi-label">{o.label}</span>
                      <div className="mi-sub">{o.sub}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* page: auto clear */}
              <div className={"menu-page" + (page === "auto" ? " active" : "")}>
                <button className="menu-back" type="button" onClick={() => setPage("root")}>
                  {Ico.back}Auto Clear
                </button>
                {AUTO_CHOICES.map((o) => (
                  <button
                    key={o.value}
                    className="menu-item"
                    type="button"
                    role="menuitemradio"
                    aria-checked={prefs.autoClear === o.value}
                    onClick={() => {
                      updatePrefs({ autoClear: o.value });
                      touchActivity();
                    }}
                  >
                    <div className="mi-text">
                      <span className="mi-label">{o.label}</span>
                      {o.sub && <div className="mi-sub">{o.sub}</div>}
                    </div>
                    <span className="mi-val">✓</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className="hbtn" type="button" title="Close" aria-label="Close chat" onClick={closeChat}>
            {Ico.close}
          </button>
        </header>

        <main
          className="transcript"
          aria-label="Conversation"
          ref={transcriptRef}
          onScroll={onTranscriptScroll}
          onClick={(e) => {
            // tap the conversation (not a control) to dismiss the keyboard
            const t = e.target as Element;
            if (document.activeElement === inputRef.current && !(t.closest && t.closest("button,a,input,textarea"))) {
              inputRef.current?.blur();
            }
          }}
        >
          {/* earlier messages loading: floats over the top, takes no space (the
              reader's scroll position is held when the rows are prepended) */}
          {histLoading === "older" && (
            <div className="hist-loading" role="status" aria-label="Loading earlier messages">
              <span className="hist-pill typing"><span className="bubble"><i></i><i></i><i></i></span>Loading earlier messages</span>
            </div>
          )}
          {rows}
          {(typing || histLoading === "initial") && (
            <div className="msg msg-bot typing" aria-hidden="true">
              <div className="avatar">AI</div>
              <div className="msg-body">
                <div className="bubble"><i></i><i></i><i></i></div>
              </div>
            </div>
          )}
        </main>

        <div className="composer-wrap">
          <form
            className="composer"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask about our AI programs…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              readOnly={!inputArmed}
              onFocus={() => setInputArmed(true)}
              onPointerDown={() => setInputArmed(true)}
              aria-label="Type your question"
              value={input}
              disabled={busy}
              onChange={(e) => {
                setInput(e.target.value);
                autoGrow();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button className="send-btn" type="submit" aria-label="Send question" disabled={busy || !input.trim()}>
              {Ico.send}
            </button>
          </form>
        </div>
      </section>

      {/* ============ LAUNCHER ============ */}
      <button
        ref={launcherRef}
        className={"launcher" + (unread ? " has-unread" : "")+ " wave-icon"}
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => (open ? closeChat() : openChat())}
      >
        <span className="main-launcher">
        <span className="badge-dot" aria-hidden="true"></span>
        {open ? Ico.close : Ico.chat}
        </span>

      </button>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveMsg}</div>
    </div>
  );
}

/* ==================================================================
   Scoped styles — every selector lives under .rtchat-root, and the
   design tokens hang off the widget's own container (not :root/<html>)
   so the site's own theme is untouched. Values match messenger.html.
   ================================================================== */
const CSS = `
.rtchat-root{
  --bg:#f2f5f9; --surface:#ffffff; --surface-2:#e9edf4; --text:#16202c; --muted:#5c6a7c;
  --border:#dde3ec; --accent:#1d4ed8; --accent-hover:#1a45bd; --accent-fg:#ffffff; --focus:#1d4ed8;
  --shadow:0 1px 2px rgba(16,24,40,.06),0 8px 24px rgba(16,24,40,.06);
  --high-bg:#e6f6ed; --high-fg:#12653a; --high-bd:#b8e4cb;
  --mid-bg:#fdf3e0; --mid-fg:#8a5a05; --mid-bd:#f2ddb4;
  --low-bg:#eef1f6; --low-fg:#5c6a7c; --low-bd:#dde3ec;
  --err-bg:#fdecec; --err-fg:#9b1c1c; --err-bd:#f5c6c6;
  --radius:14px;
  /* set from the Customize menu (font size / chat style) */
  --fs:15px; --row-gap:18px; --bubble-pad:10px 14px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-size:var(--fs); line-height:1.5;
}
.rtchat-root[data-chat-style="compact"]{ --row-gap:11px; --bubble-pad:7px 11px; }
.rtchat-root[data-chat-style="spacious"]{ --row-gap:26px; --bubble-pad:13px 16px; }
.rtchat-root[data-anim="off"] *{ transition:none !important; animation:none !important; }
.rtchat-root[data-theme="dark"]{
  --bg:#0d131e; --surface:#161e2c; --surface-2:#1e283a; --text:#e6ecf5; --muted:#93a1b5;
  --border:#29344a; --accent:#efc017; --accent-hover:#efc017; --accent-fg:#08101f; --focus:#7aa5ff;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
  --high-bg:#10301f; --high-fg:#79dda6; --high-bd:#1d5537;
  --mid-bg:#33270e; --mid-fg:#f0c368; --mid-bd:#574117;
  --low-bg:#1e283a; --low-fg:#93a1b5; --low-bd:#29344a;
  --err-bg:#3a1618; --err-fg:#f4a6a6; --err-bd:#5c2427;
}
.rtchat-root[data-theme="light"]{
  --bg:#f2f5f9; --surface:#ffffff; --surface-2:#e9edf4; --text:#16202c; --muted:#5c6a7c;
  --border:#dde3ec; --accent:#1d4ed8; --accent-hover:#1a45bd; --accent-fg:#000000;
  --shadow:0 1px 2px rgba(16,24,40,.06),0 8px 24px rgba(16,24,40,.06);
  --high-bg:#e6f6ed; --high-fg:#12653a; --high-bd:#b8e4cb;
  --mid-bg:#fdf3e0; --mid-fg:#8a5a05; --mid-bd:#f2ddb4;
  --low-bg:#eef1f6; --low-fg:#5c6a7c; --low-bd:#dde3ec;
  --err-bg:#fdecec; --err-fg:#9b1c1c; --err-bd:#f5c6c6;
}
.rtchat-root *{ box-sizing:border-box; }
.rtchat-root .sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }

.rtchat-root .launcher{
  position:fixed; right:20px; bottom:20px; width:45px; height:45px; border-radius:50%; border:0;
  background:#FFC107; color:var(--accent-fg); display:grid; place-items:center; cursor:pointer;
  box-shadow:0 6px 18px rgba(0,0,0,.35); z-index:20; transition:transform .15s ease, background .15s ease;
}
.rtchat-root .launcher:hover{ background:#FFC107; transform:scale(1.05); }
.rtchat-root .launcher svg{ width:26px; height:26px; display:block;
    color: white; }
.rtchat-root .launcher .badge-dot{ position:absolute; top:2px; right:2px; width:13px; height:13px; border-radius:50%; background:#f02849; border:2px solid var(--bg); display:none; }
.rtchat-root .launcher.has-unread .badge-dot{ display:block; }

.rtchat-root .panel{
  position:fixed; right:20px; bottom:90px; width:396px; height:min(620px, calc(100vh - 126px));
  background:var(--bg); border:1px solid var(--border); border-radius:var(--radius);
  box-shadow:0 18px 50px rgba(0,0,0,.45); display:grid; grid-template-rows:auto minmax(0,1fr) auto;
  overflow:hidden; z-index:20; transform-origin:bottom right;
  opacity:0; visibility:hidden; transform:translateY(14px) scale(.96);
  transition:opacity .16s ease, transform .16s ease, visibility .16s; color:var(--text);
}
.rtchat-root .panel.open{ opacity:1; visibility:visible; transform:none; }

.rtchat-root .app-header{ display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--surface); border-bottom:1px solid var(--border); }
.rtchat-root .brand-mark{ flex:none; width:32px; height:32px; display:grid; place-items:center; border-radius:50%; background:#FFC107; color:var(--accent-fg); font-size:11px; font-weight:700; user-select:none; }
.rtchat-root .brand{ min-width:0; flex:1; }
.rtchat-root .brand .title{ font-size:14.5px; font-weight:650; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rtchat-root .status{ display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--muted); }
.rtchat-root .status .dot{ width:7px; height:7px; border-radius:50%; background:#1fae63; flex:none; }
.rtchat-root .status[data-state="offline"] .dot{ background:#e04b4b; }
.rtchat-root .status[data-state="connecting"] .dot{ background:#d9a441; }
.rtchat-root .hbtn{ flex:none; width:30px; height:30px; display:grid; place-items:center; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--muted); cursor:pointer; transition:color .12s, border-color .12s; }
.rtchat-root .hbtn:hover{ color:var(--text); border-color:var(--muted); }
.rtchat-root .hbtn svg{ width:15px; height:15px; display:block; }

/* ---------- header popup menus (Customize chat / End chat) ---------- */
.rtchat-root .hmenu{ position:relative; flex:none; }
.rtchat-root .hbtn[aria-expanded="true"]{ color:var(--text); border-color:var(--accent); }
.rtchat-root .hbtn.danger[aria-expanded="true"]{ color:#e85a5a; border-color:#e85a5a; }
.rtchat-root .menu{
  position:absolute; top:calc(100% + 11px); right:0; width:252px; max-width:calc(100vw - 24px);
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
  box-shadow:0 18px 44px rgba(0,0,0,.45); padding:6px; z-index:30; display:none;
  font-size:15px; text-align:left;
}
.rtchat-root .menu.open{ display:block; }
/* little pointer up at the button that opened it */
.rtchat-root .menu::before{
  content:""; position:absolute; top:-6px; right:11px; width:10px; height:10px; background:var(--surface);
  border-left:1px solid var(--border); border-top:1px solid var(--border); transform:rotate(45deg);
}
.rtchat-root .menu-page{ display:none; }
.rtchat-root .menu-page.active{ display:block; }
.rtchat-root .menu-title{ display:flex; align-items:center; gap:10px; padding:8px 10px 9px; font-size:13.5px; font-weight:650; border-bottom:1px solid var(--border); margin-bottom:5px; }
.rtchat-root .menu-title svg{ width:18px; height:18px; flex:none; color:var(--muted); }
.rtchat-root .menu-back{ font:inherit; font-size:13.5px; font-weight:650; display:flex; align-items:center; gap:8px; width:100%; padding:8px 10px 9px; border:0; border-bottom:1px solid var(--border); margin-bottom:5px; background:transparent; color:var(--text); cursor:pointer; text-align:left; }
.rtchat-root .menu-back svg{ width:16px; height:16px; flex:none; color:var(--muted); }
.rtchat-root .menu-item{ font:inherit; display:flex; align-items:center; gap:11px; width:100%; padding:9px 10px; border:0; border-radius:9px; background:transparent; color:var(--text); text-align:left; cursor:pointer; transition:background .12s; }
.rtchat-root .menu-item:hover{ background:var(--surface-2); }
.rtchat-root .menu-item > svg{ width:19px; height:19px; flex:none; color:var(--accent); }
.rtchat-root .menu-item.danger > svg{ color:#e85a5a; }
.rtchat-root .menu-item.warn > svg{ color:#e0923f; }
.rtchat-root .mi-text{ min-width:0; flex:1; }
.rtchat-root .mi-label{ font-size:13.5px; line-height:1.3; }
.rtchat-root .mi-sub{ font-size:11.5px; color:var(--muted); line-height:1.35; }
.rtchat-root .mi-val{ flex:none; font-size:12.5px; color:var(--muted); }
.rtchat-root .mi-chev{ flex:none; width:15px !important; height:15px !important; color:var(--muted); }
.rtchat-root .menu-item[role="menuitemradio"] .mi-val{ visibility:hidden; color:var(--accent); font-weight:700; }
.rtchat-root .menu-item[role="menuitemradio"][aria-checked="true"] .mi-val{ visibility:visible; }
.rtchat-root .menu-item[aria-checked="true"] .mi-val{ color:var(--accent); }
.rtchat-root .menu-sep{ height:1px; background:var(--border); margin:5px 2px; }

/* theme segmented control */
.rtchat-root .seg{ display:flex; gap:8px; padding:2px 10px 8px 40px; }
.rtchat-root .seg button{ font:inherit; font-size:13px; flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 6px; border:1px solid var(--border); border-radius:9px; background:var(--bg); color:var(--text); cursor:pointer; }
.rtchat-root .seg button svg{ width:15px; height:15px; }
.rtchat-root .seg button[aria-pressed="true"]{ border-color:var(--accent); color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, transparent); }

/* on/off switch */
.rtchat-root .sw{ flex:none; width:42px; height:23px; border-radius:999px; background:var(--surface-2); border:1px solid var(--border); position:relative; transition:background .15s, border-color .15s; }
.rtchat-root .sw::after{ content:""; position:absolute; top:2px; left:2px; width:17px; height:17px; border-radius:50%; background:#fff; transition:transform .15s; }
.rtchat-root .menu-item[aria-checked="true"] .sw{ background:var(--accent); border-color:var(--accent); }
.rtchat-root .menu-item[aria-checked="true"] .sw::after{ transform:translateX(19px); }

.rtchat-root .transcript{ overflow-y:auto; overscroll-behavior:contain; padding:16px 14px 8px; display:flex; flex-direction:column; gap:var(--row-gap); scrollbar-width:thin; background:var(--bg); }
.rtchat-root .hist-loading{ position:sticky; top:6px; z-index:2; height:0; overflow:visible; display:flex; justify-content:center; align-items:flex-start; pointer-events:none; }
.rtchat-root .hist-pill{ display:inline-flex; align-items:center; gap:8px; padding:6px 14px 6px 12px; border-radius:999px; font-size:12px; line-height:1; color:var(--text); background:var(--surface-2); border:1px solid var(--border); box-shadow:var(--shadow); }
.rtchat-root .hist-pill .bubble{ display:inline-flex; align-items:center; gap:3px; padding:0 !important; background:transparent !important; box-shadow:none !important; border:0 !important; }
.rtchat-root .hist-pill i{ width:5px; height:5px; }

.rtchat-root .msg{ display:flex; gap:10px; align-items:flex-start; max-width:100%; }
.rtchat-root .msg-user{ flex-direction:row-reverse; }
.rtchat-root .avatar{ flex:none; width:30px; height:30px; margin-top:2px; display:grid; place-items:center; border-radius:50%; font-size:10.5px; font-weight:700; letter-spacing:.02em; background:#FFC107; color:var(--accent-fg); user-select:none;position: relative;
    justify-content: center;
    text-align: center;
    padding-right: 0; }
.rtchat-root .msg-user .avatar{ background:var(--surface-2); color:var(--muted); border:1px solid var(--border); }
.rtchat-root .msg-body{ min-width:0; max-width:82%; display:flex; flex-direction:column; gap:7px; }
.rtchat-root .msg-user .msg-body{ align-items:flex-end; }
.rtchat-root .bubble{ padding:var(--bubble-pad); border-radius:var(--radius); background:var(--surface); border:1px solid var(--border); box-shadow:var(--shadow); white-space:pre-wrap; overflow-wrap:anywhere; }
.rtchat-root .msg-bot .bubble{ border-top-left-radius:5px; }
.rtchat-root .msg-user .bubble{ background:#FFC107; color:#3b3636; border-color:transparent; border-top-right-radius:5px; }
.rtchat-root .msg-bot.is-fallback .bubble{ border-left:3px solid var(--mid-bd); }
.rtchat-root .msg-system .bubble{ background:var(--err-bg); border-color:var(--err-bd); color:var(--err-fg); }
.rtchat-root .bubble a{ color:var(--accent); text-decoration:underline; text-underline-offset:2px; overflow-wrap:anywhere; }
.rtchat-root .msg-user .bubble a{ color:inherit; }
.rtchat-root .msg-system .avatar{ background:var(--err-bg); color:var(--err-fg); border:1px solid var(--err-bd); }

.rtchat-root .meta{ display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding-left:2px; }
.rtchat-root .badge{ display:inline-flex; align-items:center; gap:5px; padding:2.5px 9px; font-size:11.5px; font-weight:600; border-radius:999px; border:1px solid transparent; cursor:default; }
.rtchat-root .badge-high{ background:var(--high-bg); color:var(--high-fg); border-color:var(--high-bd); }
.rtchat-root .badge-mid{ background:var(--mid-bg); color:var(--mid-fg); border-color:var(--mid-bd); }
.rtchat-root .badge-low{ background:var(--low-bg); color:var(--low-fg); border-color:var(--low-bd); }
.rtchat-root .cat{ font-size:11.5px; color:var(--muted); padding:2.5px 8px; border:1px solid var(--border); border-radius:999px; background:var(--surface); }
.rtchat-root .msg-time{ font-size:11.5px; color:var(--muted); white-space:nowrap; }
.rtchat-root .day-sep{ display:flex; align-items:center; justify-content:center; }
.rtchat-root .day-sep span{ font-size:11.5px; color:var(--muted); background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:3px 12px; }

.rtchat-root .vote{ display:inline-flex; gap:4px; margin-left:auto; }
.rtchat-root .vote-btn{ display:grid; place-items:center; width:26px; height:26px; padding:0; border:1px solid var(--border); border-radius:7px; background:var(--surface); color:var(--muted); cursor:pointer; transition:color .12s, border-color .12s, background .12s; }
.rtchat-root .vote-btn:hover:not(:disabled){ color:var(--text); border-color:var(--muted); }
.rtchat-root .vote-btn:disabled{ cursor:progress; opacity:.6; }
.rtchat-root .vote-btn[aria-pressed="true"]{ color:var(--accent); border-color:var(--accent); background:color-mix(in srgb, var(--accent) 10%, transparent); }
.rtchat-root .vote-btn svg{ width:15px; height:15px; display:block; }
.rtchat-root .vote-down svg{ transform:rotate(180deg); }
.rtchat-root .vote-note{ font-size:11.5px; color:var(--muted); padding-left:2px; }
.rtchat-root .vote-note.is-error{ color:var(--err-fg); }

.rtchat-root .suggestions{ display:flex; flex-direction:column; gap:7px; padding-top:2px; }
.rtchat-root .suggestions-label{ font-size:11.5px; font-weight:600; color:var(--muted); letter-spacing:.02em; text-transform:uppercase; }
.rtchat-root .chips{ display:flex; flex-wrap:wrap; gap:7px; }
.rtchat-root .chip{ font:inherit; font-size:13px; text-align:left; padding:6px 12px; border-radius:999px; border:1px solid var(--border); background:var(--surface); color:var(--text); cursor:pointer; transition:border-color .12s, background .12s; }
.rtchat-root .chip:hover:not(:disabled){ border-color:var(--accent); color:var(--accent); }
.rtchat-root .chip:disabled{ opacity:.5; cursor:not-allowed; }
.rtchat-root .retry-btn{ align-self:flex-start; font:inherit; font-size:13px; padding:6px 12px; border-radius:999px; border:1px solid var(--border); background:var(--surface); color:var(--text); cursor:pointer; }
.rtchat-root .retry-btn:hover{ border-color:var(--accent); color:var(--accent); }

.rtchat-root .typing .bubble{ display:inline-flex; align-items:center; gap:4px; padding:14px; }
.rtchat-root .typing i{ width:6px; height:6px; border-radius:50%; background:var(--muted); animation:rtchat-blip 1.2s infinite ease-in-out; }
.rtchat-root .typing i:nth-child(2){ animation-delay:.18s; }
.rtchat-root .typing i:nth-child(3){ animation-delay:.36s; }
@keyframes rtchat-blip{ 0%,70%,100%{ opacity:.35; transform:translateY(0); } 35%{ opacity:1; transform:translateY(-3px); } }

.rtchat-root .composer-wrap{ padding:10px 14px 12px; background:var(--surface); border-top:1px solid var(--border); }
.rtchat-root .composer{ display:flex; align-items:flex-end; gap:8px; padding:6px 6px 6px 12px; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg); transition:border-color .12s, box-shadow .12s; }
.rtchat-root .composer:focus-within{ border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.rtchat-root .composer textarea{ flex:1; min-width:0; resize:none; border:0; outline:0; background:transparent; color:var(--text); font:inherit; line-height:1.5; padding:8px 0; max-height:110px; overflow-y:auto; }
.rtchat-root .composer textarea::placeholder{ color:var(--muted); }
.rtchat-root .send-btn{ flex:none; width:36px; height:36px; display:grid; place-items:center; border:0; border-radius:9px; background:#FFC107; color:var(--accent-fg); margin-bottom:2px; cursor:pointer; transition:background .12s, opacity .12s; }
.rtchat-root .send-btn:hover:not(:disabled){ background:var(--accent-hover); }
.rtchat-root .send-btn:disabled{ opacity:.45; cursor:not-allowed; }
.rtchat-root .send-btn svg{ width:17px; height:17px; display:block; }

@media (max-width:480px){
  .rtchat-root .panel{ right:0; left:0; bottom:0; width:auto; height:var(--panel-h, 100dvh); border-radius:0; border:0; transform-origin:bottom center; }
  body.rtchat-open{ overflow:hidden; }
  body.rtchat-open .rtchat-root .launcher{ display:none; }
}
@media (prefers-reduced-motion: reduce){
  .rtchat-root .panel, .rtchat-root .launcher{ transition:none; }
  .rtchat-root .typing i{ animation:none; opacity:.5; }
}
`;
