import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useRef, useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";

import {
  Award,
  Layers,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  RotateCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  EyeOff,
  Edit,
  Trash2,
  ArrowLeft,
  Users,
  AlertCircle,
  Sparkles,
  Filter,
  ShieldX,
  Flag,
  RotateCcw,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import SecurityTokenModal from "../../../components/SecurityTokenModal";
import { AnimatedNumber, ButtonLoader, SkeletonTable } from "../../../components/loading";

// The certificate this batch's students get (website: CertificateDownload.tsx)
export const CERT_TYPES = [
  { value: "1", label: "Certificate of Kids Completion" },
  { value: "2", label: "Certificate of Completion" },
  { value: "3", label: "Certificate of Bootcamp Participation" },
];

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("batches");

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

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");

  const [form, setForm] = useState({
    id: "",
    name: "",
    startDate: "",
    endDate: "",
    students_count: 0,
    trainer: "",
    c_type: "2",
  });

  function timestampToDateTime(ts: any) {
    if (!ts) return "";
    const date = new Date(ts * 1000);
    return date
      .toLocaleString("sv-SE") // YYYY-MM-DD HH:MM
      .replace(" ", "T")
      .slice(0, 16);
  }

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  // whole-table counts for the cards above the table (not just this page)
  const [stats, setStats] = useState<{ total: number; active: number; disabled: number; courses: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseid, setCourse] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  // no new batches for a deleted course
  const courseDeleted = !!courseid && courses.some((c) => c.req_id === courseid && c.status === "1D");

  const getCourseNamesByIds = (ids: string) => {
    if (!ids || courses.length === 0) return "";
    return ids
      .split(",")
      .map((id) => id.trim())
      .map((id) => {
        const course = courses.find((c) => c.req_id === id);
        return course ? decodeHtml(course.title) : "";
      })
      .filter((title) => Boolean(title))
      .join(", ");
  };

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    return new Date(ts * 1000).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (ts: any) => {
    if (!ts) return { date: "-", time: "" };
    const d = new Date(ts * 1000);
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

  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {
        all: "1", // including courses that aren't open for enrolment
          status: "",
        });

      if (res.data.success) {
        setCourses(res.data.data);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong while loading courses");
    }
  };

  const location = useLocation();

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    targetCourseId = ""
  ) => {
    setLoading(true);
    setAllLists([]);
    setCourse(targetCourseId + "");
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);

    if (courses.length === 0) {
      await loadCourses();
    }

    try {
      const res = await listFetch("api/batches", {
          q: targetSearch,
          s: targetSort,
          n: targetPage,
          id: targetCourseId + "",
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
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const addList = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    if (!form.name.trim()) {
      setError("❌ Please enter batch name");
      return;
    }

    if (!form.startDate || !form.endDate) {
      setError("❌ Please specify both start date and end date");
      return;
    }

    const startTimestamp = Math.floor(new Date(form.startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(form.endDate).getTime() / 1000);

    if (endTimestamp <= startTimestamp) {
      setError("End date must be after start date");
      return;
    }

    if (!CERT_TYPES.some((t) => t.value === form.c_type)) {
      setError("Please select the certificate type");
      return;
    }

    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/add-batch",
        {
          c_id: courseid,
          name: form.name,
          sdate: startTimestamp,
          edate: endTimestamp,
          c_type: form.c_type,
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
        setForm({
          id: "",
          name: "",
          startDate: "",
          endDate: "",
          students_count: 0,
          trainer: "",
          c_type: "2",
        });
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

    if (!form.name.trim()) {
      setError("❌ Please enter batch name");
      return;
    }

    const startTimestamp = Math.floor(new Date(form.startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(form.endDate).getTime() / 1000);

    if (endTimestamp <= startTimestamp) {
      setError("End date must be after start date");
      return;
    }

    if (!CERT_TYPES.some((t) => t.value === form.c_type)) {
      setError("Please select the certificate type");
      return;
    }

    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-batch",
        {
          id: form.id,
          name: form.name,
          sdate: startTimestamp,
          edate: endTimestamp,
          c_type: form.c_type,
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
        loadDetails(page, search, sort, courseid);
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
      `Are you sure you want to disable '${list.name}' batch?`
    );
    if (!confirm) return;

    try {
      setLoadingId(list.b_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-batch",
        {
          id: list.b_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.b_id === list.b_id ? { ...b, status: "0" } : b))
        );
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  // running <-> completed (batches.progress). Students can add questions and
  // reviews on the Classes page until their batch is completed.
  const setProgress = async (list: any, progress: "running" | "completed") => {
    const msg =
      progress === "completed"
        ? `Mark '${list.name}' as completed? Its students can no longer add questions or reviews on the Classes page.`
        : `Mark '${list.name}' as running again?`;
    if (!window.confirm(msg)) return;
    try {
      setLoadingId(list.b_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/batch-progress",
        { id: list.b_id, progress, key: security.key, token: security.token, aut: security.aut },
        { withCredentials: true }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) => prev.map((b) => (b.b_id === list.b_id ? { ...b, progress } : b)));
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
      `Are you sure you want to enable '${list.name}' batch?`
    );
    if (!confirm) return;

    try {
      setLoadingId(list.b_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-batch",
        {
          id: list.b_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.b_id === list.b_id ? { ...b, status: "1" } : b))
        );
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  // Permanent delete of a batch already deleted (status 1D). The API checks
  // the security token (BACKUP_SECURITY_TOKEN in api/.env).
  const [purgeTarget, setPurgeTarget] = useState<any>(null);

  const purgeList = async (secToken: string): Promise<string | null> => {
    const list = purgeTarget;
    if (!list) return null;
    const security = await getSecurity();
    const res = await axios.post(
      SERVER_URL + "api/purge-batch",
      {
        id: list.b_id,
        security_token: secToken,
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
      { withCredentials: true }
    );
    if (!res.data.success) return res.data.message || "Could not delete the batch";

    toast.success(res.data.message);
    setAllLists((prev) => prev.filter((b) => b.b_id !== list.b_id));
    setTotal((prev) => Math.max(0, prev - 1));
    setPurgeTarget(null);
    return null;
  };

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      `Are you sure you want to delete '${list.name || "this"}' batch?`
    );
    if (!confirm) return;

    try {
      setLoadingId(list.b_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-batch",
        {
          id: list.b_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) => (b.b_id === list.b_id ? { ...b, status: "1D" } : b))
        );
        if (mode === "update") {
          setMode("board");
        }
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const navigate = useNavigate();

  const moveto = (targetMode: string) => {
    setSuccess("");
    setError("");
    setMode(targetMode);

    if (targetMode === "add") {
      setForm({
        id: "",
        name: "",
        startDate: "",
        endDate: "",
        students_count: 0,
        trainer: "",
        c_type: "2",
      });
    }
  };

  const updateto = (list: any) => {
    setForm({
      id: list.b_id,
      name: list.name,
      startDate: timestampToDateTime(list.sdate),
      endDate: timestampToDateTime(list.edate),
      students_count: list.students_count,
      trainer: "",
      c_type: list.c_type || "",
    });
    setMode("update");
  };

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
      loadDetails(
        1,
        qp,
        sort,
        new URLSearchParams(location.search).get("id") || ""
      );
    }
  }, [routeLoc.search]);

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && (ustatus === "X" || ustatus === "Y")) {
      const courseidx = new URLSearchParams(location.search).get("id") || "";
      loadDetails(
        page,
        new URLSearchParams(location.search).get("q") || search,
        sort,
        courseidx
      );
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
  const totalBatches = stats ? stats.total : listtotal || alllists.length;
  const activeBatches = stats
    ? stats.active
    : alllists.filter((b) => String(b.status) === "1").length;
  const disabledBatches = stats
    ? stats.disabled
    : alllists.filter((b) => String(b.status) === "0").length;
  const totalCourses = stats
    ? stats.courses
    : courses.filter((c) => c.status === "1").length;

  return (
    <>
      <Head
        pageTitle={seo.title || "Batches Management"}
        pageDesc={seo.description || "Manage training batches"}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />
      <SecurityTokenModal
        open={!!purgeTarget}
        danger
        subtitle="Token verification required to delete a batch"
        message={
          <>
            Delete <b>{purgeTarget ? decodeHtml(purgeTarget.name) : ""}</b> permanently? It
            is removed from the list and can't be restored from this page.
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

        .si-stat-purple { background: #f5f3ff; color: var(--ad-brand); }
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

        .si-batch-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .si-batch-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #ede9fe;
          color: var(--ad-brand);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .si-batch-name {
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 2px;
          display: block;
        }

        .si-batch-sub {
          font-size: 11.5px;
          color: #64748b;
        }

        .si-course-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #e0f2fe;
          color: #0369a1;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          max-width: 240px;
          white-space: normal;
          line-height: 1.3;
        }

        .si-schedule-badge {
          display: inline-flex;
          flex-direction: column;
          gap: 3px;
        }

        .si-date-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #334155;
          font-weight: 500;
        }

        .si-date-label {
          font-size: 10.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .si-students-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: #f1f5f9;
          color: #334155;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 20px;
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

        /* batch progress: running / completed */
        .progress-running {
          background: #eff6ff;
          color: #2563eb;
        }
        .progress-running .si-status-dot {
          background: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        .progress-completed {
          background: rgba(var(--ad-brand-rgb), 0.08);
          color: var(--ad-brand);
        }

        .status-disabled {
          background: #fff1f2;
          color: #e11d48;
        }
        .status-disabled .si-status-dot {
          background: #f43f5e;
          box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2);
        }

        .status-deleted {
          background: #f1f5f9;
          color: #64748b;
        }
        .status-deleted .si-status-dot {
          background: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.25);
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
        .rf-input, .rf-select {
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
        .rf-input:focus, .rf-select:focus {
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
      `}</style>

      <div className="content">
        {mode === "board" && (
          <div className="si-page-wrapper">
            {/* Header Card */}
            <div className="si-header-card">
              <div className="si-header-left">
                <div className="si-header-icon-box">
                  <Layers size={24} />
                </div>
                <div>
                  <h1 className="si-header-title">
                    Batches Management
                    {courseid && getCourseNamesByIds(courseid) && (
                      <span className="si-count-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                        <BookOpen size={12} /> {getCourseNamesByIds(courseid)}
                      </span>
                    )}
                    <span className="si-count-badge">
                      <Sparkles size={12} /> {listtotal} Total
                    </span>
                  </h1>
                  <p className="si-header-subtitle">
                    Schedule, monitor, and manage student training batches and course timelines
                  </p>
                </div>
              </div>

              <div className="si-header-actions">
                {permCan("create") && !courseDeleted && (
                  <button onClick={() => moveto("add")} className="si-btn-primary">
                    <Plus size={16} /> Add New Batch
                  </button>
                )}
              </div>
            </div>

            {/* KPI Stats Grid */}
            <div className="si-stats-grid">
              <div
                className={`si-stat-card ${statusFilter === "ALL" && !courseid ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearch("");
                  setCourse("");
                  navigate("/panel/batches");
                  loadDetails(1, "", sort, "");
                }}
                title="Click to view all batches"
              >
                <div>
                  <div className="si-stat-label">Total Batches</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={totalBatches} pending={loading} id="Batches-s1" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-purple">
                  <Layers size={22} />
                </div>
              </div>

              <div
                className={`si-stat-card card-active ${statusFilter === "1" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "1" ? "ALL" : "1"));
                }}
                title="Click to filter by Active / Ongoing batches"
              >
                <div>
                  <div className="si-stat-label">Active / Ongoing</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={activeBatches} pending={loading} id="Batches-s2" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-green">
                  <CheckCircle size={22} />
                </div>
              </div>

              <div
                className={`si-stat-card card-disabled ${statusFilter === "0" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "0" ? "ALL" : "0"));
                }}
                title="Click to filter by Disabled / Ended batches"
              >
                <div>
                  <div className="si-stat-label">Disabled / Ended</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={disabledBatches} pending={loading} id="Batches-s3" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-amber">
                  <EyeOff size={22} />
                </div>
              </div>

              <div
                className="si-stat-card"
                onClick={() => navigate("/panel/courses")}
                title="Click to view Courses Catalog"
              >
                <div>
                  <div className="si-stat-label">Courses Active</div>
                  <h3 className="si-stat-value"><AnimatedNumber value={totalCourses} pending={loading} id="Batches-s4" /></h3>
                </div>
                <div className="si-stat-icon-wrap si-stat-blue">
                  <BookOpen size={22} />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="si-filter-bar">
              <div className="si-filter-left">
                {/* Course Filter */}
                <div className="si-select-wrap">
                  <span className="si-select-label">
                    <Filter size={14} /> Course:
                  </span>
                  <select
                    className="si-select"
                    value={courseid}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCourse(val);
                      navigate(val ? `/panel/batches?id=${val}` : "/panel/batches");
                      setTimeout(() => {
                        loadDetails(1, search, sort, val);
                      }, 50);
                    }}
                  >
                    <option value="">All Courses</option>
                    {courses
                      .filter((c) => c.status === "1")
                      .map((c) => (
                        <option key={c.req_id} value={c.req_id}>
                          {decodeHtml(c.title)}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div className="si-select-wrap">
                  <span className="si-select-label">
                    <ArrowUpDown size={14} /> Sort:
                  </span>
                  <select
                    className="si-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(page, search, e.target.value, courseid);
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
                  loadDetails(1, search, sort, courseid);
                }}
              >
                <ListSearch
                  placeholder="Search batch name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button data-refresh
                  type="button"
                  className="reload-btn"
                  title="Reload Batches"
                  onClick={() => {
                    setSearch("");
                    loadDetails(1, "", sort, courseid);
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
                      : alllists.filter((b) => String(b.status) === statusFilter);

                  if (displayedLists.length === 0) {
                    return (
                      <div className="si-empty-box">
                        <div className="si-empty-icon">
                          <Layers size={28} />
                        </div>
                        <h4 style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                          {statusFilter === "1"
                            ? "No active batches found"
                            : statusFilter === "0"
                            ? "No disabled batches found"
                            : search
                            ? "No matching batches found"
                            : "No batches recorded"}
                        </h4>
                        <p style={{ fontSize: "13.5px", color: "#64748b", maxWidth: "400px", margin: "0 auto 16px auto" }}>
                          {statusFilter !== "ALL"
                            ? "Click the active card again or click Total Batches to view all records."
                            : search
                            ? "Try tweaking your search keywords or clear filters to see all batches."
                            : "Get started by adding your first training batch for courses."}
                        </p>
                        <button
                          className="si-btn-primary"
                          style={{ margin: "0 auto" }}
                          onClick={() => {
                            setStatusFilter("ALL");
                            setSearch("");
                            loadDetails(1, "", sort, courseid);
                          }}
                        >
                          <RotateCw size={14} /> Show All Batches
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
                            <th>Batch Name</th>
                            <th>Course</th>
                            <th>Schedule (Start & End)</th>
                            <th>Students</th>
                            <th>Status</th>
                            <th>Progress</th>
                            <th style={{ textAlign: "right", paddingRight: "24px" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedLists.map((list, idx) => {
                        const rowNum = (page - 1) * limit + idx + 1;
                        const courseName = getCourseNamesByIds(list.c_id) || "General Course";
                        const sDate = formatDateTime(list.sdate);
                        const eDate = formatDateTime(list.edate);
                        const isActive = String(list.status) === "1";
                        const isDeleted = String(list.status) === "1D";

                        return (
                          <tr key={list.b_id || idx}>
                            <td style={{ fontWeight: 600, color: "#94a3b8", fontSize: "13px" }}>
                              {rowNum}
                            </td>

                            <td>
                              <div className="si-batch-cell">
                                <div className="si-batch-icon">
                                  <Layers size={18} />
                                </div>
                                <div>
                                  <span className="si-batch-name">
                                    {decodeHtml(list.name)}
                                  </span>
                                  <span className="si-batch-sub">
                                    ID: #{list.b_id} • Added: {formatDate(list.datetime)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="si-course-badge" title={courseName}>
                                <BookOpen size={13} style={{ flexShrink: 0 }} />
                                {courseName}
                              </span>
                            </td>

                            <td>
                              <div className="si-schedule-badge">
                                <span className="si-date-pill">
                                  <Calendar size={13} style={{ color: "#059669" }} />
                                  <span className="si-date-label">Start:</span> {sDate.date} {sDate.time}
                                </span>
                                <span className="si-date-pill">
                                  <Clock size={13} style={{ color: "#e11d48" }} />
                                  <span className="si-date-label">End:</span> {eDate.date} {eDate.time}
                                </span>
                              </div>
                            </td>

                            <td>
                              <span className="si-students-pill">
                                <Users size={13} />
                                {list.students_count || 0} Students
                              </span>
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

                            <td>
                              {list.progress === "completed" ? (
                                <span className="si-status-pill progress-completed">
                                  <CheckCircle size={12} /> Completed
                                </span>
                              ) : (
                                <span className="si-status-pill progress-running">
                                  <span className="si-status-dot"></span> Running
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: "right", paddingRight: "24px" }}>
                              <div className="si-actions-cell" style={{ justifyContent: "flex-end" }}>
                                {isDeleted && permCan("delete") && (
                                  <button
                                    className="si-action-btn btn-delete"
                                    title="Delete Permanently"
                                    onClick={() => setPurgeTarget(list)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}

                                {!isDeleted && permCan("edit") && (
                                  <button
                                    className="si-action-btn btn-edit"
                                    title="Edit Batch"
                                    onClick={() => updateto(list)}
                                  >
                                    <Edit size={14} />
                                  </button>
                                )}

                                {!isDeleted && permCan("status") && (
                                  isActive ? (
                                    <button
                                      className="si-action-btn btn-delete"
                                      title="Disable Batch"
                                      disabled={loadingId === list.b_id}
                                      onClick={() => disableList(list)}
                                    >
                                      <EyeOff size={14} />
                                    </button>
                                  ) : (
                                    <button
                                      className="si-action-btn btn-toggle"
                                      title="Enable Batch"
                                      disabled={loadingId === list.b_id}
                                      onClick={() => enableList(list)}
                                    >
                                      <CheckCircle size={14} />
                                    </button>
                                  )
                                )}

                                {!isDeleted && permCan("status") && (
                                  <button
                                    className="si-action-btn btn-toggle"
                                    title={list.progress === "completed" ? "Mark as Running" : "Mark as Completed"}
                                    disabled={loadingId === list.b_id}
                                    onClick={() => setProgress(list, list.progress === "completed" ? "running" : "completed")}
                                  >
                                    {list.progress === "completed" ? <RotateCcw size={14} /> : <Flag size={14} />}
                                  </button>
                                )}

                                {!isDeleted && permCan("delete") && (
                                  <button
                                    className="si-action-btn btn-delete"
                                    title="Delete Batch"
                                    disabled={loadingId === list.b_id}
                                    onClick={() => deleteList(list)}
                                  >
                                    <Trash2 size={14} />
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
              );
            })()}

              {/* Modern Pagination Footer */}
              {alllists.length > 0 && listtotal > 0 && (
                <div className="si-table-footer">
                  <div className="si-footer-info">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, listtotal)} of {listtotal} batches
                  </div>

                  <div className="si-pagination">
                    <button
                      className="si-page-btn"
                      disabled={page <= 1}
                      onClick={() => {
                        const newP = page - 1;
                        setPage(newP);
                        loadDetails(newP, search, sort, courseid);
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
                            loadDetails(pageNumber, search, sort, courseid);
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
                        loadDetails(newP, search, sort, courseid);
                      }}
                      title="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/batches" />
              </div>
            </div>
          </div>
        )}

        {/* Add Batch Mode (Enrollees Form Standard) */}
        {mode === "add" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-icon-badge">
                    <Layers size={26} />
                  </div>
                  <div>
                    <h2 className="rf-header-title">Create New Batch</h2>
                    <p className="rf-header-subtitle">
                      {courseid && getCourseNamesByIds(courseid)
                        ? `Adding batch under course: ${getCourseNamesByIds(courseid)}`
                        : "Configure batch schedule and course details"}
                    </p>
                  </div>
                </div>
                <button onClick={() => moveto("board")} className="rf-back-btn">
                  <ArrowLeft size={16} /> Back to Batches
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
                      {/* Course Selection */}
                      <div className="rf-field-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="rf-icon-wrap" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Target Course <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            value={courseid}
                            onChange={(e) => setCourse(e.target.value)}
                            required
                          >
                            <option value="">-- Choose Course --</option>
                            {courses
                              .filter((c) => c.status === "1")
                              .map((c) => (
                                <option key={c.req_id} value={c.req_id}>
                                  {decodeHtml(c.title)}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Batch Name */}
                      <div className="rf-field-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="rf-icon-wrap" style={{ background: "#ede9fe", color: "var(--ad-brand)" }}>
                          <Layers size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Batch Name <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="e.g. FullStack AI FastTrack - Morning Batch 01"
                            value={form.name}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, name: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* Certificate Type */}
                      <div className="rf-field-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="rf-icon-wrap" style={{ background: "#fef3c7", color: "#b45309" }}>
                          <Award size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Certificate Type <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            value={form.c_type}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, c_type: e.target.value }))
                            }
                            required
                          >
                            <option value="">— Select certificate type —</option>
                            {CERT_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Start Date & Time */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#ecfdf5", color: "#059669" }}>
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Start Date & Time <span className="req">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            className="rf-input"
                            value={form.startDate}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, startDate: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* End Date & Time */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#fff1f2", color: "#e11d48" }}>
                          <Clock size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            End Date & Time <span className="req">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            className="rf-input"
                            value={form.endDate}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, endDate: e.target.value }))
                            }
                            required
                          />
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
                        {loading ? <ButtonLoader label="Adding Batch..." /> : "Add Batch"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Update Batch Mode (Enrollees Form Standard) */}
        {mode === "update" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-icon-badge">
                    <Edit size={26} />
                  </div>
                  <div>
                    <h2 className="rf-header-title">Update Batch Details</h2>
                    <p className="rf-header-subtitle">
                      Modify batch title, duration schedule, or remove batch
                    </p>
                  </div>
                </div>
                <button onClick={() => moveto("board")} className="rf-back-btn">
                  <ArrowLeft size={16} /> Back to Batches
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
                      {/* Batch Name */}
                      <div className="rf-field-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="rf-icon-wrap" style={{ background: "#ede9fe", color: "var(--ad-brand)" }}>
                          <Layers size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Batch Name <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            value={form.name}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, name: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* Certificate Type */}
                      <div className="rf-field-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="rf-icon-wrap" style={{ background: "#fef3c7", color: "#b45309" }}>
                          <Award size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Certificate Type <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            value={form.c_type}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, c_type: e.target.value }))
                            }
                            required
                          >
                            <option value="">— Select certificate type —</option>
                            {CERT_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Start Date & Time */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#ecfdf5", color: "#059669" }}>
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Start Date & Time <span className="req">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            className="rf-input"
                            value={form.startDate}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, startDate: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* End Date & Time */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#fff1f2", color: "#e11d48" }}>
                          <Clock size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            End Date & Time <span className="req">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            className="rf-input"
                            value={form.endDate}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, endDate: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "28px", display: "flex", gap: "12px", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        {permCan("delete") && (
                          <button
                            type="button"
                            className="rf-back-btn"
                            style={{ color: "#e11d48", borderColor: "#fecdd3" }}
                            disabled={loading || loadingId === form.id}
                            onClick={() => deleteList({ b_id: form.id, name: form.name })}
                          >
                            <Trash2 size={16} /> {loadingId === form.id ? <ButtonLoader label="Deleting..." /> : "Delete Batch"}
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
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
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

