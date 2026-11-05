import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import DateFilter, {
  dayStartEpoch,
  dayEndEpoch,
} from "../../../components/DateFilter";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  Users,
  MessageSquare,
  Clock,
  CheckCircle,
  Plus,
  Search,
  RotateCw,
  ArrowUpDown,
  Eye,
  Trash2,
  Mail,
  Phone,
  Send,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

interface Trainer {
  mem_id: string;
  name: string;
  email: string;
  number?: string;
}

interface TrainerContactItem {
  id: number;
  mem_id: string;
  to_id: string;
  name: string;
  email: string;
  number: string;
  msg: string;
  type: string;
  datetime: string;
  deltime?: string;
  status: string; // "1" = Pending, "2" = Viewed
  tname?: string;
  temail?: string;
  tphone?: string;
}

export default function StudentTrainerContacts() {
  const navigate = useNavigate();

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<TrainerContactItem[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainersLoading, setTrainersLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    viewed: 0,
  });

  // Query filters & pagination
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [stat, setStat] = useState(""); // "" = All, "1" = Pending, "2" = Viewed

  // Modals
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [viewItem, setViewItem] = useState<TrainerContactItem | null>(null);

  // New query form state
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [queryMsg, setQueryMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatDateTime = (ts: any) => {
    if (!ts) return "—";
    const num = Number(ts);
    const date = new Date(num > 1e11 ? num : num * 1000);
    if (isNaN(date.getTime())) return String(ts);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return "TR";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarColors = [
    { bg: "#ede9fe", text: "#7c3aed" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#fef3c7", text: "#d97706" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#fce7f3", text: "#db2777" },
  ];

  const getColor = (str?: string) => {
    if (!str) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const loadTrainersList = async () => {
    setTrainersLoading(true);
    try {
      const res = await listFetch("api/student/trainers-list", {});
      if (res.data.success) {
        setTrainers(res.data.trainers || []);
      }
    } catch {
      // ignore
    } finally {
      setTrainersLoading(false);
    }
  };

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    df = "",
    dt = "",
    st = "",
  ) => {
    setLoading(true);
    setList([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setDfrom(df);
    setDto(dt);
    setStat(st);

    try {
      const res = await listFetch("api/student/trainer-contacts", {
          q: targetSearch,
          s: targetSort,
          n: targetPage,
          df: dayStartEpoch(df),
          dt: dayEndEpoch(dt),
          st: st,
        });

      if (res.data.success) {
        setList(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
        setLastPage(res.data.lastPage || 1);
      } else {
        setLastPage(0);
        if (res.data.message && res.data.message !== "No data found") {
          toast.error(res.data.message);
        }
      }
    } catch {
      toast.error("❌ Failed to load trainer queries");
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainer) {
      toast.warning("Please select a trainer");
      return;
    }
    if (!queryMsg.trim()) {
      toast.warning("Please enter your question or query");
      return;
    }

    setSubmitting(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/student/contact-trainer",
        {
          to_id: selectedTrainer,
          msg: queryMsg.trim(),
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message || "Query sent to trainer!");
        setContactModalOpen(false);
        setSelectedTrainer("");
        setQueryMsg("");
        loadDetails(1, search, sort, dfrom, dto, stat);
      } else {
        toast.error(res.data.message || "Failed to send query");
      }
    } catch {
      toast.error("❌ Something went wrong sending your query");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuery = async (id: number) => {
    if (
      !window.confirm("Are you sure you want to delete this pending query?")
    ) {
      return;
    }

    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/student/delete-trainer-contact",
        {
          id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success("Query deleted");
        loadDetails(page, search, sort, dfrom, dto, stat);
      } else {
        toast.error(res.data.message || "Failed to delete query");
      }
    } catch {
      toast.error("❌ Error deleting query");
    }
  };

  const loadLists = async () => {
    await loadDetails();
    await loadTrainersList();
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && res.data.id === "1") {
          loadLists();
        } else {
          navigate("/logout");
        }
      })
      .catch(() => navigate("/logout"));
  }, []);

  return (
    <>
      <Head
        pageTitle={seo.title || "Trainer Contacts - Student Portal"}
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

        /* Header Card */
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
        .si-btn-primary {
          background: #582fea;
          border: 1.5px solid #582fea;
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
          background: #4824cf;
          border-color: #4824cf;
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
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          cursor: pointer;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
        }
        .si-stat-card.active {
          border-color: #582fea;
          background: #faf8ff;
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
          margin-bottom: 3px;
        }
        .si-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.1;
          margin: 0;
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
          border-color: #582fea;
        }
        .si-search-box input {
          border: none;
          outline: none;
          font-size: 13px;
          color: #1e293b;
          width: 100%;
          background: transparent;
        }
        .si-status-tabs {
          display: inline-flex;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 10px;
          gap: 2px;
        }
        .si-status-tab-btn {
          border: none;
          background: transparent;
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-status-tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        .si-sort-select {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 6px 12px;
          font-size: 13px;
          color: #334155;
          background: #ffffff;
          outline: none;
          font-weight: 500;
        }
        .si-reload-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #582fea;
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
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

        /* User Profile Pill */
        .si-user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .si-user-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .si-user-meta {
          display: flex;
          flex-direction: column;
        }
        .si-user-name {
          font-weight: 600;
          color: #0f172a;
          font-size: 13.5px;
        }
        .si-user-sub {
          font-size: 12px;
          color: #64748b;
        }

        /* Status Pills */
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
        .si-status-pending {
          background: #fef3c7;
          color: #b45309;
        }
        .si-status-viewed {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        /* Message preview */
        .si-msg-preview {
          max-width: 320px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #475569;
          font-size: 13px;
          cursor: pointer;
        }
        .si-msg-preview:hover {
          color: #582fea;
        }

        /* Action Buttons */
        .si-btn-action {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-action:hover {
          border-color: #582fea;
          color: #582fea;
          background: #faf8ff;
        }
        .si-btn-action.delete:hover {
          border-color: #ef4444;
          color: #ef4444;
          background: #fef2f2;
        }

        /* Table Footer */
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
        .si-page-btn {
          min-width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0 8px;
        }
        .si-page-btn.active {
          background: #582fea;
          border-color: #582fea;
          color: #ffffff;
        }
        .si-page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper">
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Users size={24} />
              </div>
              <div>
                <div className="si-header-title-row">
                  <h3 className="si-header-title">Trainer Contacts</h3>
                  <span
                    style={{
                      background: "#ede9fe",
                      color: "#582fea",
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Total <b>{stats.total}</b> Queries
                  </span>
                </div>
                <p className="si-header-subtitle">
                  Send direct questions and queries to course trainers and view
                  their review status.
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <button
                type="button"
                className="si-btn-primary"
                onClick={() => setContactModalOpen(true)}
              >
                <Plus size={16} /> Contact Trainer
              </button>
            </div>
          </div>

          {/* Stats KPI Grid */}
          <div className="si-stats-grid">
            {/* Total */}
            <div
              className={`si-stat-card ${stat === "" ? "active" : ""}`}
              onClick={() => loadDetails(1, search, sort, dfrom, dto, "")}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "#7c3aed" }}
              >
                <MessageSquare size={22} />
              </div>
              <div>
                <span className="si-stat-label">Total Queries</span>
                <h4 className="si-stat-value"><AnimatedNumber value={stats.total} pending={loading} id="TrainerContacts-s1" /></h4>
              </div>
            </div>

            {/* Pending */}
            <div
              className={`si-stat-card ${stat === "1" ? "active" : ""}`}
              onClick={() => loadDetails(1, search, sort, dfrom, dto, "1")}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <span className="si-stat-label">Pending Review</span>
                <h4 className="si-stat-value"><AnimatedNumber value={stats.pending} pending={loading} id="TrainerContacts-s2" /></h4>
              </div>
            </div>

            {/* Viewed */}
            <div
              className={`si-stat-card ${stat === "2" ? "active" : ""}`}
              onClick={() => loadDetails(1, search, sort, dfrom, dto, "2")}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <span className="si-stat-label">Viewed / Addressed</span>
                <h4 className="si-stat-value"><AnimatedNumber value={stats.viewed} pending={loading} id="TrainerContacts-s3" /></h4>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="si-filter-bar">
            {/* Search */}
            <div className="si-search-box" style={{ maxWidth: 300 }}>
              <Search size={16} style={{ color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search trainer or query message…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    loadDetails(1, search, sort, dfrom, dto, stat);
                  }
                }}
              />
            </div>

            {/* DateFilter */}
            <DateFilter
              from={dfrom}
              to={dto}
              onApply={(df: string, dt: string) => {
                setDfrom(df);
                setDto(dt);
                loadDetails(1, search, sort, df, dt, stat);
              }}
            />

            {/* Status tabs */}
            <div className="si-status-tabs">
              <button
                type="button"
                className={`si-status-tab-btn ${stat === "" ? "active" : ""}`}
                onClick={() => loadDetails(1, search, sort, dfrom, dto, "")}
              >
                All
              </button>
              <button
                type="button"
                className={`si-status-tab-btn ${stat === "1" ? "active" : ""}`}
                onClick={() => loadDetails(1, search, sort, dfrom, dto, "1")}
              >
                Pending
              </button>
              <button
                type="button"
                className={`si-status-tab-btn ${stat === "2" ? "active" : ""}`}
                onClick={() => loadDetails(1, search, sort, dfrom, dto, "2")}
              >
                Viewed
              </button>
            </div>

            {/* Sort */}
            <div className="d-flex align-items-center gap-1 ms-auto">
              <ArrowUpDown size={15} style={{ color: "#94a3b8" }} />
              <select
                className="si-sort-select"
                value={sort}
                onChange={(e) => {
                  const val = e.target.value;
                  setSort(val);
                  loadDetails(1, search, val, dfrom, dto, stat);
                }}
              >
                <option value="New">Newest First</option>
                <option value="Old">Oldest First</option>
              </select>

              <button data-refresh
                type="button"
                className="si-reload-btn"
                title="Refresh Queries"
                onClick={() =>
                  loadDetails(page, search, sort, dfrom, dto, stat)
                }
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
                    <th className="si-th" style={{ minWidth: 220 }}>
                      Trainer
                    </th>
                    <th className="si-th" style={{ minWidth: 260 }}>
                      Query Message
                    </th>
                    <th className="si-th" style={{ width: 180 }}>
                      Submitted On
                    </th>
                    <th className="si-th" style={{ width: 140 }}>
                      Status
                    </th>
                    <th className="si-th text-end" style={{ width: 110 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="si-tbody">
                  {loading ? (
                    <SkeletonRows />
                  ) : list.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-5 text-muted">
                        <div style={{ maxWidth: 360, margin: "0 auto" }}>
                          <GraduationCap
                            size={40}
                            style={{ color: "#cbd5e1", marginBottom: 12 }}
                          />
                          <h6 style={{ fontWeight: 600, color: "#1e293b" }}>
                            No Queries Found
                          </h6>
                          <p style={{ fontSize: 13, color: "#64748b" }}>
                            {search || stat || dfrom || dto
                              ? "No trainer queries match your filters."
                              : "You haven't sent any queries to trainers yet. Click 'Contact Trainer' above to send one."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    list.map((item, index) => {
                      const color = getColor(item.tname || item.to_id);
                      const isPending = item.status === "1";
                      return (
                        <tr key={item.id} className="si-tr">
                          <td className="si-td text-muted fw-semibold">
                            {(page - 1) * 10 + index + 1}
                          </td>
                          <td className="si-td">
                            <div className="si-user-cell">
                              <div
                                className="si-user-avatar"
                                style={{
                                  background: color.bg,
                                  color: color.text,
                                }}
                              >
                                {getInitials(item.tname)}
                              </div>
                              <div className="si-user-meta">
                                <span className="si-user-name">
                                  {item.tname || "Assigned Trainer"}
                                </span>
                                <span className="si-user-sub">
                                  {item.temail || "Trainer"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="si-td">
                            <div
                              className="si-msg-preview"
                              onClick={() => setViewItem(item)}
                              title="Click to view full message"
                            >
                              {item.msg}
                            </div>
                          </td>
                          <td className="si-td" style={{ fontSize: "13px" }}>
                            {formatDateTime(item.datetime)}
                          </td>
                          <td className="si-td">
                            {isPending ? (
                              <span className="si-status-pill si-status-pending">
                                <span
                                  className="si-status-dot"
                                  style={{ background: "#d97706" }}
                                />
                                Pending
                              </span>
                            ) : (
                              <span className="si-status-pill si-status-viewed">
                                <span
                                  className="si-status-dot"
                                  style={{ background: "#16a34a" }}
                                />
                                Viewed
                              </span>
                            )}
                          </td>
                          <td className="si-td text-end">
                            <div className="d-inline-flex align-items-center gap-1">
                              <button
                                type="button"
                                className="si-btn-action"
                                title="View Details"
                                onClick={() => setViewItem(item)}
                              >
                                <Eye size={15} />
                              </button>
                              {isPending && (
                                <button
                                  type="button"
                                  className="si-btn-action delete"
                                  title="Delete Query"
                                  onClick={() => handleDeleteQuery(item.id)}
                                >
                                  <Trash2 size={15} />
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

            {/* Table Footer */}
            <div className="si-table-footer">
              <div className="si-table-info">
                Showing {list.length} of {stats.total} queries
              </div>

              {lastPage > 1 && (
                <div className="si-pagination">
                  <button
                    type="button"
                    className="si-page-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      loadDetails(page - 1, search, sort, dfrom, dto, stat)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: lastPage }, (_, i) => i + 1).map(
                    (pNum) => (
                      <button
                        key={pNum}
                        type="button"
                        className={`si-page-btn ${page === pNum ? "active" : ""}`}
                        onClick={() =>
                          loadDetails(pNum, search, sort, dfrom, dto, stat)
                        }
                      >
                        {pNum}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    className="si-page-btn"
                    disabled={page >= lastPage}
                    onClick={() =>
                      loadDetails(page + 1, search, sort, dfrom, dto, stat)
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/student/trainer-contacts" />
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Contact Trainer */}
      {contactModalOpen && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
          }}
          tabIndex={-1}
          role="dialog"
          onClick={() => setContactModalOpen(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 540 }}
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-content"
              style={{
                borderRadius: "20px",
                border: "none",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              <div
                className="modal-header"
                style={{
                  background:
                    "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                  borderBottom: "1px solid #e2e8f0",
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "#582fea",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MessageSquare size={22} />
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
                      Contact Trainer
                    </h5>
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      Send your question or query directly to a course trainer
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setContactModalOpen(false)}
                />
              </div>

              <form onSubmit={handleSendQuery}>
                <div className="modal-body" style={{ padding: "24px" }}>
                  {/* Select Trainer */}
                  <div style={{ marginBottom: 18 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1e293b",
                        marginBottom: 6,
                      }}
                    >
                      Select Trainer *
                    </label>
                    <select
                      className="form-select"
                      value={selectedTrainer}
                      onChange={(e) => setSelectedTrainer(e.target.value)}
                      required
                      style={{
                        fontSize: "13.5px",
                        borderRadius: "10px",
                        border: "1.5px solid #cbd5e1",
                        padding: "9px 12px",
                      }}
                    >
                      <option value="">-- Choose a trainer --</option>
                      {trainers.map((t) => (
                        <option key={t.mem_id} value={t.mem_id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                    </select>
                    {trainers.length === 0 && !trainersLoading && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#94a3b8",
                          marginTop: 4,
                          display: "block",
                        }}
                      >
                        Loading active trainers…
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1e293b",
                        marginBottom: 6,
                      }}
                    >
                      Query / Message *
                    </label>
                    <textarea
                      rows={5}
                      className="form-control"
                      placeholder="Type your question or query for the trainer here…"
                      value={queryMsg}
                      onChange={(e) => setQueryMsg(e.target.value)}
                      required
                      style={{
                        fontSize: "13.5px",
                        borderRadius: "10px",
                        border: "1.5px solid #cbd5e1",
                        padding: "10px 12px",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      background: "#f8fafc",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <AlertCircle
                      size={14}
                      style={{ color: "#582fea", flexShrink: 0 }}
                    />
                    <span>
                      Your trainer will be notified of this query and can review
                      it in their portal.
                    </span>
                  </div>
                </div>

                <div
                  className="modal-footer"
                  style={{
                    padding: "16px 24px",
                    background: "#f8fafc",
                    borderTop: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    className="si-btn-outline"
                    onClick={() => setContactModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="si-btn-primary"
                    disabled={submitting}
                  >
                    <Send size={15} />
                    {submitting ? <ButtonLoader label="Sending Query…" /> : "Send to Trainer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: View Query Details */}
      {viewItem && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
          }}
          tabIndex={-1}
          role="dialog"
          onClick={() => setViewItem(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: 560 }}
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-content"
              style={{
                borderRadius: "20px",
                border: "none",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              <div
                className="modal-header"
                style={{
                  background:
                    "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                  borderBottom: "1px solid #e2e8f0",
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "#582fea",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Eye size={22} />
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
                      Query Details
                    </h5>
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      Submitted on {formatDateTime(viewItem.datetime)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setViewItem(null)}
                />
              </div>

              <div className="modal-body" style={{ padding: "24px" }}>
                {/* Trainer card */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "16px",
                    marginBottom: "18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: "#e0e7ff",
                      color: "#4338ca",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(viewItem.tname)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14.5px",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {viewItem.tname || "Assigned Trainer"}
                    </div>
                    {viewItem.temail && (
                      <div
                        style={{
                          fontSize: "12.5px",
                          color: "#64748b",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        <Mail size={13} /> {viewItem.temail}
                      </div>
                    )}
                    {viewItem.tphone && (
                      <div
                        style={{
                          fontSize: "12.5px",
                          color: "#64748b",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        <Phone size={13} /> {viewItem.tphone}
                      </div>
                    )}
                  </div>
                  <div>
                    {viewItem.status === "1" ? (
                      <span className="si-status-pill si-status-pending">
                        <span
                          className="si-status-dot"
                          style={{ background: "#d97706" }}
                        />
                        Pending
                      </span>
                    ) : (
                      <span className="si-status-pill si-status-viewed">
                        <span
                          className="si-status-dot"
                          style={{ background: "#16a34a" }}
                        />
                        Viewed
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Content */}
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#1e293b",
                      marginBottom: 8,
                    }}
                  >
                    Your Query / Message:
                  </label>
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px",
                      fontSize: "14px",
                      color: "#334155",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      maxHeight: "280px",
                      overflowY: "auto",
                    }}
                  >
                    {viewItem.msg}
                  </div>
                </div>
              </div>

              <div
                className="modal-footer"
                style={{
                  padding: "16px 24px",
                  background: "#f8fafc",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                {viewItem.status === "1" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    style={{ borderRadius: 8, fontWeight: 600 }}
                    onClick={() => {
                      handleDeleteQuery(viewItem.id);
                      setViewItem(null);
                    }}
                  >
                    <Trash2 size={14} className="me-1" /> Delete Query
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="button"
                  className="si-btn-outline"
                  onClick={() => setViewItem(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
