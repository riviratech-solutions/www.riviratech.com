import { useEffect, useRef, useState, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { PLANS, PLANS_PUBLISHED, type PlanKey } from "../../utils/subscriptions";
import { DEFAULT_LOGOS, logoUrl, type PartnerLogo } from "../../components/TrustedBy";
import InquiryModal from "../../components/InquiryModal";
import { VideoModal, Counter } from "../../components/RiviraUI";
import { anim, useRiviraReveal } from "../../utils/riviraReveal";
import {
  ArrowRight, Sparkles, GraduationCap, Bot, Layers, Rocket, Users, Brain, MessageSquare, Zap, Target,
  ChevronLeft, ChevronRight, Check, CheckCircle2, Play, PlayCircle, Video, Code2, Star, Plus, Minus, Cpu, Server,
  Presentation, CalendarDays, Compass, Award, Cloud, Monitor, TrendingUp, ShieldCheck, BarChart3, X,
} from "lucide-react";
import { Head, SERVER_URL } from "../../components/Includes";
import { offeredFromResponse, saveOfferedPlans } from "../../utils/offeredPlans";
import { siteFetch } from "../../utils/siteCache";

/* Home page — the 2026-11 indigo / violet redesign (styles: public/css/rivira-design.css, "HOME (rx-)"). */

// ─── DATA ────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Do I need coding experience to join?",
    a: "No. We have programs designed for complete beginners (AI for Non-Coders, GenAI for Business, AI for Kids) as well as intermediate and advanced tracks for developers and data professionals.",
  },
  {
    q: "Are the classes live or recorded?",
    a: "Both. Every plan includes live instructor-led sessions and full recorded video access so you can rewatch any class at your own pace.",
  },
  {
    q: "How long does each program take?",
    a: "Programs range from a weekend workshop to 8-week tracks, depending on the course. Corporate training schedules are fully customised to your team.",
  },
  {
    q: "Do I get a certificate after completing?",
    a: "Yes. Every learner who completes the program requirements receives a Rivira Technologies completion certificate you can share on LinkedIn.",
  },
  {
    q: "Can I enrol in more than one program?",
    a: "Absolutely. The All-Access Bundle gives you every program for one monthly price. You can switch between tracks at any time.",
  },
  {
    q: "Is there mentorship or 1:1 support available?",
    a: "Yes. Monthly subscription and individual course plans include 1:1 mentor support. We reply to all questions within one business day.",
  },
];

// Plan slider types & fallbacks (same as before)
type PlanSlide = {
  id: number | string; plan: PlanKey; tag: string; title: string; description: string; points: string[];
  cta: string; link_text: string; price: string; unit: string; badge: string; theme: string;
};
type PlanSection = { eyebrow: string; title: string; subtitle: string; autoplay: number; status: string };

const FALLBACK_SECTION: PlanSection = {
  eyebrow: "Flexible Access",
  title: "Learn your way — subscribe or own it",
  subtitle: "Live classes and recorded videos on every plan. Choose the access that fits you.",
  autoplay: 6,
  status: "1",
};
const FALLBACK_SLIDES: PlanSlide[] = [
  {
    id: "bundle", plan: "bundle", tag: "Bundle Subscription", title: "All-Access Bundle",
    description: "Unlock every Rivira Technologies program for one monthly price — full recorded video library, with new batches through the year.",
    points: ["All programs & tracks", "Recorded classes", "Cancel anytime"],
    cta: "Explore the Bundle", unit: "/ month", theme: "a",
  },
  {
    id: "monthly", plan: "monthly", tag: "Monthly Subscription", title: "One Program, Month-to-Month",
    description: "Pick a single program and pay month to month. Attend live sessions and rewatch recorded videos anytime while you're subscribed.",
    points: ["One program of your choice", "Live + recorded access", "1:1 mentor support"],
    cta: "Start Monthly", unit: "/ month", theme: "b",
  },
  {
    id: "individual", plan: "individual", tag: "Individual Course", title: "Lifetime Individual Access",
    description: "Prefer to pay once? Get lifetime access to a single program's recorded library, hands-on projects and a completion certificate.",
    points: ["Pay once, learn forever", "Lifetime recorded access", "Personalised project reviews"],
    cta: "Get Lifetime Access", unit: "/ one-time", theme: "c",
  },
].map((x) => ({
  ...x, plan: x.plan as PlanKey, link_text: "View program details →", badge: "Live + Recorded",
  price: PLANS.find((p) => p.key === x.plan)?.price ?? "",
}));

const DEFAULT_VIDEOS = [
  "https://www.youtube.com/embed/iDnmleQNri4",
  "https://www.youtube.com/embed/XSIanwFlNKo",
  "https://www.youtube.com/embed/_Z3XBALZY4Y",
  "https://www.youtube.com/embed/-o4qyjMe5Lc",
  "https://www.youtube.com/embed/m0DsQ9qp5-I",
];

// Shown when the admin testimonials can't be loaded: learner stories as
// published on riviratech.com (no ratings there, so no stars are drawn).
const LV_FALLBACK: { id: number; name: string; role: string; feedback: string; rating?: number }[] = [
  {
    id: 1,
    name: "Anusha Reddy",
    role: "QA Engineer - AI engineer",
    feedback:
      "I was working as a QA Engineer and wanted to shift into something more future-oriented like Generative AI. At Rivira Tech they explained LLMs, RAG concepts and Python implementation in a very practical way. The mentors were supportive and guided whenever I got stuck.",
  },
  {
    id: 2,
    name: "Harish Kumar",
    role: "Business Analyst - Data Scientist",
    feedback:
      "As a Business Analyst, I was curious how Generative AI can be used in reporting and automation. Rivira Tech helped me understand LLMs, prompt design and data workflows in simple real business scenarios.",
  },
  {
    id: 3,
    name: "Meghana",
    role: "Operations Executive - ML engineer",
    feedback:
      "I come from operations background and didn’t have much exposure to AI earlier. Rivira Tech explained AI basics, LLMs and automation tools in a very simple way. Even without a technical background I could follow the sessions.",
  },
  {
    id: 4,
    name: "Sravani P",
    role: "Tech Support Specialist - GenAI Engineer",
    feedback:
      "I was working in tech support and wanted to explore AI but didn’t know where to begin. Rivira Tech started from basics and gradually introduced LLMs and real AI implementations.",
  },
  {
    id: 5,
    name: "J Rajesh",
    role: "Data Analyst",
    feedback:
      "As a Data Analyst, I already worked with data but didn’t know much about Generative AI. The hands-on approach helped me understand how LLM workflows can enhance analytics.",
  },
  {
    id: 6,
    name: "Ravi Shanker",
    role: "Customer Support Associate - ML Engineer",
    feedback:
      "I am from customer support background and initially nervous about learning AI. Rivira Tech explained AI and LLM concepts with practical examples instead of complex theory.",
  },
];

const PROGRAM_LINK = "/program/generative-ai-engineer";

// ─── NEW HOME DATA ───────────────────────────────────────────────────────────

const PROGRAM_CARDS = [
  { icon: Cpu, title: "AI for Non-Coders", desc: "Start your AI journey without a technical background.", to: "/ai-for-non-coders" },
  { icon: Code2, title: "Generative AI Development", desc: "Build real GenAI applications with modern tools.", to: "/ai-for-coders" },
  { icon: Bot, title: "AI Agents & Automation", desc: "Create intelligent agents that automate real tasks.", to: "/ai-stack" },
  { icon: Server, title: "AI Solutions Buildout", desc: "Design and build end-to-end AI solutions.", to: "/business" },
  { icon: Presentation, title: "AI for Business", desc: "Apply AI to solve real business challenges.", to: "/genai-for-business" },
];

const SOLUTION_TABS: Record<string, { icon: typeof Cpu; title: string; desc: string; to: string }[]> = {
  "For Learners": [
    { icon: GraduationCap, title: "AI Training Programs", desc: "Structured, hands-on programs for real skills.", to: "/courses" },
    { icon: CalendarDays, title: "Free AI Workshops", desc: "Try a live session before you commit.", to: "/workshop" },
    { icon: Compass, title: "Career Guidance", desc: "Mentoring, portfolio and interview support.", to: "/contact" },
    { icon: Award, title: "Certificates", desc: "Proof of the projects you've completed.", to: "/certificate-request" },
  ],
  "For Teams": [
    { icon: Users, title: "Corporate Training", desc: "Tailored AI upskilling for your whole team.", to: "/corporate-training" },
    { icon: MessageSquare, title: "Prompt Engineering", desc: "Make every role more productive with AI.", to: "/corporate-training" },
    { icon: Cloud, title: "Cloud AI Platforms", desc: "Vertex, Azure OpenAI and Bedrock, hands-on.", to: "/corporate-training" },
    { icon: Monitor, title: "AI Consulting", desc: "Expert guidance to plan and implement AI.", to: "/services" },
  ],
  "For Businesses": [
    { icon: Zap, title: "AI Proof of Concepts", desc: "Validate an AI idea in weeks, not months.", to: "/business" },
    { icon: Layers, title: "Custom AI Solutions", desc: "Build AI solutions for your unique needs.", to: "/services" },
    { icon: TrendingUp, title: "AI Automation", desc: "Streamline work and boost productivity.", to: "/services" },
    { icon: Monitor, title: "AI Consulting", desc: "Plan adoption, tooling and team upskilling.", to: "/services" },
  ],
};

const CAREER_ROLES = ["AI Engineer", "LLMOps Engineer", "AI Solutions Architect", "Prompt Engineer"];

const WHY_CARDS = [
  { icon: Target, title: "Expert-Led Programs", desc: "Learn from industry practitioners who build AI for a living." },
  { icon: Rocket, title: "Real Projects", desc: "Build a portfolio that stands out — every week." },
  { icon: PlayCircle, title: "Flexible Access", desc: "Live classes plus recordings: learn anytime, anywhere." },
  { icon: ShieldCheck, title: "Career Guidance", desc: "Resume, portfolio and interview support into AI roles." },
];

const VIDEO_LABELS = ["Inside a live class", "Learner success stories", "Program overview"];

const ytId = (url: string) => url?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=|v\/))([A-Za-z0-9_-]{11})/)?.[1] || "";

type Video = { id: string; title: string };

// ─── HERO ────────────────────────────────────────────────────────────────────

function Hero({ logos }: { logos: PartnerLogo[] }) {
  return (
    <section className="rx-hero">
      <div className="rv-container rx-hero__grid">
        <div className="rx-hero__copy" {...anim("fadeInUp", 100)}>
          <span className="rv-eyebrow rv-eyebrow--cyan">AI Training &amp; Consulting</span>
          <h1 className="rx-hero__title">Build Your Future with AI Training, Real Projects &amp; Innovation</h1>
          <p className="rx-hero__text">
            Gain in-demand AI skills, work on real-world projects, and turn ideas into practical AI
            solutions with expert guidance.
          </p>
          <div className="rv-btn-row">
            <a href="#programs" className="rv-btn">Explore Programs <ArrowRight size={16} aria-hidden="true" /></a>
            <Link to="/contact" className="rv-btn rv-btn--ghost-light">Talk to an Expert</Link>
          </div>
          <ul className="rx-feats">
            <li><Zap size={20} aria-hidden="true" /> Hands-on Learning</li>
            <li><Layers size={20} aria-hidden="true" /> Real Projects</li>
            <li><Users size={20} aria-hidden="true" /> Expert Mentors</li>
          </ul>
        </div>
        <div className="rx-hero__art" {...anim("zoomIn", 250)}>
          <img src="/images/home/hero-laptop.webp" alt="A laptop with an AI chip on screen, glowing on a ring of light" width={900} height={750} />
          <span className="rx-float rx-float--1" aria-hidden="true"><Code2 size={30} /></span>
          <span className="rx-float rx-float--2" aria-hidden="true"><Sparkles size={28} /></span>
          <span className="rx-float rx-float--3" aria-hidden="true"><BarChart3 size={28} /></span>
          <span className="rx-float rx-float--4" aria-hidden="true"><Bot size={30} /></span>
        </div>
      </div>

      {logos.length > 0 && (
        <div className="rv-container">
          <div className="rx-trust" {...anim("fadeInUp", 350)}>
            <p>Trusted by teams and organizations of all sizes</p>
            <div className="rx-trust__logos">
              {logos.slice(0, 6).map((l, i) =>
                l.href ? (
                  <a key={i} className="rx-trust__logo" href={l.href} target="_blank" rel="noopener noreferrer" title={l.alt}>
                    <img src={l.src} alt={l.alt} loading="lazy" />
                  </a>
                ) : (
                  <span key={i} className="rx-trust__logo"><img src={l.src} alt={l.alt} loading="lazy" /></span>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── ABOUT ───────────────────────────────────────────────────────────────────

function About() {
  return (
    <section className="rv-section rx-about">
      <div className="rv-container rx-about__grid">
        <div className="rx-about__media" {...anim("fadeInLeft", 100)}>
          <img src="/images/home/about-team.webp" alt="Learners working together on an AI project" width={880} height={640} loading="lazy" />
          <div className="rx-badge rx-badge--tl"><span><Brain size={26} aria-hidden="true" /></span> AI Skills</div>
          <div className="rx-badge rx-badge--br">
            <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true">
              <defs><linearGradient id="rxBar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#7C3AED" /><stop offset="1" stopColor="#3B7BFF" /></linearGradient></defs>
              {[18, 30, 26, 44, 58].map((hh, i) => <rect key={i} x={8 + i * 22} y={66 - hh} width="14" height={hh} rx="3" fill="url(#rxBar)" />)}
              <path d="M6 48 L32 34 L54 38 L80 18 L112 6" fill="none" stroke="#6D4AFF" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div {...anim("fadeInRight", 200)}>
          <span className="rv-eyebrow">About Rivira Tech</span>
          <h2 className="rv-h2">A team focused on making AI skills accessible and practical</h2>
          <p className="rv-text rx-lead">
            We help learners and organizations build real-world AI capabilities through hands-on
            training, guided projects and practical implementation support.
          </p>
          <div className="rx-stats">
            <div><Users size={26} aria-hidden="true" /><Counter to={5000} suffix="+" label="Learners Trained" /></div>
            <div><Rocket size={26} aria-hidden="true" /><Counter to={50} suffix="+" label="Live Projects Built" /></div>
            <div><BarChart3 size={26} aria-hidden="true" /><Counter to={98} suffix="%" label="Learner Satisfaction" /></div>
          </div>
          <Link to="/about" className="rx-textlink">More about us <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}

// ─── FEATURED PROGRAMS ───────────────────────────────────────────────────────

function FeaturedPrograms() {
  return (
    <section id="programs" className="rv-section rx-programs">
      <div className="rv-container">
        <div className="rv-shead" {...anim("fadeInUp")}>
          <span className="rv-eyebrow">Featured Programs</span>
          <h2 className="rv-h2">AI training designed for real outcomes</h2>
          <p className="rv-text">Practical, project-based programs to build job-ready AI skills.</p>
        </div>
        <div className="rx-pcards">
          {PROGRAM_CARDS.map((p, i) => (
            <Link key={p.title} to={p.to} className="rx-pcard" {...anim("fadeInUp", i * 90)}>
              <span className="rx-pcard__icon"><p.icon size={34} aria-hidden="true" /></span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <span className="rx-pcard__go" aria-hidden="true"><ArrowRight size={18} /></span>
            </Link>
          ))}
        </div>
        <p className="rx-more" {...anim("fadeIn", 200)}>
          Also: <Link to="/ai-for-kids">AI for Kids</Link> · <Link to="/corporate-training">Corporate Training</Link> · <Link to="/courses">All courses</Link>
        </p>
      </div>
    </section>
  );
}

// ─── SOLUTIONS (tabs) ────────────────────────────────────────────────────────

function Solutions() {
  const tabs = Object.keys(SOLUTION_TABS);
  const [tab, setTab] = useState(tabs[0]);
  return (
    <section className="rv-section rv-section--white">
      <div className="rv-container">
        <div className="rv-shead" style={{ marginBottom: 28 }} {...anim("fadeInUp")}>
          <span className="rv-eyebrow">Our Solutions</span>
          <h2 className="rv-h2">Strategic solutions for your AI journey</h2>
          <p className="rv-text">From skill building to real-world implementation, we help you make AI work for you.</p>
        </div>
        <div className="rx-tabs" role="tablist" aria-label="Who the solutions are for" {...anim("fadeIn", 100)}>
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <div className="rx-scards" key={tab} role="tabpanel">
          {SOLUTION_TABS[tab].map((c, i) => (
            <Link key={c.title} to={c.to} className="rx-scard" style={{ animationDelay: `${i * 70}ms` }}>
              <c.icon size={40} strokeWidth={1.6} aria-hidden="true" />
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CAREER BAND ─────────────────────────────────────────────────────────────

function CareerBand() {
  return (
    <section className="rx-career">
      <div className="rv-container rx-career__grid">
        <div {...anim("fadeInLeft", 100)}>
          <span className="rv-eyebrow rv-eyebrow--cyan">Career with AI</span>
          <h2 className="rv-h2 rv-light">Build a smarter career with AI skills</h2>
          <p className="rx-career__text">Learn, build and showcase real projects to stand out in today's AI-driven job market.</p>
          <ul className="rx-career__checks">
            {["In-demand skills", "Career guidance", "Portfolio-ready projects", "Job-focused learning"].map((t) => (
              <li key={t}><CheckCircle2 size={20} aria-hidden="true" /> {t}</li>
            ))}
          </ul>
          <Link to="/programs" className="rv-btn">Start Your AI Career <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="rx-career__art" {...anim("fadeInRight", 200)}>
          <img src="/images/home/career.webp" alt="A learner looking ahead against a city skyline" width={880} height={656} loading="lazy" />
          <div className="rx-roles" aria-label="Roles our learners move into">
            {CAREER_ROLES.map((r, i) => <span key={r} className="rx-role" style={{ animationDelay: `${i * 0.6}s` }}>{r}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── WHY + CERTIFICATE ───────────────────────────────────────────────────────

function WhyAndCertificate() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rv-section rx-why">
      <div className="rv-container">
        <div className="rv-shead" {...anim("fadeInUp")}>
          <span className="rv-eyebrow">Why Rivira Tech</span>
          <h2 className="rv-h2">Where strategy, creativity, and AI performance connect</h2>
        </div>
        <div className="rx-scards">
          {WHY_CARDS.map((c, i) => (
            <div key={c.title} className="rx-scard" {...anim("fadeInUp", i * 90)}>
              <c.icon size={40} strokeWidth={1.6} aria-hidden="true" />
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="rx-cert">
          <button type="button" className="rx-cert__frame" onClick={() => setOpen(true)} aria-label="View the sample certificate" {...anim("fadeInLeft", 100)}>
            <img src="/certicates/Certificate of Completion.png" alt="Sample Rivira Tech certificate of completion" loading="lazy" />
          </button>
          <div {...anim("fadeInRight", 200)}>
            <span className="rv-eyebrow">Certificate</span>
            <h2 className="rv-h2">Earn a recognized Certificate of Completion</h2>
            <ul className="rx-ticks">
              {["Validate your AI skills", "Showcase real project experience", "Boost your career opportunities"].map((t) => (
                <li key={t}><Check size={18} aria-hidden="true" /> {t}</li>
              ))}
            </ul>
            <button type="button" className="rv-btn" onClick={() => setOpen(true)}>View Sample Certificate <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </div>

      {open && (
        <div className="rx-lightbox" role="dialog" aria-modal="true" aria-label="Sample certificate" onClick={() => setOpen(false)}>
          <button type="button" className="rx-lightbox__close" onClick={() => setOpen(false)} aria-label="Close" autoFocus><X size={20} /></button>
          <img src="/certicates/Certificate of Completion.png" alt="Sample Rivira Tech certificate of completion" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}

// ─── LEARNER STORIES ─────────────────────────────────────────────────────────

const Stories = memo(function Stories({ testimonials }: { testimonials: any[] }) {
  const list = testimonials?.length ? testimonials : LV_FALLBACK;
  const n = list.length;
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const go = (d: number) => setI((c) => (c + d + n) % n);

  useEffect(() => {
    if (held || n < 2) return;
    const t = setInterval(() => setI((c) => (c + 1) % n), 6000);
    return () => clearInterval(t);
  }, [held, n]);

  const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("") || "R";
  const show = n >= 3 ? [-1, 0, 1] : n === 2 ? [0, 1] : [0];

  return (
    <section className="rv-section rv-section--white rx-stories">
      <div className="rv-container">
        <div className="rv-shead" {...anim("fadeInUp")}>
          <span className="rv-eyebrow">Learner Stories</span>
          <h2 className="rv-h2">Hear from Rivira Tech learners and tutors</h2>
        </div>
        <div className="rx-stories__row" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} aria-roledescription="carousel">
          {n > 1 && <button type="button" className="rx-arrow" onClick={() => go(-1)} aria-label="Previous story"><ChevronLeft size={20} /></button>}
          <div className="rx-stories__track">
            {show.map((off) => {
              const item = list[(i + off + n) % n];
              return (
                <figure key={`${i}-${off}`} className={`rx-story${off === 0 ? " is-center" : ""}`}>
                  <figcaption className="rx-story__who">
                    <span className="rx-story__avatar">{item.avatar ? <img src={item.avatar} alt="" /> : initials(item.name)}</span>
                    <span>
                      <b>{item.name}</b>
                      <small>{item.role}</small>
                      {item.rating != null && (
                        <span className="rx-stars" aria-label={`${item.rating} out of 5`}>
                          {Array.from({ length: 5 }, (_, k) => <Star key={k} size={14} fill={k < Math.round(item.rating) ? "#FBBF24" : "none"} color="#FBBF24" />)}
                        </span>
                      )}
                    </span>
                  </figcaption>
                  <blockquote>“{item.feedback}”</blockquote>
                </figure>
              );
            })}
          </div>
          {n > 1 && <button type="button" className="rx-arrow" onClick={() => go(1)} aria-label="Next story"><ChevronRight size={20} /></button>}
        </div>
        {n > 1 && (
          <div className="rx-dots">
            {list.map((_: unknown, k: number) => (
              <button key={k} type="button" className={k === i ? "is-on" : ""} onClick={() => setI(k)} aria-label={`Story ${k + 1}`} aria-current={k === i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
});

// ─── WATCH & LEARN ───────────────────────────────────────────────────────────

function WatchAndLearn({ videos }: { videos: Video[] }) {
  const [playing, setPlaying] = useState<Video | null>(null);
  const list = videos.slice(0, 3);
  if (!list.length) return null;
  return (
    <section className="rx-watch">
      <div className="rv-container rx-watch__grid">
        <div {...anim("fadeInLeft", 100)}>
          <span className="rv-eyebrow rv-eyebrow--cyan">Watch &amp; Learn</span>
          <h2 className="rv-h3 rv-light">Watch our learners and programmes in action</h2>
        </div>
        <div className="rx-watch__videos">
          {list.map((v, k) => (
            <button key={v.id + k} type="button" className={`rx-video${k === 0 ? " rx-video--big" : ""}`} onClick={() => setPlaying(v)} aria-label={`Play video: ${v.title}`} {...anim("fadeInUp", k * 100)}>
              <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" />
              <span className="rx-video__play"><Play size={22} fill="currentColor" aria-hidden="true" /></span>
              {k > 0 && <span className="rx-video__label">{v.title}</span>}
            </button>
          ))}
        </div>
      </div>
      {playing && <VideoModal videoId={playing.id} title={playing.title} onClose={() => setPlaying(null)} />}
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  const [askOpen, setAskOpen] = useState(false);
  return (
    <section className="rv-section rx-faq">
      <div className="rv-container rx-faq__grid">
        <div className="rx-faq__intro" {...anim("fadeInLeft", 100)}>
          <img src="/images/home/faq-bubbles.webp" alt="" width={570} height={450} loading="lazy" />
          <div>
            <span className="rv-eyebrow">FAQ</span>
            <h2 className="rv-h2">Everything you need to know before getting started</h2>
            <button type="button" className="rv-btn rv-btn--ghost" style={{ marginTop: 22 }} onClick={() => setAskOpen(true)}>Ask Us a Question</button>
          </div>
        </div>
        <div className="rx-faq__list" {...anim("fadeInRight", 200)}>
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <div key={item.q} className={`rv-acc${isOpen ? " is-open" : ""}`}>
                <button type="button" className="rv-acc__btn" onClick={() => setOpen(isOpen ? null : idx)} aria-expanded={isOpen}>
                  {item.q}
                  {isOpen ? <Minus size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                </button>
                <div className="rv-acc__panel"><div><p>{item.a}</p></div></div>
              </div>
            );
          })}
        </div>
      </div>
      {askOpen && (
        <InquiryModal open onClose={() => setAskOpen(false)} title="Didn't find your answer?"
          intro="Send us your question and we'll get back to you personally." source="home-faq" />
      )}
    </section>
  );
}

// ─── CLOSING BAND ────────────────────────────────────────────────────────────

function ReadyBand() {
  return (
    <section className="rx-ready">
      <div className="rv-container rx-ready__inner" {...anim("fadeInUp")}>
        <div>
          <h2 className="rv-h3 rv-light">Ready to start your AI journey?</h2>
          <p>Join thousands of learners building real AI skills with Rivira Tech.</p>
        </div>
        <div className="rv-btn-row">
          <Link to="/programs" className="rv-btn">Explore Programs <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link to="/contact" className="rv-btn rv-btn--ghost-light">Talk to an Expert</Link>
        </div>
      </div>
    </section>
  );
}

// ─── PLAN ACCESS SLIDER (Admin → Plan Slides) ──

function ProgramAccess() {
  const [section, setSection] = useState<PlanSection | null>(null);
  const [slides, setSlides] = useState<PlanSlide[]>([]);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    let live = true;
    axios.get(SERVER_URL + "api/get-plan-slides")
      .then((res) => {
        if (!live) return;
        if (res.data?.success) {
          setSection(res.data.section);
          setSlides(res.data.data || []);
          saveOfferedPlans(offeredFromResponse(res.data));
        } else {
          setSection(FALLBACK_SECTION);
          setSlides(FALLBACK_SLIDES);
        }
      })
      .catch(() => { if (live) { setSection(FALLBACK_SECTION); setSlides(FALLBACK_SLIDES); } });
    return () => { live = false; };
  }, []);

  const n = slides.length;
  const go = (d: number) => setI((c) => (c + d + n) % n);
  const autoplay = Number(section?.autoplay) || 0;

  useEffect(() => {
    if (held || n < 2 || autoplay <= 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setI((c) => (c + 1) % n), autoplay * 1000);
    return () => clearInterval(timer);
  }, [held, n, autoplay]);

  if (!section || section.status === "0" || n === 0) return null;
  const s = slides[Math.min(i, n - 1)];

  return (
    <section className="rv-section">
      <div className="rv-container">
        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 40px" }} {...anim("fadeInUp")}>
          {section.eyebrow && <span className="rv-eyebrow">{section.eyebrow}</span>}
          <h2 className="rv-h2">{section.title}</h2>
          {section.subtitle && <p className="rv-text" style={{ marginTop: 12 }}>{section.subtitle}</p>}
        </div>

        <div
          className={"rt-plans-slider theme-" + (s.theme || "a")}
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocusCapture={() => setHeld(true)}
          onBlurCapture={() => setHeld(false)}
          role="group"
          aria-roledescription="carousel"
          aria-label="Ways to access the program"
        >
          {n > 1 && (
            <button type="button" className="rt-plans-nav prev" onClick={() => go(-1)} aria-label="Previous plan">
              <ChevronLeft />
            </button>
          )}
          <div className="rt-plans-card" key={s.id} aria-live="polite">
            <div className="rt-plans-left">
              {s.tag && <span className="rt-plans-tag">{s.tag}</span>}
              <h3>{s.title}</h3>
              {s.description && <p className="rt-plans-desc">{s.description}</p>}
              {s.points.length > 0 && (
                <ul className="rt-plans-points">
                  {s.points.map((pt, k) => (
                    <li key={k}><Check aria-hidden="true" /> {pt}</li>
                  ))}
                </ul>
              )}
              <div className="rt-plans-actions">
                <Link to={`${PROGRAM_LINK}?plan=${s.plan}#pgnr-pricing`} className="rt-plans-btn">{s.cta}</Link>
                {s.link_text && <Link to={`${PROGRAM_LINK}?plan=${s.plan}`} className="rt-plans-link">{s.link_text}</Link>}
              </div>
            </div>
            <div className="rt-plans-right">
              <div className="rt-plans-price">
                <span className="rt-plans-amt">{s.price}</span>
                {s.unit && <span className="rt-plans-unit">{s.unit}</span>}
              </div>
              {s.badge && <div className="rt-plans-badge"><Video aria-hidden="true" /> {s.badge}</div>}
            </div>
          </div>
          {n > 1 && (
            <button type="button" className="rt-plans-nav next" onClick={() => go(1)} aria-label="Next plan">
              <ChevronRight />
            </button>
          )}
        </div>

        {n > 1 && (
          <div className="rt-plans-dots">
            {slides.map((slide, k) => (
              <button
                key={slide.id}
                type="button"
                className={"rt-plans-dot" + (k === i ? " on" : "")}
                onClick={() => setI(k)}
                aria-label={`Show ${slide.tag || slide.title}`}
                aria-current={k === i}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  useRiviraReveal(rootRef);
  const [videos, setVideos] = useState<Video[]>([]);
  const [testimonials, setTestimonials] = useState<any[] | null>(null);
  const [partners, setPartners] = useState<PartnerLogo[]>([]);

  const checklogin = async () =>
    (await axios.get(SERVER_URL + "api/check-login", { withCredentials: true })).data;

  useEffect(() => {
    (async () => {
      try {
        const data = await checklogin();
        if (data.loggedIn) navigate("/dashboard");
      } catch { /* stay on homepage */ }
    })();

    const fallbackVideos = DEFAULT_VIDEOS.map((u, k) => ({ id: ytId(u), title: VIDEO_LABELS[k] || "Rivira Tech" })).filter((v) => v.id);

    (async () => {
      const [yt, tm, pt] = await Promise.allSettled([
        siteFetch("api/get-youtube"),
        siteFetch("api/get-testimonials"),
        siteFetch("api/get-partners"),
      ]);
      if (pt.status === "fulfilled" && pt.value.data?.success) {
        setPartners(
          (pt.value.data.data || [])
            .map((p: any) => ({ src: logoUrl(p.logo), alt: p.name || "", href: p.website || undefined }))
            .filter((p: PartnerLogo) => p.src)
        );
      } else {
        setPartners(DEFAULT_LOGOS);
      }
      if (yt.status === "fulfilled" && yt.value.data?.success) {
        const rows = (yt.value.data.data || []).map((v: any, k: number) => ({ id: ytId(v.url), title: v.title || VIDEO_LABELS[k] || "Rivira Tech" })).filter((v: Video) => v.id);
        setVideos(rows.length ? rows : fallbackVideos);
      } else {
        setVideos(fallbackVideos);
      }
      if (tm.status === "fulfilled" && tm.value.data?.success) {
        setTestimonials(tm.value.data.data || []);
      } else {
        setTestimonials(LV_FALLBACK);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.classList.add("rt-home");
    return () => document.body.classList.remove("rt-home");
  }, []);

  // data-reveal: utils/autoReveal.ts leaves this page to the Rivira animations
  return (
    <main className="rv-page rt-home-page rx-home" ref={rootRef} data-reveal="rivira">
      <Head
        pageTitle="Rivira Tech — AI Training, Real Projects & Consulting"
        pageDesc="Rivira Tech helps students, professionals and businesses learn generative AI, build real projects and ship practical AI solutions with expert guidance."
        pageKeywords="AI training, GenAI courses, AI consulting, learn artificial intelligence, AI bootcamp, LLM courses, AI certification, AI for kids, AI for non-coders, corporate AI training"
      />
      <Hero logos={partners} />
      <About />
      <FeaturedPrograms />
      <Solutions />
      <CareerBand />
      <WhyAndCertificate />
      {PLANS_PUBLISHED && <ProgramAccess />}
      {testimonials && testimonials.length > 0 && <Stories testimonials={testimonials} />}
      <WatchAndLearn videos={videos} />
      <FaqSection />
      <ReadyBand />
    </main>
  );
}
