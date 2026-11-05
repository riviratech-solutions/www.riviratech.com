import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePagePerm } from "../../../utils/adminPermissions";
import HomeSectionToggle from "../../../components/HomeSectionToggle";
import {
  Quote,
  Star,
  Plus,
  GripVertical,
  CheckCircle2,
  EyeOff,
  Edit3,
  Trash2,
  X,
  Sparkles,
  Layers,
  RotateCw,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonCards } from "../../../components/loading";

const seo = getSeoByPath("");

function TestimonialRow({
  item,
  onEdit,
  onDelete,
  onToggle,
  busy,
  index,
}: any) {
  const permCan = usePagePerm("testimonials");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : item.status === "1" ? 1 : 0.6,
    boxShadow: isDragging ? "0 14px 28px rgba(var(--ad-brand-rgb),0.15)" : "none",
    borderBottom: "1px solid #f1f5f9",
    background: isDragging ? "#faf8ff" : "#ffffff",
  };

  const getInitials = (name: string) => {
    if (!name) return "T";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarPalette = [
    { bg: "#ede9fe", text: "var(--ad-brand)" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#fef3c7", text: "#d97706" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#fce7f3", text: "#db2777" },
  ];
  const palette = avatarPalette[index % avatarPalette.length];

  return (
    <div ref={setNodeRef} style={style} className="si-testi-row">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="si-drag-handle"
      >
        <GripVertical size={16} />
      </div>

      {/* Avatar Badge */}
      <div
        className="si-avatar-badge"
        style={{ backgroundColor: palette.bg, color: palette.text }}
      >
        {getInitials(item.name)}
      </div>

      {/* Info & Quote */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
            {item.name}
          </span>
          {item.role && (
            <span
              style={{ fontSize: "12.5px", color: "#64748b", fontWeight: 500 }}
            >
              • {item.role}
            </span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              background: "#fffbeb",
              color: "#b45309",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11.5px",
              fontWeight: 700,
            }}
          >
            <Star size={12} style={{ fill: "#f59e0b", color: "#f59e0b" }} />{" "}
            {item.rating}
          </span>
        </div>

        <p
          style={{
            margin: "4px 0 0 0",
            fontSize: "13px",
            color: "#334155",
            lineHeight: 1.5,
          }}
        >
          "{item.feedback}"
        </p>

        {item.built && (
          <div style={{ marginTop: "4px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11.5px",
                color: "var(--ad-brand)",
                background: "#f5f3ff",
                padding: "2px 8px",
                borderRadius: "6px",
                fontWeight: 600,
              }}
            >
              <Sparkles size={11} /> Built: {item.built}
            </span>
          </div>
        )}
      </div>

      {/* Status Toggle Switch */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <label
          className="si-switch"
          title={
            item.status === "1"
              ? "Active — shown on website"
              : "Hidden from website"
          }
        >
          <input
            type="checkbox"
            disabled={!permCan("status")}
            checked={item.status === "1"}
            onChange={() => onToggle(item)}
          />
          <span className="si-slider round"></span>
        </label>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: item.status === "1" ? "#16a34a" : "#94a3b8",
            minWidth: "50px",
          }}
        >
          {item.status === "1" ? "Active" : "Hidden"}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {permCan("edit") && (
          <button
            className="si-action-btn btn-edit"
            onClick={() => onEdit(item)}
            title="Edit Testimonial"
          >
            <Edit3 size={15} />
          </button>
        )}
        {permCan("delete") && (
          <button
            className="si-action-btn btn-delete"
            disabled={busy}
            onClick={() => onDelete(item)}
            title="Delete Testimonial"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Testimonials() {
  const permCan = usePagePerm("testimonials");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [form, setForm] = useState({
    name: "",
    role: "",
    feedback: "",
    built: "",
    rating: "5",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/testimonials-list", {});
      if (res.data.success) {
        setList(res.data.data || []);
      } else {
        toast.error(res.data.message || "Failed to load");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", role: "", feedback: "", built: "", rating: "5" });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      role: item.role || "",
      feedback: item.feedback || "",
      built: item.built || "",
      rating: item.rating || "5",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const save = async (e: any) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Please enter a name");
    if (form.feedback.trim().length < 5)
      return toast.error(
        "Please enter a feedback message (at least 5 characters)",
      );

    setSaving(true);
    try {
      const s = await getSecurity();
      const path = editing ? "api/testimonials-update" : "api/testimonials-add";
      const payload: any = { ...form, key: s.key, token: s.token, aut: s.aut };
      if (editing) payload.id = editing.id;
      const res = await axios.post(SERVER_URL + path, payload, {
        withCredentials: true,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        if (editing) {
          setList((prev) =>
            prev.map((x) => (x.id === editing.id ? res.data.data : x)),
          );
        } else {
          setList((prev) => [...prev, res.data.data]);
        }
        closeModal();
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const del = async (item: any) => {
    if (!window.confirm(`Delete testimonial from "${item.name}"?`)) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/testimonials-delete",
        { id: item.id, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setList((prev) => prev.filter((x) => x.id !== item.id));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (item: any) => {
    const active = item.status !== "1";
    setList((prev) =>
      prev.map((x) =>
        x.id === item.id ? { ...x, status: active ? "1" : "1S" } : x,
      ),
    );
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/testimonials-toggle",
        { id: item.id, active, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message);
        setList((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, status: active ? "1S" : "1" } : x,
          ),
        );
      }
    } catch {
      toast.error("Something went wrong");
      setList((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, status: active ? "1S" : "1" } : x,
        ),
      );
    }
  };

  const saveOrder = async (ids: number[]) => {
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/testimonials-reorder",
        { ids, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (!res.data.success) {
        toast.error(res.data.message || "Could not save the new order");
      }
    } catch {
      toast.error("Could not save the new order");
    }
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
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    if (data.loggedIn && (data.id === "X" || data.id === "Y")) {
      load();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const filteredList = list.filter((item) => {
    if (statusFilter === "active" && item.status !== "1") return false;
    if (statusFilter === "hidden" && item.status === "1") return false;
    if (statusFilter === "rating" && (Number(item.rating) || 0) < 5)
      return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.role && item.role.toLowerCase().includes(q)) ||
      (item.feedback && item.feedback.toLowerCase().includes(q)) ||
      (item.built && item.built.toLowerCase().includes(q))
    );
  });

  const activeCount = list.filter((x) => x.status === "1").length;
  const hiddenCount = list.filter((x) => x.status !== "1").length;
  const avgRating =
    list.length > 0
      ? (
          list.reduce((acc, x) => acc + (Number(x.rating) || 5), 0) /
          list.length
        ).toFixed(1)
      : "5.0";

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2000} />

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
          border-radius: 14px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ad-brand);
          flex-shrink: 0;
        }
        .si-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .si-header-subtitle {
          font-size: 13.5px;
          color: #64748b;
          margin-top: 3px;
          margin-bottom: 0;
        }
          
        .si-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #fee2e2;
          color: var(--ad-brand);
          font-size: 12px;
          font-weight: 700;
          border-radius: 20px;
          margin-left: 20px;
        }
        .si-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .si-total-badge {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 14px;
          font-size: 13.5px;
          color: #475569;
          font-weight: 500;
        }
        .si-total-badge b {
          color: var(--ad-brand);
          font-weight: 700;
        }
        .si-btn-primary {
          background: var(--ad-brand);
          border: 1.5px solid var(--ad-brand);
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-primary:hover {
          background: #4b24d6;
          border-color: #4b24d6;
          color: #ffffff;
          transform: translateY(-1px);
        }

        /* Stat Cards */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 1024px) {
          .si-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .si-stats-grid {
            grid-template-columns: 1fr;
          }
        }
        .si-stat-card {
          border-radius: 16px;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid rgba(0, 0, 0, 0.04);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          cursor: pointer;
          user-select: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-total.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-card.card-active {
          background: #f0fdf4;
        }
        .si-stat-card.card-active.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-hidden {
          background: #faf5ff;
        }
        .si-stat-card.card-hidden.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
        }
        .si-stat-card.card-rating {
          background: #fffbeb;
        }
        .si-stat-card.card-rating.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .si-stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
          margin: 0;
        }
        .si-stat-value {
          font-size: 26px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.1;
          margin-top: 4px;
          margin-bottom: 0;
        }

        /* Filter Bar */
        .si-filter-bar {
          background: #ffffff;
          border-radius: 14px;
          padding: 12px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
          gap: 14px;
        }
        .si-search-box {
          display: flex;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          background: #ffffff;
          min-width: 300px;
          gap: 8px;
          transition: border-color 0.15s ease;
        }
        .si-search-box:focus-within {
          border-color: var(--ad-brand);
        }
        .si-search-input {
          border: none;
          outline: none;
          font-size: 13px;
          color: #1e293b;
          width: 100%;
          background: transparent;
        }

        /* Container Card */
        .si-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          margin-bottom: 24px;
        }
        .si-testi-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          transition: background 0.15s ease;
        }
        .si-testi-row:hover {
          background: #fafbff;
        }
        .si-drag-handle {
          cursor: grab;
          color: #94a3b8;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: none;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .si-drag-handle:hover {
          color: var(--ad-brand);
          background: #ede9fe;
        }
        .si-avatar-badge {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }

        /* Switch */
        .si-switch {
          position: relative;
          display: inline-block;
          width: 42px;
          height: 24px;
          margin: 0;
        }
        .si-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .si-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: 0.2s;
        }
        .si-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        input:checked + .si-slider {
          background-color: #16a34a;
        }
        input:checked + .si-slider:before {
          transform: translateX(18px);
        }
        .si-slider.round {
          border-radius: 24px;
        }
        .si-slider.round:before {
          border-radius: 50%;
        }

        /* Action Buttons */
        .si-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-action-btn.btn-edit {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.btn-edit:hover {
          background: #ddd6fe;
          transform: scale(1.05);
        }
        .si-action-btn.btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-action-btn.btn-delete:hover:not(:disabled) {
          background: #fecaca;
          transform: scale(1.05);
        }

        /* Modal */
        .si-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1050;
          padding: 16px;
        }
        .si-modal-card {
          background: #ffffff;
          border-radius: 20px;
          width: 100%;
          max-width: 540px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          animation: modalFadeIn 0.2s ease-out;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .si-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .si-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-modal-close:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .si-modal-body {
          padding: 24px;
        }
        .si-form-group {
          margin-bottom: 16px;
        }
        .si-form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
        }
        .si-form-control {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 13px;
          font-size: 13.5px;
          color: #1e293b;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .si-form-control:focus {
          border-color: var(--ad-brand);
        }
        .si-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          background: #fafbfc;
          border-radius: 0 0 20px 20px;
        }
      `}</style>

      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Quote size={24} />
              </div>
              <div>
                <h1 className="si-header-title">
                  Testimonials
                  <span className="si-count-badge">{list.length} Total</span>
                </h1>
                <p className="si-header-subtitle">
                  Customer reviews shown on the home page. Drag handles to
                  reorder live on site.
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <button data-refresh type="button" className="reload-btn" title="Refresh" aria-label="Refresh" onClick={() => load()}>
                <RotateCw size={17} />
              </button>
              {/* whole-section switch for the website home page */}
              <HomeSectionToggle
                section="testimonials"
                visibleCount={activeCount}
                canChange={permCan("status")}
              />
              {permCan("create") && (
                <button className="si-btn-primary" onClick={openAdd}>
                  <Plus size={16} /> Add Testimonial
                </button>
              )}
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card card-total ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
              title="Show all testimonials"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <Layers size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Testimonials</p>
                <h3 className="si-stat-value"><AnimatedNumber value={list.length} pending={loading} id="Testimonials-s1" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-active ${statusFilter === "active" ? "active" : ""}`}
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === "active" ? "ALL" : "active",
                )
              }
              title={
                statusFilter === "active"
                  ? "Click to show all"
                  : "Filter by Active on Home"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="si-stat-label">Active on Home</p>
                <h3 className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="Testimonials-s2" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-hidden ${statusFilter === "hidden" ? "active" : ""}`}
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === "hidden" ? "ALL" : "hidden",
                )
              }
              title={
                statusFilter === "hidden"
                  ? "Click to show all"
                  : "Filter by Hidden / Draft"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
              >
                <EyeOff size={22} />
              </div>
              <div>
                <p className="si-stat-label">Hidden / Draft</p>
                <h3 className="si-stat-value"><AnimatedNumber value={hiddenCount} pending={loading} id="Testimonials-s3" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-rating ${statusFilter === "rating" ? "active" : ""}`}
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === "rating" ? "ALL" : "rating",
                )
              }
              title={
                statusFilter === "rating"
                  ? "Click to show all"
                  : "Filter by 5-Star Rating"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Star size={22} style={{ fill: "#d97706" }} />
              </div>
              <div>
                <p className="si-stat-label">Average Rating</p>
                <h3 className="si-stat-value">
                  <AnimatedNumber value={avgRating} pending={loading} id="Testimonials-s4" />{" "}
                  <span style={{ fontSize: "16px", color: "#f59e0b" }}>★</span>
                </h3>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="si-filter-bar">
            <ListSearch
              placeholder="Search by student, company, or quote..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div
              style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}
            >
              Showing <b>{filteredList.length}</b> of <b>{list.length}</b>
            </div>
          </div>

          {/* Draggable List */}
          {loading ? (
            <SkeletonCards variant="grid" count={6} />
          ) : filteredList.length === 0 ? (
            <div
              className="si-table-card"
              style={{ textAlign: "center", padding: "64px 20px" }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  marginBottom: "16px",
                }}
              >
                <Quote size={26} />
              </div>
              <h4
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#1e293b",
                  margin: 0,
                }}
              >
                {search
                  ? "No Matching Testimonials"
                  : statusFilter !== "ALL"
                    ? `No ${statusFilter === "active" ? "Active" : statusFilter === "hidden" ? "Hidden / Draft" : "5-Star"} Testimonials`
                    : "No Testimonials Yet"}
              </h4>
              <p
                style={{
                  fontSize: "13.5px",
                  color: "#64748b",
                  marginTop: "6px",
                }}
              >
                {search
                  ? `No testimonials matched "${search}".`
                  : statusFilter !== "ALL"
                    ? "No testimonials match the selected status filter."
                    : "Add student reviews to showcase on your homepage."}
              </p>
              {search || statusFilter !== "ALL" ? (
                <button
                  className="si-btn-primary"
                  style={{ marginTop: "8px" }}
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear Filter
                </button>
              ) : (
                permCan("create") && (
                  <button
                    className="si-btn-primary"
                    style={{ marginTop: "8px" }}
                    onClick={openAdd}
                  >
                    <Plus size={16} /> Add Testimonial
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="si-table-card">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={permCan("reorder") ? onDragEnd : undefined}
              >
                <SortableContext
                  items={filteredList.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div>
                    {filteredList.map((item, index) => (
                      <TestimonialRow
                        key={item.id}
                        item={item}
                        index={index}
                        onEdit={openEdit}
                        onDelete={del}
                        onToggle={toggle}
                        busy={busyId === item.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
          <div className="saved-ago-row">
            <SavedAgo endpoint="api/testimonials-list" />
          </div>
        </div>

        {/* Add / Edit Modal */}
        {modalOpen && (
          <div className="si-modal-overlay" onClick={closeModal}>
            <div className="si-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="si-modal-header">
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#eef2ff",
                      color: "var(--ad-brand)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Quote size={18} />
                  </div>
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {editing ? "Edit Testimonial" : "Add Testimonial"}
                    </h4>
                    <p
                      style={{ margin: 0, fontSize: "12px", color: "#64748b" }}
                    >
                      {editing
                        ? `Update ${editing.name}'s testimonial`
                        : "Create a new homepage review"}
                    </p>
                  </div>
                </div>

                <button className="si-modal-close" onClick={closeModal}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={save}>
                <div className="si-modal-body">
                  <div className="si-form-group">
                    <label className="si-form-label">Student Name *</label>
                    <input
                      type="text"
                      required
                      className="si-form-control"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="e.g. Alex Chen"
                    />
                  </div>

                  <div className="si-form-group">
                    <label className="si-form-label">Role or Company</label>
                    <input
                      type="text"
                      className="si-form-control"
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                      placeholder="e.g. AI Engineer at Google, Alumnus"
                    />
                  </div>

                  <div className="si-form-group">
                    <label className="si-form-label">Feedback / Review *</label>
                    <textarea
                      rows={4}
                      required
                      className="si-form-control"
                      value={form.feedback}
                      onChange={(e) =>
                        setForm({ ...form, feedback: e.target.value })
                      }
                      placeholder="What they loved about the program and mentorship..."
                    />
                  </div>

                  <div className="si-form-group">
                    <label className="si-form-label">
                      Built Project (optional)
                    </label>
                    <input
                      type="text"
                      className="si-form-control"
                      value={form.built}
                      onChange={(e) =>
                        setForm({ ...form, built: e.target.value })
                      }
                      placeholder="e.g. Autonomous Multi-Agent RAG System"
                    />
                  </div>

                  <div className="si-form-group" style={{ marginBottom: 0 }}>
                    <label className="si-form-label">Star Rating</label>
                    <select
                      className="si-form-control"
                      value={form.rating}
                      onChange={(e) =>
                        setForm({ ...form, rating: e.target.value })
                      }
                    >
                      <option value="5">5.0 ★★★★★ (Exceptional)</option>
                      <option value="4.5">4.5 ★★★★☆ (Great)</option>
                      <option value="4">4.0 ★★★★☆ (Good)</option>
                      <option value="3.5">3.5 ★★★☆☆ (Above Average)</option>
                      <option value="3">3.0 ★★★☆☆ (Average)</option>
                    </select>
                  </div>
                </div>

                <div className="si-modal-footer">
                  <button
                    type="button"
                    className="si-btn-primary"
                    style={{
                      background: "#ffffff",
                      borderColor: "#cbd5e1",
                      color: "#475569",
                    }}
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="si-btn-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editing
                        ? "Update Testimonial"
                        : "Create Testimonial"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
