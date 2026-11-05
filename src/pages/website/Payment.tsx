import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { SERVER_URL, Head } from "../../components/Includes";
import {
  User,
  Users,
  Mail,
  Phone,
  GraduationCap,
  BookOpen,
  FileText,
  Layers,
  CreditCard,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Lock,
} from "lucide-react";

export default function Page() {
  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  function decodeHtml(str: any) {
    if (!str) return "-";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const didFetch = useRef(false);
  const [alllists, setAllLists] = useState<any[]>([]);
  const [reqid, setReqid] = useState("");
  const [statusid, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDetails = async (id: any, st: any) => {
    setLoading(true);
    setAllLists([]);
    setReqid(id);
    setStatus(st);

    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/payment/details",
        {
          id: id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        setAllLists(res.data.data);
        if ((st && st === "success") || (st && st === "cancel")) {
          checkPayment(id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
        setError(res.data.message);
      }
    } catch {
      setLoading(false);
      setError("❌ Something went wrong while loading payment details.");
    }
  };

  const paymentNow = async () => {
    setLoading(true);
    setTimeout(() => {
      document
        .querySelector(".pay-loading-box")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/payment/now",
        {
          id: reqid,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        window.location.href = res.data.url;
      } else {
        setLoading(false);
        setError(res.data.message);
      }
    } catch {
      setLoading(false);
      setError("❌ Something went wrong processing payment.");
    }
  };

  const checkPayment = async (id: any) => {
    setLoading(true);

    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/payment/check",
        {
          id: id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        setStatus(res.data.status);
        if (res.data.status === "success") {
          setSuccess(res.data.message);
        } else {
          setError(res.data.message);
        }
      } else {
        setError(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getGender = (g: any) => {
    return String(g) === "1" ? "Male" : String(g) === "2" ? "Female" : "-";
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "1":
        return "Pending";
      case "2":
        return "Payment Already Paid";
      case "3":
        return "Registered";
      case "0":
        return "Rejected";
      default:
        return "Unknown";
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    let date: Date;
    if (typeof ts === "number") {
      date = new Date(ts > 1e11 ? ts : ts * 1000);
    } else if (!isNaN(Number(ts)) && Number(ts) > 0) {
      const num = Number(ts);
      date = new Date(num > 1e11 ? num : num * 1000);
    } else {
      date = new Date(ts);
    }
    if (isNaN(date.getTime())) return String(ts);

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };


  useEffect(() => {
    if (!didFetch.current) {
      const params = new URLSearchParams(location.search);
      const id = params.get("t");
      const st = params.get("s");
      if (id && id.length >= 10) {
        loadDetails(id, st);
      } else if (
        (id && st && st === "success") ||
        (id && st && st === "cancel")
      ) {
        loadDetails(id, st);
      }
      didFetch.current = true;
    }
  }, []);

  const renderStatusBadge = (status: any) => {
    const s = String(status);
    if (s === "1") {
      return (
        <span
          style={{
            background: "#fef3c7",
            color: "#d97706",
            padding: "5px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            display: "inline-block",
            letterSpacing: "0.01em",
          }}
        >
          Pending
        </span>
      );
    }
    if (s === "2") {
      return (
        <span
          style={{
            background: "#dcfce7",
            color: "#15803d",
            padding: "5px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            display: "inline-block",
          }}
        >
          Payment Already Paid
        </span>
      );
    }
    if (s === "3") {
      return (
        <span
          style={{
            background: "#e0e7ff",
            color: "#4338ca",
            padding: "5px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            display: "inline-block",
          }}
        >
          Registered
        </span>
      );
    }
    if (s === "0") {
      return (
        <span
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "5px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            display: "inline-block",
          }}
        >
          Rejected
        </span>
      );
    }
    return (
      <span
        style={{
          background: "#f1f5f9",
          color: "#64748b",
          padding: "5px 16px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 700,
          display: "inline-block",
        }}
      >
        {getStatus(status)}
      </span>
    );
  };

  const isFailed =
    statusid === "failed" ||
    (statusid === "cancel" ? false : Boolean(error && !success));
  const isCanceled = statusid === "cancel";
  const isSuccess = statusid === "success" || Boolean(success);

  const item = alllists[0];

  return (
    <div className="enroll-page">
      <Head
        pageTitle="Complete your payment | Rivira Technologies"
        pageDesc="Complete your course enrollment payment securely."
      />

      {/* ── HERO ── (same as the Contact page: enroll-hero) */}
      <section className="enroll-hero">
        <div className="enroll-hero-grid" aria-hidden="true" />
        <div className="enroll-hero-glow-left" aria-hidden="true" />
        <div className="enroll-hero-glow-right" aria-hidden="true" />
        <div className="enroll-hero-inner">
          <div className="enroll-badge">
            <Lock size={12} /> Secure Enrollment Checkout
          </div>
          <h1>
            Check details
            <span className="gold-text">before proceeding</span>
          </h1>
          <p>
            Please review your enrollment details below, then continue to a secure, encrypted payment. You'll get instant course access the moment your payment succeeds.
          </p>
          <div className="enroll-hero-chips">
            <span className="enroll-hero-chip"><span className="dot" /> Secure payment</span>
            <span className="enroll-hero-chip"><span className="dot" /> Powered by Stripe</span>
            <span className="enroll-hero-chip"><span className="dot amber" /> SSL encrypted · Instant access</span>
          </div>
        </div>
      </section>

      {/* PAYMENT CARD SECTION */}
      <div className="pay-viewport-wrapper">
        <style>{`
        .pay-viewport-wrapper {
          min-height: calc(100vh - 380px);
          background: #f8fafc;
          position: relative;
          overflow: hidden;
          padding: 50px 16px 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        /* Decorative Soft Pastel Blobs */
        .pay-blob {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
        }
        .pay-blob-1 {
          width: 440px;
          height: 440px;
          background: radial-gradient(circle, rgba(186, 230, 253, 0.65) 0%, rgba(186, 230, 253, 0) 70%);
          filter: blur(55px);
          top: -40px;
          left: -100px;
        }
        .pay-blob-2 {
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(254, 240, 138, 0.55) 0%, rgba(254, 240, 138, 0) 70%);
          filter: blur(50px);
          top: 30%;
          right: -80px;
        }
        .pay-blob-3 {
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(251, 207, 232, 0.6) 0%, rgba(251, 207, 232, 0) 70%);
          filter: blur(45px);
          bottom: 40px;
          right: -40px;
        }

        /* Decorative Accent Dots */
        .pay-dot {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
        }
        .pay-dot-green {
          width: 14px;
          height: 14px;
          background: #6ee7b7;
          opacity: 0.8;
          top: 36%;
          left: 6%;
        }
        .pay-dot-yellow {
          width: 12px;
          height: 12px;
          background: #fde047;
          opacity: 0.8;
          top: 27%;
          right: 7%;
        }
        .pay-dot-blue {
          width: 10px;
          height: 10px;
          background: #93c5fd;
          opacity: 0.85;
          bottom: 37%;
          right: 9%;
        }
        .pay-dot-top-green {
          width: 12px;
          height: 12px;
          background: #86efac;
          opacity: 0.75;
          top: 30px;
          left: 65px;
        }

        /* Main Card */
        .pay-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 720px;
          background: #ffffff;
          border-radius: 26px;
          box-shadow: 0 20px 45px -12px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.02);
          border: 1px solid rgba(226, 232, 240, 0.85);
          padding: 34px 38px 38px;
          margin: 0 auto;
        }

        /* Top Alert Banner */
        .pay-top-banner {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 16px 20px;
          border-radius: 18px;
          margin-bottom: 24px;
        }
        .pay-top-banner-error {
          background: #fef2f2;
          border: 1px solid #fee2e2;
        }
        .pay-top-banner-cancel {
          background: #fffbeb;
          border: 1px solid #fef3c7;
        }
        .pay-top-banner-success {
          background: #f0fdf4;
          border: 1px solid #dcfce7;
        }
        .pay-top-banner-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-weight: 800;
        }
        .pay-icon-error {
          background: #ef4444;
          color: #ffffff;
          font-size: 24px;
          font-family: Arial, sans-serif;
        }
        .pay-icon-cancel {
          background: #f59e0b;
          color: #ffffff;
          font-size: 24px;
          font-family: Arial, sans-serif;
        }
        .pay-icon-success {
          background: #16a34a;
          color: #ffffff;
        }
        .pay-top-banner-title {
          font-size: 16.5px;
          font-weight: 700;
          margin: 0;
          line-height: 1.3;
        }
        .pay-top-banner-error .pay-top-banner-title {
          color: #dc2626;
        }
        .pay-top-banner-cancel .pay-top-banner-title {
          color: #d97706;
        }
        .pay-top-banner-success .pay-top-banner-title {
          color: #15803d;
        }
        .pay-top-banner-sub {
          font-size: 13.5px;
          color: #64748b;
          margin-top: 3px;
          margin-bottom: 0;
          line-height: 1.35;
        }

        /* Profile Header */
        .pay-profile-section {
          text-align: center;
          margin-bottom: 22px;
        }
        .pay-avatar-container {
          display: inline-block;
          position: relative;
        }
        .pay-avatar {
          width: 86px;
          height: 86px;
          border-radius: 50%;
          object-fit: cover;
          border: 3.5px solid #ffffff;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
          background: #e2e8f0;
        }
        .pay-profile-name {
          font-size: 19px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 10px;
          margin-bottom: 0;
          letter-spacing: -0.01em;
        }

        /* Table Card Container */
        .pay-table-card {
          border: 1px solid #f1f5f9;
          border-radius: 16px;
          overflow: hidden;
          background: #ffffff;
          margin-bottom: 18px;
        }
        .pay-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-bottom: 1px solid #f8fafc;
          transition: background 0.15s ease;
        }
        .pay-row:last-child {
          border-bottom: none;
        }
        .pay-row:hover {
          background: #fbfcfe;
        }

        /* Pill Badge on Left Column */
        .pay-pill {
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 10px;
          padding: 6px 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 146px;
          flex-shrink: 0;
        }
        .pay-pill-label {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
        }

        /* Right Value Column */
        .pay-value {
          flex: 1;
          padding-left: 20px;
          font-size: 13.5px;
          color: #334155;
          word-break: break-word;
          line-height: 1.4;
        }
        .pay-amount-value {
          font-size: 14.5px;
          font-weight: 700;
          color: #0f172a;
        }

        /* Bottom Alert */
        .pay-bottom-alert {
          border-radius: 12px;
          padding: 12px 18px;
          margin-bottom: 22px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
        }
        .pay-bottom-alert-error {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #dc2626;
        }
        .pay-bottom-alert-success {
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          color: #15803d;
        }
        .pay-bottom-alert-cancel {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          color: #d97706;
        }
        .pay-bottom-alert-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ef4444;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          font-family: Arial, sans-serif;
          flex-shrink: 0;
        }
        .pay-bottom-icon-success {
          background: #16a34a;
        }
        .pay-bottom-icon-cancel, .contact-submit:hover {
          background: #f59e0b;
        }

        /* Main Action Button */
        .pay-btn-continue{
          width: 100%;
          border: none;
          border-radius: 50px;
          background: linear-gradient(135deg, #1d68f5 0%, #1555cb 100%);
          color: #ffffff;
          padding: 15px 30px;
          font-size: 14.5px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 24px -4px rgba(29, 104, 245, 0.4);
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }
        .pay-btn-continue:hover,
        .contact-submit:hover {
          background: linear-gradient(135deg, #1F5FAF 0%, #5AA9F0 100%);
          box-shadow: 0 14px 28px -4px rgba(29, 104, 245, 0.5);
          color: #ffffff;
          transform: translateY(-1px);
        }
        .pay-btn-continue:active,
        .contact-submit:active {
          transform: translateY(0);
        }
        .pay-btn-continue:disabled,
        .contact-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Loading Skeleton / Spinner */
        .pay-loading-box {
          min-height: 380px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }
        .pay-spinner {
          width: 44px;
          height: 44px;
          border: 3.5px solid #e2e8f0;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: paySpin 0.75s linear infinite;
        }
        @keyframes paySpin {
          to { transform: rotate(360deg); }
        }

        /* Empty State */
        .pay-empty-box {
          text-align: center;
          padding: 40px 20px;
        }
        .pay-empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        /* Responsive Adjustments */
        @media (max-width: 600px) {
          .pay-viewport-wrapper {
            padding: 30px 12px 60px;
          }
          .pay-card {
            padding: 24px 20px 28px;
            border-radius: 20px;
          }
          .pay-top-banner {
            padding: 14px 16px;
            gap: 14px;
          }
          .pay-top-banner-icon {
            width: 42px;
            height: 42px;
            font-size: 20px;
          }
          .pay-top-banner-title {
            font-size: 15px;
          }
          .pay-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            padding: 10px 12px;
          }
          .pay-pill {
            min-width: unset;
            width: 100%;
          }
          .pay-value {
            padding-left: 6px;
            width: 100%;
          }
        }
      `}</style>

        {/* Decorative Pastel Background Blobs & Dots */}
        <div className="pay-blob pay-blob-1" />
        <div className="pay-blob pay-blob-2" />
        <div className="pay-blob pay-blob-3" />
        <div className="pay-dot pay-dot-green" />
        <div className="pay-dot pay-dot-yellow" />
        <div className="pay-dot pay-dot-blue" />
        <div className="pay-dot pay-dot-top-green" />

        {/* Main Content Card */}
        <div className="pay-card">
          {loading ? (
            <div className="pay-loading-box">
              <div className="pay-spinner" />
              <p
                style={{ color: "#64748b", fontSize: "14px", fontWeight: 500 }}
              >
                Loading enrollment details…
              </p>
            </div>
          ) : alllists.length === 0 ? (
            <div className="pay-empty-box">
              <div className="pay-empty-icon">
                <HelpCircle size={28} />
              </div>
              <h5
                style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}
              >
                No Information Available
              </h5>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "13.5px",
                  maxWidth: "380px",
                  margin: "0 auto 20px",
                }}
              >
                Please check your payment link or contact our student support
                team.
              </p>
              <a
                href="/"
                className="pay-btn-continue"
                style={{
                  maxWidth: "260px",
                  margin: "0 auto",
                  fontSize: "13px",
                }}
              >
                RETURN TO HOME <ArrowRight size={16} />
              </a>
            </div>
          ) : (
            <div>
              {/* Top Alert Banner */}
              {isFailed && (
                <div className="pay-top-banner pay-top-banner-error">
                  <div className="pay-top-banner-icon pay-icon-error">!</div>
                  <div>
                    <h5 className="pay-top-banner-title">
                      Unfortunately, your payment could not be processed.
                    </h5>
                    <p className="pay-top-banner-sub">
                      Please try again or contact support.
                    </p>
                  </div>
                </div>
              )}

              {isCanceled && (
                <div className="pay-top-banner pay-top-banner-cancel">
                  <div className="pay-top-banner-icon pay-icon-cancel">!</div>
                  <div>
                    <h5 className="pay-top-banner-title">
                      Payment process was canceled before completion.
                    </h5>
                    <p className="pay-top-banner-sub">
                      If you'd like to continue your enrollment, please try the
                      payment again.
                    </p>
                  </div>
                </div>
              )}

              {isSuccess && (
                <div className="pay-top-banner pay-top-banner-success">
                  <div className="pay-top-banner-icon pay-icon-success">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h5 className="pay-top-banner-title">
                      Your payment has been processed successfully!
                    </h5>
                    <p className="pay-top-banner-sub">
                      Thank you for your payment! Your course access is
                      activated.
                    </p>
                  </div>
                </div>
              )}

              {/* Profile Avatar & Name */}
              <div className="pay-profile-section">
                <div className="pay-avatar-container">
                  <img
                    src={
                      item.gender === "1"
                        ? "/images/malepic.jpg"
                        : item.gender === "2"
                          ? "/images/femalepic.jpg"
                          : "/images/malepic.jpg"
                    }
                    alt={item.name || "Student Profile"}
                    className="pay-avatar"
                    onError={(e) => {
                      // Fallback to default user avatar if not loaded
                      (e.target as HTMLImageElement).src =
                        "/images/malepic.jpg";
                    }}
                  />
                </div>
                <h4 className="pay-profile-name">{item.name || "-"}</h4>
              </div>

              {/* Details Table */}
              <div className="pay-table-card">
                {/* 1. Name */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <User size={16} color="#3b82f6" />
                    <span className="pay-pill-label">Name</span>
                  </div>
                  <div className="pay-value">{item.name || "-"}</div>
                </div>

                {/* 2. Gender */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <Users size={16} color="#8b5cf6" />
                    <span className="pay-pill-label">Gender</span>
                  </div>
                  <div className="pay-value">{getGender(item.gender)}</div>
                </div>

                {/* 3. Email */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <Mail size={16} color="#10b981" />
                    <span className="pay-pill-label">Email</span>
                  </div>
                  <div className="pay-value">{item.email || "-"}</div>
                </div>

                {/* 4. Phone */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <Phone size={16} color="#0ea5e9" />
                    <span className="pay-pill-label">Phone</span>
                  </div>
                  <div className="pay-value">{item.number || "-"}</div>
                </div>

                {/* 5. Qualification */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <GraduationCap size={16} color="#8b5cf6" />
                    <span className="pay-pill-label">Qualification</span>
                  </div>
                  <div className="pay-value">{item.qualification || "-"}</div>
                </div>

                {/* 6. Course */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <BookOpen size={16} color="#5B3FE8" />
                    <span className="pay-pill-label">Course</span>
                  </div>
                  <div className="pay-value">
                    {decodeHtml(item.course_name)}
                  </div>
                </div>

                {/* 7. Plan (if exists) */}
                {item.plan && (
                  <div className="pay-row">
                    <div className="pay-pill">
                      <FileText size={16} color="#ec4899" />
                      <span className="pay-pill-label">Plan</span>
                    </div>
                    <div className="pay-value">{item.plan}</div>
                  </div>
                )}

                {/* 8. Addon (if exists) */}
                {item.addon && (
                  <div className="pay-row">
                    <div className="pay-pill">
                      <Layers size={16} color="#6366f1" />
                      <span className="pay-pill-label">Add-on</span>
                    </div>
                    <div className="pay-value">{item.addon}</div>
                  </div>
                )}

                {/* 9. Amount */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <CreditCard size={16} color="#10b981" />
                    <span className="pay-pill-label">Amount</span>
                  </div>
                  <div className="pay-value pay-amount-value">
                    {item.currency || "USD"} {item.fees}
                  </div>
                </div>

                {/* 10. Requested On */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <Calendar size={16} color="#a855f7" />
                    <span className="pay-pill-label">Requested On</span>
                  </div>
                  <div className="pay-value">{formatDate(item.datetime)}</div>
                </div>

                {/* 11. Status */}
                <div className="pay-row">
                  <div className="pay-pill">
                    <Clock size={16} color="#5B3FE8" />
                    <span className="pay-pill-label">Status</span>
                  </div>
                  <div className="pay-value">
                    {renderStatusBadge(item.status)}
                  </div>
                </div>
              </div>

              {/* Bottom Alert Message */}
              {isFailed && (
                <div className="pay-bottom-alert pay-bottom-alert-error">
                  <div className="pay-bottom-alert-icon">i</div>
                  <span>
                    {error ||
                      "Unfortunately, your payment could not be processed. Please try again or contact support."}
                  </span>
                </div>
              )}

              {isCanceled && (
                <div className="pay-bottom-alert pay-bottom-alert-cancel">
                  <div className="pay-bottom-alert-icon pay-bottom-icon-cancel">
                    !
                  </div>
                  <span>
                    Your payment process was canceled before completion. Please
                    click continue to try again.
                  </span>
                </div>
              )}

              {isSuccess && (
                <div className="pay-bottom-alert pay-bottom-alert-success">
                  <div className="pay-bottom-alert-icon pay-bottom-icon-success">
                    ✓
                  </div>
                  <span>
                    {success ||
                      "Your payment has been processed successfully. Thank you for your payment!"}
                  </span>
                </div>
              )}

              {/* Continue or Dashboard Action Button */}
              {String(item.status) === "1" || isFailed || isCanceled ? (
                <button
                  className="contact-submit"
                  disabled={loading}
                  onClick={() => {
                    paymentNow();
                    setTimeout(() => {
                      document
                        .querySelector(".pay-loading-box")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 50);
                  }}
                >
                  {loading ? "CONTINUING…" : "CONTINUE"}{" "}
                  <ArrowRight size={18} style={{ strokeWidth: 2.5 }} />
                </button>
              ) : String(item.status) === "2" || String(item.status) === "3" ? (
                <a
                  href="/signin"
                  className="pay-btn-continue"
                  style={{ textDecoration: "none" }}
                >
                  ACCESS STUDENT PORTAL{" "}
                  <ArrowRight size={18} style={{ strokeWidth: 2.5 }} />
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
