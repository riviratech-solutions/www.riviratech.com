import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Head, SERVER_URL } from "../../../components/Includes";
import { getSeoByPath } from "../../../utils/seo";
import {
  type PermAction,
  type PermGroup,
  type PermMap,
} from "../../../utils/adminPermissions";
import {
  ShieldCheck,
  UserPlus,
  RotateCw,
  Monitor,
  Edit,
  Trash2,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

type Adminer = {
  id: number;
  mem_id: string;
  name: string;
  email: string;
  number: string;
  status: string;
  datetime: number;
  permissions?: PermMap | null;
};
const ROLE_LABEL = (s: string) =>
  s === "X" ? "Super Admin" : s === "Y" ? "Admin" : s;

export default function Adminers() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [me, setMe] = useState("");
  const isSuper = role === "X";

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Adminer[]>([]);
  // Search filters the loaded accounts as you type (name, email, phone, member ID).
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? list.filter((a) =>
        [a.name, a.email, a.number, a.mem_id].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(needle),
        ),
      )
    : list;

  // Page permission catalogue (from the API)
  const [catalogue, setCatalogue] = useState<PermGroup[]>([]);
  const allPages = catalogue.flatMap((g) => g.pages);
  const fullMap = (): PermMap =>
    Object.fromEntries(
      allPages.map((p) => [p.key, p.actions.map((a) => a.key)]),
    );

  const empty = {
    mem_id: "",
    name: "",
    email: "",
    number: "",
    password: "",
    status: "Y",
  };
  const [form, setForm] = useState<typeof empty>(empty);
  const [perms, setPerms] = useState<PermMap>({});
  const [legacyFull, setLegacyFull] = useState(false);

  const has = (page: string, a: PermAction) => (perms[page] || []).includes(a);
  const pageLabel = (key: string) =>
    allPages.find((p) => p.key === key)?.label || key;
  const innerPagesOf = (key: string) =>
    allPages.filter((p) => p.parent === key);

  const withDeps = (m: PermMap, cleared: string[] = []): PermMap => {
    const next = { ...m };
    allPages.forEach((p) => {
      if (p.parent && cleared.includes(p.parent)) delete next[p.key];
    });
    allPages.forEach((p) => {
      if (
        p.parent &&
        next[p.key]?.length &&
        !(next[p.parent] || []).includes("view")
      ) {
        next[p.parent] = ["view", ...(next[p.parent] || [])];
      }
    });
    return next;
  };

  const setPage = (page: string, acts: PermAction[]) =>
    setPerms((m) => {
      const next = { ...m };
      const meta = allPages.find((p) => p.key === page);
      let actList = (meta?.actions || [])
        .map((a) => a.key)
        .filter((x) => acts.includes(x));
      if (actList.length && !actList.includes("view"))
        actList = ["view", ...actList];
      if (actList.length) next[page] = actList;
      else delete next[page];
      return withDeps(next, actList.length ? [] : [page]);
    });

  const toggle = (page: string, a: PermAction) => {
    const cur = perms[page] || [];
    if (cur.includes(a))
      setPage(page, a === "view" ? [] : cur.filter((x) => x !== a));
    else setPage(page, [...cur, a]);
  };

  const groupState = (g: PermGroup) => {
    const total = g.pages.reduce((n, p) => n + p.actions.length, 0);
    const on = g.pages.reduce(
      (n, p) => n + p.actions.filter((a) => has(p.key, a.key)).length,
      0,
    );
    return { all: on === total, some: on > 0 && on < total };
  };

  const toggleGroup = (g: PermGroup) => {
    const { all } = groupState(g);
    setPerms((m) => {
      const next = { ...m };
      g.pages.forEach((p) => {
        if (all) delete next[p.key];
        else next[p.key] = p.actions.map((a) => a.key);
      });
      return withDeps(next, all ? g.pages.map((p) => p.key) : []);
    });
  };

  const togglePage = (page: string) => {
    const meta = allPages.find((p) => p.key === page);
    const keys = (meta?.actions || []).map((a) => a.key);
    setPage(page, keys.every((k) => has(page, k)) ? [] : keys);
  };

  const togglePageAccess = (page: string) =>
    setPage(page, (perms[page] || []).length ? [] : ["view"]);

  const countPages = (m: PermMap | null | undefined) =>
    m == null ? allPages.length : Object.keys(m).length;

  const phoneRef = useRef<HTMLInputElement>(null);

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;
  // List reads come from the saved copy when there is one (utils/listCache.ts)
  const LIST_READS = ["api/adminers"];
  const post = async (path: string, body: any = {}) => {
    if (LIST_READS.includes(path)) return (await listFetch(path, body)).data;
    const s = await getSecurity();
    return (
      await axios.post(
        SERVER_URL + path,
        { ...body, key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      )
    ).data;
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const r = await post("api/adminers");
      if (r.success) {
        setList(r.data);
        setMe(r.me || "");
        if (r.catalogue) setCatalogue(r.catalogue);
      } else {
        toast.error(r.message || "Failed to load adminers");
      }
    } catch {
      toast.error("Failed to load adminers");
    } finally {
      setLoading(false);
    }
  };

  const initchecklogin = async () => {
    try {
      const res = await axios.get(SERVER_URL + "api/check-login", {
        withCredentials: true,
      });
      if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y")) {
        setRole(res.data.id);
        setMe(res.data.key || "");
        loadList();
      } else {
        navigate("/logout");
      }
    } catch {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();

    const piCss = document.createElement("link");
    piCss.rel = "stylesheet";
    piCss.href = "/css/phoneinput.css";
    document.head.appendChild(piCss);

    const piJs = document.createElement("script");
    piJs.src = "/js/phoneinput.js";
    piJs.async = true;
    piJs.onload = () => (window as any).PhoneInput?.initAll?.();
    document.body.appendChild(piJs);

    return () => {
      if (piCss.parentNode) document.head.removeChild(piCss);
      if (piJs.parentNode) document.body.removeChild(piJs);
    };
  }, []);

  useEffect(() => {
    if (modalOpen) (window as any).PhoneInput?.initAll?.();
  }, [modalOpen]);

  const closeModal = () => {
    if (!busy) setModalOpen(false);
  };

  const newAdminer = () => {
    setForm(empty);
    setPerms({ dashboard: ["view"] });
    setLegacyFull(false);
    setModalOpen(true);
  };

  const editAdminer = (a: Adminer) => {
    setForm({
      mem_id: a.mem_id,
      name: a.name || "",
      email: a.email || "",
      number: a.number || "",
      password: "",
      status: a.status,
    });
    setPerms(
      a.status === "Y" && a.permissions ? { ...a.permissions } : fullMap(),
    );
    setLegacyFull(a.status === "Y" && a.permissions == null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!isSuper) return;
    if (!form.name.trim()) return toast.error("Please enter a name");
    if (form.status === "Y" && !Object.keys(perms).length)
      return toast.error("Give this admin access to at least one page");
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      return toast.error("Please enter a valid email");
    const local = form.number.replace(/\D/g, "");
    if (local && (local.length < 6 || local.length > 15))
      return toast.error("Please enter a valid phone number");
    const number = local
      ? phoneRef.current?.value?.trim() || form.number.trim()
      : "";
    if (!form.mem_id && form.password.length < 4)
      return toast.error("Password must be at least 4 characters");
    if (form.password && form.password.length < 4)
      return toast.error("Password must be at least 4 characters");

    setBusy(true);
    try {
      const r = await post("api/adminers/save", {
        ...form,
        number,
        permissions: form.status === "Y" ? perms : undefined,
      });
      if (r.success) {
        toast.success(r.message);
        setModalOpen(false);
        loadList();
      } else {
        toast.error(r.message);
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Adminer) => {
    if (!isSuper) return;
    if (a.mem_id === me)
      return toast.error("You can't delete your own account");
    if (
      !window.confirm(
        `Delete adminer "${a.name}" (${ROLE_LABEL(a.status)})? This cannot be undone.`,
      )
    )
      return;
    try {
      const r = await post("api/adminers/delete", { mem_id: a.mem_id });
      if (r.success) {
        toast.success(r.message);
        setList((l) => l.filter((x) => x.mem_id !== a.mem_id));
      } else toast.error(r.message);
    } catch {
      toast.error("Delete failed");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "AD";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarPalette = [
    { bg: "#ede9fe", text: "var(--ad-brand)" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#fef3c7", text: "#d97706" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#fce7f3", text: "#db2777" },
  ];

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
        .si-avatar-badge {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .si-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-user-name {
          font-weight: 600;
          color: #0f172a;
          font-size: 13.5px;
        }
        .si-me-badge {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 6px;
          margin-left: 6px;
        }
        .ad-pill {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
        }
        .ad-pill.super { background: #ede9fe; color: var(--ad-brand-2); }
        .ad-pill.admin { background: #dbeafe; color: #1e40af; }

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
        .si-action-btn.btn-sessions {
          background: #f1f5f9;
          color: #334155;
        }
        .si-action-btn.btn-edit {
          background: #e0f2fe;
          color: #0284c7;
        }
        .si-action-btn.btn-trash {
          background: #fee2e2;
          color: #ef4444;
        }

        /* Permissions styles in modal */
        .ad-perm-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin:4px 0 10px; }
        .ad-perm-head h6 { margin:0; font-weight:800; font-size:14px; }
        .ad-modal { max-width: min(1500px, 94vw); }
        .ad-perm-groups { display:flex; flex-direction:column; gap:12px; }
        .ad-pg-group { border:1px solid #e2e8f0; border-radius:12px; background:#fff; padding:10px 14px 14px; }
        .ad-pg-group.on { border-color:#c7d2fe; background:#fbfcff; }
        .ad-pg-ghead { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 2px 10px; }
        .ad-pg-ghead label { display:flex; align-items:center; gap:9px; margin:0; font-size:.78rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:#1e293b; cursor:pointer; }
        .ad-pg-ghead .cnt { font-size:.72rem; font-weight:700; color:#64748b; background:#f1f5f9; border-radius:999px; padding:2px 9px; }
        .ad-pg-cards { display:flex; flex-wrap:wrap; gap:10px; }
        .ad-pg-card { flex:1 1 300px; min-width:0; container-type:inline-size; border:1px solid #e2e8f0; border-radius:10px; background:#fff; padding:10px 12px; transition:border-color .15s,background .15s; }
        .ad-pg-card.on { border-color:#c7d2fe; background:#f8faff; }
        .ad-pg-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .ad-pg-name { display:flex; align-items:center; gap:9px; margin:0; font-size:.9rem; font-weight:700; color:#0f172a; line-height:1.3; cursor:pointer; }
        .ad-pg-all { display:inline-flex; align-items:center; gap:6px; margin:2px 0 0; font-size:.76rem; font-weight:600; color:#64748b; cursor:pointer; white-space:nowrap; }
        .ad-pg-body { margin-top:3px; }
        .ad-pg-desc { font-size:.76rem; color:#64748b; line-height:1.35; }
        .ad-pg-sub { display:block; margin-top:1px; font-size:.7rem; font-weight:600; color:var(--ad-brand); }
        .ad-perm-acts { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
        @container (min-width: 640px) {
          .ad-pg-body { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
          .ad-pg-body .ad-perm-acts { justify-content:flex-end; margin-top:0; flex-shrink:0; max-width:65%; }
        }
        .ad-perm-acts label { display:inline-flex; align-items:center; gap:6px; margin:0; padding:3px 10px 3px 7px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; font-size:.76rem; color:#475569; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
        .ad-perm-acts label.on { border-color:#a5b4fc; background:#eef2ff; color:var(--ad-brand-2); font-weight:600; }
        .ad-perm-acts input, .ad-pg-all input, .ad-pg-name input, .ad-pg-ghead input { width:15px; height:15px; margin:0; cursor:pointer; accent-color:var(--ad-brand); flex-shrink:0; }
        .ad-perm-all { border:1px dashed #c7d2fe; border-radius:12px; background:#f5f3ff; padding:14px; color:var(--ad-brand-2); font-weight:600; font-size:.9rem; }
      `}</style>

      <div className="content">
        <div className="si-page-wrapper" style={{ width: "100%" }}>
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Adminers</h3>
                <p className="si-header-subtitle">
                  {isSuper
                    ? "Manage administrative accounts and assign granular per-page access permissions."
                    : "View adminer accounts (Super Admin privileges required to edit)."}
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <span className="si-total-count-text">
                Total Accounts <b>{list.length}</b>
              </span>

              {isSuper && (
                <button className="si-btn-primary" onClick={newAdminer}>
                  <UserPlus size={16} /> Add Adminer
                </button>
              )}
            </div>
          </div>

          <div className="si-header-container">
            <div className="si-header-left"></div>
            <div className="si-header-right" style={{"display":"flex", "gap":"10px","flexWrap":"nowrap"}}>
              <ListSearch
                placeholder="Search name, email, phone or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button
                title="Refresh"
                aria-label="Refresh"
                data-refresh
                className="reload-btn"
                onClick={loadList}
                disabled={loading}
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
                    <th className="si-th">Name & Account</th>
                    <th className="si-th">Email</th>
                    <th className="si-th">Phone Number</th>
                    <th className="si-th">Role</th>
                    {isSuper && <th className="si-th">Page Access</th>}
                    {isSuper && (
                      <th className="si-th" style={{ textAlign: "right" }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="si-tbody">
                  {loading ? (
                    <SkeletonRows />
                  ) : shown.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isSuper ? 6 : 4}
                        style={{
                          textAlign: "center",
                          padding: "50px 0",
                          color: "#64748b",
                        }}
                      >
                        {list.length
                          ? "No adminers match your search."
                          : "No adminer accounts found."}
                      </td>
                    </tr>
                  ) : (
                    shown.map((a, index) => {
                      const avatarStyle =
                        avatarPalette[index % avatarPalette.length];
                      const initials = getInitials(a.name);

                      return (
                        <tr key={a.mem_id} className="si-tr">
                          <td className="si-td">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <div
                                className="si-avatar-badge"
                                style={{
                                  background: avatarStyle.bg,
                                  color: avatarStyle.text,
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <span className="si-user-name">
                                  {a.name || "—"}
                                </span>
                                {a.mem_id === me && (
                                  <span className="si-me-badge">You</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="si-td" style={{ color: "#334155" }}>
                            {a.email || "—"}
                          </td>

                          <td className="si-td" style={{ color: "#475569" }}>
                            {a.number || "—"}
                          </td>

                          <td className="si-td">
                            <span
                              className={
                                "ad-pill " +
                                (a.status === "X" ? "super" : "admin")
                              }
                            >
                              {ROLE_LABEL(a.status)}
                            </span>
                          </td>

                          {isSuper && (
                            <td
                              className="si-td"
                              style={{
                                fontWeight: 600,
                                fontSize: 13,
                                color: "#475569",
                              }}
                            >
                              {a.status === "X" || a.permissions == null
                                ? "All pages (Full Access)"
                                : `${countPages(a.permissions)} of ${allPages.length} pages`}
                            </td>
                          )}

                          {isSuper && (
                            <td
                              className="si-td"
                              style={{ textAlign: "right" }}
                            >
                              <div
                                className="si-actions-cell"
                                style={{ justifyContent: "flex-end" }}
                              >
                                <button
                                  type="button"
                                  className="si-action-btn btn-sessions"
                                  title="View sign-in sessions"
                                  onClick={() =>
                                    navigate(
                                      "/panel/login-sessions?m=" +
                                        encodeURIComponent(a.mem_id),
                                    )
                                  }
                                >
                                  <Monitor size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="si-action-btn btn-edit"
                                  title="Edit Adminer & Permissions"
                                  onClick={() => editAdminer(a)}
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="si-action-btn btn-trash"
                                  title="Delete Adminer"
                                  disabled={a.mem_id === me}
                                  onClick={() => remove(a)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/adminers" />
            </div>
          </div>
        </div>

        {/* ============ ADD / EDIT MODAL ============ */}
        {isSuper && modalOpen && (
          <>
            <div
              className="modal fade show"
              style={{
                display: "block",
                backgroundColor: "rgba(15, 23, 42, 0.55)",
                backdropFilter: "blur(4px)",
              }}
              tabIndex={-1}
              role="dialog"
              onClick={closeModal}
            >
              <div
                className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl ad-modal"
                role="document"
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
                        "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                      borderBottom: "1px solid #e2e8f0",
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
                          background: "var(--ad-brand)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShieldCheck size={20} />
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
                          {form.mem_id
                            ? "Edit Adminer Account"
                            : "Add New Adminer"}
                        </h5>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          Configure credentials and granular access permissions
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      disabled={busy}
                      onClick={closeModal}
                    />
                  </div>

                  <form
                    id="adminer-form"
                    className="modal-body adminphone"
                    style={{ padding: 24 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      save();
                    }}
                  >
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label
                          className="form-label"
                          style={{ fontWeight: 600, fontSize: 13 }}
                        >
                          Name *
                        </label>
                        <input
                          className="form-control"
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          placeholder="Full name"
                        />
                      </div>
                      <div className="col-md-6">
                        <label
                          className="form-label"
                          style={{ fontWeight: 600, fontSize: 13 }}
                        >
                          Role *
                        </label>
                        <select
                          className="form-select"
                          value={form.status}
                          onChange={(e) =>
                            setForm({ ...form, status: e.target.value })
                          }
                        >
                          <option value="Y">Admin</option>
                          <option value="X">Super Admin</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label
                          className="form-label"
                          style={{ fontWeight: 600, fontSize: 13 }}
                        >
                          Email *
                        </label>
                        <input
                          className="form-control"
                          type="email"
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                          placeholder="name@example.com"
                        />
                      </div>
                      <div
                        className="col-md-6"
                        style={{ position: "relative" }}
                      >
                        <label
                          className="form-label"
                          style={{ fontWeight: 600, fontSize: 13 }}
                        >
                          Phone
                        </label>
                        <input
                          name="fullphone"
                          type="text"
                          defaultValue=""
                          style={{ display: "none" }}
                          ref={phoneRef}
                        />
                        <input type="hidden" name="country_code" />
                        <input
                          className="form-control"
                          type="text"
                          name="phone"
                          id="phone"
                          value={form.number}
                          onChange={(e) =>
                            setForm({ ...form, number: e.target.value })
                          }
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-12">
                        <label
                          className="form-label"
                          style={{ fontWeight: 600, fontSize: 13 }}
                        >
                          {form.mem_id
                            ? "New password (leave blank to keep current)"
                            : "Password *"}
                        </label>
                        <input
                          className="form-control"
                          type="password"
                          value={form.password}
                          autoComplete="new-password"
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                          placeholder={
                            form.mem_id
                              ? "Leave blank to keep current"
                              : "At least 4 characters"
                          }
                        />
                      </div>

                      {/* ---- Page permissions ---- */}
                      <div className="col-12">
                        <div className="ad-perm-head">
                          <div>
                            <h6>Page Permissions</h6>
                            <small className="text-muted">
                              {form.status === "X"
                                ? "A super admin has unrestricted access to open every page and execute all actions."
                                : "Choose what this admin can do on each panel page. Every action also grants View."}
                            </small>
                          </div>
                          {form.status === "Y" && (
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                style={{
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                                onClick={() => setPerms(fullMap())}
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                style={{
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                                onClick={() =>
                                  setPerms(
                                    Object.fromEntries(
                                      allPages.map((p) => [
                                        p.key,
                                        ["view"] as PermAction[],
                                      ]),
                                    ),
                                  )
                                }
                              >
                                View only
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                style={{
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                                onClick={() => setPerms({})}
                              >
                                Clear all
                              </button>
                            </div>
                          )}
                        </div>

                        {form.status === "X" ? (
                          <div className="ad-perm-all">
                            ✔ Full access to all {allPages.length} pages enabled
                            for Super Admin.
                          </div>
                        ) : (
                          <>
                            {legacyFull && (
                              <div
                                className="alert alert-warning py-2 small"
                                style={{ borderRadius: 10 }}
                              >
                                This admin was added before page permissions
                                existed and currently has full access. Saving
                                applies the permissions ticked below.
                              </div>
                            )}
                            <div className="ad-perm-groups">
                              {catalogue.map((g) => {
                                const st = groupState(g);
                                const onPages = g.pages.filter(
                                  (p) => (perms[p.key] || []).length,
                                ).length;
                                return (
                                  <div
                                    key={g.group}
                                    className={
                                      "ad-pg-group" +
                                      (st.all || st.some ? " on" : "")
                                    }
                                  >
                                    <div className="ad-pg-ghead">
                                      <label>
                                        <input
                                          type="checkbox"
                                          checked={st.all}
                                          ref={(el) => {
                                            if (el) el.indeterminate = st.some;
                                          }}
                                          onChange={() => toggleGroup(g)}
                                        />
                                        {g.group}
                                      </label>
                                      <span
                                        className="cnt"
                                        title="Pages this admin can open"
                                      >
                                        {onPages} / {g.pages.length}
                                      </span>
                                    </div>
                                    <div className="ad-pg-cards">
                                      {g.pages.map((pg) => {
                                        const n = pg.actions.filter((a) =>
                                          has(pg.key, a.key),
                                        ).length;
                                        return (
                                          <div
                                            key={pg.key}
                                            className={
                                              "ad-pg-card" + (n ? " on" : "")
                                            }
                                          >
                                            <div className="ad-pg-top">
                                              <label
                                                className="ad-pg-name"
                                                title="Access to this page (View)"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={n > 0}
                                                  onChange={() =>
                                                    togglePageAccess(pg.key)
                                                  }
                                                />
                                                {pg.label}
                                              </label>
                                              {pg.actions.length > 1 && (
                                                <label className="ad-pg-all">
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      n === pg.actions.length
                                                    }
                                                    ref={(el) => {
                                                      if (el)
                                                        el.indeterminate =
                                                          n > 0 &&
                                                          n < pg.actions.length;
                                                    }}
                                                    onChange={() =>
                                                      togglePage(pg.key)
                                                    }
                                                  />
                                                  All
                                                </label>
                                              )}
                                            </div>
                                            <div className="ad-pg-body">
                                              <div>
                                                {pg.desc && (
                                                  <div className="ad-pg-desc">
                                                    {pg.desc}
                                                  </div>
                                                )}
                                                {pg.parent && (
                                                  <small className="ad-pg-sub">
                                                    Inside{" "}
                                                    {pageLabel(pg.parent)} —
                                                    also gives its View
                                                  </small>
                                                )}
                                                {!pg.parent &&
                                                  innerPagesOf(pg.key).length >
                                                    0 && (
                                                    <small className="ad-pg-sub">
                                                      Opens{" "}
                                                      {innerPagesOf(pg.key)
                                                        .map((p) => p.label)
                                                        .join(", ")}
                                                    </small>
                                                  )}
                                              </div>
                                              <div className="ad-perm-acts">
                                                {pg.actions.map((a) => (
                                                  <label
                                                    key={a.key}
                                                    className={
                                                      has(pg.key, a.key)
                                                        ? "on"
                                                        : ""
                                                    }
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      checked={has(
                                                        pg.key,
                                                        a.key,
                                                      )}
                                                      onChange={() =>
                                                        toggle(pg.key, a.key)
                                                      }
                                                    />
                                                    {a.label}
                                                  </label>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </form>
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
                      style={{
                        borderRadius: 10,
                        padding: "8px 18px",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                      disabled={busy}
                      onClick={closeModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="adminer-form"
                      className="btn"
                      style={{
                        background: "var(--ad-brand)",
                        color: "#fff",
                        borderRadius: 10,
                        padding: "8px 22px",
                        fontWeight: 600,
                        fontSize: 13,
                        border: "none",
                      }}
                      disabled={busy}
                    >
                      {busy
                        ? "Saving..."
                        : form.mem_id
                          ? "Update Adminer"
                          : "Add Adminer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
