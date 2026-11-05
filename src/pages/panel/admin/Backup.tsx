import { useEffect, useState, useMemo } from "react";
import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getSeoByPath } from "../../../utils/seo";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Database,
  Download,
  RotateCw,
  Layers,
  FileCode,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import SecurityTokenModal from "../../../components/SecurityTokenModal";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

interface TableInfo {
  name: string;
  rows: number;
}

export default function Backup() {
  const permCan = usePagePerm("backup");
  const navigate = useNavigate();

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");

  // Security token (BACKUP_SECURITY_TOKEN on the server), asked once per page
  // visit and sent with every download — the API checks it each time.
  const [secToken, setSecToken] = useState("");
  const tokenVerified = secToken !== "";
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    { type: "all" } | { type: "table"; name: string; format: string } | null
  >(null);

  const handleDownloadTable = (name: string, format: string) => {
    if (tokenVerified) {
      downloadTable(name, format, secToken);
    } else {
      setPendingAction({ type: "table", name, format });
      setModalOpen(true);
    }
  };

  const handleDownloadAll = () => {
    if (tokenVerified) {
      downloadAll(secToken);
    } else {
      setPendingAction({ type: "all" });
      setModalOpen(true);
    }
  };

  const verifyAndProceed = async (token: string): Promise<string | null> => {
    const s = await getSecurity();
    const res = await axios.post(
      SERVER_URL + "api/backup/verify-token",
      { security_token: token, key: s.key, token: s.token, aut: s.aut },
      { withCredentials: true },
    );
    if (!res.data.success) return res.data.message || "Invalid security token.";

    setSecToken(token);
    setModalOpen(false);
    toast.success("Security token verified");
    if (pendingAction?.type === "all") {
      downloadAll(token);
    } else if (pendingAction?.type === "table") {
      downloadTable(pendingAction.name, pendingAction.format, token);
    }
    setPendingAction(null);
    return null;
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingAction(null);
  };

  // a 403 means the token stopped working (changed in .env, or locked out)
  const failed = async (err: any, fallback: string) => {
    if (err?.response?.status === 403) {
      setSecToken("");
      let msg = "Security token was not accepted";
      try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch { /* keep default */ }
      toast.error(msg);
    } else {
      toast.error(fallback);
    }
  };

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/backup/tables", {});
      if (res.data.success) setTables(res.data.tables || []);
      else toast.error(res.data.message || "Failed to load tables");
    } catch {
      toast.error("Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  const fileNameFrom = (headers: any, fallback: string) => {
    const cd = headers?.["content-disposition"] || "";
    const m = /filename="?([^"]+)"?/.exec(cd);
    return m ? m[1] : fallback;
  };

  const downloadTable = async (name: string, format: string, secTok: string) => {
    const id = name + ":" + format;
    setBusy(id);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/backup/table",
        { name, format, security_token: secTok, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true, responseType: "blob" },
      );
      saveAs(res.data, fileNameFrom(res.headers, `${name}.${format}`));
    } catch (err) {
      failed(err, `Failed to export ${name}`);
    } finally {
      setBusy("");
    }
  };

  const downloadAll = async (secTok: string) => {
    setBusy("__all__");
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/backup/all-sql",
        { security_token: secTok, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true, responseType: "blob" },
      );
      saveAs(res.data, fileNameFrom(res.headers, "full_backup.sql"));
      toast.success("Full backup downloaded");
    } catch (err) {
      failed(err, "Backup failed");
    } finally {
      setBusy("");
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
    if (data.loggedIn) {
      loadTables();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();
  }, []);

  const totalRows = tables.reduce((a, t) => a + (t.rows || 0), 0);
  const formats = ["json", "csv", "sql"];

  const filteredTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [tables, search]);

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
      `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper">
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Database size={24} />
              </div>
              <div>
                <div className="si-header-title-row">
                  <h3 className="si-header-title">Database Backup</h3>
                  <span className="si-total-badge">
                    Total <b>{tables.length}</b> Tables
                  </span>
                </div>
                <p className="si-header-subtitle">
                  Download each database table as JSON, CSV or SQL — or export
                  the entire database as a single SQL dump.
                </p>
              </div>
            </div>
            <div className="si-header-right">
              {tokenVerified && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#ecfdf5",
                    color: "#059669",
                    border: "1px solid #a7f3d0",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={15} />
                  Token Verified
                </span>
              )}
              {permCan("download") && (
                <button
                  className="si-btn-primary"
                  onClick={handleDownloadAll}
                  disabled={busy === "__all__"}
                >
                  <Download size={16} />
                  {busy === "__all__" ? <ButtonLoader label="Preparing Dump…" /> : "Full SQL Backup"}
                </button>
              )}
            </div>
          </div>

          {/* Stats KPI Grid */}
          <div className="si-stats-grid">
            <div className="si-stat-card">
              <div className="si-stat-icon-wrapper purple">
                <Layers size={20} />
              </div>
              <div className="si-stat-content">
                <span className="si-stat-label">Total Tables</span>
                <h4 className="si-stat-value"><AnimatedNumber value={tables.length} pending={loading} id="Backup-s1" /></h4>
              </div>
            </div>

            <div className="si-stat-card">
              <div className="si-stat-icon-wrapper blue">
                <HardDrive size={20} />
              </div>
              <div className="si-stat-content">
                <span className="si-stat-label">Total Database Rows</span>
                <h4 className="si-stat-value"><AnimatedNumber value={totalRows.toLocaleString()} pending={loading} id="Backup-s2" /></h4>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <ListSearch
              placeholder="Search database tables…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="ms-auto d-flex align-items-center gap-2">
              <button data-refresh
                className="reload-btn"
                title="Refresh tables"
                onClick={loadTables}
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
                    <th className="si-th">Table Name</th>
                    <th className="si-th" style={{ width: 160 }}>
                      Row Count
                    </th>
                    <th className="si-th text-end" style={{ width: 300 }}>
                      Export Formats
                    </th>
                  </tr>
                </thead>
                <tbody className="si-tbody">
                  {loading ? (
                    <SkeletonRows />
                  ) : filteredTables.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-muted">
                        {search
                          ? "No tables match your search."
                          : "No tables found."}
                      </td>
                    </tr>
                  ) : (
                    filteredTables.map((t, i) => (
                      <tr key={t.name} className="si-tr">
                        <td
                          className="si-td text-muted fw-semibold"
                          style={{ fontSize: "13px" }}
                        >
                          {i + 1}
                        </td>
                        <td className="si-td">
                          <div className="d-flex align-items-center gap-2">
                            <FileCode size={16} className="text-muted" />
                            <code
                              style={{
                                fontSize: "13.5px",
                                fontWeight: 600,
                                color: "#1e293b",
                                background: "#f8fafc",
                                padding: "3px 8px",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              {t.name}
                            </code>
                          </div>
                        </td>
                        <td className="si-td">
                          <span
                            className="si-status-pill"
                            style={{
                              background: t.rows > 0 ? "#eef2ff" : "#f1f5f9",
                              color: t.rows > 0 ? "var(--ad-brand-2)" : "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            {t.rows.toLocaleString()} rows
                          </span>
                        </td>
                        <td className="si-td text-end">
                          <div className="d-inline-flex align-items-center gap-1">
                            {formats.map((fmt) =>
                              permCan("download") ? (
                                <button
                                  key={fmt}
                                  className="btn btn-sm"
                                  style={{
                                    border: "1px solid #e2e8f0",
                                    background: "#fff",
                                    color: "#475569",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    borderRadius: "8px",
                                    padding: "4px 10px",
                                    transition: "all 0.15s ease",
                                  }}
                                  disabled={
                                    busy === t.name + ":" + fmt || t.rows === 0
                                  }
                                  title={
                                    t.rows === 0
                                      ? "No rows to export"
                                      : `Download ${t.name}.${fmt}`
                                  }
                                  onClick={() => handleDownloadTable(t.name, fmt)}
                                >
                                  {busy === t.name + ":" + fmt ? (
                                    "…"
                                  ) : (
                                    <>
                                      <Download size={11} className="me-1" />
                                      {fmt.toUpperCase()}
                                    </>
                                  )}
                                </button>
                              ) : null,
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/backup/tables" />
            </div>

            <div className="si-table-footer">
              <div className="si-table-info">
                Showing {filteredTables.length} of {tables.length} tables
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Token Verification Modal */}
      <SecurityTokenModal
        open={modalOpen}
        subtitle="Token verification required for backup download"
        message="Please enter the authorization security token to download database backups."
        note="Token is asked once per visit to this page for security."
        confirmLabel="Verify & Download"
        confirmIcon={<Download size={15} />}
        onSubmit={verifyAndProceed}
        onClose={closeModal}
      />
    </>
  );
}
