import { Head, SERVER_URL } from "../../../components/Includes";
import { logoUrl } from "../../../components/TrustedBy";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// click a logo: open it in the image viewer (as on the Gallery page)
import LightGallery from "lightgallery/react";
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import HomeSectionToggle from "../../../components/HomeSectionToggle";
import {
  Handshake,
  Plus,
  RotateCw,
  Link2,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
  GripVertical,
  ImageIcon,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonList } from "../../../components/loading";

/* Admin → Partners: the logos in the home page's "Trusted by industry teams &
   partners" strip (components/TrustedBy.tsx). Name, optional website link and
   a logo; drag to set the order, switch each one (or the whole strip) on/off.
   API: api/admin/partners/partners.js */

const seo = getSeoByPath("");

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_LOGO_MB = 5;

// the viewer shows the caption as HTML
const escapeHtml = (s: string) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function Row({ item, onEdit, onDelete, onToggle, busy }: any) {
  const permCan = usePagePerm("partners");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
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

      {item.logo ? (
        <LightGallery speed={500} plugins={[lgThumbnail, lgZoom]} elementClassNames="pt-logo-gallery" addClass="pt-lg">
          <a href={logoUrl(item.logo)} className="pt-logo-box pt-logo-link" data-sub-html={"<h4>" + escapeHtml(item.name) + "</h4>"} title="View logo">
            <img src={logoUrl(item.logo)} alt={item.name} />
          </a>
        </LightGallery>
      ) : (
        <div className="pt-logo-box"><ImageIcon size={22} /></div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", marginBottom: "3px" }}>
          {item.name}
        </div>
        {item.website ? (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px", color: "var(--ad-brand)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", wordBreak: "break-all" }}
          >
            <ExternalLink size={11} />
            <span>{item.website}</span>
          </a>
        ) : (
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>No website link</span>
        )}
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
          <button type="button" className="si-action-btn btn-edit" onClick={() => onEdit(item)} title="Edit Partner">
            <Edit2 size={14} />
          </button>
        )}
        {permCan("delete") && (
          <button type="button" className="si-action-btn btn-del" disabled={busy} onClick={() => onDelete(item)} title="Delete Partner">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Partners() {
  const permCan = usePagePerm("partners");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState({ name: "", website: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getSecurity = async () =>
    (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/partners-list", {});
      if (res.data.success) setList(res.data.data);
      else toast.error(res.data.message || "Failed to load");
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };

  const resetFile = () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setProgress(0);
  };
  const openAdd = () => { setEditing(null); setForm({ name: "", website: "" }); resetFile(); setModalOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ name: item.name || "", website: item.website || "" });
    resetFile();
    setPreview(logoUrl(item.logo));
    setModalOpen(true);
  };
  const closeModal = () => { if (saving) return; setModalOpen(false); setEditing(null); resetFile(); };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!LOGO_TYPES.includes(f.type)) return toast.error("Please choose a PNG, JPG, WEBP or GIF image");
    if (f.size > MAX_LOGO_MB * 1024 * 1024) return toast.error("The logo must be under " + MAX_LOGO_MB + " MB");
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  // the logo goes to the temp upload area first; the save moves it into place
  const uploadLogo = async (f: File) => {
    const s = await getSecurity();
    const pre = await axios.post(SERVER_URL + "api/get-upload-url",
      { fileName: f.name, fileType: f.type, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
    if (!pre.data?.success) throw new Error(pre.data?.message || "Could not start the upload");
    await axios.put(pre.data.uploadURL || pre.data.uploadUrl, f, {
      headers: { "Content-Type": f.type },
      onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded * 100) / e.total)); },
    });
    return pre.data.key || pre.data.fileKey;
  };

  const save = async (e: any) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Please enter the name");
    if (!editing && !file) return toast.error("Please choose the logo");
    setSaving(true);
    try {
      const logo_key = file ? await uploadLogo(file) : "";
      const s = await getSecurity();
      const path = editing ? "api/partners-update" : "api/partners-add";
      const payload: any = { name: form.name.trim(), website: form.website.trim(), logo_key, key: s.key, token: s.token, aut: s.aut };
      if (editing) payload.id = editing.id;
      const res = await axios.post(SERVER_URL + path, payload, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        if (editing) setList((prev) => prev.map((x) => (x.id === editing.id ? res.data.data : x)));
        else setList((prev) => [...prev, res.data.data]);
        setSaving(false);
        setModalOpen(false); setEditing(null); resetFile();
        return;
      }
      toast.error(res.data.message);
    } catch (err: any) { toast.error(err?.message && !/status code/.test(err.message) ? err.message : "Something went wrong"); }
    setSaving(false);
  };

  const del = async (item: any) => {
    if (!window.confirm("Delete " + item.name + "?")) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/partners-delete",
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
      const res = await axios.post(SERVER_URL + "api/partners-toggle",
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
      const res = await axios.post(SERVER_URL + "api/partners-reorder",
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
    const res = await axios.get(SERVER_URL + "api/check-login", { withCredentials: true });
    if (res.data.loggedIn && (res.data.id == "X" || res.data.id == "Y")) load();
    else navigate("/logout");
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const totalCount = list.length;
  const activeCount = list.filter((x) => x.status === "1").length;
  const hiddenCount = list.filter((x) => x.status !== "1").length;
  const linkedCount = list.filter((x) => Boolean(x.website)).length;

  const displayedList = list.filter((item) => {
    if (statusFilter === "1" && item.status !== "1") return false;
    if (statusFilter === "0" && item.status === "1") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(item.name || "").toLowerCase().includes(q) && !(item.website || "").toLowerCase().includes(q)) return false;
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
        background: linear-gradient(135deg, #c9921a 0%, #b45309 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(201, 146, 26, 0.25);
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
        background: #fef3c7;
        color: #92400e;
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
        background: linear-gradient(135deg, #c9921a 0%, #b45309 100%);
        color: #ffffff !important;
        font-size: 13.5px;
        font-weight: 600;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(201, 146, 26, 0.2);
        text-decoration: none;
      }
      .si-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(201, 146, 26, 0.3);
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
        box-shadow: 0 0 0 2px #c9921a, 0 6px 16px rgba(201, 146, 26, 0.15);
        border-color: #c9921a;
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
      .si-stat-red    { background: #fef2f2; color: #b45309; }

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
        border-color: #c9921a;
        box-shadow: 0 0 0 3px rgba(201, 146, 26, 0.1);
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
        background: #fef3c7;
        color: #b45309;
        border-color: #fcd34d;
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
        color: #b45309;
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
    <style>{`
      .pt-logo-box {
        width: 120px; height: 58px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;
        color: #94a3b8; padding: 6px 10px;
      }
      .pt-logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .pt-logo-gallery { flex-shrink: 0; }
      .pt-logo-link { cursor: zoom-in; transition: border-color .15s ease, box-shadow .15s ease; }
      .pt-logo-link:hover { border-color: #c9921a; box-shadow: 0 0 0 3px rgba(201, 146, 26, .15); }
      /* logos are often dark-on-transparent: show them on white in the viewer */
      .pt-lg .lg-object.lg-image { background: #ffffff; border-radius: 10px; padding: 18px; }
      .pt-lg .lg-sub-html h4 { color: #ffffff; font-size: 15px; font-weight: 600; margin: 0; }
      .pt-drop {
        display: flex; align-items: center; gap: 14px;
        border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 12px 14px;
        background: #f8fafc; cursor: pointer;
      }
      .pt-drop:hover { border-color: #c9921a; background: #fffbeb; }
      .pt-drop .pt-logo-box { width: 140px; height: 70px; }
      .pt-drop small { display: block; color: #64748b; font-size: 12px; margin-top: 2px; }
      .pt-progress { height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-top: 10px; }
      .pt-progress span { display: block; height: 100%; background: #c9921a; transition: width .2s ease; }
    `}</style>

        <div className="si-page-wrapper">

          {/* Header Card */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Handshake size={24} />
              </div>
              <div>
                <h3 className="si-header-title">
                  Partners
                  <span className="si-count-badge">
                    {totalCount} Total
                  </span>
                </h3>
                <p className="si-header-subtitle">
                  Logos in the home page's "Trusted by industry teams &amp; partners" strip
                </p>
              </div>
            </div>

            <div className="si-header-actions">
              {/* whole-section switch for the website home page */}
              <HomeSectionToggle section="partners" visibleCount={activeCount} canChange={permCan("status")} />
              {permCan("create") && (
                <button type="button" onClick={openAdd} className="si-btn-primary">
                  <Plus size={16} />
                  <span>Add Partner</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="si-stats-grid">
            <div className={`si-stat-card ${statusFilter === "ALL" ? "active" : ""}`} onClick={() => setStatusFilter("ALL")}>
              <div>
                <div className="si-stat-label">Total Partners</div>
                <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Partners-s1" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-amber">
                <Handshake size={22} />
              </div>
            </div>

            <div className={`si-stat-card ${statusFilter === "1" ? "active" : ""}`} onClick={() => setStatusFilter("1")}>
              <div>
                <div className="si-stat-label">Shown on Home</div>
                <div className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="Partners-s2" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-green">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className={`si-stat-card ${statusFilter === "0" ? "active" : ""}`} onClick={() => setStatusFilter("0")}>
              <div>
                <div className="si-stat-label">Hidden</div>
                <div className="si-stat-value"><AnimatedNumber value={hiddenCount} pending={loading} id="Partners-s3" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-red">
                <Clock size={22} />
              </div>
            </div>

            <div className="si-stat-card" onClick={() => setStatusFilter("ALL")}>
              <div>
                <div className="si-stat-label">With Website Link</div>
                <div className="si-stat-value"><AnimatedNumber value={linkedCount} pending={loading} id="Partners-s4" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-blue">
                <Link2 size={22} />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <div className="si-filter-left">
              <div className="si-select-wrap">
                <span className="si-select-label">Status:</span>
                <select className="si-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Status</option>
                  <option value="1">Shown on Home Only</option>
                  <option value="0">Hidden Only</option>
                </select>
              </div>
            </div>

            <div className="si-search-form">
              <ListSearch
                placeholder="Search partners by name or website..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button data-refresh
                type="button"
                className="reload-btn"
                title="Reset & Reload"
                onClick={() => { setSearch(""); setStatusFilter("ALL"); load(); }}
              >
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          {/* List Card */}
          <div className="si-list-card">
            <div className="si-drag-hint">
              <GripVertical size={16} />
              <span>Drag items using the handle to reorder — the home page logo strip follows this exact order.</span>
            </div>

            {loading ? (
              <SkeletonList rows={5} />
            ) : displayedList.length === 0 ? (
              <div className="si-empty-box">
                <div className="si-empty-icon">
                  <Handshake size={28} />
                </div>
                <div className="si-empty-title">
                  {search ? "No matching partners found" : "No partners added yet"}
                </div>
                <p className="si-empty-desc">
                  {search
                    ? "Try adjusting your search criteria."
                    : "Add partner and client logos to show in the home page's \"Trusted by\" strip."}
                </p>
                <button className="si-btn-primary" onClick={() => { setSearch(""); setStatusFilter("ALL"); load(); }}>
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
            <SavedAgo endpoint="api/partners-list" />
          </div>

        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={closeModal}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "Edit Partner" : "Add Partner"}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                {permCan("edit", "create") && (<form onSubmit={save}>
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input className="form-control" value={form.name} maxLength={120}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. GokaTech" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Website link (optional)</label>
                    <input className="form-control" value={form.website} maxLength={500}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://www.example.com" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Logo {editing ? "(choose a new one to replace it)" : "*"}</label>
                    <label className="pt-drop">
                      <div className="pt-logo-box">
                        {preview ? <img src={preview} alt="Logo preview" /> : <ImageIcon size={24} />}
                      </div>
                      <div>
                        <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{file ? file.name : preview ? "Change logo" : "Choose logo"}</strong>
                        <small>PNG, JPG, WEBP or GIF · up to {MAX_LOGO_MB} MB · a wide logo on a transparent background looks best</small>
                      </div>
                      <input type="file" accept={LOGO_TYPES.join(",")} hidden
                        onChange={(e) => { pickFile(e.target.files?.[0] || null); e.target.value = ""; }} />
                    </label>
                    {saving && file && (
                      <div className="pt-progress"><span style={{ width: progress + "%" }} /></div>
                    )}
                  </div>
                  <button className="btn btn-success add w-100" disabled={saving}>
                    {saving ? <ButtonLoader label="Saving..." /> : editing ? "Update Partner" : "Add Partner"}
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
