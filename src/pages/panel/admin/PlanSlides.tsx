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
import { PLANS } from "../../../utils/subscriptions";
import {
  Sliders,
  Plus,
  RotateCw,
  CheckCircle2,
  Trash2,
  Edit2,
  GripVertical,
  Layers,
  EyeOff,
  Save,
  Check,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonList } from "../../../components/loading";

const seo = getSeoByPath("");

/* Panel → Plan Slides (/panel/plan-slides). Manages the home page "Learn your
   way" slider: the heading above it (plan_section) and its cards (plan_slides).
   Each card names a plan — bundle / monthly / individual — which decides the
   program-page plan and the Stripe checkout its buttons open. The price on a
   card is display text; checkout charges the plan's own amount (shown as a
   hint in the form). */

const PLAN_NAMES: Record<string, string> = {
  bundle: "Bundle subscription",
  monthly: "Monthly subscription",
  individual: "Individual course",
};

const THEMES: [string, string, string][] = [
  ["a", "Midnight", "linear-gradient(150deg, #0a0f1e, #111c3a)"],
  ["b", "Navy", "linear-gradient(150deg, #0b1220, #16213f)"],
  ["c", "Indigo", "linear-gradient(150deg, #15203d, #0a0f1e)"],
];

const themeBg = (t: string) => (THEMES.find((x) => x[0] === t) || THEMES[0])[2];
const planInfo = (k: string) => PLANS.find((p) => p.key === k);

const EMPTY = {
  plan: "bundle",
  tag: "",
  title: "",
  description: "",
  points: [""],
  cta: "",
  link_text: "View program details →",
  price: "",
  unit: "/ month",
  badge: "Live + Recorded",
  theme: "a",
};

function Row({ item, onEdit, onDelete, onToggle, busy, canReorder }: any) {
  const permCan = usePagePerm("plan-slides");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const shown = item.status === "1";
  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : shown ? 1 : 0.65,
    boxShadow: isDragging
      ? "0 12px 30px rgba(16,23,41,.15)"
      : "0 1px 3px rgba(0,0,0,0.04)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "16px 20px",
    transitionProperty: "transform, box-shadow, opacity",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {canReorder ? (
        <span
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          style={{
            cursor: "grab",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            padding: "4px",
          }}
        >
          <GripVertical size={18} />
        </span>
      ) : (
        <span
          style={{
            color: "#cbd5e1",
            display: "flex",
            alignItems: "center",
            padding: "4px",
          }}
          title="Drag disabled during search/filter"
        >
          <GripVertical size={18} />
        </span>
      )}

      {/* Theme Swatch / Price Card */}
      <div
        style={{
          background: themeBg(item.theme),
          color: "#ffffff",
          borderRadius: 12,
          padding: "10px 16px",
          minWidth: 110,
          textAlign: "center",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontSize: "17px", fontWeight: 800, lineHeight: 1.2 }}>
          {item.price || "$0"}
        </div>
        <div
          style={{
            fontSize: "11px",
            opacity: 0.85,
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          {item.unit || "/ mo"}
        </div>
      </div>

      {/* Main Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          {item.tag && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--ad-brand)",
                background: "#e0e7ff",
                padding: "2px 8px",
                borderRadius: 6,
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              {item.tag}
            </span>
          )}
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              background: "#f1f5f9",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}
          >
            {PLAN_NAMES[item.plan] || item.plan}
          </span>
          {item.badge && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#059669",
                background: "#d1fae5",
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              {item.badge}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 4,
          }}
        >
          {item.title}
        </div>

        {item.description && (
          <div
            style={{
              fontSize: "12.5px",
              color: "#64748b",
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            {item.description}
          </div>
        )}

        {Array.isArray(item.points) && item.points.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {item.points.filter(Boolean).map((pt: string, idx: number) => (
              <span
                key={idx}
                style={{
                  fontSize: "11.5px",
                  color: "#475569",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "2px 8px",
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Check size={12} className="text-success" />
                {pt}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status Pill */}
      <div>
        {shown ? (
          <span className="si-status-pill si-status-active">
            <span className="si-status-dot" /> Shown
          </span>
        ) : (
          <span className="si-status-pill si-status-disabled">
            <span className="si-status-dot" /> Hidden
          </span>
        )}
      </div>

      {/* Switch */}
      <div
        className="form-check form-switch m-0"
        title={shown ? "Shown on the home page" : "Hidden from the home page"}
      >
        <input
          disabled={!permCan("status")}
          className="form-check-input"
          type="checkbox"
          style={{ cursor: "pointer" }}
          checked={shown}
          onChange={() => onToggle(item)}
        />
      </div>

      {/* Actions */}
      <div className="si-action-btns">
        {permCan("edit") && (
          <button
            type="button"
            className="si-action-btn btn-edit"
            onClick={() => onEdit(item)}
            title="Edit Slide"
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
            title="Delete Slide"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function PlanSlides() {
  const permCan = usePagePerm("plan-slides");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [section, setSection] = useState({
    eyebrow: "",
    title: "",
    subtitle: "",
    autoplay: 6,
    status: "1",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSec, setSavingSec] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;
  const post = async (path: string, body: any) => {
    // the slide list comes from the saved copy when there is one (utils/listCache.ts)
    if (path === "list") return (await listFetch("api/plan-slides/list", body)).data;
    const s = await getSecurity();
    return (
      await axios.post(
        SERVER_URL + "api/plan-slides/" + path,
        { ...body, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      )
    ).data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const d = await post("list", {});
      if (d.success) {
        setList(d.data);
        setSection(d.section);
      } else toast.error(d.message || "Failed to load");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const saveSection = async (e: any) => {
    e.preventDefault();
    if (!section.title.trim())
      return toast.error("Please enter the section heading");
    setSavingSec(true);
    try {
      const d = await post("section", section);
      if (d.success) {
        toast.success(d.message);
        setSection(d.section);
      } else toast.error(d.message);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingSec(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, price: planInfo("bundle")?.price || "" });
    setModalOpen(true);
  };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      ...EMPTY,
      ...item,
      points: item.points.length ? [...item.points] : [""],
    });
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // switching plan pre-fills price / unit when they still match the old plan
  const changePlan = (plan: string) =>
    setForm((f: any) => {
      const was = planInfo(f.plan);
      const next = planInfo(plan);
      const out = { ...f, plan };
      if (next && (!f.price || f.price === was?.price)) out.price = next.price;
      if (next && plan === "individual" && f.unit === "/ month")
        out.unit = "/ one-time";
      if (next && plan !== "individual" && f.unit === "/ one-time")
        out.unit = "/ month";
      return out;
    });

  const setPoint = (k: number, v: string) =>
    setForm((f: any) => ({
      ...f,
      points: f.points.map((p: string, j: number) => (j === k ? v : p)),
    }));
  const addPoint = () =>
    setForm((f: any) =>
      f.points.length >= 6 ? f : { ...f, points: [...f.points, ""] },
    );
  const removePoint = (k: number) =>
    setForm((f: any) => ({
      ...f,
      points:
        f.points.length > 1
          ? f.points.filter((_: string, j: number) => j !== k)
          : [""],
    }));

  const save = async (e: any) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Please enter a title");
    if (!form.price.trim())
      return toast.error("Please enter the price shown on the card");
    if (!form.cta.trim()) return toast.error("Please enter the button text");
    setSaving(true);
    try {
      const body: any = {
        ...form,
        points: form.points.map((p: string) => p.trim()).filter(Boolean),
      };
      if (editing) body.id = editing.id;
      else delete body.id;
      const d = await post("save", body);
      if (d.success) {
        toast.success(d.message);
        if (editing)
          setList((prev) =>
            prev.map((x) => (x.id === editing.id ? d.data : x)),
          );
        else setList((prev) => [...prev, d.data]);
        closeModal();
      } else toast.error(d.message);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const del = async (item: any) => {
    if (
      !window.confirm(`Delete the "${item.title}" slide? This can't be undone.`)
    )
      return;
    setBusyId(item.id);
    try {
      const d = await post("delete", { id: item.id });
      if (d.success) {
        toast.success(d.message);
        setList((prev) => prev.filter((x) => x.id !== item.id));
      } else toast.error(d.message);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (item: any) => {
    const active = item.status !== "1";
    const flip = (on: boolean) =>
      setList((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, status: on ? "1" : "1S" } : x,
        ),
      );
    flip(active);
    try {
      const d = await post("toggle", { id: item.id, active });
      if (d.success) toast.success(d.message);
      else {
        toast.error(d.message);
        flip(!active);
      }
    } catch {
      toast.error("Something went wrong");
      flip(!active);
    }
  };

  const onDragEnd = async (e: any) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = list.findIndex((i) => i.id === active.id);
    const newI = list.findIndex((i) => i.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(list, oldI, newI);
    setList(next);
    try {
      const d = await post("reorder", { ids: next.map((i) => i.id) });
      if (!d.success) toast.error(d.message || "Could not save the new order");
    } catch {
      toast.error("Could not save the new order");
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y"))
          load();
        else navigate("/logout");
      })
      .catch(() => navigate("/logout"));
  }, []);

  const totalCount = list.length;
  const shownCount = list.filter((x) => x.status === "1").length;
  const hiddenCount = list.filter((x) => x.status !== "1").length;
  const bundlesCount = list.filter(
    (x) => x.plan === "bundle" || x.plan === "monthly",
  ).length;

  const canReorder =
    permCan("reorder") && statusFilter === "ALL" && !search.trim();

  const displayedList = list.filter((item) => {
    if (statusFilter === "1" && item.status !== "1") return false;
    if (statusFilter === "0" && item.status === "1") return false;
    if (
      statusFilter === "bundle" &&
      item.plan !== "bundle" &&
      item.plan !== "monthly"
    )
      return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchTag = (item.tag || "").toLowerCase().includes(q);
      const matchDesc = (item.description || "").toLowerCase().includes(q);
      const matchPlan = (PLAN_NAMES[item.plan] || item.plan || "")
        .toLowerCase()
        .includes(q);
      if (!matchTitle && !matchTag && !matchDesc && !matchPlan) return false;
    }
    return true;
  });

  const plan = planInfo(form.plan);
  const pts = form.points.map((p: string) => p.trim()).filter(Boolean);

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
          border-radius: 12px;
          background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25);
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
          background: #e0e7ff;
          color: var(--ad-brand-2);
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
          background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
          color: #ffffff !important;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.2);
          text-decoration: none;
        }
        .si-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(var(--ad-brand-rgb), 0.3);
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
          box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.15);
          border-color: var(--ad-brand);
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

        .si-section-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 20px 24px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .si-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        .si-section-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

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
          border-color: var(--ad-brand);
          box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.1);
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
          background: #e0e7ff;
          color: var(--ad-brand-2);
          border-color: #c7d2fe;
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

      {/* Main Content */}
      <div className="content">
        <div className="si-page-wrapper">
          {/* Header Card */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Sliders size={24} />
              </div>
              <div>
                <h3 className="si-header-title">
                  Plan Slides
                  <span className="si-count-badge">{totalCount} Total</span>
                </h3>
                <p className="si-header-subtitle">
                  Manage the "Learn your way" subscription & course cards slider
                  on the home page
                </p>
              </div>
            </div>

            <div className="si-header-actions">
              {permCan("create") && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="si-btn-primary"
                >
                  <Plus size={16} />
                  <span>Add Slide</span>
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
                <div className="si-stat-label">Total Slides</div>
                <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="PlanSlides-s1" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-purple">
                <Sliders size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${statusFilter === "1" ? "active" : ""}`}
              onClick={() => setStatusFilter("1")}
            >
              <div>
                <div className="si-stat-label">Shown on Home</div>
                <div className="si-stat-value"><AnimatedNumber value={shownCount} pending={loading} id="PlanSlides-s2" /></div>
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
                <div className="si-stat-value"><AnimatedNumber value={hiddenCount} pending={loading} id="PlanSlides-s3" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-amber">
                <EyeOff size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${statusFilter === "bundle" ? "active" : ""}`}
              onClick={() =>
                setStatusFilter(statusFilter === "bundle" ? "ALL" : "bundle")
              }
            >
              <div>
                <div className="si-stat-label">Subscriptions</div>
                <div className="si-stat-value"><AnimatedNumber value={bundlesCount} pending={loading} id="PlanSlides-s4" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-blue">
                <Layers size={22} />
              </div>
            </div>
          </div>

          {/* Home Page Section Heading Card */}
          <form className="si-section-card" onSubmit={saveSection}>
            <div className="si-section-header">
              <h4 className="si-section-title">
                <Layers size={18} className="text-primary" />
                <span>Section Heading & Autoplay Settings</span>
              </h4>
              <div
                className="form-check form-switch m-0"
                title="Show or hide the whole slider on the home page"
              >
                <input
                  id="psl-show"
                  className="form-check-input"
                  type="checkbox"
                  disabled={!permCan("section")}
                  checked={section.status !== "0"}
                  onChange={(e) =>
                    setSection({
                      ...section,
                      status: e.target.checked ? "1" : "0",
                    })
                  }
                  style={{ cursor: "pointer" }}
                />
                <label
                  className="form-check-label fw-bold ms-1"
                  htmlFor="psl-show"
                  style={{ cursor: "pointer", fontSize: 13 }}
                >
                  {section.status !== "0"
                    ? `Shown on home (${shownCount} active slide${shownCount === 1 ? "" : "s"})`
                    : "Section hidden"}
                </label>
              </div>
            </div>

            <fieldset disabled={!permCan("section")}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Eyebrow
                  </label>
                  <input
                    className="form-control form-control-sm"
                    maxLength={40}
                    value={section.eyebrow}
                    placeholder="e.g. Flexible Access"
                    onChange={(e) =>
                      setSection({ ...section, eyebrow: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Heading *
                  </label>
                  <input
                    className="form-control form-control-sm"
                    maxLength={120}
                    value={section.title}
                    placeholder="e.g. Learn your way, at your pace"
                    onChange={(e) =>
                      setSection({ ...section, title: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Auto-slide (seconds, 0 = off)
                  </label>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    min={0}
                    max={30}
                    value={section.autoplay}
                    onChange={(e) =>
                      setSection({
                        ...section,
                        autoplay: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="col-md-9">
                  <label className="form-label small fw-semibold text-secondary mb-1">
                    Subtitle
                  </label>
                  <input
                    className="form-control form-control-sm"
                    maxLength={300}
                    value={section.subtitle}
                    placeholder="e.g. Choose between monthly access to all courses or single program enrollment"
                    onChange={(e) =>
                      setSection({ ...section, subtitle: e.target.value })
                    }
                  />
                </div>
                {permCan("section") && (
                  <div className="col-md-3 d-flex align-items-end">
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2"
                      disabled={savingSec}
                    >
                      <Save size={15} />
                      <span>{savingSec ? <ButtonLoader label="Saving..." /> : "Save Heading"}</span>
                    </button>
                  </div>
                )}
              </div>
            </fieldset>
          </form>

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
                  <option value="ALL">All Statuses ({totalCount})</option>
                  <option value="1">Shown on Home ({shownCount})</option>
                  <option value="0">Hidden ({hiddenCount})</option>
                  <option value="bundle">Subscriptions ({bundlesCount})</option>
                </select>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-grow-1 justify-content-end">
              <div className="si-search-form">
                <ListSearch
                  placeholder="Search slides by title, tag, plan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button data-refresh
                type="button"
                className="reload-btn"
                onClick={load}
                title="Reload slides"
              >
                <RotateCw size={15} className={loading ? "fa-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Slides List Card */}
          <div className="si-list-card">
            <div className="si-drag-hint">
              <GripVertical size={16} className="text-secondary" />
              <span>
                {canReorder
                  ? "Drag handles (⋮⋮) to reorder slides. Order is saved automatically and matches the home slider."
                  : "Drag-and-drop reordering is enabled when viewing all slides with no search query."}
              </span>
            </div>

            {loading ? (
              <SkeletonList rows={5} />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={canReorder ? onDragEnd : undefined}
              >
                <SortableContext
                  items={displayedList.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {displayedList.map((item) => (
                      <Row
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onDelete={del}
                        onToggle={toggle}
                        busy={busyId === item.id}
                        canReorder={canReorder}
                      />
                    ))}

                    {displayedList.length === 0 && (
                      <div className="si-empty-box">
                        <div className="si-empty-icon">
                          <Layers size={24} />
                        </div>
                        <h4 className="si-empty-title">No slides found</h4>
                        <p className="si-empty-desc">
                          {list.length === 0
                            ? "The slider stays hidden on the home page until a slide is created."
                            : "No slides match your current filter or search criteria."}
                        </p>
                        {list.length === 0 && permCan("create") && (
                          <button
                            type="button"
                            onClick={openAdd}
                            className="si-btn-primary mx-auto"
                          >
                            <Plus size={16} />
                            <span>Create First Slide</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
          <div className="saved-ago-row">
            <SavedAgo endpoint="api/plan-slides/list" />
          </div>
        </div>

        {/* Add / Edit modal */}
        {modalOpen && (
          <div
            className="modal fade show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={closeModal}
          >
            <div
              className="modal-dialog modal-xl modal-dialog-scrollable"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="modal-content"
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  className="modal-header"
                  style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <h5
                    className="modal-title fw-bold d-flex align-items-center gap-2"
                    style={{ color: "#0f172a" }}
                  >
                    <Sliders size={20} className="text-primary" />
                    <span>{editing ? "Edit Slide" : "Add Slide"}</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                  ></button>
                </div>
                <form onSubmit={save} className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Plan *</label>
                      <select
                        className="form-select"
                        value={form.plan}
                        onChange={(e) => changePlan(e.target.value)}
                      >
                        {Object.entries(PLAN_NAMES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      {plan && (
                        <div className="form-text d-flex align-items-center gap-1 mt-1">
                          <Info size={13} className="text-muted" />
                          <span>
                            Buttons open checkout charging{" "}
                            <b>
                              {plan.price} {plan.unit}
                            </b>
                            .
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Tag</label>
                      <input
                        className="form-control"
                        maxLength={60}
                        value={form.tag}
                        placeholder="Monthly Subscription"
                        onChange={(e) => set("tag", e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">
                        Card Colour Theme
                      </label>
                      <div className="psl-themes">
                        {THEMES.map(([k, label, bg]) => (
                          <button
                            type="button"
                            key={k}
                            className={
                              "psl-theme" + (form.theme === k ? " on" : "")
                            }
                            style={{ background: bg }}
                            onClick={() => set("theme", k)}
                            title={label}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Title *</label>
                      <input
                        className="form-control"
                        maxLength={120}
                        value={form.title}
                        placeholder="One Program, Month-to-Month"
                        onChange={(e) => set("title", e.target.value)}
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">
                        Description
                      </label>
                      <textarea
                        className="form-control"
                        rows={2}
                        maxLength={600}
                        value={form.description}
                        placeholder="Summary of what this plan includes..."
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </div>

                    <div className="col-md-12">
                      <label className="form-label fw-semibold">
                        Points{" "}
                        <small className="text-muted">
                          (up to 6 key highlights shown with ticks)
                        </small>
                      </label>
                      {form.points.map((p: string, k: number) => (
                        <div className="input-group mb-2" key={k}>
                          <span className="input-group-text bg-light">
                            <Check size={15} className="text-success" />
                          </span>
                          <input
                            className="form-control"
                            maxLength={80}
                            value={p}
                            placeholder="e.g. Live + recorded access, Discord community"
                            onChange={(e) => setPoint(k, e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={() => removePoint(k)}
                            title="Remove point"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                      {form.points.length < 6 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                          onClick={addPoint}
                        >
                          <Plus size={14} /> <span>Add Point</span>
                        </button>
                      )}
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold">
                        Price shown *
                      </label>
                      <input
                        className="form-control"
                        maxLength={20}
                        value={form.price}
                        placeholder="$50"
                        onChange={(e) => set("price", e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">
                        Price unit
                      </label>
                      <input
                        className="form-control"
                        maxLength={30}
                        value={form.unit}
                        placeholder="/ month"
                        onChange={(e) => set("unit", e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">
                        Button text *
                      </label>
                      <input
                        className="form-control"
                        maxLength={40}
                        value={form.cta}
                        placeholder="Start Monthly"
                        onChange={(e) => set("cta", e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">
                        Link text
                      </label>
                      <input
                        className="form-control"
                        maxLength={60}
                        value={form.link_text}
                        placeholder="View program details →"
                        onChange={(e) => set("link_text", e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Badge</label>
                      <input
                        className="form-control"
                        maxLength={40}
                        value={form.badge}
                        placeholder="Live + Recorded"
                        onChange={(e) => set("badge", e.target.value)}
                      />
                    </div>
                    {plan &&
                      form.price.trim() &&
                      form.price.trim() !== plan.price && (
                        <div className="col-md-9 d-flex align-items-end">
                          <div className="alert alert-warning py-2 px-3 mb-0 w-100 small d-flex align-items-center gap-2">
                            <AlertTriangle
                              size={16}
                              className="flex-shrink-0"
                            />
                            <span>
                              The card shows <b>{form.price}</b> but Stripe
                              checkout charges <b>{plan.price}</b> for this
                              plan.
                            </span>
                          </div>
                        </div>
                      )}

                    {/* live preview */}
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">
                        Live Preview
                      </label>
                      <div
                        className="psl-preview"
                        style={{ background: themeBg(form.theme) }}
                      >
                        <div className="psl-pv-left">
                          {form.tag && (
                            <span className="psl-pv-tag">{form.tag}</span>
                          )}
                          <h4>{form.title || "Slide title"}</h4>
                          {form.description && <p>{form.description}</p>}
                          {pts.length > 0 && (
                            <ul>
                              {pts.map((p: string, k: number) => (
                                <li key={k}>
                                  <i className="fa fa-check"></i> {p}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="psl-pv-actions">
                            <span className="psl-pv-btn">
                              {form.cta || "Button"}
                            </span>
                            {form.link_text && (
                              <span className="psl-pv-link">
                                {form.link_text}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="psl-pv-right">
                          <b>{form.price || "$0"}</b>
                          {form.unit && <small>{form.unit}</small>}
                          {form.badge && (
                            <span className="psl-pv-badge">
                              <i className="fa fa-video"></i> {form.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-md-12 pt-2">
                      <button
                        className="btn btn-success w-100 py-2 fw-semibold"
                        disabled={
                          saving || !permCan(editing ? "edit" : "create")
                        }
                      >
                        {saving
                          ? "Saving..."
                          : editing
                            ? "Update Slide"
                            : "Add Slide"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
