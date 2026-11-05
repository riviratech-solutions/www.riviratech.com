import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import DateFilter, {
  dayStartEpoch,
  dayEndEpoch,
} from "../../../components/DateFilter";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { usePagePerm } from "../../../utils/adminPermissions";

import {
  GraduationCap,
  Users,
  Clock,
  CheckCircle,
  RotateCw,
  ArrowUpDown,
  BookOpen,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Check,
  RotateCcw,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

// Registrations with no topic came from the general "Save your seat" buttons.
const topicLabel = (t: string) => t || "Next free workshop";

export default function WorkshopRegistrations() {
  const permCan = usePagePerm("workshop-registrations");

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [topic, setTopic] = useState("__all");
  const [status, setStatus] = useState("");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);

  const navigate = useNavigate();

  const formatDate = (ts: any) => {
    const n = Number(ts);
    if (!n) return "";
    return new Date(n * 1000).toLocaleDateString("en-IN");
  };

  const formatDateTime = (ts: any) => {
    const n = Number(ts);
    if (!n) return "";
    const d = new Date(n * 1000);
    return (
      d.toLocaleDateString("en-IN") +
      " " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    df = "",
    dt = "",
    t = "__all",
    st = "",
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);
    setTopic(t);
    setStatus(st);
    try {
      const res = await listFetch("api/workshop-registrations/list", {
        q: targetSearch,
        s: targetSort,
        n: targetPage,
        t: t,
        st: st,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
      });

      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
        setNewCount(res.data.newCount);
        setTopics(res.data.topics || []);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const reload = (p = page) =>
    loadDetails(p, search, sort, dfrom, dto, topic, status);

  const setContacted = async (item: any) => {
    const next = item.status === "2" ? "1" : "2";
    try {
      setLoadingId(item.id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/workshop-registrations/status",
        {
          id: item.id,
          status: next,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.id === item.id ? { ...b, status: next } : b)),
        );
        setNewCount((c) => Math.max(0, c + (next === "1" ? 1 : -1)));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Update failed");
    } finally {
      setLoadingId(null);
    }
  };

  const removeList = async (item: any) => {
    if (!window.confirm(`Delete the registration from "${item.name}"?`)) return;
    try {
      setLoadingId(item.id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/workshop-registrations/delete",
        {
          id: item.id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) => prev.filter((b) => b.id !== item.id));
        setTotal((t) => Math.max(0, t - 1));
        if (item.status === "1") setNewCount((c) => Math.max(0, c - 1));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setLoadingId(null);
    }
  };

  const exportRows = (rows: any[] = alllists) => rows.map((u, i) => ({
      "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
      Name: u.name,
      Email: u.email,
      Phone: u.phone,
      Workshop: topicLabel(u.topic),
      Status: u.status === "2" ? "Contacted" : "New",
      "Registered On": formatDateTime(u.datetime),
    }));

  const exportExcel = (rows: any[] = alllists) => {
    if (!rows.length) return toast.info("No data to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Workshop Registrations");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      "workshop-registrations.xlsx",
    );
  };

  const exportCSV = (rows: any[] = alllists) => {
    if (!rows.length) return toast.info("No data to export");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows(rows)));
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "workshop-registrations.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/workshop-registrations/list"),
      run: (rows) => (format === "excel" ? exportExcel(rows) : exportCSV(rows)),
    });

  const checklogin = async () =>
    (await axios.get(SERVER_URL + "api/check-login", { withCredentials: true }))
      .data;

  const initchecklogin = async () => {
    const data = await checklogin();
    if (data.loggedIn && (data.id === "X" || data.id === "Y")) loadDetails();
    else navigate("/logout");
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const contactedCount = Math.max(0, listtotal - newCount);

  // Pagination calculation
  let pagstart = 1;
  let pagend = 10;
  if (page >= 6) {
    pagstart = page - 3;
    pagend = page + 7;
  }
  if (pagend >= lastPage) {
    pagstart = lastPage - 9;
    pagend = lastPage + 1;
  }
  if (pagstart <= 0) pagstart = 1;

  const pages: number[] = [];
  for (let i = pagstart; i < pagend && i <= lastPage; i++) {
    pages.push(i);
  }

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
        .si-total-count-text {
          font-size: 14px;
          color: #475569;
          font-weight: 500;
          background: #ffffff;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
        }
        .si-total-count-text b {
          font-weight: 700;
          color: #0f172a;
        }
        .si-btn-export-excel {
          background: #ffffff;
          border: 1.5px solid var(--ad-brand);
          color: var(--ad-brand);
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
        .si-btn-export-excel:hover {
          background: #f5f3ff;
          border-color: var(--ad-brand);
          color: var(--ad-brand);
        }
        .si-btn-export-csv {
          background: var(--ad-brand);
          border: 1.5px solid var(--ad-brand);
          color: #ffffff;
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
        .si-btn-export-csv:hover {
          background: #4b24d6;
          border-color: #4b24d6;
          color: #ffffff;
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
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
        .si-stat-card.active {
          box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.12);
          border-color: var(--ad-brand);
        }
        .si-stat-card.card-approved.active {
          box-shadow: 0 0 0 2px #16a34a, 0 6px 16px rgba(22, 163, 74, 0.15);
          border-color: #16a34a;
        }
        .si-stat-card.card-recent.active {
          box-shadow: 0 0 0 2px #d97706, 0 6px 16px rgba(217, 119, 6, 0.15);
          border-color: #d97706;
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-approved {
          background: #f0fdf4;
        }
        .si-stat-card.card-recent {
          background: #fffbeb;
        }
        .si-stat-card.card-trainers {
          background: #faf5ff;
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
        .si-filter-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .si-sort-group {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-weight: 600;
          font-size: 13.5px;
        }
        .si-select-sort {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 14px;
          font-size: 13.5px;
          font-weight: 500;
          color: #1e293b;
          background-color: #ffffff;
          cursor: pointer;
          outline: none;
        }
        .si-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          min-width: 280px;
        }
        .si-search-icon {
          position: absolute;
          left: 12px;
          color: #94a3b8;
          pointer-events: none;
        }
        .si-search-input {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 14px 8px 36px;
          font-size: 13.5px;
          color: #1e293b;
          width: 100%;
          outline: none;
          background-color: #ffffff;
          transition: border-color 0.15s ease;
        }
        .si-search-input:focus {
          border-color: var(--ad-brand);
        }
        .si-btn-reload {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--ad-brand);
          color: #ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-reload:hover {
          background: #4b24d6;
        }

        /* Table Card Container */
        .si-table-container {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          overflow: hidden;
        }
        .si-table {
          margin-bottom: 0;
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
        }
        .si-table thead th {
          background: #f8fafc;
          padding: 14px 18px;
          font-size: 12.5px;
          font-weight: 600;
          color: #475569;
          text-transform: capitalize;
          border-bottom: 1px solid #edf2f7;
          white-space: nowrap;
        }
        .si-table tbody td {
          padding: 14px 18px;
          vertical-align: middle;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13.5px;
          color: #334155;
        }
        .si-table tbody tr:hover {
          background-color: #f8fafc;
        }
        .si-avatar-badge {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .si-name {
          font-weight: 600;
          color: #1e293b;
        }
        .si-topic-pill {
          background: #ede9fe;
          color: var(--ad-brand);
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          display: inline-block;
          max-width: 240px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .si-datetime-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-date-text {
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
        }
        .si-time-text {
          font-size: 11.5px;
          color: #64748b;
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
        .si-status-pill.status-contacted {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-pill.status-new {
          background: #e0f2fe;
          color: #0284c7;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-contacted .si-status-dot {
          background: #16a34a;
        }
        .status-new .si-status-dot {
          background: #0284c7;
        }
        .si-actions-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .si-action-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-action-btn:hover:not(:disabled) {
          transform: scale(1.06);
        }
        .si-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .si-action-btn.btn-toggle-contact {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }
        .si-action-btn.btn-toggle-contact:hover:not(:disabled) {
          background: #d1fae5;
        }
        .si-action-btn.btn-toggle-undo {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        .si-action-btn.btn-toggle-undo:hover:not(:disabled) {
          background: #dbeafe;
        }
        .si-action-btn.btn-trash {
          background: #fee2e2;
          color: #ef4444;
        }
        .si-action-btn.btn-trash:hover:not(:disabled) {
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
        .si-footer-left {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #64748b;
        }
        .si-pagination {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-page-nav-btn {
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
        <div className="si-page-wrapper">
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <GraduationCap size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Workshop Registrations</h3>
                <p className="si-header-subtitle">
                  Seats reserved from the "Reserve your seat" form on the
                  Workshop page
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                style={{ borderRadius: "10px", fontWeight: 600, padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                onClick={() => navigate("/panel/workshops")}
              >
                <ChevronLeft size={15} /> Workshops
              </button>

              <span className="si-total-count-text">
                Total <b>{listtotal}</b>
              </span>

              <button className="si-btn-export-excel" onClick={() => askExport("excel")}>
                <FileSpreadsheet size={15} /> Export Excel
              </button>

              <button className="si-btn-export-csv" onClick={() => askExport("csv")}>
                <FileText size={15} /> Export CSV
              </button>
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card card-total ${!status && !dfrom && !dto && !topic ? "active" : ""}`}
              onClick={() => {
                setStatus("");
                setTopic("");
                setDfrom("");
                setDto("");
                setSearch("");
                loadDetails(1, "", "New", "", "", "", "");
              }}
              title="Click to view all registrations"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dbeafe", color: "#1d4ed8" }}
              >
                <Users size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Registrations</p>
                <h4 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="WorkshopRegistrations-s1" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card card-approved ${status === "2" ? "active" : ""}`}
              onClick={() => {
                const next = status === "2" ? "" : "2";
                setStatus(next);
                loadDetails(1, search, sort, dfrom, dto, topic, next);
              }}
              title="Click to filter by Contacted registrations"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#15803d" }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Contacted</p>
                <h4 className="si-stat-value"><AnimatedNumber value={contactedCount} pending={loading} id="WorkshopRegistrations-s2" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card card-recent ${status === "1" ? "active" : ""}`}
              onClick={() => {
                const next = status === "1" ? "" : "1";
                setStatus(next);
                loadDetails(1, search, sort, dfrom, dto, topic, next);
              }}
              title="Click to filter by New registrations"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#b45309" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">New Registrations</p>
                <h4 className="si-stat-value"><AnimatedNumber value={newCount} pending={loading} id="WorkshopRegistrations-s3" /></h4>
              </div>
            </div>

            <div
              className="si-stat-card card-trainers"
              onClick={() => navigate("/panel/workshops")}
              title="Click to manage Workshops in Workshops Panel"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
              >
                <GraduationCap size={22} />
              </div>
              <div>
                <p className="si-stat-label">Active Topics</p>
                <h4 className="si-stat-value"><AnimatedNumber value={topics.length} pending={loading} id="WorkshopRegistrations-s4" /></h4>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <div className="si-filter-left">
              <div className="si-sort-group">
                <ArrowUpDown size={15} color="var(--ad-brand)" />
                <span>Sort By:</span>
                <select
                  className="si-select-sort"
                  value={sort}
                  onChange={(e) =>
                    loadDetails(
                      1,
                      search,
                      e.target.value,
                      dfrom,
                      dto,
                      topic,
                      status,
                    )
                  }
                >
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                </select>
              </div>

              <div className="si-sort-group">
                <BookOpen size={15} color="var(--ad-brand)" />
                <span>Topic:</span>
                <select
                  className="si-select-sort"
                  style={{ maxWidth: "240px" }}
                  value={topic}
                  onChange={(e) =>
                    loadDetails(
                      1,
                      search,
                      sort,
                      dfrom,
                      dto,
                      e.target.value,
                      status,
                    )
                  }
                >
                  <option value="__all">All workshops</option>
                  {topics.map((t) => (
                    <option key={t.topic} value={t.topic}>
                      {topicLabel(t.topic)} ({t.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="si-sort-group">
                <Clock size={15} color="var(--ad-brand)" />
                <span>Status:</span>
                <select
                  className="si-select-sort"
                  value={status}
                  onChange={(e) =>
                    loadDetails(
                      1,
                      search,
                      sort,
                      dfrom,
                      dto,
                      topic,
                      e.target.value,
                    )
                  }
                >
                  <option value="">All Status</option>
                  <option value="1">New</option>
                  <option value="2">Contacted</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) =>
                  loadDetails(1, search, sort, f, t, topic, status)
                }
              />
            </div>
          </div>

          <div className="si-filter-bar">
            <div className="si-filter-left"></div>
            <div className="d-flex align-items-center gap-2">
              <ListSearch
                placeholder="Search by participant name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    loadDetails(1, search, sort, dfrom, dto, topic, status);
                  }
                }}
              />

              <button
                data-refresh
                className="reload-btn"
                title="Reload registrations"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "", sort, dfrom, dto, topic, status);
                }}
              >
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          {/* Content Table */}
          {alllists.length === 0 ? (
            <div className="bg-white rounded-3 border p-5 text-center">
              {loading ? (
                <SkeletonTable cols={8} />
              ) : (
                <div className="py-4">
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "#f1f5f9",
                      color: "#94a3b8",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <GraduationCap size={28} />
                  </div>
                  <h4
                    style={{
                      fontWeight: 700,
                      color: "#1e293b",
                      margin: "0 0 6px 0",
                    }}
                  >
                    No Registrations Found
                  </h4>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "14px",
                      margin: "0 0 16px 0",
                    }}
                  >
                    We couldn't find any workshop registrations matching your
                    filter criteria.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                    onClick={() => reload(1)}
                  >
                    Reload List
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="si-table-container">
              <div className="table-responsive">
                <table className="si-table">
                  <thead>
                    <tr>
                      <th style={{ width: "65px" }}>S No</th>
                      <th>Participant</th>
                      <th>Email Address</th>
                      <th>Phone Number</th>
                      <th>Workshop Topic</th>
                      <th>Registered On</th>
                      <th>Status</th>
                      <th className="text-center" style={{ width: "110px" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alllists.map((item, index) => {
                      const isContacted = String(item.status) === "2";
                      const initial = (item.name || "P")
                        .charAt(0)
                        .toUpperCase();

                      return (
                        <tr key={item.id}>
                          <td>{(page - 1) * limit + index + 1}</td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="si-avatar-badge"
                                style={{
                                  background: "#ede9fe",
                                  color: "var(--ad-brand)",
                                }}
                              >
                                {initial}
                              </div>
                              <div className="si-name">{item.name}</div>
                            </div>
                          </td>

                          <td>
                            <a
                              href={`mailto:${item.email}`}
                              style={{
                                color: "#2563eb",
                                textDecoration: "none",
                                fontWeight: 500,
                              }}
                            >
                              {item.email}
                            </a>
                          </td>

                          <td>
                            {item.phone ? (
                              <a
                                href={`tel:${item.phone}`}
                                style={{
                                  color: "#334155",
                                  textDecoration: "none",
                                  fontWeight: 500,
                                }}
                              >
                                {item.phone}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>

                          <td>
                            <span
                              className="si-topic-pill"
                              title={topicLabel(item.topic)}
                            >
                              {topicLabel(item.topic)}
                            </span>
                          </td>

                          <td>
                            <div className="si-datetime-col">
                              <span className="si-date-text">
                                {formatDate(item.datetime)}
                              </span>
                              <span className="si-time-text">
                                {item.datetime
                                  ? new Date(
                                      Number(item.datetime) * 1000,
                                    ).toLocaleTimeString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`si-status-pill ${
                                isContacted ? "status-contacted" : "status-new"
                              }`}
                            >
                              <span className="si-status-dot"></span>
                              {isContacted ? "Contacted" : "New"}
                            </span>
                          </td>

                          <td>
                            <div className="si-actions-cell justify-content-center">
                              {permCan("status") && (
                                <button
                                  className={`si-action-btn ${
                                    isContacted
                                      ? "btn-toggle-undo"
                                      : "btn-toggle-contact"
                                  }`}
                                  disabled={loadingId === item.id}
                                  onClick={() => setContacted(item)}
                                  title={
                                    isContacted
                                      ? "Mark as new"
                                      : "Mark as contacted"
                                  }
                                >
                                  {isContacted ? (
                                    <RotateCcw size={15} />
                                  ) : (
                                    <Check size={16} />
                                  )}
                                </button>
                              )}

                              {permCan("delete") && (
                                <button
                                  className="si-action-btn btn-trash"
                                  disabled={loadingId === item.id}
                                  onClick={() => removeList(item)}
                                  title="Delete registration"
                                >
                                  <Trash2 size={15} />
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

              {/* Pagination Footer */}
              <div className="si-table-footer">
                <div className="si-footer-left">
                  Showing {(page - 1) * limit + 1} to{" "}
                  {Math.min(page * limit, listtotal)} of {listtotal} entries
                </div>

                <div className="si-pagination">
                  <button
                    className="si-page-nav-btn"
                    disabled={page <= 1}
                    onClick={() => reload(page - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pages.map((p) => (
                    <button
                      key={p}
                      className={`si-page-btn ${p === page ? "active" : ""}`}
                      onClick={() => reload(p)}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className="si-page-nav-btn"
                    disabled={page >= lastPage}
                    onClick={() => reload(page + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/workshop-registrations/list" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
