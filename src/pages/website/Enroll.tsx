import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  X,
  ChevronDown,
  ArrowRight,
  Clock,
  Star,
  Shield,
  Zap,
  Target,
  TrendingUp,
  Award,
  Globe,
  Users,
  Trophy,
  BookOpen,
  Briefcase,
} from "lucide-react";
import axios from "axios";
import { PAYMENTS_ENABLED } from "../../utils/payments";
import { PROGRAM, durationLabel } from "../../utils/program";
import { SERVER_URL } from "../../components/Includes";
import TurnstileWidget, {
  captchaEnabled,
  type TurnstileHandle,
} from "../../components/TurnstileWidget";

// ── Data ──────────────────────────────────────────────────
const WHY_US = [
  {
    icon: Target,
    title: "Gain Career Clarity",
    desc: "Personalized 1-on-1 career coaching to define your path and set goals aligned with your passions.",
  },
  {
    icon: Trophy,
    title: "Stand Out in the Job Market",
    desc: "A comprehensive job tracker and resume polish service so your application shines among competitors.",
  },
  {
    icon: Users,
    title: "Build a Professional Network",
    desc: "Connect with like-minded individuals and industry experts who open doors to new opportunities.",
  },
  {
    icon: Zap,
    title: "Develop In-Demand Skills",
    desc: "Master cutting-edge AI tools and techniques that employers are actively seeking right now.",
  },
  {
    icon: BookOpen,
    title: "Create a Compelling Portfolio",
    desc: "Build real-world projects that demonstrate your capabilities to potential employers.",
  },
  {
    icon: Globe,
    title: "Navigate the AI Landscape",
    desc: "Gain insider knowledge through monthly masterclasses with AI industry leaders.",
  },
];

const FEATURES = [
  {
    icon: Clock,
    title: "100+ Hours of Content",
    desc: "Live and recorded sessions for all skill levels.",
  },
  {
    icon: Zap,
    title: "No-Code & Code Options",
    desc: "Pick your track — no-code tools or programming.",
  },
  {
    icon: BookOpen,
    title: "Full AI Curriculum",
    desc: "ML, Deep Learning, NLP, prompting, and more.",
  },
  {
    icon: Briefcase,
    title: "Real-World Projects",
    desc: "Build and deploy actual AI apps; capstone showcase.",
  },
  {
    icon: Users,
    title: "Weekly Live Q&A",
    desc: "Real-time answers from industry expert instructors.",
  },
  {
    icon: Shield,
    title: "Downloadable Resources",
    desc: "Prompt libraries, templates, and Notion dashboards.",
  },
  {
    icon: Star,
    title: "Portfolio Development",
    desc: "GitHub, LinkedIn, and resume support included.",
  },
  {
    icon: Trophy,
    title: "Lifetime Access",
    desc: "All updates and recordings, forever.",
  },
];

// What's included with enrollment. No dollar valuations — the site previously
// asserted "$10,000+ in bonuses" and per-item prices with no basis (audit).
const INCLUDED = [
  { icon: Target, label: "1:1 Career Coaching Call" },
  { icon: Briefcase, label: "LinkedIn + GitHub Profile Setup" },
  { icon: Globe, label: "Monthly AI Expert Webinars" },
  { icon: Award, label: "AI Resume Review + Job Tracker" },
  { icon: Zap, label: "Notion AI Vault Access (100+ tools)" },
  { icon: TrendingUp, label: '"AI for Business" Mini-Course' },
];

// Detailed breakdown for the full-program ($750) card.
const CORE_INCLUDED = [
  {
    title: "Full AI Mastery Curriculum (100+ hours)",
    desc: "Python, ML/NLP, LLMs, RAG, and agents — from fundamentals to production, across two tracks.",
  },
  {
    title: "Weekly Live Q&A Sessions",
    desc: "Real-time doubt-solving with expert instructors every single week.",
  },
  {
    title: "Capstone AI Project",
    desc: "Build and deploy an end-to-end AI system you can demo live to employers.",
  },
  {
    title: "Lifetime Access to Updates",
    desc: "Keep every session recording and future course update, forever.",
  },
  {
    title: "Portfolio-Ready Projects",
    desc: "A GitHub portfolio of real, deployable projects that prove your skills.",
  },
  {
    title: "AI Templates & Tools Library",
    desc: "Prompt libraries, starter repos, and Notion dashboards to build faster.",
  },
];

// Detailed breakdown for the optional OPT / STEM OPT add-on card.
const OPT_FEATURES = [
  {
    title: "Resume Review Support",
    desc: "A line-by-line rewrite of your resume tailored to US tech and AI roles, with revisions until it's genuinely interview-ready.",
  },
  {
    title: "GitHub Projects Monitoring",
    desc: "Ongoing feedback on your repositories so your public portfolio stays active, clean, and recruiter-friendly throughout your search.",
  },
  {
    title: "Regular Training Updates",
    desc: "Curated updates on new tools, frameworks, and hiring trends so your skills and job strategy stay current after the program ends.",
  },
  {
    title: "Job Application Support",
    desc: "Guidance on where and how to apply, referrals where possible, and help tracking every application from submission to offer.",
  },
  {
    title: "OPT / STEM OPT Training Letter",
    desc: "Official training-participation documentation to support your OPT and STEM OPT work-authorization requirements.",
  },
  {
    title: "Interview & Mock Prep",
    desc: "Targeted interview preparation and realistic mock sessions focused on AI/ML technical rounds and behavioral questions.",
  },
];

const OPT_ALSO_INCLUDED = [
  "Cover Letter Templates",
  "Recruiter Outreach Scripts",
  "Behavioral Question Bank",
  "Salary Negotiation Guidance",
];

const ACCESS_OPTIONS = [
  {
    key: "all-program",
    tier: "Subscription · All Programs",
    badge: "Most Flexible",
    featured: true,
    title: "All-Program Subscription",
    desc: "Access every available Rivira Technologies program, with course updates, recordings and resources included as they land.",
    includes: [
      "All available Rivira Technologies programs",
      "Course updates as they are released",
      "Session recordings and resources",
      "Future eligible programs included",
    ],
    cta: "Contact Us for Pricing",
    to: "/contact",
  },
  {
    key: "single-program",
    tier: "Subscription · One Program",
    featured: false,
    title: "Single-Program Subscription",
    desc: "Choose one complete program and stay with it — live sessions, recordings, resources, projects and updates for that track.",
    includes: [
      "One complete program of your choice",
      "Live sessions and recordings",
      "Resources and hands-on projects",
      "Program updates while subscribed",
    ],
    cta: "View Programs",
    to: "/programs",
  },
  {
    key: "one-time",
    tier: "One-Time Purchase",
    featured: false,
    title: "One-Time Course Purchase",
    desc: "Buy a single course outright, without starting a subscription. Best if you only need one specific topic.",
    includes: [
      "One individual course",
      "No subscription required",
      "Best for a single specific topic",
      "Keep access to what you purchased",
    ],
    cta: "View Courses",
    to: "/courses",
  },
];

const FAQS = [
  {
    q: `What is the ${PROGRAM.name}, and who is it for?`,
    a: `A comprehensive ${PROGRAM.durationWeeks}-week course guiding you from AI-curious to AI-builder. Designed for early-career professionals, STEM and OPT students, non-tech learners, and career-changers.`,
  },
  {
    q: `What can I expect to learn during the ${PROGRAM.durationWeeks}-week program?`,
    a: "Python, LangChain, NLP, transformer architectures, vector databases, model fine-tuning, AI agents, cloud deployment (AWS/Azure), and a capstone project with hands-on labs.",
  },
  {
    q: "How does the mentorship aspect work?",
    a: "Weekly live Q&A sessions, a 1:1 career coaching call, and daily mentor support through our active Skool community group.",
  },
  {
    q: "Can I participate if I don't have a coding background?",
    a: "Absolutely. We offer both no-code and code learning paths so you choose the track that fits your background and goals.",
  },
  {
    q: "How does the program help with job placement?",
    a: "Resume reviews, LinkedIn and GitHub profile setup, a job tracker, placement support, and access to our AI Pro Alumni Network.",
  },
  {
    q: "What makes this different from other AI courses?",
    a: "Real projects you can demo, personalized career coaching, MCP framework training, and lifetime access to recordings.",
  },
];

// Base program price and the optional OPT add-on price (display + label only —
// the real amounts are enforced server-side by the Stripe price IDs).
const BASE_PRICE = PROGRAM.priceUSD;
const ADDON_PRICE = 200;

function EnrollBtn({
  size = "md",
  full = false,
  addon = false,
  onClick,
}: {
  size?: "sm" | "md" | "lg";
  full?: boolean;
  addon?: boolean;
  onClick?: () => void;
}) {
  const cls =
    "enroll-btn-primary enroll-btn-" + size + (full ? " enroll-btn-full" : "");

  if (!PAYMENTS_ENABLED) {
    return (
      <Link to="/contact" className={cls}>
        <span>Talk to us about enrolling</span>
        <ArrowRight size={18} />
      </Link>
    );
  }
  const total = addon ? BASE_PRICE + ADDON_PRICE : BASE_PRICE;
  return (
    <div className={"enroll-btn-wrap" + (full ? " enroll-btn-wrap-full" : "")}>
      <button onClick={onClick} className={cls}>
        <span>Enroll Now at ${total}</span>
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

const decodeHtml = (str: string) => {
  const el = document.createElement("textarea");
  el.innerHTML = str ?? "";
  return el.value;
};

// ── Main ──────────────────────────────────────────────────
export default function Enroll() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Page-level OPT add-on selection — shared by every Enroll button so the
  // choice on the pricing card carries into whichever CTA the user clicks.
  const [addon, setAddon] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  // a student's referral link (/enroll?r=<code>): who referred them; Refer By is
  // filled with their email and can't be changed (the API credits the code)
  const [referrer, setReferrer] = useState<{ code: string; name: string; email: string } | null>(null);

  const [courses, setCourses] = useState<any[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    name: "",
    gender: "",
    phone: "",
    email: "",
    qualification: "",
    course: "",
    referby: "",
  });
  const phoneRef = useRef<HTMLInputElement>(null);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // Set between saving the enrolment and opening the payment page.
  const [redirecting, setRedirecting] = useState(false);

  // Every write endpoint on this API checks a per-session key/token/aut triple;
  // it has to be fetched fresh rather than cached, or the second submit fails.
  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const loadCourses = async () => {
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/courses/get",
        { status: "1", key: s.key, token: s.token, aut: s.aut },
        { withCredentials: true },
      );
      if (res.data.success) setCourses(res.data.data || []);
    } catch {
      /* fall through — courseValue() then submits the title instead of an id */
    }
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const firstInvalid = (): { id: string; message: string } | null => {
    const checks: Array<[string, boolean, string]> = [
      [
        "enrl-name",
        form.name.trim().length >= 3,
        "Please enter your full name (at least 3 characters).",
      ],
      ["enrl-gender", form.gender !== "", "Please select a gender."],
      [
        "phone",
        form.phone.length === 10,
        "Please enter your 10-digit contact number.",
      ],
      [
        "enrl-email",
        /^\S+@\S+\.\S+$/.test(form.email),
        "Please enter a valid email address.",
      ],
      [
        "enrl-qual",
        form.qualification.trim().length >= 2,
        "Please enter your qualification.",
      ],
      ["enrl-course", form.course !== "", "Please select a course."],
    ];
    const bad = checks.find(([, ok]) => !ok);
    return bad ? { id: bad[0], message: bad[2] } : null;
  };

  const payNow = useRef(true);

  const submitEnroll = async (e: any) => {
    e.preventDefault();
    const wantsToPayNow = payNow.current;
    payNow.current = true; // reset for the next attempt
    setFormSuccess("");
    setFormError("");

    const bad = firstInvalid();
    if (bad) {
      setFormError(bad.message);
      const el = document.getElementById(bad.id);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      // preventScroll: focus() would otherwise fight the smooth scroll above.
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
          ref: referrer?.code || "",
          captcha: captchaToken,
          // Recorded against the request so the reviewing admin sees which plan
          // was chosen before they quote a price.
          addon: addon ? "OPT / STEM OPT" : "",
          plan: addon
            ? `Full Program + OPT/STEM OPT ($${BASE_PRICE + ADDON_PRICE})`
            : `Full Program ($${BASE_PRICE})`,
          fees: addon ? BASE_PRICE + ADDON_PRICE : BASE_PRICE,
          currency: "USD",
          key: s.key,
          token: s.token,
          aut: s.aut,
        },
        { withCredentials: true },
      );

      if (!res.data.success) {
        setFormError(res.data.message || "We couldn't submit your enrollment.");
        return;
      }

      // Continue to this app's payment page (/payment?t=<req_id> → Stripe).
      if (PAYMENTS_ENABLED && wantsToPayNow && res.data.req_id) {
        setRedirecting(true);
        navigate(`/payment?t=${res.data.req_id}`);
        return;
      }

      setFormSuccess(
        res.data.message || "Your enrollment request has been received.",
      );
      setForm({
        name: "",
        gender: "",
        phone: "",
        email: "",
        qualification: "",
        course: "",
        referby: referrer?.email || "",
      });
    } catch {
      setFormError(
        "We couldn't reach the enrollment service. Please try again.",
      );
    } finally {
      setFormLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const openConfirm = () => {
    setFormSuccess("");
    setFormError("");
    setConfirmOpen(true);
  };

  // /enroll?r=<code>: a student's referral link opens the enrollment (Full
  // Program; the add-on stays optional) with Refer By filled in. A wrong or old
  // code leaves the page as it is.
  // /enroll?r=open, ?r=now or ?r=register: straight to the enrollment form
  // (Full Program; referral codes are always 6 characters, so no clash).
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("r") || "";
    if (/^(open|now|register)$/i.test(r)) {
      setFormSuccess("");
      setFormError("");
      setFormOpen(true);
      return;
    }
    if (!/^[A-Za-z2-9]{6}$/.test(r)) return;
    let live = true;
    axios
      .get(SERVER_URL + "api/public/referrer", { params: { r } })
      .then((res) => {
        if (!live || !res.data?.success || !res.data.email) return;
        const who = { code: String(res.data.code), name: String(res.data.name || ""), email: String(res.data.email) };
        setReferrer(who);
        setForm((f) => ({ ...f, referby: who.email }));
        openConfirm();
      })
      .catch(() => {
        /* the page works as usual */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadCourses();

    // PhoneInput plugin for the enrollment-form phone field. Its MutationObserver
    // initialises the #phone inside the popup form (class "enrol") when it mounts.
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
    return () => {
      document.body.style.overflow = "";
    };
  }, [confirmOpen, formOpen]);

  const Check = ({ green }: { green?: boolean }) => (
    <CheckCircle2
      size={16}
      className={`enroll-tick-icon ${green ? "green" : ""}`}
      style={{ flexShrink: 0, marginTop: 2 }}
    />
  );

  return (
    <div className="enroll-page">
      {/* ── Hero ── */}
      <section className="enroll-hero">
        <div className="enroll-hero-grid" />
        <div className="enroll-hero-glow-left" />
        <div className="enroll-hero-glow-right" />
        <div className="enroll-hero-inner">
          <div className="enroll-badge">
            <Zap size={12} /> {durationLabel} Comprehensive Program
          </div>
          <h1>
            Master AI Skills
            <span className="gold-text">Without Any Coding Experience</span>
          </h1>
          <p>
            Turn your bootcamp momentum into real AI career growth — designed
            for early-career professionals, STEM students, and career-changers.
          </p>
          {/* Meta chips (Course-Plan hero style) */}
          <div className="enroll-hero-chips">
            <span className="enroll-hero-chip">
              <span className="dot" /> {durationLabel}
            </span>
            <span className="enroll-hero-chip">
              <span className="dot" /> 100+ hours of content
            </span>
            <span className="enroll-hero-chip">
              <span className="dot amber" /> Coders &amp; non-coders
            </span>
            <span className="enroll-hero-chip">
              <span className="dot" /> Live on Zoom
            </span>
          </div>

          <div className="enroll-hero-btns">
            <EnrollBtn size="lg" addon={addon} onClick={openConfirm} />
            {/* Full curriculum now lives on the Course Plan page */}
            <Link to="/course-plan" className="enroll-btn-outline">
              Explore Curriculum
            </Link>
          </div>
          <div className="enroll-cta-note">
            Small cohorts · mentor feedback · limited seats
          </div>
        </div>
      </section>

      {/* ── Stats strip — white cards overlapping the hero (Course-Plan style) ── */}
      <div className="enroll-container">
        <div className="enroll-stats-strip">
          {[
            { num: `${PROGRAM.durationWeeks}`, label: "Weeks Program" },
            { num: "100+", label: "Hours of Content" },
            { num: "2", label: "Learning Tracks" },
            { num: "1", label: "Capstone Project" },
          ].map(({ num, label }) => (
            <div key={label} className="s">
              <div className="n">{num}</div>
              <div className="l">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── What You'll Get ── */}
      <section className="enroll-section">
        <div className="enroll-container">
          <span className="enroll-section-label">Program</span>
          <h2 className="enroll-section-title">What You'll Get</h2>
          <p className="enroll-section-sub" style={{ marginBottom: 40 }}>
            Everything you need to go from curious to career-ready in{" "}
            {PROGRAM.durationWeeks} weeks.
          </p>
          <div className="enroll-features-grid">
            <div className="enroll-feature-card">
              <h3>Core Program</h3>
              {[
                "Full AI Mastery Curriculum (100+ hours)",
                "Capstone AI Project with deployment",
                "Model Context Protocol (MCP) Framework Training",
                "Weekly Live Q&A / Doubt Solving Sessions",
              ].map((item) => (
                <div key={item} className="enroll-check-item">
                  <div className="enroll-check-icon">
                    <CheckCircle2 size={11} strokeWidth={3} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="enroll-feature-card">
              <h3>Core Program Value</h3>
              {[
                "Evaluation & Development Toolkit",
                "Lifetime Access to Updates & Recordings",
                "Portfolio-Ready Projects & GitHub Support",
                "Early Access to Structured LMS",
              ].map((item) => (
                <div key={item} className="enroll-check-item">
                  <div className="enroll-check-icon">
                    <CheckCircle2 size={11} strokeWidth={3} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section className="enroll-section-gray">
        <div className="enroll-container">
          <span className="enroll-section-label">Why Choose Us</span>
          <h2 className="enroll-section-title">
            Transform Your Future With Our Program
          </h2>
          <p className="enroll-section-sub">
            Are you ready to step into a world where your career meets the power
            of artificial intelligence?
          </p>
          <div className="enroll-why-grid">
            {WHY_US.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="enroll-why-card">
                <div className="enroll-icon-wrap">
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Program Features ── */}
      <section className="enroll-section">
        <div className="enroll-container">
          <span className="enroll-section-label">Program Features</span>
          <h2 className="enroll-section-title">
            Everything You Need to Master AI
          </h2>
          <p className="enroll-section-sub">
            Tools, resources, and support to succeed in the AI field.
          </p>
          <div className="enroll-prog-grid">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="enroll-prog-card">
                <div className="enroll-prog-icon">
                  <Icon size={18} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CHOOSE YOUR ACCESS OPTION ================= */}
      <section
        id="access-options"
        className="enroll-section-dark enroll-access-section"
      >
        <div
          className="enroll-container"
          style={{ position: "relative", zIndex: 1 }}
        >
          <span className="enroll-section-label">Access Options</span>
          <h2 className="enroll-section-title light">
            Choose Your Access Option
          </h2>
          <p className="enroll-section-sub light">
            Three ways to learn with us — subscribe across every program, focus
            on one, or buy a single course outright.
          </p>

          <div className="enroll-access-grid">
            {ACCESS_OPTIONS.map((opt) => (
              <div
                key={opt.key}
                className={
                  "enroll-price-card enroll-access-card" +
                  (opt.featured ? " featured" : "")
                }
              >
                {opt.badge && (
                  <div className="enroll-price-badge">{opt.badge}</div>
                )}

                <div className="enroll-price-tier">{opt.tier}</div>
                <h3 className="enroll-access-title">{opt.title}</h3>
                <p className="enroll-access-desc">{opt.desc}</p>

                <div className="enroll-access-price">
                  Contact Us for Pricing
                </div>

                <div
                  className="enroll-price-divider"
                  style={{ margin: "18px 0" }}
                />

                <div className="enroll-price-section-label">
                  What&apos;s included
                </div>
                {opt.includes.map((item) => (
                  <div key={item} className="enroll-price-item">
                    <Check green={opt.featured} />
                    <span>{item}</span>
                  </div>
                ))}

                <div className="enroll-access-cta">
                  <Link
                    to={opt.to}
                    className={
                      "enroll-btn-md " +
                      (opt.featured
                        ? "enroll-btn-primary"
                        : "enroll-btn-outline")
                    }
                  >
                    {opt.cta} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="enroll-access-foot">
            Looking for the {PROGRAM.name}? Its full price and everything it
            includes are just below.
          </p>
        </div>
      </section>
      {/* ── Pricing ── */}
      <section
        className="enroll-section-dark"
        style={{ paddingTop: 44, paddingBottom: 28 }}
      >
        <div
          className="enroll-container"
          style={{ position: "relative", zIndex: 1 }}
        >
          <span className="enroll-section-label">Enrollment</span>
          <h2 className="enroll-section-title light">
            Invest in Your AI Future
          </h2>
          <p className="enroll-section-sub light">
            One transparent price for the full program and everything included.
          </p>

          {/* Full-program price + optional add-on, side by side */}
          <div className="enroll-pricing-grid enroll-pricing-2col">
            <div className="enroll-price-card featured">
              <div className="enroll-price-tier">Full Program</div>
              <div className="enroll-price-amount">${BASE_PRICE}</div>
              <div className="enroll-price-inr">or {PROGRAM.priceINRLabel}</div>
              <div
                className="enroll-price-divider"
                style={{ margin: "20px 0" }}
              />

              <div className="enroll-price-section-label">Included</div>
              {CORE_INCLUDED.map((item) => (
                <div key={item.title} className="enroll-price-feat">
                  <Check />
                  <div>
                    <span className="enroll-price-feat-title">
                      {item.title}
                    </span>
                    <span className="enroll-price-feat-desc">{item.desc}</span>
                  </div>
                </div>
              ))}

              <div
                className="enroll-price-section-label"
                style={{ marginTop: 20 }}
              >
                Also Included
              </div>
              {[
                "1:1 Career Coaching Call",
                "LinkedIn + GitHub Setup",
                "AI Resume Review",
                "Placement Support",
                "AI Hackathon Invitation",
                '"AI for Business" Mini-Course',
              ].map((item) => (
                <div key={item} className="enroll-price-item">
                  <Check green />
                  <span>{item}</span>
                </div>
              ))}

              <div className="enroll-price-cta">
                <EnrollBtn size="md" full addon={addon} onClick={openConfirm} />
              </div>
              {!PAYMENTS_ENABLED && (
                <div className="enroll-price-trust">
                  Online checkout is opening soon — reach out and we'll help you
                  enroll.
                </div>
              )}
            </div>

            <div className="enroll-price-card featured">
              <div className="enroll-price-tier">
                Optional Add-On · OPT &amp; STEM OPT
              </div>
              <div
                className="enroll-price-divider"
                style={{ margin: "16px 0 20px" }}
              />

              <div className="enroll-price-section-label">Included</div>
              {OPT_FEATURES.map((f) => (
                <div key={f.title} className="enroll-price-feat">
                  <Check />
                  <div>
                    <span className="enroll-price-feat-title">{f.title}</span>
                    <span className="enroll-price-feat-desc">{f.desc}</span>
                  </div>
                </div>
              ))}

              <div
                className="enroll-price-section-label"
                style={{ marginTop: 20 }}
              >
                Also Included
              </div>
              {OPT_ALSO_INCLUDED.map((item) => (
                <div key={item} className="enroll-price-item">
                  <Check green />
                  <span>{item}</span>
                </div>
              ))}

              {/* Price + opt-in, pinned together to the foot of the card. */}
              <div className="enroll-price-addon-foot">
                <div className="enroll-price-amount">${ADDON_PRICE}</div>
                <div className="enroll-price-inr">
                  One-Time · Training + Placement Support Bundle
                </div>
                <div className="enroll-price-cta">
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: addon ? "#0B3D7A" : "#334155",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addon}
                      onChange={(e) => setAddon(e.target.checked)}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                        accentColor: "#1F5FAF",
                      }}
                    />
                    <span>
                      {addon
                        ? "Added to your enrollment"
                        : "Add to my enrollment"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What's Included ── */}
      <section className="enroll-bonuses">
        <div className="enroll-container">
          <span className="enroll-section-label">Included With Enrollment</span>
          <h2 className="enroll-section-title light">
            Support Beyond the Curriculum
          </h2>
          <p className="enroll-section-sub light">
            Enroll and get this coaching and career support alongside the core
            program.
          </p>
          <div className="enroll-bonus-grid">
            {INCLUDED.map(({ icon: Icon, label }) => (
              <div key={label} className="enroll-bonus-card">
                <div className="enroll-bonus-icon">
                  <Icon size={20} />
                </div>
                <h3>{label}</h3>
                <CheckCircle2 size={18} className="enroll-bonus-check" />
              </div>
            ))}
          </div>
          <div className="enroll-bonus-extra">
            <h3>Also Included</h3>
            <div className="enroll-bonus-extra-grid">
              {[
                "Access to AI Pro Alumni Network",
                "Placement Support + OPT/STEM OPT Training Letter",
                "Invite to AI Hackathon & Project Showcase",
                "Discount on Future Courses",
                "Certificate of Completion",
                "Ongoing Mentorship Support",
              ].map((b) => (
                <div key={b} className="enroll-bonus-extra-item">
                  <CheckCircle2 size={14} />
                  {b}
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <EnrollBtn size="lg" addon={addon} onClick={openConfirm} />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="enroll-section">
        <div className="enroll-container-sm">
          <span className="enroll-section-label">Common Questions</span>
          <h2 className="enroll-section-title">Frequently Asked Questions</h2>
          <p className="enroll-section-sub">
            Still have questions? Find answers to the most common ones below.
          </p>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className={`enroll-faq-item ${openFaq === i ? "open" : ""}`}
            >
              <button
                className="enroll-faq-btn"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                aria-controls={`enroll-faq-${i}`}
              >
                <span className="enroll-faq-q">{faq.q}</span>
                <ChevronDown size={20} className="enroll-faq-chevron" />
              </button>
              <div className="enroll-faq-body" id={`enroll-faq-${i}`}>
                <div className="enroll-faq-inner">
                  <p>{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="enroll-cta-section">
        <div className="enroll-cta-glow" />
        <div className="enroll-cta-inner">
          <h2>Your Future in AI Starts Now</h2>
          <p>
            Step confidently into your new career with a program built around
            real projects and real mentorship.
          </p>
          <div className="enroll-cta-cols" style={{ justifyContent: "center" }}>
            <div className="enroll-cta-col pros">
              <h3>Imagine 6 Months From Now</h3>
              {[
                "You're applying AI skills in a real tech role",
                "Your professional network is opening new doors",
                "You're confidently building AI solutions",
                "Your career transformation is underway",
              ].map((item) => (
                <div key={item} className="enroll-cta-list-item">
                  <CheckCircle2 size={16} style={{ color: "#5AA9F0" }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="enroll-cta-btns">
            <EnrollBtn size="lg" addon={addon} onClick={openConfirm} />
          </div>
          <div className="enroll-signature">
            "Your future in AI is waiting. Take this first step, and we'll guide
            you the rest of the way."
            <br />
            <strong>— The Rivira Technologies Team</strong>
          </div>
        </div>
      </section>

      {/* ── Step 1: confirm the plan ── */}
      {confirmOpen && (
        <div className="enrl-overlay" onClick={() => setConfirmOpen(false)}>
          <div
            className="enrl-modal enrl-modal--confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm your enrollment"
          >
            <button
              className="enrl-close"
              onClick={() => setConfirmOpen(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <h3 className="enrl-title">Confirm your enrollment</h3>
            <p className="enrl-sub">
              Review your selection, then continue to the enrollment form.
            </p>

            <div className="enrl-plan">
              <div className="enrl-plan-head">
                <div>
                  <strong>Full Program</strong>
                  <span>{PROGRAM.name}</span>
                </div>
                <div className="enrl-plan-price">
                  <b>${BASE_PRICE}</b>
                  <span>or {PROGRAM.priceINRLabel}</span>
                </div>
              </div>
              <ul>
                {CORE_INCLUDED.slice(0, 4).map((c) => (
                  <li key={c.title}>{c.title}</li>
                ))}
              </ul>
            </div>

            <label
              className="enrl-plan enrl-plan--addon"
              style={{
                display: "block",
                cursor: "pointer",
                borderColor: addon ? "var(--gold)" : undefined,
                background: addon ? "rgba(31, 95, 175,0.06)" : undefined,
                transition: "border-color .16s ease, background .16s ease",
              }}
            >
              <div className="enrl-plan-head">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={addon}
                    onChange={(e) => setAddon(e.target.checked)}
                    style={{
                      width: 17,
                      height: 17,
                      marginTop: 3,
                      flexShrink: 0,
                      cursor: "pointer",
                      accentColor: "#1F5FAF",
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <strong>Optional Add-On · OPT &amp; STEM OPT</strong>
                    <span>Training + Placement Support Bundle</span>
                  </div>
                </div>
                <div className="enrl-plan-price">
                  <b>+${ADDON_PRICE}</b>
                  <span
                    style={{
                      color: addon ? "#0B3D7A" : undefined,
                      fontWeight: addon ? 700 : undefined,
                    }}
                  >
                    {addon ? "Added" : "Optional"}
                  </span>
                </div>
              </div>
              <ul>
                {OPT_FEATURES.slice(0, 3).map((o) => (
                  <li key={o.title}>{o.title}</li>
                ))}
              </ul>
            </label>

            <div className="enrl-total">
              <span>Total</span>
              <b>${addon ? BASE_PRICE + ADDON_PRICE : BASE_PRICE}</b>
            </div>

            <div className="enrl-actions">
              <button
                className="enrl-btn-ghost"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="enrl-btn-gold"
                onClick={() => {
                  setConfirmOpen(false);
                  setFormOpen(true);
                }}
              >
                Confirm &amp; Continue <ArrowRight size={17} />
              </button>
            </div>

            <small className="enrl-note">
              {PAYMENTS_ENABLED ? (
                <>
                  Next you'll enter your details, then continue to secure
                  checkout.
                </>
              ) : (
                <>
                  Submitting the form doesn't charge you. We review each request
                  and email you a payment link.
                </>
              )}
            </small>
          </div>
        </div>
      )}

      {/* ── Step 2: take the details ── */}
      {formOpen && (
        <div className="enrl-overlay" onClick={() => setFormOpen(false)}>
          <div
            className="enrl-modal enrl-modal--form"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Enrollment form"
          >
            <button
              className="enrl-close"
              onClick={() => setFormOpen(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <h3 className="enrl-title">Enrollment Form</h3>

            <div className="enrl-plan-chip">
              Plan: <strong>Full Program (${BASE_PRICE})</strong>
              {addon && (
                <>
                  {" "}
                  + <strong>OPT / STEM OPT (${ADDON_PRICE})</strong>
                </>
              )}
              {" · "}Total{" "}
              <strong>${addon ? BASE_PRICE + ADDON_PRICE : BASE_PRICE}</strong>
            </div>

            {formSuccess ? (
              <div className="enrl-success" role="status">
                <span className="enrl-success-icon" aria-hidden="true">
                  <CheckCircle2 size={34} />
                </span>
                <h4>Enrollment request received</h4>
                <p>Thank you! Your details have been submitted successfully.</p>
                <div className="enrl-success-next">
                  <strong>What happens next</strong>
                  <ol>
                    <li>
                      Our team reviews your request and applies any available
                      discount.
                    </li>
                    <li>We email you a secure payment link.</li>
                    <li>
                      Your seat is confirmed once the payment is complete.
                    </li>
                  </ol>
                </div>
                <button
                  className="enrl-btn-gold"
                  onClick={() => {
                    setFormOpen(false);
                    setFormSuccess("");
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                className="enrol enrl-form"
                onSubmit={submitEnroll}
                autoComplete="off"
                noValidate
              >
                <div className="enrl-form-scroll">
                  <div className="enrl-field">
                    <label htmlFor="enrl-name">
                      Name <b>*</b>
                    </label>
                    <input
                      id="enrl-name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter Full Name"
                      required
                    />
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="enrl-gender">
                      Gender <b>*</b>
                    </label>
                    <select
                      id="enrl-gender"
                      name="gender"
                      value={form.gender}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="1">Male</option>
                      <option value="2">Female</option>
                      <option value="3">Prefer not to disclose</option>
                    </select>
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="phone">
                      Contact Number <b>*</b>
                    </label>
                    <div className="enrl-phone">
                      <input
                        id="phone"
                        name="phone"
                        type="text"
                        inputMode="numeric"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            phone: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 10),
                          }))
                        }
                        placeholder="10-digit number"
                        required
                      />
                      <input
                        name="fullphone"
                        type="text"
                        defaultValue=""
                        style={{ display: "none" }}
                        ref={phoneRef}
                      />
                      <input type="hidden" name="country_code" />
                    </div>
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="enrl-email">
                      Email <b>*</b>
                    </label>
                    <input
                      id="enrl-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Enter Email address"
                      required
                    />
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="enrl-qual">
                      Qualification <b>*</b>
                    </label>
                    <input
                      id="enrl-qual"
                      name="qualification"
                      value={form.qualification}
                      onChange={handleChange}
                      placeholder="Enter Qualification Details"
                      required
                    />
                  </div>

                  <div className="enrl-field">
                    <label htmlFor="enrl-course">
                      Course <b>*</b>
                    </label>
                    <select
                      id="enrl-course"
                      name="course"
                      value={form.course}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Course</option>
                      {courses.map((c) => (
                        <option key={c.req_id} value={c.req_id}>
                          {decodeHtml(c.title)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="enrl-field enrl-field--full">
                    <label htmlFor="enrl-ref">Refer By</label>
                    <input
                      id="enrl-ref"
                      name="referby"
                      value={form.referby}
                      onChange={handleChange}
                      placeholder="Enter Refer By Details"
                      readOnly={!!referrer}
                      aria-readonly={!!referrer}
                      style={referrer ? { background: "#f8fafc", cursor: "default" } : undefined}
                    />
                    {referrer && (
                      <small style={{ display: "block", marginTop: 6, color: "#64748b", fontSize: 13 }}>
                        Referred by <b style={{ color: "#1e293b" }}>{referrer.name || referrer.email}</b>
                      </small>
                    )}
                  </div>

                  {captchaEnabled && (
                    <div className="enrl-field enrl-field--full">
                      <TurnstileWidget
                        ref={turnstileRef}
                        onToken={setCaptchaToken}
                      />
                    </div>
                  )}
                </div>

                {formError && (
                  <p className="enrl-error" role="alert">
                    {formError}
                  </p>
                )}

                <div className="enrl-actions">
                  <button
                    type="button"
                    className="enrl-btn-ghost"
                    onClick={() => setFormOpen(false)}
                    disabled={formLoading || redirecting}
                  >
                    Cancel
                  </button>

                  {PAYMENTS_ENABLED && (
                    <button
                      type="submit"
                      className="enrl-btn-alt"
                      onClick={() => {
                        payNow.current = false;
                      }}
                      disabled={formLoading || redirecting}
                    >
                      {formLoading && !redirecting
                        ? "Submitting…"
                        : "Submit — pay later"}
                    </button>
                  )}

                  <button
                    type="submit"
                    className="enrl-btn-gold"
                    onClick={() => {
                      payNow.current = true;
                    }}
                    disabled={formLoading || redirecting}
                  >
                    {redirecting ? (
                      "Opening payment page…"
                    ) : formLoading ? (
                      "Submitting…"
                    ) : (
                      <>
                        {PAYMENTS_ENABLED
                          ? "Submit & Continue to Payment"
                          : "Submit Enrollment"}{" "}
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </div>

                <small className="enrl-note">
                  {PAYMENTS_ENABLED ? (
                    <>
                      Either way your details are saved first.{" "}
                      <strong>Continue to Payment</strong> takes you to our
                      secure Stripe payment page now; <strong>pay later</strong>{" "}
                      sends your request to our team, who will review it and
                      email you a payment link.
                    </>
                  ) : (
                    <>
                      No payment is taken now. We'll review your request and
                      email you a payment link.
                    </>
                  )}
                </small>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
