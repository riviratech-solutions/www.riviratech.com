import { Head, SERVER_URL } from "../../../components/Includes";
import { useLocation, useNavigate } from "react-router-dom";
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
  User,
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Calendar,
  GraduationCap,
  Compass,
  BookOpen,
  Users,
  CheckCircle,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Monitor,
  Clock,
  ShieldCheck,
  Download,
  Check,
  ArrowUpDown,
  RotateCw,
  Eye,
  Save,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldX,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import SecurityTokenModal from "../../../components/SecurityTokenModal";
import { AnimatedNumber, ButtonLoader, InlineLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("students");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");

  // Full international number written by phoneinput.js ([name="fullphone"]).
  const phoneRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    id: "", // users.id
    mem_id: "", // members.mem_id
    bid: "", // batch id
    name: "", // name
    gender: "", // gender (1/0)
    email: "",
    number: "",
    qualification: "",
    cid: "",
    profile: "",
    datetime: "", // registered date (timestamp)
    expires: "", // expiry timestamp
    lastdatetime: "", // last login timestamp
    status: "", // active/inactive
  });

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }
  function timestampToDateTime(ts: any) {
    if (!ts) return "";

    return new Date(ts * 1000).toLocaleDateString("sv-SE"); // YYYY-MM-DD
  }

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    disabled: 0,
    recent: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);

  const formatDate = (ts: any) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("en-IN");
  };

  const dformatDate = (ts: any) => {
    if (!ts) return "";
    return Math.floor(new Date(ts).getTime() / 1000);
  };

  const getGender = (g: any) => {
    return g === "1" ? "Male" : g === "2" ? "Female" : "-";
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

  const loadDetails = async (
    page = 1,
    search = "",
    sort = "",
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
      const res = await listFetch("api/students", {
        q: search,
        s: sort,
        n: page,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
      });

      //console.log(res.data.data);

      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      }
      if (res.data.stats) {
        setStats(res.data.stats);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
      loadCourses();
    }
  };

  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {});

      if (res.data.success) {
        setCourses(res.data.data);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
    }
  };

  interface Batch {
    id: number;
    b_id: string;
    c_id: string;
    name: string;
    sdate: string;
    edate: string;
    datetime: string; // timestamp as string
    status: string; // "0" | "1" | "1D"
  }

  interface BatchResponse {
    req_id: string;
    data: Batch[];
  }

  const [batches, setBatches] = useState<BatchResponse[]>([]);

  const loadBatches = async (c_id: any) => {
    try {
      const res = await listFetch("api/get-batches", {
        c_id: c_id,
        status: "",
      });

      if (res.data.success) {
        if (res.data.data.length >= 1) {
          setBatches((prev) => [
            ...prev,
            {
              req_id: c_id,
              data: res.data.data,
            },
          ]);
        }
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
    }
  };

  const loadCourseBatch = async (course = "", bid = "") => {
    setLoading(true);
    // 🔍 Check cache first

    try {
      const res = await listFetch("api/get-course-batch", {
        course: course,
        bid: bid,
      });

      if (res.data.success) {
        setForm((f) => ({
          ...f,
          bid: decodeHtml(res.data.batch),
          cid: decodeHtml(res.data.course),
        }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const updateList = async (e: any) => {
    e.preventDefault(); // ❌ Stop page reload

    setSuccess("");
    setError("");

    if (!form.name.trim()) {
      setError("❌ Please enter student name");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-student",
        {
          ...form,
          number: phoneRef.current?.value?.trim() || form.number,
          fullphone: phoneRef.current?.value?.trim() || form.number,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.mem_id === form.mem_id
              ? {
                  ...b,
                  ...form,
                  number: phoneRef.current?.value?.trim() || form.number,
                }
              : b,
          ),
        );
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const disableList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to disable '" + list.name + "' student?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.mem_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-student",
        {
          id: list.mem_id,
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
            b.mem_id === list.mem_id ? { ...b, status: "1S" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "1S" }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const enableList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to enable '" + list.name + "' student?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.mem_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-student",
        {
          id: list.mem_id,
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
            b.mem_id === list.mem_id ? { ...b, status: "1" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "1" }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  // Permanent delete of a student already deleted (status 1D). The API checks
  // the security token (BACKUP_SECURITY_TOKEN in api/.env).
  const [purgeTarget, setPurgeTarget] = useState<any>(null);

  const purgeList = async (secToken: string): Promise<string | null> => {
    const list = purgeTarget;
    if (!list) return null;
    const security = await getSecurity();
    const res = await axios.post(
      SERVER_URL + "api/purge-student",
      {
        id: list.mem_id,
        security_token: secToken,
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
      { withCredentials: true },
    );
    if (!res.data.success) return res.data.message || "Could not delete the student";

    toast.success(res.data.message);
    setAllLists((prev) => prev.filter((b) => b.mem_id !== list.mem_id));
    setTotal((prev) => Math.max(0, prev - 1));
    setStats((s) => ({
      ...s,
      total: Math.max(0, s.total - 1),
      disabled: Math.max(0, s.disabled - 1),
    }));
    if (mode === "view" && form.mem_id === list.mem_id) setMode("board");
    setPurgeTarget(null);
    return null;
  };

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to delete '" + list.name + "' student?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.mem_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-student",
        {
          id: list.mem_id,
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
            b.mem_id === list.mem_id ? { ...b, status: "1D" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "1D" }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const navigate = useNavigate();

  const moveto = async (id: any) => {
    setSuccess("");
    setError("");
    setMode(id);

    if (id === "add") {
      setForm({
        id: "",
        mem_id: "",
        bid: "",
        name: "",
        gender: "",
        email: "",
        number: "",
        qualification: "",
        cid: "",
        profile: "",
        datetime: "",
        expires: "",
        lastdatetime: "",
        status: "",
      });
    }
  };

  const updateto = async (type: any, list: any) => {

    //console.log("list=", list);
    setForm({
      id: list.id,
      mem_id: list.mem_id,
      bid: list.bid,
      name: list.name,
      gender: list.gender,
      email: list.email,
      number: list.number,
      qualification: list.qualification,
      cid: list.cid,
      profile: list.profile,
      datetime: list.datetime,
      expires: list.expires,
      lastdatetime: list.lastdatetime,
      status: list.status,
    });

    if (type == "view") {
      // ✅ Get batch info (cached or API)
      /* 
      const info = findBatchInfo(list.bid);
      if (info) {
        setForm((f) => ({ ...f, bid: info.batchName, cid: info.courseName }));
      } else {
        
      }
      */
      if (list.cid) {
        loadCourseBatch(list.cid, list.bid);
      }
    } else {
      if (list.cid) {
        const exists = batches.some((b) => b.req_id === list.cid);
        if (!exists) {
          loadBatches(list.cid);
        }
      }
    }
    // ✅ Load course & batch names

    setMode(type);
  };

  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Name: u.name,
      Phone: u.number,
      Email: u.email,
      Qualification: u.qualification,
      Date: formatDate(u.datetime),
      Status:
        u.status === "1"
          ? "Active"
          : u.status === "1S"
            ? "Disabled"
            : u.status === "1D"
              ? "Deleted"
              : "Unknown",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    saveAs(file, "students_list.xlsx");
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Name: u.name,
      Phone: u.number,
      Email: u.email,
      Qualification: u.qualification,
      Date: formatDate(u.datetime),
      Status:
        u.status === "1"
          ? "Active"
          : u.status === "1S"
            ? "Disabled"
            : u.status === "1D"
              ? "Deleted"
              : "Unknown",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(blob, "students_list.csv");
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/students"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  // header search: a new ?q= while already on this page reloads the list
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
      loadDetails(1, qp);
    }
  }, [routeLoc.search]);

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && (ustatus == "X" || ustatus == "Y")) {
      loadDetails(1, new URLSearchParams(location.search).get("q") || "");
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("t"); // 👈 gets resetnow
    if (type === "add") {
      setMode("add");
    } else if (type === "update") {
      setMode("update");
    }

    initchecklogin();

    // ---------- PhoneInput plugin (flag/country picker for #phone) ----------
    const piCss = document.createElement("link");
    piCss.rel = "stylesheet";
    piCss.href = "/css/phoneinput.css";
    document.head.appendChild(piCss);

    const piJs = document.createElement("script");
    piJs.src = "/js/phoneinput.js";
    piJs.async = true;
    piJs.onload = () => (window as any).PhoneInput?.initAll?.();
    document.body.appendChild(piJs);

    return () => {
      if (piCss.parentNode) document.head.removeChild(piCss);
      if (piJs.parentNode) document.body.removeChild(piJs);
    };
  }, []);

  // Re-init the picker whenever the add/edit form becomes visible.
  useEffect(() => {
    if (mode === "add" || mode === "update") {
      (window as any).PhoneInput?.initAll?.();
    }
  }, [mode]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(alllists.map((item) => String(item.mem_id || item.id)));
    } else {
      setSelectedIds([]);
    }
  };
  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarColors = [
    { bg: "#ede9fe", text: "var(--ad-brand)" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#fef3c7", text: "#d97706" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#fce7f3", text: "#db2777" },
    { bg: "#fee2e2", text: "#dc2626" },
    { bg: "#ccfbf1", text: "#0d9488" },
  ];

  const getAvatarStyle = (index: number) => {
    return avatarColors[index % avatarColors.length];
  };

  const formatDateTimeLines = (ts: any) => {
    if (!ts) return { date: "-", time: "" };
    const num = Number(ts);
    const dateObj = !isNaN(num)
      ? new Date(num < 10000000000 ? num * 1000 : num)
      : new Date(ts);
    if (isNaN(dateObj.getTime())) return { date: String(ts), time: "" };

    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();
    const date = `${day}/${month}/${year}`;

    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    const time = `${hours}:${minutes}:${seconds} ${ampm}`;

    return { date, time };
  };

  const renderStatusBadge = (status: any) => {
    const s = String(status);
    if (s === "1") {
      return (
        <span className="si-status-pill status-approved">
          <span className="si-status-dot"></span> Active
        </span>
      );
    }
    if (s === "1S") {
      return (
        <span
          className="si-status-pill"
          style={{ background: "#fef3c7", color: "#b45309" }}
        >
          <span
            className="si-status-dot"
            style={{ background: "#d97706" }}
          ></span>{" "}
          Disabled
        </span>
      );
    }
    if (s === "1D") {
      return (
        <span className="si-status-pill status-rejected">
          <span className="si-status-dot"></span> Deleted
        </span>
      );
    }
    return (
      <span className="si-status-pill status-new">
        <span className="si-status-dot"></span> {getStatus(status)}
      </span>
    );
  };

  const totalCount = listtotal || alllists.length;
  const activeCount = stats.active;
  const disabledCount = stats.disabled;
  const recentCount = stats.recent;

  void success;
  void error;
  void Pagination;
  void Icon;
  void DateFilter;

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />
      <SecurityTokenModal
        open={!!purgeTarget}
        danger
        subtitle="Token verification required to delete a student"
        message={
          <>
            Delete <b>{purgeTarget ? decodeHtml(purgeTarget.name) : ""}</b>'s account
            permanently? The account, its course enrolments and sign-in data are
            removed; payments, certificates and activity stay as history.
          </>
        }
        confirmLabel="Delete Permanently"
        confirmIcon={<ShieldX size={15} />}
        onSubmit={purgeList}
        onClose={() => setPurgeTarget(null)}
      />

      <style>{`
      /* Students List Styles */
      .si-page-wrapper {
        background-color: #f8fafc;
        min-height: calc(100vh - 80px);
        padding: 24px 28px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      /* Modern Form Page */
      .rf-page-wrapper {
        background-color: #f8fafc;
        min-height: calc(100vh - 80px);
        padding: 24px 28px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .rf-container {
        margin: 0 auto;
      }
      .rf-header-card {
        background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0f2fe 100%);
        border-radius: 20px;
        padding: 24px 28px;
        border: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 16px rgba(var(--ad-brand-rgb), 0.05);
      }
      .rf-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
        position: relative;
        z-index: 2;
      }
      .rf-header-icon-box {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: var(--ad-brand);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 16px rgba(var(--ad-brand-rgb), 0.25);
        flex-shrink: 0;
      }
      .rf-header-title {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        line-height: 1.2;
        letter-spacing: -0.01em;
      }
      .rf-header-subtitle {
        font-size: 13.5px;
        color: #64748b;
        margin: 4px 0 0 0;
      }
      .rf-btn-back {
        background: #ffffff;
        border: 1.5px solid var(--ad-brand);
        color: var(--ad-brand);
        border-radius: 10px;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        position: relative;
        z-index: 2;
        text-decoration: none;
      }
      .rf-btn-back:hover {
        background: #f5f3ff;
        transform: translateY(-1px);
        color: var(--ad-brand-2);
      }
      .rf-header-decor {
        position: absolute;
        right: 140px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.25;
        pointer-events: none;
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
        box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.08);
      }
      .rf-submit-btn {
        grid-column: 1 / -1;
        background: var(--ad-brand);
        color: #ffffff;
        border: none;
        border-radius: 12px;
        padding: 14px 28px;
        font-size: 15px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        margin-top: 8px;
        box-shadow: 0 4px 14px rgba(var(--ad-brand-rgb), 0.25);
      }
      .rf-submit-btn:hover:not(:disabled) {
        background: var(--ad-brand-2);
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(var(--ad-brand-rgb), 0.35);
      }
      .rf-submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
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
        gap: 14px;
        flex-wrap: wrap;
      }
      .si-total-count-text {
        font-size: 14px;
        color: #475569;
        font-weight: 500;
        margin-right: 6px;
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
        border: 2px solid transparent;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        transition: all 0.18s ease;
        cursor: pointer;
        user-select: none;
      }
      .si-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
      }
      .si-stat-card.active {
        box-shadow: 0 0 0 2px var(--ad-brand), 0 8px 20px rgba(var(--ad-brand-rgb), 0.15) !important;
        transform: translateY(-2px);
      }
      .si-stat-card.card-total {
        background: #f0f8ff;
      }
      .si-stat-card.card-total.active {
        border-color: #2563eb;
      }
      .si-stat-card.card-approved {
        background: #f0fdf4;
      }
      .si-stat-card.card-approved.active {
        border-color: #16a34a;
      }
      .si-stat-card.card-rejected {
        background: #fff1f2;
      }
      .si-stat-card.card-rejected.active {
        border-color: #ef4444;
      }
      .si-stat-card.card-recent {
        background: #faf5ff;
      }
      .si-stat-card.card-recent.active {
        border-color: var(--ad-brand);
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
      .si-stat-icon-wrap.wrap-circle {
        border-radius: 50%;
      }
      .si-stat-icon-inner-circle {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
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
      .si-date-group {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13.5px;
        font-weight: 600;
        color: #334155;
      }
      .si-date-box {
        display: flex;
        align-items: center;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 4px 10px;
        background: #ffffff;
        gap: 6px;
        transition: border-color 0.15s ease;
      }
      .si-date-box:focus-within {
        border-color: var(--ad-brand);
      }
      .si-date-icon {
        color: var(--ad-brand);
        display: flex;
        align-items: center;
      }
      .si-date-input {
        border: none;
        outline: none;
        font-size: 13px;
        color: #334155;
        background: transparent;
        cursor: pointer;
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
      .si-tr.row-deleted {
        background-color: #fff5f5 !important;
      }
      .si-tr.row-deleted:hover {
        background-color: #fee2e2 !important;
      }
      .si-tr.row-disabled {
        background-color: #fffdf5 !important;
      }
      .si-td {
        padding: 13px 16px;
        font-size: 13.5px;
        color: #334155;
        vertical-align: middle;
        border: none;
      }
      .si-checkbox {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        accent-color: var(--ad-brand);
        cursor: pointer;
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
      }
      .si-name {
        font-weight: 500;
        color: #1e293b;
        white-space: nowrap;
      }
      .si-btn-info {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: #ede9fe;
        border: none;
        color: var(--ad-brand);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .si-btn-info:hover {
        background: #ddd6fe;
        transform: scale(1.05);
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
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      .si-status-pill.status-new {
        background: #e0f2fe;
        color: #0284c7;
      }
      .si-status-pill.status-approved {
        background: #dcfce7;
        color: #15803d;
      }
      .si-status-pill.status-rejected {
        background: #fee2e2;
        color: #b91c1c;
      }
      .si-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
      }
      .status-new .si-status-dot {
        background: #0284c7;
      }
      .status-approved .si-status-dot {
        background: #16a34a;
      }
      .status-rejected .si-status-dot {
        background: #ef4444;
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
      .si-limit-select {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 5px 24px 5px 10px;
        font-size: 13px;
        color: #1e293b;
        background-color: #ffffff;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        appearance: none;
        cursor: pointer;
        outline: none;
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
        font-weight: 600;
      }

      /* Profile View Styles */
      .pv-wrapper {
        background-color: #f8fafc;
        min-height: calc(100vh - 80px);
        padding: 24px 28px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .pv-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 14px;
      }
      .pv-header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .pv-header-icon {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: #3b82f6;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25);
        flex-shrink: 0;
      }
      .pv-header-title {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        line-height: 1.2;
      }
      .pv-header-subtitle {
        font-size: 13.5px;
        color: #64748b;
        margin-top: 3px;
        margin-bottom: 0;
      }
      .pv-btn-back {
        background: #ffffff;
        border: 1.5px solid var(--ad-brand);
        color: var(--ad-brand);
        border-radius: 10px;
        padding: 8px 18px;
        font-size: 13.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      }
      .pv-btn-back:hover {
        background: #f5f3ff;
        border-color: var(--ad-brand);
      }
      .pv-layout-grid {
        display: grid;
        grid-template-columns: 290px 1fr;
        gap: 24px;
        align-items: start;
      }
      @media (max-width: 992px) {
        .pv-layout-grid {
          grid-template-columns: 1fr;
        }
      }
      .pv-left-col {
        display: flex;
        flex-direction: column;
      }
      .pv-profile-card {
        background: linear-gradient(180deg, #ede9fe 0%, #fbfaff 30%, #ffffff 70%, #f5f3ff 100%);
        border-radius: 20px;
        border: 1px solid #eef2f6;
        padding: 28px 20px 24px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      }
      .pv-avatar-wrap {
        width: 110px;
        height: 110px;
        border-radius: 50%;
        margin: 0 auto 16px;
        overflow: hidden;
        border: 4px solid #ffffff;
        box-shadow: 0 6px 18px rgba(var(--ad-brand-rgb), 0.18);
        background: #e0e7ff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .pv-profile-name {
        font-size: 19px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 8px;
      }
      .pv-status-pill-dark {
        background: #526071;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        border-radius: 20px;
        padding: 4px 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 22px;
      }
      .pv-status-dot-green {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #22c55e;
      }
      .pv-quick-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        margin-top: 6px;
      }
      .pv-quick-action-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        text-decoration: none;
        cursor: pointer;
      }
      .pv-quick-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        cursor: pointer;
      }
      .pv-quick-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0,0,0,0.08);
      }
      .pv-quick-label {
        font-size: 11.5px;
        font-weight: 500;
      }
      .pv-meta-card {
        background: #ffffff;
        border-radius: 14px;
        border: 1px solid #eef2f6;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      }
      .pv-meta-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #ede9fe;
        color: var(--ad-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .pv-meta-label {
        font-size: 12px;
        color: #64748b;
        font-weight: 500;
        margin: 0;
      }
      .pv-meta-val {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        margin: 2px 0 0;
      }

      /* Right Column Sections */
      .pv-right-col {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .pv-section-card {
        background: #ffffff;
        border-radius: 18px;
        border: 1px solid #eef2f6;
        padding: 22px 26px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      }
      .pv-section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      .pv-section-badge-blue {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv-section-badge-green {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #10b981;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv-section-title-blue {
        font-size: 17px;
        font-weight: 700;
        color: #1e3a8a;
        margin: 0;
      }
      .pv-section-title-green {
        font-size: 17px;
        font-weight: 700;
        color: #065f46;
        margin: 0;
      }
      .pv-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 18px;
      }
      @media (max-width: 650px) {
        .pv-grid-2 {
          grid-template-columns: 1fr;
        }
      }
      .pv-pill-item {
        display: flex;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #edf2f7;
        border-radius: 12px;
        padding: 10px 14px;
        gap: 12px;
        min-height: 52px;
      }
      .pv-pill-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .pv-pill-label {
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        width: 95px;
        flex-shrink: 0;
      }
      .pv-pill-value {
        font-size: 13.5px;
        color: #0f172a;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .pv-bottom-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        margin-top: 14px;
        flex-wrap: wrap;
      }
    `}</style>

      {/* Main Content */}
      <div className="content">
        {mode === "board" && (
          <div className="si-page-wrapper">
            {/* Header */}
            <div className="si-header-container">
              <div className="si-header-left">
                <div className="si-header-icon-box">
                  <GraduationCap size={24} color="var(--ad-brand)" />
                </div>
                <div>
                  <h3 className="si-header-title">Students List</h3>
                  <p className="si-header-subtitle">
                    Manage all registered students
                  </p>
                </div>
              </div>

              <div className="si-header-right">
                <span className="si-total-count-text">
                  Total <b>{totalCount}</b>
                </span>

                <button
                  type="button"
                  className="si-btn-export-excel"
                  onClick={() => askExport("excel")}
                >
                  <Download size={15} />
                  Export Excel
                </button>

                <button
                  type="button"
                  className="si-btn-export-csv"
                  onClick={() => askExport("csv")}
                >
                  <FileText size={15} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="si-stats-grid">
              {/* Total Students */}
              <div
                className={`si-stat-card card-total ${
                  sort !== "Active" && sort !== "Disabled" && !dfrom && !dto
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setSort("New");
                  setDfrom("");
                  setDto("");
                  setSearch("");
                  loadDetails(1, "", "New", "", "");
                }}
                title="Click to view all students"
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#dbeafe", color: "#2563eb" }}
                >
                  <Users size={22} color="#2563eb" />
                </div>
                <div>
                  <div className="si-stat-label">Total Students</div>
                  <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Students-s1" /></div>
                </div>
              </div>

              {/* Active */}
              <div
                className={`si-stat-card card-approved ${sort === "Active" ? "active" : ""}`}
                onClick={() => {
                  const nextSort = sort === "Active" ? "New" : "Active";
                  setSort(nextSort);
                  loadDetails(1, search, nextSort, dfrom, dto);
                }}
                title="Click to filter by Active students"
              >
                <div
                  className="si-stat-icon-wrap wrap-circle"
                  style={{ background: "#dcfce7" }}
                >
                  <div
                    className="si-stat-icon-inner-circle"
                    style={{ background: "#22c55e", color: "#ffffff" }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </div>
                </div>
                <div>
                  <div className="si-stat-label">Active</div>
                  <div className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="Students-s2" /></div>
                </div>
              </div>

              {/* Disabled */}
              <div
                className={`si-stat-card card-rejected ${sort === "Disabled" ? "active" : ""}`}
                onClick={() => {
                  const nextSort = sort === "Disabled" ? "New" : "Disabled";
                  setSort(nextSort);
                  loadDetails(1, search, nextSort, dfrom, dto);
                }}
                title="Click to filter by Disabled / Deleted students"
              >
                <div
                  className="si-stat-icon-wrap wrap-circle"
                  style={{ background: "#fee2e2" }}
                >
                  <div
                    className="si-stat-icon-inner-circle"
                    style={{ background: "#ef4444", color: "#ffffff" }}
                  >
                    <Lock size={15} strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <div className="si-stat-label">Disabled / Deleted</div>
                  <div className="si-stat-value"><AnimatedNumber value={disabledCount} pending={loading} id="Students-s3" /></div>
                </div>
              </div>

              {/* Recent (7 Days) */}
              <div
                className={`si-stat-card card-recent ${Boolean(dfrom && dto) ? "active" : ""}`}
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
                    .toISOString()
                    .slice(0, 10);
                  if (dfrom === sevenDaysAgo && dto === today) {
                    setDfrom("");
                    setDto("");
                    loadDetails(1, search, sort, "", "");
                  } else {
                    setDfrom(sevenDaysAgo);
                    setDto(today);
                    loadDetails(1, search, sort, sevenDaysAgo, today);
                  }
                }}
                title="Click to filter students registered in the last 7 days"
              >
                <div
                  className="si-stat-icon-wrap wrap-circle"
                  style={{ background: "#ede9fe" }}
                >
                  <div
                    className="si-stat-icon-inner-circle"
                    style={{ background: "var(--ad-brand)", color: "#ffffff" }}
                  >
                    <Clock size={16} strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <div className="si-stat-label">Recent (7 Days)</div>
                  <div className="si-stat-value"><AnimatedNumber value={recentCount} pending={loading} id="Students-s4" /></div>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="si-filter-bar">
              <div className="si-filter-left">
                <div className="si-sort-group">
                  <ArrowUpDown size={16} color="#334155" />
                  <span>Sort By</span>
                  <select
                    className="si-select-sort"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(1, search, e.target.value, dfrom, dto);
                    }}
                  >
                    <option value="New">New</option>
                    <option value="Old">Old</option>
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                <div className="si-date-group">
                  <span>From</span>
                  <div className="si-date-box">
                    <span className="si-date-icon">
                      <Calendar size={15} />
                    </span>
                    <input
                      type="date"
                      className="si-date-input"
                      value={dfrom}
                      max={dto || undefined}
                      onChange={(e) => {
                        setDfrom(e.target.value);
                        loadDetails(1, search, sort, e.target.value, dto);
                      }}
                    />
                  </div>
                </div>

                <div className="si-date-group">
                  <span>To</span>
                  <div className="si-date-box">
                    <span className="si-date-icon">
                      <Calendar size={15} />
                    </span>
                    <input
                      type="date"
                      className="si-date-input"
                      value={dto}
                      min={dfrom || undefined}
                      onChange={(e) => {
                        setDto(e.target.value);
                        loadDetails(1, search, sort, dfrom, e.target.value);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="si-filter-right">
                <form
                  className="si-search-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadDetails(1, search, sort, dfrom, dto);
                  }}
                  style={{
                    display: "flex",
                    gap: "10px",
                  }}
                >
                  <ListSearch
                    placeholder="Search by name, email or contact..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadDetails(1, search, sort, dfrom, dto);
                      }
                    }}
                  />

                  <button
                    data-refresh
                    type="button"
                    className="reload-btn"
                    title="Reload students"
                    onClick={() => loadDetails(1, search, sort, dfrom, dto)}
                  >
                    <RotateCw size={16} />
                  </button>
                </form>
              </div>
            </div>

            {/* Students Table Card */}
            <div className="si-table-card">
              <div className="si-table-responsive">
                <table className="si-table">
                  <thead className="si-thead">
                    <tr>
                      <th className="si-th" style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          className="si-checkbox"
                          checked={
                            alllists.length > 0 &&
                            alllists.every((item) =>
                              selectedIds.includes(
                                String(item.mem_id || item.id),
                              ),
                            )
                          }
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th className="si-th" style={{ width: "45px" }}>
                        #
                      </th>
                      <th className="si-th" style={{ width: "70px" }}>
                        Profile
                      </th>
                      <th className="si-th">Name</th>
                      <th className="si-th">Contact</th>
                      <th className="si-th">Email</th>
                      <th
                        className="si-th"
                        style={{ width: "100px", textAlign: "center" }}
                      >
                        Information
                      </th>
                      <th className="si-th">Date &amp; Time</th>
                      <th className="si-th">Status</th>
                      <th className="si-th" style={{ width: "130px" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows />
                    ) : alllists.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          style={{
                            textAlign: "center",
                            padding: "48px 20px",
                            color: "#64748b",
                          }}
                        >
                          <Users
                            size={40}
                            color="#cbd5e1"
                            style={{ display: "block", margin: "0 auto 12px" }}
                          />
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "15px",
                              color: "#334155",
                            }}
                          >
                            No students found
                          </div>
                          <div style={{ fontSize: "13px", marginTop: "4px" }}>
                            Try adjusting your filters or search term
                          </div>
                        </td>
                      </tr>
                    ) : (
                      alllists.map((item, idx) => {
                        const rowId = String(item.mem_id || item.id || idx);
                        const isChecked = selectedIds.includes(rowId);
                        const isDeleted = item.status === "1D";
                        const isDisabled = item.status === "1S";
                        const avatarStyle = getAvatarStyle(idx);
                        const initials = getInitials(item.name);
                        const dtLines = formatDateTimeLines(item.datetime);

                        return (
                          <tr
                            key={item.mem_id || item.id || idx}
                            className={`si-tr ${isDeleted ? "row-deleted" : isDisabled ? "row-disabled" : ""}`}
                          >
                            {/* Checkbox */}
                            <td className="si-td">
                              <input
                                type="checkbox"
                                className="si-checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(rowId)}
                              />
                            </td>

                            {/* Serial */}
                            <td
                              className="si-td"
                              style={{ color: "#475569", fontWeight: 500 }}
                            >
                              {(page - 1) * limit + idx + 1}
                            </td>

                            {/* Profile Badge */}
                            <td className="si-td">
                              {item.profile ? (
                                <img
                                  src={item.profile}
                                  alt="profile"
                                  width="36"
                                  height="36"
                                  className="rounded-circle"
                                  style={{ objectFit: "cover" }}
                                />
                              ) : (
                                <div
                                  className="si-avatar-badge"
                                  style={{
                                    background: avatarStyle.bg,
                                    color: avatarStyle.text,
                                  }}
                                >
                                  {initials}
                                </div>
                              )}
                            </td>

                            {/* Name */}
                            <td className="si-td">
                              <span className="si-name">
                                {item.name || "-"}
                              </span>
                            </td>

                            {/* Contact */}
                            <td
                              className="si-td"
                              style={{ color: "#334155", whiteSpace: "nowrap" }}
                            >
                              {item.number || "-"}
                            </td>

                            {/* Email */}
                            <td className="si-td" style={{ color: "#334155" }}>
                              {item.email || "-"}
                            </td>

                            {/* Information (Eye) */}
                            <td
                              className="si-td"
                              style={{ textAlign: "center" }}
                            >
                              <button
                                type="button"
                                className="si-btn-info"
                                title="View Information"
                                onClick={() => updateto("view", item)}
                              >
                                <Eye size={16} />
                              </button>
                            </td>

                            {/* Date & Time (2 lines) */}
                            <td className="si-td">
                              <div className="si-datetime-col">
                                <span className="si-date-text">
                                  {dtLines.date}
                                </span>
                                {dtLines.time && (
                                  <span className="si-time-text">
                                    {dtLines.time}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status Pill */}
                            <td className="si-td">
                              {renderStatusBadge(item.status)}
                            </td>

                            {/* Action Buttons */}
                            <td className="si-td">
                              {loadingId === item.mem_id ? (
                                <span
                                  style={{ fontSize: "12px", color: "#64748b" }}
                                >
                                  Requesting...
                                </span>
                              ) : item.status !== "1D" ? (
                                <div className="si-actions-cell">
                                  {permCan("edit") && (
                                    <button
                                      type="button"
                                      className="si-action-btn"
                                      style={{
                                        background: "#dbeafe",
                                        color: "#2563eb",
                                      }}
                                      title="Update Student Profile"
                                      onClick={() => updateto("update", item)}
                                    >
                                      <Edit size={14} />
                                    </button>
                                  )}

                                  {item.status === "1"
                                    ? permCan("status") && (
                                        <button
                                          type="button"
                                          className="si-action-btn"
                                          style={{
                                            background: "#fef3c7",
                                            color: "#d97706",
                                          }}
                                          title="Disable Student Profile"
                                          onClick={() => disableList(item)}
                                        >
                                          <Lock size={14} />
                                        </button>
                                      )
                                    : permCan("status") && (
                                        <button
                                          type="button"
                                          className="si-action-btn"
                                          style={{
                                            background: "#dcfce7",
                                            color: "#16a34a",
                                          }}
                                          title="Enable Student Profile"
                                          onClick={() => enableList(item)}
                                        >
                                          <Unlock size={14} />
                                        </button>
                                      )}

                                  {permCan("delete") && (
                                    <button
                                      type="button"
                                      className="si-action-btn btn-trash"
                                      title="Delete Student Profile"
                                      onClick={() => deleteList(item)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="si-actions-cell">
                                  <span
                                    className="si-status-pill status-rejected"
                                    style={{
                                      padding: "4px 10px",
                                      fontSize: "11.5px",
                                    }}
                                  >
                                    Deleted
                                  </span>
                                  {permCan("delete") && (
                                    <button
                                      type="button"
                                      className="si-action-btn btn-trash"
                                      title="Delete Permanently"
                                      onClick={() => setPurgeTarget(item)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
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
                  <select className="si-limit-select" value={limit} disabled>
                    <option value="10">10</option>
                  </select>
                  <span>
                    Showing {totalCount === 0 ? 0 : (page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, totalCount)} of {totalCount}{" "}
                    students
                  </span>
                </div>

                {lastPage > 1 && (
                  <div className="si-pagination">
                    <button
                      type="button"
                      className="si-page-nav-btn"
                      disabled={page <= 1}
                      onClick={() => {
                        if (page > 1) {
                          const newP = page - 1;
                          setPage(newP);
                          loadDetails(newP, search, sort, dfrom, dto);
                        }
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: Math.min(lastPage, 5) }, (_, i) => {
                      let pNum = i + 1;
                      if (lastPage > 5 && page > 3) {
                        pNum = page - 2 + i;
                        if (pNum > lastPage) pNum = lastPage - (4 - i);
                      }
                      return (
                        <button
                          key={pNum}
                          type="button"
                          className={`si-page-btn ${page === pNum ? "active" : ""}`}
                          onClick={() => {
                            setPage(pNum);
                            loadDetails(pNum, search, sort, dfrom, dto);
                          }}
                        >
                          {pNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="si-page-nav-btn"
                      disabled={page >= lastPage}
                      onClick={() => {
                        if (page < lastPage) {
                          const newP = page + 1;
                          setPage(newP);
                          loadDetails(newP, search, sort, dfrom, dto);
                        }
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/students" />
              </div>
            </div>
          </div>
        )}

        {mode === "update" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              {/* Header Card */}
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-header-icon-box">
                    <UserPlus size={26} />
                  </div>
                  <div>
                    <h1 className="rf-header-title">
                      Updating Student Details
                    </h1>
                    <p className="rf-header-subtitle">
                      Update student enrollment information
                    </p>
                  </div>
                </div>

                {/* Decorative graphic */}
                <div className="rf-header-decor">
                  <GraduationCap size={96} color="var(--ad-brand)" />
                </div>

                <a onClick={() => moveto("board")} className="rf-btn-back">
                  <ArrowLeft size={16} /> Go Back
                </a>
              </div>

              {/* Form Card */}
              <div className="rf-form-card">
                {permCan("edit") && (
                  <form className="adminphone" onSubmit={updateList}>
                    {/* Status Messages */}
                    {success && (
                      <div
                        className="alert alert-success d-flex align-items-center mb-4"
                        role="alert"
                      >
                        <CheckCircle size={18} className="me-2" />
                        <div>{success}</div>
                      </div>
                    )}

                    {error && (
                      <div
                        className="alert alert-danger d-flex align-items-center mb-4"
                        role="alert"
                      >
                        <X size={18} className="me-2" />
                        <div>{error}</div>
                      </div>
                    )}

                    <div className="rf-form-grid">
                      {/* Name */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                        >
                          <User size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Name : <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="Enter Full Name"
                            required
                            value={form.name}
                            onChange={(e) =>
                              setForm({ ...form, name: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Gender */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0f2fe", color: "#0284c7" }}
                        >
                          <Users size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Gender : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="gender"
                            value={form.gender}
                            onChange={(e) =>
                              setForm({ ...form, gender: e.target.value })
                            }
                          >
                            <option value="">Select Gender</option>
                            <option value="1">Male</option>
                            <option value="2">Female</option>
                            <option value="3">Prefer not to disclose</option>
                          </select>
                        </div>
                      </div>

                      {/* Contact Number */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fee2e2", color: "#e11d48" }}
                        >
                          <Phone size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Contact Number : <span className="req">*</span>
                          </label>
                          <input
                            name="fullphone"
                            type="text"
                            defaultValue=""
                            style={{ display: "none" }}
                            ref={phoneRef}
                          />
                          <input type="hidden" name="country_code" />

                          <input
                            type="text"
                            name="phone"
                            id="phone"
                            className="rf-input"
                            placeholder="Enter Contact Number"
                            required
                            style={{ paddingLeft: "47px" }}
                            value={form.number}
                            onChange={(e) =>
                              setForm({ ...form, number: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                        >
                          <Mail size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Email : <span className="req">*</span>
                          </label>
                          <input
                            type="email"
                            className="rf-input"
                            placeholder="Enter Email Address"
                            required
                            value={form.email}
                            onChange={(e) =>
                              setForm({ ...form, email: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Qualification */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#dcfce7", color: "#16a34a" }}
                        >
                          <GraduationCap size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Qualification : <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="Enter Qualification"
                            required
                            value={form.qualification}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                qualification: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Preferred Course */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#ffedd5", color: "#ea580c" }}
                        >
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Preferred Course : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="course"
                            id="course"
                            value={form.cid}
                            onChange={(e) => {
                              setForm({ ...form, cid: e.target.value });
                              const exists = batches.some(
                                (b) => b.req_id === e.target.value,
                              );
                              if (!exists) {
                                loadBatches(e.target.value);
                              }
                            }}
                          >
                            <option value="">Select Course</option>
                            {courses.map((c) => (
                              <option key={c.req_id} value={c.req_id}>
                                {decodeHtml(c.title)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Preferred Batch */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0f2fe", color: "#0284c7" }}
                        >
                          <Users size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Preferred Batch : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="batch"
                            id="batch"
                            value={form.bid}
                            onChange={(e) =>
                              setForm({ ...form, bid: e.target.value })
                            }
                          >
                            <option value="">Select Batch</option>
                            {batches
                              .filter((res) => res.req_id === form.cid)
                              .flatMap((res) => res.data)
                              .filter((c) => c.status === "1")
                              .map((c) => (
                                <option key={c.b_id} value={c.b_id}>
                                  {decodeHtml(c.name)}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Membership Expires Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Membership Expires Date :{" "}
                            <span className="req">*</span>
                          </label>
                          <input
                            type="date"
                            className="rf-input"
                            required
                            value={timestampToDateTime(form.expires)}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                expires: dformatDate(e.target.value) + "",
                              });
                            }}
                          />
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        className="rf-submit-btn"
                        disabled={loading}
                      >
                        <Save size={18} />
                        {loading ? <ButtonLoader label="Updating..." /> : "Update"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === "view" && (
          <div className="pv-wrapper">
            {/* Header */}
            <div className="pv-header">
              <div className="pv-header-left">
                <div className="pv-header-icon">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="pv-header-title">Profile Details</h3>
                  <p className="pv-header-subtitle">
                    View complete information about this student
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => moveto("board")}
                  className="pv-btn-back"
                >
                  <ArrowLeft size={16} />
                  Go Back
                </button>
              </div>
            </div>

            <div className="pv-layout-grid">
              {/* Left Column */}
              <div className="pv-left-col">
                <div className="pv-profile-card">
                  <div className="pv-avatar-wrap">
                    <img
                      src={
                        form.gender === "1"
                          ? "/images/malepic.jpg"
                          : form.gender === "2"
                            ? "/images/femalepic.jpg"
                            : form.profile || "/images/malepic.jpg"
                      }
                      alt={form.name || "Profile"}
                      className="pv-avatar-img"
                    />
                  </div>

                  <h4 className="pv-profile-name">{form.name || "Student"}</h4>

                  <div>
                    <span className="pv-status-pill-dark">
                      <span className="pv-status-dot-green"></span>
                      {getStatus(form.status)}
                    </span>
                  </div>

                  {/* 4 Quick Actions */}
                  <div className="pv-quick-actions">
                    <a
                      href={form.number ? `tel:${form.number}` : "#"}
                      className="pv-quick-action-item"
                      title="Call"
                    >
                      <div
                        className="pv-quick-btn"
                        style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                      >
                        <Phone size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "#64748b" }}
                      >
                        Call
                      </span>
                    </a>

                    <a
                      href={form.email ? `mailto:${form.email}` : "#"}
                      className="pv-quick-action-item"
                      title="Email"
                    >
                      <div
                        className="pv-quick-btn"
                        style={{ background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <Mail size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "#0284c7" }}
                      >
                        Email
                      </span>
                    </a>

                    <a
                      href={
                        form.number
                          ? `https://wa.me/${form.number.replace(/\D/g, "")}`
                          : "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pv-quick-action-item"
                      title="Message"
                    >
                      <div
                        className="pv-quick-btn"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <MessageCircle size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "#16a34a" }}
                      >
                        Message
                      </span>
                    </a>

                    <div
                      className="pv-quick-action-item"
                      title="View Details"
                      onClick={() =>
                        toast.info(`Viewing student #${form.id || form.mem_id}`)
                      }
                    >
                      <div
                        className="pv-quick-btn"
                        style={{ background: "#f3e8ff", color: "var(--ad-brand)" }}
                      >
                        <FileText size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "#64748b" }}
                      >
                        View Details
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lower Left Stat Cards */}
                <div className="pv-meta-card">
                  <div className="pv-meta-icon">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="pv-meta-label">Member ID</p>
                    <p className="pv-meta-val">
                      {form.id || form.mem_id || "-"}
                    </p>
                  </div>
                </div>

                <div className="pv-meta-card">
                  <div className="pv-meta-icon">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="pv-meta-label">Registered On</p>
                    <p className="pv-meta-val">
                      {formatDate(form.datetime) || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="pv-right-col">
                {/* Section 1: Personal Information */}
                <div className="pv-section-card">
                  <div className="pv-section-header">
                    <div className="pv-section-badge-blue">
                      <User size={18} />
                    </div>
                    <h4 className="pv-section-title-blue">
                      Personal Information
                    </h4>
                  </div>

                  <div className="pv-grid-2">
                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                      >
                        <User size={16} />
                      </div>
                      <span className="pv-pill-label">Name</span>
                      <span className="pv-pill-value">{form.name || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                      >
                        <GraduationCap size={16} />
                      </div>
                      <span className="pv-pill-label">Qualification</span>
                      <span className="pv-pill-value">
                        {form.qualification || "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <Compass size={16} />
                      </div>
                      <span className="pv-pill-label">Gender</span>
                      <span className="pv-pill-value">
                        {getGender(form.gender)}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ffedd5", color: "#ea580c" }}
                      >
                        <BookOpen size={16} />
                      </div>
                      <span className="pv-pill-label">Course</span>
                      <span className="pv-pill-value">
                        {loading ? <InlineLoader /> : form.cid || "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <Mail size={16} />
                      </div>
                      <span className="pv-pill-label">Email</span>
                      <span className="pv-pill-value">{form.email || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#cffafe", color: "#0891b2" }}
                      >
                        <Users size={16} />
                      </div>
                      <span className="pv-pill-label">Batch</span>
                      <span className="pv-pill-value">
                        {loading ? <InlineLoader /> : form.bid || "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ffe4e6", color: "#e11d48" }}
                      >
                        <Phone size={16} />
                      </div>
                      <span className="pv-pill-label">Phone</span>
                      <span className="pv-pill-value">
                        {form.number || "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <CheckCircle size={16} />
                      </div>
                      <span className="pv-pill-label">Status</span>
                      <span className="pv-pill-value">
                        <span
                          className="pv-status-pill-dark"
                          style={{
                            margin: 0,
                            padding: "3px 12px",
                            fontSize: "11px",
                          }}
                        >
                          <span className="pv-status-dot-green"></span>
                          {getStatus(form.status)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Enrollment & Account Details */}
                <div className="pv-section-card">
                  <div className="pv-section-header">
                    <div className="pv-section-badge-green">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="pv-section-title-green">
                      Enrollment &amp; Account Details
                    </h4>
                  </div>

                  <div className="pv-grid-2">
                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                      >
                        <Calendar size={16} />
                      </div>
                      <span className="pv-pill-label">Registered On</span>
                      <span className="pv-pill-value">
                        {formatDate(form.datetime) || "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ffe4e6", color: "#e11d48" }}
                      >
                        <Clock size={16} />
                      </div>
                      <span className="pv-pill-label">Expires On</span>
                      <span className="pv-pill-value">
                        {formatDate(form.expires) || "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <Monitor size={16} />
                      </div>
                      <span className="pv-pill-label">Last Login</span>
                      <span className="pv-pill-value">
                        {formatDate(form.lastdatetime) || "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <User size={16} />
                      </div>
                      <span className="pv-pill-label">Member ID</span>
                      <span className="pv-pill-value">
                        {form.id || form.mem_id || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="pv-bottom-actions">
                  {loadingId === form.mem_id ? (
                    <span>Requesting...</span>
                  ) : form.status !== "1D" ? (
                    <>
                      {permCan("login-sessions:view") && (
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          style={{
                            borderRadius: "10px",
                            padding: "8px 18px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                          onClick={() =>
                            navigate(
                              "/panel/login-sessions?m=" +
                                encodeURIComponent(form.mem_id),
                            )
                          }
                        >
                          <Monitor size={16} /> Sessions
                        </button>
                      )}
                      {permCan("edit") && (
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{
                            borderRadius: "10px",
                            padding: "8px 18px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                          onClick={() => updateto("update", form)}
                        >
                          <Edit size={16} /> Edit Profile
                        </button>
                      )}
                      {form.status == "1" ? (
                        permCan("status") ? (
                          <button
                            type="button"
                            className="btn btn-warning text-dark"
                            style={{
                              borderRadius: "10px",
                              padding: "8px 18px",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                            onClick={() => disableList(form)}
                          >
                            <Lock size={16} /> Disable
                          </button>
                        ) : null
                      ) : permCan("status") ? (
                        <button
                          type="button"
                          className="btn btn-info text-white"
                          style={{
                            borderRadius: "10px",
                            padding: "8px 18px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                          onClick={() => enableList(form)}
                        >
                          <Unlock size={16} /> Enable
                        </button>
                      ) : null}
                      {permCan("delete") && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{
                            borderRadius: "10px",
                            padding: "8px 18px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                          onClick={() => deleteList(form)}
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span
                        className="badge bg-danger"
                        style={{
                          fontSize: "14px",
                          padding: "8px 16px",
                          borderRadius: "10px",
                        }}
                      >
                        Deleted
                      </span>
                      {permCan("delete") && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{
                            borderRadius: "10px",
                            padding: "8px 18px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                          onClick={() => setPurgeTarget(form)}
                        >
                          <Trash2 size={16} /> Delete Permanently
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  /* ================= Components ================= */
  function Pagination({ page, total, limit, lastPage, onPageChange }: any) {
    if (total === 0 || lastPage <= 1) return null;

    // Calculate Showing X to Y
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    // Pagination range logic (same as PHP)
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

    const pages = [];

    for (let i = pagstart; i < pagend && i <= lastPage; i++) {
      pages.push(i);
    }

    return (
      <div className="col-md-12 pagepagination">
        {/* Info */}
        <div className="dt-start">
          <div className="dt-info" role="status">
            Showing {start} to {end} of {total} entries
          </div>
        </div>

        {/* Pagination */}
        <div className="dt-end">
          <div className="dt-paging paging_full_numbers">
            {/* Previous */}
            {page >= 2 && (
              <button
                className="dt-paging-button first"
                onClick={() => onPageChange(page - 1)}
              >
                «
              </button>
            )}

            {/* Page Numbers */}
            {pages.map((p) => (
              <button
                key={p}
                className={`dt-paging-button ${p === page ? "current" : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            {page >= 1 && page < lastPage && (
              <button
                className="dt-paging-button last"
                onClick={() => onPageChange(page + 1)}
              >
                »
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function Icon() {
    return (
      <>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M2 21C2 17 6 15 8 15"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M14 21C14 17 18 15 20 15"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </>
    );
  }
}
