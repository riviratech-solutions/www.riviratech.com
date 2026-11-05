import { useEffect, useState, type ReactNode } from "react";
import { Brain, Puzzle, Bot, MessageSquare, Zap, Rocket, Laptop, ArrowRight, BadgeCheck, Radio, Hammer, Users } from "lucide-react";
import WorkshopRegisterModal from "../../modals/WorkshopRegisterModal";
import { SitePage, PageHero, Section, SectionHead, CardGrid, Split, Steps, Checklist, FaqBlock, EndBanner } from "../../components/site/PageKit";
import { anim } from "../../utils/riviraReveal";
import { getSeoByPath } from "../../utils/seo";
import { siteFetch } from "../../utils/siteCache";
import { bootcampDates } from "../../utils/dateRange";

const seo = getSeoByPath("workshop");


const NEXT_UP_TOPIC = "Generative AI overview";

const FEATURED_FALLBACK = {
  badge: "Live bootcamp",
  title: "AI Agents & Agentic Framework",
  duration: "20+ hours",
  dates: "", // "November 2 – December 2, 2026", from the live bootcamp's start / expiry (Admin → Workshops)
  cadence: "Weekends only",
  times: "11:00 AM EST  |  8:30 PM IST",
  mentor: "AI expert with 10+ years of industry experience",
  learn: [
    "Build AI agents",
    "Create RAG applications",
    "Automate business workflows",
    "Build portfolio projects",
    "Explore AI career opportunities",
    "Learn with or without coding",
  ],
  zoomLabel: "Reserve your free Zoom seat",
  zoomUrl: "https://us06web.zoom.us/webinar/register/WN_akdasBr6SNyBHmmaTAHA6g",
  whatsappLabel: "Join the WhatsApp community",
  whatsappUrl: "https://chat.whatsapp.com/H0fS0kaaEIBG3zYH6LQ7FR",
  teachTags: ["Live on Zoom", "Weekends only", "Coders & non-coders"],
  joinText:
    "Registration is on Zoom — you'll get the joining link and reminders by email. " +
    "Seats are limited so the Q&A stays useful.",
  joinTags: ["Free", "No card needed", "Limited seats"],
  // "October 2026" while the live bootcamp's start (Admin → Workshops) is still
  // ahead; "" otherwise, and the page then leaves "next session" out
  nextSession: "",
  // when the bootcamp stops being shown (ms; 0 = no expiry)
  expireMs: 0,
};

type Featured = typeof FEATURED_FALLBACK;

const splitTags = (s: unknown) =>
  typeof s === "string" ? s.split(",").map((t) => t.trim()).filter(Boolean) : [];
const splitLines = (s: unknown) =>
  typeof s === "string" ? s.split("\n").map((t) => t.trim()).filter(Boolean) : [];

function fromApi(row: Record<string, any>): Featured {
  const f = FEATURED_FALLBACK;
  const learn = splitLines(row.learn_items);
  const teachTags = splitTags(row.teach_tags);
  const joinTags = splitTags(row.join_tags);
  return {
    badge: row.badge || f.badge,
    title: row.title || f.title,
    duration: row.duration ?? f.duration,
    // "November 2 – December 2, 2026", from the start and expiry dates
    dates: bootcampDates(row.start_at, row.expire_at),
    cadence: row.cadence ?? f.cadence,
    times: row.times ?? f.times,
    mentor: row.mentor ?? f.mentor,
    learn: learn.length ? learn : f.learn,
    // A button needs BOTH halves: a label with no link renders a dead control,
    // so an incomplete pair falls back rather than shipping one.
    zoomLabel: row.zoom_url ? (row.zoom_label || f.zoomLabel) : f.zoomLabel,
    zoomUrl: row.zoom_url || f.zoomUrl,
    whatsappLabel: row.whatsapp_url ? (row.whatsapp_label || f.whatsappLabel) : f.whatsappLabel,
    whatsappUrl: row.whatsapp_url || f.whatsappUrl,
    teachTags: teachTags.length ? teachTags : f.teachTags,
    joinText: row.join_text ?? f.joinText,
    joinTags: joinTags.length ? joinTags : f.joinTags,
    nextSession: nextSessionText(row.start_at),
    expireMs: Number(row.expire_at) > 0 ? Number(row.expire_at) * 1000 : 0,
  };
}

/** "October 2026" for a start time (Unix seconds) still in the future, else "". */
function nextSessionText(startAt: unknown): string {
  const ms = Number(startAt) * 1000;
  if (!ms || ms <= Date.now()) return "";
  return new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const HOST_PROOF = [
  "Live & hands-on training",
  "Practising AI trainers",
  "Build-first learning",
  "For professionals, career-switchers & non-coders",
];

type Topic = {
  icon: typeof Brain;
  title: string;
  desc: string;
  chips: string[];
  nextSession?: string;
  upcoming?: boolean;
};

const TOPICS: Topic[] = [
  {
    icon: Brain,
    title: "Generative AI overview",
    desc: "What LLMs actually do, where they fit, and where they don't. Plain language, real examples.",
    chips: ["How LLMs work", "Use cases", "Limits & risks"],
  },
  {
    icon: Puzzle,
    title: "AI agents and RAG",
    desc: "What they are, why teams are building them, and a walkthrough of a simple agent in action.",
    chips: ["Tool calling", "Retrieval", "Live agent demo"],
  },
  {
    icon: Bot,
    title: "Agentic AI and MCP",
    desc: "Teams of agents that plan, delegate and review — and MCP, the standard that safely connects them to your tools and data.",
    chips: ["Multi-agent", "MCP", "A2A"],
  },
  {
    icon: MessageSquare,
    title: "Prompt engineering",
    desc: "Patterns that reliably shape model output — system prompts, few-shot examples and structured, machine-readable results.",
    chips: ["System prompts", "Few-shot", "Structured output"],
  },
  {
    icon: Zap,
    title: "Workflow automation with AI",
    desc: "Tools to automate real tasks at work. Demos using spreadsheets, email, and document workflows.",
    chips: ["Email", "Spreadsheets", "Documents"],
  },
  {
    icon: Rocket,
    title: "Career roadmap & learning path",
    desc: "Roles, skills and a portfolio plan — plus honest guidance on which track fits where you are, not where we want to sell you.",
    chips: ["AI roles", "Portfolio plan", "Learning tracks"],
  },
];

const TAKEAWAYS = [
  { h: "A working example", d: "You'll have actually built or run something live during the hands-on exercise — not just watched." },
  { h: "Practical takeaways", d: "Prompts, tools and patterns you can apply to your own work or study immediately." },
  { h: "A clearer direction", d: "Honest guidance on where to go next and which learning path fits where you are." },
  { h: "Resources to keep", d: "A curated list of links and next steps so you can keep learning after the session ends." },
];

const AGENDA = [
  { time: "0:00 – 0:10", title: "Intros and what to expect" },
  { time: "0:10 – 0:35", title: "Topic walkthrough with live demos" },
  { time: "0:35 – 0:55", title: "Hands-on exercise (you actually try something)" },
  { time: "0:55 – 1:15", title: "Q&A with the trainer" },
  { time: "1:15 – 1:30", title: "Next steps and learning resources" },
];

const STEPS = [
  { n: "1", title: "Register", desc: "Fill the short form and pick the topic and date that fit you." },
  { n: "2", title: "Get the link", desc: "We'll email you the online meeting link and a calendar invite." },
  { n: "3", title: "Show up", desc: "Join live from your laptop. Come with your questions — the Q&A is real." },
  { n: "4", title: "Keep going", desc: "Leave with resources and next steps, and join another topic whenever you like." },
];

const WHO_FOR: ReactNode[] = [
  <><b>Curious about AI</b> but unsure where to start</>,
  <>Tried AI tools but <b>want more depth</b></>,
  <>A <b>professional</b> wanting to use AI at work</>,
  <>Considering an <b>AI career switch</b> and weighing your options</>,
  <>A <b>coder or a non-coder</b> — both are welcome</>,
];

const FAQ: { q: string; a: ReactNode }[] = [
  { q: "Is it actually free?", a: <>Yes — <b>no payment, no card</b>. We run free workshops to introduce people to our way of teaching.</> },
  { q: "Do I need any technical background?", a: <><b>No.</b> Most workshops are designed to be useful whether you've written code or not. We mention when a topic is more advanced.</> },
  { q: "Will it just be a sales pitch?", a: <><b>No.</b> It's a real, hands-on session with genuine teaching. We'll mention our full program at the end, but only if you want to go deeper.</> },
  { q: "How big are the sessions?", a: <>We <b>cap each workshop</b> so the Q&A actually works and you can get your questions answered — <b>seats are limited</b>.</> },
  { q: "Can I join more than one?", a: <><b>Absolutely.</b> Workshops rotate through different topics, so many people attend several over time.</> },
  { q: "Is it suitable for students or complete beginners?", a: <><b>Yes.</b> Sessions are <b>beginner-friendly</b> by design, and we flag when a topic goes more advanced.</> },
  { q: "Will there be a recording?", a: <>The workshops are <b>live and interactive</b>. Register and we'll let you know what resources you'll receive afterward.</> },
];

/* CoursePlan.css colours h2 dark for the light sections; on the navy panel it
   has to be overridden or the title is invisible. */
export default function Workshop() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTopic, setModalTopic] = useState("");
  const openRegister = (topic = "") => { setModalTopic(topic); setModalOpen(true); };

  // the live bootcamp from Admin → Workshops; null = none to show (no live
  // one, it has expired, or the API didn't answer) and the panel is left out
  const [featured, setFeatured] = useState<Featured | null>(null);

  // PhoneInput plugin for the "Reserve your seat" modal (form.wkform #phone).
  useEffect(() => {
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

  // Featured workshop from admin → Workshops. The API leaves out an expired
  // one; the expiry is checked here too, because the answer is saved for 10
  // minutes (utils/siteCache.ts).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await siteFetch("api/get-workshop", { method: "post" });
        const row = res.data?.success ? res.data.data : null;
        const current = row ? fromApi(row) : null;
        if (alive) setFeatured(current && (!current.expireMs || current.expireMs > Date.now()) ? current : null);
      } catch (err) {
        console.log(err);
        if (alive) setFeatured(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  // still open when the expiry passes: the panel goes at that moment
  useEffect(() => {
    if (!featured || !featured.expireMs) return;
    const left = featured.expireMs - Date.now();
    if (left <= 0) { setFeatured(null); return; }
    if (left > 2 ** 31 - 1) return; // over ~24 days away: a timer can't wait that long; a later visit re-checks
    const t = setTimeout(() => setFeatured(null), left);
    return () => clearTimeout(t);
  }, [featured]);

  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <WorkshopRegisterModal open={modalOpen} onClose={() => setModalOpen(false)} topic={modalTopic} />

      <PageHero
        crumb="Free Workshop"
        eyebrow="Free · Hands-on · Online & live"
        title="Generative AI"
        accent="workshops"
        text="Free, practical sessions where you build something instead of watching a webinar — AI agents, RAG, prompting and automation, worked through live with the real tools. No payment, no card, open to coders and non-coders."
        image="/images/pages/events.webp"
        imageAlt="A live workshop with a presenter screen and an online audience"
        actions={[{ label: "Register for a Workshop", onClick: () => openRegister() }, { label: "See the Full Program", to: "/course-plan", ghost: true }]}
        facts={[
          { icon: BadgeCheck, label: "Free · no card" },
          { icon: Radio, label: "Live & online" },
          { icon: Hammer, label: "Hands-on" },
          { icon: Users, label: "All levels" },
        ]}
      />

      {featured && (
        <Section tone="white">
          <div className="rv-featured" {...anim("zoomIn", 100)}>
            <span className="rv-featured__badge">{featured.badge}</span>
            <h2 className="rv-h2 rv-light" id="featured-bootcamp">{featured.title}</h2>
            <div className="rv-chips" style={{ marginTop: 18 }}>
              {[featured.dates, featured.cadence, featured.times, featured.duration && `${featured.duration} live`]
                .filter(Boolean)
                .map((chip) => <span key={chip as string} className="rv-chip">{chip}</span>)}
            </div>
            <div className="rv-btn-row" style={{ marginTop: 26 }}>
              {featured.zoomUrl && (
                <a className="rv-btn" href={featured.zoomUrl} target="_blank" rel="noopener noreferrer">
                  {featured.zoomLabel} <ArrowRight size={15} aria-hidden="true" />
                </a>
              )}
              {featured.whatsappUrl && (
                <a className="rv-btn rv-btn--ghost-light" href={featured.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  {featured.whatsappLabel}
                </a>
              )}
            </div>
            <div className="rv-featured__grid">
              <div className="rv-icard">
                <h3 className="rv-h5">What you'll learn</h3>
                <Checklist items={featured.learn} />
              </div>
              <div className="rv-icard">
                <h3 className="rv-h5">Who's teaching</h3>
                <p>{featured.mentor}.</p>
                <div className="rv-chips">{featured.teachTags.map((t) => <span key={t} className="rv-chip">{t}</span>)}</div>
              </div>
              <div className="rv-icard">
                <h3 className="rv-h5">How to join</h3>
                <p>{featured.joinText}</p>
                <div className="rv-chips">{featured.joinTags.map((t) => <span key={t} className="rv-chip">{t}</span>)}</div>
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section tone={featured ? "page" : "white"}>
        <SectionHead split eyebrow="Every month" title="Our regular free workshops"
          text="Free 90-minute sessions rotating through these topics. Register for the one that fits — or several — and we'll email you the date and joining link." />
        <div className="rv-icards rv-icards--3">
          {TOPICS.map((t, i) => {
            // "Next up" only while there is an upcoming session
            const isNext = t.upcoming ?? (!!NEXT_UP_TOPIC && t.title === NEXT_UP_TOPIC && !!featured?.nextSession);
            const when = t.nextSession
              ? `Next session · ${t.nextSession}`
              : isNext && featured?.nextSession
                ? `Next session · ${featured.nextSession}`
                : "90 minutes · Live on Zoom";
            return (
              <article key={t.title} className={`rv-icard rv-lift${isNext ? " rv-icard--next" : ""}`} {...anim("fadeInUp", (i % 3) * 90)}>
                <span className="rv-icard__icon"><t.icon size={24} aria-hidden="true" /></span>
                {isNext && <span className="rv-icard__flag">Next up</span>}
                <h3 className="rv-h5">{t.title}</h3>
                <p>{t.desc}</p>
                <div className="rv-chips">{t.chips.map((c) => <span key={c} className="rv-chip">{c}</span>)}</div>
                <div className="rv-icard__foot">
                  <span>{when}</span>
                  <button type="button" className="rv-btn rv-btn--sm" onClick={() => openRegister(t.title)}>
                    Register <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Outcomes" title="What you'll walk away with"
          text="Bootcamp or 90-minute session, every workshop is built around things you can use the very next day." />
        <CardGrid cols={4} items={TAKEAWAYS.map((t) => ({ title: t.h, text: t.d }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="The agenda" title="A typical 90-minute session" text="Every workshop follows the same simple structure, so you know exactly what to expect." />
        <Steps items={AGENDA.map((a) => ({ title: a.title, text: a.time }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="How to join" title="Three steps to your seat" />
        <Steps items={STEPS.map((s) => ({ title: s.title, text: s.desc }))} />
        <p className="rv-text" style={{ marginTop: 40, textAlign: "center" }}>
          <Laptop size={16} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6, color: "var(--rv-purple)" }} />
          <strong>What you need:</strong> a laptop or desktop, a stable internet connection, and a free account for the tool that session uses — we'll tell you in advance.
        </p>
      </Section>

      <Section tone="white">
        <Split
          image="/images/hero-about-card.webp"
          eyebrow="Who it's for"
          title="Made for the curious — and run by people who build"
          text="Every workshop is led by a practising trainer who builds real AI systems. It's the best way to see how Rivira Tech teaches — practical, build-first and honest about what AI can and can't do — before committing to a full program."
          bullets={WHO_FOR}
          actions={[{ label: "Register Now", onClick: () => openRegister() }]}
        >
          <div className="rv-chips" style={{ marginTop: 20 }}>{HOST_PROOF.map((p) => <span key={p} className="rv-chip">{p}</span>)}</div>
        </Split>
      </Section>

      <Section>
        <FaqBlock items={FAQ} title="Questions about the workshops" />
      </Section>

      <EndBanner
        eyebrow="Limited seats"
        title="Save your seat for the next workshop"
        text={<>Small groups keep sessions interactive and every question answered{featured?.nextSession ? <> — next session: {featured.nextSession}.</> : "."}</>}
        actions={[{ label: "Register for the Next Workshop", onClick: () => openRegister() }, { label: "Talk to Us", to: "/contact", ghost: true }]}
      />
    </SitePage>
  );
}
