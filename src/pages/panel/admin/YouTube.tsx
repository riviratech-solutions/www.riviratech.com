import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePagePerm } from "../../../utils/adminPermissions";
import HomeSectionToggle from "../../../components/HomeSectionToggle";
import {
  Video,
  Plus,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
  GripVertical,
  PlaySquare,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonList } from "../../../components/loading";

const seo = getSeoByPath("");

function ytId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function Row({ item, onEdit, onDelete, onToggle, busy }: any) {
  const permCan = usePagePerm("youtube");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const id = ytId(item.url);
  const isShown = item.status === "1";

  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : isShown ? 1 : 0.65,
    boxShadow: isDragging ? "0 12px 30px rgba(16,23,41,.15)" : "0 1px 3px rgba(0,0,0,0.04)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "14px 18px",
    transitionProperty: "transform, box-shadow, opacity",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{ cursor: "grab", color: "#94a3b8", display: "flex", alignItems: "center", padding: "4px" }}
      >
        <GripVertical size={18} />
      </span>

      {id ? (
        <img
          src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
          alt=""
          style={{ width: 100, height: 58, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "1px solid #e2e8f0" }}
        />
      ) : (
        <div style={{ width: 100, height: 58, background: "#f1f5f9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0 }}>
          <PlaySquare size={22} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", marginBottom: "3px" }}>
          {item.title || "Untitled Video"}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: "12px", color: "var(--ad-brand)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", wordBreak: "break-all" }}
        >
          <ExternalLink size={11} />
          <span>{item.url}</span>
        </a>
      </div>

      <div>
        {isShown ? (
          <span className="si-status-pill si-status-active">
            <span className="si-status-dot" /> Shown
          </span>
        ) : (
          <span className="si-status-pill si-status-disabled">
            <span className="si-status-dot" /> Hidden
          </span>
        )}
      </div>

      <div className="form-check form-switch m-0" title={isShown ? "Shown on home page" : "Hidden from home page"}>
        <input
          disabled={!permCan("status")}
          className="form-check-input"
          type="checkbox"
          style={{ cursor: "pointer" }}
          checked={isShown}
          onChange={() => onToggle(item)}
        />
      </div>

      <div className="si-action-btns">
        {permCan("edit") && (
          <button
            type="button"
            className="si-action-btn btn-edit"
            onClick={() => onEdit(item)}
            title="Edit Video"
          >
            <Edit2 size={14} />
          </button>
        )}
        {permCan("delete") && (
          <button
            type="button"
            className="si-action-btn btn-del"
            disabled={busy}
            onClick={() => onDelete(item)}
            title="Delete Video"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function YouTube() {
  const permCan = usePagePerm("youtube");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState({ title: "", url: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getSecurity = async () =>
    (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/youtube-list", {});
      if (res.data.success) setList(res.data.data);
      else toast.error(res.data.message || "Failed to load");
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm({ title: "", url: "" }); setModalOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ title: item.title || "", url: item.url }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const save = async (e: any) => {
    e.preventDefault();
    if (!ytId(form.url)) return toast.error("Please enter a valid YouTube link");
    setSaving(true);
    try {
      const s = await getSecurity();
      const path = editing ? "api/youtube-update" : "api/youtube-add";
      const payload: any = { ...form, key: s.key, token: s.token, aut: s.aut };
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

  const del = async (item: any) => {
    if (!window.confirm("Delete this video?")) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/youtube-delete",
        { id: item.id, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) { toast.success(res.data.message); setList((prev) => prev.filter((x) => x.id !== item.id)); }
      else toast.error(res.data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  const toggle = async (item: any) => {
    const active = item.status !== "1";
    setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: active ? "1" : "1S" } : x)));
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/youtube-toggle",
        { id: item.id, active, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) toast.success(res.data.message);
      else {
        toast.error(res.data.message);
        setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: active ? "1S" : "1" } : x)));
      }
    } catch {
      toast.error("Something went wrong");
      setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: active ? "1S" : "1" } : x)));
    }
  };

  const saveOrder = async (ids: number[]) => {
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/youtube-reorder",
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
  const activeCount = list.filter((x) => x.status === "1").length;
  const hiddenCount = list.filter((x) => x.status !== "1").length;
  const titledCount = list.filter((x) => Boolean(x.title)).length;

  const displayedList = list.filter((item) => {
    if (statusFilter === "1" && item.status !== "1") return false;
    if (statusFilter === "0" && item.status === "1") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchUrl = (item.url || "").toLowerCase().includes(q);
      if (!matchTitle && !matchUrl) return false;
    }
    return true;
  });

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
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
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
        background: #fee2e2;
        color: #b91c1c;
        font-size: 12px;
        font-weight: 700;
        border-radius: 20px;
        margin-left: 20px;
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
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #ffffff !important;
        font-size: 13.5px;
        font-weight: 600;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
        text-decoration: none;
      }
      .si-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(239, 68, 68, 0.3);
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
        box-shadow: 0 0 0 2px #ef4444, 0 6px 16px rgba(239, 68, 68, 0.15);
        border-color: #ef4444;
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
      .si-stat-red    { background: #fef2f2; color: #dc2626; }

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
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
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
        background: #fee2e2;
        color: #dc2626;
        border-color: #fca5a5;
      }
      .si-list-card {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .si-drag-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12.5px;
        color: #64748b;
        background: #f8fafc;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px dashed #cbd5e1;
        margin-bottom: 20px;
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
      .si-status-pill.si-status-active {
        background: #dcfce7;
        color: #15803d;
      }
      .si-status-pill.si-status-disabled {
        background: #f1f5f9;
        color: #64748b;
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
        gap: 6px;
      }
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
    `}</style>


        <div className="si-page-wrapper">

          {/* Header Card */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Video size={24} />
              </div>
              <div>
                <h3 className="si-header-title">
                  YouTube Videos
                  <span className="si-count-badge">
                    {totalCount} Total
                  </span>
                </h3>
                <p className="si-header-subtitle">
                  Highlights and student experiences featured on the website home page
                </p>
              </div>
            </div>

            <div className="si-header-actions">
              {/* whole-section switch for the website home page */}
              <HomeSectionToggle section="youtube" visibleCount={activeCount} canChange={permCan("status")} />
              {permCan("create") && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="si-btn-primary"
                >
                  <Plus size={16} />
                  <span>Add Video</span>
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
                <div className="si-stat-label">Total Videos</div>
                <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="YouTube-s1" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-red">
                <Video size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${statusFilter === "1" ? "active" : ""}`}
              onClick={() => setStatusFilter("1")}
            >
              <div>
                <div className="si-stat-label">Shown on Home</div>
                <div className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="YouTube-s2" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-green">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${statusFilter === "0" ? "active" : ""}`}
              onClick={() => setStatusFilter("0")}
            >
              <div>
                <div className="si-stat-label">Hidden</div>
                <div className="si-stat-value"><AnimatedNumber value={hiddenCount} pending={loading} id="YouTube-s3" /></div>
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
                <div className="si-stat-label">Titled Videos</div>
                <div className="si-stat-value"><AnimatedNumber value={titledCount} pending={loading} id="YouTube-s4" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-blue">
                <Sparkles size={22} />
              </div>
            </div>
          </div>

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
                  <option value="1">Shown on Home Only</option>
                  <option value="0">Hidden Only</option>
                </select>
              </div>
            </div>

            <div className="si-search-form">
              <ListSearch
                placeholder="Search videos by title or URL..."
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

          {/* List Card */}
          <div className="si-list-card">
            <div className="si-drag-hint">
              <GripVertical size={16} />
              <span>Drag items using the handle to reorder — the home page carousel follows this exact order.</span>
            </div>

            {loading ? (
              <SkeletonList rows={5} />
            ) : displayedList.length === 0 ? (
              <div className="si-empty-box">
                <div className="si-empty-icon">
                  <Video size={28} />
                </div>
                <div className="si-empty-title">
                  {search ? "No matching videos found" : "No videos added yet"}
                </div>
                <p className="si-empty-desc">
                  {search
                    ? "Try adjusting your search criteria."
                    : "Add YouTube videos to showcase student projects and reviews on the home page."}
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={permCan("reorder") ? onDragEnd : undefined}>
                <SortableContext items={displayedList.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {displayedList.map((item) => (
                      <Row
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onDelete={del}
                        onToggle={toggle}
                        busy={busyId === item.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
          <div className="saved-ago-row">
            <SavedAgo endpoint="api/youtube-list" />
          </div>

        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={closeModal}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "Edit Video" : "Add Video"}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                {permCan("edit", "create") && (<form onSubmit={save}>
                  <div className="mb-3">
                    <label className="form-label">Title (optional)</label>
                    <input className="form-control" value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Learner experience" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">YouTube URL *</label>
                    <input className="form-control" value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..." />
                  </div>
                  {ytId(form.url) && (
                    <div className="mb-3">
                      <img src={`https://img.youtube.com/vi/${ytId(form.url)}/mqdefault.jpg`} alt="preview"
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #e7eaf1" }} />
                    </div>
                  )}
                  <button className="btn btn-success add w-100" disabled={saving}>
                    {saving ? <ButtonLoader label="Saving..." /> : editing ? "Update Video" : "Add Video"}
                  </button>
                </form>)}
              </div>
            </div>
          </div>
        </div>
      )}
      
    </>
  );
}
