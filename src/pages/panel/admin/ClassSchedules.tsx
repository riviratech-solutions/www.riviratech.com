import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  CalendarClock,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Wand2,
  Layers,
  BookOpen,
  RotateCw,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Library,
} from "lucide-react";
import { listFetch, refreshLists } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { ButtonLoader, InlineLoader, SkeletonCards } from "../../../components/loading";

/* Admin → Class Schedules: each batch's weekly class times (EST and IST side
   by side), shown to that batch's students on their Class Schedule page
   (student/ClassSchedule.tsx). One schedule per batch.
   API: api/admin/class-schedules/class-schedules.js */

const seo = getSeoByPath("");

type Row = { day_est: string; time_est: string; day_ist: string; time_ist: string };

// The course guide's standard timetable (the student dashboard's Class schedule)
const STANDARD_ROWS: Row[] = [
  { day_est: "Wednesday", time_est: "9:00 PM – 10:00 PM", day_ist: "Thursday", time_ist: "6:30 AM – 7:30 AM" },
  { day_est: "Thursday", time_est: "9:00 PM – 10:00 PM", day_ist: "Friday", time_ist: "6:30 AM – 7:30 AM" },
  { day_est: "Friday", time_est: "9:00 PM – 10:00 PM", day_ist: "Saturday", time_ist: "6:30 AM – 7:30 AM" },
  { day_est: "Saturday", time_est: "10:00 AM – 12:00 PM", day_ist: "Saturday", time_ist: "7:30 PM – 9:30 PM" },
  { day_est: "Sunday", time_est: "10:00 AM – 12:00 PM", day_ist: "Sunday", time_ist: "7:30 PM – 9:30 PM" },
];
const STANDARD_INTRO = "All sessions are live on Zoom. Weekdays run one hour, weekends two.";
const STANDARD_NOTE =
  "IST days run a day ahead of EST because India is 9½ hours ahead — check the IST column if that is your timezone.";

const EMPTY_ROW: Row = { day_est: "", time_est: "", day_ist: "", time_ist: "" };
const EMPTY_FORM = { c_id: "", b_id: "", intro: "", note: "", rows: [{ ...EMPTY_ROW }] as Row[] };

function decodeHtml(str: any) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str ?? "";
  return txt.value;
}

const courseLabel = (c: any) => decodeHtml(c.title) + (c.status === "1D" ? " (deleted course)" : "");

const fmtDate = (v: any) => {
  if (!v) return "";
  const s = String(v);
  const d = /^\d{9,10}$/.test(s) ? new Date(Number(s) * 1000) : new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/* ---------- Course Resources tab ----------
   The "Course resources" card on the student's Class Schedule page: a title,
   a line of description and 1–6 link buttons each. "All courses" shows it to
   every student; a course limits it to that course's students, and a batch of
   the course to that batch's students. */
type ResLink = { label: string; href: string };
const EMPTY_LINK: ResLink = { label: "", href: "" };
const EMPTY_RES = { c_id: "", b_id: "", title: "", description: "", links: [{ ...EMPTY_LINK }] as ResLink[] };

function ResourcesPanel({ courses }: { courses: any[] }) {
  const permCan = usePagePerm("class-schedules");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_RES);
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const getSecurity = async () =>
    (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  const loadBatches = async (c_id: string) => {
    setBatches([]);
    if (!c_id) return;
    setLoadingBatches(true);
    try {
      const res = await listFetch("api/get-batches", { c_id, status: "" });
      setBatches(res.data.success ? (res.data.data || []).filter((b: any) => b.status !== "1D") : []);
    } catch {
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const load = async (fresh = false) => {
    setLoading(true);
    try {
      const res = await listFetch("api/course-resources", {}, { fresh });
      if (res.data.success) setList(res.data.data || []);
      else toast.error(res.data.message || "Failed to load");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const post = async (path: string, body: any) => {
    const s = await getSecurity();
    return (await axios.post(SERVER_URL + "api/" + path, { ...body, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true })).data;
  };

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_RES, links: [{ ...EMPTY_LINK }] }); setBatches([]); setModalOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      c_id: item.c_id || "",
      b_id: item.b_id || "",
      title: item.title || "",
      description: item.description || "",
      links: (item.links && item.links.length ? item.links : [EMPTY_LINK]).map((l: ResLink) => ({ ...l })),
    });
    loadBatches(item.c_id || "");
    setModalOpen(true);
  };
  const closeModal = () => { if (!saving) { setModalOpen(false); setEditing(null); } };

  const setLink = (i: number, k: keyof ResLink, v: string) =>
    setForm((f) => ({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const addLink = () => setForm((f) => ({ ...f, links: [...f.links, { ...EMPTY_LINK }] }));
  const removeLink = (i: number) =>
    setForm((f) => ({ ...f, links: f.links.length > 1 ? f.links.filter((_, j) => j !== i) : [{ ...EMPTY_LINK }] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 2) return toast.error("Please enter the title");
    setSaving(true);
    try {
      const body: any = { ...form };
      if (editing) body.id = editing.id;
      const data = await post("course-resources/save", body);
      if (data.success) {
        toast.success(data.message);
        setList((prev) => (editing ? prev.map((x) => (x.id === editing.id ? data.data : x)) : [...prev, data.data]));
        refreshLists("api/course-resources");
        setSaving(false);
        setModalOpen(false);
        setEditing(null);
        return;
      }
      toast.error(data.message);
    } catch {
      toast.error("Something went wrong");
    }
    setSaving(false);
  };

  const toggle = async (item: any) => {
    const active = item.status !== "1";
    setBusyId(item.id);
    try {
      const data = await post("course-resources/toggle", { id: item.id, active });
      if (data.success) {
        toast.success(data.message);
        setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: active ? "1" : "1S" } : x)));
        refreshLists("api/course-resources");
      } else toast.error(data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  const del = async (item: any) => {
    if (!window.confirm(`Delete '${item.title}'?`)) return;
    setBusyId(item.id);
    try {
      const data = await post("course-resources/delete", { id: item.id });
      if (data.success) {
        toast.success(data.message);
        setList((prev) => prev.filter((x) => x.id !== item.id));
        refreshLists("api/course-resources");
      } else toast.error(data.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  // up / down: swap with the neighbour and save the whole order
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const before = list;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    try {
      const data = await post("course-resources/reorder", { ids: next.map((x) => x.id) });
      if (!data.success) { toast.error(data.message || "Could not save the new order"); setList(before); }
      else refreshLists("api/course-resources");
    } catch { toast.error("Could not save the new order"); setList(before); }
  };

  const q = search.trim().toLowerCase();
  const shown = q
    ? list.filter((r) => (r.title || "").toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q))
    : list;

  return (
    <>
      <div className="cs-filter">
        <ListSearch placeholder="Search resources…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="ms-auto d-flex align-items-center gap-2">
          {permCan("create") && (
            <button className="cs-btn cs-btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Resource
            </button>
          )}
          <button data-refresh className="reload-btn" title="Reload" onClick={() => load(true)} disabled={loading}>
            <RotateCw size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cs-empty">Loading course resources…</div>
      ) : shown.length === 0 ? (
        <div className="cs-empty">
          {list.length === 0 ? "No course resources yet. Add one and students will see it on their Class Schedule page." : "No resources match your search."}
        </div>
      ) : (
        <div className="cr-list">
          {shown.map((item) => {
            const i = list.findIndex((x) => x.id === item.id);
            const on = item.status === "1";
            return (
              <div key={item.id} className={`cr-item${on ? "" : " is-hidden"}`}>
                {permCan("edit") && !q && (
                  <div className="cr-move">
                    <button className="cs-icon-btn" title="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp size={15} /></button>
                    <button className="cs-icon-btn" title="Move down" onClick={() => move(i, 1)} disabled={i === list.length - 1}><ChevronDown size={15} /></button>
                  </div>
                )}
                <div className="cr-body">
                  <div className="cr-top">
                    <h4>{item.title}</h4>
                    <span className="cr-course">
                      {item.c_id ? decodeHtml(item.course_name || "Course removed") : "All courses"}
                      {item.b_id ? " · " + decodeHtml(item.batch_name || "Batch removed") : item.c_id ? " · All batches" : ""}
                    </span>
                    <span className={`cs-pill ${on ? "cs-pill-on" : "cs-pill-off"}`}>{on ? "Shown" : "Hidden"}</span>
                  </div>
                  {item.description && <p>{item.description}</p>}
                  <div className="cr-links">
                    {(item.links || []).map((l: ResLink, k: number) => (
                      <a key={k} href={l.href} target="_blank" rel="noopener noreferrer" className="cr-link" title={l.href}>
                        {l.label} <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>
                <div className="cs-actions">
                  {permCan("edit") && (
                    <button className="cs-icon-btn" title="Edit" onClick={() => openEdit(item)} disabled={busyId === item.id}><Edit2 size={14} /></button>
                  )}
                  {permCan("status") && (
                    <button className="cs-icon-btn" title={on ? "Hide from students" : "Show to students"} onClick={() => toggle(item)} disabled={busyId === item.id}>
                      {on ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                  {permCan("delete") && (
                    <button className="cs-icon-btn danger" title="Delete" onClick={() => del(item)} disabled={busyId === item.id}><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="saved-ago-row" style={{ marginTop: 14 }}>
        <SavedAgo endpoint="api/course-resources" />
      </div>

      {modalOpen && (
        <div className="cs-modal-back" onClick={closeModal}>
          <form className="cs-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <div className="cs-modal-head">
              <h5>{editing ? "Edit Resource" : "Add Resource"}</h5>
              <button type="button" className="cs-icon-btn" onClick={closeModal} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="cs-modal-body">
              <div className="cs-two">
                <div>
                  <label className="cs-label">Title *</label>
                  <input className="cs-input" maxLength={120} placeholder="Detailed Course Plan" value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="cs-label">Shown to</label>
                  <select
                    className="cs-input"
                    value={form.c_id}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, c_id: e.target.value, b_id: "" }));
                      loadBatches(e.target.value);
                    }}
                  >
                    <option value="">All courses</option>
                    {courses.map((c) => (
                      <option key={c.req_id} value={c.req_id}>{courseLabel(c)} only</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.c_id && (
                <div>
                  <label className="cs-label">Batch</label>
                  <select
                    className="cs-input"
                    value={form.b_id}
                    onChange={(e) => setForm((f) => ({ ...f, b_id: e.target.value }))}
                    disabled={loadingBatches}
                  >
                    <option value="">{loadingBatches ? "Loading batches…" : "All batches of this course"}</option>
                    {batches.map((b) => (
                      <option key={b.b_id} value={b.b_id}>{decodeHtml(b.name)} only</option>
                    ))}
                  </select>
                  <p className="cs-hint">Pick a batch to show this only to that batch's students.</p>
                </div>
              )}
              <div>
                <label className="cs-label">Description</label>
                <textarea className="cs-input" rows={2} maxLength={300} placeholder="The full plan for what gets taught, week by week."
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <div className="cs-rows-head">
                  <label className="cs-label" style={{ margin: 0 }}>Links *</label>
                  <button type="button" className="cs-btn cs-btn-outline" onClick={addLink} disabled={form.links.length >= 6}>
                    <Plus size={14} /> Add link
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {form.links.map((l, i) => (
                    <div className="cr-link-row" key={i}>
                      <input className="cs-input" maxLength={60} placeholder="Button label, e.g. Open the Course Plan" value={l.label}
                        onChange={(e) => setLink(i, "label", e.target.value)} />
                      <input className="cs-input" maxLength={500} placeholder="https://…" value={l.href}
                        onChange={(e) => setLink(i, "href", e.target.value)} />
                      <button type="button" className="cs-icon-btn danger" title="Remove link" onClick={() => removeLink(i)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <p className="cs-hint">Each link is a button on the student page and opens in a new tab.</p>
              </div>
            </div>
            <div className="cs-modal-foot">
              <button type="button" className="cs-btn cs-btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
              <button type="submit" className="cs-btn cs-btn-primary" disabled={saving}>
                {saving ? <ButtonLoader label="Saving…" /> : editing ? "Save changes" : "Add Resource"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default function ClassSchedules() {
  const permCan = usePagePerm("class-schedules");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Class Schedules | Course Resources (#resources opens the second)
  const [tab, setTab] = useState<"schedules" | "resources">(
    window.location.hash === "#resources" ? "resources" : "schedules",
  );
  const switchTab = (t: "schedules" | "resources") => {
    setTab(t);
    window.history.replaceState(null, "", t === "resources" ? "#resources" : window.location.pathname);
  };
  // the resources tab loads after this page's own first loads (one request at a time)
  const [ready, setReady] = useState(false);

  const getSecurity = async () =>
    (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  const load = async (fresh = false) => {
    setLoading(true);
    try {
      const res = await listFetch("api/class-schedules", {}, { fresh });
      if (res.data.success) setList(res.data.data || []);
      else toast.error(res.data.message || "Failed to load");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", { status: "" });
      // deleted courses stay listed: their running batches still have students
      if (res.data.success) setCourses(res.data.data || []);
    } catch { /* the form says so when the list is empty */ }
  };

  const loadBatches = async (c_id: string) => {
    setBatches([]);
    if (!c_id) return;
    setLoadingBatches(true);
    try {
      const res = await listFetch("api/get-batches", { c_id, status: "" });
      setBatches(res.data.success ? (res.data.data || []).filter((b: any) => b.status !== "1D") : []);
    } catch {
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, rows: [{ ...EMPTY_ROW }] });
    setBatches([]);
    setModalOpen(true);
  };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      c_id: item.c_id,
      b_id: item.b_id,
      intro: item.intro || "",
      note: item.note || "",
      rows: (item.rows && item.rows.length ? item.rows : [EMPTY_ROW]).map((r: Row) => ({ ...r })),
    });
    loadBatches(item.c_id);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  };

  const setRow = (i: number, k: keyof Row, v: string) =>
    setForm((f) => ({ ...f, rows: f.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const addRow = () => setForm((f) => ({ ...f, rows: [...f.rows, { ...EMPTY_ROW }] }));
  const removeRow = (i: number) =>
    setForm((f) => ({ ...f, rows: f.rows.length > 1 ? f.rows.filter((_, j) => j !== i) : [{ ...EMPTY_ROW }] }));
  const fillStandard = () => {
    const hasRows = form.rows.some((r) => r.day_est || r.time_est || r.day_ist || r.time_ist);
    if (hasRows && !window.confirm("Replace the classes below with the standard schedule?")) return;
    setForm((f) => ({
      ...f,
      rows: STANDARD_ROWS.map((r) => ({ ...r })),
      intro: f.intro || STANDARD_INTRO,
      note: f.note || STANDARD_NOTE,
    }));
  };

  // batches that already have a schedule (other than the one being edited)
  const takenBatches = useMemo(
    () => new Set(list.filter((x) => !editing || x.id !== editing.id).map((x) => x.b_id)),
    [list, editing],
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.c_id) return toast.error("Please select the course");
    if (!form.b_id) return toast.error("Please select the batch");
    setSaving(true);
    try {
      const s = await getSecurity();
      const payload: any = { ...form, key: s.key, token: s.token, aut: s.aut };
      if (editing) payload.id = editing.id;
      const res = await axios.post(SERVER_URL + "api/class-schedules/save", payload, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        const row = res.data.data;
        setList((prev) => (editing ? prev.map((x) => (x.id === editing.id ? row : x)) : [row, ...prev]));
        refreshLists("api/class-schedules");
        setSaving(false);
        setModalOpen(false);
        setEditing(null);
        return;
      }
      toast.error(res.data.message);
    } catch {
      toast.error("Something went wrong");
    }
    setSaving(false);
  };

  const toggle = async (item: any) => {
    const active = item.status !== "1";
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/class-schedules/toggle",
        { id: item.id, active, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: active ? "1" : "1S" } : x)));
        refreshLists("api/class-schedules");
      } else toast.error(res.data.message);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const del = async (item: any) => {
    if (!window.confirm(`Delete the class schedule of '${decodeHtml(item.batch_name || "this batch")}'?`)) return;
    setBusyId(item.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/class-schedules/delete",
        { id: item.id, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        setList((prev) => prev.filter((x) => x.id !== item.id));
        refreshLists("api/class-schedules");
      } else toast.error(res.data.message);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    (async () => {
      const res = await axios.get(SERVER_URL + "api/check-login", { withCredentials: true });
      if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y")) {
        // one after the other: the security token is per request, and two
        // requests started together can't both pass
        await load();
        await loadCourses();
        setReady(true);
      } else navigate("/logout");
    })();
  }, []);

  const shown = list.filter((item) => {
    if (courseFilter && item.c_id !== courseFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      decodeHtml(item.course_name || "").toLowerCase().includes(q) ||
      decodeHtml(item.batch_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
      <ToastContainer position="top-right" autoClose={2200} />

      <style>{`
        .cs-page { background:#f8fafc; min-height:calc(100vh - 80px); padding:24px 28px; }
        .cs-head { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
        .cs-head-left { display:flex; align-items:center; gap:14px; }
        .cs-head-icon { width:48px; height:48px; border-radius:14px; background:#eef2ff; color:var(--ad-brand); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .cs-title { font-size:22px; font-weight:700; color:#0f172a; margin:0; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .cs-badge { font-size:12.5px; font-weight:700; background:#ede9fe; color:var(--ad-brand); padding:3px 11px; border-radius:20px; }
        .cs-sub { font-size:13.5px; color:#64748b; margin:3px 0 0; }
        .cs-btn { display:inline-flex; align-items:center; gap:7px; border-radius:10px; padding:8px 16px; font-size:13.5px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .15s ease; }
        .cs-btn-primary { background:var(--ad-brand); border-color:var(--ad-brand); color:#fff; }
        .cs-btn-primary:hover { background:var(--ad-brand-2); border-color:var(--ad-brand-2); }
        .cs-btn-outline { background:#fff; border-color:#e2e8f0; color:#475569; }
        .cs-btn-outline:hover { border-color:#cbd5e1; color:#1e293b; }
        .cs-btn:disabled { opacity:.6; cursor:not-allowed; }
        .cs-filter { background:#fff; border:1px solid #edf2f6; border-radius:14px; padding:12px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:18px; }
        .cs-select { border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:13px; color:#1e293b; background:#fff; min-width:200px; }
        .cs-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(420px, 1fr)); gap:16px; }
        @media (max-width:560px) { .cs-page { padding:16px; } .cs-grid { grid-template-columns:1fr; } }
        .cs-card { background:#fff; border:1px solid #eef2f6; border-radius:16px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,.03); display:flex; flex-direction:column; gap:12px; }
        .cs-card.is-hidden { opacity:.7; }
        .cs-card-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
        .cs-card-course { font-size:12px; font-weight:600; color:#0284c7; display:flex; align-items:center; gap:5px; }
        .cs-card-batch { font-size:16px; font-weight:700; color:#0f172a; margin:3px 0 0; display:flex; align-items:center; gap:6px; }
        .cs-card-dates { font-size:12px; color:#64748b; margin-top:2px; }
        .cs-pill { font-size:11.5px; font-weight:700; padding:3px 10px; border-radius:20px; white-space:nowrap; }
        .cs-pill-on { background:#ecfdf5; color:#059669; }
        .cs-pill-off { background:#f1f5f9; color:#64748b; }
        .cs-table-wrap { overflow-x:auto; border:1px solid #e2e8f0; border-radius:10px; }
        .cs-table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .cs-table th { background:#0f172a; color:#fff; font-size:11px; letter-spacing:.4px; text-transform:uppercase; padding:8px 10px; text-align:left; white-space:nowrap; }
        .cs-table td { padding:7px 10px; border-top:1px solid #f1f5f9; color:#334155; white-space:nowrap; }
        .cs-table td.day { font-weight:600; color:#0f172a; }
        .cs-actions { display:flex; gap:6px; justify-content:flex-end; }
        .cs-icon-btn { width:32px; height:32px; border-radius:8px; border:none; display:inline-flex; align-items:center; justify-content:center; background:#f1f5f9; color:#475569; cursor:pointer; }
        .cs-icon-btn:hover { background:#e0e7ff; color:var(--ad-brand-2); }
        .cs-icon-btn.danger:hover { background:#ffe4e6; color:#e11d48; }
        .cs-icon-btn:disabled { opacity:.5; cursor:not-allowed; }
        .cs-empty { background:#fff; border:1px dashed #cbd5e1; border-radius:16px; padding:48px 20px; text-align:center; color:#64748b; }
        .cs-modal-back { position:fixed; inset:0; background:rgba(15,23,42,.6); backdrop-filter:blur(3px); z-index:1050; display:flex; align-items:flex-start; justify-content:center; padding:40px 16px; overflow-y:auto; }
        .cs-modal { background:#fff; border-radius:18px; width:100%; max-width:860px; box-shadow:0 25px 50px -12px rgba(0,0,0,.25); }
        .cs-modal-head { display:flex; justify-content:space-between; align-items:center; padding:18px 22px; border-bottom:1px solid #e2e8f0; }
        .cs-modal-head h5 { margin:0; font-size:17px; font-weight:700; color:#0f172a; }
        .cs-modal-body { padding:20px 22px; display:flex; flex-direction:column; gap:16px; }
        .cs-modal-foot { padding:14px 22px; border-top:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:flex-end; gap:10px; border-radius:0 0 18px 18px; }
        .cs-two { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media (max-width:640px) { .cs-two { grid-template-columns:1fr; } }
        .cs-label { display:block; font-size:13px; font-weight:600; color:#1e293b; margin-bottom:6px; }
        .cs-input { width:100%; border:1.5px solid #cbd5e1; border-radius:9px; padding:8px 11px; font-size:13.5px; color:#0f172a; background:#fff; }
        .cs-input:focus { outline:none; border-color:var(--ad-brand); }
        .cs-rows-head { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
        .cs-row { display:grid; grid-template-columns:1fr 1.3fr 1fr 1.3fr 34px; gap:8px; align-items:center; }
        .cs-row-labels span { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
        @media (max-width:720px) { .cs-row { grid-template-columns:1fr 1fr; } .cs-row-labels { display:none; } }
        .cs-hint { font-size:12px; color:#64748b; margin:4px 0 0; }
        .cs-tabs { display:flex; gap:6px; background:#fff; border:1px solid #edf2f6; border-radius:12px; padding:5px; width:fit-content; margin-bottom:16px; flex-wrap:wrap; }
        .cs-tab { display:inline-flex; align-items:center; gap:7px; border:none; background:transparent; border-radius:9px; padding:8px 16px; font-size:13.5px; font-weight:600; color:#475569; cursor:pointer; }
        .cs-tab.is-active { background:var(--ad-brand); color:#fff; }
        .cr-list { display:flex; flex-direction:column; gap:12px; }
        .cr-item { background:#fff; border:1px solid #eef2f6; border-radius:14px; padding:16px 18px; display:flex; gap:14px; align-items:flex-start; box-shadow:0 1px 3px rgba(0,0,0,.03); }
        .cr-item.is-hidden { opacity:.7; }
        .cr-move { display:flex; flex-direction:column; gap:4px; }
        .cr-body { flex:1; min-width:0; }
        .cr-top { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .cr-top h4 { font-size:15.5px; font-weight:700; color:#0f172a; margin:0; }
        .cr-course { font-size:11.5px; font-weight:600; color:#0284c7; background:#e0f2fe; border-radius:20px; padding:2px 9px; }
        .cr-body p { font-size:13px; color:#475569; margin:6px 0 10px; }
        .cr-links { display:flex; gap:6px; flex-wrap:wrap; }
        .cr-link { display:inline-flex; align-items:center; gap:6px; background:#0f172a; color:#fff !important; font-size:12px; font-weight:700; padding:6px 11px; border-radius:7px; text-decoration:none; }
        .cr-link-row { display:grid; grid-template-columns:1fr 1.4fr 34px; gap:8px; align-items:center; }
        @media (max-width:640px) { .cr-link-row { grid-template-columns:1fr 34px; } .cr-link-row input:nth-child(2) { grid-column:1 / 2; } .cr-item { flex-wrap:wrap; } }
      `}</style>

      <div className="content">
        <div className="container-fluid cs-page">
          <div className="cs-head">
            <div className="cs-head-left">
              <div className="cs-head-icon">{tab === "resources" ? <Library size={24} /> : <CalendarClock size={24} />}</div>
              <div>
                <h3 className="cs-title">
                  {tab === "resources" ? "Course Resources" : <>Class Schedules <span className="cs-badge">{list.length} Total</span></>}
                </h3>
                <p className="cs-sub">
                  {tab === "resources"
                    ? "The course materials on the students' Class Schedule page — for every course or for one."
                    : "Each batch's weekly class times, shown to the batch's students in their panel."}
                </p>
              </div>
            </div>
            {tab === "schedules" && permCan("create") && (
              <button className="cs-btn cs-btn-primary" onClick={openAdd}>
                <Plus size={16} /> Add Class Schedule
              </button>
            )}
          </div>

          <div className="cs-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "schedules"} className={`cs-tab${tab === "schedules" ? " is-active" : ""}`} onClick={() => switchTab("schedules")}>
              <CalendarClock size={15} /> Class Schedules
            </button>
            <button type="button" role="tab" aria-selected={tab === "resources"} className={`cs-tab${tab === "resources" ? " is-active" : ""}`} onClick={() => switchTab("resources")}>
              <Library size={15} /> Course Resources
            </button>
          </div>

          {tab === "resources" ? (
            ready ? <ResourcesPanel courses={courses} /> : <InlineLoader center label="Loading resources…" />
          ) : (
          <>
          <div className="cs-filter">
            <ListSearch placeholder="Search course or batch…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="cs-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.req_id} value={c.req_id}>{courseLabel(c)}</option>
              ))}
            </select>
            <div className="ms-auto">
              <button data-refresh className="reload-btn" title="Reload" onClick={() => load(true)} disabled={loading}>
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          {loading ? (
            <SkeletonCards variant="grid" count={6} />
          ) : shown.length === 0 ? (
            <div className="cs-empty">
              {list.length === 0
                ? "No class schedules yet. Add one for a batch and its students will see it in their panel."
                : "No class schedules match your search."}
            </div>
          ) : (
            <div className="cs-grid">
              {shown.map((item) => {
                const on = item.status === "1";
                return (
                  <div key={item.id} className={`cs-card${on ? "" : " is-hidden"}`}>
                    <div className="cs-card-top">
                      <div>
                        <div className="cs-card-course"><BookOpen size={13} /> {decodeHtml(item.course_name || "Course removed")}</div>
                        <div className="cs-card-batch"><Layers size={15} /> {decodeHtml(item.batch_name || "Batch removed")}</div>
                        {(item.batch_sdate || item.batch_edate) && (
                          <div className="cs-card-dates">{fmtDate(item.batch_sdate)} → {fmtDate(item.batch_edate)}</div>
                        )}
                      </div>
                      <span className={`cs-pill ${on ? "cs-pill-on" : "cs-pill-off"}`}>{on ? "Shown" : "Hidden"}</span>
                    </div>

                    {item.intro && <div style={{ fontSize: 12.5, color: "#475569" }}>{item.intro}</div>}

                    <div className="cs-table-wrap">
                      <table className="cs-table">
                        <thead>
                          <tr><th>Day (EST)</th><th>Time (EST)</th><th>Day (IST)</th><th>Time (IST)</th></tr>
                        </thead>
                        <tbody>
                          {(item.rows || []).map((r: Row, i: number) => (
                            <tr key={i}>
                              <td className="day">{r.day_est}</td><td>{r.time_est}</td>
                              <td className="day">{r.day_ist}</td><td>{r.time_ist}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="cs-actions">
                      {permCan("edit") && (
                        <button className="cs-icon-btn" title="Edit" onClick={() => openEdit(item)} disabled={busyId === item.id}>
                          <Edit2 size={14} />
                        </button>
                      )}
                      {permCan("status") && (
                        <button className="cs-icon-btn" title={on ? "Hide from students" : "Show to students"} onClick={() => toggle(item)} disabled={busyId === item.id}>
                          {on ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                      {permCan("delete") && (
                        <button className="cs-icon-btn danger" title="Delete" onClick={() => del(item)} disabled={busyId === item.id}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="saved-ago-row" style={{ marginTop: 14 }}>
            <SavedAgo endpoint="api/class-schedules" />
          </div>
          </>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="cs-modal-back" onClick={closeModal}>
          <form className="cs-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <div className="cs-modal-head">
              <h5>{editing ? "Edit Class Schedule" : "Add Class Schedule"}</h5>
              <button type="button" className="cs-icon-btn" onClick={closeModal} aria-label="Close"><X size={16} /></button>
            </div>

            <div className="cs-modal-body">
              <div className="cs-two">
                <div>
                  <label className="cs-label">Course *</label>
                  <select
                    className="cs-input"
                    value={form.c_id}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, c_id: e.target.value, b_id: "" }));
                      loadBatches(e.target.value);
                    }}
                  >
                    <option value="">Select course</option>
                    {courses.map((c) => (
                      <option key={c.req_id} value={c.req_id}>{courseLabel(c)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="cs-label">Batch *</label>
                  <select
                    className="cs-input"
                    value={form.b_id}
                    onChange={(e) => setForm((f) => ({ ...f, b_id: e.target.value }))}
                    disabled={!form.c_id || loadingBatches}
                  >
                    <option value="">
                      {loadingBatches ? "Loading batches…" : !form.c_id ? "Select course first" : batches.length ? "Select batch" : "No batches for this course"}
                    </option>
                    {batches.map((b) => (
                      <option key={b.b_id} value={b.b_id} disabled={takenBatches.has(b.b_id)}>
                        {decodeHtml(b.name)}{takenBatches.has(b.b_id) ? " — has a schedule" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="cs-label">Intro line</label>
                <input
                  className="cs-input"
                  maxLength={300}
                  placeholder={STANDARD_INTRO}
                  value={form.intro}
                  onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
                />
              </div>

              <div>
                <div className="cs-rows-head">
                  <label className="cs-label" style={{ margin: 0 }}>Classes *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="cs-btn cs-btn-outline" onClick={fillStandard}>
                      <Wand2 size={14} /> Use standard schedule
                    </button>
                    <button type="button" className="cs-btn cs-btn-outline" onClick={addRow} disabled={form.rows.length >= 21}>
                      <Plus size={14} /> Add class
                    </button>
                  </div>
                </div>
                <div className="cs-row cs-row-labels" style={{ marginTop: 10 }}>
                  <span>Day (EST)</span><span>Time (EST)</span><span>Day (IST)</span><span>Time (IST)</span><span />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                  {form.rows.map((r, i) => (
                    <div className="cs-row" key={i}>
                      <input className="cs-input" maxLength={30} placeholder="Wednesday" value={r.day_est} onChange={(e) => setRow(i, "day_est", e.target.value)} />
                      <input className="cs-input" maxLength={40} placeholder="9:00 PM – 10:00 PM" value={r.time_est} onChange={(e) => setRow(i, "time_est", e.target.value)} />
                      <input className="cs-input" maxLength={30} placeholder="Thursday" value={r.day_ist} onChange={(e) => setRow(i, "day_ist", e.target.value)} />
                      <input className="cs-input" maxLength={40} placeholder="6:30 AM – 7:30 AM" value={r.time_ist} onChange={(e) => setRow(i, "time_ist", e.target.value)} />
                      <button type="button" className="cs-icon-btn danger" title="Remove class" onClick={() => removeRow(i)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="cs-hint">The IST day can run a day ahead of the EST one — fill in both.</p>
              </div>

              <div>
                <label className="cs-label">Note under the table</label>
                <textarea
                  className="cs-input"
                  rows={2}
                  maxLength={400}
                  placeholder={STANDARD_NOTE}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>

            <div className="cs-modal-foot">
              <button type="button" className="cs-btn cs-btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
              <button type="submit" className="cs-btn cs-btn-primary" disabled={saving}>
                {saving ? <ButtonLoader label="Saving…" /> : editing ? "Save changes" : "Add Class Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
