import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  CheckCircle2, X, ChevronDown, ArrowRight, Zap,
  Video, Film, Hammer, Users, Repeat, Radio,
  BookOpen, Target, Briefcase, Globe, Star,
  Sparkles, BarChart3, Layers, ShieldCheck,
} from "lucide-react";
import axios from "axios";
import { Head, PHONE, SERVER_URL } from "../../components/Includes";
import { COURSE_CATALOGUE } from "../../utils/courses";
import { PLANS, PLANS_PUBLISHED, SUBSCRIPTIONS_ENABLED, type PlanKey } from "../../utils/subscriptions";
import { offeredFromResponse, readOfferedPlans, saveOfferedPlans } from "../../utils/offeredPlans";
import TurnstileWidget, { captchaEnabled, type TurnstileHandle } from "../../components/TurnstileWidget";

const COUNSELOR_TEL = `tel:${PHONE.replace(/[^+\d]/g, "")}`;

const FORMAT = [
  { icon: Video,  label: "Live",       desc: "Online & interactive sessions" },
  { icon: Film,   label: "Recorded",   desc: "Rewatch the library anytime" },
  { icon: Hammer, label: "Hands-on",   desc: "Real, deployable projects" },
  { icon: Users,  label: "All levels",  desc: "Coders & non-coders welcome" },
];

const SKILLS = [
  "Large Language Models (LLMs)",
  "Prompt Engineering",
  "Retrieval-Augmented Generation",
  "Vector Search & Embeddings",
  "AI Agents",
  "Model Context Protocol (MCP)",
  "Multi-Agent Orchestration",
  "Fine-Tuning",
  "MLOps & Deployment",
  "AI Application Architecture",
];

const AUDIENCE = [
  "Career changers",
  "Working developers",
  "Non-coders",
  "Students",
  "Analysts & business users",
];

const ACCESS_MODEL = [
  { icon: Radio,  title: "Live classes",           desc: "Scheduled live sessions with instructors, real-time questions, plus weekly doubt-clearing calls and detailed project reviews." },
  { icon: Film,   title: "Recorded videos",        desc: "Missed a class or want to revise? Rewatch the entire recorded library whenever you like." },
  { icon: Repeat, title: "Flexible subscriptions", desc: "All-access with the Bundle, a single track with Monthly, or pay once for lifetime access." },
];

const WHY_US = [
  { icon: Target,    title: "Ship, don't just watch",   desc: "Every module ends in something you built and can demo, never a written quiz." },
  { icon: Users,     title: "Mentor support",           desc: "1:1 guidance and weekly doubt sessions with practitioners who build this for a living." },
  { icon: Briefcase, title: "Portfolio that holds up",  desc: "Finish with demo-ready GenAI projects that a hiring manager can open, run and review." },
  { icon: Globe,     title: "Learn from anywhere",      desc: "Live on Zoom with a full recorded library, so a missed session costs nothing." },
  { icon: BookOpen,  title: "Coders & non-coders",      desc: "Two paths through the same program — pick the track that fits your background." },
  { icon: Star,      title: "Certificate on completion", desc: "A shareable program certificate, issued once all your work is built and signed off." },
];

const WHAT_YOU_LEARN = [
  "Build and deploy production-grade Generative AI applications",
  "Design RAG pipelines over your own data with vector search",
  "Engineer autonomous AI agents and multi-agent workflows",
  "Work with LLMs, prompting, fine-tuning and the MCP tool ecosystem",
  "Ship cloud-based AI solutions with real-world MLOps practices",
  "Present a portfolio of demo-ready projects to employers",
];

const CURRICULUM = [
  { n: "01", title: "Foundations of Generative AI",   desc: "LLMs, tokens, embeddings and the modern AI stack — how it all fits together." },
  { n: "02", title: "Prompt Engineering & LLM Apps",  desc: "Reliable prompting, structured outputs, and building your first LLM-powered app." },
  { n: "03", title: "RAG & Vector Search",            desc: "Retrieval-augmented generation over private data, chunking, and evaluation." },
  { n: "04", title: "AI Agents & MCP",                desc: "Tool-using agents, multi-agent orchestration, and the Model Context Protocol." },
  { n: "05", title: "Deployment & MLOps",             desc: "Serving, monitoring, cost control and shipping AI to the cloud." },
  { n: "06", title: "Capstone Project",               desc: "Build an end-to-end GenAI product with mentor reviews and a certificate." },
];

const FAQS = [
  { q: "Are classes live or recorded?", a: "Both. Every plan includes scheduled live classes with instructors AND a growing library of recorded videos you can rewatch anytime while your access is active." },
  { q: "What's the difference between the plans?", a: "The Bundle subscription unlocks every program for one monthly price. The Monthly subscription gives you a single program month-to-month. The Individual Course is a one-time payment with lifetime access to that one program." },
  { q: "Can I cancel a subscription?", a: "Yes — subscriptions are month-to-month and you can cancel anytime. You keep access until the end of your billing cycle." },
  { q: "Do I get a certificate?", a: "Yes, every program includes a certificate of completion once you finish the projects." },
  { q: "How do I actually pay?", a: "Submitting the form doesn't charge you. Our team reviews each request, applies any applicable discount, and emails you a secure payment link. Your seat is confirmed once that payment is complete." },
];


const decodeHtml = (str: string) => {
  const el = document.createElement("textarea");
  el.innerHTML = str ?? "";
  return el.value;
};

// Mirrors Enroll.tsx: the panel resolves a course by req_id, and the public
// titles don't match the panel's, so pair them on the page each one links to.
const PANEL_ALIASES: Record<string, string[]> = {
  "AI For Kids":        ["learning for kids", "for kids"],
  "AI For Coders":      ["it professionals", "for coders"],
  "AI For Non Coders":  ["it non coders", "non coders"],
  "GenAI For Business": ["business & industry", "business &amp; industry", "for business"],
};

const isPlanKey = (v: string | null): v is PlanKey => v === "bundle" || v === "monthly" || v === "individual";

export default function ProgramGenAI() {
  const { pathname, search } = useLocation();

  /* Plans on offer follow Panel → Plan Slides: a plan is offered while at
     least one of its slides is shown, and none are while the whole section is
     switched off (the page then falls back to "Talk to a counselor", same as
     PLANS_PUBLISHED = false). null = still loading. If the request fails,
     every plan stays on offer. Checkout enforces the same rule server-side. */
  // Start from the last known answer (saved here and by the home page), so the
  // hero renders in its final layout instead of jumping once the API replies.
  const [offered, setOffered] = useState<PlanKey[] | null>(() => {
    if (!PLANS_PUBLISHED) return [];
    const known = readOfferedPlans();
    return known ? PLANS.map((p) => p.key).filter((k) => known.includes(k)) : null;
  });
  useEffect(() => {
    if (!PLANS_PUBLISHED) return;
    let live = true;
    axios.get(SERVER_URL + "api/get-plan-slides")
      .then((res) => {
        if (!live) return;
        if (!res.data?.success) { setOffered(PLANS.map((p) => p.key)); return; }
        const keys = offeredFromResponse(res.data);
        saveOfferedPlans(keys);
        setOffered(PLANS.map((p) => p.key).filter((k) => keys.includes(k)));
      })
      .catch(() => { if (live) setOffered(PLANS.map((p) => p.key)); });
    return () => { live = false; };
  }, []);
  const plansLoading = offered === null;
  const plansOn = PLANS_PUBLISHED && !!offered && offered.length > 0;
  const visiblePlans = PLANS.filter((p) => offered?.includes(p.key));
  const PLAN_COUNT_WORD = ["no", "the", "the two", "the three"][visiblePlans.length] ?? `the ${visiblePlans.length}`;

  const [planKey, setPlanKey] = useState<PlanKey | null>(null);
  const plan = visiblePlans.find((p) => p.key === planKey) ?? null;

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  /* Two steps, same as /enroll: confirm the plan, then take the details. The
     details go to /api/enroll, which files the row under Enrolment Requests. */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const [courses, setCourses] = useState<any[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    name: "", gender: "", phone: "", email: "",
    qualification: "", course: "", referby: "",
  });
  const phoneRef = useRef<HTMLInputElement>(null);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // Which submit button was pressed: pay now (Stripe checkout) or pay later
  // (the team emails a payment link).
  const payNow = useRef(true);
  const [redirecting, setRedirecting] = useState(false);

  // Every write endpoint checks a per-session key/token/aut triple, fetched
  // fresh each time — a cached one fails on the second submit.
  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", { withCredentials: true });
    return res.data;
  };

  const loadCourses = async () => {
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/courses/get",
        { status: "1", key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true }
      );
      if (res.data.success) setCourses(res.data.data || []);
    } catch {
      /* fall through — courseValue() then submits the title instead of an id */
    }
  };

  const courseValue = (publicName: string) => {
    const aliases = PANEL_ALIASES[publicName];
    if (aliases && courses.length) {
      const hit = courses.find((c: any) => {
        const t = decodeHtml(c.title || c.name || "").toLowerCase();
        return aliases.some((a) => t.includes(a.toLowerCase()));
      });
      if (hit) return hit.req_id || hit.id;
    }
    return publicName;
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const firstInvalid = (): { id: string; message: string } | null => {
    const checks: Array<[string, boolean, string]> = [
      ["pgnr-name",   form.name.trim().length >= 3,          "Please enter your full name (at least 3 characters)."],
      ["pgnr-gender", form.gender !== "",                    "Please select a gender."],
      ["phone",       form.phone.length === 10,              "Please enter your 10-digit contact number."],
      ["pgnr-email",  /^\S+@\S+\.\S+$/.test(form.email),     "Please enter a valid email address."],
      ["pgnr-qual",   form.qualification.trim().length >= 2, "Please enter your qualification."],
      ["pgnr-course", form.course !== "",                    "Please select a course."],
    ];
    const bad = checks.find(([, ok]) => !ok);
    return bad ? { id: bad[0], message: bad[2] } : null;
  };

  const submitEnroll = async (e: any) => {
    e.preventDefault();
    setFormSuccess("");
    setFormError("");

    if (!plan) {
      setFormError("Please choose a plan first.");
      return;
    }

    const bad = firstInvalid();
    if (bad) {
      setFormError(bad.message);
      const el = document.getElementById(bad.id);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setFormError("Please complete the captcha verification.");
      return;
    }

    // "+" + dial code + digits, written by /js/phoneinput.js
    const fullphone = phoneRef.current?.value ?? "";

    try {
      setFormLoading(true);
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enroll",
        {
          name: form.name,
          gender: form.gender,
          phone: form.phone,
          fullphone,
          email: form.email,
          qualification: form.qualification,
          course: form.course,
          referby: form.referby,
          captcha: captchaToken,
          // Recorded against the request so the reviewing admin sees which plan
          // was chosen before they quote a price and send the payment link.
          addon: "",
          plan: `${plan.tier} — Generative AI Engineer Program (${plan.price} ${plan.unit.trim()})`,
          fees: plan.amount,
          currency: "USD",
          key: s.key, token: s.token, aut: s.aut,
        },
        { withCredentials: true }
      );

      if (!res.data.success) {
        setFormError(res.data.message || "We couldn't submit your enrollment.");
        return;
      }

      if (SUBSCRIPTIONS_ENABLED && payNow.current) {
        const s2 = await getSecurity();
        const co = await axios.post(
          SERVER_URL + "api/program/checkout",
          {
            plan: plan.key, email: form.email, name: form.name,
            // ties the Stripe payment back to this enrolment request
            req_id: res.data.req_id || "",
            key: s2.key, token: s2.token, aut: s2.aut,
          },
          { withCredentials: true }
        );
        if (!co.data?.success || !co.data.url) {
          // The request IS saved — say so, rather than implying it was lost.
          setFormError(
            "Your request was saved, but we couldn't open the payment page. " +
            "We'll email you a payment link shortly.",
          );
          return;
        }
        setRedirecting(true);
        window.location.href = co.data.url;
        return;
      }

      setFormSuccess(res.data.message || "Your enrollment request has been received.");
      setForm({ name: "", gender: "", phone: "", email: "", qualification: "", course: "", referby: "" });
    } catch {
      setFormError("We couldn't reach the enrollment service. Please try again.");
    } finally {
      setFormLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const openConfirm = () => { setFormSuccess(""); setFormError(""); setConfirmOpen(true); };

  const selectPlan = (key: PlanKey) => {
    setPlanKey((cur) => (cur === key ? null : key));
  };

  // Plan chosen on the Home "Learn your way" slider: /program/...?plan=monthly.
  useEffect(() => {
    const q = new URLSearchParams(search).get("plan");
    if (isPlanKey(q) && offered?.includes(q)) setPlanKey(q);
  }, [search, offered]);

  // Bring the plan card to just below the fixed header. The header turns
  // fixed once the page scrolls, which shifts the layout mid-scroll, so
  // re-measure afterwards and nudge until the card sits in place.
  const PRICING_OFFSET = 84;
  const alignPricing = (smooth = true) => {
    const el = document.getElementById("pgnr-pricing");
    if (!el) return;
    const delta = () => el.getBoundingClientRect().top - PRICING_OFFSET;
    window.scrollBy({ top: delta(), behavior: smooth ? "smooth" : "auto" });
    let tries = 0;
    const fix = () => {
      const d = delta();
      if (Math.abs(d) > 6 && tries++ < 3) {
        window.scrollBy({ top: d, behavior: "smooth" });
        setTimeout(fix, 450);
      }
    };
    setTimeout(fix, 650);
  };

  // Arriving with #pgnr-pricing (Home slider buttons): <ScrollToTop> starts
  // the scroll; line the card up once it has rendered (it waits for the
  // plans on offer to load).
  useEffect(() => {
    if (!plansOn || window.location.hash !== "#pgnr-pricing") return;
    const t = setTimeout(() => alignPricing(), 700);
    return () => clearTimeout(t);
  }, [plansOn]);

  // "See pricing & plans": scroll to the plan card on every click (a plain
  // #hash link does nothing once the hash is already set, and nothing visible
  // on desktop where the card sits beside the button) and flash it.
  const [pricingFlash, setPricingFlash] = useState(false);
  const goToPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!document.getElementById("pgnr-pricing")) return;
    alignPricing();
    window.history.replaceState(window.history.state, "", pathname + search + "#pgnr-pricing");
    setPricingFlash(false);
    requestAnimationFrame(() => setPricingFlash(true));
  };
  useEffect(() => {
    if (!pricingFlash) return;
    const t = setTimeout(() => setPricingFlash(false), 1600);
    return () => clearTimeout(t);
  }, [pricingFlash]);

  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
    loadCourses();

    // PhoneInput plugin for the enrollment-form phone field (form class "enrol").
    const piCss = document.createElement("link");
    piCss.rel = "stylesheet";
    piCss.href = "/css/phoneinput.css";
    document.head.appendChild(piCss);

    const piJs = document.createElement("script");
    piJs.src = "/js/phoneinput.js";
    piJs.async = true;
    document.body.appendChild(piJs);

    return () => {
      if (piCss.parentNode) document.head.removeChild(piCss);
      if (piJs.parentNode) document.body.removeChild(piJs);
    };
  }, []);

  // Hold the page still while a popup is up, or the background scrolls under it.
  useEffect(() => {
    document.body.style.overflow = confirmOpen || formOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [confirmOpen, formOpen]);

  const Tick = ({ green }: { green?: boolean }) => (
    <CheckCircle2 size={16} className={`enroll-tick-icon ${green ? "green" : ""}`} style={{ flexShrink: 0, marginTop: 2 }} />
  );

  return (
    <div className="enroll-page biz-page cbiz-page pgnr-page">

      <Head
        pageTitle="Generative AI Engineer Program | Rivira Technologies"
        pageDesc="Go from fundamentals to shipping real Generative AI products — LLMs, RAG, AI agents and the full enterprise AI stack. Live classes plus a complete recorded video library."
        pageKeywords="generative ai program, ai engineer course, LLM training, RAG course, AI agents training, live AI classes, recorded AI course"
      />

      {/* ── Hero ── */}
      <section className="enroll-hero">
        <div className="enroll-hero-grid" />
        <div className="enroll-hero-glow-left" />
        <div className="enroll-hero-glow-right" />
        <div className={"enroll-hero-inner pgnr-hero-inner" + (plansOn || plansLoading ? "" : " pgnr-hero-solo")}>

          {/* ── Left: the headline ── */}
          <div className="pgnr-hero-copy">
            <div className="enroll-badge">
              <Zap size={12} /> Generative AI Program · Live + Recorded
            </div>
            <h1>
              Generative AI
              <span className="gold-text">Engineer Program</span>
            </h1>
            <p>
              Go from fundamentals to shipping real Generative AI products — LLMs, RAG, AI agents and the
              full enterprise AI stack, through live classes and a recorded library you can revisit anytime.
            </p>

            <div className="enroll-hero-chips">
              <span className="enroll-hero-chip"><span className="dot" /> Live on Zoom</span>
              <span className="enroll-hero-chip"><span className="dot" /> Full recorded library</span>
              <span className="enroll-hero-chip"><span className="dot amber" /> Coders &amp; non-coders</span>
              <span className="enroll-hero-chip"><span className="dot" /> Beginner → Advanced</span>
            </div>

            {!plansOn && !plansLoading && (
              <div className="enroll-hero-btns">
                <a href={COUNSELOR_TEL} className="enroll-btn-primary enroll-btn-md">
                  Talk to a counselor
                </a>
              </div>
            )}
            {plansOn && (
            <div className="enroll-hero-btns">
              <button className="enroll-btn-primary" onClick={openConfirm}>
                <span>Enroll Now</span><ArrowRight size={18} />
              </button>
              <a
                href={`${pathname}#pgnr-pricing`}
                className="enroll-btn-outline"
                onClick={goToPricing}
              >
                See pricing &amp; plans
              </a>
            </div>
            )}
            {plansOn && (
            <div className="enroll-cta-note">Live classes · recorded videos · mentor support on every plan</div>
            )}
          </div>

          {plansLoading && <div className="pgnr-hero-buy" aria-hidden="true" />}
          {plansOn && (
          <div className="pgnr-hero-buy" id="pgnr-pricing">
            <aside className={"pgnr-buy" + (pricingFlash ? " pgnr-flash" : "")}>
              <div className="pgnr-buy-media" aria-hidden="true">
                <span>Enrollment</span>
              </div>

              <div className="pgnr-buy-body">
                <div className="pgnr-tabs" role="group" aria-label="Choose a plan">
                  {visiblePlans.map((p, k) => {
                    const on = p.key === planKey;
                    const wide = visiblePlans.length % 2 === 1 && k === visiblePlans.length - 1;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => selectPlan(p.key)}
                        className={`pgnr-tab${wide ? " wide" : ""}${on ? " on" : ""}`}
                      >
                        <span className="pgnr-tab-tier">{p.tier}</span>
                        <span className="pgnr-tab-price">{p.price} <em>{p.unit}</em></span>
                      </button>
                    );
                  })}
                </div>

                {plan ? (
                  <>
                    <h3 className="pgnr-buy-title">{plan.tier}</h3>

                    {(plan.was || plan.off) && (
                      <div className="pgnr-buy-strike">
                        {plan.was && <span className="pgnr-was">{plan.was}</span>}
                        {plan.off && <span className="pgnr-off">{plan.off}</span>}
                      </div>
                    )}

                    <div className="pgnr-price">{plan.price}</div>
                    <div className="pgnr-unit">{plan.unit}</div>
                    <div className="pgnr-note">{plan.note}</div>

                    <div className="pgnr-rule" />

                    {plan.features.map((f) => (
                      <div key={f} className="pgnr-feat">
                        <Tick green /><span>{f}</span>
                      </div>
                    ))}

                    <button
                      className="enroll-btn-primary pgnr-buy-cta"
                      onClick={openConfirm}
                    >
                      <span>Enroll Now</span><ArrowRight size={18} />
                    </button>
                  </>
                ) : (
                  <div className="pgnr-buy-empty">
                    <p className="pgnr-buy-empty-t">Pick a plan to continue</p>
                    <p className="pgnr-buy-empty-d" id="pgnr-pick-hint">
                      {visiblePlans.length === 1 ? "Choose the option above" : `Choose one of ${PLAN_COUNT_WORD} options above`} to see everything it includes.
                    </p>
                    <button
                      className="enroll-btn-primary pgnr-buy-cta"
                      disabled
                      aria-describedby="pgnr-pick-hint"
                    >
                      <span>Select a plan above</span>
                    </button>
                  </div>
                )}

                <p className="pgnr-guarantee">
                  <ShieldCheck size={14} />{" "}
                  {SUBSCRIPTIONS_ENABLED
                    ? "Secure checkout by Stripe — or submit now and pay later by email link."
                    : "Submitting doesn't charge you — we email a secure payment link."}
                </p>
              </div>
            </aside>
          </div>
          )}

        </div>
      </section>

      {/* ── Format strip overlapping the hero ── */}
      <div className="enroll-container">
        <div className="enroll-stats-strip">
          {FORMAT.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="s">
              <div className="n" style={{ display: "flex", justifyContent: "center" }}><Icon size={26} /></div>
              <div className="l"><strong>{label}</strong> · {desc}</div>
            </div>
          ))}
        </div>
      </div>

      <section id="pgnr-detail" className="enroll-section-gray" style={{ scrollMarginTop: 80 }}>
        <div className="enroll-container">
          <div className="pgnr-detail">

            {/* ── What the program is ── */}
            <div className="pgnr-info">
              <h2 className="pgnr-info-title">Generative AI Engineer Program</h2>
              <p className="pgnr-info-lede">
                The Generative AI Engineer Program takes you from fundamentals to shipping real
                Generative AI products. Across six project-based modules you'll go past demos and
                build the things that actually run in production — LLM applications, RAG pipelines
                over private data, tool-using agents on the Model Context Protocol, and the
                deployment and MLOps work that keeps them alive. Every module pairs live classes
                with a recorded library you can revisit, and ends in something you built.
              </p>

              <div className="pgnr-meta">
                <span className="pgnr-meta-item"><Sparkles size={17} /> Generative AI Program</span>
                <span className="pgnr-meta-item"><BarChart3 size={17} /> Beginner → Advanced</span>
                <span className="pgnr-meta-item"><Layers size={17} /> 6 modules</span>
                <span className="pgnr-meta-item"><Video size={17} /> Live + Recorded</span>
              </div>

              <div className="pgnr-rule-top">
                <h3 className="pgnr-info-h3">
                  Skills you'll learn
                  <span className="pgnr-info-count">{SKILLS.length} skills</span>
                </h3>
                <p className="biz-inline">
                  {SKILLS.map((s, i) => (
                    <span key={s}>
                      {i > 0 && <span className="sep"> · </span>}
                      <strong>{s}</strong>
                    </span>
                  ))}
                </p>
              </div>

              <div className="pgnr-rule-top">
                <h3 className="pgnr-info-h3">
                  Who it's for
                  <span className="pgnr-info-count pgnr-info-badge">No prerequisites</span>
                </h3>
                <p className="pgnr-info-body">
                  Both coding and no-code paths run through the same program, so you don't need a
                  development background to start. If you can use a computer confidently you can
                  follow the beginner track; if you already write code you can take the engineering
                  track through the same modules.
                </p>
                <div className="pgnr-chips">
                  {AUDIENCE.map((a) => (
                    <span key={a} className="pgnr-chip">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Access model ── */}
      <section className="enroll-section">
        <div className="enroll-container">
          <span className="enroll-section-label">Access</span>
          <h2 className="enroll-section-title">One program, two ways to learn</h2>
          <p className="enroll-section-sub">Every plan unlocks both live and recorded learning — choose the one that fits you.</p>
          <div className="biz-split cbiz-3">
            {ACCESS_MODEL.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why this program ── */}
      <section className="enroll-section-gray">
        <div className="enroll-container">
          <span className="enroll-section-label">Why This Program</span>
          <h2 className="enroll-section-title">Built to make you employable, not just certified</h2>
          <p className="enroll-section-sub">Everything is oriented around what you can build and show at the end.</p>
          <div className="biz-split cbiz-3">
            {WHY_US.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you'll learn ── */}
      <section className="enroll-section">
        <div className="enroll-container">
          <span className="enroll-section-label">Outcomes</span>
          <h2 className="enroll-section-title">What You'll Learn</h2>
          <p className="enroll-section-sub" style={{ marginBottom: 40 }}>
            Six outcomes you can point at in an interview, each backed by something you built.
          </p>
          <div className="biz-defs">
            {WHAT_YOU_LEARN.map((item) => (
              <div key={item} className="biz-def">
                <CheckCircle2 />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Curriculum ── */}
      <section className="enroll-section-gray">
        <div className="enroll-container">
          <span className="enroll-section-label">Curriculum</span>
          <h2 className="enroll-section-title">Six hands-on modules</h2>
          <p className="enroll-section-sub">Each with live sessions, recorded lessons and a project.</p>
          <div className="biz-numbered">
            {CURRICULUM.map((m) => (
              <div key={m.n} className="biz-num-item">
                <span className="biz-num">{m.n}</span>
                <div>
                  <h3>{m.title}</h3>
                  <p>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="enroll-section">
        <div className="enroll-container">
          <span className="enroll-section-label">FAQ</span>
          <h2 className="enroll-section-title">Frequently Asked Questions</h2>
          <p className="enroll-section-sub" style={{ marginBottom: 40 }}>Everything people ask before enrolling.</p>
          {FAQS.map((faq, i) => (
            <div key={faq.q} className={`enroll-faq-item ${openFaq === i ? "open" : ""}`}>
              <button
                className="enroll-faq-btn"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                aria-controls={`pgnr-faq-${i}`}
              >
                <span className="enroll-faq-q">{faq.q}</span>
                <ChevronDown size={20} className="enroll-faq-chevron" />
              </button>
              <div className="enroll-faq-body" id={`pgnr-faq-${i}`}>
                <div className="enroll-faq-inner"><p>{faq.a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="enroll-section-dark" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="enroll-container" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <h2 className="enroll-section-title light">Ready to become a Generative AI Engineer?</h2>
          <p className="enroll-section-sub light">
            Live classes and recorded videos on every plan, with hands-on projects and mentor support
            the whole way.
          </p>
          <div className="enroll-hero-btns" style={{ justifyContent: "center", marginTop: 24 }}>
            {plansOn && (
            <button className="enroll-btn-primary" onClick={openConfirm}>
              <span>Enroll Now</span><ArrowRight size={18} />
            </button>
            )}
            <a
              href={COUNSELOR_TEL}
              className={plansOn ? "enroll-btn-outline" : "enroll-btn-primary enroll-btn-md"}
            >
              Talk to a counselor
            </a>
          </div>
        </div>
      </section>

      {/* ── Step 1: confirm the plan ── */}
      {plansOn && confirmOpen && (
        <div className="enrl-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="enrl-modal enrl-modal--confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm your enrollment">
            <button className="enrl-close" onClick={() => setConfirmOpen(false)} aria-label="Close"><X size={18} /></button>

            <h3 className="enrl-title">{plan ? "Confirm your enrollment" : "Choose your plan"}</h3>
            <p className="enrl-sub">
              {plan
                ? "Review your plan, then continue to the enrollment form."
                : "Pick the access that fits you, then continue to the enrollment form."}
            </p>

            {visiblePlans.map((p) => {
              const on = p.key === planKey;
              return (
                <label
                  key={p.key}
                  className="enrl-plan"
                  style={{
                    display: "block",
                    cursor: "pointer",
                    borderColor: on ? "var(--gold)" : undefined,
                    background: on ? "rgba(31, 95, 175,0.06)" : undefined,
                    transition: "border-color .16s ease, background .16s ease",
                  }}
                >
                  <div className="enrl-plan-head">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                      <input
                        type="radio"
                        name="pgnr-plan"
                        checked={on}
                        onChange={() => setPlanKey(p.key)}
                        style={{ width: 17, height: 17, marginTop: 3, flexShrink: 0, cursor: "pointer", accentColor: "#1F5FAF" }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <strong>{p.tier}</strong>
                        <span>{p.note}</span>
                      </div>
                    </div>
                    <div className="enrl-plan-price">
                      <b>{p.price}</b>
                      <span>{p.unit}</span>
                    </div>
                  </div>
                  {on && <ul>{p.features.slice(0, 3).map((f) => <li key={f}>{f}</li>)}</ul>}
                </label>
              );
            })}

            <div className="enrl-total">
              <span>Selected plan</span>
              {plan
                ? <b>{plan.price} <small style={{ fontSize: ".7rem", fontWeight: 600 }}>{plan.unit}</small></b>
                : <b style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--text-muted)" }}>None yet</b>}
            </div>

            <div className="enrl-actions">
              <button className="enrl-btn-ghost" onClick={() => setConfirmOpen(false)}>Cancel</button>
              {/* Disabled until a plan exists: the row this creates is priced
                  from it, so there is nothing sensible to continue with. */}
              <button
                className="enrl-btn-gold"
                disabled={!plan}
                onClick={() => { if (plan) { setConfirmOpen(false); setFormOpen(true); } }}
              >
                Confirm &amp; Continue <ArrowRight size={17} />
              </button>
            </div>

            <small className="enrl-note">
              {SUBSCRIPTIONS_ENABLED
                ? <>Next you'll enter your details, then continue to secure checkout.</>
                : <>Submitting the form doesn't charge you. We review each request and email you a payment link.</>}
            </small>
          </div>
        </div>
      )}

      {/* ── Step 2: take the details ── */}
      {/* `plan &&` is the type guard as much as the UI rule — step 1 cannot be
          passed without one, and the chip below prices the request. */}
      {plansOn && formOpen && plan && (
        <div className="enrl-overlay" onClick={() => setFormOpen(false)}>
          <div className="enrl-modal enrl-modal--form" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Enrollment form">
            <button className="enrl-close" onClick={() => setFormOpen(false)} aria-label="Close"><X size={18} /></button>

            <h3 className="enrl-title">Enrollment Form</h3>

            <div className="enrl-plan-chip">
              Plan: <strong>{plan.tier}</strong> · <strong>{plan.price}</strong> {plan.unit}
            </div>

            {formSuccess ? (
              <div className="enrl-success" role="status">
                <span className="enrl-success-icon" aria-hidden="true"><CheckCircle2 size={34} /></span>
                <h4>Enrollment request received</h4>
                <p>Thank you! Your details have been submitted successfully.</p>
                <div className="enrl-success-next">
                  <strong>What happens next</strong>
                  <ol>
                    <li>Our team reviews your request and applies any available discount.</li>
                    <li>We email you a secure payment link.</li>
                    <li>Your seat is confirmed once the payment is complete.</li>
                  </ol>
                </div>
                <button className="enrl-btn-gold" onClick={() => { setFormOpen(false); setFormSuccess(""); }}>
                  Done
                </button>
              </div>
            ) : (
              <form className="enrol enrl-form" onSubmit={submitEnroll} autoComplete="off" noValidate>
                <div className="enrl-form-scroll">

                  <div className="enrl-field">
                    <label htmlFor="pgnr-name">Name <b>*</b></label>
                    <input id="pgnr-name" name="name" value={form.name} onChange={handleChange} placeholder="Enter Full Name" required />
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="pgnr-gender">Gender <b>*</b></label>
                    <select id="pgnr-gender" name="gender" value={form.gender} onChange={handleChange} required>
                      <option value="">Select Gender</option>
                      <option value="1">Male</option>
                      <option value="2">Female</option>
                      <option value="3">Prefer not to disclose</option>
                    </select>
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="phone">Contact Number <b>*</b></label>
                    <div className="enrl-phone">
                      <input
                        id="phone"
                        name="phone"
                        type="text"
                        inputMode="numeric"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                        }
                        placeholder="10-digit number"
                        required
                      />
                      <input name="fullphone" type="text" defaultValue="" style={{ display: "none" }} ref={phoneRef} />
                      <input type="hidden" name="country_code" />
                    </div>
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="pgnr-email">Email <b>*</b></label>
                    <input id="pgnr-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter Email address" required />
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="pgnr-qual">Qualification <b>*</b></label>
                    <input id="pgnr-qual" name="qualification" value={form.qualification} onChange={handleChange} placeholder="Enter Qualification Details" required />
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="pgnr-course">Course <b>*</b></label>
                    <select id="pgnr-course" name="course" value={form.course} onChange={handleChange} required>
                      <option value="">Select Course</option>
                      {COURSE_CATALOGUE.map((c) => (
                        <option key={c.slug} value={courseValue(c.name)}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="enrl-field enrl-field--full">
                    <label htmlFor="pgnr-ref">Refer By</label>
                    <input id="pgnr-ref" name="referby" value={form.referby} onChange={handleChange} placeholder="Enter Refer By Details" />
                  </div>

                  {captchaEnabled && (
                    <div className="enrl-field enrl-field--full">
                      <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
                    </div>
                  )}

                </div>

                {formError && <p className="enrl-error" role="alert">{formError}</p>}

                <div className="enrl-actions">
                  <button type="button" className="enrl-btn-ghost" onClick={() => setFormOpen(false)} disabled={formLoading || redirecting}>Cancel</button>

                  {SUBSCRIPTIONS_ENABLED && (
                    <button
                      type="submit"
                      className="enrl-btn-alt"
                      onClick={() => { payNow.current = false; }}
                      disabled={formLoading || redirecting}
                    >
                      {formLoading && !redirecting ? "Submitting…" : "Submit — pay later"}
                    </button>
                  )}

                  <button
                    type="submit"
                    className="enrl-btn-gold"
                    onClick={() => { payNow.current = true; }}
                    disabled={formLoading || redirecting}
                  >
                    {redirecting
                      ? "Opening payment page…"
                      : formLoading
                        ? "Submitting…"
                        : <>{SUBSCRIPTIONS_ENABLED ? "Submit & Continue to Payment" : "Submit Enrollment"} <ArrowRight size={17} /></>}
                  </button>
                </div>

                <small className="enrl-note">
                  {SUBSCRIPTIONS_ENABLED
                    ? <>Either way your details are saved first. <strong>Continue to Payment</strong> opens our secure Stripe checkout{plan.key === "individual" ? "" : " for your monthly subscription"}; <strong>pay later</strong> sends your request to our team, who will email you a payment link.</>
                    : <>No payment is taken now. We'll review your request and email you a secure payment link.</>}
                </small>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
