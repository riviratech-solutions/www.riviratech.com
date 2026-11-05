import { getSeoByPath } from "../../utils/seo";
import {
  Layers,
  Zap,
  Brain,
  Workflow,
  GraduationCap,
  Target,
  Compass,
  Pencil,
  HardHat,
  TestTube,
  LineChart,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  ImageCards,
  Chips,
  CtaBand,
} from "../../components/site/PageKit";

const seo = getSeoByPath("services");

const SERVICE_OFFERINGS = [
  {
    icon: GraduationCap,
    title: "AI Training Programs",
    summary:
      "Structured AI learning tracks for individuals and teams. Cohort-based, mentor-led, project-driven.",
    who: "Students, professionals, and corporate teams.",
    deliverables: [
      "Custom curriculum aligned to your goals",
      "Live mentor-led cohorts",
      "Real project from week one",
      "Certificate and portfolio review",
    ],
  },
  {
    icon: Layers,
    title: "AI Product Development",
    summary:
      "End-to-end AI products built around your business problem — from design through launch.",
    who: "Startups and growth-stage companies.",
    deliverables: [
      "Product discovery and scoping",
      "Architecture and tech stack choices",
      "Iterative build with weekly demos",
      "Deployment, monitoring, and handover",
    ],
  },
  {
    icon: Zap,
    title: "AI Proof of Concepts",
    summary:
      "A focused prototype that validates an AI idea quickly, before you commit serious budget.",
    who: "Teams evaluating AI before investing.",
    deliverables: [
      "Two to four week sprint",
      "Working prototype on your data",
      "Feasibility report and risks",
      "Go / no-go recommendation",
    ],
  },
  {
    icon: Workflow,
    title: "Business Automation",
    summary:
      "Automate repetitive workflows with AI tools and agents. Save hours per week across your team.",
    who: "Operations, marketing, and support teams.",
    deliverables: [
      "Workflow audit and prioritization",
      "Tool and agent setup",
      "Integration with existing systems",
      "Team enablement and documentation",
    ],
  },
  {
    icon: Brain,
    title: "AI Consulting",
    summary:
      "Advisory on AI strategy, tooling, and team upskilling. We help you avoid the expensive mistakes.",
    who: "Leaders planning AI adoption.",
    deliverables: [
      "AI readiness assessment",
      "Use-case prioritization",
      "Build vs. buy guidance",
      "Roadmap aligned with business goals",
    ],
  },
  {
    icon: Target,
    title: "Career Guidance & Job Assistance",
    summary:
      "1:1 mentoring for people transitioning into AI roles. Honest guidance, no inflated promises.",
    who: "Freshers and professionals shifting into AI.",
    deliverables: [
      "Skills gap assessment",
      "Personalized learning roadmap",
      "Portfolio and resume support",
      "Mock interviews and feedback",
    ],
  },
];

const PROCESS = [
  {
    icon: Compass,
    step: "01",
    title: "Discover",
    desc: "We start with a free conversation. What's the goal, what's the constraint, what does success look like?",
  },
  {
    icon: Pencil,
    step: "02",
    title: "Design",
    desc: "A short proposal with scope, approach, and a realistic timeline. No vague language.",
  },
  {
    icon: HardHat,
    step: "03",
    title: "Build",
    desc: "Weekly demos, working software each sprint. You see progress, not status updates.",
  },
  {
    icon: TestTube,
    step: "04",
    title: "Validate",
    desc: "Real users or real data, not just our internal tests. We tune until it actually works.",
  },
  {
    icon: LineChart,
    step: "05",
    title: "Hand off",
    desc: "Documentation, training, and a clear next steps list. You own what we built.",
  },
];

const INDUSTRIES = [
  "Education and EdTech",
  "Professional services",
  "Healthcare and wellness",
  "E-commerce and retail",
  "SaaS and B2B software",
  "Financial services",
  "Real estate",
  "Non-profits",
];

const SERVICE_IMAGES: Record<string, string> = {
  "AI Training Programs": "/images/corporate-training-card.webp",
  "AI Product Development": "/images/ai-for-coders-card.webp",
  "AI Proof of Concepts": "/images/foundations-of-ai-card.webp",
  "Business Automation": "/images/genai-for-business-card.webp",
  "AI Consulting": "/images/career-card.webp",
};

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="Services"
        eyebrow="What we deliver"
        title="From idea to"
        accent="working AI product"
        text="Train your team, validate ideas fast and build production AI products — one partner from learning to launching."
        image="/images/pages/projects.webp"
        imageAlt="An AI project dashboard with usage, latency and accuracy"
        actions={[{ label: "Start a Project", to: "/contact" }, { label: "See What We've Built", to: "/business", ghost: true }]}
        facts={[
          { icon: GraduationCap, label: "AI Training" },
          { icon: Zap, label: "Proofs of Concept" },
          { icon: Layers, label: "Product Development" },
          { icon: Workflow, label: "Automation" },
        ]}
      />

      <Section tone="white">
        <SectionHead split eyebrow="Our services" title="Six services that build on each other"
          text="Most teams start with one and grow from there. Every engagement is scoped around a measurable outcome." />
        <ImageCards items={SERVICE_OFFERINGS.map((s) => ({
          image: SERVICE_IMAGES[s.title] || "/images/hero-about-card.webp",
          title: s.title,
          meta: s.who,
          text: s.summary,
          list: s.deliverables,
        }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="How we work" title="A simple, honest process" text="The same five steps for training and product work. No surprises, no hidden phases." />
        <CardGrid cols={5} items={PROCESS.map((p) => ({ icon: p.icon, meta: `Step ${p.step}`, title: p.title, text: p.desc }))} />
      </Section>

      <Section tone="white" tight>
        <SectionHead eyebrow="Industries" title="Teams we've worked with" text="We're industry-agnostic — what we care about is whether the problem is real and the data is available." />
        <Chips center items={INDUSTRIES} />
      </Section>

      <CtaBand
        eyebrow="Free 30-minute call"
        title="Have a problem worth solving with AI?"
        text="We start with a short call to see if there's a fit. No pitch deck — just a conversation."
        image="/images/hero-projects-card.webp"
        actions={[{ label: "Get in Touch", to: "/contact" }, { label: "Our Programs", to: "/programs", ghost: true }]}
      />
    </SitePage>
  );
}
