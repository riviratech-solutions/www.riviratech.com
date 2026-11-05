import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Head, SERVER_URL } from "../../../components/Includes";
import { listFetch } from "../../../utils/listCache";
import { openWebLink } from "../../../utils/openLink";
import { getCachedUser } from "../../../utils/currentUser";
import ClassVideo from "../../../components/ClassVideo";
import {
  AlarmClock,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  Lock,
  MessageCircle,
  Paperclip,
  PlayCircle,
  Radio,
  RotateCw,
  Search,
  Send,
  Star,
  User,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { AnimatedNumber, ButtonLoader, Skeleton, SkeletonList } from "../../../components/loading";
import { classDocUrl } from "../../../utils/classFiles";
import { tzShort } from "../../../utils/classTime";
import { CLASS_PROGRESS_EVENT, type ClassProgressDetail } from "../../../utils/classViewTracking";

/* Classes — a course-style view of a batch's classes for every role (admin,
   trainer, student). Adding, editing, starting, joining and recordings are
   managed on Live Classes (LiveClasses.tsx); this page only shows them:
     left   the selected class (recording / link / countdown) and Overview,
            Q&A and Reviews tabs
     right  "Course content": every class of the batch, grouped by month
   Students can ask their trainer a question (api/qa-ask) and review the course
   (api/add-feedback, one review per course) until the batch is marked completed
   (batches.progress, set on Admin → Batches).
   Data: api/live-classes (all: "1" — the whole batch), api/class-overview
   (students in the batch + the course's reviews), api/qa-list, api/my-feedbacks. */

type Cls = {
  id: number;
  req_id: string;
  title: string;
  description?: string;
  notes?: string;
  doc?: string;
  file?: string;
  type?: string;
  pwd?: string;
  stimings: number | string;
  etimings: number | string;
  status: string; // "0" cancelled, "1" scheduled, "3" started, "2" completed
  trainer?: string;
  tname?: string;
  video_mode?: string; // "" older public upload, "mp4" private stream, "hls" encrypted (ClassVideo.tsx)
  video_status?: string;
  hls_playlist?: string;
};
type Review = {
  id: number;
  name: string;
  rating: number;
  text: string;
  datetime: number;
};
type Overview = {
  students: number;
  rating: { avg: number; count: number; dist: Record<string, number> };
  reviews: Review[];
};
type Kind = "completed" | "live" | "upcoming" | "cancelled" | "ended";

const nowSec = () => Math.floor(Date.now() / 1000);
const isWeb = (v: string) => /^https?:\/\//i.test(v);

// Where a class stands, and its recording (the same rules as ClassHeroCard).
function classInfo(c: Cls, now: number) {
  const st = Number(c.stimings) || 0;
  const et = Number(c.etimings) || 0;
  const completed = c.status === "2" || c.status === "2S"; // "2S": completed, disabled (admins / trainers only)
  const cancelled = c.status === "0";
  const over = et > 0 ? now > et : st > 0 && now >= st;
  const live = !completed && !cancelled && !over && st > 0 && now >= st;
  const upcoming = !completed && !cancelled && st > now;
  const rec = String(c.file || "").trim();
  const recIsLink = String(c.type) === "2" || isWeb(rec);
  const kind: Kind = cancelled
    ? "cancelled"
    : completed
      ? "completed"
      : live
        ? "live"
        : upcoming
          ? "upcoming"
          : "ended";
  return {
    st,
    et,
    kind,
    videoFile: completed && rec.length >= 10 && !recIsLink ? rec : "",
    videoLink: completed && recIsLink && isWeb(rec) ? rec : "",
    duration: st > 0 && et > st ? et - st : 0,
  };
}

const fmtDate = (
  ts: number,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) => (ts ? new Date(ts * 1000).toLocaleDateString("en-IN", opts) : "");
const fmtTime = (ts: number) =>
  ts
    ? new Date(ts * 1000).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
function fmtDur(sec: number) {
  if (!sec) return "";
  const mins = Math.max(1, Math.round(sec / 60)); // whole minutes first: 1h 59m 40s → 2h, not 1h 60m
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m} min`;
}
// a total, same style as one class: "2h 6m", "45 min", "0 min"
const fmtHours = (sec: number) => fmtDur(sec) || "0 min";
function countdown(sec: number) {
  if (sec <= 0) return "now";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="cls-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= full ? "on" : ""} />
      ))}
    </span>
  );
}

// the last course / batch opened on this page (per signed-in account, this browser)
const SEL_KEY = () => "kkr.classes.sel:" + (getCachedUser()?.mem_id || "");
function readSel(): { cid: string; bid: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(SEL_KEY()) || "null");
    return v && typeof v.cid === "string" ? v : null;
  } catch {
    return null;
  }
}
function saveSel(cid: string, bid: string) {
  try {
    localStorage.setItem(SEL_KEY(), JSON.stringify({ cid, bid }));
  } catch {
    /* storage unavailable */
  }
}

/* ---------- loading placeholders, shaped like the page ---------- */
const SK_W = ["78%", "56%", "70%", "48%", "64%"];

/** The dark player box, with a soft light sweeping across. */
const PlayerSkeleton = () => (
  <div className="cls-player-sk" role="status">
    <span className="visually-hidden">Loading…</span>
  </div>
);

/** Sidebar: month sections, the first one open with its classes. */
function SideSkeleton({ sections = 3, rows = 3 }: { sections?: number; rows?: number }) {
  return (
    <div role="status">
      <span className="visually-hidden">Loading classes…</span>
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="cls-sec" aria-hidden="true">
          <div className="cls-sec-head">
            <Skeleton w={34} h={34} r="50%" />
            <div className="cls-sec-text">
              <Skeleton w={i ? "38%" : "46%"} h={13} />
              <Skeleton w="28%" h={10} style={{ marginTop: 7 }} />
            </div>
          </div>
          {i === 0 && (
            <div className="cls-sec-rows">
              {Array.from({ length: rows }, (_, j) => (
                <div key={j} className="cls-item">
                  <Skeleton w={18} h={18} r="50%" />
                  <div style={{ flex: 1 }}>
                    <Skeleton w={SK_W[j % SK_W.length]} h={12} />
                    <Skeleton w="42%" h={10} style={{ marginTop: 7 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** The whole page while the courses and classes first load. */
function ClassesSkeleton() {
  return (
    <div className="cls-grid" role="status">
      <span className="visually-hidden">Loading classes…</span>
      <div className="cls-main" aria-hidden="true">
        <div className="cls-player">
          <div className="cls-player-sk" />
        </div>
        <div className="cls-tabs cls-tabs-sk">
          <Skeleton w={74} h={14} />
          <Skeleton w={48} h={14} />
          <Skeleton w={66} h={14} />
        </div>
        <Skeleton w="64%" h={30} r={8} style={{ marginBottom: 18 }} />
        <div className="cls-stats">
          {[96, 84, 84, 150, 80].map((w, i) => (
            <div key={i}>
              <Skeleton w={w} h={30} r={8} />
            </div>
          ))}
        </div>
        <div className="cls-info cls-info-sk">
          {SK_W.map((w, i) => (
            <div key={i} className="cls-kv">
              <Skeleton w={20} h={20} r={6} />
              <Skeleton w={90} h={12} />
              <Skeleton w={w} h={12} />
            </div>
          ))}
        </div>
      </div>
      <aside className="cls-side" aria-hidden="true">
        <div className="cls-side-tabs">
          <span className="cls-side-tab-sk">
            <Skeleton w={130} h={14} />
          </span>
        </div>
        <div className="cls-side-sum">
          <Skeleton w={150} h={12} />
          <Skeleton w={70} h={12} />
        </div>
        <div className="cls-side-tools">
          <Skeleton h={38} r={10} />
          <div style={{ display: "flex", gap: 8 }}>
            <Skeleton w={46} h={28} r={999} />
            <Skeleton w={84} h={28} r={999} />
            <Skeleton w={92} h={28} r={999} />
          </div>
        </div>
        <div className="cls-sections">
          <SideSkeleton />
        </div>
      </aside>
    </div>
  );
}

export default function Classes() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [booting, setBooting] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [batchMap, setBatchMap] = useState<Record<string, any[]>>({});
  const [mine, setMine] = useState<any[]>([]); // the member's own courses (student / trainer)
  const [cid, setCid] = useState("");
  const [bid, setBid] = useState("");

  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selId, setSelId] = useState<number | null>(null);

  const [mainTab, setMainTab] = useState<"overview" | "qa" | "reviews">(
    "overview",
  );
  // students: a question for the trainer, and their own course review
  const [question, setQuestion] = useState("");
  const [qaNote, setQaNote] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [myReview, setMyReview] = useState<{
    loaded: boolean;
    has: boolean;
    rating: number;
    text: string;
  }>({ loaded: false, has: false, rating: 0, text: "" });
  const [revNote, setRevNote] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");
  const [search, setSearch] = useState("");
  const [descOpen, setDescOpen] = useState(false);
  const [reviewsShown, setReviewsShown] = useState(10);
  const [nextHidden, setNextHidden] = useState(false);

  const [qa, setQa] = useState<{
    items: any[];
    page: number;
    last: number;
    loaded: boolean;
    msg: string;
    busy: boolean;
  }>({
    items: [],
    page: 0,
    last: 0,
    loaded: false,
    msg: "",
    busy: false,
  });

  // the clock: every second for countdowns, a coarser one for class states
  const [now, setNow] = useState(nowSec());
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowSec()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const coarse = Math.floor(now / 30) * 30;
  const playerRef = useRef<HTMLDivElement | null>(null);

  /* ---------------- course / batch ---------------- */
  const newestBatch = (list: any[]) =>
    list
      .slice()
      .sort(
        (x, y) =>
          String(y.sdate || "").localeCompare(String(x.sdate || "")) ||
          (Number(y.id) || 0) - (Number(x.id) || 0),
      )[0];

  const chooseCourse = async (
    c: string,
    preferBid: string,
    ro: string,
    own: any[],
  ) => {
    setCid(c);
    let list: any[] = [];
    try {
      const r = (await listFetch("api/get-batches", { c_id: c, status: "" }))
        .data;
      list = r && r.success && Array.isArray(r.data) ? r.data : [];
    } catch {
      /* none */
    }
    setBatchMap((m) => ({ ...m, [c]: list }));
    const myB = own.find((m) => m.c_id === c)?.b_id || "";
    const active = list.filter((b) => b.status === "1");
    let b = "";
    if (ro === "1") b = myB || newestBatch(active)?.b_id || "";
    else
      b =
        (preferBid && list.some((x) => x.b_id === preferBid)
          ? preferBid
          : "") ||
        myB ||
        newestBatch(active)?.b_id ||
        "";
    setBid(b);
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(SERVER_URL + "api/check-login", {
          withCredentials: true,
        });
        if (!r.data || !r.data.loggedIn) {
          navigate("/logout");
          return;
        }
        const ro = String(r.data.id || "");
        setRole(ro);
        const all = (await listFetch("api/get-courses", { status: "" })).data;
        const active = (all && Array.isArray(all.data) ? all.data : []).filter(
          (c: any) => c.status === "1",
        );
        let own: any[] = [];
        if (ro === "1") {
          const m = (await listFetch("api/get-mem-courses", { status: "" }))
            .data;
          own = m && Array.isArray(m.data) ? m.data : [];
        } else if (ro === "2") {
          const p = (await listFetch("api/get-myprofile", { status: "" })).data;
          own = p && Array.isArray(p.courses) ? p.courses : [];
        }
        // students: their enrolled courses; trainers: their own; admins: every active course
        const list =
          ro === "1" || ro === "2"
            ? active.filter((c: any) => own.some((m) => m.c_id === c.req_id))
            : active;
        setMine(own);
        setCourses(list);
        const q = new URLSearchParams(window.location.search).get("id");
        const saved = readSel();
        const pick =
          (q && list.find((c: any) => c.req_id === q)) ||
          (saved && list.find((c: any) => c.req_id === saved.cid)) ||
          (list.length === 1 ? list[0] : null);
        if (pick)
          await chooseCourse(
            pick.req_id,
            saved && saved.cid === pick.req_id ? saved.bid : "",
            ro,
            own,
          );
      } catch {
        /* shown as "no courses" */
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  /* ---------------- classes of the batch ---------------- */
  const loadAll = async (fresh = false) => {
    if (!cid || !bid) return;
    setLoading(true);
    setOverview(null);
    setQa({ items: [], page: 0, last: 0, loaded: false, msg: "", busy: false });
    setReviewsShown(10);
    setMyReview({ loaded: false, has: false, rating: 0, text: "" });
    setQaNote(null);
    setRevNote(null);
    try {
      const r = (
        await listFetch(
          "api/live-classes",
          { cid, bid, all: "1", q: "", s: "", n: 1 },
          { fresh },
        )
      ).data;
      const rows: Cls[] = r && r.success && Array.isArray(r.data) ? r.data : [];
      rows.sort(
        (a, b) =>
          (Number(a.stimings) || 0) - (Number(b.stimings) || 0) || a.id - b.id,
      );
      setClasses(rows);
      // open on: the live class, else the next one, else the latest
      const t = nowSec();
      const infos = rows.map((c) => ({ c, i: classInfo(c, t) }));
      const pick =
        infos.find((x) => x.i.kind === "live") ||
        infos.find((x) => x.i.kind === "upcoming") ||
        [...infos].reverse().find((x) => x.i.kind !== "cancelled") ||
        infos[infos.length - 1];
      setSelId(pick ? pick.c.id : null);
      if (pick) setOpen({ [monthKey(pick.i.st)]: true });
      try {
        const o = (
          await listFetch("api/class-overview", { cid, bid }, { fresh })
        ).data;
        if (o && o.success) setOverview(o);
      } catch {
        /* the overview figures stay empty */
      }
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (cid && bid) {
      saveSel(cid, bid);
      setNextHidden(sessionStorageGet("kkr.classes.nextHidden:" + bid) === "1");
      loadAll(false);
    } else {
      setClasses([]);
      setSelId(null);
    }
  }, [cid, bid]);

  /* ---------------- students: viewing progress + the lock (class-views.js) ---------------- */
  type Viewing = {
    locks: Record<string, { locked: boolean; prev: { req_id: string; title: string } | null }>;
    classes: Record<string, { completed: boolean; percent: number; started?: boolean }>;
  };
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const loadViewing = async () => {
    if (role !== "1" || !cid || !bid) return setViewing(null);
    try {
      const r = (await axios.post(SERVER_URL + "api/class-view/my-progress", { c_id: cid, b_id: bid }, { withCredentials: true })).data;
      if (r && r.success) setViewing({ locks: r.locks || {}, classes: r.classes || {} });
    } catch {
      /* the list shows without it */
    }
  };
  useEffect(() => {
    setViewing(null);
    loadViewing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, cid, bid, classes]);
  // the player's saves: the % as it goes, and the next class opens once one is completed
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ClassProgressDetail>).detail;
      if (!d) return;
      setViewing((v) =>
        v ? { ...v, classes: { ...v.classes, [d.class_id]: { completed: d.completed, percent: d.completed ? 100 : d.percent, started: true } } } : v,
      );
      if (d.just_completed) loadViewing();
    };
    window.addEventListener(CLASS_PROGRESS_EVENT, on);
    return () => window.removeEventListener(CLASS_PROGRESS_EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, cid, bid]);
  const lockOf = (c: Cls) => (role === "1" && viewing ? viewing.locks[c.req_id] : undefined);
  const seenOf = (c: Cls) => (role === "1" && viewing ? viewing.classes[c.req_id] : undefined);

  /* ---------------- derived ---------------- */
  const items = useMemo(
    () => classes.map((c, n) => ({ c, n: n + 1, i: classInfo(c, coarse) })),
    [classes, coarse],
  );
  const sel = items.find((x) => x.c.id === selId) || null;
  const totalSec = items.reduce(
    (s, x) => s + (x.i.kind === "cancelled" ? 0 : x.i.duration),
    0,
  );
  const recordedSec = items.reduce(
    (s, x) => s + (x.i.videoFile || x.i.videoLink ? x.i.duration : 0),
    0,
  );
  const upcomingCount = items.filter(
    (x) => x.i.kind === "upcoming" || x.i.kind === "live",
  ).length;
  const lastPast = [...items]
    .reverse()
    .find((x) => x.i.kind === "completed" || x.i.kind === "ended");
  const next = items.find((x) => x.i.kind === "upcoming") || null;
  const courseName = courses.find((c) => c.req_id === cid)?.title || "";
  const batches = batchMap[cid] || [];

  function monthKey(st: number) {
    if (!st) return "none";
    const d = new Date(st * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const sections = useMemo(() => {
    const out: {
      key: string;
      label: string;
      rows: typeof items;
      total: number;
    }[] = [];
    for (const x of items) {
      const key = monthKey(x.i.st);
      let s = out.find((o) => o.key === key);
      if (!s) {
        s = {
          key,
          label: x.i.st
            ? fmtDate(x.i.st, { month: "long", year: "numeric" })
            : "Not scheduled",
          rows: [],
          total: 0,
        };
        out.push(s);
      }
      s.rows.push(x);
      if (x.i.kind !== "cancelled") s.total += x.i.duration;
    }
    return out;
  }, [items]);

  const q = search.trim().toLowerCase();
  const matches = (x: (typeof items)[number]) =>
    (filter === "all" ||
      (filter === "upcoming" &&
        (x.i.kind === "upcoming" || x.i.kind === "live")) ||
      (filter === "completed" && x.i.kind === "completed")) &&
    (!q ||
      String(x.c.title || "")
        .toLowerCase()
        .includes(q));
  const narrowed = filter !== "all" || !!q;
  const allOpen = sections.length > 0 && sections.every((s) => open[s.key]);

  const select = (id: number, st: number) => {
    setSelId(id);
    setDescOpen(false);
    setOpen((o) => ({ ...o, [monthKey(st)]: true }));
    // back up to the player (smoothly), on every screen size
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const watchLink = (c: Cls, link: string) => {
    const pwd = String(c.pwd || "").trim();
    const ok = pwd
      ? window.prompt("Please use '" + pwd + "' to watch this class", pwd) !==
        null
      : window.confirm("Open the video link to watch this class?");
    if (!ok) return;
    if (!openWebLink(link)) {
      alert("This class link isn't a web link (https://…).");
      return;
    }
    if (role === "1")
      axios
        .post(SERVER_URL + "api/class-view/start", { class_id: c.req_id, ck: "link-" + Date.now().toString(36) }, { withCredentials: true })
        .then(() => loadViewing())
        .catch(() => {});
  };

  /* ---------------- Q&A (loaded when the tab is opened) ---------------- */
  const loadQa = async (page: number) => {
    setQa((s) => ({ ...s, busy: true }));
    try {
      const body: Record<string, any> = { n: page, q: "", s: "" };
      if (role === "X" && sel?.c.trainer) body.tid = sel.c.trainer; // admins: this class's trainer
      const r = (await listFetch("api/qa-list", body)).data;
      if (r && r.success) {
        setQa((s) => ({
          items: page === 1 ? r.data : [...s.items, ...r.data],
          page,
          last: Number(r.lastPage) || 1,
          loaded: true,
          msg: "",
          busy: false,
        }));
      } else {
        setQa({
          items: page === 1 ? [] : qa.items,
          page,
          last: 0,
          loaded: true,
          msg: r && r.permissionDenied ? r.message : "",
          busy: false,
        });
      }
    } catch {
      setQa((s) => ({
        ...s,
        loaded: true,
        busy: false,
        msg: "Could not load Q&A",
      }));
    }
  };
  useEffect(() => {
    if (mainTab === "qa" && !qa.loaded && !qa.busy && cid && bid) loadQa(1);
  }, [mainTab, qa.loaded, cid, bid]);
  // super admins see the Q&A of the selected class's trainer: another trainer, reload
  const selTrainer = sel?.c.trainer || "";
  useEffect(() => {
    if (role === "X")
      setQa({
        items: [],
        page: 0,
        last: 0,
        loaded: false,
        msg: "",
        busy: false,
      });
  }, [selTrainer]);

  /* ---------------- students: ask / review (until the batch is completed) ---------------- */
  const batchDone =
    (batchMap[cid] || []).find((b) => b.b_id === bid)?.progress === "completed";
  const canPost = role === "1" && !batchDone;
  // a question goes to the selected class's trainer (else the batch's latest trainer)
  const askTo = sel?.c.trainer
    ? sel.c
    : [...classes].reverse().find((c) => c.trainer) || null;

  const postApi = async (path: string, body: Record<string, any>) => {
    const s =
      (
        await axios.get(SERVER_URL + "api/security/token", {
          withCredentials: true,
        })
      ).data || {};
    return (
      await axios.post(
        SERVER_URL + path,
        { ...body, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      )
    ).data;
  };

  /* admins: the batch's "watch in order" lock (class-views.js; students see it in the list) */
  const canSetLock = role === "X" || role === "Y";
  const [lockOn, setLockOn] = useState<boolean | null>(null);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMsg, setLockMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setLockOn(null);
    setLockMsg(null);
    if (!canSetLock || !bid) return;
    let live = true;
    postApi("api/class-view/lock-status", { b_id: bid })
      .then((r) => live && r?.success && setLockOn(!!r.enabled))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSetLock, bid]);
  const toggleLock = async () => {
    if (lockOn === null || lockBusy) return;
    const next = !lockOn;
    setLockBusy(true);
    setLockMsg(null);
    try {
      const r = await postApi("api/class-view/lock-set", { b_id: bid, enabled: next });
      if (r?.success) {
        setLockOn(!!r.enabled);
        setLockMsg({ ok: true, text: r.message || "Saved" });
      } else setLockMsg({ ok: false, text: r?.message || "Couldn't change it" });
    } catch {
      setLockMsg({ ok: false, text: "Couldn't change it, please try again" });
    } finally {
      setLockBusy(false);
    }
  };
  useEffect(() => {
    if (!lockMsg?.ok) return;
    const t = window.setTimeout(() => setLockMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [lockMsg]);

  const askQuestion = async () => {
    const text = question.trim();
    if (!text)
      return setQaNote({ ok: false, text: "Please type your question." });
    if (!askTo?.trainer)
      return setQaNote({
        ok: false,
        text: "This batch has no trainer to ask yet.",
      });
    setSending(true);
    setQaNote(null);
    try {
      const r = await postApi("api/qa-ask", {
        to_id: askTo.trainer,
        question: text,
      });
      if (r && r.success) {
        setQuestion("");
        setQaNote({
          ok: true,
          text:
            "Your question has been sent to " +
            (askTo.tname || "your trainer") +
            ".",
        });
        setQa({
          items: [],
          page: 0,
          last: 0,
          loaded: false,
          msg: "",
          busy: false,
        }); // reload the list
      } else
        setQaNote({
          ok: false,
          text: (r && r.message) || "Could not send your question.",
        });
    } catch {
      setQaNote({
        ok: false,
        text: "Could not send your question. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  // the student's own review of this course (My Feedback holds the same one)
  const loadMyReview = async () => {
    try {
      const r = (await listFetch("api/my-feedbacks", {})).data;
      const mineRow =
        r && Array.isArray(r.data)
          ? r.data.find((x: any) => x.course_id === cid)
          : null;
      setMyReview({
        loaded: true,
        has: !!mineRow,
        rating: mineRow ? Number(mineRow.rating) || 0 : 0,
        text: mineRow ? String(mineRow.feedback || "") : "",
      });
    } catch {
      setMyReview({ loaded: true, has: false, rating: 0, text: "" });
    }
  };
  useEffect(() => {
    if (mainTab === "reviews" && role === "1" && cid && !myReview.loaded)
      loadMyReview();
  }, [mainTab, role, cid, myReview.loaded]);

  const saveReview = async () => {
    if (!(myReview.rating >= 1))
      return setRevNote({ ok: false, text: "Please choose a rating." });
    if (myReview.text.trim().length < 10)
      return setRevNote({
        ok: false,
        text: "Please write a little more (at least 10 characters).",
      });
    setSending(true);
    setRevNote(null);
    try {
      const r = await postApi("api/add-feedback", {
        course_id: cid,
        rating: myReview.rating,
        feedback: myReview.text.trim(),
      });
      if (r && r.success) {
        setRevNote({
          ok: true,
          text: r.message || "Thank you for your review!",
        });
        setMyReview((m) => ({ ...m, has: true }));
        try {
          const o = (
            await listFetch("api/class-overview", { cid, bid }, { fresh: true })
          ).data;
          if (o && o.success) setOverview(o);
        } catch {
          /* the list refreshes next time */
        }
      } else
        setRevNote({
          ok: false,
          text: (r && r.message) || "Could not save your review.",
        });
    } catch {
      setRevNote({
        ok: false,
        text: "Could not save your review. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  /* ---------------- render ---------------- */
  const canPickBatch = role !== "1";
  const ratingAvg = overview?.rating.avg || 0;
  const ratingCount = overview?.rating.count || 0;

  return (
    <div className="content cls-page">
      <Head
        pageTitle="Classes | Rivira Technologies"
        pageDesc="Your course classes"
        pageKeywords=""
      />
      <style>{CSS}</style>

      <div className="cls-head">
        <div className="cls-head-title">
          <span className="cls-head-ico">
            <PlayCircle size={22} />
          </span>
          <div>
            <h3>Classes</h3>
            <p>
              {courseName
                ? courseName
                : "Every class of your course, its recordings and details"}
              {cid &&
                bid &&
                (batchDone ? (
                  <span className="cls-batch-tag done">Batch completed</span>
                ) : (
                  <span className="cls-batch-tag">Batch running</span>
                ))}
            </p>
          </div>
        </div>
        <div className="cls-head-pick">
          <select
            className="form-select"
            aria-label="Course"
            value={cid}
            onChange={(e) =>
              e.target.value && chooseCourse(e.target.value, "", role, mine)
            }
            disabled={booting || !courses.length}
          >
            <option value="">
              {courses.length ? "Choose a course" : booting ? "Loading courses…" : "No courses"}
            </option>
            {courses.map((c) => (
              <option key={c.req_id} value={c.req_id}>
                {c.title}
              </option>
            ))}
          </select>
          {canPickBatch && (
            <select
              className="form-select"
              aria-label="Batch"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              disabled={!cid || !batches.length}
            >
              <option value="">
                {booting ? "Loading batches…" : cid && !batches.length ? "No batches" : "Choose a batch"}
              </option>
              {batches.map((b) => (
                <option key={b.b_id} value={b.b_id}>
                  {b.name}
                  {b.status !== "1" ? " (closed)" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="cls-reload"
            title="Refresh"
            aria-label="Refresh"
            data-refresh
            onClick={() => loadAll(true)}
            disabled={!cid || !bid || loading}
          >
            <RotateCw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {booting ? (
        <ClassesSkeleton />
      ) : !courses.length ? (
        <div className="cls-empty">
          <GraduationCap size={30} />
          <b>No courses yet</b>
          <span>
            {role === "1"
              ? "Classes appear here once you are enrolled in a course."
              : "There are no active courses to show."}
          </span>
        </div>
      ) : !cid || !bid ? (
        <div className="cls-empty">
          <Layers size={30} />
          <b>Choose a course{canPickBatch ? " and batch" : ""}</b>
          <span>Its classes, recordings and details open here.</span>
        </div>
      ) : (
        <div className="cls-grid">
          {/* ================= left: the selected class ================= */}
          <div className="cls-main">
            <div className="cls-player" ref={playerRef}>
              {loading && !sel ? (
                <PlayerSkeleton />
              ) : !sel ? (
                <div className="cls-player-msg">
                  <Video size={34} />
                  <b>No classes in this batch yet</b>
                </div>
              ) : sel.i.videoFile ? (
                <ClassVideo
                  key={sel.c.id}
                  item={sel.c}
                  className="cls-video"
                  onGoTo={(reqId) => {
                    const x = items.find((y) => y.c.req_id === reqId);
                    if (x) select(x.c.id, x.i.st);
                  }}
                />
              ) : sel.i.videoLink && lockOf(sel.c)?.locked ? (
                <div className="cls-player-msg">
                  <Lock size={34} />
                  <b>This class is locked</b>
                  <span>
                    Watch "{lockOf(sel.c)?.prev?.title || "the previous class"}" first to unlock this recording.
                  </span>
                  {lockOf(sel.c)?.prev && (
                    <button
                      type="button"
                      className="cls-goto-prev"
                      onClick={() => {
                        const x = items.find((y) => y.c.req_id === lockOf(sel.c)?.prev?.req_id);
                        if (x) select(x.c.id, x.i.st);
                      }}
                    >
                      Go to the previous class
                    </button>
                  )}
                </div>
              ) : sel.i.videoLink ? (
                <div className="cls-player-msg">
                  <button
                    type="button"
                    className="cls-play-big"
                    aria-label="Watch recording"
                    onClick={() => watchLink(sel.c, sel.i.videoLink)}
                  >
                    <PlayCircle size={64} strokeWidth={1.4} />
                  </button>
                  <b>Watch recording</b>
                  <span>
                    Opens the class recording
                    {String(sel.c.pwd || "").trim()
                      ? " (passcode shown before it opens)"
                      : ""}
                  </span>
                </div>
              ) : sel.i.kind === "live" ? (
                <div className="cls-player-msg">
                  <span className="cls-live-badge">
                    <Radio size={14} /> Live now
                  </span>
                  <b>{sel.c.title}</b>
                  <span>
                    {fmtTime(sel.i.st)}
                    {sel.i.et ? ` – ${fmtTime(sel.i.et)}` : ""} {tzShort(sel.i.st)}
                  </span>
                </div>
              ) : sel.i.kind === "upcoming" ? (
                <div className="cls-player-msg">
                  <span className="cls-player-kicker">Starts in</span>
                  <div className="cls-count">
                    {countdownParts(sel.i.st - now).map(([v, l]) => (
                      <div key={l}>
                        <b>{v}</b>
                        <small>{l}</small>
                      </div>
                    ))}
                  </div>
                  <span>
                    {fmtDate(sel.i.st, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    · {fmtTime(sel.i.st)} {tzShort(sel.i.st)}
                  </span>
                </div>
              ) : sel.i.kind === "cancelled" ? (
                <div className="cls-player-msg">
                  <XCircle size={40} />
                  <b>This class was cancelled</b>
                </div>
              ) : (
                <div className="cls-player-msg">
                  <Clock size={40} />
                  <b>Recording not available yet</b>
                  <span>It appears here once the trainer adds it.</span>
                </div>
              )}
            </div>

            <div className="cls-tabs" role="tablist">
              {(
                [
                  ["overview", "Overview"],
                  ["qa", "Q&A"],
                  ["reviews", "Reviews"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={mainTab === k}
                  className={mainTab === k ? "on" : ""}
                  onClick={() => setMainTab(k)}
                >
                  {l}
                </button>
              ))}
            </div>

            {mainTab === "overview" && (
              <div className="cls-ov">
                <h1 className="cls-title">{sel ? sel.c.title : courseName}</h1>

                <div className="cls-stats">
                  <div className="cls-stat-rate">
                    <div>
                      <span className="cls-rate-num">
                        {ratingCount ? <AnimatedNumber value={ratingAvg.toFixed(1)} /> : "–"}
                      </span>
                      <Stars value={ratingAvg} size={17} />
                    </div>
                    <small>
                      {ratingCount
                        ? `${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}`
                        : "No ratings yet"}
                    </small>
                  </div>
                  <div className="cls-stat">
                    <Users size={22} />
                    <div>
                      <b>{overview ? <AnimatedNumber value={overview.students} /> : <Skeleton w={26} h={16} className="sk-num" />}</b>
                      <small>Students</small>
                    </div>
                  </div>
                  <div className="cls-stat">
                    <Clock size={22} />
                    <div>
                      <b>{fmtHours(totalSec)}</b>
                      <small>Total</small>
                    </div>
                  </div>
                  <div className="cls-stat">
                    <Calendar size={22} />
                    <span>
                      {lastPast
                        ? `Last class ${fmtDate(lastPast.i.st, { month: "long", year: "numeric" })}`
                        : "No classes held yet"}
                    </span>
                  </div>
                  <div className="cls-stat">
                    <Globe size={22} />
                    <span>English</span>
                  </div>
                </div>

                {next && !nextHidden && (
                  <div className="cls-next">
                    <span className="cls-next-ico">
                      <AlarmClock size={26} />
                    </span>
                    <div className="cls-next-body">
                      <b>Next class</b>
                      <p>
                        {next.c.title} —{" "}
                        {fmtDate(next.i.st, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        at {fmtTime(next.i.st)}. Starts in{" "}
                        {countdown(next.i.st - now)}.
                      </p>
                    </div>
                    <div className="cls-next-act">
                      <button
                        type="button"
                        className="cls-btn"
                        onClick={() => select(next.c.id, next.i.st)}
                      >
                        View class
                      </button>
                      <button
                        type="button"
                        className="cls-link"
                        onClick={() => {
                          setNextHidden(true);
                          sessionStorageSet(
                            "kkr.classes.nextHidden:" + bid,
                            "1",
                          );
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                <div className="cls-info">
                  <div className="cls-info-grid">
                    <div>
                      <div className="cls-kv">
                        <GraduationCap size={20} />
                        <span>Course</span>
                        <b>{courseName || "—"}</b>
                      </div>
                      <div className="cls-kv">
                        <Users size={20} />
                        <span>Students</span>
                        <b>{overview ? overview.students : "—"}</b>
                      </div>
                      <div className="cls-kv">
                        <Globe size={20} />
                        <span>Language</span>
                        <b>English</b>
                      </div>
                    </div>
                    <div>
                      <div className="cls-kv">
                        <Layers size={20} />
                        <span>Classes</span>
                        <b>{items.length}</b>
                      </div>
                      <div className="cls-kv">
                        <Video size={20} />
                        <span>Recorded</span>
                        <b>{fmtHours(recordedSec)}</b>
                      </div>
                      <div className="cls-kv">
                        <Calendar size={20} />
                        <span>Upcoming</span>
                        <b>{upcomingCount}</b>
                      </div>
                    </div>
                  </div>
                  {sel && (
                    <>
                      <div className="cls-row">
                        <User size={20} />
                        <span>Trainer</span>
                        <div>{sel.c.tname || "—"}</div>
                      </div>
                      <div className="cls-row">
                        <Clock size={20} />
                        <span>Date &amp; time</span>
                        <div>
                          {sel.i.st
                            ? `${fmtDate(sel.i.st, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${fmtTime(sel.i.st)}${sel.i.et ? ` – ${fmtTime(sel.i.et)}` : ""} ${tzShort(sel.i.st)}`
                            : "Not scheduled"}
                          {sel.i.duration ? (
                            <span className="cls-muted">
                              {" "}
                              ({fmtDur(sel.i.duration)})
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="cls-row">
                        <FileText size={20} />
                        <span>Notes</span>
                        <div className="cls-pre">
                          {String(sel.c.notes || "").trim() || (
                            <span className="cls-muted">No notes</span>
                          )}
                        </div>
                      </div>
                      <div className="cls-row">
                        <Paperclip size={20} />
                        <span>Attachment</span>
                        <div>
                          {String(sel.c.doc || "").trim().length >= 10 ? (
                            <a
                              className="cls-btn-outline"
                              href={classDocUrl(sel.c.doc, sel.c.req_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download size={15} /> Download
                            </a>
                          ) : (
                            <span className="cls-muted">No attachment</span>
                          )}
                        </div>
                      </div>
                      <div className="cls-row">
                        <BookOpen size={20} />
                        <span>Description</span>
                        <div>
                          {String(sel.c.description || "").trim() ? (
                            <>
                              <div
                                className={
                                  "cls-pre cls-desc" + (descOpen ? " open" : "")
                                }
                              >
                                {sel.c.description}
                              </div>
                              {String(sel.c.description).length > 160 && (
                                <button
                                  type="button"
                                  className="cls-more"
                                  onClick={() => setDescOpen((v) => !v)}
                                >
                                  {descOpen ? "Show less" : "Show more"}{" "}
                                  <ChevronDown
                                    size={15}
                                    className={descOpen ? "up" : ""}
                                  />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="cls-muted">No description</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {mainTab === "qa" && (
              <div className="cls-panel">
                <div className="cls-panel-head">
                  <b>Questions &amp; answers</b>
                  <button
                    type="button"
                    className="cls-link"
                    onClick={() => navigate("/panel/qa-session")}
                  >
                    Open Q&amp;A <MessageCircle size={14} />
                  </button>
                </div>
                {role === "1" &&
                  (canPost ? (
                    <div className="cls-compose">
                      <label htmlFor="cls-question">
                        Ask{" "}
                        {askTo?.tname ? <b>{askTo.tname}</b> : "your trainer"} a
                        question
                      </label>
                      <textarea
                        id="cls-question"
                        className="form-control"
                        rows={3}
                        maxLength={2000}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Type your question about the class or course…"
                      />
                      <div className="cls-compose-foot">
                        {qaNote ? (
                          <span className={qaNote.ok ? "ok" : "err"}>
                            {qaNote.text}
                          </span>
                        ) : (
                          <span className="cls-muted">
                            The trainer's answer appears here and on the Q&amp;A
                            page.
                          </span>
                        )}
                        <button
                          type="button"
                          className="cls-btn"
                          disabled={sending || !question.trim()}
                          onClick={askQuestion}
                        >
                          <Send size={15} />{" "}
                          {sending ? <ButtonLoader label="Sending…" /> : "Ask question"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cls-closed">
                      This batch is completed, so new questions are closed.
                    </div>
                  ))}
                {!qa.loaded ? (
                  <SkeletonList rows={3} />
                ) : qa.msg ? (
                  <div className="cls-muted cls-pad">{qa.msg}</div>
                ) : !qa.items.length ? (
                  <div className="cls-muted cls-pad">No questions yet.</div>
                ) : (
                  <>
                    {qa.items.map((x: any) => (
                      <div key={x.id} className="cls-qa">
                        <div className="cls-qa-q">
                          <span className="cls-qa-tag">Q</span>
                          <div>
                            <p>{x.question}</p>
                            <small>
                              {x.sname || "Student"}
                              {x.tname ? ` → ${x.tname}` : ""} ·{" "}
                              {fmtDate(Number(x.datetime))}
                            </small>
                          </div>
                        </div>
                        <div className="cls-qa-a">
                          <span className="cls-qa-tag a">A</span>
                          <div>
                            {x.status === "2" && x.answer ? (
                              <p>{x.answer}</p>
                            ) : (
                              <p className="cls-muted">
                                Awaiting the trainer's answer
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {qa.page < qa.last && (
                      <button
                        type="button"
                        className="cls-more block"
                        disabled={qa.busy}
                        onClick={() => loadQa(qa.page + 1)}
                      >
                        {qa.busy ? <ButtonLoader label="Loading…" /> : "Show more"}{" "}
                        <ChevronDown size={15} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {mainTab === "reviews" && (
              <div className="cls-panel">
                <div className="cls-rev-sum">
                  <div className="cls-rev-big">
                    <b>{ratingCount ? ratingAvg.toFixed(1) : "–"}</b>
                    <Stars value={ratingAvg} size={18} />
                    <small>
                      Course rating{ratingCount ? ` · ${ratingCount}` : ""}
                    </small>
                  </div>
                  <div className="cls-rev-bars">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const n = overview?.rating.dist?.[s] || 0;
                      const pct = ratingCount
                        ? Math.round((n / ratingCount) * 100)
                        : 0;
                      return (
                        <div key={s} className="cls-rev-bar">
                          <div className="track">
                            <i style={{ width: pct + "%" }} />
                          </div>
                          <Stars value={s} size={13} />
                          <span>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {role === "1" &&
                  (canPost ? (
                    <div className="cls-compose">
                      <label>
                        {myReview.has
                          ? "Your review (you can update it)"
                          : "Review this course"}
                      </label>
                      <div
                        className="cls-star-pick"
                        role="radiogroup"
                        aria-label="Your rating"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={myReview.rating === n}
                            aria-label={`${n} star${n > 1 ? "s" : ""}`}
                            className={n <= myReview.rating ? "on" : ""}
                            onClick={() =>
                              setMyReview((m) => ({ ...m, rating: n }))
                            }
                          >
                            <Star size={24} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="form-control"
                        rows={3}
                        maxLength={2000}
                        value={myReview.text}
                        onChange={(e) =>
                          setMyReview((m) => ({ ...m, text: e.target.value }))
                        }
                        placeholder="What did you like? What could be better?"
                        disabled={!myReview.loaded}
                      />
                      <div className="cls-compose-foot">
                        {revNote ? (
                          <span className={revNote.ok ? "ok" : "err"}>
                            {revNote.text}
                          </span>
                        ) : (
                          <span className="cls-muted">
                            One review per course; it also shows on My Feedback.
                          </span>
                        )}
                        <button
                          type="button"
                          className="cls-btn"
                          disabled={sending || !myReview.loaded}
                          onClick={saveReview}
                        >
                          <Send size={15} />{" "}
                          {sending
                            ? "Saving…"
                            : myReview.has
                              ? "Update review"
                              : "Submit review"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cls-closed">
                      This batch is completed, so reviews are closed.
                    </div>
                  ))}
                {!overview ? (
                  <SkeletonList rows={3} />
                ) : !overview.reviews.length ? (
                  <div className="cls-muted cls-pad">
                    No reviews yet for this course.
                  </div>
                ) : (
                  <>
                    {overview.reviews.slice(0, reviewsShown).map((r) => (
                      <div key={r.id} className="cls-rev">
                        <span className="cls-avatar">
                          {r.name
                            .split(" ")
                            .map((p) => p.charAt(0))
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <div>
                          <b>{r.name}</b>
                          <div className="cls-rev-meta">
                            <Stars value={r.rating} size={13} />
                            <small>{fmtDate(r.datetime)}</small>
                          </div>
                          {r.text && <p>{r.text}</p>}
                        </div>
                      </div>
                    ))}
                    {reviewsShown < overview.reviews.length && (
                      <button
                        type="button"
                        className="cls-more block"
                        onClick={() => setReviewsShown((n) => n + 10)}
                      >
                        Show more reviews <ChevronDown size={15} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ================= right: course content ================= */}
          <aside className="cls-side">
            <div className="cls-side-tabs">
              <span className="on">Course content</span>
            </div>

            {
              <>
                <div className="cls-side-sum">
                  <span>
                    {items.length} {items.length === 1 ? "class" : "classes"} •{" "}
                    {fmtHours(totalSec)} total
                  </span>
                  {sections.length > 0 && (
                    <button
                      type="button"
                      className="cls-link"
                      onClick={() =>
                        setOpen(
                          allOpen
                            ? {}
                            : Object.fromEntries(
                                sections.map((s) => [s.key, true]),
                              ),
                        )
                      }
                    >
                      {allOpen ? "Collapse all" : "Expand all"}
                    </button>
                  )}
                </div>
                {canSetLock && bid && lockOn !== null && (
                  <div className="cls-lockbar">
                    <span className="cls-lockbar-ico">
                      <Lock size={16} />
                    </span>
                    <span className="cls-lockbar-text">
                      <b>Watch in order</b>
                      <small>
                        {lockOn
                          ? "Students unlock each recording by watching the one before it"
                          : "Off — students can watch any recording"}
                      </small>
                      {lockMsg && !lockMsg.ok && <small className="cls-lockbar-msg err">{lockMsg.text}</small>}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={lockOn}
                      aria-label="Watch in order (lock recordings)"
                      className={"cls-switch" + (lockOn ? " on" : "")}
                      disabled={lockBusy}
                      onClick={toggleLock}
                    >
                      <span />
                    </button>
                  </div>
                )}
                {/* search + filters only once the batch has classes */}
                {items.length > 0 && (
                <div className="cls-side-tools">
                  <label className="cls-search">
                    <Search size={15} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search classes"
                      aria-label="Search classes"
                    />
                  </label>
                  <div className="cls-chips">
                    {(
                      [
                        ["all", "All"],
                        ["upcoming", "Upcoming"],
                        ["completed", "Completed"],
                      ] as const
                    ).map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        className={filter === k ? "on" : ""}
                        onClick={() => setFilter(k)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                )}
                <div className="cls-sections">
                  {loading && !items.length ? (
                    <SideSkeleton />
                  ) : !sections.length ? (
                    <div className="cls-side-empty">
                      <span className="cls-side-empty-ico">
                        <Calendar size={26} />
                      </span>
                      <b>No classes yet</b>
                      <p>
                        This batch's classes will appear here, month by month,
                        as soon as they are scheduled.
                      </p>
                    </div>
                  ) : narrowed && !items.some(matches) ? (
                    <div className="cls-side-empty small">
                      <span className="cls-side-empty-ico">
                        <Search size={22} />
                      </span>
                      <b>No classes match</b>
                      <p>Try another word, or show all classes.</p>
                      <button
                        type="button"
                        className="cls-btn-outline"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        Clear search &amp; filter
                      </button>
                    </div>
                  ) : (
                    sections.map((s, si) => {
                      const rows = s.rows.filter(matches);
                      if (narrowed && !rows.length) return null;
                      const isOpen = narrowed || !!open[s.key];
                      return (
                        <div
                          key={s.key}
                          className={"cls-sec" + (isOpen ? " open" : "")}
                        >
                          <button
                            type="button"
                            className="cls-sec-head"
                            aria-expanded={isOpen}
                            onClick={() =>
                              setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))
                            }
                          >
                            <span className="cls-sec-no">{si + 1}</span>
                            <span className="cls-sec-text">
                              <b>{s.label}</b>
                              <small>
                                {s.rows.length}{" "}
                                {s.rows.length === 1 ? "class" : "classes"}
                                {s.total ? ` • ${fmtDur(s.total)}` : ""}
                              </small>
                            </span>
                            <ChevronDown size={18} className="cls-sec-car" />
                          </button>
                          {isOpen && (
                            <div className="cls-sec-rows">
                              {rows.map((x) => (
                                <button
                                  key={x.c.id}
                                  type="button"
                                  className={
                                    "cls-item " +
                                    x.i.kind +
                                    (x.c.id === selId ? " sel" : "") +
                                    (lockOf(x.c)?.locked ? " locked" : "")
                                  }
                                  title={lockOf(x.c)?.locked ? `Locked — watch "${lockOf(x.c)?.prev?.title || "the previous class"}" first` : undefined}
                                  onClick={() => select(x.c.id, x.i.st)}
                                >
                                  <span className="cls-item-ico">
                                    {seenOf(x.c)?.completed ? (
                                      <CheckCircle2 size={17} className="cls-seen-ico" />
                                    ) : x.i.kind === "completed" ? (
                                      x.i.videoFile || x.i.videoLink ? (
                                        <PlayCircle size={17} />
                                      ) : (
                                        <CheckCircle2 size={17} />
                                      )
                                    ) : x.i.kind === "live" ? (
                                      <Radio size={17} />
                                    ) : x.i.kind === "cancelled" ? (
                                      <XCircle size={17} />
                                    ) : (
                                      <Clock size={17} />
                                    )}
                                  </span>
                                  <span className="cls-item-text">
                                    <b>
                                      {x.n}. {x.c.title}
                                    </b>
                                    <small>
                                      {x.i.st
                                        ? `${fmtDate(x.i.st, { day: "numeric", month: "short" })} · ${fmtTime(x.i.st)}`
                                        : "Not scheduled"}
                                      {x.i.duration
                                        ? ` · ${fmtDur(x.i.duration)}`
                                        : ""}
                                      {x.i.kind === "live" && (
                                        <em className="tag live">Live</em>
                                      )}
                                      {x.i.kind === "cancelled" && (
                                        <em className="tag">Cancelled</em>
                                      )}
                                      {(x.i.videoFile || x.i.videoLink) && (
                                        <em className="tag rec" style={{"display":"none"}}>Recording</em>
                                      )}
                                      {lockOf(x.c)?.locked ? null : seenOf(x.c)?.completed ? (
                                        <em className="tag seen">Watched</em>
                                      ) : (seenOf(x.c)?.percent || 0) > 0 || seenOf(x.c)?.started ? (
                                        <em className="tag pct">
                                          {(seenOf(x.c)?.percent || 0) < 1 ? "<1" : seenOf(x.c)?.percent}% watched
                                        </em>
                                      ) : null}
                                    </small>
                                  </span>
                                  {lockOf(x.c)?.locked && (
                                    <span className="cls-item-lock" aria-label="Locked">
                                      <Lock size={15} />
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            }
          </aside>
        </div>
      )}
    </div>
  );
}

function countdownParts(sec: number): [string, string][] {
  const s = Math.max(0, sec);
  return [
    [String(Math.floor(s / 86400)), "days"],
    [String(Math.floor((s % 86400) / 3600)).padStart(2, "0"), "hours"],
    [String(Math.floor((s % 3600) / 60)).padStart(2, "0"), "min"],
    [String(s % 60).padStart(2, "0"), "sec"],
  ];
}
function sessionStorageGet(k: string) {
  try {
    return sessionStorage.getItem(k) || "";
  } catch {
    return "";
  }
}
function sessionStorageSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}

const CSS = `
/* loading placeholders */
.cls-player-sk { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, .07) 50%, transparent 70%); background-size: 300% 100%; animation: sk-shimmer 1.6s ease-in-out infinite; }
.cls-player-sk::after { content: ""; position: absolute; left: 50%; top: 50%; width: 68px; height: 68px; margin: -34px 0 0 -34px; border-radius: 50%; background: rgba(255, 255, 255, .08); box-shadow: 0 0 0 10px rgba(255, 255, 255, .03); }
.cls-tabs-sk { gap: 26px; padding: 4px 4px 14px; }
.cls-info-sk { padding: 10px 22px 12px; }
.cls-side-tab-sk { border-bottom-color: transparent !important; }
@media (prefers-reduced-motion: reduce) { .cls-player-sk { animation: none; background: none; } }
.cls-page { padding: 22px 26px 40px; background: var(--ad-bg); min-height: calc(100vh - 64px); color: var(--ad-ink-2); }
.cls-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.cls-head-title { display: flex; align-items: center; gap: 14px; min-width: 0; }
.cls-head-ico { width: 46px; height: 46px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; background: rgba(var(--ad-brand-rgb), .1); color: var(--ad-brand); flex: none; }
.cls-head h3 { margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--ad-ink); }
.cls-head p { margin: 2px 0 0; color: var(--ad-muted); font-size: .9rem; }
.cls-head-pick { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.cls-head-pick .form-select { width: auto; min-width: 220px; max-width: 100%; border-radius: 10px; font-size: .9rem; }
.cls-reload { width: 40px; height: 40px; border-radius: 10px; border: 0; background: var(--ad-brand); color: #fff; display: inline-flex; align-items: center; justify-content: center; }
.cls-reload:disabled { opacity: .5; }
.cls-head-pick .form-select {
  padding-right: 38px;
}
.cls-reload .spin { animation: cls-spin 1s linear infinite; }
@keyframes cls-spin { to { transform: rotate(360deg); } }

.cls-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 70px 20px; background: var(--ad-surface); border: 1px solid var(--ad-line); border-radius: 16px; color: var(--ad-muted); }
.cls-empty b { color: var(--ad-ink); font-size: 1.05rem; }
.cls-empty svg { color: var(--ad-brand); }

.cls-grid { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 26px; align-items: start; }
.cls-main { min-width: 0; }

/* player */
.cls-player { position: relative; aspect-ratio: 16 / 9; width: 100%; min-height: 280px; max-height: 75vh; border-radius: 16px; overflow: hidden; background: radial-gradient(120% 120% at 20% 10%, #2e2052 0%, #140d2b 60%, #0b0718 100%); color: #e9e4ff; box-shadow: 0 18px 40px -22px rgba(20, 12, 45, .7); scroll-margin-top: 80px; }
.cls-video { position: absolute; inset: 0; width: 100%; height: 100%; display: block; background: #000; }
.cls-video.cv-player-wrap, .cls-video .cv-player-wrap { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 16px; }
.cls-video.cv-box, .cls-video .cv-box { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 16px; }
.cls-video .cv-video-el { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.cls-player-msg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; }
.cls-player-msg b { font-size: 1.15rem; color: #fff; }
.cls-player-msg span { color: #c9bff0; font-size: .92rem; }
.cls-player-kicker { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem !important; font-weight: 700; }
.cls-play-big { background: none; border: 0; color: #fff; padding: 0; border-radius: 50%; transition: transform .15s; }
.cls-play-big:hover { transform: scale(1.06); }
.cls-live-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: #dc2626; color: #fff !important; font-weight: 700; font-size: .8rem !important; }
.cls-count { display: flex; gap: 10px; }
.cls-count div { min-width: 70px; padding: 10px 8px; border-radius: 12px; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .12); }
.cls-count b { display: block; font-size: 1.7rem; line-height: 1.1; color: #fff; font-variant-numeric: tabular-nums; }
.cls-count small { font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: #b8acec; }

/* tabs */
.cls-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--ad-line); margin: 16px 0 20px; overflow-x: auto; }
.cls-tabs button { background: none; border: 0; padding: 10px 16px 12px; font-weight: 700; font-size: 1rem; color: var(--ad-muted); border-bottom: 3px solid transparent; margin-bottom: -1px; white-space: nowrap; }
.cls-tabs button.on { color: var(--ad-ink); border-bottom-color: var(--ad-brand); }
.cls-tabs button:hover { color: var(--ad-ink); }

/* overview */
.cls-title { font-size: 1.85rem; line-height: 1.25; font-weight: 800; color: var(--ad-ink); margin: 0 0 16px; }
.cls-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 0; margin-bottom: 20px; }
.cls-stats > div { display: flex; align-items: center; gap: 10px; padding: 0 22px; border-left: 1px solid var(--ad-line); color: var(--ad-ink-2); }
.cls-stats > div:first-child { padding-left: 0; border-left: 0; }
.cls-stats svg { color: var(--ad-muted); flex: none; }
.cls-stat b { display: block; color: var(--ad-ink); font-size: 1.02rem; }
.cls-stat small, .cls-stat-rate small { display: block; color: var(--ad-muted); font-size: .85rem; }
.cls-stat-rate { flex-direction: column; align-items: flex-start !important; gap: 0 !important; }
.cls-stat-rate > div { display: flex; align-items: center; gap: 6px; }
.cls-rate-num { font-size: 1.35rem; font-weight: 800; color: #b4690e; }
.cls-stars { display: inline-flex; gap: 1px; }
.cls-stars svg { color: #d6d3e0; fill: #d6d3e0; }
.cls-stars svg.on { color: #e59819; fill: #e59819; }

.cls-next { display: flex; align-items: center; gap: 16px; padding: 18px 20px; border-radius: 14px; border: 1px solid rgba(var(--ad-brand-rgb), .16); background: var(--ad-accent-soft); margin-bottom: 18px; }
.cls-next-ico { width: 54px; height: 54px; border-radius: 50%; flex: none; display: inline-flex; align-items: center; justify-content: center; background: rgba(var(--ad-brand-rgb), .1); color: var(--ad-brand); }
.cls-next-body { flex: 1; min-width: 0; }
.cls-next-body b { color: var(--ad-ink); font-size: 1.05rem; }
.cls-next-body p { margin: 2px 0 0; color: var(--ad-ink-2); font-size: .92rem; }
.cls-next-act { display: flex; align-items: center; gap: 14px; flex: none; }
.cls-btn { display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 10px; padding: 10px 18px; background: var(--ad-brand); color: #fff; font-weight: 700; font-size: .92rem; }
.cls-btn:hover { background: var(--ad-brand-2); color: #fff; }
.cls-link { background: none; border: 0; padding: 0; color: var(--ad-brand); font-weight: 700; font-size: .9rem; display: inline-flex; align-items: center; gap: 5px; }
.cls-link:hover { text-decoration: underline; }

.cls-info { background: var(--ad-surface); border: 1px solid var(--ad-line); border-radius: 14px; padding: 6px 22px 10px; }
.cls-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; padding: 12px 0 14px; border-bottom: 1px solid var(--ad-line); }
.cls-info-grid > div + div { border-left: 1px solid var(--ad-line); padding-left: 28px; }
.cls-kv { display: grid; grid-template-columns: 22px 130px 1fr; align-items: center; gap: 12px; padding: 7px 0; }
.cls-kv svg, .cls-row svg { color: var(--ad-ink-2); }
.cls-kv span, .cls-row > span { color: var(--ad-ink); font-weight: 600; }
.cls-kv b { font-weight: 500; color: var(--ad-ink-2); min-width: 0; overflow-wrap: anywhere; }
.cls-row { display: grid; grid-template-columns: 22px 130px 1fr; align-items: start; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--ad-line); }
.cls-row:last-child { border-bottom: 0; }
.cls-row > div { min-width: 0; overflow-wrap: anywhere; }
.cls-pre { white-space: pre-wrap; }
.cls-desc { max-height: 3.2em; overflow: hidden; }
.cls-desc.open { max-height: none; }
.cls-more { background: none; border: 0; padding: 4px 0 0; color: var(--ad-brand); font-weight: 700; font-size: .88rem; display: inline-flex; align-items: center; gap: 4px; }
.cls-more svg.up { transform: rotate(180deg); }
.cls-more.block { display: flex; margin: 10px auto 4px; }
.cls-btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 9px; border: 1.5px solid var(--ad-brand); color: var(--ad-brand); font-weight: 700; font-size: .86rem; text-decoration: none; }
.cls-btn-outline:hover { background: rgba(var(--ad-brand-rgb), .06); color: var(--ad-brand); }
.cls-muted { color: var(--ad-muted); }
.cls-pad { padding: 18px 4px; display: flex; align-items: center; gap: 8px; }

/* Q&A / reviews */
.cls-panel { background: var(--ad-surface); border: 1px solid var(--ad-line); border-radius: 14px; padding: 16px 20px; }
.cls-panel-head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--ad-line); }
.cls-panel-head b { color: var(--ad-ink); }
.cls-qa { padding: 14px 0; border-bottom: 1px solid var(--ad-line); }
.cls-qa:last-of-type { border-bottom: 0; }
.cls-qa-q, .cls-qa-a { display: flex; gap: 12px; }
.cls-qa-a { margin-top: 8px; }
.cls-qa p { margin: 0; color: var(--ad-ink); white-space: pre-wrap; }
.cls-qa small { color: var(--ad-muted); }
.cls-qa-tag { width: 24px; height: 24px; border-radius: 7px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 800; background: rgba(var(--ad-brand-rgb), .1); color: var(--ad-brand); }
.cls-qa-tag.a { background: #e8f6ec; color: #15803d; }
.cls-rev-sum { display: flex; gap: 28px; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--ad-line); flex-wrap: wrap; }
.cls-rev-big { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 110px; }
.cls-rev-big b { font-size: 2.6rem; line-height: 1; color: #b4690e; }
.cls-rev-big small { color: var(--ad-muted); font-weight: 600; }
.cls-rev-bars { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 7px; }
.cls-rev-bar { display: grid; grid-template-columns: 1fr auto 40px; align-items: center; gap: 10px; font-size: .85rem; color: var(--ad-muted); }
.cls-rev-bar .track { height: 8px; border-radius: 99px; background: rgba(var(--ad-brand-rgb), .1); overflow: hidden; }
.cls-rev-bar .track i { display: block; height: 100%; background: var(--ad-brand); border-radius: 99px; }
.cls-rev { display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px solid var(--ad-line); }
.cls-rev:last-of-type { border-bottom: 0; }
.cls-rev b { color: var(--ad-ink); }
.cls-rev p { margin: 6px 0 0; color: var(--ad-ink-2); white-space: pre-wrap; }
.cls-rev-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.cls-rev-meta small { color: var(--ad-muted); }
.cls-avatar { width: 42px; height: 42px; border-radius: 50%; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--ad-brand); color: #fff; font-weight: 800; font-size: .9rem; }

/* sidebar */
.cls-side { position: sticky; top: 80px; background: var(--ad-surface); border: 1px solid var(--ad-line); border-radius: 16px; overflow: hidden; }
.cls-side-tabs { display: flex; gap: 4px; padding: 0 16px; border-bottom: 1px solid var(--ad-line); }
.cls-side-tabs span { padding: 16px 12px 14px; font-weight: 700; font-size: .98rem; color: var(--ad-ink); border-bottom: 3px solid var(--ad-brand); margin-bottom: -1px; display: inline-flex; align-items: center; gap: 7px; }
.cls-lockbar { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--ad-line); }
.cls-lockbar-ico { width: 32px; height: 32px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: rgba(var(--ad-brand-rgb), .08); color: var(--ad-brand); }
.cls-lockbar-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cls-lockbar-text b { font-size: .9rem; color: var(--ad-ink); }
.cls-lockbar-text small { font-size: .78rem; color: var(--ad-muted); line-height: 1.35; }
.cls-lockbar-msg.ok { color: #15803d; font-weight: 600; }
.cls-lockbar-msg.err { color: #b91c1c; font-weight: 600; }
.cls-switch { flex: none; position: relative; width: 44px; height: 24px; border-radius: 999px; border: 0; padding: 0; background: #cbd5e1; cursor: pointer; transition: background .2s; }
.cls-switch span { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(15, 23, 42, .25); transition: transform .2s; }
.cls-switch.on { background: var(--ad-brand); }
.cls-switch.on span { transform: translateX(20px); }
.cls-switch:disabled { opacity: .6; cursor: wait; }
.cls-side-sum { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--ad-line); font-size: .92rem; color: var(--ad-ink-2); font-weight: 600; }
.cls-side-tools { padding: 12px 18px; border-bottom: 1px solid var(--ad-line); display: flex; flex-direction: column; gap: 10px; }
.cls-search { display: flex; align-items: center; gap: 8px; margin: 0; padding: 0 12px; height: 38px; border-radius: 10px; border: 1px solid var(--ad-line); background: var(--ad-bg); color: var(--ad-muted); }
.cls-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ad-ink); font-size: .9rem; }
.cls-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.cls-chips button { border: 1px solid var(--ad-line); background: var(--ad-surface); color: var(--ad-ink-2); border-radius: 999px; padding: 4px 12px; font-size: .82rem; font-weight: 600; }
.cls-chips button.on { background: var(--ad-brand); border-color: var(--ad-brand); color: #fff; }
.cls-sections { max-height: calc(100vh - 330px); min-height: 200px; overflow-y: auto; padding: 4px 0; }
/* sidebar empty states: no classes yet / nothing matches */
.cls-side-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 44px 28px 48px; }
.cls-side-empty.small { padding: 32px 24px 36px; }
.cls-side-empty-ico { width: 58px; height: 58px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: rgba(var(--ad-brand-rgb), .08); color: var(--ad-brand); margin-bottom: 4px; }
.cls-side-empty.small .cls-side-empty-ico { width: 48px; height: 48px; }
.cls-side-empty b { color: var(--ad-ink); font-size: 1.02rem; }
.cls-side-empty p { margin: 0; color: var(--ad-muted); font-size: .88rem; line-height: 1.5; max-width: 260px; }
.cls-side-empty .cls-btn-outline { margin-top: 6px; background: none; }
.cls-sec { border-bottom: 1px solid var(--ad-line); }
.cls-sec:last-child { border-bottom: 0; }
.cls-sec-head { width: 100%; display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: none; border: 0; text-align: left; }
.cls-sec-head:hover { background: rgba(var(--ad-brand-rgb), .04); }
.cls-sec-no { width: 34px; height: 34px; border-radius: 50%; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--ad-bg); border: 1px solid var(--ad-line); color: var(--ad-ink); font-weight: 700; font-size: .9rem; }
.cls-sec-text { flex: 1; min-width: 0; }
.cls-sec-text b { display: block; color: var(--ad-ink); font-size: .98rem; }
.cls-sec-text small { color: var(--ad-muted); font-size: .84rem; }
.cls-sec-car { color: var(--ad-ink-2); transition: transform .2s; flex: none; }
.cls-sec.open .cls-sec-car { transform: rotate(180deg); }
/* indented so the rows sit under the month's title (18px padding + 34px number + 14px gap - 12px row padding) */
.cls-sec-rows { padding: 0 8px 8px 54px; }
@media (max-width: 640px) { .cls-sec-rows { padding-left: 30px; } }
.cls-item { width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 10px 12px; border: 0; border-radius: 10px; background: none; position: relative; }
.cls-item:hover { background: rgba(var(--ad-brand-rgb), .05); }
.cls-item.sel { background: rgba(var(--ad-brand-rgb), .1); }
.cls-item.sel::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 3px; background: var(--ad-brand); }
.cls-item-ico { margin-top: 1px; color: var(--ad-muted); flex: none; }
.cls-item.completed .cls-item-ico { color: var(--ad-brand); }
.cls-item.live .cls-item-ico { color: #dc2626; }
.cls-item.cancelled .cls-item-text b { text-decoration: line-through; color: var(--ad-muted); }
.cls-item-text { min-width: 0; }
.cls-item-text b { display: block; color: var(--ad-ink); font-size: .9rem; font-weight: 600; line-height: 1.35; }
.cls-item-text small { color: var(--ad-muted); font-size: .8rem; }
.cls-item .tag { font-style: normal; margin-left: 6px; padding: 1px 7px; border-radius: 99px; font-size: .7rem; font-weight: 700; background: var(--ad-bg); border: 1px solid var(--ad-line); color: var(--ad-muted); }
.cls-item .tag.live { background: #fee2e2; border-color: #fecaca; color: #b91c1c; }
.cls-item .tag.rec { background: rgba(var(--ad-brand-rgb), .08); border-color: rgba(var(--ad-brand-rgb), .18); color: var(--ad-brand); }
.cls-item .tag.seen { background: #dcfce7; border-color: #bbf7d0; color: #15803d; }
.cls-item .tag.pct { background: #fef9c3; border-color: #fde68a; color: #a16207; }
.cls-item-lock { margin-left: auto; align-self: center; flex: none; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #f1f5f9; color: #64748b; }
.cls-item.locked .cls-item-ico { color: #94a3b8; }
.cls-item.locked .cls-item-text b { color: var(--ad-muted); }
.cls-item .cls-seen-ico { color: #16a34a; }
.cls-goto-prev { margin-top: 6px; padding: 7px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,.3); background: rgba(255,255,255,.12); color: #fff; font-size: .86rem; font-weight: 600; cursor: pointer; }
.cls-goto-prev:hover { background: rgba(255,255,255,.22); }
/* students: ask a question / review the course */
.cls-compose { margin: 14px 0 4px; padding: 14px 16px; border: 1px solid var(--ad-line); border-radius: 12px; background: var(--ad-bg); display: flex; flex-direction: column; gap: 10px; }
.cls-compose label { margin: 0; font-weight: 700; color: var(--ad-ink); font-size: .95rem; }
.cls-compose label b { color: var(--ad-brand); }
.cls-compose textarea { border-radius: 10px; font-size: .92rem; resize: vertical; }
.cls-compose-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: .85rem; }
.cls-compose-foot .ok { color: #15803d; font-weight: 600; }
.cls-compose-foot .err { color: #b91c1c; font-weight: 600; }
.cls-btn:disabled { opacity: .55; }
.cls-star-pick { display: flex; gap: 4px; }
.cls-star-pick button { background: none; border: 0; padding: 2px; color: #d6d3e0; }
.cls-star-pick button svg { fill: currentColor; }
.cls-star-pick button.on { color: #e59819; }
.cls-closed { margin: 14px 0 4px; padding: 12px 16px; border-radius: 12px; background: var(--ad-accent-soft); color: var(--ad-ink-2); font-size: .9rem; font-weight: 600; }
.cls-batch-tag { display: inline-block; margin-left: 10px; padding: 1px 10px; border-radius: 999px; font-size: .75rem; font-weight: 700; background: #eff6ff; color: #2563eb; vertical-align: 1px; }
.cls-batch-tag.done { background: rgba(var(--ad-brand-rgb), .1); color: var(--ad-brand); }


@media (max-width: 1100px) {
  .cls-grid { grid-template-columns: minmax(0, 1fr); }
  .cls-side { position: static; }
  .cls-sections { max-height: none; }
}
@media (max-width: 640px) {
  .cls-page { padding: 16px 14px 32px; }
  .cls-head-pick { width: 100%; }
  .cls-head-pick .form-select { min-width: 0; flex: 1 1 calc(100% - 50px); }
  .cls-head-pick .form-select:first-child { flex-basis: 100%; }
  .cls-title { font-size: 1.4rem; }
  .cls-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 12px; }
  .cls-stats > div { padding: 0; border-left: 0; }
  .cls-next { flex-wrap: wrap; gap: 12px; padding: 16px; }
  .cls-next-ico { width: 44px; height: 44px; }
  .cls-next-body { flex: 1 1 calc(100% - 60px); }
  .cls-next-act { width: 100%; }
  .cls-info { padding: 4px 16px 8px; }
  .cls-info-grid { grid-template-columns: 1fr; }
  .cls-info-grid > div + div { border-left: 0; padding-left: 0; }
  .cls-kv, .cls-row { grid-template-columns: 22px 100px 1fr; }
  .cls-count div { min-width: 58px; }
  .cls-count b { font-size: 1.3rem; }
}
`;
