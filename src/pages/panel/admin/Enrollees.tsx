import { Head, SERVER_URL } from "../../../components/Includes";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useRef } from "react";
import { getSeoByPath } from "../../../utils/seo";
import DateFilter, {
  dayStartEpoch,
  dayEndEpoch,
} from "../../../components/DateFilter";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
  DollarSign,
  Plus,
  Trash2,
  Check,
  UserCheck,
  Download,
  X,
  Clock,
  ArrowUpDown,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
  Save,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";
import { securePassword } from "../../../utils/securePassword";

// Membership Expires Date default: today + 3 years (YYYY-MM-DD, local date)
const threeYearsFromToday = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("enrollees");

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
  const [showPass, setShowPass] = useState(false);
  const [showRpass, setShowRpass] = useState(false);

  // Full international number written by phoneinput.js ([name="fullphone"]).
  const phoneRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    id: "", // users.id
    req_id: "", // members.mem_id
    name: "", // name
    gender: "", // gender (1/0)
    email: "",
    number: "",
    qualification: "",
    cid: "",
    bid: "",
    course: "",
    addon: "",
    plan: "",
    fees: "",
    currency: "",
    expires: "",
    referby: "",
    password: "",
    rpassword: "",
    datetime: "", // registered date (timestamp)
    status: "", // active/inactive
  });

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

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

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    rejected: 0,
    recent: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<BatchResponse[]>([]);

  const formatDate = (ts: any) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("en-IN");
  };

  const getGender = (g: any) => {
    return g === "1" ? "Male" : g === "2" ? "Female" : "-";
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "2":
        return "Pending";
      case "3":
        return "Approved";
      case "0":
        return "Rejected";
      default:
        return "Unknown";
    }
  };

  const getCourseNameById = (id: string) => {
    if (!id || courses.length === 0) return "";

    const course = courses.find((c) => c.req_id === id);

    return course ? decodeHtml(course.title) : "";
  };

  const getBatchNameById = (id: string) => {
    if (!id || batches.length === 0) return "";

    for (const res of batches) {
      const batch = res.data.find((b) => b.b_id === id);

      if (batch) {
        return decodeHtml(batch.name);
      }
    }
    return "";
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = alllists.map((item) => item.req_id || String(item.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const getInitials = (name: string) => {
    if (!name) return "EN";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarColors = [
    { bg: "#ede9fe", text: "var(--ad-brand)" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#fef3c7", text: "#d97706" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#fee2e2", text: "#dc2626" },
    { bg: "#f3e8ff", text: "var(--ad-brand)" },
  ];

  const getAvatarStyle = (index: number) => {
    return avatarColors[index % avatarColors.length];
  };

  const formatDateTimeLines = (ts: any) => {
    if (!ts) return { date: "-", time: "" };
    let num = Number(ts);
    let d: Date;
    if (!isNaN(num) && num > 0) {
      if (num < 10000000000) {
        d = new Date(num * 1000);
      } else {
        d = new Date(num);
      }
    } else {
      d = new Date(ts);
    }

    if (isNaN(d.getTime())) return { date: String(ts), time: "" };

    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return { date: dateStr, time: timeStr };
  };

  const renderStatusBadge = (status: any) => {
    const s = String(status);
    if (s === "3") {
      return (
        <span className="si-status-pill status-approved">
          <span className="si-status-dot"></span>
          Approved
        </span>
      );
    }
    if (s === "0") {
      return (
        <span className="si-status-pill status-rejected">
          <span className="si-status-dot"></span>
          Rejected
        </span>
      );
    }
    return (
      <span className="si-status-pill status-new">
        <span className="si-status-dot"></span>
        Pending
      </span>
    );
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
      const res = await listFetch("api/enrollees", {
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
      const res = await listFetch("api/get-courses", {
        status: "1",
      });

      if (res.data.success) {
        setCourses(res.data.data);
        if (res.data.data.length >= 1) {
          loadBatches(res.data.data[0].req_id);
        }
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
    }
  };

  const loadBatches = async (c_id = "") => {
    try {
      const res = await listFetch("api/get-batches", {
        status: "1",
        c_id: c_id,
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
        SERVER_URL + "api/accept-enroll",
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
            b.req_id === form.req_id
              ? {
                  ...b,
                  ...form,
                  number: phoneRef.current?.value?.trim() || form.number,
                }
              : b,
          ),
        );
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === form.req_id ? { ...b, status: "3" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "3" }));
        setMode("board");
        alert(res.data.message);
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

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const reason = window.prompt(
      "Are you sure you want to reject '" + list.name + "'?\n\nEnter reason:",
    );

    if (reason === null) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/reject-enroll",
        {
          id: list.req_id,
          name: list.name,
          email: list.email,
          reason: reason || "",
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
            b.req_id === list.req_id ? { ...b, status: "0" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "0" }));
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
      setBatches([]);
      setForm({
        id: "",
        req_id: "",
        name: "",
        gender: "",
        email: "",
        number: "",
        qualification: "",
        bid: "",
        cid: "",
        course: "",
        addon: "",
        plan: "",
        fees: "",
        currency: "",
        expires: "",
        referby: "",
        password: "",
        rpassword: "",
        datetime: "",
        status: "",
      });
    }
  };

  const updateto = async (type: any, list: any) => {
    // registering: expiry and password are filled in (both can be changed)
    const pwd = type === "update" ? securePassword() : "";
    setShowPass(false);
    setShowRpass(false);
    setForm({
      id: list.id,
      req_id: list.req_id,
      name: list.name,
      gender: list.gender,
      email: list.email,
      number: list.number,
      qualification: list.qualification,
      bid: list.bid,
      cid: list.cid,
      course: list.cid,
      expires: type === "update" ? threeYearsFromToday() : "",
      referby: list.profile,
      password: pwd,
      rpassword: pwd,
      datetime: list.datetime,
      status: list.status,
      addon: list.addon || "",
      plan: list.plan || "",
      fees: list.fees ?? "",
      currency: list.currency || "",
    });
    setBatches([]);
    loadBatches(list.cid);
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
      Course: decodeHtml(getCourseNameById(u.cid || u.course)),
      Batch: getBatchNameById(u.bid),
      Date: formatDate(u.datetime),
      Status: getStatus(u.status),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Enrollees");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    saveAs(file, "enrollees_list.xlsx");
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
      Course: decodeHtml(getCourseNameById(u.cid || u.course)),
      Batch: getBatchNameById(u.bid),
      Date: formatDate(u.datetime),
      Status: getStatus(u.status),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(blob, "enrollees_list.csv");
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/enrollees"),
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

  const totalCount = listtotal || alllists.length;
  const approvedCount = stats.approved;
  const rejectedCount = stats.rejected;
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

      <style>{`
      /* Students Inquiries & Enrollees List Styles */
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
      .rf-password-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .rf-eye-btn {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
      }
      .rf-eye-btn:hover {
        color: var(--ad-brand);
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
      .si-stat-card.card-rejected.active {
        box-shadow: 0 0 0 2px #dc2626, 0 6px 16px rgba(220, 38, 38, 0.15);
        border-color: #dc2626;
      }
      .si-stat-card.card-recent.active {
        box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.15);
        border-color: var(--ad-brand);
      }
      .si-stat-card.card-total {
        background: #f0f8ff;
      }
      .si-stat-card.card-approved {
        background: #f0fdf4;
      }
      .si-stat-card.card-rejected {
        background: #fff1f2;
      }
      .si-stat-card.card-recent {
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
      .si-tr.row-rejected {
        background-color: #fff5f5 !important;
      }
      .si-tr.row-rejected:hover {
        background-color: #fee2e2 !important;
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
                  <UserCheck size={24} color="var(--ad-brand)" />
                </div>
                <div>
                  <h3 className="si-header-title">Enrollees List</h3>
                  <p className="si-header-subtitle">
                    Manage all enrolled students
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
              {/* Total Enrollees */}
              <div
                className={`si-stat-card card-total ${
                  sort !== "Approved" && sort !== "Rejected" && !dfrom && !dto
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
                title="Click to view all enrollees"
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#dbeafe", color: "#2563eb" }}
                >
                  <Users size={22} color="#2563eb" />
                </div>
                <div>
                  <div className="si-stat-label">Total Enrollees</div>
                  <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Enrollees-s1" /></div>
                </div>
              </div>

              {/* Approved */}
              <div
                className={`si-stat-card card-approved ${sort === "Approved" ? "active" : ""}`}
                onClick={() => {
                  const nextSort = sort === "Approved" ? "New" : "Approved";
                  setSort(nextSort);
                  loadDetails(1, search, nextSort, dfrom, dto);
                }}
                title="Click to filter by Approved"
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
                  <div className="si-stat-label">Approved</div>
                  <div className="si-stat-value"><AnimatedNumber value={approvedCount} pending={loading} id="Enrollees-s2" /></div>
                </div>
              </div>

              {/* Rejected */}
              <div
                className={`si-stat-card card-rejected ${sort === "Rejected" ? "active" : ""}`}
                onClick={() => {
                  const nextSort = sort === "Rejected" ? "New" : "Rejected";
                  setSort(nextSort);
                  loadDetails(1, search, nextSort, dfrom, dto);
                }}
                title="Click to filter by Rejected"
              >
                <div
                  className="si-stat-icon-wrap wrap-circle"
                  style={{ background: "#fee2e2" }}
                >
                  <div
                    className="si-stat-icon-inner-circle"
                    style={{ background: "#ef4444", color: "#ffffff" }}
                  >
                    <X size={16} strokeWidth={3} />
                  </div>
                </div>
                <div>
                  <div className="si-stat-label">Rejected</div>
                  <div className="si-stat-value"><AnimatedNumber value={rejectedCount} pending={loading} id="Enrollees-s3" /></div>
                </div>
              </div>

              {/* Recent (7 Days) */}
              <div
                className={`si-stat-card card-recent ${dfrom && dto ? "active" : ""}`}
                onClick={() => {
                  if (dfrom && dto) {
                    setDfrom("");
                    setDto("");
                    loadDetails(1, search, sort, "", "");
                  } else {
                    const now = new Date();
                    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const fStr = `${sevenDaysAgo.getFullYear()}-${pad(sevenDaysAgo.getMonth() + 1)}-${pad(sevenDaysAgo.getDate())}`;
                    const tStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                    setDfrom(fStr);
                    setDto(tStr);
                    loadDetails(1, search, sort, fStr, tStr);
                  }
                }}
                title="Click to filter by Recent (7 Days)"
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
                  <div className="si-stat-value"><AnimatedNumber value={recentCount} pending={loading} id="Enrollees-s4" /></div>
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
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
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
                    loadDetails(1, search, sort);
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
                    title="Reload enrollees"
                    onClick={() => loadDetails(1, search, sort, dfrom, dto)}
                  >
                    <RotateCw size={16} />
                  </button>
                </form>
              </div>
            </div>

            {/* Enrollees Table Card */}
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
                                item.req_id || String(item.id),
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
                          <UserCheck
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
                            No enrollees found
                          </div>
                          <div style={{ fontSize: "13px", marginTop: "4px" }}>
                            Try adjusting your filters or search term
                          </div>
                        </td>
                      </tr>
                    ) : (
                      alllists.map((item, idx) => {
                        const rowId = item.req_id || String(item.id || idx);
                        const isChecked = selectedIds.includes(rowId);
                        const isRejected = String(item.status) === "0";
                        const avatarStyle = getAvatarStyle(idx);
                        const initials = getInitials(item.name);
                        const dtLines = formatDateTimeLines(item.datetime);

                        return (
                          <tr
                            key={item.req_id || item.id || idx}
                            className={`si-tr ${isRejected ? "row-rejected" : ""}`}
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
                              {loadingId === item.req_id ? (
                                <span
                                  style={{ fontSize: "12px", color: "#64748b" }}
                                >
                                  Requesting...
                                </span>
                              ) : item.status !== "0" ? (
                                item.status == "2" ? (
                                  <div className="si-actions-cell">
                                    {(!permCan || permCan("approve")) && (
                                      <button
                                        type="button"
                                        className="si-action-btn btn-trash"
                                        title="Reject enrollee"
                                        onClick={() => deleteList(item)}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}

                                    {(!permCan || permCan("approve")) && (
                                      <button
                                        type="button"
                                        className="si-action-btn"
                                        style={{
                                          background: "#dcfce7",
                                          color: "#16a34a",
                                        }}
                                        title="View Details & Register"
                                        onClick={() => updateto("update", item)}
                                      >
                                        <Check size={15} strokeWidth={2.5} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span
                                    className="si-status-pill status-approved"
                                    style={{
                                      padding: "4px 10px",
                                      fontSize: "11.5px",
                                    }}
                                  >
                                    Approved
                                  </span>
                                )
                              ) : (
                                <span
                                  className="si-status-pill status-rejected"
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: "11.5px",
                                  }}
                                >
                                  Rejected
                                </span>
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
                    {Math.min(page * limit, totalCount)} of {totalCount} entries
                  </span>
                </div>

                <div className="si-pagination">
                  <button
                    type="button"
                    className="si-page-nav-btn"
                    disabled={page <= 1}
                    onClick={() => {
                      const prev = Math.max(1, page - 1);
                      setPage(prev);
                      loadDetails(prev, search, sort, dfrom, dto);
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Pages */}
                  {Array.from(
                    {
                      length: Math.max(
                        1,
                        lastPage || Math.ceil(totalCount / limit),
                      ),
                    },
                    (_, i) => i + 1,
                  )
                    .filter(
                      (p) =>
                        p === 1 || p === lastPage || Math.abs(p - page) <= 1,
                    )
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`si-page-btn ${page === p ? "active" : ""}`}
                        onClick={() => {
                          setPage(p);
                          loadDetails(p, search, sort, dfrom, dto);
                        }}
                      >
                        {p}
                      </button>
                    ))}

                  <button
                    type="button"
                    className="si-page-nav-btn"
                    disabled={
                      page >= (lastPage || Math.ceil(totalCount / limit))
                    }
                    onClick={() => {
                      const next = page + 1;
                      setPage(next);
                      loadDetails(next, search, sort, dfrom, dto);
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/enrollees" />
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
                      Registering Enroll Student Details
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
                {permCan("approve") && (
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
                              setForm({
                                ...form,
                                cid: e.target.value,
                                course: e.target.value,
                              });
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
                              .filter((res) => res.req_id === form.course)
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
                            value={form.expires}
                            onChange={(e) =>
                              setForm({ ...form, expires: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fee2e2", color: "#dc2626" }}
                        >
                          <Lock size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Password : <span className="req">*</span>
                          </label>
                          <div className="rf-password-wrapper">
                            <input
                              type={showPass ? "text" : "password"}
                              className="rf-input"
                              required
                              placeholder="Enter Account Password"
                              value={form.password}
                              onChange={(e) =>
                                setForm({ ...form, password: e.target.value })
                              }
                              style={{ paddingRight: 70 }}
                            />
                            <button
                              type="button"
                              className="rf-eye-btn"
                              style={{ right: 38 }}
                              title="Generate a new password"
                              aria-label="Generate a new password"
                              onClick={() => {
                                const pwd = securePassword();
                                setForm({ ...form, password: pwd, rpassword: pwd });
                                setShowPass(true);
                              }}
                            >
                              <RotateCw size={16} />
                            </button>
                            <button
                              type="button"
                              className="rf-eye-btn"
                              onClick={() => setShowPass(!showPass)}
                            >
                              {showPass ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Re-Password */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0f2fe", color: "#0284c7" }}
                        >
                          <Lock size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Re-Password : <span className="req">*</span>
                          </label>
                          <div className="rf-password-wrapper">
                            <input
                              type={showRpass ? "text" : "password"}
                              className="rf-input"
                              required
                              placeholder="Re-Enter Account Password"
                              value={form.rpassword}
                              onChange={(e) =>
                                setForm({ ...form, rpassword: e.target.value })
                              }
                            />
                            <button
                              type="button"
                              className="rf-eye-btn"
                              onClick={() => setShowRpass(!showRpass)}
                            >
                              {showRpass ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
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
                    View complete information about this enrollee
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
                            : "/images/malepic.jpg"
                      }
                      alt={form.name || "Profile"}
                      className="pv-avatar-img"
                    />
                  </div>

                  <h4 className="pv-profile-name">{form.name || "Enrollee"}</h4>

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
                        toast.info(
                          `Viewing enrollee #${form.id || form.req_id}`,
                        )
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
                      {form.id || form.req_id || "-"}
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
                        {decodeHtml(getCourseNameById(form.course)) || "-"}
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
                        {getBatchNameById(form.bid) || "-"}
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

                {/* Section 2: Program & Payment Information */}
                <div className="pv-section-card">
                  <div className="pv-section-header">
                    <div className="pv-section-badge-green">
                      <FileText size={18} />
                    </div>
                    <h4 className="pv-section-title-green">
                      Program &amp; Payment Information
                    </h4>
                  </div>

                  <div className="pv-grid-2">
                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                      >
                        <FileText size={16} />
                      </div>
                      <span className="pv-pill-label">Plan</span>
                      <span className="pv-pill-value">{form.plan || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <DollarSign size={16} />
                      </div>
                      <span className="pv-pill-label">Fees</span>
                      <span className="pv-pill-value">
                        {form.fees !== "" && form.fees != null
                          ? `${form.currency || "USD"} ${form.fees}`
                          : "-"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ffe4e6", color: "#e11d48" }}
                      >
                        <Plus size={16} />
                      </div>
                      <span className="pv-pill-label">Add-on</span>
                      <span className="pv-pill-value">{form.addon || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <Calendar size={16} />
                      </div>
                      <span className="pv-pill-label">Registered On</span>
                      <span className="pv-pill-value">
                        {formatDate(form.datetime) || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="pv-bottom-actions">
                  {loadingId === form.req_id ? (
                    <span>Requesting...</span>
                  ) : form.status !== "0" ? (
                    form.status === "2" ? (
                      <>
                        {(!permCan || permCan("approve")) && (
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
                            <Trash2 size={16} />
                            Reject
                          </button>
                        )}
                        {(!permCan || permCan("approve")) && (
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
                            <Check size={16} />
                            Register
                          </button>
                        )}
                      </>
                    ) : (
                      <span
                        className="badge bg-success"
                        style={{
                          fontSize: "14px",
                          padding: "8px 16px",
                          borderRadius: "10px",
                        }}
                      >
                        Approved
                      </span>
                    )
                  ) : (
                    <span
                      className="badge bg-danger"
                      style={{
                        fontSize: "14px",
                        padding: "8px 16px",
                        borderRadius: "10px",
                      }}
                    >
                      Rejected
                    </span>
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
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
          <path
            d="M3 21C3 17 6 15 9 15"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M17 8V14M14 11H20" stroke="currentColor" strokeWidth="2" />
        </svg>
      </>
    );
  }
}
