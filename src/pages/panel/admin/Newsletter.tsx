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
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Mail,
  Send,
  Users,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  RotateCw,
  ArrowUpDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Newsletter() {
  const permCan = usePagePerm("newsletter");

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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [activeCard, setActiveCard] = useState<string>("total");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);

  const location = useLocation();
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
    page = 1,
    search = "",
    sort = "New",
    df = "",
    dt = "",
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);
    setDfrom(df);
    setDto(dt);
    try {
      const res = await listFetch("api/newsletter/list", {
          q: search,
          s: sort,
          n: page,
          df: dayStartEpoch(df),
          dt: dayEndEpoch(dt),
        });

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

  const removeList = async (item: any) => {
    if (!window.confirm(`Remove subscriber "${item.email}"?`)) return;
    try {
      setLoadingId(item.id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/newsletter/delete",
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
        Email: u.email,
        "Subscribed On": `${formatted.date} ${formatted.time}`,
        Status: "Subscribed",
      };
    });

  const exportExcel = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscribers");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      "newsletter-subscribers.xlsx",
    );
  };

  const exportCSV = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows(rows)));
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "newsletter-subscribers.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/newsletter/list"),
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
  void location;

  const getInitials = (email: string) => {
    if (!email) return "NL";
    const userPart = email.split("@")[0];
    return userPart.slice(0, 2).toUpperCase();
  };

  const avatarPalette = [
    { bg: "#ede9fe", text: "var(--ad-brand)" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#fef3c7", text: "#d97706" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#fce7f3", text: "#db2777" },
  ];

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
        .si-stat-card.card-active {
          background: #f0fdf4;
        }
        .si-stat-card.card-active.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-page {
          background: #faf5ff;
        }
        .si-stat-card.card-page.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
        }
        .si-stat-card.card-status {
          background: #fffbeb;
        }
        .si-stat-card.card-status.active {
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
        .si-email-link {
          font-weight: 600;
          color: #0f172a;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .si-email-link:hover {
          color: var(--ad-brand);
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
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #16a34a;
          display: inline-block;
        }
        .si-action-btn-del {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #fee2e2;
          color: #dc2626;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-action-btn-del:hover:not(:disabled) {
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
                <h1 className="si-header-title">Newsletter Subscribers</h1>
                <p className="si-header-subtitle">
                  Emails collected from the site footer "Stay in the Loop"
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <div className="si-total-badge">
                Total Subscribers: <b>{listtotal}</b>
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
              className={`si-stat-card card-total ${activeCard === "total" ? "active" : ""}`}
              onClick={() => {
                setActiveCard("total");
                if (search || dfrom || dto) {
                  loadDetails(1, "", "New", "", "");
                }
              }}
              title="Show all subscribers"
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
                <p className="si-stat-label">Total Subscribers</p>
                <h3 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="Newsletter-s1" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-active ${activeCard === "active" ? "active" : ""}`}
              onClick={() => {
                setActiveCard("active");
                loadDetails(1, "", "New", "", "");
              }}
              title="Filter by Active Subscriptions"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Active Subscriptions</p>
                <h3 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="Newsletter-s2" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-page ${activeCard === "page" ? "active" : ""}`}
              onClick={() => setActiveCard("page")}
              title="Subscribers visible on current page"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
              >
                <FileText size={22} />
              </div>
              <div>
                <p className="si-stat-label">On Current Page</p>
                <h3 className="si-stat-value"><AnimatedNumber value={alllists.length} pending={loading} id="Newsletter-s3" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-status ${activeCard === "status" ? "active" : ""}`}
              onClick={() => {
                setActiveCard("status");
                loadDetails(1, search, sort, dfrom, dto);
              }}
              title="Delivery Status: Active delivery list"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Send size={22} />
              </div>
              <div>
                <p className="si-stat-label">Delivery Status</p>
                <h3 className="si-stat-value" style={{ fontSize: "20px" }}>
                  Active List
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
                  onChange={(e) => {
                    setSort(e.target.value);
                    loadDetails(1, search, e.target.value, dfrom, dto);
                  }}
                >
                  <option value="New">Newest First</option>
                  <option value="Old">Oldest First</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) => loadDetails(1, search, sort, f, t)}
              />
            </div>

            <div className="si-filter-right">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort, dfrom, dto);
                }}
              >
                <ListSearch
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <button data-refresh
                className="reload-btn"
                title="Reset search and reload"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "", sort, dfrom, dto);
                }}
              >
                <RotateCw size={17} />
              </button>
            </div>
          </div>

          {/* Main Table Container */}
          {alllists.length === 0 ? (
            <div className="si-table-card">
              {loading ? (
                <SkeletonTable cols={4} />
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
                    <Mail size={26} />
                  </div>
                  <h4
                    style={{
                      fontSize: "17px",
                      fontWeight: 700,
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    {search ? "No Subscribers Found" : "No Subscribers Yet"}
                  </h4>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#64748b",
                      marginTop: "6px",
                    }}
                  >
                    {search
                      ? `No subscriber emails matched "${search}".`
                      : "No one has subscribed to the newsletter yet."}
                  </p>
                  {search && (
                    <button
                      className="si-btn-export-csv"
                      style={{ marginTop: "8px" }}
                      onClick={() => {
                        setSearch("");
                        loadDetails(1, "", sort);
                      }}
                    >
                      Clear Filter
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
                      <th className="si-th">SUBSCRIBER</th>
                      <th className="si-th">SUBSCRIBED ON</th>
                      <th className="si-th">STATUS</th>
                      <th
                        className="si-th"
                        style={{ width: "90px", textAlign: "center" }}
                      >
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alllists.map((item, index) => {
                      const palette =
                        avatarPalette[index % avatarPalette.length];
                      const initials = getInitials(item.email);
                      const formatted = formatDate(item.datetime);

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
                                <a
                                  href={`mailto:${item.email}`}
                                  className="si-email-link"
                                >
                                  {item.email}
                                </a>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#94a3b8",
                                    marginTop: "2px",
                                  }}
                                >
                                  Web subscriber
                                </div>
                              </div>
                            </div>
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
                            <span className="si-status-pill">
                              <span className="si-status-dot" /> Subscribed
                            </span>
                          </td>

                          <td className="si-td" style={{ textAlign: "center" }}>
                            {permCan("delete") && (
                              <button
                                className="si-action-btn-del"
                                disabled={loadingId === item.id}
                                onClick={() => removeList(item)}
                                title="Remove subscriber"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
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
                      onClick={() =>
                        loadDetails(page - 1, search, sort, dfrom, dto)
                      }
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
                              onClick={() =>
                                loadDetails(p, search, sort, dfrom, dto)
                              }
                            >
                              {p}
                            </button>
                          </span>
                        );
                      })}

                    <button
                      className="si-page-btn"
                      disabled={page >= lastPage}
                      onClick={() =>
                        loadDetails(page + 1, search, sort, dfrom, dto)
                      }
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/newsletter/list" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
