import { Head, SERVER_URL } from "../../../components/Includes";
import { fetchCurrentUser } from "../../../utils/currentUser";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  User,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  GraduationCap,
  Compass,
  BookOpen,
  Users,
  CheckCircle,
  Edit,
  Lock,
  Building2,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import { ButtonLoader, SkeletonForm } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const getCourseNamesByIds = (ids: string) => {
    if (!ids || courses.length === 0) return "";
    return ids
      .split(",")
      .map((id) => id.trim())
      .map((id) => {
        const course = courses.find((c) => c.req_id === id);
        return course ? decodeHtml(course.title) : "";
      })
      .filter((title) => title)
      .join(", ");
  };

  const getBatchNameById = (ids: string) => {
    if (!ids || batches.length === 0) return "";
    return ids
      .split(",")
      .map((id) => id.trim())
      .map((id) => {
        const batch = batches.find((c) => c.b_id === id);
        return batch ? decodeHtml(batch.name) : "";
      })
      .filter((name) => name)
      .join(", ");
  };

  const formatDate = (ts: any) => {
    if (!ts) return "";
    const num = Number(ts);
    const d = !isNaN(num)
      ? new Date(num < 10000000000 ? num * 1000 : num)
      : new Date(ts);
    return isNaN(d.getTime()) ? String(ts) : d.toLocaleDateString("en-IN");
  };

  const [ploading, setpLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [usercourses, setuserCourses] = useState<any[]>([]);

  // Popups state
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isPwdOpen, setIsPwdOpen] = useState(false);

  const getGender = (g: any) => {
    return g === "1" ? "Male" : g === "2" ? "Female" : "-";
  };

  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {
        all: "1", // including courses that aren't open for enrolment
        status: "",
      });

      if (res.data.success) {
        setCourses(res.data.data);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
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
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    }
  };

  const [myprofile, setmyprofile] = useState<any[]>([]);
  const loadMyProfile = async () => {
    try {
      setpLoading(true);
      const res = await listFetch("api/get-myprofile", {
        status: "",
      });

      if (res.data.success) {
        const profile = res.data.data || [];
        setmyprofile(res.data.data);
        setuserCourses(res.data.courses || "");

        if (profile.length > 0) {
          const user = profile[0];

          setForm({
            name: user.name || "",
            gender: user.gender || "",
            phone: user.number || "",
            email: user.email || "",
            city: user.city || "",
            address: user.address || "",
            qualification: user.qualification || "",
          });
        }
      } else {
        toast.error(res.data.message);
      }

      if (courses.length === 0) {
        await loadCourses();
      }
      if (batches.length === 0) {
        await loadBatches();
      }
    } catch (err) {
      setError(err + "");
    } finally {
      setpLoading(false);
    }
  };

  const [form, setForm] = useState({
    name: "",
    gender: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    qualification: "",
  });

  const [pform, setpForm] = useState({
    cpassword: "",
    npassword: "",
    rpassword: "",
  });

  const openUpdateModal = () => {
    setSuccess("");
    setError("");
    if (myprofile.length >= 1) {
      setForm({
        name: myprofile[0].name || "",
        gender: myprofile[0].gender || "",
        phone: myprofile[0].number || "",
        email: myprofile[0].email || "",
        city: myprofile[0].city || "",
        address: myprofile[0].address || "",
        qualification: myprofile[0].qualification || "",
      });
    }
    setIsUpdateOpen(true);
  };

  const openPwdModal = () => {
    setSuccess("");
    setError("");
    setpForm({
      cpassword: "",
      npassword: "",
      rpassword: "",
    });
    setIsPwdOpen(true);
  };

  const updateList = async (e: any) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    if (!form.name.trim()) {
      setError("❌ Please enter your name");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-profile",
        {
          ...form,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        },
      );
      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        loadMyProfile();
        fetchCurrentUser();
        setTimeout(() => setIsUpdateOpen(false), 600);
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const pwdreset = async (e: any) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    if (!pform.cpassword.trim()) {
      setError("❌ Please enter current password");
      return;
    }

    if (!pform.npassword.trim()) {
      setError("❌ Please enter new password");
      return;
    }

    if (pform.npassword !== pform.rpassword) {
      setError("❌ New password and confirmation do not match");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/ac-reset-password",
        {
          ...pform,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        },
      );
      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setpForm({
          cpassword: "",
          npassword: "",
          rpassword: "",
        });
        setTimeout(() => setIsPwdOpen(false), 600);
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const phandleChange = (e: any) => {
    setpForm({
      ...pform,
      [e.target.name]: e.target.value,
    });
  };

  const navigate = useNavigate();
  const [ustatus, setUstatus] = useState("");

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    if (loggedIn) {
      setUstatus(data.id);
      loadMyProfile();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab === "update") {
      openUpdateModal();
    } else if (tab === "pwd") {
      openPwdModal();
    }
  }, [location.search]);

  useEffect(() => {
    initchecklogin();
  }, []);

  const p = myprofile.length >= 1 ? myprofile[0] : null;

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />

      <style>{`
      /* Modern Profile View Styles */
      .pv-wrapper {
        background-color: #f8fafc;
        min-height: calc(100vh - 80px);
        padding: 24px 28px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .pv-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 14px;
      }
      .pv-header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .pv-header-icon {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: #3b82f6;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25);
        flex-shrink: 0;
      }
      .pv-header-title {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        line-height: 1.2;
      }
      .pv-header-subtitle {
        font-size: 13.5px;
        color: #64748b;
        margin-top: 3px;
        margin-bottom: 0;
      }
      .pv-btn-edit {
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
        box-shadow: 0 2px 6px rgba(var(--ad-brand-rgb), 0.2);
      }
      .pv-btn-edit:hover {
        background: #4922cf;
        border-color: #4922cf;
        color: #ffffff;
      }
      .pv-btn-pwd {
        background: #ffffff;
        border: 1.5px solid var(--ad-brand);
        color: var(--ad-brand);
        border-radius: 10px;
        padding: 8px 18px;
        font-size: 13.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      }
      .pv-btn-pwd:hover {
        background: #f5f3ff;
        border-color: var(--ad-brand);
        color: var(--ad-brand);
      }
      .pv-layout-grid {
        display: grid;
        grid-template-columns: 290px 1fr;
        gap: 24px;
        align-items: start;
      }
      @media (max-width: 992px) {
        .pv-layout-grid {
          grid-template-columns: 1fr;
        }
      }
      .pv-left-col {
        display: flex;
        flex-direction: column;
      }
      .pv-profile-card {
        background: linear-gradient(180deg, #ede9fe 0%, #fbfaff 30%, #ffffff 70%, #f5f3ff 100%);
        border-radius: 20px;
        border: 1px solid #eef2f6;
        padding: 28px 20px 24px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      }
      .pv-avatar-wrap {
        width: 110px;
        height: 110px;
        border-radius: 50%;
        margin: 0 auto 16px;
        overflow: hidden;
        border: 4px solid #ffffff;
        box-shadow: 0 6px 18px rgba(var(--ad-brand-rgb), 0.18);
        background: #e0e7ff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .pv-profile-name {
        font-size: 19px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 8px;
      }
      .pv-status-pill-dark {
        background: #526071;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        border-radius: 20px;
        padding: 4px 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 22px;
      }
      .pv-status-dot-green {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #22c55e;
      }
      .pv-quick-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        margin-top: 6px;
      }
      .pv-quick-action-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        text-decoration: none;
        cursor: pointer;
      }
      .pv-quick-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        cursor: pointer;
      }
      .pv-quick-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0,0,0,0.08);
      }
      .pv-quick-label {
        font-size: 11.5px;
        font-weight: 500;
      }
      .pv-meta-card {
        background: #ffffff;
        border-radius: 14px;
        border: 1px solid #eef2f6;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      }
      .pv-meta-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #ede9fe;
        color: var(--ad-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .pv-meta-label {
        font-size: 12px;
        color: #64748b;
        font-weight: 500;
        margin: 0;
      }
      .pv-meta-val {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        margin: 2px 0 0;
      }

      /* Right Column Sections */
      .pv-right-col {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .pv-section-card {
        background: #ffffff;
        border-radius: 18px;
        border: 1px solid #eef2f6;
        padding: 22px 26px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      }
      .pv-section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      .pv-section-badge-blue {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv-section-badge-green {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #10b981;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv-section-title-blue {
        font-size: 17px;
        font-weight: 700;
        color: #1e3a8a;
        margin: 0;
      }
      .pv-section-title-green {
        font-size: 17px;
        font-weight: 700;
        color: #065f46;
        margin: 0;
      }
      .pv-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 18px;
      }
      @media (max-width: 650px) {
        .pv-grid-2 {
          grid-template-columns: 1fr;
        }
      }
      .pv-pill-item {
        display: flex;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #edf2f7;
        border-radius: 12px;
        padding: 10px 14px;
        gap: 12px;
        min-height: 52px;
      }
      .pv-pill-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .pv-pill-label {
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        width: 95px;
        flex-shrink: 0;
      }
      .pv-pill-value {
        font-size: 13.5px;
        color: #0f172a;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .pv-bottom-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        margin-top: 18px;
        flex-wrap: wrap;
      }

      /* Modal Popup Styles */
      .pv-modal-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1050;
        padding: 20px;
        animation: pvFadeIn 0.2s ease-out;
      }
      @keyframes pvFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .pv-modal-dialog {
        background: #ffffff;
        border-radius: 20px;
        width: 100%;
        max-width: 680px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
        border: 1px solid #e2e8f0;
        overflow: hidden;
        animation: pvScaleUp 0.2s ease-out;
      }
      .pv-modal-dialog.modal-sm {
        max-width: 500px;
      }
      @keyframes pvScaleUp {
        from { transform: scale(0.96); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .pv-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #f1f5f9;
      }
      .pv-modal-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .pv-modal-badge {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: #ede9fe;
        color: var(--ad-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .pv-modal-title {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        line-height: 1.2;
      }
      .pv-modal-subtitle {
        font-size: 13px;
        color: #64748b;
        margin: 2px 0 0;
      }
      .pv-modal-close {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: none;
        background: #f1f5f9;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .pv-modal-close:hover {
        background: #fee2e2;
        color: #ef4444;
      }
      .pv-modal-body {
        padding: 24px;
        overflow-y: auto;
      }
      .pv-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        background: #f8fafc;
      }
      .pv-input-custom {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 14px;
        color: #1e293b;
        width: 100%;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .pv-input-custom:focus {
        border-color: var(--ad-brand);
        box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.1);
        outline: none;
      }
      .pv-label-custom {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
        margin-bottom: 6px;
        display: block;
      }
      .pv-btn-cancel {
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        color: #475569;
        border-radius: 10px;
        padding: 8px 18px;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .pv-btn-cancel:hover {
        background: #f1f5f9;
        color: #1e293b;
      }
      .pv-btn-submit {
        background: var(--ad-brand);
        border: 1.5px solid var(--ad-brand);
        color: #ffffff;
        border-radius: 10px;
        padding: 8px 20px;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .pv-btn-submit:hover:not(:disabled) {
        background: #4922cf;
        border-color: #4922cf;
      }
      .pv-btn-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="pv-wrapper">
          {/* Header */}
          <div className="pv-header">
            <div className="pv-header-left">
              <div className="pv-header-icon">
                <User size={24} />
              </div>
              <div>
                <h3 className="pv-header-title">My Profile</h3>
                <p className="pv-header-subtitle">
                  View and manage your personal account details
                </p>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openUpdateModal}
                className="pv-btn-edit"
              >
                <Edit size={15} />
                Update Details
              </button>

              <button
                type="button"
                onClick={openPwdModal}
                className="pv-btn-pwd"
              >
                <Lock size={15} />
                Password Reset
              </button>
            </div>
          </div>

          {ploading ? (
            <SkeletonForm fields={6} />
          ) : !p ? (
            <div className="pv-section-card text-center py-5">
              <User
                size={40}
                color="#cbd5e1"
                style={{ display: "block", margin: "0 auto 12px" }}
              />
              <h4 style={{ color: "#334155", fontWeight: 700 }}>
                Profile Not Found
              </h4>
              <p className="text-muted">Unable to load your profile details.</p>
            </div>
          ) : (
            <div className="pv-layout-grid">

              <div className="pv-left-col">
                <div className="pv-profile-card">
                  <div className="pv-avatar-wrap">
                    <img
                      src={
                        p.profile
                          ? p.profile
                          : p.gender === "1"
                            ? "/images/malepic.jpg"
                            : p.gender === "2"
                              ? "/images/femalepic.jpg"
                              : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                      }
                      alt={p.name || "Profile"}
                      className="pv-avatar-img"
                    />
                  </div>

                  <h4 className="pv-profile-name">{p.name || "User"}</h4>

                  <div>
                    <span className="pv-status-pill-dark">
                      <span className="pv-status-dot-green"></span>
                      {ustatus === "1"
                        ? "Student"
                        : ustatus === "2"
                          ? "Trainer"
                          : "Admin"}
                    </span>
                  </div>

                  {/* Quick Actions */}
                  <div className="pv-quick-actions">
                    <a
                      href={p.number ? `tel:${p.number}` : "#"}
                      className="pv-quick-action-item"
                      title="Call"
                    >
                      <div
                        className="pv-quick-btn"
                        style={{
                          background: "#ede9fe",
                          color: "var(--ad-brand)",
                        }}
                      >
                        <Phone size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "#64748b" }}
                      >
                        Call
                      </span>
                    </a>

                    <a
                      href={p.email ? `mailto:${p.email}` : "#"}
                      className="pv-quick-action-item"
                      title="Email"
                    >
                      <div
                        className="pv-quick-btn"
                        style={{ background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <Mail size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "#0284c7" }}
                      >
                        Email
                      </span>
                    </a>

                    <a
                      href={
                        p.number
                          ? `https://wa.me/${p.number.replace(/\D/g, "")}`
                          : "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pv-quick-action-item"
                      title="Message"
                    >
                      <div
                        className="pv-quick-btn"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <MessageCircle size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "#16a34a" }}
                      >
                        Message
                      </span>
                    </a>

                    <div
                      className="pv-quick-action-item"
                      title="Edit Details"
                      onClick={openUpdateModal}
                    >
                      <div
                        className="pv-quick-btn"
                        style={{
                          background: "#f3e8ff",
                          color: "var(--ad-brand)",
                        }}
                      >
                        <Edit size={18} />
                      </div>
                      <span
                        className="pv-quick-label"
                        style={{ color: "var(--ad-brand)" }}
                      >
                        Edit
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lower Left Stat Cards */}
                <div className="pv-meta-card">
                  <div className="pv-meta-icon">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="pv-meta-label">Account / Member ID</p>
                    <p className="pv-meta-val">{p.mem_id || p.id || "-"}</p>
                  </div>
                </div>

                {p.datetime && (
                  <div className="pv-meta-card">
                    <div className="pv-meta-icon">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="pv-meta-label">Joined / Registered</p>
                      <p className="pv-meta-val">
                        {formatDate(p.datetime) || "-"}
                      </p>
                    </div>
                  </div>
                )}

                {p.city && (
                  <div className="pv-meta-card">
                    <div
                      className="pv-meta-icon"
                      style={{ background: "#e0f2fe", color: "#0284c7" }}
                    >
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="pv-meta-label">City</p>
                      <p className="pv-meta-val">{p.city}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="pv-right-col">
                {/* Section 1: Personal Information */}
                <div className="pv-section-card">
                  <div className="pv-section-header">
                    <div className="pv-section-badge-blue">
                      <User size={18} />
                    </div>
                    <h4 className="pv-section-title-blue">
                      Personal Information
                    </h4>
                  </div>

                  <div className="pv-grid-2">
                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{
                          background: "#ede9fe",
                          color: "var(--ad-brand)",
                        }}
                      >
                        <User size={16} />
                      </div>
                      <span className="pv-pill-label">Full Name</span>
                      <span className="pv-pill-value">{p.name || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#ffe4e6", color: "#e11d48" }}
                      >
                        <Phone size={16} />
                      </div>
                      <span className="pv-pill-label">Contact</span>
                      <span className="pv-pill-value">{p.number || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <Mail size={16} />
                      </div>
                      <span className="pv-pill-label">Email</span>
                      <span className="pv-pill-value">{p.email || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <Compass size={16} />
                      </div>
                      <span className="pv-pill-label">Gender</span>
                      <span className="pv-pill-value">
                        {getGender(p.gender)}
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#fef3c7", color: "#d97706" }}
                      >
                        <Building2 size={16} />
                      </div>
                      <span className="pv-pill-label">City</span>
                      <span className="pv-pill-value">{p.city || "-"}</span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{
                          background: "#ede9fe",
                          color: "var(--ad-brand)",
                        }}
                      >
                        <GraduationCap size={16} />
                      </div>
                      <span className="pv-pill-label">Qualification</span>
                      <span className="pv-pill-value">
                        {p.qualification || "-"}
                      </span>
                    </div>

                    <div
                      className="pv-pill-item"
                      style={{ gridColumn: "1 / -1" }}
                    >
                      <div
                        className="pv-pill-icon"
                        style={{
                          background: "#f3e8ff",
                          color: "var(--ad-brand)",
                        }}
                      >
                        <MapPin size={16} />
                      </div>
                      <span className="pv-pill-label">Address</span>
                      <span className="pv-pill-value">{p.address || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Role & Course Details */}
                <div className="pv-section-card">
                  <div className="pv-section-header">
                    <div className="pv-section-badge-green">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="pv-section-title-green">
                      Role &amp; Enrolled Courses
                    </h4>
                  </div>

                  <div className="pv-grid-2">
                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{ background: "#dcfce7", color: "#16a34a" }}
                      >
                        <CheckCircle size={16} />
                      </div>
                      <span className="pv-pill-label">Account Role</span>
                      <span className="pv-pill-value">
                        <span
                          className="pv-status-pill-dark"
                          style={{
                            margin: 0,
                            padding: "3px 12px",
                            fontSize: "11.5px",
                          }}
                        >
                          <span className="pv-status-dot-green"></span>
                          {ustatus === "1"
                            ? "Student"
                            : ustatus === "2"
                              ? "Trainer"
                              : "Admin"}
                        </span>
                      </span>
                    </div>

                    <div className="pv-pill-item">
                      <div
                        className="pv-pill-icon"
                        style={{
                          background: "#ede9fe",
                          color: "var(--ad-brand)",
                        }}
                      >
                        <Users size={16} />
                      </div>
                      <span className="pv-pill-label">Total Courses</span>
                      <span className="pv-pill-value">
                        {usercourses?.length || 0}
                      </span>
                    </div>
                  </div>

                  {usercourses && usercourses.length > 0 && (
                    <div style={{ marginTop: "18px" }}>
                      <h5
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#1e293b",
                          marginBottom: "12px",
                        }}
                      >
                        Course &amp; Batch Enrollments:
                      </h5>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {usercourses.map((list, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "10px 14px",
                              borderRadius: "12px",
                              background: "#f8fafc",
                              border: "1px solid #edf2f7",
                            }}
                          >
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: "#e0f2fe",
                                color: "#0284c7",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <BookOpen size={16} />
                            </div>
                            <span
                              style={{
                                fontSize: "13.5px",
                                fontWeight: 600,
                                color: "#1e293b",
                              }}
                            >
                              {getCourseNamesByIds(list.c_id) || "Course"}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#64748b",
                                background: "#ede9fe",
                                padding: "3px 10px",
                                borderRadius: "20px",
                                marginLeft: "auto",
                              }}
                            >
                              Batch: {getBatchNameById(list.b_id) || "Default"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pv-bottom-actions">
                    <button
                      type="button"
                      className="pv-btn-edit"
                      onClick={openUpdateModal}
                    >
                      <Edit size={14} />
                      Update Details
                    </button>

                    <button
                      type="button"
                      className="pv-btn-pwd"
                      onClick={openPwdModal}
                    >
                      <Lock size={14} />
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= UPDATE PROFILE POPUP MODAL ================= */}
      {isUpdateOpen && (
        <div
          className="pv-modal-overlay"
          onClick={() => !loading && setIsUpdateOpen(false)}
        >
          <div className="pv-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="pv-modal-header">
              <div className="pv-modal-header-left">
                <div className="pv-modal-badge">
                  <Edit size={18} />
                </div>
                <div>
                  <h4 className="pv-modal-title">Update Personal Details</h4>
                  <p className="pv-modal-subtitle">
                    Modify your personal contact and background details
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="pv-modal-close"
                disabled={loading}
                onClick={() => setIsUpdateOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {ploading ? (
              <SkeletonForm fields={4} />
            ) : (
              <form onSubmit={updateList}>
                <div className="pv-modal-body">
                  {success && (
                    <div className="alert alert-success py-2 px-3 mb-3">
                      {success}
                    </div>
                  )}

                  {error && (
                    <div className="alert alert-danger py-2 px-3 mb-3">
                      {error}
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="pv-label-custom">
                        Full Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="pv-input-custom"
                        name="name"
                        value={form.name}
                        onChange={(e: any) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="Enter full name"
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="pv-label-custom">
                        Gender <span className="text-danger">*</span>
                      </label>
                      <select
                        className="pv-input-custom form-select"
                        name="gender"
                        value={form.gender}
                        onChange={(e) =>
                          setForm({ ...form, gender: e.target.value })
                        }
                        required
                      >
                        <option value="">Select Gender</option>
                        <option value="1">Male</option>
                        <option value="2">Female</option>
                        <option value="3">Prefer not to disclose</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="pv-label-custom">Contact Number</label>
                      <input
                        type="text"
                        className="pv-input-custom"
                        value={form.phone}
                        disabled
                        style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="pv-label-custom">Email Address</label>
                      <input
                        type="email"
                        className="pv-input-custom"
                        value={form.email}
                        disabled
                        style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="pv-label-custom">
                        City <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="pv-input-custom"
                        name="city"
                        value={form.city}
                        onChange={(e: any) =>
                          setForm({ ...form, city: e.target.value })
                        }
                        placeholder="City name"
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="pv-label-custom">
                        Qualification <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="pv-input-custom"
                        name="qualification"
                        value={form.qualification}
                        onChange={(e: any) =>
                          setForm({ ...form, qualification: e.target.value })
                        }
                        placeholder="E.g., B.Tech, MCA, Degree"
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="pv-label-custom">
                        Address <span className="text-danger">*</span>
                      </label>
                      <textarea
                        className="pv-input-custom"
                        name="address"
                        rows={3}
                        value={form.address}
                        onChange={(e: any) =>
                          setForm({ ...form, address: e.target.value })
                        }
                        placeholder="Enter complete residential address"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="pv-modal-footer">
                  <button
                    type="button"
                    className="pv-btn-cancel"
                    disabled={loading}
                    onClick={() => setIsUpdateOpen(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="pv-btn-submit"
                    disabled={loading}
                  >
                    {loading ? <ButtonLoader label="Saving..." /> : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= PASSWORD RESET POPUP MODAL ================= */}
      {isPwdOpen && (
        <div
          className="pv-modal-overlay"
          onClick={() => !loading && setIsPwdOpen(false)}
        >
          <div
            className="pv-modal-dialog modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="pv-modal-header">
              <div className="pv-modal-header-left">
                <div
                  className="pv-modal-badge"
                  style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                >
                  <Lock size={18} />
                </div>
                <div>
                  <h4 className="pv-modal-title">Reset Password</h4>
                  <p className="pv-modal-subtitle">
                    Enter your current and new account passwords
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="pv-modal-close"
                disabled={loading}
                onClick={() => setIsPwdOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={pwdreset}>
              <div className="pv-modal-body">
                {success && (
                  <div className="alert alert-success py-2 px-3 mb-3">
                    {success}
                  </div>
                )}

                {error && (
                  <div className="alert alert-danger py-2 px-3 mb-3">
                    {error}
                  </div>
                )}

                <div className="d-flex flex-column gap-3">
                  <div>
                    <label className="pv-label-custom">
                      Current Password <span className="text-danger">*</span>
                    </label>
                    <input
                      name="cpassword"
                      type="password"
                      className="pv-input-custom"
                      placeholder="Enter current password"
                      value={pform.cpassword}
                      onChange={phandleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="pv-label-custom">
                      New Password <span className="text-danger">*</span>
                    </label>
                    <input
                      name="npassword"
                      type="password"
                      className="pv-input-custom"
                      placeholder="Enter new password"
                      value={pform.npassword}
                      onChange={phandleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="pv-label-custom">
                      Confirm New Password{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <input
                      name="rpassword"
                      type="password"
                      className="pv-input-custom"
                      placeholder="Re-enter new password"
                      value={pform.rpassword}
                      onChange={phandleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pv-modal-footer">
                <button
                  type="button"
                  className="pv-btn-cancel"
                  disabled={loading}
                  onClick={() => setIsPwdOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="pv-btn-submit"
                  disabled={loading}
                >
                  {loading ? <ButtonLoader label="Resetting..." /> : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
