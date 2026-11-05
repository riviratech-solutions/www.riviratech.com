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
  MessageSquare,
  Star,
  CheckCircle2,
  Clock,
  RotateCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Eye,
  Trash2,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Globe,
  X,
  ThumbsUp,
  AlertTriangle,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

const STAR_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

export default function SiteFeedback() {
  const permCan = usePagePerm("site-feedback");

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
  const [avgRating, setAvgRating] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [rating, setRating] = useState("");
  const [status, setStatus] = useState("");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const navigate = useNavigate();

  const formatDate = (ts: any) => {
    const n = Number(ts);
    if (!n) return { date: "-", time: "" };
    const d = new Date(n * 1000);
    return {
      date: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      time: d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "New",
    df = "",
    dt = "",
    r = "",
    st = "",
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);
    setRating(r);
    setStatus(st);
    try {
      const res = await listFetch("api/site-feedback/list", {
        q: targetSearch,
        s: targetSort,
        n: targetPage,
        r: r,
        st: st,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
      });

      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage || 1);
        setAvgRating(res.data.avgRating || 0);
        setNewCount(res.data.newCount || 0);
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
    loadDetails(p, search, sort, dfrom, dto, rating, status);

  const setReviewed = async (item: any) => {
    const next = item.status === "2" ? "1" : "2";
    try {
      setLoadingId(item.id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/site-feedback/status",
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
        if (selectedItem?.id === item.id) {
          setSelectedItem((prev: any) => ({ ...prev, status: next }));
        }
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
    if (!window.confirm(`Delete feedback from "${item.name}"?`)) return;
    try {
      setLoadingId(item.id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/site-feedback/delete",
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
        if (selectedItem?.id === item.id) setModalOpen(false);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setLoadingId(null);
    }
  };

  const exportRows = (rows: any[] = alllists) => rows.map((u, i) => {
      const formatted = formatDate(u.datetime);
      return {
        "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
        Name: u.name,
        Rating: u.rating,
        "What worked well": u.liked,
        "What could be better": u.improve,
        Page: u.page,
        Status: u.status === "2" ? "Reviewed" : "New",
        "Submitted On": `${formatted.date} ${formatted.time}`,
      };
    });

  const exportExcel = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Site Feedback");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      "site-feedback.xlsx",
    );
  };

  const exportCSV = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows(rows)));
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "site-feedback.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/site-feedback/list"),
      run: (rows) => (format === "excel" ? exportExcel(rows) : exportCSV(rows)),
    });

  const checklogin = async () =>
    (await axios.get(SERVER_URL + "api/check-login", { withCredentials: true }))
      .data;

  const initchecklogin = async () => {
    const data = await checklogin();
    if (data.loggedIn && (data.id == "X" || data.id == "Y")) loadDetails();
    else navigate("/logout");
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const Stars = ({ value }: { value: number }) => (
    <span
      title={`${value} / 5 — ${STAR_LABELS[value - 1] || ""}`}
      style={{ whiteSpace: "nowrap", display: "inline-flex", gap: "2px" }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          style={{
            color: n <= value ? "#f59e0b" : "#cbd5e1",
            fill: n <= value ? "#f59e0b" : "none",
          }}
        />
      ))}
    </span>
  );

  const getInitials = (name: string) => {
    if (!name) return "FB";
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

  const openView = (item: any) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

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
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-total.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-card.card-rating {
          background: #fffbeb;
        }
        .si-stat-card.card-rating.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.card-new {
          background: #eff6ff;
        }
        .si-stat-card.card-new.active {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25) !important;
        }
        .si-stat-card.card-reviewed {
          background: #f0fdf4;
        }
        .si-stat-card.card-reviewed.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
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
          padding: 7px 32px 7px 12px;
          font-size: 13.5px;
          font-weight: 500;
          color: #1e293b;
          background-color: #ffffff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          appearance: none;
          cursor: pointer;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .si-select-sort:focus {
          border-color: var(--ad-brand);
        }
        .si-filter-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .si-search-box {
          display: flex;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          background: #ffffff;
          min-width: 280px;
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
        .si-search-input::placeholder {
          color: #94a3b8;
        }
        .si-reload-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--ad-brand);
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
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
          background: #f3f1fd;
          border-bottom: 1px solid #e2e8f0;
        }
        .si-th {
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          text-align: left;
          white-space: nowrap;
          border: none;
        }
        .si-tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s ease;
        }
        .si-tr:hover {
          background: #fafbff;
        }
        .si-td {
          padding: 14px 16px;
          font-size: 13.5px;
          color: #334155;
          vertical-align: middle;
          border: none;
        }
        .si-avatar-badge {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }

        /* Status Pills */
        .si-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .si-status-pill.status-new {
          background: #e0f2fe;
          color: #0284c7;
        }
        .si-status-pill.status-reviewed {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-new .si-status-dot {
          background: #0284c7;
        }
        .status-reviewed .si-status-dot {
          background: #16a34a;
        }

        /* Action Buttons */
        .si-actions-cell {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
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
        .si-action-btn.btn-view {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.btn-view:hover {
          background: #ddd6fe;
          transform: scale(1.05);
        }
        .si-action-btn.btn-toggle {
          background: #dcfce7;
          color: #15803d;
        }
        .si-action-btn.btn-toggle:hover:not(:disabled) {
          background: #bbf7d0;
          transform: scale(1.05);
        }
        .si-action-btn.btn-undo {
          background: #f1f5f9;
          color: #475569;
        }
        .si-action-btn.btn-undo:hover:not(:disabled) {
          background: #e2e8f0;
          transform: scale(1.05);
        }
        .si-action-btn.btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-action-btn.btn-delete:hover:not(:disabled) {
          background: #fecaca;
          color: #b91c1c;
          transform: scale(1.05);
        }

        /* Pagination */
        .si-pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-top: 1px solid #edf2f7;
          background: #ffffff;
          flex-wrap: wrap;
          gap: 12px;
        }
        .si-pagination-info {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }
        .si-pagination-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-page-btn {
          min-width: 32px;
          height: 32px;
          padding: 0 8px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-page-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .si-page-btn.active {
          background: var(--ad-brand);
          border-color: var(--ad-brand);
          color: #ffffff;
        }
        .si-page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Detail Modal */
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
          max-width: 600px;
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
        .si-modal-section-title {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .si-detail-item {
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px 14px;
          border: 1px solid #f1f5f9;
        }
        .si-detail-item-label {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .si-detail-item-val {
          font-size: 13.5px;
          font-weight: 600;
          color: #0f172a;
          word-break: break-word;
        }
        .si-msg-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
          font-size: 13.5px;
          color: #334155;
          line-height: 1.6;
          white-space: pre-wrap;
          margin-bottom: 16px;
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
        <div className="si-page-wrapper">
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <MessageSquare size={24} />
              </div>
              <div>
                <h1 className="si-header-title">Site Feedback</h1>
                <p className="si-header-subtitle">
                  Ratings, reviews, and insights submitted via the site feedback
                  widget
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <div className="si-total-badge">
                Total Feedback: <b>{listtotal}</b>
              </div>
              <button className="si-btn-export-excel" onClick={() => askExport("excel")}>
                <FileSpreadsheet size={16} /> Export Excel
              </button>
              <button className="si-btn-export-csv" onClick={() => askExport("csv")}>
                <FileText size={16} /> Export CSV
              </button>
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card card-total ${status === "" && rating === "" ? "active" : ""}`}
              onClick={() => {
                if (status !== "" || rating !== "") {
                  setRating("");
                  setStatus("");
                  loadDetails(1, search, sort, dfrom, dto, "", "");
                }
              }}
              title="Show all submissions"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <MessageSquare size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Submissions</p>
                <h3 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="SiteFeedback-s1" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-rating ${rating === "5" ? "active" : ""}`}
              onClick={() => {
                const nextR = rating === "5" ? "" : "5";
                setRating(nextR);
                loadDetails(1, search, sort, dfrom, dto, nextR, status);
              }}
              title={
                rating === "5"
                  ? "Click to clear rating filter"
                  : "Filter by 5-star ratings"
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
                  <AnimatedNumber value={avgRating ? avgRating.toFixed(1) : "0.0"} pending={loading} id="SiteFeedback-s2" />{" "}
                  <span style={{ fontSize: "16px", color: "#f59e0b" }}>★</span>
                </h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-new ${status === "1" ? "active" : ""}`}
              onClick={() => {
                const nextS = status === "1" ? "" : "1";
                setStatus(nextS);
                loadDetails(1, search, sort, dfrom, dto, rating, nextS);
              }}
              title={
                status === "1"
                  ? "Click to show all"
                  : "Filter by New submissions"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dbeafe", color: "#2563eb" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">New Submissions</p>
                <h3 className="si-stat-value"><AnimatedNumber value={newCount} pending={loading} id="SiteFeedback-s3" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-reviewed ${status === "2" ? "active" : ""}`}
              onClick={() => {
                const nextS = status === "2" ? "" : "2";
                setStatus(nextS);
                loadDetails(1, search, sort, dfrom, dto, rating, nextS);
              }}
              title={
                status === "2"
                  ? "Click to show all"
                  : "Filter by Reviewed feedback"
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
                <p className="si-stat-label">Reviewed Feedback</p>
                <h3 className="si-stat-value">
                  <AnimatedNumber value={Math.max(0, listtotal - newCount)} pending={loading} id="SiteFeedback-s4" />
                </h3>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <div className="si-filter-left">
              <div className="si-sort-group">
                <ArrowUpDown size={15} style={{ color: "#64748b" }} />
                <span>Sort:</span>
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
                      rating,
                      status,
                    )
                  }
                >
                  <option value="New">Newest First</option>
                  <option value="Old">Oldest First</option>
                  <option value="High">Highest Rating</option>
                  <option value="Low">Lowest Rating</option>
                </select>
              </div>

              <div className="si-sort-group">
                <span>Rating:</span>
                <select
                  className="si-select-sort"
                  value={rating}
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
                  <option value="">All Ratings</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={String(n)}>
                      {n} Star{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="si-sort-group">
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
                      rating,
                      e.target.value,
                    )
                  }
                >
                  <option value="">All Status</option>
                  <option value="1">New</option>
                  <option value="2">Reviewed</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) =>
                  loadDetails(1, search, sort, f, t, rating, status)
                }
              />
            </div>
          </div>

          <div className="si-filter-bar">
            <div className="si-filter-left"></div>

            <div className="si-filter-right">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort, dfrom, dto, rating, status);
                }}
              >
                <ListSearch
                  placeholder="Search reviewer or comment..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <button
                data-refresh
                className="reload-btn"
                title="Reset filters and reload"
                onClick={() => {
                  setSearch("");
                  setRating("");
                  setStatus("");
                  loadDetails(1, "", sort, dfrom, dto, "", "");
                }}
              >
                <RotateCw size={17} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          {alllists.length === 0 ? (
            <div className="si-table-card">
              {loading ? (
                <SkeletonTable cols={7} />
              ) : (
                <div style={{ textAlign: "center", padding: "64px 20px" }}>
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
                    <MessageSquare size={26} />
                  </div>
                  <h4
                    style={{
                      fontSize: "17px",
                      fontWeight: 700,
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    {search || rating || status
                      ? "No Records Found"
                      : "No Feedback Yet"}
                  </h4>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#64748b",
                      marginTop: "6px",
                    }}
                  >
                    {search || rating || status
                      ? "No feedback entries match your active filters."
                      : "No site feedback has been submitted yet."}
                  </p>
                  {(search || rating || status) && (
                    <button
                      className="si-btn-export-csv"
                      style={{ marginTop: "8px" }}
                      onClick={() => {
                        setSearch("");
                        setRating("");
                        setStatus("");
                        loadDetails(1, "", sort, dfrom, dto, "", "");
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="si-table-card">
              <div className="si-table-responsive">
                <table className="si-table">
                  <thead className="si-thead">
                    <tr>
                      <th className="si-th" style={{ width: "70px" }}>
                        S NO
                      </th>
                      <th className="si-th">REVIEWER</th>
                      <th className="si-th">RATING</th>
                      <th className="si-th" style={{ minWidth: "260px" }}>
                        FEEDBACK SUMMARY
                      </th>
                      <th className="si-th">PAGE</th>
                      <th className="si-th">SUBMITTED ON</th>
                      <th className="si-th">STATUS</th>
                      <th
                        className="si-th"
                        style={{ width: "120px", textAlign: "center" }}
                      >
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alllists.map((item, index) => {
                      const palette =
                        avatarPalette[index % avatarPalette.length];
                      const initials = getInitials(item.name);
                      const formatted = formatDate(item.datetime);
                      const starVal = Number(item.rating) || 0;

                      return (
                        <tr key={item.id} className="si-tr">
                          <td
                            className="si-td"
                            style={{ fontWeight: 600, color: "#64748b" }}
                          >
                            {(page - 1) * limit + index + 1}
                          </td>

                          <td className="si-td">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <div
                                className="si-avatar-badge"
                                style={{
                                  backgroundColor: palette.bg,
                                  color: palette.text,
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: "#0f172a",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => openView(item)}
                                >
                                  {item.name || "Anonymous User"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#94a3b8",
                                    marginTop: "2px",
                                  }}
                                >
                                  Site visitor
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="si-td">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Stars value={starVal} />
                              <span
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  color: "#475569",
                                }}
                              >
                                {starVal}.0
                              </span>
                            </div>
                          </td>

                          <td className="si-td">
                            <div style={{ maxWidth: "340px" }}>
                              {item.liked && (
                                <div
                                  style={{
                                    fontSize: "12.5px",
                                    color: "#334155",
                                    marginBottom: "3px",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "#16a34a",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Worked well:{" "}
                                  </span>
                                  {item.liked.length > 60
                                    ? `${item.liked.slice(0, 60)}...`
                                    : item.liked}
                                </div>
                              )}
                              {item.improve && (
                                <div
                                  style={{
                                    fontSize: "12.5px",
                                    color: "#334155",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "#dc2626",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Improve:{" "}
                                  </span>
                                  {item.improve.length > 60
                                    ? `${item.improve.slice(0, 60)}...`
                                    : item.improve}
                                </div>
                              )}
                              {!item.liked && !item.improve && (
                                <span
                                  style={{
                                    color: "#94a3b8",
                                    fontSize: "12.5px",
                                  }}
                                >
                                  Rating only
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="si-td">
                            {item.page ? (
                              <a
                                href={item.page}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "var(--ad-brand)",
                                  fontSize: "12.5px",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  maxWidth: "160px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Globe size={13} />{" "}
                                {item.page.replace(/^https?:\/\/[^/]+/, "") ||
                                  "/"}
                              </a>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>-</span>
                            )}
                          </td>

                          <td className="si-td">
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  fontSize: "13px",
                                }}
                              >
                                {formatted.date}
                              </span>
                              <span
                                style={{ fontSize: "11.5px", color: "#64748b" }}
                              >
                                {formatted.time}
                              </span>
                            </div>
                          </td>

                          <td className="si-td">
                            <span
                              className={`si-status-pill ${
                                item.status === "2"
                                  ? "status-reviewed"
                                  : "status-new"
                              }`}
                            >
                              <span className="si-status-dot" />{" "}
                              {item.status === "2" ? "Reviewed" : "New"}
                            </span>
                          </td>

                          <td className="si-td">
                            <div className="si-actions-cell">
                              <button
                                className="si-action-btn btn-view"
                                onClick={() => openView(item)}
                                title="View Full Feedback"
                              >
                                <Eye size={15} />
                              </button>

                              {permCan("status") && (
                                <button
                                  className={`si-action-btn ${
                                    item.status === "2"
                                      ? "btn-undo"
                                      : "btn-toggle"
                                  }`}
                                  disabled={loadingId === item.id}
                                  onClick={() => setReviewed(item)}
                                  title={
                                    item.status === "2"
                                      ? "Mark as New"
                                      : "Mark as Reviewed"
                                  }
                                >
                                  {item.status === "2" ? (
                                    <RotateCcw size={14} />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                </button>
                              )}

                              {permCan("delete") && (
                                <button
                                  className="si-action-btn btn-delete"
                                  disabled={loadingId === item.id}
                                  onClick={() => removeList(item)}
                                  title="Delete Feedback"
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

              {/* Pagination */}
              {listtotal > limit && (
                <div className="si-pagination-bar">
                  <div className="si-pagination-info">
                    Showing {(page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, listtotal)} of {listtotal} entries
                  </div>

                  <div className="si-pagination-controls">
                    <button
                      className="si-page-btn"
                      disabled={page <= 1}
                      onClick={() => reload(page - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: lastPage }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 || p === lastPage || Math.abs(p - page) <= 2,
                      )
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <span
                            key={p}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {prev && p - prev > 1 && (
                              <span
                                style={{ color: "#94a3b8", padding: "0 2px" }}
                              >
                                ...
                              </span>
                            )}
                            <button
                              className={`si-page-btn ${p === page ? "active" : ""}`}
                              onClick={() => reload(p)}
                            >
                              {p}
                            </button>
                          </span>
                        );
                      })}

                    <button
                      className="si-page-btn"
                      disabled={page >= lastPage}
                      onClick={() => reload(page + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/site-feedback/list" />
              </div>
            </div>
          )}
        </div>

        {/* Modal View */}
        {modalOpen && selectedItem && (
          <div className="si-modal-overlay" onClick={() => setModalOpen(false)}>
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
                    <MessageSquare size={18} />
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
                      Feedback Details
                    </h4>
                    <p
                      style={{ margin: 0, fontSize: "12px", color: "#64748b" }}
                    >
                      From {selectedItem.name || "Anonymous User"}
                    </p>
                  </div>
                </div>

                <button
                  className="si-modal-close"
                  onClick={() => setModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="si-modal-body">
                <div className="si-detail-grid">
                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Reviewer</div>
                    <div className="si-detail-item-val">
                      {selectedItem.name || "Anonymous User"}
                    </div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Rating</div>
                    <div
                      className="si-detail-item-val"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Stars value={Number(selectedItem.rating) || 0} />
                      <span>({selectedItem.rating} / 5)</span>
                    </div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Source Page</div>
                    <div className="si-detail-item-val">
                      {selectedItem.page ? (
                        <a
                          href={selectedItem.page}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {selectedItem.page}
                        </a>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Submitted On</div>
                    <div className="si-detail-item-val">
                      {formatDate(selectedItem.datetime).date}{" "}
                      {formatDate(selectedItem.datetime).time}
                    </div>
                  </div>
                </div>

                <div className="si-modal-section-title">
                  <ThumbsUp size={15} style={{ color: "#16a34a" }} /> What
                  worked well
                </div>
                <div
                  className="si-msg-box"
                  style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}
                >
                  {selectedItem.liked || "None provided"}
                </div>

                <div className="si-modal-section-title">
                  <AlertTriangle size={15} style={{ color: "#dc2626" }} /> What
                  could be better
                </div>
                <div
                  className="si-msg-box"
                  style={{ borderColor: "#fecaca", background: "#fef2f2" }}
                >
                  {selectedItem.improve || "None provided"}
                </div>
              </div>

              <div className="si-modal-footer">
                {permCan("status") && (
                  <button
                    className="si-btn-export-excel"
                    style={{
                      borderColor:
                        selectedItem.status === "2" ? "#94a3b8" : "#16a34a",
                      color:
                        selectedItem.status === "2" ? "#475569" : "#16a34a",
                    }}
                    onClick={() => setReviewed(selectedItem)}
                  >
                    {selectedItem.status === "2" ? (
                      <>
                        <RotateCcw size={15} /> Mark as New
                      </>
                    ) : (
                      <>
                        <Check size={15} /> Mark as Reviewed
                      </>
                    )}
                  </button>
                )}

                <button
                  className="si-btn-export-csv"
                  onClick={() => setModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
