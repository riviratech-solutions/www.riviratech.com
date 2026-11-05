import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Bell, ChevronLeft, Menu as MenuIcon, Moon, Search, Sun, X } from "lucide-react";
import { SERVER_URL } from "./Includes";
import { useAdminPerms, can, isGatedPage, pageKeyFromPath } from "../utils/adminPermissions";
import { clearCachedUser, roleLabel, useCurrentUser } from "../utils/currentUser";
import { AnimatedNumber } from "./loading";

/* Panel header: sidebar toggle, global search, notifications, light/dark
   switch and the signed-in user's menu. Admin-only parts (record search,
   notifications) use cookie-only GETs so they never consume the page's
   one-time security tokens. */

type Props = { onToggleSidebar: () => void; dark: boolean; onToggleTheme: () => void; collapsed?: boolean };
type Hit = { title: string; sub?: string; link: string };
type Group = { key: string; label: string; items: Hit[] };
type Notice = { key: string; label: string; link: string; count: number };

// close a popover on an outside click / tap, or on Esc
function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
}

export default function PanelTopbar({ onToggleSidebar, dark, onToggleTheme, collapsed = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const perms = useAdminPerms();
  const user = useCurrentUser();

  // role from the session (also signs out a visitor who isn't logged in)
  const [status, setStatus] = useState(user?.status || "");
  useEffect(() => {
    axios.get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => { if (res.data.loggedIn) setStatus(res.data.id); else navigate("/logout"); })
      .catch(() => { /* offline: keep what we have */ });
  }, []);
  const isAdmin = status === "X" || status === "Y";
  const portal = isAdmin ? "Admin" : status === "2" ? "Trainer" : status === "1" ? "Student" : "";
  const displayName = user?.name || "…";
  const displayRole = user?.role || roleLabel(user?.status || status) || "";
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  /* ---------------- profile menu ---------------- */
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useDismiss(profileRef, menuOpen, () => setMenuOpen(false));

  const logout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try { await axios.post(SERVER_URL + "api/logout", {}, { withCredentials: true }); } catch { /* ignore */ }
    clearCachedUser();
    navigate("/signin");
  };

  /* ---------------- notifications ---------------- */
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeTotal, setNoticeTotal] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  useDismiss(bellRef, bellOpen, () => setBellOpen(false));

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    const load = () => axios.get(SERVER_URL + "api/panel-notifications", { withCredentials: true })
      .then((res) => { if (live && res.data?.success) { setNotices(res.data.items || []); setNoticeTotal(res.data.total || 0); } })
      .catch(() => { /* keep the last counts */ });
    load();
    const timer = setInterval(load, 60000);
    return () => { live = false; clearInterval(timer); };
  }, [isAdmin, location.pathname]);

  /* ---------------- search ---------------- */
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useDismiss(searchRef, searchOpen, () => setSearchOpen(false));

  // Ctrl/Cmd + K focuses the search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); setSearchOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // panel pages matching the text — taken from the sidebar links this account can open
  const pageHits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const seen = new Set<string>();
    const out: Hit[] = [];
    document.querySelectorAll<HTMLAnchorElement>(".sidebar a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const title = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!title || !href.startsWith("/") || seen.has(href) || !title.toLowerCase().includes(term)) return;
      if (perms.role === "Y" && !perms.full) {
        const key = pageKeyFromPath(href);
        if (isGatedPage(perms, key) && !can(perms, key, "view")) return;
      }
      seen.add(href);
      out.push({ title, sub: "Page", link: href });
    });
    return out.slice(0, 6);
  }, [q, perms]);

  // records (admins): debounced, latest request wins
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (!isAdmin || term.length < 2) { setGroups([]); setSearching(false); return; }
    const mine = ++seq.current;
    setSearching(true);
    const t = setTimeout(() => {
      axios.get(SERVER_URL + "api/panel-search", { params: { q: term }, withCredentials: true })
        .then((res) => { if (mine === seq.current) setGroups(res.data?.groups || []); })
        .catch(() => { if (mine === seq.current) setGroups([]); })
        .finally(() => { if (mine === seq.current) setSearching(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, isAdmin]);

  const allGroups: Group[] = useMemo(
    () => (pageHits.length ? [{ key: "pages", label: "Pages", items: pageHits }] : []).concat(groups),
    [pageHits, groups]
  );
  const flat = useMemo(() => allGroups.flatMap((g) => g.items), [allGroups]);
  useEffect(() => { setActiveIdx(0); }, [q]);

  const go = (hit: Hit) => {
    setSearchOpen(false);
    setQ("");
    navigate(hit.link);
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && flat[activeIdx]) { e.preventDefault(); go(flat[activeIdx]); }
  };

  const showResults = searchOpen && q.trim().length > 0;
  let idx = -1;

  return (
    <div className="topbar ptb">
      <div className="ptb-left">
        <h5 className="ptb-brand">{portal ? `${portal} Portal` : "Portal"}</h5>
        {/* desktop: an arrow — points left to collapse the menu to icons, right to
            expand it; phones keep ☰, which opens the slide-over menu */}
        <button
          type="button"
          className={"ptb-icon ptb-menu-toggle" + (collapsed ? " is-collapsed" : "")}
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
          title={collapsed ? "Expand menu" : "Collapse menu"}
        >
          <ChevronLeft size={22} className="ptb-toggle-arrow" aria-hidden="true" />
          <MenuIcon size={22} className="ptb-toggle-burger" aria-hidden="true" />
        </button>

        <div className="ptb-search" ref={searchRef}>
          <Search size={18} className="ptb-search-ico" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            placeholder={isAdmin ? "Search students, courses, batches, or anything..." : "Search pages..."}
            onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={onSearchKey}
            aria-label="Search the panel"
          />
          {q && (
            <button type="button" className="ptb-search-clear" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
          <kbd className="ptb-kbd">Ctrl K</kbd>

          {showResults && (
            <div className="ptb-results" role="listbox">
              {allGroups.map((g) => (
                <div key={g.key} className="ptb-group">
                  <div className="ptb-group-title">{g.label}</div>
                  {g.items.map((h) => {
                    idx += 1;
                    const my = idx;
                    return (
                      <button type="button" key={g.key + h.link + h.title} role="option" aria-selected={my === activeIdx}
                        className={"ptb-hit" + (my === activeIdx ? " on" : "")}
                        onMouseEnter={() => setActiveIdx(my)} onClick={() => go(h)}>
                        <span className="t">{h.title}</span>
                        {h.sub && <span className="s">{h.sub}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
              {searching && <div className="ptb-empty">Searching…</div>}
              {!searching && allGroups.length === 0 && (
                <div className="ptb-empty">
                  {isAdmin && q.trim().length < 2 ? "Type at least 2 letters" : `No results for “${q.trim()}”`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ptb-right">
        {isAdmin && (
          <div className="ptb-pop" ref={bellRef}>
            <button type="button" className="ptb-icon" onClick={() => setBellOpen((o) => !o)}
              aria-label={`Notifications${noticeTotal ? ` (${noticeTotal})` : ""}`} title="Notifications">
              <Bell size={21} />
              {noticeTotal > 0 && <span className="ptb-badge">{noticeTotal > 99 ? "99+" : <AnimatedNumber value={noticeTotal} duration={600} />}</span>}
            </button>
            {bellOpen && (
              <div className="ptb-drop ptb-notes">
                <div className="ptb-drop-head">
                  <b>Notifications</b>
                  {noticeTotal > 0 && <span>{noticeTotal} waiting</span>}
                </div>
                {notices.length === 0 ? (
                  <div className="ptb-empty">You're all caught up 🎉</div>
                ) : notices.map((n) => (
                  <Link key={n.key} to={n.link} className="ptb-note" onClick={() => setBellOpen(false)}>
                    <span>{n.label}</span>
                    <b>{n.count}</b>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="button" style={{"display":"none"}} className="ptb-icon" onClick={onToggleTheme}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
          {dark ? <Sun size={21} /> : <Moon size={21} />}
        </button>

        <div className="profile-box" ref={profileRef}>
          <button className="profile-btn" onClick={() => setMenuOpen(!menuOpen)}>
            <span className="profile-avatar">{initial}</span>
            <span className="profile-name">
              <strong>{displayName}</strong>
              <small>{displayRole}</small>
            </span>
            <svg className={"caret" + (menuOpen ? " up" : "")} width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {menuOpen && (
            <div className="profile-dropdown">
              <div className="pd-head" style={{"display":"none"}}>
                <span className="profile-avatar big">{initial}</span>
                <div>
                  <strong>{displayName}</strong>
                  <small>{user?.email || displayRole}</small>
                </div>
              </div>

              <Link to="/panel/myprofile" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M4 20C4 16.5 7.5 14 12 14C16.5 14 20 16.5 20 20" stroke="currentColor" strokeWidth="2" />
                </svg>
                Personal details
              </Link>

              <Link to="/panel/myprofile?tab=update" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M19 12C19 11.5 18.95 11 18.86 10.55L20.5 9.3L18.5 5.85L16.6 6.65C15.85 6.05 15 5.55 14.05 5.3L13.75 3.25H9.75L9.45 5.3C8.5 5.55 7.65 6.05 6.9 6.65L5 5.85L3 9.3L4.64 10.55C4.55 11 4.5 11.5 4.5 12C4.5 12.5 4.55 13 4.64 13.45L3 14.7L5 18.15L6.9 17.35C7.65 17.95 8.5 18.45 9.45 18.7L9.75 20.75H13.75L14.05 18.7C15 18.45 15.85 17.95 16.6 17.35L18.5 18.15L20.5 14.7L18.86 13.45C18.95 13 19 12.5 19 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Profile settings
              </Link>

              <Link to="/panel/myprofile?tab=pwd" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10" stroke="currentColor" strokeWidth="2" />
                </svg>
                Password reset
              </Link>

              <Link to="/panel/my-sessions" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                My sessions
              </Link>

              <div className="pd-sep"></div>

              <a className="pd-logout" onClick={logout} href="/logout">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
