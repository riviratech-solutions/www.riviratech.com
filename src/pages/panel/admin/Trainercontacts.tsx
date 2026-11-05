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
  Mail,
  CheckCircle,
  Clock,
  MessageSquare,
  RotateCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import StudentTrainerContacts from "../student/TrainerContacts";
import TrainerPanelContacts from "../trainer/TrainerContacts";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const [role, setRole] = useState("");
  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState("");

  const initialForm = {
    id: "",
    name: "",
    email: "",
    number: "",
    sname: "",
    semail: "",
    sphone: "",
    tname: "",
    temail: "",
    tphone: "",
    subject: "",
    msg: "",
    datetime: "",
    status: "",
  };
  const [form, setForm] = useState<any>(initialForm);

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);

  const [listtotal, setTotal] = useState(0);
  const [listpending, setPending] = useState(0);
  const [listviewed, setViewed] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [stat, setStat] = useState(""); // "" = All, "1" = Pending, "2" = Viewed
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

  const navigate = useNavigate();

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    df = "",
    dt = "",
    st = "",
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);
    setStat(st);

    try {
      const res = await listFetch("api/trainer-contacts", {
          q: targetSearch,
          s: targetSort,
          n: targetPage,
          df: dayStartEpoch(df),
          dt: dayEndEpoch(dt),
          st: st,
        });

      if (res.data.success) {
        setAllLists(res.data.data);
        if (res.data.stats) {
          setTotal(res.data.stats.total);
          setPending(res.data.stats.pending);
          setViewed(res.data.stats.viewed);
        }
        setLastPage(res.data.lastPage);
      } else {
        setLastPage(0);
        if (res.data.message && res.data.message !== "No data found") {
          toast.error(res.data.message);
        }
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const viewedList = async (list: any) => {
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/viewed-trainer-contact",
        {
          id: list.id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        setPending((prev) => Math.max(0, prev - 1));
        setViewed((prev) => prev + 1);
        setAllLists((prev) =>
          prev.map((b) => (b.id === list.id ? { ...b, status: "2" } : b)),
        );
      }
    } catch {
      // silently ignore
    }
  };

  const deleteList = async (item: any) => {
    if (
      !window.confirm("Are you sure you want to delete this trainer query?")
    ) {
      return;
    }
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-trainer-contact",
        {
          id: item.id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message || "Query deleted successfully");
        setAllLists((prev) => prev.filter((b) => b.id !== item.id));
        setTotal((prev) => Math.max(0, prev - 1));
        if (item.status === "1") {
          setPending((prev) => Math.max(0, prev - 1));
        } else if (item.status === "2") {
          setViewed((prev) => Math.max(0, prev - 1));
        }
      } else {
        toast.error(res.data.message || "Failed to delete query");
      }
    } catch {
      toast.error("❌ Something went wrong while deleting");
    }
  };

  const getStatusText = (status: any) => {
    switch (status) {
      case "1":
        return "Pending";
      case "2":
        return "Viewed";
      default:
        return "Unknown";
    }
  };

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
    if (loggedIn) {
      setRole(ustatus);
      if (ustatus === "X" || ustatus === "Y") {
        loadDetails();
      } else if (ustatus === "1" || ustatus === "2") {
        // Handled by StudentTrainerContacts (1) or TrainerPanelContacts (2)
      } else {
        navigate("/logout");
      }
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "TC";
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

  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.warn("No data to export");
      return;
    }
    const data = rows.map((u, i) => ({
      "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
      "Student Name": u.sname,
      "Student Email": u.semail,
      "Student Phone": u.sphone,
      "Trainer Name": u.tname,
      "Trainer Email": u.temail,
      "Trainer Phone": u.tphone,
      Subject: u.subject || "-",
      Message: u.msg || "-",
      "Submitted On": formatDateTime(u.datetime),
      Status: getStatusText(u.status),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TrainerContacts");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      "trainer_contacts.xlsx",
    );
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.warn("No data to export");
      return;
    }
    const data = rows.map((u, i) => ({
      "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
      "Student Name": u.sname,
      "Student Email": u.semail,
      "Student Phone": u.sphone,
      "Trainer Name": u.tname,
      "Trainer Email": u.temail,
      "Trainer Phone": u.tphone,
      Subject: u.subject || "-",
      Message: u.msg || "-",
      "Submitted On": formatDateTime(u.datetime),
      Status: getStatusText(u.status),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "trainer_contacts.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/trainer-contacts"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

  if (role === "1") {
    return <StudentTrainerContacts />;
  }

  if (role === "2") {
    return <TrainerPanelContacts />;
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
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
        .si-stat-card.active {
          box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.12);
          border-color: var(--ad-brand);
        }
        .si-stat-card.card-pending.active {
          box-shadow: 0 0 0 2px #d97706, 0 6px 16px rgba(217, 119, 6, 0.15);
          border-color: #d97706;
        }
        .si-stat-card.card-viewed.active {
          box-shadow: 0 0 0 2px #16a34a, 0 6px 16px rgba(22, 163, 74, 0.15);
          border-color: #16a34a;
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-pending {
          background: #fffbeb;
        }
        .si-stat-card.card-viewed {
          background: #f0fdf4;
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
        .si-tbody .si-tr.row-unread {
          background-color: #fbfaff;
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
        .si-user-sub {
          font-size: 12px;
          color: #64748b;
        }
        .si-datetime-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-date-text {
          font-weight: 500;
          color: #1e293b;
          font-size: 13px;
        }
        .si-time-text {
          font-size: 12px;
          color: #94a3b8;
        }
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
        .si-status-pill.status-viewed {
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
        .status-viewed .si-status-dot {
          background: #16a34a;
        }
        .status-pending .si-status-dot {
          background: #d97706;
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
        .si-action-btn:hover {
          transform: scale(1.06);
        }
        .si-action-btn.btn-view {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.btn-view:hover {
          background: #ddd6fe;
        }
        .si-action-btn.btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-action-btn.btn-delete:hover {
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
        .si-empty-box {
          text-align: center;
          padding: 60px 20px;
        }
        .si-empty-icon {
          color: #94a3b8;
          margin-bottom: 12px;
        }
      `}</style>

      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Trainer Contact Requests</h3>
                <p className="si-header-subtitle">
                  Manage student inquiries and direct communications sent to
                  trainers
                </p>
              </div>
            </div>

            <div className="si-header-right">
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

          {/* Stats Grid */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card card-total ${!stat && !dfrom && !dto ? "active" : ""}`}
              onClick={() => {
                setStat("");
                setSearch("");
                setDfrom("");
                setDto("");
                loadDetails(1, "", sort, "", "", "");
              }}
              title="Click to view all inquiries"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <MessageSquare size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Inquiries</p>
                <h3 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="Trainercontacts-s1" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-pending ${stat === "1" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "1" ? "" : "1";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter by Pending inquiries"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">Pending Inquiries</p>
                <h3 className="si-stat-value"><AnimatedNumber value={listpending} pending={loading} id="Trainercontacts-s2" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-viewed ${stat === "2" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "2" ? "" : "2";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter by Viewed inquiries"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Viewed Inquiries</p>
                <h3 className="si-stat-value"><AnimatedNumber value={listviewed} pending={loading} id="Trainercontacts-s3" /></h3>
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
                    loadDetails(1, search, e.target.value, dfrom, dto, stat);
                  }}
                >
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                </select>
              </div>

              <div className="si-sort-group">
                <span>Status:</span>
                <select
                  className="si-select-sort"
                  value={stat}
                  onChange={(e) => {
                    setStat(e.target.value);
                    loadDetails(1, search, sort, dfrom, dto, e.target.value);
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="1">Pending</option>
                  <option value="2">Viewed</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) => {
                  setDfrom(f);
                  setDto(t);
                  loadDetails(1, search, sort, f, t, stat);
                }}
              />
            </div>

            <div className="si-filter-right">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort, dfrom, dto, stat);
                }}
              >
                <ListSearch
                  placeholder="Search student, trainer, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <button data-refresh
                className="reload-btn"
                title="Reset search & reload"
                onClick={() => {
                  setSearch("");
                  setDfrom("");
                  setDto("");
                  setStat("");
                  loadDetails(1, "", "New", "", "", "");
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
                    <th className="si-th" style={{ width: "60px" }}>
                      S.No
                    </th>
                    <th className="si-th">Student Details</th>
                    <th className="si-th">Trainer Details</th>
                    <th className="si-th">Subject</th>
                    <th className="si-th">Submitted Date</th>
                    <th className="si-th">Status</th>
                    <th
                      className="si-th"
                      style={{ textAlign: "center", width: "80px" }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="si-tbody">
                  {loading ? (
                    <SkeletonRows />
                  ) : alllists.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="si-empty-box">
                          <Mail size={40} className="si-empty-icon" />
                          <h5
                            style={{
                              fontWeight: 600,
                              color: "#1e293b",
                              margin: "4px 0",
                            }}
                          >
                            No Contact Requests Found
                          </h5>
                          <p
                            style={{
                              color: "#64748b",
                              fontSize: "13px",
                              margin: 0,
                            }}
                          >
                            {search
                              ? "Try adjusting your search criteria or date filters."
                              : "There are currently no trainer contact inquiries recorded."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    alllists.map((item, index) => {
                      const avatarStyle =
                        avatarPalette[index % avatarPalette.length];
                      const initials = getInitials(item.sname || item.name);
                      const dt = formatDateTime(item.datetime);

                      return (
                        <tr
                          key={item.id}
                          className={`si-tr ${item.status === "1" ? "row-unread" : ""}`}
                        >
                          {/* S.No */}
                          <td
                            className="si-td"
                            style={{ fontWeight: 600, color: "#64748b" }}
                          >
                            {(page - 1) * limit + index + 1}
                          </td>

                          {/* Student Details */}
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
                                  background: avatarStyle.bg,
                                  color: avatarStyle.text,
                                }}
                              >
                                {initials}
                              </div>
                              <div className="si-user-info">
                                <span className="si-user-name">
                                  {item.sname || "—"}
                                </span>
                                <span className="si-user-sub">
                                  {item.semail || "—"}
                                </span>
                                {item.sphone && (
                                  <span
                                    className="si-user-sub"
                                    style={{ fontSize: "11.5px" }}
                                  >
                                    📞 {item.sphone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Trainer Details */}
                          <td className="si-td">
                            <div className="si-user-info">
                              <span
                                className="si-user-name"
                                style={{ color: "var(--ad-brand)" }}
                              >
                                👨‍🏫 {item.tname || "—"}
                              </span>
                              <span className="si-user-sub">
                                {item.temail || "—"}
                              </span>
                              {item.tphone && (
                                <span
                                  className="si-user-sub"
                                  style={{ fontSize: "11.5px" }}
                                >
                                  📞 {item.tphone}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Subject */}
                          <td className="si-td" style={{ maxWidth: "200px" }}>
                            <span style={{ fontWeight: 500, color: "#334155" }}>
                              {item.subject || "—"}
                            </span>
                          </td>

                          {/* Submitted Date */}
                          <td className="si-td">
                            <div className="si-datetime-col">
                              <span className="si-date-text">
                                {formatDate(item.datetime)}
                              </span>
                              <span className="si-time-text">
                                {dt.split(" ")[1] || ""}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="si-td">
                            {item.status === "2" ? (
                              <span className="si-status-pill status-viewed">
                                <span className="si-status-dot" /> Viewed
                              </span>
                            ) : (
                              <span className="si-status-pill status-pending">
                                <span className="si-status-dot" /> Pending
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="si-td" style={{ textAlign: "center" }}>
                            <div
                              className="si-actions-cell"
                              style={{ justifyContent: "center" }}
                            >
                              <button
                                type="button"
                                className="si-action-btn btn-view"
                                title="View Message"
                                onClick={() => {
                                  setForm(item);
                                  setModel("view");
                                  if (item.status === "1") {
                                    viewedList(item);
                                  }
                                }}
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                className="si-action-btn btn-delete"
                                title="Delete Message"
                                onClick={() => deleteList(item)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer & Pagination */}
            <div className="si-table-footer">
              <div className="si-footer-left">
                <span>
                  Showing <b>{alllists.length ? (page - 1) * limit + 1 : 0}</b>{" "}
                  to <b>{Math.min(page * limit, listtotal)}</b> of{" "}
                  <b>{listtotal}</b> entries
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
                    loadDetails(p, search, sort, dfrom, dto, stat);
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
                          loadDetails(pNum, search, sort, dfrom, dto, stat);
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
                    loadDetails(p, search, sort, dfrom, dto, stat);
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/trainer-contacts" />
            </div>
          </div>
        </div>

        {/* ---------------- View Message Modal ---------------- */}
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
              style={{ maxWidth: 540 }}
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
                      <MessageSquare size={20} />
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
                        Trainer Inquiry Message
                      </h5>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Submitted on {formatDateTime(form.datetime)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModel("")}
                    style={{ filter: "grayscale(1)" }}
                  />
                </div>

                <div className="modal-body" style={{ padding: "24px" }}>
                  {/* Info Cards */}
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
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        Student
                      </div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#0f172a",
                          fontSize: 13.5,
                        }}
                      >
                        {form.sname || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        {form.semail || "—"}
                      </div>
                      {form.sphone && (
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          {form.sphone}
                        </div>
                      )}
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
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        Trainer
                      </div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--ad-brand)",
                          fontSize: 13.5,
                        }}
                      >
                        {form.tname || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        {form.temail || "—"}
                      </div>
                      {form.tphone && (
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          {form.tphone}
                        </div>
                      )}
                    </div>
                  </div>

                  {form.subject && (
                    <div style={{ marginBottom: 16 }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                        }}
                      >
                        Subject
                      </label>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        {form.subject}
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                      }}
                    >
                      Message Content
                    </label>
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        padding: "14px 16px",
                        fontSize: 13.5,
                        color: "#1e293b",
                        lineHeight: 1.6,
                        marginTop: 6,
                        whiteSpace: "pre-wrap",
                        maxHeight: 220,
                        overflowY: "auto",
                      }}
                    >
                      {form.msg || "No message content."}
                    </div>
                  </div>
                </div>

                <div
                  className="modal-footer"
                  style={{
                    borderTop: "1px solid #edf2f7",
                    padding: "14px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: "#fee2e2",
                      color: "#dc2626",
                      borderRadius: 10,
                      padding: "8px 18px",
                      fontWeight: 600,
                      fontSize: 13,
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => {
                      deleteList(form);
                      setModel("");
                    }}
                  >
                    <Trash2 size={15} /> Delete Query
                  </button>

                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: "var(--ad-brand)",
                      color: "#ffffff",
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
