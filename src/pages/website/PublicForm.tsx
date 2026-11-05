import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Head, SERVER_URL, AWS_UPLOADS } from "../../components/Includes";
import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "../../components/TurnstileWidget";
import { findDuplicateSubmission, recordSubmission } from "../../utils/formSubmissionLimit";
import { isValidLocal, lengthText, maxTyped, normalizeLocal } from "../../utils/phoneRules";
import { richMessage } from "../../utils/richMessage";
// the banner opens in the same zoomable viewer as the Gallery page
import LightGallery from "lightgallery/react";
import lgZoom from "lightgallery/plugins/zoom";
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";

type Field = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
};
type FormDef = {
  slug: string;
  title: string;
  description: string;
  fields: Field[];
  submit_text: string;
  success_msg: string;
  banner?: string; // upload key set in Admin → Forms; empty = the default illustration
};

const DEFAULT_BANNER = "/images/login_side.png";
const bannerSrc = (b?: string) =>
  !b ? DEFAULT_BANNER : /^(https?:)?\/\//.test(b) || b.startsWith("/") ? b : AWS_UPLOADS + b;

export default function PublicForm() {
  const { slug = "" } = useParams();
  // who referred them: ?r=<name> on a referral link made in Admin → Forms;
  // saved with the response and shown in its responses list
  const [searchParams] = useSearchParams();
  const referrer = (searchParams.get("r") || "").trim().slice(0, 80);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormDef | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // the success message: admin HTML + CSS, cleaned, its CSS kept inside .pf-success-msg
  const success = useMemo(() => richMessage(form?.success_msg || "", ".pf-success-msg"), [form?.success_msg]);
  const [notFound, setNotFound] = useState(false);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // the side image: the form's banner, or the default illustration when it has
  // none or it doesn't load (the zoom viewer opens the same picture)
  const [bannerFailed, setBannerFailed] = useState(false);
  useEffect(() => setBannerFailed(false), [form?.banner]);
  const banner = bannerFailed ? DEFAULT_BANNER : bannerSrc(form?.banner);

  const getSecurity = async () => (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.post(SERVER_URL + "api/public/form", { slug }, { withCredentials: true });
      if (res.data.success) {
        setForm(res.data.data);
        const seed: Record<string, any> = {};
        for (const f of res.data.data.fields) seed[f.id] = f.type === "checkbox" ? [] : "";
        setAnswers(seed);
      } else setNotFound(true);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  const setVal = (id: string, v: any) => setAnswers((a) => ({ ...a, [id]: v }));

  /* ---- Phone fields: country-code picker, as on the Contact page ----
     /js/phoneinput.js puts a flag / country list on each phone input. Each field
     sits in its own [data-phone-scope] box with its own hidden fullphone /
     country_code, so several phone fields on one form never mix up. The answer
     holds the local digits while typing; on submit it becomes the full number
     with its country code, e.g. "+919876543210". */
  const phoneEls = useRef<Record<string, HTMLInputElement | null>>({});
  const hasPhone = !!form && form.fields.some((x) => x.type === "tel");

  useEffect(() => {
    if (!hasPhone) return;
    const w = window as any;
    const attach = () =>
      setTimeout(() => {
        Object.entries(phoneEls.current).forEach(([id, el]) => {
          if (!el) return;
          w.PhoneInput?.init?.(el, {
            initialCountry: "us",
            // another country picked: cut a number that is now too long for it
            onChange: (info: any) =>
              setAnswers((a) => {
                const cur = String(a[id] || "");
                const cap = maxTyped(cur, info && info.iso2);
                return cur.length > cap ? { ...a, [id]: cur.slice(0, cap) } : a;
              }),
          });
        });
      }, 60);
    if (w.PhoneInput) { attach(); return; }
    if (!document.querySelector('link[href="/css/phoneinput.css"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/css/phoneinput.css";
      document.head.appendChild(css);
    }
    let js = document.querySelector('script[src="/js/phoneinput.js"]') as HTMLScriptElement | null;
    if (!js) {
      js = document.createElement("script");
      js.src = "/js/phoneinput.js";
      js.async = true;
      document.body.appendChild(js);
    }
    js.addEventListener("load", attach);
    return () => js?.removeEventListener("load", attach);
  }, [hasPhone, done]);

  // the picker on a phone field (null until /js/phoneinput.js has attached it)
  const pickerOf = (id: string) => (phoneEls.current[id] as any)?._phoneInput || null;

  // Digits only, no more than the selected country's numbers have
  // (utils/phoneRules.ts). A number pasted with "+<code>" is handed to the
  // picker, which selects that country and keeps just the local number.
  const setPhone = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target as any;
    const raw = String(el.value || "");
    if (/^\s*\+/.test(raw) && el._phoneInput) {
      el._phoneInput._hydrate(); // re-fires this handler with the local digits
      if (!/^\s*\+/.test(String(el.value || ""))) return;
    }
    const d = raw.replace(/\D/g, "");
    const iso = el._phoneInput?.current?.[0];
    setVal(id, d.slice(0, maxTyped(d, iso)));
  };

  // "+<code><digits>" for a phone answer ("" when empty; a home-dialling
  // leading 0 dropped); local digits if the picker couldn't load
  const fullPhone = (f: Field) => {
    const local = String(answers[f.id] || "").replace(/\D/g, "");
    if (!local) return "";
    const c = pickerOf(f.id)?.current; // [iso2, country, dial code]
    return c ? "+" + c[2] + normalizeLocal(local, c[0]) : local;
  };
  const toggleCheck = (id: string, opt: string) =>
    setAnswers((a) => {
      const cur: string[] = Array.isArray(a[id]) ? a[id] : [];
      return { ...a, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  // Pull an email / phone answer (if the form has such a field) for de-dup.
  const emailFor = () => { const f = form?.fields.find((x) => x.type === "email"); return f ? String(answers[f.id] || "") : ""; };
  const phoneFor = () => { const f = form?.fields.find((x) => x.type === "tel"); return f ? fullPhone(f) : ""; };

  const submit = async (e: any) => {
    e.preventDefault();
    setError("");
    if (!form) return;
    for (const f of form.fields) {
      if (f.required) {
        const v = answers[f.id];
        const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
        if (empty) { setError(`Please fill "${f.label}"`); return; }
      }
    }
    // phone numbers: the selected country's length (India / US: 10 digits, ...;
    // utils/phoneRules.ts), and at most 15 digits with the country code
    for (const f of form.fields) {
      if (f.type !== "tel") continue;
      const local = String(answers[f.id] || "");
      if (!local) continue;
      const c = pickerOf(f.id)?.current; // [iso2, country, dial code]
      if (!isValidLocal(local, c?.[0], c?.[2])) {
        setError(
          `Please enter a valid ${c ? c[1] + " " : ""}phone number for "${f.label}": ${lengthText(c?.[0])} after the country code.`,
        );
        return;
      }
    }
    if (captchaEnabled && !captchaToken) { setError("Please complete the captcha."); return; }

    // Block a repeat submission from the same browser (same email/phone).
    const dup = findDuplicateSubmission("form:" + slug, emailFor(), phoneFor());
    if (dup) { setError(`You have already submitted this form with this ${dup}.`); return; }

    setBusy(true);
    try {
      // phone answers go with their country code
      const sendAnswers: Record<string, any> = { ...answers };
      for (const f of form.fields) if (f.type === "tel") sendAnswers[f.id] = fullPhone(f);
      const s = await getSecurity();
      const res = await axios.post(SERVER_URL + "api/public/form-submit",
        { slug, answers: sendAnswers, referrer, captcha: captchaToken, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true });
      if (res.data.success) {
        recordSubmission("form:" + slug, emailFor(), phoneFor());
        setDone(true);
      } else {
        setError(res.data.message || "Something went wrong");
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
    finally { setBusy(false); }
  };

  const renderField = (f: Field) => {
    switch (f.type) {
      case "textarea":
        return <textarea className="form-control" rows={4} placeholder={f.placeholder || ""} value={answers[f.id] || ""} onChange={(e) => setVal(f.id, e.target.value)} />;
      case "select":
        return (
          <select className="form-select" value={answers[f.id] || ""} onChange={(e) => setVal(f.id, e.target.value)}>
            <option value="">Select…</option>
            {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case "radio":
        return (
          <div className="pf-opts">
            {(f.options || []).map((o) => (
              <label key={o} className="pf-opt">
                <input type="radio" name={f.id} checked={answers[f.id] === o} onChange={() => setVal(f.id, o)} /> <span>{o}</span>
              </label>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <div className="pf-opts">
            {(f.options || []).map((o) => (
              <label key={o} className="pf-opt">
                <input type="checkbox" checked={Array.isArray(answers[f.id]) && answers[f.id].includes(o)} onChange={() => toggleCheck(f.id, o)} /> <span>{o}</span>
              </label>
            ))}
          </div>
        );
      case "tel":
        return (
          <div data-phone-scope="">
            {/* kept in sync by /js/phoneinput.js for this field only */}
            <input type="text" name="fullphone" defaultValue="" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
            <input type="hidden" name="country_code" />
            <input
              className="form-control"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={15}
              ref={(el) => { phoneEls.current[f.id] = el; }}
              placeholder={f.placeholder || "Phone number"}
              value={answers[f.id] || ""}
              onChange={(e) => setPhone(f.id, e)}
            />
          </div>
        );
      default:
        return <input className="form-control" type={f.type} placeholder={f.placeholder || ""} value={answers[f.id] || ""} onChange={(e) => setVal(f.id, e.target.value)} />;
    }
  };

  return (
    <>
      <Head pageTitle={form ? form.title : "Form"} pageDesc={form?.description || ""} pageKeywords="" />
      <style dangerouslySetInnerHTML={{ __html: `
        .pf-page{min-height:100vh;background:#F6F5FF;display:flex;align-items:center;justify-content:center;padding:90px 16px 40px;}
        .pf-shell{width:100%;max-width:1040px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(20,20,40,.12);display:grid;grid-template-columns:1fr 1fr;}
        .pf-aside{background:linear-gradient(160deg,#011330 0%,#022150 60%,#0B3D7A 100%);color:#fff;padding:40px 34px;display:flex;flex-direction:column;justify-content:center;}
        .pf-aside .brandbar{height:4px;width:100%;background:linear-gradient(90deg,#1F5FAF,#5AA9F0);border-radius:4px;margin-bottom:26px;}
        .pf-aside imgx{max-width:100%;max-height:300px;object-fit:contain;margin:0 auto 22px;display:block;}
     
        .pf-banner-link{display:block;cursor:zoom-in;}
        .pf-banner-link img{display:block;max-width:100%;height:auto;margin:0 auto;transition:transform .25s ease,filter .25s ease;}
           .pf-aside img{
margin-bottom: 20px;
      }
        .pf-banner-link:hover img{transform:scale(1.02);filter:brightness(1.06);}
        .pf-aside h2{font-family:var(--font-display);font-weight:700;font-size:1.5rem;margin:0 0 8px;}
        .pf-aside .rule{width:54px;height:3px;background:#5AA9F0;border-radius:3px;margin:10px 0 14px;}
        .pf-aside .tag{color:#94a3b8;margin:0;}
        .pf-aside .pf-desc{margin-top:16px;color:#cdd6e4;font-size:.95rem;line-height:1.6;border-top:1px solid rgba(255,255,255,.12);padding-top:16px;}
        .pf-main{padding:34px 38px;display:flex;flex-direction:column;}
        .pf-main .top{display:flex;justify-content:flex-end;margin-bottom:6px;}
        .pf-main .top a{color:#64748b;text-decoration:none;font-size:.9rem;}
        .pf-main .top a:hover{color:#0f172a;}
        .pf-title{font-family:var(--font-display);font-weight:700;font-size:1.55rem;color:#0a0f1e;margin:6px 0 20px;}
        .pf-field{margin-bottom:18px;}
        .pf-field label.pf-q{display:block;font-weight:600;color:#1f2430;margin-bottom:7px;}
        .pf-field .req{color:#dc2626;margin-left:3px;}
        .pf-field .form-control,.pf-field .form-select{border-radius:10px;padding:11px 14px;border:1px solid #dfe3ea;}
        .pf-field .form-control:focus,.pf-field .form-select:focus{border-color:#1F5FAF;box-shadow:0 0 0 3px rgba(31, 95, 175,.15);}
        .pf-opts{display:flex;flex-direction:column;gap:9px;}
        .pf-opt{display:flex;align-items:center;gap:9px;font-size:.96rem;color:#374151;cursor:pointer;}
        .pf-err{background:#fee2e2;color:#991b1b;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:.92rem;}
        .pf-submit{background:linear-gradient(90deg,#3B7BFF,#7C3AED);box-shadow:0 12px 30px rgba(91,63,232,.35);border:none;color:#fff;font-weight:700;border-radius:999px;padding:13px 30px;cursor:pointer;transition:filter .2s ease,transform .15s ease;box-shadow:0 4px 20px rgba(31, 95, 175,.25);}
        .pf-submit:hover{filter:brightness(.97);transform:translateY(-1px);}
        .pf-submit:disabled{opacity:.6;cursor:default;box-shadow:none;}
        .pf-done{text-align:center;padding:30px 10px;}
        .pf-success-msg{margin-top:8px;overflow-wrap:anywhere;}
        .pf-success-msg > :last-child{margin-bottom:0;}
        .pf-success-msg img{max-width:100%;height:auto;}
        .pf-done .ic{width:66px;height:66px;border-radius:50%;background:#dcfce7;color:#16a34a;font-size:34px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
        @media (max-width:768px){
          .pf-shell{grid-template-columns:1fr;}
          .pf-aside{display:none;}   /* hide the illustration side on mobile */
          .pf-main{padding:26px 20px;}
        }

.content .loader-facebook,
.modal-body .loader-facebook {
  position: relative;
  background: transparent;
  z-index: 1;
}  
.content .loader-facebook .lds-facebook div,
.content .loader-facebook .lds-facebook div { background: black; }

      ` }} />

      <div className="pf-page">
        {loading && <div className="pf-shell" style={{"display":"block"}}><div className="pf-main content">
          
          <div className="loader-facebook">
            <div className="lds-facebook">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <h6>Form Loading, Please Wait..</h6>
          </div>
          
        </div></div>}

        {!loading && notFound && (
          <div className="pf-shell"><div className="pf-main">
            <h2 className="pf-title">Form not found</h2>
            <p className="text-muted">This form doesn’t exist or is no longer accepting responses.</p>
            <div><Link to="/" className="pf-submit" style={{ display: "inline-block", textDecoration: "none" }}>Back to Home</Link></div>
          </div></div>
        )}

        {!loading && form && (
          <div className="pf-shell">
            {/* Left panel — hidden on mobile */}
            <aside className="pf-aside" data-aos="fade-right">
              <div className="brandbar" />
              {/* click to open it full-screen with zoom (lightGallery, as on the Gallery page) */}
              <LightGallery speed={500} plugins={[lgZoom]} elementClassNames="pf-banner-lg">
                <a href={banner} className="pf-banner-link" title="Click to zoom">
                  <img
                    src={banner}
                    alt={form.title}
                    // a missing upload falls back to the default illustration
                    onError={() => setBannerFailed(true)}
                  />
                </a>
              </LightGallery>
              <h2>Welcome to Rivira Technologies</h2>
              <div className="rule" />
              <p className="tag">AI-Powered Solutions for a Smarter World.</p>
              {form.description && <p className="pf-desc">{form.description}</p>}
            </aside>

            {/* Right panel — the form */}
            <div className="pf-main" data-aos="fade-left">
              <div className="top"><Link to="/">Back to Home</Link></div>

              {done ? (
                <div className="pf-done">
                  <div className="ic">✓</div>
                  <h2 className="pf-title" style={{ marginTop: 6 }}>{form.title}</h2>
                  {success.css && <style>{success.css}</style>}
                  <div className="pf-success-msg text-muted" dangerouslySetInnerHTML={{ __html: success.html }} />
                </div>
              ) : (
                <>
                  <h2 className="pf-title">{form.title}</h2>
                  <form onSubmit={submit} autoComplete="off">
                    {error && <div className="pf-err">{error}</div>}
                    {form.fields.map((f) => (
                      <div className="pf-field" key={f.id}>
                        <label className="pf-q">{f.label}{f.required && <span className="req">*</span>}</label>
                        {renderField(f)}
                      </div>
                    ))}
                    {captchaEnabled && (
                      <div className="col-12 d-flex justify-content-center">
                        <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
                      </div>
                    )}
                    <button type="submit" className="pf-submit" style={{"width":"100%"}} disabled={busy}>{busy ? "Submitting…" : (form.submit_text || "Submit")}</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
