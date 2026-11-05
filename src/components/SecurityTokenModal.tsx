import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, KeyRound, AlertCircle, Lock } from "lucide-react";
import { ButtonLoader } from "./loading";

/* Asks for the admin security token (BACKUP_SECURITY_TOKEN on the server).
   The panel never knows the token — onSubmit sends it to the API, which
   checks it and answers with an error message or null for success. */
interface Props {
  open: boolean;
  subtitle: string;
  message: ReactNode;
  note?: string;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  danger?: boolean;
  onSubmit: (token: string) => Promise<string | null>;
  onClose: () => void;
}

export default function SecurityTokenModal({
  open, subtitle, message, note, confirmLabel, confirmIcon, danger, onSubmit, onClose,
}: Props) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setToken(""); setError(""); setBusy(false); }
  }, [open]);

  if (!open) return null;

  const accent = danger ? "#dc2626" : "var(--ad-brand)";
  const close = () => { if (!busy) onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) { setError("Enter the security token."); return; }
    setBusy(true);
    try {
      const err = await onSubmit(token.trim());
      if (err) setError(err);
    } catch {
      setError("Something went wrong, please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal fade show"
      style={{ display: "block", backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)", zIndex: 1050 }}
      tabIndex={-1}
      role="dialog"
      onClick={close}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "460px" }} role="document" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: "20px", border: "none", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
          <div
            className="modal-header"
            style={{
              background: danger ? "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)" : "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
              borderBottom: "1px solid #e2e8f0",
              padding: "18px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h5 className="modal-title" style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Security Authorization
                </h5>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>{subtitle}</span>
              </div>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={close} />
          </div>

          <form onSubmit={submit}>
            <div className="modal-body" style={{ padding: "24px" }}>
              <div style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>{message}</div>

              <div style={{ marginBottom: note ? 16 : 0 }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>
                  Security Token *
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: error ? "1.5px solid #ef4444" : "1.5px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    background: "#fff",
                    gap: "8px",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <KeyRound size={17} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <input
                    type="password"
                    autoFocus
                    autoComplete="off"
                    placeholder="Paste security token here…"
                    value={token}
                    disabled={busy}
                    onChange={(e) => { setToken(e.target.value); if (error) setError(""); }}
                    style={{ border: "none", outline: "none", width: "100%", fontSize: "13.5px", fontFamily: "monospace", color: "#0f172a", background: "transparent" }}
                  />
                </div>
                {error && (
                  <div style={{ color: "#ef4444", fontSize: "12.5px", fontWeight: 500, marginTop: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <AlertCircle size={14} />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {note && (
                <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Lock size={13} style={{ color: accent, flexShrink: 0 }} />
                  <span>{note}</span>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "#475569", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                style={{
                  background: accent,
                  border: "1.5px solid " + accent,
                  color: "#fff",
                  borderRadius: "10px",
                  padding: "8px 18px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.75 : 1,
                }}
              >
                {confirmIcon}
                {busy ? <ButtonLoader label="Checking…" /> : confirmLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
