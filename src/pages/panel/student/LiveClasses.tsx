import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ClassHeroCard from "../../../components/ClassHeroCard";
import ClassVideo from "../../../components/ClassVideo";
import PickerSelect from "../../../components/PickerSelect";
import {
  Video,
  ChevronLeft,
  GraduationCap,
  Calendar,
  Clock,
  User,
  Users,
  Play,
  XCircle,
  CheckCircle2,
  X,
  Check,
  Search,
  RotateCw,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { openWebLink } from "../../../utils/openLink";
import { AnimatedNumber, ButtonLoader, InlineLoader, SkeletonCards } from "../../../components/loading";
import { tzShort } from "../../../utils/classTime";

const seo = getSeoByPath("");

export default function Dashboard() {

  const datetime = Math.floor(Date.now() / 1000);

  const getSecurity = async () => {
    const res = await axios.get(
      SERVER_URL + "api/security/token",
      {
        withCredentials: true, // 🔥 REQUIRED
      }
    );

    return res.data;
  };

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const getCourseNamesByIds = (ids: string) => {
    if (!ids || courses.length === 0) return "";
    return ids
      .split(",")                 // "2,5,7" → ["2","5","7"]
      .map(id => id.trim())       // remove spaces
      .map(id => {
        const course = courses.find(c => c.req_id === id);
        return course ? decodeHtml(course.title) : "";
      })
      .filter(title => title)     // remove empty values
      .join(", ");                // join with comma + space
  };

  const [trainers, setTrainers] = useState<any[]>([]);

  const loadTrainers = async () => {
    try {
      const res = await listFetch("api/get-trainers", {
          status: "",
          course: "",
        });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setTrainers(res.data.data);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const getTrainerNameById = (idOrName: string) => {
    if (!idOrName) return "";
    const clean = String(idOrName).trim();
    const found = trainers.find(
      (t: any) => t.mem_id === clean || t.id === clean || t.ukey === clean
    );
    if (found && found.name) return decodeHtml(found.name);
    if (/^[0-9a-fA-F]{20,40}$/.test(clean)) return "";
    return clean;
  };

  const getBatchNameById = (id: string) => {
    if (!id || batches.length === 0) return "";

    for (const res of batches) {
      const batch = res.data.find(b => b.b_id === id);

      if (batch) {
        return decodeHtml(batch.name);
      }
    }
    return "";
  };

  const [loading, setLoading] = useState(true);
  //const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("selection");

  const initialForm = {
    id: "",
    req_id: "",
    sno: "",
    c_id: "",
    b_id: "",
    trainer: "",
    tname: "",
    title: "",
    description: "",
    classdate: "",
    stimings: "",
    etimings: "",
    zoom_link: "",
    passcode: "",
    notes: "",
    file: "",
    pwd: "",
    type: "",
    doc: "",
    attendance: 0,
    datetime: "",
    status: "",
  };
  const [form, setForm] = useState(initialForm);

  function DateTime(ts: any) {
    if (!ts) return "";

    return new Date(ts * 1000)
      .toLocaleDateString("sv-SE"); // YYYY-MM-DD
  }

  const timestampTime = (ts: any) => {
    if (!ts) return "";
    const date = new Date(ts * 1000);
    return date.toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  interface Batch {
    id: number;
    b_id: string;
    c_id: string;
    name: string;
    sdate: string;
    edate: string;
    datetime: string;     // timestamp as string
    status: string;       // "0" | "1" | "1D"
  }

  interface BatchResponse {
    req_id: string;
    data: Batch[];
  }

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  // the full class row (recording fields included) for a class in the form
  const rowOf = (f: any) => alllists.find((r: any) => r.req_id === f.req_id) || f;

  const initstats = {
    pending: 0,
    completed: 0,
    canceled: 0,
    upcoming: 0,
    total: 0
  }
  const [stats, setStats] = useState(initstats);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [usercourses, setUserCourses] = useState<any[]>([]);

  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [courseid, setCourseid] = useState("");
  const [batchid, setBatchid] = useState("");

  /* The signed-in member's own courses (member_courses — students and trainers
     alike). One course: its classes load straight away. Several: the picker
     lists only those. None: a "not enrolled" message. Requests run one after
     another — each one spends the session's single security token. */
  const loadUserCourses = async () => {
    setLoading(true);
    try {
      let userCourseList: any[] = [];
      try {
        const res = await listFetch("api/get-mem-courses", { status: "" });
        if (res.data && res.data.success && Array.isArray(res.data.data)) userCourseList = res.data.data;
      } catch (e) {
        console.error("Error loading user courses:", e);
      }

      const allCourses = await loadCourses(userCourseList);

      // one entry per enrolled course that exists and is active
      const enrolled: any[] = [];
      for (const uc of userCourseList) {
        const ok = allCourses.some((c: any) => c.req_id === uc.c_id && c.status === "1");
        if (ok && !enrolled.some((e) => e.c_id === uc.c_id)) enrolled.push(uc);
      }
      setUserCourses(enrolled);

      const qCid = new URLSearchParams(window.location.search).get("id");
      const pick = (qCid && enrolled.find((e) => e.c_id === qCid)) || (enrolled.length === 1 ? enrolled[0] : null);
      if (pick) {
        await openCourse(pick.c_id, pick.b_id);
      } else {
        setMode("selection");
      }
    } catch (err) {
      console.error("❌ Something went wrong loading courses:", err);
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const newestBatch = (list: any[]) =>
    list.slice().sort((x, y) =>
      String(y.sdate || "").localeCompare(String(x.sdate || "")) || (Number(y.id) || 0) - (Number(x.id) || 0))[0];

  // Select a course and load its classes right away: the enrolled batch, or
  // (none on record) the course's newest active batch.
  const openCourse = async (cid: string, bid?: string) => {
    setCourseid(cid);
    const list = await loadBatches(cid);
    let b = bid || "";
    if (!b) {
      // no enrolled batch on record: the course's newest active batch
      const active = list.filter((x: any) => x.status === "1");
      if (active.length) b = newestBatch(active).b_id;
    }
    setBatchid(b);
    if (b) {
      await loadDetails(1, "", sort, cid, b);
      setMode("board");
    } else {
      setMode("selection");
    }
  };

  const loadCourses = async (userCourseList: any[] = []) => {
    try {

      const res = await listFetch("api/get-courses", {
          status: "",
        });

      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        const mergedCourses = res.data.data.map((course: any) => {
          const exists = Array.isArray(userCourseList) && userCourseList.some(
            (uc: any) => uc.c_id === course.req_id
          );
          return {
            ...course,
            isEnrolled: exists,
          };
        });

        setCourses(mergedCourses);
        return mergedCourses;
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const loadBatches = async (c_id: any): Promise<Batch[]> => {
    if (!c_id || c_id === "null" || c_id === "undefined") return [];
    try {

      const res = await listFetch("api/get-batches", {
          c_id: c_id,
          status: "",
        });

      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setBatches(prev => {
          const filtered = prev.filter(b => b.req_id !== c_id);
          return [
            ...filtered,
            {
              req_id: c_id,
              data: res.data.data,
            },
          ];
        });
        return res.data.data as Batch[];
      }
    } catch (err) {
      console.error(err);
    }
    return [] as Batch[];
  };

  const updateattendace = async () => {

    try {
      const security = await getSecurity();

      const res = await axios.post(SERVER_URL + "api/live-class-join", {
        title: form.title,
        req_id: form.req_id,
        key: security.key,
        token: security.token,
        aut: security.aut,
      },
        {
          withCredentials: true, // 🔥 REQUIRED
        });

      if (res.data.success) {
        if (!openWebLink(form.zoom_link)) alert("This class link isn't a web link (https://…).");
      } else {
        toast.error("❌ Something went wrong");
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
    }

  };

  const location = useLocation();

  const loadDetails = async (page = 1, search = "", sort = "", courseid = "", batchid = "") => {

    setLoading(true);
    setAllLists([]);
    setStats(initstats);
    setPage(page);
    setSearch(search);
    setSort(sort);

    if (courses.length == 0) {
      console.log("courses reloading");
    }

    try {
      const res = await listFetch("api/live-classes", {
        q: search,
        s: sort,
        n: page,
        cid: courseid,
        bid: batchid,
      });

      if (res.data && res.data.success) {
        setAllLists(res.data.data || []);
        setStats(res.data.stats || initstats);
        setLastPage(res.data.lastPage || 1);
      } else {
        toast.error(res.data?.message || "No classes found");
      }

    } catch (err) {
      console.error(err);
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }

  };

  const navigate = useNavigate();

  const moveto = async (id: any) => {

    setSuccess("");
    setError("");

    if (id === "play" && form.type === "2") {
      let message = "";
      let confirm = null;
      if (form.pwd.length >= 1) {
        message = "Please use '" + form.pwd + "' to watch video class";
        confirm = window.prompt(message, form.pwd);
      } else {
        message = "Open video link to watch video class";
        confirm = window.confirm(message);
      }
      if (!confirm) return; // ❌ Cancel clicked
      if (!openWebLink(form.file)) alert("This class link isn't a web link (https://…).");

    } else {
      setMode(id);
    }

  };

  const updateto = async (type: any, list: any) => {

    try {
      let classdate = list.classdate;
      let stimings = list.stimings;
      let etimings = list.etimings;

      setForm({
        id: list.id,
        req_id: list.req_id,
        sno: list.sno,

        c_id: list.c_id,
        b_id: list.b_id,

        trainer: list.trainer,

        tname: list.tname,

        title: list.title,

        description: list.description || "",

        classdate: classdate,

        stimings: stimings,

        etimings: etimings,

        zoom_link: list.zoom_link,

        passcode: list.passcode,

        notes: list.notes,

        file: list.file,

        pwd: list.pwd,

        type: list.type,

        doc: list.doc,

        attendance: list.attendance || 0,

        datetime: list.datetime,

        status: list.status,
      });

    } catch (error) {
      console.log(error);
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
    if (loggedIn) {
      await loadUserCourses();
      if (data.id === "2") await loadTrainers();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {

    const params = new URLSearchParams(location.search);
    const type = params.get("t");
    if (type === "view") {
      setMode("view");
    }
    const courseidx = params.get("id");

    if (courseidx && courseidx !== "null" && courseidx !== "undefined") {
      setCourseid(courseidx);
    } else {
      setCourseid("");
    }

    // ---------- Admin CSS ----------

    initchecklogin();

    return () => {
      //document.body.removeChild(aosrun);
      //document.head.removeChild(maincss);
      //document.head.removeChild(adminlink);
    };

  }, []);

  return (<>

    <Head
      pageTitle={seo.title}
      pageDesc={seo.description}
      pageKeywords={seo.keywords}
    />

    <ToastContainer position="top-right" autoClose={2500} />

    {/* Main Content */}
    <div className="content">

      <div style={{ display: "none" }}>
        {error}{success}
      </div>

      
    {/* Scoped CSS for Redesigned Live Classes Board */}
    <style dangerouslySetInnerHTML={{ __html: `
      .lc-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 22px;
      }
      @media (max-width: 992px) {
        .lc-stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 576px) {
        .lc-stats-grid {
          grid-template-columns: 1fr;
        }
      }
      .lc-stat-card {
        border-radius: 16px;
        padding: 16px 20px;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      }
      .lc-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
      }
      .lc-stat-pending {
        background: #f0f9ff;
        border: 1px solid #e0f2fe;
      }
      .lc-stat-pending.active {
        border-color: #0284c7 !important;
        box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
      }
      .lc-stat-upcoming {
        background: #faf5ff;
        border: 1px solid #f3e8ff;
      }
      .lc-stat-upcoming.active {
        border-color: #582fea !important;
        box-shadow: 0 0 0 2px rgba(88, 47, 234, 0.25) !important;
      }
      .lc-stat-canceled {
        background: #fff1f2;
        border: 1px solid #ffe4e6;
      }
      .lc-stat-canceled.active {
        border-color: #ef4444 !important;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25) !important;
      }
      .lc-stat-completed {
        background: #f0fdf4;
        border: 1px solid #dcfce7;
      }
      .lc-stat-completed.active {
        border-color: #10b981 !important;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25) !important;
      }
      .lc-stat-left {
        display: flex;
        align-items: center;
        gap: 16px;
        z-index: 1;
      }
      .lc-stat-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .lc-stat-pending .lc-stat-icon {
        background-color: #e0f2fe;
      }
      .lc-stat-upcoming .lc-stat-icon {
        background-color: #ede9fe;
      }
      .lc-stat-canceled .lc-stat-icon {
        background-color: #fee2e2;
      }
      .lc-stat-completed .lc-stat-icon {
        background-color: #dcfce7;
      }
      .lc-stat-label {
        font-size: 0.84rem;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 2px;
      }
      .lc-stat-value {
        font-size: 1.65rem;
        font-weight: 800;
        color: #0f172a;
        line-height: 1;
        margin: 0;
      }
      .lc-stat-watermark {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        opacity: 0.12;
      }
      .lc-filter-bar {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 10px 18px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 14px;
      }
      .lc-sort-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lc-sort-label {
        font-size: 0.86rem;
        font-weight: 600;
        color: #374151;
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
      }
      .lc-sort-select {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        height: 38px;
        padding: 4px 14px;
        font-size: 0.86rem;
        font-weight: 500;
        color: #1f2937;
        background-color: #ffffff;
        outline: none;
        cursor: pointer;
      }
      .lc-search-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lc-search-input-wrapper {
        position: relative;
      }
      .lc-search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
        pointer-events: none;
      }
      .lc-search-input {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        height: 38px;
        padding: 4px 14px 4px 36px;
        font-size: 0.86rem;
        color: #1f2937;
        background: #ffffff;
        min-width: 320px;
        outline: none;
        transition: border-color 0.15s ease;
      }
      @media (max-width: 768px) {
        .lc-search-input {
          min-width: 100%;
        }
        .lc-search-group {
          width: 100%;
        }
        .lc-search-input-wrapper {
          flex: 1;
        }
      }
      .lc-search-input:focus {
        border-color: #582fea;
      }
      .lc-reload-btn {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background-color: #582fea;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        cursor: pointer;
        transition: background-color 0.15s ease;
        flex-shrink: 0;
      }
      .lc-reload-btn:hover {
        background-color: #4823c9;
      }
      .lc-item-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 16px 20px;
        margin-bottom: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        position: relative;
        overflow: hidden;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .lc-item-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      @media (max-width: 992px) {
        .lc-item-card {
          flex-direction: column;
          align-items: flex-start;
        }
      }
      .lc-card-left-section {
        display: flex;
        align-items: center;
        gap: 20px;
        flex: 1;
      }
      @media (max-width: 768px) {
        .lc-card-left-section {
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
        }
      }
      .lc-camera-box {
        width: 110px;
        min-width: 110px;
        height: 82px;
        border-radius: 12px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .lc-camera-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        border-radius: 9999px;
        padding: 2px 8px;
        font-size: 0.68rem;
        font-weight: 700;
        color: #ffffff;
      }
      .lc-item-content {
        flex: 1;
      }
      .lc-item-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 10px 0;
      }
      .lc-meta-list {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 24px;
      }
      .lc-meta-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lc-meta-icon {
        color: #582fea;
        flex-shrink: 0;
      }
      .lc-meta-label {
        font-size: 0.73rem;
        color: #94a3b8;
        font-weight: 500;
        line-height: 1.1;
      }
      .lc-meta-val {
        font-size: 0.84rem;
        font-weight: 600;
        color: #1e293b;
        line-height: 1.2;
      }
      .lc-card-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        flex-shrink: 0;
      }
      @media (max-width: 992px) {
        .lc-card-actions {
          width: 100%;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
        }
      }
      .lc-btn-details {
        border: 1.5px solid #c7d2fe;
        background-color: #ffffff;
        color: #582fea;
        border-radius: 8px;
        padding: 6px 16px;
        font-size: 0.85rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .lc-btn-details:hover {
        background-color: #f5f3ff;
        border-color: #a5b4fc;
      }
    
          /* Scoped CSS for Selection Card View */
          .lc-select-card-wrapper {
            margin: 24px auto 40px auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            box-shadow: 0 4px 25px rgba(0, 0, 0, 0.04);
            overflow: hidden;
          }
          .lc-select-card-header {
            background: linear-gradient(90deg, #f8faff 0%, #f1f5fd 50%, #e8edfb 100%);
            padding: 24px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            border-bottom: 1px solid #edf2f7;
          }
          .lc-select-card-header-left {
            display: flex;
            align-items: center;
            gap: 16px;
            z-index: 1;
          }
          .lc-select-header-icon {
            width: 54px;
            height: 54px;
            border-radius: 16px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
          }
          .lc-select-header-title {
            font-size: 1.45rem;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 4px 0;
            letter-spacing: -0.01em;
          }
          .lc-select-header-subtitle {
            font-size: 0.88rem;
            color: #64748b;
            margin: 0;
          }
          .lc-select-card-art {
            height: 95px;
            object-fit: contain;
            pointer-events: none;
            z-index: 1;
          }
          @media (max-width: 640px) {
            .lc-select-card-art {
              display: none;
            }
          }
          .lc-select-card-body {
            padding: 28px 32px 34px 32px;
          }
          .lc-select-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            margin-bottom: 28px;
          }
          @media (max-width: 768px) {
            .lc-select-grid {
              grid-template-columns: 1fr;
              gap: 18px;
            }
            .lc-select-card-body {
              padding: 20px 18px 24px 18px;
            }
            .lc-select-card-header {
              padding: 18px 20px;
            }
          }
          .lc-select-field-group {
            display: flex;
            flex-direction: column;
          }
          .lc-select-label {
            font-size: 0.88rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 3px;
          }
          .lc-select-label .req {
            color: #ef4444;
          }
          /* the <select> fills the whole box and the icon sits on top of it, so the
             browser's option list opens aligned with the box at its full width */
          .lc-select-input-box {
            position: relative;
            background-color: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 12px;
            height: 52px;
            transition: all 0.2s ease;
          }
          .lc-select-input-box:focus-within {
            border-color: #6366f1;
            background-color: #ffffff;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          }
          .lc-select-input-icon {
            position: absolute;
            left: 9px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 1;
            pointer-events: none;
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .lc-select-input-icon.course-icon {
            background-color: #eef2ff;
            color: #4f46e5;
            margin-bottom: 0;
          }
          .lc-select-input-icon.batch-icon {
            background-color: #e0f2fe;
            color: #0284c7;
          }
          .lc-select-dropdown {
            display: block;
            width: 100%;
            height: 100% !important;
            border: none !important;
            border-radius: 11px !important;
            /* keep Bootstrap's arrow (background-image), just no fill */
            background-color: transparent !important;
            background-position: right 16px center !important;
            font-size: 0.92rem;
            font-weight: 600;
            color: #1e293b;
            outline: none !important;
            box-shadow: none !important;
            padding: 0 44px 0 58px !important;
            cursor: pointer;
          }
          .lc-select-dropdown option {
            font-weight: 500;
            color: #1e293b;
            background: #ffffff;
          }
          .lc-select-btn-wrap {
            display: flex;
            justify-content: center;
          }
          .lc-select-submit-btn {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: #ffffff;
            border: none;
            border-radius: 12px;
            padding: 12px 34px;
            font-size: 0.95rem;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 16px rgba(79, 70, 229, 0.35);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .lc-select-submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
            background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          }
          .lc-select-submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

    ` }} />

      {mode === "selection" && (
        <div className="container-fluid p-3">
          <div className="lc-select-card-wrapper">
            {/* Header with illustration */}
            <div className="lc-select-card-header">
              <div className="lc-select-card-header-left">
                <div className="lc-select-header-icon">
                  <Video size={26} color="#ffffff" />
                </div>
                <div>
                  <h3 className="lc-select-header-title">Live Classes</h3>
                  <p className="lc-select-header-subtitle">
                    Select your course and batch to view live classes
                  </p>
                </div>
              </div>
              <img
                src="/images/liveclass-selection-art.png"
                alt="Live Classes"
                className="lc-select-card-art"
              />
            </div>

            {/* Form Body */}
            <div className="lc-select-card-body">
              {loading ? (
                <InlineLoader center label="Loading your courses…" />
              ) : usercourses.length === 0 ? (
                <div className="text-center py-4">
                  <GraduationCap size={34} color="#94a3b8" />
                  <h5 className="mt-2 mb-1">No courses yet</h5>
                  <p className="text-muted mb-0">You're not enrolled in any course yet, so there are no live classes to show.</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!courseid || courseid === "null") {
                      alert("Please select course");
                    } else if (!batchid || batchid === "null") {
                      alert("Please select batch");
                    } else {
                      loadDetails(1, search, sort, courseid, batchid);
                      setMode("board");
                    }
                  }}
                >
                  <div className="lc-select-grid">
                    {/* Course */}
                    <div className="lc-select-field-group">
                      <label className="lc-select-label" htmlFor="student-select-course">
                        Preferred Course <span className="req">*</span>
                      </label>
                      <div className="lc-select-input-box">
                        <div className="lc-select-input-icon course-icon">
                          <GraduationCap size={18} />
                        </div>
                        <PickerSelect
                          id="student-select-course"
                          placeholder="Select Course"
                          emptyText="No courses available"
                          value={courseid}
                          options={courses
                            .filter((c) => c.status === "1" && usercourses.some((uc) => uc.c_id === c.req_id))
                            .map((c) => ({ value: c.req_id, label: decodeHtml(c.title) }))}
                          onChange={(val) => {
                            setCourseid(val);
                            setBatchid(usercourses.find((uc) => uc.c_id === val)?.b_id || "");
                            if (val) {
                              loadBatches(val);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Batch */}
                    <div className="lc-select-field-group">
                      <label className="lc-select-label" htmlFor="student-select-batch">
                        Preferred Batch <span className="req">*</span>
                      </label>
                      <div className="lc-select-input-box">
                        <div className="lc-select-input-icon batch-icon">
                          <Users size={18} />
                        </div>
                        <PickerSelect
                          id="student-select-batch"
                          placeholder={courseid ? "Select Batch" : "Select a course first"}
                          emptyText={courseid ? "No active batches" : "Select a course first"}
                          value={batchid}
                          options={batches
                            .filter((res) => res.req_id === courseid)
                            .flatMap((res) => res.data)
                            .filter((c, i, list) => list.findIndex((x) => x.b_id === c.b_id) === i)
                            .filter((c) => c.status === "1")
                            .filter((c) => {
                              // enrolled in one batch of this course → just that one
                              const mine = usercourses.find((uc) => uc.c_id === courseid)?.b_id;
                              return !mine || c.b_id === mine;
                            })
                            .map((c) => ({ value: c.b_id, label: decodeHtml(c.name) }))}
                          onChange={(val) => setBatchid(val)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="lc-select-btn-wrap">
                    <button
                      type="submit"
                      className="lc-select-submit-btn"
                      disabled={loading}
                    >
                      <Video size={18} color="#ffffff" />
                      <span>{loading ? <ButtonLoader label="Loading..." /> : "Get Classes"}</span>
                      <ArrowRight size={17} color="#ffffff" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === "board" && (

        <div className="container-fluid p-3 p-md-4 liveclass-page">

          {/* Top Header */}
          <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                backgroundColor: "#f3f0ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <Video size={24} color="#582fea" />
              </div>
              <div>
                <h3 className="fw-bold mb-1" style={{ fontSize: "1.35rem", color: "#111827", lineHeight: "1.25" }}>
                  Live Classes Of {getCourseNamesByIds(courseid) || "Selected Course"}
                </h3>
                <p className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
                  View all live classes for this batch
                </p>
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold" style={{ fontSize: "0.95rem", color: "#111827" }}>
                    {getBatchNameById(batchid) || "Selected Batch"}
                  </span>
                  <span style={{
                    backgroundColor: "#ede9fe",
                    color: "#582fea",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "9999px",
                    padding: "2px 8px"
                  }}>
                    Batch
                  </span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={() => moveto("selection")}
                className="btn"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#582fea",
                  border: "1.5px solid #ede9fe",
                  borderRadius: "9999px",
                  padding: "7px 18px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <ChevronLeft size={16} /> Go Back
              </button>
            </div>
          </div>

          {/* 4 Stats Cards */}
          <div className="lc-stats-grid">
            {/* Pending */}
            <div
              className={`lc-stat-card lc-stat-pending ${statusFilter === "pending" ? "active" : ""}`}
              onClick={() => setStatusFilter(prev => prev === "pending" ? "ALL" : "pending")}
              title={statusFilter === "pending" ? "Click to clear filter" : "Filter by Pending classes"}
              role="button"
              tabIndex={0}
            >
              <div className="lc-stat-left">
                <div className="lc-stat-icon">
                  <Calendar size={20} color="#0284c7" />
                </div>
                <div>
                  <div className="lc-stat-label">Pending</div>
                  <div className="lc-stat-value"><AnimatedNumber value={stats.pending} pending={loading} id="LiveClasses-s1" /></div>
                </div>
              </div>
              <Calendar size={56} color="#0284c7" className="lc-stat-watermark" />
            </div>

            {/* Upcoming */}
            <div
              className={`lc-stat-card lc-stat-upcoming ${statusFilter === "upcoming" ? "active" : ""}`}
              onClick={() => setStatusFilter(prev => prev === "upcoming" ? "ALL" : "upcoming")}
              title={statusFilter === "upcoming" ? "Click to clear filter" : "Filter by Upcoming classes"}
              role="button"
              tabIndex={0}
            >
              <div className="lc-stat-left">
                <div className="lc-stat-icon">
                  <Play size={18} fill="#582fea" color="#582fea" />
                </div>
                <div>
                  <div className="lc-stat-label">Upcoming</div>
                  <div className="lc-stat-value"><AnimatedNumber value={stats.upcoming} pending={loading} id="LiveClasses-s2" /></div>
                </div>
              </div>
              <Play size={56} fill="#582fea" color="#582fea" className="lc-stat-watermark" />
            </div>

            {/* Canceled */}
            <div
              className={`lc-stat-card lc-stat-canceled ${statusFilter === "canceled" ? "active" : ""}`}
              onClick={() => setStatusFilter(prev => prev === "canceled" ? "ALL" : "canceled")}
              title={statusFilter === "canceled" ? "Click to clear filter" : "Filter by Canceled classes"}
              role="button"
              tabIndex={0}
            >
              <div className="lc-stat-left">
                <div className="lc-stat-icon">
                  <XCircle size={20} color="#ef4444" />
                </div>
                <div>
                  <div className="lc-stat-label">Canceled</div>
                  <div className="lc-stat-value"><AnimatedNumber value={stats.canceled} pending={loading} id="LiveClasses-s3" /></div>
                </div>
              </div>
              <X size={56} color="#ef4444" className="lc-stat-watermark" />
            </div>

            {/* Completed */}
            <div
              className={`lc-stat-card lc-stat-completed ${statusFilter === "completed" ? "active" : ""}`}
              onClick={() => setStatusFilter(prev => prev === "completed" ? "ALL" : "completed")}
              title={statusFilter === "completed" ? "Click to clear filter" : "Filter by Completed classes"}
              role="button"
              tabIndex={0}
            >
              <div className="lc-stat-left">
                <div className="lc-stat-icon">
                  <CheckCircle2 size={20} color="#10b981" />
                </div>
                <div>
                  <div className="lc-stat-label">Completed</div>
                  <div className="lc-stat-value"><AnimatedNumber value={stats.completed} pending={loading} id="LiveClasses-s4" /></div>
                </div>
              </div>
              <Check size={56} color="#10b981" className="lc-stat-watermark" />
            </div>
          </div>

          {/* Filter / Search Bar */}
          <div className="lc-filter-bar">
            <div className="lc-sort-group">
              <label className="lc-sort-label">
                <SlidersHorizontal size={16} color="#64748b" /> Sort By:
              </label>
              <select
                className="lc-sort-select"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  loadDetails(page, search, e.target.value, courseid, batchid);
                }}
              >
                <option value="New">New</option>
                <option value="Old">Old</option>
              </select>
            </div>

            <div className="lc-search-group">
              <form
                className="lc-search-input-wrapper"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort, courseid, batchid);
                }}
              >
                <Search size={16} className="lc-search-icon" />
                <input
                  type="text"
                  className="lc-search-input"
                  placeholder="Search classes by title, trainer, date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
              <button data-refresh
                type="button"
                className="lc-reload-btn"
                title="Reload"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "", sort, courseid, batchid);
                }}
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>

          {/* Class Cards List */}
          {(() => {
            const displayedLists = alllists
              .filter((list) => {
                if (statusFilter === "pending") return list.status === "1";
                if (statusFilter === "upcoming") return list.status === "1" && Number(list.stimings) > datetime;
                if (statusFilter === "canceled") return list.status === "0";
                if (statusFilter === "completed") return list.status === "2";
                return true;
              })
              .sort((a, b) => {
                const timeA = Number(a.stimings) || 0;
                const timeB = Number(b.stimings) || 0;
                if (sort === "Old") {
                  return timeA - timeB || (Number(a.id) || 0) - (Number(b.id) || 0);
                }
                return timeB - timeA || (Number(b.id) || 0) - (Number(a.id) || 0);
              });

            return (
              <div className="row g-3">
                {alllists.length === 0 ? (
                  <div className="col-12">
                    {loading ? (
                      <SkeletonCards count={3} />
                    ) : (
                      <div className="no-data-card text-center p-5 bg-white rounded-3 border">
                        <i className="fa fa-database no-data-icon mb-3" style={{ fontSize: "2rem", color: "#94a3b8" }}></i>
                        {search.length === 0 ? (
                          <div>
                            <h5 className="fw-bold">No Records</h5>
                            <p className="text-muted">We couldn’t load any live classes for this batch.</p>
                          </div>
                        ) : (
                          <div>
                            <h5 className="fw-bold">No Records Found</h5>
                            <p className="text-muted">We couldn’t find any live classes matching your search.</p>
                          </div>
                        )}
                        <button
                          className="btn btn-primary mt-2"
                          onClick={() => {
                            setSearch("");
                            loadDetails(1, "", "", courseid, batchid);
                          }}
                        >
                          Reload
                        </button>
                      </div>
                    )}
                  </div>
                ) : displayedLists.length === 0 ? (
                  <div className="col-12">
                    <div className="no-data-card text-center p-5 bg-white rounded-3 border">
                      <i className="fa fa-filter no-data-icon mb-3" style={{ fontSize: "2rem", color: "#94a3b8" }}></i>
                      <div>
                        <h5 className="fw-bold">No {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Classes</h5>
                        <p className="text-muted">No live classes match the selected "{statusFilter}" status filter.</p>
                      </div>
                      <button
                        className="btn btn-primary mt-2"
                        onClick={() => setStatusFilter("ALL")}
                      >
                        Clear Filter
                      </button>
                    </div>
                  </div>
                ) : (
                  displayedLists.map((list) => (
                    <ClassCard key={list.id} list={list} />
                  ))
                )}

                <Pagination
                  page={page}
                  total={statusFilter === "ALL" ? stats.total : displayedLists.length}
                  limit={limit}
                  lastPage={statusFilter === "ALL" ? lastPage : 1}
                  onPageChange={(p: any) => {
                    setPage(p);
                    loadDetails(p, search, sort, courseid, batchid);
                  }}
                />
                <div className="col-12 saved-ago-row">
                  <SavedAgo endpoint="api/live-classes" />
                </div>
              </div>
            );
          })()}

        </div>

      )}

      {mode === "view" && (

      <div className="container-fluid p-3 p-md-4 liveclass-page view" style={{ minHeight: "auto", background: "none" }}>

        <div className="mx-auto">
          <ClassHeroCard
            item={rowOf(form)}
            courseName={getCourseNamesByIds(form.c_id || courseid)}
            batchName={getBatchNameById(form.b_id || batchid)}
            trainerName={getTrainerNameById(form.trainer || form.tname) || getTrainerNameById(form.tname) || form.tname}
            isTrainer={false}
            showGoBack={true}
            onGoBack={() => moveto("board")}
            onJoinOrStart={() => {
              const datetime = Math.floor(Date.now() / 1000);
              const st = Number(form.stimings) - (10 * 60);
              if (st >= datetime) {
                alert("You can join before 10min only");
              } else {
                updateattendace();
              }
            }}
            onViewVideo={() => moveto("play")}
          />
        </div>

      </div>

    )}

    {mode === "play" && (

        <div className="container-fluid p-4 liveclass-page view">

          <div className="row">
            {/* Title */}
            <h3 className="fw-bold pagehead" style={{ position: "relative", "padding": "0px" }}><Icon />A Class Details in {getCourseNamesByIds(courseid)}
              <span className="totalcount">
                <a onClick={() => moveto("view")} className="add btn btn-success">Go Back</a>
              </span>
            </h3>
          </div>

          <div className="row g-4 contentbox">
            <div className="class-view-card shadow-sm col-sm-12 p-3 p-md-4">
              <div
                className="lc-player-frame"
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 1100,
                  margin: "0 auto",
                  aspectRatio: "16 / 9",
                  minHeight: 280,
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "#000",
                  boxShadow: "0 18px 40px -20px rgba(15, 23, 42, 0.45)",
                }}
              >
                <ClassVideo item={rowOf(form)} autoPlay className="w-100 h-100" />
              </div>
            </div>
          </div>

        </div>

      )}

    </div>

  </>);

  /* ================= Components ================= */
  function ClassCard({ list }: any) {
    const isCompleted = list.status === "2";
    const isCanceled = list.status === "0";
    const isExpired = !isCompleted && !isCanceled && datetime >= Number(list.stimings);
    
    let statusBorder = "#582fea";
    let cameraBg = "#f5f3ff";
    let cameraColor = "#818cf8";
    let badgeText = "Upcoming";
    let badgeBg = "#582fea";

    if (isCompleted) {
      statusBorder = "#10b981";
      cameraBg = "#ecfdf5";
      cameraColor = "#34d399";
      badgeText = "Completed";
      badgeBg = "#10b981";
    } else if (isCanceled) {
      statusBorder = "#ef4444";
      cameraBg = "#fef2f2";
      cameraColor = "#f87171";
      badgeText = "Canceled";
      badgeBg = "#ef4444";
    } else if (isExpired) {
      statusBorder = "#ef4444";
      cameraBg = "#faf5ff";
      cameraColor = "#818cf8";
      badgeText = "Expired";
      badgeBg = "#ef4444";
    }

    return (
      <div className="col-12">
        <div
          className="lc-item-card"
          style={{ borderLeft: `4px solid ${statusBorder}` }}
        >
          <div className="lc-card-left-section">
            {/* Camera Thumbnail */}
            <div
              className="lc-camera-box"
              style={{ backgroundColor: cameraBg }}
            >
              <span
                className="lc-camera-badge"
                style={{ backgroundColor: badgeBg }}
              >
                {badgeText}
              </span>
              <svg width="44" height="34" viewBox="0 0 24 24" fill={cameraColor}>
                <rect x="2" y="5" width="13" height="14" rx="3" />
                <path d="M16 9.5l5-3v11l-5-3v-5z" />
              </svg>
            </div>

            {/* Title & Meta Details */}
            <div className="lc-item-content">
              <h5 className="lc-item-title">{list.title}</h5>
              <div className="lc-meta-list">
                {/* Batch */}
                <div className="lc-meta-item">
                  <Calendar size={17} color="#582fea" className="lc-meta-icon" />
                  <div>
                    <div className="lc-meta-label">Batch</div>
                    <div className="lc-meta-val">{getBatchNameById(batchid || list.b_id)}</div>
                  </div>
                </div>

                {/* Trainer */}
                <div className="lc-meta-item">
                  <User size={17} color="#582fea" className="lc-meta-icon" />
                  <div>
                    <div className="lc-meta-label">Trainer</div>
                    <div className="lc-meta-val">
                      {getTrainerNameById(list.trainer || list.tname) || list.tname || "Trainer"}
                    </div>
                  </div>
                </div>

                {/* Class Date */}
                <div className="lc-meta-item">
                  <Calendar size={17} color="#582fea" className="lc-meta-icon" />
                  <div>
                    <div className="lc-meta-label">Class Date</div>
                    <div className="lc-meta-val">{DateTime(list.stimings || list.classdate)}</div>
                  </div>
                </div>

                {/* Class Timings */}
                <div className="lc-meta-item">
                  <Clock size={17} color="#582fea" className="lc-meta-icon" />
                  <div>
                    <div className="lc-meta-label">Class Timings</div>
                    <div className="lc-meta-val">
                      {timestampTime(list.stimings)} - {timestampTime(list.etimings)}{" "}
                      <span style={{ fontSize: "0.78em", fontWeight: 600, color: "#64748b" }} title="Shown in your time zone">
                        {tzShort(list.stimings)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attendees */}
                <div className="lc-meta-item">
                  <Users size={17} color="#582fea" className="lc-meta-icon" />
                  <div>
                    <div className="lc-meta-label">Attendees</div>
                    <div className="lc-meta-val">{list.attendance || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="lc-card-actions">
            <button
              type="button"
              className="lc-btn-details"
              onClick={() => updateto("view", list)}
            >
              <span>Class Details</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  function Pagination({
    page,
    total,
    limit,
    lastPage,
    onPageChange,
  }: any) {
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
                className={`dt-paging-button ${p === page ? "current" : ""
                  }`}
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
    return (<>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="15" height="12" rx="2"
          stroke="currentColor" strokeWidth="2" />
        <path d="M18 10L22 8V16L18 14" stroke="currentColor" strokeWidth="2" />
      </svg>
    </>
    );
  }

}

