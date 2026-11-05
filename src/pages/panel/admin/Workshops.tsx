import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  GraduationCap,
  Plus,
  RotateCw,
  Sparkles,
  Clock,
  Trash2,
  Edit2,
  Upload,
  Calendar,
  Eye,
  Copy,
  Users,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import { bootcampDates } from "../../../utils/dateRange";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

/**
 * Panel → Workshop. Edits the featured bootcamp panel on the public /workshop
 * page.
 *
 * The page LAYOUT is fixed in src/pages/website/Workshop.tsx — this screen only
 * changes the copy inside it. The form is grouped in the same order the panel
 * renders (badge → title → chips → buttons → three cards) and the preview below
 * mirrors the real thing, so what you type is what the site shows.
 *
 * Workflow for the next bootcamp: Add → fill it in (it saves as a DRAFT, the
 * site is untouched) → Publish when ready. Publishing retires the previous one
 * automatically; exactly one bootcamp is ever live.
 */

const BLANK = {
  badge: "Upcoming bootcamp",
  title: "",
  cadence: "",
  times: "",
  duration: "",
  zoom_label: "Reserve your free Zoom seat",
  zoom_url: "",
  whatsapp_label: "Join the WhatsApp community",
  whatsapp_url: "",
  learn_items: "",
  mentor: "",
  teach_tags: "",
  join_text: "",
  join_tags: "",
  // "YYYY-MM-DDTHH:mm" in this browser's time (datetime-local); sent as Unix seconds
  start_at: "",
  expire_at: "",
};

type Form = typeof BLANK;

/* start_at / expire_at: Unix seconds in the API, datetime-local in the form */
const toInput = (sec: any) => {
  const n = Number(sec);
  if (!n) return "";
  const d = new Date(n * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toSeconds = (v: string) => {
  if (!v) return "";
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : "";
};
const fmtWhen = (sec: any) =>
  Number(sec)
    ? new Date(Number(sec) * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

/** Where a bootcamp is in time: "expired" / "upcoming" (not started) / "running" / "" (no dates). */
const timing = (item: any): "expired" | "upcoming" | "running" | "" => {
  const now = Date.now() / 1000;
  if (Number(item.expire_at) && Number(item.expire_at) <= now) return "expired";
  if (Number(item.start_at) && Number(item.start_at) > now) return "upcoming";
  if (Number(item.start_at)) return "running";
  return "";
};

const splitTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
const splitLines = (s: string) => s.split("\n").map((t) => t.trim()).filter(Boolean);

/** Mirrors the dark featured panel on /workshop so edits can be checked here. */
function Preview({ f }: { f: Form }) {
  // the website's date chip: "November 2 – December 2, 2026" from the start / expiry
  const chips = [bootcampDates(toSeconds(f.start_at), toSeconds(f.expire_at)), f.cadence, f.times, f.duration && `${f.duration} live`].filter(Boolean);
  return (
    <div
      style={{
        background: "linear-gradient(160deg,#0B1220 0%,#132038 100%)",
        borderRadius: 16,
        padding: "26px 22px",
        color: "#fff",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            display: "inline-block", background: "#E0A82E", color: "#1B1200",
            fontWeight: 700, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
            padding: "9px 22px", borderRadius: 999,
          }}
        >
          {f.badge || "Upcoming bootcamp"}
        </span>
      </div>

      {/* Colour is set explicitly, not inherited: the panel stylesheet gives
          every h1–h6 a dark ink colour, which is invisible on this navy card. */}
      <h4 style={{ fontWeight: 800, margin: "18px 0 0", fontSize: 26, color: "#fff" }}>
        {f.title || <span style={{ opacity: 0.45 }}>Bootcamp title…</span>}
      </h4>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {chips.map((c) => (
          <span
            key={c}
            style={{
              border: "1px solid rgba(255,255,255,.18)", borderRadius: 999,
              padding: "7px 15px", fontSize: 13, color: "#E7EDF6",
            }}
          >
            {c}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
        {f.zoom_label && (
          <span style={{ background: "#D9A227", color: "#1B1200", fontWeight: 700, borderRadius: 999, padding: "11px 20px", fontSize: 14 }}>
            {f.zoom_label} →
          </span>
        )}
        {f.whatsapp_label && (
          <span style={{ background: "#E8BE5A", color: "#1B1200", fontWeight: 700, borderRadius: 999, padding: "11px 20px", fontSize: 14 }}>
            {f.whatsapp_label} →
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginTop: 22 }}>
        <div style={{ background: "#fff", color: "#1F2937", borderRadius: 12, padding: 16 }}>
          <h6 style={{ fontWeight: 700 }}>What you'll learn</h6>
          {splitLines(f.learn_items).map((l) => (
            <div key={l} style={{ fontSize: 13, marginTop: 6 }}>
              <span style={{ color: "#059669", fontWeight: 700 }}>✓</span> {l}
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", color: "#1F2937", borderRadius: 12, padding: 16 }}>
          <h6 style={{ fontWeight: 700 }}>Who's teaching</h6>
          <div style={{ fontSize: 13, marginTop: 6 }}>{f.mentor && `${f.mentor}.`}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {splitTags(f.teach_tags).map((t) => (
              <span key={t} style={{ background: "#EEF2F7", borderRadius: 8, padding: "4px 9px", fontSize: 12 }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", color: "#1F2937", borderRadius: 12, padding: 16 }}>
          <h6 style={{ fontWeight: 700 }}>How to join</h6>
          <div style={{ fontSize: 13, marginTop: 6 }}>{f.join_text}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {splitTags(f.join_tags).map((t) => (
              <span key={t} style={{ background: "#EEF2F7", borderRadius: 8, padding: "4px 9px", fontSize: 12 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Workshop() {
  const permCan = usePagePerm("workshops");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [form, setForm] = useState<Form>(BLANK);

  const set = (k: keyof Form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const getSecurity = async () =>
    (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/workshop-list", {});
      if (res.data.success) setList(res.data.data);
      else toast.error(res.data.message || "Failed to load");
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm(BLANK); setModalOpen(true); };

  const openEdit = (item: any) => {
    setEditing(item);
    // Fall back to BLANK per key so a column added later can't render `undefined`
    // into a controlled input (React then warns and the field goes read-only).
    const next = { ...BLANK };
    (Object.keys(BLANK) as (keyof Form)[]).forEach((k) => {
      if (item[k] != null) next[k] = item[k];
    });
    next.start_at = toInput(item.start_at);
    next.expire_at = toInput(item.expire_at);
    setForm(next);
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  // the page behind the popup doesn't scroll while it is open
  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [modalOpen]);

  const save = async (e: any) => {
    e.preventDefault();
    if (form.title.trim().length < 2) return toast.error("Please enter the bootcamp title");
    const startSec = toSeconds(form.start_at);
    const expireSec = toSeconds(form.expire_at);
    if (startSec && expireSec && expireSec <= startSec) return toast.error("The expiry must be after the start");
    setSaving(true);
    try {
      const s = await getSecurity();
      const path = editing ? "api/workshop-update" : "api/workshop-add";
      const payload: any = { ...form, start_at: startSec, expire_at: expireSec, key: s.key, token: s.token, aut: s.aut };
      if (editing) payload.id = editing.id;
      const res = await axios.post(SERVER_URL + path, payload, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        if (editing) setList((prev) => prev.map((x) => (x.id === editing.id ? res.data.data : x)));
        else setList((prev) => [...prev, res.data.data]);
        closeModal();
      } else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const publish = async (item: any) => {
    if (item.status === "1") return;
    if (!window.confirm(`Publish "${item.title}" to the website? The current one will be retired.`)) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/workshop-activate",
        { id: item.id, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      // The server returns the whole list so the retired row flips here too.
      if (res.data.success) { setList(res.data.data); toast.success(res.data.message); }
      else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  
  const unpublish = async (item: any) => {
    if (item.status === "0") return;
    if (!window.confirm(`Unpublish "${item.title}" to the website? This will be retired.`)) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/workshop-deactivate",
        { id: item.id, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      // The server returns the whole list so the retired row flips here too.
      if (res.data.success) { setList(res.data.data); toast.success(res.data.message); }
      else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  const del = async (item: any) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/workshop-delete",
        { id: item.id, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) { setList((prev) => prev.filter((x) => x.id !== item.id)); toast.success(res.data.message); }
      else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  // a draft copy of the bootcamp, opened for editing straight away
  const duplicate = async (item: any) => {
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/workshop-duplicate",
        { id: item.id, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) {
        setList((prev) => [...prev, res.data.data]);
        toast.success(res.data.message);
        openEdit(res.data.data);
      } else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && (ustatus == "X" || ustatus == "Y")) {
      load();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();
  }, []);


  const totalCount = list.length;
  const liveCount = list.filter((x) => x.status === "1").length;
  const draftCount = list.filter((x) => x.status !== "1").length;
  const scheduledCount = list.filter((x) => Number(x.start_at) > 0).length;

  const displayedList = list.filter((item) => {
    if (statusFilter === "1" && item.status !== "1") return false;
    if (statusFilter === "0" && item.status === "1") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesTitle = (item.title || "").toLowerCase().includes(q);
      const matchesDates = fmtWhen(item.start_at).toLowerCase().includes(q);
      const matchesCadence = (item.cadence || "").toLowerCase().includes(q);
      if (!matchesTitle && !matchesDates && !matchesCadence) return false;
    }
    return true;
  });

  const live = list.find((x) => x.status === "1");

  return (
    <>
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="content">
        <style>{`
          .si-page-wrapper {
            background-color: #f8fafc;
            min-height: calc(100vh - 80px);
            padding: 24px 28px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          .si-header-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 22px;
            flex-wrap: wrap;
            gap: 16px;
          }
          .si-header-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .si-header-icon-box {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
          }
          .si-header-title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .si-count-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: #e0f2fe;
            color: #0369a1;
            font-size: 12px;
            font-weight: 700;
            border-radius: 20px;
          }
          .si-header-subtitle {
            font-size: 13px;
            color: #64748b;
            margin: 4px 0 0 0;
          }
          .si-header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }
          .si-btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 18px;
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff !important;
            font-size: 13.5px;
            font-weight: 600;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
            text-decoration: none;
          }
          .si-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(2, 132, 199, 0.3);
            color: #ffffff;
          }
          .si-stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }
          @media (max-width: 992px) {
            .si-stats-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (max-width: 576px) {
            .si-stats-grid {
              grid-template-columns: 1fr;
            }
          }
          .si-stat-card {
            background: #ffffff;
            border-radius: 14px;
            padding: 16px 20px;
            border: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            cursor: pointer;
            user-select: none;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          }
          .si-stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
          }
          .si-stat-card.active {
            box-shadow: 0 0 0 2px #0284c7, 0 6px 16px rgba(2, 132, 199, 0.15);
            border-color: #0284c7;
          }
          .si-stat-card.card-live.active {
            box-shadow: 0 0 0 2px #10b981, 0 6px 16px rgba(16, 185, 129, 0.15);
            border-color: #10b981;
          }
          .si-stat-card.card-draft.active {
            box-shadow: 0 0 0 2px #f59e0b, 0 6px 16px rgba(245, 158, 11, 0.15);
            border-color: #f59e0b;
          }
          .si-stat-label {
            font-size: 12.5px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .si-stat-value {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
          }
          .si-stat-icon-wrap {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .si-stat-purple { background: #f5f3ff; color: var(--ad-brand); }
          .si-stat-green  { background: #ecfdf5; color: #059669; }
          .si-stat-blue   { background: #eff6ff; color: #2563eb; }
          .si-stat-amber  { background: #fffbeb; color: #d97706; }

          .si-filter-bar {
            background: #ffffff;
            border-radius: 14px;
            padding: 14px 18px;
            border: 1px solid #e2e8f0;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
          }
          .si-filter-left {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }
          .si-select-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 4px 10px;
          }
          .si-select-label {
            font-size: 12.5px;
            font-weight: 600;
            color: #64748b;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .si-select {
            border: none;
            background: transparent;
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            outline: none;
            cursor: pointer;
          }
          .si-search-form {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            max-width: 360px;
          }
          .si-search-box {
            position: relative;
            width: 100%;
          }
          .si-search-input {
            width: 100%;
            padding: 8px 12px 8px 36px;
            font-size: 13px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            outline: none;
            transition: all 0.2s ease;
          }
          .si-search-input:focus {
            background: #ffffff;
            border-color: #0284c7;
            box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
          }
          .si-search-icon {
            position: absolute;
            left: 11px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }
          .si-reload-btn {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            color: #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
          }
          .si-reload-btn:hover {
            background: #e0f2fe;
            color: #0284c7;
            border-color: #bae6fd;
          }

          /* Modern Table Card */
          .si-table-card {
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            overflow: hidden;
          }
          .si-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
          }
          .si-table th {
            background: #f8fafc;
            padding: 14px 18px;
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #e2e8f0;
            white-space: nowrap;
          }
          .si-table td {
            padding: 16px 18px;
            font-size: 13.5px;
            color: #1e293b;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
          }
          .si-table tbody tr {
            transition: background-color 0.15s ease;
          }
          .si-table tbody tr:hover {
            background-color: #f8fafc;
          }
          .si-table tbody tr:last-child td {
            border-bottom: none;
          }
          .si-bootcamp-cell {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .si-bootcamp-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: #e0f2fe;
            color: #0284c7;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .si-bootcamp-title {
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 2px;
            display: block;
            font-size: 14px;
          }
          .si-bootcamp-sub {
            font-size: 12px;
            color: #64748b;
            display: block;
          }
          .si-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
          }
          .si-status-pill.si-status-live {
            background: #dcfce7;
            color: #15803d;
          }
          .si-status-pill.si-status-draft {
            background: #f1f5f9;
            color: #475569;
          }
          .si-status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: currentColor;
          }
          .si-action-btns {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
          }
          /* the popup is the screen's height: title bar and footer fixed, fields scroll
             (set here because on phones the dialog otherwise grows with its content) */
          .ws-modal .modal-dialog { height: calc(100vh - 2 * var(--bs-modal-margin, .5rem)); height: calc(100dvh - 2 * var(--bs-modal-margin, .5rem)); }
          .ws-modal .modal-content { max-height: 100%; overflow: hidden; }
          .ws-modal .modal-body { overflow-y: auto; overscroll-behavior: contain; }
          .ws-modal-footer { gap:8px; flex-wrap:wrap; }
          .ws-modal-footer small { flex:1 1 240px; }
          .si-when { display:flex; flex-direction:column; gap:2px; margin-top:5px; font-size:11.5px; color:#475569; }
          .si-time-pill { display:inline-block; margin-top:6px; font-size:11px; font-weight:700; border-radius:999px; padding:2px 9px; }
          .si-time-pill.upcoming { background:#e0f2fe; color:#0369a1; }
          .si-time-pill.running { background:#dcfce7; color:#15803d; }
          .si-time-pill.expired { background:#fee2e2; color:#b91c1c; }
          .si-action-btn.btn-dup:hover { background:#ede9fe; color:var(--ad-brand); border-color:#ddd6fe; }
          .si-action-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            color: #475569;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .si-action-btn:hover {
            background: #f1f5f9;
            color: #0f172a;
            border-color: #cbd5e1;
          }
          .si-action-btn.btn-pub:hover {
            background: #dcfce7;
            color: #15803d;
            border-color: #bbf7d0;
          }
          .si-action-btn.btn-unpub:hover {
            background: #fee2e2;
            color: #dc2626;
            border-color: #fecaca;
          }
          .si-action-btn.btn-edit:hover {
            background: #e0f2fe;
            color: #0284c7;
            border-color: #bae6fd;
          }
          .si-action-btn.btn-del:hover {
            background: #fee2e2;
            color: #dc2626;
            border-color: #fecaca;
          }
          .si-empty-box {
            text-align: center;
            padding: 56px 20px;
          }
          .si-empty-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            background: #f1f5f9;
            color: #94a3b8;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
          }
          .si-empty-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 6px;
          }
          .si-empty-desc {
            font-size: 13px;
            color: #64748b;
            max-width: 400px;
            margin: 0 auto 16px;
          }
          .si-live-banner {
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            padding: 20px;
            margin-bottom: 22px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          }
          .si-live-banner-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
          }
        `}</style>

        <div className="si-page-wrapper">

          {/* Header Card */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <GraduationCap size={24} />
              </div>
              <div>
                <h3 className="si-header-title">
                  Workshop Bootcamps
                  <span className="si-count-badge">
                    {totalCount} Total
                  </span>
                </h3>
                <p className="si-header-subtitle">
                  The featured bootcamp panel on the website's Workshop page. Add drafts and publish when ready.
                </p>
              </div>
            </div>

            <div className="si-header-actions">
              {live && (
                <button
                  type="button"
                  onClick={() => setShowLivePreview(!showLivePreview)}
                  className="btn btn-outline-secondary btn-sm"
                  style={{ borderRadius: "10px", fontWeight: "600", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Eye size={15} />
                  <span>{showLivePreview ? "Hide Live Preview" : "Show Live Preview"}</span>
                </button>
              )}

              {/* the seats reserved on the website (their own page; no menu item) */}
              {permCan("workshop-registrations:view") && (
                <button
                  type="button"
                  onClick={() => navigate("/panel/workshop-registrations")}
                  className="btn btn-outline-primary btn-sm"
                  style={{ borderRadius: "10px", fontWeight: "600", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Users size={15} />
                  <span>Registrations</span>
                </button>
              )}

              {permCan("create") && (
                <button
                  onClick={openAdd}
                  className="si-btn-primary"
                >
                  <Plus size={16} />
                  <span>Add Bootcamp</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              <div>
                <div className="si-stat-label">Total Bootcamps</div>
                <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Workshops-s1" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-purple">
                <GraduationCap size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card card-live ${statusFilter === "1" ? "active" : ""}`}
              onClick={() => setStatusFilter("1")}
            >
              <div>
                <div className="si-stat-label">Live on Website</div>
                <div className="si-stat-value"><AnimatedNumber value={liveCount} pending={loading} id="Workshops-s2" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-green">
                <Sparkles size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card card-draft ${statusFilter === "0" ? "active" : ""}`}
              onClick={() => setStatusFilter("0")}
            >
              <div>
                <div className="si-stat-label">Drafts</div>
                <div className="si-stat-value"><AnimatedNumber value={draftCount} pending={loading} id="Workshops-s3" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-amber">
                <Clock size={22} />
              </div>
            </div>

            <div
              className="si-stat-card"
              onClick={() => setStatusFilter("ALL")}
            >
              <div>
                <div className="si-stat-label">Scheduled</div>
                <div className="si-stat-value"><AnimatedNumber value={scheduledCount} pending={loading} id="Workshops-s4" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-blue">
                <Calendar size={22} />
              </div>
            </div>
          </div>

          {/* Optional Live Preview Banner */}
          {live && showLivePreview && (
            <div className="si-live-banner">
              <div className="si-live-banner-head">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="si-status-pill si-status-live">
                    <span className="si-status-dot" /> LIVE ON WEBSITE NOW
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                    {live.title}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-decoration-none text-muted"
                  onClick={() => setShowLivePreview(false)}
                >
                  Dismiss Preview
                </button>
              </div>
              <Preview f={{ ...BLANK, ...live }} />
            </div>
          )}

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <div className="si-filter-left">
              <div className="si-select-wrap">
                <span className="si-select-label">Status:</span>
                <select
                  className="si-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="1">Live Only</option>
                  <option value="0">Drafts Only</option>
                </select>
              </div>
            </div>

            <div className="si-search-form">
              <ListSearch
                placeholder="Search bootcamps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button data-refresh
                type="button"
                className="reload-btn"
                title="Reset & Reload"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  load();
                }}
              >
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          {/* Modern Table Card */}
          <div className="si-table-card">
            {loading ? (
              <SkeletonTable cols={5} />
            ) : displayedList.length === 0 ? (
              <div className="si-empty-box">
                <div className="si-empty-icon">
                  <GraduationCap size={28} />
                </div>
                <div className="si-empty-title">
                  {search ? "No matching bootcamps found" : "No bootcamps yet"}
                </div>
                <p className="si-empty-desc">
                  {search
                    ? "Try adjusting your search criteria."
                    : "Add one — the website shows its built-in copy until you publish."}
                </p>
                <button
                  className="si-btn-primary"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    load();
                  }}
                >
                  <RotateCw size={14} /> Reload
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="si-table">
                  <thead>
                    <tr>
                      <th style={{ width: "36%" }}>Bootcamp</th>
                      <th style={{ width: "24%" }}>Schedule & Cadence</th>
                      <th style={{ width: "16%" }}>Mentor / Tags</th>
                      <th style={{ width: "12%" }}>Status</th>
                      <th style={{ width: "12%", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedList.map((item) => {
                      const isLive = item.status === "1";
                      const isBusy = busyId === item.id;

                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="si-bootcamp-cell">
                              <div className="si-bootcamp-icon">
                                <GraduationCap size={18} />
                              </div>
                              <div>
                                <span className="si-bootcamp-title">{item.title}</span>
                                {item.badge && (
                                  <span className="si-bootcamp-sub">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: "12.5px", color: "#334155" }}>
                              {[item.cadence, item.times].filter(Boolean).join(" · ") || (Number(item.start_at) > 0 ? "" : "No schedule specified")}
                            </div>
                            {item.duration && (
                              <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                                Duration: {item.duration}
                              </div>
                            )}
                            {(Number(item.start_at) > 0 || Number(item.expire_at) > 0) && (
                              <div className="si-when">
                                {Number(item.start_at) > 0 && <span>Starts {fmtWhen(item.start_at)}</span>}
                                {Number(item.expire_at) > 0 && <span>Expires {fmtWhen(item.expire_at)}</span>}
                              </div>
                            )}
                          </td>

                          <td>
                            <span style={{ fontSize: "12.5px", color: "#475569" }}>
                              {item.mentor || item.teach_tags || "—"}
                            </span>
                          </td>

                          <td>
                            {isLive ? (
                              <span className="si-status-pill si-status-live">
                                <span className="si-status-dot" /> Live
                              </span>
                            ) : (
                              <span className="si-status-pill si-status-draft">
                                <span className="si-status-dot" /> Draft
                              </span>
                            )}
                            {timing(item) === "expired" && <span className="si-time-pill expired">Expired</span>}
                            {timing(item) === "upcoming" && <span className="si-time-pill upcoming">Upcoming</span>}
                            {timing(item) === "running" && <span className="si-time-pill running">Running</span>}
                          </td>

                          <td>
                            <div className="si-action-btns">
                              {/* Publish / Unpublish */}
                              {permCan("status") && (
                                !isLive ? (
                                  <button
                                    className="si-action-btn btn-pub"
                                    title="Publish to website"
                                    disabled={isBusy}
                                    onClick={() => publish(item)}
                                  >
                                    <Upload size={14} />
                                  </button>
                                ) : (
                                  <button
                                    className="si-action-btn btn-unpub"
                                    title="Unpublish from website"
                                    disabled={isBusy}
                                    onClick={() => unpublish(item)}
                                  >
                                    <Clock size={14} />
                                  </button>
                                )
                              )}

                              {/* Edit */}
                              {permCan("edit") && (
                                <button
                                  className="si-action-btn btn-edit"
                                  title="Edit Bootcamp"
                                  onClick={() => openEdit(item)}
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}

                              {/* Duplicate (a draft copy) */}
                              {permCan("create") && (
                                <button
                                  className="si-action-btn btn-dup"
                                  title="Duplicate as a draft"
                                  disabled={isBusy}
                                  onClick={() => duplicate(item)}
                                >
                                  <Copy size={14} />
                                </button>
                              )}

                              {/* Delete */}
                              {permCan("delete") && (
                                <button
                                  className="si-action-btn btn-del"
                                  title="Delete Bootcamp"
                                  disabled={isBusy}
                                  onClick={() => del(item)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/workshop-list" />
            </div>
          </div>

        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        // Scrollable popup: the title bar and the save button stay in view, the
        // fields scroll between them (Bootstrap's modal-dialog-scrollable)
        <div className="modal fade show d-block ws-modal" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={closeModal}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "Edit Bootcamp" : "Add Bootcamp"}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                {permCan("edit", "create") && (<form id="ws-bootcamp-form" onSubmit={save}>

                  <div className="mb-2">
                    <label className="form-label">Badge</label>
                    <input className="form-control" value={form.badge} onChange={set("badge")}
                      placeholder="Upcoming bootcamp" />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Title *</label>
                    <input className="form-control" value={form.title} onChange={set("title")}
                      placeholder="e.g. AI Agents &amp; Agentic Framework" />
                  </div>

                  {/* cadence / times / duration on one row, start / expiry on the next */}
                  <div className="row">
                    <div className="col-md-4 mb-2">
                      <label className="form-label">Cadence</label>
                      <input className="form-control" value={form.cadence} onChange={set("cadence")}
                        placeholder="e.g. Weekends only" />
                    </div>
                    <div className="col-md-4 mb-2">
                      <label className="form-label">Times</label>
                      <input className="form-control" value={form.times} onChange={set("times")}
                        placeholder="e.g. 11:00 AM EST  |  8:30 PM IST" />
                    </div>
                    <div className="col-md-4 mb-2">
                      <label className="form-label">Duration</label>
                      <input className="form-control" value={form.duration} onChange={set("duration")}
                        placeholder="e.g. 20+ hours" />
                      <small className="text-muted">The word “live” is added automatically.</small>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <label className="form-label">Starts on</label>
                      <input type="datetime-local" className="form-control" value={form.start_at} onChange={set("start_at")} />
                      <small className="text-muted">Until then the website shows “Next session: {form.start_at ? new Date(form.start_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "<month year>"}”.</small>
                    </div>
                    <div className="col-md-6 mb-2">
                      <label className="form-label">Expires on</label>
                      <input type="datetime-local" className="form-control" value={form.expire_at} onChange={set("expire_at")}
                        min={form.start_at || undefined} />
                      <small className="text-muted">After this the bootcamp is no longer shown on the website. Leave empty to keep it.</small>
                    </div>
                  </div>

                  <hr />
                  <div className="row">
                    <div className="col-md-5 mb-2">
                      <label className="form-label">Button 1 label</label>
                      <input className="form-control" value={form.zoom_label} onChange={set("zoom_label")} />
                    </div>
                    <div className="col-md-7 mb-2">
                      <label className="form-label">Button 1 link</label>
                      <input className="form-control" value={form.zoom_url} onChange={set("zoom_url")}
                        placeholder="https://..." />
                    </div>
                    <div className="col-md-5 mb-2">
                      <label className="form-label">Button 2 label</label>
                      <input className="form-control" value={form.whatsapp_label} onChange={set("whatsapp_label")} />
                    </div>
                    <div className="col-md-7 mb-2">
                      <label className="form-label">Button 2 link</label>
                      <input className="form-control" value={form.whatsapp_url} onChange={set("whatsapp_url")}
                        placeholder="https://..." />
                    </div>
                  </div>
                  <small className="text-muted">Clear a label to hide that button.</small>

                  <hr />
                  <div className="mb-2">
                    <label className="form-label">What you'll learn</label>
                    <textarea className="form-control" rows={6} value={form.learn_items} onChange={set("learn_items")}
                      placeholder={"Build AI agents\nCreate RAG applications\nAutomate business workflows"} />
                    <small className="text-muted">One bullet per line.</small>
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Who's teaching</label>
                    <textarea className="form-control" rows={2} value={form.mentor} onChange={set("mentor")}
                      placeholder="AI expert with 10+ years of industry experience" />
                    <small className="text-muted">A full stop is added automatically.</small>
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Who's teaching — tags</label>
                    <input className="form-control" value={form.teach_tags} onChange={set("teach_tags")}
                      placeholder="Live on Zoom, Weekends only, Coders &amp; non-coders" />
                    <small className="text-muted">Separate with commas.</small>
                  </div>

                  <div className="mb-2">
                    <label className="form-label">How to join</label>
                    <textarea className="form-control" rows={3} value={form.join_text} onChange={set("join_text")}
                      placeholder="Registration is on Zoom — you'll get the joining link and reminders by email." />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">How to join — tags</label>
                    <input className="form-control" value={form.join_tags} onChange={set("join_tags")}
                      placeholder="Free, No card needed, Limited seats" />
                    <small className="text-muted">Separate with commas.</small>
                  </div>

                  <div className="mb-1">
                    <label className="form-label fw-bold">Preview</label>
                    <Preview f={form} />
                  </div>
                </form>)}
              </div>
              {permCan("edit", "create") && (
                <div className="modal-footer ws-modal-footer">
                  {!editing && (
                    <small className="text-muted me-auto">
                      Saved as a draft — the website is unchanged until you press Publish.
                    </small>
                  )}
                  <button type="button" className="btn btn-outline-secondary" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" form="ws-bootcamp-form" className="btn btn-success add" disabled={saving}>
                    {saving ? <ButtonLoader label="Saving..." /> : editing ? "Update Bootcamp" : "Save as Draft"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );


  void Icon;
function Icon() {
    return (<>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: "relative", top: "-2px" }}
      >
        <path d="M3 4h18v12H3z" />
        <path d="M12 16v4" />
        <path d="M8 20h8" />
        <path d="M7 8h10" />
      </svg>
    </>
    );
  }

}
