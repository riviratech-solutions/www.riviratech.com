import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, Video, Users, GraduationCap, Github, Cpu, MessagesSquare, Rocket,
  Repeat, Timer, CreditCard, Download, Zap, ArrowRight,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Head } from "../../components/Includes";
/* Not lazy here, unlike on Home: this whole page is already behind a lazy()
   route, so the component lands in the CoursePlan chunk and costs the startup
   graph nothing either way. */
import SampleCertificate from "../../components/SampleCertificate";
import { PROGRAM } from "../../utils/program";
import { PHASES, PROJECT_LEVELS, type Phase, type Week } from "./coursePlanData";
import { useGoogleAnalytics } from "../../utils/gtag";

/**
 * Applied AI Program course plan — React port of the retired static
 * public/ai-course-plan.html (gold/premium theme). The page's own nav, brand
 * block and footer were dropped: the SPA's shared Header/Footer wrap this
 * route. Styling lives in /css/website.css (loaded site-wide), scoped under
 * .course-plan-page; the hero reuses the program page's .enroll-hero styles.
 *
 * Old /ai-course-plan.html URLs redirect here (see App.tsx). Deep links
 * (#prereq / #prerequisites / #projects) still select the matching view.
 */

/* The vocabulary of the six-discipline arc, in roughly the order the weeks
   introduce it: the model and the prompt first, then everything built on top. */
const TERM_GROUPS = [
  { label: "AI Foundations", terms: ["LLM", "Prompt", "Token", "Embedding", "Context Window", "Inference", "Sampling"] },
  { label: "RAG & Retrieval", terms: ["RAG", "Vector DB", "Hallucination"] },
  { label: "AI Agents", terms: ["Tool Calling", "Harness", "Agentic Loop", "MCP", "LangGraph", "Checkpoint", "Human Gate"] },
  { label: "Model Optimization", terms: ["Fine-Tuning", "LoRA / PEFT"] },
  { label: "Evaluation & Safety", terms: ["Eval"] },
];

/**
 * The downloadable brochure in public/docs. `size` and `pages` are stated
 * rather than measured — nothing on the client can read either without
 * fetching the whole file first, and a download link that has to download the
 * file to describe it is worse than one that is kept honest by hand. Re-check
 * both when the PDF is replaced.
 */
const BROCHURE = {
  href: "/docs/AI-Launchpad-16-Week-Program.pdf",
  filename: "AI-Launchpad-16-Week-Program.pdf",
  pages: 14,
  size: "854 KB",
};

/** Brochure p12 — taught across the sixteen weeks, not owned by one of them. */
const USE_CASES = [
  "AI Customer Support Chatbot", "Resume Screening & Matching",
  "Healthcare Document Summarization", "Financial Risk Analysis",
  "Insurance Claims Processing", "Retail Recommendation Engine",
  "Personalized AI Tutoring", "Legal Contract Review",
  "Supply Chain Intelligence", "Fraud Detection & Alerts",
  "HR & Recruiting Assistant", "Enterprise Knowledge Assistant",
  "Sales Call Intelligence", "AI Research Assistant",
];

/** Brochure p13 — run alongside the scheduled classes, not counted within them. */
const OPTIONAL_CLASSES = [
  { h: "Guest lectures from AI leaders", d: "Practitioner sessions from industry leaders, slotted between the modules and typically after each capstone, connecting your builds to real teams." },
  { h: "Using Claude Code effectively", d: "A hands-on session on agentic coding tools, best paired with harness engineering — the harness you are building, mirrored in a production tool." },
  { h: "No-code and low-code AI tooling", d: "A guided survey of the landscape, showing where visual tooling fits alongside engineered systems and when each approach truly wins." },
  { h: "Interview and portfolio clinic", d: "Packaging your two capstones into a portfolio that interviews well, plus system-design practice focused on real agent architectures." },
  { h: "Free bootcamps & FDE sessions", d: "Free bootcamps every two months, plus Forward Deployment Engineering sessions that introduce one of the fastest-growing career paths in applied AI." },
  { h: "Career guidance & interview prep", d: "Ongoing guidance and interview preparation that continue throughout your batch and beyond it, all the way into your first AI role." },
];

type ViewKey = "plan" | "prereq" | "projects";

/** Deep links: #prereq / #prerequisites / #projects (same as the static page). */
function viewFromHash(hash: string): ViewKey | null {
  const h = hash.replace("#", "").toLowerCase();
  if (h === "prereq" || h === "prerequisites") return "prereq";
  if (h === "projects") return "projects";
  return null;
}

/**
 * Scroll-reveal: adds the "in" state when the element first enters the
 * viewport (same threshold/margin as the static page's IntersectionObserver),
 * shown immediately under prefers-reduced-motion or without IO support.
 */
function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px 8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

/** One week card. Weeks start collapsed (compact, scannable) and expand on click/Enter/Space. */
function WeekCard({ week }: { week: Week }) {
  const { ref, shown } = useReveal();
  const [open, setOpen] = useState(false);
  // `flag` drives the gold card variant that the retired industry-use-case
  // weeks used; today only the certification week (12) carries one.
  const isProj = Boolean(week.flag);
  const cls = [
    "week",
    isProj ? "proj" : "",
    week.cap ? "cap" : "",
    shown ? "in" : "",
    open ? "open" : "",
  ].filter(Boolean).join(" ");

  const toggle = () => setOpen((o) => !o);

  return (
    <article ref={ref} className={cls}>
      <div className="wk-num">
        <span className="w">Week</span>
        <span className="n">{String(week.n).padStart(2, "0")}</span>
        {/* "Days" is broken onto its own line rather than left to wrap: the rail
            is 64px, and "Days 106–112" wrapped mid-range as "Days 106–" / "112". */}
        <span className="d">
          <span className="dl">Days</span>
          {week.days.replace(/^Days\s*/, "")}
        </span>
      </div>
      <div className="wk-body">
        <div
          className="wk-head"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
        >
          {week.flag && <div className="proj-flag">{week.flag}</div>}
          {/* The chevron lives inside .usecase so it always sits beside the
              "You ship" badge. As a direct child of .wk-head it was pinned to a
              fixed top:16px, which landed next to the orange Industry Use Case
              pill on the project weeks (5, 9, 10) and next to "You ship"
              everywhere else — QA D2 #12. */}
          <div className="usecase">
            <span className="uc-tag">You ship</span>
            <b>{week.use}</b>
            <span className="wk-chev" aria-hidden="true"></span>
          </div>
          <h3>{week.title}</h3>
          <p className="wk-tagline">{week.tag}</p>
        </div>
        <div className="wk-detail">
          <div className="wk-detail-in">
            <div className="topics">
              {week.topics.map((t) => <span key={t} className="topic">{t}</span>)}
            </div>
            <div className="tools"><b>Stack:</b> {week.tools}</div>
            {week.check && (
              /* The brochure's checkpoint is a paragraph, not the short phrase
                 the old plan carried, so the weight sits on the label and the
                 sentence itself reads at normal weight (see .check in the CSS). */
              <div className="check">
                <span className="ck-ic">✓</span>
                <span><b>Checkpoint</b> — {week.check}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function PhaseSection({ phase }: { phase: Phase }) {
  const { ref, shown } = useReveal();
  return (
    <section ref={ref} className={shown ? "phase in" : "phase"}>
      <div className="phase-head">
        <span className="phase-idx">{phase.idx}</span>
        <h2>{phase.name}</h2>
        <span className="phase-range">{phase.range}</span>
      </div>
      <hr className="phase-rule" />
      <div className="weeks">
        {phase.weeks.map((w) => <WeekCard key={w.n} week={w} />)}
      </div>
    </section>
  );
}

/** Stats strip with the static page's count-up on first view (reduced-motion safe). */
function StatsStrip() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;

    const targets = Array.from(strip.querySelectorAll<HTMLElement>(".n")).map((el) => ({
      el,
      to: parseInt(el.textContent ?? "", 10) || 0,
      raw: el.textContent ?? "",
    }));
    let raf = 0;
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || done) return;
          done = true;
          const dur = 1200;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / dur);
            const ease = 1 - Math.pow(1 - p, 3);
            targets.forEach((t) => { t.el.textContent = String(Math.round(t.to * ease)); });
            if (p < 1) raf = requestAnimationFrame(tick);
            else targets.forEach((t) => { t.el.textContent = t.raw; });
          };
          raf = requestAnimationFrame(tick);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(strip);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      // If unmounted mid-animation, restore the real numbers.
      targets.forEach((t) => { t.el.textContent = t.raw; });
    };
  }, []);

  return (
    <div className="stats" ref={ref}>
      <div className="stat"><div className="n">{PROGRAM.durationWeeks}</div><div className="l">weeks — one continuous arc, live on Zoom</div></div>
      <div className="stat"><div className="n">6</div><div className="l">disciplines: prompt → context → RAG → harness → loop → graph</div></div>
      <div className="stat"><div className="n">30</div><div className="l">GitHub portfolio projects across 3 levels</div></div>
      <div className="stat"><div className="n">2</div><div className="l">capstones shipped and operated (scope for four)</div></div>
    </div>
  );
}

// The SPA's fixed navbar is ~67px tall (see Head.css); used when scrolling the
// sticky tab bar to the top of the viewport.
const NAV_OFFSET = 66;

export default function CoursePlan() {
  const location = useLocation();
  const [view, setView] = useState<ViewKey>(() => viewFromHash(window.location.hash) ?? "plan");

  /* Mobile QA 21-08 item 9. Collapsed by default at every width, not only on
     phones: a Show More that appears and disappears with the viewport is a
     layout that has to be reasoned about twice, and the button is unobtrusive
     on desktop. See the render site for why the content stays mounted. */
  const [weeksOpen, setWeeksOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  /* Mobile QA 07-09, item 3. Same report and same fix as CollapsibleRows --
     see the long note there. The week rail collapses through its own state
     rather than that component, so the behaviour is repeated here rather than
     shared: collapsing used to leave the reader stranded below a list that had
     just lost eleven weeks.

     An effect, not the click handler, so the measurement happens after React
     has applied the collapsed height. `wasWeeksOpen` keeps it from firing on
     mount, when `weeksOpen` is already false. Scrolls up only. */
  const curriculumRef = useRef<HTMLElement | null>(null);
  const wasWeeksOpen = useRef(false);

  useEffect(() => {
    if (wasWeeksOpen.current && !weeksOpen) {
      const el = curriculumRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 92;
        if (top < window.scrollY) {
          const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
        }
      }
    }
    wasWeeksOpen.current = weeksOpen;
  }, [weeksOpen]);

  // The page stylesheet is declared as a JSX <link precedence> at the render
  // site, which holds the first paint until it has loaded. It used to be
  // appended from an effect here as well, which fetched the same file twice.
  //
  // ?v= is still load-bearing and still lives on that JSX link: the file is
  // referenced by a literal path, so unlike the bundled CSS it is not
  // content-hashed and nothing tells a returning visitor it changed — they
  // keep the cached copy and see the old hero. Same failure cc0a4c5 documented
  // for course-theme.css. Bump it there on every edit.

  // Keep deep links working after mount too (e.g. in-app navigation to
  // /course-plan#projects). ScrollToTop handles the anchor scroll itself.
  useEffect(() => {
    const v = viewFromHash(location.hash);
    if (v) setView(v);
  }, [location.hash]);

  // Google Analytics (GA4), in addition to the site-wide page_view in App.tsx.
  // The prerequisites / projects tabs are client-side view switches, so GA
  // cannot see them on its own; reporting them as virtual paths gives each its
  // own row in the Pages report. The default "plan" tab passes null because
  // App.tsx has already counted this route — sending it here too would
  // double-count every /course-plan visit.
  useGoogleAnalytics(view === "plan" ? null : `${location.pathname}#${view}`);

  function selectView(v: ViewKey) {
    setView(v);
    // Bring the sticky tab bar to just below the fixed navbar so the selected
    // view shows right beneath it — instead of jumping the page up to the hero.
    const bar = tabsRef.current;
    if (!bar) return;
    // Measure the bar's *static* flow position, not its current one. The bar is
    // position:sticky, and offsetTop / getBoundingClientRect() on a stuck
    // element report where it has been shifted to — which, any time you've
    // scrolled past it, is exactly (scrollY + NAV_OFFSET). Scrolling there was
    // therefore a no-op, and switching tabs deep in a long view dropped you at
    // that same depth in the new one instead of at the top of it. Dropping
    // sticky for the measurement gives the flow position; nothing paints
    // between the two assignments, so there is no flicker.
    const sticky = bar.style.position;
    bar.style.position = "static";
    const top = bar.getBoundingClientRect().top + window.scrollY;
    bar.style.position = sticky;
    window.scrollTo({ top: top - NAV_OFFSET, behavior: "smooth" });
  }

  return (
    <div className="course-plan-page">
      <Head
        pageTitle={`${PROGRAM.name} — Course Plan | Rivira Technologies`}
        pageDesc={`Full ${PROGRAM.durationWeeks}-week course plan for the ${PROGRAM.name} — Python, ML, DL and NLP, then prompt, context, RAG, harness, loop and graph engineering, a Claude AI certification and 2 to 4 shipped capstones. Live on Zoom.`}
        pageKeywords="AI Launchpad program, course plan, GenAI engineering, LLM apps, RAG, AI agents, harness engineering, LangGraph, MCP, Claude certification, AI curriculum"
      />

      {/* ================= HERO =================
          Same design as the program page (ProgramGenAI.tsx, centered layout): its
          styles live under .enroll-page/.biz-page/.pgnr-page, so only the hero is
          wrapped in those — wrapping the whole page would restyle everything
          below it. A <header>, not a <section>, so `.course-plan-page section`
          padding can't reach it. Names the program via PROGRAM.name so it
          matches checkout and the enrolment confirmation. */}
      <div className="enroll-page biz-page cbiz-page pgnr-page cp-hero">
        <header className="enroll-hero">
          <div className="enroll-hero-grid" />
          <div className="enroll-hero-glow-left" />
          <div className="enroll-hero-glow-right" />
          <div className="enroll-hero-inner pgnr-hero-inner pgnr-hero-solo">
            <div className="pgnr-hero-copy">
              <div className="enroll-badge">
                <Zap size={12} />Course plan · {PROGRAM.name} · Understand / Build / Create / Launch
              </div>
              <h1>
                From your first prompt to a
                <span className="gold-text">production AI system — in {PROGRAM.durationWeeks} weeks</span>
              </h1>
              <p>
                A focused {PROGRAM.durationWeeks}-week path from AI foundations to production-ready systems.
                Build with <b>Python, RAG, agents, LangGraph, fine-tuning, and cloud AI</b>, earn your
                <b> Claude AI certification</b>, and finish with <b>2 to 4 capstone projects</b> you can demo in interviews.
              </p>

              <div className="enroll-hero-chips">
                <span className="enroll-hero-chip"><span className="dot" /> {PROGRAM.durationWeeks} weeks total</span>
                <span className="enroll-hero-chip"><span className="dot" /> 13 teaching + 3 capstone &amp; launch weeks</span>
                <span className="enroll-hero-chip"><span className="dot" /> Claude AI certification · RTX 5090 GPU lab</span>
                <span className="enroll-hero-chip"><span className="dot" /> Live on Zoom</span>
              </div>

              <div className="enroll-hero-btns">
                <Link className="enroll-btn-primary" to="/enroll">
                  <span>Enroll now</span><ArrowRight size={18} />
                </Link>
                <Link className="enroll-btn-outline" to="/contact">
                  Talk to an advisor
                </Link>
              </div>
              <div className="enroll-cta-note">Small cohorts · mentor feedback · limited seats</div>
            </div>
          </div>
        </header>
      </div>

      {/* ================= STATS STRIP ================= */}
      <div className="wrap">
        <StatsStrip />
      </div>

      {/* ================= VIEW TABS ================= */}
      <div className="viewtabs" ref={tabsRef}>
        <div className="viewtabs-inner">
          <button className={`vtab${view === "plan" ? " active" : ""}`} type="button" aria-pressed={view === "plan"} onClick={() => selectView("plan")}>Course Plan</button>
          <button className={`vtab${view === "prereq" ? " active" : ""}`} type="button" aria-pressed={view === "prereq"} onClick={() => selectView("prereq")}>Prerequisites</button>
          <button className={`vtab${view === "projects" ? " active" : ""}`} type="button" aria-pressed={view === "projects"} onClick={() => selectView("projects")}>GitHub Projects</button>
        </div>
      </div>

      {/* ================= VIEW: COURSE PLAN ================= */}
      <div id="view-plan" className="view" hidden={view !== "plan"}>
        <div className="wrap">

          {/* SCHEDULE */}
          <div className="schedule">
            <div className="sched-label">
              <span className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="1.6" />
                  <path d="M12 7.5V12l3 1.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="t">Live class<br />schedule</span>
            </div>
            <div className="sess">
              <div className="days">Tue · Wed · Thu · Fri</div>
              <div className="time">9:00 – 10:00 PM EST</div>
              <span className="len">1 hr · 6:30–7:30 AM IST, next day</span>
            </div>
            <div className="sess">
              <div className="days">Saturday</div>
              <div className="time">10:00 AM – 12:00 PM EST</div>
              <span className="len">2 hr · 7:30–9:30 PM IST</span>
            </div>
          </div>

          {/* What the brochure attaches to the schedule rather than to any one
              week, because it is true of all sixteen. */}
          <p className="sched-note">
            Every class is recorded on Skool · mentor 1:1 feedback · graded weekly checkpoints ·
            the Rivira Technologies Hub community on WhatsApp · every class carries a hands-on lab, and every
            week ends with something shipped.
          </p>

          {/* TERM BANK */}
          <div className="termbank">
            <div className="tb-head"><b>Week 1:</b> the vocabulary you'll use throughout the program.</div>
            <div className="term-groups">
              {TERM_GROUPS.map((group) => (
                <div className="term-group" key={group.label}>
                  <div className="term-group-label">{group.label}</div>
                  <div className="terms">
                    {group.terms.map((t) => <span key={t} className="term">{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LEGEND */}
          <div className="legend">
            {/* The swatches name the colour the card actually paints. They did
                not before: "teaching week" carried .wtype.green (--brand, blue)
                while every teaching card draws a GOLD rail, and .wtype.dark
                (#12224A) matched nothing on the page — the capstone variant is
                the blue one. Gold rail, blue card, gold flag. */}
            <span className="lbl">How to read the plan</span>
            <span className="tk"><span className="wtype gold"></span>Teaching week</span>
            <span className="tk"><span className="wtype green"></span>Capstone &amp; launch</span>
            <span className="tk"><span className="lg-flag">★</span>Certification week</span>
            <span className="tk">Tap any week to open its topics, stack and checkpoint</span>
          </div>
        </div>

        {/* Mobile QA 21-08 item 9: 16 week cards is "excessive page height and
            heavy scrolling", so everything past the first five is collapsed
            behind a Show More.

            The cut lands on a PHASE boundary, not on a card count: Phase 01 is
            exactly weeks 1-4, so truncating there shows a complete phase rather
            than half of one with its heading orphaned above the button.

            Everything is RENDERED and hidden with CSS rather than left
            unmounted. This is the curriculum — it is what the page ranks for —
            and unmounting eleven of sixteen weeks would take that content out
            of the DOM entirely. Collapsed height, not absent content. */}
        <main className="wrap" id="curriculum" ref={curriculumRef}>
          {PHASES.map((phase, i) => (
            <div
              key={phase.idx}
              className={i === 0 || weeksOpen ? "" : "cp-phase-collapsed"}
              /* aria-hidden tracks the visual state so a screen reader is not
                 read eleven weeks the sighted user cannot see. */
              aria-hidden={i === 0 || weeksOpen ? undefined : true}
            >
              <PhaseSection phase={phase} />
            </div>
          ))}

          {PHASES.length > 1 && (
            <button
              type="button"
              className="cp-show-more"
              onClick={() => setWeeksOpen((v) => !v)}
              aria-expanded={weeksOpen}
              aria-controls="curriculum"
            >
              {weeksOpen
                ? "Show fewer weeks"
                : `Show all ${PHASES.reduce((n, p) => n + p.weeks.length, 0)} weeks`}
              <ChevronDown
                size={16}
                style={{ transform: weeksOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              />
            </button>
          )}
        </main>

        {/* DOWNLOAD THE BROCHURE
            Served straight out of public/docs, so the href is a real file path
            and not a route — `download` names the saved copy, and the link stays
            a plain <a> so middle-click, "save link as" and the keyboard all work.

            NOT an <embed>/<object> preview: _headers sets `object-src 'none'`,
            so an inline PDF viewer would be blocked with no visible error.

            Keep BROCHURE in sync with the file in public/docs. The other PDF in
            that folder, Rivira Technologies-Complete-Course-Guide.pdf, is attached to the
            credentials email (#136) and is a different document — do not swap
            one for the other. */}
        <div className="wrap">
          <div className="brochure" id="download">
            <div className="br-copy">
              <span className="br-eyebrow">Take it with you</span>
              <h2>Download the {PROGRAM.durationWeeks}-week plan</h2>
              <p>
                The complete brochure: all {PROGRAM.durationWeeks} weeks with their day ranges,
                topics, stack and checkpoints, the class schedule, the {USE_CASES.length} enterprise
                use cases and the optional classes — the same plan laid out on this page, as a PDF
                you can read offline or send to whoever signs off on the training budget.
              </p>
            </div>
            <div className="br-action">
              <a className="btn-primary" href={BROCHURE.href} download={BROCHURE.filename}>
                <Download size={17} aria-hidden="true" /> Download PDF
              </a>
              <span className="br-meta">{BROCHURE.pages} pages · PDF · {BROCHURE.size}</span>
              <a className="br-alt" href={BROCHURE.href} target="_blank" rel="noopener noreferrer">
                or open it in a new tab
              </a>
            </div>
          </div>
        </div>

        {/* OUTCOMES */}
        <div className="wrap">
          <div className="outcome-banner">
            <h2>What you walk away with</h2>
            <p className="k">Every graduate finishes with proof of work, not just a certificate.</p>
            <div className="grid4">
              <div className="oc"><div className="h">Production build skills</div><div className="d">Ship LLM apps, RAG and agents end to end — applied, not theoretical.</div></div>
              <div className="oc"><div className="h">A shipped system</div><div className="d">A deployed, multi-agent end-to-end project you can demo live.</div></div>
              <div className="oc"><div className="h">A public portfolio</div><div className="d">GitHub, LinkedIn and an AI-ready résumé template.</div></div>
              <div className="oc"><div className="h">A career path</div><div className="d">Role mapping, interview prep and next-step certifications.</div></div>
            </div>
          </div>

          {/* WHAT'S INCLUDED */}
          <div className="included" id="included">
            <h2>Everything Included</h2>
            <p className="k">Everything that comes with your enrollment — ready from day one.</p>
            <div className="inc-grid">
              <div className="inc-card">
                <div className="ic-ic"><Video /></div>
                <h3>Recorded sessions</h3>
                <p>Every live session is recorded and shared in our Skool community, from onboarding onward.</p>
                <a className="inc-link" href="https://www.skool.com/riviratech-innovations-9088/about" target="_blank" rel="noopener noreferrer">Visit Skool →</a>
              </div>
              <div className="inc-card">
                <div className="ic-ic"><Users /></div>
                <h3>Mentor &amp; 1:1 feedback</h3>
                <p>Personal mentor feedback on your work every alternate week.</p>
              </div>
              <div className="inc-card">
                <div className="ic-ic"><GraduationCap /></div>
                <h3>Certificate of completion</h3>
                <p>An industry-ready certificate awarded when you finish the program.</p>
              </div>
              <div className="inc-card">
                <div className="ic-ic"><Github /></div>
                <h3>GitHub project access</h3>
                <p>Starter repos, use-case code, and our <b>30-project hands-on library</b> — granted at onboarding.</p>
              </div>
              <div className="inc-card">
                <div className="ic-ic"><Cpu /></div>
                <h3>GPU Lab access</h3>
                <p>Hands-on model training on our <b>RTX 5090</b> GPU machine at the Alpharetta office (Week 13).</p>
              </div>
              <div className="inc-card">
                <div className="ic-ic"><MessagesSquare /></div>
                <h3>Community access</h3>
                <p>Join the Rivira Technologies Hub on WhatsApp for regular updates and peer support.</p>
                <a className="inc-link" href="https://chat.whatsapp.com/Jxu7XnwqibC8SeIeh7EGGb" target="_blank" rel="noopener noreferrer">Join WhatsApp →</a>
              </div>
              <div className="inc-card">
                <div className="ic-ic"><Rocket /></div>
                <h3>Portfolio &amp; career support</h3>
                <p>Résumé, LinkedIn, interview prep and a live project showcase (Week 16).</p>
              </div>
            </div>
          </div>

          {/* ENTERPRISE USE CASES — brochure p12. These are taught across the
              sixteen weeks rather than owned by any one of them, which is why
              they are a list here and not a week card. */}
          <div className="included" id="use-cases">
            <h2>14 enterprise use cases taught across the program</h2>
            <p className="k">The problems the weeks are aimed at — you meet each one inside the discipline that solves it.</p>
            <ul className="uc-list">
              {USE_CASES.map((u) => (
                <li key={u}><span className="uc-ck" aria-hidden="true">✓</span>{u}</li>
              ))}
            </ul>
          </div>

          {/* OPTIONAL CLASSES — brochure p13. Explicitly "in parallel with the
              scheduled classes; they are not counted within them", so they sit
              after the sixteen weeks and say so. */}
          <div className="included" id="optional">
            <h2>Additional &amp; optional classes</h2>
            <p className="k">These run <b>in parallel</b> with the scheduled classes and are not counted within them — optional, but each one connects what you're building to the people, tools and interviews on the other side of the program.</p>
            <div className="inc-grid">
              {OPTIONAL_CLASSES.map((c) => (
                <div key={c.h} className="inc-card">
                  <h3>{c.h}</h3>
                  <p>{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inside view-plan, at the end of it. The "Certificate of completion"
            card in the What's included grid above says one exists; this is what
            it looks like and what it takes to earn. It is on the DEFAULT tab
            deliberately — in view-prereq or view-projects it would be behind a
            hash nobody lands on. */}
        <SampleCertificate id="certificate" />
      </div>{/* /view-plan */}

      {/* ================= VIEW: PREREQUISITES ================= */}
      <div id="view-prereq" className="view" hidden={view !== "prereq"}>
        <section className="wrap" id="prerequisites">

          <div className="prq-hero">
            <span className="prq-badge">✓ Before you enroll</span>
            <h2>Prerequisites &amp; Readiness</h2>
            <p className="lead">This is an <b>applied, build-first program</b> — you'll ship real GenAI systems, not derive equations. You do <b>not</b> need any prior AI, machine-learning, or data-science experience, and Python is covered in the pre-work. What you do need is a working computer, a stable internet connection, and about 11–13 hours a week for {PROGRAM.durationWeeks} weeks. Everything below explains exactly how to get ready — and we walk you through setup live at onboarding.</p>
          </div>

          {/* FIT */}
          <div className="prq-block">
            <h3 className="prq-h">Is this course right for you?</h3>
            <div className="prq-grid">
              <div className="prq-card fit-yes">
                {/* No tick. The ticks in this card are the checklist's, drawn by
                    .prq-card li::before — one on the heading too made the heading
                    look like the first item of its own list, and its opposite
                    number ("Consider some prep first if…") never had one. */}
                <h3>You'll thrive here if…</h3>
                <ul>
                  <li>You're a <b>working IT professional</b> (developer, tester, analyst, admin, support) moving into AI</li>
                  <li>You're a <b>career-switcher, student or graduate</b> starting your AI journey</li>
                  <li>You're a <b>non-technical professional</b> (product, ops, marketing, business) who wants to build with AI, no code</li>
                  <li>You can commit <b>~11–13 hours per week</b> and enjoy learning by building</li>
                </ul>
              </div>
              <div className="prq-card fit-no">
                <h3>Consider some prep first if…</h3>
                <ul>
                  <li>You can't set aside the weekly time — the pace is steady and hands-on</li>
                  <li>You want <b>deep ML research / heavy mathematics</b> — this is an applied build course, not a theory degree</li>
                  <li>You've never installed software or used online tools — get comfortable with the basics first (we can help)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* SELF-CHECK */}
          <div className="prq-block">
            <h3 className="prq-h">Quick self-check</h3>
            <div className="prq-card">
              {/* A class, not the inline style this used to carry: it is the one
                  line in the card that introduces the list, and it was set
                  smaller and lighter than the list it introduces. */}
              <p className="prq-lead-in">If you can tick most of these, you're ready to start:</p>
              <ul>
                <li>I can install software and manage files on my computer</li>
                <li>I can use a web browser, sign up for online tools, and follow written steps</li>
                <li>I can join live video calls (Zoom) with camera and mic</li>
                <li>I can commit roughly <b>11–13 hours a week for {PROGRAM.durationWeeks} weeks</b></li>
                <li>I'm willing to write Python — week 1 teaches it, the pre-work below is the head start</li>
                <li>I'll <b>explore the basics of ML / DL / NLP</b> (listed below) before we start — no mastery needed; we teach from the ground up</li>
              </ul>
            </div>
          </div>

          {/* PRE-WORK */}
          <div className="prq-block">
            <h3 className="prq-h">Before Week 1 — your pre-work</h3>
            <div className="prq-card prq-wide">
              <p style={{ margin: "0 0 14px", color: "#334155", fontSize: ".9rem" }}>Python fundamentals are delivered as <b>self-paced pre-recorded lessons</b> inside our Skool community (shared at onboarding). Complete them before the first live class: week 1 covers Python for AI engineers properly, and arriving with the basics already in hand is what lets that week reach generators, decorators and your first LLM call.</p>
              <div className="modules">
                <div className="module"><span className="mnum">01</span><span className="mtitle">Python basics — variables, data types, operators</span><span className="mtime">~60 min</span></div>
                <div className="module"><span className="mnum">02</span><span className="mtitle">Control flow — if / elif / else, for &amp; while loops</span><span className="mtime">~60 min</span></div>
                <div className="module"><span className="mnum">03</span><span className="mtitle">Functions, arguments &amp; error handling</span><span className="mtime">~60 min</span></div>
                <div className="module"><span className="mnum">04</span><span className="mtitle">Data structures — lists, dicts, sets, tuples</span><span className="mtime">~60 min</span></div>
                <div className="module"><span className="mnum">05</span><span className="mtitle">Files, JSON &amp; working with data</span><span className="mtime">~45 min</span></div>
                <div className="module"><span className="mnum">06</span><span className="mtitle">Notebooks — Google Colab &amp; Jupyter basics</span><span className="mtime">~30 min</span></div>
                <div className="module"><span className="mnum">07</span><span className="mtitle">Account setup + environment test (checklist below)</span><span className="mtime">~45 min</span></div>
              </div>
              <div className="cost-note"><Timer size={15} aria-hidden="true" /> <b>Total pre-work: ~5–6 hours</b>, fully self-paced. It's the one thing we ask you to finish before Week 1 — it's what lets the live sessions stay hands-on.</div>
            </div>
          </div>

          {/* SETUP */}
          <div className="prq-block">
            <h3 className="prq-h">Your setup checklist</h3>
            <div className="prq-grid">
              <div className="prq-card">
                <h3><span className="pn">A</span> Hardware</h3>
                <ul>
                  <li>Laptop or desktop — <b>Windows, macOS or Linux</b></li>
                  <li><b>8 GB RAM</b> minimum (16 GB recommended)</li>
                  <li>~10 GB free disk space</li>
                  <li>Stable broadband internet</li>
                  <li>Webcam &amp; mic for live sessions</li>
                  <li><b>No GPU needed</b> — you'll get hands-on time on our RTX 5090 GPU lab at the Alpharetta office (Week 13)</li>
                </ul>
              </div>
              <div className="prq-card">
                <h3><span className="pn">B</span> Software (all free)</h3>
                <ul>
                  <li>Google Chrome or Edge, and <b>Zoom</b></li>
                  <li><b>A code editor / notebook — required:</b> VS Code, Google Antigravity <b>or</b> Jupyter Notebook (any one)</li>
                  <li><b>Coders:</b> Python 3.11+ (or Anaconda) &amp; Git</li>
                  <li>A browser + <b>Google Colab</b> covers the notebook work</li>
                  <li>GitHub Desktop client (optional)</li>
                </ul>
              </div>
              <div className="prq-card prq-wide">
                <h3><span className="pn">C</span> Accounts to create — what &amp; why</h3>
                <div className="prq-grid" style={{ gap: "2px 24px" }}>
                  <div>
                    <p className="sub first">AI model access</p>
                    <ul>
                      <li><b>OpenAI</b> — GPT models &amp; embeddings (pay-as-you-go)</li>
                      <li><b>Google AI Studio (Gemini)</b> — generous free tier</li>
                      <li><b>Anthropic Claude</b> — API access (pay-as-you-go)</li>
                      <li><b>Hugging Face</b> — free; open models &amp; datasets</li>
                      <li><b>Recommended:</b> one paid chat plan — <b>ChatGPT Plus, Claude Pro or Gemini Advanced</b> (any one)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="sub first">Cloud &amp; tools</p>
                    <ul>
                      <li><b>Google account</b> — Colab (free GPU) &amp; Vertex AI</li>
                      <li><b>Microsoft Azure</b> — free credits; Azure OpenAI (Wk 11)</li>
                      <li><b>AWS</b> — free-tier account; Bedrock (Wk 11)</li>
                      <li><b>GitHub</b> — free; your project repos live here</li>
                    </ul>
                  </div>
                  <div>
                    <p className="sub">Community</p>
                    <ul>
                      <li><b>Skool</b> — recordings &amp; community</li>
                      <li><b>WhatsApp</b> — the Rivira Technologies Hub for updates</li>
                    </ul>
                  </div>
                  <div>
                    <p className="sub">We help you set up</p>
                    <ul>
                      <li>Guided setup walkthrough at <b>onboarding</b></li>
                      <li>Step-by-step docs &amp; API-key guidance</li>
                      <li>Mentor support if anything won't install</li>
                    </ul>
                  </div>
                </div>
                <div className="cost-note"><CreditCard size={15} aria-hidden="true" /> <b>What about cost?</b> Most tools have free tiers (Gemini, Colab, Hugging Face, and new-account cloud credits). We <b>recommend one paid chat subscription</b> — ChatGPT Plus, Claude Pro or Gemini Advanced (~$20/mo, any one) — for the best hands-on experience, plus roughly <b>$10–25 total</b> of optional API credit across the course. We show free or low-cost alternatives wherever possible.</div>
              </div>
            </div>
          </div>

          {/* TIME */}
          <div className="prq-block">
            <h3 className="prq-h">Time commitment</h3>
            <div className="prq-grid">
              <div className="prq-card">
                {/* "W", not the clock emoji it replaced, and not an SVG.
                    .pn is a TEXT badge — its nineteen other instances hold
                    A/B/C, 1-4, ML/DL/NLP, L1/L2/L3, Sigma and </>, all white
                    glyphs on the gold pill. The clock was the only pictograph
                    in the set, so it rendered in full colour inside a gold
                    gradient and matched nothing beside it. An icon here would
                    be just as inconsistent as the emoji was; the fix is a
                    letter, paired with the Sigma on "Overall" below. */}
                <h3><span className="pn">W</span> Weekly</h3>
                <ul>
                  <li><b>Live classes — 6 hrs/week:</b> Tue·Wed·Thu·Fri 9–10 PM EST + Saturday 10 AM–12 PM EST</li>
                  <li><b>Self-study &amp; labs:</b> ~4–6 hrs/week</li>
                  <li><b>Capstone weeks (14–16):</b> heavier — the two builds are yours to design and ship</li>
                  <li><b>Plan for ~11–13 hrs/week</b></li>
                </ul>
              </div>
              <div className="prq-card">
                <h3><span className="pn">Σ</span> Overall</h3>
                <ul>
                  <li><b>{PROGRAM.durationWeeks} weeks</b> total — 13 teaching weeks + 3 capstone &amp; launch weeks</li>
                  <li>Roughly <b>180–210 hours</b> across the program</li>
                  <li>Missed a live session? <b>All sessions are recorded</b> in Skool</li>
                  <li>Mentor / 1:1 feedback on your work every alternate week</li>
                </ul>
              </div>
            </div>
          </div>

          {/* TRACKS */}
          <div className="prq-block">
            <h3 className="prq-h">One engineering path — what you'll actually be doing</h3>
            <div className="prq-grid">
              <div className="prq-card">
                <h3><span className="pn">{"</>"}</span> You will write code</h3>
                <ul>
                  <li>Build with <b>Python, LLM APIs, LangChain &amp; LangGraph</b></li>
                  <li>Use <b>VS Code, git &amp; GitHub</b> and the starter repos</li>
                  <li>Train and fine-tune with <b>PyTorch, Hugging Face, LoRA/PEFT</b></li>
                  <li>Deploy on <b>Azure OpenAI, AWS Bedrock &amp; Vertex AI</b></li>
                </ul>
              </div>
              <div className="prq-card">
                <h3><span className="pn">✦</span> You do not need to arrive fluent</h3>
                <ul>
                  <li><b>Week 1 teaches the Python</b> every model and agent stands on</li>
                  <li>The pre-work below is a head start, not an entry exam</li>
                  <li>No prior ML, deep-learning or data-science experience assumed</li>
                  <li>Best if you want to understand the internals, not only the outcome</li>
                </ul>
              </div>
            </div>
            <div className="cost-note"><Repeat size={15} aria-hidden="true" /> This is a single engineering track. The program used to split every week into a coder and a no-code path; the 16-week arc builds one system, week on week, so there is one path through it.</div>
          </div>

          {/* ML/DL/NLP CONCEPTS */}
          <div className="prq-block">
            <h3 className="prq-h">ML, DL &amp; NLP — concepts to explore before you start</h3>
            <p style={{ margin: "-4px 0 14px", color: "#334155", fontSize: ".9rem" }}>Please come in with <b>basic familiarity</b> of these — read up or watch a short intro on each concept before the program begins. You don't need to master them; just explore the terms so they aren't brand new. We'll then <b>guide you through ML / DL / NLP in the sessions</b> and apply them throughout. The more you've explored beforehand, the more you'll get from these weeks.</p>
            <div className="prq-grid">
              <div className="prq-card">
                <h3><span className="pn">ML</span> Machine Learning</h3>
                <p className="sub first">Core concepts</p>
                <ul>
                  <li>Supervised, unsupervised &amp; reinforcement learning</li>
                  <li>Train / test split &amp; cross-validation</li>
                  <li>Bias–variance, over/underfitting</li>
                  <li>Feature engineering, scaling &amp; encoding</li>
                </ul>
                <p className="sub">Algorithms</p>
                <ul>
                  <li>Linear &amp; Logistic Regression</li>
                  <li>Decision Trees &amp; Random Forest</li>
                  <li>Support Vector Machines (SVM)</li>
                  <li>K-Nearest Neighbors &amp; Naïve Bayes</li>
                  <li>K-Means &amp; Hierarchical clustering</li>
                  <li>PCA &amp; t-SNE (dimensionality reduction)</li>
                </ul>
                <p className="sub">Evaluation</p>
                <ul>
                  <li>Accuracy, Precision, Recall, F1, ROC-AUC</li>
                </ul>
              </div>
              <div className="prq-card">
                <h3><span className="pn">DL</span> Deep Learning</h3>
                <p className="sub first">Core concepts</p>
                <ul>
                  <li>Neurons, layers &amp; activation functions</li>
                  <li>Forward &amp; backpropagation</li>
                  <li>Gradient descent — SGD, Adam, RMSprop</li>
                  <li>Loss functions · epochs · batches · learning rate</li>
                  <li>Dropout, regularization &amp; tuning</li>
                  <li>Role of GPUs / TPUs</li>
                </ul>
                <p className="sub">Architectures</p>
                <ul>
                  <li>Feedforward Neural Networks</li>
                  <li>CNNs — images &amp; pattern recognition</li>
                  <li>RNNs, LSTM &amp; GRU — sequences</li>
                  <li>Transformers &amp; the attention mechanism</li>
                </ul>
              </div>
              <div className="prq-card">
                <h3><span className="pn">NLP</span> Natural Language Processing</h3>
                <p className="sub first">Preprocessing</p>
                <ul>
                  <li>Tokenization, stemming &amp; lemmatization</li>
                  <li>Stop-word removal &amp; normalization</li>
                  <li>Subword tokenization (BPE, WordPiece)</li>
                </ul>
                <p className="sub">Text representation</p>
                <ul>
                  <li>Bag-of-Words &amp; TF-IDF</li>
                  <li>Word embeddings — Word2Vec, GloVe, FastText</li>
                  <li>Contextual embeddings — BERT, ELMo</li>
                </ul>
                <p className="sub">Tasks &amp; models</p>
                <ul>
                  <li>Text classification, sentiment, NER</li>
                  <li>Naïve Bayes, Logistic Regression, SVM</li>
                  <li>RNN / LSTM sequence models</li>
                  <li>Transformers — BERT vs GPT</li>
                </ul>
              </div>
            </div>
          </div>

          {/* OPTIONAL PREP */}
          <div className="prq-block">
            <h3 className="prq-h">Optional prep to get ahead</h3>
            <div className="prq-card prq-wide">
              <ul>
                <li>Skim the <b>Week-1 term bank</b> on the Course Plan tab so the vocabulary feels familiar</li>
                <li>Spend 30 minutes prompting a free chat model (ChatGPT, Gemini or Claude) to get a feel for it</li>
                <li><b>Coders:</b> start the Python pre-work early and set up VS Code + Git</li>
                <li>Create your free accounts ahead of time so onboarding is quick</li>
              </ul>
            </div>
          </div>

          {/* FAQ */}
          <div className="prq-block">
            <h3 className="prq-h">Frequently asked questions</h3>
            <div className="faq">
              <div className="faq-item"><div className="q">Do I need a powerful computer or a GPU?</div><div className="a">No. An <b>8 GB-RAM laptop and a browser</b> are enough — we use Google Colab's free GPU and cloud platforms for anything heavy.</div></div>
              <div className="faq-item"><div className="q">Do I need to know Python already?</div><div className="a">No. <b>Week 1 is Python for AI engineers</b>, from syntax to decorators, and the pre-recorded pre-work lets you arrive with the basics already covered.</div></div>
              <div className="faq-item"><div className="q">Will I have to pay for AI usage?</div><div className="a">Mostly no — Gemini, Colab, Hugging Face and new cloud accounts have free tiers. Budget about <b>$10–25 total</b> of optional API credit for providers like OpenAI/Claude, and we show free alternatives where possible.</div></div>
              <div className="faq-item"><div className="q">What if I miss a live session?</div><div className="a">Every session is <b>recorded and posted in Skool</b>, so you can catch up anytime.</div></div>
              <div className="faq-item"><div className="q">Is there a certificate?</div><div className="a">Two things, and they are not the same. Week 12 is a full <b>Claude AI certification</b> week ending in a graded build project and assessment; separately, you receive a <b>certificate of completion</b> once you finish the program and both capstones.</div></div>
              <div className="faq-item"><div className="q">How many capstone projects do I build?</div><div className="a"><b>Two by default</b> — an Enterprise Knowledge Assistant in production RAG (week 14) and a multi-agent Support System orchestrated in LangGraph (week 15) — with scope for up to four. Week 16 ships and operates both.</div></div>
              <div className="faq-item"><div className="q">Do I get the project code?</div><div className="a">Yes — <b>starter repos and use-case code are shared via GitHub</b> at onboarding.</div></div>
              <div className="faq-item"><div className="q">Is it truly beginner-friendly?</div><div className="a">Yes. We start from <b>zero AI knowledge</b>; the term bank and pre-work bring everyone to the same baseline before the build begins.</div></div>
            </div>
          </div>

          {/* CTA */}
          <div className="prq-cta">
            <div className="t">Still not sure you're ready?<span>Reach out and we'll walk you through the 16 weeks before you enroll.</span></div>
            <Link to="/enroll">Enroll now →</Link>
          </div>

        </section>
      </div>{/* /view-prereq */}

      {/* ================= VIEW: GITHUB PROJECTS ================= */}
      <div id="view-projects" className="view" hidden={view !== "projects"}>
        <section className="wrap" id="projects">

          <div className="prq-hero">
            <span className="prq-badge">✓ Hands-on portfolio</span>
            <h2>30 GitHub Projects — build a serious portfolio</h2>
            <p className="lead">Beyond the live use cases, every enrolled student gets access to a curated library of <b>30 hands-on projects</b> in our GitHub training organization — structured across three levels so you keep building real, portfolio-ready systems at your own pace. Hit a roadblock? Your <b>mentor guides you through the implementation</b> so you never stay stuck.</p>
          </div>

          {/* LEVELS */}
          <div className="prq-block">
            <h3 className="prq-h">Three levels · 10 projects each</h3>
            {/* Was an inline gridTemplateColumns:repeat(3,1fr). Inline styles beat
                every stylesheet rule, so the <=700px stacking rule below could
                never apply and L1/L2/L3 stayed in three squeezed columns on a
                390px screen (QA D2 #13). Moved to .prq-grid-3 so it's responsive. */}
            <div className="prq-grid prq-grid-3">
              <div className="prq-card lvl-card">
                <h3><span className="pn">L1</span> Beginner</h3>
                <p style={{ margin: "0 0 10px", color: "#1F2937", fontSize: ".9rem", fontWeight: 600 }}>10 foundation projects</p>
                <ul>
                  <li>Get hands-on and build confidence</li>
                  <li>Core AI, ML &amp; GenAI building blocks</li>
                  <li>Perfect first entries for your portfolio</li>
                </ul>
              </div>
              <div className="prq-card lvl-card">
                <h3><span className="pn">L2</span> Intermediate</h3>
                <p style={{ margin: "0 0 10px", color: "#1F2937", fontSize: ".9rem", fontWeight: 600 }}>10 projects · multiple domains</p>
                <ul>
                  <li>Real-world applications you can demo</li>
                  <li>Spanning industries &amp; domains</li>
                  <li>RAG, agents &amp; applied GenAI patterns</li>
                </ul>
              </div>
              <div className="prq-card lvl-card">
                <h3><span className="pn">L3</span> Advanced</h3>
                <p style={{ margin: "0 0 10px", color: "#1F2937", fontSize: ".9rem", fontWeight: 600 }}>10 projects · multiple domains</p>
                <ul>
                  <li>Production-grade, complex systems</li>
                  <li>End-to-end, multi-domain builds</li>
                  <li>Portfolio pieces that stand out to employers</li>
                </ul>
              </div>
            </div>
          </div>

          {/* LEVEL 1–3 PROJECT LISTS (added to the static page by PRs #50/#52) */}
          {PROJECT_LEVELS.map((lvl) => (
            <div className="prq-block" key={lvl.tag}>
              <div className="lvl-head">
                <span className="lvl-tag">{lvl.tag}</span>
                <h3 className="prq-h" style={{ margin: 0 }}>{lvl.heading}</h3>
                <span className="lvl-count">{lvl.count}</span>
              </div>
              <div className="proj-list">
                {lvl.projects.map((p, i) => (
                  <div className="proj-item" key={p.title}>
                    <div className="proj-item-head">
                      <span className="proj-num">{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <h4 className="proj-title">{p.title}</h4>
                        <span className="proj-ind">{p.industry}</span>
                      </div>
                    </div>
                    <p className="proj-desc">{p.desc}</p>
                    {/* Capitalised here rather than in the 30 strings in
                        coursePlanData. Mobile QA 07-09 item 8 asks for the
                        first skill after the label to start with a capital;
                        doing it at the render site fixes every card at once
                        and keeps the 31st entry right on the day it is added,
                        which 30 hand-edits would not.

                        Idempotent on the ones already capitalised -- several
                        open on proper nouns ("Pinecone metadata filtering",
                        "StateGraph design", "W&B experiment tracking") and
                        toUpperCase on an existing capital returns it
                        unchanged. NOT text-transform: capitalize, which would
                        also capitalise every word after the first. */}
                    <p className="proj-teaches">
                      <b>Teaches:</b> {p.teaches.charAt(0).toUpperCase() + p.teaches.slice(1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* WHAT EACH INCLUDES */}
          <div className="prq-block">
            <h3 className="prq-h">What every project includes</h3>
            <div className="prq-grid">
              <div className="prq-card"><h3><span className="pn">1</span> Problem statement</h3><p style={{ margin: 0, color: "#1F2937", fontSize: ".88rem", lineHeight: 1.55 }}>A clear, real-world problem to solve — the "why" behind the build.</p></div>
              <div className="prq-card"><h3><span className="pn">2</span> Objective</h3><p style={{ margin: 0, color: "#1F2937", fontSize: ".88rem", lineHeight: 1.55 }}>Exactly what you'll build and the outcome you'll achieve.</p></div>
              <div className="prq-card"><h3><span className="pn">3</span> System architecture</h3><p style={{ margin: 0, color: "#1F2937", fontSize: ".88rem", lineHeight: 1.55 }}>The design and components, mapped out before you code.</p></div>
              <div className="prq-card"><h3><span className="pn">4</span> Step-by-step guide</h3><p style={{ margin: 0, color: "#1F2937", fontSize: ".88rem", lineHeight: 1.55 }}>An implementation walkthrough from setup to finished build.</p></div>
            </div>
          </div>

          {/* MENTOR + ACCESS */}
          <div className="prq-block">
            <div className="prq-grid">
              <div className="prq-card"><h3><span className="pn">5</span> Mentor-guided</h3><p style={{ margin: 0, color: "#1F2937", fontSize: ".88rem", lineHeight: 1.55 }}>Stuck on a step? Your mentor walks you through the implementation and clears any roadblock — you learn by finishing, not by getting lost.</p></div>
              <div className="prq-card"><h3><span className="pn">6</span> GitHub access</h3><p style={{ margin: 0, color: "#1F2937", fontSize: ".88rem", lineHeight: 1.55 }}>Granted at onboarding through our GitHub training organization — yours to build, fork and showcase to employers.</p></div>
            </div>
          </div>

          <div className="prq-cta">
            <div className="t">30 projects · 3 levels · one standout portfolio<span>Full access is included with your seat — keep building beyond the live sessions.</span></div>
            <Link to="/enroll">Enroll now →</Link>
          </div>

        </section>
      </div>{/* /view-projects */}
    </div>
  );
}
