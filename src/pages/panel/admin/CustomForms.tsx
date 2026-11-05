import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { getSeoByPath } from "../../../utils/seo";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  FileSpreadsheet,
  Plus,
  RotateCw,
  ArrowLeft,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  FileText,
  Users,
  ClipboardList,
  ArrowUp,
  ArrowDown,
  X,
  ImagePlus,
  RotateCcw,
  UserPlus,
  Link2,
  Info,
  Phone,
  Mail,
  CalendarClock,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import { richMessage } from "../../../utils/richMessage";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

type Field = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
};
type FormRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  fields: Field[];
  status: string;
  datetime: number;
  submissions: number;
};
type Submission = {
  id: number;
  datetime: number;
  answers: Record<string, any>;
  referrer?: string; // from a referral link (?r=<name>); "" when none
};

const FIELD_TYPES = [
  { v: "text", l: "Short text" },
  { v: "textarea", l: "Paragraph" },
  { v: "email", l: "Email" },
  { v: "number", l: "Number" },
  { v: "tel", l: "Phone" },
  { v: "date", l: "Date" },
  { v: "select", l: "Dropdown" },
  { v: "radio", l: "Multiple choice" },
  { v: "checkbox", l: "Checkboxes" },
];
const HAS_OPTIONS = ["select", "radio", "checkbox"];
const PAGE_SIZE = 10;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
const uid = () => "f" + Math.random().toString(36).slice(2, 8);

export default function CustomForms() {
  const permCan = usePagePerm("forms");
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "builder" | "responses">("list");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [formPage, setFormPage] = useState(1);
  const [subPage, setSubPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // builder state
  const emptyForm = {
    id: 0,
    slug: "",
    title: "",
    description: "",
    submit_text: "Submit",
    success_msg: "Thank you! Your response has been recorded.",
    status: "1",
    banner: "", // saved banner image (upload key), "" = the default illustration
  };
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  // the success message as the website will show it (cleaned HTML, CSS kept inside the preview)
  const successPreview = useMemo(
    () => richMessage(form.success_msg || "", ".cf-success-preview-body"),
    [form.success_msg],
  );

  // Banner image shown beside the form on the website (PublicForm.tsx). A new
  // file is uploaded on save; bannerRemove goes back to the default image.
  const BANNER_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const MAX_BANNER_MB = 5;
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerRemove, setBannerRemove] = useState(false);
  const [bannerProgress, setBannerProgress] = useState(0);
  const bannerUrl = (b: string) =>
    !b
      ? ""
      : /^(https?:)?\/\//.test(b) || b.startsWith("/")
        ? b
        : AWS_UPLOADS + b;
  const resetBanner = (saved = "") => {
    if (bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview(bannerUrl(saved));
    setBannerRemove(false);
    setBannerProgress(0);
  };
  const pickBanner = (file: File | null) => {
    if (!file) return;
    if (!BANNER_TYPES.includes(file.type))
      return toast.error("Please choose a PNG, JPG, WEBP or GIF image");
    if (file.size > MAX_BANNER_MB * 1024 * 1024)
      return toast.error(
        "The banner image must be under " + MAX_BANNER_MB + " MB",
      );
    if (bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setBannerRemove(false);
  };
  const clearBanner = () => {
    if (bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview("");
    setBannerRemove(!!form.banner);
  };
  // to the temp upload area first; the save moves it into place
  const uploadBanner = async (file: File) => {
    const sec = await getSecurity();
    const pre = await axios.post(
      SERVER_URL + "api/get-upload-url",
      {
        fileName: file.name,
        fileType: file.type,
        key: sec.key,
        token: sec.token,
        aut: sec.aut,
      },
      { withCredentials: true },
    );
    if (!pre.data?.success)
      throw new Error(pre.data?.message || "Could not start the upload");
    await axios.put(pre.data.uploadURL || pre.data.uploadUrl, file, {
      headers: { "Content-Type": file.type },
      onUploadProgress: (e) => {
        if (e.total) setBannerProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return String(pre.data.key || pre.data.fileKey || "");
  };
  const [fields, setFields] = useState<Field[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);

  // responses state
  const [respForm, setRespForm] = useState<FormRow | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [respFields, setRespFields] = useState<Field[]>([]);
  // Responses table columns: the name, phone and email fields (in form order), at
  // most 4; a form without any shows its first 4 fields. Every answer is still in
  // Detail and in the Excel / CSV exports.
  const tableFields = useMemo(() => {
    const key = respFields.filter(
      (f) => f.type === "tel" || f.type === "email" || (f.type === "text" && /name/i.test(f.label)),
    );
    return (key.length ? key : respFields).slice(0, 4);
  }, [respFields]);
  const [detailSub, setDetailSub] = useState<{
    sub: Submission;
    sno: number;
  } | null>(null);
  const [subSearch, setSubSearch] = useState("");

  // Referral link popup: the form's link with ?r=<name>. The name is saved
  // with each response sent through that link ("Referred By" in Responses).
  const [refForm, setRefForm] = useState<FormRow | null>(null);
  const [refName, setRefName] = useState("");
  const [refLink, setRefLink] = useState("");

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;
  // List reads come from the saved copy when there is one (utils/listCache.ts)
  const LIST_READS = [
    "api/forms/list",
    "api/forms/get",
    "api/forms/submissions",
  ];
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

  const loadForms = async () => {
    setLoading(true);
    try {
      const r = await post("api/forms/list");
      if (r.success) {
        setForms(r.data || []);
        setFormPage(1);
      } else toast.error(r.message || "Failed to load forms");
    } catch {
      toast.error("Failed to load forms");
    } finally {
      setLoading(false);
    }
  };

  const initchecklogin = async () => {
    try {
      const res = await axios.get(SERVER_URL + "api/check-login", {
        withCredentials: true,
      });
      if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y"))
        loadForms();
      else navigate("/logout");
    } catch {
      navigate("/logout");
    }
  };
  useEffect(() => {
    initchecklogin();
  }, []);

  /* ---------------- builder ---------------- */
  const newForm = () => {
    setForm(emptyForm);
    resetBanner();
    setFields([]);
    setSlugTouched(false);
    setView("builder");
  };

  const editForm = async (id: number) => {
    try {
      const r = await post("api/forms/get", { id });
      if (!r.success) return toast.error(r.message);
      const f = r.data;
      setForm({
        id: f.id,
        slug: f.slug,
        title: f.title,
        description: f.description || "",
        submit_text: f.submit_text || "Submit",
        success_msg: f.success_msg || "",
        status: f.status || "1",
        banner: f.banner || "",
      });
      resetBanner(f.banner || "");
      setFields(Array.isArray(f.fields) ? f.fields : []);
      setSlugTouched(true);
      setView("builder");
    } catch {
      toast.error("Failed to open form");
    }
  };

  const addField = () =>
    setFields((f) => [
      ...f,
      {
        id: uid(),
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
      },
    ]);
  const updateField = (i: number, patch: Partial<Field>) =>
    setFields((f) => f.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const removeField = (i: number) =>
    setFields((f) => f.filter((_, k) => k !== i));
  const moveField = (i: number, dir: -1 | 1) =>
    setFields((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.length) return f;
      const c = [...f];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const saveForm = async () => {
    if (!form.title.trim()) return toast.error("Please enter a form title");
    if (!fields.length) return toast.error("Add at least one field");
    for (const fl of fields) {
      if (!fl.label.trim()) return toast.error("Every field needs a label");
      if (
        HAS_OPTIONS.includes(fl.type) &&
        !(fl.options || []).filter(Boolean).length
      )
        return toast.error(
          `"${fl.label || fl.type}" needs at least one option`,
        );
    }
    setBusy(true);
    try {
      let banner_key = "";
      if (bannerFile) {
        try {
          banner_key = await uploadBanner(bannerFile);
        } catch (err: any) {
          toast.error(err?.message || "The banner image could not be uploaded");
          return;
        }
      }
      const r = await post("api/forms/save", {
        id: form.id,
        banner_key,
        banner_remove: bannerRemove ? "1" : "",
        slug: slugify(form.slug || form.title),
        title: form.title,
        description: form.description,
        submit_text: form.submit_text,
        success_msg: form.success_msg,
        status: form.status,
        fields: fields.map((f) => ({
          ...f,
          options: HAS_OPTIONS.includes(f.type)
            ? (f.options || []).filter(Boolean)
            : undefined,
        })),
      });
      if (r.success) {
        toast.success(r.message);
        resetBanner();
        setView("list");
        loadForms();
      } else toast.error(r.message);
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteForm = async (row: FormRow) => {
    if (
      !window.confirm(
        `Delete form "${row.title}" and all ${row.submissions} submission(s)? This cannot be undone.`,
      )
    )
      return;
    try {
      const r = await post("api/forms/delete", { id: row.id });
      if (r.success) {
        toast.success(r.message);
        setForms((f) => f.filter((x) => x.id !== row.id));
      } else toast.error(r.message);
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ---------------- responses ---------------- */
  const openResponses = async (row: FormRow) => {
    setRespForm(row);
    setSubs([]);
    setLoading(true);
    setRespFields(Array.isArray(row.fields) ? row.fields : []);
    setSubPage(1);
    setSubSearch("");
    setView("responses");
    try {
      const s = await post("api/forms/submissions", { slug: row.slug });
      if (s.success) setSubs(s.data || []);
      else toast.error(s.message);
    } catch {
      toast.error("Failed to load responses");
    } finally{
      setLoading(false);
    }
  };

  // Reload button on Responses: the open form's responses again, keeping the
  // search and the page
  const reloadResponses = async () => {
    if (!respForm) return;
    setLoading(true);
    try {
      const s = await post("api/forms/submissions", { slug: respForm.slug });
      if (s.success) setSubs(s.data || []);
      else toast.error(s.message);
    } catch {
      toast.error("Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  const publicUrl = (slug: string) => `${window.location.origin}/form/${slug}`;
  const copyLink = (slug: string) => {
    navigator.clipboard?.writeText(publicUrl(slug));
    toast.success("Link copied");
  };
  const openRefLink = (row: FormRow) => {
    setRefForm(row);
    setRefName("");
    setRefLink("");
  };
  const createRefLink = () => {
    const name = refName.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!refForm || !name) return toast.error("Please enter the referrer's name");
    setRefLink(`${publicUrl(refForm.slug)}?r=${encodeURIComponent(name)}`);
  };
  const copyRefLink = () => {
    navigator.clipboard?.writeText(refLink);
    toast.success("Referral link copied");
  };
  const tsDate = (ts: number) =>
    ts ? new Date(ts * 1000).toLocaleString("en-IN") : "—";
  const answerText = (v: any) =>
    Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);

  const exportRows = (rows: any[] = subs) =>
    rows.map((s, i) => {
      const row: Record<string, any> = { "S No": rows.length - i };
      respFields.forEach((f) => {
        row[f.label || f.id] = answerText(s.answers?.[f.id]);
      });
      row["Referred By"] = s.referrer || "";
      row["Submitted"] = tsDate(s.datetime);
      return row;
    });

  const exportFileName = () => `${respForm?.slug || "form"}-responses`;

  const exportToExcel = (rows: any[] = subs) => {
    if (rows.length === 0) return toast.error("No responses to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `${exportFileName()}.xlsx`,
    );
  };

  const exportToCSV = (rows: any[] = subs) => {
    if (rows.length === 0) return toast.error("No responses to export");
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    const csv = XLSX.utils.sheet_to_csv(ws);
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `${exportFileName()}.csv`,
    );
  };

  // Filtered forms
  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter((f) => {
      if (q && !`${f.title} ${f.slug}`.toLowerCase().includes(q)) return false;
      if (statusFilter === "active" && f.status !== "1") return false;
      if (statusFilter === "disabled" && f.status === "1") return false;
      return true;
    });
  }, [forms, search, statusFilter]);

  const totalFormPages = Math.max(
    1,
    Math.ceil(filteredForms.length / PAGE_SIZE),
  );
  const formPageSafe = Math.min(formPage, totalFormPages);
  const formRows = filteredForms.slice(
    (formPageSafe - 1) * PAGE_SIZE,
    formPageSafe * PAGE_SIZE,
  );

  // Filtered submissions
  const filteredSubs = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter((s) => {
      const answersText = [...Object.values(s.answers || {}).map(answerText), s.referrer || ""]
        .join(" ")
        .toLowerCase();
      return answersText.includes(q);
    });
  }, [subs, subSearch]);

  const totalSubPages = Math.max(1, Math.ceil(filteredSubs.length / PAGE_SIZE));
  const subPageSafe = Math.min(subPage, totalSubPages);
  const subRows = filteredSubs.slice(
    (subPageSafe - 1) * PAGE_SIZE,
    subPageSafe * PAGE_SIZE,
  );

  // Excel / CSV: the responses on this page, or all matching the search
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: subRows,
      total: filteredSubs.length,
      fetchAll: async () => ({ rows: filteredSubs }),
      run: (rows) =>
        format === "excel" ? exportToExcel(rows) : exportToCSV(rows),
    });

  const totalSubmissionsCount = useMemo(
    () => forms.reduce((sum, f) => sum + (f.submissions || 0), 0),
    [forms],
  );
  const activeFormsCount = useMemo(
    () => forms.filter((f) => f.status === "1").length,
    [forms],
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
        .cf-rd-overlay { position: fixed; inset: 0; z-index: 99999; background: rgba(15, 23, 42, .6); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: modal-fade-in .2s ease both; }
        .cf-rd { width: 100%; max-width: 620px; max-height: 90vh; display: flex; flex-direction: column; background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, .35); animation: modal-pop-in .26s cubic-bezier(.2, .8, .3, 1) backwards; }
        .cf-rd-head { display: flex; align-items: center; gap: 14px; padding: 20px 22px; color: #fff; background: linear-gradient(135deg, var(--ad-brand), #4b3590); }
        .cf-rd-avatar { width: 48px; height: 48px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; letter-spacing: .02em; background: rgba(255, 255, 255, .16); border: 2px solid rgba(255, 255, 255, .35); }
        .cf-rd-who { flex: 1; min-width: 0; }
        .cf-rd-who h4 { margin: 0; font-size: 18px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: capitalize; }
        .cf-rd-who p { margin: 2px 0 0; font-size: 12.5px; color: rgba(255, 255, 255, .78); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cf-rd-close { width: 34px; height: 34px; flex: none; border: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: rgba(255, 255, 255, .16); transition: background .15s; }
        .cf-rd-close:hover { background: rgba(255, 255, 255, .28); }
        .cf-rd-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 22px; border-bottom: 1px solid #eef0f6; background: #fbfaff; }
        .cf-rd-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--ad-brand); background: rgba(var(--ad-brand-rgb), .07); border: 1px solid rgba(var(--ad-brand-rgb), .12); text-decoration: none; }
        a.cf-rd-chip:hover { background: rgba(var(--ad-brand-rgb), .12); color: var(--ad-brand); }
        .cf-rd-chip svg { flex: none; }
        .cf-rd-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cf-rd-chip.muted { color: #475569; background: #f1f5f9; border-color: #e2e8f0; font-weight: 500; }
        .cf-rd-chip.ref { color: #6d28d9; background: #f5f3ff; border-color: #ddd6fe; }
        .cf-rd-body { padding: 18px 22px 6px; overflow-y: auto; }
        .cf-rd-sec { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
        .cf-rd-sec span { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
        .cf-rd-sec small { font-size: 12px; color: #94a3b8; }
        .cf-rd-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; margin: 0; }
        .cf-rd-item { padding: 11px 0; border-bottom: 1px solid #f1f5f9; min-width: 0; }
        .cf-rd-item.wide { grid-column: 1 / -1; }
        .cf-rd-item dt { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 3px; }
        .cf-rd-item dd { margin: 0; font-size: 14px; font-weight: 600; color: #0f172a; white-space: pre-wrap; overflow-wrap: anywhere; }
        .cf-rd-item.empty dd { font-weight: 400; font-style: italic; color: #a3acbd; }
        .cf-rd-foot { display: flex; justify-content: flex-end; padding: 12px 22px 16px; }
        @media (max-width: 575px) { .cf-rd-list { grid-template-columns: 1fr; } .cf-rd-head { padding: 16px; } .cf-rd-chips, .cf-rd-body, .cf-rd-foot { padding-left: 16px; padding-right: 16px; } }
        @media (prefers-reduced-motion: reduce) { .cf-rd-overlay, .cf-rd { animation: none; } }
        .cf-success { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 14px; align-items: stretch; }
        @media (max-width: 991px) { .cf-success { grid-template-columns: 1fr; } }
        .cf-success-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.55; min-height: 150px; resize: vertical; }
        .cf-success-preview { position: relative; border: 1px dashed #d6d0ea; border-radius: 12px; background: #fff; padding: 28px 18px 18px; min-height: 150px; overflow: auto; }
        .cf-success-preview-label { position: absolute; top: 8px; left: 12px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; }
        .cf-success-preview-body { text-align: center; color: #6c757d; overflow-wrap: anywhere; }
        .cf-success-preview-body > :last-child { margin-bottom: 0; }
        .cf-success-preview-body img { max-width: 100%; height: auto; }
        .cf-success-badge { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(var(--ad-brand-rgb), .08); color: var(--ad-brand); }
        /* referral link popup + "Referred By" pill */
        .cf-ref-overlay { position:fixed; inset:0; z-index:9; background:rgba(15,23,42,.6); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center; padding:16px; }
        .cf-ref-modal { width:100%; max-width:520px; max-height:90vh; overflow-y:auto; background:#fff; border-radius:20px;
          box-shadow:0 25px 50px -12px rgba(0,0,0,.3); }
        .cf-ref-head { display:flex; align-items:center; gap:14px; padding:20px 22px; color:#fff;
          background:#2465a8; }
        .cf-ref-head-icon { width:42px; height:42px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
          background:rgba(255,255,255,.18); color:#fff; }
        .cf-ref-head-text { flex:1; min-width:0; }
        .cf-ref-head-text h4 { margin:0; font-size:18px; font-weight:700; color:#fff !important; line-height:1.25; }
        .cf-ref-head-text p { margin:2px 0 0; font-size:13px; color:rgba(255,255,255,.82); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cf-ref-close { width:34px; height:34px; border-radius:50%; border:0; flex-shrink:0; display:flex; align-items:center; justify-content:center;
          background:rgba(255,255,255,.18); color:#fff; cursor:pointer; transition:background .15s; }
        .cf-ref-close:hover { background:rgba(255,255,255,.3); }
        .cf-ref-body { padding:22px; }
        .cf-ref-label { display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:8px; }
        .cf-ref-row { display:flex; gap:10px; }
        .cf-ref-input { flex:1; min-width:0; display:flex; align-items:center; gap:8px; height:46px; padding:0 14px;
          border:1.5px solid #e2e8f0; border-radius:12px; background:#fff; color:#94a3b8; transition:border-color .15s, box-shadow .15s; }
        .cf-ref-input:focus-within { border-color:var(--ad-brand); box-shadow:0 0 0 3px rgba(var(--ad-brand-rgb),.14); color:var(--ad-brand); }
        .cf-ref-input input { flex:1; min-width:0; border:0; outline:0; background:transparent; font-size:14.5px; color:#0f172a; }
        .cf-ref-create { height:46px; padding:0 18px; border:0; border-radius:12px; display:inline-flex; align-items:center; gap:7px; white-space:nowrap;
          background:#2465a8; color:#fff; font-size:14px; font-weight:700; cursor:pointer;
          box-shadow:0 6px 16px rgba(var(--ad-brand-rgb),.25); transition:filter .15s, opacity .15s; }
        .cf-ref-create:hover:not(:disabled) { filter:brightness(1.07); }
        .cf-ref-create:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; }
        .cf-ref-hint { display:flex; gap:7px; align-items:flex-start; margin:10px 0 0; font-size:12.5px; line-height:1.5; color:#64748b; }
        .cf-ref-hint svg { flex-shrink:0; margin-top:2px; }
        .cf-ref-result { margin-top:18px; padding:14px; border:1px solid #c7d2fe; border-radius:14px; background:#f5f7ff; }
        .cf-ref-result-top { display:flex; align-items:center; gap:6px; font-size:13px; color:#15803d; margin-bottom:10px; }
        .cf-ref-result-top b { color:#0f172a; }
        .cf-ref-link { display:flex; align-items:center; gap:6px; height:42px; padding:0 6px 0 12px; background:#fff;
          border:1px solid #dbe1f0; border-radius:10px; }
        .cf-ref-link input { flex:1; min-width:0; border:0; outline:0; background:transparent;
          font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12.5px; color:var(--ad-brand-2); }
        .cf-ref-icon-btn { width:32px; height:32px; border:0; border-radius:8px; display:flex; align-items:center; justify-content:center;
          background:#eef2ff; color:var(--ad-brand); cursor:pointer; flex-shrink:0; }
        .cf-ref-icon-btn:hover { background:#e0e7ff; }
        .cf-ref-actions { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
        .cf-ref-copy, .cf-ref-open { height:38px; padding:0 14px; border-radius:10px; display:inline-flex; align-items:center; gap:6px;
          font-size:13px; font-weight:600; text-decoration:none; cursor:pointer; }
        .cf-ref-copy { border:0; background:var(--ad-brand); color:#fff; }
        .cf-ref-copy:hover { background:var(--ad-brand-2); }
        .cf-ref-open { border:1.5px solid #e2e8f0; background:#fff; color:#334155 !important; }
        .cf-ref-open:hover { border-color:#c7d2fe; color:var(--ad-brand) !important; }
        @media (max-width: 480px) {
          .cf-ref-row { flex-direction:column; }
          .cf-ref-input { flex:none; } /* in a column, flex:1 would shrink its height */
          .cf-ref-create { justify-content:center; }
          .cf-ref-actions > * { flex:1; justify-content:center; }
        }
        .cf-ref-pill { display:inline-block; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle;
          background:#ede9fe; color:var(--ad-brand); font-weight:600; font-size:12px; border-radius:999px; padding:3px 10px; }
        /* form banner picker (builder) */
        .cf-banner { display:flex; gap:18px; align-items:center; padding:14px; border:1.5px solid #e2e8f0; border-radius:14px; background:#fff; }
        .cf-banner-preview { position:relative; width:240px; aspect-ratio:16/10; border-radius:10px; overflow:hidden; flex-shrink:0; cursor:pointer;
          background:#f1f5f9; border:1px solid #e2e8f0; display:block; margin:0; }
        .cf-banner-preview img { width:100%; height:100%; object-fit:cover; display:block; }
        /* the default illustration, on the website's dark panel */
        .cf-banner-preview.is-default { background:linear-gradient(160deg,#0a0f1e 0%,#111a33 60%,#0a0f1e 100%); border-color:#111a33; }
        .cf-banner-preview.is-default img { object-fit:contain; padding:10px; }
        .cf-banner-hover { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:6px;
          background:rgba(15,23,42,.55); color:#fff; font-size:13px; font-weight:600; opacity:0; transition:opacity .15s ease; }
        .cf-banner-preview:hover .cf-banner-hover, .cf-banner-preview:focus-within .cf-banner-hover { opacity:1; }
        .cf-banner-side { flex:1; min-width:0; }
        .cf-banner-state { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; border-radius:999px; padding:3px 10px; margin-bottom:8px; }
        .cf-banner-state.default { background:#f1f5f9; color:#475569; }
        .cf-banner-state.saved { background:#dcfce7; color:#15803d; }
        .cf-banner-state.pending { background:#fef3c7; color:#b45309; }
        .cf-banner-file { font-size:12.5px; color:#334155; margin:0 0 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cf-banner-help { font-size:12.5px; color:#64748b; margin:0 0 12px; line-height:1.5; }
        .cf-banner-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .cf-banner-actions .si-btn-outline { cursor:pointer; margin:0; }
        .cf-banner-actions .cf-btn-danger { color:#dc2626; border-color:#fecaca; }
        .cf-banner-actions .cf-btn-danger:hover { background:#fef2f2; border-color:#fca5a5; }
        .cf-banner-progress { font-size:12px; color:#475569; margin-top:10px; }
        @media (max-width: 640px) {
          .cf-banner { flex-direction:column; align-items:stretch; }
          .cf-banner-preview { width:100%; }
        }
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
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
        }
        .si-stat-card.card-total.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
        }
        .si-stat-card.card-active.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-disabled.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.card-submissions.active {
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
      `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper customfrom-page-wrapper">
          {/* ============ LIST VIEW ============ */}
          {view === "list" && (
            <>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <div className="si-header-title-row">
                      <h3 className="si-header-title">Custom Forms</h3>
                      <span className="si-total-badge">
                        Total <b>{forms.length}</b>
                      </span>
                    </div>
                    <p className="si-header-subtitle">
                      Build dynamic forms that open at{" "}
                      <code>/form/&lt;slug&gt;</code> and collect responses
                      directly.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  {permCan("create") && (
                    <button className="si-btn-primary" onClick={newForm}>
                      <Plus size={16} /> New Form
                    </button>
                  )}
                </div>
              </div>

              {/* Stats KPI Grid */}
              <div className="si-stats-grid">
                <div
                  className={`si-stat-card card-total ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter("all");
                    setFormPage(1);
                  }}
                  title="Show all forms"
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper purple">
                    <ClipboardList size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Total Forms</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={forms.length} pending={loading} id="CustomForms-s1" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-active ${statusFilter === "active" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "active" ? "all" : "active",
                    );
                    setFormPage(1);
                  }}
                  title={
                    statusFilter === "active"
                      ? "Click to show all"
                      : "Filter by Active Forms"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper green">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Active Forms</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={activeFormsCount} pending={loading} id="CustomForms-s2" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card card-disabled ${statusFilter === "disabled" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "disabled" ? "all" : "disabled",
                    );
                    setFormPage(1);
                  }}
                  title={
                    statusFilter === "disabled"
                      ? "Click to show all"
                      : "Filter by Disabled Forms"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper amber">
                    <XCircle size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Disabled Forms</span>
                    <h4 className="si-stat-value">
                      <AnimatedNumber value={forms.length - activeFormsCount} pending={loading} id="CustomForms-s3" />
                    </h4>
                  </div>
                </div>

                <div
                  className="si-stat-card card-submissions"
                  title="Total Form Responses Collected (Click to view all)"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setStatusFilter("all");
                    setFormPage(1);
                  }}
                >
                  <div className="si-stat-icon-wrapper blue">
                    <Users size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Total Submissions</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={totalSubmissionsCount} pending={loading} id="CustomForms-s4" /></h4>
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
                      setFormPage(1);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Forms</option>
                    <option value="disabled">Disabled Forms</option>
                  </select>
                </div>

                <ListSearch
                  placeholder="Search form title or slug…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFormPage(1);
                  }}
                />

                <div className="ms-auto d-flex align-items-center gap-2">
                  <button
                    data-refresh
                    className="reload-btn"
                    title="Refresh"
                    onClick={loadForms}
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
                        <th className="si-th">Form Title & Description</th>
                        <th className="si-th">Public Link</th>
                        <th className="si-th">Responses</th>
                        <th className="si-th">Status</th>
                        <th className="si-th text-end" style={{ width: 170 }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {loading ? (
                        <SkeletonRows />
                      ) : formRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-5 text-muted"
                          >
                            No forms found. Click “New Form” to create one.
                          </td>
                        </tr>
                      ) : (
                        formRows.map((f) => (
                          <tr key={f.id} className="si-tr">
                            <td className="si-td">
                              <div>
                                <div
                                  className="fw-bold text-dark"
                                  style={{ fontSize: "14px" }}
                                >
                                  {f.title}
                                </div>
                                {f.description && (
                                  <small
                                    className="text-muted d-block"
                                    style={{ fontSize: "12px", maxWidth: 300 }}
                                  >
                                    {f.description}
                                  </small>
                                )}
                              </div>
                            </td>

                            <td className="si-td">
                              <div className="d-flex align-items-center gap-2">
                                <code
                                  style={{
                                    fontSize: "12.5px",
                                    color: "var(--ad-brand)",
                                    background: "#f1f5f9",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                  }}
                                >
                                  /form/{f.slug}
                                </code>
                                <button
                                  className="btn btn-sm btn-light p-1"
                                  title="Copy link"
                                  onClick={() => copyLink(f.slug)}
                                >
                                  <Copy size={13} className="text-muted" />
                                </button>
                                <a
                                  href={publicUrl(f.slug)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-light p-1"
                                  title="Open live form"
                                >
                                  <ExternalLink
                                    size={13}
                                    className="text-muted"
                                  />
                                </a>
                                <button
                                  className="btn btn-sm btn-light p-1"
                                  title="Referral link — the link with a referrer's name"
                                  onClick={() => openRefLink(f)}
                                >
                                  <UserPlus size={13} className="text-muted" />
                                </button>
                              </div>
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background: "#eef2ff",
                                  color: "var(--ad-brand-2)",
                                  fontWeight: 700,
                                }}
                              >
                                {f.submissions} response
                                {f.submissions !== 1 ? "s" : ""}
                              </span>
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background:
                                    f.status === "1" ? "#dcfce7" : "#fee2e2",
                                  color:
                                    f.status === "1" ? "#166534" : "#991b1b",
                                }}
                              >
                                <span
                                  className="si-status-dot"
                                  style={{
                                    background:
                                      f.status === "1" ? "#16a34a" : "#dc2626",
                                  }}
                                />
                                {f.status === "1" ? "Active" : "Disabled"}
                              </span>
                            </td>

                            <td className="si-td text-end">
                              <div className="d-inline-flex align-items-center gap-1">
                                {permCan("submissions") && (
                                  <button
                                    className="btn btn-sm btn-outline-secondary"
                                    style={{
                                      borderRadius: "8px",
                                      fontSize: "11.5px",
                                      fontWeight: 600,
                                      padding: "4px 8px",
                                    }}
                                    title="View Responses"
                                    onClick={() => openResponses(f)}
                                  >
                                    Responses
                                  </button>
                                )}
                                {permCan("edit") && (
                                  <button
                                    className="si-action-btn view"
                                    title="Edit Form"
                                    onClick={() => editForm(f.id)}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {permCan("delete") && (
                                  <button
                                    className="si-action-btn delete"
                                    title="Delete Form"
                                    onClick={() => deleteForm(f)}
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
                {filteredForms.length > 0 && totalFormPages > 1 && (
                  <div className="si-table-footer">
                    <div className="si-table-info">
                      Showing {(formPageSafe - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(formPageSafe * PAGE_SIZE, filteredForms.length)}{" "}
                      of {filteredForms.length} forms
                    </div>
                    <div className="si-pagination">
                      <button
                        className="si-page-nav-btn"
                        disabled={formPageSafe <= 1}
                        onClick={() => setFormPage(formPageSafe - 1)}
                      >
                        « Prev
                      </button>
                      {Array.from({ length: totalFormPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalFormPages ||
                            Math.abs(p - formPageSafe) <= 2,
                        )
                        .map((p, idx, arr) => (
                          <span key={p} className="d-flex align-items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-muted">…</span>
                            )}
                            <button
                              className={`si-page-btn ${p === formPageSafe ? "active" : ""}`}
                              onClick={() => setFormPage(p)}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        className="si-page-nav-btn"
                        disabled={formPageSafe >= totalFormPages}
                        onClick={() => setFormPage(formPageSafe + 1)}
                      >
                        Next »
                      </button>
                    </div>
                  </div>
                )}
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/forms/list" />
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
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      {form.id ? "Edit Custom Form" : "Create New Custom Form"}
                    </h3>
                    <p className="si-header-subtitle">
                      Configure form fields, options, validation rules, and
                      redirect text.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  <button
                    className="si-btn-outline"
                    onClick={() => setView("list")}
                  >
                    <ArrowLeft size={16} /> Back to Forms
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
                  <div className="col-md-6">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Form Title *
                    </label>
                    <input
                      className="form-control"
                      value={form.title}
                      placeholder="e.g. Free Consultation Request"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          title: e.target.value,
                          slug: slugTouched
                            ? form.slug
                            : slugify(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Form URL Slug *
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">/form/</span>
                      <input
                        className="form-control"
                        value={form.slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setForm({ ...form, slug: slugify(e.target.value) });
                        }}
                      />
                    </div>
                  </div>

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
                      value={form.description}
                      placeholder="Introductory text displayed at the top of the form..."
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-12">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Banner Image (Optional)
                    </label>
                    <div className="cf-banner">
                      {/* the preview is also a button that opens the file picker */}
                      <label
                        className={
                          "cf-banner-preview" +
                          (bannerPreview ? "" : " is-default")
                        }
                        title={bannerPreview ? "Change image" : "Upload image"}
                      >
                        <img
                          src={bannerPreview || "/images/login_side.png"}
                          alt="Form banner preview"
                        />
                        <span className="cf-banner-hover">
                          <ImagePlus size={16} />{" "}
                          {bannerPreview ? "Change image" : "Upload image"}
                        </span>
                        <input
                          type="file"
                          accept={BANNER_TYPES.join(",")}
                          hidden
                          onChange={(e) => {
                            pickBanner(e.target.files?.[0] || null);
                            e.target.value = "";
                          }}
                        />
                      </label>

                      <div className="cf-banner-side">
                        {bannerFile ? (
                          <>
                            <span className="cf-banner-state pending">
                              New image · not saved yet
                            </span>
                            <p
                              className="cf-banner-file"
                              title={bannerFile.name}
                            >
                              {bannerFile.name} ·{" "}
                              {(bannerFile.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </>
                        ) : bannerPreview ? (
                          <span className="cf-banner-state saved">
                            Custom image
                          </span>
                        ) : (
                          <span className="cf-banner-state default">
                            {bannerRemove
                              ? "Default illustration · saved on update"
                              : "Default illustration"}
                          </span>
                        )}
                        <p className="cf-banner-help">
                          Shown beside the form on the website (wide screens). A
                          landscape image looks best. PNG, JPG, WEBP or GIF, up
                          to {MAX_BANNER_MB} MB.
                        </p>
                        <div className="cf-banner-actions">
                          <label className="si-btn-outline">
                            <ImagePlus size={15} />{" "}
                            {bannerPreview ? "Change image" : "Upload image"}
                            <input
                              type="file"
                              accept={BANNER_TYPES.join(",")}
                              hidden
                              onChange={(e) => {
                                pickBanner(e.target.files?.[0] || null);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {bannerPreview && (
                            <button
                              type="button"
                              className="si-btn-outline cf-btn-danger"
                              onClick={clearBanner}
                            >
                              <RotateCcw size={15} /> Use default
                            </button>
                          )}
                        </div>
                        {busy && bannerFile && bannerProgress > 0 && (
                          <div className="cf-banner-progress">
                            Uploading… {bannerProgress}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-8">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Submit Button Label
                    </label>
                    <input
                      className="form-control"
                      value={form.submit_text}
                      onChange={(e) =>
                        setForm({ ...form, submit_text: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Form Status
                    </label>
                    <select
                      className="form-select"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      <option value="1">Active</option>
                      <option value="0">Disabled</option>
                    </select>
                  </div>

                  {/* shown after a submit: HTML + CSS, with a live preview */}
                  <div className="col-12">
                    <label
                      className="form-label fw-semibold d-flex align-items-center gap-2"
                      style={{ fontSize: "13px" }}
                      htmlFor="cf-success-msg"
                    >
                      Success Message
                      <span className="cf-success-badge">HTML &amp; CSS</span>
                    </label>
                    <div className="cf-success">
                      <textarea
                        id="cf-success-msg"
                        className="form-control cf-success-code"
                        rows={7}
                        spellCheck={false}
                        value={form.success_msg}
                        placeholder={
                          '<h3 class="thanks">🎉 Thank you!</h3>\n<p>We will contact you <b>within 24 hours</b>.</p>\n<style>\n  .thanks { color: #453275; }\n</style>'
                        }
                        onChange={(e) =>
                          setForm({ ...form, success_msg: e.target.value })
                        }
                      />
                      <div className="cf-success-preview" aria-label="Preview">
                        <span className="cf-success-preview-label">Preview</span>
                        {successPreview.css && <style>{successPreview.css}</style>}
                        <div
                          className="cf-success-preview-body"
                          dangerouslySetInnerHTML={{
                            __html:
                              successPreview.html ||
                              "Thank you! Your response has been recorded.",
                          }}
                        />
                      </div>
                    </div>
                    <small className="text-muted d-block mt-1" style={{ fontSize: "12px" }}>
                      Plain text, or HTML such as &lt;h3&gt;, &lt;p&gt;, &lt;b&gt;, &lt;a&gt;, &lt;img&gt; with
                      class and style="…", plus a &lt;style&gt; block whose rules apply only inside
                      this message. Scripts and event handlers are removed.
                    </small>
                  </div>
                </div>
              </div>

              {/* Form Fields Builder */}
              <div
                className="card shadow-sm border-0 p-4 mb-4"
                style={{ borderRadius: "16px", background: "#fff" }}
              >
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5
                    className="fw-bold mb-0"
                    style={{ fontSize: "16px", color: "#1e293b" }}
                  >
                    Form Questions & Fields ({fields.length})
                  </h5>
                  <button className="si-btn-primary" onClick={addField}>
                    <Plus size={15} /> Add Field
                  </button>
                </div>

                {fields.length === 0 ? (
                  <p className="text-muted text-center py-4">
                    No fields added yet. Click “Add Field” to get started.
                  </p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {fields.map((fl, i) => (
                      <div
                        key={fl.id}
                        className="p-3"
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          background: "#f8fafc",
                        }}
                      >
                        <div className="row g-2 align-items-center">
                          <div className="col-md-5">
                            <label
                              className="form-label mb-1 fw-semibold"
                              style={{ fontSize: "12px" }}
                            >
                              Label / Question *
                            </label>
                            <input
                              className="form-control form-control-sm"
                              value={fl.label}
                              placeholder="e.g. What is your company size?"
                              onChange={(e) =>
                                updateField(i, { label: e.target.value })
                              }
                            />
                          </div>

                          <div className="col-md-3">
                            <label
                              className="form-label mb-1 fw-semibold"
                              style={{ fontSize: "12px" }}
                            >
                              Input Type
                            </label>
                            <select
                              className="form-select form-select-sm"
                              value={fl.type}
                              onChange={(e) =>
                                updateField(i, { type: e.target.value })
                              }
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t.v} value={t.v}>
                                  {t.l}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-md-4 d-flex align-items-center justify-content-end gap-2 pt-3">
                            <label
                              className="d-flex align-items-center gap-1 mb-0 me-2"
                              style={{ fontSize: "12.5px" }}
                            >
                              <input
                                type="checkbox"
                                className="form-check-input mt-0"
                                checked={fl.required}
                                onChange={(e) =>
                                  updateField(i, { required: e.target.checked })
                                }
                              />
                              Required
                            </label>

                            <button
                              type="button"
                              className="btn btn-sm btn-light border p-1"
                              title="Move Up"
                              disabled={i === 0}
                              onClick={() => moveField(i, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-light border p-1"
                              title="Move Down"
                              disabled={i === fields.length - 1}
                              onClick={() => moveField(i, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger p-1"
                              title="Remove"
                              onClick={() => removeField(i)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {!HAS_OPTIONS.includes(fl.type) &&
                            fl.type !== "date" && (
                              <div className="col-12 mt-2">
                                <input
                                  className="form-control form-control-sm"
                                  placeholder="Input placeholder text (optional)..."
                                  value={fl.placeholder || ""}
                                  onChange={(e) =>
                                    updateField(i, {
                                      placeholder: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            )}

                          {HAS_OPTIONS.includes(fl.type) && (
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
                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                                value={(fl.options || []).join("\n")}
                                onChange={(e) =>
                                  updateField(i, {
                                    options: e.target.value
                                      .split("\n")
                                      .map((s) => s.trim()),
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                {permCan("create", "edit") && (
                  <button
                    className="si-btn-primary"
                    disabled={busy}
                    onClick={saveForm}
                  >
                    {busy ? <ButtonLoader label="Saving…" /> : form.id ? "Update Form" : "Create Form"}
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
          {view === "responses" && respForm && (
            <>
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      Responses — {respForm.title}
                    </h3>
                    <p className="si-header-subtitle">
                      {subs.length} total response(s) submitted via{" "}
                      <code>/form/{respForm.slug}</code>.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  <button
                    className="si-btn-export-excel"
                    onClick={() => askExport("excel")}
                  >
                    <FileSpreadsheet size={15} /> Export Excel
                  </button>
                  <button
                    className="si-btn-export-csv"
                    onClick={() => askExport("csv")}
                  >
                    <FileText size={15} /> Export CSV
                  </button>
                  <button
                    className="si-btn-outline"
                    onClick={() => setView("list")}
                  >
                    <ArrowLeft size={16} /> Back to Forms
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <ListSearch
                  placeholder="Search response answers…"
                  value={subSearch}
                  onChange={(e) => {
                    setSubSearch(e.target.value);
                    setSubPage(1);
                  }}
                />

                <div className="ms-auto d-flex align-items-center gap-2">
                  {/* data-refresh: the saved copy is dropped first, so this asks the server */}
                  <button
                    data-refresh
                    className="reload-btn"
                    title="Reload responses"
                    onClick={reloadResponses}
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
                        <th className="si-th" style={{ width: 60 }}>
                          #
                        </th>
                        {tableFields.map((f) => (
                          <th key={f.id} className="si-th">
                            {f.label}
                          </th>
                        ))}
                        <th className="si-th" style={{ width: 150 }}>
                          Referred By
                        </th>
                        <th className="si-th" style={{ width: 170 }}>
                          Submitted At
                        </th>
                        <th className="si-th text-center" style={{ width: 80 }}>
                          Detail
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {loading ? (
                        <SkeletonRows />
                      ) : subRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={tableFields.length + 4}
                            className="text-center py-5 text-muted"
                          >
                            {subSearch
                              ? "No submissions match your search."
                              : "No responses submitted yet."}
                          </td>
                        </tr>
                      ) : (
                        subRows.map((s, i) => {
                          const sno =
                            subs.length - ((subPageSafe - 1) * PAGE_SIZE + i);
                          return (
                            <tr key={s.id} className="si-tr">
                              <td
                                className="si-td text-muted fw-semibold"
                                style={{ fontSize: "13px" }}
                              >
                                {sno}
                              </td>
                              {tableFields.map((f) => (
                                <td
                                  key={f.id}
                                  className="si-td"
                                  style={{ fontSize: "13px", maxWidth: 220 }}
                                >
                                  <div
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {answerText(s.answers?.[f.id]) || (
                                      <span className="text-muted">—</span>
                                    )}
                                  </div>
                                </td>
                              ))}
                              <td className="si-td" style={{ fontSize: "13px" }}>
                                {s.referrer ? (
                                  <span className="cf-ref-pill" title={s.referrer}>{s.referrer}</span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td
                                className="si-td text-muted"
                                style={{ fontSize: "12.5px" }}
                              >
                                {tsDate(s.datetime)}
                              </td>
                              <td className="si-td text-center">
                                <button
                                  className="si-action-btn view"
                                  title="View full submission"
                                  onClick={() => setDetailSub({ sub: s, sno })}
                                >
                                  <Eye size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredSubs.length > 0 && totalSubPages > 1 && (
                  <div className="si-table-footer">
                    <div className="si-table-info">
                      Showing {(subPageSafe - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(subPageSafe * PAGE_SIZE, filteredSubs.length)}{" "}
                      of {filteredSubs.length} responses
                    </div>
                    <div className="si-pagination">
                      <button
                        className="si-page-nav-btn"
                        disabled={subPageSafe <= 1}
                        onClick={() => setSubPage(subPageSafe - 1)}
                      >
                        « Prev
                      </button>
                      {Array.from({ length: totalSubPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalSubPages ||
                            Math.abs(p - subPageSafe) <= 2,
                        )
                        .map((p, idx, arr) => (
                          <span key={p} className="d-flex align-items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-muted">…</span>
                            )}
                            <button
                              className={`si-page-btn ${p === subPageSafe ? "active" : ""}`}
                              onClick={() => setSubPage(p)}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        className="si-page-nav-btn"
                        disabled={subPageSafe >= totalSubPages}
                        onClick={() => setSubPage(subPageSafe + 1)}
                      >
                        Next »
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Submission Detail Modal */}
        {refForm && (
          <div className="cf-ref-overlay" onClick={() => setRefForm(null)}>
            <div className="cf-ref-modal" role="dialog" aria-label="Referral link" onClick={(e) => e.stopPropagation()}>
              <div className="cf-ref-head">
                <div className="cf-ref-head-icon" aria-hidden="true">
                  <Link2 size={20} />
                </div>
                <div className="cf-ref-head-text">
                  <h4>Referral link</h4>
                  <p>{refForm.title}</p>
                </div>
                <button type="button" className="cf-ref-close" onClick={() => setRefForm(null)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <form
                className="cf-ref-body"
                onSubmit={(e) => {
                  e.preventDefault();
                  createRefLink();
                }}
              >
                <label className="cf-ref-label" htmlFor="cf-ref-name">Referrer name</label>
                <div className="cf-ref-row">
                  <div className="cf-ref-input">
                    <UserPlus size={16} aria-hidden="true" />
                    <input
                      id="cf-ref-name"
                      value={refName}
                      maxLength={80}
                      autoFocus
                      autoComplete="off"
                      placeholder="e.g. Ravi Kumar"
                      onChange={(e) => {
                        setRefName(e.target.value);
                        setRefLink("");
                      }}
                    />
                  </div>
                  <button type="submit" className="cf-ref-create" disabled={!refName.trim()}>
                    <Link2 size={16} /> Create link
                  </button>
                </div>
                <p className="cf-ref-hint">
                  <Info size={14} aria-hidden="true" />
                  <span>Everyone who fills the form through this link is listed under <b>Referred By</b> in its responses.</span>
                </p>

                {refLink && (
                  <div className="cf-ref-result">
                    <div className="cf-ref-result-top">
                      <CheckCircle2 size={16} aria-hidden="true" /> Link ready for <b>{refName.trim()}</b>
                    </div>
                    <div className="cf-ref-link">
                      <input readOnly value={refLink} onFocus={(e) => e.currentTarget.select()} aria-label="Referral link" />
                      <button type="button" className="cf-ref-icon-btn" onClick={copyRefLink} title="Copy link">
                        <Copy size={15} />
                      </button>
                    </div>
                    <div className="cf-ref-actions">
                      <button type="button" className="cf-ref-copy" onClick={copyRefLink}>
                        <Copy size={15} /> Copy link
                      </button>
                      <a href={refLink} target="_blank" rel="noreferrer" className="cf-ref-open">
                        <ExternalLink size={15} /> Open form
                      </a>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {detailSub && respForm && (() => {
          // the name, phones and emails go in the header; the rest below as answers
          const fields = respFields;
          const ans = (fl: Field) => answerText(detailSub.sub.answers?.[fl.id]);
          const nameField = fields.find((fl) => fl.type === "text" && /name/i.test(fl.label));
          const name = nameField ? ans(nameField) : "";
          const phones = fields.filter((fl) => fl.type === "tel" && ans(fl));
          const emails = fields.filter((fl) => fl.type === "email" && ans(fl));
          const shown = new Set([nameField?.id, ...phones.map((p) => p.id), ...emails.map((m) => m.id)]);
          const rest = fields.filter((fl) => !shown.has(fl.id));
          const answered = rest.filter((fl) => ans(fl)).length;
          const initials =
            name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0].toUpperCase())
              .join("") || "#";
          // rendered into <body>, so nothing in the page layout can confine or offset it
          return createPortal(
            <div className="cf-rd-overlay" onClick={() => setDetailSub(null)}>
              <div
                className="cf-rd"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cf-rd-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="cf-rd-head">
                  <span className="cf-rd-avatar" aria-hidden="true">
                    {initials}
                  </span>
                  <div className="cf-rd-who">
                    <h4 id="cf-rd-title">{name || `Response #${detailSub.sno}`}</h4>
                    <p>
                      {name ? `Response #${detailSub.sno} · ` : ""}
                      {respForm.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="cf-rd-close"
                    aria-label="Close"
                    onClick={() => setDetailSub(null)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="cf-rd-chips">
                  {phones.map((p) => (
                    <a key={p.id} className="cf-rd-chip" href={`tel:${ans(p).replace(/[^\d+]/g, "")}`} title={p.label}>
                      <Phone size={14} /> {ans(p)}
                    </a>
                  ))}
                  {emails.map((m) => (
                    <a key={m.id} className="cf-rd-chip" href={`mailto:${ans(m)}`} title={m.label}>
                      <Mail size={14} /> <span className="cf-rd-chip-text">{ans(m)}</span>
                    </a>
                  ))}
                  <span className="cf-rd-chip muted" title="Submitted at">
                    <CalendarClock size={14} /> {tsDate(detailSub.sub.datetime)}
                  </span>
                  {detailSub.sub.referrer && (
                    <span className="cf-rd-chip ref" title="Referred by">
                      <UserPlus size={14} /> {detailSub.sub.referrer}
                    </span>
                  )}
                </div>

                <div className="cf-rd-body">
                  {rest.length > 0 && (
                    <>
                      <div className="cf-rd-sec">
                        <span>Answers</span>
                        <small>
                          {answered} of {rest.length} answered
                        </small>
                      </div>
                      <dl className="cf-rd-list">
                        {rest.map((fl) => {
                          const v = ans(fl);
                          const wide = fl.type === "textarea" || v.length > 48;
                          return (
                            <div key={fl.id} className={"cf-rd-item" + (wide ? " wide" : "") + (v ? "" : " empty")}>
                              <dt>{fl.label}</dt>
                              <dd>{v || "Not answered"}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    </>
                  )}
                  {rest.length === 0 && !phones.length && !emails.length && !name && (
                    <p className="text-muted mb-0">This response has no answers.</p>
                  )}
                </div>

                <div className="cf-rd-foot">
                  <button type="button" className="si-btn-outline" onClick={() => setDetailSub(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}
      </div>
    </>
  );
}
