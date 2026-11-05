import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
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
  Phone,
  User,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
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
    subject: "",
    msg: "",
    datetime: "",
    status: "",
  };
  const [form, setForm] = useState(initialForm);

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

  const location = useLocation();
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
      const res = await listFetch("api/web-contacts", {
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
        SERVER_URL + "api/viewed-web-contact",
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
      } else {
        toast.error(res.data.message);
      }
    } catch {
      // ignore
    }
  };

  const deleteList = async (item: any) => {
    if (!window.confirm("Are you sure you want to delete this web contact inquiry?")) {
      return;
    }
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-web-contact",
        {
          id: item.id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message || "Contact inquiry deleted successfully");
        setAllLists((prev) => prev.filter((b) => b.id !== item.id));
        setTotal((prev) => Math.max(0, prev - 1));
        if (item.status === "1") {
          setPending((prev) => Math.max(0, prev - 1));
        } else if (item.status === "2") {
          setViewed((prev) => Math.max(0, prev - 1));
        }
      } else {
        toast.error(res.data.message || "Failed to delete inquiry");
      }
    } catch {
      toast.error("❌ Something went wrong while deleting");
    }
  };

  // Export functions
  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
      Name: u.name,
      Email: u.email,
      Phone: u.number,
      Subject: u.subject || "-",
      Message: u.msg || "-",
      Date: formatDateTime(u.datetime),
      Status: u.status === "2" ? "Viewed" : "Pending",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Web Contacts");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    saveAs(file, "web_contacts.xlsx");
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
      Name: u.name,
      Email: u.email,
      Phone: u.number,
      Subject: u.subject || "-",
      Message: u.msg || "-",
      Date: formatDateTime(u.datetime),
      Status: u.status === "2" ? "Viewed" : "Pending",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(blob, "web_contacts.csv");
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/web-contacts"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

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
    initchecklogin();
  }, []);
  void location;

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
      `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Web Contact Requests</h3>
                <p className="si-header-subtitle">
                  Manage all incoming website contact requests and counseling
                  inquiries
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

          {/* 4 Stat Cards */}
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
              title="Click to view all contacts"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dbeafe", color: "#1d4ed8" }}
              >
                <Mail size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Contacts</p>
                <h4 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="Webcontacts-s1" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card card-approved ${stat === "2" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "2" ? "" : "2";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter by Viewed requests"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#15803d" }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Viewed Requests</p>
                <h4 className="si-stat-value"><AnimatedNumber value={listviewed} pending={loading} id="Webcontacts-s2" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card card-recent ${stat === "1" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "1" ? "" : "1";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter by Pending review"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#b45309" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">Pending Review</p>
                <h4 className="si-stat-value"><AnimatedNumber value={listpending} pending={loading} id="Webcontacts-s3" /></h4>
              </div>
            </div>

            <div
              className="si-stat-card card-trainers"
              onClick={() => {
                const next = stat === "2" ? "" : "2";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter viewed contacts"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
              >
                <MessageSquare size={22} />
              </div>
              <div>
                <p className="si-stat-label">Review Rate</p>
                <h4 className="si-stat-value">
                  <AnimatedNumber value={listtotal > 0
                    ? Math.round((listviewed / listtotal) * 100)
                    : 0} pending={loading} id="Webcontacts-s4" />
                  %
                </h4>
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
                    loadDetails(page, search, e.target.value, dfrom, dto, stat)
                  }
                >
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                </select>
              </div>

              <div className="si-sort-group">
                <Clock size={15} color="var(--ad-brand)" />
                <span>Status:</span>
                <select
                  className="si-select-sort"
                  value={stat}
                  onChange={(e) =>
                    loadDetails(1, search, sort, dfrom, dto, e.target.value)
                  }
                >
                  <option value="">All Status</option>
                  <option value="1">Pending</option>
                  <option value="2">Viewed</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) => loadDetails(1, search, sort, f, t, stat)}
              />
            </div>

            <div className="d-flex align-items-center gap-2">
              <ListSearch
                placeholder="Search by name, email or number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadDetails(1, search, sort, dfrom, dto, stat);
                    }
                  }}
              />

              <button data-refresh
                className="reload-btn"
                title="Reload contacts"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "", sort, dfrom, dto, stat);
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
                <SkeletonTable cols={7} />
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
                    <Mail size={28} />
                  </div>
                  <h4
                    style={{
                      fontWeight: 700,
                      color: "#1e293b",
                      margin: "0 0 6px 0",
                    }}
                  >
                    No Contacts{search.length === 0 ? "" : " Found"}
                  </h4>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "14px",
                      margin: "0 0 16px 0",
                    }}
                  >
                    {search.length === 0
                      ? "There are no web contact inquiries recorded yet."
                      : "We couldn't find any contact requests matching your search."}
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                    onClick={() => {
                      setSearch("");
                      loadDetails(1, "", "", "", "", "");
                    }}
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
                      <th>Contact Person</th>
                      <th>Phone Number</th>
                      <th>Message Details</th>
                      <th>Date &amp; Time</th>
                      <th>Status</th>
                      <th className="text-center" style={{ width: "100px" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alllists.map((item, index) => {
                      const isViewed = String(item.status) === "2";
                      const initial = (item.name || "C")
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
                              <div>
                                <div className="si-name">
                                  {item.name === "Enquiry"
                                    ? "Free Counseling Inquiry"
                                    : item.name}
                                </div>
                                <div className="si-time-text">{item.email}</div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {item.number ? (
                              <a
                                href={`tel:${item.number}`}
                                style={{
                                  textDecoration: "none",
                                  color: "#2563eb",
                                  fontWeight: 500,
                                }}
                              >
                                {item.number}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>

                          <td style={{ maxWidth: 360 }}>
                            {item.name === "Enquiry" ? (
                              <span
                                style={{ fontSize: "13px", color: "#64748b" }}
                              >
                                Career counseling step inquiry
                              </span>
                            ) : (
                              <div
                                style={{
                                  fontSize: "13.5px",
                                  color: "#334155",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "340px",
                                }}
                                title={item.msg}
                              >
                                {item.msg || "-"}
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="si-datetime-col">
                              <span className="si-date-text">
                                {formatDate(item.datetime)}
                              </span>
                              <span className="si-time-text">
                                {item.datetime
                                  ? new Date(
                                      item.datetime * 1000,
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
                                isViewed ? "status-viewed" : "status-pending"
                              }`}
                            >
                              <span className="si-status-dot"></span>
                              {isViewed ? "Viewed" : "Pending"}
                            </span>
                          </td>

                          <td>
                            <div className="si-actions-cell justify-content-center">
                              <button
                                className="si-action-btn btn-view"
                                title="View Full Message"
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
                                className="si-action-btn btn-delete"
                                title="Delete Inquiry"
                                onClick={() => deleteList(item)}
                              >
                                <Trash2 size={16} />
                              </button>
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
                    onClick={() =>
                      loadDetails(page - 1, search, sort, dfrom, dto, stat)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pages.map((p) => (
                    <button
                      key={p}
                      className={`si-page-btn ${p === page ? "active" : ""}`}
                      onClick={() =>
                        loadDetails(p, search, sort, dfrom, dto, stat)
                      }
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className="si-page-nav-btn"
                    disabled={page >= lastPage}
                    onClick={() =>
                      loadDetails(page + 1, search, sort, dfrom, dto, stat)
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/web-contacts" />
              </div>
            </div>
          )}
        </div>

        {/* ---------------- View Message Modal ---------------- */}
        {model === "view" && form && (
          <div
            className="modal fade show d-block"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div
                className="modal-content"
                style={{
                  borderRadius: "16px",
                  border: "none",
                  overflow: "hidden",
                  boxShadow:
                    "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                }}
              >
                <div
                  className="modal-header"
                  style={{
                    padding: "16px 24px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        background: "#ede9fe",
                        color: "var(--ad-brand)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Mail size={22} />
                    </div>
                    <div>
                      <h5
                        className="modal-title"
                        style={{
                          fontSize: "17px",
                          fontWeight: "700",
                          color: "#0f172a",
                          margin: 0,
                        }}
                      >
                        Contact Request Details
                      </h5>
                      <p
                        style={{
                          fontSize: "12.5px",
                          color: "#64748b",
                          margin: "2px 0 0 0",
                        }}
                      >
                        Received on {formatDateTime(form.datetime)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    style={{ fontSize: "12px" }}
                    onClick={() => setModel("")}
                  ></button>
                </div>

                <div className="modal-body" style={{ padding: "24px" }}>
                  {/* Info Cards */}
                  <div className="row g-3 mb-4">
                    <div className="col-md-4">
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "12px 16px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "#64748b",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <User size={13} /> Name
                        </span>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#0f172a",
                            marginTop: "3px",
                          }}
                        >
                          {form.name === "Enquiry"
                            ? "Free Counseling Inquiry"
                            : form.name || "-"}
                        </div>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "12px 16px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "#64748b",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Mail size={13} /> Email
                        </span>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#0f172a",
                            marginTop: "3px",
                          }}
                        >
                          <a
                            href={`mailto:${form.email}`}
                            style={{ color: "#2563eb", textDecoration: "none" }}
                          >
                            {form.email || "-"}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "12px 16px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "#64748b",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Phone size={13} /> Phone
                        </span>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#0f172a",
                            marginTop: "3px",
                          }}
                        >
                          {form.number ? (
                            <a
                              href={`tel:${form.number}`}
                              style={{
                                color: "#2563eb",
                                textDecoration: "none",
                              }}
                            >
                              {form.number}
                            </a>
                          ) : (
                            "-"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message Box */}
                  <div>
                    <label
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "8px",
                      }}
                    >
                      <MessageSquare size={15} color="var(--ad-brand)" /> Message
                      Content
                    </label>
                    <div
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "18px",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        color: "#1e293b",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {form.name === "Enquiry"
                        ? "This is from 'Get Free counseling to decide your next career step' form."
                        : form.msg || "No message body provided."}
                    </div>
                  </div>
                </div>

                <div
                  className="modal-footer"
                  style={{
                    padding: "14px 24px",
                    background: "#f8fafc",
                    borderTop: "1px solid #e2e8f0",
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
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontWeight: 600,
                      fontSize: "13px",
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
                    <Trash2 size={15} /> Delete Inquiry
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    style={{
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
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
