import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Users,
  Clock,
  RotateCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  UserCheck,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, Skeleton, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("referred-friends");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const initialForm = {
    t_id: "",
    name: "",
    gender: "",
    email: "",
    number: "",
    course_name: "",
    batch_name: "",
    qualification: "",
    type: "",
    category: "",
    priority: "",
    msg: "",
    tstatus: "",
    profile: "",
  };

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [mode, setMode] = useState("board");
  const [model, setModel] = useState("");

  const limit = 10;
  const [courses, setAllcourses] = useState<any[]>([]);
  const [alllists, setAllLists] = useState<any[]>([]);
  const [allAlists, setAllALists] = useState<any[]>([]);

  const [stats, setStats] = useState<any>({
    open: 0,
    progress: 0,
    resolved: 0,
    total: 0,
    pending: 0,
    enrolled: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);

  const formatDate = (ts: any) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("en-IN");
  };

  const formatDateTime = (ts: any) => {
    if (!ts) return "";
    const d = new Date(ts * 1000);
    return (
      d.toLocaleDateString("en-IN") +
      " " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const location = useLocation();
  const navigate = useNavigate();

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    view = mode,
  ) => {
    setLoading(true);
    if (view === "board") setAllLists([]);
    else setAllALists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);

    try {
      const res = await listFetch("api/refers", {
          q: targetSearch,
          s: targetSort,
          n: targetPage,
        });

      if (res.data.success) {
        if (view === "board") {
          setAllLists(res.data.data);
        }
        setAllALists(res.data.data);
        setStats(res.data.stats || {});
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

  const getGender = (g: any) => {
    return g === "1" ? "Male" : g === "2" ? "Female" : "-";
  };

  const fbmemberList = async (type: any, list: any) => {
    setLoading(true);
    setAllcourses([]);
    try {
      let mid = list.mem_id;
      if (type === "fr") {
        mid = list.frmem_id;
      }

      const res = await listFetch("api/get-member", {
          mem_id: mid,
        });

      if (res.data.success) {
        const d = res.data.data[0];
        setAllcourses(d.courses || []);
        setForm({
          ...initialForm,
          name: d.name,
          email: d.email,
          number: d.number,
          gender: getGender(d.gender),
          qualification: d.qualification,
        });
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const deleteList = async (list: any) => {
    const confirm = window.confirm(
      "Are you sure you want to delete this referral record?",
    );
    if (!confirm) return;

    try {
      setLoadingId(list.id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-refer",
        {
          id: list.id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) => prev.filter((b) => b.id !== list.id));
        setAllALists((prev) => prev.filter((b) => b.id !== list.id));
        setStats((prev: any) => ({
          ...prev,
          total: Math.max(0, (prev.total || 0) - 1),
          pending:
            list.status === "1"
              ? Math.max(0, (prev.pending || 0) - 1)
              : prev.pending,
          enrolled:
            list.status === "2"
              ? Math.max(0, (prev.enrolled || 0) - 1)
              : prev.enrolled,
        }));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const moveto = (id: any) => {
    setMode(id);
    if (id === "board") loadDetails(1, "", "New", "board");
    else loadDetails(1, search, sort, "boardlist");
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "1":
        return "Pending";
      case "2":
        return "Enrolled";
      default:
        return "Unknown";
    }
  };

  const chartData = [
    { name: "Pending", value: Number(stats?.pending) || 0 },
    { name: "Enrolled", value: Number(stats?.enrolled) || 0 },
  ];

  const COLORS = ["#f59e0b", "#10b981"];

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && (ustatus === "X" || ustatus === "Y")) {
      loadDetails();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("t");
    if (type === "add") {
      setMode("add");
    } else if (type === "update") {
      setMode("update");
    }
    initchecklogin();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "RF";
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

  const exportToExcel = (rows: any[] = allAlists) => {
    if (rows.length === 0) {
      toast.warn("No data to export");
      return;
    }
    const data = rows.map((u, i) => ({
      "S No": (rows === allAlists ? (page - 1) * limit : 0) + i + 1,
      "Referrer Student": u.rname || "—",
      "Friend Name": u.name || "—",
      "Friend Email": u.email || "—",
      "Friend Phone": u.phone || "—",
      "Referred On": formatDateTime(u.datetime),
      Status: getStatus(u.status),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ReferredFriends");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      "referred_friends.xlsx",
    );
  };

  const exportToCSV = (rows: any[] = allAlists) => {
    if (rows.length === 0) {
      toast.warn("No data to export");
      return;
    }
    const data = rows.map((u, i) => ({
      "S No": (rows === allAlists ? (page - 1) * limit : 0) + i + 1,
      "Referrer Student": u.rname || "—",
      "Friend Name": u.name || "—",
      "Friend Email": u.email || "—",
      "Friend Phone": u.phone || "—",
      "Referred On": formatDateTime(u.datetime),
      Status: getStatus(u.status),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "referred_friends.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: allAlists,
      total: lastPage > 1 ? undefined : allAlists.length,
      fetchAll: () => fetchAllRows("api/refers"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

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
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .si-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
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
          gap: 10px;
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
          text-decoration: none;
        }
        .si-btn-outline:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
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

        /* Stats Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 900px) {
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
        .si-stat-card.card-pending {
          background: #fffbeb;
        }
        .si-stat-card.card-pending.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.card-enrolled {
          background: #f0fdf4;
        }
        .si-stat-card.card-enrolled.active {
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
          border: 1px solid #edf2f6;
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
        .si-avatar-badge {
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
        .si-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-user-name {
          font-weight: 600;
          color: #0f172a;
          font-size: 13.5px;
        }
        .si-user-name-link {
          font-weight: 600;
          color: var(--ad-brand);
          font-size: 13.5px;
          cursor: pointer;
          text-decoration: underline;
        }
        .si-user-sub {
          font-size: 12px;
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
        .si-status-pill.status-enrolled {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-pill.status-pending {
          background: #fef3c7;
          color: #b45309;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-enrolled .si-status-dot { background: #16a34a; }
        .status-pending .si-status-dot { background: #d97706; }

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
        .si-action-btn:hover {
          transform: scale(1.06);
        }
        .si-action-btn.btn-view {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.btn-trash {
          background: #fee2e2;
          color: #ef4444;
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
        .si-empty-box {
          text-align: center;
          padding: 60px 20px;
        }
        .si-empty-icon {
          color: #94a3b8;
          margin-bottom: 12px;
        }

        /* Dashboard Overview Grid */
        .si-dash-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }
        @media (max-width: 1024px) {
          .si-dash-grid {
            grid-template-columns: 1fr;
          }
        }
        .si-chart-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          padding: 22px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
      `}</style>

      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* ===================== BOARD MODE (Overview) ===================== */}
          {mode === "board" && (
            <div>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      Referred Friends Dashboard
                    </h3>
                    <p className="si-header-subtitle">
                      Overview of student referral activities, conversion rates
                      and enrollment
                    </p>
                  </div>
                </div>

                <div className="si-header-right">
                  <span className="si-total-count-text">
                    Total <b>{stats?.total || 0}</b>
                  </span>

                  <button
                    className="si-btn-outline"
                    onClick={() => moveto("boardlist")}
                  >
                    View All Referrals →
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="si-stats-grid">
                <div
                  className={`si-stat-card card-total ${statusFilter === "ALL" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter("ALL");
                    moveto("boardlist");
                  }}
                  title="View all referrals in board list"
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#e0f2fe", color: "#0284c7" }}
                  >
                    <Users size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Total Referrals</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.total || 0} pending={loading} id="Referredfriends-s1" /></h3>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-pending ${statusFilter === "pending" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter("pending");
                    moveto("boardlist");
                  }}
                  title="View pending invitations in board list"
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#fef3c7", color: "#d97706" }}
                  >
                    <Clock size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Pending Invitations</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.pending || 0} pending={loading} id="Referredfriends-s2" /></h3>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-enrolled ${statusFilter === "enrolled" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter("enrolled");
                    moveto("boardlist");
                  }}
                  title="View enrolled friends in board list"
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#dcfce7", color: "#16a34a" }}
                  >
                    <UserCheck size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Enrolled Friends</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.enrolled || 0} pending={loading} id="Referredfriends-s3" /></h3>
                  </div>
                </div>
              </div>

              {/* Dashboard 2-column: Preview Table + Chart */}
              <div className="si-dash-grid">
                {/* Preview table */}
                <div className="si-table-card" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid #f1f5f9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h5
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      Recent Referrals
                    </h5>
                    <button
                      className="btn btn-sm btn-link"
                      style={{
                        color: "var(--ad-brand)",
                        textDecoration: "none",
                        fontWeight: 600,
                        padding: 0,
                      }}
                      onClick={() => moveto("boardlist")}
                    >
                      View All →
                    </button>
                  </div>
                  <div className="si-table-responsive">
                    <table className="si-table">
                      <thead className="si-thead">
                        <tr>
                          <th className="si-th" style={{ width: 50 }}>
                            #
                          </th>
                          <th className="si-th">Referrer</th>
                          <th className="si-th">Friend</th>
                          <th className="si-th">Date</th>
                          <th className="si-th">Status</th>
                        </tr>
                      </thead>
                      <tbody className="si-tbody">
                        {loading ? (
                          <SkeletonRows />
                        ) : (
                          alllists.slice(0, 7).map((list, index) => {
                            const st = getStatus(list.status);
                            return (
                              <tr key={list.id || index} className="si-tr">
                                <td
                                  className="si-td"
                                  style={{ color: "#64748b", fontWeight: 600 }}
                                >
                                  {index + 1}
                                </td>
                                <td className="si-td">
                                  <span
                                    className="si-user-name-link"
                                    onClick={() => {
                                      fbmemberList("refer", list);
                                      setModel("view");
                                    }}
                                  >
                                    {list.rname || "—"}
                                  </span>
                                </td>
                                <td className="si-td">
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {list.name || "—"}
                                  </div>
                                  <div
                                    style={{ fontSize: 11.5, color: "#64748b" }}
                                  >
                                    {list.email || ""}
                                  </div>
                                </td>
                                <td
                                  className="si-td"
                                  style={{ fontSize: 13, color: "#475569" }}
                                >
                                  {formatDate(list.datetime)}
                                </td>
                                <td className="si-td">
                                  <span
                                    className={`si-status-pill ${
                                      st === "Enrolled"
                                        ? "status-enrolled"
                                        : "status-pending"
                                    }`}
                                  >
                                    <span className="si-status-dot" /> {st}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Status Breakdown Chart */}
                <div className="si-chart-card">
                  <h5
                    style={{
                      margin: "0 0 16px 0",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Referral Conversion
                  </h5>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        background: "#fffbeb",
                        padding: "10px",
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#d97706",
                        }}
                      >
                        PENDING
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        {stats?.pending || 0}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#ecfdf5",
                        padding: "10px",
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#059669",
                        }}
                      >
                        ENROLLED
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        {stats?.enrolled || 0}
                      </div>
                    </div>
                  </div>
        
                  {loading ? (
                    <div style={{ height: 230, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Skeleton w={170} h={170} r="50%" />
                    </div>
                  ) : (
                    <div style={{ height: 230 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={5}
                          >
                            {chartData.map((_, index) => (
                              <Cell
                                key={index}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== BOARDLIST MODE (Full Table) ===================== */}
          {mode === "boardlist" && (
            <div>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">Referred Friends List</h3>
                    <p className="si-header-subtitle">
                      Manage student referrals, contact details and follow up on
                      enrollment
                    </p>
                  </div>
                </div>

                <div className="si-header-right">
                  <span className="si-total-count-text">
                    Total <b>{stats?.total || 0}</b>
                  </span>

                  <button
                    className="si-btn-export-excel"
                    onClick={() => askExport("excel")}
                  >
                    <FileSpreadsheet size={15} /> Export Excel
                  </button>

                  <button className="si-btn-export-csv" onClick={() => askExport("csv")}>
                    <FileText size={15} /> Export CSV
                  </button>

                  <button
                    className="si-btn-outline"
                    onClick={() => moveto("board")}
                  >
                    <ArrowLeft size={15} /> Back to Dashboard
                  </button>
                </div>
              </div>

              {/* 3 Stat Cards in Boardlist */}
              <div className="si-stats-grid">
                <div
                  className={`si-stat-card card-total ${statusFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setStatusFilter("ALL")}
                  title="Show all referrals"
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#e0f2fe", color: "#0284c7" }}
                  >
                    <Users size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Total Referrals</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.total || 0} pending={loading} id="Referredfriends-s4" /></h3>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-pending ${statusFilter === "pending" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "pending" ? "ALL" : "pending",
                    )
                  }
                  title={
                    statusFilter === "pending"
                      ? "Click to clear filter"
                      : "Filter by Pending Invitations"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#fffbeb", color: "#d97706" }}
                  >
                    <Clock size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Pending Invitations</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.pending || 0} pending={loading} id="Referredfriends-s5" /></h3>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-enrolled ${statusFilter === "enrolled" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "enrolled" ? "ALL" : "enrolled",
                    )
                  }
                  title={
                    statusFilter === "enrolled"
                      ? "Click to clear filter"
                      : "Filter by Enrolled Friends"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#dcfce7", color: "#16a34a" }}
                  >
                    <UserCheck size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Enrolled Friends</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.enrolled || 0} pending={loading} id="Referredfriends-s6" /></h3>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <div className="si-filter-left">
                  <div className="si-sort-group">
                    <ArrowUpDown size={15} color="#64748b" />
                    <span>Sort By:</span>
                    <select
                      className="si-select-sort"
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        loadDetails(1, search, e.target.value, "boardlist");
                      }}
                    >
                      <option value="New">New</option>
                      <option value="Old">Old</option>
                    </select>
                  </div>
                </div>

                <div className="si-filter-right">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      loadDetails(1, search, sort, "boardlist");
                    }}
                  >
                    <ListSearch
                      placeholder="Search referrer or friend..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </form>

                  <button data-refresh
                    className="reload-btn"
                    title="Reset search & reload"
                    onClick={() => {
                      setSearch("");
                      loadDetails(1, "", "New", "boardlist");
                    }}
                  >
                    <RotateCw size={16} />
                  </button>
                </div>
              </div>

              {/* Table Card */}
              <div className="si-table-card">
                <div className="si-table-responsive">
                  <table className="si-table">
                    <thead className="si-thead">
                      <tr>
                        <th className="si-th" style={{ width: 60 }}>
                          S.No
                        </th>
                        <th className="si-th">Referrer Student</th>
                        <th className="si-th">Referred Friend</th>
                        <th className="si-th">Date & Time</th>
                        <th className="si-th">Status</th>
                        <th
                          className="si-th"
                          style={{ textAlign: "center", width: 90 }}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {(() => {
                        const displayedAlists = allAlists.filter((item) => {
                          if (statusFilter === "pending")
                            return String(item.status) === "1";
                          if (statusFilter === "enrolled")
                            return String(item.status) === "2";
                          return true;
                        });

                        if (loading) {
                          return (
                            <tr>
                              <td
                                colSpan={6}
                                style={{
                                  textAlign: "center",
                                  padding: "40px 0",
                                }}
                              >
                                <div
                                  className="spinner-border text-primary"
                                  role="status"
                                  style={{ width: 28, height: 28 }}
                                >
                                  <span className="visually-hidden">
                                    Loading...
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        if (allAlists.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6}>
                                <div className="si-empty-box">
                                  <Users size={40} className="si-empty-icon" />
                                  <h5
                                    style={{
                                      fontWeight: 600,
                                      color: "#1e293b",
                                      margin: "4px 0",
                                    }}
                                  >
                                    No Referred Friends Found
                                  </h5>
                                  <p
                                    style={{
                                      color: "#64748b",
                                      fontSize: "13px",
                                      margin: 0,
                                    }}
                                  >
                                    {search
                                      ? "No referrals match your search query."
                                      : "There are currently no referrals recorded."}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        if (displayedAlists.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6}>
                                <div className="si-empty-box">
                                  <Users size={40} className="si-empty-icon" />
                                  <h5
                                    style={{
                                      fontWeight: 600,
                                      color: "#1e293b",
                                      margin: "4px 0",
                                    }}
                                  >
                                    No{" "}
                                    {statusFilter === "pending"
                                      ? "Pending"
                                      : "Enrolled"}{" "}
                                    Referrals
                                  </h5>
                                  <p
                                    style={{
                                      color: "#64748b",
                                      fontSize: "13px",
                                      margin: 0,
                                    }}
                                  >
                                    No referrals match the "{statusFilter}"
                                    status filter.
                                  </p>
                                  <button
                                    className="si-btn-outline"
                                    style={{ marginTop: "10px" }}
                                    onClick={() => setStatusFilter("ALL")}
                                  >
                                    Clear Filter
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return displayedAlists.map((list, index) => {
                          const avatarStyle =
                            avatarPalette[index % avatarPalette.length];
                          const initials = getInitials(list.name);
                          const st = getStatus(list.status);

                          return (
                            <tr key={list.id || index} className="si-tr">
                              <td
                                className="si-td"
                                style={{ color: "#64748b", fontWeight: 600 }}
                              >
                                {(page - 1) * limit + index + 1}
                              </td>

                              {/* Referrer */}
                              <td className="si-td">
                                <span
                                  className="si-user-name-link"
                                  onClick={() => {
                                    fbmemberList("refer", list);
                                    setModel("view");
                                  }}
                                >
                                  {list.rname || "—"}
                                </span>
                              </td>

                              {/* Friend Details */}
                              <td className="si-td">
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                  }}
                                >
                                  <div
                                    className="si-avatar-badge"
                                    style={{
                                      background: avatarStyle.bg,
                                      color: avatarStyle.text,
                                    }}
                                  >
                                    {initials}
                                  </div>
                                  <div className="si-user-info">
                                    <span className="si-user-name">
                                      {list.name || "—"}
                                    </span>
                                    <span className="si-user-sub">
                                      {list.email || "—"}
                                    </span>
                                    {list.phone && (
                                      <span
                                        className="si-user-sub"
                                        style={{ fontSize: "11.5px" }}
                                      >
                                        📞 {list.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Date */}
                              <td
                                className="si-td"
                                style={{ fontSize: 13, color: "#475569" }}
                              >
                                {formatDate(list.datetime)}
                              </td>

                              {/* Status */}
                              <td className="si-td">
                                <span
                                  className={`si-status-pill ${
                                    st === "Enrolled"
                                      ? "status-enrolled"
                                      : "status-pending"
                                  }`}
                                >
                                  <span className="si-status-dot" /> {st}
                                </span>
                              </td>

                              {/* Actions */}
                              <td
                                className="si-td"
                                style={{ textAlign: "center" }}
                              >
                                <div
                                  className="si-actions-cell"
                                  style={{ justifyContent: "center" }}
                                >
                                  {list.status === "2" && (
                                    <button
                                      type="button"
                                      className="si-action-btn btn-view"
                                      title="View Friend Details"
                                      onClick={() => {
                                        fbmemberList("fr", list);
                                        setModel("view");
                                      }}
                                    >
                                      <Eye size={15} />
                                    </button>
                                  )}
                                  {permCan("delete") && (
                                    <button
                                      type="button"
                                      className="si-action-btn btn-trash"
                                      title="Delete Referral"
                                      disabled={loadingId === list.id}
                                      onClick={() => deleteList(list)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Footer & Pagination */}
                <div className="si-table-footer">
                  <div className="si-footer-left">
                    <span>
                      Showing{" "}
                      <b>{allAlists.length ? (page - 1) * limit + 1 : 0}</b> to{" "}
                      <b>{Math.min(page * limit, stats.total || 0)}</b> of{" "}
                      <b>{stats.total || 0}</b> entries
                    </span>
                  </div>

                  <div className="si-pagination">
                    <button
                      type="button"
                      className="si-page-nav-btn"
                      disabled={page <= 1}
                      onClick={() => {
                        const p = page - 1;
                        setPage(p);
                        loadDetails(p, search, sort, "boardlist");
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: Math.min(lastPage || 1, 5) }).map(
                      (_, i) => {
                        const pNum = i + 1;
                        return (
                          <button
                            key={pNum}
                            type="button"
                            className={`si-page-btn ${page === pNum ? "active" : ""}`}
                            onClick={() => {
                              setPage(pNum);
                              loadDetails(pNum, search, sort, "boardlist");
                            }}
                          >
                            {pNum}
                          </button>
                        );
                      },
                    )}

                    <button
                      type="button"
                      className="si-page-nav-btn"
                      disabled={page >= (lastPage || 1)}
                      onClick={() => {
                        const p = page + 1;
                        setPage(p);
                        loadDetails(p, search, sort, "boardlist");
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/refers" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Student Details Modal ---------------- */}
        {model === "view" && form && (
          <div
            className="modal fade show d-block"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              style={{ maxWidth: 480 }}
            >
              <div
                className="modal-content"
                style={{
                  borderRadius: 20,
                  border: "none",
                  overflow: "hidden",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                }}
              >
                <div
                  className="modal-header"
                  style={{
                    background:
                      "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "18px 24px",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: "var(--ad-brand)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Users size={20} />
                    </div>
                    <div>
                      <h5
                        className="modal-title"
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          margin: 0,
                          color: "#0f172a",
                        }}
                      >
                        Student Profile
                      </h5>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Member referral profile information
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModel("")}
                  />
                </div>

                <div className="modal-body" style={{ padding: 24 }}>
                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: "1px solid #edf2f7",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {form.name || "—"}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#475569", marginTop: 2 }}
                    >
                      {form.email || "—"}
                    </div>
                    {form.number && (
                      <div style={{ fontSize: 13, color: "#475569" }}>
                        📞 {form.number}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid #edf2f7",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                        }}
                      >
                        Gender
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#0f172a",
                          marginTop: 3,
                        }}
                      >
                        {form.gender || "—"}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid #edf2f7",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                        }}
                      >
                        Qualification
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#0f172a",
                          marginTop: 3,
                        }}
                      >
                        {form.qualification || "—"}
                      </div>
                    </div>
                  </div>

                  {courses.length > 0 && (
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "14px 16px",
                        borderRadius: 14,
                        border: "1px solid #edf2f7",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                          marginBottom: 6,
                        }}
                      >
                        Enrolled Courses ({courses.length})
                      </div>
                      {courses.map((list, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13,
                            color: "#334155",
                            padding: "4px 0",
                            borderBottom:
                              i < courses.length - 1
                                ? "1px solid #edf2f7"
                                : "none",
                          }}
                        >
                          📘 <b>{decodeHtml(list.course_name)}</b> —{" "}
                          <span style={{ color: "#64748b" }}>
                            {decodeHtml(list.batch_name)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="modal-footer"
                  style={{
                    borderTop: "1px solid #edf2f7",
                    padding: "14px 24px",
                  }}
                >
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: "var(--ad-brand)",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "8px 20px",
                      fontWeight: 600,
                      fontSize: 13,
                      border: "none",
                    }}
                    onClick={() => setModel("")}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
