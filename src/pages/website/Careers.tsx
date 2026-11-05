import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Clock,
  FolderOpen,
  MapPin,
  Network,
  Wallet,
} from "lucide-react";
import { Head, SERVER_URL } from "../../components/Includes";
import { getSeoByPath } from "../../utils/seo";
import { siteFetch } from "../../utils/siteCache";
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import TurnstileWidget, {
  captchaEnabled,
  type TurnstileHandle,
} from "../../components/TurnstileWidget";
import { PageHero } from "../../components/site/PageKit";

const seo = getSeoByPath("careers");

type Job = {
  req_id?: string; // not in the saved copy (siteFetch keeps no ids): use slug
  slug: string;
  title: string;
  location: string;
  jtype: string;
  department: string;
  experience: string;
  salary: string;
  short_desc: string;
  description?: string;
  datetime: number;
};

const getSecurity = async () =>
  (
    await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    })
  ).data;

export default function Careers() {
  const { slug } = useParams();
  return slug ? <CareerDetail slug={slug} /> : <CareerList />;
}

/* ---------------- LIST ---------------- */
function CareerList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // saved for 10 minutes like the other website lists (utils/siteCache.ts)
        const r = await siteFetch("api/public/jobs", { method: "post" });
        if (r.data.success) setJobs(r.data.data);
      } catch {
        /* leave empty */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="enroll-page biz-page">
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <style>{CAREERS_CSS}</style>

      {/* ── Hero ── */}
      <PageHero
        crumb="Careers"
        eyebrow="Careers at Rivira Tech"
        title="Build the future of"
        accent="AI education"
        text="Join Rivira Tech — help students and businesses learn, build and ship real generative AI, alongside people who teach what they build."
        image="/images/pages/careers.webp"
        imageAlt="A career-growth chart beside a portfolio-ready profile"
        actions={[{ label: "See Open Roles", href: "#openings" }, { label: "About Us", to: "/about", ghost: true }]}
      />

      {/* ── Openings ── */}
      <section className="enroll-section-gray" id="openings">
        <div className="enroll-container">
          <span className="enroll-section-label">Open roles</span>
          <h2 className="enroll-section-title">Current openings</h2>
          <p className="enroll-section-sub">
            Teaching and building practical AI, with a team that does both.
          </p>

          {loading ? (
            <div className="pageloader">
              <div className="loader-facebook">
                <div className="lds-facebook">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="cr-empty" data-aos="zoom-in">
              <FolderOpen size={40} />
              <h3>No open positions right now</h3>
              <p>
                We're not hiring at the moment — check back soon, or reach out
                via our contact page.
              </p>
              <Link to="/contact" className="enroll-btn-primary">
                <span>Contact Us</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="cr-grid">
              {jobs.map((j) => (
                <div className="cr-card" key={j.slug} data-aos="fade-up">
                  <div className="cr-card-head">
                    <h3>{j.title}</h3>
                    {j.jtype && <span className="cr-tag">{j.jtype}</span>}
                  </div>
                  <div className="cr-meta">
                    {j.location && (
                      <span>
                        <MapPin size={14} /> {j.location}
                      </span>
                    )}
                    {j.department && (
                      <span>
                        <Network size={14} /> {j.department}
                      </span>
                    )}
                    {j.experience && (
                      <span>
                        <Clock size={14} /> {j.experience}
                      </span>
                    )}
                  </div>
                  {j.short_desc && <p className="cr-summary">{j.short_desc}</p>}
                  <div className="cr-card-foot">
                    {j.salary ? (
                      <span className="cr-salary">{j.salary}</span>
                    ) : (
                      <span />
                    )}
                    <Link to={`/careers/${j.slug}`} className="cr-more">
                      More info <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------- DETAIL + APPLY ---------------- */
function CareerDetail({ slug }: { slug: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [state, setState] = useState<"loading" | "found" | "notfound">(
    "loading",
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cover: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  // Full international number ("+" + dial code + digits), written by the
  // phoneinput.js country picker into the hidden [name="fullphone"] field.
  const phoneRef = useRef<HTMLInputElement>(null);

  // ---------- PhoneInput plugin (flag / country-code picker for #phone) ----------
  // The apply form mounts after the job loads; the plugin's observer picks it up.
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

  // Phone: digits only — the country code comes from the flag picker. A full
  // number pasted / autofilled with "+<code>" is handed to the picker, which
  // selects that country and leaves just the local number in the box.
  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target as any;
    const raw = String(el.value || "");
    if (/^\s*\+/.test(raw) && el._phoneInput) {
      el._phoneInput._hydrate(); // re-fires this handler with the local digits
      if (!/^\s*\+/.test(String(el.value || ""))) return;
    }
    setForm((f) => ({ ...f, phone: raw.replace(/\D/g, "").slice(0, 15) }));
  };

  useEffect(() => {
    (async () => {
      setState("loading");
      try {
        const r = await siteFetch("api/public/job", { method: "post", params: { slug } });
        if (r.data.success) {
          setJob(r.data.data);
          setState("found");
        } else setState("notfound");
      } catch {
        setState("notfound");
      }
    })();
  }, [slug]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f) {
      const okType = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(f.type);
      const okExt = /\.(pdf|doc|docx)$/i.test(f.name);
      if (!okType && !okExt) {
        setErr("Please upload a PDF or Word (.pdf, .doc, .docx) file");
        return;
      }
      if (f.size > 8 * 1024 * 1024) {
        setErr("Resume must be under 8 MB");
        return;
      }
      setErr("");
    }
    setFile(f);
  };

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setDone("");
    if (!form.name.trim()) return setErr("Please enter your name");
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      return setErr("Please enter a valid email");
    if (!file) return setErr("Please attach your resume (PDF or Word)");
    if (captchaEnabled && !captchaToken)
      return setErr("Please complete the captcha");

    setBusy(true);
    try {
      const s = await getSecurity();
      // 1) signed upload URL for the resume
      const up = await axios.post(
        SERVER_URL + "api/public/resume-url",
        {
          fileName: file.name,
          fileType: file.type,
          key: s.key,
          token: s.token,
          aut: s.aut,
        },
        { withCredentials: true },
      );
      if (!up.data.success) {
        setErr(up.data.message || "Could not upload resume");
        setBusy(false);
        return;
      }
      // 2) upload the file to the signed URL
      await axios.put(up.data.uploadURL, file, {
        headers: { "Content-Type": file.type },
      });
      // 3) submit the application
      const r = await axios.post(
        SERVER_URL + "api/public/job-apply",
        {
          slug,
          ...form,
          // saved with its country code, e.g. "+919876543210"
          phone: form.phone ? phoneRef.current?.value || form.phone : "",
          resume: up.data.key,
          captcha: captchaToken,
          key: s.key,
          token: s.token,
          aut: s.aut,
        },
        { withCredentials: true },
      );
      if (r.data.success) {
        setDone(r.data.message);
        setForm({ name: "", email: "", phone: "", cover: "" });
        setFile(null);
      } else setErr(r.data.message || "Could not submit application");
    } catch {
      setErr("Something went wrong, please try again");
    } finally {
      setBusy(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  if (state === "loading") {
    return (
      <div className="enroll-page biz-page">
        <style>{CAREERS_CSS}</style>
        <section className="enroll-section cr-state">
          <div className="pageloader">
            <div className="loader-facebook">
              <div className="lds-facebook">
                <div></div>
                <div></div>
                <div></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }
  if (state === "notfound" || !job) {
    return (
      <div className="enroll-page biz-page">
        <Head
          pageTitle={seo.title}
          pageDesc={seo.description}
          pageKeywords={seo.keywords}
        />
        <style>{CAREERS_CSS}</style>
        <section className="enroll-section cr-state">
          <div className="cr-empty">
            <FolderOpen size={40} />
            <h3>Position not found</h3>
            <p>This opening may have been filled or closed.</p>
            <Link to="/careers" className="enroll-btn-primary">
              <span>View all jobs</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="enroll-page biz-page">
      <Head
        pageTitle={`${job.title} — Careers`}
        pageDesc={job.short_desc || job.title}
        pageKeywords="careers, jobs, ai"
      />
      <style>{CAREERS_CSS}</style>

      {/* ── Hero ── */}
      <section className="enroll-hero">
        <div className="enroll-hero-grid" />
        <div className="enroll-hero-glow-left" />
        <div className="enroll-hero-glow-right" />
        <div className="enroll-hero-inner">
          <Link to="/careers" className="cr-back">
            <ArrowLeft size={15} /> All jobs
          </Link>
          <div className="enroll-badge">
            <Briefcase size={12} /> {job.department || "Careers"}
          </div>
          <h1>{job.title}</h1>
          {job.short_desc && <p>{job.short_desc}</p>}
          <div className="enroll-hero-chips">
            {job.jtype && (
              <span className="enroll-hero-chip">
                <span className="dot" /> {job.jtype}
              </span>
            )}
            {job.location && (
              <span className="enroll-hero-chip">
                <MapPin size={13} /> {job.location}
              </span>
            )}
            {job.experience && (
              <span className="enroll-hero-chip">
                <Clock size={13} /> {job.experience}
              </span>
            )}
            {job.salary && (
              <span className="enroll-hero-chip">
                <Wallet size={13} /> {job.salary}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="enroll-section">
        <div className="enroll-container cr-detail-grid">
          <div className="cr-body" data-aos="fade-right">
            <span className="enroll-section-label">About the role</span>
            {/* admin-authored copy — sanitised before rendering (audit F9) */}
            <div
              className="cr-desc"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(
                  (job.description || job.short_desc || "").replace(
                    /\n/g,
                    "<br/>",
                  ),
                ),
              }}
            />
          </div>

          <aside className="cr-apply" id="apply" data-aos="fade-left">
            <h3>Apply for this role</h3>
            {done ? (
              <div className="cr-thanks">
                <span className="cr-thanks-ic">✅</span>
                <h4>Application received!</h4>
                <p>{done}</p>
                <Link to="/careers" className="enroll-btn-primary">
                  <span>View other roles</span>
                  <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              /* form.careerapply: phoneinput.js attaches its country picker to #phone */
              <form onSubmit={apply} className="careerapply">
                <label>Full name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                  required
                />
                <label>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />
                <label>Phone</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={setPhone}
                  maxLength={15}
                  autoComplete="tel-national"
                  inputMode="numeric"
                  placeholder="Optional"
                />
                {/* the plugin keeps these in sync: "+" + dial code + digits, and the ISO country */}
                <input name="fullphone" type="text" defaultValue="" ref={phoneRef} style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
                <input type="hidden" name="country_code" />
                <label>Cover note</label>
                <textarea
                  rows={3}
                  value={form.cover}
                  onChange={(e) => setForm({ ...form, cover: e.target.value })}
                  placeholder="Why you're a great fit (optional)"
                />
                <label>Resume (PDF or Word) *</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onFile}
                />
                {file && <div className="cr-file">{file.name}</div>}

                {captchaEnabled && (
                  <div className="cr-captcha">
                    <TurnstileWidget
                      ref={turnstileRef}
                      onToken={setCaptchaToken}
                    />
                  </div>
                )}
                {err && <div className="cr-err">{err}</div>}
                <button type="submit" className="cr-btn" disabled={busy}>
                  {busy ? "Submitting…" : "Submit Application"}
                </button>
                <small className="cr-fine">
                  Your resume is sent securely to our hiring team.
                </small>
              </form>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

const CAREERS_CSS = `
.cr-back {position: absolute;left: 0; display:inline-flex; align-items:center; gap:6px; margin-bottom:18px; color:var(--gold-pale,#f5dfa0); text-decoration:none; font-weight:700; font-size:.9rem; }
.cr-back:hover { color:#fff; }

.cr-loading { text-align:center; color:#64748b; padding:40px 0; margin:0; }
.cr-state { min-height:50vh; display:flex; align-items:center; justify-content:center; }

.cr-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:22px; }
.cr-card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:24px; box-shadow:0 10px 26px -18px rgba(10,15,30,.35); transition:transform .2s, box-shadow .2s; display:flex; flex-direction:column; text-align:left; }
.cr-card:hover { transform:translateY(-4px); box-shadow:0 20px 40px -22px rgba(10,15,30,.45); }
.cr-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.cr-card-head h3 { color:#0a0f1e; font-family:var(--font-display); font-size:1.2rem; font-weight:700; margin:0; }
.cr-tag { flex-shrink:0; background:rgba(31, 95, 175,.1); color:#0B3D7A; border:1px solid rgba(31, 95, 175,.35); font-size:.72rem; font-weight:700; padding:4px 10px; border-radius:999px; }
.cr-meta { display:flex; flex-wrap:wrap; gap:8px 16px; margin:12px 0; color:#64748b; font-size:.85rem; }
.cr-meta span { display:inline-flex; align-items:center; gap:5px; }
.cr-meta svg { color:#1F5FAF; }
.cr-summary { color:#475569; font-size:.95rem; line-height:1.6; margin:0 0 16px; flex:1; }
.cr-card-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; border-top:1px solid #e2e8f0; padding-top:14px; }
.cr-salary { color:#0a0f1e; font-weight:700; font-size:.95rem; }
.cr-more { display:inline-flex; align-items:center; gap:6px; color:#0B3D7A; font-weight:700; text-decoration:none; font-size:.9rem; }
.cr-more:hover { color:#1F5FAF; }

.cr-detail-grid { display:grid; grid-template-columns:1fr 380px; gap:40px; align-items:start; text-align:left; }
.cr-desc { color:#334155; font-size:1.02rem; line-height:1.8; margin-top:14px; }
.cr-desc h3 { color:#0a0f1e; margin:22px 0 10px; }
.cr-desc ul { padding-left:20px; }
.cr-desc li { margin:6px 0; }

.cr-apply { position:sticky; top:96px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:24px; }
.cr-apply h3 { color:#0a0f1e; font-family:var(--font-display); font-size:1.2rem; font-weight:700; margin:0 0 14px; }
.cr-apply label { display:block; font-size:.82rem; font-weight:700; color:#334155; margin:12px 0 5px; }
.cr-apply input, .cr-apply textarea { width:100%; border:1px solid #cbd5e1; border-radius:10px; padding:10px 12px; font-size:.92rem; background:#fff; }
.cr-apply input:focus, .cr-apply textarea:focus { outline:none; border-color:#1F5FAF; box-shadow:0 0 0 3px rgba(31, 95, 175,.15); }
.cr-file { margin-top:6px; font-size:.82rem; color:#047857; font-weight:600; }
.cr-captcha { display:flex; justify-content:center; margin:12px 0 4px; }
.cr-err { margin-top:10px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; border-radius:8px; padding:8px 12px; font-size:.85rem; }
.cr-fine { display:block; text-align:center; color:#64748b; font-size:.75rem; margin-top:10px; }
.cr-btn { display:block; width:100%; margin-top:16px; background:linear-gradient(135deg,#1F5FAF,#5AA9F0); color:#fff; font-weight:700; padding:13px 26px; border:none; border-radius:999px; cursor:pointer; transition:transform .2s, box-shadow .2s; box-shadow:0 4px 20px rgba(31, 95, 175,.25); }
.cr-btn:hover { transform:translateY(-2px); }
.cr-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
.cr-thanks { text-align:center; padding:14px 4px; }
.cr-thanks-ic { font-size:2.4rem; }
.cr-thanks h4 { color:#0a0f1e; margin:8px 0 6px; }
.cr-thanks p { color:#475569; margin:0 0 16px; }

.cr-empty { text-align:center; max-width:520px; margin:0 auto; padding:30px 20px; }
.cr-empty svg { color:#1F5FAF; margin:0 auto; }
.cr-empty h3 { color:#0a0f1e; font-family:var(--font-display); margin:16px 0 8px; }
.cr-empty p { color:#475569; margin:0 0 20px; }

@media (max-width:900px){ .cr-detail-grid { grid-template-columns:1fr; } .cr-apply { position:static; } }
`;
