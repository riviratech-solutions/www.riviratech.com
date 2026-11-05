import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  ArrowLeft,
  RotateCw,
  LogOut,
  MapPin,
  Clock,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { AnimatedNumber, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

const STATE: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#16a34a", bg: "#dcfce7" },
  expired: { label: "Expired", color: "#64748b", bg: "#f1f5f9" },
  logged_out: { label: "Logged out", color: "#64748b", bg: "#f1f5f9" },
  revoked: { label: "Signed out (admin)", color: "#dc2626", bg: "#fee2e2" },
};

export default function LoginSessions({ self = false }: { self?: boolean }) {
  const pagePerm = usePagePerm("login-sessions");
  const permCan = (a: string) => (self ? true : pagePerm(a));
  const api = self ? "api/my-sessions/" : "api/login-sessions/";
  const navigate = useNavigate();
  const location = useLocation();
  const memId = new URLSearchParams(location.search).get("m") || "";

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;

  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [member, setMember] = useState<any>(null);
  const [stats, setStats] = useState({
    active: 0,
    remembered: 0,
    total: 0,
    last: 0,
  });
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [stat, setStat] = useState("");
  const [error, setError] = useState("");

  const load = async (p = 1, st = stat) => {
    setLoading(true);
    setPage(p);
    setStat(st);
    try {
      const res = await listFetch(api + "list", { m: memId, n: p, st });
      if (res.data.success) {
        setMember(res.data.member);
        setStats(
          res.data.stats || { active: 0, remembered: 0, total: 0, last: 0 },
        );
        setRows(res.data.data || []);
        setTotal(res.data.total || 0);
        setLastPage(res.data.lastPage || 1);
        setError("");
      } else {
        setError(res.data.message || "Couldn't load sessions");
        setRows([]);
      }
    } catch {
      setError("Couldn't load sessions");
    } finally {
      setLoading(false);
    }
  };

  const endSession = async (r: any) => {
    const msg = r.thisDevice
      ? "This is your own current session — signing it out will sign you out here. Continue?"
      : `Sign out this ${r.device?.browser || ""} session? That device will have to sign in again.`;
    if (!window.confirm(msg)) return;
    setBusyId(r.id);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + api + "end",
        { id: r.id, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message);
        if (r.thisDevice) {
          navigate("/logout");
          return;
        }
        load(page);
      } else toast.error(res.data.message);
    } catch {
      toast.error("Request failed");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (
          res.data.loggedIn &&
          (self || res.data.id === "X" || res.data.id === "Y")
        )
          load(1, "");
        else navigate("/logout");
      })
      .catch(() => navigate("/logout"));
  }, [memId, self]);

  const fmt = (ts: number) =>
    ts
      ? new Date(ts * 1000).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const renderDeviceIcon = (t: string) => {
    if (t === "Mobile")
      return <Smartphone size={18} className="text-primary" />;
    if (t === "Tablet")
      return (
        <Tablet
          size={18}
          className="text-purple"
          style={{ color: "var(--ad-brand)" }}
        />
      );
    return <Laptop size={18} className="text-secondary" />;
  };

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
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
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
      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper">
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Monitor size={24} />
              </div>
              <div>
                <div className="si-header-title-row">
                  <h3 className="si-header-title">
                    {self ? "My Sessions" : "Login Sessions"}
                  </h3>
                  <span className="si-total-badge">
                    Total <b>{stats.total}</b>
                  </span>
                </div>
                <p className="si-header-subtitle">
                  {member ? (
                    <>
                      <b className="text-dark">{member.name || "—"}</b>
                      <span
                        className="badge bg-primary ms-2"
                        style={{ fontSize: "11px" }}
                      >
                        {member.role}
                      </span>
                      <span className="ms-2">
                        {member.email}
                        {member.number ? ` · ${member.number}` : ""}
                      </span>
                    </>
                  ) : (
                    "Manage active and past device sign-in sessions."
                  )}
                </p>
              </div>
            </div>
            <div className="si-header-right">
              <button className="si-btn-outline" onClick={() => navigate(-1)}>
                <ArrowLeft size={16} /> Go Back
              </button>
            </div>
          </div>

          {error ? (
            <div className="card p-4 text-center text-muted">{error}</div>
          ) : (
            <>
              {/* Stats KPI Grid */}
              <div className="si-stats-grid">
                <div className="si-stat-card">
                  <div className="si-stat-icon-wrapper green">
                    <Radio size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Active Now</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={stats.active} pending={loading} id="LoginSessions-s1" /></h4>
                  </div>
                </div>

                <div className="si-stat-card">
                  <div className="si-stat-icon-wrapper amber">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Remembered Devices</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={stats.remembered} pending={loading} id="LoginSessions-s2" /></h4>
                  </div>
                </div>

                <div className="si-stat-card">
                  <div className="si-stat-icon-wrapper purple">
                    <Monitor size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">All Sessions</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={stats.total} pending={loading} id="LoginSessions-s3" /></h4>
                  </div>
                </div>

                <div className="si-stat-card">
                  <div className="si-stat-icon-wrapper blue">
                    <Clock size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Last Sign-In</span>
                    <h4 className="si-stat-value" style={{ fontSize: "14px" }}>
                      <AnimatedNumber value={fmt(stats.last)} pending={loading} id="LoginSessions-s4" />
                    </h4>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <div className="si-filter-select-wrapper">
                  <select
                    className="si-filter-select"
                    value={stat}
                    onChange={(e) => load(1, e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active Sessions</option>
                    <option value="ended">Ended Sessions</option>
                  </select>
                </div>

                <div className="ms-auto d-flex align-items-center gap-2">
                  <button data-refresh
                    className="reload-btn"
                    title="Reload"
                    onClick={() => load(1, stat)}
                  >
                    <RotateCw size={15} />
                  </button>
                </div>
              </div>

              {/* Modern Table Card */}
              <div className="si-table-card">
                <div className="si-table-responsive">
                  <table className="si-table">
                    <thead className="si-thead">
                      <tr>
                        <th className="si-th">Device & Browser</th>
                        <th className="si-th">IP Address</th>
                        <th className="si-th">Location / Locale</th>
                        <th className="si-th">Signed In</th>
                        <th className="si-th">Expires</th>
                        <th className="si-th">Type</th>
                        <th className="si-th">Status</th>
                        <th
                          className="si-th text-center"
                          style={{ width: 110 }}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {loading ? (
                        <SkeletonRows />
                      ) : rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="text-center py-5 text-muted"
                          >
                            {stat
                              ? "No sessions match this status filter."
                              : self
                                ? "No sign-in sessions recorded yet."
                                : "No sign-in sessions recorded for this member yet."}
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => {
                          const d = r.device || {};
                          const stMeta = STATE[r.state] || {
                            label: r.state,
                            color: "#64748b",
                            bg: "#f1f5f9",
                          };
                          const place = [d.city, d.region, d.country]
                            .filter(Boolean)
                            .join(", ");
                          return (
                            <tr key={r.id} className="si-tr">
                              <td className="si-td">
                                <div className="d-flex align-items-center gap-2">
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 10,
                                      background: "#f1f5f9",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {renderDeviceIcon(d.deviceType)}
                                  </div>
                                  <div>
                                    <div
                                      className="fw-semibold text-dark"
                                      style={{ fontSize: "13.5px" }}
                                    >
                                      {d.browser || "Unknown browser"}
                                      {d.version ? ` ${d.version}` : ""}
                                      {r.thisDevice && (
                                        <span
                                          className="badge ms-2"
                                          style={{
                                            background: "#e0f2fe",
                                            color: "#0369a1",
                                            fontSize: "11px",
                                            fontWeight: 600,
                                          }}
                                        >
                                          This device
                                        </span>
                                      )}
                                    </div>
                                    <small
                                      className="text-muted"
                                      style={{ fontSize: "12px" }}
                                    >
                                      {[d.os, d.deviceType]
                                        .filter(Boolean)
                                        .join(" · ") || "—"}
                                    </small>
                                  </div>
                                </div>
                              </td>

                              <td className="si-td">
                                <code
                                  style={{
                                    background: "#f8fafc",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    border: "1px solid #e2e8f0",
                                    fontSize: "12px",
                                    color: "#475569",
                                  }}
                                >
                                  {r.ip || "—"}
                                </code>
                              </td>

                              <td className="si-td">
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: "#1e293b",
                                  }}
                                >
                                  {place ? (
                                    <span className="d-flex align-items-center gap-1">
                                      <MapPin
                                        size={13}
                                        className="text-muted"
                                      />{" "}
                                      {place}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </div>
                                <small
                                  className="text-muted d-block"
                                  style={{ fontSize: "11.5px" }}
                                >
                                  {[
                                    d.timezone,
                                    d.language,
                                    d.screen && `${d.screen} screen`,
                                    d.platform,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </small>
                              </td>

                              <td className="si-td">
                                <When ts={r.created} />
                              </td>

                              <td className="si-td">
                                <When ts={r.expires} />
                              </td>

                              <td className="si-td">
                                {r.type === "R" ? (
                                  <span
                                    className="si-status-pill"
                                    style={{
                                      background: "#fef3c7",
                                      color: "#92400e",
                                    }}
                                  >
                                    Remembered
                                  </span>
                                ) : (
                                  <span
                                    className="si-status-pill"
                                    style={{
                                      background: "#f1f5f9",
                                      color: "#475569",
                                    }}
                                  >
                                    Normal
                                  </span>
                                )}
                              </td>

                              <td className="si-td">
                                <span
                                  className="si-status-pill"
                                  style={{
                                    background: stMeta.bg,
                                    color: stMeta.color,
                                  }}
                                >
                                  <span
                                    className="si-status-dot"
                                    style={{ background: stMeta.color }}
                                  />
                                  {stMeta.label}
                                </span>
                              </td>

                              <td className="si-td text-center">
                                {r.state === "active" && permCan("status") ? (
                                  <button
                                    className="si-action-btn delete"
                                    title="Sign out this session"
                                    disabled={busyId === r.id}
                                    onClick={() => endSession(r)}
                                  >
                                    <LogOut size={15} />
                                  </button>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {total > 0 && lastPage > 1 && (
                  <div className="si-table-footer">
                    <div className="si-table-info">
                      Showing {(page - 1) * limit + 1} to{" "}
                      {Math.min(page * limit, total)} of {total} entries
                    </div>
                    <div className="si-pagination">
                      <button
                        className="si-page-nav-btn"
                        disabled={page <= 1}
                        onClick={() => load(page - 1)}
                      >
                        « Prev
                      </button>
                      {Array.from({ length: lastPage }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === lastPage ||
                            Math.abs(p - page) <= 2,
                        )
                        .map((p, idx, arr) => (
                          <span key={p} className="d-flex align-items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-muted">…</span>
                            )}
                            <button
                              className={`si-page-btn ${p === page ? "active" : ""}`}
                              onClick={() => load(p)}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        className="si-page-nav-btn"
                        disabled={page >= lastPage}
                        onClick={() => load(page + 1)}
                      >
                        Next »
                      </button>
                    </div>
                  </div>
                )}
                <div className="saved-ago-row">
                  <SavedAgo endpoint={api + "list"} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  function When({ ts }: { ts: number }) {
    if (!ts) return <>—</>;
    const d = new Date(ts * 1000);
    return (
      <div style={{ fontSize: "12.5px" }}>
        <div style={{ fontWeight: 500, color: "#1e293b" }}>
          {d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </div>
        <small className="text-muted" style={{ fontSize: "11px" }}>
          {d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </small>
      </div>
    );
  }
}
