import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import RaiseTicketModal from "../../../components/RaiseTicketModal";
import {
  TICKET_TYPES as TYPES,
  TICKET_CATEGORIES as CATEGORIES,
} from "../../../utils/ticketTopics";
import {
  Ticket,
  Plus,
  RotateCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  X,
  MessageSquare,
  Tag,
  Calendar,
  Layers,
} from "lucide-react";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

const PRIORITIES: Record<string, { label: string; color: string; bg: string }> =
  {
    "1": { label: "Low", color: "#16a34a", bg: "#f0fdf4" },
    "2": { label: "Medium", color: "#d97706", bg: "#fffbeb" },
    "3": { label: "High", color: "#dc2626", bg: "#fef2f2" },
  };

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; bg: string; color: string }
> = {
  "1": { label: "Open", dot: "#f59e0b", bg: "#fef3c7", color: "#b45309" },
  "2": {
    label: "In Progress",
    dot: "#3b82f6",
    bg: "#dbeafe",
    color: "#1d4ed8",
  },
  "3": { label: "Resolved", dot: "#10b981", bg: "#d1fae5", color: "#047857" },
};

const FILTERS: [string, string][] = [
  ["all", "All Tickets"],
  ["1", "Open"],
  ["2", "In Progress"],
  ["3", "Resolved"],
];

const label = (list: [string, string][], v: any) =>
  list.find(([k]) => k === String(v))?.[1] || String(v || "—");

export default function MyTickets() {
  const navigate = useNavigate();

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<any | null>(null);

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadMine = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/my-tickets", {});
      if (res.data.success) {
        setTickets(res.data.data || []);
      } else {
        toast.error(res.data.message || "Couldn't load your tickets");
      }
    } catch {
      toast.error("Couldn't load your tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && res.data.id === "1") loadMine();
        else navigate("/logout");
      })
      .catch(() => navigate("/logout"));
  }, []);

  const fmt = (ts: any) =>
    Number(ts)
      ? new Date(Number(ts) * 1000).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

  const count = (st: string) =>
    st === "all"
      ? tickets.length
      : tickets.filter((t) => String(t.status) === st).length;

  const filteredTickets = tickets.filter((t) => {
    const matchesFilter = filter === "all" ? true : String(t.status) === filter;
    if (!matchesFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const typeStr = label(TYPES, t.type).toLowerCase();
    const catStr = label(CATEGORIES, t.category).toLowerCase();
    const msgStr = String(t.msg || "").toLowerCase();
    const idStr = String(t.t_id || "").toLowerCase();
    return (
      typeStr.includes(q) ||
      catStr.includes(q) ||
      msgStr.includes(q) ||
      idStr.includes(q)
    );
  });

  const totalOpen = count("1");
  const totalInProgress = count("2");
  const totalResolved = count("3");

  return (
    <>
      <Head
        pageTitle={seo.title || "My Tickets - Student Portal"}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />

      <div className="content">
        <div className="container-fluid p-4 si-wrapper">
          {/* Header Bar */}
          <div className="si-header-card">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Ticket size={24} />
              </div>
              <div>
                <h3 className="si-header-title">My Support Tickets</h3>
                <p className="si-header-subtitle">
                  Need help with a class, assignment, certificate or payment?
                  Raise a ticket and follow its status.
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <span className="si-total-count-text">
                Total Tickets: <b>{tickets.length}</b>
              </span>
              <button
                data-refresh
                type="button"
                className="si-btn-export-excel"
                onClick={loadMine}
                disabled={loading}
                title="Refresh Tickets"
              >
                <RotateCw size={14} className={loading ? "si-spin" : ""} />{" "}
                Refresh
              </button>
              <button
                type="button"
                className="si-btn-export-csv"
                onClick={() => setRaiseOpen(true)}
              >
                <Plus size={16} /> Raise a Ticket
              </button>
            </div>
          </div>

          {/* Stats KPI Cards */}
          <div className="si-stats-grid">
            {/* Total Tickets */}
            <div
              className={`si-stat-card card-total ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
              title="Show all tickets"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <Layers size={22} />
              </div>
              <div>
                <p className="si-stat-label">Total Tickets</p>
                <h3 className="si-stat-value"><AnimatedNumber value={tickets.length} pending={loading} id="MyTickets-s1" /></h3>
              </div>
            </div>

            {/* Open */}
            <div
              className={`si-stat-card card-rejected ${filter === "1" ? "active" : ""}`}
              onClick={() => setFilter((prev) => (prev === "1" ? "all" : "1"))}
              title={
                filter === "1" ? "Click to show all" : "Filter: Open tickets"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#b45309" }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Open Issues</p>
                <h3 className="si-stat-value"><AnimatedNumber value={totalOpen} pending={loading} id="MyTickets-s2" /></h3>
              </div>
            </div>

            {/* In Progress */}
            <div
              className={`si-stat-card card-recent ${filter === "2" ? "active" : ""}`}
              onClick={() => setFilter((prev) => (prev === "2" ? "all" : "2"))}
              title={
                filter === "2"
                  ? "Click to show all"
                  : "Filter: In Progress tickets"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "#7c3aed" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">In Progress</p>
                <h3 className="si-stat-value"><AnimatedNumber value={totalInProgress} pending={loading} id="MyTickets-s3" /></h3>
              </div>
            </div>

            {/* Resolved */}
            <div
              className={`si-stat-card card-approved ${filter === "3" ? "active" : ""}`}
              onClick={() => setFilter((prev) => (prev === "3" ? "all" : "3"))}
              title={
                filter === "3"
                  ? "Click to show all"
                  : "Filter: Resolved tickets"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="si-stat-label">Resolved</p>
                <h3 className="si-stat-value"><AnimatedNumber value={totalResolved} pending={loading} id="MyTickets-s4" /></h3>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <div className="si-filter-left">
              <div className="si-tab-pills">
                {FILTERS.map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={`si-tab-pill ${filter === v ? "active" : ""}`}
                    onClick={() => setFilter(v)}
                  >
                    {l}
                    <span className="si-tab-pill-badge">{count(v)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="si-filter-right">
              <div className="si-search-box">
                <Search size={15} className="si-search-icon" />
                <input
                  type="text"
                  placeholder="Search by topic, message, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="si-search-input"
                />
                {search && (
                  <button
                    type="button"
                    className="si-search-clear"
                    onClick={() => setSearch("")}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="si-table-card">
            {loading ? (
              <SkeletonTable cols={7} />
            ) : filteredTickets.length === 0 ? (
              <div className="si-empty-state">
                <div className="si-empty-icon">
                  <Ticket size={40} />
                </div>
                <h4 className="si-empty-title">
                  {tickets.length === 0
                    ? "No Support Tickets Yet"
                    : "No Matching Tickets Found"}
                </h4>
                <p className="si-empty-desc">
                  {tickets.length === 0
                    ? "Whenever you encounter a technical issue, have a course query, or need assistance, raise a ticket here."
                    : "No tickets match your filter or search query. Try clearing your filters."}
                </p>
                {tickets.length === 0 ? (
                  <button
                    type="button"
                    className="si-btn-export-csv mt-2"
                    onClick={() => setRaiseOpen(true)}
                  >
                    <Plus size={16} /> Raise Your First Ticket
                  </button>
                ) : (
                  <button
                    type="button"
                    className="si-btn-export-excel mt-2"
                    onClick={() => {
                      setFilter("all");
                      setSearch("");
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="si-table">
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>Ticket ID</th>
                      <th>Topic & Category</th>
                      <th style={{ width: "110px" }}>Priority</th>
                      <th>Message</th>
                      <th style={{ width: "150px" }}>Raised Date</th>
                      <th style={{ width: "130px" }}>Status</th>
                      <th style={{ width: "80px", textAlign: "center" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((t) => {
                      const st = STATUS_CONFIG[String(t.status)] || {
                        label: "Unknown",
                        dot: "#94a3b8",
                        bg: "#f1f5f9",
                        color: "#475569",
                      };
                      const pr = PRIORITIES[String(t.priority)] || {
                        label: "Normal",
                        color: "#475569",
                        bg: "#f1f5f9",
                      };

                      return (
                        <tr key={t.t_id} className="si-table-row">
                          {/* Ticket ID */}
                          <td>
                            <span className="si-id-badge">
                              {t.t_id?.startsWith("TID-")
                                ? t.t_id
                                : `#${t.t_id}`}
                            </span>
                          </td>

                          {/* Topic & Category */}
                          <td>
                            <div className="si-topic-cell">
                              <span className="si-topic-title">
                                {label(TYPES, t.type)}
                              </span>
                              <span className="si-topic-cat">
                                {label(CATEGORIES, t.category)}
                              </span>
                            </div>
                          </td>

                          {/* Priority */}
                          <td>
                            <span
                              className="si-priority-badge"
                              style={{ color: pr.color, background: pr.bg }}
                            >
                              {pr.label}
                            </span>
                          </td>

                          {/* Message */}
                          <td>
                            <div className="si-msg-cell" title={t.msg}>
                              {t.msg}
                            </div>
                          </td>

                          {/* Date */}
                          <td>
                            <span className="si-date-cell">
                              {fmt(t.datetime)}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            <span
                              className="si-status-pill"
                              style={{ background: st.bg, color: st.color }}
                            >
                              <span
                                className="si-status-dot"
                                style={{ background: st.dot }}
                              />
                              {st.label}
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="si-action-btn view"
                              title="View Ticket Details"
                              onClick={() => setViewTicket(t)}
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/my-tickets" />
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Details View Modal */}
      {viewTicket && (
        <div className="si-modal-overlay" onClick={() => setViewTicket(null)}>
          <div
            className="si-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="si-modal-header">
              <div className="d-flex align-items-center gap-2">
                <div className="si-modal-icon-badge">
                  <Ticket size={20} />
                </div>
                <div>
                  <h4 className="si-modal-title">
                    Ticket Details{" "}
                    {viewTicket.t_id?.startsWith("TID-")
                      ? `(${viewTicket.t_id})`
                      : `#${viewTicket.t_id}`}
                  </h4>
                  <p className="si-modal-sub">
                    Raised on {fmt(viewTicket.datetime)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="si-modal-close"
                onClick={() => setViewTicket(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="si-modal-body">
              <div className="si-ticket-meta-grid">
                <div className="si-meta-box">
                  <span className="si-meta-label">
                    <Tag size={13} /> Topic
                  </span>
                  <span className="si-meta-val">
                    {label(TYPES, viewTicket.type)}
                  </span>
                </div>
                <div className="si-meta-box">
                  <span className="si-meta-label">
                    <Layers size={13} /> Category
                  </span>
                  <span className="si-meta-val">
                    {label(CATEGORIES, viewTicket.category)}
                  </span>
                </div>
                <div className="si-meta-box">
                  <span className="si-meta-label">
                    <AlertCircle size={13} /> Priority
                  </span>
                  <span className="si-meta-val">
                    {PRIORITIES[String(viewTicket.priority)]?.label || "Normal"}
                  </span>
                </div>
                <div className="si-meta-box">
                  <span className="si-meta-label">
                    <CheckCircle2 size={13} /> Status
                  </span>
                  <span className="si-meta-val">
                    {STATUS_CONFIG[String(viewTicket.status)]?.label ||
                      "Unknown"}
                  </span>
                </div>
              </div>

              <div className="si-ticket-message-block">
                <label className="si-field-label">
                  <MessageSquare size={14} /> Description / Message
                </label>
                <div className="si-ticket-fullmsg">{viewTicket.msg}</div>
              </div>

              <div className="si-ticket-timeline-note">
                <Calendar size={15} className="text-primary" />
                <span>
                  Our support team reviews tickets actively. You can track
                  progress or submit an update anytime.
                </span>
              </div>
            </div>

            <div className="si-modal-footer">
              <button
                type="button"
                className="si-btn-export-excel"
                onClick={() => setViewTicket(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raise Ticket Modal */}
      {raiseOpen && (
        <RaiseTicketModal
          onClose={() => setRaiseOpen(false)}
          onCreated={() => {
            setFilter("all");
            loadMine();
          }}
        />
      )}

      {/* Embedded Modern Styling matching StudentsInquiries.tsx standard */}
      <style>{`
        .si-wrapper {
          background-color: #f8fafc;
          min-height: 100vh;
        }
        .si-header-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
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
        }
        .si-total-count-text b {
          font-weight: 700;
          color: #0f172a;
        }
        .si-btn-export-excel {
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
        .si-btn-export-excel:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .si-btn-export-csv {
          background: #582fea;
          border: 1.5px solid #582fea;
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 18px;
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
        .si-spin {
          animation: siSpin 1s linear infinite;
        }
        @keyframes siSpin {
          100% { transform: rotate(360deg); }
        }

        /* Stats Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 1024px) {
          .si-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .si-stats-grid { grid-template-columns: 1fr; }
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
        .si-stat-card.card-total { background: #f0f8ff; }
        .si-stat-card.card-total.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-card.card-approved { background: #f0fdf4; }
        .si-stat-card.card-approved.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-rejected { background: #fffbeb; }
        .si-stat-card.card-rejected.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.card-recent { background: #faf5ff; }
        .si-stat-card.card-recent.active {
          border-color: #7c3aed !important;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25) !important;
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
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
          gap: 12px;
        }
        .si-tab-pills {
          display: flex;
          gap: 6px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          flex-wrap: wrap;
        }
        .si-tab-pill {
          background: transparent;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .si-tab-pill:hover {
          color: #0f172a;
        }
        .si-tab-pill.active {
          background: #ffffff;
          color: #582fea;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .si-tab-pill-badge {
          background: #e2e8f0;
          color: #475569;
          border-radius: 12px;
          padding: 1px 7px;
          font-size: 11px;
          font-weight: 700;
        }
        .si-tab-pill.active .si-tab-pill-badge {
          background: #ede9fe;
          color: #582fea;
        }
        .si-search-box {
          position: relative;
          min-width: 260px;
        }
        .si-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }
        .si-search-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 32px 7px 34px;
          font-size: 13.5px;
          outline: none;
          transition: all 0.15s ease;
        }
        .si-search-input:focus {
          border-color: #582fea;
          box-shadow: 0 0 0 3px rgba(88, 47, 234, 0.1);
        }
        .si-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 16px;
          cursor: pointer;
          line-height: 1;
        }

        /* Table Card */
        .si-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          overflow: hidden;
        }
        .si-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .si-table th {
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 13px 18px;
          border-bottom: 1px solid #edf2f7;
        }
        .si-table td {
          padding: 14px 18px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13.5px;
          color: #334155;
          vertical-align: middle;
        }
        .si-table-row:hover td {
          background: #fafbff;
        }
        .si-id-badge {
          font-family: monospace;
          font-weight: 700;
          color: #582fea;
          background: #ede9fe;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 12px;
        }
        .si-topic-cell {
          display: flex;
          flex-direction: column;
        }
        .si-topic-title {
          font-weight: 600;
          color: #0f172a;
        }
        .si-topic-cat {
          font-size: 12px;
          color: #64748b;
        }
        .si-priority-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 700;
        }
        .si-msg-cell {
          max-width: 320px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #475569;
        }
        .si-date-cell {
          font-size: 12.5px;
          color: #64748b;
          white-space: nowrap;
        }
        .si-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .si-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .si-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #582fea;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-action-btn:hover {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #4318ff;
        }

        /* Empty State */
        .si-empty-state {
          padding: 60px 20px;
          text-align: center;
        }
        .si-empty-icon {
          width: 68px;
          height: 68px;
          border-radius: 20px;
          background: #f1f5f9;
          color: #94a3b8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .si-empty-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .si-empty-desc {
          font-size: 13.5px;
          color: #64748b;
          max-width: 420px;
          margin: 0 auto 16px;
        }

        /* Modal styling */
        .si-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .si-modal-content {
          background: #ffffff;
          border-radius: 20px;
          width: 100%;
          max-width: 600px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: siPop 0.18s ease-out;
        }
        @keyframes siPop {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .si-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .si-modal-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #eef2ff;
          color: #582fea;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .si-modal-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .si-modal-sub {
          font-size: 12.5px;
          color: #64748b;
          margin: 2px 0 0;
        }
        .si-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .si-modal-close:hover {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #ef4444;
        }
        .si-modal-body {
          padding: 24px;
        }
        .si-ticket-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .si-meta-box {
          background: #f8fafc;
          border-radius: 12px;
          padding: 10px 14px;
          border: 1px solid #edf2f7;
        }
        .si-meta-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 3px;
        }
        .si-meta-val {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
        }
        .si-ticket-message-block {
          margin-bottom: 16px;
        }
        .si-field-label {
          font-size: 12.5px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-ticket-fullmsg {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 14px;
          line-height: 1.6;
          color: #1e293b;
          white-space: pre-wrap;
          max-height: 220px;
          overflow-y: auto;
        }
        .si-ticket-timeline-note {
          background: #f0f7ff;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 12.5px;
          color: #1e40af;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .si-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: flex-end;
          background: #fafbfc;
        }
      `}</style>
    </>
  );
}
