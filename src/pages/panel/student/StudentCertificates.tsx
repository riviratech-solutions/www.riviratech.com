import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  Award,
  Plus,
  RotateCw,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  GraduationCap,
  BookOpen,
  ArrowLeft,
  User,
  Phone,
  Mail,
  Send,
  Download,
  Layers,
  ArrowUpDown,
  Tag,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { AnimatedNumber, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

// Same choices as the website request form (CertificateRequest.tsx)
const CERT_FOR = [
  { value: "course", label: "Course completion" },
  { value: "internship", label: "Internship" },
  { value: "project", label: "Project" },
  { value: "bootcamp", label: "Bootcamp" },
];

export default function StudentCertificates() {
  const navigate = useNavigate();
  const location = useLocation();

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [cform, setcForm] = useState({
    name: "",
    gender: "",
    phone: "",
    email: "",
    type: "",
    course: "",
    batch: "",
  });

  const [ploading, setpLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"board" | "view" | "apply">("board");

  const initialForm = {
    id: "",
    mem_id: "",
    req_id: "",
    name: "",
    gender: "",
    email: "",
    number: "",
    type: "",
    batch: "",
    course: "",
    batch_name: "",
    course_name: "",
    sdate: "",
    edate: "",
    reason: "",
    datetime: "",
    updatetime: "",
    status: "",
  };

  const [form, setForm] = useState(initialForm);

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str ?? "";
    return txt.value;
  }

  const formatDateTime = (ts: any) => {
    if (!ts) return "—";
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [lastPage, setLastPage] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  const formatDate = (ts: any) => {
    if (!ts || ts === "-" || ts === "0") return "-";
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
      const dateObj = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      return dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return "-";
  };

  const getGender = (g: any) => {
    return g === "1"
      ? "Male"
      : g === "2"
        ? "Female"
        : g === "3"
          ? "Prefer not to disclose"
          : "-";
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "1":
        return "Pending";
      case "2":
        return "Approved";
      case "0":
        return "Rejected";
      default:
        return "Unknown";
    }
  };

  const getCourseNameById = (id: string) => {
    if (!id || courses.length === 0) return "";
    const course = courses.find((c) => c.req_id === id);
    return course ? decodeHtml(course.title) : "";
  };

  const getBatchNameById = (id: string) => {
    if (!id || batches.length === 0) return "";
    const batch = batches.find((c) => c.b_id === id);
    return batch ? decodeHtml(batch.name) : "";
  };

  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {
          status: "",
        });
      if (res.data.success) {
        setCourses(res.data.data);
      }
    } catch {
      // ignore
    }
  };

  const loadBatches = async () => {
    try {
      const res = await listFetch("api/get-batches", {
          c_id: "",
          status: "",
        });
      if (res.data.success) {
        setBatches(res.data.data);
      }
    } catch {
      // ignore
    }
  };

  const loadDetails = async (p = 1, q = "", s = "New") => {
    setLoading(true);
    setPage(p);
    setSearch(q);
    setSort(s);

    await loadCourses();
    await loadBatches();

    try {
      const res = await listFetch("api/certificates", {
          q: q,
          s: s,
          n: p,
        });

      if (res.data.success) {
        setAllLists(res.data.data || []);
        setTotal(res.data.total || 0);
        setLastPage(res.data.lastPage || 0);
      } else {
        toast.error(res.data.message || "Failed to load certificates");
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const [myprofile, setmyprofile] = useState<any[]>([]);
  const loadMyProfile = async () => {
    try {
      setpLoading(true);
      const res = await listFetch("api/get-myprofile", {
          status: "",
        });

      if (res.data.success && res.data.data?.[0]) {
        const profile = res.data.data[0];
        setmyprofile(res.data.data);
        setcForm({
          name: profile.name || "",
          gender: profile.gender || "",
          phone: profile.number || "",
          email: profile.email || "",
          type: "",
          course: "",
          batch: "",
        });
      }
    } catch (err: any) {
      setError(err?.message || "Error loading profile");
    } finally {
      setpLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setcForm((f) => ({
      ...f,
      [name]: value,
      ...(name === "course" ? { batch: "" } : {}),
    }));
  };

  // Full international number ("+" + dial code + digits), written by the
  // phoneinput.js country picker into the hidden [name="fullphone"] field.
  const phoneRef = useRef<HTMLInputElement>(null);

  // Phone: digits only — the country code comes from the flag picker. A full
  // number ("+91…", e.g. from the profile) is handed to the picker, which
  // selects that country and leaves just the local number in the box.
  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target as any;
    const raw = String(el.value || "");
    if (/^\s*\+/.test(raw) && el._phoneInput) {
      el._phoneInput._hydrate(); // re-fires this handler with the local digits
      if (!/^\s*\+/.test(String(el.value || ""))) return;
    }
    setcForm((f) => ({ ...f, phone: raw.replace(/\D/g, "").slice(0, 15) }));
  };

  // The picker on the request form (form.adminphone #phone)
  useEffect(() => {
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
      if (piCss.parentNode) piCss.parentNode.removeChild(piCss);
      if (piJs.parentNode) piJs.parentNode.removeChild(piJs);
    };
  }, []);

  useEffect(() => {
    if (mode !== "apply") return;
    (window as any).PhoneInput?.initAll?.();
    // a saved number with its country code: let the picker split it
    if (/^\s*\+/.test(cform.phone)) {
      const el = document.querySelector("form.adminphone #phone") as any;
      el?._phoneInput?._hydrate();
      // React puts the old value back for a moment while it updates; sync the
      // hidden full number again once the box shows just the local digits
      setTimeout(() => el?._phoneInput?.sync?.(), 0);
    }
  }, [mode, cform.phone]);

  // batches of the chosen course (deleted ones left out)
  const courseBatches = batches.filter(
    (b) => cform.course && b.c_id === cform.course && b.status !== "1D",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!cform.name.trim()) return setError("❌ Please enter your full name.");
    if (!cform.gender) return setError("❌ Please select your gender.");
    const phoneDigits = cform.phone.replace(/\D/g, "");
    if (phoneDigits.length < 6 || phoneDigits.length > 15)
      return setError("❌ Please enter a valid phone number.");
    if (!/^\S+@\S+\.\S+$/.test(cform.email))
      return setError("❌ Please enter a valid email address.");
    if (!cform.type) return setError("❌ Please select certificate type.");
    if (!cform.course) return setError("❌ Please select your course.");

    try {
      setLoading(true);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/certificate-request",
        {
          ...cform,
          fullphone: phoneRef.current?.value?.trim() || cform.phone,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        setSuccess(
          res.data.message || "Certificate request submitted successfully!",
        );
        toast.success(res.data.message || "Request submitted successfully!");
        setAllLists((prev) => [res.data.data, ...prev]);
        setTotal((prev) => prev + 1);
        setcForm({
          name: "",
          gender: "",
          phone: "",
          email: "",
          type: "",
          course: "",
          batch: "",
        });
        setTimeout(() => {
          setMode("board");
          loadDetails(1, "", "New");
        }, 1200);
      } else {
        toast.error(res.data.message || "Failed to submit request");
        setError(res.data.message);
      }
    } catch {
      setError("❌ Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const moveto = async (targetMode: "board" | "view" | "apply") => {
    setSuccess("");
    setError("");
    setMode(targetMode);

    if (targetMode === "apply") {
      setForm(initialForm);
      if (myprofile.length === 0) {
        await loadMyProfile();
      } else {
        setcForm({
          name: myprofile[0].name || "",
          gender: myprofile[0].gender || "",
          phone: myprofile[0].number || "",
          email: myprofile[0].email || "",
          type: "",
          course: "",
          batch: "",
        });
      }
    }
  };

  const updateto = (type: "view", list: any) => {
    setForm({
      id: list.id,
      req_id: list.req_id,
      mem_id: list.effective_mem_id || list.mem_id,
      name: list.name,
      gender: list.gender,
      email: list.email,
      number: list.number,
      type: list.type,
      course: list.course,
      batch: list.batch,
      batch_name: list.batch_name,
      course_name: list.course_name,
      sdate: list.sdate,
      edate: list.edate,
      reason: list.reason,
      datetime: list.datetime,
      updatetime: list.updatetime,
      status: list.status,
    });
    setMode(type);
  };

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    if (data.loggedIn && data.id === "1") {
      loadDetails();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("t");
    if (type === "apply") {
      setMode("apply");
    }
    initchecklogin();
  }, []);

  const totalApproved = alllists.filter((l) => String(l.status) === "2").length;
  const totalPending = alllists.filter((l) => String(l.status) === "1").length;

  const displayedLists = alllists.filter((l) => {
    if (statusFilter === "2") return String(l.status) === "2";
    if (statusFilter === "1") return String(l.status) === "1";
    return true;
  });

  return (
    <>
      <Head
        pageTitle={seo.title || "My Certificates - Student Portal"}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />

      <div className="content">
        {/* ===================== MODE: BOARD (LIST) ===================== */}
        {mode === "board" && (
          <div className="container-fluid p-4 si-wrapper">
            {/* Header Bar */}
            <div className="si-header-card">
              <div className="si-header-left">
                <div className="si-header-icon-box">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="si-header-title">My Certificates</h3>
                  <p className="si-header-subtitle">
                    Request, track and download official course & internship
                    completion certificates.
                  </p>
                </div>
              </div>

              <div className="si-header-right">
                <span className="si-total-count-text">
                  Total Records: <b>{listtotal}</b>
                </span>
                <button data-refresh
                  type="button"
                  className="si-btn-export-excel"
                  onClick={() => loadDetails(page, search, sort)}
                  disabled={loading}
                  title="Refresh Certificates"
                >
                  <RotateCw size={14} className={loading ? "si-spin" : ""} />{" "}
                  Refresh
                </button>
                <button
                  type="button"
                  className="si-btn-export-csv"
                  onClick={() => moveto("apply")}
                >
                  <Plus size={16} /> Request Certificate
                </button>
              </div>
            </div>

            {/* Stats KPI Cards */}
            <div className="si-stats-grid">
              {/* Total Applied */}
              <div
                className={`si-stat-card card-total ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
                title="Show all requested certificates"
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#e0f2fe", color: "#0284c7" }}
                >
                  <Layers size={22} />
                </div>
                <div>
                  <p className="si-stat-label">Total Applied</p>
                  <h3 className="si-stat-value">
                    <AnimatedNumber value={listtotal || alllists.length} pending={loading} id="StudentCertificates-s1" />
                  </h3>
                </div>
              </div>

              {/* Approved / Issued */}
              <div
                className={`si-stat-card card-approved ${statusFilter === "2" ? "active" : ""}`}
                onClick={() =>
                  setStatusFilter((prev) => (prev === "2" ? "ALL" : "2"))
                }
                title={
                  statusFilter === "2"
                    ? "Click to clear filter"
                    : "Filter by Approved & Issued"
                }
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#dcfce7", color: "#16a34a" }}
                >
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <p className="si-stat-label">Approved & Issued</p>
                  <h3 className="si-stat-value"><AnimatedNumber value={totalApproved} pending={loading} id="StudentCertificates-s2" /></h3>
                </div>
              </div>

              {/* Pending Review */}
              <div
                className={`si-stat-card card-recent ${statusFilter === "1" ? "active" : ""}`}
                onClick={() =>
                  setStatusFilter((prev) => (prev === "1" ? "ALL" : "1"))
                }
                title={
                  statusFilter === "1"
                    ? "Click to clear filter"
                    : "Filter by Pending Approval"
                }
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#fef3c7", color: "#d97706" }}
                >
                  <Clock size={22} />
                </div>
                <div>
                  <p className="si-stat-label">Pending Approval</p>
                  <h3 className="si-stat-value"><AnimatedNumber value={totalPending} pending={loading} id="StudentCertificates-s3" /></h3>
                </div>
              </div>

              {/* Courses Enrolled */}
              <div
                className="si-stat-card card-rejected"
                onClick={() => moveto("apply")}
                title="Click to apply for a certificate from your enrolled programs"
                role="button"
                tabIndex={0}
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#ede9fe", color: "#7c3aed" }}
                >
                  <GraduationCap size={22} />
                </div>
                <div>
                  <p className="si-stat-label">Enrolled Programs</p>
                  <h3 className="si-stat-value"><AnimatedNumber value={courses.length} pending={loading} id="StudentCertificates-s4" /></h3>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="si-filter-bar">
              <div className="si-filter-left">
                <div className="si-sort-group">
                  <ArrowUpDown size={15} className="text-muted" />
                  <span>Sort By:</span>
                  <select
                    className="si-select-sort"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(1, search, e.target.value);
                    }}
                  >
                    <option value="New">Newest First</option>
                    <option value="Old">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="si-filter-right">
                <div className="si-search-box">
                  <Search size={15} className="si-search-icon" />
                  <input
                    type="text"
                    placeholder="Search course or certificate..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        loadDetails(1, search, sort);
                      }
                    }}
                    className="si-search-input"
                  />
                  {search && (
                    <button
                      type="button"
                      className="si-search-clear"
                      onClick={() => {
                        setSearch("");
                        loadDetails(1, "", sort);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div className="si-table-card">
              {loading ? (
                <SkeletonTable cols={6} />
              ) : alllists.length === 0 ? (
                <div className="si-empty-state">
                  <div className="si-empty-icon">
                    <Award size={40} />
                  </div>
                  <h4 className="si-empty-title">
                    {search
                      ? "No Certificates Found"
                      : "No Certificates Requested Yet"}
                  </h4>
                  <p className="si-empty-desc">
                    {search
                      ? "No records matched your search query. Try another keyword or clear filters."
                      : "Once you complete your enrolled course or internship project, submit a certificate request here to receive your verified digital credential."}
                  </p>
                  {search ? (
                    <button
                      type="button"
                      className="si-btn-export-excel mt-2"
                      onClick={() => {
                        setSearch("");
                        loadDetails(1, "", "New");
                      }}
                    >
                      Clear Search
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="si-btn-export-csv mt-2"
                      onClick={() => moveto("apply")}
                    >
                      <Plus size={16} /> Request Your Certificate
                    </button>
                  )}
                </div>
              ) : displayedLists.length === 0 ? (
                <div className="si-empty-state">
                  <div className="si-empty-icon">
                    <Award size={40} />
                  </div>
                  <h4 className="si-empty-title">
                    No Certificates Match Selected Status
                  </h4>
                  <p className="si-empty-desc">
                    There are no certificates matching the active filter.
                  </p>
                  <button
                    type="button"
                    className="si-btn-export-excel mt-2"
                    onClick={() => setStatusFilter("ALL")}
                  >
                    Show All Certificates
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="si-table">
                    <thead>
                      <tr>
                        <th style={{ width: "70px" }}>S No</th>
                        <th>Student</th>
                        <th>Course & Certificate</th>
                        <th style={{ width: "140px" }}>Requested Date</th>
                        <th style={{ width: "130px" }}>Status</th>
                        <th style={{ width: "160px", textAlign: "center" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLists.map((list, index) => {
                        const isApproved = String(list.status) === "2";
                        const isPending = String(list.status) === "1";
                        const isRejected = String(list.status) === "0";

                        return (
                          <tr key={list.id || index} className="si-table-row">
                            {/* S No */}
                            <td>
                              <span className="text-muted font-monospace">
                                {(page - 1) * limit + index + 1}
                              </span>
                            </td>

                            {/* Student */}
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="si-avatar-circle">
                                  {list.profile ? (
                                    <img
                                      src={list.profile}
                                      alt="profile"
                                      className="rounded-circle"
                                      width="32"
                                      height="32"
                                    />
                                  ) : (
                                    <User
                                      size={16}
                                      className="text-secondary"
                                    />
                                  )}
                                </div>
                                <div>
                                  <span className="fw-semibold text-dark d-block">
                                    {list.name || "Student"}
                                  </span>
                                  <small
                                    className="text-muted"
                                    style={{ fontSize: "11px" }}
                                  >
                                    ID: #
                                    {list.effective_mem_id ||
                                      list.mem_id ||
                                      list.id}
                                  </small>
                                </div>
                              </div>
                            </td>

                            {/* Course */}
                            <td>
                              <div>
                                <span className="fw-bold text-dark d-block">
                                  {list.course_name ||
                                    getCourseNameById(list.course) ||
                                    "Course"}
                                </span>
                                <span className="si-type-badge mt-1">
                                  <Tag size={10} className="me-1 inline" />
                                  {list.type
                                    ? String(list.type).toUpperCase()
                                    : "COURSE"}{" "}
                                  CERTIFICATE
                                </span>
                              </div>
                            </td>

                            {/* Requested Date */}
                            <td>
                              <span className="si-date-cell">
                                {formatDate(list.datetime)}
                              </span>
                            </td>

                            {/* Status */}
                            <td>
                              {isApproved ? (
                                <span className="si-status-pill approved">
                                  <span className="si-status-dot approved" />
                                  Approved
                                </span>
                              ) : isPending ? (
                                <span className="si-status-pill pending">
                                  <span className="si-status-dot pending" />
                                  Pending
                                </span>
                              ) : isRejected ? (
                                <span className="si-status-pill rejected">
                                  <span className="si-status-dot rejected" />
                                  Rejected
                                </span>
                              ) : (
                                <span className="si-status-pill">
                                  {getStatus(list.status)}
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: "center" }}>
                              <div className="d-inline-flex align-items-center gap-2">
                                <button
                                  type="button"
                                  className="si-action-btn view"
                                  title="View Certificate Details"
                                  onClick={() => updateto("view", list)}
                                >
                                  <Eye size={15} />
                                </button>

                                {isApproved && (
                                  <Link
                                    to={`/panel/certificate/download?m=${encodeURIComponent(
                                      list.effective_mem_id ||
                                        list.mem_id ||
                                        "",
                                    )}&req_id=${encodeURIComponent(list.req_id)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="si-btn-download-pdf"
                                    title="View & Download PDF Certificate"
                                  >
                                    <Download size={13} />
                                    <span>PDF</span>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <Pagination
                page={page}
                total={listtotal}
                limit={limit}
                lastPage={lastPage}
                onPageChange={(p: number) => {
                  setPage(p);
                  loadDetails(p, search, sort);
                }}
              />
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/certificates" />
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODE: VIEW (DETAILS) ===================== */}
        {mode === "view" && (
          <div className="container-fluid p-4 si-wrapper">
            {/* Header Bar */}
            <div className="si-header-card">
              <div className="si-header-left">
                <button
                  type="button"
                  className="si-back-btn"
                  onClick={() => moveto("board")}
                  title="Go Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="si-header-title">
                    Certificate Request Details
                  </h3>
                  <p className="si-header-subtitle">
                    Request ID: <b>#{form.req_id || form.id}</b> · Submitted on{" "}
                    {formatDateTime(form.datetime)}
                  </p>
                </div>
              </div>

              <div className="si-header-right">
                <button
                  type="button"
                  className="si-btn-export-excel"
                  onClick={() => moveto("board")}
                >
                  ← Back to List
                </button>
                {form.status === "2" && (
                  <Link
                    to={`/panel/certificate/download?m=${encodeURIComponent(
                      form.mem_id || "",
                    )}&req_id=${encodeURIComponent(form.req_id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="si-btn-export-csv"
                  >
                    <Download size={15} /> Download Certificate (PDF)
                  </Link>
                )}
              </div>
            </div>

            {/* Details Layout */}
            <div className="row g-4">
              {/* Left Column: Student Summary Card */}
              <div className="col-lg-4">
                <div className="si-profile-card text-center">
                  <div className="si-profile-avatar-wrap">
                    <img
                      src={
                        form.gender === "1"
                          ? "/images/malepic.jpg"
                          : form.gender === "2"
                            ? "/images/femalepic.jpg"
                            : "/images/logo_mark_dark.png"
                      }
                      className="rounded-circle shadow-sm"
                      width="96"
                      height="96"
                      alt={form.name || "Student"}
                    />
                  </div>

                  <h5 className="fw-bold text-dark mt-3 mb-1">
                    {form.name || "Student"}
                  </h5>
                  <p className="text-muted mb-2" style={{ fontSize: "12.5px" }}>
                    {form.email || "No email"}
                  </p>

                  <div className="mb-3">
                    {form.status === "2" ? (
                      <span className="si-status-pill approved">
                        <span className="si-status-dot approved" /> Approved &
                        Issued
                      </span>
                    ) : form.status === "1" ? (
                      <span className="si-status-pill pending">
                        <span className="si-status-dot pending" /> Pending
                        Verification
                      </span>
                    ) : form.status === "0" ? (
                      <span className="si-status-pill rejected">
                        <span className="si-status-dot rejected" /> Request
                        Rejected
                      </span>
                    ) : (
                      <span className="si-status-pill">
                        {getStatus(form.status)}
                      </span>
                    )}
                  </div>

                  <div className="border-top pt-3 text-start">
                    <div
                      className="d-flex justify-content-between py-1 text-muted"
                      style={{ fontSize: "12.5px" }}
                    >
                      <span>Member ID:</span>
                      <strong className="text-dark">
                        #{form.mem_id || form.id || "—"}
                      </strong>
                    </div>
                    <div
                      className="d-flex justify-content-between py-1 text-muted"
                      style={{ fontSize: "12.5px" }}
                    >
                      <span>Submitted Date:</span>
                      <strong className="text-dark">
                        {formatDate(form.datetime)}
                      </strong>
                    </div>
                    <div
                      className="d-flex justify-content-between py-1 text-muted"
                      style={{ fontSize: "12.5px" }}
                    >
                      <span>Certificate Type:</span>
                      <strong className="text-dark text-capitalize">
                        {form.type || "Course"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Full Details & Official Report Notice */}
              <div className="col-lg-8">
                {/* Information Card */}
                <div className="si-table-card p-4 mb-4">
                  <h5 className="si-card-title mb-3">Application Details</h5>

                  <div className="pv-grid-2">
                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ede9fe", color: "#7c3aed" }}
                      >
                        <User size={16} />
                      </div>
                      <span className="pv-pill-label">Full Name</span>
                      <span className="pv-pill-value">{form.name || "—"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <Mail size={16} />
                      </div>
                      <span className="pv-pill-label">Email Address</span>
                      <span className="pv-pill-value">{form.email || "—"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ffe4e6", color: "#e11d48" }}
                      >
                        <Phone size={16} />
                      </div>
                      <span className="pv-pill-label">Contact Phone</span>
                      <span className="pv-pill-value">
                        {form.number || "—"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#fef3c7", color: "#d97706" }}
                      >
                        <User size={16} />
                      </div>
                      <span className="pv-pill-label">Gender</span>
                      <span className="pv-pill-value">
                        {getGender(form.gender)}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ffedd5", color: "#ea580c" }}
                      >
                        <BookOpen size={16} />
                      </div>
                      <span className="pv-pill-label">Enrolled Course</span>
                      <span className="pv-pill-value">
                        {form.course_name ||
                          getCourseNameById(form.course) ||
                          form.course ||
                          "—"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#cffafe", color: "#0891b2" }}
                      >
                        <GraduationCap size={16} />
                      </div>
                      <span className="pv-pill-label">Assigned Batch</span>
                      <span className="pv-pill-value">
                        {form.batch_name ||
                          getBatchNameById(form.batch) ||
                          form.batch ||
                          "Regular Batch"}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <Calendar size={16} />
                      </div>
                      <span className="pv-pill-label">Course Duration</span>
                      <span className="pv-pill-value">
                        {formatDate(form.sdate)} → {formatDate(form.edate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Notice / Report Box */}
                {form.status === "2" && (
                  <div className="si-report-card approved">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="si-report-icon-box approved">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h5 className="fw-bold text-success mb-1">
                          Your Certificate Has Been Approved!
                        </h5>
                        <p
                          className="text-muted mb-0"
                          style={{ fontSize: "13px" }}
                        >
                          Verification completed on{" "}
                          {formatDateTime(form.updatetime || form.datetime)}
                        </p>
                      </div>
                    </div>

                    <p className="si-report-text">
                      Dear <b>{form.name}</b>,<br />
                      Congratulations! Your certificate request for{" "}
                      <b>
                        {form.course_name ||
                          getCourseNameById(form.course) ||
                          "your course"}
                      </b>{" "}
                      has been officially approved and issued by Rivira Technologies
                      Innovations. You can view, print, or download your PDF
                      certificate below.
                    </p>

                    <div className="mt-4 pt-3 border-top text-center">
                      <Link
                        to={`/panel/certificate/download?m=${encodeURIComponent(
                          form.mem_id || "",
                        )}&req_id=${encodeURIComponent(form.req_id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="si-btn-export-csv px-4 py-2"
                      >
                        <Award size={18} />
                        <span>View & Download Certificate (PDF)</span>
                      </Link>
                    </div>
                  </div>
                )}

                {form.status === "1" && (
                  <div className="si-report-card pending">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="si-report-icon-box pending">
                        <Clock size={24} />
                      </div>
                      <div>
                        <h5 className="fw-bold text-warning mb-1">
                          Certificate Request In Review
                        </h5>
                        <p
                          className="text-muted mb-0"
                          style={{ fontSize: "13px" }}
                        >
                          Submitted on {formatDateTime(form.datetime)}
                        </p>
                      </div>
                    </div>

                    <p className="si-report-text">
                      Dear <b>{form.name}</b>,<br />
                      Thank you for applying for your certificate. Our academic
                      verification team is currently verifying your course
                      completion and batch attendance. You will be notified as
                      soon as your certificate is ready.
                    </p>
                  </div>
                )}

                {form.status === "0" && (
                  <div className="si-report-card rejected">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="si-report-icon-box rejected">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <h5 className="fw-bold text-danger mb-1">
                          Certificate Request Notice
                        </h5>
                        <p
                          className="text-muted mb-0"
                          style={{ fontSize: "13px" }}
                        >
                          Updated on {formatDateTime(form.updatetime)}
                        </p>
                      </div>
                    </div>

                    <p className="si-report-text">
                      Dear <b>{form.name}</b>,<br />
                      Your certificate request could not be processed at this
                      time. If you believe this was an error or have recently
                      satisfied the eligibility requirements, please submit a
                      new request.
                    </p>

                    <button
                      type="button"
                      className="si-btn-export-csv mt-3"
                      onClick={() => moveto("apply")}
                    >
                      <RotateCw size={14} /> Request Certificate Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== MODE: APPLY (REQUEST FORM) ===================== */}
        {mode === "apply" && (
          <div className="container-fluid p-4 si-wrapper">
            {/* Header Bar */}
            <div className="si-header-card">
              <div className="si-header-left">
                <button
                  type="button"
                  className="si-back-btn"
                  onClick={() => moveto("board")}
                  title="Go Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="si-header-title">
                    Request Course Certificate
                  </h3>
                  <p className="si-header-subtitle">
                    Fill in your verified course and completion details to
                    generate your certificate.
                  </p>
                </div>
              </div>

              <div className="si-header-right">
                <button
                  type="button"
                  className="si-btn-export-excel"
                  onClick={() => moveto("board")}
                >
                  Cancel & Return
                </button>
              </div>
            </div>

            {/* Form Card */}
            <div className="si-form-container">
              <div className="si-form-card">
                <div className="si-card-header">
                  <div className="d-flex align-items-center gap-2">
                    <Award size={20} className="text-primary" />
                    <h5 className="si-card-title">
                      Certificate Application Form
                    </h5>
                  </div>
                  <span
                    className="badge bg-primary-subtle text-primary border px-2 py-1"
                    style={{ fontSize: "11px" }}
                  >
                    Verified Student Credentials
                  </span>
                </div>

                {error && (
                  <div
                    className="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2"
                    style={{ fontSize: "13px" }}
                  >
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                {success && (
                  <div
                    className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center gap-2"
                    style={{ fontSize: "13px" }}
                  >
                    <CheckCircle2 size={16} /> {success}
                  </div>
                )}

                {ploading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading profile…</span>
                    </div>
                    <p className="text-muted mt-2 mb-0">
                      Loading your profile information…
                    </p>
                  </div>
                ) : (
                  <form className="adminphone" onSubmit={handleSubmit} noValidate>
                    {/* form.adminphone: phoneinput.js attaches its country picker to #phone */}
                    <div className="row g-3">
                      {/* Name */}
                      <div className="col-md-6">
                        <label className="si-field-label">
                          Full Name (as printed on Certificate){" "}
                          <span className="text-danger">*</span>
                        </label>
                        <div className="si-input-group">
                          <User size={16} className="si-input-icon" />
                          <input
                            type="text"
                            name="name"
                            className="si-form-control with-icon"
                            placeholder="e.g. John Doe"
                            value={cform.name}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      {/* Gender */}
                      <div className="col-md-6">
                        <label className="si-field-label">
                          Gender <span className="text-danger">*</span>
                        </label>
                        <select
                          name="gender"
                          className="si-form-control si-select"
                          value={cform.gender}
                          onChange={handleChange}
                        >
                          <option value="">Select Gender</option>
                          <option value="1">Male</option>
                          <option value="2">Female</option>
                          <option value="3">Prefer not to disclose</option>
                        </select>
                      </div>

                      {/* Phone */}
                      <div className="col-md-6">
                        <label className="si-field-label">
                          Contact Phone Number{" "}
                          <span className="text-danger">*</span>
                        </label>
                        {/* the plugin keeps these in sync: "+" + dial code + digits, and the ISO country */}
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
                        <input
                          type="text"
                          name="phone"
                          id="phone"
                          disabled
                          className="si-form-control"
                          style={{ paddingLeft: "47px" }}
                          maxLength={15}
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="Phone number"
                          value={cform.phone}
                          onChange={setPhone}
                        />
                      </div>

                      {/* Email */}
                      <div className="col-md-6">
                        <label className="si-field-label">
                          Email Address <span className="text-danger">*</span>
                        </label>
                        <div className="si-input-group">
                          <Mail size={16} className="si-input-icon" />
                          <input
                            type="email"
                            name="email"
                            disabled
                            className="si-form-control with-icon"
                            placeholder="e.g. student@example.com"
                            value={cform.email}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      {/* Certificate Type */}
                      <div className="col-md-6">
                        <label className="si-field-label">
                          Certificate Type{" "}
                          <span className="text-danger">*</span>
                        </label>
                        <select
                          name="type"
                          className="si-form-control si-select"
                          value={cform.type}
                          onChange={handleChange}
                        >
                          <option value="">Select Type</option>
                          {CERT_FOR.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Course */}
                      <div className="col-md-6">
                        <label className="si-field-label">
                          Completed Course{" "}
                          <span className="text-danger">*</span>
                        </label>
                        <select
                          name="course"
                          className="si-form-control si-select"
                          value={cform.course}
                          onChange={handleChange}
                        >
                          <option value="">Select Course</option>
                          {courses
                            .filter((c) => c.status === "1")
                            .map((c) => (
                              <option key={c.req_id} value={c.req_id}>
                                {decodeHtml(c.title)}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Batch (its dates go on the request) */}
                      <div className="col-md-6">
                        <label className="si-field-label">Batch</label>
                        <select
                          name="batch"
                          className="si-form-control si-select"
                          value={cform.batch}
                          onChange={handleChange}
                          disabled={!cform.course || courseBatches.length === 0}
                        >
                          <option value="">
                            {!cform.course
                              ? "Select course first"
                              : courseBatches.length === 0
                                ? "No batches available"
                                : "Select batch"}
                          </option>
                          {courseBatches.map((b) => (
                            <option key={b.b_id} value={b.b_id}>
                              {decodeHtml(b.name)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="si-btn-export-excel"
                        onClick={() => moveto("board")}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="si-btn-export-csv"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <RotateCw size={14} className="si-spin" />{" "}
                            Submitting Request…
                          </>
                        ) : (
                          <>
                            <Send size={15} /> Submit Certificate Request
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scoped CSS matching StudentsInquiries.tsx standard */}
      <style>{`
        .si-wrapper {
          background-color: #f8fafc;
          min-height: 100vh;
        }
        .si-header-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
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
          color: #582fea;
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
          gap: 12px;
          flex-wrap: wrap;
        }
        .si-total-count-text {
          font-size: 14px;
          color: #475569;
          font-weight: 500;
        }
        .si-total-count-text b {
          font-weight: 700;
          color: #0f172a;
        }
        .si-btn-export-excel {
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
        .si-btn-export-excel:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .si-btn-export-csv {
          background: #582fea;
          border: 1.5px solid #582fea;
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .si-btn-export-csv:hover {
          background: #4b24d6;
          border-color: #4b24d6;
          color: #ffffff;
        }
        .si-back-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-back-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .si-spin {
          animation: siSpin 1s linear infinite;
        }
        @keyframes siSpin {
          100% { transform: rotate(360deg); }
        }

        /* Stats Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 1024px) {
          .si-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .si-stats-grid { grid-template-columns: 1fr; }
        }
        .si-stat-card {
          border-radius: 16px;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid rgba(0, 0, 0, 0.04);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          cursor: pointer;
          user-select: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.card-total { background: #f0f8ff; }
        .si-stat-card.card-total.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-card.card-approved { background: #f0fdf4; }
        .si-stat-card.card-approved.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-rejected { background: #faf5ff; }
        .si-stat-card.card-rejected.active {
          border-color: #7c3aed !important;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25) !important;
        }
        .si-stat-card.card-recent { background: #fffdf0; }
        .si-stat-card.card-recent.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }

        .si-stat-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .si-stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
          margin: 0;
        }
        .si-stat-value {
          font-size: 26px;
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
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
          gap: 12px;
        }
        .si-sort-group {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
        }
        .si-select-sort {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 13px;
          color: #1e293b;
          outline: none;
        }
        .si-search-box {
          position: relative;
          min-width: 260px;
        }
        .si-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }
        .si-search-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 32px 7px 34px;
          font-size: 13.5px;
          outline: none;
          transition: all 0.15s ease;
        }
        .si-search-input:focus {
          border-color: #582fea;
          box-shadow: 0 0 0 3px rgba(88, 47, 234, 0.1);
        }
        .si-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 16px;
          cursor: pointer;
        }

        /* Table Card */
        .si-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          overflow: hidden;
        }
        .si-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .si-table th {
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 13px 18px;
          border-bottom: 1px solid #edf2f7;
        }
        .si-table td {
          padding: 14px 18px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13.5px;
          color: #334155;
          vertical-align: middle;
        }
        .si-table-row:hover td {
          background: #fafbff;
        }
        .si-avatar-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .si-type-badge {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
        }
        .si-date-cell {
          font-size: 12.5px;
          color: #64748b;
          white-space: nowrap;
        }
        .si-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          background: #f1f5f9;
          color: #475569;
        }
        .si-status-pill.approved { background: #dcfce7; color: #15803d; }
        .si-status-pill.pending { background: #fef3c7; color: #b45309; }
        .si-status-pill.rejected { background: #fee2e2; color: #b91c1c; }

        .si-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #94a3b8;
        }
        .si-status-dot.approved { background: #16a34a; }
        .si-status-dot.pending { background: #d97706; }
        .si-status-dot.rejected { background: #dc2626; }

        .si-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #582fea;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-action-btn:hover {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #4318ff;
        }
        .si-btn-download-pdf {
          background: #16a34a;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          text-decoration: none;
          transition: background 0.15s ease;
        }
        .si-btn-download-pdf:hover {
          background: #15803d;
          color: #ffffff;
        }

        /* Detail View / Profile card */
        .si-profile-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .si-profile-avatar-wrap {
          display: inline-block;
          border-radius: 50%;
          padding: 4px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
        }
        .pv-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (max-width: 768px) {
          .pv-grid-2 { grid-template-columns: 1fr; }
        }
        .pv-pill-item {
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .pv-pill-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2px;
        }
        .pv-pill-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
        }
        .pv-pill-value {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
        }
        .si-report-card {
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #e2e8f0;
        }
        .si-report-card.approved { background: #f0fdf4; border-color: #bbf7d0; }
        .si-report-card.pending { background: #fffdf0; border-color: #fef08a; }
        .si-report-card.rejected { background: #fef2f2; border-color: #fecaca; }

        .si-report-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .si-report-icon-box.approved { background: #dcfce7; color: #16a34a; }
        .si-report-icon-box.pending { background: #fef3c7; color: #d97706; }
        .si-report-icon-box.rejected { background: #fee2e2; color: #dc2626; }
        .si-report-text {
          font-size: 13.5px;
          line-height: 1.6;
          color: #334155;
          margin: 0;
        }

        /* Form Card */
        .si-form-container {
          margin: 0 auto;
        }
        .si-form-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 28px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .si-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
          padding-bottom: 14px;
          border-bottom: 1px solid #f1f5f9;
        }
        .si-card-title {
          font-size: 16.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .si-field-label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
          display: block;
        }
        .si-input-group {
          position: relative;
        }
        .si-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }
        .si-form-control {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 14px;
          font-size: 13.5px;
          color: #1e293b;
          outline: none;
          transition: all 0.15s ease;
          background-color: #ffffff;
        }
        .si-form-control.with-icon {
          padding-left: 36px;
        }
        .si-form-control:focus {
          border-color: #582fea;
          box-shadow: 0 0 0 3px rgba(88, 47, 234, 0.1);
        }

        /* Empty State */
        .si-empty-state {
          padding: 60px 20px;
          text-align: center;
        }
        .si-empty-icon {
          width: 68px;
          height: 68px;
          border-radius: 20px;
          background: #f1f5f9;
          color: #94a3b8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .si-empty-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .si-empty-desc {
          font-size: 13.5px;
          color: #64748b;
          max-width: 440px;
          margin: 0 auto 16px;
        }
      `}</style>
    </>
  );

  /* Pagination Component */
  function Pagination({ page, total, limit, lastPage, onPageChange }: any) {
    if (total === 0 || lastPage <= 1) return null;

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    let pagstart = 1;
    let pagend = 10;

    if (page >= 6) {
      pagstart = page - 3;
      pagend = page + 7;
    }

    if (pagend >= lastPage) {
      pagstart = lastPage - 9;
      pagend = lastPage + 1;
    }

    if (pagstart <= 0) pagstart = 1;

    const pages = [];
    for (let i = pagstart; i < pagend && i <= lastPage; i++) {
      pages.push(i);
    }

    return (
      <div data-pagination className="p-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="text-muted" style={{ fontSize: "13px" }}>
          Showing <b>{start}</b> to <b>{end}</b> of <b>{total}</b> entries
        </div>

        <div className="d-flex align-items-center gap-1">
          {page >= 2 && (
            <button
              type="button"
              className="si-btn-export-excel py-1 px-2"
              onClick={() => onPageChange(page - 1)}
            >
              « Prev
            </button>
          )}

          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${
                p === page ? "btn-primary" : "btn-outline-secondary"
              }`}
              style={{
                minWidth: "32px",
                fontSize: "12px",
                borderRadius: "8px",
              }}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}

          {page < lastPage && (
            <button
              type="button"
              className="si-btn-export-excel py-1 px-2"
              onClick={() => onPageChange(page + 1)}
            >
              Next »
            </button>
          )}
        </div>
      </div>
    );
  }
}
