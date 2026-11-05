import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  ShieldAlert,
  Plus,
  RotateCw,
  ArrowUpDown,
  Unlock,
  Trash2,
  ShieldOff,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Globe,
  User,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

const STATE_BADGE: Record<string, [string, string]> = {
  active: ["Active", "danger"],
  expired: ["Expired", "secondary"],
  revoked: ["Revoked", "success"],
};

export default function LoginBlocks() {
  const permCan = usePagePerm("login-blocks");
  const navigate = useNavigate();

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [stats, setStats] = useState({
    active: 0,
    permanent: 0,
    temporary: 0,
    total: 0,
    failed24h: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [kind, setKind] = useState("");
  const [stat, setStat] = useState("");
  const [cardFilter, setCardFilter] = useState<string>("ALL");
  const [lastPage, setLastPage] = useState(0);

  // add-block popup
  const emptyForm = {
    kind: "ip",
    value: "",
    btype: "temp",
    hours: "3",
    reason: "",
  };
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fmtDate = (ts: any) => {
    const n = Number(ts);
    return n
      ? new Date(n * 1000).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  };
  const fmtLeft = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  };

  const loadDetails = async (
    targetPage = 1,
    targetSearch = "",
    targetSort = "",
    k = "",
    st = "",
  ) => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    setSort(targetSort);
    setKind(k);
    setStat(st);
    try {
      const res = await listFetch("api/login-blocks/list", {
          q: targetSearch,
          s: targetSort,
          n: targetPage,
          kind: k,
          st,
        });
      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
        setStats(res.data.stats);
      } else toast.error(res.data.message);
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };
  const reload = (p = page) => loadDetails(p, search, sort, kind, stat);

  const act = async (item: any, action: "revoke" | "delete") => {
    const what =
      item.kind === "ip"
        ? `IP ${item.label || item.value}`
        : `account ${item.label}`;
    const ok = window.confirm(
      action === "revoke"
        ? `Revoke the block on ${what}? They can sign in again straight away.`
        : `Delete this block record for ${what}?${item.state === "active" ? " The block ends now." : ""}`,
    );
    if (!ok) return;
    try {
      setLoadingId(item.b_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/login-blocks/" + action,
        {
          id: item.b_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        if (action === "revoke") {
          // Do not reload lists; change status to revoked in-place
          setAllLists((prev) =>
            prev.map((it) =>
              it.b_id === item.b_id
                ? { ...it, status: "0", state: "revoked", remaining: 0 }
                : it,
            ),
          );
          setStats((prev) => ({
            ...prev,
            active:
              item.state === "active"
                ? Math.max(0, prev.active - 1)
                : prev.active,
            permanent:
              item.state === "active" && item.btype === "perm"
                ? Math.max(0, prev.permanent - 1)
                : prev.permanent,
            temporary:
              item.state === "active" && item.btype === "temp"
                ? Math.max(0, prev.temporary - 1)
                : prev.temporary,
          }));
        } else if (action === "delete") {
          // Do not reload lists; remove only from existing list
          setAllLists((prev) => prev.filter((it) => it.b_id !== item.b_id));
          setTotal((prev) => Math.max(0, prev - 1));
          setStats((prev) => ({
            ...prev,
            total: Math.max(0, prev.total - 1),
            active:
              item.state === "active"
                ? Math.max(0, prev.active - 1)
                : prev.active,
            permanent:
              item.state === "active" && item.btype === "perm"
                ? Math.max(0, prev.permanent - 1)
                : prev.permanent,
            temporary:
              item.state === "active" && item.btype === "temp"
                ? Math.max(0, prev.temporary - 1)
                : prev.temporary,
          }));
        }
      } else toast.error(res.data.message);
    } catch {
      toast.error("Request failed");
    } finally {
      setLoadingId(null);
    }
  };

  const saveBlock = async () => {
    if (!form.value.trim()) {
      toast.error(
        form.kind === "ip"
          ? "Enter an IP address"
          : "Enter an email or phone number",
      );
      return;
    }
    setSaving(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/login-blocks/add",
        {
          ...form,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAddOpen(false);
        reload(1);
      } else toast.error(res.data.message);
    } catch {
      toast.error("Request failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y"))
          loadDetails();
        else navigate("/logout");
      })
      .catch(() => navigate("/logout"));
  }, []);

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
          background: #fee2e2;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
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

        /* Stats Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 900px) {
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
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.card-active {
          background: #fef2f2;
        }
        .si-stat-card.card-active.active {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25) !important;
        }
        .si-stat-card.card-permanent {
          background: #f8fafc;
        }
        .si-stat-card.card-permanent.active {
          border-color: #0f172a !important;
          box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.25) !important;
        }
        .si-stat-card.card-failed {
          background: #fffbeb;
        }
        .si-stat-card.card-failed.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
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
          min-width: 260px;
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

        .si-kind-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          margin-right: 8px;
        }
        .si-kind-badge.kind-ip {
          background: #e0f2fe;
          color: #0369a1;
        }
        .si-kind-badge.kind-acc {
          background: #ede9fe;
          color: var(--ad-brand);
        }

        .si-btype-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
        }
        .si-btype-badge.perm {
          background: #0f172a;
          color: #ffffff;
        }
        .si-btype-badge.temp {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
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
        .si-status-pill.status-active {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-status-pill.status-expired {
          background: #f1f5f9;
          color: #64748b;
        }
        .si-status-pill.status-revoked {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-active .si-status-dot { background: #dc2626; }
        .status-expired .si-status-dot { background: #94a3b8; }
        .status-revoked .si-status-dot { background: #16a34a; }

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
        .si-action-btn.btn-unlock {
          background: #dcfce7;
          color: #16a34a;
        }
        .si-action-btn.btn-trash {
          background: #fee2e2;
          color: #ef4444;
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
      `}</style>
      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Login Blocks</h3>
                <p className="si-header-subtitle">
                  Automated 3-hour lockout protection & manual access blocks for
                  IPs and accounts
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <span className="si-total-count-text">
                Total <b>{listtotal}</b>
              </span>

              {permCan("create") && (
                <button
                  className="si-btn-primary"
                  onClick={() => {
                    setForm(emptyForm);
                    setAddOpen(true);
                  }}
                >
                  <Plus size={16} /> Add Block
                </button>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card card-active ${cardFilter === "active" ? "active" : ""}`}
              onClick={() => {
                if (cardFilter === "active") {
                  setCardFilter("ALL");
                  loadDetails(1, search, sort, kind, "");
                } else {
                  setCardFilter("active");
                  loadDetails(1, search, sort, kind, "active");
                }
              }}
              title={
                cardFilter === "active"
                  ? "Click to show all"
                  : "Filter by Active Blocks"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fee2e2", color: "#dc2626" }}
              >
                <ShieldOff size={22} />
              </div>
              <div>
                <p className="si-stat-label">Active Blocks</p>
                <h3 className="si-stat-value"><AnimatedNumber value={stats.active} pending={loading} id="LoginBlocks-s1" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-permanent ${cardFilter === "permanent" ? "active" : ""}`}
              onClick={() => {
                if (cardFilter === "permanent") {
                  setCardFilter("ALL");
                } else {
                  setCardFilter("permanent");
                }
              }}
              title={
                cardFilter === "permanent"
                  ? "Click to show all"
                  : "Filter by Permanent Blocks"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#f1f5f9", color: "#0f172a" }}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <p className="si-stat-label">Permanent Blocks</p>
                <h3 className="si-stat-value"><AnimatedNumber value={stats.permanent} pending={loading} id="LoginBlocks-s2" /></h3>
              </div>
            </div>

            <div
              className={`si-stat-card card-failed ${cardFilter === "failed" ? "active" : ""}`}
              onClick={() => {
                if (cardFilter === "failed") {
                  setCardFilter("ALL");
                } else {
                  setCardFilter("failed");
                }
              }}
              title="Failed Sign-ins in past 24 hours"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <p className="si-stat-label">Failed Sign-ins (24h)</p>
                <h3 className="si-stat-value"><AnimatedNumber value={stats.failed24h} pending={loading} id="LoginBlocks-s3" /></h3>
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
                  onChange={(e) =>
                    loadDetails(1, search, e.target.value, kind, stat)
                  }
                >
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                </select>
              </div>

              <div className="si-sort-group">
                <span>Target:</span>
                <select
                  className="si-select-sort"
                  value={kind}
                  onChange={(e) =>
                    loadDetails(1, search, sort, e.target.value, stat)
                  }
                >
                  <option value="">IP &amp; Accounts</option>
                  <option value="ip">IP Addresses</option>
                  <option value="account">Accounts</option>
                </select>
              </div>

              <div className="si-sort-group">
                <span>Status:</span>
                <select
                  className="si-select-sort"
                  value={stat}
                  onChange={(e) =>
                    loadDetails(1, search, sort, kind, e.target.value)
                  }
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>

            <div className="si-filter-right">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort, kind, stat);
                }}
              >
                <ListSearch
                  placeholder="Search IP, email, reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <button data-refresh
                className="reload-btn"
                title="Reset search & reload"
                onClick={() => {
                  setSearch("");
                  setKind("");
                  setStat("");
                  loadDetails(1, "", "New", "", "");
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
                    <th className="si-th">Blocked Target</th>
                    <th className="si-th">Type</th>
                    <th className="si-th">Reason</th>
                    <th className="si-th">Blocked Date</th>
                    <th className="si-th">Expires / Remaining</th>
                    <th className="si-th">Blocked By</th>
                    <th className="si-th">Status</th>
                    <th
                      className="si-th"
                      style={{ textAlign: "center", width: 90 }}
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
                      <td colSpan={9}>
                        <div className="si-empty-box">
                          <ShieldAlert size={40} className="si-empty-icon" />
                          <h5
                            style={{
                              fontWeight: 600,
                              color: "#1e293b",
                              margin: "4px 0",
                            }}
                          >
                            No Blocks Found
                          </h5>
                          <p
                            style={{
                              color: "#64748b",
                              fontSize: "13px",
                              margin: 0,
                            }}
                          >
                            {search || kind || stat
                              ? "No blocked entries match your filters."
                              : "No IP address or user account has been blocked."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    alllists
                      .filter((item) => {
                        if (cardFilter === "permanent")
                          return item.btype === "perm";
                        return true;
                      })
                      .map((item, index) => {
                        const [stLabel] = STATE_BADGE[item.state] || [
                          "—",
                          "secondary",
                        ];

                        return (
                          <tr key={item.b_id} className="si-tr">
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
                                }}
                              >
                                <span
                                  className={`si-kind-badge ${
                                    item.kind === "ip" ? "kind-ip" : "kind-acc"
                                  }`}
                                >
                                  {item.kind === "ip" ? (
                                    <>
                                      <Globe size={11} /> IP
                                    </>
                                  ) : (
                                    <>
                                      <User size={11} /> Account
                                    </>
                                  )}
                                </span>
                                <span
                                  style={{ fontWeight: 600, color: "#0f172a" }}
                                >
                                  {item.label || item.value}
                                </span>
                              </div>
                            </td>

                            <td className="si-td">
                              <span
                                className={`si-btype-badge ${
                                  item.btype === "perm" ? "perm" : "temp"
                                }`}
                              >
                                {item.btype === "perm"
                                  ? "Permanent"
                                  : "Temporary"}
                              </span>
                            </td>

                            <td
                              className="si-td"
                              style={{ maxWidth: 220, color: "#475569" }}
                            >
                              {item.reason || "—"}
                            </td>

                            <td
                              className="si-td"
                              style={{ fontSize: 13, color: "#475569" }}
                            >
                              {fmtDate(item.datetime)}
                            </td>

                            <td className="si-td">
                              <div style={{ fontSize: 13, color: "#1e293b" }}>
                                {item.btype === "perm"
                                  ? "Never"
                                  : fmtDate(item.expires)}
                              </div>
                              {item.state === "active" &&
                                item.remaining > 0 && (
                                  <div
                                    style={{
                                      fontSize: 11.5,
                                      color: "#dc2626",
                                      fontWeight: 600,
                                    }}
                                  >
                                    ⏳ {fmtLeft(item.remaining)} left
                                  </div>
                                )}
                            </td>

                            <td
                              className="si-td"
                              style={{ fontSize: 13, color: "#64748b" }}
                            >
                              {item.by || "System"}
                            </td>

                            <td className="si-td">
                              <span
                                className={`si-status-pill ${
                                  item.state === "active"
                                    ? "status-active"
                                    : item.state === "revoked"
                                      ? "status-revoked"
                                      : "status-expired"
                                }`}
                              >
                                <span className="si-status-dot" /> {stLabel}
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
                                {item.state === "active" &&
                                  permCan("status") && (
                                    <button
                                      type="button"
                                      className="si-action-btn btn-unlock"
                                      disabled={loadingId === item.b_id}
                                      onClick={() => act(item, "revoke")}
                                      title="Revoke block — allow sign in"
                                    >
                                      <Unlock size={15} />
                                    </button>
                                  )}

                                {permCan("delete") && (
                                  <button
                                    type="button"
                                    className="si-action-btn btn-trash"
                                    disabled={loadingId === item.b_id}
                                    onClick={() => act(item, "delete")}
                                    title="Delete record"
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

            {/* Footer & Pagination */}
            <div className="si-table-footer">
              <div className="si-footer-left">
                <span>
                  Showing <b>{alllists.length ? (page - 1) * limit + 1 : 0}</b>{" "}
                  to <b>{Math.min(page * limit, listtotal)}</b> of{" "}
                  <b>{listtotal}</b> entries
                </span>
              </div>

              <div className="si-pagination">
                <button
                  type="button"
                  className="si-page-nav-btn"
                  disabled={page <= 1}
                  onClick={() => reload(page - 1)}
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
                        onClick={() => reload(pNum)}
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
                  onClick={() => reload(page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/login-blocks/list" />
            </div>
          </div>
        </div>

        {/* ============ ADD BLOCK MODAL ============ */}
        {addOpen && (
          <div
            className="modal fade show d-block"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => !saving && setAddOpen(false)}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              style={{ maxWidth: 500 }}
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
                      "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                    borderBottom: "1px solid #fecaca",
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
                        background: "#ef4444",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ShieldAlert size={20} />
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
                        Add Login Block
                      </h5>
                      <span style={{ fontSize: 12, color: "#7f1d1d" }}>
                        Manually block an IP or user account
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    disabled={saving}
                    onClick={() => setAddOpen(false)}
                  />
                </div>

                <div className="modal-body" style={{ padding: 24 }}>
                  <div className="row g-3">
                    <div className="col-12">
                      <label
                        className="form-label"
                        style={{ fontWeight: 600, fontSize: 13 }}
                      >
                        Block Target
                      </label>
                      <div className="d-flex gap-4">
                        <label
                          className="form-check"
                          style={{ cursor: "pointer" }}
                        >
                          <input
                            className="form-check-input"
                            type="radio"
                            name="lb-kind"
                            checked={form.kind === "ip"}
                            onChange={() =>
                              setForm({ ...form, kind: "ip", value: "" })
                            }
                          />
                          <span
                            className="form-check-label"
                            style={{ fontWeight: 600, fontSize: 13.5 }}
                          >
                            IP Address
                          </span>
                        </label>
                        <label
                          className="form-check"
                          style={{ cursor: "pointer" }}
                        >
                          <input
                            className="form-check-input"
                            type="radio"
                            name="lb-kind"
                            checked={form.kind === "account"}
                            onChange={() =>
                              setForm({ ...form, kind: "account", value: "" })
                            }
                          />
                          <span
                            className="form-check-label"
                            style={{ fontWeight: 600, fontSize: 13.5 }}
                          >
                            User Account
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="col-12">
                      <label
                        className="form-label"
                        style={{ fontWeight: 600, fontSize: 13 }}
                      >
                        {form.kind === "ip"
                          ? "IP Address *"
                          : "Account Email or Phone Number *"}
                      </label>
                      <input
                        className="form-control"
                        value={form.value}
                        onChange={(e) =>
                          setForm({ ...form, value: e.target.value })
                        }
                        placeholder={
                          form.kind === "ip"
                            ? "e.g. 103.21.244.12"
                            : "name@example.com or 9876543210"
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label
                        className="form-label"
                        style={{ fontWeight: 600, fontSize: 13 }}
                      >
                        Type
                      </label>
                      <select
                        className="form-select"
                        value={form.btype}
                        onChange={(e) =>
                          setForm({ ...form, btype: e.target.value })
                        }
                      >
                        <option value="temp">Temporary</option>
                        <option value="perm">Permanent</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label
                        className="form-label"
                        style={{ fontWeight: 600, fontSize: 13 }}
                      >
                        Duration (Hours)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={8760}
                        className="form-control"
                        value={form.hours}
                        disabled={form.btype === "perm"}
                        onChange={(e) =>
                          setForm({ ...form, hours: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-12">
                      <label
                        className="form-label"
                        style={{ fontWeight: 600, fontSize: 13 }}
                      >
                        Reason (Optional)
                      </label>
                      <input
                        className="form-control"
                        value={form.reason}
                        maxLength={300}
                        onChange={(e) =>
                          setForm({ ...form, reason: e.target.value })
                        }
                        placeholder="Display note or explanation"
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
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={saving}
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
                      background: "#ef4444",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "8px 20px",
                      fontWeight: 600,
                      fontSize: 13,
                      border: "none",
                    }}
                    disabled={saving}
                    onClick={saveBlock}
                  >
                    {saving ? <ButtonLoader label="Saving..." /> : "Add Block"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
