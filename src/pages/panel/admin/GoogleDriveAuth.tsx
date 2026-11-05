import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Cloud,
  CheckCircle2,
  XCircle,
  RotateCw,
  KeyRound,
  FolderCheck,
  Upload,
  Copy,
  Check,
  ExternalLink,
  HardDrive,
  ShieldCheck,
  Video,
} from "lucide-react";
import UploadProgress, { type UploadState } from "../../../components/UploadProgress";
import { ButtonLoader } from "../../../components/loading";

const seo = getSeoByPath("");

type DriveStatusData = {
  enabled: boolean;
  maxBytes: number;
  quotaOk: boolean;
  quotaMessage: string;
  isSharedDrive: boolean;
  folderName: string;
  folderId: string;
  saEmail: string;
  ownerEmail: string;
  limitBytes: number | null;
  usageBytes: number;
  remainingBytes: number | null;
  clientIdConfigured: boolean;
  clientIdPreview: string;
  hasRefreshToken: boolean;
  tokenPath: string;
  redirectUri: string;
};

export default function GoogleDriveAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DriveStatusData | null>(null);
  const [redirectUri, setRedirectUri] = useState(() => `${window.location.origin}/panel/google-drive`);
  const [copied, setCopied] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [exchanging, setExchanging] = useState(false);

  const [testingToken, setTestingToken] = useState(false);
  const [testingQuickUpload, setTestingQuickUpload] = useState(false);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [keepTestFile, setKeepTestFile] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [upState, setUpState] = useState<UploadState>(null);

  const [actionResult, setActionResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
    details?: any;
  } | null>(null);

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const fmtBytes = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "Unlimited";
    const n = Number(bytes) || 0;
    if (n >= 1024 ** 4) return (n / 1024 ** 4).toFixed(2) + " TB";
    if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + " GB";
    if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " MB";
    if (n >= 1024) return Math.round(n / 1024) + " KB";
    return n + " B";
  };

  const loadStatus = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const r = await axios.get(SERVER_URL + "api/class-drive-status", {
        withCredentials: true,
      });
      if (r.data?.success) {
        setStatus(r.data);
      }
    } catch {
      if (!quiet) toast.error("Could not load Google Drive status");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        const d = res.data || {};
        if (!(d.loggedIn && (d.id === "X" || d.id === "Y"))) {
          navigate("/logout");
        } else {
          setReady(true);
        }
      })
      .catch(() => navigate("/logout"));
  }, [navigate]);

  useEffect(() => {
    if (!ready) return;
    loadStatus();
  }, [ready]);

  // Handle OAuth redirect back to /panel/google-drive?code=...
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const err = params.get("error");
    const connected = params.get("connected");

    if (err) {
      setActionResult({
        ok: false,
        title: "Google OAuth Access Denied",
        message: err,
      });
      toast.error("Google Drive authorization was not granted: " + err);
      navigate("/panel/google-drive", { replace: true });
      return;
    }

    if (connected === "1") {
      setActionResult({
        ok: true,
        title: "Google Drive Connected",
        message: "OAuth refresh token saved to .secrets/google-drive-token.json and api/.env.",
      });
      toast.success("Google Drive connected and verified!");
      navigate("/panel/google-drive", { replace: true });
      loadStatus(true);
      return;
    }

    if (code) {
      const savedRedirect =
        sessionStorage.getItem("kkr_gdrive_redirect_uri") ||
        `${window.location.origin}/panel/google-drive`;
      navigate("/panel/google-drive", { replace: true });
      handleExchangeCode(code, savedRedirect);
    }
  }, [ready, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartOAuth = async () => {
    setAuthLoading(true);
    setActionResult(null);
    try {
      const s = await getSecurity();
      const targetRedirect = redirectUri.trim() || `${window.location.origin}/panel/google-drive`;
      sessionStorage.setItem("kkr_gdrive_redirect_uri", targetRedirect);
      const res = await axios.post(
        SERVER_URL + "api/google-drive/auth-url",
        {
          redirectUri: targetRedirect,
          key: s.key,
          token: s.token,
          aut: s.aut,
        },
        { withCredentials: true },
      );
      if (res.data?.success && res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        toast.error(res.data?.message || "Could not start Google OAuth");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to generate OAuth link");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExchangeCode = async (codeOrUrl: string, customRedirect?: string) => {
    const clean = codeOrUrl.trim();
    if (!clean) {
      toast.error("Please enter the authorization code or callback URL");
      return;
    }
    setExchanging(true);
    setActionResult(null);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/google-drive/exchange-code",
        {
          code: clean,
          redirectUri: (customRedirect || redirectUri).trim(),
          key: s.key,
          token: s.token,
          aut: s.aut,
        },
        { withCredentials: true },
      );
      if (res.data?.success) {
        setManualCode("");
        setActionResult({
          ok: true,
          title: "Google Drive Authorized & Verified",
          message: res.data.message || "Refresh token saved and 1-byte upload check passed.",
        });
        toast.success("Google Drive connected!");
        await loadStatus(true);
      } else {
        setActionResult({
          ok: false,
          title: "OAuth Code Exchange Failed",
          message: res.data?.message || "Could not exchange code.",
        });
        toast.error(res.data?.message || "Authorization failed");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Authorization failed";
      setActionResult({ ok: false, title: "OAuth Code Exchange Failed", message: msg });
      toast.error(msg);
    } finally {
      setExchanging(false);
    }
  };

  const handleTestRefreshToken = async () => {
    setTestingToken(true);
    setActionResult(null);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/google-drive/test-token",
        { key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (res.data?.success) {
        setActionResult({
          ok: true,
          title: "Refresh Token Check Passed",
          message: res.data.message,
        });
        toast.success("Fresh access token obtained!");
        await loadStatus(true);
      } else {
        setActionResult({
          ok: false,
          title: "Refresh Token Check Failed",
          message: res.data?.message || "Token refresh failed",
        });
        toast.error(res.data?.message || "Token refresh failed");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Token test failed");
    } finally {
      setTestingToken(false);
    }
  };

  const handleQuickUploadCheck = async () => {
    setTestingQuickUpload(true);
    setActionResult(null);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/google-drive/test-upload",
        { key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (res.data?.success) {
        setActionResult({
          ok: true,
          title: "1-Byte Drive Upload Check Passed",
          message: res.data.message,
          details: res.data.file,
        });
        toast.success("1-byte test file created and deleted in Drive!");
        await loadStatus(true);
      } else {
        setActionResult({
          ok: false,
          title: "Drive Upload Check Failed",
          message: res.data?.message || "Upload check failed",
        });
        toast.error(res.data?.message || "Upload check failed");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Upload check failed");
    } finally {
      setTestingQuickUpload(false);
    }
  };

  const handleFileUploadTest = async () => {
    if (!testFile) {
      toast.error("Please choose a file to test upload");
      return;
    }
    setUploadingFile(true);
    setActionResult(null);
    try {
      const s1 = await getSecurity();
      setUpState({
        label: `Uploading ${testFile.name}…`,
        loaded: 0,
        total: testFile.size,
        start: performance.now(),
      });
      const urlRes = await axios.post(
        SERVER_URL + "api/get-upload-url",
        {
          fileName: testFile.name,
          fileType: testFile.type || "application/octet-stream",
          key: s1.key,
          token: s1.token,
          aut: s1.aut,
        },
        { withCredentials: true },
      );
      if (!urlRes.data?.success || !urlRes.data.uploadURL) {
        throw new Error(urlRes.data?.message || "Could not start file upload");
      }
      await axios.put(urlRes.data.uploadURL, testFile, {
        headers: { "Content-Type": testFile.type || "application/octet-stream" },
        onUploadProgress: (e) =>
          setUpState((u) => (u ? { ...u, loaded: e.loaded, total: e.total || u.total } : u)),
      });

      setUpState((u) => (u ? { ...u, label: "Sending to Google Drive (resumable OAuth)…" } : u));
      const s2 = await getSecurity();
      const driveRes = await axios.post(
        SERVER_URL + "api/google-drive/test-upload",
        {
          tempKey: urlRes.data.key,
          fileName: testFile.name,
          keepFile: keepTestFile,
          key: s2.key,
          token: s2.token,
          aut: s2.aut,
        },
        { withCredentials: true },
      );
      if (driveRes.data?.success) {
        setActionResult({
          ok: true,
          title: "File Uploaded to Google Drive",
          message: driveRes.data.message,
          details: driveRes.data.file,
        });
        toast.success("File uploaded to Google Drive!");
        setTestFile(null);
        await loadStatus(true);
      } else {
        setActionResult({
          ok: false,
          title: "Google Drive Upload Failed",
          message: driveRes.data?.message || "Upload failed",
        });
        toast.error(driveRes.data?.message || "Upload failed");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Upload failed";
      setActionResult({ ok: false, title: "Google Drive Upload Failed", message: msg });
      toast.error(msg);
    } finally {
      setUpState(null);
      setUploadingFile(false);
    }
  };

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri.trim());
    setCopied(true);
    toast.success("Redirect URI copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const usagePct =
    status?.limitBytes && status.limitBytes > 0
      ? Math.min(100, Math.max(0.5, (status.usageBytes / status.limitBytes) * 100))
      : 0;

  return (
    <>
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
      <ToastContainer position="top-right" autoClose={2500} />

      <div className="content">
        <style>{`
          .gd-page { background: #f8fafc; min-height: calc(100vh - 80px); padding: 24px 28px; }
          @media (max-width: 576px) { .gd-page { padding: 16px; } }
          .gd-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
          .gd-header-left { display: flex; align-items: center; gap: 14px; }
          .gd-icon-box { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
          .gd-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
          .gd-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
          .gd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 20px; }
          .gd-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04); }
          .gd-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
          .gd-card-title { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
          .gd-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
          .gd-badge-ok { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
          .gd-badge-err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
          .gd-kv-list { display: flex; flex-direction: column; gap: 10px; font-size: 13.5px; }
          .gd-kv-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; }
          .gd-kv-key { color: #64748b; font-weight: 500; }
          .gd-kv-val { color: #0f172a; font-weight: 600; word-break: break-all; text-align: right; }
          .gd-quota-box { margin-top: 16px; padding: 14px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
          .gd-quota-bar { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; margin: 10px 0 8px; }
          .gd-quota-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #10b981); border-radius: 999px; transition: width 0.3s ease; }
          .gd-input-group { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
          .gd-input { width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 13px; color: #0f172a; background: #fff; }
          .gd-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 9px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s ease; text-decoration: none; }
          .gd-btn:disabled { opacity: 0.6; cursor: not-allowed; }
          .gd-btn-primary { background: #2563eb; color: #fff; }
          .gd-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
          .gd-btn-outline { background: #fff; color: #0f172a; border-color: #cbd5e1; }
          .gd-btn-outline:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
          .gd-alert { padding: 14px 18px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 12px; font-size: 13.5px; }
          .gd-alert-ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
          .gd-alert-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
        `}</style>

        <div className="gd-page">
          <div className="gd-header">
            <div className="gd-header-left">
              <div className="gd-icon-box">
                <Cloud size={24} />
              </div>
              <div>
                <h1 className="gd-title">Google Drive Storage &amp; OAuth Setup</h1>
                <p className="gd-subtitle">
                  Authorize Google Drive, verify refresh tokens, and test resumable uploads directly from the Admin Panel (no separate host or port required).
                </p>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <Link to="/panel/live-classes" className="gd-btn gd-btn-outline">
                <Video size={16} />
                Live Classes
              </Link>
              <button
                type="button"
                className="gd-btn gd-btn-outline"
                onClick={() => loadStatus()}
                disabled={loading}
              >
                <RotateCw size={16} className={loading ? "spin" : ""} />
                Refresh Status
              </button>
            </div>
          </div>

          {actionResult && (
            <div className={`gd-alert ${actionResult.ok ? "gd-alert-ok" : "gd-alert-err"}`}>
              {actionResult.ok ? (
                <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <XCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{actionResult.title}</div>
                <div>{actionResult.message}</div>
                {actionResult.details && (
                  <pre
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.65)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(actionResult.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          <div className="gd-grid">
            {/* 1. Connection & Storage Quota Card */}
            <div className="gd-card">
              <div className="gd-card-head">
                <h2 className="gd-card-title">
                  <HardDrive size={18} color="#2563eb" />
                  Drive Connection &amp; Quota
                </h2>
                {status?.quotaOk ? (
                  <span className="gd-badge gd-badge-ok">
                    <CheckCircle2 size={14} /> Connected &amp; Ready
                  </span>
                ) : (
                  <span className="gd-badge gd-badge-err">
                    <XCircle size={14} /> Needs Authorization
                  </span>
                )}
              </div>

              <div className="gd-kv-list">
                <div className="gd-kv-row">
                  <span className="gd-kv-key">Authorized Account</span>
                  <span className="gd-kv-val">{status?.saEmail || "Not connected"}</span>
                </div>
                <div className="gd-kv-row">
                  <span className="gd-kv-key">Drive Folder</span>
                  <span className="gd-kv-val">
                    {status?.folderName ? `${status.folderName} (${status.folderId})` : status?.folderId || "—"}
                  </span>
                </div>
                <div className="gd-kv-row">
                  <span className="gd-kv-key">Token File (`GOOGLE_DRIVE_TOKEN_PATH`)</span>
                  <span className="gd-kv-val">
                    {status?.tokenPath || "./.secrets/google-drive-token.json"}{" "}
                    {status?.hasRefreshToken ? "✅" : "⚠️ Missing"}
                  </span>
                </div>
                <div className="gd-kv-row">
                  <span className="gd-kv-key">Max Video Upload Limit</span>
                  <span className="gd-kv-val">{fmtBytes(status?.maxBytes || 5368709120)}</span>
                </div>
              </div>

              {status?.quotaOk ? (
                <div className="gd-quota-box">
                  <div className="d-flex justify-content-between align-items-center" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>Google Drive Storage Usage</span>
                    <span style={{ fontWeight: 600, color: "#2563eb" }}>
                      {fmtBytes(status.usageBytes)} used of {fmtBytes(status.limitBytes)}
                    </span>
                  </div>
                  <div className="gd-quota-bar">
                    <div className="gd-quota-fill" style={{ width: `${usagePct}%` }} />
                  </div>
                  <div className="d-flex justify-content-between text-muted" style={{ fontSize: 12 }}>
                    <span>Available: {fmtBytes(status.remainingBytes)}</span>
                    <span>Private backend streaming enabled</span>
                  </div>
                </div>
              ) : (
                status?.quotaMessage && (
                  <div className="gd-alert gd-alert-err mt-3 mb-0">
                    <XCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>{status.quotaMessage}</div>
                  </div>
                )
              )}
            </div>

            {/* 2. One-Click OAuth Sign-In Card (replaces test/drive-auth.js) */}
            <div className="gd-card">
              <div className="gd-card-head">
                <h2 className="gd-card-title">
                  <KeyRound size={18} color="#2563eb" />
                  OAuth 2.0 Sign-In (Admin Panel)
                </h2>
                <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>
                  Replaces test/drive-auth.js
                </span>
              </div>

              <p style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
                Sign in with the Google account that owns your Drive folder (<b>weorganize.ai@gmail.com</b>).
                Instead of opening a separate port, Google redirects right back to this Admin Panel page and saves the refresh token to{" "}
                <code>.secrets/google-drive-token.json</code> and <code>api/.env</code>.
              </p>

              <div className="mb-3">
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                  Authorized Redirect URI (add this in Google Cloud Console → OAuth Client)
                </label>
                <div className="gd-input-group">
                  <input
                    type="text"
                    className="gd-input"
                    value={redirectUri}
                    onChange={(e) => setRedirectUri(e.target.value)}
                  />
                  <button
                    type="button"
                    className="gd-btn gd-btn-outline"
                    onClick={copyRedirectUri}
                    title="Copy Redirect URI"
                  >
                    {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="d-flex gap-2 flex-wrap mb-3">
                <button
                  type="button"
                  className="gd-btn gd-btn-primary"
                  onClick={handleStartOAuth}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <ButtonLoader label="Opening Google Sign-In…" />
                  ) : (
                    <>
                      <ExternalLink size={16} />
                      Sign in with Google &amp; Authorize Drive
                    </>
                  )}
                </button>
              </div>

              <details style={{ marginTop: 12, fontSize: 13 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, color: "#475569" }}>
                  Have an authorization code or callback URL to paste manually?
                </summary>
                <div className="mt-2">
                  <div className="gd-input-group">
                    <input
                      type="text"
                      className="gd-input"
                      placeholder="Paste ?code=... or full callback URL here"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                    />
                    <button
                      type="button"
                      className="gd-btn gd-btn-primary"
                      disabled={exchanging || !manualCode.trim()}
                      onClick={() => handleExchangeCode(manualCode)}
                    >
                      {exchanging ? <ButtonLoader label="Saving…" /> : "Save Token"}
                    </button>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* 3. Test Refresh Token & Resumable Upload Card (replaces test-refresh-token.js & upload-to-drive-oauth.js) */}
          <div className="gd-card">
            <div className="gd-card-head">
              <h2 className="gd-card-title">
                <ShieldCheck size={18} color="#2563eb" />
                Verify Token &amp; Test Resumable Drive Upload
              </h2>
              <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>
                Replaces test-refresh-token.js &amp; upload-to-drive-oauth.js
              </span>
            </div>

            <div className="gd-grid" style={{ marginBottom: 0 }}>
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                  1. Automated Token &amp; Folder Checks
                </h3>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
                  Verify that your saved refresh token in <code>.secrets/google-drive-token.json</code> obtains a fresh access token without interactive login, and test creating a 1-byte file in your Drive folder.
                </p>
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="gd-btn gd-btn-outline"
                    onClick={handleTestRefreshToken}
                    disabled={testingToken}
                  >
                    {testingToken ? (
                      <ButtonLoader label="Testing Token…" />
                    ) : (
                      <>
                        <KeyRound size={16} />
                        Test Refresh Token
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="gd-btn gd-btn-outline"
                    onClick={handleQuickUploadCheck}
                    disabled={testingQuickUpload}
                  >
                    {testingQuickUpload ? (
                      <ButtonLoader label="Checking Upload…" />
                    ) : (
                      <>
                        <FolderCheck size={16} />
                        Run 1-Byte Upload &amp; Delete Check
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                  2. Test File Upload to Google Drive (`drive.files.create` resumable)
                </h3>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                  Select a PDF, document, or video file to test uploading directly into your configured Google Drive folder (<code>{status?.folderName || "riviratech"}</code>).
                </p>
                <div className="gd-input-group mb-2">
                  <input
                    type="file"
                    className="gd-input"
                    onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    className="gd-btn gd-btn-primary"
                    onClick={handleFileUploadTest}
                    disabled={uploadingFile || !testFile}
                  >
                    {uploadingFile ? (
                      <ButtonLoader label="Uploading…" />
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload to Drive
                      </>
                    )}
                  </button>
                </div>
                <label className="d-flex align-items-center gap-2" style={{ fontSize: 12.5, color: "#475569", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={keepTestFile}
                    onChange={(e) => setKeepTestFile(e.target.checked)}
                  />
                  Keep uploaded file in Google Drive folder (uncheck to trash immediately after upload check)
                </label>
                <UploadProgress up={upState} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
