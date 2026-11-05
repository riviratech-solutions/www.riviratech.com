import { Head, SERVER_URL } from "../../../components/Includes";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { dayStartEpoch, dayEndEpoch } from "../../../components/DateFilter";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  MessageSquare,
  MessageSquareText,
  Download,
  FileText,
  Check,
  X,
  Clock,
  ArrowUpDown,
  Calendar,
  RotateCw,
  Eye,
  Trash2,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Mail,
  MessageCircle,
  GraduationCap,
  Compass,
  BookOpen,
  Users,
  CheckCircle,
  DollarSign,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("students-inquiries");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Send-payment-link popup: review addon/plan/fees/currency, edit the fee, send.
  const [payOpen, setPayOpen] = useState(false);
  const [payList, setPayList] = useState<any>(null);
  const [payFees, setPayFees] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");

  const [form, setForm] = useState({
    id: "", // users.id
    req_id: "", // members.mem_id
    name: "", // name
    gender: "", // gender (1/0)
    email: "",
    number: "",
    qualification: "",
    bid: "",
    cid: "",
    course: "",
    expires: "",
    referby: "",
    password: "",
    rpassword: "",
    datetime: "", // registered date (timestamp)
    status: "", // active/inactive
    addon: "",
    plan: "",
    fees: "",
    currency: "",
  });

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
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
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(alllists.map((item) => item.req_id || String(item.id)));
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
    if (!name) return "S";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarPalette = [
    { bg: "#ede9fe", text: "var(--ad-brand)" }, // purple
    { bg: "#e0f2fe", text: "#0284c7" }, // blue
    { bg: "#dcfce7", text: "#16a34a" }, // green
    { bg: "#ffe4e6", text: "#e11d48" }, // rose/pink
  ];

  const getAvatarStyle = (index: number) => {
    return avatarPalette[index % avatarPalette.length];
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
    if (s === "2") {
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
        New
      </span>
    );
  };

  /* ---- Add Subscription popup (same payment form as Subscriptions.tsx) ---- */
  const emptySub = {
    mem_id: "",
    sname: "",
    semail: "",
    sphone: "",
    bname: "",
    crs_id: "",
    b_id: "",
    currency: "USD",
    fees: "",
    status: "2",
    paydate: "",
    pay_id: "",
    pay_intent: "",
  };
  const [subForm, setSubForm] = useState(emptySub);
  const [subOpen, setSubOpen] = useState(false);
  const [subBusy, setSubBusy] = useState(false);

  // Batches of the course chosen in the popup — kept apart from `batches`,
  // which the table uses to name every row's batch.
  const [subBatches, setSubBatches] = useState<any[]>([]);
  const [subBatchesLoading, setSubBatchesLoading] = useState(false);
  const subBatchReq = useRef(0);

  const loadSubBatches = async (c_id: string, keepBid = "") => {
    const ticket = ++subBatchReq.current;
    setSubBatches([]);
    if (!c_id) return;
    setSubBatchesLoading(true);
    try {
      const res = await listFetch("api/get-batches", {
        status: "1",
        c_id,
      });
      if (ticket !== subBatchReq.current) return; // a newer course was picked meanwhile
      const list = res.data.success
        ? (res.data.data || []).filter((b: any) => !b.c_id || b.c_id === c_id)
        : [];
      setSubBatches(list);
      // keep the student's current batch when it belongs to this course
      if (keepBid && list.some((b: any) => b.b_id === keepBid)) {
        setSubForm((f) => (f.crs_id === c_id ? { ...f, b_id: keepBid } : f));
      }
    } catch {
      if (ticket === subBatchReq.current) setSubBatches([]);
    } finally {
      if (ticket === subBatchReq.current) setSubBatchesLoading(false);
    }
  };

  const subCourseChange = (c_id: string) => {
    setSubForm((f) => ({ ...f, crs_id: c_id, b_id: "" }));
    loadSubBatches(c_id);
  };

  const fmtBatchDates = (b: any) => {
    const d = (t: any) =>
      Number(t)
        ? new Date(Number(t) * 1000).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "";
    const a = d(b.sdate),
      z = d(b.edate);
    return a || z ? ` (${a}${z ? " – " + z : ""})` : "";
  };

  const openSub = async (list: any) => {
    setSubForm({
      mem_id: list.req_id || "",
      sname: list.name || "",
      semail: list.email || "",
      sphone: list.number || "",
      bname: getBatchNameById(list.bid) || "",
      crs_id: list.cid || "",
      b_id: "",
      currency: "USD",
      fees: "",
      status: "2",
      paydate: "",
      pay_id: "",
      pay_intent: "",
    });
    setSubBatches([]);
    setSubBatchesLoading(!!list.cid);
    setSubOpen(true);
    // one request at a time: the API keeps only the latest security token
    if (!batches.length) await loadBatches("");
    await loadSubBatches(list.cid || "", list.bid || "");
  };

  const saveSub = async () => {
    if (!subForm.mem_id) {
      toast.error("No student selected");
      return;
    }
    if (!subForm.crs_id) {
      toast.error("Please select a course");
      return;
    }
    if (subBatchesLoading) {
      toast.error("Batches are still loading");
      return;
    }
    if (subBatches.length && !subForm.b_id) {
      toast.error("Please select a batch");
      return;
    }
    setSubBusy(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/subscriptions/add",
        {
          ...subForm,
          fromInquiry: true,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setSubOpen(false);
        // The inquiry is now approved — drop it from the list.
        setAllLists((prev) => prev.filter((b) => b.req_id !== subForm.mem_id));
        setTotal((t) => Math.max(0, t - 1));
        setStats((prev) => ({
          ...prev,
          approved: prev.approved + 1,
        }));
        if (mode === "view") setMode("board"); // done from its details view
      } else toast.error(res.data.message);
    } catch {
      toast.error("Save failed");
    } finally {
      setSubBusy(false);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("en-IN");
  };

  const getGender = (g: any) => {
    return g === "1" ? "Male" : g === "2" ? "Female" : "-";
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "1":
        return "Pending";
      case "2":
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

    const batch = batches.find((c) => c.b_id === id);

    return batch ? decodeHtml(batch.name) : "";
  };

  const loadDetails = async (
    page = 1,
    search = "",
    sort = "",
    df = "",
    dt = "",
    fetchStats = false,
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);
    setDfrom(df);
    setDto(dt);

    try {
      const res = await listFetch("api/inquiries-received", {
        q: search,
        s: sort,
        n: page,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
        fetchStats,
      });

      if (res.data && res.data.stats) {
        setStats(res.data.stats);
      }

      if (res.data && res.data.success) {
        setAllLists(res.data.data || []);
        setTotal(res.data.total || 0);
        setLastPage(res.data.lastPage || 1);
        // a page past the end (e.g. after deleting its last row) comes back as the last page
        if (Number(res.data.page) > 0) setPage(Number(res.data.page));
      } else {
        setAllLists([]);
        setTotal(0);
        setLastPage(0);
      }
    } catch (err) {
      console.error(err);
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
      await loadCourses();
    }
  };

  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {
        status: "1",
      });

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

  const loadBatches = async (c_id = "") => {
    try {
      const res = await listFetch("api/get-batches", {
        status: "1",
        c_id: c_id,
      });

      if (res.data.success) {
        setBatches(res.data.data);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
    }
  };

  // Open the review popup (shows addon / plan / fees / currency; fee is editable).
  const sendpaymentlink = (list: any) => {
    setSuccess("");
    setError("");
    setPayList(list);
    setPayFees(list.fees != null && list.fees !== "" ? String(list.fees) : "");
    setPayOpen(true);
  };

  // Confirm from the popup → save the (edited) fee + send the payment-link email.
  const submitPaymentLink = async () => {
    const list = payList;
    if (!list) return;

    if (payFees === "" || isNaN(Number(payFees)) || Number(payFees) <= 0) {
      toast.error("Please enter a valid fee amount");
      return;
    }

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/payment-request",
        {
          id: list.req_id,
          fees: Number(payFees),
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        // reflect the saved fee + "requested" state in the list
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === list.req_id
              ? { ...b, prs: "1", fees: Number(payFees) }
              : b,
          ),
        );
        setForm((f) =>
          f.req_id === list.req_id ? { ...f, fees: String(payFees) } : f,
        );
        setPayOpen(false);
        setPayList(null);
        if (mode === "view") setMode("board"); // done from its details view
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error("❌ Something went wrong");
    } finally {
      setLoadingId(null);
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
        SERVER_URL + "api/reject-inquiry",
        {
          // the server emails the inquiry's own name / address
          id: list.req_id,
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
        if (String(list.status) !== "0") {
          setStats((prev) => ({
            ...prev,
            rejected: prev.rejected + 1,
          }));
        }
        if (mode === "view") setMode("board"); // done from its details view
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  // Delete a rejected inquiry for good (it is kept in Deleted Records).
  const removeInquiry = async (list: any) => {
    if (!window.confirm("Delete the rejected inquiry of '" + (list.name || "") + "'?\n\nThis removes it from the list.")) return;
    try {
      setLoadingId(list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-inquiry",
        { id: list.req_id, key: security.key, token: security.token, aut: security.aut },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setSelectedIds((ids) => ids.filter((x) => x !== list.req_id));
        if (mode === "view") setMode("board"); // deleted from its details view
        loadDetails(page, search, sort, dfrom, dto, true);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Something went wrong");
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
        expires: "",
        referby: "",
        password: "",
        rpassword: "",
        datetime: "",
        status: "",
        addon: "",
        plan: "",
        fees: "",
        currency: "",
      });
    }
  };

  const updateto = async (type: any, list: any) => {
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
      expires: "",
      referby: list.referby || "",
      password: "",
      rpassword: "",
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
      Date: formatDate(u.datetime),
      Status: getStatus(u.status),
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

    saveAs(file, "enrollees_list.xlsx");
  };

  // Excel runs a CSV cell that starts with = + - @ (or a tab / CR) as a
  // formula. Names, emails, … come from the public enroll form, so such a
  // cell gets a leading ' — plain numbers and phone numbers are left as is.
  const csvSafe = (v: any) => {
    const s = v == null ? "" : String(v);
    return /^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s) ? "'" + s : s;
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Name: csvSafe(u.name),
      Phone: csvSafe(u.number),
      Email: csvSafe(u.email),
      Qualification: csvSafe(u.qualification),
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
      fetchAll: () => fetchAllRows("api/inquiries-received"),
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
      loadDetails(
        1,
        new URLSearchParams(location.search).get("q") || "",
        "New",
        "",
        "",
        true,
      );
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

    // ---------- Admin CSS ----------

    return () => {
      //document.body.removeChild(aosrun);
      //document.head.removeChild(maincss);
      //document.head.removeChild(adminlink);
    };
  }, []);

  const totalCount = listtotal || alllists.length;
  const statTotal = stats.total > 0 ? stats.total : totalCount;
  const approvedCount =
    stats.total > 0
      ? stats.approved
      : alllists.filter((i) => String(i.status) === "2").length;
  const rejectedCount =
    stats.total > 0
      ? stats.rejected
      : alllists.filter((i) => String(i.status) === "0").length;
  const recentCount =
    stats.total > 0
      ? stats.recent
      : alllists.filter((i) => {
          const ts = Number(i.datetime);
          if (!ts) return false;
          const num = ts < 10000000000 ? ts * 1000 : ts;
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          return num >= sevenDaysAgo;
        }).length;

  void success;
  void error;
  void getStatus;
  void Pagination;
  void Icon;

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
      .si-action-btn.btn-delete {
        background: #ef4444;
        color: #ffffff;
      }
      .si-action-btn.btn-delete:hover {
        background: #dc2626;
      }
      .si-action-btn.btn-pay {
        background: #1e1b4b;
        color: #ffffff;
      }
      .si-action-btn.btn-pay:hover {
        background: #312e81;
      }
      .si-action-btn.btn-sub {
        background: #f3e8ff;
        color: var(--ad-brand);
      }
      .si-action-btn.btn-sub:hover {
        background: #e9d5ff;
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

      /* View Mode styles */
      .si-view-card {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #eef2f6;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
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
                  <MessageSquareText size={24} color="var(--ad-brand)" />
                </div>
                <div>
                  <h3 className="si-header-title">Inquiries Received</h3>
                  <p className="si-header-subtitle">
                    Manage all students inquiries
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
              {/* Total Inquiries */}
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
                title="Click to view all inquiries"
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#dbeafe", color: "#2563eb" }}
                >
                  <MessageSquare size={22} fill="#2563eb" color="#2563eb" />
                </div>
                <div>
                  <div className="si-stat-label">Total Inquiries</div>
                  <div className="si-stat-value"><AnimatedNumber value={statTotal} pending={loading} id="StudentsInquiries-s1" /></div>
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
                title="Click to filter by Approved inquiries"
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
                  <div className="si-stat-value"><AnimatedNumber value={approvedCount} pending={loading} id="StudentsInquiries-s2" /></div>
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
                title="Click to filter by Rejected inquiries"
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
                  <div className="si-stat-value"><AnimatedNumber value={rejectedCount} pending={loading} id="StudentsInquiries-s3" /></div>
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
                title="Click to filter inquiries from the last 7 days"
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
                  <div className="si-stat-value"><AnimatedNumber value={recentCount} pending={loading} id="StudentsInquiries-s4" /></div>
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
                    title="Reload inquiries"
                    onClick={() =>
                      loadDetails(1, search, sort, dfrom, dto, true)
                    }
                  >
                    <RotateCw size={16} />
                  </button>
                </form>
              </div>
            </div>

            {/* Inquiries Table Card */}
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
                          <MessageSquareText
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
                            No inquiries found
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
                              <div
                                className="si-avatar-badge"
                                style={{
                                  background: avatarStyle.bg,
                                  color: avatarStyle.text,
                                }}
                              >
                                {initials}
                              </div>
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
                              ) : (
                                <div className="si-actions-cell">
                                  {/* Trash (Reject) — new inquiries only */}
                                  {(!permCan || permCan("reject")) &&
                                    String(item.status) === "1" && (
                                      <button
                                        type="button"
                                        className="si-action-btn btn-trash"
                                        title="Reject inquiry"
                                        onClick={() => deleteList(item)}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}

                                  {/* Delete (rejected only) */}
                                  {(!permCan || permCan("delete")) &&
                                    item.status == "0" && (
                                      <button
                                        type="button"
                                        className="si-action-btn btn-delete"
                                        title="Delete inquiry"
                                        onClick={() => removeInquiry(item)}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}

                                  {/* Payment Request — new inquiries only */}
                                  {(!permCan || permCan("payment")) &&
                                    String(item.status) === "1" && (
                                      <button
                                        type="button"
                                        className="si-action-btn btn-pay"
                                        title="Send payment request"
                                        onClick={() => sendpaymentlink(item)}
                                      >
                                        <BadgeDollarSign size={15} />
                                      </button>
                                    )}

                                  {/* Add Subscription */}
                                  {(!permCan || permCan("subscribe")) &&
                                    item.status != "0" && (
                                      <button
                                        type="button"
                                        className="si-action-btn btn-sub"
                                        title="Add subscription"
                                        onClick={() => openSub(item)}
                                      >
                                        <FileText size={15} />
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
                <SavedAgo endpoint="api/inquiries-received" />
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
                            : "/images/malepic.jpg"
                      }
                      alt={form.name || "Profile"}
                      className="pv-avatar-img"
                    />
                  </div>

                  <h4 className="pv-profile-name">{form.name || "Student"}</h4>

                  <div>
                    <span className="pv-status-pill-dark">
                      <span className="pv-status-dot-green"></span>
                      {form.status === "2"
                        ? "Approved"
                        : form.status === "0"
                          ? "Rejected"
                          : "Pending"}
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
                      title="View Inquiry"
                      onClick={() =>
                        toast.info(`Viewing inquiry #${form.req_id || form.id}`)
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
                        View Inquiry
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
                        {getCourseNameById(form.course || form.cid) || "-"}
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
                          {form.status === "2"
                            ? "Approved"
                            : form.status === "0"
                              ? "Rejected"
                              : "Pending"}
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
                  ) : (
                    <>
                      {(!permCan || permCan("reject")) &&
                        String(form.status) === "1" && (
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
                            Reject Inquiry
                          </button>
                        )}
                      {(!permCan || permCan("delete")) &&
                        String(form.status) === "0" && (
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
                            onClick={() => removeInquiry(form)}
                          >
                            <Trash2 size={16} />
                            Delete Inquiry
                          </button>
                        )}
                      {(!permCan || permCan("payment")) &&
                        String(form.status) === "1" && (
                          <button
                            type="button"
                            className="btn btn-dark"
                            style={{
                              borderRadius: "10px",
                              padding: "8px 18px",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                            onClick={() => sendpaymentlink(form)}
                          >
                            <BadgeDollarSign size={16} />
                            Send Payment Request
                          </button>
                        )}
                      {(!permCan || permCan("subscribe")) &&
                        form.status != "0" && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              borderRadius: "10px",
                              padding: "8px 18px",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                            onClick={() => openSub(form)}
                          >
                            <FileText size={16} />
                            Add Subscription
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

      {/* ============ SEND PAYMENT LINK POPUP ============ */}
      {payOpen && payList && (
        <div className="spl-overlay" onClick={() => setPayOpen(false)}>
          <div className="spl-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="spl-close"
              onClick={() => setPayOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h4 className="spl-title">Send Payment Request</h4>
            <p className="spl-sub">
              Review the details and confirm the fee to charge{" "}
              <b>{payList.name}</b>.
            </p>

            <table className="spl-table">
              <tbody>
                <tr>
                  <th>Name</th>
                  <td>{payList.name || "-"}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>{payList.email || "-"}</td>
                </tr>
                <tr>
                  <th>Course</th>
                  <td>
                    {getCourseNameById(payList.cid || payList.course) || "-"}
                  </td>
                </tr>
                <tr>
                  <th>Plan</th>
                  <td>{payList.plan || "-"}</td>
                </tr>
                <tr>
                  <th>Add-on</th>
                  <td>{payList.addon || "-"}</td>
                </tr>
                <tr>
                  <th>Currency</th>
                  <td>{payList.currency || "USD"}</td>
                </tr>
              </tbody>
            </table>

            <div className="spl-fee">
              <label>Fees ({payList.currency || "USD"}) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                className="form-control"
                value={payFees}
                onChange={(e) => setPayFees(e.target.value)}
                placeholder="Enter amount"
              />
              <small>
                This amount is saved and is the exact amount the student pays.
              </small>
            </div>

            <div className="spl-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setPayOpen(false)}
              >
                Cancel
              </button>
              {permCan("payment") && (
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={loadingId === payList.req_id}
                  onClick={submitPaymentLink}
                >
                  {loadingId === payList.req_id
                    ? "Sending..."
                    : "Send Payment Link"}
                </button>
              )}
            </div>
          </div>

          <style
            dangerouslySetInnerHTML={{
              __html: `
          .spl-overlay{position:fixed;inset:0;z-index:99;background:rgba(6,11,25,.7);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:16px;}
          .spl-modal{position:relative;background:#fff;border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 26px 54px -18px rgba(2,6,23,.6);}
          .spl-close{position:absolute;top:10px;right:12px;width:30px;height:30px;border:none;border-radius:50%;background:#f1f5f9;color:#475569;font-size:20px;line-height:1;cursor:pointer;}
          .spl-close:hover{background:#e2e8f0;color:#1a2233;}
          .spl-title{margin:0 0 4px;font-size:1.2rem;color:#1a2233;font-weight:700;}
          .spl-sub{margin:0 0 14px;color:#64748b;font-size:.88rem;}
          .spl-table{width:100%;border-collapse:collapse;margin-bottom:14px;}
          .spl-table th{text-align:left;color:#64748b;font-weight:600;font-size:.82rem;padding:7px 8px;width:38%;border-bottom:1px solid #eef1f6;vertical-align:top;}
          .spl-table td{color:#1a2233;font-size:.9rem;padding:7px 8px;border-bottom:1px solid #eef1f6;}
          .spl-fee{background:#fff6db;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:16px;}
          .spl-fee label{display:block;font-size:.82rem;font-weight:700;color:#8a6d00;margin-bottom:6px;}
          .spl-fee input{max-width:220px;}
          .spl-fee small{display:block;margin-top:6px;color:#8a6d00;font-size:.75rem;}
          .spl-actions{display:flex;gap:10px;justify-content:flex-end;}
        `,
            }}
          />
        </div>
      )}

      {/* ============ ADD SUBSCRIPTION (Payment Details) ============ */}
      {subOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => !subBusy && setSubOpen(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Add Subscription — Payment Details
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  disabled={subBusy}
                  onClick={() => setSubOpen(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div
                  className="alert alert-secondary py-2 px-3 mb-3"
                  style={{ fontSize: ".88rem" }}
                >
                  <b>{subForm.sname || "—"}</b>
                  {subForm.semail ? ` · ${subForm.semail}` : ""}
                  {subForm.sphone ? ` · ${subForm.sphone}` : ""}
                  {subForm.bname && (
                    <div className="text-muted" style={{ fontSize: ".8rem" }}>
                      Latest batch: {subForm.bname}
                    </div>
                  )}
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Course</label>
                    <select
                      className="form-select"
                      value={subForm.crs_id}
                      onChange={(e) => subCourseChange(e.target.value)}
                    >
                      <option value="">Select course</option>
                      {courses.map((c) => (
                        <option key={c.req_id} value={c.req_id}>
                          {decodeHtml(c.title)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      Batch
                      {subBatches.length > 0 && (
                        <span className="text-danger"> *</span>
                      )}
                    </label>
                    <select
                      className="form-select"
                      value={subForm.b_id}
                      disabled={
                        !subForm.crs_id ||
                        subBatchesLoading ||
                        subBatches.length === 0
                      }
                      onChange={(e) =>
                        setSubForm({ ...subForm, b_id: e.target.value })
                      }
                    >
                      <option value="">
                        {!subForm.crs_id
                          ? "Select a course first"
                          : subBatchesLoading
                            ? "Loading batches…"
                            : subBatches.length
                              ? "Select batch"
                              : "No active batches for this course"}
                      </option>
                      {subBatches.map((b) => (
                        <option key={b.b_id} value={b.b_id}>
                          {decodeHtml(b.name)}
                          {fmtBatchDates(b)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Payment Date</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={subForm.paydate}
                      onChange={(e) =>
                        setSubForm({ ...subForm, paydate: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Currency</label>
                    <select
                      className="form-select"
                      value={subForm.currency}
                      onChange={(e) =>
                        setSubForm({ ...subForm, currency: e.target.value })
                      }
                    >
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Fees</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={subForm.fees}
                      onChange={(e) =>
                        setSubForm({ ...subForm, fees: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Status</label>
                    <select
                      className="form-select"
                      value={subForm.status}
                      onChange={(e) =>
                        setSubForm({ ...subForm, status: e.target.value })
                      }
                    >
                      <option value="2">Success</option>
                      <option value="1">Pending</option>
                      <option value="0">Failed</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Pay ID</label>
                    <input
                      className="form-control"
                      value={subForm.pay_id}
                      onChange={(e) =>
                        setSubForm({ ...subForm, pay_id: e.target.value })
                      }
                      placeholder="Payment / receipt id"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Pay Intent</label>
                    <input
                      className="form-control"
                      value={subForm.pay_intent}
                      onChange={(e) =>
                        setSubForm({ ...subForm, pay_intent: e.target.value })
                      }
                      placeholder="Payment intent"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={subBusy}
                  onClick={() => setSubOpen(false)}
                >
                  Cancel
                </button>
                {permCan("subscribe") && (
                  <button
                    type="button" style={{"color":"white"}}
                    className="btn btn-primary"
                    disabled={subBusy}
                    onClick={saveSub}
                  >
                    {subBusy ? <ButtonLoader label="Saving…" /> : "Add Subscription"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="30"
          height="30"
          viewBox="0 0 200 200"
        >
          <g>
            <path
              d="M 79.96 128.04 C73.65,131.28 62.33,131.74 55.50,129.03 C47.52,125.86 40.65,119.11 36.31,110.20 C34.25,105.96 31.55,100.93 30.32,99.00 C25.97,92.21 24.08,78.23 27.02,74.50 C27.45,73.95 27.98,69.22 28.19,64.00 C28.50,56.58 29.11,53.41 30.98,49.50 C34.18,42.84 44.30,32.98 51.60,29.41 C56.80,26.86 58.53,26.54 66.98,26.54 C78.16,26.54 82.51,28.12 91.06,35.28 C104.16,46.25 105.37,48.60 105.54,63.50 C105.59,68.45 106.17,74.36 106.83,76.64 C107.79,79.99 107.73,82.15 106.51,87.93 C105.16,94.35 104.04,97.24 101.03,102.00 C100.50,102.82 98.89,106.11 97.44,109.31 C94.33,116.14 86.25,124.80 79.96,128.04 ZM 145.76 131.00 C141.31,135.40 137.31,139.00 136.88,139.00 C136.44,139.00 135.95,135.51 135.79,131.25 L 135.50 123.50 L 127.90 123.00 C114.48,122.12 114.00,121.00 114.00,90.70 C114.00,76.59 114.43,66.07 115.07,64.22 C117.23,58.04 117.46,58.00 154.78,58.00 C187.26,58.00 188.71,58.08 190.77,60.00 C194.51,63.49 195.15,68.74 194.82,93.18 L 194.50 116.16 L 190.76 119.58 L 187.03 123.00 L 153.84 123.00 ZM 86.50 170.57 C78.37,172.81 59.24,173.35 51.41,171.57 C42.94,169.65 32.52,165.37 26.00,161.15 C20.26,157.43 6.00,143.95 6.00,142.25 C6.00,140.44 31.97,124.00 34.83,124.00 C35.58,124.00 38.25,125.81 40.75,128.02 C43.26,130.22 48.26,133.48 51.86,135.25 C57.58,138.07 59.42,138.48 66.45,138.49 C73.41,138.50 75.38,138.08 81.00,135.39 C84.57,133.68 89.59,130.42 92.15,128.14 C94.71,125.86 97.32,124.00 97.94,124.00 C101.38,124.00 127.00,140.07 127.00,142.23 C127.00,142.93 123.06,147.33 118.25,152.02 C108.79,161.23 98.39,167.31 86.50,170.57 ZM 57.22 121.42 C66.31,125.95 75.22,124.04 83.83,115.70 C88.03,111.63 93.00,103.50 93.00,100.69 C93.00,99.93 93.90,98.49 95.01,97.49 C97.11,95.59 101.00,84.51 101.00,80.43 C101.00,79.09 100.13,77.61 99.00,77.00 C97.42,76.16 97.00,74.91 97.00,71.08 C97.00,67.80 96.38,65.46 95.10,63.87 C93.39,61.76 92.32,61.51 84.35,61.35 C77.38,61.21 73.60,60.52 66.56,58.09 C61.65,56.39 56.09,55.00 54.21,55.00 C46.33,55.00 40.56,60.77 37.94,71.28 C37.22,74.18 35.96,76.49 34.74,77.14 C33.01,78.07 32.81,78.91 33.29,83.48 C33.76,88.04 35.25,91.89 38.92,98.00 C39.42,98.82 40.57,101.62 41.48,104.22 C43.67,110.44 50.78,118.21 57.22,121.42 ZM 148.88 97.75 C149.08,99.81 156.93,99.36 157.69,97.25 C158.03,96.29 160.49,93.45 163.16,90.94 C167.61,86.75 168.00,86.00 168.00,81.71 C168.00,78.02 167.42,76.38 165.25,73.96 C159.20,67.21 144.45,68.29 141.35,75.72 C139.54,80.03 140.21,81.00 145.02,81.00 C147.91,81.00 149.21,80.48 150.00,79.00 C151.21,76.74 155.87,76.27 157.80,78.20 C160.33,80.73 159.11,84.28 154.09,88.94 C149.47,93.23 148.59,94.72 148.88,97.75 ZM 149.05 109.56 C149.87,110.55 151.61,110.99 153.91,110.80 C157.29,110.52 157.50,110.29 157.50,107.00 C157.50,103.60 157.38,103.49 153.28,103.19 C149.48,102.92 149.00,103.14 148.42,105.46 C148.04,106.98 148.30,108.65 149.05,109.56 Z"
              fill="rgb(1,1,1)"
            />
            <path
              d="M 0.00 100.00 L 0.00 0.00 L 100.00 0.00 L 200.00 0.00 L 200.00 100.00 L 200.00 200.00 L 100.00 200.00 L 0.00 200.00 L 0.00 100.00 ZM 86.50 170.57 C98.39,167.31 108.79,161.23 118.25,152.02 C123.06,147.33 127.00,142.93 127.00,142.23 C127.00,140.07 101.38,124.00 97.94,124.00 C97.32,124.00 94.71,125.86 92.15,128.14 C89.59,130.42 84.57,133.68 81.00,135.39 C75.38,138.08 73.41,138.50 66.45,138.49 C59.42,138.48 57.58,138.07 51.86,135.25 C48.26,133.48 43.26,130.22 40.75,128.02 C38.25,125.81 35.58,124.00 34.83,124.00 C31.97,124.00 6.00,140.44 6.00,142.25 C6.00,143.95 20.26,157.43 26.00,161.15 C32.52,165.37 42.94,169.65 51.41,171.57 C59.24,173.35 78.37,172.81 86.50,170.57 ZM 145.76 131.00 L 153.84 123.00 L 170.44 123.00 L 187.03 123.00 L 190.76 119.58 L 194.50 116.16 L 194.82 93.18 C195.15,68.74 194.51,63.49 190.77,60.00 C188.71,58.08 187.26,58.00 154.78,58.00 C117.46,58.00 117.23,58.04 115.07,64.22 C114.43,66.07 114.00,76.59 114.00,90.70 C114.00,121.00 114.48,122.12 127.90,123.00 L 135.50 123.50 L 135.79 131.25 C135.95,135.51 136.44,139.00 136.88,139.00 C137.31,139.00 141.31,135.40 145.76,131.00 ZM 79.96 128.04 C86.25,124.80 94.33,116.14 97.44,109.31 C98.89,106.11 100.50,102.82 101.03,102.00 C104.04,97.24 105.16,94.35 106.51,87.93 C107.73,82.15 107.79,79.99 106.83,76.64 C106.17,74.36 105.59,68.45 105.54,63.50 C105.37,48.60 104.16,46.25 91.06,35.28 C82.51,28.12 78.16,26.54 66.98,26.54 C58.53,26.54 56.80,26.86 51.60,29.41 C44.30,32.98 34.18,42.84 30.98,49.50 C29.11,53.41 28.50,56.58 28.19,64.00 C27.98,69.22 27.45,73.95 27.02,74.50 C24.08,78.23 25.97,92.21 30.32,99.00 C31.55,100.93 34.25,105.96 36.31,110.20 C40.65,119.11 47.52,125.86 55.50,129.03 C62.33,131.74 73.65,131.28 79.96,128.04 ZM 149.05 109.56 C148.30,108.65 148.04,106.98 148.42,105.46 C149.00,103.14 149.48,102.92 153.28,103.19 C157.38,103.49 157.50,103.60 157.50,107.00 C157.50,110.29 157.29,110.52 153.91,110.80 C151.61,110.99 149.87,110.55 149.05,109.56 ZM 148.88 97.75 C148.59,94.72 149.47,93.23 154.09,88.94 C159.11,84.28 160.33,80.73 157.80,78.20 C155.87,76.27 151.21,76.74 150.00,79.00 C149.21,80.48 147.91,81.00 145.02,81.00 C140.21,81.00 139.54,80.03 141.35,75.72 C144.45,68.29 159.20,67.21 165.25,73.96 C167.42,76.38 168.00,78.02 168.00,81.71 C168.00,86.00 167.61,86.75 163.16,90.94 C160.49,93.45 158.03,96.29 157.69,97.25 C156.93,99.36 149.08,99.81 148.88,97.75 ZM 57.22 121.42 C50.78,118.21 43.67,110.44 41.48,104.22 C40.57,101.62 39.42,98.82 38.92,98.00 C35.25,91.89 33.76,88.04 33.29,83.48 C32.81,78.91 33.01,78.07 34.74,77.14 C35.96,76.49 37.22,74.18 37.94,71.28 C40.56,60.77 46.33,55.00 54.21,55.00 C56.09,55.00 61.65,56.39 66.56,58.09 C73.60,60.52 77.38,61.21 84.35,61.35 C92.32,61.51 93.39,61.76 95.10,63.87 C96.38,65.46 97.00,67.80 97.00,71.08 C97.00,74.91 97.42,76.16 99.00,77.00 C100.13,77.61 101.00,79.09 101.00,80.43 C101.00,84.51 97.11,95.59 95.01,97.49 C93.90,98.49 93.00,99.93 93.00,100.69 C93.00,103.50 88.03,111.63 83.83,115.70 C75.22,124.04 66.31,125.95 57.22,121.42 Z"
              fill="transparent"
            />
          </g>
        </svg>
      </>
    );
  }
}
