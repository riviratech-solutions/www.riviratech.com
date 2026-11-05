import { useEffect, useState } from "react";
import axios from "axios";
import { SERVER_URL } from "./Includes";
import { listFetch } from "../utils/listCache";
import { TICKET_TYPES as TYPES, TICKET_CATEGORIES as CATEGORIES } from "../utils/ticketTopics";
import { ButtonLoader } from "./loading";

/* Student panel → "Raise a Ticket" popup (sidebar item and the My Tickets
   page button). Sends the ticket to api/raise-ticket and lists the student's
   own tickets (api/my-tickets) with their status. Admins answer them at
   /panel/raised-tickets; students see them all at /panel/my-tickets. Values match TICKET_TYPES /
   TICKET_CATEGORIES in api/student/my-tickets/my-tickets.js (the topics: utils/ticketTopics.ts). */

const PRIORITIES: [string, string][] = [["1", "Low"], ["2", "Medium"], ["3", "High"]];

const STATUS: Record<string, [string, string]> = {
  "1": ["Open", "danger"],
  "2": ["In Progress", "primary"],
  "3": ["Resolved", "success"],
};

const label = (list: [string, string][], v: any) => list.find(([k]) => k === String(v))?.[1] || String(v || "—");

const getSecurity = async () =>
  (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

export default function RaiseTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [tab, setTab] = useState<"new" | "mine">("new");
  const empty = { type: "", category: "", priority: "2", msg: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const loadMine = async () => {
    setLoadingList(true);
    try {
      // the same saved list as the My Tickets page (a new ticket clears it)
      const res = await listFetch("api/my-tickets", {});
      if (res.data.success) setTickets(res.data.data || []);
    } catch {
      /* the list just stays empty */
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadMine(); }, []);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.type) return setError("Please choose what your concern is about.");
    if (!form.category) return setError("Please choose a category.");
    if (form.msg.trim().length < 10) return setError("Please describe your concern (at least 10 characters).");

    setBusy(true);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/raise-ticket",
        { ...form, msg: form.msg.trim(), key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true }
      );
      if (res.data.success) {
        setSuccess(res.data.message || "Ticket submitted.");
        setForm(empty);
        await loadMine();
        // after our own request: the API keeps only the latest security token,
        // so the page's reload must not run at the same time as ours
        onCreated?.();
      } else {
        setError(res.data.message || "We couldn't submit your ticket.");
      }
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (ts: any) =>
    Number(ts)
      ? new Date(Number(ts) * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";
  const openCount = tickets.filter((t) => t.status !== "3").length;

  return (
    <div className="modal fade show d-block rtk-modal" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => !busy && onClose()}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rtk-title">
        <div className="modal-content">

          <div className="modal-header">
            <h5 className="modal-title" id="rtk-title">Raise a Ticket</h5>
            <button type="button" className="btn-close" aria-label="Close" disabled={busy} onClick={onClose}></button>
          </div>

          <div className="rtk-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "new"} className={tab === "new" ? "on" : ""} onClick={() => setTab("new")}>
              New ticket
            </button>
            <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>
              My tickets{tickets.length > 0 && <span className="rtk-count">{tickets.length}</span>}
            </button>
          </div>

          {tab === "new" ? (
            <form onSubmit={submit} noValidate>
              <div className="modal-body">
                <p className="text-muted mb-3" style={{ fontSize: ".9rem" }}>
                  Tell us what's wrong — our support team will look into it and update the ticket status.
                  {openCount > 0 && <> You have <b>{openCount}</b> open ticket{openCount > 1 ? "s" : ""}.</>}
                </p>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="rtk-type">Concern about *</label>
                    <select id="rtk-type" className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      <option value="">Select</option>
                      {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="rtk-cat">Category *</label>
                    <select id="rtk-cat" className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      <option value="">Select</option>
                      {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>

                  <div className="col-12">
                    <span className="form-label d-block">Priority *</span>
                    <div className="rtk-prio" role="radiogroup" aria-label="Priority">
                      {PRIORITIES.map(([v, l]) => (
                        <label key={v} className={"rtk-prio-opt p" + v + (form.priority === v ? " on" : "")}>
                          <input type="radio" name="rtk-priority" value={v} checked={form.priority === v} onChange={() => setForm({ ...form, priority: v })} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="rtk-msg">Describe your concern *</label>
                    <textarea
                      id="rtk-msg"
                      className="form-control"
                      rows={5}
                      maxLength={2000}
                      value={form.msg}
                      onChange={(e) => setForm({ ...form, msg: e.target.value })}
                      placeholder="What happened, which class / assignment it is about, and anything you've already tried."
                    />
                    <div className="text-end text-muted" style={{ fontSize: ".75rem" }}>{form.msg.length} / 2000</div>
                  </div>
                </div>

                {error && <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">{error}</div>}
                {success && <div className="alert alert-success py-2 mt-3 mb-0" role="status">{success}</div>}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? <ButtonLoader label="Submitting…" /> : "Submit Ticket"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="modal-body">
                {loadingList ? (
                  <p className="text-muted text-center py-4 mb-0">Loading your tickets…</p>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted mb-3">You haven't raised any tickets yet.</p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab("new")}>Raise a ticket</button>
                  </div>
                ) : (
                  <ul className="rtk-list">
                    {tickets.map((t) => {
                      const [st, tone] = STATUS[String(t.status)] || ["Unknown", "secondary"];
                      return (
                        <li key={t.t_id}>
                          <div className="rtk-row">
                            {t.t_id && (
                              <span className="badge bg-light text-primary border me-2 font-monospace" style={{ fontSize: "11px" }}>
                                {t.t_id}
                              </span>
                            )}
                            <strong>{label(TYPES, t.type)}</strong>
                            <span className="text-muted"> · {label(CATEGORIES, t.category)} · {label(PRIORITIES, t.priority)} priority</span>
                            <span className={`badge bg-${tone} ms-auto`}>{st}</span>
                          </div>
                          <p className="rtk-msg">{t.msg}</p>
                          <small className="text-muted">Raised {fmt(t.datetime)}</small>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={loadMine} disabled={loadingList}>Refresh</button>
                <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
