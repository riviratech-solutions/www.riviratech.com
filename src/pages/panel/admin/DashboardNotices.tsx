import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  BellRing, Plus, RotateCw, Radio, CalendarClock, CalendarX2, Trash2, Edit2, GripVertical, Users,
  MessageSquareReply, Loader, CheckCircle2, Bold, Italic, Underline, List, ListOrdered, Link2,
  RemoveFormatting, Undo2, Eye,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { NoticeCard, NOTICE_STYLES, REPLY_STATUS } from "../../../components/DashboardNotices";
import { sanitizeHtml } from "../../../utils/sanitizeHtml";
import { AnimatedNumber, ButtonLoader, SkeletonList } from "../../../components/loading";

/* Admin → Dashboard Notices: notices on the student dashboard
   (api/admin/dashboard-notices) and the replies students send back. */

const seo = getSeoByPath("");
const PAGE_SIZE = 10;

type When = "live" | "scheduled" | "expired" | "hidden";
function whenOf(m: any, now: number): When {
  if (m.status !== "1") return "hidden";
  if (Number(m.end_at) && Number(m.end_at) <= now) return "expired";
  if (Number(m.start_at) && Number(m.start_at) > now) return "scheduled";
  return "live";
}
const WHEN_PILL: Record<When, [string, string]> = {
  live: ["Live", "si-status-active"],
  scheduled: ["Scheduled", "si-status-scheduled"],
  expired: ["Expired", "si-status-expired"],
  hidden: ["Hidden", "si-status-disabled"],
};
const toLocalInput = (epoch: number) => {
  if (!epoch) return "";
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);
const fmt = (epoch: number) =>
  epoch ? new Date(epoch * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const parseList = (v: any): string[] => {
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
};
const decode = (s: string) => {
  const t = document.createElement("textarea");
  t.innerHTML = String(s || "");
  return t.value;
};
const plain = (html: string) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const EMPTY = {
  title: "",
  html: "",
  style: "info",
  audience: "all",
  courses: [] as string[],
  batches: [] as string[],
  allow_reply: true,
  start: "",
  end: "",
};

/* ---------------- small rich-text box (bold, italic, lists, links) ---------------- */
function MiniEditor({ initial, onChange }: { initial: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // cleaned first: a saved notice with an onerror / javascript: link would
    // otherwise run in the editing admin's browser
    if (ref.current) ref.current.innerHTML = sanitizeHtml(initial || "");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    // links open in a new tab on the dashboard
    el.querySelectorAll("a").forEach((a) => { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
    onChange(el.innerHTML);
  };
  const cmd = (name: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, value);
    emit();
  };
  const link = () => {
    const url = window.prompt("Link address (https://…)", "https://");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url.trim())) return toast.error("Use a link starting with https://, http://, mailto: or /");
    cmd("createLink", url.trim());
  };
  const B = ({ title, onClick, children }: any) => (
    <button type="button" title={title} aria-label={title} className="dn-ed-btn" onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
  return (
    <div className="dn-ed">
      <div className="dn-ed-bar">
        <B title="Bold" onClick={() => cmd("bold")}><Bold size={15} /></B>
        <B title="Italic" onClick={() => cmd("italic")}><Italic size={15} /></B>
        <B title="Underline" onClick={() => cmd("underline")}><Underline size={15} /></B>
        <span className="dn-ed-sep" />
        <B title="Bullet list" onClick={() => cmd("insertUnorderedList")}><List size={15} /></B>
        <B title="Numbered list" onClick={() => cmd("insertOrderedList")}><ListOrdered size={15} /></B>
        <B title="Link" onClick={link}><Link2 size={15} /></B>
        <span className="dn-ed-sep" />
        <B title="Clear formatting" onClick={() => { cmd("removeFormat"); cmd("unlink"); }}><RemoveFormatting size={15} /></B>
        <B title="Undo" onClick={() => cmd("undo")}><Undo2 size={15} /></B>
      </div>
      <div
        ref={ref}
        className="dn-ed-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Notice message"
        data-placeholder="Write the notice students will see…"
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          // paste as plain text so no foreign styling comes along
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          emit();
        }}
      />
    </div>
  );
}

/* ---------------- a notice row (drag to reorder) ---------------- */
function Row({ item, now, courseName, batchName, onEdit, onDelete, onToggle, onReplies, busy, canReorder }: any) {
  const permCan = usePagePerm("dashboard-notices");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const when = whenOf(item, now);
  const courses = parseList(item.courses), batches = parseList(item.batches);
  const audience = item.audience === "select"
    ? [...courses.map(courseName), ...batches.map(batchName)].join(", ")
    : "All students";
  const style = NOTICE_STYLES[item.style] ? item.style : "info";

  return (
    <div
      ref={setNodeRef}
      className="mq-row-wrap"
      style={{
        transform: CSS.Transform.toString(transform), transition,
        boxShadow: isDragging ? "0 12px 30px rgba(16,23,41,.15)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
    <div className="mq-row" style={{ opacity: isDragging ? 0.85 : item.status === "1" ? 1 : 0.65 }}>
      <span {...(canReorder ? { ...attributes, ...listeners } : {})} title={canReorder ? "Drag to reorder" : ""}
        className="mq-grip" style={{ cursor: canReorder ? "grab" : "default" }}>
        <GripVertical size={18} />
      </span>
      <div className="mq-row-main">
        <div className="mq-row-title">
          <span className={`dn-style-dot dn-style-${style}`} title={NOTICE_STYLES[style].label} /> {item.title}
        </div>
        <div className="mq-row-text" title={plain(item.html)}>{plain(item.html)}</div>
        <div className="mq-row-meta">
          <span className="mq-chip" title={audience}><Users size={12} /> {item.audience === "select" ? `${courses.length + batches.length} selected` : "All students"}</span>
          <span className="mq-chip">{item.allow_reply === "1" ? "Replies on" : "Replies off"}</span>
          {(item.allow_reply === "1" || Number(item.replies) > 0) && (
            <button type="button" title="Open the replies"
              className={`mq-chip mq-chip-btn ${Number(item.replies_new) ? "has-new" : ""}`} onClick={() => onReplies(item)}>
              <MessageSquareReply size={12} /> {item.replies} {Number(item.replies) === 1 ? "reply" : "replies"}
              {Number(item.replies_new) > 0 && ` · ${item.replies_new} new`}
            </button>
          )}
          <span className="mq-chip" title="Students who have opened it"><Eye size={12} /> {item.reads} read</span>
          {(Number(item.start_at) > 0 || Number(item.end_at) > 0) && (
            <span className="mq-chip mq-chip-time">
              <CalendarClock size={12} />
              {Number(item.start_at) > 0 ? fmt(Number(item.start_at)) : "Now"} → {Number(item.end_at) > 0 ? fmt(Number(item.end_at)) : "No expiry"}
            </span>
          )}
        </div>
      </div>
      <span className={`si-status-pill ${WHEN_PILL[when][1]}`}><span className="si-status-dot" /> {WHEN_PILL[when][0]}</span>
      <div className="form-check form-switch m-0" title={item.status === "1" ? "Shown to students" : "Hidden from students"}>
        <input disabled={!permCan("status")} className="form-check-input" type="checkbox" style={{ cursor: "pointer" }}
          checked={item.status === "1"} onChange={() => onToggle(item)} />
      </div>
      <div className="si-action-btns">
        {permCan("edit") && (
          <button type="button" className="si-action-btn btn-edit" onClick={() => onEdit(item)} title="Edit notice"><Edit2 size={14} /></button>
        )}
        {permCan("delete") && (
          <button type="button" className="si-action-btn btn-del" disabled={busy} onClick={() => onDelete(item)} title="Delete notice"><Trash2 size={14} /></button>
        )}
      </div>
    </div>
    </div>
  );
}

/* ---------------- "Showing x to y of n" + page buttons ---------------- */
function Pager({ page, total, onPage, noun }: { page: number; total: number; onPage: (p: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, pages);
  if (!total) return null;
  return (
    <div className="si-table-footer">
      <div className="si-table-info">
        Showing {(cur - 1) * PAGE_SIZE + 1} to {Math.min(cur * PAGE_SIZE, total)} of {total} {noun}
      </div>
      {pages > 1 && (
        <div className="si-pagination">
          <button type="button" className="si-page-nav-btn" disabled={cur <= 1} onClick={() => onPage(cur - 1)}>« Prev</button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - cur) <= 2)
            .map((n, idx, arr) => (
              <span key={n} className="d-flex align-items-center">
                {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-1 text-muted">…</span>}
                <button type="button" className={`si-page-btn ${n === cur ? "active" : ""}`} onClick={() => onPage(n)}>{n}</button>
              </span>
            ))}
          <button type="button" className="si-page-nav-btn" disabled={cur >= pages} onClick={() => onPage(cur + 1)}>Next »</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- one notice's replies, in a popup ----------------
   Grouped by student: each student is one conversation, their messages on the
   left and the team's notes (in progress / completed) on the right. */
const R_FILTERS: [string, string][] = [["ALL", "All"], ["1", "New"], ["2", "In progress"], ["3", "Completed"]];
const initials = (name: string) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function RepliesModal({ notice, replies, loading, initialFilter, onClose, onStatus, onDelete, onReload, onStudent, studentOpen }: any) {
  const permCan = usePagePerm("dashboard-notices");
  const [filter, setFilter] = useState(initialFilter || "ALL");
  const [page, setPage] = useState(1);
  const count = (k: string) => (k === "ALL" ? replies.length : replies.filter((r: any) => r.status === k).length);
  const style = NOTICE_STYLES[notice.style] ? notice.style : "info";
  const bodyRef = useRef<HTMLDivElement>(null);
  const goPage = (n: number) => { setPage(n); bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !studentOpen) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, studentOpen]);

  // one conversation per student, oldest message first; students with new
  // messages first, then the most recent conversation
  const threads = useMemo(() => {
    const m = new Map<string, any>();
    replies.forEach((r: any) => {
      const t = m.get(r.mem_id) || { mem_id: r.mem_id, name: r.name, email: r.email, number: r.number, items: [] as any[] };
      t.items.push(r);
      m.set(r.mem_id, t);
    });
    return [...m.values()]
      .map((t) => {
        t.items.sort((a: any, b: any) => Number(a.datetime) - Number(b.datetime) || a.id - b.id);
        t.latest = Math.max(...t.items.map((r: any) => Number(r.datetime) || 0));
        t.newCount = t.items.filter((r: any) => r.status === "1").length;
        return t;
      })
      .filter((t) => filter === "ALL" || t.items.some((r: any) => r.status === filter))
      .sort((a, b) => (b.newCount > 0 ? 1 : 0) - (a.newCount > 0 ? 1 : 0) || b.latest - a.latest);
  }, [replies, filter]);
  const pages = Math.max(1, Math.ceil(threads.length / PAGE_SIZE));
  const cur = Math.min(page, pages);

  const pill = (s: string) => (
    <span className={`si-status-pill ${s === "1" ? "si-status-new" : s === "2" ? "si-status-progress" : "si-status-active"}`}>
      <span className="si-status-dot" /> {s === "1" ? "New" : REPLY_STATUS[s]}
    </span>
  );

  return (
    <div className="modal fade show d-block dn-replies-modal" tabIndex={-1} role="dialog" aria-modal="true" aria-label={"Replies to " + notice.title}
      style={{ background: "rgba(15,23,42,.45)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content" style={{ borderRadius: 16 }}>
          <div className="modal-header align-items-start">
            <div className="me-3" style={{ minWidth: 0 }}>
              <div className="dn-rp-kicker"><MessageSquareReply size={13} /> Replies</div>
              <h5 className="modal-title fw-bold d-flex align-items-center gap-2" style={{ fontSize: 17 }}>
                <span className={`dn-style-dot dn-style-${style}`} /> <span className="text-truncate">{notice.title}</span>
              </h5>
            </div>
            <button type="button" className="btn-close mt-2" aria-label="Close" onClick={onClose} />
          </div>
          <div className="dn-rp-bar px-3 pt-3">
            {R_FILTERS.map(([k, label]) => (
              <button key={k} type="button" className={`dn-rp-f${filter === k ? " on" : ""}`} onClick={() => { setFilter(k); setPage(1); }}>
                {label} <span>{count(k)}</span>
              </button>
            ))}
            <button type="button" className="reload-btn ms-auto" title="Refresh replies" disabled={loading} onClick={onReload}>
              <RotateCw size={15} />
            </button>
          </div>
          <div className="modal-body dn-rp" ref={bodyRef}>
            {loading && !replies.length ? (
              <SkeletonList rows={3} />
            ) : threads.length === 0 ? (
              <div className="text-muted py-4 text-center" style={{ fontSize: 13.5 }}>{replies.length ? "No replies with this status." : "No replies yet."}</div>
            ) : (
              threads.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE).map((t: any) => (
                <div key={t.mem_id} className="dn-thread">
                  <div className="dn-thread-head">
                    <span className="dn-avatar">{initials(t.name)}</span>
                    <div className="dn-rp-who">
                      <button type="button" className="dn-who-link" title="View student details" onClick={() => onStudent(t.mem_id)}>{t.name || "—"}</button>
                      <span>{[t.email, t.number].filter(Boolean).join(" · ")}</span>
                    </div>
                    {t.newCount > 0 && <span className="dn-thread-new">{t.newCount} new</span>}
                    <span className="dn-rp-time">{t.items.length} {t.items.length === 1 ? "message" : "messages"}</span>
                  </div>
                  <div className="dn-chat">
                    {t.items.map((r: any) => (
                      <div key={r.id} className={`dn-turn${filter !== "ALL" && r.status !== filter ? " dim" : ""}`}>
                        <div className={`dn-bubble student s${r.status}`}>
                          <div className="dn-msg">{r.message}</div>
                          <div className="dn-bubble-meta">{fmt(Number(r.datetime))} {pill(r.status)}</div>
                          {permCan("replies") && (
                            <div className="dn-rp-acts">
                              {r.status === "1" && <button type="button" className="dn-act dn-act-progress" onClick={() => onStatus(r, "2")}><Loader size={13} /> In progress</button>}
                              {r.status === "2" && <button type="button" className="dn-act dn-act-progress" onClick={() => onStatus(r, "2")}><Edit2 size={13} /> Edit note</button>}
                              {r.status !== "3" && <button type="button" className="dn-act dn-act-done" onClick={() => onStatus(r, "3")}><CheckCircle2 size={13} /> Complete</button>}
                              {r.status === "3" && <button type="button" className="dn-act dn-act-reopen" onClick={() => onStatus(r, "2")}><Undo2 size={13} /> Reopen</button>}
                              <button type="button" className="dn-act" onClick={() => onDelete(r)} title="Delete this message"><Trash2 size={13} /> Delete</button>
                            </div>
                          )}
                        </div>
                        {!!r.progress_note && r.status !== "1" && (
                          <div className="dn-bubble team progress-note">
                            <div className="dn-bubble-label">In progress</div>
                            <div className="dn-msg">{r.progress_note}</div>
                            {Number(r.progress_at) > 0 && <div className="dn-bubble-meta">{fmt(Number(r.progress_at))}</div>}
                          </div>
                        )}
                        {!!r.done_note && r.status === "3" && (
                          <div className="dn-bubble team done-note">
                            <div className="dn-bubble-label">Completed</div>
                            <div className="dn-msg">{r.done_note}</div>
                            {Number(r.done_at) > 0 && <div className="dn-bubble-meta">{fmt(Number(r.done_at))}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          {threads.length > 0 && (
            <div className="modal-footer py-2">
              <Pager page={cur} total={threads.length} onPage={goPage} noun={threads.length === 1 ? "student" : "students"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- a replying student's full details (opened from their name) ---------------- */
const ACCOUNT_STATUS: Record<string, [string, string]> = {
  "1": ["Active", "si-status-active"],
  "1S": ["Disabled", "si-status-disabled"],
  "1D": ["Disabled", "si-status-disabled"],
};
function StudentModal({ memId, post, onClose }: { memId: string; post: (path: string, body?: any) => Promise<any>; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    post("api/notice-student", { mem_id: memId })
      .then((r) => { if (!alive) return; if (r.success) setData(r.data); else setError(r.message || "Could not load the student"); })
      .catch(() => alive && setError("Could not load the student"));
    return () => { alive = false; };
  }, [memId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const address = data ? [data.address, data.city, data.state, data.pincode].filter((x: any) => String(x || "").trim()).join(", ") : "";
  const acct = data ? ACCOUNT_STATUS[data.status] || [data.status || "—", "si-status-disabled"] : null;
  const Field = ({ label, children }: any) => (
    <div className="dn-sf"><span>{label}</span><div>{children || <span className="text-muted">—</span>}</div></div>
  );

  return (
    <div className="modal fade show d-block dn-student-modal" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Student details"
      style={{ background: "rgba(15,23,42,.45)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content" style={{ borderRadius: 16 }}>
          <div className="modal-header">
            <h5 className="modal-title fw-bold">Student details</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {error ? (
              <div className="text-center text-muted py-4">{error}</div>
            ) : !data ? (
              <SkeletonList rows={4} />
            ) : (
              <>
                <div className="dn-sp-head">
                  {data.profile
                    ? <img className="dn-sp-photo" src={AWS_UPLOADS + data.profile} alt="" />
                    : <span className="dn-avatar dn-sp-photo">{initials(data.name)}</span>}
                  <div style={{ minWidth: 0 }}>
                    <div className="dn-sp-name">{data.name || "—"}</div>
                    <div className="dn-sp-sub">
                      <span className={`si-status-pill ${acct![1]}`}><span className="si-status-dot" /> {acct![0]}</span>
                      <span>Student ID {data.mem_id}</span>
                    </div>
                  </div>
                </div>

                <div className="dn-sf-grid">
                  <Field label="Email">{data.email && <a href={"mailto:" + data.email}>{data.email}</a>}</Field>
                  <Field label="Phone">{data.number && <a href={"tel:" + String(data.number).replace(/[^\d+]/g, "")}>{data.number}</a>}</Field>
                  <Field label="Gender">{data.gender}</Field>
                  <Field label="Qualification">{data.qualification}</Field>
                  <Field label="Address">{address}</Field>
                  <Field label="Joined">{Number(data.datetime) ? fmt(Number(data.datetime)) : ""}</Field>
                  <Field label="Last active">{Number(data.lastdatetime) ? fmt(Number(data.lastdatetime)) : ""}</Field>
                  <Field label="Notice replies">
                    {data.replies.total} on {data.replies.notices} {data.replies.notices === 1 ? "notice" : "notices"}
                    {" · "}{data.replies.new} new · {data.replies.progress} in progress · {data.replies.done} completed
                  </Field>
                </div>

                <div className="dn-sp-section">Courses</div>
                {data.courses.length === 0 ? (
                  <div className="text-muted" style={{ fontSize: 13 }}>Not enrolled in any course.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
                      <thead><tr><th>Course</th><th>Batch</th><th>Enrolled</th><th>Expires</th><th>Status</th></tr></thead>
                      <tbody>
                        {data.courses.map((c: any, i: number) => (
                          <tr key={i}>
                            <td className="fw-semibold">{c.course ? decode(c.course) : <span className="text-muted">(removed course)</span>}</td>
                            <td>{c.batch ? decode(c.batch) : "—"}</td>
                            <td>{Number(c.datetime) ? fmt(Number(c.datetime)) : "—"}</td>
                            <td>{Number(c.expires) ? fmt(Number(c.expires)) : "—"}</td>
                            <td>{c.status === "1" ? <span className="si-status-pill si-status-active"><span className="si-status-dot" /> Active</span>
                              : <span className="si-status-pill si-status-disabled"><span className="si-status-dot" /> Inactive</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            {data?.email && (
              <a className="dn-open-students" href={"/panel/students?q=" + encodeURIComponent(data.email)} target="_blank" rel="noopener noreferrer">
                Open in Students
              </a>
            )}
            <button type="button" className="si-btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardNotices() {
  const permCan = usePagePerm("dashboard-notices");
  const navigate = useNavigate();
  // the notice whose replies are open in the popup
  const [repliesFor, setRepliesFor] = useState<{ id: number; filter: string } | null>(null);
  const [studentFor, setStudentFor] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // notices
  const [list, setList] = useState<any[]>([]);
  const [serverNow, setServerNow] = useState(() => Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [search, setSearch] = useState("");
  const [whenFilter, setWhenFilter] = useState<"ALL" | When>("ALL");

  // audience choices
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  // replies
  const [replies, setReplies] = useState<any[]>([]);
  const [rLoading, setRLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<{ reply: any; status: string } | null>(null);
  const [note, setNote] = useState("");
  const [rBusy, setRBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const getSecurity = async () => (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;
  const post = async (path: string, body: any = {}) => {
    const s = await getSecurity();
    return (await axios.post(SERVER_URL + path, { ...body, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true })).data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/notices-list", {});
      if (res.data.success) {
        setList(res.data.data);
        setServerNow(Math.floor(Date.now() / 1000));
        // from the admin bell (?open=new): open the first notice with new replies
        if (new URLSearchParams(window.location.search).get("open") === "new") {
          const first = res.data.data.find((n: any) => Number(n.replies_new) > 0);
          if (first) setRepliesFor({ id: first.id, filter: "1" });
        }
      } else toast.error(res.data.message || "Failed to load");
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };
  const loadReplies = async () => {
    setRLoading(true);
    try {
      const res = await listFetch("api/notice-replies-list", {});
      if (res.data.success) setReplies(res.data.data);
      else toast.error(res.data.message || "Failed to load replies");
    } catch { toast.error("Something went wrong"); }
    finally { setRLoading(false); }
  };
  const loadAudience = async () => {
    try {
      const [c, b] = await Promise.all([
        listFetch("api/get-courses", { status: "" }),
        listFetch("api/get-batches", { c_id: "", status: "" }),
      ]);
      if (c.data.success) setCourses(c.data.data || []);
      if (b.data.success) setBatches(b.data.data || []);
    } catch { /* the picker shows what it has */ }
  };

  const initchecklogin = async () => {
    try {
      const d = (await axios.get(SERVER_URL + "api/check-login", { withCredentials: true })).data;
      if (d.loggedIn && (d.id == "X" || d.id == "Y")) {
        await load();
        await loadReplies();
        loadAudience();
      } else navigate("/logout");
    } catch { navigate("/logout"); }
  };
  useEffect(() => { initchecklogin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const courseName = (id: string) => decode(courses.find((c) => c.req_id === id)?.title || "") || "Course";
  const batchName = (id: string) => {
    const b = batches.find((x) => x.b_id === id);
    return b ? `${decode(b.name)} (${courseName(b.c_id)})` : "Batch";
  };

  /* ---- notices ---- */
  const openAdd = () => { setEditing(null); setForm({ ...EMPTY }); setModalOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      html: item.html || "",
      style: item.style || "info",
      audience: item.audience === "select" ? "select" : "all",
      courses: parseList(item.courses),
      batches: parseList(item.batches),
      allow_reply: item.allow_reply === "1",
      start: toLocalInput(Number(item.start_at) || 0),
      end: toLocalInput(Number(item.end_at) || 0),
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); };
  const toggleIn = (key: "courses" | "batches", id: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  const save = async (e: any) => {
    e.preventDefault();
    if (form.title.trim().length < 2) return toast.error("Please enter a title");
    if (!plain(form.html)) return toast.error("Please enter the message");
    if (form.audience === "select" && !form.courses.length && !form.batches.length)
      return toast.error("Choose at least one course or batch, or show it to all students");
    const start_at = fromLocalInput(form.start), end_at = fromLocalInput(form.end);
    if (start_at && end_at && end_at <= start_at) return toast.error("The expiry must be after the start");
    setSaving(true);
    try {
      const payload: any = {
        title: form.title, html: form.html, style: form.style, audience: form.audience,
        courses: form.courses, batches: form.batches, allow_reply: form.allow_reply ? "1" : "0", start_at, end_at,
      };
      if (editing) payload.id = editing.id;
      const r = await post("api/notices-save", payload);
      if (r.success) {
        toast.success(r.message);
        if (editing) setList((prev) => prev.map((x) => (x.id === editing.id ? r.data : x)));
        else setList((prev) => [...prev, r.data]);
        closeModal();
      } else toast.error(r.message);
    } catch { toast.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const del = async (item: any) => {
    const n = Number(item.replies) || 0;
    const extra = n ? `\n\nThis also deletes all student replies to it (${n} ${n === 1 ? "message" : "messages"}).` : "";
    if (!window.confirm(`Delete the notice "${item.title}"?${extra}`)) return;
    setBusyId(item.id);
    try {
      const r = await post("api/notices-delete", { id: item.id });
      if (r.success) {
        toast.success(r.message);
        setList((prev) => prev.filter((x) => x.id !== item.id));
        // its chats are gone on the server too
        setReplies((prev) => prev.filter((x) => x.notice_id !== item.id));
        setRepliesFor((cur) => (cur && cur.id === item.id ? null : cur));
      } else toast.error(r.message);
    } catch { toast.error("Something went wrong"); }
    finally { setBusyId(null); }
  };

  const toggle = async (item: any) => {
    const active = item.status !== "1";
    const flip = (on: boolean) => setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: on ? "1" : "1S" } : x)));
    flip(active);
    try {
      const r = await post("api/notices-toggle", { id: item.id, active });
      if (r.success) toast.success(r.message);
      else { toast.error(r.message); flip(!active); }
    } catch { toast.error("Something went wrong"); flip(!active); }
  };

  const onDragEnd = async (e: any) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = list.findIndex((i) => i.id === active.id);
    const newI = list.findIndex((i) => i.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(list, oldI, newI);
    setList(next);
    try {
      const r = await post("api/notices-reorder", { ids: next.map((i) => i.id) });
      if (!r.success) toast.error(r.message || "Could not save the new order");
    } catch { toast.error("Could not save the new order"); }
  };

  const counts = useMemo(() => {
    const c = { live: 0, scheduled: 0, expired: 0, hidden: 0 };
    list.forEach((m) => { c[whenOf(m, serverNow)]++; });
    return c;
  }, [list, serverNow]);
  const shown = list.filter((m) => {
    if (whenFilter !== "ALL" && whenOf(m, serverNow) !== whenFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || `${m.title} ${plain(m.html)}`.toLowerCase().includes(q);
  });
  const canReorder = permCan("reorder") && whenFilter === "ALL" && !search.trim();
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const pageItems = shown.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, whenFilter]);

  /* ---- replies (popup per notice) ---- */
  const newReplies = useMemo(() => replies.filter((r) => r.status === "1").length, [replies]);
  const repliesOf = useMemo(() => {
    const m = new Map<number, any[]>();
    replies.forEach((r) => { m.set(r.notice_id, [...(m.get(r.notice_id) || []), r]); });
    return m;
  }, [replies]);

  const openStatus = (reply: any, status: string) => {
    setNote(status === "2" ? reply.progress_note || "" : status === "3" ? reply.done_note || "" : "");
    setStatusModal({ reply, status });
  };
  const applyStatus = async () => {
    if (!statusModal) return;
    setRBusy(true);
    try {
      const r = await post("api/notice-replies-status", { id: statusModal.reply.id, status: statusModal.status, note });
      if (r.success) {
        toast.success(r.message);
        setReplies((prev) => prev.map((x) => (x.id === statusModal.reply.id ? { ...x, ...r.data } : x)));
        setList((prev) => prev.map((n) => {
          if (n.id !== statusModal.reply.notice_id) return n;
          const was = statusModal.reply.status, now = statusModal.status;
          const d = (s: string) => (was === s ? -1 : 0) + (now === s ? 1 : 0);
          return { ...n, replies_new: Number(n.replies_new) + d("1"), replies_progress: Number(n.replies_progress) + d("2") };
        }));
        setStatusModal(null);
      } else toast.error(r.message);
    } catch { toast.error("Something went wrong"); }
    finally { setRBusy(false); }
  };
  const delReply = async (reply: any) => {
    if (!window.confirm(`Delete this reply from ${reply.name || "the student"}?`)) return;
    try {
      const r = await post("api/notice-replies-delete", { id: reply.id });
      if (r.success) {
        toast.success(r.message);
        setReplies((prev) => prev.filter((x) => x.id !== reply.id));
        setList((prev) => prev.map((n) => (n.id === reply.notice_id
          ? { ...n, replies: Number(n.replies) - 1, replies_new: Number(n.replies_new) - (reply.status === "1" ? 1 : 0) } : n)));
      } else toast.error(r.message);
    } catch { toast.error("Something went wrong"); }
  };
  const showRepliesOf = (item: any) => setRepliesFor({ id: item.id, filter: "ALL" });
  const closeReplies = useCallback(() => setRepliesFor(null), []);
  const closeStudent = useCallback(() => setStudentFor(null), []);
  const openNewReplies = () => {
    const first = list.find((n) => Number(n.replies_new) > 0);
    if (first) setRepliesFor({ id: first.id, filter: "1" });
  };
  const repliesNotice = repliesFor ? list.find((n) => n.id === repliesFor.id) : null;

  // the live preview in the form
  const preview = { id: 0, title: form.title, html: form.html, style: form.style, allow_reply: form.allow_reply ? "1" : "0", read: false };

  return (
    <>
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="content">
        <style>{`
          .si-page-wrapper { background-color: #f8fafc; min-height: calc(100vh - 80px); padding: 24px 28px; }
          @media (max-width: 576px) { .si-page-wrapper { padding: 16px; } }
          .si-header-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 16px; }
          .si-header-left { display: flex; align-items: center; gap: 14px; }
          .si-header-icon-box { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25); flex-shrink: 0; }
          .si-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px; }
          .si-count-badge { display: inline-flex; align-items: center; padding: 4px 10px; background: #eef2ff; color: var(--ad-brand-2); font-size: 12px; font-weight: 700; border-radius: 20px; }
          .si-header-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
          .si-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%); color: #fff !important; font-size: 13.5px; font-weight: 600; border-radius: 10px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.2); }
          .si-btn-primary:disabled { opacity: .6; }
          .si-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
          @media (max-width: 992px) { .si-stats-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 576px) { .si-stats-grid { grid-template-columns: 1fr; } }
          .si-stat-card { background: #fff; border-radius: 14px; padding: 16px 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,.04); cursor: pointer; user-select: none; transition: transform .2s, box-shadow .2s, border-color .2s; }
          .si-stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.08); }
          .si-stat-card.active { box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb),.15); border-color: var(--ad-brand); }
          .si-stat-label { font-size: 12.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
          .si-stat-value { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
          .si-stat-icon-wrap { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
          .si-stat-purple { background: #f5f3ff; color: var(--ad-brand); } .si-stat-green { background: #ecfdf5; color: #059669; }
          .si-stat-blue { background: #eff6ff; color: #2563eb; } .si-stat-red { background: #fef2f2; color: #dc2626; }
          .si-stat-amber { background: #fffbeb; color: #d97706; }
          .si-filter-bar { background: #fff; border-radius: 14px; padding: 14px 18px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
          .si-list-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
          .si-status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; }
          .si-status-active { background: #dcfce7; color: #15803d; } .si-status-scheduled { background: #e0f2fe; color: #0369a1; }
          .si-status-expired { background: #fee2e2; color: #b91c1c; } .si-status-disabled { background: #f1f5f9; color: #64748b; }
          .si-status-new { background: #e0e7ff; color: var(--ad-brand-2); } .si-status-progress { background: #fef3c7; color: #b45309; }
          .si-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
          .si-action-btns { display: flex; align-items: center; gap: 6px; }
          .si-action-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #475569; display: flex; align-items: center; justify-content: center; cursor: pointer; }
          .si-action-btn.btn-edit:hover { background: #e0f2fe; color: #0284c7; border-color: #bae6fd; }
          .si-action-btn.btn-del:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }
          .si-empty-box { text-align: center; padding: 56px 20px; color: #64748b; }
          .si-empty-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 12px 0 6px; }


          .mq-row-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 10px; transition-property: transform, box-shadow; overflow: hidden; }
          .mq-row { display: flex; align-items: center; gap: 16px; padding: 14px 18px; transition: opacity .2s; }
          .dn-new-badge { border: none; background: #fee2e2; color: #b91c1c; cursor: pointer; }
          .dn-rp { background: #f8fafc; }
          .dn-rp-kicker { display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ad-brand); margin-bottom: 2px; }
          .dn-rp-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
          .dn-thread { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 12px; overflow: hidden; }
          .dn-thread-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
          .dn-avatar { width: 36px; height: 36px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%); color: #fff; font-size: 13px; font-weight: 800; }
          .dn-who-link { border: none; background: none; padding: 0; font-weight: 700; font-size: 13.5px; color: var(--ad-brand-2); text-align: left; cursor: pointer; }
          .dn-who-link:hover { text-decoration: underline; }
          .dn-sp-head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
          .dn-sp-photo { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; font-size: 20px; flex: none; }
          .dn-sp-name { font-size: 18px; font-weight: 800; color: #0f172a; }
          .dn-sp-sub { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: #64748b; margin-top: 4px; }
          .dn-sf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-bottom: 16px; }
          @media (max-width: 576px) { .dn-sf-grid { grid-template-columns: 1fr; } }
          .dn-sf { background: #f8fafc; border: 1px solid #eef2f7; border-radius: 10px; padding: 8px 12px; }
          .dn-sf > span { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin-bottom: 2px; }
          .dn-sf > div { font-size: 13.5px; color: #0f172a; overflow-wrap: anywhere; }
          .dn-open-students { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 10px; border: 1px solid #c7d2fe; background: #eef2ff; color: var(--ad-brand-2) !important; font-size: 13.5px; font-weight: 600; text-decoration: none; }
          .dn-open-students:hover { background: #e0e7ff; }
          .dn-sp-section { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--ad-brand); margin: 4px 0 8px; }
          .dn-thread-new { background: #fee2e2; color: #b91c1c; border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 800; }
          .dn-chat { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; background: #f8fafc; }
          .dn-turn { display: flex; flex-direction: column; gap: 6px; }
          .dn-turn.dim { opacity: .45; }
          .dn-bubble { max-width: 82%; padding: 9px 12px; border-radius: 14px; }
          .dn-bubble.student { align-self: flex-start; background: #fff; border: 1px solid #e2e8f0; border-top-left-radius: 4px; }
          .dn-bubble.student.s1 { border-color: #c7d2fe; box-shadow: 0 0 0 2px #eef2ff; }
          .dn-bubble.team { align-self: flex-end; border-top-right-radius: 4px; }
          .dn-bubble.progress-note { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
          .dn-bubble.done-note { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
          .dn-bubble.team .dn-msg { color: inherit; }
          .dn-bubble-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
          .dn-bubble-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11.5px; color: #94a3b8; margin-top: 4px; }
          .dn-bubble-meta .si-status-pill { padding: 2px 8px; font-size: 11px; }
          .dn-rp-f { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 4px 11px; font-size: 12px; font-weight: 700; color: #475569; cursor: pointer; }
          .dn-rp-f span { color: #94a3b8; margin-left: 3px; }
          .dn-rp-f.on { background: var(--ad-brand); border-color: var(--ad-brand); color: #fff; } .dn-rp-f.on span { color: #c7d2fe; }
          .dn-rp-who { flex: 1; min-width: 180px; display: flex; flex-direction: column; }
          .dn-rp-who b { font-size: 13.5px; color: #0f172a; } .dn-rp-who span { font-size: 12px; color: #64748b; }
          .dn-rp-time { font-size: 12px; color: #94a3b8; white-space: nowrap; }
          .dn-rp-acts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
          .si-table-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 14px; flex-wrap: wrap; }
          .modal-footer .si-table-footer { padding-top: 0; width: 100%; }
          .si-table-info { font-size: 13px; color: #64748b; }
          .si-pagination { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .si-page-btn, .si-page-nav-btn { min-width: 34px; height: 34px; border-radius: 9px; border: 1px solid #e2e8f0; background: #fff; font-size: 13px; font-weight: 600; color: #334155; padding: 0 10px; cursor: pointer; }
          .si-page-btn.active { background: var(--ad-brand); border-color: var(--ad-brand); color: #fff; }
          .si-page-nav-btn:disabled { opacity: .5; cursor: default; }
          .mq-grip { color: #94a3b8; display: flex; align-items: center; padding: 4px; }
          .mq-row-main { flex: 1; min-width: 0; }
          .mq-row-title { font-weight: 700; color: #0f172a; font-size: 14px; display: flex; align-items: center; gap: 8px; }
          .mq-row-text { font-size: 12.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0 6px; }
          .mq-row-meta { display: flex; flex-wrap: wrap; gap: 6px; }
          .mq-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; background: #f1f5f9; color: #334155; font-size: 11.5px; font-weight: 600; border: none; }
          .mq-chip-time { background: #eef2ff; color: var(--ad-brand-2); }
          .mq-chip-btn { cursor: pointer; } .mq-chip-btn:hover { background: #e0e7ff; color: var(--ad-brand-2); }
          .mq-chip-btn.has-new { background: #fee2e2; color: #b91c1c; }
          @media (max-width: 768px) { .mq-row { flex-wrap: wrap; } }
          .dn-style-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
          .dn-style-info { background: #2563eb; } .dn-style-important { background: #d97706; } .dn-style-urgent { background: #dc2626; }

          .mq-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; }
          @media (max-width: 768px) { .mq-form-grid { grid-template-columns: 1fr; } }
          .mq-span { grid-column: 1 / -1; }
          .mq-label { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px; display: block; }
          .mq-hint { font-size: 12px; color: #64748b; margin-top: 4px; }
          .mq-seg { display: inline-flex; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; flex-wrap: wrap; }
          .mq-seg button { border: none; background: #fff; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #475569; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
          .mq-seg button + button { border-left: 1px solid #e2e8f0; }
          .mq-seg button.on { background: var(--ad-brand); color: #fff; }
          .dn-aud { max-height: 260px; overflow: auto; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
          .dn-aud-course { padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
          .dn-aud-course:last-child { border-bottom: none; }
          .dn-aud label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer; padding: 3px 4px; border-radius: 6px; }
          .dn-aud label:hover { background: #eef2ff; }
          .dn-aud .c-name { font-weight: 700; }
          .dn-aud .b-list { padding-left: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
          .dn-preview { border: 1px dashed #c7d2fe; border-radius: 12px; padding: 12px; background: #f8fafc; }
          .dn-preview-label { font-size: 12px; font-weight: 700; color: var(--ad-brand-2); margin-bottom: 8px; }

          .dn-ed { border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #fff; }
          .dn-ed:focus-within { border-color: var(--ad-brand); box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb),.15); }
          .dn-ed-bar { display: flex; align-items: center; gap: 2px; padding: 6px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-wrap: wrap; }
          .dn-ed-btn { width: 32px; height: 30px; border: none; background: transparent; border-radius: 6px; color: #334155; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
          .dn-ed-btn:hover { background: #e0e7ff; color: var(--ad-brand-2); }
          .dn-ed-sep { width: 1px; height: 20px; background: #e2e8f0; margin: 0 4px; }
          .dn-ed-area { min-height: 140px; max-height: 320px; overflow: auto; padding: 10px 12px; font-size: 14px; line-height: 1.6; color: #0f172a; outline: none; }
          .dn-ed-area:empty::before { content: attr(data-placeholder); color: #94a3b8; }
          .dn-ed-area ul, .dn-ed-area ol { padding-left: 22px; margin: 4px 0; }
          .dn-ed-area a { color: var(--ad-brand); text-decoration: underline; }

          .dn-msg { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13.5px; color: #1e293b; }
          .dn-act { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
          .dn-act-progress:hover { background: #fffbeb; border-color: #fcd34d; color: #b45309; }
          .dn-act-done:hover { background: #f0fdf4; border-color: #86efac; color: #15803d; }
          .dn-act-reopen:hover { background: #eef2ff; border-color: #c7d2fe; color: var(--ad-brand-2); }
        `}</style>

        <div className="si-page-wrapper">
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box"><BellRing size={24} /></div>
              <div>
                <h3 className="si-header-title">
                  Dashboard Notices <span className="si-count-badge">{list.length} Total</span>
                  {newReplies > 0 && (
                    <button type="button" className="si-count-badge dn-new-badge" title="Open the notices with new replies"
                      onClick={openNewReplies}>
                      {newReplies} new {newReplies === 1 ? "reply" : "replies"}
                    </button>
                  )}
                </h3>
                <p className="si-header-subtitle">Notices on the student dashboard, and the replies students send back</p>
              </div>
            </div>
            {permCan("create") && (
              <button type="button" onClick={openAdd} className="si-btn-primary"><Plus size={16} /> <span>Add Notice</span></button>
            )}
          </div>

              <div className="si-stats-grid">
                {([
                  ["ALL", "Total Notices", list.length, "si-stat-purple", <BellRing size={22} key="i" />],
                  ["live", "Live Now", counts.live, "si-stat-green", <Radio size={22} key="i" />],
                  ["scheduled", "Scheduled", counts.scheduled, "si-stat-blue", <CalendarClock size={22} key="i" />],
                  ["expired", "Expired", counts.expired, "si-stat-red", <CalendarX2 size={22} key="i" />],
                ] as const).map(([key, label, value, color, icon]) => (
                  <div key={key} className={`si-stat-card ${whenFilter === key ? "active" : ""}`} onClick={() => setWhenFilter(key as any)}>
                    <div><div className="si-stat-label">{label}</div><div className="si-stat-value"><AnimatedNumber value={value} pending={loading} id="DashboardNotices-s1" /></div></div>
                    <div className={`si-stat-icon-wrap ${color}`}>{icon}</div>
                  </div>
                ))}
              </div>

              <div className="si-filter-bar">
                <ListSearch placeholder="Search notices..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="ms-auto d-flex align-items-center gap-2">
                  <button data-refresh type="button" className="reload-btn" title="Refresh" disabled={loading}
                    onClick={() => { setSearch(""); setWhenFilter("ALL"); load(); loadReplies(); }}>
                    <RotateCw size={15} />
                  </button>
                </div>
              </div>

              <div className="si-list-card">
                {loading ? (
                  <SkeletonList rows={5} />
                ) : shown.length === 0 ? (
                  <div className="si-empty-box">
                    <BellRing size={40} color="#cbd5e1" />
                    <div className="si-empty-title">{list.length ? "No notices match" : "No notices yet"}</div>
                    <div>{list.length ? "Try another filter or search." : "Add a notice and it appears on the student dashboard."}</div>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={pageItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {pageItems.map((item) => (
                        <Row key={item.id} item={item} now={serverNow} courseName={courseName} batchName={batchName}
                          onEdit={openEdit} onDelete={del} onToggle={toggle} onReplies={showRepliesOf}
                          busy={busyId === item.id} canReorder={canReorder} />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
                {!loading && <Pager page={curPage} total={shown.length} onPage={setPage} noun={shown.length === 1 ? "notice" : "notices"} />}
                <div className="saved-ago-row"><SavedAgo endpoint="api/notices-list" /></div>
              </div>
        </div>
      </div>

      {/* ---------------- add / edit notice ---------------- */}
      {modalOpen && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ background: "rgba(15,23,42,.45)" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) closeModal(); }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <form className="modal-content" onSubmit={save} style={{ borderRadius: 16 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{editing ? "Edit notice" : "Add notice"}</h5>
                <button type="button" className="btn-close" onClick={closeModal} disabled={saving} />
              </div>
              <div className="modal-body">
                <div className="mq-form-grid">
                  <div className="mq-span">
                    <label className="mq-label">Title</label>
                    <input className="form-control" maxLength={150} value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Batch timing change next week" />
                  </div>

                  <div>
                    <label className="mq-label">Style</label>
                    <div className="mq-seg">
                      {Object.entries(NOTICE_STYLES).map(([k, v]) => {
                        const Icon = v.icon;
                        return (
                          <button key={k} type="button" className={form.style === k ? "on" : ""} onClick={() => setForm({ ...form, style: k })}>
                            <Icon size={14} /> {v.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mq-label">Replies</label>
                    <div className="form-check form-switch mt-2">
                      <input className="form-check-input" type="checkbox" id="dn-allow-reply" checked={form.allow_reply}
                        onChange={(e) => setForm({ ...form, allow_reply: e.target.checked })} />
                      <label className="form-check-label" htmlFor="dn-allow-reply">Show the Reply button to students</label>
                    </div>
                  </div>

                  <div className="mq-span">
                    <label className="mq-label">Message</label>
                    <MiniEditor key={editing ? editing.id : "new"} initial={form.html} onChange={(html) => setForm((f) => ({ ...f, html }))} />
                  </div>

                  <div className="mq-span">
                    <label className="mq-label">Show to</label>
                    <div className="mq-seg mb-2">
                      <button type="button" className={form.audience === "all" ? "on" : ""} onClick={() => setForm({ ...form, audience: "all" })}>
                        <Users size={14} /> All students
                      </button>
                      <button type="button" className={form.audience === "select" ? "on" : ""} onClick={() => setForm({ ...form, audience: "select" })}>
                        Choose courses / batches
                      </button>
                    </div>
                    {form.audience === "select" && (
                      <>
                        <div className="dn-aud">
                          {courses.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>Loading courses…</div>}
                          {courses.map((c) => {
                            const cb = batches.filter((b) => b.c_id === c.req_id);
                            const whole = form.courses.includes(c.req_id);
                            return (
                              <div key={c.req_id} className="dn-aud-course">
                                <label>
                                  <input type="checkbox" checked={whole} onChange={() => toggleIn("courses", c.req_id)} />
                                  <span className="c-name">{decode(c.title)}</span>
                                  <span className="text-muted" style={{ fontSize: 12 }}>· every batch{c.status !== "1" ? " · course disabled" : ""}</span>
                                </label>
                                {!whole && cb.length > 0 && (
                                  <div className="b-list">
                                    {cb.map((b) => (
                                      <label key={b.b_id}>
                                        <input type="checkbox" checked={form.batches.includes(b.b_id)} onChange={() => toggleIn("batches", b.b_id)} />
                                        {decode(b.name)}{b.status !== "1" ? " (disabled)" : ""}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mq-hint">Tick a course for all of its students, or open it and tick single batches.</div>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="mq-label">Start showing (optional)</label>
                    <input type="datetime-local" className="form-control" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                    <div className="mq-hint">Empty = from now.</div>
                  </div>
                  <div>
                    <label className="mq-label">Expires (optional)</label>
                    <input type="datetime-local" className="form-control" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                    <div className="mq-hint">Empty = until you hide or delete it.</div>
                  </div>

                  <div className="mq-span">
                    <div className="dn-preview">
                      <div className="dn-preview-label">Preview — how students see it (it pulses until they open it)</div>
                      <NoticeCard notice={preview} preview />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={closeModal} disabled={saving}>Cancel</button>
                {permCan(editing ? "edit" : "create") && (
                  <button type="submit" className="si-btn-primary" disabled={saving}>{saving ? <ButtonLoader label="Saving…" /> : editing ? "Save changes" : "Add notice"}</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- one notice's replies ---------------- */}
      {repliesFor && repliesNotice && (
        <RepliesModal key={repliesNotice.id} notice={repliesNotice} replies={repliesOf.get(repliesNotice.id) || []}
          loading={rLoading} initialFilter={repliesFor.filter} onClose={closeReplies} onStatus={openStatus} onDelete={delReply}
          onReload={() => { loadReplies(); load(); }} onStudent={setStudentFor} studentOpen={!!studentFor} />
      )}

      {/* ---------------- a student's details, over the replies ---------------- */}
      {studentFor && <StudentModal memId={studentFor} post={post} onClose={closeStudent} />}

      {/* ---------------- reply status + optional note ---------------- */}
      {statusModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ background: "rgba(15,23,42,.45)" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !rBusy) setStatusModal(null); }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: 16 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{statusModal.status === "3" ? "Mark as completed" : "Mark as in progress"}</h5>
                <button type="button" className="btn-close" onClick={() => setStatusModal(null)} disabled={rBusy} />
              </div>
              <div className="modal-body">
                <div className="mb-3 p-2 rounded" style={{ background: "#f8fafc", fontSize: 13 }}>
                  <b>{statusModal.reply.name}</b> on <i>{statusModal.reply.notice_title}</i>
                  <div className="dn-msg mt-1">{statusModal.reply.message}</div>
                </div>
                <label className="mq-label">Note for the student (optional)</label>
                <textarea className="form-control" rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder={statusModal.status === "3" ? "e.g. Done — your batch is now Saturday 10 AM." : "e.g. We're checking this with your trainer."} />
                <div className="mq-hint">The student sees this under their reply{statusModal.status === "2" ? ", and the status blinks until it is completed" : ""}.</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setStatusModal(null)} disabled={rBusy}>Cancel</button>
                <button type="button" className="si-btn-primary" onClick={applyStatus} disabled={rBusy}>
                  {rBusy ? <ButtonLoader label="Saving…" /> : statusModal.status === "3" ? "Mark completed" : "Mark in progress"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
