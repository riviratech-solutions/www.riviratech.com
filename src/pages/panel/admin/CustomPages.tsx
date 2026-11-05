import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useRef, useMemo } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import MonacoEditor from "@monaco-editor/react";
import { components } from "../../../components/library";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Plus,
  RotateCw,
  ArrowLeft,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Code,
  Layers,
  Globe,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

const pageSlugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .split("/")
    .map((seg) =>
      seg
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("/");

export default function CustomPages() {
  const permCan = usePagePerm("pages");
  const navigate = useNavigate();

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"board" | "add" | "update">("board");
  const [model, setModel] = useState<"view" | "preview">("view");

  const initialForm = {
    id: "",
    req_id: "",
    slug: "",
    title: "",
    html: "",
    css: "",
    datetime: "",
    status: "",
  };
  const [form, setForm] = useState(initialForm);
  const [slugTouched, setSlugTouched] = useState(false);

  function timestampToDateTime(ts: any) {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [lastPage, setLastPage] = useState(0);

  const loadDetails = async (p = 1, q = search, s = sort) => {
    setLoading(true);
    setPage(p);
    setSearch(q);
    setSort(s);
    try {
      const res = await listFetch("api/pages", {
          q,
          s,
          n: p,
        });
      if (res.data.success) {
        setAllLists(res.data.data || []);
        setTotal(res.data.total || 0);
        setLastPage(res.data.lastPage || 1);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const addList = async (e: any) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    if (!form.title.trim()) {
      setError("❌ Please enter page title");
      return;
    }
    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/add-page",
        {
          ...form,
          slug: pageSlugify(form.slug || form.title),
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setAllLists((prev) => [res.data.data, ...prev]);
        setTotal((t) => t + 1);
        setForm(initialForm);
        setSlugTouched(false);
        setMode("board");
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const updateList = async (e: any) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    if (!form.title.trim()) {
      setError("❌ Please enter page title");
      return;
    }
    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-page",
        {
          ...form,
          slug: pageSlugify(form.slug || form.title),
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        const updated = res.data.data;
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === updated.req_id ? { ...b, ...updated } : b,
          ),
        );
        setMode("board");
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const disableList = async (list: any) => {
    setSuccess("");
    setError("");
    if (
      !window.confirm(
        "Are you sure you want to disable '" + list.title + "' page?",
      )
    )
      return;
    try {
      setLoadingId(list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-page",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === list.req_id ? { ...b, status: "1S" } : b,
          ),
        );
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const enableList = async (list: any) => {
    setSuccess("");
    setError("");
    if (
      !window.confirm(
        "Are you sure you want to enable '" + list.title + "' page?",
      )
    )
      return;
    try {
      setLoadingId(list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-page",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === list.req_id ? { ...b, status: "1" } : b,
          ),
        );
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");
    if (
      !window.confirm(
        "Delete page '" + list.title + "' permanently? This cannot be undone.",
      )
    )
      return;
    try {
      setLoadingId(list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-page",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) => prev.filter((b) => b.req_id !== list.req_id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const moveto = (m: "board" | "add" | "update") => {
    setSuccess("");
    setError("");
    setMode(m);
    if (m === "add") {
      setModel("view");
      setForm(initialForm);
      setSlugTouched(false);
    }
  };

  const updateto = (list: any) => {
    setForm({
      id: list.id,
      req_id: list.req_id,
      slug: list.slug || "",
      title: list.title,
      html: list.html,
      css: list.css,
      datetime: list.datetime,
      status: list.status,
    });
    setSlugTouched(true);
    setMode("update");
    setModel("view");
  };

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    if (data.loggedIn && (data.id === "X" || data.id === "Y")) loadDetails();
    else navigate("/logout");
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const [preview, setPreview] = useState("");
  const editorRef = useRef<any>(null);

  const addComponent = (c: any) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    editor.executeEdits("", [
      { range: selection, text: c.html, forceMoveMarkers: true },
    ]);
    editor.focus();
  };

  const updatePreview = () => {
    setPreview(`
    <style>
    ${form.css}
    </style>

    <div class="tailwind">
    ${form.html.replaceAll("AWSPATH/", AWS_UPLOADS)}
    </div>
    `);
    setModel("preview");
  };

  const publicUrl = (slug: string) => `${window.location.origin}/${slug}`;
  const copyLink = (slug: string) => {
    navigator.clipboard?.writeText(publicUrl(slug));
    toast.success("Link copied");
  };

  const activeCount = useMemo(
    () => alllists.filter((p) => p.status === "1").length,
    [alllists],
  );
  const filteredPages = useMemo(() => {
    if (statusFilter === "active")
      return alllists.filter((p) => p.status === "1");
    if (statusFilter === "disabled")
      return alllists.filter((p) => p.status !== "1");
    return alllists;
  }, [alllists, statusFilter]);

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2500} />

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
        .si-header-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
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
        .si-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .si-total-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #ede9fe;
          color: var(--ad-brand);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        .si-total-badge b {
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
          background: var(--ad-brand-2);
          border-color: var(--ad-brand-2);
          color: #ffffff;
        }
        .si-btn-outline {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          color: #475569;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-outline:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }

        /* Stats KPI Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }
        .si-stat-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid #eef2f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          cursor: pointer;
          user-select: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
        }
        .si-stat-card.card-total.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
        }
        .si-stat-card.card-active.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-disabled.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .si-stat-icon-wrapper.purple {
          background: #f5f3ff;
          color: var(--ad-brand);
        }
        .si-stat-icon-wrapper.green {
          background: #f0fdf4;
          color: #16a34a;
        }
        .si-stat-icon-wrapper.amber {
          background: #fffbeb;
          color: #d97706;
        }
        .si-stat-icon-wrapper.blue {
          background: #f0f9ff;
          color: #0284c7;
        }
        .si-stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
          display: block;
        }
        .si-stat-value {
          font-size: 24px;
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
          gap: 12px;
          margin-bottom: 20px;
          border: 1px solid #edf2f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
        }
        .si-filter-select-wrapper {
          position: relative;
        }
        .si-filter-select {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 32px 8px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          background-color: #ffffff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          appearance: none;
          cursor: pointer;
          outline: none;
          min-width: 150px;
        }
        .si-filter-select:focus {
          border-color: var(--ad-brand);
        }
        .si-search-box {
          display: flex;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 12px;
          background: #ffffff;
          min-width: 260px;
          gap: 8px;
        }
        .si-search-box:focus-within {
          border-color: var(--ad-brand);
        }
        .si-search-icon {
          color: #94a3b8;
          flex-shrink: 0;
        }
        .si-search-box input {
          border: none;
          outline: none;
          font-size: 13px;
          color: #1e293b;
          width: 100%;
          background: transparent;
        }
        .si-reload-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--ad-brand);
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-reload-btn:hover {
          background: var(--ad-brand-2);
          transform: rotate(45deg);
        }

        /* Table Card */
        .si-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          margin-bottom: 24px;
        }
        .si-table-responsive {
          width: 100%;
          overflow-x: auto;
        }
        .si-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
        }
        .si-thead {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .si-th {
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          text-align: left;
          white-space: nowrap;
        }
        .si-tbody .si-tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.15s ease;
        }
        .si-tbody .si-tr:hover {
          background-color: #fbfcfe;
        }
        .si-td {
          padding: 14px 16px;
          font-size: 13.5px;
          color: #1e293b;
          vertical-align: middle;
        }
        .si-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
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
        .si-action-btn.view {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.view:hover {
          background: #ddd6fe;
        }
        .si-action-btn.delete {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-action-btn.delete:hover {
          background: #fecaca;
        }

        /* Footer & Pagination */
        .si-table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid #f1f5f9;
          flex-wrap: wrap;
          gap: 12px;
        }
        .si-table-info {
          font-size: 13px;
          color: #64748b;
        }
        .si-pagination {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-page-nav-btn {
          height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s ease;
        }
        .si-page-nav-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .si-page-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .si-page-btn {
          min-width: 32px;
          height: 32px;
          padding: 0 8px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .si-page-btn:hover:not(.active) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .si-page-btn.active {
          background: var(--ad-brand);
          border-color: var(--ad-brand);
          color: #ffffff;
          font-weight: 700;
        }
      `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper">
          {/* ============ LIST VIEW ============ */}
          {mode === "board" && (
            <>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Globe size={24} />
                  </div>
                  <div>
                    <div className="si-header-title-row">
                      <h3 className="si-header-title">Custom Pages</h3>
                      <span className="si-total-badge">
                        Total <b>{listtotal}</b>
                      </span>
                    </div>
                    <p className="si-header-subtitle">
                      Build dynamic HTML & CSS landing pages that open directly
                      at <code>/&lt;slug&gt;</code>.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  {permCan("create") && (
                    <button
                      className="si-btn-primary"
                      onClick={() => moveto("add")}
                    >
                      <Plus size={16} /> Add New Page
                    </button>
                  )}
                </div>
              </div>

              {/* Stats KPI Grid */}
              <div className="si-stats-grid">
                <div
                  className={`si-stat-card card-total ${statusFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setStatusFilter("ALL")}
                  title="Show all pages"
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper purple">
                    <Globe size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Total Custom Pages</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="CustomPages-s1" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-active ${statusFilter === "active" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((p) => (p === "active" ? "ALL" : "active"))
                  }
                  title={
                    statusFilter === "active"
                      ? "Click to show all"
                      : "Filter by Active pages"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper green">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Active Pages</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="CustomPages-s2" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-disabled ${statusFilter === "disabled" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((p) =>
                      p === "disabled" ? "ALL" : "disabled",
                    )
                  }
                  title={
                    statusFilter === "disabled"
                      ? "Click to show all"
                      : "Filter by Disabled pages"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper amber">
                    <XCircle size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Disabled Pages</span>
                    <h4 className="si-stat-value">
                      <AnimatedNumber value={Math.max(0, listtotal - activeCount)} pending={loading} id="CustomPages-s3" />
                    </h4>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <div className="si-filter-select-wrapper">
                  <select
                    className="si-filter-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(1, search, e.target.value);
                    }}
                  >
                    <option value="New">Sort: Newest First</option>
                    <option value="Old">Sort: Oldest First</option>
                  </select>
                </div>

                <ListSearch
                  placeholder="Search custom page title or slug…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === "Enter") loadDetails(1, search, sort);
                    }}
                />

                <div className="ms-auto d-flex align-items-center gap-2">
                  <button data-refresh
                    className="reload-btn"
                    title="Refresh"
                    onClick={() => {
                      setSearch("");
                      loadDetails(1, "", sort);
                    }}
                    disabled={loading}
                  >
                    <RotateCw size={15} />
                  </button>
                </div>
              </div>

              {/* Table Card */}
              <div className="si-table-card">
                <div className="si-table-responsive">
                  <table className="si-table">
                    <thead className="si-thead">
                      <tr>
                        <th className="si-th">Page Title</th>
                        <th className="si-th">Public Link (Slug)</th>
                        <th className="si-th">Created Date</th>
                        <th className="si-th">Status</th>
                        <th className="si-th text-end" style={{ width: 180 }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {loading ? (
                        <SkeletonRows />
                      ) : alllists.length === 0 ||
                        filteredPages.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-5 text-muted"
                          >
                            {statusFilter !== "ALL" && alllists.length > 0 ? (
                              <>
                                No{" "}
                                {statusFilter === "active"
                                  ? "active"
                                  : "disabled"}{" "}
                                pages on this page.{" "}
                                <button
                                  className="btn btn-sm btn-outline-primary ms-2"
                                  onClick={() => setStatusFilter("ALL")}
                                >
                                  Clear Filter
                                </button>
                              </>
                            ) : search ? (
                              "No pages match your search."
                            ) : (
                              "No custom pages found. Click “Add New Page”."
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredPages.map((list) => (
                          <tr key={list.req_id} className="si-tr">
                            <td className="si-td">
                              <div
                                className="fw-bold text-dark"
                                style={{ fontSize: "14px" }}
                              >
                                {decodeHtml(list.title)}
                              </div>
                            </td>

                            <td className="si-td">
                              <div className="d-flex align-items-center gap-2">
                                <code
                                  style={{
                                    fontSize: "12.5px",
                                    color: "var(--ad-brand)",
                                    background: "#f1f5f9",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                  }}
                                >
                                  /{list.slug}
                                </code>
                                <button
                                  className="btn btn-sm btn-light p-1"
                                  title="Copy link"
                                  onClick={() => copyLink(list.slug)}
                                >
                                  <Copy size={13} className="text-muted" />
                                </button>
                                <a
                                  href={publicUrl(list.slug)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-light p-1"
                                  title="Open live page"
                                >
                                  <ExternalLink
                                    size={13}
                                    className="text-muted"
                                  />
                                </a>
                              </div>
                            </td>

                            <td
                              className="si-td text-muted"
                              style={{ fontSize: "12.5px" }}
                            >
                              {timestampToDateTime(list.datetime)}
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background:
                                    list.status === "1" ? "#dcfce7" : "#fee2e2",
                                  color:
                                    list.status === "1" ? "#166534" : "#991b1b",
                                }}
                              >
                                <span
                                  className="si-status-dot"
                                  style={{
                                    background:
                                      list.status === "1"
                                        ? "#16a34a"
                                        : "#dc2626",
                                  }}
                                />
                                {list.status === "1" ? "Active" : "InActive"}
                              </span>
                            </td>

                            <td className="si-td text-end">
                              <div className="d-inline-flex align-items-center gap-1">
                                {loadingId === list.req_id ? (
                                  <span
                                    className="text-muted"
                                    style={{ fontSize: "12px" }}
                                  >
                                    Updating…
                                  </span>
                                ) : (
                                  <>
                                    {list.status === "1" &&
                                      permCan("status") && (
                                        <button
                                          className="btn btn-sm btn-outline-warning"
                                          style={{
                                            borderRadius: "8px",
                                            fontSize: "11.5px",
                                            fontWeight: 600,
                                            padding: "3px 8px",
                                          }}
                                          onClick={() => disableList(list)}
                                        >
                                          Disable
                                        </button>
                                      )}
                                    {list.status === "1S" &&
                                      permCan("status") && (
                                        <button
                                          className="btn btn-sm btn-outline-success"
                                          style={{
                                            borderRadius: "8px",
                                            fontSize: "11.5px",
                                            fontWeight: 600,
                                            padding: "3px 8px",
                                          }}
                                          onClick={() => enableList(list)}
                                        >
                                          Enable
                                        </button>
                                      )}
                                    {permCan("edit") && (
                                      <button
                                        className="si-action-btn view"
                                        title="Edit Page"
                                        onClick={() => updateto(list)}
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                    )}
                                    {permCan("delete") && (
                                      <button
                                        className="si-action-btn delete"
                                        title="Delete Page"
                                        onClick={() => deleteList(list)}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {listtotal > 0 && lastPage > 1 && (
                  <div className="si-table-footer">
                    <div className="si-table-info">
                      Showing {(page - 1) * limit + 1} to{" "}
                      {Math.min(page * limit, listtotal)} of {listtotal} pages
                    </div>
                    <div className="si-pagination">
                      <button
                        className="si-page-nav-btn"
                        disabled={page <= 1}
                        onClick={() => loadDetails(page - 1, search, sort)}
                      >
                        « Prev
                      </button>
                      {Array.from({ length: lastPage }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === lastPage ||
                            Math.abs(p - page) <= 2,
                        )
                        .map((p, idx, arr) => (
                          <span key={p} className="d-flex align-items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-muted">…</span>
                            )}
                            <button
                              className={`si-page-btn ${p === page ? "active" : ""}`}
                              onClick={() => loadDetails(p, search, sort)}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        className="si-page-nav-btn"
                        disabled={page >= lastPage}
                        onClick={() => loadDetails(page + 1, search, sort)}
                      >
                        Next »
                      </button>
                    </div>
                  </div>
                )}
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/pages" />
                </div>
              </div>
            </>
          )}

          {/* ============ ADD / UPDATE VIEW ============ */}
          {(mode === "add" || mode === "update") && (
            <>
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Code size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      {mode === "add"
                        ? "Adding a New Custom Page"
                        : "Updating Custom Page"}
                    </h3>
                    <p className="si-header-subtitle">
                      Write customized HTML and CSS or insert prebuilt
                      components with real-time preview.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  <button
                    className="si-btn-outline"
                    onClick={() => moveto("board")}
                  >
                    <ArrowLeft size={16} /> Back to Pages
                  </button>
                </div>
              </div>

              {success && (
                <div className="alert alert-success mb-3">{success}</div>
              )}
              {error && <div className="alert alert-danger mb-3">{error}</div>}

              {/* Title & Slug inputs */}
              <div
                className="card shadow-sm border-0 p-4 mb-4"
                style={{ borderRadius: "16px", background: "#fff" }}
              >
                <div className="row g-3">
                  <div className="col-md-6">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Page Title *
                    </label>
                    <input
                      value={form.title}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          title: e.target.value,
                          slug: slugTouched
                            ? f.slug
                            : pageSlugify(e.target.value),
                        }))
                      }
                      className="form-control"
                      placeholder="e.g. About Our AI Platform"
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Page Link (Slug) *
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">
                        {window.location.origin}/
                      </span>
                      <input
                        value={form.slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setForm((f) => ({
                            ...f,
                            slug: pageSlugify(e.target.value),
                          }));
                        }}
                        className="form-control"
                        placeholder="about-us or services/genai"
                      />
                    </div>
                    <small
                      className="text-muted"
                      style={{ fontSize: "11.5px" }}
                    >
                      Letters, numbers, and hyphens. Slash creates nested paths
                      like <code>services/ai-consulting</code>.
                    </small>
                  </div>
                </div>
              </div>

              {/* Code Editor or Preview */}
              {model === "view" && (
                <div
                  className="card shadow-sm border-0 mb-4 overflow-hidden"
                  style={{ borderRadius: "16px", background: "#fff" }}
                >
                  <div className="d-flex" style={{ minHeight: "600px" }}>
                    {/* Component sidebar */}
                    <div
                      style={{
                        width: "240px",
                        borderRight: "1px solid #e2e8f0",
                        padding: "16px",
                        background: "#f8fafc",
                        overflowY: "auto",
                      }}
                    >
                      <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                        <Layers size={16} /> Components
                      </h6>
                      <div className="d-flex flex-column gap-2">
                        {components.map((c: any, i: any) => (
                          <div
                            key={i}
                            style={{
                              padding: "10px 12px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              background: "#ffffff",
                              fontSize: "12.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            className="hover-shadow"
                            onClick={() => addComponent(c)}
                          >
                            + {c.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Monaco HTML & CSS editors */}
                    <div
                      style={{ flex: 1, padding: "16px" }}
                      className="d-flex flex-column gap-3"
                    >
                      <div>
                        <h6 className="fw-bold mb-2 text-dark">HTML Code</h6>
                        <div
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            overflow: "hidden",
                          }}
                        >
                          <MonacoEditor
                            height="280px"
                            defaultLanguage="html"
                            value={form.html}
                            onMount={(editor) => (editorRef.current = editor)}
                            onChange={(v: any) =>
                              setForm((f) => ({ ...f, html: v || "" }))
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <h6 className="fw-bold mb-2 text-dark">
                          CSS Stylesheet
                        </h6>
                        <div
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            overflow: "hidden",
                          }}
                        >
                          <MonacoEditor
                            height="200px"
                            defaultLanguage="css"
                            value={form.css}
                            onChange={(v: any) =>
                              setForm((f) => ({ ...f, css: v || "" }))
                            }
                          />
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2 pt-2">
                        {mode === "add" && permCan("create") && (
                          <button
                            type="button"
                            className="si-btn-primary"
                            disabled={loading}
                            onClick={addList}
                          >
                            {loading ? <ButtonLoader label="Adding…" /> : "Publish Page"}
                          </button>
                        )}
                        {mode === "update" && permCan("edit") && (
                          <button
                            type="button"
                            className="si-btn-primary"
                            disabled={loading}
                            onClick={updateList}
                          >
                            {loading ? <ButtonLoader label="Updating…" /> : "Update Page"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="si-btn-outline"
                          onClick={updatePreview}
                        >
                          <Eye size={15} /> Open Live Preview
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {model === "preview" && (
                <div
                  className="card shadow-sm border-0 mb-4 overflow-hidden"
                  style={{ borderRadius: "16px", background: "#fff" }}
                >
                  <div
                    className="p-3 border-bottom d-flex align-items-center justify-content-between"
                    style={{ background: "#f8fafc" }}
                  >
                    <span className="fw-bold text-dark">
                      Live Output Preview
                    </span>
                    <button
                      className="si-btn-primary"
                      onClick={() => setModel("view")}
                    >
                      <Code size={15} /> Return to Code Editor
                    </button>
                  </div>
                  <div style={{ height: "650px", width: "100%" }}>
                    <iframe
                      title="preview"
                      style={{ width: "100%", height: "100%", border: "none" }}
                      srcDoc={preview}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
