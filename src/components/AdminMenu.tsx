import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import axios from "axios";
import { SERVER_URL, CHATBOT_URL } from "./Includes";
import { EMAIL_ERROR, isValidEmail } from "../utils/validateEmail";
import { OPEN_REFER, REFER_ADDED } from "../utils/referEvents";
import AdminAccessCard from "./AdminAccessCard";
import PanelTopbar from "./PanelTopbar";
import { ButtonLoader, PageLoader } from "./loading";
import RailFlyout from "./RailFlyout";
import {
  AdminPermsContext,
  EMPTY_PERMS,
  useAdminPerms,
  can,
  isGatedPage,
  pageKeyFromPath,
  pagePath,
  type AdminPerms,
} from "../utils/adminPermissions";

export function AdminLayout() {
  const location = useLocation();
  const [perms, setPerms] = useState<AdminPerms>(EMPTY_PERMS);

  // The signed-in adminer's page permissions. Re-read on every navigation so a
  // change a super admin makes shows up without signing out (cookie-only GET,
  // so it never consumes the page's one-time security token).
  useEffect(() => {
    let live = true;
    axios
      .get(SERVER_URL + "api/my-permissions", { withCredentials: true })
      .then((res) => {
        if (!live) return;
        const d = res.data || {};
        setPerms(
          d.success
            ? {
                loaded: true,
                role: d.role,
                full: !!d.full,
                permissions: d.permissions || {},
                catalogue: d.catalogue || [],
              }
            : { ...EMPTY_PERMS, loaded: true },
        );
      })
      .catch(() => {
        if (live)
          setPerms((p) => (p.loaded ? p : { ...EMPTY_PERMS, loaded: true }));
      });
    return () => {
      live = false;
    };
  }, [location.pathname]);

  // Sidebar: collapsed on desktop (remembered), slide-over on phones (closes
  // on navigation). Theme: light / dark for the whole panel (remembered).
  const readPref = (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const writePref = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  };
  const [collapsed, setCollapsed] = useState(
    () => readPref("kkr_sidebar") === "collapsed",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(
    () => readPref("kkr_panel_theme") === "dark",
  );
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      setMobileOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      writePref("kkr_sidebar", c ? "open" : "collapsed");
      return !c;
    });
  };
  // Icon rail (collapsed sidebar): every entry shows only its icon, so give each
  // one its label as a tooltip (labels are plain text in the menu markup).
  useEffect(() => {
    if (!collapsed) return;
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>(".sidebar li").forEach((li) => {
        // the label text only: not the section emoji or the ▾ caret
        const label = [...li.childNodes, ...[...li.querySelectorAll("a, p")].flatMap((el) => [...el.childNodes])]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (!label) return;
        if (!li.title) li.title = label;
        const a = li.querySelector("a");
        if (a && !a.getAttribute("aria-label")) a.setAttribute("aria-label", label);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [collapsed, location.pathname, perms.loaded]);

  // pages an Admin (Y) account may not open stay out of the rail's submenu
  const canOpen = useCallback(
    (href: string) => {
      if (!href.startsWith("/") || perms.role !== "Y" || perms.full) return true;
      const key = pageKeyFromPath(href);
      return !isGatedPage(perms, key) || can(perms, key, "view");
    },
    [perms],
  );

  const toggleTheme = () =>
    setDark((d) => {
      writePref("kkr_panel_theme", d ? "light" : "dark");
      return !d;
    });

  return (
    <AdminPermsContext.Provider value={perms}>
      <div
        className={
          "dashboard-wrapper" +
          (collapsed ? " sidebar-collapsed" : "") +
          (mobileOpen ? " sidebar-open" : "") +
          (dark ? " panel-dark" : "")
        }
        data-bs-theme={dark ? "dark" : "light"}
      >
        <PageLoader />
        <PanelTopbar
          onToggleSidebar={toggleSidebar}
          dark={dark}
          onToggleTheme={toggleTheme}
          collapsed={collapsed}
        />
        <div className="d-flex">
          <Menu />
          {/* icon rail: a section tile opens its pages beside the rail */}
          <RailFlyout enabled={collapsed} canOpen={canOpen} />
          {mobileOpen && (
            <div
              className="sidebar-backdrop"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
          )}
          {perms.loaded ? <PageGuard /> : <div className="content" />}
        </div>
      </div>
    </AdminPermsContext.Provider>
  );
}

/* Admin (Y) accounts only see the pages a super admin allowed. The API enforces
   the same rules, so this is just the friendly front of it. */
function PageGuard() {
  const perms = useAdminPerms();
  const { pathname } = useLocation();
  const page = pageKeyFromPath(pathname);

  if (perms.role !== "Y" || perms.full || !isGatedPage(perms, page))
    return <Outlet />;

  // No dashboard analytics: still greet them with what they can use.
  if (page === "dashboard" && !can(perms, page, "view")) {
    return (
      <div className="content p-4">
        <h3>Welcome</h3>
        <p className="text-muted">
          Dashboard analytics aren't part of your access — here is what you can
          use.
        </p>
        <AdminAccessCard />
      </div>
    );
  }

  if (!can(perms, page, "view")) {
    const allowed = perms.catalogue
      .flatMap((g) => g.pages)
      .filter((p) => can(perms, p.key, "view"));
    return (
      <div className="content">
        <div className="container-fluid p-4">
          <div
            className="card p-4 text-center"
            style={{ maxWidth: 560, margin: "40px auto" }}
          >
            <div style={{ fontSize: 40, lineHeight: 1 }}>🔒</div>
            <h4 className="mt-3 mb-2">You don't have access to this page</h4>
            <p className="text-muted mb-3">
              Ask a super admin to give your account permission for it.
            </p>
            {allowed.length > 0 && (
              <div className="d-flex flex-wrap justify-content-center gap-2">
                {allowed.slice(0, 8).map((p) => (
                  <Link
                    key={p.key}
                    className="btn btn-sm btn-outline-primary"
                    to={pagePath(p.key)}
                  >
                    {p.label.replace(/ \(.*\)$/, "")}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Viewable: the page itself hides the actions this account can't use
  // (usePagePerm in each panel page).
  return <Outlet />;
}

export function Menu() {
  const [model, setModel] = useState("");
  const [mode, setMode] = useState("login");
  const [active, setActive] = useState("");

  // Collapsible admin-menu sections. Default: every group minimized so only
  // Dashboard/Overview shows; the group holding the current page auto-expands.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    students: true,
    training: true,
    content: true,
    comm: true,
    business: true,
    admin: true,
  });
  const toggleGroup = (g: string) =>
    setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  // Map each active menu key to the section it lives in.
  const ACTIVE_GROUP: Record<string, string> = {
    "students-inquiries": "students",
    enrollees: "students",
    students: "students",
    certificates: "students",
    "certificate-requests": "students",
    assignments: "students",
    "live-classes": "students",
    classes: "students",
    trainers: "training",
    "trainer-contacts": "training",
    "class-schedules": "training",
    courses: "training",
    events: "content",
    workshops: "content",
    gallery: "content",
    blogs: "content",
    "blog-categories": "content",
    testimonials: "content",
    youtube: "content",
    partners: "content",
    marquees: "content",
    "plan-slides": "content",
    "web-contacts": "comm",
    "qa-session": "comm",
    feedbacks: "comm",
    newsletter: "comm",
    "site-feedback": "comm",
    "raised-tickets": "comm",
    "dashboard-notices": "comm",
    subscriptions: "business",
    "referred-friends": "business",
    backup: "admin",
    coupons: "admin",
    "promotion-codes": "admin",
    forms: "admin",
    pages: "admin",
    surveys: "admin",
    adminers: "admin",
    activities: "admin",
    "login-blocks": "admin",
    "server-logs": "admin",
    "google-drive": "admin",
    jobs: "admin",
  };
  // Open the section that contains the current route (never force-collapses others).
  useEffect(() => {
    const g = ACTIVE_GROUP[active];
    if (g) setCollapsed((c) => (c[g] ? { ...c, [g]: false } : c));
  }, [active]);

  const location = useLocation();

  // Admin (Y) accounts: hide the pages they may not open, and any section
  // heading left with nothing under it.
  const perms = useAdminPerms();
  let permCss = "";
  if (perms.role === "Y" && !perms.full) {
    const pages = perms.catalogue.flatMap((g) => g.pages.map((p) => p.key));
    const hidden = pages.filter((k) => !can(perms, k, "view"));
    const sel = hidden.map(
      (k) => `.admin-nav li:has(a[href="${pagePath(k)}"])`,
    );
    // the Classes page shows Live Classes data: hidden along with it
    if (hidden.includes("live-classes")) sel.push(`.admin-nav li:has(a[href="/panel/classes"])`);
    const groupOf = (k: string) =>
      k === "dashboard"
        ? "dashboard"
        : k === "batches"
          ? "training"
          : ACTIVE_GROUP[k];
    const groups = [...new Set(pages.map(groupOf).filter(Boolean))];
    groups
      .filter((g) =>
        pages.filter((k) => groupOf(k) === g).every((k) => hidden.includes(k)),
      )
      .forEach((g) => sel.push(`.admin-nav .mh-${g}`));
    if (sel.length)
      permCss = sel.join(",\n") + " { display: none !important; }";
  }

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  const [courses, setCourses] = useState<any[]>([]);

  const [form, setForm] = useState({
    course_id: "",
    name: "",
    email: "",
    phone: "",
    fullphone: "",
    country_code: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  /* ---------------- Load Courses ---------------- */

  const loadCourses = async () => {
    try {
      const security = await getSecurity();

      const res = await axios.post(
        SERVER_URL + "api/get-courses",
        {
          status: "1",
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        setCourses(res.data.data);
      }
    } catch (err) {}
  };

  /* ---------------- Phone (country-code picker, as the website's Contact form) ---------------- */

  // "+" + dial code + digits, kept in the hidden [name="fullphone"] field by
  // /js/phoneinput.js (the flag / country list on #phone)
  const phoneRef = useRef<HTMLInputElement>(null);

  // Digits only — the country code comes from the flag picker. A number pasted
  // with "+<code>" is handed to the picker, which selects that country and keeps
  // just the local number in the box.
  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target as any;
    const raw = String(el.value || "");
    if (/^\s*\+/.test(raw) && el._phoneInput) {
      el._phoneInput._hydrate(); // re-fires this handler with the local digits
      if (!/^\s*\+/.test(String(el.value || ""))) return;
    }
    setForm((f) => ({ ...f, phone: raw.replace(/\D/g, "").slice(0, 15) }));
  };

  // The picker's script / styles, loaded the first time the form opens (and
  // attached again when the form comes back after the success message)
  useEffect(() => {
    if (model !== "referafriend" || success) return;
    const w = window as any;
    if (w.PhoneInput) {
      setTimeout(() => w.PhoneInput?.initAll?.(), 60);
      return;
    }
    if (!document.querySelector('link[href="/css/phoneinput.css"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/css/phoneinput.css";
      document.head.appendChild(css);
    }
    if (!document.querySelector('script[src="/js/phoneinput.js"]')) {
      const js = document.createElement("script");
      js.src = "/js/phoneinput.js";
      js.async = true;
      js.onload = () => setTimeout(() => w.PhoneInput?.initAll?.(), 60);
      document.body.appendChild(js);
    }
  }, [model, success]);

  const closeRefer = () => {
    setModel("");
    setSuccess("");
    setError("");
  };

  // The My Referrals page's "Refer a Friend" button opens this same form
  useEffect(() => {
    const open = () => {
      setSuccess("");
      setError("");
      setModel("referafriend");
    };
    window.addEventListener(OPEN_REFER, open);
    return () => window.removeEventListener(OPEN_REFER, open);
  }, []);

  /* ---------------- Submit ---------------- */
  const navigate = useNavigate();

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (!form.course_id) return setError("❌ Select course");
    if (form.name.trim().length < 3) return setError("❌ Enter your friend's full name");
    if (!form.email.trim()) return setError("❌ Enter email");
    if (!isValidEmail(form.email.trim())) return setError("❌ " + EMAIL_ERROR);
    if (!form.phone) return setError("❌ Enter phone number");
    // local number 6–15 digits; with the country code at most 15 (E.164)
    const fullphone = phoneRef.current?.value?.trim() || "";
    const fullDigits = fullphone.replace(/\D/g, "");
    if (form.phone.length < 6 || form.phone.length > 15 || (fullphone && (fullDigits.length < 7 || fullDigits.length > 15)))
      return setError("❌ Enter a valid phone number for the selected country");

    try {
      setLoading(true);

      const security = await getSecurity();

      const res = await axios.post(
        SERVER_URL + "api/add-refer",
        {
          ...form,
          name: form.name.trim(),
          email: form.email.trim(),
          fullphone,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        setSuccess(res.data.message);
        window.dispatchEvent(new Event(REFER_ADDED)); // My Referrals reloads its list

        setForm({
          course_id: "",
          name: "",
          email: "",
          phone: "",
          fullphone: "",
          country_code: "",
        });
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      console.error(err);
      setError("❌ Submit failed");
    } finally {
      setLoading(false);
    }
  };

  if (model === "referafriend" && courses.length == 0) {
    loadCourses();
  }

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const status = data.id;
    if (loggedIn) {
      if (status == "X" || status == "Y") {
        setMode("admin");
      }
      if (status == "1") {
        setMode("student");
      }
      if (status == "2") {
        setMode("trainer");
      }
    }
  };

  const getCookie = (name: string): string | null => {
    const cookies = document.cookie.split("; ");

    for (const cookie of cookies) {
      const [key, ...value] = cookie.split("=");

      if (key === name) {
        return decodeURIComponent(value.join("="));
      }
    }

    return null;
  };

  useEffect(() => {
    const ustatus = getCookie("id");
    if (
      ustatus === "X" ||
      ustatus === "Y" ||
      ustatus === "1" ||
      ustatus === "2"
    ) {
      if (ustatus == "X" || ustatus == "Y") {
        setMode("admin");
      } else if (ustatus == "1") {
        setMode("student");
      } else if (ustatus == "2") {
        setMode("trainer");
      }
    } else {
      navigate("/logout");
    }
    initchecklogin();
  }, []);

  // The sidebar lives in a persistent AdminLayout and never re-mounts, so keying
  // this on location.pathname is what moves the highlight to the clicked item
  // (and clears it from the previous one) on every navigation.
  useEffect(() => {
    const path = location.pathname;
    // before the "dashboard" check below, which would also match this path
    if (path.includes("/panel/dashboard-notices")) {
      setActive("dashboard-notices");
    } else if (path.includes("dashboard")) {
      setActive("dashboard");
    } else if (path.includes("students-inquiries")) {
      setActive("students-inquiries");
    } else if (path.includes("enrollees")) {
      setActive("enrollees");
    } else if (path.includes("students")) {
      setActive("students");
    } else if (path.includes("trainers")) {
      setActive("trainers");
    } else if (path.includes("courses")) {
      setActive("courses");
    } else if (path.includes("batches")) {
      setActive("courses");
    } else if (path.includes("class-schedule")) {
      setActive(path.includes("class-schedules") ? "class-schedules" : "class-schedule");
    } else if (path.includes("gallery")) {
      setActive("gallery");
    } else if (path.includes("certificate-requests")) {
      setActive("certificate-requests");
    } else if (path.includes("certificates")) {
      setActive("certificates");
    } else if (
      path.includes("assignments") ||
      path.includes("assignment/submitions")
    ) {
      setActive("assignments");
    } else if (path.includes("live-classes")) {
      setActive("live-classes");
    } else if (path.includes("/panel/classes")) {
      setActive("classes");
    } else if (path.includes("/panel/newsletter")) {
      setActive("newsletter");
    } else if (path.includes("/panel/my-feedback")) {
      setActive("my-feedback");
    } else if (path.includes("/panel/my-tickets")) {
      setActive("my-tickets");
    } else if (path.includes("/panel/my-referrals")) {
      setActive("my-referrals");
    } else if (path.includes("/panel/raised-tickets")) {
      setActive("raised-tickets");
    } else if (path.includes("/panel/site-feedback")) {
      setActive("site-feedback");
    } else if (path.includes("web-contacts")) {
      setActive("web-contacts");
    } else if (path.includes("trainer-contacts")) {
      setActive("trainer-contacts");
    } else if (path.includes("qa-session")) {
      setActive("qa-session");
    } else if (path.includes("feedbacks")) {
      setActive("feedbacks");
    } else if (path.includes("referred-friends")) {
      setActive("referred-friends");
    } else if (path.includes("subscriptions")) {
      setActive("subscriptions");
    } else if (path.includes("events")) {
      setActive("events");
    } else if (path.includes("workshop-registrations")) {
      // opened from the Registrations button on Workshops (no menu item of its own)
      setActive("workshops");
    } else if (path.includes("workshops")) {
      setActive("workshops");
    } else if (path.includes("blog-categories")) {
      setActive("blogs");
    } else if (path.includes("blogs")) {
      setActive("blogs");
    } else if (path.includes("ai-chatbot")) {
      setActive("ai-chatbot");
    } else if (path.includes("/panel/forms")) {
      setActive("forms");
    } else if (path.includes("/panel/pages")) {
      setActive("pages");
    } else if (path.includes("/panel/jobs")) {
      setActive("jobs");
    } else if (path.includes("/panel/surveys")) {
      setActive("surveys");
    } else if (path.includes("/panel/adminers")) {
      setActive("adminers");
    } else if (path.includes("/panel/login-blocks")) {
      setActive("login-blocks");
    } else if (path.includes("/panel/server-logs")) {
      setActive("server-logs");
    } else if (path.includes("/panel/google-drive") || path.includes("/panel/drive-auth")) {
      setActive("google-drive");
    } else if (path.includes("/panel/activities")) {
      setActive("activities");
    } else if (path.includes("promotion-codes")) {
      setActive("promotion-codes");
    } else if (path.includes("coupons")) {
      setActive("coupons");
    } else if (path.includes("backup")) {
      setActive("backup");
    } else if (path.includes("testimonials")) {
      setActive("testimonials");
    } else if (path.includes("youtube")) {
      setActive("youtube");
    } else if (path.includes("partners")) {
      setActive("partners");
    } else if (path.includes("marquees")) {
      setActive("marquees");
    } else if (path.includes("plan-slides")) {
      setActive("plan-slides");
    } else if (path.includes("myprofile")) {
      setActive("myprofile");
    } else if (path.includes("myidcard")) {
      setActive("myidcard");
    } else if (path.includes("myassignments")) {
      setActive("myassignments");
    }
  }, [location.pathname]);

  /* The rail (.sidebar ul) is a 100vh scroller holding ~20 links, so for the
     pages sitting further down the list — Q & A Session, Web Contacts,
     Subscriptions, Backup — the highlighted item opens below the fold and you
     have to hunt for it. Bring it up into view once we know which one is active.

     Only the rail is scrolled: scrollIntoView() would also scroll the window
     and shove the page content off-screen. Each panel page appends Admin.css at
     runtime, so on a cold load the rail may not be a scroller yet when this
     first runs — hence the short rAF retry rather than silently doing nothing. */
  useEffect(() => {
    if (!active || mode === "login") return;

    let frames = 0;
    let raf = 0;

    const bringIntoView = () => {
      const ul = document.querySelector(".sidebar ul") as HTMLElement | null;
      const li = ul?.querySelector("li.active") as HTMLElement | null;

      if (ul && li && ul.scrollHeight > ul.clientHeight) {
        const offset =
          li.getBoundingClientRect().top - ul.getBoundingClientRect().top;

        // leave it alone when it is already fully visible
        if (offset < 0 || offset + li.offsetHeight > ul.clientHeight) {
          ul.scrollTop += offset - 12; // 12px = clear of the rail's top padding
        }
        return;
      }

      if (frames++ < 30) raf = requestAnimationFrame(bringIntoView); // ~0.5s max
    };

    raf = requestAnimationFrame(bringIntoView);
    return () => cancelAnimationFrame(raf);
  }, [active, mode]);

  return (
    <>
      {mode === "admin" && (
        <div className="sidebar">
          {permCss && <style>{permCss}</style>}

          {/* Grouped, ordered admin menu (styles live in panel.css under
              .admin-nav). CSS `order` + :has() place each item into its section
              without moving the large SVG blocks; per-group collapse is driven
              by the `col-<group>` classes toggled on the <ul>. */}
          <ul
            className={
              "admin-nav grouped-nav" +
              Object.keys(collapsed)
                .filter((k) => collapsed[k])
                .map((k) => " col-" + k)
                .join("")
            }
          >
            <li className="menu-heading mh-dashboard">
              <span className="mh-ico">🖥️</span> Dashboard
            </li>

            <li
              className="menu-heading mh-students"
              onClick={() => toggleGroup("students")}
            >
              <span className="mh-ico">🏫</span> Student Management
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li
              className="menu-heading mh-training"
              onClick={() => toggleGroup("training")}
            >
              <span className="mh-ico">👨‍🏫</span> Training
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li
              className="menu-heading mh-content"
              onClick={() => toggleGroup("content")}
            >
              <span className="mh-ico">📅</span> Content &amp; Events
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li
              className="menu-heading mh-comm"
              onClick={() => toggleGroup("comm")}
            >
              <span className="mh-ico">💬</span> Communication
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li
              className="menu-heading mh-business"
              onClick={() => toggleGroup("business")}
            >
              <span className="mh-ico">💸</span> Business
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li
              className="menu-heading mh-admin"
              onClick={() => toggleGroup("admin")}
            >
              <span className="mh-ico">🛠</span> Administration
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li className={active === "dashboard" ? "active" : ""}>
              <Link to="/dashboard">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="13"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="3"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="13"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Overview
              </Link>
            </li>

            <li className={active === "students-inquiries" ? "active" : ""}>
              <Link to="/panel/students-inquiries">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 200 200"
                >
                  <g>
                    <path
                      d="M 79.96 128.04 C73.65,131.28 62.33,131.74 55.50,129.03 C47.52,125.86 40.65,119.11 36.31,110.20 C34.25,105.96 31.55,100.93 30.32,99.00 C25.97,92.21 24.08,78.23 27.02,74.50 C27.45,73.95 27.98,69.22 28.19,64.00 C28.50,56.58 29.11,53.41 30.98,49.50 C34.18,42.84 44.30,32.98 51.60,29.41 C56.80,26.86 58.53,26.54 66.98,26.54 C78.16,26.54 82.51,28.12 91.06,35.28 C104.16,46.25 105.37,48.60 105.54,63.50 C105.59,68.45 106.17,74.36 106.83,76.64 C107.79,79.99 107.73,82.15 106.51,87.93 C105.16,94.35 104.04,97.24 101.03,102.00 C100.50,102.82 98.89,106.11 97.44,109.31 C94.33,116.14 86.25,124.80 79.96,128.04 ZM 145.76 131.00 C141.31,135.40 137.31,139.00 136.88,139.00 C136.44,139.00 135.95,135.51 135.79,131.25 L 135.50 123.50 L 127.90 123.00 C114.48,122.12 114.00,121.00 114.00,90.70 C114.00,76.59 114.43,66.07 115.07,64.22 C117.23,58.04 117.46,58.00 154.78,58.00 C187.26,58.00 188.71,58.08 190.77,60.00 C194.51,63.49 195.15,68.74 194.82,93.18 L 194.50 116.16 L 190.76 119.58 L 187.03 123.00 L 153.84 123.00 ZM 86.50 170.57 C78.37,172.81 59.24,173.35 51.41,171.57 C42.94,169.65 32.52,165.37 26.00,161.15 C20.26,157.43 6.00,143.95 6.00,142.25 C6.00,140.44 31.97,124.00 34.83,124.00 C35.58,124.00 38.25,125.81 40.75,128.02 C43.26,130.22 48.26,133.48 51.86,135.25 C57.58,138.07 59.42,138.48 66.45,138.49 C73.41,138.50 75.38,138.08 81.00,135.39 C84.57,133.68 89.59,130.42 92.15,128.14 C94.71,125.86 97.32,124.00 97.94,124.00 C101.38,124.00 127.00,140.07 127.00,142.23 C127.00,142.93 123.06,147.33 118.25,152.02 C108.79,161.23 98.39,167.31 86.50,170.57 ZM 57.22 121.42 C66.31,125.95 75.22,124.04 83.83,115.70 C88.03,111.63 93.00,103.50 93.00,100.69 C93.00,99.93 93.90,98.49 95.01,97.49 C97.11,95.59 101.00,84.51 101.00,80.43 C101.00,79.09 100.13,77.61 99.00,77.00 C97.42,76.16 97.00,74.91 97.00,71.08 C97.00,67.80 96.38,65.46 95.10,63.87 C93.39,61.76 92.32,61.51 84.35,61.35 C77.38,61.21 73.60,60.52 66.56,58.09 C61.65,56.39 56.09,55.00 54.21,55.00 C46.33,55.00 40.56,60.77 37.94,71.28 C37.22,74.18 35.96,76.49 34.74,77.14 C33.01,78.07 32.81,78.91 33.29,83.48 C33.76,88.04 35.25,91.89 38.92,98.00 C39.42,98.82 40.57,101.62 41.48,104.22 C43.67,110.44 50.78,118.21 57.22,121.42 ZM 148.88 97.75 C149.08,99.81 156.93,99.36 157.69,97.25 C158.03,96.29 160.49,93.45 163.16,90.94 C167.61,86.75 168.00,86.00 168.00,81.71 C168.00,78.02 167.42,76.38 165.25,73.96 C159.20,67.21 144.45,68.29 141.35,75.72 C139.54,80.03 140.21,81.00 145.02,81.00 C147.91,81.00 149.21,80.48 150.00,79.00 C151.21,76.74 155.87,76.27 157.80,78.20 C160.33,80.73 159.11,84.28 154.09,88.94 C149.47,93.23 148.59,94.72 148.88,97.75 ZM 149.05 109.56 C149.87,110.55 151.61,110.99 153.91,110.80 C157.29,110.52 157.50,110.29 157.50,107.00 C157.50,103.60 157.38,103.49 153.28,103.19 C149.48,102.92 149.00,103.14 148.42,105.46 C148.04,106.98 148.30,108.65 149.05,109.56 Z"
                      fill="rgb(1,1,1)"
                    />
                    <path
                      d="M 0.00 100.00 L 0.00 0.00 L 100.00 0.00 L 200.00 0.00 L 200.00 100.00 L 200.00 200.00 L 100.00 200.00 L 0.00 200.00 L 0.00 100.00 ZM 86.50 170.57 C98.39,167.31 108.79,161.23 118.25,152.02 C123.06,147.33 127.00,142.93 127.00,142.23 C127.00,140.07 101.38,124.00 97.94,124.00 C97.32,124.00 94.71,125.86 92.15,128.14 C89.59,130.42 84.57,133.68 81.00,135.39 C75.38,138.08 73.41,138.50 66.45,138.49 C59.42,138.48 57.58,138.07 51.86,135.25 C48.26,133.48 43.26,130.22 40.75,128.02 C38.25,125.81 35.58,124.00 34.83,124.00 C31.97,124.00 6.00,140.44 6.00,142.25 C6.00,143.95 20.26,157.43 26.00,161.15 C32.52,165.37 42.94,169.65 51.41,171.57 C59.24,173.35 78.37,172.81 86.50,170.57 ZM 145.76 131.00 L 153.84 123.00 L 170.44 123.00 L 187.03 123.00 L 190.76 119.58 L 194.50 116.16 L 194.82 93.18 C195.15,68.74 194.51,63.49 190.77,60.00 C188.71,58.08 187.26,58.00 154.78,58.00 C117.46,58.00 117.23,58.04 115.07,64.22 C114.43,66.07 114.00,76.59 114.00,90.70 C114.00,121.00 114.48,122.12 127.90,123.00 L 135.50 123.50 L 135.79 131.25 C135.95,135.51 136.44,139.00 136.88,139.00 C137.31,139.00 141.31,135.40 145.76,131.00 ZM 79.96 128.04 C86.25,124.80 94.33,116.14 97.44,109.31 C98.89,106.11 100.50,102.82 101.03,102.00 C104.04,97.24 105.16,94.35 106.51,87.93 C107.73,82.15 107.79,79.99 106.83,76.64 C106.17,74.36 105.59,68.45 105.54,63.50 C105.37,48.60 104.16,46.25 91.06,35.28 C82.51,28.12 78.16,26.54 66.98,26.54 C58.53,26.54 56.80,26.86 51.60,29.41 C44.30,32.98 34.18,42.84 30.98,49.50 C29.11,53.41 28.50,56.58 28.19,64.00 C27.98,69.22 27.45,73.95 27.02,74.50 C24.08,78.23 25.97,92.21 30.32,99.00 C31.55,100.93 34.25,105.96 36.31,110.20 C40.65,119.11 47.52,125.86 55.50,129.03 C62.33,131.74 73.65,131.28 79.96,128.04 ZM 149.05 109.56 C148.30,108.65 148.04,106.98 148.42,105.46 C149.00,103.14 149.48,102.92 153.28,103.19 C157.38,103.49 157.50,103.60 157.50,107.00 C157.50,110.29 157.29,110.52 153.91,110.80 C151.61,110.99 149.87,110.55 149.05,109.56 ZM 148.88 97.75 C148.59,94.72 149.47,93.23 154.09,88.94 C159.11,84.28 160.33,80.73 157.80,78.20 C155.87,76.27 151.21,76.74 150.00,79.00 C149.21,80.48 147.91,81.00 145.02,81.00 C140.21,81.00 139.54,80.03 141.35,75.72 C144.45,68.29 159.20,67.21 165.25,73.96 C167.42,76.38 168.00,78.02 168.00,81.71 C168.00,86.00 167.61,86.75 163.16,90.94 C160.49,93.45 158.03,96.29 157.69,97.25 C156.93,99.36 149.08,99.81 148.88,97.75 ZM 57.22 121.42 C50.78,118.21 43.67,110.44 41.48,104.22 C40.57,101.62 39.42,98.82 38.92,98.00 C35.25,91.89 33.76,88.04 33.29,83.48 C32.81,78.91 33.01,78.07 34.74,77.14 C35.96,76.49 37.22,74.18 37.94,71.28 C40.56,60.77 46.33,55.00 54.21,55.00 C56.09,55.00 61.65,56.39 66.56,58.09 C73.60,60.52 77.38,61.21 84.35,61.35 C92.32,61.51 93.39,61.76 95.10,63.87 C96.38,65.46 97.00,67.80 97.00,71.08 C97.00,74.91 97.42,76.16 99.00,77.00 C100.13,77.61 101.00,79.09 101.00,80.43 C101.00,84.51 97.11,95.59 95.01,97.49 C93.90,98.49 93.00,99.93 93.00,100.69 C93.00,103.50 88.03,111.63 83.83,115.70 C75.22,124.04 66.31,125.95 57.22,121.42 Z"
                      fill="transparent"
                    />
                  </g>
                </svg>{" "}
                Student Inquiries
              </Link>
            </li>

            <li className={active === "enrollees" ? "active" : ""}>
              <Link to="/panel/enrollees">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 21C3 17 6 15 9 15"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M17 8V14M14 11H20"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Enrollees
              </Link>
            </li>

            <li className={active === "events" ? "active" : ""}>
              <Link to="/panel/events">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: "relative", top: "-2px" }}
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <polyline points="9 15 11 17 15 13" />
                </svg>
                Events
              </Link>
            </li>

            <li className={active === "workshops" ? "active" : ""}>
              <Link to="/panel/workshops">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: "relative", top: "-2px" }}
                >
                  <path d="M3 4h18v12H3z" />
                  <path d="M12 16v4" />
                  <path d="M8 20h8" />
                  <path d="M7 8h10" />
                </svg>
                Workshops
              </Link>
            </li>

            <li className={active === "gallery" ? "active" : ""}>
              <Link to="/panel/gallery">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="3" y="3" width="8" height="8" rx="2" />
                  <rect x="13" y="3" width="8" height="8" rx="2" />
                  <rect x="3" y="13" width="8" height="8" rx="2" />
                  <rect x="13" y="13" width="8" height="8" rx="2" />
                </svg>{" "}
                Gallery
              </Link>
            </li>

            <li className={active === "blogs" ? "active" : ""}>
              <Link to="/panel/blogs">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="7" y1="8" x2="17" y2="8" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                  <line x1="7" y1="16" x2="13" y2="16" />
                </svg>{" "}
                Blogs
              </Link>
            </li>

            <li className={active === "blog-categories" ? "active" : ""}>
              <Link to="/panel/blog-categories">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 6h16M4 10h16M4 14h10" />
                  <circle cx="18" cy="17" r="3" />
                  <path d="M20.12 19.12L22 21" strokeLinecap="round" />
                </svg>{" "}
                Blog Categories
              </Link>
            </li>

            <li className={active === "students" ? "active" : ""}>
              <Link to="/panel/students">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="8"
                    cy="7"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx="16"
                    cy="7"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M2 21C2 17 6 15 8 15"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M14 21C14 17 18 15 20 15"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Students
              </Link>
            </li>
            <li className={active === "trainers" ? "active" : ""}>
              <Link to="/panel/trainers">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 8L12 3L22 8L12 13L2 8Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M6 11V16C6 17.5 9 19 12 19C15 19 18 17.5 18 16V11"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Trainers
              </Link>
            </li>
            <li className={active === "courses" ? "active" : ""}>
              <Link to="/panel/courses">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 4H16C18 4 20 6 20 8V20H8C6 20 4 18 4 16V4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M8 4V20" stroke="currentColor" strokeWidth="2" />
                </svg>{" "}
                Courses
              </Link>
            </li>

            <li
              className={active === "batches" ? "active" : ""}
              style={{ display: "none" }}
            >
              <Link to="/panel/batches">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 7L12 2L21 7L12 12L3 7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 12L12 17L21 12"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 17L12 22L21 17"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Batches
              </Link>
            </li>

            <li className={active === "class-schedules" ? "active" : ""}>
              <Link to="/panel/class-schedules">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 10H21M8 3V7M16 3V7M8 14H10M14 14H16M8 17H10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Class Schedules
              </Link>
            </li>

            <li className={active === "certificate-requests" ? "active" : ""}>
              <Link to="/panel/certificate-requests">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 2V8H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 13H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 17H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Certificate Requests
              </Link>
            </li>
            <li className={active === "assignments" ? "active" : ""}>
              <Link to="/panel/assignments">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="18"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M9 4V2H15V4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M8 10H16M8 14H16"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Assignments
              </Link>
            </li>
            <li className={active === "live-classes" ? "active" : ""}>
              <Link to="/panel/live-classes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="6"
                    width="15"
                    height="12"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 10L22 8V16L18 14"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Live Classes
              </Link>
            </li>
            <li className={active === "classes" ? "active" : ""}>
              <Link to="/panel/classes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7.5 7.2L11 9L7.5 10.8V7.2Z" fill="currentColor" />
                  <path d="M19.5 5V15M2 18.5H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>{" "}
                Classes
              </Link>
            </li>
            <li className={active === "trainer-contacts" ? "active" : ""}>
              <Link to="/panel/trainer-contacts">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 7L12 13L21 7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Trainer Contacts
              </Link>
            </li>

            <li className={active === "web-contacts" ? "active" : ""}>
              <Link to="/panel/web-contacts">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 7L12 13L21 7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Web Contacts
              </Link>
            </li>

            <li className={active === "newsletter" ? "active" : ""}>
              <Link to="/panel/newsletter">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 6h16v12H4z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 7l8 6 8-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 3v3M17 3v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Newsletter
              </Link>
            </li>

            <li className={active === "site-feedback" ? "active" : ""}>
              <Link to="/panel/site-feedback">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 6.8l1.1 2.2 2.4.35-1.75 1.7.4 2.4L12 12.3l-2.15 1.15.4-2.4-1.75-1.7 2.4-.35z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Site Feedback
              </Link>
            </li>

            <li className={active === "raised-tickets" ? "active" : ""}>
              <Link to="/panel/raised-tickets">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 9v6M14 10.5h3M14 13.5h2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Raised Tickets
              </Link>
            </li>

            <li className={active === "dashboard-notices" ? "active" : ""}>
              <Link to="/panel/dashboard-notices">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0M4 2C2.8 3.7 2 5.7 2 8M22 8c0-2.3-.8-4.3-2-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>{" "}
                Dashboard Notices
              </Link>
            </li>

            <li className={active === "qa-session" ? "active" : ""}>
              <Link to="/panel/qa-session">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="12"
                    y1="16"
                    x2="12"
                    y2="16"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Q &amp; A Session
              </Link>
            </li>

            <li className={active === "feedbacks" ? "active" : ""}>
              <Link to="/panel/feedbacks">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 4H20V16H6L4 18V4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Feedback
              </Link>
            </li>

            <li className={active === "referred-friends" ? "active" : ""}>
              <Link to="/panel/referred-friends">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 360 360"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <path
                    d="M0 0 C118.8 0 237.6 0 360 0 C360 118.8 360 237.6 360 360 C241.2 360 122.4 360 0 360 C0 241.2 0 122.4 0 0 Z "
                    fill="transparent"
                    transform="translate(0,0)"
                  />
                  <path
                    d="M0 0 C2.699 1.195 4.496 2.618 6.695 4.59 C26.465 20.933 50.117 24.754 75.109 22.719 C91.996 20.201 108.705 11.403 121.32 0.027 C148.905 14.126 167.605 43.542 177.32 72.027 C177.626 72.845 177.931 73.662 178.246 74.504 C182.289 85.575 183.528 96.355 183.402 108.051 C183.393 109.64 183.393 109.64 183.384 111.26 C183.369 113.85 183.348 116.438 183.32 119.027 C159.607 119.379 135.893 119.643 112.177 119.805 C101.164 119.882 90.153 119.987 79.141 120.159 C69.536 120.309 59.933 120.405 50.328 120.439 C45.246 120.458 40.168 120.503 35.088 120.613 C0.022 121.342 0.022 121.342 -8.912 113.906 C-11.335 111.421 -13.403 108.87 -15.328 105.984 C-17.206 103.265 -19.419 100.928 -21.68 98.525 C-29.856 89.68 -35.766 79.468 -40.68 68.527 C-40.983 67.857 -41.286 67.186 -41.599 66.495 C-43.267 62.607 -43.68 60.392 -43.68 56.027 C-28.17 55.697 -12.66 55.367 3.32 55.027 C-2.929 48.747 -2.929 48.747 -9.305 42.34 C-10.607 41.028 -11.91 39.716 -13.252 38.365 C-14.304 37.311 -15.355 36.257 -16.406 35.203 C-16.937 34.667 -17.468 34.132 -18.014 33.579 C-21.416 30.177 -24.942 27.057 -28.68 24.027 C-25.054 15.8 -16.92 10.205 -9.93 4.902 C-9.292 4.405 -8.654 3.907 -7.997 3.394 C-5.295 1.402 -3.419 0.035 0 0 Z "
                    fill="#010101"
                    transform="translate(153.6796875,207.97265625)"
                  />
                  <path
                    d="M0 0 C1.583 0.009 1.583 0.009 3.198 0.019 C11.2 0.179 17.796 1.229 25.188 4.438 C25.987 4.749 26.786 5.061 27.609 5.383 C29.863 6.308 32.018 7.329 34.188 8.438 C34.964 8.833 35.74 9.229 36.539 9.637 C54.302 19.477 66.485 36.072 72.188 55.438 C74.957 69.695 75.272 87.062 69.188 100.438 C68.69 101.591 68.192 102.745 67.68 103.934 C58.681 123.374 43.16 136.977 23.188 144.438 C4.89 150.192 -14.903 148.95 -32.25 140.828 C-51.3 130.234 -65.602 113.895 -71.699 92.812 C-76.367 73.289 -73.71 52.637 -63.5 35.438 C-52.849 20.142 -39.645 9.068 -21.812 3.438 C-21.101 3.185 -20.39 2.933 -19.657 2.673 C-13.031 0.451 -6.965 -0.069 0 0 Z "
                    fill="#010101"
                    transform="translate(214.8125,70.5625)"
                  />
                  <path
                    d="M0 0 C9.879 6.753 18.005 15.614 21.852 27.137 C21.775 30.57 21.28 31.718 18.812 34.129 C17.532 35.061 17.532 35.061 16.227 36.012 C1.958 46.891 -10.522 64.173 -14.148 82.137 C-14.317 83.478 -14.474 84.82 -14.621 86.164 C-14.74 87.251 -14.74 87.251 -14.862 88.359 C-15.009 89.814 -15.136 91.272 -15.24 92.73 C-15.697 97.711 -15.697 97.711 -17.688 99.586 C-31.305 102.634 -46.097 99.786 -57.961 92.676 C-70.515 83.843 -79.417 72.091 -83.148 57.137 C-83.6 53.377 -83.673 49.671 -83.648 45.887 C-83.643 44.874 -83.638 43.861 -83.633 42.818 C-83.355 30.818 -79.445 21.666 -72.148 12.137 C-71.474 11.216 -71.474 11.216 -70.785 10.277 C-53.67 -11.514 -22.606 -13.379 0 0 Z "
                    fill="#020202"
                    transform="translate(144.1484375,40.86328125)"
                  />
                  <path
                    d="M0 0 C2.543 1.574 2.543 1.574 5.188 3.688 C18.472 13.74 31.204 16.295 47.61 16.622 C48.536 16.645 49.461 16.668 50.414 16.691 C51.666 16.71 51.666 16.71 52.944 16.729 C55 17 55 17 57 19 C57.433 21.323 57.795 23.66 58.125 26 C59.815 36.422 63.91 46.819 69.75 55.645 C71.381 58.718 71.577 60.572 71 64 C68.945 66.02 68.945 66.02 66.125 67.812 C59.506 72.262 53.283 77.229 48.027 83.266 C46 85 46 85 43.782 85.489 C39.479 84.733 37.398 81.998 34.457 78.91 C33.543 77.981 33.543 77.981 32.61 77.034 C30.665 75.055 28.738 73.06 26.812 71.062 C24.872 69.073 22.929 67.086 20.983 65.102 C19.774 63.866 18.569 62.626 17.367 61.382 C14.483 58.304 14.483 58.304 11 56 C11 55.34 11 54.68 11 54 C10.34 54 9.68 54 9 54 C8.237 53.175 7.474 52.35 6.688 51.5 C4.306 48.816 4.306 48.816 1.584 48.627 C-1.698 49.101 -2.72 50.119 -5.024 52.472 C-5.778 53.23 -6.532 53.988 -7.309 54.768 C-8.508 56.01 -8.508 56.01 -9.73 57.277 C-10.562 58.118 -11.394 58.959 -12.251 59.826 C-14.908 62.518 -17.548 65.227 -20.188 67.938 C-22.841 70.641 -25.498 73.34 -28.157 76.038 C-29.811 77.719 -31.462 79.404 -33.108 81.093 C-34.225 82.234 -34.225 82.234 -35.364 83.398 C-36.347 84.407 -36.347 84.407 -37.351 85.437 C-40.932 88.831 -44.287 88.076 -49 88 C-50.394 69.853 -45.198 52.047 -37 36 C-36.54 35.094 -36.08 34.188 -35.605 33.254 C-30.025 23.203 -12.974 -1.963 0 0 Z "
                    fill="#030303"
                    transform="translate(71,134)"
                  />
                  <path
                    d="M0 0 C2.173 0.873 3.417 1.789 5.111 3.395 C5.691 3.939 6.271 4.483 6.868 5.044 C7.487 5.641 8.105 6.237 8.743 6.851 C9.726 7.784 9.726 7.784 10.728 8.735 C18.399 16.056 25.865 23.586 33.325 31.121 C36.068 33.891 38.815 36.657 41.563 39.422 C42.184 40.051 42.805 40.68 43.444 41.328 C46.436 44.451 46.436 44.451 50.013 46.808 C50.013 47.468 50.013 48.128 50.013 48.808 C40.773 49.138 31.533 49.468 22.013 49.808 C22.013 76.617 35.001 98.26 52.411 117.847 C54.401 120.112 56.258 122.362 58.013 124.808 C42.945 126.014 26.535 118.157 15.157 108.679 C14.449 108.062 13.742 107.444 13.013 106.808 C11.781 105.774 11.781 105.774 10.524 104.718 C-6.227 90.255 -15.984 70.821 -21.987 49.808 C-35.847 49.313 -35.847 49.313 -49.987 48.808 C-48.059 44.95 -46.393 42.974 -43.362 39.996 C-42.137 38.78 -42.137 38.78 -40.886 37.539 C-38.804 35.578 -36.721 33.732 -34.542 31.89 C-30.565 28.44 -26.897 24.73 -23.222 20.965 C-22.617 20.347 -22.012 19.729 -21.388 19.093 C-18.856 16.506 -16.325 13.918 -13.813 11.311 C-11.96 9.393 -10.093 7.49 -8.222 5.59 C-7.655 4.994 -7.088 4.398 -6.504 3.784 C-2.505 -0.242 -2.505 -0.242 0 0 Z "
                    fill="#030303"
                    transform="translate(72.98744201660156,201.1917266845703)"
                  />
                </svg>
                Referred Friends
              </Link>
            </li>

            <li className={active === "subscriptions" ? "active" : ""}>
              <Link to="/panel/subscriptions">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 240 210"
                >
                  <g>
                    <path
                      d="M 128.00 201.32 C109.79,205.60 102.90,203.93 72.00,187.69 L 54.50 178.50 L 53.97 109.00 L 71.86 109.00 C94.22,109.00 100.63,110.73 118.50,121.58 L 126.50 126.44 L 142.34 126.97 L 158.18 127.50 L 160.59 130.31 C164.41,134.75 163.89,139.46 159.09,144.03 C153.38,149.47 147.84,151.00 133.94,151.00 C121.08,151.00 119.60,151.61 120.18,156.68 C120.72,161.37 123.90,162.15 137.80,161.02 C152.02,159.85 158.92,157.59 164.42,152.27 C166.56,150.20 169.38,146.10 170.68,143.16 L 173.05 137.83 L 192.55 128.41 C208.73,120.60 212.85,119.00 216.77,119.00 C223.11,119.00 227.97,121.62 230.72,126.50 C235.56,135.11 232.59,142.31 220.66,150.81 C194.70,169.34 142.11,198.01 128.00,201.32 ZM 188.12 97.96 C184.90,108.66 181.87,117.52 181.38,117.65 C180.90,117.78 173.07,115.61 164.00,112.84 C154.93,110.06 136.25,104.41 122.50,100.29 C85.55,89.20 64.54,82.79 64.22,82.51 C63.80,82.15 67.31,69.48 74.60,44.94 C78.12,33.09 81.00,22.80 81.00,22.08 C81.00,20.51 82.15,20.73 95.00,24.73 C100.22,26.35 111.70,29.82 120.50,32.44 C129.30,35.06 146.85,40.34 159.50,44.17 C172.15,48.01 186.45,52.33 191.28,53.77 C198.23,55.85 199.94,56.72 199.46,57.95 C199.13,58.80 197.76,63.78 196.42,69.00 C195.08,74.22 191.35,87.26 188.12,97.96 ZM 153.00 99.80 C158.23,101.45 163.09,102.84 163.81,102.90 C164.54,102.95 166.24,101.68 167.60,100.06 C169.35,97.98 171.15,97.03 173.73,96.81 L 177.37 96.50 L 180.65 85.50 C182.46,79.45 183.95,73.93 183.97,73.24 C183.98,72.54 182.64,70.74 180.99,69.24 C178.96,67.39 177.89,65.40 177.72,63.13 L 177.47 59.75 L 158.98 53.95 C101.71,35.98 98.49,35.05 98.10,36.20 C97.13,39.09 92.95,42.00 89.78,42.00 L 86.47 42.00 L 82.88 54.09 L 82.76 54.49 C80.39,62.47 79.60,65.14 80.54,66.86 C81.02,67.76 81.98,68.40 83.41,69.39 C84.59,70.20 85.55,72.40 85.91,75.07 C86.45,79.03 86.82,79.51 90.00,80.34 C93.22,81.18 130.51,92.70 153.00,99.80 ZM 45.02 102.00 L 44.50 185.50 L 26.94 185.77 C17.28,185.92 9.07,185.73 8.69,185.36 C8.31,184.98 8.00,166.07 8.00,143.33 L 8.00 102.00 ZM 203.83 99.25 C202.72,102.96 201.29,105.94 200.65,105.86 C196.87,105.42 195.00,104.73 195.00,103.79 C195.00,102.61 200.64,81.45 204.67,67.50 C206.10,62.55 207.24,57.21 207.20,55.63 C207.10,51.81 203.51,48.17 199.09,47.43 C193.11,46.43 154.14,34.86 148.35,32.36 C146.62,31.61 144.62,31.00 143.91,31.00 C142.68,31.00 99.85,17.11 99.18,16.49 C98.30,15.68 101.27,7.89 102.31,8.28 C102.96,8.52 111.82,11.25 122.00,14.34 C132.18,17.43 148.82,22.50 159.00,25.60 C169.18,28.70 182.23,32.57 188.00,34.20 C193.77,35.83 202.77,38.51 208.00,40.16 C213.23,41.81 218.02,43.32 218.65,43.51 C219.43,43.75 218.38,48.81 215.40,59.18 C212.97,67.61 209.83,78.55 208.42,83.50 C207.01,88.45 204.95,95.54 203.83,99.25 ZM 139.99 82.73 C135.10,85.31 132.79,85.48 128.45,83.59 C118.57,79.29 116.23,66.19 124.14,59.53 C127.81,56.45 130.91,55.59 135.95,56.27 C149.75,58.12 152.49,76.11 139.99,82.73 Z"
                      fill="rgb(1,1,1)"
                    />
                    <path
                      d="M 0.00 105.00 L 0.00 0.00 L 120.00 0.00 L 240.00 0.00 L 240.00 105.00 L 240.00 210.00 L 120.00 210.00 L 0.00 210.00 L 0.00 105.00 ZM 128.00 201.32 C142.11,198.01 194.70,169.34 220.66,150.81 C232.59,142.31 235.56,135.11 230.72,126.50 C227.97,121.62 223.11,119.00 216.77,119.00 C212.85,119.00 208.73,120.60 192.55,128.41 L 173.05 137.83 L 170.68 143.16 C169.38,146.10 166.56,150.20 164.42,152.27 C158.92,157.59 152.02,159.85 137.80,161.02 C123.90,162.15 120.72,161.37 120.18,156.68 C119.60,151.61 121.08,151.00 133.94,151.00 C147.84,151.00 153.38,149.47 159.09,144.03 C163.89,139.46 164.41,134.75 160.59,130.31 L 158.18 127.50 L 142.34 126.97 L 126.50 126.44 L 118.50 121.58 C100.63,110.73 94.22,109.00 71.86,109.00 L 53.97 109.00 L 54.24 143.75 L 54.50 178.50 L 72.00 187.69 C102.90,203.93 109.79,205.60 128.00,201.32 ZM 44.76 143.75 L 45.02 102.00 L 26.51 102.00 L 8.00 102.00 L 8.00 143.33 C8.00,166.07 8.31,184.98 8.69,185.36 C9.07,185.73 17.28,185.92 26.94,185.77 L 44.50 185.50 L 44.76 143.75 ZM 188.12 97.96 C191.35,87.26 195.08,74.22 196.42,69.00 C197.76,63.78 199.13,58.80 199.46,57.95 C199.94,56.72 198.23,55.85 191.28,53.77 C186.45,52.33 172.15,48.01 159.50,44.17 C146.85,40.34 129.30,35.06 120.50,32.44 C111.70,29.82 100.22,26.35 95.00,24.73 C82.15,20.73 81.00,20.51 81.00,22.08 C81.00,22.80 78.12,33.09 74.60,44.94 C67.31,69.48 63.80,82.15 64.22,82.51 C64.54,82.79 85.55,89.20 122.50,100.29 C136.25,104.41 154.93,110.06 164.00,112.84 C173.07,115.61 180.90,117.78 181.38,117.65 C181.87,117.52 184.90,108.66 188.12,97.96 ZM 203.83 99.25 C204.95,95.54 207.01,88.45 208.42,83.50 C209.83,78.55 212.97,67.61 215.40,59.18 C218.38,48.81 219.43,43.75 218.65,43.51 C218.02,43.32 213.23,41.81 208.00,40.16 C202.77,38.51 193.77,35.83 188.00,34.20 C182.23,32.57 169.18,28.70 159.00,25.60 C148.82,22.50 132.18,17.43 122.00,14.34 C111.82,11.25 102.96,8.52 102.31,8.28 C101.27,7.89 98.30,15.68 99.18,16.49 C99.85,17.11 142.68,31.00 143.91,31.00 C144.62,31.00 146.62,31.61 148.35,32.36 C154.14,34.86 193.11,46.43 199.09,47.43 C203.51,48.17 207.10,51.81 207.20,55.63 C207.24,57.21 206.10,62.55 204.67,67.50 C200.64,81.45 195.00,102.61 195.00,103.79 C195.00,104.73 196.87,105.42 200.65,105.86 C201.29,105.94 202.72,102.96 203.83,99.25 ZM 153.00 99.80 C130.51,92.70 93.22,81.18 90.00,80.34 C86.82,79.51 86.45,79.03 85.91,75.07 C85.55,72.40 84.59,70.20 83.41,69.39 C79.15,66.45 79.16,66.61 82.88,54.09 L 86.47 42.00 L 89.78 42.00 C92.95,42.00 97.13,39.09 98.10,36.20 C98.49,35.05 101.71,35.98 158.98,53.95 L 177.47 59.75 L 177.72 63.13 C177.89,65.40 178.96,67.39 180.99,69.24 C182.64,70.74 183.98,72.54 183.97,73.24 C183.95,73.93 182.46,79.45 180.65,85.50 L 177.37 96.50 L 173.73 96.81 C171.15,97.03 169.35,97.98 167.60,100.06 C166.24,101.68 164.54,102.95 163.81,102.90 C163.09,102.84 158.23,101.45 153.00,99.80 ZM 139.99 82.73 C152.49,76.11 149.75,58.12 135.95,56.27 C130.91,55.59 127.81,56.45 124.14,59.53 C116.23,66.19 118.57,79.29 128.45,83.59 C132.79,85.48 135.10,85.31 139.99,82.73 Z"
                      fill="transparent"
                    />
                  </g>
                </svg>
                Subscriptions
              </Link>
            </li>

            <li className={active === "testimonials" ? "active" : ""}>
              <Link to="/panel/testimonials">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Testimonials
              </Link>
            </li>

            <li className={active === "youtube" ? "active" : ""}>
              <Link to="/panel/youtube">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="2"
                    y="5"
                    width="20"
                    height="14"
                    rx="4"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M10 9L15 12L10 15V9Z" fill="currentColor" />
                </svg>{" "}
                YouTube
              </Link>
            </li>

            <li className={active === "partners" ? "active" : ""}>
              <Link to="/panel/partners">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
                  <rect x="3" y="15" width="7" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="15" width="7" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
                </svg>{" "}
                Partners
              </Link>
            </li>

            <li className={active === "marquees" ? "active" : ""}>
              <Link to="/panel/marquees">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>{" "}
                Marquee Messages
              </Link>
            </li>

            <li className={active === "plan-slides" ? "active" : ""}>
              <Link to="/panel/plan-slides">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="5"
                    y="5"
                    width="14"
                    height="12"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M2 8v6M22 8v6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9 21h2M13 21h2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Plan Slides
              </Link>
            </li>

            <li className={active === "backup" ? "active" : ""}>
              <Link to="/panel/backup">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <ellipse
                    cx="12"
                    cy="5"
                    rx="8"
                    ry="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M4 5V12C4 13.5 7.5 15 12 15C16.5 15 20 13.5 20 12V5"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M4 12V19C4 20.5 7.5 22 12 22C16.5 22 20 20.5 20 19V12"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Backup
              </Link>
            </li>

            <li className={active === "coupons" ? "active" : ""}>
              <Link to="/panel/coupons">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M14 8l-4 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Coupons
              </Link>
            </li>

            <li className={active === "promotion-codes" ? "active" : ""}>
              <Link to="/panel/promotion-codes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
                </svg>{" "}
                Promotion Codes
              </Link>
            </li>

            {/* The AI chatbot server (VITE_CHATBOT_URL) — its own app, so a new tab */}
            <li className="nav-webchatbot">
              <a href={CHATBOT_URL+'admin'} target="_blank" rel="noopener noreferrer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-2.9-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Web ChatBot
              </a>
            </li>

            <li className={active === "forms" ? "active" : ""}>
              <Link to="/panel/forms">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4"
                    y="3"
                    width="16"
                    height="18"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 8h8M8 12h8M8 16h5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Custom Forms
              </Link>
            </li>

            <li className={active === "pages" ? "active" : ""}>
              <Link to="/panel/pages">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 3v6h6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Custom Pages
              </Link>
            </li>

            <li className={active === "surveys" ? "active" : ""}>
              <Link to="/panel/surveys">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 20V10M10 20V4M16 20v-7M22 20H2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Surveys
              </Link>
            </li>

            <li className={active === "jobs" ? "active" : ""}>
              <Link to="/panel/jobs">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="7"
                    width="18"
                    height="13"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Career Jobs
              </Link>
            </li>

            <li className={active === "adminers" ? "active" : ""}>
              <Link to="/panel/adminers">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="9"
                    cy="8"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 20c0-3 3-5 6-5s6 2 6 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M17 11l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Adminers
              </Link>
            </li>

            <li className={active === "activities" ? "active" : ""}>
              <Link to="/panel/activities">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 8v4l3 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Activities
              </Link>
            </li>

            <li className={active === "login-blocks" ? "active" : ""}>
              <Link to="/panel/login-blocks">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3l7 3v5c0 4.6-3 8.5-7 10-4-1.5-7-5.4-7-10V6z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.5 9.5l5 5M14.5 9.5l-5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Login Blocks
              </Link>
            </li>

            <li className={active === "server-logs" ? "active" : ""}>
              <Link to="/panel/server-logs">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 9l3 3-3 3M12 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>{" "}
                Server Logs
              </Link>
            </li>

            <li className={active === "google-drive" ? "active" : ""}>
              <Link to="/panel/google-drive">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Google Drive
              </Link>
            </li>
          </ul>
        </div>
      )}

      {mode === "trainer" && (
        <div className="sidebar">
          <ul
            className={
              "trainer-nav grouped-nav" +
              (collapsed.teaching ? " col-teaching" : "")
            }
          >
            <li className="menu-heading mh-dashboard">
              <span className="mh-ico">🖥️</span> Dashboard
            </li>
            <li
              className="menu-heading mh-teaching"
              onClick={() => toggleGroup("teaching")}
            >
              <span className="mh-ico">📖</span> Teaching
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li className={active === "dashboard" ? "active" : ""}>
              <Link to="/dashboard">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="13"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="3"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="13"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Overview
              </Link>
            </li>

            <li className={active === "assignments" ? "active" : ""}>
              <Link to="/panel/assignments">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="18"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M9 4V2H15V4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M8 10H16M8 14H16"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Assignments
              </Link>
            </li>

            <li className={active === "live-classes" ? "active" : ""}>
              <Link to="/panel/live-classes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="6"
                    width="15"
                    height="12"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 10L22 8V16L18 14"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Live Classes
              </Link>
            </li>
            <li className={active === "classes" ? "active" : ""}>
              <Link to="/panel/classes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7.5 7.2L11 9L7.5 10.8V7.2Z" fill="currentColor" />
                  <path d="M19.5 5V15M2 18.5H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>{" "}
                Classes
              </Link>
            </li>

            <li className={active === "qa-session" ? "active" : ""}>
              <Link to="/panel/qa-session">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="12"
                    y1="16"
                    x2="12"
                    y2="16"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Q &amp; A Session
              </Link>
            </li>

            <li className={active === "trainer-contacts" ? "active" : ""}>
              <Link to="/panel/trainer-contacts">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M23 21v-2a4 4 0 0 0-3-3.87"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 3.13a4 4 0 0 1 0 7.75"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Student Queries
              </Link>
            </li>
          </ul>
        </div>
      )}

      {mode === "student" && (
        <div className="sidebar">
          <ul
            className={
              "student-nav grouped-nav" +
              (collapsed.learning ? " col-learning" : "") +
              (collapsed.account ? " col-account" : "")
            }
          >
            <li className="menu-heading mh-dashboard">
              <span className="mh-ico">🖥️</span> Dashboard
            </li>
            <li
              className="menu-heading mh-learning"
              onClick={() => toggleGroup("learning")}
            >
              <span className="mh-ico">📖</span> Learning
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>
            <li
              className="menu-heading mh-account"
              onClick={() => toggleGroup("account")}
            >
              <span className="mh-ico">🧑‍🎓</span> Account
              <span className="mh-caret" aria-hidden="true">
                ▾
              </span>
            </li>

            <li className={active === "dashboard" ? "active" : ""}>
              <Link to="/dashboard">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="13"
                    y="3"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="3"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="13"
                    y="13"
                    width="8"
                    height="8"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Overview
              </Link>
            </li>

            <li className={active === "myidcard" ? "active" : ""}>
              <Link to="/panel/myidcard">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 400 300"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="10"
                    y="10"
                    width="380"
                    height="280"
                    rx="25"
                    ry="25"
                    fill="#222"
                  />

                  <rect
                    x="40"
                    y="30"
                    width="320"
                    height="20"
                    rx="8"
                    fill="#ddd"
                  />

                  <circle cx="120" cy="120" r="35" fill="#eee" />

                  <path
                    d="M85 190
       C85 160, 155 160, 155 190
       Z"
                    fill="#eee"
                  />

                  <rect
                    x="200"
                    y="90"
                    width="150"
                    height="18"
                    rx="6"
                    fill="#ddd"
                  />
                  <rect
                    x="200"
                    y="120"
                    width="100"
                    height="16"
                    rx="6"
                    fill="#ddd"
                  />
                  <rect
                    x="320"
                    y="120"
                    width="30"
                    height="16"
                    rx="6"
                    fill="#ddd"
                  />
                  <rect
                    x="200"
                    y="150"
                    width="150"
                    height="18"
                    rx="6"
                    fill="#ddd"
                  />
                </svg>
                My ID Card
              </Link>
            </li>

            <li className={active === "certificates" ? "active" : ""}>
              <Link to="/panel/certificates">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="8"
                    r="5"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 14L6 22L12 18L18 22L16 14"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Certificates
              </Link>
            </li>

            <li className={active === "class-schedule" ? "active" : ""}>
              <Link to="/panel/class-schedule">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3 10H21M8 3V7M16 3V7M8 14H10M14 14H16M8 17H10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Class Schedule
              </Link>
            </li>

            <li className={active === "assignments" ? "active" : ""}>
              <Link to="/panel/assignments">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="18"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M9 4V2H15V4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M8 10H16M8 14H16"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Assignments
              </Link>
            </li>

            <li className={active === "live-classes" ? "active" : ""}>
              <Link to="/panel/live-classes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="6"
                    width="15"
                    height="12"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 10L22 8V16L18 14"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>{" "}
                Live Classes
              </Link>
            </li>
            <li className={active === "classes" ? "active" : ""}>
              <Link to="/panel/classes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7.5 7.2L11 9L7.5 10.8V7.2Z" fill="currentColor" />
                  <path d="M19.5 5V15M2 18.5H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>{" "}
                Classes
              </Link>
            </li>

            <li className={active === "qa-session" ? "active" : ""}>
              <Link to="/panel/qa-session">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="12"
                    y1="16"
                    x2="12"
                    y2="16"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Q &amp; A Session
              </Link>
            </li>

            <li className={active === "trainer-contacts" ? "active" : ""}>
              <Link to="/panel/trainer-contacts">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M23 21v-2a4 4 0 0 0-3-3.87"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 3.13a4 4 0 0 1 0 7.75"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Trainer Contacts
              </Link>
            </li>

            <li className={active === "my-feedback" ? "active" : ""}>
              <Link to="/panel/my-feedback">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 6.8l1.1 2.2 2.4.35-1.75 1.7.4 2.4L12 12.3l-2.15 1.15.4-2.4-1.75-1.7 2.4-.35z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                My Feedback
              </Link>
            </li>

            <li className={active === "my-referrals" ? "active" : ""}>
              <Link to="/panel/my-referrals">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 4 1.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 18l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                My Referrals
              </Link>
            </li>

            <li className={active === "my-tickets" ? "active" : ""}>
              <Link to="/panel/my-tickets">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12h6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                My Tickets
              </Link>
            </li>
          </ul>

          {/* Rendered outside the sidebar (hidden on phones), inside .dashboard-wrapper
              so it keeps the panel's popup styles and dark mode */}
          {model === "referafriend" && createPortal(
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            >
              <div className="modal-dialog">
                {/* refer-modal: lets the country list show outside the box (panel.css) */}
                <div className="modal-content refer-modal">
                  <div className="modal-header">
                    <h5 className="modal-title">Refer a Friend</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeRefer}
                    ></button>
                  </div>
                  {success ? (
                    /* Saved: the message takes the form's place */
                    <div className="refer-done" role="status">
                      <style>{`
                        .refer-done { padding:34px 28px 28px; text-align:center; }
                        .refer-done-icon { width:72px; height:72px; border-radius:50%; margin:0 auto 16px; display:flex; align-items:center; justify-content:center; background:#dcfce7; color:#16a34a; }
                        .refer-done h4 { font-size:21px; font-weight:700; color:#0f172a; margin:0 0 8px; }
                        .refer-done p { font-size:14.5px; color:#475569; margin:0 auto 24px; max-width:360px; }
                        .refer-done-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
                        .refer-done-actions .btn { border-radius:10px; font-weight:600; padding:9px 18px; }
                      `}</style>
                      <div className="refer-done-icon" aria-hidden="true">
                        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 12.5l4.5 4.5L19 7.5"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <h4>Thank you for the referral!</h4>
                      <p>
                        Your friend's details were submitted. You can follow whether they
                        apply and join on My Referrals.
                      </p>
                      <div className="refer-done-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ background: "#1a6f98", borderColor: "#1a6f98" }}
                          onClick={() => {
                            closeRefer();
                            navigate("/panel/my-referrals");
                          }}
                        >
                          View My Referrals
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setSuccess("")}
                        >
                          Refer Another Friend
                        </button>
                      </div>
                    </div>
                  ) : (
                  /* form.adminphone: /js/phoneinput.js attaches its country picker to #phone */
                  <form onSubmit={submitForm} className="refer adminphone" noValidate>
                    <div className="modal-body">
                      <div className="form-group mb-3">
                        <label htmlFor="refer-course">Course : *</label>
                        <select
                          id="refer-course"
                          className="form-control form-select"
                          value={form.course_id}
                          required
                          onChange={(e) =>
                            setForm({ ...form, course_id: e.target.value })
                          }
                        >
                          <option value="">
                            {courses.length ? "Select the course to refer" : "Loading courses..."}
                          </option>
                          {courses
                            .filter((c) => c.status === "1")
                            .map((c) => (
                              <option key={c.req_id} value={c.req_id}>
                                {c.title}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="form-group mb-3">
                        <label>Name : *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter name"
                          required
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                        />
                      </div>

                      <div className="form-group mb-3">
                        <label>Email : *</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="Enter email"
                          required
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                        />
                      </div>
                      {/* Phone: the plugin keeps these in sync — "+" + dial code + digits, and the ISO country */}
                      <input
                        name="fullphone"
                        type="text"
                        defaultValue=""
                        ref={phoneRef}
                        style={{ display: "none" }}
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                      <input type="hidden" name="country_code" />
                      <div className="form-group mb-3">
                        <label htmlFor="phone">Contact Number : *</label>
                        <input
                          type="text"
                          id="phone"
                          name="phone"
                          className="form-control"
                          required
                          value={form.phone}
                          onChange={setPhone}
                          maxLength={15}
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="Enter phone number"
                          style={{ paddingLeft: "47px" }}
                        />
                      </div>
                      {/* Submit */}

                      <div className="form-group mb-3">
                        {error && <h5 className="text-danger">{error}</h5>}
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ background: "#1a6f98" }}
                        disabled={loading}
                      >
                        {loading ? <ButtonLoader label="Submitting..." /> : "Submit Details"}
                      </button>
                    </div>
                  </form>
                  )}
                </div>
              </div>
            </div>,
            document.querySelector(".dashboard-wrapper") || document.body,
          )}
        </div>
      )}
    </>
  );
}
