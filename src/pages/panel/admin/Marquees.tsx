import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import MonacoEditor from "@monaco-editor/react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Megaphone,
  Plus,
  RotateCw,
  Radio,
  CalendarClock,
  CalendarX2,
  Trash2,
  Edit2,
  GripVertical,
  PanelTop,
  PanelBottom,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { MarqueeStrip, type MarqueeItem } from "../../../components/SiteMarquee";
import { MARQUEE_PAGES } from "../../../utils/marqueePages";
import { AnimatedNumber, ButtonLoader, SkeletonList } from "../../../components/loading";

const seo = getSeoByPath("");

const PLACE_LABEL: Record<string, string> = { header: "Header", footer: "Footer", both: "Header & Footer" };
const pageLabel = (key: string) => (key === "*" ? "All pages" : MARQUEE_PAGES.find((p) => p.key === key)?.label || key);

// Schedule state of a message right now.
type When = "live" | "scheduled" | "expired" | "hidden";
function whenOf(m: any, now: number): When {
  if (m.status !== "1") return "hidden";
  if (Number(m.end_at) && Number(m.end_at) <= now) return "expired";
  if (Number(m.start_at) && Number(m.start_at) > now) return "scheduled";
  return "live";
}
const WHEN_PILL: Record<When, [string, string]> = {
  live: ["Live", "si-status-active"],
  scheduled: ["Scheduled", "si-status-scheduled"],
  expired: ["Expired", "si-status-expired"],
  hidden: ["Hidden", "si-status-disabled"],
};

// <input type="datetime-local"> <-> epoch seconds (0 = not set)
const toLocalInput = (epoch: number) => {
  if (!epoch) return "";
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);
const fmt = (epoch: number) =>
  epoch ? new Date(epoch * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const parsePages = (v: any): string[] => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v || '["*"]'); } catch { return ["*"]; }
};

const EMPTY = {
  title: "",
  html: "<strong>New batch starts soon!</strong> Enrol today and get early access.",
  css: ".highlight {\n  color: #fcd34d;\n}\n",
  placement: "header",
  pages: ["*"] as string[],
  speed: "normal",
  direction: "left",
  pause_hover: true,
  closable: false,
  start: "",
  end: "",
};

function Row({ item, now, onEdit, onDelete, onToggle, busy, canReorder }: any) {
  const permCan = usePagePerm("marquees");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const when = whenOf(item, now);
  const pages = parsePages(item.pages);
  const text = String(item.html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : item.status === "1" ? 1 : 0.65,
    boxShadow: isDragging ? "0 12px 30px rgba(16,23,41,.15)" : "0 1px 3px rgba(0,0,0,0.04)",
  };

  return (
    <div ref={setNodeRef} style={style} className="mq-row">
      <span
        {...(canReorder ? { ...attributes, ...listeners } : {})}
        title={canReorder ? "Drag to reorder" : ""}
        className="mq-grip"
        style={{ cursor: canReorder ? "grab" : "default" }}
      >
        <GripVertical size={18} />
      </span>

      <div className="mq-row-main">
        <div className="mq-row-title">{item.title}</div>
        <div className="mq-row-text" title={text}>{text}</div>
        <div className="mq-row-meta">
          <span className="mq-chip">
            {item.placement === "footer" ? <PanelBottom size={12} /> : <PanelTop size={12} />} {PLACE_LABEL[item.placement] || item.placement}
          </span>
          <span className="mq-chip" title={pages.map(pageLabel).join(", ")}>
            {pages.includes("*") ? "All pages" : pages.length === 1 ? pageLabel(pages[0]) : `${pages.length} pages`}
          </span>
          {(Number(item.start_at) > 0 || Number(item.end_at) > 0) && (
            <span className="mq-chip mq-chip-time">
              <CalendarClock size={12} />
              {Number(item.start_at) > 0 ? fmt(Number(item.start_at)) : "Now"} → {Number(item.end_at) > 0 ? fmt(Number(item.end_at)) : "No expiry"}
            </span>
          )}
        </div>
      </div>

      <span className={`si-status-pill ${WHEN_PILL[when][1]}`}>
        <span className="si-status-dot" /> {WHEN_PILL[when][0]}
      </span>

      <div className="form-check form-switch m-0" title={item.status === "1" ? "Shown on the website" : "Hidden from the website"}>
        <input
          disabled={!permCan("status")}
          className="form-check-input"
          type="checkbox"
          style={{ cursor: "pointer" }}
          checked={item.status === "1"}
          onChange={() => onToggle(item)}
        />
      </div>

      <div className="si-action-btns">
        {permCan("edit") && (
          <button type="button" className="si-action-btn btn-edit" onClick={() => onEdit(item)} title="Edit message">
            <Edit2 size={14} />
          </button>
        )}
        {permCan("delete") && (
          <button type="button" className="si-action-btn btn-del" disabled={busy} onClick={() => onDelete(item)} title="Delete message">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Marquees() {
  const permCan = usePagePerm("marquees");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [serverNow, setServerNow] = useState(() => Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [whenFilter, setWhenFilter] = useState<"ALL" | When>("ALL");
  const [placeFilter, setPlaceFilter] = useState("ALL");
  const [form, setForm] = useState({ ...EMPTY });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getSecurity = async () =>
    (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/marquees-list", {});
      if (res.data.success) {
        setList(res.data.data);
        setServerNow(Math.floor(Date.now() / 1000));
      } else toast.error(res.data.message || "Failed to load");
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY, pages: ["*"] }); setModalOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      html: item.html || "",
      css: item.css || "",
      placement: item.placement || "header",
      pages: parsePages(item.pages),
      speed: item.speed || "normal",
      direction: item.direction || "left",
      pause_hover: item.pause_hover !== "0",
      closable: item.closable === "1",
      start: toLocalInput(Number(item.start_at) || 0),
      end: toLocalInput(Number(item.end_at) || 0),
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const togglePage = (key: string) =>
    setForm((f) => {
      if (key === "*") return { ...f, pages: f.pages.includes("*") ? [] : ["*"] };
      const cur = f.pages.filter((p) => p !== "*");
      return { ...f, pages: cur.includes(key) ? cur.filter((p) => p !== key) : [...cur, key] };
    });

  const save = async (e: any) => {
    e.preventDefault();
    if (form.title.trim().length < 2) return toast.error("Please enter a title");
    if (!form.html.replace(/<[^>]*>/g, "").trim()) return toast.error("Please enter the message");
    if (!form.pages.length) return toast.error("Choose at least one page");
    const start_at = fromLocalInput(form.start), end_at = fromLocalInput(form.end);
    if (start_at && end_at && end_at <= start_at) return toast.error("The expiry must be after the start");
    setSaving(true);
    try {
      const s = await getSecurity();
      const payload: any = {
        title: form.title, html: form.html, css: form.css, placement: form.placement, pages: form.pages,
        speed: form.speed, direction: form.direction, pause_hover: form.pause_hover ? "1" : "0",
        closable: form.closable ? "1" : "0", start_at, end_at,
        key: s.key, token: s.token, aut: s.aut,
      };
      if (editing) payload.id = editing.id;
      const res = await axios.post(SERVER_URL + "api/marquees-save", payload, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        if (editing) setList((prev) => prev.map((x) => (x.id === editing.id ? res.data.data : x)));
        else setList((prev) => [...prev, res.data.data]);
        closeModal();
      } else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const del = async (item: any) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/marquees-delete",
        { id: item.id, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) { toast.success(res.data.message); setList((prev) => prev.filter((x) => x.id !== item.id)); }
      else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  const toggle = async (item: any) => {
    const active = item.status !== "1";
    const flip = (on: boolean) => setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: on ? "1" : "1S" } : x)));
    flip(active);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/marquees-toggle",
        { id: item.id, active, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) toast.success(res.data.message);
      else { toast.error(res.data.message); flip(!active); }
    } catch { toast.error("Something went wrong"); flip(!active); }
  };

  const saveOrder = async (ids: number[]) => {
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/marquees-reorder",
        { ids, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (!res.data.success) toast.error(res.data.message || "Could not save the new order");
    } catch { toast.error("Could not save the new order"); }
  };

  const onDragEnd = (e: any) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = list.findIndex((i) => i.id === active.id);
    const newI = list.findIndex((i) => i.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(list, oldI, newI);
    setList(next);
    saveOrder(next.map((i) => i.id));
  };

  const initchecklogin = async () => {
    const data = (await axios.get(SERVER_URL + "api/check-login", { withCredentials: true })).data;
    if (data.loggedIn && (data.id == "X" || data.id == "Y")) load();
    else navigate("/logout");
  };

  useEffect(() => {
    initchecklogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { live: 0, scheduled: 0, expired: 0, hidden: 0 };
    list.forEach((m) => { c[whenOf(m, serverNow)]++; });
    return c;
  }, [list, serverNow]);

  const displayedList = list.filter((m) => {
    if (whenFilter !== "ALL" && whenOf(m, serverNow) !== whenFilter) return false;
    if (placeFilter !== "ALL" && m.placement !== placeFilter && !(m.placement === "both" && placeFilter !== "both")) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${m.title} ${String(m.html || "").replace(/<[^>]*>/g, " ")}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const canReorder = permCan("reorder") && whenFilter === "ALL" && placeFilter === "ALL" && !search.trim();

  // live preview of the strip being edited
  const previewItem: MarqueeItem = {
    req_id: "preview",
    html: form.html,
    css: form.css,
    placement: form.placement as any,
    pages: form.pages,
    speed: form.speed as any,
    direction: form.direction as any,
    pause_hover: form.pause_hover ? "1" : "0",
    closable: "0",
  };

  return (
    <>
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="content">
        <style>{`
          .si-page-wrapper { background-color: #f8fafc; min-height: calc(100vh - 80px); padding: 24px 28px; }
          .si-header-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; flex-wrap: wrap; gap: 16px; }
          .si-header-left { display: flex; align-items: center; gap: 14px; }
          .si-header-icon-box { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25); }
          .si-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px; }
          .si-count-badge { display: inline-flex; align-items: center; padding: 4px 10px; background: #eef2ff; color: var(--ad-brand-2); font-size: 12px; font-weight: 700; border-radius: 20px; margin-left: 12px; }
          .si-header-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
          .si-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%); color: #fff !important; font-size: 13.5px; font-weight: 600; border-radius: 10px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.2); }
          .si-btn-primary:hover { transform: translateY(-1px); }
          .si-btn-primary:disabled { opacity: .6; transform: none; }
          .si-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
          @media (max-width: 992px) { .si-stats-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 576px) { .si-stats-grid { grid-template-columns: 1fr; } }
          .si-stat-card { background: #fff; border-radius: 14px; padding: 16px 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,.04); cursor: pointer; user-select: none; transition: transform .2s, box-shadow .2s, border-color .2s; }
          .si-stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.08); }
          .si-stat-card.active { box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb),.15); border-color: var(--ad-brand); }
          .si-stat-label { font-size: 12.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
          .si-stat-value { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
          .si-stat-icon-wrap { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
          .si-stat-purple { background: #f5f3ff; color: var(--ad-brand); }
          .si-stat-green { background: #ecfdf5; color: #059669; }
          .si-stat-blue { background: #eff6ff; color: #2563eb; }
          .si-stat-red { background: #fef2f2; color: #dc2626; }
          .si-filter-bar { background: #fff; border-radius: 14px; padding: 14px 18px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
          .si-select-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 4px 10px; }
          .si-select-label { font-size: 12.5px; font-weight: 600; color: #64748b; }
          .si-select { border: none; background: transparent; font-size: 13px; font-weight: 600; color: #0f172a; outline: none; cursor: pointer; }
          .si-search-form { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; }
          .si-list-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
          .si-drag-hint { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #64748b; background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px dashed #cbd5e1; margin-bottom: 20px; }
          .si-status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; }
          .si-status-active { background: #dcfce7; color: #15803d; }
          .si-status-scheduled { background: #e0f2fe; color: #0369a1; }
          .si-status-expired { background: #fee2e2; color: #b91c1c; }
          .si-status-disabled { background: #f1f5f9; color: #64748b; }
          .si-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
          .si-action-btns { display: flex; align-items: center; gap: 6px; }
          .si-action-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #475569; display: flex; align-items: center; justify-content: center; cursor: pointer; }
          .si-action-btn.btn-edit:hover { background: #e0f2fe; color: #0284c7; border-color: #bae6fd; }
          .si-action-btn.btn-del:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }
          .si-empty-box { text-align: center; padding: 56px 20px; color: #64748b; }
          .si-empty-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 12px 0 6px; }

          .mq-row { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; transition-property: transform, box-shadow, opacity; }
          .mq-grip { color: #94a3b8; display: flex; align-items: center; padding: 4px; }
          .mq-row-main { flex: 1; min-width: 0; }
          .mq-row-title { font-weight: 700; color: #0f172a; font-size: 14px; }
          .mq-row-text { font-size: 12.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0 6px; }
          .mq-row-meta { display: flex; flex-wrap: wrap; gap: 6px; }
          .mq-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; background: #f1f5f9; color: #334155; font-size: 11.5px; font-weight: 600; }
          .mq-chip-time { background: #eef2ff; color: var(--ad-brand-2); }

          .mq-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; }
          @media (max-width: 768px) { .mq-form-grid { grid-template-columns: 1fr; } }
          .mq-span { grid-column: 1 / -1; }
          .mq-label { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px; display: block; }
          .mq-hint { font-size: 12px; color: #64748b; margin-top: 4px; }
          .mq-seg { display: inline-flex; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
          .mq-seg button { border: none; background: #fff; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #475569; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
          .mq-seg button + button { border-left: 1px solid #e2e8f0; }
          .mq-seg button.on { background: var(--ad-brand); color: #fff; }
          .mq-pages { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
          .mq-page { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; padding: 4px 6px; border-radius: 8px; cursor: pointer; }
          .mq-page:hover { background: #eef2ff; }
          .mq-page.all { grid-column: 1 / -1; font-weight: 700; border-bottom: 1px dashed #cbd5e1; border-radius: 0; padding-bottom: 8px; margin-bottom: 2px; }
          .mq-editor { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
          .mq-preview { border: 1px dashed #c7d2fe; border-radius: 12px; overflow: hidden; background: #fff; }
          .mq-preview-label { font-size: 12px; font-weight: 700; color: var(--ad-brand-2); padding: 6px 10px; background: #eef2ff; }
        `}</style>

        <div className="si-page-wrapper">
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box"><Megaphone size={24} /></div>
              <div>
                <h3 className="si-header-title">
                  Marquee Messages <span className="si-count-badge">{list.length} Total</span>
                </h3>
                <p className="si-header-subtitle">Scrolling messages in the website header and footer, page by page</p>
              </div>
            </div>
            {permCan("create") && (
              <button type="button" onClick={openAdd} className="si-btn-primary">
                <Plus size={16} /> <span>Add Message</span>
              </button>
            )}
          </div>

          <div className="si-stats-grid">
            {([
              ["ALL", "Total Messages", list.length, "si-stat-purple", <Megaphone size={22} key="i" />],
              ["live", "Live Now", counts.live, "si-stat-green", <Radio size={22} key="i" />],
              ["scheduled", "Scheduled", counts.scheduled, "si-stat-blue", <CalendarClock size={22} key="i" />],
              ["expired", "Expired", counts.expired, "si-stat-red", <CalendarX2 size={22} key="i" />],
            ] as const).map(([key, label, value, color, icon]) => (
              <div key={key} className={`si-stat-card ${whenFilter === key ? "active" : ""}`} onClick={() => setWhenFilter(key as any)}>
                <div>
                  <div className="si-stat-label">{label}</div>
                  <div className="si-stat-value"><AnimatedNumber value={value} pending={loading} id="Marquees-s1" /></div>
                </div>
                <div className={`si-stat-icon-wrap ${color}`}>{icon}</div>
              </div>
            ))}
          </div>

          <div className="si-filter-bar">
            <div className="si-select-wrap">
              <span className="si-select-label">Shown in:</span>
              <select className="si-select" value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)}>
                <option value="ALL">Header & Footer</option>
                <option value="header">Header</option>
                <option value="footer">Footer</option>
                <option value="both">Both only</option>
              </select>
            </div>
            <div className="si-search-form">
              <ListSearch placeholder="Search messages..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <button data-refresh type="button" className="reload-btn" title="Reset & Reload"
                onClick={() => { setSearch(""); setWhenFilter("ALL"); setPlaceFilter("ALL"); load(); }}>
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          <div className="si-list-card">
            <div className="si-drag-hint">
              <GripVertical size={16} />
              <span>Drag to reorder — messages in the same place scroll one after another in this order (clear filters to reorder).</span>
            </div>
            {loading ? (
              <SkeletonList rows={5} />
            ) : displayedList.length === 0 ? (
              <div className="si-empty-box">
                <Megaphone size={30} />
                <div className="si-empty-title">{list.length ? "No messages match" : "No messages yet"}</div>
                <div>{list.length ? "Try clearing the filters." : "Add a message to show it in the website header or footer."}</div>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={canReorder ? onDragEnd : undefined}>
                <SortableContext items={displayedList.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {displayedList.map((item) => (
                      <Row key={item.id} item={item} now={serverNow} onEdit={openEdit} onDelete={del} onToggle={toggle}
                        busy={busyId === item.id} canReorder={canReorder} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
          <div className="saved-ago-row">
            <SavedAgo endpoint="api/marquees-list" />
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={closeModal}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "Edit Message" : "Add Message"}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <form onSubmit={save} className="modal-body">
                <div className="mq-form-grid">
                  <div>
                    <label className="mq-label">Title *</label>
                    <input className="form-control" value={form.title} maxLength={150}
                      onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. October batch announcement" />
                    <div className="mq-hint">For admins only — not shown on the website.</div>
                  </div>

                  <div>
                    <label className="mq-label">Show in *</label>
                    <div className="mq-seg">
                      {(["header", "footer", "both"] as const).map((p) => (
                        <button type="button" key={p} className={form.placement === p ? "on" : ""} onClick={() => setForm({ ...form, placement: p })}>
                          {p === "footer" ? <PanelBottom size={14} /> : <PanelTop size={14} />} {PLACE_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mq-span">
                    <label className="mq-label">Show on pages *</label>
                    <div className="mq-pages">
                      <label className="mq-page all">
                        <input type="checkbox" checked={form.pages.includes("*")} onChange={() => togglePage("*")} /> All website pages
                      </label>
                      {MARQUEE_PAGES.map((p) => (
                        <label className="mq-page" key={p.key}>
                          <input type="checkbox" disabled={form.pages.includes("*")}
                            checked={form.pages.includes("*") || form.pages.includes(p.key)} onChange={() => togglePage(p.key)} />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mq-label">Start date & time</label>
                    <input type="datetime-local" className="form-control" value={form.start}
                      onChange={(e) => setForm({ ...form, start: e.target.value })} />
                    <div className="mq-hint">Empty = show straight away.</div>
                  </div>
                  <div>
                    <label className="mq-label">Expiry date & time</label>
                    <input type="datetime-local" className="form-control" value={form.end} min={form.start || undefined}
                      onChange={(e) => setForm({ ...form, end: e.target.value })} />
                    <div className="mq-hint">Empty = never expires.</div>
                  </div>

                  <div>
                    <label className="mq-label">Speed</label>
                    <select className="form-select" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })}>
                      <option value="slow">Slow</option>
                      <option value="normal">Normal</option>
                      <option value="fast">Fast</option>
                    </select>
                  </div>
                  <div>
                    <label className="mq-label">Direction</label>
                    <select className="form-select" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                      <option value="left">Right to left</option>
                      <option value="right">Left to right</option>
                    </select>
                  </div>

                  <div className="mq-span d-flex flex-wrap gap-4">
                    <label className="form-check m-0">
                      <input type="checkbox" className="form-check-input" checked={form.pause_hover}
                        onChange={(e) => setForm({ ...form, pause_hover: e.target.checked })} />{" "}
                      Pause when the mouse is over it
                    </label>
                    <label className="form-check m-0">
                      <input type="checkbox" className="form-check-input" checked={form.closable}
                        onChange={(e) => setForm({ ...form, closable: e.target.checked })} />{" "}
                      Visitors can close it (×) for the rest of their visit
                    </label>
                  </div>

                  <div>
                    <label className="mq-label">Message (HTML) *</label>
                    <div className="mq-editor">
                      <MonacoEditor height="200px" language="html" value={form.html}
                        onChange={(v) => setForm((f) => ({ ...f, html: v || "" }))}
                        options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 13, scrollBeyondLastLine: false }} />
                    </div>
                    <div className="mq-hint">Text, links, &lt;strong&gt;, &lt;span class="…"&gt;, small images. Scripts are removed.</div>
                  </div>
                  <div>
                    <label className="mq-label">Style (CSS)</label>
                    <div className="mq-editor">
                      <MonacoEditor height="200px" language="css" value={form.css}
                        onChange={(v) => setForm((f) => ({ ...f, css: v || "" }))}
                        options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 13, scrollBeyondLastLine: false }} />
                    </div>
                    <div className="mq-hint">Applies to this message only, e.g. <code>.highlight {"{ color: gold }"}</code>.</div>
                  </div>

                  <div className="mq-span">
                    <label className="mq-label">Live preview</label>
                    <div className="mq-preview">
                      <div className="mq-preview-label">{PLACE_LABEL[form.placement]} strip</div>
                      {form.html.replace(/<[^>]*>/g, "").trim() ? (
                        <MarqueeStrip items={[previewItem]} placement={form.placement === "footer" ? "footer" : "header"} />
                      ) : (
                        <div className="p-3 text-muted small">Type a message to see it here.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-light" onClick={closeModal}>Cancel</button>
                  {permCan(editing ? "edit" : "create") && (
                    <button type="submit" className="si-btn-primary" disabled={saving}>
                      {saving ? <ButtonLoader label="Saving..." /> : editing ? "Update Message" : "Add Message"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
