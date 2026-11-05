import { useState, useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useLocation } from "react-router-dom";
import {
  Headphones,
  Mail,
  Phone,
  ArrowRight,
  MessageSquare,
  BarChart2,
  Users,
  X,
  CheckCircle2,
} from "lucide-react";

import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "../components/TurnstileWidget";
import { findDuplicateSubmission, recordSubmission } from "../utils/formSubmissionLimit";

import axios from "axios";

import { SERVER_URL } from "../components/Includes";

interface Props {
  onClose: () => void;
}

export default function DecideCareerModal({ onClose }: Props) {
  const getSecurity = async () => {
    const res = await axios.get(
      SERVER_URL + "api/security/token",
      {
        withCredentials: true, // 🔥 REQUIRED
      }
    );

    return res.data;
  };

  // Limit to numbers only
  const enforceMax = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");

    if (val.length > 10) {
      val = val.slice(0, 10);
    }
    setForm((f) => ({
      ...f,
      phone: val,
    }));
  };

  const [form, setForm] = useState({
    email: "",
    phone: "",
    fullphone: "",
  });

  const phoneRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const fullphoneValue = phoneRef.current?.value ?? "";
    setForm((f) => ({
      ...f,
      fullphone: fullphoneValue,
      [e.target.name]: e.target.value,
    }));
  };

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // Submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const fullphoneValue = phoneRef.current?.value ?? "";
    const updatedForm = {
      ...form,
      fullphone: fullphoneValue,
    };
    setForm(updatedForm);

    setSuccess("");
    setError("");

    if (!form.email || !form.phone) {
      setError("Please enter both email and phone number");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }

    // Block re-submitting the contact form with the same email/phone from this browser.
    const dup = findDuplicateSubmission("careercontact", updatedForm.email, fullphoneValue);
    if (dup) {
      setError(
        dup === "email"
          ? "You've already sent us a message with this email address. We'll be in touch soon!"
          : "You've already sent us a message with this phone number. We'll be in touch soon!"
      );
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();

      const res = await axios.post(
        SERVER_URL + "api/contacts/add",
        {
          name: "Enquiry",
          email: updatedForm.email,
          phone: updatedForm.phone,
          fullphone: fullphoneValue,
          topic: "Career Counseling",
          company: "",
          msg: "Free career counseling enquiry from popup",

          captcha: captchaToken,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        setSuccess(res.data.message || "Thank you! Our Career Advisor will call you shortly.");
        recordSubmission("careercontact", updatedForm.email, fullphoneValue);
        setForm({
          email: "",
          phone: "",
          fullphone: "",
        });
      } else {
        setError(res.data.message || "Failed to submit. Please try again.");
      }

    } catch (err) {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const location = useLocation();
  const [mode, setMode] = useState("");

  useEffect(() => {
    if (
      location.pathname.includes("/panel") ||
      location.pathname.includes("/dashboard") ||
      location.pathname.includes("/form/") ||
      location.pathname.includes("/workshop") ||
      location.pathname.includes("/survey/") ||
      location.pathname.includes("/feedback/") ||
      location.pathname.includes("/certificate-request") ||
      location.pathname.includes("/enroll") ||
      location.pathname.includes("/signin")
    ) {
      setMode("admin");
    } else {
      setMode("user");
    }

    const decidecareer = localStorage.getItem("decidecareer");
    console.log("decidecareer", decidecareer);
    if ((decidecareer && decidecareer.length <= 2) || decidecareer == null) {
      const phoneinputcss = document.createElement("link");
      phoneinputcss.rel = "stylesheet";
      phoneinputcss.href = "/css/phoneinput.css";
      document.head.appendChild(phoneinputcss);

      const phoneinputjs = document.createElement("script");
      phoneinputjs.src = "/js/phoneinput.js";
      phoneinputjs.async = true;
      document.body.appendChild(phoneinputjs);

      const openmodal = document.createElement("script");
      openmodal.src = "/js/openmodal.js";
      openmodal.async = true;
      document.body.appendChild(openmodal);

      const enroll = document.createElement("script");
      enroll.src = "/js/enroll.js";
      enroll.async = true;
      document.body.appendChild(enroll);

      return () => {
        if (openmodal.parentNode) document.body.removeChild(openmodal);
        if (phoneinputcss.parentNode) document.head.removeChild(phoneinputcss);
        if (phoneinputjs.parentNode) document.body.removeChild(phoneinputjs);
        if (enroll.parentNode) document.body.removeChild(enroll);
      };
    }
  }, [location.pathname]);

  const close = () => {
    if (typeof window !== "undefined" && (window as any).$ && (window as any).$('#decidecareer').modal) {
      try {
        (window as any).$('#decidecareer').modal('hide');
      } catch (e) {
        // ignore
      }
    }
    onClose();
  };

  return (
    <>
      {mode === "user" && (
        <div
          className="modal fade"
          data-bs-backdrop="static"
          id="decidecareer"
          tabIndex={-1}
          aria-hidden="true"
        >
          <div className="modal-dialog modal-dialog-centered decide-career-modal-dialog">
            <div className="modal-content decide-career-modal-content">
              {/* Close Button Top-Right */}
              <button
                onClick={close}
                type="button"
                className="decide-career-close-btn"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <X size={22} />
              </button>

              {success ? (
                /* Success Confirmation State */
                <div className="decide-career-success-card">
                  <div className="decide-career-success-icon-wrap">
                    <CheckCircle2 size={48} className="text-emerald-500" />
                  </div>
                  <h3 className="decide-career-success-title">Thank you for reaching out!</h3>
                  <p className="decide-career-success-msg">
                    {success}
                  </p>
                  <p className="decide-career-success-sub">
                    Our expert Career Advisor will give you a call shortly on your registered number.
                  </p>
                  <button
                    type="button"
                    className="decide-career-success-btn"
                    onClick={close}
                    data-bs-dismiss="modal"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Main 2-Column Exact Layout */
                <div className="decide-career-grid">
                  {/* LEFT COLUMN: 3D Advisor Illustration + Benefits Card */}
                  <div className="decide-career-left-col">
                    {/* Top 3D Illustration */}
                    <div className="decide-career-hero-wrap">
                      <img
                        src="/images/counseling-3d-advisor.png"
                        alt="Career Counseling Advisor"
                        className="decide-career-hero-img"
                      />
                    </div>

                    {/* Bottom 3-Value Props Card */}
                    <div className="decide-career-benefits-card">
                      {/* Benefit 1 */}
                      <div className="decide-benefit-item">
                        <div className="decide-benefit-icon-badge decide-badge-purple">
                          <MessageSquare size={17} className="text-white" fill="white" />
                        </div>
                        <div className="decide-benefit-info">
                          <div className="decide-benefit-title">One-on-one Guidance</div>
                          <div className="decide-benefit-desc">
                            Get expert advice tailored to your goals.
                          </div>
                        </div>
                      </div>

                      <div className="decide-benefit-divider" />

                      {/* Benefit 2 */}
                      <div className="decide-benefit-item">
                        <div className="decide-benefit-icon-badge decide-badge-indigo">
                          <BarChart2 size={17} strokeWidth={2.5} />
                        </div>
                        <div className="decide-benefit-info">
                          <div className="decide-benefit-title">Find the Right Course</div>
                          <div className="decide-benefit-desc">
                            Explore the best learning path for your career.
                          </div>
                        </div>
                      </div>

                      <div className="decide-benefit-divider" />

                      {/* Benefit 3 */}
                      <div className="decide-benefit-item">
                        <div className="decide-benefit-icon-badge decide-badge-lavender">
                          <Users size={17} strokeWidth={2.2} />
                        </div>
                        <div className="decide-benefit-info">
                          <div className="decide-benefit-title">100% Free Counseling</div>
                          <div className="decide-benefit-desc">
                            Talk to our career advisor at no cost.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Badge + Heading with Underline + Form */}
                  <div className="decide-career-right-col">
                    {/* Top Badge: Free Career Counseling */}
                    <div className="decide-career-top-badge">
                      <Headphones size={13} className="text-amber-600 flex-shrink-0" />
                      <span>Free Career Counseling</span>
                    </div>

                    {/* Headline */}
                    <h2 className="decide-career-headline">
                      Get Free counseling to<br />
                      decide your{" "}
                      <span className="decide-career-highlight">
                        next career step.
                        <svg
                          className="decide-career-underline-svg"
                          viewBox="0 0 160 8"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M3 5.5C45 2 115 2 157 5.5"
                            stroke="#F59E0B"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </h2>

                    {/* Subtitle */}
                    <p className="decide-career-subtitle">
                      Our Career Advisor will give you a call shortly.
                    </p>

                    {/* Form */}
                    <form className="decidecareer decide-career-form" onSubmit={handleSubmit}>
                      {/* Email Input */}
                      <div className="decide-field-group">
                        <div className="decide-input-box">
                          <Mail size={18} className="decide-input-icon" />
                          <input
                            type="email"
                            name="email"
                            placeholder="e.g. sara@gmail.com*"
                            value={form.email}
                            onChange={handleChange}
                            required
                            className="decide-text-input"
                          />
                        </div>
                      </div>

                      {/* Phone Input with country picker */}
                      <div className="decide-field-group">
                        <input
                          name="fullphone"
                          className="form-control"
                          defaultValue=""
                          type="text"
                          style={{ display: "none" }}
                          ref={phoneRef}
                          onChange={handleChange}
                        />
                        <input type="hidden" name="country_code" />

                        <input
                          type="text"
                          name="phone"
                          className="form-control decide-phone-input"
                          value={form.phone}
                          id="phone"
                          placeholder="Enter your phone number*"
                          onChange={enforceMax}
                          required
                        />
                      </div>

                      {/* Captcha Turnstile */}
                      <div className="decide-captcha-container">
                        <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
                      </div>

                      {/* Error Banner */}
                      {error && (
                        <div className="decide-error-banner">
                          {error}
                        </div>
                      )}

                      {/* Golden Yellow CTA Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="decide-submit-button"
                      >
                        {loading ? (
                          <div className="d-flex align-items-center justify-content-center gap-2">
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            <span>PLEASE WAIT...</span>
                          </div>
                        ) : (
                          <>
                            <div className="decide-btn-center-content">
                              <Phone size={15} fill="black" stroke="black" />
                              <span>GET A CALL</span>
                            </div>
                            <ArrowRight size={18} strokeWidth={2.5} className="decide-btn-right-arrow" />
                          </>
                        )}
                      </button>

                      {/* Footer Note */}
                      <div className="decide-footer-note">
                        Our Career Advisor will give you a call shortly.
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scoped CSS Styles to Guarantee Pixel-Perfect 1:1 Rendering */}
      <style>{`
        /* Reset and Container */
        .decide-career-modal-dialog {
          max-width: 980px !important;
          width: 92% !important;
          margin: 1.5rem auto !important;
        }

        .decide-career-modal-content {
          border-radius: 26px !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.04) !important;
          background: #ffffff !important;
          padding: 24px 28px !important;
          position: relative !important;
          overflow: hidden !important;
        }

        /* Close Button */
        .decide-career-close-btn {
          position: absolute !important;
          top: 18px !important;
          right: 20px !important;
          z-index: 25 !important;
          background: transparent !important;
          border: none !important;
          padding: 6px !important;
          cursor: pointer !important;
          color: #475569 !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
          line-height: 1 !important;
        }

        .decide-career-close-btn:hover {
          color: #0f172a !important;
          background: rgba(0, 0, 0, 0.05) !important;
          transform: scale(1.05);
        }

        /* 2-Column Grid Layout */
        .decide-career-grid {
          display: flex !important;
          gap: 28px !important;
          align-items: stretch !important;
        }

        .decide-career-left-col {
          flex: 0 0 44% !important;
          max-width: 44% !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }

        .decide-career-right-col {
          flex: 0 0 calc(56% - 28px) !important;
          max-width: calc(56% - 28px) !important;
          display: flex !important;
          flex-direction: column !important;
          padding-top: 6px !important;
        }

        /* Left Hero Image */
        .decide-career-hero-wrap {
          border-radius: 20px !important;
          overflow: hidden !important;
          background: radial-gradient(ellipse at 50% 50%, #f7f6ff 0%, #ffffff 80%) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 12px !important;
        }

        .decide-career-hero-img {
          width: 100% !important;
          height: auto !important;
          max-height: 250px !important;
          object-fit: contain !important;
          display: block !important;
          user-select: none !important;
        }

        /* Benefits Card */
        .decide-career-benefits-card {
          background: #f4f3ff !important;
          border: 1px solid #e2e0fb !important;
          border-radius: 20px !important;
          padding: 16px 18px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
        }

        .decide-benefit-item {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
        }

        .decide-benefit-icon-badge {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }

        .decide-badge-purple {
          background: #4f46e5 !important;
          color: #ffffff !important;
        }

        .decide-badge-indigo {
          background: #e0e7ff !important;
          color: #4f46e5 !important;
        }

        .decide-badge-lavender {
          background: #ede9fe !important;
          color: #4f46e5 !important;
        }

        .decide-benefit-info {
          flex: 1 !important;
        }

        .decide-benefit-title {
          font-size: 13.5px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          margin: 0 0 2px 0 !important;
          line-height: 1.25 !important;
        }

        .decide-benefit-desc {
          font-size: 11.5px !important;
          color: #64748b !important;
          margin: 0 !important;
          line-height: 1.35 !important;
        }

        .decide-benefit-divider {
          height: 1px !important;
          background: #e4e2fc !important;
          width: 100% !important;
        }

        /* Right Column Elements */
        .decide-career-top-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 4px 12px !important;
          border-radius: 9999px !important;
          background: #fef6e7 !important;
          border: 1px solid #fde68a !important;
          color: #0B3D7A !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          margin-bottom: 12px !important;
          width: fit-content !important;
        }

        .decide-career-headline {
          font-size: 28px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          line-height: 1.22 !important;
          letter-spacing: -0.4px !important;
          margin: 0 0 6px 0 !important;
          text-align: left !important;
        }

        .decide-career-highlight {
          color: #4f46e5 !important;
          position: relative !important;
          display: inline-block !important;
        }

        .decide-career-underline-svg {
          position: absolute !important;
          bottom: -4px !important;
          left: 0 !important;
          width: 100% !important;
          height: 8px !important;
          pointer-events: none !important;
          overflow: visible !important;
        }

        .decide-career-subtitle {
          font-size: 14px !important;
          color: #64748b !important;
          margin: 0 0 18px 0 !important;
          line-height: 1.4 !important;
        }

        /* Form Inputs */
        .decide-career-form {
          display: flex !important;
          flex-direction: column !important;
          width: 100% !important;
        }

        .decide-field-group {
          margin-bottom: 12px !important;
          position: relative !important;
          width: 100% !important;
        }

        .decide-input-box {
          position: relative !important;
          width: 100% !important;
        }

        .decide-input-icon {
          position: absolute !important;
          left: 14px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          color: #94a3b8 !important;
          pointer-events: none !important;
          z-index: 2 !important;
        }

        .decide-text-input {
          width: 100% !important;
          height: 48px !important;
          border-radius: 10px !important;
          border: 1.5px solid #e2e8f0 !important;
          padding: 0 14px 0 42px !important;
          font-size: 14px !important;
          color: #0f172a !important;
          background: #ffffff !important;
          outline: none !important;
          box-shadow: none !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }

        .decide-text-input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
        }

        .decide-text-input::placeholder {
          color: #94a3b8 !important;
        }

        /* Phone Input Integration (targeting .pi-wrap from phoneinput.js) */
        #decidecareer .pi-wrap {
          width: 100% !important;
          position: relative !important;
        }

        #decidecareer .pi-wrap > .form-control,
        #decidecareer .pi-wrap > input[type="text"] {
          height: 48px !important;
          border: 1.5px solid #e2e8f0 !important;
          border-radius: 10px !important;
          padding-left: 64px !important;
          font-size: 14px !important;
          color: #0f172a !important;
          background: #ffffff !important;
          box-shadow: none !important;
          margin: 0 !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }

        #decidecareer .pi-wrap > input[type="text"]:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
        }

        #decidecareer .pi-wrap > input[type="text"]::placeholder {
          color: #94a3b8 !important;
        }

        #decidecareer .pi-selected {
          width: 54px !important;
          border-right: 1.5px solid #e2e8f0 !important;
          border-radius: 9px 0 0 9px !important;
          background: transparent !important;
          top: 1.5px !important;
          bottom: 1.5px !important;
          left: 1.5px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 4px !important;
        }

        #decidecareer .pi-selected:hover {
          background: rgba(99, 102, 241, 0.04) !important;
        }

        /* Captcha */
        .decide-captcha-container {
          margin: 4px 0 12px 0 !important;
          display: flex !important;
          justify-content: flex-start !important;
        }

        /* Error Banner */
        .decide-error-banner {
          background: #fef2f2 !important;
          border: 1px solid #fecaca !important;
          color: #dc2626 !important;
          font-size: 12.5px !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          margin-bottom: 12px !important;
        }

        /* Golden Yellow Submit Button */
        #decidecareer .decide-submit-button {
          height: 50px !important;
          width: 100% !important;
          border-radius: 12px !important;
          background: linear-gradient(180deg, #fecf1b 0%, #f7b919 100%) !important;
          border: none !important;
          color: #000000 !important;
          font-size: 14.5px !important;
          font-weight: 800 !important;
          letter-spacing: 0.5px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
          cursor: pointer !important;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3) !important;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease !important;
          margin-top: 4px !important;
          padding: 0 20px !important;
        }

        #decidecareer .decide-submit-button:hover:not(:disabled) {
          background: linear-gradient(180deg, #ffd329 0%, #f9be10 100%) !important;
          box-shadow: 0 6px 18px rgba(245, 158, 11, 0.4) !important;
          filter: brightness(1.02) !important;
        }

        #decidecareer .decide-submit-button:active:not(:disabled) {
          transform: scale(0.99) !important;
        }

        #decidecareer .decide-submit-button:disabled {
          opacity: 0.7 !important;
          cursor: not-allowed !important;
        }

        .decide-btn-center-content {
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          font-weight: 800 !important;
        }

        .decide-btn-right-arrow {
          position: absolute !important;
          right: 20px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
        }

        /* Footer Note */
        .decide-footer-note {
          text-align: center !important;
          margin-top: 10px !important;
          font-size: 12px !important;
          color: #94a3b8 !important;
        }

        /* Success Card View */
        .decide-career-success-card {
          text-align: center !important;
          padding: 40px 20px !important;
        }

        .decide-career-success-icon-wrap {
          width: 72px !important;
          height: 72px !important;
          background: #ecfdf5 !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 auto 18px auto !important;
        }

        .decide-career-success-title {
          font-size: 24px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          margin-bottom: 8px !important;
        }

        .decide-career-success-msg {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: #059669 !important;
          margin-bottom: 6px !important;
        }

        .decide-career-success-sub {
          font-size: 13.5px !important;
          color: #64748b !important;
          max-width: 440px !important;
          margin: 0 auto 24px auto !important;
        }

        .decide-career-success-btn {
          padding: 10px 32px !important;
          background: #4f46e5 !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border-radius: 10px !important;
          border: none !important;
          font-size: 14px !important;
          cursor: pointer !important;
        }

        /* Responsive Breakpoints */
        @media (max-width: 991px) {
          .decide-career-grid {
            flex-direction: column !important;
            gap: 20px !important;
          }

          .decide-career-left-col {
            flex: 0 0 100% !important;
            max-width: 100% !important;
          }

          .decide-career-right-col {
            flex: 0 0 100% !important;
            max-width: 100% !important;
            padding-top: 0 !important;
          }

          .decide-career-headline {
            font-size: 24px !important;
          }
        }

        @media (max-width: 576px) {
          .decide-career-modal-content {
            padding: 20px 16px !important;
            border-radius: 20px !important;
          }

          .decide-career-headline {
            font-size: 21px !important;
          }
        }
      `}</style>
    </>
  );
}