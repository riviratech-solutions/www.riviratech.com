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
  MessageSquare,
  Star,
  RotateCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  User,
  BookOpen,
  X,
  Award,
  ThumbsUp,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Feedbacks() {
  function decodeHtml(str: any) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const initialForm = {
    id: "",
    name: "",
    gender: "",
    email: "",
    number: "",
    qualification: "",
    course_name: "",
    batch_name: "",
    rating: 5,
    feedback: "",
    datetime: "",
  };

  const [form, setForm] = useState(initialForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);

  const limit = 10;
  const [courses, setAllcourses] = useState<any[]>([]);
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [ratingFilter, setRatingFilter] = useState("");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  const formatDateTime = (ts: any) => {
    if (!ts) return { date: "-", time: "" };
    const date = new Date(Number(ts) * 1000);
    return {
      date: date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-IN", {
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
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);

    try {
      const res = await listFetch("api/feedbacks", {
        q: targetSearch,
        s: targetSort,
        n: targetPage,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
      });

      if (res.data.success) {
        setAllLists(res.data.data || []);
        setTotal(res.data.stats?.total ?? res.data.total ?? 0);
        setLastPage(res.data.lastPage || 1);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getGender = (g: any) =>
    g === "1" ? "Male" : g === "2" ? "Female" : "-";

  const openFeedbackModal = async (item: any) => {
    setModalLoading(true);
    setAllcourses([]);
    setForm({
      ...initialForm,
      id: item.id || "",
      name: item.name || "",
      rating: Number(item.rating) || 5,
      feedback: item.feedback || "",
      datetime: item.datetime || "",
      course_name: item.course || "",
    });
    setModalOpen(true);

    try {
      const res = await listFetch("api/get-member", {
        mem_id: item.mem_id,
      });

      if (res.data.success) {
        const user = res.data.data?.[0];
        if (user) {
          setAllcourses(user.courses || []);
          setForm((prev) => ({
            ...prev,
            name: user.name || prev.name,
            email: user.email || "",
            number: user.number || "",
            gender: getGender(user.gender),
            qualification: user.qualification || "",
          }));
        }
      }
    } catch {
      // ignore
    } finally {
      setModalLoading(false);
    }
  };

  const checklogin = async () =>
    (await axios.get(SERVER_URL + "api/check-login", { withCredentials: true }))
      .data;

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
  void location;

  const getInitials = (name: string) => {
    if (!name) return "ST";
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

  // Calculated Stats
  const avgRating =
    alllists.length > 0
      ? (
          alllists.reduce((acc, f) => acc + (Number(f.rating) || 0), 0) /
          alllists.length
        ).toFixed(1)
      : "5.0";

  const fiveStarCount = alllists.filter((f) => Number(f.rating) === 5).length;
  const fourStarCount = alllists.filter((f) => Number(f.rating) === 4).length;

  // Filtered view by rating if chosen
  const displayedLists = ratingFilter
    ? alllists.filter((item) => String(item.rating) === ratingFilter)
    : alllists;

  // Export functions
  const exportRows = (rows: any[] = alllists) => rows.map((u, i) => {
      const formatted = formatDateTime(u.datetime);
      return {
        "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
        Student: u.name,
        Course: u.course || "-",
        Rating: `${u.rating} / 5`,
        Feedback: decodeHtml(u.feedback),
        "Submitted On": `${formatted.date} ${formatted.time}`,
      };
    });

  const exportExcel = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Feedbacks");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      "course-feedbacks.xlsx",
    );
  };

  const exportCSV = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows(rows)));
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "course-feedbacks.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/feedbacks"),
      run: (rows) => (format === "excel" ? exportExcel(rows) : exportCSV(rows)),
    });

  const Stars = ({ value }: { value: number }) => (
    <span style={{ display: "inline-flex", gap: "2px", alignItems: "center" }}>
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
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
        .si-stat-card.active {
          box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.12);
          border-color: var(--ad-brand);
        }
        .si-stat-card.card-top.active {
          box-shadow: 0 0 0 2px #16a34a, 0 6px 16px rgba(22, 163, 74, 0.15);
          border-color: #16a34a;
        }
        .si-stat-card.card-active.active {
          box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.15);
          border-color: var(--ad-brand);
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-rating {
          background: #fffbeb;
        }
        .si-stat-card.card-top {
          background: #f0fdf4;
        }
        .si-stat-card.card-active {
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
        .si-name-link {
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .si-name-link:hover {
          color: var(--ad-brand);
        }

        .si-action-btn-view {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #ede9fe;
          color: var(--ad-brand);
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-action-btn-view:hover {
          background: #ddd6fe;
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

        /* Modal */
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
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <MessageSquare size={24} />
              </div>
              <div>
                <h1 className="si-header-title">Student Feedbacks</h1>
                <p className="si-header-subtitle">
                  Course reviews, ratings, and feedback submitted by enrolled
                  students
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <div className="si-total-badge">
                Total Feedbacks: <b>{listtotal}</b>
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
              className={`si-stat-card card-total ${!ratingFilter && !dfrom && !dto ? "active" : ""}`}
              onClick={() => {
                setRatingFilter("");
                setSearch("");
                setDfrom("");
                setDto("");
                loadDetails(1, "", "New", "", "");
              }}
              title="Click to view all feedbacks"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <MessageSquare size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Feedbacks</p>
                <h3 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="Feedbacks-s1" /></h3>
              </div>
            </div>

            <div
              className="si-stat-card card-rating"
              onClick={() => {
                setRatingFilter("");
                loadDetails(1, search, sort, dfrom, dto);
              }}
              title="Average rating across all reviews"
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
                  <AnimatedNumber value={avgRating} pending={loading} id="Feedbacks-s2" />{" "}
                  <span style={{ fontSize: "16px", color: "#f59e0b" }}>★</span>
                </h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-top ${ratingFilter === "5" ? "active" : ""}`}
              onClick={() => {
                const next = ratingFilter === "5" ? "" : "5";
                setRatingFilter(next);
              }}
              title="Click to filter by 5-Star reviews"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <ThumbsUp size={22} />
              </div>
              <div>
                <p className="si-stat-label">5-Star Reviews</p>
                <h3 className="si-stat-value"><AnimatedNumber value={fiveStarCount} pending={loading} id="Feedbacks-s3" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-active ${ratingFilter === "4" ? "active" : ""}`}
              onClick={() => {
                const next = ratingFilter === "4" ? "" : "4";
                setRatingFilter(next);
              }}
              title="Click to filter by 4-Star reviews"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
              >
                <Award size={22} />
              </div>
              <div>
                <p className="si-stat-label">4-Star Reviews</p>
                <h3 className="si-stat-value"><AnimatedNumber value={fourStarCount} pending={loading} id="Feedbacks-s4" /></h3>
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

              <div className="si-sort-group">
                <span>Rating:</span>
                <select
                  className="si-select-sort"
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                >
                  <option value="">All Ratings</option>
                  <option value="5">5 Stars ★★★★★</option>
                  <option value="4">4 Stars ★★★★☆</option>
                  <option value="3">3 Stars ★★★☆☆</option>
                  <option value="2">2 Stars ★★☆☆☆</option>
                  <option value="1">1 Star ★☆☆☆☆</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) => loadDetails(1, search, sort, f, t)}
              />
            </div>
          </div>

          <div className="si-filter-bar">
            <div className="si-filter-left"></div>
            <div className="si-filter-right">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort, dfrom, dto);
                }}
              >
                <ListSearch
                  placeholder="Search student, course, comment..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <button
                data-refresh
                className="reload-btn"
                title="Reset search and reload"
                onClick={() => {
                  setSearch("");
                  setRatingFilter("");
                  loadDetails(1, "", sort, dfrom, dto);
                }}
              >
                <RotateCw size={17} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          {displayedLists.length === 0 ? (
            <div className="si-table-card">
              {loading ? (
                <SkeletonTable cols={6} />
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
                    {search || ratingFilter
                      ? "No Feedbacks Found"
                      : "No Feedbacks Yet"}
                  </h4>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#64748b",
                      marginTop: "6px",
                    }}
                  >
                    {search || ratingFilter
                      ? "No student feedback matched your filters."
                      : "No course feedback has been submitted yet."}
                  </p>
                  {(search || ratingFilter) && (
                    <button
                      className="si-btn-export-csv"
                      style={{ marginTop: "8px" }}
                      onClick={() => {
                        setSearch("");
                        setRatingFilter("");
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
                      <th className="si-th">STUDENT</th>
                      <th className="si-th">RATING</th>
                      <th className="si-th">COURSE</th>
                      <th className="si-th" style={{ minWidth: "280px" }}>
                        FEEDBACK MESSAGE
                      </th>
                      <th className="si-th">SUBMITTED ON</th>
                      <th
                        className="si-th"
                        style={{ width: "90px", textAlign: "center" }}
                      >
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLists.map((item, index) => {
                      const palette =
                        avatarPalette[index % avatarPalette.length];
                      const initials = getInitials(item.name);
                      const formatted = formatDateTime(item.datetime);
                      const starVal = Number(item.rating) || 5;

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
                                  className="si-name-link"
                                  onClick={() => openFeedbackModal(item)}
                                  title="Click to view student and course details"
                                >
                                  {item.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#94a3b8",
                                    marginTop: "2px",
                                  }}
                                >
                                  Student
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
                            <span
                              style={{
                                background: "#f1f5f9",
                                color: "#334155",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "12.5px",
                                fontWeight: 600,
                                display: "inline-block",
                              }}
                            >
                              {decodeHtml(item.course) || "General"}
                            </span>
                          </td>

                          <td className="si-td">
                            <div
                              style={{
                                maxWidth: "360px",
                                color: "#334155",
                                fontSize: "13px",
                                lineHeight: 1.5,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              "{decodeHtml(item.feedback)}"
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

                          <td className="si-td" style={{ textAlign: "center" }}>
                            <button
                              className="si-action-btn-view"
                              onClick={() => openFeedbackModal(item)}
                              title="View Feedback & Student Profile"
                            >
                              <Eye size={16} />
                            </button>
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
                <SavedAgo endpoint="api/feedbacks" />
              </div>
            </div>
          )}
        </div>

        {/* Modal View */}
        {modalOpen && (
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
                      Student Feedback
                    </h4>
                    <p
                      style={{ margin: 0, fontSize: "12px", color: "#64748b" }}
                    >
                      From {form.name}
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
                {modalLoading ? (
                  <div style={{ padding: "40px 0", textAlign: "center" }}>
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="si-modal-section-title">
                      <User size={15} /> Student Information
                    </div>

                    <div className="si-detail-grid">
                      <div className="si-detail-item">
                        <div className="si-detail-item-label">Student Name</div>
                        <div className="si-detail-item-val">
                          {form.name || "-"}
                        </div>
                      </div>

                      <div className="si-detail-item">
                        <div className="si-detail-item-label">
                          Email Address
                        </div>
                        <div className="si-detail-item-val">
                          {form.email ? (
                            <a href={`mailto:${form.email}`}>{form.email}</a>
                          ) : (
                            "-"
                          )}
                        </div>
                      </div>

                      <div className="si-detail-item">
                        <div className="si-detail-item-label">Phone Number</div>
                        <div className="si-detail-item-val">
                          {form.number || "-"}
                        </div>
                      </div>

                      <div className="si-detail-item">
                        <div className="si-detail-item-label">
                          Gender & Qualification
                        </div>
                        <div className="si-detail-item-val">
                          {form.gender || "-"} • {form.qualification || "-"}
                        </div>
                      </div>
                    </div>

                    {courses.length > 0 && (
                      <div style={{ marginBottom: "20px" }}>
                        <div className="si-modal-section-title">
                          <BookOpen size={15} /> Enrolled Courses
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {courses.map((c, i) => (
                            <div
                              key={i}
                              style={{
                                background: "#f8fafc",
                                borderRadius: "10px",
                                padding: "10px 14px",
                                border: "1px solid #f1f5f9",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "#1e293b",
                              }}
                            >
                              {decodeHtml(c.course_name)}
                              {c.batch_name && (
                                <span
                                  style={{
                                    color: "#64748b",
                                    fontWeight: 400,
                                    marginLeft: "6px",
                                  }}
                                >
                                  ({decodeHtml(c.batch_name)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="si-modal-section-title">
                      <Star size={15} style={{ color: "#f59e0b" }} /> Feedback
                      Rating & Details
                    </div>

                    <div className="si-detail-grid">
                      <div className="si-detail-item">
                        <div className="si-detail-item-label">Rating Given</div>
                        <div
                          className="si-detail-item-val"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Stars value={Number(form.rating) || 5} />
                          <span>({form.rating} / 5)</span>
                        </div>
                      </div>

                      <div className="si-detail-item">
                        <div className="si-detail-item-label">
                          Course / Topic
                        </div>
                        <div className="si-detail-item-val">
                          {decodeHtml(form.course_name) || "General"}
                        </div>
                      </div>

                      <div
                        className="si-detail-item"
                        style={{ gridColumn: "1 / -1" }}
                      >
                        <div className="si-detail-item-label">Submitted On</div>
                        <div className="si-detail-item-val">
                          {formatDateTime(form.datetime).date}{" "}
                          {formatDateTime(form.datetime).time}
                        </div>
                      </div>
                    </div>

                    <div className="si-modal-section-title">
                      <FileText size={15} /> Feedback Message
                    </div>
                    <div className="si-msg-box">
                      "
                      {decodeHtml(form.feedback) ||
                        "No feedback text provided."}
                      "
                    </div>
                  </>
                )}
              </div>

              <div className="si-modal-footer">
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
