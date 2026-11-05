import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import axios from "axios";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SERVER_URL } from "./Includes";
import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "./TurnstileWidget";
import { findDuplicateSubmission, recordSubmission } from "../utils/formSubmissionLimit";
import { EMAIL_ERROR, EMAIL_PATTERN, isValidEmail } from "../utils/validateEmail";

export const INTEREST_OPTIONS = [
  "AI Training",
  "Free Workshop",
  "Business AI Solution",
  "AI Project / POC",
  "Corporate Training",
  "Career Guidance",
];

export default function InquiryForm({ source = "contact" }: { source?: string }) {

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: INTEREST_OPTIONS[0],
    company: "",
    msg: "",
  });

  const phoneRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const enforceMax = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 10) val = val.slice(0, 10);
    setForm((f) => ({ ...f, phone: val }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fullphone = phoneRef.current?.value ?? "";

    if (!form.name || !form.email) {
      setError("Name and Email are required");
      return;
    }
    if (!isValidEmail(form.email)) {
      setError(EMAIL_ERROR);
      return;
    }
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }

    // Shares the "contact" key with the Contact page — the same person filling
    // in either form is one lead, not two.
    const dup = findDuplicateSubmission(source, form.email, fullphone);
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
          name: form.name,
          email: form.email,
          phone: form.phone,
          fullphone: fullphone,
          topic: form.topic,
          company: form.company,
          msg: form.msg,
          captcha: captchaToken,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success === true) {
        recordSubmission(source, form.email, fullphone);
        setSubmitted(res.data.message || "We'll get back to you shortly at the email you provided.");
      } else {
        setError(res.data.message || "Something went wrong. Please try again, or email us directly.");
      }
    } catch {
      setError("We couldn't reach the server. Please try again, or email us directly.");
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  useEffect(() => {
    const phoneinputcss = document.createElement("link");
    phoneinputcss.rel = "stylesheet";
    phoneinputcss.href = "/css/phoneinput.css";
    document.head.appendChild(phoneinputcss);

    const phoneinputjs = document.createElement("script");
    phoneinputjs.src = "/js/phoneinput.js";
    phoneinputjs.async = true;
    phoneinputjs.onload = () => {
      setTimeout(() => (window as any).PhoneInput?.initAll?.(), 60);
    };
    document.body.appendChild(phoneinputjs);

    return () => {
      document.head.removeChild(phoneinputcss);
      document.body.removeChild(phoneinputjs);
    };
  }, []);

  if (submitted) {
    return (
      <div className="contact-success">
        <span className="ring">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3>Thank you for reaching out</h3>
        <p>{submitted}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="contact contact-form" autoComplete="off">
      <div className="contact-row">
        <div className="contact-field">
          <label htmlFor="inq-name">
            Full Name <span aria-hidden="true">*</span>
          </label>
          <input id="inq-name" name="name" type="text" required value={form.name} onChange={handleChange} />
        </div>
        <div className="contact-field">
          <label htmlFor="inq-email">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="inq-email"
            name="email"
            type="email"
            required
            pattern={EMAIL_PATTERN}
            value={form.email}
            onChange={handleChange}
          />
        </div>
      </div>
      <div className="contact-row">
        <div className="contact-field">
          <label htmlFor="phone">
            Phone <span aria-hidden="true">*</span>
          </label>
          <input id="phone" name="phone" type="text" value={form.phone} onChange={enforceMax} />
          {/* Filled in by /js/phoneinput.js: "+" + dial code + digits */}
          <input name="fullphone" type="text" defaultValue="" style={{ display: "none" }} ref={phoneRef} />
          <input type="hidden" name="country_code" />
        </div>
        <div className="contact-field">
          <label htmlFor="inq-topic">Interest</label>
          <select id="inq-topic" name="topic" value={form.topic} onChange={handleChange}>
            {INTEREST_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="contact-field">
        <label htmlFor="inq-company">Company (optional)</label>
        <input id="inq-company" name="company" type="text" value={form.company} onChange={handleChange} />
      </div>
      <div className="contact-field">
        <label htmlFor="inq-msg">Message</label>
        <textarea
          id="inq-msg"
          name="msg"
          rows={4}
          placeholder="Tell us a bit about what you're looking for..."
          value={form.msg}
          onChange={handleChange}
        />
      </div>
      {error && <p className="contact-error">{error}</p>}
      <div style={{ marginBottom: 14 }}>
        <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
      </div>
      <button type="submit" disabled={loading} className="contact-submit">
        {loading ? (
          <>
            <span className="contact-spinner" />
            Sending…
          </>
        ) : (
          <>
            Send Inquiry
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      <p className="contact-note">We respond within one business day.</p>
    </form>
  );
}
