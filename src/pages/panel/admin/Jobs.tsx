import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Head, SERVER_URL } from "../../../components/Includes";
import { getSeoByPath } from "../../../utils/seo";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Briefcase,
  Plus,
  RotateCw,
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  Download,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

type Job = {
  id: number;
  req_id: string;
  slug: string;
  title: string;
  location: string;
  jtype: string;
  department: string;
  experience: string;
  salary: string;
  short_desc: string;
  description: string;
  status: string;
  datetime: number;
  applications: number;
};
type Appn = {
  id: number;
  name: string;
  email: string;
  phone: string;
  cover: string;
  resume: string;
  status: string;
  datetime: number;
};

const JTYPES = ["Full-time", "Part-time", "Contract", "Internship", "Remote"];
const PAGE_SIZE = 10;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export default function Jobs() {
  const permCan = usePagePerm("jobs");
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "builder" | "apps">("list");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobPage, setJobPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const empty = {
    req_id: "",
    slug: "",
    title: "",
    location: "",
    jtype: "Full-time",
    department: "",
    experience: "",
    salary: "",
    short_desc: "",
    description: "",
    status: "1",
  };
  const [job, setJob] = useState<typeof empty>(empty);
  const [slugTouched, setSlugTouched] = useState(false);

  // applications view
  const [appsJob, setAppsJob] = useState<Job | null>(null);
  const [apps, setApps] = useState<Appn[]>([]);
  const [appsBase, setAppsBase] = useState("");
  const [appsSearch, setAppsSearch] = useState("");
  const [appsPage, setAppsPage] = useState(1);
  const [appsLoading, setAppsLoading] = useState(false);

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;
  // List reads come from the saved copy when there is one (utils/listCache.ts)
  const LIST_READS = ["api/jobs/list", "api/jobs/get", "api/jobs/applications"];
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

  const loadJobs = async () => {
    setLoading(true);
    try {
      const r = await post("api/jobs/list", { n: 1, s: "New" });
      if (r.success) {
        setJobs(r.data || []);
        setJobPage(1);
      } else toast.error(r.message || "Failed to load jobs");
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const initchecklogin = async () => {
    try {
      const res = await axios.get(SERVER_URL + "api/check-login", {
        withCredentials: true,
      });
      if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y"))
        loadJobs();
      else navigate("/logout");
    } catch {
      navigate("/logout");
    }
  };
  useEffect(() => {
    initchecklogin();
  }, []);

  const newJob = () => {
    setJob(empty);
    setSlugTouched(false);
    setView("builder");
  };
  const editJob = async (req_id: string) => {
    try {
      const r = await post("api/jobs/get", { req_id });
      if (!r.success) return toast.error(r.message);
      const j = r.data;
      setJob({
        req_id: j.req_id,
        slug: j.slug,
        title: j.title,
        location: j.location || "",
        jtype: j.jtype || "Full-time",
        department: j.department || "",
        experience: j.experience || "",
        salary: j.salary || "",
        short_desc: j.short_desc || "",
        description: j.description || "",
        status: j.status || "1",
      });
      setSlugTouched(true);
      setView("builder");
    } catch {
      toast.error("Failed to open job");
    }
  };

  const saveJob = async () => {
    if (!job.title.trim()) return toast.error("Please enter a job title");
    setBusy(true);
    try {
      const r = await post("api/jobs/save", {
        ...job,
        slug: slugify(job.slug || job.title),
      });
      if (r.success) {
        toast.success(r.message);
        setView("list");
        loadJobs();
      } else toast.error(r.message);
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleJob = async (row: Job) => {
    try {
      const r = await post("api/jobs/toggle", { req_id: row.req_id });
      if (r.success) {
        toast.success(r.message);
        setJobs((j) =>
          j.map((x) =>
            x.req_id === row.req_id ? { ...x, status: r.status } : x,
          ),
        );
      } else toast.error(r.message);
    } catch {
      toast.error("Failed");
    }
  };

  const deleteJob = async (row: Job) => {
    if (
      !window.confirm(
        `Delete job "${row.title}" and all ${row.applications} application(s)? This cannot be undone.`,
      )
    )
      return;
    try {
      const r = await post("api/jobs/delete", { req_id: row.req_id });
      if (r.success) {
        toast.success(r.message);
        setJobs((j) => j.filter((x) => x.req_id !== row.req_id));
      } else toast.error(r.message);
    } catch {
      toast.error("Delete failed");
    }
  };

  const loadApps = async (row: Job) => {
    setAppsLoading(true);
    try {
      const r = await post("api/jobs/applications", { req_id: row.req_id });
      if (r.success) {
        setApps(r.data || []);
        setAppsBase(r.base || "");
      } else toast.error(r.message);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setAppsLoading(false);
    }
  };

  const openApps = (row: Job) => {
    setAppsJob(row);
    setApps([]);
    setAppsSearch("");
    setAppsPage(1);
    setView("apps");
    loadApps(row);
  };

  const tsDate = (ts: number) =>
    ts ? new Date(ts * 1000).toLocaleString("en-IN") : "—";
  const publicUrl = (slug: string) =>
    `${window.location.origin}/careers/${slug}`;

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (
        q &&
        !`${j.title} ${j.department} ${j.location}`.toLowerCase().includes(q)
      )
        return false;
      if (statusFilter === "active" && j.status !== "1") return false;
      if (statusFilter === "disabled" && j.status === "1") return false;
      if (statusFilter === "applications" && Number(j.applications || 0) <= 0)
        return false;
      return true;
    });
  }, [jobs, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const jobPageSafe = Math.min(jobPage, totalPages);
  const jobRows = filteredJobs.slice(
    (jobPageSafe - 1) * PAGE_SIZE,
    jobPageSafe * PAGE_SIZE,
  );

  // Filtered applications
  const filteredApps = useMemo(() => {
    const q = appsSearch.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) =>
      `${a.name} ${a.email} ${a.phone}`.toLowerCase().includes(q),
    );
  }, [apps, appsSearch]);

  const appsTotalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const appsPageSafe = Math.min(appsPage, appsTotalPages);
  const appRows = filteredApps.slice(
    (appsPageSafe - 1) * PAGE_SIZE,
    appsPageSafe * PAGE_SIZE,
  );

  const totalAppsCount = useMemo(
    () => jobs.reduce((sum, j) => sum + (j.applications || 0), 0),
    [jobs],
  );
  const activeJobsCount = useMemo(
    () => jobs.filter((j) => j.status === "1").length,
    [jobs],
  );

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
          cursor: pointer;
          user-select: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.kpi-purple.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
        }
        .si-stat-card.kpi-green.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.kpi-amber.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.kpi-blue.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
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

      {/* Main Content */}
      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper">
          {/* ============ LIST VIEW ============ */}
          {view === "list" && (
            <>
              {/* Header */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <div className="si-header-title-row">
                      <h3 className="si-header-title">Career Jobs</h3>
                      <span className="si-total-badge">
                        Total <b>{jobs.length}</b>
                      </span>
                    </div>
                    <p className="si-header-subtitle">
                      Post and manage job career openings displayed on{" "}
                      <code>/careers</code>.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  {permCan("create") && (
                    <button className="si-btn-primary" onClick={newJob}>
                      <Plus size={16} /> Post a Job
                    </button>
                  )}
                </div>
              </div>

              {/* Stats KPI Grid */}
              <div className="si-stats-grid">
                <div
                  className={`si-stat-card kpi-purple ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter("all");
                    setJobPage(1);
                  }}
                  title="Show all job postings"
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper purple">
                    <Briefcase size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Total Postings</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={jobs.length} pending={loading} id="Jobs-s1" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card kpi-green ${statusFilter === "active" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "active" ? "all" : "active",
                    );
                    setJobPage(1);
                  }}
                  title={
                    statusFilter === "active"
                      ? "Click to show all jobs"
                      : "Filter by active openings"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper green">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Active Openings</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={activeJobsCount} pending={loading} id="Jobs-s2" /></h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card kpi-amber ${statusFilter === "disabled" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "disabled" ? "all" : "disabled",
                    );
                    setJobPage(1);
                  }}
                  title={
                    statusFilter === "disabled"
                      ? "Click to show all jobs"
                      : "Filter by closed openings"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper amber">
                    <XCircle size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Closed Openings</span>
                    <h4 className="si-stat-value">
                      <AnimatedNumber value={jobs.length - activeJobsCount} pending={loading} id="Jobs-s3" />
                    </h4>
                  </div>
                </div>

                <div
                  className={`si-stat-card kpi-blue ${statusFilter === "applications" ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev === "applications" ? "all" : "applications",
                    );
                    setJobPage(1);
                  }}
                  title={
                    statusFilter === "applications"
                      ? "Click to show all jobs"
                      : "Filter jobs with applications"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="si-stat-icon-wrapper blue">
                    <Users size={20} />
                  </div>
                  <div className="si-stat-content">
                    <span className="si-stat-label">Total Applications</span>
                    <h4 className="si-stat-value"><AnimatedNumber value={totalAppsCount} pending={loading} id="Jobs-s4" /></h4>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <div className="si-filter-select-wrapper">
                  <select
                    className="si-filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setJobPage(1);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Openings</option>
                    <option value="disabled">Closed / Disabled</option>
                    <option value="applications">Has Applications</option>
                  </select>
                </div>

                <ListSearch
                  placeholder="Search by job title, department, location…"
                  value={search}
                  onChange={(e) => {
                      setSearch(e.target.value);
                      setJobPage(1);
                    }}
                />

                <div className="ms-auto d-flex align-items-center gap-2">
                  <button data-refresh
                    className="reload-btn"
                    title="Refresh"
                    onClick={loadJobs}
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
                        <th className="si-th">Job Title & Details</th>
                        <th className="si-th">Department</th>
                        <th className="si-th">Job Type</th>
                        <th className="si-th">Location</th>
                        <th className="si-th">Applications</th>
                        <th className="si-th">Status</th>
                        <th className="si-th text-end" style={{ width: 170 }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {loading ? (
                        <SkeletonRows />
                      ) : jobRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-5 text-muted"
                          >
                            No job openings found. Click “Post a Job” to create
                            one.
                          </td>
                        </tr>
                      ) : (
                        jobRows.map((j) => (
                          <tr key={j.req_id} className="si-tr">
                            <td className="si-td">
                              <div>
                                <div
                                  className="fw-bold text-dark"
                                  style={{ fontSize: "14px" }}
                                >
                                  {j.title}
                                </div>
                                <div className="d-flex align-items-center gap-2 mt-1">
                                  <a
                                    href={publicUrl(j.slug)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="d-flex align-items-center gap-1"
                                    style={{
                                      fontSize: "12px",
                                      color: "var(--ad-brand)",
                                      textDecoration: "none",
                                    }}
                                  >
                                    /careers/{j.slug} <ExternalLink size={12} />
                                  </a>
                                  {j.experience && (
                                    <span
                                      className="text-muted"
                                      style={{ fontSize: "11.5px" }}
                                    >
                                      · {j.experience}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background: "#f1f5f9",
                                  color: "#334155",
                                }}
                              >
                                {j.department || "General"}
                              </span>
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background: "#ede9fe",
                                  color: "var(--ad-brand)",
                                  fontWeight: 600,
                                }}
                              >
                                {j.jtype}
                              </span>
                            </td>

                            <td
                              className="si-td text-muted"
                              style={{ fontSize: "13px" }}
                            >
                              <span className="d-flex align-items-center gap-1">
                                <MapPin size={13} className="text-muted" />{" "}
                                {j.location || "Remote"}
                              </span>
                            </td>

                            <td className="si-td">
                              <button
                                className="btn btn-sm btn-link p-0 fw-bold d-flex align-items-center gap-1"
                                style={{
                                  color: "var(--ad-brand)",
                                  textDecoration: "none",
                                  fontSize: "13px",
                                }}
                                onClick={() => openApps(j)}
                              >
                                <Users size={14} /> {j.applications} applied
                              </button>
                            </td>

                            <td className="si-td">
                              <span
                                className="si-status-pill"
                                style={{
                                  background:
                                    j.status === "1" ? "#dcfce7" : "#fee2e2",
                                  color:
                                    j.status === "1" ? "#166534" : "#991b1b",
                                }}
                              >
                                <span
                                  className="si-status-dot"
                                  style={{
                                    background:
                                      j.status === "1" ? "#16a34a" : "#dc2626",
                                  }}
                                />
                                {j.status === "1" ? "Active" : "Closed"}
                              </span>
                            </td>

                            <td className="si-td text-end">
                              <div className="d-inline-flex align-items-center gap-1">
                                {permCan("edit") && (
                                  <button
                                    className="si-action-btn view"
                                    title="Edit Job"
                                    onClick={() => editJob(j.req_id)}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {permCan("edit") && (
                                  <button
                                    className={`btn btn-sm ${
                                      j.status === "1"
                                        ? "btn-outline-warning"
                                        : "btn-outline-success"
                                    }`}
                                    style={{
                                      borderRadius: "8px",
                                      fontSize: "11.5px",
                                      fontWeight: 600,
                                      padding: "3px 8px",
                                    }}
                                    onClick={() => toggleJob(j)}
                                  >
                                    {j.status === "1" ? "Close" : "Open"}
                                  </button>
                                )}
                                {permCan("delete") && (
                                  <button
                                    className="si-action-btn delete"
                                    title="Delete Job"
                                    onClick={() => deleteJob(j)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredJobs.length > 0 && totalPages > 1 && (
                  <div className="si-table-footer">
                    <div className="si-table-info">
                      Showing {(jobPageSafe - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(jobPageSafe * PAGE_SIZE, filteredJobs.length)}{" "}
                      of {filteredJobs.length} jobs
                    </div>
                    <div className="si-pagination">
                      <button
                        className="si-page-nav-btn"
                        disabled={jobPageSafe <= 1}
                        onClick={() => setJobPage(jobPageSafe - 1)}
                      >
                        « Prev
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - jobPageSafe) <= 2,
                        )
                        .map((p, idx, arr) => (
                          <span key={p} className="d-flex align-items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-muted">…</span>
                            )}
                            <button
                              className={`si-page-btn ${p === jobPageSafe ? "active" : ""}`}
                              onClick={() => setJobPage(p)}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        className="si-page-nav-btn"
                        disabled={jobPageSafe >= totalPages}
                        onClick={() => setJobPage(jobPageSafe + 1)}
                      >
                        Next »
                      </button>
                    </div>
                  </div>
                )}
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/jobs/list" />
                </div>
              </div>
            </>
          )}

          {/* ============ BUILDER VIEW ============ */}
          {view === "builder" && (
            <>
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      {job.req_id ? "Edit Job Posting" : "Post a New Job"}
                    </h3>
                    <p className="si-header-subtitle">
                      Fill in the job details, criteria, and role description.
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  <button
                    className="si-btn-outline"
                    onClick={() => setView("list")}
                  >
                    <ArrowLeft size={16} /> Back to Openings
                  </button>
                </div>
              </div>

              <div
                className="card shadow-sm border-0 p-4 mb-4"
                style={{ borderRadius: "16px", background: "#fff" }}
              >
                <div className="row g-3">
                  <div className="col-md-6">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Job Title *
                    </label>
                    <input
                      className="form-control"
                      value={job.title}
                      placeholder="e.g. Senior AI / GenAI Engineer"
                      onChange={(e) =>
                        setJob({
                          ...job,
                          title: e.target.value,
                          slug: slugTouched
                            ? job.slug
                            : slugify(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Job URL Slug *
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">/careers/</span>
                      <input
                        className="form-control"
                        value={job.slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setJob({ ...job, slug: slugify(e.target.value) });
                        }}
                      />
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Department
                    </label>
                    <input
                      className="form-control"
                      value={job.department}
                      placeholder="e.g. Engineering, Sales, Product"
                      onChange={(e) =>
                        setJob({ ...job, department: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Job Type
                    </label>
                    <select
                      className="form-select"
                      value={job.jtype}
                      onChange={(e) =>
                        setJob({ ...job, jtype: e.target.value })
                      }
                    >
                      {JTYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Location
                    </label>
                    <input
                      className="form-control"
                      value={job.location}
                      placeholder="e.g. Bengaluru, India or Remote"
                      onChange={(e) =>
                        setJob({ ...job, location: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Experience Required
                    </label>
                    <input
                      className="form-control"
                      value={job.experience}
                      placeholder="e.g. 3–5 years"
                      onChange={(e) =>
                        setJob({ ...job, experience: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Salary Range (Optional)
                    </label>
                    <input
                      className="form-control"
                      value={job.salary}
                      placeholder="e.g. ₹15 LPA - ₹25 LPA or Competitive"
                      onChange={(e) =>
                        setJob({ ...job, salary: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Status
                    </label>
                    <select
                      className="form-select"
                      value={job.status}
                      onChange={(e) =>
                        setJob({ ...job, status: e.target.value })
                      }
                    >
                      <option value="1">Active (Open for applications)</option>
                      <option value="0">Closed</option>
                    </select>
                  </div>

                  <div className="col-12">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Short Summary
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={job.short_desc}
                      placeholder="A quick 1-2 sentence overview of the role"
                      onChange={(e) =>
                        setJob({ ...job, short_desc: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-12">
                    <label
                      className="form-label fw-semibold"
                      style={{ fontSize: "13px" }}
                    >
                      Full Job Description & Requirements
                    </label>
                    <textarea
                      className="form-control"
                      rows={8}
                      value={job.description}
                      placeholder="Responsibilities, requirements, perks..."
                      onChange={(e) =>
                        setJob({ ...job, description: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-12 mt-4 d-flex gap-2">
                    {permCan("create", "edit") && (
                      <button
                        className="si-btn-primary"
                        disabled={busy}
                        onClick={saveJob}
                      >
                        {busy
                          ? "Saving…"
                          : job.req_id
                            ? "Update Job"
                            : "Publish Job Opening"}
                      </button>
                    )}
                    <button
                      className="si-btn-outline"
                      onClick={() => setView("list")}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============ APPLICATIONS VIEW ============ */}
          {view === "apps" && appsJob && (
            <>
              <div className="si-header-container">
                <div className="si-header-left">
                  <div className="si-header-icon-box">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="si-header-title">
                      Applications — {appsJob.title}
                    </h3>
                    <p className="si-header-subtitle">
                      {appsLoading && apps.length === 0
                        ? appsJob.applications
                        : apps.length}{" "}
                      applicant(s) for this position ·{" "}
                      <a
                        href={publicUrl(appsJob.slug)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--ad-brand)" }}
                      >
                        View live opening
                      </a>
                    </p>
                  </div>
                </div>
                <div className="si-header-right">
                  <button
                    className="si-btn-outline"
                    onClick={() => setView("list")}
                  >
                    <ArrowLeft size={16} /> Back to Jobs
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="si-filter-bar">
                <ListSearch
                  placeholder="Search applicant name, email, phone…"
                  value={appsSearch}
                  onChange={(e) => {
                    setAppsSearch(e.target.value);
                    setAppsPage(1);
                  }}
                />

                <div className="ms-auto d-flex align-items-center gap-2">
                  <button data-refresh
                    className="reload-btn"
                    title="Refresh"
                    onClick={() => loadApps(appsJob)}
                    disabled={appsLoading}
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
                        <th className="si-th" style={{ width: 50 }}>
                          #
                        </th>
                        <th className="si-th">Applicant</th>
                        <th className="si-th">Contact Info</th>
                        <th className="si-th">Cover Note</th>
                        <th className="si-th">Applied On</th>
                        <th
                          className="si-th text-center"
                          style={{ width: 100 }}
                        >
                          Resume
                        </th>
                      </tr>
                    </thead>
                    <tbody className="si-tbody">
                      {appsLoading ? (
                        <SkeletonRows />
                      ) : filteredApps.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center py-5 text-muted"
                          >
                            {appsSearch
                              ? "No applicants match your search."
                              : "No applications received yet for this job."}
                          </td>
                        </tr>
                      ) : (
                        appRows.map((a, i) => (
                          <tr key={a.id} className="si-tr">
                            <td
                              className="si-td text-muted fw-semibold"
                              style={{ fontSize: "13px" }}
                            >
                              {(appsPageSafe - 1) * PAGE_SIZE + i + 1}
                            </td>
                            <td
                              className="si-td fw-bold text-dark"
                              style={{ fontSize: "13.5px" }}
                            >
                              {a.name}
                            </td>
                            <td className="si-td">
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#1e293b",
                                }}
                              >
                                {a.email}
                              </div>
                              <small
                                className="text-muted"
                                style={{ fontSize: "12px" }}
                              >
                                {a.phone || "—"}
                              </small>
                            </td>
                            <td
                              className="si-td"
                              style={{ fontSize: "12.5px", maxWidth: 280 }}
                            >
                              <div
                                style={{
                                  whiteSpace: "pre-wrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {a.cover || (
                                  <span className="text-muted">—</span>
                                )}
                              </div>
                            </td>
                            <td
                              className="si-td text-muted"
                              style={{ fontSize: "12.5px" }}
                            >
                              {tsDate(a.datetime)}
                            </td>
                            <td className="si-td text-center">
                              {a.resume ? (
                                <a
                                  href={appsBase +"/uploads/"+ a.resume}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-primary"
                                  style={{
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    padding: "4px 10px",
                                  }}
                                >
                                  <Download size={13} className="me-1" /> Resume
                                </a>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredApps.length > 0 && (
                  <div className="si-table-footer">
                    <div className="si-table-info">
                      Showing {(appsPageSafe - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(appsPageSafe * PAGE_SIZE, filteredApps.length)}{" "}
                      of {filteredApps.length} applications
                      {filteredApps.length !== apps.length &&
                        ` (filtered from ${apps.length})`}
                    </div>
                    {appsTotalPages > 1 && (
                      <div className="si-pagination">
                        <button
                          className="si-page-nav-btn"
                          disabled={appsPageSafe <= 1}
                          onClick={() => setAppsPage(appsPageSafe - 1)}
                        >
                          « Prev
                        </button>
                        {Array.from({ length: appsTotalPages }, (_, i) => i + 1)
                          .filter(
                            (p) =>
                              p === 1 ||
                              p === appsTotalPages ||
                              Math.abs(p - appsPageSafe) <= 2,
                          )
                          .map((p, idx, arr) => (
                            <span key={p} className="d-flex align-items-center">
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span className="px-1 text-muted">…</span>
                              )}
                              <button
                                className={`si-page-btn ${p === appsPageSafe ? "active" : ""}`}
                                onClick={() => setAppsPage(p)}
                              >
                                {p}
                              </button>
                            </span>
                          ))}
                        <button
                          className="si-page-nav-btn"
                          disabled={appsPageSafe >= appsTotalPages}
                          onClick={() => setAppsPage(appsPageSafe + 1)}
                        >
                          Next »
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/jobs/applications" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
