import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { listFetch } from "../utils/listCache";
import { toast } from "react-toastify";
import { SERVER_URL } from "./Includes";
import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "./TurnstileWidget";
import { isValidEmail, EMAIL_ERROR } from "../utils/validateEmail";
import { isValidLocal, lengthText, maxTyped, normalizeLocal } from "../utils/phoneRules";

/**
 * Student survey popup. On mount it fetches the surveys pending for the logged-in
 * student's batch and, if any, opens a modal that walks through them ONE QUESTION
 * AT A TIME (Prev / Next, Submit on the very last question). Each survey is saved as
 * the student crosses its last question. "Skip this survey" skips the current survey;
 * "Skip all" (offered when every pending survey is skippable) skips the lot.
 * Renders all supported question types.
 *
 * publicId: a PUBLIC survey (Admin → Surveys, audience "Public") answered by anyone
 * on the website page /survey/<id> or /feedback/<id> (publicKind; see
 * pages/website/PublicSurvey.tsx) — no account, no skip. First the visitor's
 * name, email and (optional) phone, then the questions; captcha on the last
 * one. One response per person: the kkr_surveys_done cookie remembers answered
 * surveys, and the server also refuses the same browser (random visitor id) or
 * the same email again.
 */

// the browser's id for public surveys (32 hex characters, kept in localStorage)
function visitorId(): string {
  const KEY = "kkr.survey.visitor";
  try {
    const have = localStorage.getItem(KEY) || "";
    if (/^[a-f0-9]{32}$/.test(have)) return have;
  } catch { /* storage unavailable */ }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try { localStorage.setItem(KEY, id); } catch { /* storage unavailable */ }
  return id;
}

// public surveys answered in this browser: cookie "kkr_surveys_done" = "id1,id2,..." (kept a year)
const DONE_COOKIE = "kkr_surveys_done";
function answeredIds(): string[] {
  const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + DONE_COOKIE + "=([^;]*)"));
  if (!m) return [];
  try { return decodeURIComponent(m[1]).split(",").filter(Boolean); } catch { return []; }
}
function markAnswered(id: string) {
  const ids = [...answeredIds().filter((x) => x !== id), id].slice(-50);
  document.cookie = `${DONE_COOKIE}=${encodeURIComponent(ids.join(","))}; max-age=${365 * 86400}; path=/; SameSite=Lax`;
}

type Question = {
  id: string; type: string; label: string; required: boolean;
  options?: string[]; allowOther?: boolean; min?: number; max?: number;
};
type Survey = { req_id: string; title: string; description: string; allow_skip: string; questions: Question[] };

const EMOJIS = ["😡", "😞", "😐", "🙂", "😍"];
const OTHER = "__other__";

const PP_CSS = `
        .pp-overlay{position:fixed;inset:0;z-index:99999;background:rgba(6,11,25,.7);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:16px;}
        .pp-modal{background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 26px 54px -18px rgba(2,6,23,.6);overflow:hidden;}
        .pp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:20px 22px 12px;border-bottom:1px solid #eef1f6;}
        .pp-head h4{margin:0;color:#1a2233;font-weight:700;font-size:1.15rem;}
        .pp-desc{margin:4px 0 0;color:#64748b;font-size:.86rem;}
        .pp-count{white-space:nowrap;background:#f1eefb;color:#6d28d9;font-weight:700;font-size:.75rem;padding:4px 10px;border-radius:999px;}
        .pp-progress{height:4px;background:#f1eefb;}
        .pp-progress-bar{height:100%;background:#6d28d9;transition:width .25s ease;}
        .pp-body{padding:22px;overflow-y:auto;min-height:120px;}
        .pp-q{margin-bottom:0;}
        .pp-q-label{font-weight:600;color:#1a2233;margin-bottom:14px;font-size:1.05rem;}
        .pp-req{color:#dc2626;}
        .pp-opts{display:flex;flex-direction:column;gap:10px;}
        .pp-opt{display:flex;align-items:center;gap:8px;font-size:.95rem;color:#1a2233;cursor:pointer;}
        .pp-other{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:.88rem;}
        .pp-other:disabled{background:#f8fafc;}
        .pp-stars{font-size:2.2rem;color:#e2e8f0;display:flex;gap:6px;cursor:pointer;}
        .pp-star.on{color:#f59e0b;}
        .pp-emojis{display:flex;gap:12px;font-size:2rem;cursor:pointer;}
        .pp-emoji{filter:grayscale(1);opacity:.5;transition:.15s;}
        .pp-emoji.on,.pp-emoji:hover{filter:none;opacity:1;transform:scale(1.15);}
        .pp-slider{display:flex;align-items:center;gap:12px;}
        .pp-slider input[type=range]{flex:1;}
        .pp-slider-val{min-width:36px;text-align:center;font-weight:700;color:#6d28d9;}
        .pp-rank{display:flex;flex-direction:column;gap:6px;}
        .pp-rank-item{display:flex;align-items:center;gap:10px;border:1px solid #e7eaf1;border-radius:8px;padding:6px 10px;background:#fafafe;}
        .pp-rank-no{width:22px;height:22px;border-radius:50%;background:#6d28d9;color:#fff;font-size:.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .pp-rank-label{flex:1;font-size:.9rem;}
        .pp-rank-btn{border:1px solid #e2e8f0;background:#fff;border-radius:6px;width:26px;cursor:pointer;}
        .pp-rank-btn:disabled{opacity:.4;cursor:not-allowed;}
        .pp-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid #eef1f6;}
        .pp-foot-left{display:flex;gap:14px;}
        .pp-foot-right{display:flex;gap:8px;}
        .pp-link{background:none;border:none;color:#64748b;font-size:.85rem;cursor:pointer;text-decoration:underline;}
        .pp-link:hover{color:#1a2233;}
        .pp-done{padding:34px 26px;text-align:center;}
        .pp-done-ic{font-size:2.6rem;line-height:1;margin-bottom:10px;}
        .pp-done h4{margin:0 0 6px;color:#1a2233;font-weight:700;}
        .pp-done p{margin:0 0 18px;color:#64748b;font-size:.9rem;}
        .pp-note{margin:0 0 14px;padding:8px 12px;border-radius:8px;background:#f5f3ff;color:#5b21b6;font-size:.84rem;}
        .pp-captcha{display:flex;justify-content:center;margin-top:18px;}
        .pp-modal.pp-free,.pp-modal.pp-free .pp-body{overflow:visible;}
        .pp-who{display:flex;flex-direction:column;gap:14px;}
        .pp-who label{display:block;font-weight:600;color:#1a2233;font-size:.88rem;margin-bottom:5px;}
        .pp-opt-tag{font-weight:500;color:#94a3b8;font-size:.8rem;}
        .pp-err{margin:14px 0 0;padding:8px 12px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:.84rem;}
`;

export default function SurveyPopup({ panel = false, publicId = "", publicKind = "survey" }: {
  panel?: boolean; publicId?: string; publicKind?: "survey" | "feedback";
}) {
  // Emailed one-click link: /?r=<survey_req_id>&u=<mem_id>&s=<signature> — opens the
  // survey with NO login (the server checks the signature; see api/website/surveys).
  const params = new URLSearchParams(window.location.search);
  const linkR = params.get("r") || "";
  const linkU = params.get("u") || "";
  const linkS = params.get("s") || "";
  const linkMode = !!(linkR && linkU);
  const linkBody = { r: linkR, u: linkU, s: linkS };
  // The global instance (panel=false) handles the emailed link; the dashboard
  // instance (panel=true) handles logged-in pending surveys. Never both at once.
  // A public survey page (publicId) runs on its own.
  const openMode = !!publicId;
  const shouldRun = openMode || (linkMode ? !panel : panel);
  const [closedMsg, setClosedMsg] = useState("");   // public survey not found / closed
  const [already, setAlready] = useState(false);    // public survey answered from this browser / email
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const visitor = openMode ? visitorId() : "";
  const isFeedback = publicKind === "feedback";
  const noun = isFeedback ? "feedback form" : "survey";

  // public survey: who is answering, asked before the questions
  const [who, setWho] = useState({ name: "", email: "", phone: "" }); // phone: local digits
  const [whoDone, setWhoDone] = useState(false);
  const [whoErr, setWhoErr] = useState("");
  const [phoneIso, setPhoneIso] = useState("us");
  const phoneRef = useRef<HTMLInputElement | null>(null);
  // the picker's last [iso2, country, dial code], for when it hasn't re-attached yet (after "Back")
  const lastPick = useRef<string[] | null>(null);
  const fullPhone = useRef("");                     // "+<code><digits>" once the details are accepted

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [cur, setCur] = useState(0);        // index into the flattened step list
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"" | "submitted" | "skipped">("");
  // answers[surveyReqId][questionId] = value ; other[surveyReqId][questionId] = free text
  const [answers, setAnswers] = useState<Record<string, Record<string, any>>>({});
  const [others, setOthers] = useState<Record<string, Record<string, string>>>({});

  const getSecurity = async () => (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;
  // Secured post (logged-in student endpoints).
  const post = async (path: string, body: any = {}) => {
    const s = await getSecurity();
    return (await axios.post(SERVER_URL + path, { ...body, key: s.key, token: s.token, aut: s.aut }, { withCredentials: true })).data;
  };
  // Public post (emailed-link endpoints — no auth token needed).
  const publicPost = async (path: string, body: any = {}) =>
    (await axios.post(SERVER_URL + path, body, { withCredentials: true })).data;

  useEffect(() => {
    if (!shouldRun) return;
    (async () => {
      try {
        if (openMode) {
          if (answeredIds().includes(publicId)) { setAlready(true); setOpen(true); return; }
          const r = await publicPost("api/public/open-survey", { id: publicId, kind: publicKind, visitor });
          if (r.success && r.data) {
            setSurveys([r.data]);
            if (r.answered) { markAnswered(publicId); setAlready(true); }
          } else setClosedMsg(`This ${noun} is closed or doesn't exist.`);
          setOpen(true);
        } else if (linkMode) {
          const r = await publicPost("api/public/survey", linkBody);
          if (r.success && r.data) { setSurveys([r.data]); setOpen(true); }
        } else {
          // saved for 10 minutes; answering / skipping a survey clears it
          const r = (await listFetch("api/student/surveys/pending", {})).data;
          if (r.success && r.data.length) { setSurveys(r.data); setOpen(true); }
        }
      } catch { /* silent — a survey popup must never block the page */ }
    })();
  }, []);

  /* Public survey details step: the phone field gets the flag / country-code
     picker (/js/phoneinput.js), as on the website's forms. */
  const onWhoStep = openMode && open && !whoDone && !already && !closedMsg && surveys.length > 0;
  useEffect(() => {
    if (!onWhoStep) return;
    const w = window as any;
    const attach = () =>
      setTimeout(() => {
        if (!phoneRef.current) return;
        w.PhoneInput?.init?.(phoneRef.current, {
          initialCountry: phoneIso,
          // another country picked: cut a number that is now too long for it
          onChange: (info: any) => {
            if (info?.iso2) setPhoneIso(info.iso2);
            setWho((s) => {
              const cap = maxTyped(s.phone, info?.iso2);
              return s.phone.length > cap ? { ...s, phone: s.phone.slice(0, cap) } : s;
            });
          },
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
  }, [onWhoStep]);

  if (!open) return null;

  // Public survey that isn't open (wrong link, disabled, deleted)
  if (openMode && closedMsg) {
    return (
      <div className="pp-overlay">
        <div className="pp-modal" style={{ maxWidth: 440 }}>
          <div className="pp-done">
            <div className="pp-done-ic">{isFeedback ? "💬" : "🗳️"}</div>
            <h4>{isFeedback ? "Feedback form not available" : "Survey not available"}</h4>
            <p>{closedMsg}</p>
            <a className="btn btn-dark btn-sm" href="/">Back to home</a>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: PP_CSS }} />
      </div>
    );
  }

  // Public survey already answered (cookie, this browser, or this email)
  if (openMode && already && !done) {
    return (
      <div className="pp-overlay">
        <div className="pp-modal" style={{ maxWidth: 440 }}>
          <div className="pp-done">
            <div className="pp-done-ic">✅</div>
            <h4>You have already responded</h4>
            <p>{isFeedback ? "We've got your feedback" : "Your answers to this survey are in"} — one response per person. Thank you!</p>
            <a className="btn btn-dark btn-sm" href="/">Back to home</a>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: PP_CSS }} />
      </div>
    );
  }

  // Link-mode confirmation card (there's no dashboard behind it to fall back to).
  if (done) {
    return (
      <div className="pp-overlay">
        <div className="pp-modal" style={{ maxWidth: 440 }}>
          <div className="pp-done">
            <div className="pp-done-ic">{done === "submitted" ? "✅" : "👍"}</div>
            <h4>{done === "submitted" ? (openMode && isFeedback ? "Thanks for your feedback!" : "Thanks for your response!") : "No problem"}</h4>
            <p>{done === "submitted" ? "Your answers have been recorded." : "You’ve skipped this survey."}</p>
            {openMode ? (
              <a className="btn btn-dark btn-sm" href="/">Back to home</a>
            ) : (
              <button className="btn btn-dark btn-sm" onClick={() => setOpen(false)}>Close</button>
            )}
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: PP_CSS }} />
      </div>
    );
  }

  if (!surveys.length) return null;

  // Public survey, first step: name, email and (optional) phone
  if (onWhoStep) {
    const p0 = surveys[0];
    const setPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target as any;
      const raw = String(el.value || "");
      // a number pasted with "+<code>": the picker selects that country and keeps the local number
      if (/^\s*\+/.test(raw) && el._phoneInput) {
        el._phoneInput._hydrate();
        if (!/^\s*\+/.test(String(el.value || ""))) return;
      }
      const d = raw.replace(/\D/g, "");
      setWho((s) => ({ ...s, phone: d.slice(0, maxTyped(d, el._phoneInput?.current?.[0])) }));
    };
    const goOn = (e: React.FormEvent) => {
      e.preventDefault();
      setWhoErr("");
      if (who.name.trim().length < 2) return setWhoErr("Please enter your name.");
      if (!isValidEmail(who.email.trim())) return setWhoErr(EMAIL_ERROR);
      fullPhone.current = "";
      if (who.phone) {
        const c = (phoneRef.current as any)?._phoneInput?.current || lastPick.current; // [iso2, country, dial code]
        if (c) { lastPick.current = c; setPhoneIso(c[0]); }
        if (!isValidLocal(who.phone, c?.[0], c?.[2]))
          return setWhoErr(`Please enter a valid ${c ? c[1] + " " : ""}phone number: ${lengthText(c?.[0])} after the country code — or leave it empty.`);
        fullPhone.current = c ? "+" + c[2] + normalizeLocal(who.phone, c[0]) : who.phone;
      }
      setWhoDone(true);
    };
    return (
      <div className="pp-overlay">
        <form className="pp-modal pp-free" onSubmit={goOn} noValidate>
          <div className="pp-head">
            <div>
              <h4>{p0.title}</h4>
              {p0.description && <p className="pp-desc">{p0.description}</p>}
            </div>
            <span className="pp-count">Your details</span>
          </div>
          <div className="pp-progress"><div className="pp-progress-bar" style={{ width: "0%" }} /></div>
          <div className="pp-body">
            <div className="pp-who">
              <div>
                <label htmlFor="pp-name">Name <span className="pp-req">*</span></label>
                <input id="pp-name" className="form-control" autoComplete="name" maxLength={80} value={who.name}
                  onChange={(e) => setWho({ ...who, name: e.target.value })} placeholder="Your full name" autoFocus />
              </div>
              <div>
                <label htmlFor="pp-email">Email <span className="pp-req">*</span></label>
                <input id="pp-email" className="form-control" type="email" autoComplete="email" maxLength={120} value={who.email}
                  onChange={(e) => setWho({ ...who, email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div>
                <label htmlFor="pp-phone">Phone <span className="pp-opt-tag">(optional)</span></label>
                <div data-phone-scope="">
                  {/* kept in sync by /js/phoneinput.js */}
                  <input type="text" name="fullphone" defaultValue="" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
                  <input type="hidden" name="country_code" />
                  <input id="pp-phone" ref={phoneRef} className="form-control" type="tel" inputMode="numeric" autoComplete="tel-national"
                    maxLength={15} value={who.phone} onChange={setPhone} placeholder="Phone number" />
                </div>
              </div>
            </div>
            {whoErr && <p className="pp-err">{whoErr}</p>}
          </div>
          <div className="pp-foot">
            <span className="pp-desc" style={{ margin: 0 }}>{p0.questions.length} question{p0.questions.length === 1 ? "" : "s"} next</span>
            <button type="submit" className="btn btn-dark btn-sm">Continue ›</button>
          </div>
        </form>
        <style dangerouslySetInnerHTML={{ __html: PP_CSS }} />
      </div>
    );
  }

  // Flatten every question across all surveys into a single step sequence so the
  // student answers ONE question per screen, crossing survey boundaries seamlessly.
  const steps: { pi: number; qi: number }[] = [];
  surveys.forEach((p, pi) => p.questions.forEach((_, qi) => steps.push({ pi, qi })));
  if (!steps.length) return null;

  const safeCur = Math.min(cur, steps.length - 1);
  const { pi, qi } = steps[safeCur];
  const survey = surveys[pi];
  const question = survey.questions[qi];
  const isSurveyLastQ = qi === survey.questions.length - 1;
  const isLastStep = safeCur === steps.length - 1;
  const allSkippable = surveys.every((p) => p.allow_skip === "1");

  const setA = (qid: string, v: any) =>
    setAnswers((s) => ({ ...s, [survey.req_id]: { ...(s[survey.req_id] || {}), [qid]: v } }));
  const getA = (qid: string) => answers[survey.req_id]?.[qid];
  const setOther = (qid: string, v: string) =>
    setOthers((s) => ({ ...s, [survey.req_id]: { ...(s[survey.req_id] || {}), [qid]: v } }));
  const getOther = (qid: string) => others[survey.req_id]?.[qid] || "";

  // Replace the OTHER sentinel with the typed text before submitting.
  const resolve = (p: Survey) => {
    const raw = answers[p.req_id] || {};
    const oth = others[p.req_id] || {};
    const out: Record<string, any> = {};
    for (const q of p.questions) {
      let v = raw[q.id];
      if (Array.isArray(v)) v = v.map((x) => (x === OTHER ? (oth[q.id] || "") : x)).filter((x) => x !== "");
      else if (v === OTHER) v = oth[q.id] || "";
      out[q.id] = v;
    }
    return out;
  };

  // Is the CURRENT single question missing a required answer?
  const currentMissing = () => {
    if (!question.required) return false;
    const resolved = resolve(survey)[question.id];
    return resolved == null || (Array.isArray(resolved) ? resolved.length === 0 : String(resolved).trim() === "");
  };

  const submitSurvey = async (p: Survey) => {
    setBusy(true);
    try {
      const r = openMode
        ? await post("api/public/open-survey-submit", {
            id: p.req_id, kind: publicKind, visitor, answers: resolve(p), captcha: captchaToken,
            name: who.name.trim(), email: who.email.trim(), phone: fullPhone.current,
          })
        : linkMode
        ? await publicPost("api/public/survey-submit", { ...linkBody, answers: resolve(p) })
        : await post("api/student/surveys/submit", { req_id: p.req_id, answers: resolve(p) });
      if (openMode && r.already) { markAnswered(publicId); setAlready(true); return false; }
      if (openMode && r.success) markAnswered(publicId);
      if (!r.success) {
        toast.error(r.message);
        if (openMode) { turnstileRef.current?.reset(); setCaptchaToken(null); }
        return false;
      }
      return true;
    } catch { toast.error("Could not save your response"); return false; }
    finally { setBusy(false); }
  };

  const finish = (kind: "submitted" | "skipped") => {
    // Link mode has no panel behind it → show a confirmation card. Panel mode
    // just closes so the dashboard shows through.
    if (linkMode || openMode) setDone(kind);
    else setOpen(false);
  };

  const next = async () => {
    if (currentMissing()) { toast.error(`Please answer "${question.label}"`); return; }
    // Crossing a survey boundary saves that survey before moving to the next one.
    if (isSurveyLastQ && !(await submitSurvey(survey))) return;
    setCur(safeCur + 1);
  };

  const prev = () => setCur(Math.max(safeCur - 1, 0));

  const submitAll = async () => {
    if (currentMissing()) { toast.error(`Please answer "${question.label}"`); return; }
    if (openMode && captchaEnabled && !captchaToken) { toast.error("Please complete the captcha"); return; }
    if (await submitSurvey(survey)) { toast.success(openMode && isFeedback ? "Thanks for your feedback!" : "Thanks for your responses!"); finish("submitted"); }
  };

  // Jump to the first step of a given survey index (or close if none left).
  const gotoSurvey = (targetPi: number) => {
    const s = steps.findIndex((st) => st.pi === targetPi);
    if (s === -1) setOpen(false); else setCur(s);
  };

  const skipThis = async () => {
    setBusy(true);
    try {
      if (linkMode) await publicPost("api/public/survey-skip", linkBody);
      else await post("api/student/surveys/skip", { req_id: survey.req_id });
    } catch { /* ignore */ }
    setBusy(false);
    if (linkMode) { finish("skipped"); return; }
    if (pi >= surveys.length - 1) setOpen(false);
    else gotoSurvey(pi + 1);
  };

  const skipAll = async () => {
    setBusy(true);
    try {
      if (linkMode) await publicPost("api/public/survey-skip", linkBody);
      else await post("api/student/surveys/skip", { req_ids: surveys.map((p) => p.req_id) });
    } catch { /* ignore */ }
    setBusy(false);
    finish("skipped");
  };

  /* ---------------- per-type input ---------------- */
  const renderQ = (q: Question) => {
    const v = getA(q.id);
    switch (q.type) {
      case "single":
      case "yesno": {
        const opts = q.type === "yesno" ? ["Yes", "No"] : (q.options || []);
        return (
          <div className="pp-opts">
            {opts.map((o) => (
              <label key={o} className="pp-opt">
                <input type="radio" name={q.id} checked={v === o} onChange={() => setA(q.id, o)} /> <span>{o}</span>
              </label>
            ))}
            {q.allowOther && (
              <label className="pp-opt">
                <input type="radio" name={q.id} checked={v === OTHER} onChange={() => setA(q.id, OTHER)} />
                <span>Other:</span>
                <input className="pp-other" disabled={v !== OTHER} value={getOther(q.id)} onChange={(e) => setOther(q.id, e.target.value)} placeholder="your answer" />
              </label>
            )}
          </div>
        );
      }
      case "multi": {
        const arr: string[] = Array.isArray(v) ? v : [];
        const toggle = (o: string) => setA(q.id, arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
        return (
          <div className="pp-opts">
            {(q.options || []).map((o) => (
              <label key={o} className="pp-opt">
                <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} /> <span>{o}</span>
              </label>
            ))}
            {q.allowOther && (
              <label className="pp-opt">
                <input type="checkbox" checked={arr.includes(OTHER)} onChange={() => toggle(OTHER)} />
                <span>Other:</span>
                <input className="pp-other" disabled={!arr.includes(OTHER)} value={getOther(q.id)} onChange={(e) => setOther(q.id, e.target.value)} placeholder="your answer" />
              </label>
            )}
          </div>
        );
      }
      case "dropdown":
        return (
          <select className="form-select" value={v ?? ""} onChange={(e) => setA(q.id, e.target.value)}>
            <option value="">— Select —</option>
            {(q.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            {q.allowOther && <option value={OTHER}>Other…</option>}
          </select>
        );
      case "ranking": {
        const order: string[] = Array.isArray(v) && v.length ? v : (q.options || []);
        const move = (i: number, d: -1 | 1) => {
          const j = i + d; if (j < 0 || j >= order.length) return;
          const c = [...order];[c[i], c[j]] = [c[j], c[i]]; setA(q.id, c);
        };
        return (
          <div className="pp-rank">
            {order.map((o, i) => (
              <div className="pp-rank-item" key={o}>
                <span className="pp-rank-no">{i + 1}</span>
                <span className="pp-rank-label">{o}</span>
                <button type="button" className="pp-rank-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" className="pp-rank-btn" onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</button>
              </div>
            ))}
          </div>
        );
      }
      case "star":
        return (
          <div className="pp-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={"pp-star " + (Number(v) >= n ? "on" : "")} onClick={() => setA(q.id, n)}>★</span>
            ))}
          </div>
        );
      case "emoji":
        return (
          <div className="pp-emojis">
            {EMOJIS.map((e) => (
              <span key={e} className={"pp-emoji " + (v === e ? "on" : "")} onClick={() => setA(q.id, e)}>{e}</span>
            ))}
          </div>
        );
      case "number":
        return <input type="number" className="form-control" min={q.min} max={q.max} value={v ?? ""} onChange={(e) => setA(q.id, e.target.value)} placeholder={`${q.min ?? 1}–${q.max ?? 10}`} />;
      case "slider":
        return (
          <div className="pp-slider">
            <input type="range" min={q.min ?? 0} max={q.max ?? 100} value={Number(v ?? (q.min ?? 0))} onChange={(e) => setA(q.id, Number(e.target.value))} />
            <span className="pp-slider-val">{v ?? (q.min ?? 0)}</span>
          </div>
        );
      case "date":
        return <input type="date" className="form-control" value={v ?? ""} onChange={(e) => setA(q.id, e.target.value)} />;
      case "time":
        return <input type="time" className="form-control" value={v ?? ""} onChange={(e) => setA(q.id, e.target.value)} />;
      case "textarea":
        return <textarea className="form-control" rows={3} value={v ?? ""} onChange={(e) => setA(q.id, e.target.value)} />;
      default:
        return <input type="text" className="form-control" value={v ?? ""} onChange={(e) => setA(q.id, e.target.value)} />;
    }
  };

  const progress = Math.round(((safeCur + 1) / steps.length) * 100);

  return (
    <div className="pp-overlay">
      <div className="pp-modal">
        <div className="pp-head">
          <div>
            <h4>{survey.title}</h4>
            {qi === 0 && survey.description && <p className="pp-desc">{survey.description}</p>}
          </div>
          <span className="pp-count">
            {surveys.length > 1 ? `Survey ${pi + 1}/${surveys.length} · ` : ""}Q {qi + 1}/{survey.questions.length}
          </span>
        </div>

        <div className="pp-progress"><div className="pp-progress-bar" style={{ width: `${progress}%` }} /></div>

        <div className="pp-body">
          <div className="pp-q" key={question.id}>
            <div className="pp-q-label">{question.label} {question.required && <span className="pp-req">*</span>}</div>
            {renderQ(question)}
          </div>
          {openMode && isLastStep && captchaEnabled && (
            <div className="pp-captcha">
              <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
            </div>
          )}
        </div>

        <div className="pp-foot">
          <div className="pp-foot-left">
            {allSkippable && <button type="button" className="pp-link" disabled={busy} onClick={skipAll}>Skip all</button>}
            {survey.allow_skip === "1" && <button type="button" className="pp-link" disabled={busy} onClick={skipThis}>Skip this survey</button>}
          </div>
          <div className="pp-foot-right">
            {safeCur > 0 && <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={prev}>‹ Prev</button>}
            {openMode && safeCur === 0 && <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => setWhoDone(false)}>‹ Back</button>}
            {!isLastStep && <button type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={next}>{isSurveyLastQ ? "Save & Next ›" : "Next ›"}</button>}
            {isLastStep && <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={submitAll}>{busy ? "Saving…" : "Submit"}</button>}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: PP_CSS }} />
    </div>
  );
}
