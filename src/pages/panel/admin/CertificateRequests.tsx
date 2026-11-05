import { Head, SERVER_URL, SITE_ORIGIN } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { getSeoByPath } from "../../../utils/seo";
import DateFilter, {
  dayStartEpoch,
  dayEndEpoch,
} from "../../../components/DateFilter";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Award,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  UserPlus,
  Eye,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Key,
  Check,
  Mail,
  Phone,
  User,
  BookOpen,
  Download,
  Edit3,
  Calendar,
  RotateCw,
} from "lucide-react";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("certificate-requests");

// Account type as shown in this page. The stored value stays "ELDER" (database,
// public request form, server); it is displayed as "ADULT".
const acTypeLabel = (t?: string) => (!t || t === "ELDER" ? "ADULT" : t);

export default function CertificateRequests() {
  const [usertype, setusertype] = useState("");
  const navigate = useNavigate();

  const getCookie = (name: string): string | null => {
    const cookies = document.cookie.split("; ");

    for (const cookie of cookies) {
      const [key, ...value] = cookie.split("=");

      if (key === name) {
        return decodeURIComponent(value.join("="));
      }
    }

    return null;
  };

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    try {
      const data = await checklogin();
      const loggedIn = data.loggedIn;
      const status = data.id;
      if (loggedIn && (status === "X" || status === "Y")) {
        setusertype("SuperAdmin");
      } else {
        navigate("/signin");
      }
    } catch {
      navigate("/signin");
    }
  };

  useEffect(() => {
    const status = getCookie("id");
    if (status === "X" || status === "Y") {
      setusertype("SuperAdmin");
    } else {
      navigate("/signin");
    }

    initchecklogin();
  }, []);

  return (
    <>
      <Head
        pageTitle={seo.title || "Certificate Requests | Admin Panel"}
        pageDesc={
          seo.description ||
          "Manage incoming certificate requests, create student accounts, and issue credentials"
        }
        pageKeywords={
          seo.keywords || "certificate requests, student accounts, credentials"
        }
      />
      <ToastContainer position="top-right" autoClose={3000} />
      {usertype === "SuperAdmin" && <CertificateRequestsConsole />}
    </>
  );
}

function CertificateRequestsConsole() {
  const permCan = usePagePerm("certificate-requests");
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Lists & pagination
  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [serverStats, setServerStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    recent: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, no_account, approved, rejected
  const [typeFilter, setTypeFilter] = useState("all"); // all, course, internship, project
  const [courseFilter, setCourseFilter] = useState("all");

  // Courses & Batches
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [batchesByCourse, setBatchesByCourse] = useState<Record<string, any[]>>(
    {},
  );

  // Modals
  const [viewItem, setViewItem] = useState<any | null>(null);
  const [createAccountItem, setCreateAccountItem] = useState<any | null>(null);
  const [approveItem, setApproveItem] = useState<any | null>(null);
  const [rejectItem, setRejectItem] = useState<any | null>(null);

  // Create Account Form State
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    number: "",
    gender: "1",
    ac_type: "ELDER",
    qualification: "Graduate",
    course: "",
    batch: "",
    password: "",
    auto_approve: true,
    reason: "Student account created and certificate approved",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [existingAccountCheck, setExistingAccountCheck] = useState<{
    checked: boolean;
    loading: boolean;
    exists: boolean;
    member?: any;
  }>({ checked: false, loading: false, exists: false });

  // Approve Form State
  const [approveReason, setApproveReason] = useState(
    "Course completion verified by admin",
  );

  // Reject Form State
  const [rejectReason, setRejectReason] = useState("");

  // Edit Certificate Request Details State (Batch, Dates, Ac Type)
  const [editItem, setEditItem] = useState<{
    req_id: string;
    course: string;
    batch: string;
    sdate: string;
    edate: string;
    ac_type: string;
    name: string;
    email: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const FORM_URL = SITE_ORIGIN + "/certificate-request";

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const decodeHtml = (str: any) => {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  };

  const formatDate = (ts: any) => {
    if (!ts || ts === "-" || ts === "0") return "-";
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
      const dateObj = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      return dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return "-";
  };

  const formatDateTime = (ts: any) => {
    if (!ts || ts === "-" || ts === "0") return "-";
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
      const dateObj = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      return dateObj.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "-";
  };

  const calculateDuration = (sdate: any, edate: any) => {
    if (!sdate || !edate || sdate === "-" || edate === "-") return "";
    let start = Number(sdate);
    let end = Number(edate);
    if (!isNaN(start) && start > 0) {
      if (start < 10000000000) start *= 1000;
    } else {
      start = new Date(sdate).getTime();
    }
    if (!isNaN(end) && end > 0) {
      if (end < 10000000000) end *= 1000;
    } else {
      end = new Date(edate).getTime();
    }
    if (isNaN(start) || isNaN(end) || end < start) return "";
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays >= 30) {
      const months = (diffDays / 30).toFixed(1).replace(/\.0$/, "");
      return `${diffDays} days (~${months} mo)`;
    }
    return `${diffDays} days`;
  };

  const epochToDateInput = (ts: any) => {
    if (!ts || ts === "-" || ts === "0") return "";
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
      const d = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      return d.toISOString().split("T")[0];
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return "";
  };

  const dateInputToEpoch = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00Z");
    return Math.floor(d.getTime() / 1000).toString();
  };

  const getGenderText = (g: any) => {
    return g === "1"
      ? "Male"
      : g === "2"
        ? "Female"
        : g === "3"
          ? "Other"
          : "-";
  };

  const getTypeName = (t: string) => {
    const clean = (t || "").toLowerCase();
    if (clean === "internship") return "Internship";
    if (clean === "project") return "Project";
    if (clean === "bootcamp") return "Bootcamp";
    return "Course Completion";
  };

  const getCourseNameById = (id: string) => {
    if (!id) return "-";
    const c = courses.find((x) => x.req_id === id || x.title === id);
    if (c) return decodeHtml(c.title);
    if (/^[a-f0-9]{16,}$/i.test(id)) return "-";
    return id;
  };

  const getBatchForItem = (item: any) => {
    if (!item) return null;
    const batchId = String(item.batch || "").trim();
    const batchName = String(item.batch_name || "")
      .trim()
      .toLowerCase();
    return (
      batches.find(
        (b) =>
          (b.b_id && b.b_id === batchId) ||
          String(b.id) === batchId ||
          (b.name &&
            (b.name.toLowerCase() === batchName ||
              b.name.toLowerCase() === batchId.toLowerCase())),
      ) || null
    );
  };

  const getEffectiveDates = (item: any) => {
    if (!item) return { sdate: "", edate: "", batch: null };
    const batch = getBatchForItem(item);
    const sdate =
      item.sdate ||
      item.effective_sdate ||
      item.batch_sdate ||
      batch?.sdate ||
      "";
    const edate =
      item.edate ||
      item.effective_edate ||
      item.batch_edate ||
      batch?.edate ||
      "";
    return { sdate, edate, batch };
  };

  const getBatchNameById = (id: string) => {
    if (!id) return "-";
    const b = batches.find(
      (x) => x.b_id === id || x.name === id || String(x.id) === String(id),
    );
    if (b) return decodeHtml(b.name);
    if (/^[a-f0-9]{16,}$/i.test(id)) return "-";
    return id;
  };

  // Generate strong random password
  const generatePassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyz23456789";
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const specials = "!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pwd += uppers.charAt(Math.floor(Math.random() * uppers.length));
    pwd += specials.charAt(Math.floor(Math.random() * specials.length));
    pwd += Math.floor(100 + Math.random() * 900);
    return pwd;
  };

  // Copy public form link
  const copyFormLink = async () => {
    try {
      await navigator.clipboard.writeText(FORM_URL);
      toast.success("Public request form link copied to clipboard!");
    } catch {
      window.prompt("Copy public request form link:", FORM_URL);
    }
  };

  // Load courses
  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {
        all: "1", // including courses that aren't open for enrolment
        status: "",
      });
      if (res.data.success) {
        setCourses(res.data.data || []);
        return res.data.data || [];
      }
      console.error("loadCourses:", res.data.message);
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  // Load all batches
  const loadAllBatches = async () => {
    try {
      const res = await listFetch("api/get-batches", {
        c_id: "",
        status: "1",
      });
      if (res.data.success) {
        const loaded = res.data.data || [];
        setBatches(loaded);
        const grouped: Record<string, any[]> = {};
        loaded.forEach((b: any) => {
          if (b.c_id) {
            if (!grouped[b.c_id]) grouped[b.c_id] = [];
            grouped[b.c_id].push(b);
          }
        });
        setBatchesByCourse(grouped);
        return loaded;
      }
    } catch (err) {
      console.error("loadAllBatches error:", err);
    }
    return [];
  };

  // Load batches for a specific course
  const loadBatchesForCourse = async (courseId: string) => {
    if (!courseId) return [];
    if (batchesByCourse[courseId] && batchesByCourse[courseId].length > 0) {
      return batchesByCourse[courseId];
    }
    try {
      const res = await listFetch("api/get-batches", {
        c_id: courseId,
        status: "1",
      });
      if (res.data.success) {
        const loaded = res.data.data || [];
        setBatchesByCourse((prev) => ({ ...prev, [courseId]: loaded }));
        setBatches((prev) => {
          const ids = new Set(prev.map((b) => b.b_id));
          const fresh = loaded.filter((b: any) => !ids.has(b.b_id));
          return [...prev, ...fresh];
        });
        return loaded;
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  // Check if member exists by email
  const checkMemberAccount = async (email: string) => {
    if (!email) return;
    setExistingAccountCheck({ checked: false, loading: true, exists: false });
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/check-student-account",
        {
          email: email.trim(),
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success && res.data.exists) {
        setExistingAccountCheck({
          checked: true,
          loading: false,
          exists: true,
          member: res.data.member,
        });
      } else {
        setExistingAccountCheck({
          checked: true,
          loading: false,
          exists: false,
        });
      }
    } catch {
      setExistingAccountCheck({ checked: true, loading: false, exists: false });
    }
  };

  // Load list of certificate requests
  const loadDetails = async (
    targetPage = 1,
    query = search,
    sortOrder = sort,
    df = dfrom,
    dt = dto,
  ) => {
    setLoading(true);
    setPage(targetPage);
    setSearch(query);
    setSort(sortOrder);
    setDfrom(df);
    setDto(dt);

    try {
      const res = await listFetch("api/certificates", {
        q: query,
        s: sortOrder,
        n: targetPage,
        df: dayStartEpoch(df),
        dt: dayEndEpoch(dt),
      });

      if (res.data.success) {
        setAllLists(res.data.data || []);
        setTotal(res.data.total || 0);
        setLastPage(res.data.lastPage || 0);
      }
      if (res.data.stats) {
        setServerStats(res.data.stats);
      } else {
        toast.error(res.data.message || "Failed to load certificate requests");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load certificate requests from server");
    } finally {
      setLoading(false);
    }
  };

  // One request at a time: each call fetches a fresh security token and the
  // server keeps only the latest, so parallel calls fail each other's check
  // (that left the course/batch lists empty in the Edit modal).
  useEffect(() => {
    (async () => {
      await loadDetails(1);
      await loadCourses();
      await loadAllBatches();
    })();
  }, []);

  // Filter items in memory for status / type / course filters
  const filteredList = useMemo(() => {
    return alllists.filter((item) => {
      // Status filter
      if (statusFilter === "pending" && String(item.status) !== "1")
        return false;
      if (statusFilter === "approved" && String(item.status) !== "2")
        return false;
      if (statusFilter === "rejected" && String(item.status) !== "0")
        return false;
      if (statusFilter === "no_account") {
        const hasNoAccount = !item.mem_id || String(item.mem_id).trim() === "";
        if (!hasNoAccount) return false;
      }

      // Type filter
      if (
        typeFilter !== "all" &&
        (item.type || "").toLowerCase() !== typeFilter
      ) {
        return false;
      }

      // Course filter
      if (courseFilter !== "all" && item.course !== courseFilter) {
        return false;
      }

      return true;
    });
  }, [alllists, statusFilter, typeFilter, courseFilter]);

  // Summary Metrics — totals come from server stats (accurate across all pages);
  // noAccount is still computed locally as backend doesn't track it.
  const metrics = useMemo(() => {
    let noAccount = 0;
    alllists.forEach((item) => {
      if (!item.mem_id || String(item.mem_id).trim() === "") {
        noAccount++;
      }
    });

    return {
      total: serverStats.total || listtotal || alllists.length,
      pending: serverStats.pending,
      approved: serverStats.approved,
      rejected: serverStats.rejected,
      noAccount,
    };
  }, [alllists, listtotal, serverStats]);

  // Open Create Account Modal
  const openCreateAccountModal = async (item: any) => {
    const courseId = item.course || "";
    const generatedPwd = generatePassword();

    setAccountForm({
      name: item.name || "",
      email: item.email || "",
      number: item.number || "",
      gender: item.gender || "1",
      ac_type: item.ac_type || "ELDER",
      qualification: "Graduate",
      course: courseId,
      batch: item.batch || "",
      password: generatedPwd,
      auto_approve: true,
      reason: "Student account created and certificate approved",
    });

    setCreateAccountItem(item);
    setShowPassword(false);

    // Check if account already exists (awaited — see the note on the initial load)
    if (item.email) {
      await checkMemberAccount(item.email);
    }

    // Load batches for course
    if (courseId) {
      const loadedBatches = await loadBatchesForCourse(courseId);
      if (loadedBatches.length > 0 && !item.batch) {
        setAccountForm((prev) => ({ ...prev, batch: loadedBatches[0].b_id }));
      }
    }
  };

  // Submit Create Account
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createAccountItem) return;

    if (!accountForm.name.trim()) {
      toast.error("Please enter student name");
      return;
    }
    if (!accountForm.email.trim()) {
      toast.error("Please enter email address");
      return;
    }
    if (
      !existingAccountCheck.exists &&
      (!accountForm.password || accountForm.password.length < 6)
    ) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!accountForm.batch) {
      toast.error("Please select a batch for this course");
      return;
    }

    setActionBusy(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/create-student-from-request",
        {
          req_id: createAccountItem.req_id,
          name: accountForm.name.trim(),
          email: accountForm.email.trim(),
          number: accountForm.number.trim(),
          gender: accountForm.gender,
          ac_type: accountForm.ac_type || "ELDER",
          qualification: accountForm.qualification,
          course: accountForm.course,
          batch: accountForm.batch,
          password: accountForm.password,
          auto_approve: accountForm.auto_approve,
          reason: accountForm.reason,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message || "Account created successfully!");

        // Update local list
        const updatedMemId = res.data.mem_id || "linked";
        const newStatus = res.data.approved ? "2" : createAccountItem.status;
        const selectedBatch = batches.find(
          (b) =>
            b.b_id === accountForm.batch ||
            String(b.id) === String(accountForm.batch),
        );
        const updatedBatchName = selectedBatch
          ? decodeHtml(selectedBatch.name)
          : "";
        const updatedSdate = selectedBatch?.sdate || createAccountItem.sdate;
        const updatedEdate = selectedBatch?.edate || createAccountItem.edate;

        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === createAccountItem.req_id
              ? {
                  ...b,
                  mem_id: updatedMemId,
                  batch: accountForm.batch,
                  batch_name: updatedBatchName || b.batch_name,
                  course: accountForm.course,
                  ac_type: accountForm.ac_type,
                  sdate: updatedSdate,
                  edate: updatedEdate,
                  status: newStatus,
                  is_public: false,
                }
              : b,
          ),
        );

        if (viewItem && viewItem.req_id === createAccountItem.req_id) {
          setViewItem((v: any) => ({
            ...v,
            mem_id: updatedMemId,
            batch: accountForm.batch,
            batch_name: updatedBatchName || v.batch_name,
            course: accountForm.course,
            ac_type: accountForm.ac_type,
            sdate: updatedSdate,
            edate: updatedEdate,
            status: newStatus,
            is_public: false,
          }));
        }

        setCreateAccountItem(null);
      } else {
        toast.error(res.data.message || "Failed to create student account");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create student account");
    } finally {
      setActionBusy(false);
    }
  };

  // Open Edit Details Modal
  const openEditModal = async (item: any) => {
    const { sdate, edate } = getEffectiveDates(item);
    setEditItem({
      req_id: item.req_id,
      course: item.course || "",
      batch: item.batch || "",
      sdate: String(sdate || ""),
      edate: String(edate || ""),
      ac_type: item.ac_type || "ELDER",
      name: item.name || "",
      email: item.email || "",
    });

    // Course / batch lists are needed by the modal's selects — load them if missing
    if (!courses.length) await loadCourses();
    if (item.course && !(batchesByCourse[item.course] || []).length) {
      await loadBatchesForCourse(item.course);
    }
  };

  // Submit Edit Details
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSavingEdit(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-certificate-request",
        {
          req_id: editItem.req_id,
          course: editItem.course,
          batch: editItem.batch,
          sdate: editItem.sdate,
          edate: editItem.edate,
          ac_type: editItem.ac_type,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message || "Request updated successfully");
        const chosenBatch = batches.find(
          (b) =>
            b.b_id === editItem.batch ||
            String(b.id) === String(editItem.batch),
        );
        const updatedBatchName = chosenBatch
          ? decodeHtml(chosenBatch.name)
          : "";
        const finalSdate = res.data.sdate || editItem.sdate;
        const finalEdate = res.data.edate || editItem.edate;

        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === editItem.req_id
              ? {
                  ...b,
                  course: editItem.course,
                  batch: editItem.batch,
                  batch_name: updatedBatchName || b.batch_name,
                  sdate: finalSdate,
                  edate: finalEdate,
                  ac_type: editItem.ac_type,
                }
              : b,
          ),
        );

        if (viewItem && viewItem.req_id === editItem.req_id) {
          setViewItem((v: any) => ({
            ...v,
            course: editItem.course,
            batch: editItem.batch,
            batch_name: updatedBatchName || v.batch_name,
            sdate: finalSdate,
            edate: finalEdate,
            ac_type: editItem.ac_type,
          }));
        }

        setEditItem(null);
      } else {
        toast.error(res.data.message || "Failed to update request");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update request details");
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Approve Modal
  const openApproveModal = (item: any) => {
    setApproveItem(item);
    setApproveReason(
      item.payment_state === "PAID"
        ? "Payment verified - Course completed"
        : "Course completion verified by admin",
    );
  };

  // Handle Approve Submit
  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveItem) return;

    setActionBusy(true);
    setLoadingId(approveItem.req_id);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/accept-certificate",
        {
          id: approveItem.req_id,
          name: approveItem.name,
          email: approveItem.email,
          batch:
            decodeHtml(approveItem.batch_name) ||
            getBatchNameById(approveItem.batch),
          course:
            decodeHtml(approveItem.course_name) ||
            getCourseNameById(approveItem.course),
          reason: approveReason || "Course completed and approved",
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(
          res.data.message || "Certificate request approved successfully!",
        );
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === approveItem.req_id
              ? { ...b, status: "2", reason: approveReason }
              : b,
          ),
        );
        if (viewItem && viewItem.req_id === approveItem.req_id) {
          setViewItem((v: any) => ({
            ...v,
            status: "2",
            reason: approveReason,
          }));
        }
        setApproveItem(null);
      } else {
        toast.error(res.data.message || "Failed to approve certificate");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve request");
    } finally {
      setActionBusy(false);
      setLoadingId(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (item: any) => {
    setRejectItem(item);
    setRejectReason("");
  };

  // Handle Reject Submit
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectItem) return;

    setActionBusy(true);
    setLoadingId(rejectItem.req_id);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/reject-certificate",
        {
          id: rejectItem.req_id,
          name: rejectItem.name,
          email: rejectItem.email,
          reason: rejectReason || "Requirements not fulfilled",
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message || "Certificate request rejected");
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === rejectItem.req_id
              ? { ...b, status: "0", reason: rejectReason }
              : b,
          ),
        );
        if (viewItem && viewItem.req_id === rejectItem.req_id) {
          setViewItem((v: any) => ({
            ...v,
            status: "0",
            reason: rejectReason,
          }));
        }
        setRejectItem(null);
      } else {
        toast.error(res.data.message || "Failed to reject certificate");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject certificate");
    } finally {
      setActionBusy(false);
      setLoadingId(null);
    }
  };

  // Export to Excel
  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.warning("No data to export");
      return;
    }
    const data = rows.map((u, i) => {
      const { sdate, edate, batch } = getEffectiveDates(u);
      return {
        "S No": i + 1,
        "Request ID": u.req_id,
        Name: u.name,
        Email: u.email,
        Phone: u.number,
        Gender: getGenderText(u.gender),
        "Account Type": acTypeLabel(u.ac_type),
        Type: getTypeName(u.type),
        Course: u.course_name || getCourseNameById(u.course),
        Batch:
          u.batch_name ||
          (batch ? decodeHtml(batch.name) : getBatchNameById(u.batch)),
        "Start Date": formatDate(sdate),
        "End Date": formatDate(edate),
        Duration: calculateDuration(sdate, edate) || "-",
        "Submitted At": formatDate(u.datetime),
        Account: u.mem_id ? `Linked (${u.mem_id})` : "Public / No Account",
        "Payment Status": u.payment_label || u.payment_state || "-",
        Status:
          u.status === "2"
            ? "Approved"
            : u.status === "0"
              ? "Rejected"
              : "Pending",
        "Certificate No": u.cert_no || "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Certificate Requests");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });
    saveAs(blob, "certificate_requests.xlsx");
  };

  // Export to CSV
  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.warning("No data to export");
      return;
    }
    const data = rows.map((u, i) => {
      const { sdate, edate, batch } = getEffectiveDates(u);
      return {
        "S No": i + 1,
        "Request ID": u.req_id,
        Name: u.name,
        Email: u.email,
        Phone: u.number,
        Gender: getGenderText(u.gender),
        "Account Type": acTypeLabel(u.ac_type),
        Type: getTypeName(u.type),
        Course: u.course_name || getCourseNameById(u.course),
        Batch:
          u.batch_name ||
          (batch ? decodeHtml(batch.name) : getBatchNameById(u.batch)),
        "Start Date": formatDate(sdate),
        "End Date": formatDate(edate),
        Duration: calculateDuration(sdate, edate) || "-",
        "Submitted At": formatDate(u.datetime),
        Account: u.mem_id ? `Linked (${u.mem_id})` : "Public / No Account",
        "Payment Status": u.payment_label || u.payment_state || "-",
        Status:
          u.status === "2"
            ? "Approved"
            : u.status === "0"
              ? "Rejected"
              : "Pending",
        "Certificate No": u.cert_no || "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "certificate_requests.csv");
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/certificates"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

  return (
    <div className="content">
      <style>{`
        .cert-actions-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          white-space: nowrap;
        }
        .cert-btn-action {
          width: 32px !important;
          height: 32px !important;
          min-width: 32px !important;
          max-width: 32px !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 7px !important;
          font-size: 13px !important;
          line-height: 1 !important;
          transition: all 0.15s ease-in-out !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          border-width: 1px !important;
          border-style: solid !important;
          cursor: pointer;
          text-decoration: none !important;
        }
        .cert-btn-action:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 6px rgba(0, 0, 0, 0.12) !important;
        }
        .cert-btn-view {
          background: #ffffff !important;
          color: #475569 !important;
          border-color: #cbd5e1 !important;
        }
        .cert-btn-view:hover {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border-color: #94a3b8 !important;
        }
        .cert-btn-account {
          background: #eef2ff !important;
          color: var(--ad-brand-2) !important;
          border-color: #c7d2fe !important;
        }
        .cert-btn-account:hover {
          background: var(--ad-brand-2) !important;
          color: #ffffff !important;
          border-color: var(--ad-brand-2) !important;
        }
        .cert-btn-approve {
          background: #10b981 !important;
          color: #ffffff !important;
          border-color: #059669 !important;
        }
        .cert-btn-approve:hover {
          background: #059669 !important;
          color: #ffffff !important;
          border-color: #047857 !important;
        }
        .cert-btn-reject {
          background: #ffffff !important;
          color: #dc2626 !important;
          border-color: #fca5a5 !important;
        }
        .cert-btn-reject:hover {
          background: #dc2626 !important;
          color: #ffffff !important;
          border-color: #b91c1c !important;
        }
        .cert-btn-verify {
          background: #ecfdf5 !important;
          color: #059669 !important;
          border-color: #a7f3d0 !important;
        }
        .cert-btn-verify:hover {
          background: #059669 !important;
          color: #ffffff !important;
          border-color: #047857 !important;
        }
        .cert-btn-edit {
          background: #eff6ff !important;
          color: #2563eb !important;
          border-color: #bfdbfe !important;
        }
        .cert-btn-edit:hover {
          background: #2563eb !important;
          color: #ffffff !important;
          border-color: #1d4ed8 !important;
        }

        /* Modal Scrollable & Custom Scrollbar */
        .modal-dialog-scrollable .modal-content {
          max-height: calc(100vh - 60px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .modal-dialog-scrollable .modal-content > form {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          overflow: hidden;
          min-height: 0;
        }
        .modal-dialog-scrollable .modal-header,
        .modal-dialog-scrollable .modal-footer {
          flex-shrink: 0;
        }
        .modal-dialog-scrollable .modal-body {
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .modal-dialog-scrollable .modal-body::-webkit-scrollbar {
          width: 6px;
        }
        .modal-dialog-scrollable .modal-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-dialog-scrollable .modal-body::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .modal-dialog-scrollable .modal-body::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div className="container-fluid p-4 batches-page">
        {/* Top Header */}
        <div className="row mb-4">
          <div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h3 className="fw-bold pagehead d-flex align-items-center gap-2 m-0">
                <Award className="text-primary" size={28} />
                Certificate Requests Management
              </h3>
              <p className="text-muted m-0 mt-1 small">
                Manage incoming certificate requests, review applicant details,
                create student accounts, and approve credentials.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="d-flex flex-wrap gap-2">
              <button
                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={copyFormLink}
                title="Copy public form link to send to students"
              >
                <Copy size={15} />
                <span>Copy Public Form Link</span>
              </button>

              <a
                href={FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
              >
                <ExternalLink size={15} />
                <span>Open Form</span>
              </a>

              <button
                className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={() => askExport("excel")}
              >
                <FileSpreadsheet size={15} />
                <span>Export Excel</span>
              </button>

              <button
                className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={() => askExport("csv")}
              >
                <FileText size={15} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top KPI Cards (Interactive Filters) */}
        <div className="row g-3 mb-4">
          {/* Card: Total */}
          <div className="col-12 col-sm-6 col-lg-4 col-xl">
            <div
              className={`card border-0 shadow-sm rounded-3 cursor-pointer transition-all ${
                statusFilter === "all"
                  ? "border-primary border-2 bg-primary-subtle"
                  : "bg-white"
              }`}
              style={{ cursor: "pointer" }}
              onClick={() => setStatusFilter("all")}
            >
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small fw-semibold">
                      Total Requests
                    </span>
                    <h4 className="fw-bold mb-0 mt-1 text-dark">
                      {metrics.total}
                    </h4>
                  </div>
                  <div className="p-2 rounded-3 bg-light text-primary">
                    <Award size={22} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Pending */}
          <div className="col-12 col-sm-6 col-lg-4 col-xl">
            <div
              className={`card border-0 shadow-sm rounded-3 cursor-pointer transition-all ${
                statusFilter === "pending"
                  ? "border-warning border-2 bg-warning-subtle"
                  : "bg-white"
              }`}
              style={{ cursor: "pointer" }}
              onClick={() => setStatusFilter("pending")}
            >
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small fw-semibold">
                      Pending Review
                    </span>
                    <h4 className="fw-bold mb-0 mt-1 text-warning">
                      {metrics.pending}
                    </h4>
                  </div>
                  <div className="p-2 rounded-3 bg-warning-subtle text-warning">
                    <Clock size={22} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Needs Account */}
          <div className="col-12 col-sm-6 col-lg-4 col-xl">
            <div
              className={`card border-0 shadow-sm rounded-3 cursor-pointer transition-all ${
                statusFilter === "no_account"
                  ? "border-info border-2 bg-info-subtle"
                  : "bg-white"
              }`}
              style={{ cursor: "pointer" }}
              onClick={() => setStatusFilter("no_account")}
            >
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small fw-semibold">
                      Needs Account (Public)
                    </span>
                    <h4 className="fw-bold mb-0 mt-1 text-info">
                      {metrics.noAccount}
                    </h4>
                  </div>
                  <div className="p-2 rounded-3 bg-info-subtle text-info">
                    <UserPlus size={22} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Approved */}
          <div className="col-12 col-sm-6 col-lg-4 col-xl">
            <div
              className={`card border-0 shadow-sm rounded-3 cursor-pointer transition-all ${
                statusFilter === "approved"
                  ? "border-success border-2 bg-success-subtle"
                  : "bg-white"
              }`}
              style={{ cursor: "pointer" }}
              onClick={() => setStatusFilter("approved")}
            >
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small fw-semibold">
                      Approved
                    </span>
                    <h4 className="fw-bold mb-0 mt-1 text-success">
                      {metrics.approved}
                    </h4>
                  </div>
                  <div className="p-2 rounded-3 bg-success-subtle text-success">
                    <CheckCircle2 size={22} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Rejected */}
          <div className="col-12 col-sm-6 col-lg-4 col-xl">
            <div
              className={`card border-0 shadow-sm rounded-3 cursor-pointer transition-all ${
                statusFilter === "rejected"
                  ? "border-danger border-2 bg-danger-subtle"
                  : "bg-white"
              }`}
              style={{ cursor: "pointer" }}
              onClick={() => setStatusFilter("rejected")}
            >
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small fw-semibold">
                      Rejected
                    </span>
                    <h4 className="fw-bold mb-0 mt-1 text-danger">
                      {metrics.rejected}
                    </h4>
                  </div>
                  <div className="p-2 rounded-3 bg-danger-subtle text-danger">
                    <XCircle size={22} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="card border-0 shadow-sm rounded-3 mb-4">
          <div className="card-body p-3">
            <div className="row g-3 align-items-center">
              {/* Search input */}
              <div className="col-12 col-md-4">
                <ListSearch
                  placeholder="Search by name, email, phone, cert no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadDetails(1, search, sort, dfrom, dto);
                    }
                  }}
                />
              </div>

              {/* Status Filter Dropdown */}
              <div className="col-6 col-md-2">
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Only</option>
                  <option value="no_account">Needs Student Account</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Type Filter */}
              <div className="col-6 col-md-2">
                <select
                  className="form-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="course">Course Completion</option>
                  <option value="internship">Internship</option>
                  <option value="project">Project</option>
                  <option value="bootcamp">Bootcamp</option>
                </select>
              </div>

              {/* Course Filter */}
              <div className="col-12 col-md-2">
                <select
                  className="form-select"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                >
                  <option value="all">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.req_id} value={c.req_id}>
                      {decodeHtml(c.title)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter & Sort */}
              <div className="col-12 col-md-2 d-flex gap-2">
                <select
                  className="form-select"
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
            </div>

            {/* Date range filter component */}
            <div className="mt-2 pt-2 border-top d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2 small text-muted">
                <Filter size={14} />
                <span>Date Range:</span>
                <DateFilter
                  from={dfrom}
                  to={dto}
                  onApply={(f, t) => loadDetails(1, search, sort, f, t)}
                />
              </div>

              <div
                className="small text-muted"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "5px",
                }}
              >
                Showing <b>{filteredList.length}</b> of <b>{listtotal}</b>{" "}
                requests
                <button
                  data-refresh
                  className="reload-btn"
                  onClick={() => loadDetails(page, search, sort, dfrom, dto)}
                  title="Refresh List"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="card border-0 shadow-sm rounded-3">
          <div className="card-body p-0">
            {loading ? (
              <SkeletonTable cols={6} />
            ) : filteredList.length === 0 ? (
              <div className="text-center p-5">
                <Award size={48} className="text-muted mb-3 opacity-50" />
                <h5 className="fw-bold">No Certificate Requests Found</h5>
                <p className="text-muted small">
                  {search || statusFilter !== "all" || typeFilter !== "all"
                    ? "Try adjusting your search criteria or filters."
                    : "No certificate requests have been submitted yet."}
                </p>
                <div className="d-flex justify-content-center gap-2 mt-3">
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setTypeFilter("all");
                      setCourseFilter("all");
                      loadDetails(1, "", sort, "", "");
                    }}
                  >
                    Reset All Filters
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={copyFormLink}
                  >
                    <Copy size={14} className="me-1" /> Copy Form Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light text-muted small fw-semibold text-uppercase">
                    <tr>
                      <th style={{ width: "60px" }} className="ps-3">
                        #
                      </th>
                      <th>Applicant Details</th>
                      <th>Course & Type</th>
                      <th>Account Status</th>
                      <th>Request Status</th>
                      <th>Submitted</th>
                      <th
                        style={{ width: "160px", minWidth: "160px" }}
                        className="text-end pe-3"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((item, index) => {
                      const hasAccount =
                        item.mem_id && String(item.mem_id).trim() !== "";
                      const isPending = String(item.status) === "1";
                      const isApproved = String(item.status) === "2";
                      const isRejected = String(item.status) === "0";

                      return (
                        <tr
                          key={item.id || item.req_id}
                          className={
                            isApproved
                              ? "table-success-subtle"
                              : isRejected
                                ? "opacity-75"
                                : ""
                          }
                        >
                          {/* S.No */}
                          <td className="ps-3 text-muted small">
                            {(page - 1) * limit + index + 1}
                          </td>

                          {/* Applicant Info */}
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm"
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  fontSize: "14px",
                                  backgroundColor:
                                    item.gender === "2"
                                      ? "#e83e8c"
                                      : item.gender === "1"
                                        ? "#0d6efd"
                                        : "#6c757d",
                                }}
                              >
                                {(item.name || "U").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="fw-bold text-dark">
                                  {item.name}
                                </div>
                                <div className="small text-muted d-flex align-items-center gap-1">
                                  <Mail size={12} />
                                  <a
                                    href={`mailto:${item.email}`}
                                    className="text-muted text-decoration-none"
                                  >
                                    {item.email}
                                  </a>
                                </div>
                                <div className="small text-muted d-flex align-items-center gap-1">
                                  <Phone size={12} />
                                  {item.number &&
                                  String(item.number).replace(/\D/g, "")
                                    .length >= 7 ? (
                                    <a
                                      href={`https://wa.me/${String(item.number).replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-muted text-decoration-none"
                                      title="Message on WhatsApp"
                                    >
                                      {item.number}
                                    </a>
                                  ) : (
                                    <span>{item.number || "-"}</span>
                                  )}
                                </div>
                                <div className="small text-muted d-flex align-items-center gap-1">
                                  <span
                                    className="badge bg-light text-dark border ms-1 py-0 px-1"
                                    style={{ fontSize: "10px" }}
                                  >
                                    {getGenderText(item.gender)}
                                  </span>
                                  <span
                                    className={`badge ${
                                      item.ac_type === "KID"
                                        ? "bg-info text-dark"
                                        : "bg-primary-subtle text-primary"
                                    } border ms-1 py-0 px-1`}
                                    style={{ fontSize: "10px" }}
                                  >
                                    {acTypeLabel(item.ac_type)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Course & Type */}
                          <td>
                            <div className="fw-semibold text-dark">
                              {item.course_name ||
                                getCourseNameById(item.course)}
                            </div>
                            <div className="flex-wrap align-items-center gap-1 mt-1">
                              <span
                                className={`badge ${
                                  (item.type || "").toLowerCase() ===
                                  "internship"
                                    ? "bg-purple text-white"
                                    : (item.type || "").toLowerCase() ===
                                        "project"
                                      ? "bg-warning text-dark"
                                      : "bg-primary-subtle text-primary"
                                } py-1 px-2`}
                                style={{
                                  backgroundColor:
                                    (item.type || "").toLowerCase() ===
                                    "internship"
                                      ? "#6f42c1"
                                      : undefined,
                                }}
                              >
                                {getTypeName(item.type)}
                              </span>
                              {(() => {
                                const { sdate, edate, batch } =
                                  getEffectiveDates(item);
                                const batchTitle =
                                  item.batch_name ||
                                  (batch
                                    ? decodeHtml(batch.name)
                                    : getBatchNameById(item.batch));
                                return (
                                  <>
                                    {batchTitle && batchTitle !== "-" && (
                                      <span className="badge bg-light text-muted border py-1 px-2">
                                        {batchTitle}
                                      </span>
                                    )}
                                    {(sdate || edate) && (
                                      <div
                                        className="small text-muted w-100 mt-1 align-items-center gap-1"
                                        style={{ fontSize: "11px" }}
                                      >
                                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                                          <Calendar
                                            size={11}
                                            className="text-primary flex-shrink-0"
                                          />
                                          <span className="d-flex ">
                                            {formatDate(sdate)} –{" "}
                                            {formatDate(edate)}
                                          </span>
                                        </div>
                                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                                          {calculateDuration(sdate, edate) && (
                                            <span className="text-primary fw-semibold">
                                              ({calculateDuration(sdate, edate)}
                                              )
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>

                          {/* Account Status */}
                          <td>
                            {hasAccount ? (
                              <div>
                                <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 py-1 px-2">
                                  <UserCheck size={12} />
                                  <span>Student Linked</span>
                                </span>
                                <div
                                  className="text-muted mt-1"
                                  style={{
                                    fontSize: "11px",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  ID: {item.mem_id}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="badge bg-warning-subtle text-warning border border-warning-subtle d-inline-flex align-items-center gap-1 py-1 px-2">
                                  <UserX size={12} />
                                  <span>No Account (Public)</span>
                                </span>
                                <div className="mt-1">
                                  {permCan("account") && (
                                    <button
                                      className="btn btn-outline-primary py-0 px-2 small fw-semibold"
                                      style={{ fontSize: "11px" }}
                                      onClick={() =>
                                        openCreateAccountModal(item)
                                      }
                                      title="Create student portal account for applicant"
                                    >
                                      <UserPlus size={11} className="me-1" />
                                      Create Account
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Request Status */}
                          <td>
                            {isApproved ? (
                              <div>
                                <span className="badge bg-success d-inline-flex align-items-center gap-1 py-1 px-2">
                                  <CheckCircle2 size={12} /> Approved
                                </span>
                                {item.cert_no && (
                                  <div className="mt-1">
                                    <a
                                      href={`${SITE_ORIGIN}/certificate-verify?cert=${encodeURIComponent(item.cert_no)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="small text-primary text-decoration-none fw-bold"
                                      style={{ fontSize: "11px" }}
                                      title="Click to verify certificate"
                                    >
                                      {item.cert_no}
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : isRejected ? (
                              <div>
                                <span className="badge bg-danger d-inline-flex align-items-center gap-1 py-1 px-2">
                                  <XCircle size={12} /> Rejected
                                </span>
                                {item.reason && (
                                  <div
                                    className="text-muted mt-1 small"
                                    style={{ fontSize: "11px" }}
                                  >
                                    {item.reason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1 py-1 px-2">
                                <Clock size={12} /> Pending Review
                              </span>
                            )}
                          </td>

                          {/* Submitted */}
                          <td className="small text-muted">
                            <div>{formatDate(item.datetime)}</div>
                          </td>

                          {/* Actions */}
                          <td
                            className="text-end pe-3"
                            style={{ whiteSpace: "nowrap", width: "160px" }}
                          >
                            <div className="cert-actions-wrapper">
                              {/* View Details */}
                              <button
                                type="button"
                                className="cert-btn-action cert-btn-view"
                                onClick={() => setViewItem(item)}
                                title="View Request Details"
                              >
                                <Eye size={15} />
                              </button>

                              {/* Edit Details */}
                              {permCan("edit") && isPending && (
                                <button
                                  type="button"
                                  className="cert-btn-action cert-btn-edit"
                                  onClick={() => openEditModal(item)}
                                  title="Edit Batch & Dates"
                                >
                                  <Edit3 size={15} />
                                </button>
                              )}

                              {/* Create Account & Approve */}
                              {!hasAccount &&
                                isPending &&
                                (permCan("account") ? (
                                  <button
                                    type="button"
                                    className="cert-btn-action cert-btn-account"
                                    onClick={() => openCreateAccountModal(item)}
                                    title="Create Student Account & Approve"
                                  >
                                    <UserPlus size={15} />
                                  </button>
                                ) : null)}

                              {/* Approve Button */}
                              {isPending &&
                                (permCan("approve") ? (
                                  <button
                                    type="button"
                                    className="cert-btn-action cert-btn-approve"
                                    onClick={() => openApproveModal(item)}
                                    title="Approve Certificate Request"
                                    disabled={loadingId === item.req_id}
                                  >
                                    <Check size={16} strokeWidth={2.5} />
                                  </button>
                                ) : null)}

                              {/* Reject Button */}
                              {isPending &&
                                (permCan("approve") ? (
                                  <button
                                    type="button"
                                    className="cert-btn-action cert-btn-reject"
                                    onClick={() => openRejectModal(item)}
                                    title="Reject Certificate Request"
                                    disabled={loadingId === item.req_id}
                                  >
                                    <XCircle size={15} />
                                  </button>
                                ) : null)}

                              {/* Download / View Certificate in PDF (if approved) */}
                              {isApproved && (
                                <a
                                  href={`/panel/certificate/download?m=${encodeURIComponent(item.mem_id || "")}&req_id=${encodeURIComponent(item.req_id)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cert-btn-action cert-btn-verify"
                                  title="Download / View Certificate in PDF"
                                  style={{ color: "#16a34a" }}
                                >
                                  <Download size={15} />
                                </a>
                              )}
                              {isApproved && item.cert_no && (
                                <a
                                  href={`${SITE_ORIGIN}/certificate-verify?cert=${encodeURIComponent(item.cert_no)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cert-btn-action cert-btn-verify"
                                  title="Verify Certificate"
                                >
                                  <ExternalLink size={15} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredList.length > 0 && (
              <Pagination
                page={page}
                total={listtotal}
                limit={limit}
                lastPage={lastPage}
                onPageChange={(p: number) => {
                  setPage(p);
                  loadDetails(p, search, sort, dfrom, dto);
                }}
              />
            )}
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/certificates" />
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL 1: VIEW DETAILS ================= */}
      {viewItem && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-bottom px-4 py-3 bg-light">
                <div className="d-flex align-items-center gap-2">
                  <Award className="text-primary" size={24} />
                  <h5 className="modal-title fw-bold m-0">
                    Certificate Request Details
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setViewItem(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-4">
                  {/* Left Column: Profile Card */}
                  <div className="col-12 col-md-4 text-center border-end pe-md-4">
                    <div
                      className="rounded-circle mx-auto d-flex align-items-center justify-content-center fw-bold text-white mb-3 shadow"
                      style={{
                        width: "80px",
                        height: "80px",
                        fontSize: "32px",
                        backgroundColor:
                          viewItem.gender === "2"
                            ? "#e83e8c"
                            : viewItem.gender === "1"
                              ? "#0d6efd"
                              : "#6c757d",
                      }}
                    >
                      {(viewItem.name || "U").charAt(0).toUpperCase()}
                    </div>
                    <h5 className="fw-bold mb-1">{viewItem.name}</h5>
                    <p className="text-muted small mb-2">{viewItem.email}</p>

                    <div className="mb-3">
                      {String(viewItem.status) === "2" ? (
                        <span className="badge bg-success px-3 py-2">
                          <CheckCircle2 size={14} className="me-1" /> Approved
                        </span>
                      ) : String(viewItem.status) === "0" ? (
                        <span className="badge bg-danger px-3 py-2">
                          <XCircle size={14} className="me-1" /> Rejected
                        </span>
                      ) : (
                        <span className="badge bg-warning text-dark px-3 py-2">
                          <Clock size={14} className="me-1" /> Pending Review
                        </span>
                      )}
                    </div>

                    {/* Account Status Badge */}
                    <div className="p-3 bg-light rounded-3 text-start mb-3">
                      <div className="small fw-bold text-muted text-uppercase mb-1">
                        Account Status
                      </div>
                      {viewItem.mem_id ? (
                        <div>
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            Student Account Linked
                          </span>
                          <div
                            className="small text-muted mt-1"
                            style={{ fontSize: "11px", wordBreak: "break-all" }}
                          >
                            Member ID: <code>{viewItem.mem_id}</code>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="badge bg-warning-subtle text-warning border border-warning-subtle mb-2">
                            No Account (Public Form)
                          </span>
                          {permCan("account") && (
                            <button
                              className="btn btn-primary btn-sm w-100 mt-2 d-flex align-items-center justify-content-center gap-1 shadow-sm"
                              onClick={() => {
                                const itm = viewItem;
                                setViewItem(null);
                                openCreateAccountModal(itm);
                              }}
                            >
                              <UserPlus size={14} />
                              <span>Create Account</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment Gate Status */}
                    <div className="p-3 bg-light rounded-3 text-start">
                      <div className="small fw-bold text-muted text-uppercase mb-1">
                        Payment Status
                      </div>
                      <span
                        className={`badge ${
                          viewItem.payment_state === "PAID"
                            ? "bg-success"
                            : viewItem.payment_state === "FREE"
                              ? "bg-info"
                              : "bg-secondary"
                        }`}
                      >
                        {viewItem.payment_label ||
                          viewItem.payment_state ||
                          "No Payment Record"}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Detailed Info Table */}
                  <div className="col-12 col-md-8 ps-md-4">
                    <h6 className="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                      <BookOpen size={18} /> Training & Completion Details
                    </h6>

                    <table className="table table-sm table-borderless">
                      <tbody>
                        <tr>
                          <th
                            className="text-muted fw-normal"
                            style={{ width: "140px" }}
                          >
                            Request ID:
                          </th>
                          <td className="fw-semibold">
                            <code>{viewItem.req_id}</code>
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted fw-normal">
                            Certificate Type:
                          </th>
                          <td>
                            <span className="badge bg-primary-subtle text-primary">
                              {getTypeName(viewItem.type)}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted fw-normal">Course:</th>
                          <td className="fw-bold text-dark">
                            {viewItem.course_name ||
                              getCourseNameById(viewItem.course)}
                          </td>
                        </tr>
                        {(() => {
                          const {
                            sdate: effSdate,
                            edate: effEdate,
                            batch: foundBatch,
                          } = getEffectiveDates(viewItem);
                          const batchName =
                            viewItem.batch_name ||
                            (foundBatch
                              ? decodeHtml(foundBatch.name)
                              : getBatchNameById(viewItem.batch));
                          const isSdateFromBatch =
                            effSdate &&
                            (!viewItem.sdate || viewItem.sdate === "-");
                          const isEdateFromBatch =
                            effEdate &&
                            (!viewItem.edate || viewItem.edate === "-");
                          return (
                            <>
                              <tr>
                                <th className="text-muted fw-normal">
                                  Account Type:
                                </th>
                                <td>
                                  <span
                                    className={`badge ${
                                      viewItem.ac_type === "KID"
                                        ? "bg-info text-dark"
                                        : "bg-primary-subtle text-primary"
                                    }`}
                                  >
                                    {acTypeLabel(viewItem.ac_type)}
                                  </span>
                                </td>
                              </tr>
                              <tr>
                                <th className="text-muted fw-normal">
                                  Assigned Batch:
                                </th>
                                <td className="fw-semibold">
                                  {batchName && batchName !== "-" ? (
                                    <span>{batchName}</span>
                                  ) : (
                                    <span className="text-muted">
                                      Not Assigned
                                    </span>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <th className="text-muted fw-normal">
                                  Start Date:
                                </th>
                                <td className="fw-semibold text-dark">
                                  {formatDate(effSdate)}
                                  {isSdateFromBatch && (
                                    <span
                                      className="badge bg-light text-muted ms-2 border"
                                      style={{ fontSize: "10px" }}
                                    >
                                      From Batch
                                    </span>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <th className="text-muted fw-normal">
                                  End Date:
                                </th>
                                <td className="fw-semibold text-dark">
                                  {formatDate(effEdate)}
                                  {isEdateFromBatch && (
                                    <span
                                      className="badge bg-light text-muted ms-2 border"
                                      style={{ fontSize: "10px" }}
                                    >
                                      From Batch
                                    </span>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <th className="text-muted fw-normal">
                                  Duration:
                                </th>
                                <td className="fw-semibold text-primary">
                                  {calculateDuration(effSdate, effEdate) || "-"}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                        <tr>
                          <th className="text-muted fw-normal">
                            Phone Number:
                          </th>
                          <td>{viewItem.number || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted fw-normal">Gender:</th>
                          <td>{getGenderText(viewItem.gender)}</td>
                        </tr>
                        <tr>
                          <th className="text-muted fw-normal">
                            Submitted Date:
                          </th>
                          <td>{formatDateTime(viewItem.datetime)}</td>
                        </tr>
                        {viewItem.cert_no && (
                          <tr className="bg-success-subtle rounded-2">
                            <th className="text-success fw-bold">
                              Certificate No:
                            </th>
                            <td>
                              <span className="fw-bold text-success font-monospace">
                                {viewItem.cert_no}
                              </span>
                            </td>
                          </tr>
                        )}
                        {viewItem.issued_at && (
                          <tr>
                            <th className="text-muted fw-normal">Issued On:</th>
                            <td>{formatDateTime(viewItem.issued_at)}</td>
                          </tr>
                        )}
                        {viewItem.reason && (
                          <tr>
                            <th className="text-muted fw-normal">
                              Admin Note:
                            </th>
                            <td className="text-dark fst-italic">
                              "{viewItem.reason}"
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Certificate Download Banner if approved */}
                    {String(viewItem.status) === "2" && (
                      <div className="alert alert-success d-flex align-items-center justify-content-between p-3 rounded-3 mt-3">
                        <div className="d-flex align-items-center gap-2">
                          <ShieldCheck size={20} className="text-success" />
                          <div>
                            <div className="fw-bold">Certificate Approved</div>
                            <div className="small text-muted">
                              Ready for download in official PDF format
                            </div>
                          </div>
                        </div>
                        <a
                          href={`/panel/certificate/download?m=${encodeURIComponent(viewItem.mem_id || "")}&req_id=${encodeURIComponent(viewItem.req_id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-success d-flex align-items-center gap-1 shadow-sm"
                        >
                          <Download size={14} />
                          <span>Download PDF</span>
                        </a>
                      </div>
                    )}

                    {/* Certificate Verification Banner if approved */}
                    {viewItem.cert_no && (
                      <div className="alert alert-info d-flex align-items-center justify-content-between p-3 rounded-3 mt-2">
                        <div className="d-flex align-items-center gap-2">
                          <ShieldCheck size={20} className="text-info" />
                          <div>
                            <div className="fw-bold">
                              Certificate Issued &amp; Verifiable
                            </div>
                            <div className="small text-muted">
                              Credential registered in public registry
                            </div>
                          </div>
                        </div>
                        <a
                          href={`${SITE_ORIGIN}/certificate-verify?cert=${encodeURIComponent(viewItem.cert_no)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-info text-white d-flex align-items-center gap-1"
                        >
                          <ExternalLink size={14} />
                          <span>Verify</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer px-4 py-3 bg-light border-top d-flex justify-content-between">
                <div>
                  {!viewItem.mem_id &&
                    String(viewItem.status) === "1" &&
                    (permCan("account") ? (
                      <button
                        className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                        onClick={() => {
                          const itm = viewItem;
                          setViewItem(null);
                          openCreateAccountModal(itm);
                        }}
                      >
                        <UserPlus size={15} />
                        <span>Create Student Account & Approve</span>
                      </button>
                    ) : null)}
                </div>

                <div className="d-flex gap-2">
                  {String(viewItem.status) === "1" && permCan("edit") && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      onClick={() => {
                        const itm = viewItem;
                        setViewItem(null);
                        openEditModal(itm);
                      }}
                    >
                      <Edit3 size={14} />
                      <span>Edit Batch & Dates</span>
                    </button>
                  )}
                  {String(viewItem.status) === "1" && (
                    <>
                      {permCan("approve") && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => {
                            const itm = viewItem;
                            setViewItem(null);
                            openRejectModal(itm);
                          }}
                        >
                          Reject
                        </button>
                      )}
                      {permCan("approve") && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => {
                            const itm = viewItem;
                            setViewItem(null);
                            openApproveModal(itm);
                          }}
                        >
                          Approve
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: CREATE STUDENT ACCOUNT & APPROVE ================= */}
      {createAccountItem && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-4">
              {permCan("account") && (
                <form onSubmit={handleCreateAccountSubmit}>
                  <div className="modal-header border-bottom px-4 py-3 bg-light">
                    <div className="d-flex align-items-center gap-2">
                      <UserPlus className="text-primary" size={24} />
                      <div>
                        <h5 className="modal-title fw-bold m-0">
                          Create Student Account
                        </h5>
                        <span className="text-muted small">
                          Provision a student portal account and optionally
                          approve their certificate request
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setCreateAccountItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4">
                    {/* Account Exists Notice */}
                    {existingAccountCheck.loading ? (
                      <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                        <div
                          className="spinner-border spinner-border-sm"
                          role="status"
                        ></div>
                        <span>
                          Checking if student account already exists for{" "}
                          {createAccountItem.email}...
                        </span>
                      </div>
                    ) : existingAccountCheck.exists ? (
                      <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                        <AlertCircle
                          size={18}
                          className="text-warning flex-shrink-0"
                        />
                        <div>
                          <b>Account Already Exists!</b> A student account for{" "}
                          <code>{createAccountItem.email}</code> is already
                          registered (Member ID:{" "}
                          <code>{existingAccountCheck.member?.mem_id}</code>).
                          Submitting this will{" "}
                          <b>link this certificate request</b> to the existing
                          account without overwriting their password.
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-primary py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                        <Sparkles
                          size={18}
                          className="text-primary flex-shrink-0"
                        />
                        <div>
                          <b>New Student Account:</b> This will register a new
                          student member in the database, enroll them in the
                          course & batch, and email them portal login
                          credentials.
                        </div>
                      </div>
                    )}

                    <div className="row g-3">
                      {/* Full Name */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Full Name *
                        </label>
                        <div className="input-group">
                          <span className="input-group-text bg-light">
                            <User size={16} className="text-muted" />
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            required
                            value={accountForm.name}
                            onChange={(e) =>
                              setAccountForm({
                                ...accountForm,
                                name: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Email Address *
                        </label>
                        <div className="input-group">
                          <span className="input-group-text bg-light">
                            <Mail size={16} className="text-muted" />
                          </span>
                          <input
                            type="email"
                            className="form-control"
                            required
                            value={accountForm.email}
                            onChange={(e) => {
                              setAccountForm({
                                ...accountForm,
                                email: e.target.value,
                              });
                              checkMemberAccount(e.target.value);
                            }}
                          />
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Phone Number
                        </label>
                        <div className="input-group">
                          <span className="input-group-text bg-light">
                            <Phone size={16} className="text-muted" />
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            value={accountForm.number}
                            onChange={(e) =>
                              setAccountForm({
                                ...accountForm,
                                number: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Gender */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Gender
                        </label>
                        <select
                          className="form-select"
                          value={accountForm.gender}
                          onChange={(e) =>
                            setAccountForm({
                              ...accountForm,
                              gender: e.target.value,
                            })
                          }
                        >
                          <option value="1">Male</option>
                          <option value="2">Female</option>
                          <option value="3">Other</option>
                        </select>
                      </div>

                      {/* Account Type */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Account Type *
                        </label>
                        <select
                          className="form-select"
                          value={accountForm.ac_type || "ELDER"}
                          onChange={(e) =>
                            setAccountForm({
                              ...accountForm,
                              ac_type: e.target.value,
                            })
                          }
                        >
                          <option value="ELDER">ADULT (Professional)</option>
                          <option value="KID">KID (Student / Minor)</option>
                        </select>
                      </div>

                      {/* Course */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Course *
                        </label>
                        <select
                          className="form-select"
                          required
                          value={accountForm.course}
                          onChange={async (e) => {
                            const newCourse = e.target.value;
                            setAccountForm({
                              ...accountForm,
                              course: newCourse,
                              batch: "",
                            });
                            const bList = await loadBatchesForCourse(newCourse);
                            if (bList.length > 0) {
                              setAccountForm((prev) => ({
                                ...prev,
                                course: newCourse,
                                batch: bList[0].b_id,
                              }));
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

                      {/* Batch */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Assigned Batch *
                        </label>
                        <select
                          className="form-select"
                          required
                          value={accountForm.batch}
                          onChange={(e) =>
                            setAccountForm({
                              ...accountForm,
                              batch: e.target.value,
                            })
                          }
                        >
                          <option value="">Select Batch</option>
                          {(batchesByCourse[accountForm.course] || batches).map(
                            (b) => (
                              <option key={b.b_id} value={b.b_id}>
                                {decodeHtml(b.name)}
                              </option>
                            ),
                          )}
                        </select>
                        {(() => {
                          const selectedBatch = (
                            batchesByCourse[accountForm.course] || batches
                          ).find(
                            (b) =>
                              b.b_id === accountForm.batch ||
                              String(b.id) === String(accountForm.batch),
                          );
                          if (
                            selectedBatch &&
                            (selectedBatch.sdate || selectedBatch.edate)
                          ) {
                            return (
                              <div className="mt-1 small p-2 bg-light rounded border text-muted">
                                <b>Batch Schedule:</b>{" "}
                                {formatDate(selectedBatch.sdate)} to{" "}
                                {formatDate(selectedBatch.edate)}
                                {calculateDuration(
                                  selectedBatch.sdate,
                                  selectedBatch.edate,
                                ) && (
                                  <span className="text-primary fw-semibold ms-1">
                                    (
                                    {calculateDuration(
                                      selectedBatch.sdate,
                                      selectedBatch.edate,
                                    )}
                                    )
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Portal Password */}
                      {!existingAccountCheck.exists && (
                        <div className="col-12">
                          <label className="form-label small fw-bold">
                            Student Portal Password *
                          </label>
                          <div className="input-group">
                            <span className="input-group-text bg-light">
                              <Key size={16} className="text-muted" />
                            </span>
                            <input
                              type={showPassword ? "text" : "password"}
                              className="form-control font-monospace"
                              required
                              value={accountForm.password}
                              onChange={(e) =>
                                setAccountForm({
                                  ...accountForm,
                                  password: e.target.value,
                                })
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => {
                                const newPwd = generatePassword();
                                setAccountForm({
                                  ...accountForm,
                                  password: newPwd,
                                });
                                toast.info("Generated new strong password");
                              }}
                              title="Generate new password"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={async () => {
                                await navigator.clipboard.writeText(
                                  accountForm.password,
                                );
                                toast.success("Password copied!");
                              }}
                              title="Copy Password"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <div className="form-text small">
                            This password will be emailed to the student with
                            their portal login URL.
                          </div>
                        </div>
                      )}

                      {/* Auto-Approve Checkbox */}
                      <div className="col-12 mt-4 pt-3 border-top">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="autoApproveSwitch"
                            checked={accountForm.auto_approve}
                            onChange={(e) =>
                              setAccountForm({
                                ...accountForm,
                                auto_approve: e.target.checked,
                              })
                            }
                          />
                          <label
                            className="form-check-label fw-bold"
                            htmlFor="autoApproveSwitch"
                          >
                            Accept / Approve Certificate Request immediately
                            after creating account
                          </label>
                        </div>
                        <div className="form-text small ms-4">
                          When enabled, the certificate number will be generated
                          and issued right now, and the student will receive
                          their certificate access email.
                        </div>
                      </div>

                      {/* Approval Reason (if auto-approve enabled) */}
                      {accountForm.auto_approve && (
                        <div className="col-12 ms-4 pe-4">
                          <label className="form-label small fw-semibold text-muted">
                            Approval Note / Reason
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={accountForm.reason}
                            onChange={(e) =>
                              setAccountForm({
                                ...accountForm,
                                reason: e.target.value,
                              })
                            }
                            placeholder="e.g. Student account verified and certificate issued"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer px-4 py-3 bg-light border-top">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setCreateAccountItem(null)}
                      disabled={actionBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm"
                      disabled={actionBusy}
                    >
                      {actionBusy ? (
                        <>
                          <div
                            className="spinner-border spinner-border-sm"
                            role="status"
                          ></div>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} />
                          <span>
                            {accountForm.auto_approve
                              ? "Create Account & Approve Request"
                              : "Create Student Account"}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: APPROVE REQUEST ================= */}
      {approveItem && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-4">
              {permCan("approve") && (
                <form onSubmit={handleApproveSubmit}>
                  <div className="modal-header border-bottom px-4 py-3 bg-light">
                    <div className="d-flex align-items-center gap-2">
                      <CheckCircle2 className="text-success" size={24} />
                      <h5 className="modal-title fw-bold m-0">
                        Approve Certificate Request
                      </h5>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setApproveItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4">
                    <p>
                      Are you sure you want to approve the certificate request
                      for <b>{approveItem.name}</b>?
                    </p>

                    <div className="p-3 bg-light rounded-3 mb-3 small">
                      <div>
                        <b>Applicant:</b> {approveItem.name} (
                        {approveItem.email})
                      </div>
                      <div>
                        <b>Account Type:</b>{" "}
                        <span
                          className={`badge ${
                            approveItem.ac_type === "KID"
                              ? "bg-info text-dark"
                              : "bg-primary-subtle text-primary"
                          }`}
                        >
                          {acTypeLabel(approveItem.ac_type)}
                        </span>
                      </div>
                      <div>
                        <b>Course:</b>{" "}
                        {approveItem.course_name ||
                          getCourseNameById(approveItem.course)}
                      </div>
                      <div>
                        <b>Assigned Batch:</b>{" "}
                        {approveItem.batch_name ||
                          getBatchNameById(approveItem.batch)}
                      </div>
                      {(() => {
                        const { sdate, edate } = getEffectiveDates(approveItem);
                        if (sdate || edate) {
                          return (
                            <div>
                              <b>Batch Dates:</b> {formatDate(sdate)} –{" "}
                              {formatDate(edate)}{" "}
                              {calculateDuration(sdate, edate) && (
                                <span className="text-primary fw-semibold">
                                  ({calculateDuration(sdate, edate)})
                                </span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div>
                        <b>Type:</b> {getTypeName(approveItem.type)}
                      </div>
                      <div className="mt-1">
                        <b>Payment Gate:</b>{" "}
                        <span className="badge bg-secondary">
                          {approveItem.payment_label ||
                            approveItem.payment_state ||
                            "No Record"}
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">
                        Approval Reason / Audit Note
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={approveReason}
                        onChange={(e) => setApproveReason(e.target.value)}
                        placeholder="e.g. Coursework verified and completed"
                      />
                      <div className="form-text small">
                        This note will be recorded in the admin audit log.
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer px-4 py-3 bg-light border-top">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setApproveItem(null)}
                      disabled={actionBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                      disabled={actionBusy}
                    >
                      {actionBusy ? (
                        <>
                          <div
                            className="spinner-border spinner-border-sm"
                            role="status"
                          ></div>
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Confirm Approval</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: REJECT REQUEST ================= */}
      {rejectItem && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-4">
              {permCan("approve") && (
                <form onSubmit={handleRejectSubmit}>
                  <div className="modal-header border-bottom px-4 py-3 bg-light">
                    <div className="d-flex align-items-center gap-2">
                      <XCircle className="text-danger" size={24} />
                      <h5 className="modal-title fw-bold m-0">
                        Reject Certificate Request
                      </h5>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setRejectItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4">
                    <p>
                      Are you sure you want to reject the certificate request
                      for <b>{rejectItem.name}</b>?
                    </p>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">
                        Rejection Reason *
                      </label>
                      <textarea
                        className="form-control"
                        rows={3}
                        required
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Please enter the reason for rejection (this will be emailed to the applicant)..."
                      ></textarea>
                      <div className="form-text small">
                        An email will be sent notifying the student of this
                        decision.
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer px-4 py-3 bg-light border-top">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setRejectItem(null)}
                      disabled={actionBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm"
                      disabled={actionBusy}
                    >
                      {actionBusy ? (
                        <>
                          <div
                            className="spinner-border spinner-border-sm"
                            role="status"
                          ></div>
                          <span>Rejecting...</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} />
                          <span>Confirm Rejection</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: EDIT REQUEST DETAILS ================= */}
      {editItem && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-4">
              {permCan("edit") && (
                <form onSubmit={handleEditSubmit}>
                  <div className="modal-header border-bottom px-4 py-3 bg-light">
                    <div className="d-flex align-items-center gap-2">
                      <Edit3 className="text-primary" size={24} />
                      <div>
                        <h5 className="modal-title fw-bold m-0">
                          Edit Request Details
                        </h5>
                        <span className="text-muted small">
                          Update course, assigned batch, schedule dates, and
                          account type
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setEditItem(null)}
                    ></button>
                  </div>

                  <div className="modal-body p-4">
                    {/* Applicant Details Banner */}
                    <div className="alert alert-light border py-2 px-3 small d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                      <div>
                        <b>Applicant:</b>{" "}
                        <span className="fw-semibold">{editItem.name}</span>{" "}
                        <span className="text-muted">({editItem.email})</span>
                      </div>
                      <div>
                        <b>Request ID:</b>{" "}
                        <code className="text-muted">{editItem.req_id}</code>
                      </div>
                    </div>

                    <div className="row g-3">
                      {/* Account Type */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Account Type
                        </label>
                        <select
                          className="form-select"
                          value={editItem.ac_type || "ELDER"}
                          onChange={(e) =>
                            setEditItem({
                              ...editItem,
                              ac_type: e.target.value,
                            })
                          }
                        >
                          <option value="ELDER">ADULT (Professional)</option>
                          <option value="KID">KID (Student / Junior)</option>
                        </select>
                        <div className="form-text small">
                          Designates whether the certificate is issued to an
                          Adult or a Kid student.
                        </div>
                      </div>

                      {/* Course */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Course *
                        </label>
                        <select
                          className="form-select"
                          required
                          value={editItem.course}
                          onChange={(e) => {
                            const newCourse = e.target.value;
                            setEditItem({
                              ...editItem,
                              course: newCourse,
                            });
                            if (!batchesByCourse[newCourse]) {
                              loadBatchesForCourse(newCourse);
                            }
                          }}
                        >
                          <option value="">Select Course...</option>
                          {courses.map((c) => (
                            <option key={c.req_id} value={c.req_id}>
                              {decodeHtml(c.title)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Assigned Batch */}
                      <div className="col-12">
                        <label className="form-label small fw-bold">
                          Assigned Batch
                        </label>
                        <select
                          className="form-select"
                          value={editItem.batch}
                          onChange={(e) => {
                            const newBatchVal = e.target.value;
                            const availableBatches =
                              batchesByCourse[editItem.course] || batches;
                            const foundBatch = availableBatches.find(
                              (b) =>
                                b.b_id === newBatchVal ||
                                String(b.id) === String(newBatchVal),
                            );
                            setEditItem({
                              ...editItem,
                              batch: newBatchVal,
                              sdate: foundBatch?.sdate
                                ? String(foundBatch.sdate)
                                : editItem.sdate,
                              edate: foundBatch?.edate
                                ? String(foundBatch.edate)
                                : editItem.edate,
                            });
                          }}
                        >
                          <option value="">-- No Specific Batch --</option>
                          {(batchesByCourse[editItem.course] || batches).map(
                            (b) => (
                              <option
                                key={b.b_id || b.id}
                                value={b.b_id || b.id}
                              >
                                {decodeHtml(b.name)}
                              </option>
                            ),
                          )}
                        </select>
                        <div className="form-text small">
                          Selecting a batch will automatically pre-populate the
                          start and end dates below.
                        </div>
                      </div>

                      {/* Start Date */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          Start Date
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={epochToDateInput(editItem.sdate)}
                          onChange={(e) =>
                            setEditItem({
                              ...editItem,
                              sdate: dateInputToEpoch(e.target.value),
                            })
                          }
                        />
                        {editItem.sdate && editItem.sdate !== "-" && (
                          <div className="form-text small text-muted">
                            Formatted: <b>{formatDate(editItem.sdate)}</b>
                          </div>
                        )}
                      </div>

                      {/* End Date */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold">
                          End Date
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={epochToDateInput(editItem.edate)}
                          onChange={(e) =>
                            setEditItem({
                              ...editItem,
                              edate: dateInputToEpoch(e.target.value),
                            })
                          }
                        />
                        {editItem.edate && editItem.edate !== "-" && (
                          <div className="form-text small text-muted">
                            Formatted: <b>{formatDate(editItem.edate)}</b>
                          </div>
                        )}
                      </div>

                      {/* Duration Preview */}
                      {calculateDuration(editItem.sdate, editItem.edate) && (
                        <div className="col-12">
                          <div className="p-2 bg-light rounded border small d-flex align-items-center gap-2">
                            <Calendar
                              size={14}
                              className="text-primary flex-shrink-0"
                            />
                            <span>Calculated Duration:</span>
                            <span className="badge bg-primary-subtle text-primary fw-bold">
                              {calculateDuration(
                                editItem.sdate,
                                editItem.edate,
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer px-4 py-3 bg-light border-top">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditItem(null)}
                      disabled={savingEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm"
                      disabled={savingEdit}
                    >
                      {savingEdit ? (
                        <>
                          <div
                            className="spinner-border spinner-border-sm"
                            role="status"
                          ></div>
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Pagination Component ================= */
function Pagination({
  page,
  total,
  limit,
  lastPage,
  onPageChange,
}: {
  page: number;
  total: number;
  limit: number;
  lastPage: number;
  onPageChange: (p: number) => void;
}) {
  if (total === 0 || lastPage <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  let pagstart = 1;
  let pagend = 10;

  if (page >= 6) {
    pagstart = page - 3;
    pagend = page + 7;
  }

  if (pagend >= lastPage) {
    pagstart = Math.max(1, lastPage - 9);
    pagend = lastPage + 1;
  }

  const pages = [];
  for (let i = pagstart; i < pagend && i <= lastPage; i++) {
    pages.push(i);
  }

  return (
    <div
      data-pagination
      className="p-3 border-top d-flex flex-wrap align-items-center justify-content-between gap-3 bg-light rounded-bottom-3"
    >
      <div className="small text-muted">
        Showing <b>{start}</b> to <b>{end}</b> of <b>{total}</b> requests
      </div>

      <div className="d-flex align-items-center gap-1">
        {page > 1 && (
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
        )}

        {pages.map((p) => (
          <button
            key={p}
            className={`btn btn-sm ${p === page ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}

        {page < lastPage && (
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
