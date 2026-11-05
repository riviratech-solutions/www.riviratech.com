import { Head, SERVER_URL, ADDRESS } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import {
  CreditCard,
  Printer,
  RotateCw,
  User,
  BookOpen,
  Phone,
  ShieldCheck,
  Download,
} from "lucide-react";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { InlineLoader } from "../../../components/loading";

const seo = getSeoByPath("");

export default function MyIDCard() {
  const navigate = useNavigate();

  const [ploading, setpLoading] = useState(true);
  const [error, setError] = useState("");
  const [myprofile, setmyprofile] = useState<any[]>([]);
  // the student's active enrolments: { course_name, batch_name }
  const [enrolled, setEnrolled] = useState<any[]>([]);
  const [activeCard, setActiveCard] = useState<string>("all");


  // course titles / batch names are stored HTML-encoded
  const decodeHtml = (str: any) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = str ?? "";
    return txt.value;
  };

  const loadMyProfile = async () => {
    try {
      setpLoading(true);
      const res = await listFetch("api/get-myprofile", {
          status: "",
        });

      if (res.data.success) {
        setmyprofile(res.data.data || []);
        setEnrolled(
          (res.data.courses || []).filter(
            (c: any) => String(c.status ?? "1") === "1" && c.course_name,
          ),
        );
      } else {
        toast.error(res.data.message || "Failed to load ID card");
      }
    } catch (err: any) {
      setError(err?.message || "❌ Something went wrong");
    } finally {
      setpLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && res.data.id === "1") {
          loadMyProfile();
        } else {
          navigate("/logout");
        }
      })
      .catch(() => navigate("/logout"));
  }, []);

  const profile = myprofile[0] || {};
  const courseNames = [...new Set(enrolled.map((c) => decodeHtml(c.course_name)))];
  const batchNames = [...new Set(enrolled.map((c) => decodeHtml(c.batch_name)).filter(Boolean))];
  const primaryCourse = courseNames[0] || "";

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Head
        pageTitle={seo.title || "Student ID Card - Rivira Technologies"}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />

      <div className="content">
        <div className="container-fluid p-4 si-wrapper">
          {/* Header Bar */}
          <div className="si-header-card d-print-none">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Student Digital ID Card</h3>
                <p className="si-header-subtitle">
                  Official Rivira Technologies credential & verification identification badge.
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <SavedAgo endpoint="api/get-myprofile" />
              <button data-refresh
                type="button"
                className="si-btn-export-excel"
                onClick={loadMyProfile}
                disabled={ploading}
                title="Refresh ID Card"
              >
                <RotateCw size={14} className={ploading ? "si-spin" : ""} /> Refresh
              </button>
              <button
                type="button"
                className="si-btn-export-csv"
                onClick={handlePrint}
                disabled={ploading || !profile.name}
              >
                <Printer size={15} /> Print / Save ID Card
              </button>
            </div>
          </div>

          {/* Stats KPI Grid */}
          <div className="si-stats-grid d-print-none">
            {/* Student Name */}
            <div
              className={`si-stat-card card-total ${activeCard === "name" ? "active" : ""}`}
              onClick={() => {
                setActiveCard(prev => prev === "name" ? "all" : "name");
                document.querySelector('.si-idcard-showcase-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Click to highlight student profile on ID card"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <User size={22} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <p className="si-stat-label">Student Name</p>
                <h3 className="si-stat-value text-truncate" title={profile.name || "Student"}>
                  {profile.name || (ploading ? <InlineLoader /> : "—")}
                </h3>
              </div>
            </div>

            {/* Course Enrolled */}
            <div
              className={`si-stat-card card-approved ${activeCard === "course" ? "active" : ""}`}
              onClick={() => {
                setActiveCard(prev => prev === "course" ? "all" : "course");
                document.querySelector('.si-idcard-showcase-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Click to view enrolled course on ID card"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <BookOpen size={22} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <p className="si-stat-label">Primary Course</p>
                <h3 className="si-stat-value text-truncate" title={courseNames.join(", ") || "Course"}>
                  {primaryCourse || (ploading ? <InlineLoader /> : "Enrolled")}
                </h3>
              </div>
            </div>

            {/* Contact */}
            <div
              className={`si-stat-card card-recent ${activeCard === "contact" ? "active" : ""}`}
              onClick={() => {
                setActiveCard(prev => prev === "contact" ? "all" : "contact");
                document.querySelector('.si-idcard-showcase-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Click to view contact info on ID card"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "#7c3aed" }}
              >
                <Phone size={22} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <p className="si-stat-label">Contact Number</p>
                <h3 className="si-stat-value text-truncate">
                  {profile.number || (ploading ? <InlineLoader /> : "—")}
                </h3>
              </div>
            </div>

            {/* Status */}
            <div
              className={`si-stat-card card-rejected ${activeCard === "status" ? "active" : ""}`}
              onClick={() => {
                setActiveCard(prev => prev === "status" ? "all" : "status");
                document.querySelector('.si-idcard-showcase-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Click to view student active credentials"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="si-stat-label">Status</p>
                <h3 className="si-stat-value" style={{ color: "#16a34a" }}>
                  Active Student
                </h3>
              </div>
            </div>
          </div>

          {/* ID Card Presentation Box */}
          <div className="si-idcard-showcase-card">
            {error && (
              <div className="alert alert-danger mb-4 d-print-none">{error}</div>
            )}

            {ploading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading…</span>
                </div>
                <p className="text-muted mt-2 mb-0">Generating student ID card…</p>
              </div>
            ) : myprofile.length === 0 ? (
              <div className="si-empty-state">
                <div className="si-empty-icon">
                  <CreditCard size={40} />
                </div>
                <h4 className="si-empty-title">No ID Card Profile Found</h4>
                <p className="si-empty-desc">
                  Unable to load your student profile information. Please verify your enrollment status.
                </p>
                <button
                  type="button"
                  className="si-btn-export-excel mt-2"
                  onClick={loadMyProfile}
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="idcardpage text-center py-2">

                <div className="idcard d-inline-block text-start">
                  <div className="id-card">
                    {/* Logo Header */}
                    <div className="idlogo">
                      <img
                        src="/images/logo_mark_dark.png"
                        alt="Rivira Technologies"
                      />
                      <p>Think Upskilling, Think Rivira Tech.</p>
                    </div>

                    {/* Student & Center Details */}
                    <div className="details">
                      <p>
                        <strong>Name:</strong> {profile.name || "Student Name"}
                      </p>
                      <p>
                        <strong>Mobile No:</strong> {profile.number || "—"}
                      </p>
                      <p>
                        <strong>{courseNames.length > 1 ? "Courses" : "Course"}:</strong>{" "}
                        {courseNames.join(", ") || "—"}
                      </p>
                      <p>
                        <strong>{batchNames.length > 1 ? "Batches" : "Batch"}:</strong>{" "}
                        {batchNames.join(", ") || "—"}
                      </p>
                      <p>
                        <strong>Address:</strong> {ADDRESS}
                        <br />
                        <a href="tel:+14708616312">+1 4708616312 US</a>
                      </p>
                    </div>

                    {/* QR Code / Security Badge */}
                    <div className="qr-code">
                      {/* Optional QR slot */}
                    </div>

                    {/* Footer */}
                    <div className="idfooter">
                      <span className="student-card">Student I-Card</span>
                      <span className="id-number">#Rivira Technologies</span>
                    </div>

                    {/* Decorative Background Elements */}
                    <div className="bg1">
                      <img src="/images/idbg1.png" alt="" />
                    </div>

                    <div className="bg2">
                      <img src="/images/idbg2.png" alt="" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex justify-content-center gap-3 d-print-none flex-wrap">
                  <button
                    type="button"
                    className="si-btn-export-csv"
                    onClick={handlePrint}
                  >
                    <Printer size={16} /> Print ID Card
                  </button>
                  <button
                    type="button"
                    className="si-btn-export-excel"
                    onClick={() => {
                      toast.info("Tip: Choose 'Save as PDF' in the print dialog to export a digital copy.");
                      window.print();
                    }}
                  >
                    <Download size={15} /> Save as PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scoped CSS matching StudentsInquiries.tsx standard + ID card styling */}
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
        }
        .si-btn-export-csv:hover {
          background: #4b24d6;
          border-color: #4b24d6;
          color: #ffffff;
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
        .si-stat-card.card-recent { background: #faf5ff; }
        .si-stat-card.card-recent.active {
          border-color: #7c3aed !important;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25) !important;
        }
        .si-stat-card.card-rejected { background: #fffdf0; }
        .si-stat-card.card-rejected.active {
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
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
          margin-top: 4px;
          margin-bottom: 0;
        }

        /* Showcase Card */
        .si-idcard-showcase-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 32px 24px;
          border: 1px solid #edf2f7;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          position: relative;
        }

        .si-badge-lanyard {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: -10px;
          z-index: 2;
          position: relative;
        }
        .si-badge-clip {
          width: 24px;
          height: 16px;
          background: #64748b;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }
        .si-badge-slot {
          width: 50px;
          height: 8px;
          background: #cbd5e1;
          border-radius: 4px;
          margin-top: 2px;
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
          max-width: 420px;
          margin: 0 auto 16px;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .idcard, .idcard * {
            visibility: visible;
          }
          .idcard {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}