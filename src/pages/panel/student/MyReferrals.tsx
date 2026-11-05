import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getSeoByPath } from "../../../utils/seo";
import {
  UserPlus,
  Users,
  UserCheck,
  Hourglass,
  Send,
  RotateCw,
  BookOpen,
  Layers,
  Mail,
  Phone,
  Search,
  Info,
  Check,
  Link2,
  Copy,
  X,
  MessageCircle,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import { OPEN_REFER, REFER_ADDED } from "../../../utils/referEvents";
import { SkeletonList } from "../../../components/loading";

/* Student → My Referrals: the friends this student referred (the "Refer a
   Friend" form in the menu) and how far each one got — an enrolment request on
   the website, a student account, and the courses / batches they joined.
   API: api/admin/referredfriends/referredfriends.js (/student/my-referrals) */

const seo = getSeoByPath("");

type Enrolled = {
  course_name: string;
  batch_name: string;
  batch_sdate: string;
  batch_edate: string;
  enrolled_at: number | null;
  referred_course: boolean;
};

type Referral = {
  id: number;
  name: string;
  email: string;
  phone: string;
  course_name: string;
  referred_at: number | null;
  status: "joined" | "applied" | "waiting";
  already_member: boolean;
  joined_at: number | null;
  joined_course: boolean;
  courses: Enrolled[];
  request: { at: number | null; course_name: string; approved: boolean } | null;
};

type Stats = { total: number; joined: number; applied: number; waiting: number };
type Filter = "all" | Referral["status"];

function decodeHtml(str: any) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str ?? "";
  return txt.value;
}

const fmtDate = (v: any) => {
  if (!v) return "";
  const s = String(v);
  const d = /^\d{9,10}$/.test(s) ? new Date(Number(s) * 1000) : new Date(s);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const STATUS: Record<Referral["status"], { label: string; cls: string }> = {
  joined: { label: "Joined", cls: "rf-pill-joined" },
  applied: { label: "Applied", cls: "rf-pill-applied" },
  waiting: { label: "Not joined yet", cls: "rf-pill-waiting" },
};

export default function MyReferrals() {
  const navigate = useNavigate();
  const [list, setList] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, joined: 0, applied: 0, waiting: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const load = async (fresh = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await listFetch("api/student/my-referrals", {}, { fresh });
      if (res.data.success) {
        setList(res.data.data || []);
        setStats(res.data.stats || { total: 0, joined: 0, applied: 0, waiting: 0 });
      } else setError(res.data.message || "Could not load your referrals");
    } catch {
      setError("Could not load your referrals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const res = await axios.get(SERVER_URL + "api/check-login", { withCredentials: true });
      if (res.data.loggedIn && res.data.id === "1") load();
      else navigate("/logout");
    })();
    // a referral sent from the menu's form shows here straight away
    const added = () => load(true);
    window.addEventListener(REFER_ADDED, added);
    return () => window.removeEventListener(REFER_ADDED, added);
  }, []);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!term ||
          [r.name, r.email, r.phone, r.course_name].some((v) =>
            decodeHtml(v).toLowerCase().includes(term),
          )),
    );
  }, [list, filter, search]);

  const openRefer = () => window.dispatchEvent(new Event(OPEN_REFER));

  // The student's referral link: /enroll?r=<code> (api/shared/referral-link.js).
  // Friends who enroll through it are added to these referrals automatically.
  const [shareOpen, setShareOpen] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);
  const refLink = refCode ? `${window.location.origin}/enroll?r=${refCode}` : "";
  const shareText = refLink
    ? `Join me at Rivira Technologies and learn AI & Generative AI. Enroll here: ${refLink}`
    : "";
  const openShare = async () => {
    setShareOpen(true);
    setCopied(false);
    if (refCode) return;
    setShareError("");
    try {
      const sec = (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data || {};
      const r = await axios.post(
        SERVER_URL + "api/student/referral-code",
        { key: sec.key, token: sec.token, aut: sec.aut },
        { withCredentials: true },
      );
      if (r.data?.success && r.data.code) setRefCode(String(r.data.code));
      else setShareError(r.data?.message || "Couldn't make your link, please try again.");
    } catch {
      setShareError("Couldn't make your link, please try again.");
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
    } catch {
      // older browsers / no permission: select the text and copy it the old way
      const el = document.getElementById("rf-share-link") as HTMLInputElement | null;
      el?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShareOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen]);

  const STAT_CARDS: { key: Filter; label: string; value: number; icon: any; cls: string }[] = [
    { key: "all", label: "Friends referred", value: stats.total, icon: Users, cls: "rf-st-total" },
    { key: "joined", label: "Joined", value: stats.joined, icon: UserCheck, cls: "rf-st-joined" },
    { key: "applied", label: "Applied", value: stats.applied, icon: Send, cls: "rf-st-applied" },
    { key: "waiting", label: "Not joined yet", value: stats.waiting, icon: Hourglass, cls: "rf-st-waiting" },
  ];

  return (
    <>
      <Head
        pageTitle={seo.title || "My Referrals - Student Portal"}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <style>{`
        .rf-page { background:#f8fafc; min-height:calc(100vh - 80px); padding:24px 28px; }
        @media (max-width:560px) { .rf-page { padding:16px; } }
        .rf-head { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:20px; }
        .rf-head-left { display:flex; align-items:center; gap:14px; }
        .rf-head-icon { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#7c3aed,#5b21b6); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(91,33,182,.25); }
        .rf-title { font-size:22px; font-weight:700; color:#0f172a; margin:0; }
        .rf-sub { font-size:13.5px; color:#64748b; margin:3px 0 0; }
        .rf-head-actions { display:flex; align-items:center; gap:10px; }
        .rf-btn { display:inline-flex; align-items:center; gap:8px; border:0; border-radius:10px; padding:10px 16px; font-size:14px; font-weight:700; color:#fff; background:linear-gradient(135deg,#7c3aed,#5b21b6); box-shadow:0 6px 16px rgba(91,33,182,.25); cursor:pointer; }
        .rf-btn:hover { filter:brightness(1.06); }
        .rf-btn-ghost { display:inline-flex; align-items:center; gap:8px; border:1.5px solid #ddd6fe; border-radius:10px; padding:9px 15px; font-size:14px; font-weight:700; color:#5b21b6; background:#fff; cursor:pointer; }
        .rf-btn-ghost:hover { background:#f5f3ff; }
        .rf-share-overlay { position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px; animation:modal-fade-in .2s ease both; }
        .rf-share { width:100%; max-width:520px; background:#fff; border-radius:16px; padding:22px 22px 18px; box-shadow:0 25px 50px -12px rgba(15,23,42,.35); animation:modal-pop-in .26s cubic-bezier(.2,.8,.3,1) backwards; }
        .rf-share-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
        .rf-share-head h4 { flex:1; margin:0; font-size:18px; font-weight:800; color:#1e293b; }
        .rf-share-ico { width:40px; height:40px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; color:#5b21b6; background:#f5f3ff; }
        .rf-share-x { width:34px; height:34px; border:0; border-radius:50%; background:#f1f5f9; color:#475569; display:inline-flex; align-items:center; justify-content:center; }
        .rf-share-x:hover { background:#e2e8f0; }
        .rf-share-row { display:flex; gap:8px; }
        .rf-share-row input { flex:1; min-width:0; border:1.5px solid #e2e8f0; border-radius:10px; padding:10px 12px; font-size:14px; color:#1e293b; background:#f8fafc; }
        .rf-share-apps { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; }
        .rf-share-app { flex:1; min-width:140px; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 14px; border-radius:10px; font-size:14px; font-weight:700; text-decoration:none; }
        .rf-share-app.wa { color:#fff; background:#25d366; }
        .rf-share-app.wa:hover { background:#1ebe5b; color:#fff; }
        .rf-share-app.mail { color:#334155; background:#f1f5f9; }
        .rf-share-app.mail:hover { background:#e2e8f0; color:#1e293b; }
        .rf-share-note { display:flex; align-items:flex-start; gap:6px; margin:14px 0 0; font-size:12.5px; color:#64748b; }
        .rf-share-note svg { flex:none; margin-top:2px; }
        .rf-share-err { margin:0; padding:10px 12px; border-radius:10px; background:#fef2f2; color:#b91c1c; font-size:13.5px; }
        @media (max-width:575px) { .rf-head-actions { flex-wrap:wrap; } }

        .rf-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:18px; }
        @media (max-width:900px) { .rf-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        .rf-stat { background:#fff; border:1px solid #eef2f6; border-radius:16px; padding:16px; display:flex; align-items:center; gap:12px; text-align:left; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.03); transition:border-color .15s, box-shadow .15s; width:100%; }
        .rf-stat:hover { border-color:#cbd5e1; }
        .rf-stat.active { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.12); }
        .rf-stat-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .rf-st-total .rf-stat-icon { background:#ede9fe; color:#6d28d9; }
        .rf-st-joined .rf-stat-icon { background:#dcfce7; color:#15803d; }
        .rf-st-applied .rf-stat-icon { background:#e0f2fe; color:#0369a1; }
        .rf-st-waiting .rf-stat-icon { background:#fef3c7; color:#b45309; }
        .rf-stat-val { font-size:22px; font-weight:800; color:#0f172a; line-height:1.1; }
        .rf-stat-label { font-size:12.5px; color:#64748b; font-weight:600; }

        .rf-tools { display:flex; gap:10px; margin-bottom:16px; }
        .rf-search { position:relative; flex:1; max-width:380px; }
        .rf-search svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; }
        .rf-search input { width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px 10px 36px; font-size:14px; background:#fff; color:#0f172a; }
        .rf-search input:focus { outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.12); }

        .rf-card { background:#fff; border:1px solid #eef2f6; border-radius:18px; padding:20px 22px; box-shadow:0 1px 3px rgba(0,0,0,.03); margin-bottom:14px; }
        .rf-card-top { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start; }
        .rf-name { font-size:17px; font-weight:700; color:#0f172a; margin:0 0 6px; }
        .rf-contact { display:flex; gap:16px; flex-wrap:wrap; font-size:13px; color:#475569; }
        .rf-contact span { display:inline-flex; align-items:center; gap:6px; word-break:break-all; }
        .rf-pill { font-size:12px; font-weight:700; border-radius:20px; padding:5px 12px; white-space:nowrap; }
        .rf-pill-joined { background:#dcfce7; color:#15803d; }
        .rf-pill-applied { background:#e0f2fe; color:#0369a1; }
        .rf-pill-waiting { background:#fef3c7; color:#b45309; }
        .rf-meta { display:flex; gap:8px 18px; flex-wrap:wrap; font-size:13px; color:#475569; margin:12px 0 0; }
        .rf-meta b { color:#0f172a; font-weight:600; }

        .rf-steps { list-style:none; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:0; margin:18px 0 0; padding:0; }
        .rf-step { position:relative; padding-top:30px; text-align:center; font-size:12.5px; color:#94a3b8; }
        .rf-step::before { content:""; position:absolute; top:11px; left:0; right:0; height:3px; background:#e2e8f0; }
        .rf-step:first-child::before { left:50%; }
        .rf-step:last-child::before { right:50%; }
        .rf-step.done::before { background:#22c55e; }
        .rf-step.done + .rf-step:not(.done)::before { background:linear-gradient(90deg,#22c55e 50%,#e2e8f0 50%); }
        .rf-dot { position:absolute; top:0; left:50%; transform:translateX(-50%); width:25px; height:25px; border-radius:50%; background:#fff; border:3px solid #e2e8f0; display:flex; align-items:center; justify-content:center; z-index:1; }
        .rf-step.done .rf-dot { background:#22c55e; border-color:#22c55e; color:#fff; }
        .rf-step-label { font-weight:700; color:#64748b; display:block; }
        .rf-step.done .rf-step-label { color:#0f172a; }
        .rf-step-date { display:block; margin-top:2px; }


        .rf-step:first-child{
        text-align: left;
        }
        .rf-step:first-child::before {
  left: 20px;
}
        .rf-step:first-child .rf-dot{
        left: 23px;
        }

                .rf-step:last-child{
        text-align: right;
        }
        .rf-step:last-child::before {
  right: 20px;
}
.rf-step:last-child .rf-dot {
  right: 0;
  left: initial;
}

        .rf-note { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:#64748b; margin:14px 0 0; }
        .rf-courses { margin:16px 0 0; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
        .rf-courses-head { background:#f8fafc; padding:9px 14px; font-size:12px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:#475569; }
        .rf-course { display:flex; justify-content:space-between; gap:10px 16px; flex-wrap:wrap; padding:12px 14px; border-top:1px solid #f1f5f9; font-size:13.5px; }
        .rf-course-name { font-weight:700; color:#0f172a; display:flex; align-items:center; gap:7px; }
        .rf-course-batch { color:#475569; display:flex; align-items:center; gap:7px; margin-top:3px; font-size:13px; }
        .rf-course-side { text-align:right; font-size:12.5px; color:#64748b; }
        .rf-tag { display:inline-block; font-size:11px; font-weight:700; color:#6d28d9; background:#ede9fe; border-radius:20px; padding:2px 9px; margin-left:6px; }
        @media (max-width:560px) { .rf-course-side { text-align:left; } .rf-steps { font-size:11.5px; } }

        .rf-empty { background:#fff; border:1px dashed #cbd5e1; border-radius:16px; padding:44px 20px; text-align:center; color:#64748b; font-size:14px; margin-bottom:18px; }
        .rf-empty h4 { font-size:18px; font-weight:700; color:#0f172a; margin:12px 0 6px; }
        .rf-empty p { margin:0 auto 16px; max-width:460px; }
        .rf-how { background:#fff; border:1px solid #eef2f6; border-radius:18px; padding:20px 22px; margin-top:18px; }
        .rf-how h3 { font-size:16px; font-weight:700; color:#0f172a; margin:0 0 10px; display:flex; align-items:center; gap:8px; }
        .rf-how ol { margin:0; padding-left:20px; color:#475569; font-size:13.5px; line-height:1.8; }
      `}</style>

      {shareOpen &&
        createPortal(
          <div className="rf-share-overlay" onClick={() => setShareOpen(false)}>
            <div
              className="rf-share"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rf-share-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rf-share-head">
                <span className="rf-share-ico">
                  <Link2 size={20} />
                </span>
                <h4 id="rf-share-title">Share your referral link</h4>
                <button type="button" className="rf-share-x" aria-label="Close" onClick={() => setShareOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              {shareError ? (
                <p className="rf-share-err">{shareError}</p>
              ) : !refLink ? (
                <p className="rf-share-note">Getting your link…</p>
              ) : (
                <>
                  <div className="rf-share-row">
                    <input id="rf-share-link" readOnly value={refLink} onFocus={(e) => e.currentTarget.select()} />
                    <button type="button" className="rf-btn" onClick={copyLink}>
                      {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="rf-share-apps">
                    <a
                      className="rf-share-app wa"
                      href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle size={17} /> WhatsApp
                    </a>
                    <a
                      className="rf-share-app mail"
                      href={`mailto:?subject=${encodeURIComponent("Join me at Rivira Technologies")}&body=${encodeURIComponent(shareText)}`}
                    >
                      <Mail size={17} /> Email
                    </a>
                  </div>
                </>
              )}
              <p className="rf-share-note">
                <Info size={14} /> Friends who enroll through this link are added to your referrals automatically.
              </p>
            </div>
          </div>,
          document.body,
        )}

      <div className="content">
        <div className="container-fluid rf-page">
          <div className="rf-head">
            <div className="rf-head-left">
              <div className="rf-head-icon">
                <Users size={24} />
              </div>
              <div>
                <h3 className="rf-title">My Referrals</h3>
                <p className="rf-sub">The friends you referred, and whether they have joined.</p>
              </div>
            </div>
            <div className="rf-head-actions">
              <button type="button" className="rf-btn-ghost" onClick={openShare}>
                <Link2 size={17} /> Share referral link
              </button>
              <button type="button" className="rf-btn" onClick={openRefer}>
                <UserPlus size={17} /> Refer a Friend
              </button>
              <button
                data-refresh
                className="reload-btn"
                title="Reload"
                onClick={() => load(true)}
                disabled={loading}
              >
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          {loading ? (
            <SkeletonList rows={4} />
          ) : error ? (
            <div className="rf-empty">{error}</div>
          ) : list.length === 0 ? (
            <div className="rf-empty">
              <Users size={36} color="#7c3aed" />
              <h4>No referrals yet</h4>
              <p>
                Know someone who would like to learn with Rivira Technologies? Refer them, and you can follow
                here when they apply and join.
              </p>
              <button type="button" className="rf-btn" onClick={openRefer}>
                <UserPlus size={17} /> Refer a Friend
              </button>
            </div>
          ) : (
            <>
              <div className="rf-stats">
                {STAT_CARDS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`rf-stat ${c.cls} ${filter === c.key ? "active" : ""}`}
                    onClick={() => setFilter(filter === c.key ? "all" : c.key)}
                    title={c.key === "all" ? "Show all" : `Show only: ${c.label}`}
                    aria-pressed={filter === c.key}
                  >
                    <span className="rf-stat-icon">
                      <c.icon size={20} />
                    </span>
                    <span>
                      <span className="rf-stat-val d-block">{c.value}</span>
                      <span className="rf-stat-label">{c.label}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="rf-tools">
                <label className="rf-search">
                  <Search size={16} />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, phone or course"
                    aria-label="Search your referrals"
                  />
                </label>
              </div>

              {shown.length === 0 ? (
                <div className="rf-empty">No referrals match this filter.</div>
              ) : (
                shown.map((r) => {
                  const st = STATUS[r.status];
                  const applied = r.status !== "waiting";
                  const joined = r.status === "joined";
                  return (
                    <div key={r.id} className="rf-card">
                      <div className="rf-card-top">
                        <div>
                          <h4 className="rf-name">{decodeHtml(r.name)}</h4>
                          <div className="rf-contact">
                            {r.email && (
                              <span>
                                <Mail size={14} /> {r.email}
                              </span>
                            )}
                            {r.phone && (
                              <span>
                                <Phone size={14} /> {r.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`rf-pill ${st.cls}`}>{st.label}</span>
                      </div>

                      <div className="rf-meta">
                        <span>
                          Referred for: <b>{decodeHtml(r.course_name) || "—"}</b>
                        </span>
                        {r.referred_at && (
                          <span>
                            Referred on: <b>{fmtDate(r.referred_at)}</b>
                          </span>
                        )}
                      </div>

                      {/* Referred → Applied → Joined */}
                      <ol className="rf-steps">
                        <li className="rf-step done">
                          <span className="rf-dot">
                            <Check size={13} strokeWidth={3} />
                          </span>
                          <span className="rf-step-label">Referred</span>
                          <span className="rf-step-date">{fmtDate(r.referred_at)}</span>
                        </li>
                        <li className={`rf-step ${applied ? "done" : ""}`}>
                          <span className="rf-dot">
                            {applied && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className="rf-step-label">Applied</span>
                          <span className="rf-step-date">
                            {r.request?.at
                              ? fmtDate(r.request.at)
                              : joined
                                ? "Done"
                                : "Waiting"}
                          </span>
                        </li>
                        <li className={`rf-step ${joined ? "done" : ""}`}>
                          <span className="rf-dot">
                            {joined && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className="rf-step-label">Joined</span>
                          <span className="rf-step-date">
                            {joined ? fmtDate(r.joined_at) || "Done" : "Waiting"}
                          </span>
                        </li>
                      </ol>

                      {r.request && (
                        <p className="rf-note">
                          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>
                            {decodeHtml(r.name)} sent an enrolment request
                            {r.request.course_name
                              ? ` for ${decodeHtml(r.request.course_name)}`
                              : ""}
                            {r.request.approved
                              ? ". It has been approved; their student account is being set up."
                              : ". Our team is reviewing it."}
                          </span>
                        </p>
                      )}

                      {r.already_member && (
                        <p className="rf-note">
                          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>They already had a student account when you referred them.</span>
                        </p>
                      )}

                      {joined &&
                        (r.courses.length > 0 ? (
                          <div className="rf-courses">
                            <div className="rf-courses-head">Courses & batches joined</div>
                            {r.courses.map((c, i) => (
                              <div key={i} className="rf-course">
                                <div>
                                  <div className="rf-course-name">
                                    <BookOpen size={15} /> {decodeHtml(c.course_name) || "Course"}
                                    {c.referred_course && (
                                      <span className="rf-tag">Your referral</span>
                                    )}
                                  </div>
                                  {c.batch_name && (
                                    <div className="rf-course-batch">
                                      <Layers size={14} /> {decodeHtml(c.batch_name)}
                                    </div>
                                  )}
                                </div>
                                <div className="rf-course-side">
                                  {(c.batch_sdate || c.batch_edate) && (
                                    <div>
                                      {fmtDate(c.batch_sdate) || "—"} → {fmtDate(c.batch_edate) || "—"}
                                    </div>
                                  )}
                                  {c.enrolled_at && <div>Enrolled {fmtDate(c.enrolled_at)}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rf-note">
                            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>
                              Their account is ready; they haven't been added to a batch yet.
                            </span>
                          </p>
                        ))}
                    </div>
                  );
                })
              )}
            </>
          )}

          <div className="rf-how">
            <h3>
              <Info size={17} /> How referrals are tracked
            </h3>
            <ol>
              <li>Refer a friend with their name, email and contact number.</li>
              <li>
                When they send an enrolment request with the same email or number, the referral shows{" "}
                <b>Applied</b>.
              </li>
              <li>
                Once their student account is created it shows <b>Joined</b>, with the course and
                batch they are in.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
