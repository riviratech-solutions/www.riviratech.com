import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Activity as ActivityIcon,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  Eye,
  X,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Clock,
  KeyRound,
  User,
  RefreshCw,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

type Activity = {
  id: number;
  mem_id: string;
  to_id?: string;
  ntable: string;
  info: string;
  fromtxt: string;
  totxt: string;
  datetime: string;
  actor?: string;
};

export default function Activities() {
  const navigate = useNavigate();
  const limit = 100;


  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [alllists, setAllLists] = useState<Activity[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [lastPage, setLastPage] = useState(0);

  /* Popups: the profile behind an "Adminer" name, and the full record of one row. */
  const [profile, setProfile] = useState<{ open: boolean; loading: boolean; data: any; error: string }>({
    open: false, loading: false, data: null, error: "",
  });
  const [infoRow, setInfoRow] = useState<Activity | null>(null);

  /* Profiles come through listFetch (utils/listCache.ts), so opening the same
     person again is instant and makes no request; the popup's refresh button
     asks for fresh details. */
  const openProfile = async (memId: string, fresh = false) => {
    if (!memId) return;
    setProfile((p) => ({ open: true, loading: true, data: p.data?.mem_id === memId ? p.data : null, error: "" }));
    try {
      const res = await listFetch("api/activities-actor", { mem_id: memId }, { fresh });
      if (res.data.success) setProfile({ open: true, loading: false, data: res.data.data, error: "" });
      else setProfile({ open: true, loading: false, data: null, error: res.data.message || "Could not load this profile" });
    } catch {
      setProfile({ open: true, loading: false, data: null, error: "Something went wrong" });
    }
  };
  const closeProfile = () => setProfile({ open: false, loading: false, data: null, error: "" });

  // Escape closes whichever popup is open.
  useEffect(() => {
    if (!profile.open && !infoRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeProfile();
      setInfoRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile.open, infoRow]);

  const formatDate = (ts: any): { date: string; time: string } => {
    const n = Number(ts);
    if (!n) return { date: "—", time: "" };
    const d = new Date(n * 1000);
    return {
      date: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      time: d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const loadDetails = async (targetPage = 1, targetSearch = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(targetPage);
    setSearch(targetSearch);
    try {
      const res = await listFetch("api/activities", {
          q: targetSearch,
          n: targetPage,
        });

      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
        setIsSuper(!!res.data.isSuper);
      } else {
        toast.error(res.data.message || "Failed to load activities");
      }
    } catch {
      toast.error("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    if (data.loggedIn && (data.id === "X" || data.id === "Y")) {
      setIsSuper(data.id === "X");
      loadDetails();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();
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
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ad-brand);
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
          text-decoration: none;
        }
        .si-btn-outline:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
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
        .si-filter-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          width: 100%;
          justify-content: flex-end;
        }
        .si-search-box {
          display: flex;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          background: #ffffff;
          min-width: 320px;
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
        .si-actor-btn { border: 0; cursor: pointer; text-align: left; line-height: 1.35; transition: background .15s, box-shadow .15s; }
        .si-actor-btn:hover { background: #ddd6fe; box-shadow: 0 0 0 2px #c4b5fd; }
        .si-info-btn {
          width: 34px; height: 34px; border-radius: 9px; border: 1px solid #e2e8f0; background: #fff;
          color: var(--ad-brand); display: inline-grid; place-items: center; cursor: pointer; transition: all .15s;
        }
        .si-info-btn:hover { background: #eef2ff; border-color: #a5b4fc; }
        .ap-overlay {
          position: fixed; inset: 0; z-index: 2000; background: rgba(15, 23, 42, .55);
          display: flex; align-items: center; justify-content: center; padding: 16px; animation: ap-fade .15s ease-out;
        }
        @keyframes ap-fade { from { opacity: 0; } to { opacity: 1; } }
        .ap-modal {
          position: relative; width: 100%; max-width: 520px; max-height: calc(100vh - 32px); overflow: auto;
          background: #fff; border-radius: 18px; padding: 24px; box-shadow: 0 24px 60px -20px rgba(15,23,42,.5);
        }
        .ap-close {
          position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; border-radius: 9px; border: 0;
          background: #f1f5f9; color: #475569; display: grid; place-items: center; cursor: pointer;
        }
        .ap-close:hover { background: #e2e8f0; color: #0f172a; }
        .ap-refresh { right: 54px; }
        .ap-refresh:disabled { cursor: default; opacity: .7; }
        .ap-refresh.is-spinning svg { animation: ap-spin .8s linear infinite; }
        @keyframes ap-spin { to { transform: rotate(360deg); } }
        .ap-state { padding: 40px 0; text-align: center; color: #64748b; }
        .ap-error { color: #b91c1c; }
        .ap-head { display: flex; align-items: center; gap: 14px; margin: 0 84px 18px 0; }
        .ap-head h3 { margin: 0 0 6px; font-size: 1.2rem; font-weight: 700; color: #0f172a; }
        .ap-avatar {
          position: relative; flex: none; width: 58px; height: 58px; border-radius: 16px; overflow: hidden;
          background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%); color: #fff; display: grid; place-items: center;
          font-size: 1.4rem; font-weight: 700;
        }
        .ap-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .ap-avatar-icon { background: #eef2ff; color: var(--ad-brand); }
        .ap-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .ap-tag { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
        .ap-role { background: #ede9fe; color: var(--ad-brand); }
        .ap-ok { background: #dcfce7; color: #15803d; }
        .ap-warn { background: #fee2e2; color: #b91c1c; }
        .ap-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
        .ap-stats div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; text-align: center; }
        .ap-stats b { display: block; font-size: 1.15rem; color: #0f172a; }
        .ap-stats small { font-size: 11.5px; color: #64748b; }
        .ap-list { margin: 0; display: flex; flex-direction: column; }
        .ap-list > div { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid #f1f5f9; }
        .ap-list dt { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #64748b; }
        .ap-list dd { margin: 0; font-size: 13.5px; color: #0f172a; overflow-wrap: anywhere; }
        .ap-list a, .ap-link { color: var(--ad-brand); text-decoration: none; }
        .ap-link { border: 0; background: none; padding: 0; font: inherit; font-weight: 600; cursor: pointer; }
        .ap-link:hover, .ap-list a:hover { text-decoration: underline; }
        .ap-mono { font-family: ui-monospace, Consolas, monospace; font-size: 12px !important; color: #475569 !important; }
        .ap-info-text { margin: 0 0 14px; padding: 12px 14px; background: #f8fafc; border-radius: 12px; font-size: 14px; color: #0f172a; overflow-wrap: anywhere; }
        .ap-change { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .ap-change small { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; margin-bottom: 4px; }
        .ap-change pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; max-height: 180px; overflow: auto; }
        @media (max-width: 560px) {
          .ap-list > div { grid-template-columns: 1fr; gap: 2px; }
          .ap-change { grid-template-columns: 1fr; }
        }
        .si-actor-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ede9fe;
          color: var(--ad-brand);
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
        }
        .si-section-pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          text-transform: capitalize;
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .si-datetime-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-date-text {
          font-weight: 500;
          color: #1e293b;
          font-size: 13px;
        }
        .si-time-text {
          font-size: 12px;
          color: #94a3b8;
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
                <ActivityIcon size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Activities Log</h3>
                <p className="si-header-subtitle">
                  {isSuper
                    ? "Audit trail of all administrative actions and system updates across the platform"
                    : "Your recent administrative activity history and event logs"}
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <span className="si-total-count-text">
                Total Logged <b>{listtotal}</b>
              </span>

              <button
                className="si-btn-outline"
                onClick={() => loadDetails(page, search)}
                disabled={loading}
              >
                <RotateCw size={15} /> Refresh
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <div className="si-filter-right">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search);
                }}
              >
                <ListSearch
                  placeholder="Search activity description or adminer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>

              <button data-refresh
                className="reload-btn"
                title="Reset search & reload"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "");
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
                    {isSuper && (
                      <th className="si-th" style={{ width: 170 }}>
                        Adminer
                      </th>
                    )}
                    <th className="si-th">Activity Details</th>
                    <th className="si-th" style={{ width: 150 }}>
                      Section
                    </th>
                    <th className="si-th" style={{ width: 180 }}>
                      Date & Time
                    </th>
                    <th className="si-th" style={{ width: 70, textAlign: "center" }}>
                      Info
                    </th>
                  </tr>
                </thead>
                <tbody className="si-tbody">
                  {loading ? (
                    <SkeletonRows />
                  ) : alllists.length === 0 ? (
                    <tr>
                      <td colSpan={isSuper ? 6 : 5}>
                        <div className="si-empty-box">
                          <ActivityIcon size={40} className="si-empty-icon" />
                          <h5
                            style={{
                              fontWeight: 600,
                              color: "#1e293b",
                              margin: "4px 0",
                            }}
                          >
                            No Activities Recorded
                          </h5>
                          <p
                            style={{
                              color: "#64748b",
                              fontSize: "13px",
                              margin: 0,
                            }}
                          >
                            {search
                              ? "No activity logs match your search query."
                              : "There is currently no activity recorded in the logs."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    alllists.map((a, index) => {
                      const dt = formatDate(a.datetime);
                      return (
                        <tr key={a.id} className="si-tr">
                          <td
                            className="si-td"
                            style={{ color: "#64748b", fontWeight: 600 }}
                          >
                            {(page - 1) * limit + index + 1}
                          </td>

                          {isSuper && (
                            <td className="si-td">
                              <button
                                type="button"
                                className="si-actor-badge si-actor-btn"
                                onClick={() => openProfile(a.mem_id)}
                                title="View full profile"
                              >
                                <Shield size={13} />{" "}
                                {a.actor || a.mem_id || "—"}
                              </button>
                            </td>
                          )}

                          <td
                            className="si-td"
                            style={{ fontWeight: 500, color: "#0f172a" }}
                          >
                            {a.info}
                          </td>

                          <td className="si-td">
                            <span className="si-section-pill">
                              <Layers
                                size={11}
                                style={{ marginRight: 4, display: "inline" }}
                              />
                              {a.ntable || "—"}
                            </span>
                          </td>

                          <td className="si-td">
                            <div className="si-datetime-col">
                              <span className="si-date-text">{dt.date}</span>
                              <span className="si-time-text">{dt.time}</span>
                            </div>
                          </td>

                          <td className="si-td" style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="si-info-btn"
                              onClick={() => setInfoRow(a)}
                              title="View full activity details"
                              aria-label="View full activity details"
                            >
                              <Eye size={16} />
                            </button>
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
                  onClick={() => {
                    const p = page - 1;
                    setPage(p);
                    loadDetails(p, search);
                  }}
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
                        onClick={() => {
                          setPage(pNum);
                          loadDetails(pNum, search);
                        }}
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
                  onClick={() => {
                    const p = page + 1;
                    setPage(p);
                    loadDetails(p, search);
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/activities" />
            </div>
          </div>
        </div>
      </div>
      {/* ===== Profile popup (click an Adminer name) ===== */}
      {profile.open && (
        <div className="ap-overlay" onMouseDown={closeProfile}>
          <div className="ap-modal" role="dialog" aria-modal="true" aria-label="Profile" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="ap-close" onClick={closeProfile} aria-label="Close"><X size={18} /></button>
            {profile.data && (
              <button
                type="button"
                className={"ap-close ap-refresh" + (profile.loading ? " is-spinning" : "")}
                onClick={() => openProfile(profile.data.mem_id, true)}
                disabled={profile.loading}
                aria-label="Refresh details"
                title="Load fresh details"
              >
                <RefreshCw size={16} />
              </button>
            )}
            {profile.loading && !profile.data ? (
              <div className="ap-state">Loading profile…</div>
            ) : profile.error ? (
              <div className="ap-state ap-error">{profile.error}</div>
            ) : profile.data && (() => {
              const m = profile.data;
              const base = String(m.status || "").replace(/[SDP]$/, "");
              const role = ({ X: "Super Admin", Y: "Admin", "1": "Student", "2": "Trainer" } as Record<string, string>)[base] || "Member";
              const state = /S$/.test(m.status) ? "Suspended" : /P$/.test(m.status) ? "Pending" : /D$/.test(m.status) ? "Deleted" : "Active";
              const img = m.profile ? (/^https?:/.test(m.profile) ? m.profile : AWS_UPLOADS + m.profile) : "";
              const joined = formatDate(m.datetime);
              const seen = formatDate(m.lastdatetime);
              const last = formatDate(m.lastActivity);
              const place = [m.address, m.city, m.state, m.pincode].filter(Boolean).join(", ");
              return (
                <>
                  <div className="ap-head">
                    <div className="ap-avatar">
                      {img ? <img src={img} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} /> : null}
                      <span>{String(m.name || "?").trim().charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <h3>{m.name || "—"}</h3>
                      <div className="ap-tags">
                        <span className="ap-tag ap-role">{role}</span>
                        <span className={"ap-tag " + (state === "Active" ? "ap-ok" : "ap-warn")}>{state}</span>
                      </div>
                    </div>
                  </div>

                  <div className="ap-stats">
                    <div><b>{m.activityCount ?? 0}</b><small>Activities logged</small></div>
                    <div><b>{m.activeSessions ?? 0}</b><small>Active sign-ins</small></div>
                    <div><b>{base === "Y" ? (m.pages == null ? "All" : m.pages) : base === "X" ? "All" : "—"}</b><small>Panel pages</small></div>
                  </div>

                  <dl className="ap-list">
                    <div><dt><Mail size={14} /> Email</dt><dd>{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : "—"}</dd></div>
                    <div><dt><Phone size={14} /> Phone</dt><dd>{m.number ? <a href={`tel:${m.number}`}>{m.number}</a> : "—"}</dd></div>
                    {m.gender && <div><dt><User size={14} /> Gender</dt><dd>{m.gender === "1" ? "Male" : m.gender === "2" ? "Female" : m.gender}</dd></div>}
                    {place && <div><dt><MapPin size={14} /> Address</dt><dd>{place}</dd></div>}
                    {m.qualification && <div><dt><GraduationCap size={14} /> Qualification</dt><dd>{m.qualification}</dd></div>}
                    {m.courses?.length > 0 && <div><dt><GraduationCap size={14} /> Courses</dt><dd>{m.courses.join(", ")}</dd></div>}
                    <div><dt><Clock size={14} /> Joined</dt><dd>{joined.date} {joined.time}</dd></div>
                    <div><dt><KeyRound size={14} /> Last sign-in</dt><dd>{seen.date} {seen.time}</dd></div>
                    <div><dt><ActivityIcon size={14} /> Last activity</dt><dd>{last.date} {last.time}</dd></div>
                    <div><dt><Shield size={14} /> Member ID</dt><dd className="ap-mono">{m.mem_id}</dd></div>
                  </dl>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===== Activity info popup (Info column) ===== */}
      {infoRow && (() => {
        const dt = formatDate(infoRow.datetime);
        return (
          <div className="ap-overlay" onMouseDown={() => setInfoRow(null)}>
            <div className="ap-modal" role="dialog" aria-modal="true" aria-label="Activity details" onMouseDown={(e) => e.stopPropagation()}>
              <button type="button" className="ap-close" onClick={() => setInfoRow(null)} aria-label="Close"><X size={18} /></button>
              <div className="ap-head ap-head-plain">
                <div className="ap-avatar ap-avatar-icon"><ActivityIcon size={22} /></div>
                <div>
                  <h3>Activity #{infoRow.id}</h3>
                  <div className="ap-tags"><span className="ap-tag ap-role">{infoRow.ntable || "—"}</span></div>
                </div>
              </div>
              <p className="ap-info-text">{infoRow.info || "—"}</p>
              <dl className="ap-list">
                {isSuper && (
                  <div>
                    <dt><Shield size={14} /> Done by</dt>
                    <dd>
                      <button type="button" className="ap-link" onClick={() => { const id = infoRow.mem_id; setInfoRow(null); openProfile(id); }}>
                        {infoRow.actor || infoRow.mem_id || "—"}
                      </button>
                    </dd>
                  </div>
                )}
                <div><dt><Clock size={14} /> Date &amp; time</dt><dd>{dt.date} {dt.time}</dd></div>
                <div><dt><Layers size={14} /> Section</dt><dd>{infoRow.ntable || "—"}</dd></div>
                <div><dt><KeyRound size={14} /> Record ID</dt><dd className="ap-mono">{infoRow.to_id || "—"}</dd></div>
              </dl>
              {(infoRow.fromtxt || infoRow.totxt) && (
                <div className="ap-change">
                  <div><small>Before</small><pre>{infoRow.fromtxt || "—"}</pre></div>
                  <div><small>After</small><pre>{infoRow.totxt || "—"}</pre></div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
