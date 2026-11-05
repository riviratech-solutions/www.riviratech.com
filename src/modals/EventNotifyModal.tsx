import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { X, Bell, Sparkles, User, Mail, CheckCircle2 } from "lucide-react";
import { SERVER_URL, EMAIL } from "../components/Includes";
import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "../components/TurnstileWidget";
import { findDuplicateSubmission, recordSubmission } from "../utils/formSubmissionLimit";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The event the visitor asked about, as plain text ('' = no live event). */
  eventTitle?: string;
}

/* "Notify Me" on the Events page. Same look as WorkshopRegisterModal; the
   request is saved as a contact-form message (Admin → Web Contacts), so the
   team follows it up with the other enquiries. */
export default function EventNotifyModal({ open, onClose, eventTitle = "" }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const phoneRef = useRef<HTMLInputElement>(null); // hidden fullphone the PhoneInput plugin fills

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setError("");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // PhoneInput plugin (flag + country picker on form.wkform #phone), loaded once
  useEffect(() => {
    if (!open || document.querySelector('script[src="/js/phoneinput.js"]')) return;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/css/phoneinput.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "/js/phoneinput.js";
    js.async = true;
    document.body.appendChild(js);
  }, [open]);

  if (!open) return null;

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", { withCredentials: true });
    return res.data;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // The PhoneInput plugin writes "+<dial><digits>" into the hidden fullphone.
    const fullphone =
      phoneRef.current?.value && phoneRef.current.value.length > 10
        ? phoneRef.current.value
        : "+1" + phone;

    if (!name || name.trim().length < 3) {
      setError("Please enter your full name");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }
    if (findDuplicateSubmission("event-notify", email, fullphone)) {
      setError("You're already on the list — we'll let you know about the next event.");
      return;
    }

    try {
      setLoading(true);
      const security = await getSecurity();

      // Saved like the contact form (Admin → Web Contacts)
      const res = await axios.post(
        SERVER_URL + "api/contacts/add",
        {
          name: name.trim(),
          email,
          phone,
          fullphone,
          topic: "Event notification",
          msg: eventTitle
            ? `Please notify me about this event and upcoming ones: ${eventTitle}`
            : "Please notify me when the next AI event opens for registration.",
          captcha: captchaToken,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success === true) {
        recordSubmission("event-notify", email, fullphone);
        setSubmitted(true);
        setName("");
        setEmail("");
        setPhone("");
      } else {
        setError(res.data.message || "Something went wrong, please try again.");
      }
    } catch {
      setError("Something went wrong. Please email us at " + EMAIL);
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const iconStyle: React.CSSProperties = {
    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
    width: 16, height: 16, color: "#9aa2ad",
  };

  return createPortal(
    <div className="wkm-overlay" onClick={onClose}>
      <div className="wkm-box" role="dialog" aria-modal="true" aria-label="Get notified" onClick={(e) => e.stopPropagation()}>
        <div className="wkm-head">
          <button className="wkm-close" onClick={onClose} aria-label="Close"><X /></button>
          <span className="wk-badge"><Sparkles /> AI Events</span>
          <h3>{submitted ? "You're on the list!" : "Don’t miss our next AI event"}</h3>
          {eventTitle && !submitted && <p className="wkm-topic">{eventTitle}</p>}
        </div>

        <div className="wkm-body">
          {submitted ? (
            <div className="wkm-success">
              <div className="ic"><CheckCircle2 /></div>
              <h3>Thanks — we'll keep you posted</h3>
              <p>We'll let you know as soon as the next webinar, bootcamp or live AI session opens for registration.</p>
              <button className="wkm-submit" onClick={onClose}>Done</button>
            </div>
          ) : (
            <form className="wkform" onSubmit={handleSubmit}>
              {error && <p className="wkm-msg err">{error}</p>}

              <div className="wkm-field">
                <label>Full name <span className="req">*</span></label>
                <div style={{ position: "relative" }}>
                  <User style={iconStyle} />
                  <input className="wkm-input" style={{ paddingLeft: 38 }} type="text"
                    value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
                </div>
              </div>

              <div className="wkm-field">
                <label>Email <span className="req">*</span></label>
                <div style={{ position: "relative" }}>
                  <Mail style={iconStyle} />
                  <input className="wkm-input" style={{ paddingLeft: 38 }} type="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required />
                </div>
              </div>

              <div className="wkm-field">
                <label>Phone <span className="req">*</span></label>
                {/* PhoneInput plugin (form.wkform #phone) mounts a flag + country
                    picker and writes these hidden fields, scoped to this form. */}
                <input type="text" name="fullphone" ref={phoneRef} defaultValue="" style={{ display: "none" }} />
                <input type="hidden" name="country_code" />
                <input
                  type="text"
                  name="phone"
                  id="phone"
                  className="wkm-input"
                  style={{ paddingLeft: 52 }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit number"
                  required
                />
              </div>
              <div className="wkm-field" style={{ textAlign: "center" }}>
                <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
              </div>
              <button className="wkm-submit" type="submit" disabled={loading}>
                {loading ? "Sending…" : (<>Notify me <Bell /></>)}
              </button>

              <p className="wkm-note">No spam — we'll only contact you about our AI events.</p>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
