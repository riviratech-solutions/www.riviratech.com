import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FileText,
  ClipboardList,
  SlidersHorizontal,
  Search,
  RotateCw,
  Eye,
  CheckCircle,
  BookOpen,
  Calendar,
  Download,
  UploadCloud,
  Clock,
  ArrowLeft,
  FileSpreadsheet,
  X,
  AlertCircle,
  Send,
  Layers,
  UserCheck,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { AnimatedNumber, SkeletonCards } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const [assignmentid, setAssignmentid] = useState("");
  const [mainmode, setMainMode] = useState("assignments");
  const [asslists, setAssLists] = useState([]);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");

  return (
    <>
      {mainmode == "assignments" && (
        <Assignments
          setMainMode={setMainMode}
          setAssLists={setAssLists}
          setAssignmentid={setAssignmentid}
          page={page}
          setPage={setPage}
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
        />
      )}

      {mainmode == "subassignments" && (
        <SubAssignments
          setMainMode={setMainMode}
          asslists={asslists}
          assignmentid={assignmentid}
        />
      )}
    </>
  );
}

function Assignments({
  setMainMode,
  setAssLists,
  setAssignmentid,
  page,
  setPage,
  search,
  setSearch,
  sort,
  setSort,
}: any) {

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");

  const initialForm = {
    id: "", // users.id
    mem_id: "",
    tname: "",
    req_id: "",
    title: "", // name
    note: "",
    batch: "",
    course: "",
    batch_name: "",
    course_name: "",
    sdate: "",
    edate: "",
    file: "",
    students_count: "",
    subs_count: "",
    datetime: "", // registered date (timestamp)
    updatetime: "",
    status: "", // active/inactive
  };

  const [form, setForm] = useState(initialForm);

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

  const [lastPage, setLastPage] = useState(0);

  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);

  const formatDate = (ts: any) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("en-IN");
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "0":
        return "Deleted";
      case "1D":
        return "Deleted";
      case "1":
        return "Active";
      case "1S":
        return "Disabled";
      case "2":
        return "Completed";
      default:
        return "Unknown";
    }
  };

  const getsubStatus = (s: any) => {
    let ss = s == null ? "" : s;
    switch (String(ss)) {
      case "1":
        return "Pending";
      case "0":
        return "Rejected";
      case "2":
        return "Approved";
      default:
        return "Not Applied Yet";
    }
  };

  const loadDetails = async (page = 1, search = "", sort = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);

    try {

      const res = await listFetch("api/assignments", {
          q: search,
          s: sort,
          n: page,
        });

      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  const moveto = async (id: any) => {
    setSuccess("");
    setError("");
    setMode(id);

    if (id === "add") {
      setForm(initialForm);
    }
  };

  const updateto = async (type: any, list: any) => {
    setForm({
      id: list.id,
      req_id: list.req_id,
      mem_id: list.mem_id,
      tname: list.tname,
      title: decodeHtml(list.title),
      note: list.note,
      course: list.course,
      batch: list.batch,
      batch_name: list.batch_name,
      course_name: decodeHtml(list.course_name),
      sdate: type == "update" ? timestampToDateTime(list.sdate) : list.sdate,
      edate: type == "update" ? timestampToDateTime(list.edate) : list.edate,
      file: list.file,
      students_count: list.students_count,
      subs_count: list.subs_count,
      datetime: list.datetime,
      updatetime: list.updatetime,
      status: list.status,
    });

    if (type == "view") {
    }

    setMode(type);
  };

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && ustatus == "1") {
      loadDetails();
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

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />

      {/* Main Content */}
      <div className="content">

        <style>{`
          /* Modern Form Page (.rf-*) */
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
            box-shadow: 0 4px 16px rgba(88, 47, 234, 0.05);
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
            background: #582fea;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 16px rgba(88, 47, 234, 0.25);
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
            border: 1.5px solid #582fea;
            color: #582fea;
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
            color: #4824cf;
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
            border-color: #582fea;
            box-shadow: 0 0 0 3px rgba(88, 47, 234, 0.08);
          }
          .rf-textarea {
            width: 100%;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 13.5px;
            color: #0f172a;
            outline: none;
            min-height: 80px;
            resize: vertical;
            box-sizing: border-box;
          }
          .rf-textarea:focus {
            border-color: #582fea;
            box-shadow: 0 0 0 3px rgba(88, 47, 234, 0.08);
          }
          .rf-progress-bar-container {
            grid-column: 1 / -1;
            margin-top: 10px;
          }
          .rf-progress {
            height: 10px;
            background: #e2e8f0;
            border-radius: 999px;
            overflow: hidden;
          }
          .rf-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #582fea, #7c3aed);
            border-radius: 999px;
            transition: width 0.3s ease;
          }
          .rf-progress-text {
            font-size: 12px;
            font-weight: 600;
            color: #582fea;
            margin-top: 4px;
            text-align: right;
          }
          .rf-file-existing {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 8px;
            padding: 6px 14px;
            background: #ede9fe;
            color: #582fea;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.15s ease;
          }
          .rf-file-existing:hover {
            background: #ddd6fe;
            color: #4824cf;
          }
          .rf-submit-btn {
            grid-column: 1 / -1;
            background: #582fea;
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
            box-shadow: 0 4px 14px rgba(88, 47, 234, 0.25);
          }
          .rf-submit-btn:hover:not(:disabled) {
            background: #4824cf;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(88, 47, 234, 0.35);
          }
          .rf-submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          /* Student Feedback Cards */
          .rf-feedback-card {
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
          }
          .rf-feedback-card.rejected {
            border-left: 5px solid #ef4444;
            background: #fffafa;
          }
          .rf-feedback-card.pending {
            border-left: 5px solid #f59e0b;
            background: #fffdf5;
          }
          .rf-feedback-card.approved {
            border-left: 5px solid #10b981;
            background: #f0fdf4;
          }
          .rf-feedback-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 12px;
          }
          .rf-feedback-title {
            font-size: 18px;
            font-weight: 700;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .rf-feedback-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          .rf-feedback-badge.rejected {
            background: #fee2e2;
            color: #dc2626;
          }
          .rf-feedback-badge.pending {
            background: #fef3c7;
            color: #d97706;
          }
          .rf-feedback-badge.approved {
            background: #d1fae5;
            color: #059669;
          }
          .rf-feedback-body {
            font-size: 14px;
            color: #334155;
            line-height: 1.6;
          }
          .rf-feedback-reason {
            background: #fee2e2;
            border: 1px solid #fecaca;
            border-radius: 10px;
            padding: 12px 16px;
            color: #b91c1c;
            font-weight: 600;
            margin: 14px 0;
            display: flex;
            align-items: flex-start;
            gap: 10px;
          }

          /* Board View Styles */
          .asg-wrapper {
                padding: 24px;
                background-color: #f8fafc;
                min-height: calc(100vh - 70px);
              }
              .asg-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 16px;
              }
              .asg-header-left {
                display: flex;
                align-items: center;
                gap: 14px;
              }
              .asg-header-icon {
                width: 44px;
                height: 44px;
                border-radius: 10px;
                background: #7c3aed;
                color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
              }
              .asg-header-title {
                font-size: 22px;
                font-weight: 700;
                color: #1e293b;
                margin: 0;
                line-height: 1.2;
              }
              .asg-header-subtitle {
                font-size: 13.5px;
                color: #64748b;
                margin: 2px 0 0 0;
              }
              .asg-header-right {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
              }
              .asg-total-badge {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                color: #475569;
                padding: 7px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 500;
              }
              .asg-total-badge b {
                color: #1e293b;
                font-weight: 700;
              }
              .asg-filter-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 12px 18px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                flex-wrap: wrap;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
              }
              .asg-sort-group {
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .asg-sort-label {
                font-size: 13.5px;
                font-weight: 500;
                color: #64748b;
                white-space: nowrap;
              }
              .asg-sort-select {
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 6px 12px;
                font-size: 13.5px;
                color: #1e293b;
                background-color: #ffffff;
                outline: none;
                cursor: pointer;
              }
              .asg-search-box {
                flex: 1;
                min-width: 260px;
                position: relative;
                display: flex;
                align-items: center;
              }
              .asg-search-icon {
                position: absolute;
                left: 12px;
                color: #94a3b8;
                pointer-events: none;
              }
              .asg-search-input {
                width: 100%;
                padding: 8px 14px 8px 36px;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                font-size: 13.5px;
                color: #1e293b;
                outline: none;
                background-color: #ffffff;
                transition: border-color 0.2s ease;
              }
              .asg-search-input:focus {
                border-color: #7c3aed;
              }
              .asg-btn-reload {
                background: #7c3aed;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                width: 38px;
                height: 38px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                flex-shrink: 0;
              }
              .asg-btn-reload:hover {
                background: #6d28d9;
              }
              .asg-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 14px;
                overflow: hidden;
                margin-bottom: 16px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                transition: box-shadow 0.2s ease, transform 0.2s ease;
              }
              .asg-card:hover {
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
              }
              .asg-card-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 20px;
                border-bottom: 1px solid transparent;
              }
              .asg-card-top-left {
                display: flex;
                align-items: center;
                gap: 14px;
              }
              .asg-card-iconbox {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              }
              .asg-card-title-group {
                display: flex;
                flex-direction: column;
              }
              .asg-card-title {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
                margin: 0;
                line-height: 1.3;
              }
              .asg-card-date {
                font-size: 12px;
                color: #64748b;
                margin: 2px 0 0 0;
              }
              .asg-status-pill {
                border-radius: 20px;
                padding: 4px 12px;
                font-size: 12px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                line-height: 1;
              }
              .asg-top-active {
                background-color: #f0f9ff;
                border-bottom-color: #bae6fd;
              }
              .asg-icon-active {
                background-color: #dbeafe;
                color: #0284c7;
              }
              .asg-pill-active {
                background-color: #e0f2fe;
                color: #0284c7;
              }
              .asg-top-disabled {
                background-color: #fef2f2;
                border-bottom-color: #fecaca;
              }
              .asg-icon-disabled {
                background-color: #fee2e2;
                color: #b91c1c;
              }
              .asg-pill-disabled {
                background-color: #fee2e2;
                color: #b91c1c;
              }
              .asg-top-completed {
                background-color: #f0fdf4;
                border-bottom-color: #bbf7d0;
              }
              .asg-icon-completed {
                background-color: #dcfce7;
                color: #15803d;
              }
              .asg-pill-completed {
                background-color: #dcfce7;
                color: #15803d;
              }
              .asg-pill-sub-approved {
                background-color: #dcfce7;
                color: #15803d;
              }
              .asg-pill-sub-pending {
                background-color: #fef3c7;
                color: #b45309;
              }
              .asg-pill-sub-rejected {
                background-color: #fee2e2;
                color: #b91c1c;
              }
              .asg-pill-sub-none {
                background-color: #f1f5f9;
                color: #64748b;
              }
              .asg-card-bottom {
                padding: 16px 20px;
                background-color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 16px;
              }
              .asg-meta-cols {
                display: flex;
                align-items: center;
                gap: 36px;
                flex-wrap: wrap;
              }
              .asg-meta-item {
                display: flex;
                flex-direction: column;
              }
              .asg-meta-label {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                color: #64748b;
                font-weight: 500;
                margin-bottom: 3px;
              }
              .asg-meta-value {
                font-size: 13.5px;
                font-weight: 600;
                color: #1e293b;
                margin: 0;
              }
              .asg-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
              }
              .asg-btn-view {
                border: 1.5px solid #7c3aed;
                color: #6d28d9;
                background: #ffffff;
                border-radius: 8px;
                padding: 6px 14px;
                font-size: 12.5px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .asg-btn-view:hover {
                background: #f5f3ff;
              }
              .asg-btn-submit {
                background: #7c3aed;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                padding: 6px 14px;
                font-size: 12.5px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .asg-btn-submit:hover {
                background: #6d28d9;
                color: #ffffff;
              }
              .asg-btn-viewsubm {
                border: 1px solid #cbd5e1;
                background: #ffffff;
                color: #334155;
                border-radius: 8px;
                padding: 6px 12px;
                font-size: 12.5px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .asg-btn-viewsubm:hover {
                background: #f8fafc;
              }
              .asg-badge-closed {
                background: #f1f5f9;
                color: #64748b;
                border-radius: 8px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 600;
              }
              .asg-doc-link {
                color: #2563eb;
                text-decoration: none;
                font-size: 13px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 4px;
              }
              .asg-doc-link:hover {
                text-decoration: underline;
              }
        `}</style>

        {mode === "board" && (
          <div className="asg-wrapper">
            {/* Header */}
            <div className="asg-header">
              <div className="asg-header-left">
                <div className="asg-header-icon">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="asg-header-title">Assignments</h3>
                  <p className="asg-header-subtitle">Manage and submit your assignments</p>
                </div>
              </div>

              <div className="asg-header-right">
                <span className="asg-total-badge">
                  Total <b>{listtotal}</b>
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="asg-filter-card">
              <div className="asg-sort-group">
                <SlidersHorizontal size={16} color="#7c3aed" />
                <label className="asg-sort-label">Sort By:</label>
                <select
                  className="asg-sort-select"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    loadDetails(page, search, e.target.value);
                  }}
                >
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="asg-search-box">
                <Search className="asg-search-icon" size={16} />
                <input
                  type="text"
                  className="asg-search-input"
                  placeholder="Search assignments by title or course..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadDetails(1, search, sort);
                    }
                  }}
                />
              </div>

              <button data-refresh
                className="asg-btn-reload"
                title="Reload assignments"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "", sort);
                }}
              >
                <RotateCw size={16} />
              </button>
            </div>

            {/* Cards List */}
            <div className="row g-3">
              {alllists.length === 0 ? (
                <div className="col-12">
                  {loading ? (
                    <SkeletonCards count={3} />
                  ) : (
                    <div className="no-data-card text-center p-5 bg-white rounded-3 border">
                      <i className="fa fa-database no-data-icon"></i>
                      {search.length === 0 ? (
                        <div>
                          <h4 className="mt-3">No Records</h4>
                          <p className="text-muted">
                            We couldn't load any assignments detail, there is no data.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <h4 className="mt-3">No Records Found</h4>
                          <p className="text-muted">
                            We couldn't find any assignments detail matching your search.
                          </p>
                        </div>
                      )}
                      <button
                        className="btn btn-primary mt-2"
                        onClick={() => {
                          setSearch("");
                          loadDetails(page, "", sort);
                        }}
                      >
                        Reload
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="col-12">
                  {alllists.map((list, index) => {
                    const isCompleted = String(list.status) === "2";
                    const isDisabled = String(list.status) === "1S";

                    const topClass = isCompleted
                      ? "asg-top-completed"
                      : isDisabled
                      ? "asg-top-disabled"
                      : "asg-top-active";

                    const iconClass = isCompleted
                      ? "asg-icon-completed"
                      : isDisabled
                      ? "asg-icon-disabled"
                      : "asg-icon-active";

                    const statusLabel = isCompleted
                      ? "Completed"
                      : isDisabled
                      ? "Disabled"
                      : "Active";

                    const subStatus = String(list.sub_status ?? "");
                    const isApproved = subStatus === "2";
                    const isPending = subStatus === "1";
                    const isRejected = subStatus === "0";

                    const subPillClass = isApproved
                      ? "asg-pill-sub-approved"
                      : isPending
                      ? "asg-pill-sub-pending"
                      : isRejected
                      ? "asg-pill-sub-rejected"
                      : "asg-pill-sub-none";

                    const subStatusLabel = getsubStatus(list.sub_status);

                    return (
                      <div className="asg-card" key={list.req_id || index}>
                        {/* Tier 1 Header */}
                        <div className={`asg-card-top ${topClass}`}>
                          <div className="asg-card-top-left">
                            <div className={`asg-card-iconbox ${iconClass}`}>
                              <FileText size={18} />
                            </div>
                            <div className="asg-card-title-group">
                              <h6 className="asg-card-title">{decodeHtml(list.title)}</h6>
                              <p className="asg-card-date">
                                Created: {formatDate(list.datetime)}
                              </p>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <span className={`asg-status-pill ${subPillClass}`}>
                              ● {subStatusLabel}
                            </span>
                            <span
                              className={`asg-status-pill ${
                                isCompleted
                                  ? "asg-pill-completed"
                                  : isDisabled
                                  ? "asg-pill-disabled"
                                  : "asg-pill-active"
                              }`}
                            >
                              ● {statusLabel}
                            </span>
                          </div>
                        </div>

                        {/* Tier 2 Body & Actions */}
                        <div className="asg-card-bottom">
                          <div className="asg-meta-cols">
                            {/* Course */}
                            <div className="asg-meta-item">
                              <span className="asg-meta-label">
                                <BookOpen size={14} color="#7c3aed" /> Course
                              </span>
                              <p className="asg-meta-value">
                                {decodeHtml(list.course_name)} - {decodeHtml(list.batch_name)}
                              </p>
                            </div>

                            {/* Due Date */}
                            <div className="asg-meta-item">
                              <span className="asg-meta-label">
                                <Calendar size={14} color="#0284c7" /> Due Date
                              </span>
                              <p className="asg-meta-value">{formatDate(list.edate)}</p>
                            </div>

                            {/* Assignment Document */}
                            <div className="asg-meta-item">
                              <span className="asg-meta-label">
                                <FileText size={14} color="#6366f1" /> Assignment File
                              </span>
                              <div className="asg-meta-value">
                                {list.file ? (
                                  <a
                                    href={AWS_UPLOADS + list.file}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="asg-doc-link"
                                  >
                                    <Download size={13} /> View Document
                                  </a>
                                ) : (
                                  <span className="text-muted fs12">No document attached</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="asg-actions">
                            <button
                              className="asg-btn-view"
                              title="View Full Details"
                              onClick={() => updateto("view", list)}
                            >
                              <Eye size={14} /> View
                            </button>

                            {isApproved && (
                              <button
                                className="asg-btn-viewsubm"
                                title="View Approved Submission"
                                onClick={() => {
                                  setAssLists(list);
                                  setAssignmentid(list.req_id);
                                  setMainMode("subassignments");
                                }}
                              >
                                <CheckCircle size={14} color="#16a34a" /> Approved
                              </button>
                            )}

                            {isPending && (
                              <button
                                className="asg-btn-viewsubm"
                                title="View Submitted Assignment"
                                onClick={() => {
                                  setAssLists(list);
                                  setAssignmentid(list.req_id);
                                  setMainMode("subassignments");
                                }}
                              >
                                <Clock size={14} color="#d97706" /> Submitted
                              </button>
                            )}

                            {isRejected && (
                              <>
                                {list.status === "1" ? (
                                  <button
                                    className="asg-btn-submit"
                                    title="Resubmit Assignment"
                                    onClick={() => {
                                      setAssLists(list);
                                      setAssignmentid(list.req_id);
                                      setMainMode("subassignments");
                                    }}
                                  >
                                    <UploadCloud size={14} /> Resubmit
                                  </button>
                                ) : (
                                  <span className="asg-badge-closed">Closed</span>
                                )}
                              </>
                            )}

                            {!isApproved && !isPending && !isRejected && (
                              <>
                                {list.status === "1" ? (
                                  <button
                                    className="asg-btn-submit"
                                    title="Submit Assignment"
                                    onClick={() => {
                                      setAssLists(list);
                                      setAssignmentid(list.req_id);
                                      setMainMode("subassignments");
                                    }}
                                  >
                                    <UploadCloud size={14} /> Apply
                                  </button>
                                ) : (
                                  <span className="asg-badge-closed">Closed</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Pagination
                page={page}
                total={listtotal}
                limit={limit}
                lastPage={lastPage}
                onPageChange={(p: any) => {
                  setPage(p);
                  loadDetails(p, search, sort);
                }}
              />
              <div className="col-12 saved-ago-row">
                <SavedAgo endpoint="api/assignments" />
              </div>
            </div>
          </div>
        )}

        {mode === "view" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              {/* Header Card */}
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <button
                    type="button"
                    className="asg-btn-view"
                    style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "10px" }}
                    onClick={() => moveto("board")}
                    title="Go Back"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="rf-header-icon-box">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h1 className="rf-header-title">Assignment Details</h1>
                    <p className="rf-header-subtitle">
                      Course: <b>{decodeHtml(form.course_name)}</b>
                    </p>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <a onClick={() => moveto("board")} className="rf-btn-back">
                    <ArrowLeft size={16} /> Go Back
                  </a>
                  {form.file && (
                    <a
                      href={AWS_UPLOADS + form.file}
                      target="_blank"
                      rel="noreferrer"
                      className="asg-btn-submit"
                      style={{ textDecoration: "none", padding: "8px 16px", borderRadius: "10px" }}
                    >
                      <Download size={15} /> Download Resource
                    </a>
                  )}
                </div>
              </div>

              {/* Details Two-Column Grid */}
              <div className="row g-4">
                {/* Left Column: Quick Overview Card */}
                <div className="col-lg-4">
                  <div className="rf-form-card text-center" style={{ padding: "24px" }}>
                    <div
                      className="mx-auto mb-3"
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: "18px",
                        background: "#ede9fe",
                        color: "#7c3aed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FileText size={32} />
                    </div>

                    <h5 className="fw-bold text-dark mb-1">{form.title || "Assignment Title"}</h5>
                    <p className="text-muted mb-3" style={{ fontSize: "12.5px" }}>
                      {decodeHtml(form.course_name)} · {decodeHtml(form.batch_name)}
                    </p>

                    <div className="mb-3">
                      <span
                        className={`asg-status-pill ${
                          String(form.status) === "2"
                            ? "asg-pill-completed"
                            : String(form.status) === "1S"
                            ? "asg-pill-disabled"
                            : "asg-pill-active"
                        }`}
                        style={{ fontSize: "12.5px", padding: "5px 14px" }}
                      >
                        ● {getStatus(form.status)}
                      </span>
                    </div>

                    {/* Trainer Box */}
                    <div
                      className="p-3 mb-3 text-start rounded-3"
                      style={{ background: "#f8fafc", border: "1px solid #edf2f7" }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            background: "#dcfce7",
                            color: "#16a34a",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <UserCheck size={18} />
                        </div>
                        <div>
                          <small className="text-muted d-block" style={{ fontSize: "11px" }}>
                            Assigned Trainer
                          </small>
                          <strong className="text-dark" style={{ fontSize: "13.5px" }}>
                            {decodeHtml(form.tname) || "Trainer"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Document Box */}
                    <div
                      className="p-3 mb-3 text-start rounded-3"
                      style={{ background: "#f8fafc", border: "1px solid #edf2f7" }}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <Download size={18} className="text-primary" />
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                            Attachment File
                          </span>
                        </div>
                        {form.file ? (
                          <a
                            href={AWS_UPLOADS + form.file}
                            target="_blank"
                            rel="noreferrer"
                            className="asg-doc-link"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-muted" style={{ fontSize: "12px" }}>None</span>
                        )}
                      </div>
                    </div>

                    {/* Submissions Action CTA */}
                    <button
                      type="button"
                      className="rf-submit-btn w-100 justify-content-center"
                      style={{ marginTop: "12px", padding: "11px 20px" }}
                      onClick={() => {
                        setAssLists(form);
                        setAssignmentid(form.req_id);
                        setMainMode("subassignments");
                      }}
                    >
                      <UploadCloud size={17} />
                      <span>View My Submission / Apply</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Detailed Information & Notes */}
                <div className="col-lg-8">
                  {/* Status Messages */}
                  {success && (
                    <div className="alert alert-success d-flex align-items-center mb-4" role="alert">
                      <CheckCircle size={18} className="me-2 flex-shrink-0" />
                      <div>{success}</div>
                    </div>
                  )}
                  {error && (
                    <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                      <AlertCircle size={18} className="me-2 flex-shrink-0" />
                      <div>{error}</div>
                    </div>
                  )}

                  {/* Metadata Grid Card */}
                  <div className="rf-form-card mb-4">
                    <h5
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: 18,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <ClipboardList size={18} color="#582fea" /> Schedule & Program Details
                    </h5>

                    <div className="rf-form-grid">
                      {/* Course */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Course</span>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                            {decodeHtml(form.course_name) || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Batch */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                          <Layers size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Batch</span>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                            {decodeHtml(form.batch_name) || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Start Date */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Submission Starts</span>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                            {formatDate(form.sdate) || "—"}
                          </div>
                        </div>
                      </div>

                      {/* End Date */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#fee2e2", color: "#dc2626" }}>
                          <Clock size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Submission Due Date</span>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                            {formatDate(form.edate) || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Assigned Trainer */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#dcfce7", color: "#16a34a" }}>
                          <UserCheck size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Trainer</span>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                            {decodeHtml(form.tname) || "Assigned Trainer"}
                          </div>
                        </div>
                      </div>

                      {/* Assignment Status */}
                      <div className="rf-field-card">
                        <div className="rf-icon-wrap" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                          <CheckCircle size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Assignment Status</span>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                            {getStatus(form.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes / Instructions Card */}
                  <div className="rf-form-card">
                    <h5
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <FileText size={18} color="#582fea" /> Assignment Guidelines & Notes
                    </h5>

                    {form.note ? (
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "16px 20px",
                          fontSize: "14px",
                          lineHeight: "1.65",
                          color: "#334155",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {form.note}
                      </div>
                    ) : (
                      <p className="text-muted mb-0" style={{ fontSize: "13.5px" }}>
                        No specific instructions or guidelines were attached to this assignment.
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <button
                        type="button"
                        className="asg-btn-view"
                        onClick={() => moveto("board")}
                      >
                        ← Back to Assignments
                      </button>

                      <button
                        type="button"
                        className="asg-btn-submit"
                        onClick={() => {
                          setAssLists(form);
                          setAssignmentid(form.req_id);
                          setMainMode("subassignments");
                        }}
                      >
                        <UploadCloud size={15} /> Open Submission Portal
                      </button>
                    </div>
                  </div>
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
}

function SubAssignments({ setMainMode, asslists, assignmentid }: any) {
  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  const [cloading, setcLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState("board");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [model, setModel] = useState("");

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [lastPage, setLastPage] = useState(0);

  const filteredSubmissions = statusFilter === "ALL"
    ? alllists
    : alllists.filter((l) => String(l.status) === statusFilter);

  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);



  function decodeHtml(str: any) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const formatDateTime = (ts: any) => {
    if (!ts) return "";

    const date = new Date(ts * 1000);

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatDateOnly = (ts: any) => {
    if (!ts) return "-";
    const num = Number(ts);
    const d = !isNaN(num) && num > 0 ? (num < 10000000000 ? new Date(num * 1000) : new Date(num)) : new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const location = useLocation();

  const loadDetails = async (page = 1, search = "", sort = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);

    try {
      const res = await listFetch("api/sub-assignments", {
          q: search,
          s: sort,
          n: page,
          id: assignmentid + "",
        });

      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const [rlist, setRllList] = useState<any[]>([]);

  const checkDetails = async () => {
    setModel("");
    setcLoading(true);
    setRllList([]);

    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/check-assignment",
        {
          req_id: asslists.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true, // 🔥 REQUIRED
        },
      );

      if (res.data.success) {
        let msg = res.data.message;
        setRllList(res.data.data);
        if (msg === "pending") {
          setModel("pending");
        } else if (msg === "approved") {
          setModel("approved");
        } else if (msg === "rejected") {
          setModel("rejected");
        }
      } else {
        setModel("applyalert");
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
      setcLoading(false);
    }
  };

  const initialForm = {
    name: "",
    gender: "",
    email: "",
    number: "",
    course_name: "",
    batch_name: "",
    qualification: "",
    file: "",
    datetime: "",
    updatetime: "",
    status: "",
    reason: "",
  };

  const [form, setForm] = useState(initialForm);

  const initialApplyForm = {
    note: "",
  };

  const [applyform, setApplyForm] = useState(initialApplyForm);

  const applyAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (!file) {
      setError("❌ Please select a file");
      return;
    }

    try {
      setLoading(true);

      let gof = false;

      // 🔐 Security
      const security = await getSecurity();

      // 1️⃣ Get S3 presigned URL
      const presignRes = await axios.post(
        SERVER_URL + "api/get-upload-url",
        {
          fileName: file.name,
          fileType: file.type,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (presignRes.data?.success && presignRes.data?.uploadURL) {
        gof = true;
      }

      const { uploadURL, key } = presignRes.data;

      // 2️⃣ Upload file to S3 (with progress)
      await axios.put(uploadURL, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const percent = Math.round((e.loaded * 100) / e.total);
          setProgress(percent); // 🔥 progress bar
        },
      });

      if (!gof) {
        setError("Something went wrong, try again");
      } else {
        // 3️⃣ Save assignment data (DB)
        const res = await axios.post(
          SERVER_URL + "api/apply-assignment",
          {
            ...applyform,
            req_id: asslists.req_id,
            file_key: key, // ✅ store S3 key
            file_name: file.name,
            file_type: file.type,
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );

        if (res.data.success) {
          setSuccess(res.data.message);
          toast.success(res.data.message);
          setAllLists((prev) => [res.data.data, ...prev]);
          setForm(initialForm);
          setFile(null);
          setTotal(listtotal + 1);
          setProgress(0);

          setTimeout(() => {
            checkDetails();
          }, 2000);
        } else {
          toast.error(res.data.message);
          setError(res.data.message);
        }
      }
    } catch (err) {
      console.error(err);
      setError("❌ Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn && ustatus == "1") {
      loadDetails(page, search, sort);
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
          Rejected / Revision
        </span>
      );
    }
    return (
      <span className="si-status-pill status-pending">
        <span className="si-status-dot"></span>
        Pending Review
      </span>
    );
  };

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2000} />

      <style>{`
        .si-wrapper {
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
          color: #582fea;
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
          margin-right: 6px;
        }
        .si-total-count-text b {
          font-weight: 700;
          color: #0f172a;
        }
        .si-btn-back {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          color: #334155;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-back:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }
        .si-btn-add {
          background: #582fea;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 2px 6px rgba(88, 47, 234, 0.25);
        }
        .si-btn-add:hover {
          background: #4b24d6;
          box-shadow: 0 4px 10px rgba(88, 47, 234, 0.35);
          transform: translateY(-1px);
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
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.06);
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-total.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-card.card-pending {
          background: #fffbeb;
        }
        .si-stat-card.card-pending.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.card-approved {
          background: #f0fdf4;
        }
        .si-stat-card.card-approved.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-rejected {
          background: #fff1f2;
        }
        .si-stat-card.card-rejected.active {
          border-color: #e11d48 !important;
          box-shadow: 0 0 0 2px rgba(225, 29, 72, 0.25) !important;
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
        }
        .si-select-sort:focus {
          border-color: #582fea;
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
          border-color: #582fea;
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
          background: #582fea;
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .si-reload-btn:hover {
          background: #4824cf;
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
        .si-status-pill.status-approved {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-pill.status-rejected {
          background: #fee2e2;
          color: #b91c1c;
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
        .status-rejected .si-status-dot {
          background: #ef4444;
        }
        .status-pending .si-status-dot {
          background: #f59e0b;
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
        .si-action-btn.btn-view {
          background: #eff6ff;
          color: #2563eb;
        }
        .si-action-btn.btn-view:hover {
          background: #dbeafe;
        }
        .si-action-btn.btn-download {
          background: #ede9fe;
          color: #7c3aed;
        }
        .si-action-btn.btn-download:hover {
          background: #ddd6fe;
        }
        .si-action-btn.btn-reject {
          background: #fee2e2;
          color: #ef4444;
        }
        .si-action-btn.btn-reject:hover {
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
          background: #582fea;
          border-color: #582fea;
          color: #ffffff;
          font-weight: 600;
        }

        /* ================= Submit Assignment Form Styles ================= */
        .sub-form-page {
          background-color: #f8fafc;
          min-height: calc(100vh - 80px);
          padding: 24px 28px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .sub-form-container {
          margin: 0 auto;
        }
        .sub-header-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 22px 26px;
          margin-bottom: 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .sub-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sub-header-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.28);
          flex-shrink: 0;
        }
        .sub-header-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
          line-height: 1.25;
        }
        .sub-header-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .sub-badge-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          background: #eef2ff;
          color: #4f46e5;
        }
        .sub-badge-due {
          background: #fff1f2;
          color: #e11d48;
        }
        .sub-btn-back {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          border-radius: 10px;
          padding: 9px 18px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .sub-btn-back:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }

        /* Context Card (Instructions & Reference) */
        .sub-context-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 20px 24px;
          margin-bottom: 22px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .sub-context-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .sub-context-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sub-context-note {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px 18px;
          font-size: 13.5px;
          color: #334155;
          line-height: 1.6;
          white-space: pre-wrap;
          margin-bottom: 14px;
        }
        .sub-download-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          background: #e0f2fe;
          color: #0369a1;
          font-size: 12.5px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .sub-download-link:hover {
          background: #bae6fd;
          color: #0284c7;
        }

        /* Hero Feedback Cards */
        .sub-feedback-hero {
          border-radius: 16px;
          padding: 24px 28px;
          margin-bottom: 22px;
          border: 1px solid transparent;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .sub-feedback-hero.approved {
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
          border-color: #a7f3d0;
        }
        .sub-feedback-hero.pending {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-color: #fde68a;
        }
        .sub-feedback-hero.rejected {
          background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
          border-color: #fecdd3;
        }
        .sub-feedback-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .sub-feedback-heading {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sub-feedback-msg {
          font-size: 14px;
          line-height: 1.6;
          color: #334155;
          margin-bottom: 14px;
        }
        .sub-reason-box {
          background: #ffffff;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 14px 18px;
          margin-top: 12px;
          box-shadow: 0 1px 3px rgba(225, 29, 72, 0.05);
        }
        .sub-reason-title {
          font-size: 13px;
          font-weight: 700;
          color: #b91c1c;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sub-reason-body {
          font-size: 13.5px;
          color: #0f172a;
          line-height: 1.5;
        }

        /* Form Card */
        .sub-form-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 28px 32px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .sub-form-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        .sub-form-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 20px 0;
        }

        /* Drag-and-drop Dropzone */
        .sub-dropzone {
          border: 2px dashed #c7d2fe;
          border-radius: 14px;
          background: #f8faff;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        .sub-dropzone:hover {
          border-color: #6366f1;
          background: #f5f7ff;
        }
        .sub-dropzone-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: #eef2ff;
          color: #6366f1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px auto;
          transition: transform 0.2s ease;
        }
        .sub-dropzone:hover .sub-dropzone-icon {
          transform: translateY(-2px);
        }
        .sub-dropzone-text {
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }
        .sub-dropzone-hint {
          font-size: 12.5px;
          color: #64748b;
          margin-bottom: 12px;
        }
        .sub-browse-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #4338ca;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        /* Selected File Card */
        .sub-file-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 14px 18px;
          gap: 12px;
        }
        .sub-file-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .sub-file-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #dcfce7;
          color: #16a34a;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sub-file-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sub-file-size {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .sub-file-remove {
          background: #ffffff;
          border: 1px solid #fecaca;
          color: #ef4444;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .sub-file-remove:hover {
          background: #fee2e2;
          color: #b91c1c;
        }

        /* Note Input */
        .sub-note-wrap {
          margin-top: 20px;
        }
        .sub-note-label {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sub-textarea {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13.5px;
          color: #0f172a;
          min-height: 90px;
          outline: none;
          transition: all 0.15s ease;
          background: #ffffff;
          resize: vertical;
          box-sizing: border-box;
        }
        .sub-textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        /* Progress Bar */
        .sub-progress-wrap {
          margin-top: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 16px;
        }
        .sub-progress-bar {
          height: 8px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }
        .sub-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          transition: width 0.2s ease;
        }
        .sub-progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
          color: #6366f1;
          margin-top: 6px;
        }

        /* Actions Bar */
        .sub-action-bar {
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }
        .sub-btn-submit {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 24px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
        }
        .sub-btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
        }
        .sub-btn-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>

      {/* Main Content */}
      <div className="content">
        {mode === "board" && (
          <div className="si-wrapper" style={{ width: "100%" }}>
            {/* Header Card */}
            <div className="si-header-container">
              <div className="si-header-left">
                <div className="si-header-icon-box">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="si-header-title">
                    My Submissions: {asslists.title || "Assignment"}
                  </h3>
                  <p className="si-header-subtitle">
                    Track submission review status, download attachments and inspect instructor feedback
                  </p>
                </div>
              </div>

              <div className="si-header-right">
                <span className="si-total-count-text">
                  Total Submissions <b>{listtotal || alllists.length}</b>
                </span>

                <button
                  type="button"
                  className="si-btn-back"
                  onClick={() => setMainMode("assignments")}
                >
                  <ArrowLeft size={16} /> Back to Assignments
                </button>

                {asslists.status === "1" && (
                  <button
                    type="button"
                    className="si-btn-add"
                    onClick={() => {
                      setSuccess("");
                      setError("");
                      setMode("apply");
                      checkDetails();
                    }}
                  >
                    <UploadCloud size={16} /> Submit Assignment
                  </button>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="si-stats-grid">
              {/* Total Submissions */}
              <div
                className={`si-stat-card card-total ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
                title="Show all submissions"
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#e0f2fe", color: "#0284c7" }}
                >
                  <FileText size={22} />
                </div>
                <div>
                  <div className="si-stat-label">My Submissions</div>
                  <div className="si-stat-value"><AnimatedNumber value={listtotal || alllists.length} pending={loading} id="Assignments-s1" /></div>
                </div>
              </div>

              {/* Pending Review */}
              <div
                className={`si-stat-card card-pending ${statusFilter === "1" ? "active" : ""}`}
                onClick={() => setStatusFilter(prev => prev === "1" ? "ALL" : "1")}
                title={statusFilter === "1" ? "Click to show all" : "Filter by Under Review"}
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#fef3c7", color: "#d97706" }}
                >
                  <Clock size={22} />
                </div>
                <div>
                  <div className="si-stat-label">Under Review</div>
                  <div className="si-stat-value">
                    <AnimatedNumber value={alllists.filter((l) => String(l.status) === "1").length} pending={loading} id="Assignments-s2" />
                  </div>
                </div>
              </div>

              {/* Approved */}
              <div
                className={`si-stat-card card-approved ${statusFilter === "2" ? "active" : ""}`}
                onClick={() => setStatusFilter(prev => prev === "2" ? "ALL" : "2")}
                title={statusFilter === "2" ? "Click to show all" : "Filter by Approved"}
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#dcfce7", color: "#16a34a" }}
                >
                  <CheckCircle size={22} />
                </div>
                <div>
                  <div className="si-stat-label">Approved</div>
                  <div className="si-stat-value">
                    <AnimatedNumber value={alllists.filter((l) => String(l.status) === "2").length} pending={loading} id="Assignments-s3" />
                  </div>
                </div>
              </div>

              {/* Rejected / Revision */}
              <div
                className={`si-stat-card card-rejected ${statusFilter === "0" ? "active" : ""}`}
                onClick={() => setStatusFilter(prev => prev === "0" ? "ALL" : "0")}
                title={statusFilter === "0" ? "Click to show all" : "Filter by Needs Revision"}
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#fff1f2", color: "#e11d48" }}
                >
                  <AlertCircle size={22} />
                </div>
                <div>
                  <div className="si-stat-label">Needs Revision</div>
                  <div className="si-stat-value">
                    <AnimatedNumber value={alllists.filter((l) => String(l.status) === "0").length} pending={loading} id="Assignments-s4" />
                  </div>
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
                      loadDetails(page, search, e.target.value);
                    }}
                  >
                    <option value="New">Newest First</option>
                    <option value="Old">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="si-filter-right">
                <div className="si-search-box">
                  <Search size={16} color="#582fea" />
                  <input
                    type="text"
                    className="si-search-input"
                    placeholder="Search submissions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadDetails(1, search, sort);
                      }
                    }}
                  />
                </div>

                <button data-refresh
                  type="button"
                  className="si-reload-btn"
                  title="Reload submissions"
                  onClick={() => {
                    setSearch("");
                    loadDetails(1, "", sort);
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
                      <th className="si-th" style={{ width: "50px" }}>#</th>
                      <th className="si-th">Assignment Document</th>
                      <th className="si-th">Submitted Date</th>
                      <th className="si-th">Reviewed Date</th>
                      <th className="si-th">Status</th>
                      <th className="si-th" style={{ width: "160px", textAlign: "center" }}>Action / Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "40px" }}>
                          <div className="spinner-border text-primary" role="status"></div>
                        </td>
                      </tr>
                    ) : alllists.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
                          <FileText size={40} color="#cbd5e1" style={{ display: "block", margin: "0 auto 12px" }} />
                          <div style={{ fontWeight: 600, fontSize: "15px", color: "#334155" }}>
                            {search.length === 0 ? "No submissions yet" : "No matching submissions found"}
                          </div>
                          <div style={{ fontSize: "13px", marginTop: "4px" }}>
                            {search.length === 0
                              ? "You haven't submitted your work for this assignment yet."
                              : "Try adjusting your search criteria."}
                          </div>
                          {asslists.status === "1" && (
                            <button
                              type="button"
                              className="si-btn-add"
                              style={{ margin: "16px auto 0", display: "inline-flex" }}
                              onClick={() => {
                                setSuccess("");
                                setError("");
                                setMode("apply");
                                checkDetails();
                              }}
                            >
                              <UploadCloud size={16} /> Submit Assignment Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : filteredSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
                          <FileText size={40} color="#cbd5e1" style={{ display: "block", margin: "0 auto 12px" }} />
                          <div style={{ fontWeight: 600, fontSize: "15px", color: "#334155" }}>
                            No submissions match the selected status
                          </div>
                          <div style={{ fontSize: "13px", marginTop: "4px" }}>
                            Try clearing your status filter to see all submissions.
                          </div>
                          <button
                            type="button"
                            className="si-btn-add"
                            style={{ margin: "16px auto 0", display: "inline-flex" }}
                            onClick={() => setStatusFilter("ALL")}
                          >
                            Show All Submissions
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredSubmissions.map((list, idx) => {
                        const subDt = formatDateTimeLines(list.datetime);
                        const actDt = formatDateTimeLines(list.updatetime);

                        return (
                          <tr key={list.id || idx} className="si-tr">
                            {/* S.No */}
                            <td className="si-td" style={{ color: "#64748b", fontWeight: 500 }}>
                              {(page - 1) * limit + idx + 1}
                            </td>

                            {/* Document */}
                            <td className="si-td">
                              {list.file ? (
                                <a
                                  href={AWS_UPLOADS + list.file}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    background: "#ede9fe",
                                    color: "#7c3aed",
                                    padding: "6px 14px",
                                    borderRadius: 10,
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    textDecoration: "none",
                                    transition: "all 0.15s ease",
                                  }}
                                  title="Download your submitted file"
                                >
                                  <FileText size={15} />
                                  <span>Download Submission</span>
                                  <Download size={13} style={{ marginLeft: 2 }} />
                                </a>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12px" }}>No document</span>
                              )}
                            </td>

                            {/* Submitted Date */}
                            <td className="si-td">
                              <div className="si-datetime-col">
                                <span className="si-date-text">{subDt.date}</span>
                                {subDt.time && <span className="si-time-text">{subDt.time}</span>}
                              </div>
                            </td>

                            {/* Reviewed Date */}
                            <td className="si-td">
                              {list.updatetime && String(list.status) !== "1" ? (
                                <div className="si-datetime-col">
                                  <span className="si-date-text">{actDt.date}</span>
                                  {actDt.time && <span className="si-time-text">{actDt.time}</span>}
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12px" }}>Awaiting review</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="si-td">
                              {renderStatusBadge(list.status)}
                            </td>

                            {/* Action / Feedback */}
                            <td className="si-td" style={{ textAlign: "center" }}>
                              <div className="si-actions-cell" style={{ justifyContent: "center" }}>
                                {list.file && (
                                  <a
                                    className="si-action-btn btn-download"
                                    title="Download Document"
                                    href={AWS_UPLOADS + list.file}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                  >
                                    <Download size={15} />
                                  </a>
                                )}

                                {String(list.status) === "0" ? (
                                  <button
                                    type="button"
                                    className="si-action-btn btn-reject"
                                    title="Review Feedback & Resubmit"
                                    style={{ width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600, gap: 4 }}
                                    onClick={() => {
                                      setSuccess("");
                                      setError("");
                                      setMode("apply");
                                      checkDetails();
                                    }}
                                  >
                                    <RotateCw size={13} />
                                    <span>Resubmit</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="si-action-btn btn-view"
                                    title="View Submission Status"
                                    style={{ width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600, gap: 4 }}
                                    onClick={() => {
                                      setSuccess("");
                                      setError("");
                                      setMode("apply");
                                      checkDetails();
                                    }}
                                  >
                                    <Eye size={13} />
                                    <span>Feedback</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer & Pagination */}
              <div className="si-table-footer">
                <div className="si-footer-left">
                  <select className="si-limit-select" value={limit} disabled>
                    <option value="10">10</option>
                  </select>
                  <span>
                    Showing {listtotal === 0 ? 0 : (page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, listtotal)} of {listtotal} entries
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
                      loadDetails(prev, search, sort);
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Pages */}
                  {Array.from(
                    { length: Math.max(1, lastPage || Math.ceil(listtotal / limit)) },
                    (_, i) => i + 1
                  )
                    .filter((p) => p === 1 || p === lastPage || Math.abs(p - page) <= 1)
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`si-page-btn ${page === p ? "active" : ""}`}
                        onClick={() => {
                          setPage(p);
                          loadDetails(p, search, sort);
                        }}
                      >
                        {p}
                      </button>
                    ))}

                  <button
                    type="button"
                    className="si-page-nav-btn"
                    disabled={page >= lastPage}
                    onClick={() => {
                      const next = Math.min(lastPage, page + 1);
                      setPage(next);
                      loadDetails(next, search, sort);
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/sub-assignments" />
              </div>
            </div>
          </div>
        )}

        {mode === "apply" && (
          <div className="sub-form-page">
            <div className="sub-form-container">
              {/* Header Card */}
              <div className="sub-header-card">
                <div className="sub-header-left">
                  <div className="sub-header-icon">
                    <UploadCloud size={26} />
                  </div>
                  <div>
                    <h1 className="sub-header-title">
                      {rlist.length > 0 && model === "rejected"
                        ? "Resubmit Revised Assignment"
                        : rlist.length > 0 && model === "approved"
                        ? "Assignment Submission & Evaluation"
                        : rlist.length > 0 && model === "pending"
                        ? "Assignment Submission Under Review"
                        : "Submit Assignment"}
                    </h1>
                    <div className="sub-header-subtitle">
                      <span>Assignment: <strong style={{ color: "#0f172a" }}>{decodeHtml(asslists.title) || "Course Assignment"}</strong></span>
                      {asslists.course_name && (
                        <span className="sub-badge-chip">
                          <BookOpen size={11} /> {decodeHtml(asslists.course_name)}
                        </span>
                      )}
                      {asslists.batch_name && (
                        <span className="sub-badge-chip">
                          <Layers size={11} /> {decodeHtml(asslists.batch_name)}
                        </span>
                      )}
                      {asslists.edate && (
                        <span className="sub-badge-chip sub-badge-due">
                          <Clock size={11} /> Due: {formatDateOnly(asslists.edate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMode("board")}
                  className="sub-btn-back"
                >
                  <ArrowLeft size={16} /> Back to Submissions
                </button>
              </div>

              {cloading ? (
                <div className="sub-form-card text-center py-5">
                  <div className="spinner-border text-primary" role="status" style={{ width: 38, height: 38 }} />
                  <p className="mt-3 text-muted" style={{ fontSize: 14, fontWeight: 600 }}>
                    Checking your assignment submission status...
                  </p>
                </div>
              ) : (
                <div>
                  {/* Assignment Guidelines & Reference Context Card */}
                  {(asslists.note || asslists.file || asslists.tname) && (
                    <div className="sub-context-card">
                      <div className="sub-context-header">
                        <h4 className="sub-context-title">
                          <ClipboardList size={18} color="#6366f1" /> Assignment Brief & Guidelines
                        </h4>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          {asslists.tname && (
                            <span className="sub-badge-chip" style={{ background: "#dcfce7", color: "#16a34a" }}>
                              <UserCheck size={12} /> Instructor: {decodeHtml(asslists.tname)}
                            </span>
                          )}
                          {asslists.file && (
                            <a
                              href={AWS_UPLOADS + asslists.file}
                              target="_blank"
                              rel="noreferrer"
                              className="sub-download-link"
                            >
                              <Download size={13} /> Download Resource File
                            </a>
                          )}
                        </div>
                      </div>

                      {asslists.note && (
                        <div className="sub-context-note">
                          {asslists.note}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submission History / Feedback Status Hero Cards */}
                  {rlist.length > 0 && (
                    <div>
                      {rlist.map((l) => (
                        <div key={l.id}>
                          {model === "approved" && (
                            <div className="sub-feedback-hero approved">
                              <div className="sub-feedback-top">
                                <h3 className="sub-feedback-heading" style={{ color: "#059669" }}>
                                  <CheckCircle size={24} color="#059669" />
                                  Assignment Approved & Graded!
                                </h3>
                                <span className="si-status-pill status-approved">
                                  <span className="si-status-dot"></span> Approved
                                </span>
                              </div>

                              <div className="sub-feedback-msg">
                                <p style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                                  Excellent work, {l.name || "Student"}!
                                </p>
                                <p style={{ color: "#334155", marginBottom: 12 }}>
                                  Your assignment submitted on <strong>{formatDateTime(l.datetime)}</strong> has been thoroughly reviewed and marked as approved on <strong>{formatDateTime(l.updatetime)}</strong>.
                                </p>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingTop: "12px", borderTop: "1px solid #bbf7d0" }}>
                                {l.file && (
                                  <a
                                    href={AWS_UPLOADS + l.file}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="sub-download-link"
                                    style={{ background: "#ffffff", borderColor: "#a7f3d0" }}
                                  >
                                    <Download size={14} /> Download Your Approved Submission
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setMode("board")}
                                  className="sub-btn-back"
                                >
                                  ← View All Submissions
                                </button>
                              </div>
                            </div>
                          )}

                          {model === "pending" && (
                            <div className="sub-feedback-hero pending">
                              <div className="sub-feedback-top">
                                <h3 className="sub-feedback-heading" style={{ color: "#d97706" }}>
                                  <Clock size={24} color="#d97706" />
                                  Submission Received & Under Review
                                </h3>
                                <span className="si-status-pill status-pending">
                                  <span className="si-status-dot"></span> Pending Evaluation
                                </span>
                              </div>

                              <div className="sub-feedback-msg">
                                <p style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                                  Hello {l.name || "Student"},
                                </p>
                                <p style={{ color: "#334155", marginBottom: 12 }}>
                                  We received your submission on <strong>{formatDateTime(l.datetime)}</strong>. It is currently placed in the instructor review queue. You will be able to view detailed feedback and grades once the evaluation is complete.
                                </p>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingTop: "12px", borderTop: "1px solid #fde68a" }}>
                                {l.file && (
                                  <a
                                    href={AWS_UPLOADS + l.file}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="sub-download-link"
                                    style={{ background: "#ffffff", borderColor: "#fde68a", color: "#b45309" }}
                                  >
                                    <Download size={14} /> View Your Submitted File
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setMode("board")}
                                  className="sub-btn-back"
                                >
                                  ← Back to Submissions
                                </button>
                              </div>
                            </div>
                          )}

                          {model === "rejected" && (
                            <div className="sub-feedback-hero rejected">
                              <div className="sub-feedback-top">
                                <h3 className="sub-feedback-heading" style={{ color: "#e11d48" }}>
                                  <AlertCircle size={24} color="#e11d48" />
                                  Revisions Requested by Instructor
                                </h3>
                                <span className="si-status-pill status-rejected">
                                  <span className="si-status-dot"></span> Needs Revision
                                </span>
                              </div>

                              <div className="sub-feedback-msg">
                                <p style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                                  Hello {l.name || "Student"},
                                </p>
                                <p style={{ color: "#334155", marginBottom: 10 }}>
                                  Your submission from <strong>{formatDateTime(l.datetime)}</strong> was evaluated on <strong>{formatDateTime(l.updatetime)}</strong> and requires improvements before it can be approved.
                                </p>

                                <div className="sub-reason-box">
                                  <div className="sub-reason-title">
                                    <AlertCircle size={16} /> Instructor Feedback & Required Changes:
                                  </div>
                                  <div className="sub-reason-body">
                                    {l.reason || "Please address instructor remarks, rectify formatting or content, and submit an updated copy."}
                                  </div>
                                </div>
                              </div>

                              {l.file && (
                                <div style={{ paddingTop: "10px", marginBottom: "4px" }}>
                                  <a
                                    href={AWS_UPLOADS + l.file}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="sub-download-link"
                                    style={{ background: "#ffffff", borderColor: "#fecdd3", color: "#b91c1c" }}
                                  >
                                    <Download size={14} /> Download Previous Submission File
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submission Form: Shown for first-time submissions OR revisions */}
                  {(rlist.length === 0 || model === "rejected") && (
                    <div className="sub-form-card">
                      <div className="sub-form-title">
                        {model === "rejected"
                          ? "Upload Revised Assignment File"
                          : "Upload Completed Assignment Document"}
                      </div>
                      <div className="sub-form-subtitle">
                        {model === "rejected"
                          ? "Attach your updated assignment document addressing the instructor's feedback above."
                          : "Attach your completed project, document, or archive for evaluation by your trainer."}
                      </div>

                      {/* Status Alerts */}
                      {success && (
                        <div className="alert alert-success d-flex align-items-center mb-4" role="alert" style={{ borderRadius: "12px", padding: "12px 16px" }}>
                          <CheckCircle size={18} className="me-2 flex-shrink-0" />
                          <div style={{ fontWeight: 600 }}>{success}</div>
                        </div>
                      )}

                      {error && (
                        <div className="alert alert-danger d-flex align-items-center mb-4" role="alert" style={{ borderRadius: "12px", padding: "12px 16px" }}>
                          <AlertCircle size={18} className="me-2 flex-shrink-0" />
                          <div style={{ fontWeight: 600 }}>{error}</div>
                        </div>
                      )}

                      <form onSubmit={applyAssignment}>
                        {/* Hidden Native File Input */}
                        <input
                          id="assignment-file-upload-input"
                          type="file"
                          style={{ display: "none" }}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                          onChange={(e: any) => {
                            if (e.target.files && e.target.files[0]) {
                              setFile(e.target.files[0]);
                              setProgress(0);
                              setForm({ ...form, file: e.target.value });
                            }
                          }}
                        />

                        {/* Interactive Dropzone */}
                        {!file ? (
                          <div
                            className="sub-dropzone"
                            onClick={() => document.getElementById("assignment-file-upload-input")?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                setFile(e.dataTransfer.files[0]);
                                setProgress(0);
                                setForm({ ...form, file: e.dataTransfer.files[0].name });
                              }
                            }}
                          >
                            <div className="sub-dropzone-icon">
                              <UploadCloud size={28} />
                            </div>
                            <div className="sub-dropzone-text">
                              Click to choose a file or drag & drop here
                            </div>
                            <div className="sub-dropzone-hint">
                              Accepted formats: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), PPT/PPTX, TXT, CSV, or ZIP (Max 50MB)
                            </div>
                            <button
                              type="button"
                              className="sub-browse-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                document.getElementById("assignment-file-upload-input")?.click();
                              }}
                            >
                              <UploadCloud size={14} /> Browse from Device
                            </button>
                          </div>
                        ) : (
                          <div className="sub-file-preview">
                            <div className="sub-file-left">
                              <div className="sub-file-icon">
                                <FileSpreadsheet size={22} />
                              </div>
                              <div>
                                <div className="sub-file-name" title={file.name}>
                                  {file.name}
                                </div>
                                <div className="sub-file-size">
                                  {formatBytes(file.size)} • Ready for upload
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="sub-file-remove"
                              title="Remove selected file"
                              onClick={() => {
                                setFile(null);
                                setForm({ ...form, file: "" });
                                setProgress(0);
                              }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}

                        {/* Submission Remarks */}
                        <div className="sub-note-wrap">
                          <label className="sub-note-label">
                            <ClipboardList size={16} color="#6366f1" /> Submission Remarks / Notes for Instructor (Optional)
                          </label>
                          <textarea
                            className="sub-textarea"
                            placeholder="Add any remarks, technical explanations, repository links, or questions for your instructor..."
                            value={applyform.note}
                            onChange={(e) => {
                              setApplyForm({
                                ...applyform,
                                note: e.target.value,
                              });
                            }}
                          />
                        </div>

                        {/* S3 Upload Progress Bar */}
                        {loading && (
                          <div className="sub-progress-wrap">
                            <div className="sub-progress-bar">
                              <div
                                className="sub-progress-fill"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="sub-progress-info">
                              <span>Uploading to secure cloud storage...</span>
                              <span>{progress}%</span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="sub-action-bar">
                          <button
                            type="button"
                            onClick={() => setMode("board")}
                            className="sub-btn-back"
                          >
                            Cancel
                          </button>

                          <button
                            type="submit"
                            className="sub-btn-submit"
                            disabled={loading || !file}
                          >
                            {loading ? (
                              <>
                                <div className="spinner-border spinner-border-sm" role="status" />
                                <span>Uploading & Submitting...</span>
                              </>
                            ) : model === "rejected" ? (
                              <>
                                <RotateCw size={16} />
                                <span>Resubmit Revised Assignment</span>
                              </>
                            ) : (
                              <>
                                <Send size={16} />
                                <span>Submit Assignment</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );


}
