import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Head, SERVER_URL } from "../../../components/Includes";
import { getSeoByPath } from "../../../utils/seo";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Vote,
  Plus,
  RotateCw,
  ArrowLeft,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  FileText,
  Send,
  Users,
  BarChart3,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  Copy,
  MessageSquare,
  Globe,
  ExternalLink,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

type Question = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
  allowOther?: boolean;
  min?: number;
  max?: number;
};
type Batch = { b_id: string; name: string; c_id: string };
type Course = { req_id: string; title: string };
type SurveyRow = {
  id: number;
  req_id: string;
  title: string;
  description: string;
  target_bid: string;
  batch_name?: string;
  audience?: string; // "students" (one batch) | "public" (a link anyone can answer)
  kind?: string; // "survey" | "feedback": the wording, and the public link /survey/<id> or /feedback/<id>
  target_cid?: string;
  course_name?: string;
  questions: Question[];
  allow_skip: string;
  status: string;
  datetime: number;
  responses: number;
  skips: number;
};
type Resp = {
  id: number;
  mem_id: string;
  name?: string;
  email?: string; // public answers: typed before the questions
  phone?: string;
  answers: Record<string, any>;
  skipped: string;
  datetime: number;
};

const TYPES = [
  { v: "single", l: "Single Select" },
  { v: "multi", l: "Multiple Select" },
  { v: "dropdown", l: "Dropdown" },
  { v: "ranking", l: "Ranking (drag order)" },
  { v: "star", l: "Star Rating (1–5)" },
  { v: "emoji", l: "Emoji Rating" },
  { v: "yesno", l: "Yes / No" },
  { v: "number", l: "Number / Scale" },
  { v: "slider", l: "Slider" },
  { v: "text", l: "Short Answer" },
  { v: "textarea", l: "Long Answer" },
  { v: "date", l: "Date" },
  { v: "time", l: "Time" },
];
const HAS_OPTIONS = ["single", "multi", "dropdown", "ranking"];
const HAS_OTHER = ["single", "multi", "dropdown"];
const HAS_RANGE = ["number", "slider"];
const CHOICE = [
  "single",
  "multi",
  "dropdown",
  "ranking",
  "yesno",
  "star",
  "emoji",
];
const EMOJIS = ["😡", "😞", "😐", "🙂", "😍"];
const PAGE_SIZE = 10;
const uid = () => "q" + Math.random().toString(36).slice(2, 8);

export default function Surveys() {
  const permCan = usePagePerm("surveys");
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "builder" | "responses">("list");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [surveyPage, setSurveyPage] = useState(1);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // builder state
  const emptySurvey = {
    req_id: "",
    title: "",
    description: "",
    kind: "survey", // "survey" | "feedback"
    audience: "students", // "students": one course's batch / "public": a link anyone can answer
    target_cid: "",
    target_bid: "",
    allow_skip: "1",
    status: "1",
  };
  const [survey, setSurvey] = useState<typeof emptySurvey>(emptySurvey);

  // the website page a public survey is answered on
  const publicSurveyUrl = (req_id: string, kind?: string) =>
    `${window.location.origin}/${kind === "feedback" ? "feedback" : "survey"}/${req_id}`;
  const copySurveyLink = (req_id: string, kind?: string) => {
    navigator.clipboard?.writeText(publicSurveyUrl(req_id, kind));
    toast.success(kind === "feedback" ? "Feedback link copied" : "Survey link copied");
  };
  const [questions, setQuestions] = useState<Question[]>([]);

  // responses state
  const [respSurvey, setRespSurvey] = useState<SurveyRow | null>(null);
  const [resps, setResps] = useState<Resp[]>([]);
  const [respQs, setRespQs] = useState<Question[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [respPage, setRespPage] = useState(1);
  const [respTab, setRespTab] = useState<"summary" | "individual">("summary");

  // email picker state
  type Student = {
    mem_id: string;
    name: string;
    email: string;
    status: string;
  };
  const [emailSurvey, setEmailSurvey] = useState<SurveyRow | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string>("");
  const [emailSearch, setEmailSearch] = useState("");
  const EMAIL_BATCH = 10;

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;
  // List reads come from the saved copy when there is one (utils/listCache.ts)
  const LIST_READS = ["api/surveys", "api/get-batches", "api/get-courses", "api/surveys/get", "api/surveys/students", "api/surveys/responses"];
  const post = async (path: string, body: any = {}) => {
    if (LIST_READS.includes(path)) return (await listFetch(path, body)).data;
    const s = await getSecurity();
    return (
      await axios.post(
        SERVER_URL + path,
        { ...body, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      )
    ).data;
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const r = await post("api/surveys", { n: 1, s: "New" });
      if (r.success) {
        setSurveys(r.data || []);
        setSurveyPage(1);
      } else toast.error(r.message || "Failed to load surveys");
    } catch {
      toast.error("Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const r = await post("api/get-batches", { c_id: "", status: "1" });
      if (r.success)
        setBatches(r.data.map((b: any) => ({ b_id: b.b_id, name: b.name, c_id: b.c_id || "" })));
      // courses for "Students" surveys (course first, then its batch)
      const c = await post("api/get-courses", { status: "1" });
      if (c.success)
        setCourses((c.data || []).map((x: any) => ({ req_id: x.req_id, title: x.title })));
      loadSurveys();
    } catch {
      /* non-fatal */
    }
  };

  const initchecklogin = async () => {
    try {
      const res = await axios.get(SERVER_URL + "api/check-login", {
        withCredentials: true,
      });
      if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y")) {
        loadBatches();
      } else navigate("/logout");
    } catch {
      navigate("/logout");
    }
  };
  useEffect(() => {
    initchecklogin();
  }, []);

  /* ---------------- builder ---------------- */
  const newSurvey = () => {
    setSurvey(emptySurvey);
    setQuestions([]);
    setView("builder");
  };

  const editSurvey = async (req_id: string) => {
    try {
      const r = await post("api/surveys/get", { req_id });
      if (!r.success) return toast.error(r.message);
      const p = r.data;
      setSurvey({
        req_id: p.req_id,
        title: p.title,
        description: p.description || "",
        kind: p.kind === "feedback" ? "feedback" : "survey",
        audience: p.audience === "public" ? "public" : "students",
        // older surveys have no course: take it from their batch
        target_cid: p.target_cid || batches.find((b) => b.b_id === p.target_bid)?.c_id || "",
        target_bid: p.target_bid || "",
        allow_skip: p.allow_skip || "1",
        status: p.status || "1",
      });
      setQuestions(Array.isArray(p.questions) ? p.questions : []);
      setView("builder");
    } catch {
      toast.error("Failed to open survey");
    }
  };

  // the question just added: scrolled to, its text box focused, briefly highlighted
  const [newQid, setNewQid] = useState("");
  const addQuestion = () => {
    const id = uid();
    setQuestions((q) => [
      ...q,
      {
        id,
        type: "single",
        label: "",
        required: true,
        options: ["", ""],
        allowOther: false,
      },
    ]);
    setNewQid(id);
  };
  useEffect(() => {
    if (!newQid) return;
    const card = document.querySelector<HTMLElement>(`[data-qid="${newQid}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.querySelector<HTMLInputElement>("input.form-control")?.focus({ preventScroll: true });
    }
    const t = window.setTimeout(() => setNewQid(""), 1600);
    return () => window.clearTimeout(t);
  }, [newQid]);
  const updateQ = (i: number, patch: Partial<Question>) =>
    setQuestions((q) => q.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const removeQ = (i: number) =>
    setQuestions((q) => q.filter((_, k) => k !== i));
  const moveQ = (i: number, dir: -1 | 1) =>
    setQuestions((q) => {
      const j = i + dir;
      if (j < 0 || j >= q.length) return q;
      const c = [...q];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const saveSurvey = async () => {
    if (!survey.title.trim()) return toast.error("Please enter a survey title");
    if (survey.audience === "students" && !survey.target_bid) return toast.error("Please choose a batch");
    if (!questions.length) return toast.error("Add at least one question");
    for (const q of questions) {
      if (!q.label.trim()) return toast.error("Every question needs a label");
      if (
        HAS_OPTIONS.includes(q.type) &&
        !(q.options || []).filter(Boolean).length
      )
        return toast.error(`"${q.label || q.type}" needs at least one option`);
    }
    setBusy(true);
    try {
      const r = await post("api/surveys/save", {
        req_id: survey.req_id,
        title: survey.title,
        description: survey.description,
        kind: survey.kind,
        audience: survey.audience,
        target_cid: survey.audience === "public" ? "" : survey.target_cid,
        target_bid: survey.audience === "public" ? "" : survey.target_bid,
        allow_skip: survey.allow_skip,
        status: survey.status,
        questions: questions.map((q) => ({
          ...q,
          options: HAS_OPTIONS.includes(q.type)
            ? (q.options || []).filter(Boolean)
            : undefined,
          allowOther: HAS_OTHER.includes(q.type) ? !!q.allowOther : undefined,
          min: HAS_RANGE.includes(q.type)
            ? (q.min ?? (q.type === "slider" ? 0 : 1))
            : undefined,
          max: HAS_RANGE.includes(q.type)
            ? (q.max ?? (q.type === "slider" ? 100 : 10))
            : undefined,
        })),
      });
      if (r.success) {
        toast.success(
          r.message + (r.emailed ? ` · emailed ${r.emailed} student(s)` : ""),
        );
        setView("list");
        loadSurveys();
      } else toast.error(r.message);
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteSurvey = async (row: SurveyRow) => {
    if (
      !window.confirm(
        `Delete survey "${row.title}" and all ${row.responses + row.skips} response(s)? This cannot be undone.`,
      )
    )
      return;
    try {
      const r = await post("api/surveys/delete", { req_id: row.req_id });
      if (r.success) {
        toast.success(r.message);
        setSurveys((p) => p.filter((x) => x.req_id !== row.req_id));
      } else toast.error(r.message);
    } catch {
      toast.error("Delete failed");
    }
  };

  const toggleSurvey = async (row: SurveyRow) => {
    const path = row.status === "1" ? "api/surveys/disable" : "api/surveys/enable";
    try {
      const r = await post(path, { req_id: row.req_id });
      if (r.success) {
        toast.success(r.message + (r.emailed ? ` · emailed ${r.emailed}` : ""));
        setSurveys((p) =>
          p.map((x) =>
            x.req_id === row.req_id
              ? { ...x, status: row.status === "1" ? "1S" : "1" }
              : x,
          ),
        );
      } else toast.error(r.message);
    } catch {
      toast.error("Failed");
    }
  };

  // Open the student picker for a survey's batch.
  const openEmail = async (row: SurveyRow) => {
    setEmailSurvey(row);
    setStudents([]);
    setSel(new Set());
    setEmailSearch("");
    setEmailLoading(true);
    try {
      const r = await post("api/surveys/students", { req_id: row.req_id });
      if (r.success) setStudents(r.data || []);
      else toast.error(r.message);
    } catch {
      toast.error("Failed to load students");
    } finally {
      setEmailLoading(false);
    }
  };

  const canEmail = (st: Student) => st.status !== "answered" && !!st.email;
  const emailFiltered = students.filter((st) => {
    const q = emailSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (st.name || "").toLowerCase().includes(q) ||
      (st.email || "").toLowerCase().includes(q)
    );
  });
  const eligibleFiltered = emailFiltered.filter(canEmail);

  const toggleOne = (st: Student) => {
    if (!canEmail(st)) return;
    setSel((s) => {
      const n = new Set(s);
      n.has(st.mem_id) ? n.delete(st.mem_id) : n.add(st.mem_id);
      return n;
    });
  };
  const allSelected =
    eligibleFiltered.length > 0 &&
    eligibleFiltered.every((s) => sel.has(s.mem_id));
  const toggleAll = () =>
    setSel(
      allSelected ? new Set() : new Set(eligibleFiltered.map((s) => s.mem_id)),
    );

  const chunk = <T,>(arr: T[], n: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const sendSurveyEmail = async (memIds: string[], busyKey: string) => {
    if (!emailSurvey) return;
    const targets = memIds.filter((id) => {
      const st = students.find((s) => s.mem_id === id);
      return st && canEmail(st);
    });
    if (!targets.length) {
      toast.info("No pending students to email");
      return;
    }
    setSendingId(busyKey);
    try {
      let total = 0;
      const batches = chunk(targets, EMAIL_BATCH);
      for (const b of batches) {
        const r = await post("api/surveys/send-email", {
          req_id: emailSurvey.req_id,
          mem_ids: b,
        });
        if (r.success) total += r.emailed || 0;
        else {
          toast.error(r.message);
          break;
        }
      }
      toast.success(
        `Email sent to ${total} student(s)${batches.length > 1 ? ` in ${batches.length} batches` : ""}`,
      );
    } catch {
      toast.error("Email failed");
    } finally {
      setSendingId("");
    }
  };

  /* ---------------- responses ---------------- */
  const openResponses = async (row: SurveyRow) => {
    setRespSurvey(row);
    setResps([]);
    setRespQs(row.questions || []);
    setRespPage(1);
    setRespTab("summary");
    setView("responses");
    try {
      const r = await post("api/surveys/responses", { req_id: row.req_id });
      if (r.success) {
        setResps(r.data || []);
        setRespQs(r.survey?.questions || []);
        setTotalStudents(r.totalStudents || 0);
      } else toast.error(r.message);
    } catch {
      toast.error("Failed to load responses");
    }
  };

  const tsDate = (ts: number) =>
    ts ? new Date(ts * 1000).toLocaleString("en-IN") : "—";
  const answerText = (v: any) =>
    Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);

  const answered = resps.filter((r) => r.skipped === "0");
  const skipped = resps.filter((r) => r.skipped === "1");

  const exportRows = (rows: any[] = answered) =>
    rows.map((r, i) => {
      const row: Record<string, any> = {
        "S No": rows.length - i,
        [respSurvey?.audience === "public" ? "Name" : "Student"]: r.name || r.mem_id,
      };
      if (respSurvey?.audience === "public") {
        row["Email"] = r.email || "";
        row["Phone"] = r.phone || "";
      }
      respQs.forEach((q) => {
        row[q.label || q.id] = answerText(r.answers?.[q.id]);
      });
      row["Submitted"] = tsDate(r.datetime);
      return row;
    });
  const exportName = () => `survey-${respSurvey?.req_id?.slice(-6) || "responses"}`;
  const exportExcel = (rows: any[] = answered) => {
    if (!rows.length) return toast.error("No responses to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `${exportName()}.xlsx`,
    );
  };
  const exportCSV = (rows: any[] = answered) => {
    if (!rows.length) return toast.error("No responses to export");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows(rows)));
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `${exportName()}.csv`,
    );
  };

  const tally = (q: Question) => {
    const counts: Record<string, number> = {};
    let sum = 0,
      n = 0;
    for (const r of answered) {
      const v = r.answers?.[q.id];
      if (v == null || v === "") continue;
      if (Array.isArray(v))
        v.forEach((x) => {
          counts[String(x)] = (counts[String(x)] || 0) + 1;
        });
      else {
        counts[String(v)] = (counts[String(v)] || 0) + 1;
        const num = Number(v);
        if (!isNaN(num)) {
          sum += num;
          n++;
        }
      }
    }
    return { counts, avg: n ? sum / n : null, n };
  };

  // Filtered surveys
  const filteredSurveys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return surveys.filter((p) => {
      if (
        q &&
        !`${p.title} ${p.batch_name || p.target_bid}`.toLowerCase().includes(q)
      )
        return false;
      if (statusFilter === "active" && p.status !== "1") return false;
      if (statusFilter === "disabled" && p.status === "1") return false;
      if (statusFilter === "responses" && Number(p.responses || 0) <= 0)
        return false;
      return true;
    });
  }, [surveys, search, statusFilter]);

  const totalSurveyPages = Math.max(
    1,
    Math.ceil(filteredSurveys.length / PAGE_SIZE),
  );
  const surveyPageSafe = Math.min(surveyPage, totalSurveyPages);
  const surveyRows = filteredSurveys.slice(
    (surveyPageSafe - 1) * PAGE_SIZE,
    surveyPageSafe * PAGE_SIZE,
  );

  const totalRespPages = Math.max(1, Math.ceil(answered.length / PAGE_SIZE));
  const respPageSafe = Math.min(respPage, totalRespPages);
  const respRows = answered.slice(
    (respPageSafe - 1) * PAGE_SIZE,
    respPageSafe * PAGE_SIZE,
  );

  // Excel / CSV: the responses on this page, or all of them
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: respRows,
      total: answered.length,
      fetchAll: async () => ({ rows: answered }),
      run: (rows) => (format === "excel" ? exportExcel(rows) : exportCSV(rows)),
    });

  const activeSurveysCount = useMemo(
    () => surveys.filter((p) => p.status === "1").length,
    [surveys],
  );
  const totalResponsesCount = useMemo(
    () => surveys.reduce((sum, p) => sum + (p.responses || 0), 0),
    [surveys],
  );

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2500} />

      <style>{`
        /* audience switch (Students / Public) and the public link box */
        .pl-aud { display:flex; gap:6px; padding:4px; background:#f1f5f9; border-radius:12px; }
        .pl-aud-opt { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:7px; height:38px;
          border:0; border-radius:9px; background:transparent; color:#475569; font-weight:600; font-size:14px; cursor:pointer; transition:background .15s, color .15s; }
        .pl-aud-opt:hover { color:#1e293b; }
        .pl-aud-opt.on { background:#fff; color:var(--ad-brand); box-shadow:0 1px 3px rgba(15,23,42,.12); }
        /* responses: Visual Summary / Individual Answers */
        .pl-tab { display:inline-flex; align-items:center; gap:7px; padding:7px 16px; border-radius:10px; border:1.5px solid #e2e8f0;
          background:#fff; color:#475569; font-size:13.5px; font-weight:600; cursor:pointer; transition:background .15s, color .15s, border-color .15s; }
        .pl-tab:hover { border-color:#c4b5fd; color:var(--ad-brand); background:#faf8ff; }
        .pl-tab.on, .pl-tab.on:hover { background:var(--ad-brand); border-color:var(--ad-brand); color:#fff; }
        /* a question just added with "Add Question" */
        .pl-q-new { animation: pl-q-flash 1.6s ease; }
        @keyframes pl-q-flash { 0%, 35% { box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), .35); border-color: var(--ad-brand) !important; } 100% { box-shadow: 0 0 0 0 rgba(var(--ad-brand-rgb), 0); } }
        .pl-public { display:flex; gap:12px; align-items:flex-start; padding:14px 16px; border:1px solid #c7d2fe; border-radius:12px; background:#f5f7ff; color:var(--ad-brand-2); }
        .pl-public > svg { flex-shrink:0; margin-top:2px; }
        .pl-public-body { flex:1; min-width:0; color:#1e293b; font-size:13.5px; }
        .pl-public-link { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .pl-public-link code { flex:1 1 260px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          background:#fff; border:1px solid #dbe1f0; border-radius:8px; padding:7px 10px; color:var(--ad-brand-2); font-size:12.5px; }
        .pl-public-btn { display:inline-flex; align-items:center; gap:5px; height:34px; padding:0 12px; border-radius:8px;
          border:1px solid #c7d2fe; background:#fff; color:var(--ad-brand-2) !important; font-size:12.5px; font-weight:600; text-decoration:none; cursor:pointer; }
        .pl-public-btn:hover { background:#eef2ff; }
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
        .si-header-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
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
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #ede9fe;
          color: var(--ad-brand);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        .si-total-badge b {
          font-weight: 700;
        }
        .si-btn-primary {
          background: var(--ad-brand);
          border: 1.5px solid var(--ad-brand);
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-primary:hover {
          background: var(--ad-brand-2);
          border-color: var(--ad-brand-2);
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

        /* Stats KPI Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }
        .si-stat-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid #eef2f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          cursor: pointer;
          user-select: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.kpi-purple.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
        }
        .si-stat-card.kpi-green.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.kpi-amber.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.kpi-blue.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .si-stat-icon-wrapper.purple {
          background: #f5f3ff;
          color: var(--ad-brand);
        }
        .si-stat-icon-wrapper.green {
          background: #f0fdf4;
          color: #16a34a;
        }
        .si-stat-icon-wrapper.amber {
          background: #fffbeb;
          color: #d97706;
        }
        .si-stat-icon-wrapper.blue {
          background: #f0f9ff;
          color: #0284c7;
        }
        .si-stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
          display: block;
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
          gap: 12px;
          margin-bottom: 20px;
          border: 1px solid #edf2f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
        }
        .si-filter-select-wrapper {
          position: relative;
        }
        .si-filter-select {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 32px 8px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          background-color: #ffffff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          appearance: none;
          cursor: pointer;
          outline: none;
          min-width: 150px;
        }
        .si-filter-select:focus {
          border-color: var(--ad-brand);
        }
        .si-search-box {
          display: flex;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 12px;
          background: #ffffff;
          min-width: 260px;
          gap: 8px;
        }
        .si-search-box:focus-within {
          border-color: var(--ad-brand);
        }
        .si-search-icon {
          color: #94a3b8;
          flex-shrink: 0;
        }
        .si-search-box input {
          border: none;
          outline: none;
          font-size: 13px;
          color: #1e293b;
          width: 100%;
          background: transparent;
        }
        .si-reload-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--ad-brand);
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
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
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
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
        .si-action-btn.view {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.view:hover {
          background: #ddd6fe;
        }
        .si-action-btn.delete {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-action-btn.delete:hover {
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
        .si-table-info {
          font-size: 13px;
          color: #64748b;
        }
        .si-pagination {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-page-nav-btn {
          height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
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


      .dashboard-wrapper .btn {
          color: #000000;
      }

      `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper">
          {/* ============ LIST VIEW ============ */}
          {view === "list" && (
            <>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Vote size={24} />
                  </div>
                  <div>
                    <div className="si-header-title-row">
                      <h3 className="si-header-title">Surveys</h3>
                      <span className="si-total-badge">
                        Total <b>{surveys.length}</b>
                      </span>
                    </div>
                    <p className="si-header-subtitle">
                      Create interactive batch feedback surveys. Students answer
                      in a popup inside their panel.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  {permCan("create") && (
                    <button className="si-btn-primary" onClick={newSurvey}>
                      <Plus size={16} /> New Survey
                    </button>
                  )}
                </div>
              </div>

              {/* Stats KPI Grid */}
              <div className="si-stats-grid">
                <div
                  className={`si-stat-card kpi-purple ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter("all");
                    setSurveyPage(1);
                  }}
                  title="Show all surveys"
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper purple">
                    <Vote size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Total Surveys</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={surveys.length} pending={loading} id="Surveys-s1" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card kpi-green ${statusFilter === "active" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "active" ? "all" : "active",
                    );
                    setSurveyPage(1);
                  }}
                  title={
                    statusFilter === "active"
                      ? "Click to show all surveys"
                      : "Filter by active surveys"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper green">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Active Surveys</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={activeSurveysCount} pending={loading} id="Surveys-s2" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card kpi-amber ${statusFilter === "disabled" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "disabled" ? "all" : "disabled",
                    );
                    setSurveyPage(1);
                  }}
                  title={
                    statusFilter === "disabled"
                      ? "Click to show all surveys"
                      : "Filter by disabled surveys"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper amber">
                    <XCircle size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Disabled Surveys</span>
                    <h4 className="si-stat-value">
                      <AnimatedNumber value={surveys.length - activeSurveysCount} pending={loading} id="Surveys-s3" />
                    </h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card kpi-blue ${statusFilter === "responses" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "responses" ? "all" : "responses",
                    );
                    setSurveyPage(1);
                  }}
                  title={
                    statusFilter === "responses"
                      ? "Click to show all surveys"
                      : "Filter surveys with responses"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper blue">
                    <Users size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Total Responses</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={totalResponsesCount} pending={loading} id="Surveys-s4" /></h4>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <div className="si-filter-select-wrapper">
                  <select
                    className="si-filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setSurveyPage(1);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Surveys</option>
                    <option value="disabled">Disabled Surveys</option>
                    <option value="responses">Has Responses</option>
                  </select>
                </div>

                <ListSearch
                  placeholder="Search by survey title or batch…"
                  value={search}
                  onChange={(e) => {
                      setSearch(e.target.value);
                      setSurveyPage(1);
                    }}
                />

                <div className="ms-auto d-flex align-items-center gap-2">
                  <button data-refresh
                    className="reload-btn"
                    title="Refresh"
                    onClick={loadSurveys}
                    disabled={loading}
                  >
                    <RotateCw size={15} />
                  </button>
                </div>
              </div>

              {/* Table Card */}
              <div className="si-table-card">
                <div className="si-table-responsive">
                  <table className="si-table">
                    <thead className="si-thead">
                      <tr>
                        <th className="si-th">Survey Title</th>
                        <th className="si-th">Audience</th>
                        <th className="si-th">Responses & Skips</th>
                        <th className="si-th">Status</th>
                        <th className="si-th text-end" style={{ width: 190 }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {loading ? (
                        <SkeletonRows />
                      ) : surveyRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-5 text-muted"
                          >
                            No surveys found. Click “New Survey” to create one.
                          </td>
                        </tr>
                      ) : (
                        surveyRows.map((p) => (
                          <tr key={p.req_id} className="si-tr">
                            <td className="si-td">
                              <div>
                                <div
                                  className="fw-bold text-dark"
                                  style={{ fontSize: "14px" }}
                                >
                                  {p.title}
                                </div>
                                <small
                                  className="text-muted"
                                  style={{ fontSize: "12px" }}
                                >
                                  {p.kind === "feedback" ? "Feedback" : "Survey"} · {p.questions?.length || 0} question(s)
                                </small>
                              </div>
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background: "#ede9fe",
                                  color: "var(--ad-brand)",
                                  fontWeight: 600,
                                }}
                              >
                                {p.audience === "public" ? (
                                  <><Globe size={12} style={{ marginRight: 4, verticalAlign: "-1px" }} />Public</>
                                ) : (
                                  p.batch_name || p.target_bid
                                )}
                              </span>
                              {p.audience !== "public" && p.course_name && (
                                <small className="d-block text-muted mt-1" style={{ fontSize: "11.5px" }}>
                                  {p.course_name}
                                </small>
                              )}
                            </td>

                            <td className="si-td">
                              <span
                                style={{
                                  fontSize: "13.5px",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                }}
                              >
                                {p.responses} answered
                              </span>
                              <span
                                className="text-muted ms-1"
                                style={{ fontSize: "12px" }}
                              >
                                ({p.skips} skipped)
                              </span>
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background:
                                    p.status === "1" ? "#dcfce7" : "#fee2e2",
                                  color:
                                    p.status === "1" ? "#166534" : "#991b1b",
                                }}
                              >
                                <span
                                  className="si-status-dot"
                                  style={{
                                    background:
                                      p.status === "1" ? "#16a34a" : "#dc2626",
                                  }}
                                />
                                {p.status === "1" ? "Active" : "Disabled"}
                              </span>
                            </td>

                            <td className="si-td text-end">
                              <div className="d-inline-flex align-items-center gap-1">
                                {permCan("responses") && (
                                  <button
                                    className="btn btn-sm btn-outline-secondary"
                                    style={{
                                      borderRadius: "8px",
                                      fontSize: "11.5px",
                                      fontWeight: 600,
                                      padding: "4px 8px",
                                    }}
                                    title="View Responses"
                                    onClick={() => openResponses(p)}
                                  >
                                    Responses
                                  </button>
                                )}
                                {p.audience === "public" ? (
                                  <button
                                    className="si-action-btn view"
                                    title="Copy public link"
                                    onClick={() => copySurveyLink(p.req_id, p.kind)}
                                  >
                                    <Copy size={14} />
                                  </button>
                                ) : permCan("send") && (
                                  <button
                                    className="si-action-btn view"
                                    title="Email Survey to Students"
                                    onClick={() => openEmail(p)}
                                  >
                                    <Mail size={14} />
                                  </button>
                                )}
                                {permCan("edit") && (
                                  <button
                                    className="si-action-btn view"
                                    title="Edit Survey"
                                    onClick={() => editSurvey(p.req_id)}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {permCan("status") && (
                                  <button
                                    className={`btn btn-sm ${
                                      p.status === "1"
                                        ? "btn-outline-warning"
                                        : "btn-outline-success"
                                    }`}
                                    style={{
                                      borderRadius: "8px",
                                      fontSize: "11.5px",
                                      fontWeight: 600,
                                      padding: "3px 8px",
                                    }}
                                    onClick={() => toggleSurvey(p)}
                                  >
                                    {p.status === "1" ? "Disable" : "Enable"}
                                  </button>
                                )}
                                {permCan("delete") && (
                                  <button
                                    className="si-action-btn delete"
                                    title="Delete Survey"
                                    onClick={() => deleteSurvey(p)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredSurveys.length > 0 && totalSurveyPages > 1 && (
                  <div className="si-table-footer">
                    <div className="si-table-info">
                      Showing {(surveyPageSafe - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(surveyPageSafe * PAGE_SIZE, filteredSurveys.length)}{" "}
                      of {filteredSurveys.length} surveys
                    </div>
                    <div className="si-pagination">
                      <button
                        className="si-page-nav-btn"
                        disabled={surveyPageSafe <= 1}
                        onClick={() => setSurveyPage(surveyPageSafe - 1)}
                      >
                        « Prev
                      </button>
                      {Array.from({ length: totalSurveyPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalSurveyPages ||
                            Math.abs(p - surveyPageSafe) <= 2,
                        )
                        .map((p, idx, arr) => (
                          <span key={p} className="d-flex align-items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-muted">…</span>
                            )}
                            <button
                              className={`si-page-btn ${p === surveyPageSafe ? "active" : ""}`}
                              onClick={() => setSurveyPage(p)}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        className="si-page-nav-btn"
                        disabled={surveyPageSafe >= totalSurveyPages}
                        onClick={() => setSurveyPage(surveyPageSafe + 1)}
                      >
                        Next »
                      </button>
                    </div>
                  </div>
                )}
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/surveys" />
                </div>
              </div>
            </>
          )}

          {/* ============ BUILDER VIEW ============ */}
          {view === "builder" && (
            <>
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Vote size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      {survey.req_id ? "Edit Survey" : "Create New Survey"}
                    </h3>
                    <p className="si-header-subtitle">
                      Target a batch with multiple choice, ratings, emoji, or
                      text questions.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  <button
                    className="si-btn-outline"
                    onClick={() => setView("list")}
                  >
                    <ArrowLeft size={16} /> Back to Surveys
                  </button>
                </div>
              </div>

              {/* General Settings */}
              <div
                className="card shadow-sm border-0 p-4 mb-4"
                style={{ borderRadius: "16px", background: "#fff" }}
              >
                <h5
                  className="fw-bold mb-3"
                  style={{ fontSize: "16px", color: "#1e293b" }}
                >
                  General Settings
                </h5>
                <div className="row g-3">
                  <div className="col-12">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Survey Title *
                    </label>
                    <input
                      className="form-control"
                      value={survey.title}
                      placeholder="e.g. Weekly GenAI Feedback"
                      onChange={(e) =>
                        setSurvey({ ...survey, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: "13px" }}>
                      Type *
                    </label>
                    <div className="pl-aud" role="radiogroup" aria-label="Type">
                      {([
                        ["survey", "Survey", Vote],
                        ["feedback", "Feedback", MessageSquare],
                      ] as const).map(([val, label, Icon]) => (
                        <button
                          key={val}
                          type="button"
                          role="radio"
                          aria-checked={survey.kind === val}
                          className={"pl-aud-opt" + (survey.kind === val ? " on" : "")}
                          onClick={() => setSurvey({ ...survey, kind: val })}
                        >
                          <Icon size={15} /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: "13px" }}>
                      Audience *
                    </label>
                    <div className="pl-aud" role="radiogroup" aria-label="Audience">
                      {([
                        ["students", "Students", Users],
                        ["public", "Public", Globe],
                      ] as const).map(([val, label, Icon]) => (
                        <button
                          key={val}
                          type="button"
                          role="radio"
                          aria-checked={survey.audience === val}
                          className={"pl-aud-opt" + (survey.audience === val ? " on" : "")}
                          onClick={() => setSurvey({ ...survey, audience: val })}
                        >
                          <Icon size={15} /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {survey.audience === "students" ? (
                    <>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold" style={{ fontSize: "13px" }}>
                          Course *
                        </label>
                        <select
                          className="form-select"
                          value={survey.target_cid}
                          onChange={(e) => {
                            const cid = e.target.value;
                            // a batch of another course doesn't fit any more
                            const keep = batches.some((b) => b.b_id === survey.target_bid && b.c_id === cid);
                            setSurvey({ ...survey, target_cid: cid, target_bid: keep ? survey.target_bid : "" });
                          }}
                        >
                          <option value="">— Select a course —</option>
                          {courses.map((c) => (
                            <option key={c.req_id} value={c.req_id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold" style={{ fontSize: "13px" }}>
                          Target Batch *
                        </label>
                        <select
                          className="form-select"
                          value={survey.target_bid}
                          disabled={!survey.target_cid}
                          onChange={(e) => setSurvey({ ...survey, target_bid: e.target.value })}
                        >
                          <option value="">
                            {survey.target_cid ? "— Select a batch —" : "Choose a course first"}
                          </option>
                          {batches
                            .filter((b) => b.c_id === survey.target_cid)
                            .map((b) => (
                              <option key={b.b_id} value={b.b_id}>
                                {b.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="col-12">
                      <div className="pl-public">
                        <Globe size={18} />
                        <div className="pl-public-body">
                          <b>Anyone with the link can answer — no login needed. They give their name, email and (optional) phone first; one response per person.</b>
                          {survey.req_id ? (
                            <div className="pl-public-link">
                              <code>{publicSurveyUrl(survey.req_id, survey.kind)}</code>
                              <button type="button" className="pl-public-btn" onClick={() => copySurveyLink(survey.req_id, survey.kind)}>
                                <Copy size={14} /> Copy
                              </button>
                              <a className="pl-public-btn" href={publicSurveyUrl(survey.req_id, survey.kind)} target="_blank" rel="noreferrer">
                                <ExternalLink size={14} /> Open
                              </a>
                            </div>
                          ) : (
                            <span className="d-block text-muted" style={{ fontSize: "12.5px" }}>
                              The link appears here (and in the surveys list) once the survey is saved.
                            </span>
                          )}
                          <span className="d-block text-muted mt-1" style={{ fontSize: "12px" }}>
                            Public surveys aren't shown to students in the panel or emailed.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="col-12">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Description (Optional)
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={survey.description}
                      placeholder="Instructions or remarks for students..."
                      onChange={(e) =>
                        setSurvey({ ...survey, description: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Status
                    </label>
                    <select
                      className="form-select"
                      value={survey.status}
                      onChange={(e) =>
                        setSurvey({ ...survey, status: e.target.value })
                      }
                    >
                      <option value="1">
                        Active (available & emailed to batch)
                      </option>
                      <option value="1S">Disabled</option>
                    </select>
                  </div>

                  <div className="col-md-6 d-flex align-items-end">
                    <label
                      className="d-flex align-items-center gap-2 mb-2"
                      style={{ fontSize: "13px" }}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={survey.allow_skip === "1"}
                        onChange={(e) =>
                          setSurvey({
                            ...survey,
                            allow_skip: e.target.checked ? "1" : "0",
                          })
                        }
                      />
                      Allow students to skip this survey
                    </label>
                  </div>
                </div>
              </div>

              {/* Questions Builder */}
              <div
                className="card shadow-sm border-0 p-4 mb-4"
                style={{ borderRadius: "16px", background: "#fff" }}
              >
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5
                    className="fw-bold mb-0"
                    style={{ fontSize: "16px", color: "#1e293b" }}
                  >
                    Questions ({questions.length})
                  </h5>
                  <button className="si-btn-primary" onClick={addQuestion}>
                    <Plus size={15} /> Add Question
                  </button>
                </div>

                {questions.length === 0 ? (
                  <p className="text-muted text-center py-4">
                    No questions added yet. Click “Add Question”.
                  </p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {questions.map((q, i) => (
                      <div
                        key={q.id}
                        data-qid={q.id}
                        className={"p-3" + (q.id === newQid ? " pl-q-new" : "")}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          background: "#f8fafc",
                          scrollMarginTop: "90px",
                        }}
                      >
                        <div className="row g-2 align-items-center">
                          <div className="col-md-6">
                            <label
                              className="form-label mb-1 fw-semibold"
                              style={{ fontSize: "12px" }}
                            >
                              Question {i + 1} *
                            </label>
                            <input
                              className="form-control form-control-sm"
                              value={q.label}
                              placeholder="Type your question here..."
                              onChange={(e) =>
                                updateQ(i, { label: e.target.value })
                              }
                            />
                          </div>

                          <div className="col-md-3">
                            <label
                              className="form-label mb-1 fw-semibold"
                              style={{ fontSize: "12px" }}
                            >
                              Answer Type
                            </label>
                            <select
                              className="form-select form-select-sm"
                              value={q.type}
                              onChange={(e) => {
                                const type = e.target.value;
                                const patch: Partial<Question> = { type };
                                if (
                                  HAS_OPTIONS.includes(type) &&
                                  !(q.options || []).length
                                )
                                  patch.options = ["", ""];
                                if (HAS_RANGE.includes(type)) {
                                  patch.min = type === "slider" ? 0 : 1;
                                  patch.max = type === "slider" ? 100 : 10;
                                }
                                updateQ(i, patch);
                              }}
                            >
                              {TYPES.map((t) => (
                                <option key={t.v} value={t.v}>
                                  {t.l}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-md-3 d-flex align-items-center justify-content-end gap-2 pt-3">
                            <label
                              className="d-flex align-items-center gap-1 mb-0 me-2"
                              style={{ fontSize: "12px" }}
                            >
                              <input
                                type="checkbox"
                                className="form-check-input mt-0"
                                checked={q.required}
                                onChange={(e) =>
                                  updateQ(i, { required: e.target.checked })
                                }
                              />
                              Required
                            </label>
                            <button
                              type="button"
                              className="btn btn-sm btn-light border p-1"
                              disabled={i === 0}
                              onClick={() => moveQ(i, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-light border p-1"
                              disabled={i === questions.length - 1}
                              onClick={() => moveQ(i, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger p-1"
                              onClick={() => removeQ(i)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {HAS_OPTIONS.includes(q.type) && (
                            <div className="col-12 mt-2">
                              <label
                                className="form-label mb-1 text-muted"
                                style={{ fontSize: "11.5px" }}
                              >
                                Options (one per line)
                              </label>
                              <textarea
                                className="form-control form-control-sm"
                                rows={3}
                                value={(q.options || []).join("\n")}
                                onChange={(e) =>
                                  updateQ(i, {
                                    options: e.target.value.split("\n"),
                                  })
                                }
                              />
                              {HAS_OTHER.includes(q.type) && (
                                <label
                                  className="d-flex align-items-center gap-2 mt-2 mb-0"
                                  style={{ fontSize: "12px" }}
                                >
                                  <input
                                    type="checkbox"
                                    className="form-check-input mt-0"
                                    checked={!!q.allowOther}
                                    onChange={(e) =>
                                      updateQ(i, {
                                        allowOther: e.target.checked,
                                      })
                                    }
                                  />
                                  Add an “Other …” option with a free-text box
                                </label>
                              )}
                            </div>
                          )}

                          {HAS_RANGE.includes(q.type) && (
                            <div className="col-12 mt-2 d-flex gap-3">
                              <div style={{ width: 140 }}>
                                <label
                                  className="form-label mb-1 text-muted"
                                  style={{ fontSize: "11px" }}
                                >
                                  Min
                                </label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={q.min ?? 0}
                                  onChange={(e) =>
                                    updateQ(i, { min: Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div style={{ width: 140 }}>
                                <label
                                  className="form-label mb-1 text-muted"
                                  style={{ fontSize: "11px" }}
                                >
                                  Max
                                </label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={q.max ?? 100}
                                  onChange={(e) =>
                                    updateQ(i, { max: Number(e.target.value) })
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {q.type === "star" && (
                            <div
                              className="col-12 text-muted mt-1"
                              style={{ fontSize: "12px" }}
                            >
                              Students pick 1 to 5 ⭐
                            </div>
                          )}
                          {q.type === "emoji" && (
                            <div
                              className="col-12 mt-1"
                              style={{ fontSize: "18px" }}
                            >
                              {EMOJIS.join("  ")}
                            </div>
                          )}
                          {q.type === "yesno" && (
                            <div
                              className="col-12 text-muted mt-1"
                              style={{ fontSize: "12px" }}
                            >
                              Students pick Yes / No
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {questions.length > 0 && (
                  <div className="mt-3" style={{"textAlign":"right"}}>
                    <button className="si-btn-primary" onClick={addQuestion}>
                      <Plus size={15} /> Add Question
                    </button>
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                {permCan("create", "edit") && (
                  <button
                    className="si-btn-primary"
                    disabled={busy}
                    onClick={saveSurvey}
                  >
                    {busy
                      ? "Saving…"
                      : survey.req_id
                        ? "Update Survey"
                        : "Create Survey"}
                  </button>
                )}
                <button
                  className="si-btn-outline"
                  onClick={() => setView("list")}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* ============ RESPONSES VIEW ============ */}
          {view === "responses" && respSurvey && (
            <>
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      Responses — {respSurvey.title}
                    </h3>
                    <p className="si-header-subtitle">
                      {respSurvey.audience === "public"
                        ? <>{answered.length} response(s) · public {respSurvey.kind === "feedback" ? "feedback form" : "survey"}</>
                        : <>{answered.length} answered · {skipped.length} skipped · {totalStudents} student(s) in batch</>}
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  <button className="si-btn-export-excel" onClick={() => askExport("excel")}>
                    <FileSpreadsheet size={15} /> Export Excel
                  </button>
                  <button className="si-btn-export-csv" onClick={() => askExport("csv")}>
                    <FileText size={15} /> Export CSV
                  </button>
                  <button
                    className="si-btn-outline"
                    onClick={() => setView("list")}
                  >
                    <ArrowLeft size={16} /> Back to Surveys
                  </button>
                </div>
              </div>

              <div className="d-flex gap-2 mb-3" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={respTab === "summary"}
                  className={"pl-tab" + (respTab === "summary" ? " on" : "")}
                  onClick={() => setRespTab("summary")}
                >
                  <BarChart3 size={15} /> Visual Summary
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={respTab === "individual"}
                  className={"pl-tab" + (respTab === "individual" ? " on" : "")}
                  onClick={() => setRespTab("individual")}
                >
                  <Users size={15} /> Individual Answers
                </button>
              </div>

              {respTab === "summary" && (
                <div
                  className="card shadow-sm border-0 p-4"
                  style={{ borderRadius: "16px", background: "#fff" }}
                >
                  {answered.length === 0 ? (
                    <p className="text-muted text-center py-4 mb-0">
                      No student responses submitted yet.
                    </p>
                  ) : (
                    <div className="d-flex flex-column gap-4">
                      {respQs.map((q) => {
                        const { counts, avg } = tally(q);
                        const isChoice = CHOICE.includes(q.type);
                        const keys = isChoice
                          ? q.type === "star"
                            ? ["1", "2", "3", "4", "5"]
                            : q.type === "emoji"
                              ? EMOJIS
                              : q.type === "yesno"
                                ? ["Yes", "No"]
                                : q.options || Object.keys(counts)
                          : Object.keys(counts);
                        const maxN = Math.max(
                          1,
                          ...keys.map((k) => counts[k] || 0),
                          ...Object.values(counts),
                        );
                        return (
                          <div
                            key={q.id}
                            className="p-3"
                            style={{
                              background: "#f8fafc",
                              borderRadius: "12px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <div
                              className="fw-bold mb-1 text-dark"
                              style={{ fontSize: "14px" }}
                            >
                              {q.label}
                            </div>
                            <div
                              className="text-muted mb-3"
                              style={{ fontSize: "12px" }}
                            >
                              {TYPES.find((t) => t.v === q.type)?.l}
                              {avg != null
                                ? ` · Average Rating: ${avg.toFixed(2)}`
                                : ""}
                            </div>
                            {isChoice || HAS_RANGE.includes(q.type) ? (
                              <div className="d-flex flex-column gap-2">
                                {keys.map((k) => (
                                  <div
                                    key={k}
                                    className="d-flex align-items-center gap-3"
                                  >
                                    <div
                                      style={{ width: 140, fontSize: "13px" }}
                                      className="text-truncate"
                                      title={k}
                                    >
                                      {k}
                                    </div>
                                    <div
                                      style={{
                                        background: "#e2e8f0",
                                        borderRadius: "6px",
                                        overflow: "hidden",
                                        flex: 1,
                                        height: 12,
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: `${((counts[k] || 0) / maxN) * 100}%`,
                                          background: "var(--ad-brand)",
                                          height: "100%",
                                          borderRadius: "6px",
                                        }}
                                      />
                                    </div>
                                    <div
                                      style={{
                                        width: 50,
                                        fontSize: "13px",
                                        fontWeight: 700,
                                      }}
                                      className="text-end"
                                    >
                                      {counts[k] || 0}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <ul
                                className="mb-0 ps-3"
                                style={{ fontSize: "13px" }}
                              >
                                {answered
                                  .map((r) => r.answers?.[q.id])
                                  .filter((v) => v != null && v !== "")
                                  .map((v, idx) => (
                                    <li key={idx}>{answerText(v)}</li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {respTab === "individual" && (
                <div className="si-table-card">
                  <div className="si-table-responsive">
                    <table className="si-table">
                      <thead className="si-thead">
                        <tr>
                          <th className="si-th" style={{ width: 50 }}>
                            #
                          </th>
                          <th className="si-th" style={{ width: 160 }}>
                            {respSurvey?.audience === "public" ? "Respondent" : "Student"}
                          </th>
                          {respQs.map((q) => (
                            <th key={q.id} className="si-th">
                              {q.label}
                            </th>
                          ))}
                          <th className="si-th" style={{ width: 160 }}>
                            Submitted At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="si-tbody">
                        {answered.length === 0 ? (
                          <tr>
                            <td
                              colSpan={respQs.length + 3}
                              className="text-center py-5 text-muted"
                            >
                              No responses submitted yet.
                            </td>
                          </tr>
                        ) : (
                          respRows.map((r, i) => (
                            <tr key={r.id} className="si-tr">
                              <td
                                className="si-td text-muted fw-semibold"
                                style={{ fontSize: "13px" }}
                              >
                                {answered.length -
                                  ((respPageSafe - 1) * PAGE_SIZE + i)}
                              </td>
                              <td
                                className="si-td fw-bold text-dark"
                                style={{ fontSize: "13px" }}
                              >
                                {r.name || r.mem_id}
                                {(r.email || r.phone) && (
                                  <small className="d-block text-muted fw-normal" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                                    {[r.email, r.phone].filter(Boolean).join(" · ")}
                                  </small>
                                )}
                              </td>
                              {respQs.map((q) => (
                                <td
                                  key={q.id}
                                  className="si-td"
                                  style={{ fontSize: "13px" }}
                                >
                                  {answerText(r.answers?.[q.id]) || (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                              ))}
                              <td
                                className="si-td text-muted"
                                style={{ fontSize: "12.5px" }}
                              >
                                {tsDate(r.datetime)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {answered.length > 0 && totalRespPages > 1 && (
                    <div className="si-table-footer">
                      <div className="si-table-info">
                        Showing {(respPageSafe - 1) * PAGE_SIZE + 1} to{" "}
                        {Math.min(respPageSafe * PAGE_SIZE, answered.length)} of{" "}
                        {answered.length} responses
                      </div>
                      <div className="si-pagination">
                        <button
                          className="si-page-nav-btn"
                          disabled={respPageSafe <= 1}
                          onClick={() => setRespPage(respPageSafe - 1)}
                        >
                          « Prev
                        </button>
                        {Array.from({ length: totalRespPages }, (_, i) => i + 1)
                          .filter(
                            (p) =>
                              p === 1 ||
                              p === totalRespPages ||
                              Math.abs(p - respPageSafe) <= 2,
                          )
                          .map((p, idx, arr) => (
                            <span key={p} className="d-flex align-items-center">
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span className="px-1 text-muted">…</span>
                              )}
                              <button
                                className={`si-page-btn ${p === respPageSafe ? "active" : ""}`}
                                onClick={() => setRespPage(p)}
                              >
                                {p}
                              </button>
                            </span>
                          ))}
                        <button
                          className="si-page-nav-btn"
                          disabled={respPageSafe >= totalRespPages}
                          onClick={() => setRespPage(respPageSafe + 1)}
                        >
                          Next »
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ============ EMAIL STUDENT PICKER MODAL ============ */}
        {emailSurvey && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
            onClick={() => setEmailSurvey(null)}
          >
            <div
              style={{
                position: "relative",
                background: "#ffffff",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "660px",
                maxHeight: "88vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  background: "#f5f3ff",
                  borderBottom: "1px solid #e9e5ff",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h4 className="mb-0 fw-bold" style={{ fontSize: "17px", color: "#1e1b4b" }}>
                    Email Students — {emailSurvey.title}
                  </h4>
                  <p className="mb-0" style={{ fontSize: "12.5px", color: "#6b7280" }}>
                    {emailSurvey.batch_name || emailSurvey.target_bid} · Answered
                    students are skipped automatically.
                  </p>
                </div>
                <button
                  className="btn btn-sm p-1"
                  style={{
                    background: "#ede9fe",
                    color: "var(--ad-brand-2)",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                  aria-label="Close"
                  onClick={() => setEmailSurvey(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 border-bottom d-flex align-items-center justify-content-between gap-2 flex-wrap bg-light">
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 260 }}
                  placeholder="Search student name or email…"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
                <div className="d-flex gap-2">
                  {permCan("send") && (
                    <button
                      className="btn btn-sm btn-outline-dark"
                      style={{ borderRadius: "8px", fontWeight: 600 }}
                      disabled={!sel.size || !!sendingId}
                      onClick={() => sendSurveyEmail([...sel], "selected")}
                    >
                      {sendingId === "selected"
                        ? "Sending…"
                        : `Send Selected (${sel.size})`}
                    </button>
                  )}
                  {permCan("send") && (
                    <button
                      className="btn btn-sm btn-success"
                      style={{ borderRadius: "8px", fontWeight: 600 }}
                      disabled={!eligibleFiltered.length || !!sendingId}
                      onClick={() =>
                        sendSurveyEmail(
                          eligibleFiltered.map((s) => s.mem_id),
                          "all",
                        )
                      }
                    >
                      {sendingId === "all" ? <ButtonLoader label="Sending…" /> : "Send to All Pending"}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-0 overflow-auto" style={{ maxHeight: "400px" }}>
                {emailLoading ? (
                  <div className="text-center text-muted py-4">
                    Loading student roster…
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    No enrolled students in this batch.
                  </div>
                ) : emailFiltered.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    No students match “{emailSearch}”.
                  </div>
                ) : (
                  <table
                    className="table table-hover align-middle mb-0"
                    style={{ fontSize: "13px" }}
                  >
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 40 }} className="ps-3">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={allSelected}
                            onChange={toggleAll}
                            disabled={!eligibleFiltered.length}
                            title="Select all pending"
                          />
                        </th>
                        <th>Student</th>
                        <th style={{ width: 100 }}>Status</th>
                        <th style={{ width: 80 }} className="text-center pe-3">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailFiltered.map((st) => {
                        const answered = st.status === "answered";
                        return (
                          <tr
                            key={st.mem_id}
                            style={answered ? { opacity: 0.6 } : undefined}
                          >
                            <td className="ps-3">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={sel.has(st.mem_id)}
                                disabled={!canEmail(st)}
                                onChange={() => toggleOne(st)}
                              />
                            </td>
                            <td>
                              <div className="fw-semibold text-dark">
                                {st.name || "—"}
                              </div>
                              <small className="text-muted">
                                {st.email || "—"}
                              </small>
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: answered
                                    ? "#dcfce7"
                                    : st.status === "skipped"
                                      ? "#fef9c3"
                                      : "#f1f5f9",
                                  color: answered
                                    ? "#166534"
                                    : st.status === "skipped"
                                      ? "#854d0e"
                                      : "#475569",
                                  textTransform: "capitalize",
                                }}
                              >
                                {st.status}
                              </span>
                            </td>
                            <td className="text-center pe-3">
                              {answered ? (
                                <Check size={16} className="text-success" />
                              ) : permCan("send") ? (
                                <button
                                  className="btn btn-sm btn-outline-success p-1"
                                  style={{ borderRadius: "6px" }}
                                  disabled={!st.email || !!sendingId}
                                  title="Send email to this student"
                                  onClick={() =>
                                    sendSurveyEmail([st.mem_id], st.mem_id)
                                  }
                                >
                                  <Send size={13} />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-3 border-top text-end">
                <button
                  className="si-btn-outline"
                  onClick={() => setEmailSurvey(null)}
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
