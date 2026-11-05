import { getSeoByPath } from "../../utils/seo";
import {
  Target,
  Wrench,
  ShieldHalf,
  LineChart,
  Compass,
  MessageSquare,
  Megaphone,
  Headset,
  BookOpen,
  Workflow,
  Scale,
  Map as MapIcon,
  Zap,
  Landmark,
  HeartPulse,
  ShoppingCart,
  Factory,
  Laptop,
  GraduationCap,
  Search,
  Bot,
  Sparkles,
  CalendarDays,
  Medal,
  Building2,
  PenTool,
  Briefcase,
  Rocket,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Split,
  Curriculum,
  ChipGroups,
  EndBanner,
} from "../../components/site/PageKit";

const seo = getSeoByPath("genai-for-business");

const PILLARS = [
  {
    icon: Target,
    title: "Business-First, Not Tool-First",
    desc: "We start from outcomes — revenue, cost, risk, speed — and work back to the AI capability. You leave with a portfolio prioritised by value and feasibility.",
  },
  {
    icon: Wrench,
    title: "Hands-On With Real Workflows",
    desc: "Every module is applied, not lectured. You'll build real assistants, agents and flows on your own live business cases — with no coding, but no hand-waving either.",
  },
  {
    icon: ShieldHalf,
    title: "Governance Built In",
    desc: "Risk tiers, human-in-the-loop review, data privacy and the EU AI Act aren't an afterthought — they're woven through every use case so what you build scales safely.",
  },
  {
    icon: LineChart,
    title: "Measurable ROI",
    desc: "You'll finish with a board-ready business case — KPIs, metrics and an adoption roadmap — so your investment in AI is defensible and trackable from day one.",
  },
];

const MODULES = [
  {
    id: "1",
    icon: Compass,
    title: "GenAI Business Foundations",
    desc:
      "The mechanics a decision-maker genuinely needs: how these models work, what the current landscape offers, and where the limits are. Ends on the cost, latency and build-versus-buy questions that decide whether a project is viable.",
    topics: [
      "How LLMs, tokens & inference really work",
      "The 2026 model landscape (frontier, reasoning, open-source)",
      "Capabilities, limits & where AI fits",
      "Cost, latency & the build-vs-buy decision",
      "Where generative AI fails, and why",
      "Model and vendor risk",
    ],
    tools: ["ChatGPT", "Claude", "Gemini"],
  },
  {
    id: "2",
    icon: MessageSquare,
    title: "Prompt Engineering for Business",
    desc:
      "Prompting as a repeatable business process. Patterns and templates that hold up under real use, structured outputs a downstream system can consume, and a prompt library your team can share.",
    topics: [
      "Reliable prompt patterns & templates",
      "Role, context & few-shot techniques",
      "Structured outputs for real workflows",
      "Building a reusable prompt library",
      "Testing a prompt before rollout",
      "Sharing prompts across a team",
    ],
    tools: ["Custom GPTs", "Claude", "Gemini"],
  },
  {
    id: "3",
    icon: Megaphone,
    title: "AI for Marketing & Content",
    desc:
      "Content produced at scale without losing the brand. Generation, SEO and personalisation, the quality controls that keep output publishable, and campaign automation across channels.",
    topics: [
      "Content generation at scale",
      "SEO & personalization strategies",
      "Brand voice & quality control",
      "Campaign & social automation",
      "Disclosure & authenticity",
      "Measuring content performance",
    ],
    tools: ["Gamma AI", "Notion AI", "HubSpot AI"],
  },
  {
    id: "4",
    icon: Headset,
    title: "Customer Service & Support AI",
    desc:
      "Support is where AI meets customers directly, so the design matters. Building support agents, classifying and routing tickets, reading sentiment at volume, and the escalation path to a human.",
    topics: [
      "Designing AI support agents",
      "Ticket classification & routing",
      "Sentiment analysis at scale",
      "Escalation & human handoff design",
      "Deflection rate & customer satisfaction",
      "Holding brand tone in replies",
    ],
    tools: ["Intercom", "Custom GPTs", "Zapier"],
  },
  {
    id: "5",
    icon: BookOpen,
    title: "RAG & Enterprise Knowledge",
    desc:
      "Why a capable model still knows nothing about your business, and what retrieval-augmented generation does about it. Grounding answers in your own documents to cut hallucinations and make output trustworthy.",
    topics: [
      "Why models alone aren't enough",
      "Retrieval-augmented generation explained",
      "Grounding AI in your own documents",
      "Reducing hallucinations & building trust",
      "Keeping the knowledge base current",
      "Access control on retrieval",
    ],
    tools: ["Custom GPTs", "Notion AI", "Perplexity"],
  },
  {
    id: "6",
    icon: Workflow,
    title: "Agentic AI & Workflow Automation",
    desc:
      "The step from a chatbot that answers to an agent that acts. Multi-step orchestration, connecting AI to n8n, Zapier and Copilot, and automating document and process work end to end.",
    topics: [
      "From chatbots to autonomous agents",
      "Multi-step task orchestration",
      "Connecting AI to n8n, Zapier & Copilot",
      "Document & process automation",
      "Approval gates & rollback",
      "Costing an automated workflow",
    ],
    tools: ["n8n", "Zapier", "Copilot"],
  },
  {
    id: "7",
    icon: Scale,
    title: "AI Governance, Risk & Ethics",
    desc:
      "Governance built as part of the work rather than bolted on afterwards. Risk-tiering use cases, human-in-the-loop review, data privacy and shadow AI, and what the EU AI Act and GDPR require.",
    topics: [
      "Risk-tiered use-case classification",
      "Human-in-the-loop & auditability",
      "Data privacy, security & shadow AI",
      "EU AI Act, GDPR & responsible AI",
      "Writing an internal AI policy",
      "Incident response for AI",
    ],
    tools: ["EU AI Act", "GDPR", "HITL"],
  },
  {
    id: "8",
    icon: MapIcon,
    title: "AI Strategy & ROI Capstone",
    desc:
      "The capstone: an adoption roadmap with prioritised use cases, the metrics that prove return, a change-management plan, and a presentation built to survive a board meeting.",
    topics: [
      "Building an AI adoption roadmap",
      "Measuring ROI & business KPIs",
      "Change management & enablement",
      "Board-ready capstone presentation",
      "Prioritising the first three use cases",
      "Budgeting & resourcing",
    ],
    tools: ["Roadmap", "ROI KPIs", "Power BI Copilot"],
  },
];

const USE_CASES = [
  {
    title: "Marketing & Content",
    desc: "Generate campaigns, personalize at scale, accelerate SEO and creative production.",
  },
  {
    title: "Customer Service",
    desc: "AI agents, ticket routing, sentiment analysis and 24/7 grounded support.",
  },
  {
    title: "Data & Decisions",
    desc: "Extract insights, auto-generate reports and surface trends from your own data.",
  },
  {
    title: "Operations & Automation",
    desc: "Automate document handling, approvals and repetitive multi-step workflows.",
  },
  {
    title: "HR & Talent",
    desc: "Screen candidates, draft policies, build internal knowledge assistants.",
  },
  {
    title: "Finance & Sales",
    desc: "Forecast, summarize contracts, qualify leads and speed up proposals.",
  },
];

const INDUSTRIES = [
  {
    icon: Landmark,
    title: "Finance & Banking",
    desc: "Report automation, contract and document summarization, customer support agents, and risk-aware workflows built for compliance-heavy environments.",
  },
  {
    icon: HeartPulse,
    title: "Healthcare & Life Sciences",
    desc: "Knowledge assistants grounded in policy and literature, administrative automation, and patient-communication drafting with human oversight.",
  },
  {
    icon: ShoppingCart,
    title: "Retail & E-commerce",
    desc: "Personalized marketing at scale, AI shopping assistants, catalog and content generation, and demand-signal analysis.",
  },
  {
    icon: Factory,
    title: "Manufacturing & Supply Chain",
    desc: "SOP and documentation automation, supplier communication, and operational reporting that turns data into decisions.",
  },
  {
    icon: Laptop,
    title: "Technology & SaaS",
    desc: "Support-deflection agents, internal knowledge search, go-to-market content engines, and workflow orchestration.",
  },
  {
    icon: GraduationCap,
    title: "Professional Services & Education",
    desc: "Proposal and report acceleration, research assistants, client communication, and scalable content production.",
  },
];

const OUTCOMES = [
  {
    title: "Spot High-Value Use Cases",
    desc: "Diagnose workflows and prioritize AI opportunities by impact, feasibility and risk.",
  },
  {
    title: "Master Prompt Engineering",
    desc: "Write reliable, reusable prompts and prompt patterns for business-grade output.",
  },
  {
    title: "Build RAG Knowledge Assistants",
    desc: "Ground AI in your own documents and data to cut hallucinations and boost trust.",
  },
  {
    title: "Design Agentic Workflows",
    desc: "Deploy AI agents that plan and execute multi-step tasks across your business tools.",
  },
  {
    title: "Govern AI Responsibly",
    desc: "Apply risk tiers, human-in-the-loop review, data privacy and compliance controls.",
  },
  {
    title: "Prove ROI to Leadership",
    desc: "Build a board-ready business case with metrics, KPIs and an adoption roadmap.",
  },
];

const TOOL_GROUPS = [
  {
    icon: Sparkles,
    title: "AI Assistants",
    tools: ["ChatGPT", "Claude", "Google Gemini", "Microsoft Copilot", "Perplexity"],
  },
  { icon: PenTool, title: "Content & Docs", tools: ["Custom GPTs", "Gamma AI", "Notion AI"] },
  { icon: Workflow, title: "Automation", tools: ["n8n", "Zapier", "Make"] },
  {
    icon: Briefcase,
    title: "Business Apps",
    tools: ["HubSpot AI", "Intercom", "Power BI Copilot"],
  },
];

const AUDIENCE = [
  {
    icon: Zap,
    title: "Prerequisites",
    items: [
      "Comfort with email, docs and spreadsheets",
      "Familiarity with your own team's workflows and goals",
      "Curiosity about AI — no prior AI experience needed",
      "No coding or data-science background required",
    ],
  },
  {
    icon: Target,
    title: "Ideal For",
    items: [
      "Managers, directors & executives driving AI adoption",
      "Marketing, sales & customer-experience professionals",
      "Operations, HR, finance & project leads",
      "Consultants, entrepreneurs & startup founders",
    ],
  },
];

const PROJECTS = [
  {
    icon: PenTool,
    title: "Content Engine",
    desc: "A prompt-driven system that produces on-brand blog, email and social content at scale.",
    tools: ["Custom GPTs", "Gamma AI"],
  },
  {
    icon: Bot,
    title: "Support Agent",
    desc: "A no-code customer-service assistant with routing, escalation and human handoff.",
    tools: ["Intercom", "Zapier"],
  },
  {
    icon: Search,
    title: "RAG Knowledge Assistant",
    desc: "An assistant grounded in your own documents that answers with cited, trustworthy sources.",
    tools: ["Custom GPTs", "Notion AI"],
  },
  {
    icon: Workflow,
    title: "Automated Workflow",
    desc: "A multi-step business process orchestrated across your tools with n8n or Zapier.",
    tools: ["n8n", "Zapier"],
  },
  {
    icon: MapIcon,
    title: "AI Adoption Roadmap",
    desc: "A board-ready strategy with prioritized use cases, governance guardrails and ROI metrics.",
    tools: ["Strategy", "Governance"],
  },
];

const FORMAT = [
  {
    icon: CalendarDays,
    title: "6 Weeks · 8 Modules",
    desc: "A structured cohort pace with weekly live sessions, guided labs and office hours — about 4–6 hours weekly.",
  },
  {
    icon: Laptop,
    title: "Live + Online",
    desc: "Instructor-led online sessions plus a self-paced library, so you learn live and can revisit any lesson at will.",
  },
  {
    icon: Medal,
    title: "Certificate of Completion",
    desc: "Earn a shareable Rivira Technologies credential for your LinkedIn and résumé, backed by a real, assessed capstone project.",
  },
  {
    icon: Building2,
    title: "Teams & Enterprise",
    desc: "Available as a private cohort tailored to your industry and tools — request a quote for enterprise pricing.",
  },
];

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="GenAI for Business"
        eyebrow="No coding required · 6 weeks"
        title="Master Generative AI"
        accent="for business"
        text="Move from AI experiments to measurable value: find high-impact use cases, deploy generative AI and agentic workflows responsibly, and leave with a governed roadmap."
        image="/images/pages/business.webp"
        imageAlt="Business chat assistant beside an hours-saved chart"
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "View Modules", href: "#curriculum", ghost: true }]}
        facts={[
          { icon: BookOpen, label: "8 Modules" },
          { icon: Rocket, label: "5 Capstone Projects" },
          { icon: CalendarDays, label: "6 Weeks · Live + Online" },
          { icon: Briefcase, label: "For Leaders & Teams" },
        ]}
      />

      <Section tone="white">
        <SectionHead split eyebrow="Why this program" title="Close the gap between hype and value"
          text="Business-first, not tool-first: every module ties AI back to a decision, a workflow or a number your organisation cares about." />
        <CardGrid cols={4} items={PILLARS.map((p) => ({ icon: p.icon, title: p.title, text: p.desc }))} />
      </Section>

      <Section id="curriculum">
        <SectionHead eyebrow="The curriculum" title="Eight modules, strategy to rollout" text="Open any module to see its topics and the tools it uses." />
        <Curriculum modules={MODULES.map((m) => ({ title: m.title, meta: m.tools.join(" · "), summary: m.desc, topics: m.topics }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Use cases" title="Where generative AI pays off first" />
        <CardGrid cols={3} items={USE_CASES.map((u) => ({ title: u.title, text: u.desc }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="Industries" title="Applied to your sector" />
        <CardGrid cols={3} items={INDUSTRIES.map((i) => ({ icon: i.icon, title: i.title, text: i.desc }))} />
      </Section>

      <Section>
        <Split
          image="/images/genai-for-business-card.webp"
          eyebrow="Outcomes"
          title="What you'll be able to do"
          text="By the end of the six weeks you can lead AI work in your team, not just talk about it."
          bullets={OUTCOMES.map((o) => o.title)}
          badge={{ value: "5", label: "capstone projects" }}
          actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Talk to a Specialist", to: "/contact", ghost: true }]}
        />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="Platforms" title="Tools you'll master" />
        <ChipGroups groups={TOOL_GROUPS.map((g) => ({ icon: g.icon, title: g.title, items: g.tools }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Who it's for" title="Built for leaders, managers and analysts" />
        <CardGrid cols={2} items={AUDIENCE.map((a) => ({ icon: a.icon, title: a.title, list: a.items }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Capstones" title="Projects you'll build" text="Five practical builds you can take straight back to work." />
        <CardGrid cols={3} items={PROJECTS.map((p) => ({ icon: p.icon, title: p.title, text: p.desc, chips: p.tools }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="Format" title="How the program runs" />
        <CardGrid cols={4} items={FORMAT.map((f) => ({ icon: f.icon, title: f.title, text: f.desc }))} />
      </Section>

      <EndBanner
        eyebrow="The future starts here"
        title="Turn AI ambition into business results"
        text="Enroll yourself or your team, or talk to a specialist about the best fit for your organisation."
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Corporate Training", to: "/corporate-training", ghost: true }]}
      />
    </SitePage>
  );
}
