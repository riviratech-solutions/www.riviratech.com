import {
  GraduationCap,
  Zap,
  Workflow,
  Users,
  Hammer,
  MessageSquare,
  Route as RouteIcon,
  Lightbulb,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Split,
  Steps,
  StatRow,
  EndBanner,
} from "../../components/site/PageKit";

const WHAT_WE_DO = [
  {
    icon: GraduationCap,
    title: "Training programs",
    tag: "Students · Professionals · Teams",
    what:
      "Structured AI learning tracks, cohort-based and mentor-led, built around a real project from the first week rather than a final one.",
    who:
      "People choosing a direction, professionals moving into AI roles, and teams inside organisations that have decided AI is now part of the job.",
    keywords: ["Cohort-based", "Mentor-led", "Project from week one", "Portfolio review"],
    to: "/programs",
    linkLabel: "See the programs",
  },
  {
    icon: Zap,
    title: "AI POCs and product development",
    tag: "Prototype · Build · Handover",
    what:
      "A focused prototype that validates an idea on your own data before serious budget is committed — and the full build when it proves out, through architecture, iteration, deployment and handover.",
    who:
      "Teams weighing up AI before investing, and companies who need the thing made rather than explained.",
    keywords: ["RAG", "Agents", "LLMs", "Cloud deployment", "Handover"],
    to: "/business",
    linkLabel: "See what we build",
  },
  {
    icon: Workflow,
    title: "Business automation",
    tag: "Agents · Integration · Enablement",
    what:
      "Repetitive workflows automated with AI tools and agents, integrated with the systems a team already uses, and documented so the team can run them without us.",
    who:
      "Operations, marketing and support teams losing hours a week to work that does not need a person.",
    keywords: ["Workflow audit", "Agent setup", "Integration", "Documentation"],
    to: "/services",
    linkLabel: "See the services",
  },
];

/* The teaching approach. Every line here is something the Course Plan, Enroll
   or Services page already commits to. */
const APPROACH = [
  {
    icon: Hammer,
    title: "Projects first",
    desc:
      "Learning is organised around building something that works. Concepts arrive when a build needs them, which is when they are easiest to keep.",
  },
  {
    icon: Users,
    title: "Small cohorts, real mentors",
    desc:
      "Cohorts stay small enough that a mentor knows your work. Personal feedback on what you have built, not a graded quiz.",
  },
  {
    icon: MessageSquare,
    title: "Live, not recordings alone",
    desc:
      "Weekly live Q&A with instructors, plus day-to-day support in the community — so being stuck is a short state rather than the end of the course.",
  },
  {
    icon: RouteIcon,
    title: "Honest career guidance",
    desc:
      "Skills-gap assessment, a learning roadmap, portfolio and resume support, mock interviews. No inflated promises about what a certificate is worth.",
  },
];

/* The service lines as Services.tsx defines them, condensed. Same order and
   the same words, so the two pages read as one company. */
const SERVICES = [
  {
    kind: "Training",
    title: "AI training programs",
    who: "Students, professionals and corporate teams",
    desc: "Custom curriculum, live mentor-led cohorts, a real project from week one, and a portfolio review at the end.",
    detail: ["Curriculum aligned to your goals", "Live cohorts", "Certificate and portfolio review"],
  },
  {
    kind: "Product",
    title: "AI product development",
    who: "Startups and growth-stage companies",
    desc: "End-to-end AI products built around a business problem, from discovery through launch.",
    detail: ["Discovery and scoping", "Architecture and stack choices", "Deployment and handover"],
  },
  {
    kind: "Validation",
    title: "AI proof of concepts",
    who: "Teams evaluating AI before investing",
    desc: "A short sprint that tests the assumption on your own data, ending in a recommendation you can act on.",
    detail: ["Working prototype", "Feasibility and risks", "A clear go or no-go"],
  },
  {
    kind: "Automation",
    title: "Business automation",
    who: "Operations, marketing and support teams",
    desc: "Repetitive workflows handed to AI tools and agents, wired into the systems already in use.",
    detail: ["Workflow audit", "Tool and agent setup", "Team enablement"],
  },
  {
    kind: "Advisory",
    title: "AI consulting",
    who: "Leaders planning AI adoption",
    desc: "Strategy, tooling and upskilling advice, aimed at avoiding the expensive mistakes rather than selling more of them.",
    detail: ["Readiness assessment", "Use-case prioritisation", "Build vs. buy guidance"],
  },
  {
    kind: "Careers",
    title: "Career guidance",
    who: "Freshers and professionals moving into AI",
    desc: "One-to-one mentoring for people making the move, with guidance that stays honest about the market.",
    detail: ["Skills-gap assessment", "Portfolio and resume support", "Mock interviews"],
  },
];

const VISION = [
  {
    title: "One partner from learning to launching",
    desc:
      "Most organisations meet AI twice: once as something their people need to learn, and once as something their product needs to do. Covering both is the point — the same team that trains a group can build the thing they were training for.",
  },
  {
    title: "Practical skills that survive the hype cycle",
    desc:
      "Tools change every few months. The goal is people who can pick up the next framework because they understand what it is doing, not people who memorised the current one.",
  },
  {
    title: "AI worth adopting, proven before it is bought",
    desc:
      "Validate on real data, in weeks, before the budget conversation. A clear go or no-go is a better outcome than an expensive maybe.",
  },
];

export default function Page() {
  return (
    <SitePage
      title="About Us — Rivira Tech | AI Training & AI Product Development"
      desc="Rivira Tech is an AI training and product company: we teach generative AI to students, professionals and teams, and build AI products for businesses."
      keywords="About Rivira Tech, AI training company, AI product development, generative AI education"
    >
      <PageHero
        crumb="About Us"
        eyebrow="Who we are"
        title="Practical AI,"
        accent="taught and built"
        text="We help students, professionals and businesses learn generative AI and build practical projects — and we build AI products for organisations that need one made rather than explained."
        image="/images/pages/about.webp"
        imageAlt="Mentors and learners around a live coding session"
        actions={[{ label: "Explore Programs", to: "/programs" }, { label: "Talk to a Specialist", to: "/contact", ghost: true }]}
        facts={[
          { icon: Users, label: "Cohort-based Training" },
          { icon: Hammer, label: "Projects from Week One" },
          { icon: Lightbulb, label: "AI POCs & Products" },
          { icon: Workflow, label: "Business Automation" },
        ]}
      />

      <Section tone="white">
        <Split
          image="/images/hero-about-card.webp"
          eyebrow="Our story"
          title="An AI company that teaches — and a teacher that ships"
          text={<>
            <p>Rivira Tech teaches generative AI to people who intend to use it — students choosing a direction, professionals moving into AI roles, and teams whose organisations have decided AI is now part of the job. We also build AI systems for businesses that need one made rather than explained.</p>
            <p>Those two halves are deliberately one company. Teaching what we also ship keeps the curriculum honest: the tools taught are the tools used, and the problems discussed in class are the ones we met on a build that week.</p>
          </>}
          badge={{ value: "5,000+", label: "learners trained" }}
        />
        <div style={{ marginTop: 72 }}>
          <StatRow stats={[
            { value: "5,000+", label: "Learners trained" },
            { value: "6", label: "AI programs" },
            { value: "50+", label: "Live projects built" },
            { value: "98%", label: "Satisfaction rate" },
          ]} />
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="What we do" title="Three things, done properly" text="Each has a page of its own with the detail — this is the map." />
        <CardGrid cols={3} items={WHAT_WE_DO.map((w) => ({ icon: w.icon, meta: w.tag, title: w.title, text: <>{w.what}<br /><br /><strong style={{ color: "var(--rv-ink)" }}>Who it's for:</strong> {w.who}</>, chips: w.keywords, to: w.to, linkLabel: w.linkLabel }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="How we teach" title="Our approach to AI education" text="A course you finish is worth more than a course you enrol in. Everything here exists to make finishing the likely outcome." />
        <CardGrid cols={4} items={APPROACH.map((a) => ({ icon: a.icon, title: a.title, text: a.desc }))} />
      </Section>

      <Section tone="white">
        <SectionHead split eyebrow="For organisations" title="Our AI business services"
          text="What companies come to us for, and who each service is for." actions={[{ label: "All Services", to: "/services" }]} />
        <CardGrid cols={3} items={SERVICES.map((s) => ({ meta: s.kind, title: s.title, text: <>{s.desc}<br /><br /><strong style={{ color: "var(--rv-ink)" }}>For:</strong> {s.who}</>, list: s.detail }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Where we're going" title="Our vision and goals" />
        <Steps items={VISION.map((v) => ({ title: v.title, text: v.desc }))} />
      </Section>

      <EndBanner
        eyebrow="Start where it suits you"
        title="Learn with us, or build with us"
        text="Sit in on a free workshop, read the curriculum before committing to anything, or bring us a problem and we'll tell you honestly whether AI is the right tool for it."
        actions={[{ label: "Join a Free Workshop", to: "/workshop" }, { label: "Talk to Us", to: "/contact", ghost: true }]}
      />
    </SitePage>
  );
}
