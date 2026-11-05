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

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  CreditCard,
  CheckCircle,
  Clock,
  RotateCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowLeft,
  DollarSign,
  XCircle,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, Skeleton, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("subscriptions");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const initialForm = {
    id: "",
    sname: "",
    semail: "",
    sphone: "",
    course_name: "",
    batch_name: "",
    pay_intent: "",
    currency: "",
    fees: "",
    datetime: "",
    status: "",
  };

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("board");
  const [model, setModel] = useState("");

  // Manual add / edit subscription flow
  const emptyAdd = {
    req_id: "",
    mem_id: "",
    sname: "",
    semail: "",
    sphone: "",
    crs_id: "",
    currency: "USD",
    fees: "",
    status: "2",
    paydate: "",
    pay_id: "",
    pay_intent: "",
  };
  const [addForm, setAddForm] = useState(emptyAdd);
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<"search" | "form">("search");
  const [busy, setBusy] = useState(false);

  // student picker
  const [stuQuery, setStuQuery] = useState("");
  const [stuResults, setStuResults] = useState<any[]>([]);
  const [stuLoading, setStuLoading] = useState(false);
  const [selStu, setSelStu] = useState<any>(null);

  // course list for crs_id
  const [subCourses, setSubCourses] = useState<any[]>([]);

  const toDatetimeLocal = (ts: any) => {
    const n = Number(ts);
    if (!n) return "";
    const d = new Date(n * 1000);
    const pad = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const loadSubCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {
          status: "1",
        });
      if (res.data.success) setSubCourses(res.data.data);
    } catch {
      /* leave empty */
    }
  };

  const openAdd = () => {
    setAddForm(emptyAdd);
    setSelStu(null);
    setStuQuery("");
    setStuResults([]);
    setAddStep("search");
    setAddOpen(true);
    if (!subCourses.length) loadSubCourses();
  };

  const openEdit = (list: any) => {
    setSelStu({
      mem_id: list.mem_id,
      name: list.sname,
      email: list.semail,
      number: list.sphone,
    });
    setAddForm({
      req_id: list.req_id || "",
      mem_id: list.mem_id || "",
      sname: list.sname || "",
      semail: list.semail || "",
      sphone: list.sphone || "",
      crs_id: list.crs_id || "",
      currency: list.currency || "USD",
      fees: String(list.fees ?? ""),
      status: String(list.status ?? "2"),
      paydate: list.datetime ? toDatetimeLocal(list.datetime) : "",
      pay_id: list.pay_id || "",
      pay_intent: list.pay_intent || "",
    });
    setAddStep("form");
    setAddOpen(true);
    if (!subCourses.length) loadSubCourses();
  };

  const searchStudents = async () => {
    if (stuQuery.trim().length < 2) {
      toast.error("Type at least 2 characters");
      return;
    }
    setStuLoading(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/students/search",
        {
          q: stuQuery.trim(),
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) setStuResults(res.data.data);
      else toast.error(res.data.message);
    } catch {
      toast.error("Search failed");
    } finally {
      setStuLoading(false);
    }
  };

  const continueToForm = () => {
    if (!selStu) {
      toast.error("Select a student first");
      return;
    }
    setAddForm({
      ...emptyAdd,
      mem_id: selStu.mem_id,
      sname: selStu.name,
      semail: selStu.email,
      sphone: selStu.number,
      crs_id: selStu.crs_id || "",
    });
    setAddStep("form");
  };

  const saveSub = async () => {
    if (!addForm.mem_id) {
      toast.error("No student selected");
      return;
    }
    setBusy(true);
    try {
      const security = await getSecurity();
      const path = addForm.req_id
        ? "api/subscriptions/update"
        : "api/subscriptions/add";
      const res = await axios.post(
        SERVER_URL + path,
        {
          ...addForm,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAddOpen(false);
        loadDetails(page, search, sort, dfrom, dto);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    pending: 0,
    failed: 0,
    success: 0,
    total: 0,
    revenue: "$0",
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [status, setStatus] = useState("");
  const [listTotal, setListTotal] = useState(0);
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);

  const formatDate = (ts: any) => {
    if (!ts) return "";
    const date = new Date(ts * 1000);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const location = useLocation();
  const navigate = useNavigate();

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    df = "",
    dt = "",
    st = status,
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);
    setStatus(st);

    try {
      const res = await listFetch("api/subscriptions", {
          q: targetSearch,
          s: targetSort,
          n: targetPage,
          df: dayStartEpoch(df),
          dt: dayEndEpoch(dt),
          st,
        });

      if (res.data.success) {
        setAllLists(res.data.data);
        if (res.data.stats) setStats(res.data.stats);
        setLastPage(res.data.lastPage);
        setListTotal(Number(res.data.listTotal ?? res.data.stats?.total) || 0);
      } else {
        setAllLists([]);
        if (res.data.stats) setStats(res.data.stats);
        if (typeof res.data.lastPage === "number")
          setLastPage(res.data.lastPage);
        setListTotal(Number(res.data.listTotal) || 0);
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const fbmemberList = (user: any) => {
    setForm({
      ...initialForm,
      id: user.id || "",
      sname: user.sname || "",
      semail: user.semail || "",
      sphone: user.sphone || "",
      course_name: user.course_name || "",
      batch_name: user.batch_name || "",
      pay_intent: user.pay_intent || "",
      currency: user.currency || "",
      fees: user.fees || "",
      datetime: user.datetime || "",
      status: user.status || "",
    });
  };

  const moveto = (id: any) => {
    setMode(id);
    if (id === "board" && status) loadDetails(1, search, sort, dfrom, dto, "");
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "0":
        return "Failed";
      case "1":
        return "Pending";
      case "2":
        return "Success";
      default:
        return "Unknown";
    }
  };

  const chartData = [
    { name: "Pending", value: Number(stats?.pending) || 0 },
    { name: "Failed", value: Number(stats?.failed) || 0 },
    { name: "Success", value: Number(stats?.success) || 0 },
  ];

  const COLORS = ["#f59e0b", "#ef4444", "#10b981"];

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && (ustatus === "X" || ustatus === "Y")) {
      const st0 = new URLSearchParams(window.location.search).get("st") || "";
      const okSt = ["0", "1", "2", "1D"].includes(st0);
      if (okSt) setMode("boardlist");
      loadDetails(1, "", "New", "", "", okSt ? st0 : "");
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

  const getInitials = (name: string) => {
    if (!name) return "SB";
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

  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.warn("No data to export");
      return;
    }
    const data = rows.map((u, i) => ({
      "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
      "Student Name": u.sname,
      "Student Email": u.semail,
      "Student Phone": u.sphone,
      Course: decodeHtml(u.course_name),
      Fees: `${u.currency || "USD"} ${u.fees || ""}`,
      "Payment Date": formatDate(u.datetime),
      Status: getStatus(u.status),
      Type: u.type === "1" ? "Manual" : "Auto",
      "Pay ID": u.pay_id || u.pay_intent || "-",
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subscriptions");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      "subscriptions.xlsx",
    );
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      toast.warn("No data to export");
      return;
    }
    const data = rows.map((u, i) => ({
      "S No": (rows === alllists ? (page - 1) * limit : 0) + i + 1,
      "Student Name": u.sname,
      "Student Email": u.semail,
      "Student Phone": u.sphone,
      Course: decodeHtml(u.course_name),
      Fees: `${u.currency || "USD"} ${u.fees || ""}`,
      "Payment Date": formatDate(u.datetime),
      Status: getStatus(u.status),
      Type: u.type === "1" ? "Manual" : "Auto",
      "Pay ID": u.pay_id || u.pay_intent || "-",
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "subscriptions.csv",
    );
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listTotal,
      fetchAll: () => fetchAllRows("api/subscriptions"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

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
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .si-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
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
          gap: 10px;
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
        .si-btn-primary {
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
          text-decoration: none;
        }
        .si-btn-primary:hover {
          background: #4b24d6;
          color: #ffffff;
        }
        .si-btn-outline {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          color: #475569;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .si-btn-outline:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
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
          background: #ffffff;
          border: 1.5px solid #0284c7;
          color: #0284c7;
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
          background: #f0f9ff;
          border-color: #0369a1;
          color: #0369a1;
        }

        /* Stats Grid */
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
        .si-stat-card.card-pending.active {
          box-shadow: 0 0 0 2px #d97706, 0 6px 16px rgba(217, 119, 6, 0.15);
          border-color: #d97706;
        }
        .si-stat-card.card-revenue.active,
        .si-stat-card.card-success.active {
          box-shadow: 0 0 0 2px #16a34a, 0 6px 16px rgba(22, 163, 74, 0.15);
          border-color: #16a34a;
        }
        .si-stat-card.card-failed.active {
          box-shadow: 0 0 0 2px #dc2626, 0 6px 16px rgba(220, 38, 38, 0.15);
          border-color: #dc2626;
        }
        .si-stat-card.card-pending {
          background: #fffbeb;
        }
        .si-stat-card.card-revenue {
          background: #f0fdf4;
        }
        .si-stat-card.card-success {
          background: #ecfdf5;
        }
        .si-stat-card.card-failed {
          background: #fef2f2;
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
          font-size: 24px;
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
          border: 1px solid #edf2f6;
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
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .si-th {
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          text-align: left;
          white-space: nowrap;
        }
        .si-tbody .si-tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.15s ease;
        }
        .si-tbody .si-tr:hover {
          background-color: #fbfcfe;
        }
        .si-td {
          padding: 14px 16px;
          font-size: 13.5px;
          color: #1e293b;
          vertical-align: middle;
        }
        .si-avatar-badge {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .si-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-user-name {
          font-weight: 600;
          color: #0f172a;
          font-size: 13.5px;
          cursor: pointer;
        }
        .si-user-name:hover {
          color: var(--ad-brand);
        }
        .si-user-sub {
          font-size: 12px;
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
        .si-status-pill.status-success {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-pill.status-pending {
          background: #fef3c7;
          color: #b45309;
        }
        .si-status-pill.status-failed {
          background: #fee2e2;
          color: #b91c1c;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-success .si-status-dot { background: #16a34a; }
        .status-pending .si-status-dot { background: #d97706; }
        .status-failed .si-status-dot { background: #dc2626; }

        .si-type-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .si-type-pill.type-manual {
          background: #e0f2fe;
          color: #0369a1;
        }
        .si-type-pill.type-auto {
          background: #f1f5f9;
          color: #475569;
        }

        .si-actions-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .si-action-btn {
          width: 34px;
          height: 34px;
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
        .si-action-btn.btn-edit {
          background: #e0f2fe;
          color: #0284c7;
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
        .si-empty-box {
          text-align: center;
          padding: 60px 20px;
        }
        .si-empty-icon {
          color: #94a3b8;
          margin-bottom: 12px;
        }

        /* Dashboard Overview Grid */
        .si-dash-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }
        @media (max-width: 1024px) {
          .si-dash-grid {
            grid-template-columns: 1fr;
          }
        }
        .si-chart-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          padding: 22px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
      `}</style>

      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* ===================== BOARD MODE (Overview) ===================== */}
          {mode === "board" && (
            <div>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">Subscriptions Dashboard</h3>
                    <p className="si-header-subtitle">
                      Real-time payment analytics, status breakdowns and recent
                      activity
                    </p>
                  </div>
                </div>

                <div className="si-header-right">
                  <span className="si-total-count-text">
                    Total <b>{stats?.total || 0}</b>
                  </span>

                  {permCan("create") && (
                    <button className="si-btn-primary" onClick={openAdd}>
                      <Plus size={16} /> Add Subscription
                    </button>
                  )}

                  <button
                    className="si-btn-outline"
                    onClick={() => moveto("boardlist")}
                  >
                    View All Subscriptions →
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="si-stats-grid">
                <div
                  className="si-stat-card card-pending"
                  onClick={() => {
                    setStatus("1");
                    setMode("boardlist");
                    loadDetails(1, "", "New", "", "", "1");
                  }}
                  title="Click to view pending payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#fef3c7", color: "#d97706" }}
                  >
                    <Clock size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Pending Payments</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.pending || 0} pending={loading} id="Subscriptions-s1" /></h3>
                  </div>
                </div>

                <div
                  className="si-stat-card card-revenue"
                  onClick={() => {
                    setStatus("2");
                    setMode("boardlist");
                    loadDetails(1, "", "New", "", "", "2");
                  }}
                  title="Click to view successful revenue payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#dcfce7", color: "#16a34a" }}
                  >
                    <DollarSign size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Total Revenue</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.revenue || "$0"} pending={loading} id="Subscriptions-s2" /></h3>
                  </div>
                </div>

                <div
                  className="si-stat-card card-success"
                  onClick={() => {
                    setStatus("2");
                    setMode("boardlist");
                    loadDetails(1, "", "New", "", "", "2");
                  }}
                  title="Click to view successful payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#d1fae5", color: "#059669" }}
                  >
                    <CheckCircle size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Successful Payments</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.success || 0} pending={loading} id="Subscriptions-s3" /></h3>
                  </div>
                </div>

                <div
                  className="si-stat-card card-failed"
                  onClick={() => {
                    setStatus("0");
                    setMode("boardlist");
                    loadDetails(1, "", "New", "", "", "0");
                  }}
                  title="Click to view failed payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#fee2e2", color: "#dc2626" }}
                  >
                    <XCircle size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Failed Payments</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.failed || 0} pending={loading} id="Subscriptions-s4" /></h3>
                  </div>
                </div>
              </div>

              {/* Dashboard 2-column: Recent Table + Chart */}
              <div className="si-dash-grid">
                {/* Recent subscriptions */}
                <div className="si-table-card" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid #f1f5f9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h5
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      Recent Subscriptions
                    </h5>
                    <button
                      className="btn btn-sm btn-link"
                      style={{
                        color: "var(--ad-brand)",
                        textDecoration: "none",
                        fontWeight: 600,
                        padding: 0,
                      }}
                      onClick={() => moveto("boardlist")}
                    >
                      View All →
                    </button>
                  </div>
                  <div className="si-table-responsive">
                    <table className="si-table">
                      <thead className="si-thead">
                        <tr>
                          <th className="si-th" style={{ width: 50 }}>
                            #
                          </th>
                          <th className="si-th">Student</th>
                          <th className="si-th">Course</th>
                          <th className="si-th">Amount</th>
                          <th className="si-th">Status</th>
                        </tr>
                      </thead>
                      <tbody className="si-tbody">
                        {loading ? (
                          <SkeletonRows />
                        ) : (
                          alllists.slice(0, 7).map((list, index) => {
                            const st = getStatus(list.status);
                            return (
                              <tr key={list.id || index} className="si-tr">
                                <td
                                  className="si-td"
                                  style={{ color: "#64748b", fontWeight: 600 }}
                                >
                                  {index + 1}
                                </td>
                                <td className="si-td">
                                  <span
                                    className="si-user-name"
                                    onClick={() => {
                                      fbmemberList(list);
                                      setModel("view");
                                    }}
                                  >
                                    {list.sname || "—"}
                                  </span>
                                  <div
                                    style={{ fontSize: 11.5, color: "#64748b" }}
                                  >
                                    {list.semail || ""}
                                  </div>
                                </td>
                                <td
                                  className="si-td"
                                  style={{
                                    maxWidth: 180,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {decodeHtml(list.course_name) || "—"}
                                </td>
                                <td
                                  className="si-td"
                                  style={{ fontWeight: 600, color: "#0f172a" }}
                                >
                                  {list.currency || "USD"} {list.fees || "0"}
                                </td>
                                <td className="si-td">
                                  <span
                                    className={`si-status-pill ${
                                      st === "Success"
                                        ? "status-success"
                                        : st === "Pending"
                                          ? "status-pending"
                                          : "status-failed"
                                    }`}
                                  >
                                    <span className="si-status-dot" /> {st}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Status Breakdown Chart */}
                <div className="si-chart-card">
                  <h5
                    style={{
                      margin: "0 0 16px 0",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Status Distribution
                  </h5>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        background: "#fffbeb",
                        padding: "8px 4px",
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#d97706",
                        }}
                      >
                        PENDING
                      </div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        {stats?.pending || 0}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#fef2f2",
                        padding: "8px 4px",
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#dc2626",
                        }}
                      >
                        FAILED
                      </div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        {stats?.failed || 0}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#ecfdf5",
                        padding: "8px 4px",
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#059669",
                        }}
                      >
                        SUCCESS
                      </div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        {stats?.success || 0}
                      </div>
                    </div>
                  </div>

                  {loading ? (
                    <div style={{ height: 230, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Skeleton w={170} h={170} r="50%" />
                    </div>
                  ) : (
                    <div style={{ height: 230 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={5}
                          >
                            {chartData.map((_, index) => (
                              <Cell
                                key={index}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== BOARDLIST MODE (Full Table) ===================== */}
          {mode === "boardlist" && (
            <div>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">Subscriptions List</h3>
                    <p className="si-header-subtitle">
                      Manage and filter all payments, subscriptions and
                      transactions
                    </p>
                  </div>
                </div>

                <div className="si-header-right">
                  <span className="si-total-count-text">
                    Total <b>{listTotal}</b>
                  </span>

                  {permCan("create") && (
                    <button className="si-btn-primary" onClick={openAdd}>
                      <Plus size={16} /> Add Subscription
                    </button>
                  )}

                  <button
                    className="si-btn-export-excel"
                    onClick={() => askExport("excel")}
                  >
                    <FileSpreadsheet size={15} /> Export Excel
                  </button>

                  <button className="si-btn-export-csv" onClick={() => askExport("csv")}>
                    <FileText size={15} /> Export CSV
                  </button>

                  <button
                    className="si-btn-outline"
                    onClick={() => moveto("board")}
                  >
                    <ArrowLeft size={15} /> Back to Dashboard
                  </button>
                </div>
              </div>

              {/* 4 Stat Cards in Boardlist */}
              <div className="si-stats-grid" style={{ marginBottom: 20 }}>
                <div
                  className={`si-stat-card card-revenue ${status === "" && !dfrom && !dto ? "active" : ""}`}
                  onClick={() => {
                    setStatus("");
                    setSearch("");
                    setDfrom("");
                    setDto("");
                    loadDetails(1, "", sort, "", "", "");
                  }}
                  title="Click to view all payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#e0f2fe", color: "#0284c7" }}
                  >
                    <DollarSign size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Total Payments</p>
                    <h3 className="si-stat-value">
                      <AnimatedNumber value={stats?.total || listTotal} pending={loading} id="Subscriptions-s5" />
                    </h3>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-pending ${status === "1" ? "active" : ""}`}
                  onClick={() => {
                    const next = status === "1" ? "" : "1";
                    setStatus(next);
                    loadDetails(1, search, sort, dfrom, dto, next);
                  }}
                  title="Click to filter by Pending payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#fef3c7", color: "#d97706" }}
                  >
                    <Clock size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Pending Payments</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.pending || 0} pending={loading} id="Subscriptions-s6" /></h3>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-success ${status === "2" ? "active" : ""}`}
                  onClick={() => {
                    const next = status === "2" ? "" : "2";
                    setStatus(next);
                    loadDetails(1, search, sort, dfrom, dto, next);
                  }}
                  title="Click to filter by Successful payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#d1fae5", color: "#059669" }}
                  >
                    <CheckCircle size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Successful Payments</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.success || 0} pending={loading} id="Subscriptions-s7" /></h3>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-failed ${status === "0" ? "active" : ""}`}
                  onClick={() => {
                    const next = status === "0" ? "" : "0";
                    setStatus(next);
                    loadDetails(1, search, sort, dfrom, dto, next);
                  }}
                  title="Click to filter by Failed payments"
                >
                  <div
                    className="si-stat-icon-wrap"
                    style={{ background: "#fee2e2", color: "#dc2626" }}
                  >
                    <XCircle size={22} />
                  </div>
                  <div>
                    <p className="si-stat-label">Failed Payments</p>
                    <h3 className="si-stat-value"><AnimatedNumber value={stats?.failed || 0} pending={loading} id="Subscriptions-s8" /></h3>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <div className="si-filter-left">
                  <div className="si-sort-group">
                    <ArrowUpDown size={15} color="#64748b" />
                    <span>Sort:</span>
                    <select
                      className="si-select-sort"
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        loadDetails(
                          page,
                          search,
                          e.target.value,
                          dfrom,
                          dto,
                          status,
                        );
                      }}
                    >
                      <option value="New">New</option>
                      <option value="Old">Old</option>
                    </select>
                  </div>

                  <div className="si-sort-group">
                    <span>Status:</span>
                    <select
                      className="si-select-sort"
                      value={status}
                      onChange={(e) =>
                        loadDetails(1, search, sort, dfrom, dto, e.target.value)
                      }
                    >
                      <option value="">All Statuses</option>
                      <option value="2">Success</option>
                      <option value="1">Pending</option>
                      <option value="0">Failed</option>
                      <option value="1D">Deleted</option>
                    </select>
                  </div>

                  <DateFilter
                    from={dfrom}
                    to={dto}
                    onApply={(f, t) =>
                      loadDetails(1, search, sort, f, t, status)
                    }
                  />
                </div>

                <div className="si-filter-right">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      loadDetails(1, search, sort, dfrom, dto, status);
                    }}
                  >
                    <ListSearch
                      placeholder="Search student, email, course..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </form>

                  <button data-refresh
                    className="reload-btn"
                    title="Reset search & reload"
                    onClick={() => {
                      setSearch("");
                      setDfrom("");
                      setDto("");
                      setStatus("");
                      loadDetails(1, "", "New", "", "", "");
                    }}
                  >
                    <RotateCw size={16} />
                  </button>
                </div>
              </div>

              {/* Table Card */}
              <div className="si-table-card">
                <div className="si-table-responsive">
                  <table className="si-table">
                    <thead className="si-thead">
                      <tr>
                        <th className="si-th" style={{ width: 60 }}>
                          S.No
                        </th>
                        <th className="si-th">Student Details</th>
                        <th className="si-th">Course</th>
                        <th className="si-th">Fees</th>
                        <th className="si-th">Date & Time</th>
                        <th className="si-th">Status</th>
                        <th className="si-th">Type</th>
                        <th
                          className="si-th"
                          style={{ textAlign: "center", width: 80 }}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {loading ? (
                        <SkeletonRows />
                      ) : alllists.length === 0 ? (
                        <tr>
                          <td colSpan={8}>
                            <div className="si-empty-box">
                              <CreditCard size={40} className="si-empty-icon" />
                              <h5
                                style={{
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  margin: "4px 0",
                                }}
                              >
                                No Subscriptions Found
                              </h5>
                              <p
                                style={{
                                  color: "#64748b",
                                  fontSize: "13px",
                                  margin: 0,
                                }}
                              >
                                {search
                                  ? "No subscriptions match your search parameters."
                                  : "There are currently no subscription entries recorded."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        alllists.map((list, index) => {
                          const avatarStyle =
                            avatarPalette[index % avatarPalette.length];
                          const initials = getInitials(list.sname);
                          const st = getStatus(list.status);

                          return (
                            <tr key={list.id || index} className="si-tr">
                              <td
                                className="si-td"
                                style={{ color: "#64748b", fontWeight: 600 }}
                              >
                                {(page - 1) * limit + index + 1}
                              </td>

                              <td className="si-td">
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                  }}
                                >
                                  <div
                                    className="si-avatar-badge"
                                    style={{
                                      background: avatarStyle.bg,
                                      color: avatarStyle.text,
                                    }}
                                  >
                                    {initials}
                                  </div>
                                  <div className="si-user-info">
                                    <span
                                      className="si-user-name"
                                      onClick={() => {
                                        fbmemberList(list);
                                        setModel("view");
                                      }}
                                    >
                                      {list.sname || "—"}
                                    </span>
                                    <span className="si-user-sub">
                                      {list.semail || "—"}
                                    </span>
                                    {list.sphone && (
                                      <span
                                        className="si-user-sub"
                                        style={{ fontSize: "11.5px" }}
                                      >
                                        📞 {list.sphone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="si-td" style={{ maxWidth: 220 }}>
                                <span
                                  style={{ fontWeight: 500, color: "#1e293b" }}
                                >
                                  {decodeHtml(list.course_name) || "—"}
                                </span>
                              </td>

                              <td
                                className="si-td"
                                style={{ fontWeight: 700, color: "#0f172a" }}
                              >
                                {list.currency || "USD"} {list.fees || "0"}
                              </td>

                              <td
                                className="si-td"
                                style={{ fontSize: 13, color: "#475569" }}
                              >
                                {formatDate(list.datetime)}
                              </td>

                              <td className="si-td">
                                <span
                                  className={`si-status-pill ${
                                    st === "Success"
                                      ? "status-success"
                                      : st === "Pending"
                                        ? "status-pending"
                                        : "status-failed"
                                  }`}
                                >
                                  <span className="si-status-dot" /> {st}
                                </span>
                              </td>

                              <td className="si-td">
                                <span
                                  className={`si-type-pill ${
                                    list.type === "1"
                                      ? "type-manual"
                                      : "type-auto"
                                  }`}
                                >
                                  {list.type === "1" ? "Manual" : "Auto"}
                                </span>
                              </td>

                              <td
                                className="si-td"
                                style={{ textAlign: "center" }}
                              >
                                <div
                                  className="si-actions-cell"
                                  style={{ justifyContent: "center" }}
                                >
                                  {list.type === "1" && permCan("edit") && (
                                    <button
                                      type="button"
                                      className="si-action-btn btn-edit"
                                      title="Edit Subscription"
                                      onClick={() => openEdit(list)}
                                    >
                                      <Edit size={15} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="si-action-btn btn-view"
                                    title="View Student Details"
                                    onClick={() => {
                                      fbmemberList(list);
                                      setModel("view");
                                    }}
                                  >
                                    <Eye size={15} />
                                  </button>
                                </div>
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
                    <span>
                      Showing{" "}
                      <b>{alllists.length ? (page - 1) * limit + 1 : 0}</b> to{" "}
                      <b>{Math.min(page * limit, listTotal)}</b> of{" "}
                      <b>{listTotal}</b> entries
                    </span>
                  </div>

                  <div className="si-pagination">
                    <button
                      type="button"
                      className="si-page-nav-btn"
                      disabled={page <= 1}
                      onClick={() => {
                        const p = page - 1;
                        setPage(p);
                        loadDetails(p, search, sort, dfrom, dto, status);
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: Math.min(lastPage || 1, 5) }).map(
                      (_, i) => {
                        const pNum = i + 1;
                        return (
                          <button
                            key={pNum}
                            type="button"
                            className={`si-page-btn ${page === pNum ? "active" : ""}`}
                            onClick={() => {
                              setPage(pNum);
                              loadDetails(
                                pNum,
                                search,
                                sort,
                                dfrom,
                                dto,
                                status,
                              );
                            }}
                          >
                            {pNum}
                          </button>
                        );
                      },
                    )}

                    <button
                      type="button"
                      className="si-page-nav-btn"
                      disabled={page >= (lastPage || 1)}
                      onClick={() => {
                        const p = page + 1;
                        setPage(p);
                        loadDetails(p, search, sort, dfrom, dto, status);
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/subscriptions" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------------- View Student Details Modal ---------------- */}
        {model === "view" && form && (
          <div
            className="modal fade show d-block"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              style={{ maxWidth: 500 }}
            >
              <div
                className="modal-content"
                style={{
                  borderRadius: 20,
                  border: "none",
                  overflow: "hidden",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                }}
              >
                <div
                  className="modal-header"
                  style={{
                    background:
                      "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "18px 24px",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: "var(--ad-brand)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h5
                        className="modal-title"
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          margin: 0,
                          color: "#0f172a",
                        }}
                      >
                        Subscription Details
                      </h5>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Recorded on {formatDate(form.datetime)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModel("")}
                  />
                </div>

                <div className="modal-body" style={{ padding: 24 }}>
                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: "1px solid #edf2f7",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      Student Information
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {form.sname || "—"}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#475569", marginTop: 2 }}
                    >
                      {form.semail || "—"}
                    </div>
                    {form.sphone && (
                      <div style={{ fontSize: 13, color: "#475569" }}>
                        📞 {form.sphone}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid #edf2f7",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                        }}
                      >
                        Course
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#0f172a",
                          marginTop: 3,
                        }}
                      >
                        {decodeHtml(form.course_name) || "—"}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid #edf2f7",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                        }}
                      >
                        Amount Paid
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#16a34a",
                          marginTop: 3,
                        }}
                      >
                        {form.currency || "USD"} {form.fees || "0"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid #edf2f7",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      Payment Reference
                    </div>
                    <div style={{ fontSize: 12.5, color: "#334155" }}>
                      <strong>Pay Intent:</strong> {form.pay_intent || "—"}
                    </div>
                    <div
                      style={{ fontSize: 12.5, color: "#334155", marginTop: 4 }}
                    >
                      <strong>Status:</strong>{" "}
                      <span
                        style={{
                          fontWeight: 600,
                          color: form.status === "2" ? "#16a34a" : "#d97706",
                        }}
                      >
                        {getStatus(form.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="modal-footer"
                  style={{
                    borderTop: "1px solid #edf2f7",
                    padding: "14px 24px",
                  }}
                >
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: "var(--ad-brand)",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "8px 20px",
                      fontWeight: 600,
                      fontSize: 13,
                      border: "none",
                    }}
                    onClick={() => setModel("")}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Add / Edit Subscription Modal ---------------- */}
        {addOpen && (
          <div
            className="modal fade show d-block"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => !busy && setAddOpen(false)}
          >
            <div
              className="modal-dialog modal-dialog-centered modal-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="modal-content"
                style={{
                  borderRadius: 20,
                  border: "none",
                  overflow: "hidden",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                }}
              >
                <div
                  className="modal-header"
                  style={{
                    background:
                      "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "18px 24px",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: "var(--ad-brand)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h5
                        className="modal-title"
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          margin: 0,
                          color: "#0f172a",
                        }}
                      >
                        {addForm.req_id
                          ? "Edit Subscription"
                          : addStep === "search"
                            ? "Add Subscription — Find Student"
                            : "Add Subscription — Payment Details"}
                      </h5>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {addStep === "search"
                          ? "Select an existing student to attach this subscription"
                          : "Enter payment and enrollment information"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    disabled={busy}
                    onClick={() => setAddOpen(false)}
                  />
                </div>

                {/* STEP 1: Search student */}
                {addStep === "search" && (
                  <>
                    <div className="modal-body" style={{ padding: 24 }}>
                      <label
                        className="form-label"
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: "#334155",
                        }}
                      >
                        Search Student by Email or Contact Number
                      </label>
                      <div className="input-group mb-3">
                        <input
                          className="form-control"
                          value={stuQuery}
                          placeholder="Enter student email or phone..."
                          style={{
                            borderRadius: "10px 0 0 10px",
                            padding: "10px 14px",
                          }}
                          onChange={(e) => setStuQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") searchStudents();
                          }}
                        />
                        <button
                          className="btn"
                          style={{
                            background: "var(--ad-brand)",
                            color: "#fff",
                            fontWeight: 600,
                            padding: "0 20px",
                          }}
                          disabled={stuLoading}
                          onClick={searchStudents}
                        >
                          {stuLoading ? <ButtonLoader label="Searching..." /> : "Search"}
                        </button>
                      </div>

                      <div
                        className="table-responsive"
                        style={{
                          maxHeight: 280,
                          overflowY: "auto",
                          border: "1px solid #edf2f7",
                          borderRadius: 12,
                        }}
                      >
                        <table className="table table-hover align-middle mb-0">
                          <thead style={{ background: "#f8fafc" }}>
                            <tr>
                              <th style={{ width: 40 }}></th>
                              <th style={{ fontSize: 12 }}>Name</th>
                              <th style={{ fontSize: 12 }}>Email</th>
                              <th style={{ fontSize: 12 }}>Phone</th>
                              <th style={{ fontSize: 12 }}>Course / Batch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stuResults.length === 0 && !stuLoading && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="text-center text-muted py-4"
                                  style={{ fontSize: 13 }}
                                >
                                  Search to find a student (max 10 results).
                                </td>
                              </tr>
                            )}
                            {stuResults.map((st) => (
                              <tr
                                key={st.mem_id}
                                style={{
                                  cursor: "pointer",
                                  background:
                                    selStu?.mem_id === st.mem_id
                                      ? "#f5f3ff"
                                      : undefined,
                                }}
                                onClick={() => setSelStu(st)}
                              >
                                <td>
                                  <input
                                    type="radio"
                                    name="stusel"
                                    checked={selStu?.mem_id === st.mem_id}
                                    onChange={() => setSelStu(st)}
                                  />
                                </td>
                                <td
                                  style={{ fontWeight: 600, color: "#0f172a" }}
                                >
                                  {st.name || "—"}
                                </td>
                                <td
                                  className="text-muted"
                                  style={{ fontSize: ".85rem" }}
                                >
                                  {st.email || "—"}
                                </td>
                                <td style={{ fontSize: ".85rem" }}>
                                  {st.number || "—"}
                                </td>
                                <td style={{ fontSize: ".82rem" }}>
                                  {st.course_name ? (
                                    decodeHtml(st.course_name)
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                  {st.batch_name ? (
                                    <span className="text-muted">
                                      {" "}
                                      · {decodeHtml(st.batch_name)}
                                    </span>
                                  ) : (
                                    ""
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div
                      className="modal-footer"
                      style={{
                        borderTop: "1px solid #edf2f7",
                        padding: "14px 24px",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        style={{
                          borderRadius: 10,
                          padding: "8px 18px",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                        onClick={() => setAddOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: "var(--ad-brand)",
                          color: "#fff",
                          borderRadius: 10,
                          padding: "8px 20px",
                          fontWeight: 600,
                          fontSize: 13,
                          border: "none",
                        }}
                        disabled={!selStu}
                        onClick={continueToForm}
                      >
                        Continue →
                      </button>
                    </div>
                  </>
                )}

                {/* STEP 2: Payment details form */}
                {addStep === "form" && (
                  <>
                    <div className="modal-body" style={{ padding: 24 }}>
                      <div
                        style={{
                          background: "#f5f3ff",
                          border: "1px solid #ddd6fe",
                          borderRadius: 12,
                          padding: "12px 16px",
                          marginBottom: 18,
                          fontSize: 13.5,
                          color: "var(--ad-brand-2)",
                        }}
                      >
                        <b>{addForm.sname || "—"}</b>
                        {addForm.semail ? ` · ${addForm.semail}` : ""}
                        {addForm.sphone ? ` · ${addForm.sphone}` : ""}
                        {selStu?.batch_name && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--ad-brand)",
                              marginTop: 2,
                            }}
                          >
                            Latest Batch: {decodeHtml(selStu.batch_name)}
                          </div>
                        )}
                      </div>

                      <div className="row g-3">
                        <div className="col-md-6">
                          <label
                            className="form-label"
                            style={{ fontWeight: 600, fontSize: 13 }}
                          >
                            Course
                          </label>
                          <select
                            className="form-select"
                            value={addForm.crs_id}
                            onChange={(e) =>
                              setAddForm({ ...addForm, crs_id: e.target.value })
                            }
                          >
                            <option value="">Select course</option>
                            {subCourses.map((c) => (
                              <option key={c.req_id} value={c.req_id}>
                                {decodeHtml(c.title)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-md-6">
                          <label
                            className="form-label"
                            style={{ fontWeight: 600, fontSize: 13 }}
                          >
                            Payment Date
                          </label>
                          <input
                            type="datetime-local"
                            className="form-control"
                            value={addForm.paydate}
                            onChange={(e) =>
                              setAddForm({
                                ...addForm,
                                paydate: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="col-md-4">
                          <label
                            className="form-label"
                            style={{ fontWeight: 600, fontSize: 13 }}
                          >
                            Currency
                          </label>
                          <select
                            className="form-select"
                            value={addForm.currency}
                            onChange={(e) =>
                              setAddForm({
                                ...addForm,
                                currency: e.target.value,
                              })
                            }
                          >
                            <option value="USD">USD</option>
                            <option value="INR">INR</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </div>

                        <div className="col-md-4">
                          <label
                            className="form-label"
                            style={{ fontWeight: 600, fontSize: 13 }}
                          >
                            Fees
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={addForm.fees}
                            onChange={(e) =>
                              setAddForm({ ...addForm, fees: e.target.value })
                            }
                            placeholder="0.00"
                          />
                        </div>

                        <div className="col-md-4">
                          <label
                            className="form-label"
                            style={{ fontWeight: 600, fontSize: 13 }}
                          >
                            Status
                          </label>
                          <select
                            className="form-select"
                            value={addForm.status}
                            onChange={(e) =>
                              setAddForm({ ...addForm, status: e.target.value })
                            }
                          >
                            <option value="2">Success</option>
                            <option value="1">Pending</option>
                            <option value="0">Failed</option>
                          </select>
                        </div>

                        <div className="col-md-6">
                          <label
                            className="form-label"
                            style={{ fontWeight: 600, fontSize: 13 }}
                          >
                            Pay ID
                          </label>
                          <input
                            className="form-control"
                            value={addForm.pay_id}
                            onChange={(e) =>
                              setAddForm({ ...addForm, pay_id: e.target.value })
                            }
                            placeholder="Payment / receipt ID"
                          />
                        </div>

                        <div className="col-md-6">
                          <label
                            className="form-label"
                            style={{ fontWeight: 600, fontSize: 13 }}
                          >
                            Pay Intent
                          </label>
                          <input
                            className="form-control"
                            value={addForm.pay_intent}
                            onChange={(e) =>
                              setAddForm({
                                ...addForm,
                                pay_intent: e.target.value,
                              })
                            }
                            placeholder="Payment intent ID"
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className="modal-footer"
                      style={{
                        borderTop: "1px solid #edf2f7",
                        padding: "14px 24px",
                      }}
                    >
                      {!addForm.req_id && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary me-auto"
                          disabled={busy}
                          style={{
                            borderRadius: 10,
                            padding: "8px 18px",
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                          onClick={() => setAddStep("search")}
                        >
                          ← Back
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        disabled={busy}
                        style={{
                          borderRadius: 10,
                          padding: "8px 18px",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                        onClick={() => setAddOpen(false)}
                      >
                        Cancel
                      </button>
                      {permCan("edit", "create") && (
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: "var(--ad-brand)",
                            color: "#fff",
                            borderRadius: 10,
                            padding: "8px 20px",
                            fontWeight: 600,
                            fontSize: 13,
                            border: "none",
                          }}
                          disabled={busy}
                          onClick={saveSub}
                        >
                          {busy
                            ? "Saving..."
                            : addForm.req_id
                              ? "Update Subscription"
                              : "Add Subscription"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
