import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useRef } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Tags,
  Plus,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit2,
  ArrowUpDown,
  ArrowLeft,
  FolderTree,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

export default function BlogCategories() {
  const permCan = usePagePerm("blog-categories");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // "add" | "update" — which form variant is open
  const [modalMode, setModalMode] = useState<"add" | "update">("add");
  const [modalOpen, setModalOpen] = useState(false);

  const initialForm = {
    id: "",
    req_id: "",
    name: "",
    slug: "",
    status: "1",
  };

  const [form, setForm] = useState(initialForm);

  const limit = 20;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  // whole-table counts for the cards above the table (not just this page)
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number; slugs: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement>(null);

  /* ---- Auth ---- */
  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    if (data.loggedIn && (data.id === "X" || data.id === "Y")) {
      loadDetails();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  // Focus the name field whenever the modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [modalOpen]);

  /* ---- Load list ---- */
  const loadDetails = async (pg = 1, sq = "", so = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(pg);
    setSearch(sq);
    setSort(so);
    try {
      const res = await listFetch("api/blog-categories", { q: sq, s: so, n: pg });
      if (res.data.stats) setStats(res.data.stats);
      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ---- Auto-generate slug from name ---- */
  const toSlug = (val: string) =>
    val.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ---- Add ---- */
  const addList = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    if (!form.name.trim()) { setError("❌ Please enter category name"); return; }
    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/add-blog-category",
        { ...form, key: security.key, token: security.token, aut: security.aut },
        { withCredentials: true }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists(prev => [res.data.data, ...prev]);
        setTotal(prev => prev + 1);
        setForm(initialForm);
        setModalOpen(false);
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ---- Update ---- */
  const updateList = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    if (!form.name.trim()) { setError("❌ Please enter category name"); return; }
    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-blog-category",
        { ...form, key: security.key, token: security.token, aut: security.aut },
        { withCredentials: true }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists(prev =>
          prev.map(c => c.req_id === form.req_id ? { ...c, ...form } : c)
        );
        setModalOpen(false);
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ---- Delete ---- */
  const deleteList = async (cat: any) => {
    if (!window.confirm(`Are you sure you want to delete "${cat.name}" category?`)) return;
    try {
      setLoadingId(cat.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-blog-category",
        { id: cat.req_id, key: security.key, token: security.token, aut: security.aut },
        { withCredentials: true }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists(prev => prev.filter(c => c.req_id !== cat.req_id));
        setTotal(prev => prev - 1);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  /* ---- Open modal helpers ---- */
  const openAdd = () => {
    setForm(initialForm);
    setSuccess("");
    setError("");
    setModalMode("add");
    setModalOpen(true);
  };

  const openEdit = (cat: any) => {
    setForm({ id: cat.id, req_id: cat.req_id, name: cat.name, slug: cat.slug, status: cat.status });
    setSuccess("");
    setError("");
    setModalMode("update");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (loading) return;
    setModalOpen(false);
    setSuccess("");
    setError("");
  };

  /* ======================================================
     RENDER
  ====================================================== */
  const totalCount = stats ? stats.total : listtotal || alllists.length;
  const activeCount = stats
    ? stats.active
    : alllists.filter((c) => c.status === "1").length;
  const inactiveCount = stats
    ? stats.inactive
    : alllists.filter((c) => c.status !== "1").length;
  const slugCount = stats
    ? stats.slugs
    : alllists.filter((c) => Boolean(c.slug)).length;

  const displayedLists = alllists.filter((item) => {
    if (statusFilter === "1" && item.status !== "1") return false;
    if (statusFilter === "0" && item.status === "1") return false;
    return true;
  });

  void Icon;

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2500} />

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
        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
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
        background: #ecfdf5;
        color: #059669;
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
        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
        color: #ffffff !important;
        font-size: 13.5px;
        font-weight: 600;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        text-decoration: none;
      }
      .si-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
        color: #ffffff;
      }
      .si-btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #ffffff;
        color: #334155 !important;
        border: 1px solid #cbd5e1;
        font-size: 13px;
        font-weight: 600;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      .si-btn-secondary:hover {
        background: #f8fafc;
        border-color: #94a3b8;
        color: #0f172a !important;
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
        box-shadow: 0 0 0 2px #10b981, 0 6px 16px rgba(16, 185, 129, 0.15);
        border-color: #10b981;
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
        border-color: #10b981;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
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
        background: #ecfdf5;
        color: #059669;
        border-color: #a7f3d0;
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
      .si-cat-cell {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .si-cat-icon {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: #ecfdf5;
        color: #059669;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .si-cat-title {
        font-weight: 700;
        color: #0f172a;
        display: block;
        font-size: 14px;
      }
      .si-slug-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        background: #f1f5f9;
        color: #475569;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        font-family: monospace;
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
        background: #fef3c7;
        color: #b45309;
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
                <Tags size={24} />
              </div>
              <div>
                <h3 className="si-header-title">
                  Blog Categories
                  <span className="si-count-badge">
                    {totalCount} Total
                  </span>
                </h3>
                <p className="si-header-subtitle">
                  Manage categories and taxonomy for all blog posts
                </p>
              </div>
            </div>

            <div className="si-header-actions">
              {permCan("blogs:view") && (
                <Link to="/panel/blogs" className="si-btn-secondary">
                  <ArrowLeft size={15} />
                  <span>Back to Blogs</span>
                </Link>
              )}

              {permCan("create") && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="si-btn-primary"
                >
                  <Plus size={16} />
                  <span>Add New Category</span>
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
                <div className="si-stat-label">Total Categories</div>
                <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="BlogCategories-s1" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-green">
                <Tags size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${statusFilter === "1" ? "active" : ""}`}
              onClick={() => setStatusFilter("1")}
            >
              <div>
                <div className="si-stat-label">Active</div>
                <div className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="BlogCategories-s2" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-purple">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${statusFilter === "0" ? "active" : ""}`}
              onClick={() => setStatusFilter("0")}
            >
              <div>
                <div className="si-stat-label">Inactive</div>
                <div className="si-stat-value"><AnimatedNumber value={inactiveCount} pending={loading} id="BlogCategories-s3" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-amber">
                <FolderTree size={22} />
              </div>
            </div>

            <div
              className="si-stat-card"
              onClick={() => setStatusFilter("ALL")}
            >
              <div>
                <div className="si-stat-label">Slugs Configured</div>
                <div className="si-stat-value"><AnimatedNumber value={slugCount} pending={loading} id="BlogCategories-s4" /></div>
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
                <span className="si-select-label">
                  <ArrowUpDown size={13} /> Sort:
                </span>
                <select
                  className="si-select"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    loadDetails(page, search, e.target.value);
                  }}
                >
                  <option value="New">Newest First</option>
                  <option value="Old">Oldest First</option>
                  <option value="A-Z">A–Z Alphabetical</option>
                </select>
              </div>

              <div className="si-select-wrap">
                <span className="si-select-label">Status:</span>
                <select
                  className="si-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="1">Active Only</option>
                  <option value="0">Inactive Only</option>
                </select>
              </div>
            </div>

            <form
              className="si-search-form"
              onSubmit={(e) => {
                e.preventDefault();
                loadDetails(1, search, sort);
              }}
            >
              <ListSearch
                placeholder="Search categories..."
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
                  loadDetails(1, "", sort);
                }}
              >
                <RotateCw size={15} />
              </button>
            </form>
          </div>

          {/* Table Card */}
          <div className="si-table-card">
            {loading ? (
              <SkeletonTable cols={5} />
            ) : displayedLists.length === 0 ? (
              <div className="si-empty-box">
                <div className="si-empty-icon">
                  <Tags size={28} />
                </div>
                <div className="si-empty-title">
                  {search ? "No matching categories found" : "No categories yet"}
                </div>
                <p className="si-empty-desc">
                  {search
                    ? "Try adjusting your search criteria."
                    : "No blog categories yet. Click 'Add New Category' to create one."}
                </p>
                <button
                  className="si-btn-primary"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    loadDetails(1, "", "");
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
                      <th style={{ width: "80px" }}>#</th>
                      <th style={{ width: "38%" }}>Category Name</th>
                      <th style={{ width: "30%" }}>Slug</th>
                      <th style={{ width: "16%" }}>Status</th>
                      <th style={{ width: "16%", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLists.map((cat, idx) => {
                      const isBusy = loadingId === cat.req_id;
                      const isActive = cat.status === "1";

                      return (
                        <tr key={cat.req_id}>
                          <td style={{ fontWeight: 600, color: "#64748b" }}>
                            {(page - 1) * limit + idx + 1}
                          </td>

                          <td>
                            <div className="si-cat-cell">
                              <div className="si-cat-icon">
                                <Tags size={16} />
                              </div>
                              <span className="si-cat-title">{cat.name}</span>
                            </div>
                          </td>

                          <td>
                            <span className="si-slug-badge">
                              {cat.slug || "—"}
                            </span>
                          </td>

                          <td>
                            {isActive ? (
                              <span className="si-status-pill si-status-active">
                                <span className="si-status-dot" /> Active
                              </span>
                            ) : (
                              <span className="si-status-pill si-status-disabled">
                                <span className="si-status-dot" /> Inactive
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="si-action-btns">
                              {/* Edit */}
                              {permCan("edit") && (
                                <button
                                  type="button"
                                  className="si-action-btn btn-edit"
                                  title="Edit Category"
                                  onClick={() => openEdit(cat)}
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}

                              {/* Delete */}
                              {permCan("delete") && (
                                <button
                                  type="button"
                                  className="si-action-btn btn-del"
                                  title="Delete Category"
                                  disabled={isBusy}
                                  onClick={() => deleteList(cat)}
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

            <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9" }}>
              <Pagination
                page={page}
                total={listtotal}
                limit={limit}
                lastPage={lastPage}
                onPageChange={(p: any) => {
                  setPage(p);
                  loadDetails(p, search, sort);
                }}
              />
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/blog-categories" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {modalOpen && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">

              {/* Header */}
              <div className="modal-header">
                <h5 className="modal-title">
                  {modalMode === "add" ? "Add Blog Category" : "Update Blog Category"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeModal}
                  disabled={loading}
                  aria-label="Close"
                />
              </div>

              {/* Body */}
              <div className="modal-body">
                {permCan("create", "edit") && (<form
                  id="cat-form"
                  onSubmit={modalMode === "add" ? addList : updateList}
                >
                  {/* Alerts */}
                  {error && (
                    <div className="alert alert-danger py-2 mb-3">{error}</div>
                  )}
                  {success && (
                    <div className="alert alert-success py-2 mb-3">{success}</div>
                  )}

                  {/* Category Name */}
                  <div className="form-group mb-3">
                    <label htmlFor="catName" className="form-label">
                      Category Name <span className="text-danger">*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      id="catName"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Machine Learning"
                      value={form.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(f => ({
                          ...f,
                          name: val,
                          slug: modalMode === "add" ? toSlug(val) : f.slug,
                        }));
                      }}
                      autoComplete="off"
                      required
                    />
                  </div>

                  {/* Slug */}
                  <div className="form-group mb-3">
                    <label htmlFor="catSlug" className="form-label">Slug</label>
                    <input
                      id="catSlug"
                      type="text"
                      className="form-control"
                      placeholder="auto-generated from name"
                      value={form.slug}
                      onChange={(e) => setForm(f => ({ ...f, slug: toSlug(e.target.value) }))}
                      autoComplete="off"
                    />
                    <div className="form-text">Used in URLs. Leave blank to auto-generate.</div>
                  </div>

                  {/* Status */}
                  <div className="form-group mb-3">
                    <label htmlFor="catStatus" className="form-label">Status</label>
                    <select
                      id="catStatus"
                      className="form-select"
                      value={form.status}
                      onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                </form>)}
              </div>

              {/* Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="cat-form"
                  className="btn btn-success"
                  style={{ minWidth: "140px" }}
                  disabled={loading}
                >
                  {loading
                    ? (modalMode === "add" ? "Adding…" : "Updating…")
                    : (modalMode === "add" ? "Add Category" : "Update Category")}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );

  /* ---- Sub-components ---- */
  function Pagination({ page, total, limit, lastPage, onPageChange }: any) {
    if (total === 0 || lastPage <= 1) return null;
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    let pagstart = 1, pagend = 10;
    if (page >= 6) { pagstart = page - 3; pagend = page + 7; }
    if (pagend >= lastPage) { pagstart = lastPage - 9; pagend = lastPage + 1; }
    if (pagstart <= 0) pagstart = 1;
    const pages = [];
    for (let i = pagstart; i < pagend && i <= lastPage; i++) pages.push(i);
    return (
      <div className="col-md-12 pagepagination">
        <div className="dt-start">
          <div className="dt-info">Showing {start} to {end} of {total} entries</div>
        </div>
        <div className="dt-end">
          <div className="dt-paging paging_full_numbers">
            {page >= 2 && (
              <button className="dt-paging-button first" onClick={() => onPageChange(page - 1)}>«</button>
            )}
            {pages.map(p => (
              <button key={p} className={`dt-paging-button ${p === page ? "current" : ""}`} onClick={() => onPageChange(p)}>{p}</button>
            ))}
            {page >= 1 && page < lastPage && (
              <button className="dt-paging-button last" onClick={() => onPageChange(page + 1)}>»</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function Icon() {
    return (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M4 10h16M4 14h10" />
        <circle cx="18" cy="17" r="3" />
        <path d="M20.12 19.12L22 21" />
      </svg>
    );
  }
}
