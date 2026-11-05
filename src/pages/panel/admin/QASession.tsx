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
import { usePagePerm } from "../../../utils/adminPermissions";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  MessageSquare,
  HelpCircle,
  CheckCircle,
  Clock,
  Users,
  User,
  RotateCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Plus,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

/**
 * Q & A Session — one page, three roles.
 *
 *   Admin   (id cookie "X" / "Y") — every question, filterable trainer-wise; can answer and delete.
 *   Trainer (id cookie "2")       — only questions addressed to them; can answer.
 *   Student (id cookie "1")       — asks questions and reads the answers.
 */
export default function Dashboard() {
  const permCan = usePagePerm("qa-session");
  const navigate = useNavigate();

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [mode, setMode] = useState(""); // Admin | Trainer | Student
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState(""); // "" | "view" | "ask"

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);

  const [listtotal, setTotal] = useState(0);
  const [listpending, setPending] = useState(0);
  const [listanswered, setAnswered] = useState(0);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [stat, setStat] = useState(""); // "" All | "1" Pending | "2" Answered
  const [tid, setTid] = useState(""); // admin-only trainer filter
  const [lastPage, setLastPage] = useState(0);

  // active row + the answer being typed for it
  const [form, setForm] = useState<any>(null);
  const [answer, setAnswer] = useState("");

  // student "ask" form
  const [askTrainer, setAskTrainer] = useState("");
  const [askQuestion, setAskQuestion] = useState("");

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

  /* ================= Data Loading ================= */

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    df = "",
    dt = "",
    st = "",
    trainer = "",
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);
    setStat(st);
    setTid(trainer);

    try {
      const res = await listFetch("api/qa-list", {
        q: targetSearch,
        s: targetSort,
        n: targetPage,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
        st: st,
        tid: trainer,
      });

      if (res.data.stats) {
        setTotal(res.data.stats.total);
        setPending(res.data.stats.pending);
        setAnswered(res.data.stats.answered);
      }

      if (res.data.success) {
        setAllLists(res.data.data);
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

  const loadTrainers = async () => {
    try {
      const res = await listFetch("api/qa-trainers", {});

      if (res.data.success) setTrainers(res.data.data);
    } catch {
      // ignore
    }
  };

  /* ---- Student asks ---- */
  const openAsk = () => {
    setAskTrainer("");
    setAskQuestion("");
    setModel("ask");
  };

  const closeAsk = () => {
    setModel("");
    setAskTrainer("");
    setAskQuestion("");
  };

  const askNow = async (e: any) => {
    e.preventDefault();

    if (!askTrainer) {
      toast.error("Please choose a trainer");
      return;
    }
    if (!askQuestion.trim()) {
      toast.error("Please enter your question");
      return;
    }

    try {
      setSaving(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/qa-ask",
        {
          to_id: askTrainer,
          question: askQuestion,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        closeAsk();
        loadDetails(1, search, sort, dfrom, dto, stat, tid);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  /* ---- Trainer / Admin answers ---- */
  const answerNow = async (e: any) => {
    e.preventDefault();

    if (!answer.trim()) {
      toast.error("Please enter an answer");
      return;
    }

    try {
      setSaving(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/qa-answer",
        {
          id: form.id,
          answer: answer,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        const wasPending = form.status === "1";
        setAllLists((prev) =>
          prev.map((b) =>
            b.id === form.id
              ? {
                  ...b,
                  answer: res.data.answer,
                  ans_by: res.data.ans_by,
                  ansdatetime: res.data.ansdatetime,
                  status: "2",
                }
              : b,
          ),
        );
        if (wasPending) {
          setPending((p) => Math.max(0, p - 1));
          setAnswered((a) => a + 1);
        }
        setModel("");
        setForm(null);
        setAnswer("");
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  /* ---- Admin deletes ---- */
  const deleteNow = async (list: any) => {
    if (!window.confirm("Delete this question permanently from the list?"))
      return;

    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/qa-delete",
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
        loadDetails(page, search, sort, dfrom, dto, stat, tid);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong");
    }
  };

  /* ---- Export functions ---- */
  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Student: u.sname || "-",
      Email: u.semail || "-",
      Trainer: u.tname || "-",
      Question: u.question || "-",
      Answer: u.answer || "-",
      Date: formatDateTime(u.datetime),
      Status: u.status === "2" ? "Answered" : "Pending",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Q&A Sessions");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    saveAs(file, "qa_sessions.xlsx");
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Student: u.sname || "-",
      Email: u.semail || "-",
      Trainer: u.tname || "-",
      Question: u.question || "-",
      Answer: u.answer || "-",
      Date: formatDateTime(u.datetime),
      Status: u.status === "2" ? "Answered" : "Pending",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(blob, "qa_sessions.csv");
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/qa-list"),
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
    const status = data.id;
    if (
      loggedIn &&
      (status === "X" || status === "Y" || status === "1" || status === "2")
    ) {
      if (status === "X" || status === "Y") setMode("Admin");
      if (status === "1") setMode("Student");
      if (status === "2") setMode("Trainer");

      loadDetails(page, search, sort, dfrom, dto, stat, tid).then(() => {
        if (status === "X" || status === "Y" || status === "1") loadTrainers();
      });
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const canAnswer = mode === "Admin" || mode === "Trainer";
  const canDelete = mode === "Admin";

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
          width:100%;
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
        .si-btn-ask {
          background: var(--ad-brand);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-ask:hover {
          background: #4b24d6;
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
        .si-stat-card.card-approved {
          background: #f0fdf4;
        }
        .si-stat-card.card-approved.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-recent {
          background: #fffbeb;
        }
        .si-stat-card.card-recent.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.card-trainers {
          background: #faf5ff;
        }
        .si-stat-card.card-trainers.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
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
        .si-status-pill.status-approved {
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
        .status-approved .si-status-dot {
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
        .si-action-btn.btn-trash {
          background: #fee2e2;
          color: #ef4444;
        }
        .si-action-btn.btn-trash:hover {
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
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Q &amp; A Session</h3>
                <p className="si-header-subtitle">
                  {mode === "Student" &&
                    "Ask your trainers questions and track their responses"}
                  {mode === "Trainer" &&
                    "Questions addressed to you by your students"}
                  {mode === "Admin" &&
                    "All student questions, answers, and trainer responses"}
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <span className="si-total-count-text">
                Total <b>{listtotal}</b>
              </span>

              {mode === "Student" && (
                <button className="si-btn-ask" onClick={openAsk}>
                  <Plus size={16} /> Ask a Question
                </button>
              )}

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
              className={`si-stat-card card-total ${stat === "" ? "active" : ""}`}
              onClick={() => {
                if (stat !== "") {
                  setStat("");
                  loadDetails(1, search, sort, dfrom, dto, "", tid);
                }
              }}
              title="Show all questions"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dbeafe", color: "#1d4ed8" }}
              >
                <MessageSquare size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Questions</p>
                <h4 className="si-stat-value"><AnimatedNumber value={listtotal} pending={loading} id="QASession-s1" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card card-approved ${stat === "2" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "2" ? "" : "2";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next, tid);
              }}
              title={
                stat === "2"
                  ? "Click to show all"
                  : "Filter by Answered questions"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#15803d" }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Answered</p>
                <h4 className="si-stat-value"><AnimatedNumber value={listanswered} pending={loading} id="QASession-s2" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card card-recent ${stat === "1" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "1" ? "" : "1";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next, tid);
              }}
              title={
                stat === "1"
                  ? "Click to show all"
                  : "Filter by Pending questions"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#b45309" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">Pending Response</p>
                <h4 className="si-stat-value"><AnimatedNumber value={listpending} pending={loading} id="QASession-s3" /></h4>
              </div>
            </div>

            <div
              className="si-stat-card card-trainers"
              title="Question response completion percentage (Click to view answered)"
              role="button"
              tabIndex={0}
              onClick={() => {
                const next = stat === "2" ? "" : "2";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next, tid);
              }}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
              >
                <Users size={22} />
              </div>
              <div>
                <p className="si-stat-label">Response Rate</p>
                <h4 className="si-stat-value">
                  <AnimatedNumber value={listtotal > 0
                    ? Math.round((listanswered / listtotal) * 100)
                    : 0} pending={loading} id="QASession-s4" />
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
                    loadDetails(
                      page,
                      search,
                      e.target.value,
                      dfrom,
                      dto,
                      stat,
                      tid,
                    )
                  }
                >
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                </select>
              </div>

              {mode === "Admin" && (
                <div className="si-sort-group">
                  <User size={15} color="var(--ad-brand)" />
                  <span>Trainer:</span>
                  <select
                    className="si-select-sort"
                    value={tid}
                    onChange={(e) =>
                      loadDetails(
                        1,
                        search,
                        sort,
                        dfrom,
                        dto,
                        stat,
                        e.target.value,
                      )
                    }
                  >
                    <option value="">All Trainers</option>
                    {trainers.map((t) => (
                      <option key={t.mem_id} value={t.mem_id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="si-sort-group">
                <Clock size={15} color="var(--ad-brand)" />
                <span>Status:</span>
                <select
                  className="si-select-sort"
                  value={stat}
                  onChange={(e) =>
                    loadDetails(
                      1,
                      search,
                      sort,
                      dfrom,
                      dto,
                      e.target.value,
                      tid,
                    )
                  }
                >
                  <option value="">All Status</option>
                  <option value="1">Pending</option>
                  <option value="2">Answered</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) =>
                  loadDetails(1, search, sort, f, t, stat, tid)
                }
              />
            </div>
          </div>

          <div className="si-filter-bar">
            <div className="si-filter-left"></div>

            <div className="d-flex align-items-center gap-2">
              <ListSearch
                placeholder="Search questions, students or trainers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    loadDetails(1, search, sort, dfrom, dto, stat, tid);
                  }
                }}
              />

              <button
                data-refresh
                className="reload-btn"
                title="Reload questions"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "", sort, dfrom, dto, stat, tid);
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
                    <MessageSquare size={28} />
                  </div>
                  <h4
                    style={{
                      fontWeight: 700,
                      color: "#1e293b",
                      margin: "0 0 6px 0",
                    }}
                  >
                    No Questions{search.length === 0 ? "" : " Found"}
                  </h4>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "14px",
                      margin: "0 0 16px 0",
                    }}
                  >
                    {search.length === 0
                      ? mode === "Student"
                        ? "You haven't asked anything yet — click 'Ask a Question' to get started."
                        : "There are no questions here yet."
                      : "We couldn't find any questions matching your search criteria."}
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
                      loadDetails(1, "", "", "", "", "", "");
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
                      {mode !== "Student" && <th>Student</th>}
                      {mode !== "Trainer" && <th>Trainer</th>}
                      <th>Question</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="text-center" style={{ width: "110px" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alllists.map((item, index) => {
                      const isAnswered = String(item.status) === "2";
                      const studentInitial = (item.sname || "S")
                        .charAt(0)
                        .toUpperCase();
                      const trainerInitial = (item.tname || "T")
                        .charAt(0)
                        .toUpperCase();

                      return (
                        <tr key={item.id}>
                          <td>{(page - 1) * limit + index + 1}</td>

                          {mode !== "Student" && (
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="si-avatar-badge"
                                  style={{
                                    background: "#ede9fe",
                                    color: "var(--ad-brand)",
                                  }}
                                >
                                  {studentInitial}
                                </div>
                                <div>
                                  <div className="si-name">
                                    {item.sname || "-"}
                                  </div>
                                  <div className="si-time-text">
                                    {item.semail || ""}
                                  </div>
                                </div>
                              </div>
                            </td>
                          )}

                          {mode !== "Trainer" && (
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="si-avatar-badge"
                                  style={{
                                    background: "#e0f2fe",
                                    color: "#0284c7",
                                  }}
                                >
                                  {trainerInitial}
                                </div>
                                <div className="si-name">
                                  {item.tname || "-"}
                                </div>
                              </div>
                            </td>
                          )}

                          <td style={{ maxWidth: 380 }}>
                            <div
                              style={{
                                fontSize: "13.5px",
                                fontWeight: 500,
                                color: "#1e293b",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "350px",
                              }}
                              title={item.question}
                            >
                              {item.question}
                            </div>
                            {item.answer && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#16a34a",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "350px",
                                  marginTop: "2px",
                                }}
                                title={`Answer: ${item.answer}`}
                              >
                                ↳ {item.answer}
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
                                isAnswered
                                  ? "status-approved"
                                  : "status-pending"
                              }`}
                            >
                              <span className="si-status-dot"></span>
                              {isAnswered ? "Answered" : "Pending"}
                            </span>
                          </td>

                          <td>
                            <div className="si-actions-cell justify-content-center">
                              <button
                                className="si-action-btn btn-view"
                                title={
                                  canAnswer
                                    ? isAnswered
                                      ? "View / Edit Answer"
                                      : "Answer Question"
                                    : "View Details"
                                }
                                onClick={() => {
                                  setForm(item);
                                  setAnswer(item.answer || "");
                                  setModel("view");
                                }}
                              >
                                <Eye size={15} />
                              </button>

                              {canDelete && permCan("delete") && (
                                <button
                                  className="si-action-btn btn-trash"
                                  title="Delete Question"
                                  onClick={() => deleteNow(item)}
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
                    onClick={() =>
                      loadDetails(page - 1, search, sort, dfrom, dto, stat, tid)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pages.map((p) => (
                    <button
                      key={p}
                      className={`si-page-btn ${p === page ? "active" : ""}`}
                      onClick={() =>
                        loadDetails(p, search, sort, dfrom, dto, stat, tid)
                      }
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className="si-page-nav-btn"
                    disabled={page >= lastPage}
                    onClick={() =>
                      loadDetails(page + 1, search, sort, dfrom, dto, stat, tid)
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/qa-list" />
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Ask Popup (Student) ---------------- */}
        {model === "ask" && (
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
                <form onSubmit={askNow}>
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
                        <Plus size={22} />
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
                          Ask a Question
                        </h5>
                        <p
                          style={{
                            fontSize: "12.5px",
                            color: "#64748b",
                            margin: "2px 0 0 0",
                          }}
                        >
                          Submit your question directly to your course trainer
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      style={{ fontSize: "12px" }}
                      onClick={closeAsk}
                    ></button>
                  </div>

                  <div className="modal-body" style={{ padding: "24px" }}>
                    <div className="mb-3">
                      <label
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: "6px",
                          display: "block",
                        }}
                      >
                        Select Trainer *
                      </label>
                      <select
                        className="form-select"
                        style={{
                          borderRadius: "10px",
                          padding: "10px 14px",
                          fontSize: "13.5px",
                          borderColor: "#cbd5e1",
                        }}
                        value={askTrainer}
                        onChange={(e) => setAskTrainer(e.target.value)}
                      >
                        <option value="">-- Choose Instructor --</option>
                        {trainers.map((t) => (
                          <option key={t.mem_id} value={t.mem_id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {trainers.length === 0 && (
                        <small className="text-danger mt-1 d-block">
                          No trainers available right now.
                        </small>
                      )}
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: "6px",
                          display: "block",
                        }}
                      >
                        Your Question *
                      </label>
                      <textarea
                        className="form-control"
                        rows={6}
                        maxLength={2000}
                        placeholder="Type your question with details..."
                        style={{
                          borderRadius: "10px",
                          padding: "12px",
                          fontSize: "13.5px",
                          borderColor: "#cbd5e1",
                        }}
                        value={askQuestion}
                        onChange={(e) => setAskQuestion(e.target.value)}
                      />
                      <div className="text-end mt-1">
                        <small style={{ color: "#64748b", fontSize: "12px" }}>
                          {askQuestion.length}/2000
                        </small>
                      </div>
                    </div>
                  </div>

                  <div
                    className="modal-footer"
                    style={{
                      padding: "14px 24px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      style={{
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                      onClick={closeAsk}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        background: "var(--ad-brand)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 20px",
                        fontWeight: 600,
                        fontSize: "13.5px",
                        cursor: "pointer",
                      }}
                    >
                      {saving ? <ButtonLoader label="Sending..." /> : "Submit Question"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- View / Answer Popup ---------------- */}
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
                      <HelpCircle size={22} />
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
                        Question Details &amp; Answer
                      </h5>
                      <p
                        style={{
                          fontSize: "12.5px",
                          color: "#64748b",
                          margin: "2px 0 0 0",
                        }}
                      >
                        Asked on {formatDateTime(form.datetime)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    style={{ fontSize: "12px" }}
                    onClick={() => {
                      setModel("");
                      setForm(null);
                      setAnswer("");
                    }}
                  ></button>
                </div>

                <div className="modal-body" style={{ padding: "24px" }}>
                  {/* Metadata cards */}
                  <div className="row g-3 mb-4">
                    {mode !== "Student" && (
                      <div className="col-md-5">
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
                            }}
                          >
                            Student
                          </span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#0f172a",
                              marginTop: "2px",
                            }}
                          >
                            {form.sname || "-"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {form.semail || ""}
                          </div>
                        </div>
                      </div>
                    )}

                    {mode !== "Trainer" && (
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
                            }}
                          >
                            Trainer
                          </span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#0f172a",
                              marginTop: "2px",
                            }}
                          >
                            {form.tname || "-"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            Assigned Instructor
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={mode === "Admin" ? "col-md-3" : "col-md-4"}>
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
                          }}
                        >
                          Status
                        </span>
                        <div style={{ marginTop: "4px" }}>
                          <span
                            className={`si-status-pill ${
                              form.status === "2"
                                ? "status-approved"
                                : "status-pending"
                            }`}
                          >
                            <span className="si-status-dot"></span>
                            {form.status === "2" ? "Answered" : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Question Box */}
                  <div className="mb-4">
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
                      <HelpCircle size={15} color="var(--ad-brand)" /> Question
                    </label>
                    <div
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        color: "#1e293b",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {form.question}
                    </div>
                  </div>

                  {/* Answer Section */}
                  <div>
                    {canAnswer ? (
                      permCan("answer") ? (
                        <form onSubmit={answerNow}>
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
                            <CheckCircle size={15} color="#16a34a" /> Your
                            Answer
                          </label>
                          <textarea
                            className="form-control"
                            rows={6}
                            maxLength={5000}
                            placeholder="Type a comprehensive answer here..."
                            style={{
                              borderRadius: "12px",
                              padding: "14px",
                              fontSize: "14px",
                              borderColor: "#cbd5e1",
                            }}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                          />
                          <div className="d-flex justify-content-between align-items-center mt-2">
                            <small
                              style={{ color: "#64748b", fontSize: "12px" }}
                            >
                              {answer.length}/5000 characters
                            </small>
                            <button
                              type="submit"
                              disabled={saving}
                              style={{
                                background: "var(--ad-brand)",
                                color: "#fff",
                                border: "none",
                                borderRadius: "10px",
                                padding: "8px 20px",
                                fontWeight: 600,
                                fontSize: "13.5px",
                                cursor: "pointer",
                              }}
                            >
                              {saving
                                ? "Saving..."
                                : form.status === "2"
                                  ? "Update Answer"
                                  : "Send Answer"}
                            </button>
                          </div>
                        </form>
                      ) : null
                    ) : (
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
                          <CheckCircle size={15} color="#16a34a" /> Instructor's
                          Response
                        </label>
                        {form.status === "2" ? (
                          <div
                            style={{
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              borderRadius: "12px",
                              padding: "16px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "14px",
                                lineHeight: "1.6",
                                color: "#14532d",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {form.answer}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#15803d",
                                marginTop: "10px",
                                fontWeight: 500,
                              }}
                            >
                              Answered on {formatDateTime(form.ansdatetime)}
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "12px",
                              padding: "20px",
                              textAlign: "center",
                              color: "#64748b",
                              fontSize: "13.5px",
                            }}
                          >
                            <Clock
                              size={24}
                              color="#94a3b8"
                              style={{
                                marginBottom: "8px",
                                display: "block",
                                margin: "0 auto 8px auto",
                              }}
                            />
                            Not answered yet — please check back later.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
