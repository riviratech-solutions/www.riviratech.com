import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { SERVER_URL } from "../../components/Includes";
import {
  Download,
  Printer,
  AlertCircle,
  Clock,
  ArrowLeft,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";
// @ts-ignore
import html2pdf from "html2pdf.js";
import QRCode from "qrcode";

interface CertificateData {
  id: number;
  req_id: string;
  mem_id: string;
  name: string;
  email: string;
  number?: string;
  type?: string;
  course: string;
  course_name: string;
  program_name: string;
  batch?: string;
  batch_name?: string;
  ac_type?: string;
  c_type?: string;
  sdate?: string | number;
  edate?: string | number;
  datetime?: string | number;
  updatetime?: string | number;
  status: string; // '2' = Approved, '1' = Pending, '0' = Rejected
}

/* The three certificates (public/certicates), chosen by the batch's
   certificate type — Admin → Batches (batches.c_type):
     1 Certificate of Kids Completion · 2 Certificate of Completion ·
     3 Certificate of Bootcamp Participation
   The API falls back to the account type for batches made before that setting.
   Each template has its own lines, so each says where its printed fields sit
   (centre points, % of the 1120×747 certificate). */
type Spot = React.CSSProperties;
interface CertLayout {
  img: string;
  name: Spot;
  course: Spot;
  date: Spot;
  sign: Spot;
  stamp: Spot;
  /** verify QR: centre of the white QR box, width = the box's width */
  qr: Spot;
  /** bottom lines (centre points; fontSize / letterSpacing may be set too) */
  credential: Spot;
  student: Spot;
  verify: Spot;
}
// "Completion" and "Bootcamp Participation" share one design
const KIDS_SPOTS = {
  name: { top: "43.5%", left: "50.3%", width: "60%" },
  course: { top: "55%", left: "50.3%", width: "55%" },
  date: { top: "86%", left: "71.5%", width: "22%" },
  sign: { top: "84.8%", left: "29%", width: "15.5%" },
  stamp: { top: "86.2%", left: "34.5%", width: "9.5%" },
};

const ADULT_SPOTS = {
  name: { top: "44.3%", left: "52.1%", width: "52%" },
  course: { top: "55.2%", left: "52.1%", width: "80%" },
  date: { top: "86.6%", left: "79.5%", width: "22%" },
  sign: { top: "84.8%", left: "30.9%", width: "15.5%" },
  stamp: { top: "86.2%", left: "38.4%", width: "9.5%" },
};
// Set per certificate (Completion and Bootcamp can differ): the verify QR and
// the bottom lines — Credential ID, Student ID, Verify Authenticity
const CERT_LAYOUTS: Record<string, CertLayout> = {
  "1": {
    img: "/certicates/Certificate of Kids Completion.png",
    ...KIDS_SPOTS,
    qr: { top: "86.5%", left: "92.3%", width: "11.9%" },
    credential: { top: "96.2%", left: "28.4%", fontSize: "8px", letterSpacing: "0.4px" },
    student: { top: "96.2%", left: "50.5%", fontSize: "8px", letterSpacing: "0.4px" },
    verify: { top: "96.2%", left: "72.1%", fontSize: "8px", letterSpacing: "0.4px" },
  },
  "2": {
    img: "/certicates/Certificate of Completion.png",
    ...ADULT_SPOTS,
    qr: { top: "12%", left: "92.3%", width: "11.9%" },
    credential: { top: "95.9%", left: "30.5%" },
    student: { top: "98.3%", left: "30.5%" },
    verify: { top: "97.6%", left: "88%" },
  },
  "3": {
    img: "/certicates/Certificate of Bootcamp Participation.png",
    ...ADULT_SPOTS,
    qr: { top: "12%", left: "92.3%", width: "11.9%" },
    credential: { top: "95.9%", left: "30.5%" },
    student: { top: "98.3%", left: "30.5%" },
    verify: { top: "97.6%", left: "88%" },
  },
};
const CERT_NAMES: Record<string, string> = {
  "1": "Certificate of Kids Completion",
  "2": "Certificate of Completion",
  "3": "Certificate of Bootcamp Participation",
};
const layoutFor = (c?: string, ac?: string) =>
  CERT_LAYOUTS[String(c || "")] || (ac === "KID" ? CERT_LAYOUTS["1"] : CERT_LAYOUTS["2"]);

export default function CertificateDownload({ isPanel = false }: { isPanel?: boolean }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const reqIdParam = searchParams.get("req_id") || searchParams.get("id") || "";
  const memIdParam = searchParams.get("m") || searchParams.get("mem_id") || "";

  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Manual search input if accessed without params
  const [manualReqId, setManualReqId] = useState("");

  const certificateRef = useRef<HTMLDivElement>(null);

  // Helper date formatter
  const formatCertDate = (rawDate?: string | number) => {
    if (!rawDate) return "October 2024";
    const ts = typeof rawDate === "string" ? parseInt(rawDate, 10) : rawDate;
    if (isNaN(ts) || ts <= 0) return "October 2024";
    // If epoch timestamp is in seconds, convert to ms
    const dateObj = ts < 10000000000 ? new Date(ts * 1000) : new Date(ts);
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const loadCertificate = async (reqId: string, mId: string) => {
    if (!reqId && !mId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${SERVER_URL}api/certificate/details?req_id=${encodeURIComponent(reqId)}&m=${encodeURIComponent(mId)}`,
        { withCredentials: true }
      );
      if (res.data?.success && res.data?.data) {
        setCertData(res.data.data);
      } else {
        setError(res.data?.message || "Certificate details could not be found.");
      }
    } catch (err: any) {
      console.error("Certificate load error:", err);
      setError(
        err.response?.data?.message || "Failed to load certificate. Please verify your link."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificate(reqIdParam, memIdParam);
  }, [reqIdParam, memIdParam]);

  useEffect(() => {
    if (certData) {
      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://www.riviratech.com";
      const targetUrl = `${origin}/certificate/download?m=${encodeURIComponent(certData.mem_id || "")}&req_id=${encodeURIComponent(certData.req_id)}`;

      QRCode.toDataURL(targetUrl, {
        width: 280,
        margin: 1,
        color: {
          dark: "#17145C",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((url: string) => setQrCodeDataUrl(url))
        .catch((err: any) => console.error("QR Code generation error:", err));
    } else {
      setQrCodeDataUrl("");
    }
  }, [certData]);

  const verifyUrl = certData
    ? `${typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://www.riviratech.com"}/certificate/download?m=${encodeURIComponent(certData.mem_id || "")}&req_id=${encodeURIComponent(certData.req_id)}`
    : "";

  // Handle Download PDF using html2pdf.js
  const handleDownloadPdf = async () => {
    if (!certificateRef.current) return;
    setIsDownloading(true);

    const safeName = (certData?.name || "Student").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `RiviraTech_Certificate_${safeName}.pdf`;

    const opt = {
      margin: 0,
      filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
      },
      // Page = the certificate's own 1120×747 proportions (297 × 198 mm, as in
      // the print styles) — A4 is taller and left a white band at the bottom.
      jsPDF: {
        unit: "mm" as const,
        format: [297, (297 * 747) / 1120] as [number, number],
        orientation: "landscape" as const,
      },
      pagebreak: { mode: "avoid-all" },
    };

    // html2canvas finds each font's baseline with a hidden <img> it appends as
    // a direct child of <body>. The site stylesheet's `img { display: block }`
    // breaks that measurement, so every line of text was drawn too low (the
    // name dropped below its line and was clipped). Undo it for the capture only.
    const metricsFix = document.createElement("style");
    metricsFix.textContent = "body > div:not(#root) > img { display: inline-block !important; vertical-align: baseline !important; }";
    document.head.appendChild(metricsFix);

    try {
      // Script/serif web fonts must be ready, or the canvas uses fallbacks
      await document.fonts?.ready;
      await html2pdf().set(opt).from(certificateRef.current).save();
      toast.success("Certificate downloaded successfully!");
    } catch (err: any) {
      console.error("html2pdf error:", err);
      toast.info("Opening print dialog as fallback...");
      window.print();
    } finally {
      metricsFix.remove();
      setIsDownloading(false);
    }
  };

  // Browser Print fallback
  const handlePrint = () => {
    window.print();
  };

  // Copy shareable link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Certificate link copied to clipboard!");
  };

  const isApproved = certData?.status === "2";
  const layout = layoutFor(certData?.c_type, certData?.ac_type);
  const isPending = certData?.status === "1";
  const isRejected = certData?.status === "0";

  return (
    <>
      {/* Dynamic Font Styling & Print Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Balsamiq+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Bebas+Neue&family=Great+Vibes&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Roboto+Slab:wght@100..900&display=swap');
        @import url('https://fonts.googleapis.com/css?family=Tangerine:wght@400;700&display=swap');

        .cert-canvas {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: #ffffff;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08);
          width: 1120px;
          height: 747px;
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
          border-radius: 4px;
        }

        /* Tangerine Bold under its own family name, at normal weight. The PDF
           (html2canvas) finds each font's baseline at normal weight, and
           Tangerine Bold sits ~10px higher in its box than Tangerine Regular:
           measured as Regular, the name was drawn low in the PDF, on top of
           the gold line and "has successfully completed the". With its own
           family the PDF measures the very font it draws. */
        @font-face {
          font-family: 'Rivira Tangerine Bold';
          src: url('/fonts/tangerine-700-latin.woff2') format('woff2');
          font-weight: 400;
          font-style: normal;
          font-display: block;
        }

        .cert-name-tangerine {
          font-family: 'Rivira Tangerine Bold', 'Tangerine', Georgia, serif !important;
          font-size: 50px;
          color: #17145C;
          letter-spacing: 0.5px;
          text-transform: capitalize;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1;
        }

        .cert-serif {
          font-family: 'Playfair Display', Georgia, serif;
        }

        .cert-sans-bold {
          font-family: 'Montserrat', 'Inter', -apple-system, sans-serif;
        }

        /* Watermark for unapproved / sample preview */
        .cert-sample-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-family: 'Montserrat', sans-serif;
          font-size: 110px;
          font-weight: 900;
          color: rgba(148, 163, 184, 0.42);
          letter-spacing: 20px;
          pointer-events: none;
          user-select: none;
          text-transform: uppercase;
          z-index: 20;
          white-space: nowrap;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cert-no-print {
            display: none !important;
          }
          .cert-outer-wrapper {
            background: #ffffff !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          .cert-canvas {
            width: 297mm !important;
            height: 198mm !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        @media (max-width: 1160px) {
          .cert-viewport-scale {
            transform-origin: top center;
            transform: scale(calc((100vw - 32px) / 1120));
            margin-bottom: calc(747px * (1 - ((100vw - 32px) / 1120)) * -1);
          }
        }
      `}</style>

      <div
        className="cert-outer-wrapper"
        style={{
          minHeight: "100vh",
          backgroundColor: "#0B0A2E",
          backgroundImage: "radial-gradient(ellipse at 50% 0%, #1E1670 0%, #0B0A2E 75%)",
          paddingBottom: "80px",
        }}
      >
        {/* Top Floating Control Bar */}
        <header
          className="cert-no-print"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            backgroundColor: "rgba(11, 19, 43, 0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "14px 24px",
          }}
        >
          <div
            style={{
              maxWidth: "1140px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {/* Left Nav */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={() => (isPanel ? navigate("/panel/certificates") : navigate("/"))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontWeight: 500,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)")}
              >
                <ArrowLeft size={16} />
                {isPanel ? "Back to Certificates" : "Back to Website"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "15px",
                    letterSpacing: "-0.2px",
                  }}
                >
                  Rivira Technologies
                </span>
                <span style={{ color: "#94a3b8", fontSize: "14px" }}>|</span>
                <span style={{ color: "#cbd5e1", fontSize: "13.5px" }}>Certificate Download</span>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {certData && (
                <>
                  {/* Status Badge */}
                  {isApproved && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        backgroundColor: "rgba(22, 163, 74, 0.2)",
                        border: "1px solid rgba(34, 197, 94, 0.4)",
                        color: "#4ade80",
                        fontSize: "12.5px",
                        fontWeight: 600,
                      }}
                    >
                      <ShieldCheck size={15} />
                      Verified &amp; Approved
                    </div>
                  )}

                  {isPending && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        backgroundColor: "rgba(234, 179, 8, 0.18)",
                        border: "1px solid rgba(234, 179, 8, 0.4)",
                        color: "#fde047",
                        fontSize: "12.5px",
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={14} />
                      Pending Approval (Sample Preview)
                    </div>
                  )}

                  {isRejected && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        backgroundColor: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        color: "#f87171",
                        fontSize: "12.5px",
                        fontWeight: 600,
                      }}
                    >
                      <AlertCircle size={14} />
                      Request Rejected
                    </div>
                  )}

                  {/* Copy Link */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.18)",
                      color: "#f1f5f9",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                    title="Copy Certificate Link"
                  >
                    <Copy size={15} />
                    Copy Link
                  </button>

                  {/* Print / Save PDF */}
                  <button
                    type="button"
                    onClick={handlePrint}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.18)",
                      color: "#f1f5f9",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                    title="Print or Save as PDF"
                  >
                    <Printer size={15} />
                    Print
                  </button>

                  {/* Primary Download PDF Button */}
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isDownloading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "9px 18px",
                      borderRadius: "8px",
                      backgroundColor: "#5B3FE8",
                      border: "1px solid #A78BFA",
                      color: "#ffffff",
                      fontSize: "13.5px",
                      fontWeight: 700,
                      cursor: isDownloading ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 14px rgba(22, 163, 74, 0.4)",
                      transition: "transform 0.15s ease, background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isDownloading) e.currentTarget.style.backgroundColor = "#4C2FD0";
                    }}
                    onMouseLeave={(e) => {
                      if (!isDownloading) e.currentTarget.style.backgroundColor = "#5B3FE8";
                    }}
                  >
                    <Download size={16} />
                    {isDownloading ? "Generating PDF..." : "Download in PDF"}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ padding: "40px 16px 20px" }}>
          {/* Loading state */}
          {loading && (
            <div style={{ textAlign: "center", padding: "100px 20px", color: "#f8fafc" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "4px solid rgba(255, 255, 255, 0.1)",
                  borderTopColor: "#A78BFA",
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <h5 style={{ fontWeight: 600 }}>Loading certificate...</h5>
              <p style={{ color: "#94a3b8", fontSize: "14px" }}>Verifying credentials and preparing preview</p>
            </div>
          )}

          {/* Error / Not Found */}
          {!loading && error && (
            <div
              className="cert-no-print"
              style={{
                maxWidth: "520px",
                margin: "60px auto",
                padding: "36px",
                backgroundColor: "#1e293b",
                borderRadius: "16px",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f8fafc",
                textAlign: "center",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              }}
            >
              <AlertCircle size={44} color="#ef4444" style={{ margin: "0 auto 16px" }} />
              <h4 style={{ fontWeight: 700, marginBottom: "8px" }}>Certificate Not Found</h4>
              <p style={{ color: "#cbd5e1", fontSize: "14.5px", lineHeight: "1.6" }}>{error}</p>

              <div style={{ marginTop: "24px", display: "flex", justifyContent: "center", gap: "12px" }}>
                <Link
                  to="/certificate-request"
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontSize: "13.5px",
                    fontWeight: 600,
                  }}
                >
                  Request a Certificate
                </Link>
                <Link
                  to="/"
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontSize: "13.5px",
                    fontWeight: 500,
                  }}
                >
                  Go to Home
                </Link>
              </div>
            </div>
          )}

          {/* Form to enter ID if no params provided */}
          {!loading && !certData && !error && !reqIdParam && (
            <div
              className="cert-no-print"
              style={{
                maxWidth: "480px",
                margin: "60px auto",
                padding: "36px",
                backgroundColor: "#1e293b",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#f8fafc",
                textAlign: "center",
              }}
            >
              <ShieldCheck size={48} color="#A78BFA" style={{ margin: "0 auto 16px" }} />
              <h4 style={{ fontWeight: 700, marginBottom: "8px" }}>Certificate Verification</h4>
              <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "20px" }}>
                Enter your Certificate Request ID or Student ID to view and download your official certificate.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualReqId.trim()) {
                    loadCertificate(manualReqId.trim(), "");
                  }
                }}
              >
                <input
                  type="text"
                  placeholder="e.g. ad387d527c077ae1eda21c42c9fcc9d61"
                  value={manualReqId}
                  onChange={(e) => setManualReqId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    color: "#ffffff",
                    fontSize: "14px",
                    marginBottom: "16px",
                    outline: "none",
                  }}
                  required
                />

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "#5B3FE8",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  View Certificate
                </button>
              </form>
            </div>
          )}



          {!loading && certData && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                padding: "10px 0",
              }}
            >
              <div className="cert-viewport-scale">
                {/* The Exact Printable / Downloadable Canvas */}
                <div
                  id="certificate-print-area"
                  ref={certificateRef}
                  className="cert-canvas"
                  style={{
                    width: "1120px",
                    height: "747px",
                    position: "relative",
                    background: "#ffffff",
                    overflow: "hidden",
                    userSelect: "none",
                  }}
                >
                  {/* Official Certificate Background Template Image */}
                  <img
                    src={layout.img}
                    alt={CERT_NAMES[certData.c_type || ""] || "Certificate"}
                    crossOrigin="anonymous"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "fill",
                      zIndex: 1,
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  />

                  {/* Subtle Background Watermark if not approved or if sample */}
                  {!isApproved && <div className="cert-sample-watermark">SAMPLE</div>}

                  {/* Verification QR Code (layout.qr: centre + width of the white box) */}
                  {qrCodeDataUrl && (
                    <div
                      style={{
                        position: "absolute",
                        ...layout.qr,
                        transform: "translate(-50%, -50%)",
                        zIndex: 6,
                      }}
                    >
                      <a
                        href={verifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Scan or click to verify this certificate online"
                        style={{
                          display: "block",
                          boxSizing: "border-box",
                          width: "100%",
                          backgroundColor: "#ffffff",
                          padding: "5px",
                          borderRadius: "8px",
                          boxShadow: "0 2px 10px rgba(7, 29, 73, 0.12)",
                          border: "1.5px solid rgba(7, 29, 73, 0.15)",
                          textDecoration: "none",
                          lineHeight: 0,
                          cursor: "pointer",
                        }}
                      >
                        <img
                          src={qrCodeDataUrl}
                          alt="Scan to Verify Certificate"
                          style={{
                            width: "100%",
                            height: "auto",
                            aspectRatio: "1 / 1",
                            display: "block",
                          }}
                        />
                      </a>
                      {/* under the box, so the box stays the centre point */}
                      <span
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          whiteSpace: "nowrap",
                          marginTop: "4px",
                          fontFamily: "'Inter', -apple-system, sans-serif",
                          fontSize: "8.5px",
                          fontWeight: 700,
                          color: "#ffffff",
                          letterSpacing: "0.6px",
                          textTransform: "uppercase",
                          userSelect: "none",
                          textShadow: "1px 1px 4px rgb(0 0 0)"
                        }}
                      >
                        Scan to Verify
                      </span>
                    </div>
                  )}

                  {/* Recipient Full Name */}
                  <div
                    style={{
                      position: "absolute",
                      ...layout.name,
                      transform: "translate(-50%, -50%)",
                      zIndex: 5,
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <h1
                      className="cert-name-tangerine"
                      style={{
                        margin: 0,
                        padding: 0,
                        textShadow: "0 1px 1px rgba(255, 255, 255, 0.8)",
                      }}
                    >
                      {certData.name}
                    </h1>
                  </div>

                  {/* Course / Program Title */}
                  <div
                    style={{
                      position: "absolute",
                      ...layout.course,
                      transform: "translate(-50%, -50%)",
                      zIndex: 5,
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: "'Montserrat', 'Inter', -apple-system, sans-serif",
                        fontSize: "25px",
                        fontWeight: 800,
                        color: "#0a2540",
                        margin: 0,
                        padding: 0,
                        letterSpacing: "0.8px",
                        lineHeight: 1.25,
                        textTransform: "capitalize",
                      }}
                    >
                      {certData.program_name || certData.course_name || "Generative AI & LLMs Engineering"}
                    </h2>
                  </div>

                  {/* Date of Completion */}


                  <div
                    style={{
                      position: "absolute",
                      ...layout.date,
                      transform: "translate(-50%, -50%)",
                      zIndex: 5,
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#1e293b",
                        letterSpacing: "0.3px",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {formatCertDate(certData.edate || certData.updatetime || certData.datetime)}
                    </span>
                  </div>


                  {/* Authorized Signature (rivira-sign.png) */}
                  <div
                    style={{
                      position: "absolute",
                      ...layout.sign,
                      transform: "translate(-50%, -50%)",
                      zIndex: 4,
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <img
                      src="/certicates/rivira-sign.png"
                      alt="Authorized Signature"
                      crossOrigin="anonymous"
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                        margin: "0 auto",
                        filter: "contrast(1.05)",
                      }}
                    />
                  </div>

                  {/* Official Rubber Stamp Seal (rivira-stamp.png) */}
                  <div
                    style={{
                      position: "absolute",
                      ...layout.stamp,
                      transform: "translate(-50%, -50%) rotate(-8deg)",
                      zIndex: 5,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >

                    <img
                      src="/certicates/rivira-stamp.png"
                      alt="Official Seal"
                      crossOrigin="anonymous"
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                        opacity: 0.92,
                        mixBlendMode: "multiply",
                      }}
                    />
                  </div>

                  {/* Bottom lines — each at its own spot (layout.credential / student / verify) */}
                  {[
                    { spot: layout.verify, label: "Verify Authenticity", value: "www.riviratech.com" },
                  ]
                    .filter((line) => line.value)
                    .map((line) => (
                      <div
                        key={line.label}
                        style={{
                          position: "absolute",
                          transform: "translate(-50%, -50%)",
                          zIndex: 5,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                          fontSize: "7.5px",
                          lineHeight: 1.4,
                          fontWeight: 500,
                          color: "#64748b",
                          letterSpacing: "0.3px",
                          pointerEvents: "none",
                          ...line.spot,
                        }}
                      >
                        {line.label}: <strong style={{ color: "#334155", fontWeight: 700 }}>{line.value}</strong>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
