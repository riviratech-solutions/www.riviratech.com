import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useRef } from "react";
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
  Ticket,
  AlertCircle,
  Clock,
  CheckCircle2,
  RotateCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Eye,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  X,
  BookOpen,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import { TICKET_TYPES, TICKET_CATEGORIES, ticketLabel } from "../../../utils/ticketTopics";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Raisedtickets() {
  const permCan = usePagePerm("raised-tickets");
  const didFetch = useRef(false);

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  function decodeHtml(str: any) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

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
    datetime: "",
    tstatus: "",
    profile: "",
  };

  const [form, setForm] = useState(initialForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"student" | "ticket">("student");
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const limit = 10;
  const [courses, setAllcourses] = useState<any[]>([]);
  const [alllists, setAllLists] = useState<any[]>([]);

  const [stats, setStats] = useState<any>({
    open: 0,
    progress: 0,
    resolved: 0,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [stat, setStat] = useState("");
  const [listtotal, setTotal] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "New",
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
      const res = await listFetch("api/raised-tickets", {
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
          setStats(res.data.stats);
        }
        setTotal(res.data.total ?? res.data.stats?.total ?? 0);
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

  const openStudentModal = async (list: any) => {
    setLoading(true);
    setAllcourses([]);
    setModalType("student");
    setModalOpen(true);
    try {
      const res = await listFetch("api/get-member", {
          mem_id: list.mem_id,
        });
      if (res.data.success) {
        const user = res.data.data[0] || {};
        setAllcourses(user.courses || []);
        setForm({
          ...initialForm,
          t_id: user.t_id || list.t_id || "",
          name: user.name || list.name || "",
          email: user.email || list.email || "",
          number: user.number || list.number || "",
          gender: getGender(user.gender || list.gender),
          course_name: user.course_name || list.course_name || "",
          batch_name: user.batch_name || list.batch_name || "",
          qualification: user.qualification || list.qualification || "",
          type: list.type || "",
          category: list.category || "",
          priority: list.priority || "",
          datetime: list.datetime || "",
          msg: list.msg || "",
          tstatus: list.status || "",
          profile: user.profile || list.profile || "",
        });
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Failed to load student details");
    } finally {
      setLoading(false);
    }
  };

  const openTicketModal = (list: any) => {
    setForm({
      ...initialForm,
      t_id: list.t_id || "",
      name: list.name || "",
      email: list.email || "",
      number: list.number || "",
      gender: getGender(list.gender),
      course_name: list.course_name || "",
      batch_name: list.batch_name || "",
      qualification: list.qualification || "",
      type: list.type || "",
      category: list.category || "",
      priority: list.priority || "",
      msg: list.msg || "",
      datetime: list.datetime || "",
      tstatus: list.status || "",
      profile: list.profile || "",
    });
    setModalType("ticket");
    setModalOpen(true);
  };

  const statusChange = async (type: "progress" | "resolved", list: any) => {
    const actionLabel = type === "resolved" ? "Resolved" : "In Progress";
    const confirm = window.confirm(
      `Are you sure you want to mark ticket #${list.t_id || ""} as "${actionLabel}"?`,
    );
    if (!confirm) return;

    setLoadingId(list.t_id);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/change-ticket",
        {
          id: list.t_id,
          type: type,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.t_id === list.t_id ? { ...b, status: res.data.status } : b,
          ),
        );
        if (form.t_id === list.t_id) {
          setForm((f) => ({ ...f, tstatus: res.data.status }));
        }
        setStats((prev: any) => {
          if (type === "resolved") {
            return {
              ...prev,
              progress: Math.max(0, prev.progress - 1),
              resolved: prev.resolved + 1,
            };
          } else {
            return {
              ...prev,
              open: Math.max(0, prev.open - 1),
              progress: prev.progress + 1,
            };
          }
        });
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Failed to update status");
    } finally {
      setLoadingId(null);
    }
  };

  const deleteList = async (list: any) => {
    const confirm = window.confirm(
      `Are you sure you want to delete the ticket for "${list.name}"?`,
    );
    if (!confirm) return;

    try {
      setLoadingId(list.t_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-ticket",
        {
          id: list.t_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) => prev.filter((b) => b.t_id !== list.t_id));
        setStats((prev: any) => {
          const next = { ...prev, total: Math.max(0, prev.total - 1) };
          if (list.status === "1") next.open = Math.max(0, next.open - 1);
          else if (list.status === "2")
            next.progress = Math.max(0, next.progress - 1);
          else if (list.status === "3")
            next.resolved = Math.max(0, next.resolved - 1);
          return next;
        });
        setTotal((t) => Math.max(0, t - 1));
        if (modalOpen && form.t_id === list.t_id) setModalOpen(false);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Failed to delete ticket");
    } finally {
      setLoadingId(null);
    }
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "1":
        return "Open";
      case "2":
        return "In Progress";
      case "3":
        return "Resolved";
      default:
        return "Unknown";
    }
  };

  const getPriority = (s: any) => {
    switch (String(s)) {
      case "1":
        return "Low";
      case "2":
        return "Medium";
      case "3":
        return "High";
      default:
        return "Normal";
    }
  };

  const exportRows = (rows: any[] = alllists) => rows.map((u, i) => {
      const formatted = formatDateTime(u.datetime);
      return {
        "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
        Student: u.name,
        Topic: ticketLabel(TICKET_TYPES, u.type),
        Category: ticketLabel(TICKET_CATEGORIES, u.category),
        Priority: getPriority(u.priority),
        "Raised On": `${formatted.date} ${formatted.time}`,
        Status: getStatus(u.status),
        Message: decodeHtml(u.msg),
      };
    });

  const exportExcel = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      "raised-tickets.xlsx",
    );
  };

  const exportCSV = (rows: any[] = alllists) => {
    if (!rows.length) return toast.error("No data to export");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows(rows)));
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "raised-tickets.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/raised-tickets"),
      run: (rows) => (format === "excel" ? exportExcel(rows) : exportCSV(rows)),
    });

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y")) {
          loadDetails(page, search, sort);
        } else {
          navigate("/logout");
        }
      })
      .catch(() => navigate("/logout"));
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
        .si-stat-card.card-open.active {
          box-shadow: 0 0 0 2px #dc2626, 0 6px 16px rgba(220, 38, 38, 0.15);
          border-color: #dc2626;
        }
        .si-stat-card.card-progress.active {
          box-shadow: 0 0 0 2px #d97706, 0 6px 16px rgba(217, 119, 6, 0.15);
          border-color: #d97706;
        }
        .si-stat-card.card-resolved.active {
          box-shadow: 0 0 0 2px #16a34a, 0 6px 16px rgba(22, 163, 74, 0.15);
          border-color: #16a34a;
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-open {
          background: #fff1f2;
        }
        .si-stat-card.card-progress {
          background: #fffbeb;
        }
        .si-stat-card.card-resolved {
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
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .si-table-responsive::-webkit-scrollbar {
          height: 6px;
        }
        .si-table-responsive::-webkit-scrollbar-track {
          background: transparent;
        }
        .si-table-responsive::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .si-table-responsive::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
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

        /* Priority Badges */
        .si-cat-pill {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          background: #f1f5f9;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .si-priority-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .si-priority-pill.priority-high {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-priority-pill.priority-medium {
          background: #fef3c7;
          color: #d97706;
        }
        .si-priority-pill.priority-low {
          background: #dcfce7;
          color: #16a34a;
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
        .si-status-pill.status-open {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-status-pill.status-progress {
          background: #fef3c7;
          color: #b45309;
        }
        .si-status-pill.status-resolved {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-open .si-status-dot {
          background: #ef4444;
        }
        .status-progress .si-status-dot {
          background: #f59e0b;
        }
        .status-resolved .si-status-dot {
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
        .si-action-btn.btn-progress {
          background: #fef3c7;
          color: #b45309;
        }
        .si-action-btn.btn-progress:hover:not(:disabled) {
          background: #fde68a;
          transform: scale(1.05);
        }
        .si-action-btn.btn-resolve {
          background: #dcfce7;
          color: #15803d;
        }
        .si-action-btn.btn-resolve:hover:not(:disabled) {
          background: #bbf7d0;
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
          max-width: 640px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
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
          flex-shrink: 0;
          background: #ffffff;
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
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .si-modal-body::-webkit-scrollbar {
          width: 6px;
        }
        .si-modal-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .si-modal-body::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .si-modal-body::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
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
          flex-shrink: 0;
        }
      `}</style>

      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Ticket size={24} />
              </div>
              <div>
                <h1 className="si-header-title">Raised Tickets</h1>
                <p className="si-header-subtitle">
                  Manage student inquiries, issues, and support ticket
                  resolutions
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <div className="si-total-badge">
                Total Tickets: <b>{stats.total}</b>
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
              className={`si-stat-card card-total ${!stat && !dfrom && !dto ? "active" : ""}`}
              onClick={() => {
                setStat("");
                setSearch("");
                setDfrom("");
                setDto("");
                loadDetails(1, "", sort, "", "", "");
              }}
              title="Click to view all tickets"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <Ticket size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Tickets</p>
                <h3 className="si-stat-value"><AnimatedNumber value={stats.total} pending={loading} id="Raisedtickets-s1" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-open ${stat === "1" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "1" ? "" : "1";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter by Open tickets"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fee2e2", color: "#dc2626" }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Open Tickets</p>
                <h3 className="si-stat-value"><AnimatedNumber value={stats.open} pending={loading} id="Raisedtickets-s2" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-progress ${stat === "2" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "2" ? "" : "2";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter by In Progress tickets"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">In Progress</p>
                <h3 className="si-stat-value"><AnimatedNumber value={stats.progress} pending={loading} id="Raisedtickets-s3" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-resolved ${stat === "3" ? "active" : ""}`}
              onClick={() => {
                const next = stat === "3" ? "" : "3";
                setStat(next);
                loadDetails(1, search, sort, dfrom, dto, next);
              }}
              title="Click to filter by Resolved tickets"
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="si-stat-label">Resolved</p>
                <h3 className="si-stat-value"><AnimatedNumber value={stats.resolved} pending={loading} id="Raisedtickets-s4" /></h3>
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
                    loadDetails(1, search, e.target.value, dfrom, dto, stat);
                  }}
                >
                  <option value="New">Newest First</option>
                  <option value="Old">Oldest First</option>
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
                  <option value="">All Status</option>
                  <option value="1">Open</option>
                  <option value="2">In Progress</option>
                  <option value="3">Resolved</option>
                </select>
              </div>

              <DateFilter
                from={dfrom}
                to={dto}
                onApply={(f, t) => loadDetails(1, search, sort, f, t, stat)}
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
                  placeholder="Search student or ticket..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <button data-refresh
                className="reload-btn"
                title="Reset search and reload"
                onClick={() => {
                  setSearch("");
                  setStat("");
                  loadDetails(1, "", sort, dfrom, dto, "");
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
                    <Ticket size={26} />
                  </div>
                  <h4
                    style={{
                      fontSize: "17px",
                      fontWeight: 700,
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    {search || stat ? "No Tickets Found" : "No Raised Tickets"}
                  </h4>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#64748b",
                      marginTop: "6px",
                    }}
                  >
                    {search || stat
                      ? "No tickets match your search or filter criteria."
                      : "No student has raised support tickets yet."}
                  </p>
                  {(search || stat) && (
                    <button
                      className="si-btn-export-csv"
                      style={{ marginTop: "8px" }}
                      onClick={() => {
                        setSearch("");
                        setStat("");
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
                      <th className="si-th">TOPIC</th>
                      <th className="si-th">CATEGORY</th>
                      <th className="si-th">PRIORITY</th>
                      <th className="si-th">RAISED ON</th>
                      <th className="si-th">STATUS</th>
                      <th
                        className="si-th"
                        style={{ width: "130px", textAlign: "center" }}
                      >
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alllists.map((list, index) => {
                      const palette =
                        avatarPalette[index % avatarPalette.length];
                      const initials = getInitials(list.name);
                      const formatted = formatDateTime(list.datetime);
                      const prio = getPriority(list.priority);
                      const statusText = getStatus(list.status);

                      return (
                        <tr key={list.t_id || list.id} className="si-tr">
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
                                  onClick={() => openStudentModal(list)}
                                  title="Click to view student profile & courses"
                                >
                                  {list.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#94a3b8",
                                    marginTop: "2px",
                                  }}
                                >
                                  {list.email || "No email"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="si-td">
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>
                              {ticketLabel(TICKET_TYPES, list.type)}
                            </span>
                            {list.t_id && (
                              <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", marginTop: "2px" }}>
                                {list.t_id}
                              </div>
                            )}
                          </td>

                          <td className="si-td">
                            <span className="si-cat-pill">
                              {ticketLabel(TICKET_CATEGORIES, list.category)}
                            </span>
                          </td>

                          <td className="si-td">
                            <span
                              className={`si-priority-pill ${
                                prio === "High"
                                  ? "priority-high"
                                  : prio === "Medium"
                                    ? "priority-medium"
                                    : "priority-low"
                              }`}
                            >
                              {prio}
                            </span>
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
                                statusText === "Open"
                                  ? "status-open"
                                  : statusText === "In Progress"
                                    ? "status-progress"
                                    : "status-resolved"
                              }`}
                            >
                              <span className="si-status-dot" /> {statusText}
                            </span>
                          </td>

                          <td className="si-td">
                            <div className="si-actions-cell">
                              <button
                                className="si-action-btn btn-view"
                                onClick={() => openTicketModal(list)}
                                title="View Ticket Details"
                              >
                                <Eye size={15} />
                              </button>

                              {list.status === "1" && permCan("status") && (
                                <button
                                  className="si-action-btn btn-progress"
                                  disabled={loadingId === list.t_id}
                                  onClick={() => statusChange("progress", list)}
                                  title="Set as In Progress"
                                >
                                  <Clock size={15} />
                                </button>
                              )}

                              {list.status === "2" && permCan("status") && (
                                <button
                                  className="si-action-btn btn-resolve"
                                  disabled={loadingId === list.t_id}
                                  onClick={() => statusChange("resolved", list)}
                                  title="Set as Resolved"
                                >
                                  <Check size={15} />
                                </button>
                              )}

                              {permCan("delete") && (
                                <button
                                  className="si-action-btn btn-delete"
                                  disabled={loadingId === list.t_id}
                                  onClick={() => deleteList(list)}
                                  title="Delete Ticket"
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
                      onClick={() =>
                        loadDetails(page - 1, search, sort, dfrom, dto, stat)
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
                                loadDetails(p, search, sort, dfrom, dto, stat)
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
                        loadDetails(page + 1, search, sort, dfrom, dto, stat)
                      }
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/raised-tickets" />
              </div>
            </div>
          )}
        </div>

        {/* Modern Detail Modal */}
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
                    {modalType === "student" ? (
                      <User size={18} />
                    ) : (
                      <Ticket size={18} />
                    )}
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
                      {modalType === "student"
                        ? "Student & Ticket Details"
                        : "Ticket Details"}
                    </h4>
                    <p
                      style={{ margin: 0, fontSize: "12px", color: "#64748b" }}
                    >
                      Ticket ID: {form.t_id || "N/A"}
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
                {/* Student Overview */}
                <div className="si-modal-section-title">
                  <User size={15} /> Student Information
                </div>

                <div className="si-detail-grid">
                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Student Name</div>
                    <div className="si-detail-item-val">{form.name || "-"}</div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Email Address</div>
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

                {/* Courses Enrolled */}
                {modalType === "student" && courses.length > 0 && (
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

                {/* Ticket Details */}
                <div className="si-modal-section-title">
                  <Ticket size={15} /> Ticket Information
                </div>

                <div className="si-detail-grid">
                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Topic</div>
                    <div className="si-detail-item-val">
                      {form.type ? ticketLabel(TICKET_TYPES, form.type) : "-"}
                    </div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Category</div>
                    <div className="si-detail-item-val">
                      {form.category ? ticketLabel(TICKET_CATEGORIES, form.category) : "-"}
                    </div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Priority</div>
                    <div className="si-detail-item-val">
                      {getPriority(form.priority)}
                    </div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Raised Date</div>
                    <div className="si-detail-item-val">
                      {formatDateTime(form.datetime).date}{" "}
                      {formatDateTime(form.datetime).time}
                    </div>
                  </div>

                  <div className="si-detail-item">
                    <div className="si-detail-item-label">Current Status</div>
                    <div className="si-detail-item-val">
                      {getStatus(form.tstatus)}
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div className="si-modal-section-title">
                  <FileText size={15} /> Ticket Message
                </div>
                <div className="si-msg-box">
                  {decodeHtml(form.msg) || "No message provided."}
                </div>
              </div>

              <div className="si-modal-footer">
                {form.tstatus === "1" && permCan("status") && (
                  <button
                    className="si-btn-export-excel"
                    style={{ borderColor: "#f59e0b", color: "#d97706" }}
                    onClick={() => {
                      statusChange("progress", form);
                    }}
                  >
                    <Clock size={15} /> Move to In Progress
                  </button>
                )}

                {form.tstatus === "2" && permCan("status") && (
                  <button
                    className="si-btn-export-csv"
                    style={{ background: "#16a34a", borderColor: "#16a34a" }}
                    onClick={() => {
                      statusChange("resolved", form);
                    }}
                  >
                    <Check size={15} /> Mark Resolved
                  </button>
                )}

                <button
                  className="si-btn-export-excel"
                  style={{ border: "1px solid #cbd5e1", color: "#475569" }}
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
