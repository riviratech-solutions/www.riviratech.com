import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminPerms, can, pagePath } from "../utils/adminPermissions";

/* Dashboard card for Admin (Y) accounts: the pages a super admin gave them and
   what they may do on each. Super admins don't see it (they have everything). */
export default function AdminAccessCard() {
  const perms = useAdminPerms();
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem("kkr_access_card") !== "closed"; } catch { return true; }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem("kkr_access_card", next ? "open" : "closed"); } catch { /* ignore */ }
  };

  if (!perms.loaded || perms.role !== "Y") return null;

  const allPages = perms.catalogue.flatMap((g) => g.pages);
  const label = (key: string) => (allPages.find((p) => p.key === key)?.label || key).replace(/ \(.*\)$/, "");

  if (perms.full) {
    return (
      <div className="ad-access-card">
        <div className="ad-access-head">
          <div>
            <h5>🔐 Your access</h5>
            <small>Full access to all {allPages.length} pages — no page permissions have been set for your account yet.</small>
          </div>
        </div>
      </div>
    );
  }

  const groups = perms.catalogue
    .map((g) => ({ group: g.group, pages: g.pages.filter((p) => can(perms, p.key, "view")) }))
    .filter((g) => g.pages.length);
  const count = groups.reduce((n, g) => n + g.pages.length, 0);

  return (
    <div className="ad-access-card">
      <div className="ad-access-head">
        <div>
          <h5>🔐 Your access</h5>
          <small>
            {count ? `You can open ${count} of ${allPages.length} panel pages.` : "No pages have been given to your account yet."}{" "}
            Ask a super admin if you need more.
          </small>
        </div>
        {count > 0 && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={toggle} aria-expanded={open}>
            {open ? "Hide" : "Show"} details
          </button>
        )}
      </div>

      {open && count > 0 && (
        <div className="ad-access-grid">
          {groups.map((g) => (
            <div key={g.group} className="ad-access-group">
              <h6>{g.group}</h6>
              {g.pages.map((p) => {
                const allowed = p.actions.filter((a) => can(perms, p.key, a.key));
                const tag = allowed.length === p.actions.length
                  ? (p.actions.length > 1 ? "Full access" : "")
                  : allowed.length === 1 ? "View only" : "";
                return (
                  <div key={p.key} className="ad-access-page">
                    <div className="ad-access-title">
                      <Link to={pagePath(p.key)}>{label(p.key)}</Link>
                      {p.parent && <small> · inside {label(p.parent)}</small>}
                      {tag && <span className={"ad-access-tag" + (tag === "Full access" ? " full" : "")}>{tag}</span>}
                    </div>
                    {!tag && (
                      <div className="ad-access-acts">
                        {allowed.map((a) => <span key={a.key}>{a.label}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
