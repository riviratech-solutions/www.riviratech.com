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

import {
  MessageSquare,
  Clock,
  CheckCircle,
  Search,
  RotateCw,
  Eye,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { AnimatedNumber, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

interface StudentQueryItem {
  id: number;
  mem_id: string;
  to_id: string;
  name?: string;
  email?: string;
  number?: string;
  sname?: string;
  semail?: string;
  sphone?: string;
  msg: string;
  type: string;
  datetime: string;
  deltime?: string;
  status: string; // "1" = Pending, "2" = Viewed
}

export default function TrainerContacts() {
  const navigate = useNavigate();

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<StudentQueryItem[]>([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    viewed: 0,
  });

  // Query filters & pagination
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [stat, setStat] = useState(""); // "" = All, "1" = Pending, "2" = Viewed

  // Modal
  const [viewItem, setViewItem] = useState<StudentQueryItem | null>(null);

  const formatDateTime = (ts: any) => {
    if (!ts) return "—";
    const num = Number(ts);
    const date = new Date(num > 1e11 ? num : num * 1000);
    if (isNaN(date.getTime())) return String(ts);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarColors = [
    { bg: "#ede9fe", text: "#7c3aed" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#fef3c7", text: "#d97706" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#fce7f3", text: "#db2777" },
  ];

  const getColor = (str?: string) => {
    if (!str) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    df = "",
    dt = "",
    st = "",
  ) => {
    setLoading(true);
    setList([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);
    setStat(st);

    try {
      const res = await listFetch("api/trainer/trainer-contacts", {
        q: targetSearch,
        s: targetSort,
        n: targetPage,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
        st: st,
      });

      if (res.data.success) {
        setList(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
        setLastPage(res.data.lastPage || 1);
      } else {
        setLastPage(0);
        if (res.data.message && res.data.message !== "No data found") {
          toast.error(res.data.message);
        }
      }
    } catch {
      toast.error("❌ Failed to load student queries");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQuery = async (item: StudentQueryItem) => {
    setViewItem(item);

    // If query is pending, mark it as viewed immediately
    if (item.status === "1") {
      try {
        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/trainer/viewed-trainer-contact",
          {
            id: item.id,
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );

        if (res.data.success) {
          // Update in local state
          setList((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, status: "2" } : it)),
          );
          setViewItem((prev) => (prev ? { ...prev, status: "2" } : null));
          setStats((prev) => ({
            ...prev,
            pending: Math.max(0, prev.pending - 1),
            viewed: prev.viewed + 1,
          }));
        }
      } catch {
        // silently ignore error on view update
      }
    }
  };

  const exportToExcel = () => {
    if (list.length === 0) {
      toast.warn("No data to export");
      return;
    }
    const data = list.map((item, index) => ({
      "S No": (page - 1) * 10 + index + 1,
      "Student Name": item.sname || item.name || "—",
      "Student Email": item.semail || item.email || "—",
      "Student Phone": item.sphone || item.number || "—",
      "Query Message": item.msg,
      "Received On": formatDateTime(item.datetime),
      Status: item.status === "2" ? "Viewed" : "Pending",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "student_queries.csv",
    );
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && res.data.id === "2") {
          loadDetails();
        } else {
          navigate("/logout");
        }
      })
      .catch(() => {
        navigate("/logout");
      });
  }, []);

  return (
    <>
      <Head
        pageTitle="Student Queries | Trainer Panel"
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2500} />

      <style>{`
        .sq-page-wrapper {
        width:100%;
          background-color: #f8fafc;
          min-height: calc(100vh - 80px);
          padding: 24px 28px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .sq-header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .sq-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sq-header-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #582fea;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(88, 47, 234, 0.12);
        }
        .sq-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
        }
        .sq-header-subtitle {
          font-size: 13.5px;
          color: #64748b;
          margin-top: 3px;
          margin-bottom: 0;
        }
        .sq-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* KPI Cards */
        .sq-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .sq-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .sq-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
        }
        .sq-stat-card.active-stat {
          border-color: #582fea;
          box-shadow: 0 0 0 2px rgba(88, 47, 234, 0.15);
        }
        .sq-stat-card-left {
          display: flex;
          flex-direction: column;
        }
        .sq-stat-label {
          font-size: 13px;
          font-weight: 500;
          color: #64748b;
          margin-bottom: 6px;
        }
        .sq-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1;
        }
        .sq-stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
          margin-top: 6px;
          width: fit-content;
        }
        .sq-stat-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Filter Bar */
        .sq-filter-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px 20px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .sq-filter-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          flex: 1;
        }
        .sq-search-box {
          position: relative;
          min-width: 260px;
          flex: 1;
          max-width: 360px;
        }
        .sq-search-input {
          width: 100%;
          padding: 9px 12px 9px 36px;
          font-size: 13.5px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          background: #f8fafc;
          color: #1e293b;
          outline: none;
          transition: all 0.2s;
        }
        .sq-search-input:focus {
          border-color: #582fea;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(88, 47, 234, 0.1);
        }
        .sq-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }
        .sq-status-pills {
          display: inline-flex;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 10px;
          gap: 3px;
        }
        .sq-status-pill-btn {
          border: none;
          background: transparent;
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 8px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sq-status-pill-btn:hover {
          color: #1e293b;
        }
        .sq-status-pill-btn.active {
          background: #ffffff;
          color: #582fea;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
        }
        .sq-filter-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* Buttons */
        .sq-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .sq-btn-primary {
          background: #582fea;
          color: #ffffff;
        }
        .sq-btn-primary:hover {
          background: #4721d0;
        }
        .sq-btn-outline {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #475569;
        }
        .sq-btn-outline:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #1e293b;
        }
        .sq-select {
          padding: 8px 12px;
          font-size: 13px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          background: #ffffff;
          color: #334155;
          outline: none;
          cursor: pointer;
        }
        .sq-select:focus {
          border-color: #582fea;
        }

        /* Table Card */
        .sq-table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .sq-table-container {
          overflow-x: auto;
          width: 100%;
        }
        .sq-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13.5px;
        }
        .sq-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 13px 18px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          white-space: nowrap;
        }
        .sq-table td {
          padding: 16px 18px;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
          vertical-align: middle;
        }
        .sq-table tbody tr:last-child td {
          border-bottom: none;
        }
        .sq-table tbody tr:hover {
          background-color: #fbfcfe;
        }
        .sq-table-row-unread {
          background-color: #faf5ff !important;
        }
        .sq-table-row-unread:hover {
          background-color: #f3e8ff !important;
        }

        /* Student cell */
        .sq-student-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sq-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .sq-student-info {
          display: flex;
          flex-direction: column;
        }
        .sq-student-name {
          font-weight: 600;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sq-student-email {
          font-size: 12px;
          color: #64748b;
          text-decoration: none;
          margin-top: 1px;
        }
        .sq-student-email:hover {
          color: #582fea;
        }
        .sq-student-phone {
          font-size: 11.5px;
          color: #94a3b8;
        }

        /* Message Preview */
        .sq-msg-preview-box {
          max-width: 340px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: #334155;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Status Badges */
        .sq-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .sq-status-pending {
          background: #fef3c7;
          color: #b45309;
        }
        .sq-status-viewed {
          background: #dcfce7;
          color: #15803d;
        }

        /* Actions */
        .sq-action-btn-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sq-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
        }
        .sq-icon-btn:hover {
          background: #f8fafc;
          color: #582fea;
          border-color: #c7d2fe;
        }

        /* Pagination */
        .sq-pagination-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
          flex-wrap: wrap;
          gap: 12px;
        }
        .sq-pagination-info {
          font-size: 13px;
          color: #64748b;
        }
        .sq-pagination-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sq-page-nav-btn {
          padding: 6px 12px;
          border-radius: 7px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }
        .sq-page-nav-btn:hover:not(:disabled) {
          border-color: #582fea;
          color: #582fea;
        }
        .sq-page-nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Modal Backdrop & Dialog */
        .sq-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1050;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: sqFadeIn 0.2s ease-out;
        }
        @keyframes sqFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .sq-modal-box {
          background: #ffffff;
          border-radius: 18px;
          max-width: 560px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
          overflow: hidden;
          animation: sqSlideUp 0.25s ease-out;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }
        @keyframes sqSlideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .sq-modal-header {
          padding: 18px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
        }
        .sq-modal-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sq-modal-close-btn {
          border: none;
          background: #f1f5f9;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          transition: all 0.15s;
        }
        .sq-modal-close-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .sq-modal-body {
          padding: 24px;
          overflow-y: auto;
        }
        .sq-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          background: #f8fafc;
        }

        /* Detail Student Card inside Modal */
        .sq-modal-student-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        .sq-modal-msg-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 18px;
          margin-bottom: 16px;
        }
        .sq-modal-msg-text {
          font-size: 14px;
          line-height: 1.6;
          color: #1e293b;
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
        }

        /* Empty State */
        .sq-empty-state {
          padding: 60px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .sq-empty-icon-box {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          margin-bottom: 16px;
        }
      `}</style>

      <div className="content">
        <div className="sq-page-wrapper">
          {/* Top Header */}
          <div className="sq-header-container">
            <div className="sq-header-left">
              <div className="sq-header-icon-box">
                <MessageSquare size={26} />
              </div>
              <div>
                <h1 className="sq-header-title">Student Queries</h1>
                <p className="sq-header-subtitle">
                  Review and respond to questions received from enrolled
                  students
                </p>
              </div>
            </div>

            <div className="sq-header-right">
              <button
                className="sq-btn sq-btn-outline"
                onClick={exportToExcel}
                title="Export to CSV"
              >
                <FileSpreadsheet size={16} />
                Export CSV
              </button>
              <button
                data-refresh
                className="sq-btn sq-btn-outline"
                onClick={() =>
                  loadDetails(page, search, sort, dfrom, dto, stat)
                }
                title="Refresh"
              >
                <RotateCw size={15} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="sq-stats-grid">
            {/* Total */}
            <div
              className={`sq-stat-card ${stat === "" ? "active-stat" : ""}`}
              onClick={() => loadDetails(1, search, sort, dfrom, dto, "")}
            >
              <div className="sq-stat-card-left">
                <span className="sq-stat-label">Total Queries</span>
                <span className="sq-stat-value"><AnimatedNumber value={stats.total} pending={loading} id="TrainerContacts-s1" /></span>
                <span
                  className="sq-stat-badge"
                  style={{ background: "#eef2ff", color: "#4f46e5" }}
                >
                  All student messages
                </span>
              </div>
              <div
                className="sq-stat-icon-wrapper"
                style={{ background: "#eef2ff", color: "#582fea" }}
              >
                <MessageSquare size={22} />
              </div>
            </div>

            {/* Pending */}
            <div
              className={`sq-stat-card ${stat === "1" ? "active-stat" : ""}`}
              onClick={() => loadDetails(1, search, sort, dfrom, dto, "1")}
            >
              <div className="sq-stat-card-left">
                <span className="sq-stat-label">Unread / Pending</span>
                <span className="sq-stat-value"><AnimatedNumber value={stats.pending} pending={loading} id="TrainerContacts-s2" /></span>
                <span
                  className="sq-stat-badge"
                  style={{ background: "#fef3c7", color: "#b45309" }}
                >
                  <Clock size={12} /> Awaiting review
                </span>
              </div>
              <div
                className="sq-stat-icon-wrapper"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Clock size={22} />
              </div>
            </div>

            {/* Viewed */}
            <div
              className={`sq-stat-card ${stat === "2" ? "active-stat" : ""}`}
              onClick={() => loadDetails(1, search, sort, dfrom, dto, "2")}
            >
              <div className="sq-stat-card-left">
                <span className="sq-stat-label">Viewed / Reviewed</span>
                <span className="sq-stat-value"><AnimatedNumber value={stats.viewed} pending={loading} id="TrainerContacts-s3" /></span>
                <span
                  className="sq-stat-badge"
                  style={{ background: "#dcfce7", color: "#15803d" }}
                >
                  <CheckCircle size={12} /> Checked
                </span>
              </div>
              <div
                className="sq-stat-icon-wrapper"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle size={22} />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="sq-filter-card">
            <div className="sq-filter-left">
              {/* Search Input */}
              <div className="sq-search-box">
                <Search size={16} className="sq-search-icon" />
                <input
                  type="text"
                  placeholder="Search by student name, email, query..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    loadDetails(1, e.target.value, sort, dfrom, dto, stat);
                  }}
                  className="sq-search-input"
                />
              </div>

              {/* Date Filter */}
              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(df, dt) => {
                  setDfrom(df);
                  setDto(dt);
                  loadDetails(1, search, sort, df, dt, stat);
                }}
              />

              {/* Status Pills */}
              <div className="sq-status-pills">
                <button
                  className={`sq-status-pill-btn ${stat === "" ? "active" : ""}`}
                  onClick={() => loadDetails(1, search, sort, dfrom, dto, "")}
                >
                  All
                </button>
                <button
                  className={`sq-status-pill-btn ${stat === "1" ? "active" : ""}`}
                  onClick={() => loadDetails(1, search, sort, dfrom, dto, "1")}
                >
                  Pending ({stats.pending})
                </button>
                <button
                  className={`sq-status-pill-btn ${stat === "2" ? "active" : ""}`}
                  onClick={() => loadDetails(1, search, sort, dfrom, dto, "2")}
                >
                  Viewed ({stats.viewed})
                </button>
              </div>
            </div>

            <div className="sq-filter-right">
              {/* Sort Dropdown */}
              <select
                className="sq-select"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  loadDetails(1, search, e.target.value, dfrom, dto, stat);
                }}
              >
                <option value="New">Newest First</option>
                <option value="Old">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Table Card */}
          <div className="sq-table-card">
            <div className="sq-table-container">
              <table className="sq-table">
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>#</th>
                    <th>Student</th>
                    <th>Query Message</th>
                    <th>Received On</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows />
                  ) : list.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="sq-empty-state">
                          <div className="sq-empty-icon-box">
                            <MessageSquare size={30} />
                          </div>
                          <h3
                            style={{
                              fontSize: "16px",
                              fontWeight: "700",
                              color: "#1e293b",
                              margin: "0 0 6px",
                            }}
                          >
                            No student queries found
                          </h3>
                          <p
                            style={{
                              fontSize: "13.5px",
                              color: "#64748b",
                              margin: 0,
                              maxWidth: "360px",
                            }}
                          >
                            {search || stat || dfrom
                              ? "Try adjusting your search filters to find what you're looking for."
                              : "You currently have no questions or queries submitted by students."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    list.map((item, index) => {
                      const studentName = item.sname || item.name || "Student";
                      const studentEmail = item.semail || item.email || "";
                      const studentPhone = item.sphone || item.number || "";
                      const avatarStyle = getColor(studentName);
                      const isUnread = item.status === "1";

                      return (
                        <tr
                          key={item.id}
                          className={isUnread ? "sq-table-row-unread" : ""}
                        >
                          <td
                            style={{
                              color: "#94a3b8",
                              fontWeight: 600,
                              fontSize: "12.5px",
                            }}
                          >
                            {(page - 1) * 10 + index + 1}
                          </td>
                          <td>
                            <div className="sq-student-cell">
                              <div
                                className="sq-avatar"
                                style={{
                                  backgroundColor: avatarStyle.bg,
                                  color: avatarStyle.text,
                                }}
                              >
                                {getInitials(studentName)}
                              </div>
                              <div className="sq-student-info">
                                <span className="sq-student-name">
                                  {studentName}
                                  {isUnread && (
                                    <span
                                      style={{
                                        width: "7px",
                                        height: "7px",
                                        borderRadius: "50%",
                                        background: "#f59e0b",
                                        display: "inline-block",
                                      }}
                                      title="Unread"
                                    />
                                  )}
                                </span>
                                {studentEmail && (
                                  <a
                                    href={`mailto:${studentEmail}`}
                                    className="sq-student-email"
                                  >
                                    {studentEmail}
                                  </a>
                                )}
                                {studentPhone && (
                                  <span className="sq-student-phone">
                                    {studentPhone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div
                              className="sq-msg-preview-box"
                              title={item.msg}
                              onClick={() => handleOpenQuery(item)}
                              style={{ cursor: "pointer" }}
                            >
                              {item.msg}
                            </div>
                          </td>

                          <td
                            style={{
                              color: "#475569",
                              fontSize: "13px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDateTime(item.datetime)}
                          </td>

                          <td>
                            {item.status === "2" ? (
                              <span className="sq-status-badge sq-status-viewed">
                                <CheckCircle size={13} /> Viewed
                              </span>
                            ) : (
                              <span className="sq-status-badge sq-status-pending">
                                <Clock size={13} /> Pending
                              </span>
                            )}
                          </td>

                          <td>
                            <div
                              className="sq-action-btn-group"
                              style={{ justifyContent: "flex-end" }}
                            >
                              <button
                                className="sq-icon-btn"
                                title="View Full Query"
                                onClick={() => handleOpenQuery(item)}
                              >
                                <Eye size={16} />
                              </button>

                              {studentEmail && (
                                <a
                                  href={`mailto:${studentEmail}?subject=Re: Your Query&body=Hi ${studentName},\n\nRegarding your question: "${encodeURIComponent(
                                    item.msg,
                                  )}"\n\n`}
                                  className="sq-icon-btn"
                                  title="Reply via Email"
                                >
                                  <Mail size={15} />
                                </a>
                              )}

                              {studentPhone && (
                                <a
                                  href={`tel:${studentPhone}`}
                                  className="sq-icon-btn"
                                  title="Call Student"
                                >
                                  <Phone size={15} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination */}
            {!loading && list.length > 0 && (
              <div className="sq-pagination-container">
                <div className="sq-pagination-info">
                  Showing page <strong>{page}</strong> of{" "}
                  <strong>{lastPage || 1}</strong>
                </div>

                <div className="sq-pagination-buttons">
                  <button
                    className="sq-page-nav-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      loadDetails(page - 1, search, sort, dfrom, dto, stat)
                    }
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  <button
                    className="sq-page-nav-btn"
                    disabled={page >= lastPage}
                    onClick={() =>
                      loadDetails(page + 1, search, sort, dfrom, dto, stat)
                    }
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/trainer/trainer-contacts" />
            </div>
          </div>
        </div>

        {/* View Query Details Modal */}
        {viewItem && (
          <div className="sq-modal-backdrop" onClick={() => setViewItem(null)}>
            <div className="sq-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="sq-modal-header">
                <div className="sq-modal-title">
                  <MessageSquare size={19} color="#582fea" />
                  Student Query Details
                </div>
                <button
                  className="sq-modal-close-btn"
                  onClick={() => setViewItem(null)}
                >
                  <X size={17} />
                </button>
              </div>

              <div className="sq-modal-body">
                {/* Student Card */}
                <div className="sq-modal-student-card">
                  <div
                    className="sq-avatar"
                    style={{
                      width: "46px",
                      height: "46px",
                      fontSize: "15px",
                      backgroundColor: getColor(viewItem.sname || viewItem.name)
                        .bg,
                      color: getColor(viewItem.sname || viewItem.name).text,
                    }}
                  >
                    {getInitials(viewItem.sname || viewItem.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: "700",
                        color: "#0f172a",
                      }}
                    >
                      {viewItem.sname || viewItem.name || "Student"}
                    </div>
                    {(viewItem.semail || viewItem.email) && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#64748b",
                          marginTop: "2px",
                        }}
                      >
                        <a
                          href={`mailto:${viewItem.semail || viewItem.email}`}
                          style={{ color: "#582fea", textDecoration: "none" }}
                        >
                          {viewItem.semail || viewItem.email}
                        </a>
                      </div>
                    )}
                    {(viewItem.sphone || viewItem.number) && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
                          marginTop: "2px",
                        }}
                      >
                        Phone: {viewItem.sphone || viewItem.number}
                      </div>
                    )}
                  </div>
                  <div>
                    {viewItem.status === "2" ? (
                      <span className="sq-status-badge sq-status-viewed">
                        <CheckCircle size={13} /> Viewed
                      </span>
                    ) : (
                      <span className="sq-status-badge sq-status-pending">
                        <Clock size={13} /> Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Details */}
                <div style={{ marginBottom: "8px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Question / Query:
                  </span>
                </div>
                <div className="sq-modal-msg-card">
                  <p className="sq-modal-msg-text">{viewItem.msg}</p>
                </div>

                {/* Metadata */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: "#94a3b8",
                    padding: "0 4px",
                  }}
                >
                  <span>Received on: {formatDateTime(viewItem.datetime)}</span>
                  <span>Contact ID: #{viewItem.id}</span>
                </div>
              </div>

              <div className="sq-modal-footer">
                {(viewItem.semail || viewItem.email) && (
                  <a
                    href={`mailto:${
                      viewItem.semail || viewItem.email
                    }?subject=Re: Your Query&body=Hi ${
                      viewItem.sname || viewItem.name || "Student"
                    },\n\nRegarding your question: "${encodeURIComponent(
                      viewItem.msg,
                    )}"\n\n`}
                    className="sq-btn sq-btn-primary"
                    style={{ textDecoration: "none" }}
                  >
                    <Mail size={15} />
                    Reply via Email
                  </a>
                )}
                <button
                  className="sq-btn sq-btn-outline"
                  onClick={() => setViewItem(null)}
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
