import { Head, SERVER_URL } from "../../../components/Includes";
import { useLocation, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useRef, useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";

import {
  GraduationCap,
  BookOpen,
  Clock,
  Tag,
  Users,
  Plus,
  RotateCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  ArrowLeft,
  Layers,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Sparkles,
  Calendar,
  ShieldX,
  Award,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import SecurityTokenModal from "../../../components/SecurityTokenModal";
import { AnimatedNumber, ButtonLoader, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("courses");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");

  const initialForm = {
    id: "",
    req_id: "",
    total: "",
    title: "",
    fees: "",
    students_count: "",
    datetime: "",
    status: "",
    // "1" = offered in every course list; "0" = only in certificate requests
    enrollable: "1",
  };

  const [form, setForm] = useState(initialForm);

  function decodeHtml(str: any) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  // whole-table counts for the cards above the table (not just this page)
  const [stats, setStats] = useState<{ total: number; active: number; disabled: number; students: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    return new Date(ts * 1000).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "1D":
        return "Deleted";
      case "1":
        return "Active";
      case "1S":
        return "Disabled";
      default:
        return "Unknown";
    }
  };

  const loadDetails = async (targetPage = 1, targetSearch = "", targetSort = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);

    try {
      const res = await listFetch("api/courses", {
          q: targetSearch,
          s: targetSort,
          n: targetPage,
        });

      if (res.data.stats) setStats(res.data.stats);
      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong while loading courses");
    } finally {
      setLoading(false);
    }
  };

  const addList = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      setError("❌ Please enter course name");
      return;
    }

    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/add-course",
        {
          ...form,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setSuccess(res.data.message);
        setAllLists((prev) => [res.data.data, ...prev]);
        setTotal((prev) => prev + 1);
        setForm(initialForm);
        setTimeout(() => setMode("board"), 800);
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const updateList = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      setError("❌ Please enter course name");
      return;
    }

    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-course",
        {
          ...form,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setSuccess(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.req_id === form.req_id ? { ...b, ...form } : b))
        );
        setTimeout(() => setMode("board"), 800);
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const disableList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      `Are you sure you want to disable '${list.title}' course?`
    );
    if (!confirm) return;

    try {
      setLoadingId(list.mem_id || list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-course",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.req_id === list.req_id ? { ...b, status: "1S" } : b))
        );
        setForm((f) => ({ ...f, status: "1S" }));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const enableList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      `Are you sure you want to enable '${list.title}' course?`
    );
    if (!confirm) return;

    try {
      setLoadingId(list.mem_id || list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-course",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.req_id === list.req_id ? { ...b, status: "1" } : b))
        );
        setForm((f) => ({ ...f, status: "1" }));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      `Are you sure you want to delete '${list.title}' course?`
    );
    if (!confirm) return;

    try {
      setLoadingId(list.mem_id || list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-course",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.req_id === list.req_id ? { ...b, status: "1D" } : b))
        );
        setForm((f) => ({ ...f, status: "1D" }));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  // Permanent delete of a course already in the Deleted list. The API checks
  // the security token (BACKUP_SECURITY_TOKEN in api/.env).
  const [purgeTarget, setPurgeTarget] = useState<any>(null);

  const purgeList = async (secToken: string): Promise<string | null> => {
    const list = purgeTarget;
    if (!list) return null;
    const security = await getSecurity();
    const res = await axios.post(
      SERVER_URL + "api/purge-course",
      {
        id: list.req_id,
        security_token: secToken,
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
      { withCredentials: true }
    );
    if (!res.data.success) return res.data.message || "Could not delete the course";

    toast.success(res.data.message);
    setAllLists((prev) => prev.filter((b) => b.req_id !== list.req_id));
    setTotal((prev) => Math.max(0, prev - 1));
    setPurgeTarget(null);
    return null;
  };

  const navigate = useNavigate();

  const moveto = (targetMode: string) => {
    setSuccess("");
    setError("");
    setMode(targetMode);

    if (targetMode === "add") {
      setForm(initialForm);
    }
  };

  const updateto = (type: string, list: any) => {
    setForm({
      id: list.id,
      req_id: list.req_id,
      total: list.total,
      title: list.title,
      fees: list.fees,
      students_count: list.students_count,
      datetime: list.datetime,
      status: list.status,
      enrollable: list.enrollable === "0" ? "0" : "1",
    });
    setMode(type);
  };

  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Title: decodeHtml(u.title),
      Total: u.total,
      Fees: u.fees,
      Date: formatDate(u.datetime),
      Status: u.status === "1" ? "Active" : u.status === "1S" ? "Disabled" : "Deleted",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Courses");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(file, "courses_list.xlsx");
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Title: decodeHtml(u.title),
      Total: u.total,
      Fees: u.fees,
      Date: formatDate(u.datetime),
      Status: u.status === "1" ? "Active" : u.status === "1S" ? "Disabled" : "Deleted",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    saveAs(blob, "courses_list.csv");
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/courses"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const routeLoc = useLocation();
  const lastQ = useRef<string | null>(null);
  useEffect(() => {
    const qp = new URLSearchParams(routeLoc.search).get("q");
    if (lastQ.current === null) {
      lastQ.current = qp || "";
      return;
    }
    if (qp !== null && qp !== lastQ.current) {
      lastQ.current = qp;
      loadDetails(1, qp, sort);
    }
  }, [routeLoc.search]);

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && (ustatus === "X" || ustatus === "Y")) {
      loadDetails(1, new URLSearchParams(location.search).get("q") || "", sort);
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

  // Stats calculations
  const totalCourses = stats ? stats.total : listtotal || alllists.length;
  const activeCourses = stats
    ? stats.active
    : alllists.filter((c) => c.status === "1").length;
  const disabledCourses = stats
    ? stats.disabled
    : alllists.filter((c) => c.status === "1S").length;
  const totalStudents = stats
    ? stats.students
    : alllists.reduce((acc, c) => acc + (Number(c.students_count) || 0), 0);

  return (
    <>
      <Head
        pageTitle={seo.title || "Courses Management"}
        pageDesc={seo.description || "Manage courses and curriculum"}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />
      <SecurityTokenModal
        open={!!purgeTarget}
        danger
        subtitle="Token verification required to delete a course"
        message={
          <>
            Delete <b>{purgeTarget ? decodeHtml(purgeTarget.title) : ""}</b> permanently? It
            is removed from the Deleted list and can't be restored from this page.
          </>
        }
        confirmLabel="Delete Permanently"
        confirmIcon={<ShieldX size={15} />}
        onSubmit={purgeList}
        onClose={() => setPurgeTarget(null)}
      />

      <style>{`
        /* ================= Modern Admin Styles (StudentsInquiries Standard) ================= */
        .si-page-wrapper {
          padding: 24px;
          background: #f8fafc;
          min-height: calc(100vh - 70px);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .si-header-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 20px 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
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
          border-radius: 12px;
          background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25);
        }

        .si-header-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .si-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #eef2ff;
          color: var(--ad-brand);
          font-size: 12px;
          font-weight: 700;
          border-radius: 20px;
        }

        .si-header-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 4px 0 0 0;
        }

        .si-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .si-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
          color: #ffffff !important;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.2);
          text-decoration: none;
        }

        .si-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(var(--ad-brand-rgb), 0.3);
          color: #ffffff;
        }

        .si-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .si-btn-secondary:hover {
          background: #f8fafc;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (max-width: 992px) {
          .si-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 576px) {
          .si-stats-grid {
            grid-template-columns: 1fr;
          }
        }

        .si-stat-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 16px 20px;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          user-select: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }

        .si-stat-card.active {
          box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.15);
          border-color: var(--ad-brand);
        }

        .si-stat-card.card-active.active {
          box-shadow: 0 0 0 2px #10b981, 0 6px 16px rgba(16, 185, 129, 0.15);
          border-color: #10b981;
        }

        .si-stat-card.card-disabled.active {
          box-shadow: 0 0 0 2px #f59e0b, 0 6px 16px rgba(245, 158, 11, 0.15);
          border-color: #f59e0b;
        }

        .si-stat-label {
          font-size: 12.5px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .si-stat-value {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .si-stat-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .si-stat-indigo { background: #eef2ff; color: var(--ad-brand); }
        .si-stat-green  { background: #ecfdf5; color: #059669; }
        .si-stat-amber  { background: #fffbeb; color: #d97706; }
        .si-stat-blue   { background: #eff6ff; color: #2563eb; }

        .si-filter-bar {
          background: #ffffff;
          border-radius: 14px;
          padding: 14px 18px;
          border: 1px solid #e2e8f0;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .si-filter-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .si-select-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 4px 10px;
        }

        .si-select-label {
          font-size: 12.5px;
          font-weight: 600;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .si-select {
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          cursor: pointer;
        }

        .si-search-form {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          max-width: 380px;
        }

        .si-search-box {
          position: relative;
          width: 100%;
        }

        .si-search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          font-size: 13px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          outline: none;
          transition: all 0.2s ease;
        }

        .si-search-input:focus {
          background: #ffffff;
          border-color: var(--ad-brand);
          box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.1);
        }

        .si-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .si-reload-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .si-reload-btn:hover {
          background: #eef2ff;
          color: var(--ad-brand);
          border-color: #c7d2fe;
        }

        /* Modern Table Card */
        .si-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .si-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .si-table th {
          background: #f8fafc;
          padding: 14px 18px;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .si-table td {
          padding: 16px 18px;
          font-size: 13.5px;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .si-table tbody tr {
          transition: background-color 0.15s ease;
        }

        .si-table tbody tr:hover {
          background-color: #f8fafc;
        }

        .si-table tbody tr:last-child td {
          border-bottom: none;
        }

        .si-course-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .si-course-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #eef2ff;
          color: var(--ad-brand);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .si-course-title {
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 2px;
          display: block;
        }
        /* "Enrollable" checkbox + the "Certificate only" label */
        .crs-check { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; color: #0f172a; cursor: pointer; margin: 2px 0 4px; }
        .crs-check input { width: 18px; height: 18px; accent-color: #059669; cursor: pointer; }
        .crs-check-help { display: block; font-size: 12.5px; color: #64748b; line-height: 1.45; }
        .crs-cert-only { display: inline-block; margin-left: 8px; vertical-align: middle; font-size: 11px; font-weight: 700;
          color: #b45309; background: #fef3c7; border-radius: 999px; padding: 2px 9px; }

        .si-course-sub {
          font-size: 11.5px;
          color: #64748b;
        }

        .si-classes-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: #f1f5f9;
          color: #334155;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 8px;
        }

        .si-fee-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: #ecfdf5;
          color: #059669;
          font-size: 12.5px;
          font-weight: 700;
          border-radius: 8px;
        }

        .si-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .si-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .status-active {
          background: #ecfdf5;
          color: #059669;
        }
        .status-active .si-status-dot {
          background: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
        }

        .status-disabled {
          background: #fffbeb;
          color: #d97706;
        }
        .status-disabled .si-status-dot {
          background: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
        }

        .status-deleted {
          background: #fff1f2;
          color: #e11d48;
        }
        .status-deleted .si-status-dot {
          background: #f43f5e;
          box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2);
        }

        .si-actions-cell {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .si-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          background: #f8fafc;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }

        .si-action-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .si-action-btn.btn-view:hover {
          background: #e0f2fe;
          color: #0284c7;
        }

        .si-action-btn.btn-batches:hover {
          background: #ede9fe;
          color: var(--ad-brand);
        }

        .si-action-btn.btn-edit:hover {
          background: #e0e7ff;
          color: var(--ad-brand-2);
        }

        .si-action-btn.btn-toggle:hover {
          background: #ecfdf5;
          color: #059669;
        }

        .si-action-btn.btn-delete:hover {
          background: #ffe4e6;
          color: #e11d48;
        }

        /* Empty State */
        .si-empty-box {
          padding: 60px 20px;
          text-align: center;
        }

        .si-empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: #f1f5f9;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px auto;
        }

        /* Modern Pagination */
        .si-table-footer {
          padding: 14px 20px;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .si-footer-info {
          font-size: 13px;
          color: #64748b;
        }

        .si-pagination {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .si-page-btn {
          min-width: 34px;
          height: 34px;
          padding: 0 8px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .si-page-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
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

        /* ================= Enrollees Form Standard (.rf-*) ================= */
        .rf-page-wrapper {
          padding: 28px 20px;
          background: #f8fafc;
          min-height: calc(100vh - 70px);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .rf-container {
          margin: 0 auto;
        }
        .rf-header-card {
          background: linear-gradient(135deg, #ffffff 0%, #f9fbff 100%);
          border-radius: 20px;
          border: 1px solid #edf2f7;
          padding: 24px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 24px;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04);
        }
        .rf-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .rf-icon-badge {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 8px 16px -4px rgba(var(--ad-brand-rgb), 0.3);
          flex-shrink: 0;
          background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
        }
        .rf-header-title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
          letter-spacing: -0.02em;
        }
        .rf-header-subtitle {
          font-size: 13.5px;
          color: #64748b;
          margin: 0;
        }
        .rf-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          color: #475569;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .rf-back-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .rf-form-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #edf2f7;
          padding: 32px 36px;
          box-shadow: 0 4px 24px -2px rgba(15, 23, 42, 0.05);
        }
        .rf-form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        @media (max-width: 768px) {
          .rf-form-grid {
            grid-template-columns: 1fr;
          }
          .rf-form-card {
            padding: 20px;
          }
        }
        .rf-field-card {
          background: #f8faff;
          border: 1px solid #edf2f7;
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .rf-field-card:focus-within {
          border-color: #c7d2fe;
          background: #ffffff;
        }
        .rf-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rf-field-body {
          flex: 1;
          min-width: 0;
        }
        .rf-field-label {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .rf-field-label .req {
          color: #ef4444;
        }
        .rf-input {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        .rf-input:focus {
          border-color: var(--ad-brand);
          box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.1);
        }
        .rf-alert-box {
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .rf-alert-success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .rf-alert-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        /* View Card Specs */
        .pv-metric-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }
        @media (max-width: 640px) {
          .pv-metric-grid {
            grid-template-columns: 1fr;
          }
        }
        .pv-metric-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          text-align: center;
        }
        .pv-metric-title {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .pv-metric-num {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
        }
        .pv-spec-list {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 24px;
        }
        .pv-spec-row {
          display: flex;
          padding: 14px 18px;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
        }
        .pv-spec-row:last-child {
          border-bottom: none;
        }
        .pv-spec-row:nth-child(even) {
          background: #fcfdfe;
        }
        .pv-spec-key {
          width: 220px;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          flex-shrink: 0;
        }
        .pv-spec-val {
          font-size: 13.5px;
          color: #0f172a;
          font-weight: 500;
          flex: 1;
        }
      `}</style>

      <div className="content">
        {mode === "board" && (
          <div className="si-page-wrapper">
            {/* Header Card */}
            <div className="si-header-card">
              <div className="si-header-left">
                <div className="si-header-icon-box">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h1 className="si-header-title">
                    Courses Catalog
                    <span className="si-count-badge">
                      <Sparkles size={12} /> {listtotal} Total
                    </span>
                  </h1>
                  <p className="si-header-subtitle">
                    Manage instructional courses, pricing packages, class curriculums, and batch links
                  </p>
                </div>
              </div>

              <div className="si-header-actions">
                <button onClick={() => askExport("excel")} className="si-btn-secondary" title="Export Excel">
                  <FileSpreadsheet size={15} style={{ color: "#16a34a" }} /> Export Excel
                </button>
                <button onClick={() => askExport("csv")} className="si-btn-secondary" title="Export CSV">
                  <FileText size={15} style={{ color: "#0284c7" }} /> Export CSV
                </button>
                {permCan("create") && (
                  <button onClick={() => moveto("add")} className="si-btn-primary">
                    <Plus size={16} /> Add New Course
                  </button>
                )}
              </div>
            </div>

            {/* KPI Stats Grid */}
            <div className="si-stats-grid">
              <div
                className={`si-stat-card ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearch("");
                  loadDetails(1, "", sort);
                }}
                title="Click to view all courses"
              >
                <div>
                  <div className="si-stat-label">Total Courses</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={totalCourses} pending={loading} id="Courses-s1" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-indigo">
                  <GraduationCap size={22} />
                </div>
              </div>

              <div
                className={`si-stat-card card-active ${statusFilter === "1" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "1" ? "ALL" : "1"));
                }}
                title="Click to filter by Active courses"
              >
                <div>
                  <div className="si-stat-label">Active Courses</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={activeCourses} pending={loading} id="Courses-s2" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-green">
                  <CheckCircle size={22} />
                </div>
              </div>

              <div
                className={`si-stat-card card-disabled ${statusFilter === "1S" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "1S" ? "ALL" : "1S"));
                }}
                title="Click to filter by Disabled courses"
              >
                <div>
                  <div className="si-stat-label">Disabled Courses</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={disabledCourses} pending={loading} id="Courses-s3" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-amber">
                  <EyeOff size={22} />
                </div>
              </div>

              <div
                className="si-stat-card"
                onClick={() => navigate("/panel/students")}
                title="Click to view Enrolled Students"
              >
                <div>
                  <div className="si-stat-label">Enrolled Students</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={totalStudents} pending={loading} id="Courses-s4" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-blue">
                  <Users size={22} />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="si-filter-bar">
              <div className="si-filter-left">
                <div className="si-select-wrap">
                  <span className="si-select-label">
                    <ArrowUpDown size={14} /> Sort:
                  </span>
                  <select
                    className="si-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(page, search, e.target.value);
                    }}
                  >
                    <option value="New">Newest First</option>
                    <option value="Old">Oldest First</option>
                  </select>
                </div>
              </div>

              {/* Instant Search */}
              <form
                className="si-search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort);
                }}
              >
                <ListSearch
                  placeholder="Search course title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button data-refresh
                  type="button"
                  className="reload-btn"
                  title="Reload Courses"
                  onClick={() => {
                    setSearch("");
                    loadDetails(1, "", sort);
                  }}
                >
                  <RotateCw size={15} />
                </button>
              </form>
            </div>

            {/* Main Table Card */}
            <div className="si-table-card">
              {loading ? (
                <SkeletonTable cols={8} />
              ) : (() => {
                  const displayedLists =
                    statusFilter === "ALL"
                      ? alllists
                      : alllists.filter((c) => c.status === statusFilter);

                  if (displayedLists.length === 0) {
                    return (
                      <div className="si-empty-box">
                        <div className="si-empty-icon">
                          <GraduationCap size={28} />
                        </div>
                        <h4 style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                          {statusFilter === "1"
                            ? "No active courses found"
                            : statusFilter === "1S"
                            ? "No disabled courses found"
                            : search
                            ? "No matching courses found"
                            : "No courses recorded"}
                        </h4>
                        <p style={{ fontSize: "13.5px", color: "#64748b", maxWidth: "400px", margin: "0 auto 16px auto" }}>
                          {statusFilter !== "ALL"
                            ? "Click the active card again or click Total Courses to view all records."
                            : search
                            ? "Try tweaking your search keywords or clear filters to see all courses."
                            : "Get started by adding your first course to your curriculum catalog."}
                        </p>
                        <button
                          className="si-btn-primary"
                          style={{ margin: "0 auto" }}
                          onClick={() => {
                            setStatusFilter("ALL");
                            setSearch("");
                            loadDetails(1, "", sort);
                          }}
                        >
                          <RotateCw size={14} /> Show All Courses
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div style={{ overflowX: "auto" }}>
                      <table className="si-table">
                        <thead>
                          <tr>
                            <th style={{ width: "50px" }}>#</th>
                            <th>Course Title</th>
                            <th>Curriculum</th>
                            <th>Fees</th>
                            <th>Students</th>
                            <th>Added Date</th>
                            <th>Status</th>
                            <th style={{ textAlign: "right", paddingRight: "24px" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedLists.map((list, idx) => {
                        const rowNum = (page - 1) * limit + idx + 1;
                        const isDeleted = list.status === "1D";
                        const isActive = list.status === "1";

                        return (
                          <tr key={list.req_id || idx}>
                            <td style={{ fontWeight: 600, color: "#94a3b8", fontSize: "13px" }}>
                              {rowNum}
                            </td>

                            <td>
                              <div className="si-course-cell">
                                <div className="si-course-icon">
                                  <GraduationCap size={20} />
                                </div>
                                <div>
                                  <span className="si-course-title">
                                    {decodeHtml(list.title)}
                                  </span>
                                  <span className="si-course-sub">
                                    ID: #{list.id || list.req_id}
                                  </span>
                                    {list.enrollable === "0" && (
                                      <span className="crs-cert-only" title="Not enrollable — shown only in certificate requests">Certificate only</span>
                                    )}
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="si-classes-pill">
                                <Clock size={13} style={{ color: "#64748b" }} />
                                {list.total || "0"} Classes
                              </span>
                            </td>

                            <td>
                              <span className="si-fee-pill">
                                <Tag size={13} />
                                {list.fees || "Free"}
                              </span>
                            </td>

                            <td>
                              <span className="si-classes-pill">
                                <Users size={13} style={{ color: "#64748b" }} />
                                {list.students_count || 0} Students
                              </span>
                            </td>

                            <td style={{ fontSize: "13px", color: "#64748b" }}>
                              {formatDate(list.datetime)}
                            </td>

                            <td>
                              {isDeleted ? (
                                <span className="si-status-pill status-deleted">
                                  <span className="si-status-dot"></span> Deleted
                                </span>
                              ) : isActive ? (
                                <span className="si-status-pill status-active">
                                  <span className="si-status-dot"></span> Active
                                </span>
                              ) : (
                                <span className="si-status-pill status-disabled">
                                  <span className="si-status-dot"></span> Disabled
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: "right", paddingRight: "24px" }}>
                              <div className="si-actions-cell" style={{ justifyContent: "flex-end" }}>
                                {permCan("batches:view") && (
                                  <Link
                                    className="si-action-btn btn-batches"
                                    title="View Batches"
                                    to={"/panel/batches?id=" + list.req_id}
                                  >
                                    <Layers size={14} />
                                  </Link>
                                )}

                                <button
                                  className="si-action-btn btn-view"
                                  title="View Full Details"
                                  onClick={() => updateto("view", list)}
                                >
                                  <Eye size={14} />
                                </button>

                                {isDeleted && permCan("delete") && (
                                  <button
                                    className="si-action-btn btn-delete"
                                    title="Delete Permanently"
                                    onClick={() => setPurgeTarget(list)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}

                                {!isDeleted && (
                                  <>
                                    {permCan("edit") && (
                                      <button
                                        className="si-action-btn btn-edit"
                                        title="Edit Course"
                                        onClick={() => updateto("update", list)}
                                      >
                                        <Edit size={14} />
                                      </button>
                                    )}

                                    {permCan("status") && (
                                      isActive ? (
                                        <button
                                          className="si-action-btn btn-delete"
                                          title="Disable Course"
                                          disabled={loadingId === list.req_id}
                                          onClick={() => disableList(list)}
                                        >
                                          <EyeOff size={14} />
                                        </button>
                                      ) : (
                                        <button
                                          className="si-action-btn btn-toggle"
                                          title="Enable Course"
                                          disabled={loadingId === list.req_id}
                                          onClick={() => enableList(list)}
                                        >
                                          <CheckCircle size={14} />
                                        </button>
                                      )
                                    )}

                                    {permCan("delete") && (
                                      <button
                                        className="si-action-btn btn-delete"
                                        title="Delete Course"
                                        disabled={loadingId === list.req_id}
                                        onClick={() => deleteList(list)}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

              {/* Modern Pagination Footer */}
              {alllists.length > 0 && listtotal > 0 && (
                <div className="si-table-footer">
                  <div className="si-footer-info">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, listtotal)} of {listtotal} courses
                  </div>

                  <div className="si-pagination">
                    <button
                      className="si-page-btn"
                      disabled={page <= 1}
                      onClick={() => {
                        const newP = page - 1;
                        setPage(newP);
                        loadDetails(newP, search, sort);
                      }}
                      title="Previous Page"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: Math.min(5, lastPage || 1) }, (_, i) => {
                      let pageNumber = page;
                      if (page <= 3) pageNumber = i + 1;
                      else if (page >= lastPage - 2) pageNumber = lastPage - 4 + i;
                      else pageNumber = page - 2 + i;

                      if (pageNumber < 1 || pageNumber > lastPage) return null;

                      return (
                        <button
                          key={pageNumber}
                          className={`si-page-btn ${pageNumber === page ? "active" : ""}`}
                          onClick={() => {
                            setPage(pageNumber);
                            loadDetails(pageNumber, search, sort);
                          }}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}

                    <button
                      className="si-page-btn"
                      disabled={page >= lastPage}
                      onClick={() => {
                        const newP = page + 1;
                        setPage(newP);
                        loadDetails(newP, search, sort);
                      }}
                      title="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/courses" />
              </div>
            </div>
          </div>
        )}

        {/* Add Course Mode */}
        {mode === "add" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-icon-badge">
                    <GraduationCap size={26} />
                  </div>
                  <div>
                    <h2 className="rf-header-title">Add New Course</h2>
                    <p className="rf-header-subtitle">
                      Create and publish a new course program to your learning catalog
                    </p>
                  </div>
                </div>
                <button onClick={() => moveto("board")} className="rf-back-btn">
                  <ArrowLeft size={16} /> Back to Courses
                </button>
              </div>

              <div className="rf-form-card">
                {success && (
                  <div className="rf-alert-box rf-alert-success">
                    <CheckCircle size={18} /> {success}
                  </div>
                )}
                {error && (
                  <div className="rf-alert-box rf-alert-error">
                    <AlertCircle size={18} /> {error}
                  </div>
                )}

                {permCan("create") && (
                  <form onSubmit={addList}>
                    <div className="rf-form-grid">
                      {/* Course Title */}
                      <div className="rf-field-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="rf-icon-wrap" style={{ background: "#eef2ff", color: "var(--ad-brand)" }}>
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Course Title <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="e.g. Generative AI Engineer Masterclass"
                            required
                            value={decodeHtml(form.title)}
                            onChange={(e) =>
                              setForm({ ...form, title: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Total Classes */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                          <Clock size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Total Classes <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="e.g. 45"
                            required
                            value={decodeHtml(form.total)}
                            onChange={(e) =>
                              setForm({ ...form, total: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Fee Structure */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                          <Tag size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Fee Details <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="e.g. ₹25,000 / $350"
                            required
                            value={decodeHtml(form.fees)}
                            onChange={(e) =>
                              setForm({ ...form, fees: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Enrollable */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#ecfdf5", color: "#047857" }}>
                          <Award size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="crs-check">
                            <input
                              type="checkbox"
                              checked={form.enrollable !== "0"}
                              onChange={(e) => setForm({ ...form, enrollable: e.target.checked ? "1" : "0" })}
                            />
                            <span>Enrollable</span>
                          </label>
                          <small className="crs-check-help">
                            {form.enrollable !== "0"
                              ? "Offered in the enrolment forms and every course list."
                              : "Certificate only: shown just in certificate requests (website form and Admin → Certificate Requests)."}
                          </small>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "28px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => moveto("board")}
                        className="rf-back-btn"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="si-btn-primary"
                        style={{ padding: "11px 28px", fontSize: "14px" }}
                        disabled={loading}
                      >
                        {loading ? <ButtonLoader label="Adding Course..." /> : "Add Course"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Update Course Mode */}
        {mode === "update" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-icon-badge">
                    <Edit size={26} />
                  </div>
                  <div>
                    <h2 className="rf-header-title">Update Course Details</h2>
                    <p className="rf-header-subtitle">
                      Modify course curriculum, pricing, or title
                    </p>
                  </div>
                </div>
                <button onClick={() => moveto("board")} className="rf-back-btn">
                  <ArrowLeft size={16} /> Back to Courses
                </button>
              </div>

              <div className="rf-form-card">
                {success && (
                  <div className="rf-alert-box rf-alert-success">
                    <CheckCircle size={18} /> {success}
                  </div>
                )}
                {error && (
                  <div className="rf-alert-box rf-alert-error">
                    <AlertCircle size={18} /> {error}
                  </div>
                )}

                {permCan("edit") && (
                  <form onSubmit={updateList}>
                    <div className="rf-form-grid">
                      {/* Course Title */}
                      <div className="rf-field-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="rf-icon-wrap" style={{ background: "#eef2ff", color: "var(--ad-brand)" }}>
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Course Title <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="Enter Full Title"
                            required
                            value={decodeHtml(form.title)}
                            onChange={(e) =>
                              setForm({ ...form, title: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Total Classes */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                          <Clock size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Total Classes <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="Total Number of Classes"
                            required
                            value={decodeHtml(form.total)}
                            onChange={(e) =>
                              setForm({ ...form, total: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Fee Structure */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                          <Tag size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Fee Details <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="Fee Structure"
                            required
                            value={decodeHtml(form.fees)}
                            onChange={(e) =>
                              setForm({ ...form, fees: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Enrollable */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#ecfdf5", color: "#047857" }}>
                          <Award size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="crs-check">
                            <input
                              type="checkbox"
                              checked={form.enrollable !== "0"}
                              onChange={(e) => setForm({ ...form, enrollable: e.target.checked ? "1" : "0" })}
                            />
                            <span>Enrollable</span>
                          </label>
                          <small className="crs-check-help">
                            {form.enrollable !== "0"
                              ? "Offered in the enrolment forms and every course list."
                              : "Certificate only: shown just in certificate requests (website form and Admin → Certificate Requests)."}
                          </small>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "28px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => moveto("board")}
                        className="rf-back-btn"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="si-btn-primary"
                        style={{ padding: "11px 28px", fontSize: "14px" }}
                        disabled={loading}
                      >
                        {loading ? <ButtonLoader label="Saving Changes..." /> : "Save Changes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* View Course Details Mode */}
        {mode === "view" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-icon-badge">
                    <GraduationCap size={26} />
                  </div>
                  <div>
                    <h2 className="rf-header-title">{decodeHtml(form.title) || "Course Overview"}</h2>
                    <p className="rf-header-subtitle">
                      Course ID: #{form.id || form.req_id} • Status: {getStatus(form.status)}
                    </p>
                  </div>
                </div>
                <button onClick={() => moveto("board")} className="rf-back-btn">
                  <ArrowLeft size={16} /> Back to Courses
                </button>
              </div>

              <div className="rf-form-card">
                {/* Metric highlights */}
                <div className="pv-metric-grid">
                  <div className="pv-metric-item">
                    <div className="pv-metric-title">Curriculum Classes</div>
                    <div className="pv-metric-num">{form.total || "0"}</div>
                  </div>
                  <div className="pv-metric-item">
                    <div className="pv-metric-title">Fees / Tuition</div>
                    <div className="pv-metric-num" style={{ color: "#059669" }}>
                      {form.fees || "Free"}
                    </div>
                  </div>
                  <div className="pv-metric-item">
                    <div className="pv-metric-title">Enrolled Students</div>
                    <div className="pv-metric-num" style={{ color: "#2563eb" }}>
                      {form.students_count || "0"}
                    </div>
                  </div>
                </div>

                {/* Specification Table */}
                <div className="pv-spec-list">
                  <div className="pv-spec-row">
                    <div className="pv-spec-key">System Record ID</div>
                    <div className="pv-spec-val">{form.id || form.req_id || "-"}</div>
                  </div>
                  <div className="pv-spec-row">
                    <div className="pv-spec-key">Course Title</div>
                    <div className="pv-spec-val" style={{ fontWeight: 700 }}>
                      {decodeHtml(form.title) || "-"}
                    </div>
                  </div>
                  <div className="pv-spec-row">
                    <div className="pv-spec-key">Total Classes</div>
                    <div className="pv-spec-val">{form.total || "0"} Sessions</div>
                  </div>
                  <div className="pv-spec-row">
                    <div className="pv-spec-key">Fee Details</div>
                    <div className="pv-spec-val">{form.fees || "Not Specified"}</div>
                  </div>
                  <div className="pv-spec-row">
                    <div className="pv-spec-key">Active Students</div>
                    <div className="pv-spec-val">{form.students_count || 0} Registered Enrollees</div>
                  </div>
                  <div className="pv-spec-row">
                    <div className="pv-spec-key">Creation Date</div>
                    <div className="pv-spec-val">
                      <Calendar size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                      {formatDate(form.datetime)}
                    </div>
                  </div>
                  <div className="pv-spec-row">
                    <div className="pv-spec-key">Current Status</div>
                    <div className="pv-spec-val">
                      <span
                        className={`si-status-pill ${
                          form.status === "1"
                            ? "status-active"
                            : form.status === "1S"
                            ? "status-disabled"
                            : "status-deleted"
                        }`}
                      >
                        <span className="si-status-dot"></span>
                        {getStatus(form.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    {permCan("batches:view") && (
                      <Link
                        to={"/panel/batches?id=" + form.req_id}
                        className="si-btn-primary"
                        style={{ textDecoration: "none" }}
                      >
                        <Layers size={15} /> Manage Linked Batches
                      </Link>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {permCan("edit") && form.status !== "1D" && (
                      <button
                        onClick={() => updateto("update", form)}
                        className="rf-back-btn"
                        style={{ color: "var(--ad-brand)", borderColor: "#c7d2fe" }}
                      >
                        <Edit size={15} /> Edit
                      </button>
                    )}

                    {permCan("status") && form.status !== "1D" && (
                      form.status === "1" ? (
                        <button
                          onClick={() => disableList(form)}
                          className="rf-back-btn"
                          style={{ color: "#d97706", borderColor: "#fde68a" }}
                        >
                          <EyeOff size={15} /> Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => enableList(form)}
                          className="rf-back-btn"
                          style={{ color: "#059669", borderColor: "#a7f3d0" }}
                        >
                          <CheckCircle size={15} /> Enable
                        </button>
                      )
                    )}

                    {permCan("delete") && form.status !== "1D" && (
                      <button
                        onClick={() => deleteList(form)}
                        className="rf-back-btn"
                        style={{ color: "#e11d48", borderColor: "#fecdd3" }}
                      >
                        <Trash2 size={15} /> Delete
                      </button>
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