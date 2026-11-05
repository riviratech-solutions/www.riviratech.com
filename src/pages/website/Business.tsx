import {
  FileText,
  BarChart3,
  MessageCircle,
  Database,
  Image as ImageIcon,
  Mic,
  Users,
  Layers,
  Code2,
  GitBranch,
  CloudCog,
  Zap,
  Shield,
  Compass,
  Activity,
  Globe,
  LineChart,
  Bot,
  ShoppingBag,
  Truck,
  Home as HomeIcon,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Steps,
  Chips,
  EndBanner,
} from "../../components/site/PageKit";

/* ── Featured enterprise work (redesigned case studies) ── */
const FEATURED_PROJECTS = [
  {
    icon: FileText,
    title: "AI Document Assistant",
    tag: "RAG • Knowledge",
    problem:
      "An internal team was spending hours each week searching through hundreds of policy documents to answer recurring questions.",
    solution:
      "A retrieval-augmented assistant indexed on their document library. Answers cite the exact source paragraphs and stay grounded in the team's actual content.",
    stack: ["LLMs", "Vector Database", "RAG", "Cloud Deployment"],
    duration: "4 weeks",
    team: "2 engineers",
  },
  {
    icon: BarChart3,
    title: "Sales Insights Agent",
    tag: "Agents • Analytics",
    problem:
      "Sales leadership had data scattered across the CRM, spreadsheets, and email exports. Weekly reporting was manual and error-prone.",
    solution:
      "An AI agent that connects to those sources, answers questions in plain English, and drafts a weekly pipeline summary.",
    stack: ["LLMs", "Agents", "Spreadsheet APIs", "CRM Integration"],
    duration: "6 weeks",
    team: "1 engineer + PM",
  },
  {
    icon: MessageCircle,
    title: "Customer Support Copilot",
    tag: "RAG • Productivity",
    problem:
      "Support agents were answering the same questions across channels and copying from outdated docs.",
    solution:
      "A copilot that drafts responses from past tickets and the help center. Agents review and send — never auto-replies.",
    stack: ["RAG", "Vector Search", "Workflow Automation"],
    duration: "5 weeks",
    team: "2 engineers",
  },
  {
    icon: Database,
    title: "Internal Knowledge Search",
    tag: "Embeddings • Onboarding",
    problem:
      "New hires were taking weeks to ramp because the answers they needed were spread across Notion, Drive, and Slack.",
    solution:
      "A unified search trained on internal documentation, with access control respected at retrieval time.",
    stack: ["LLMs", "Embeddings", "Access Controls"],
    duration: "5 weeks",
    team: "2 engineers",
  },
  {
    icon: ImageIcon,
    title: "Visual Catalog Tagging",
    tag: "Vision • E-commerce",
    problem:
      "A small e-commerce team had thousands of product photos with inconsistent or missing tags, hurting search.",
    solution:
      "A vision model that suggests tags and short descriptions; a reviewer queue keeps the team in the loop.",
    stack: ["Vision Models", "LLMs", "Reviewer Workflow"],
    duration: "3 weeks",
    team: "1 engineer",
  },
  {
    icon: Mic,
    title: "Meeting Notes Automation",
    tag: "Audio • Productivity",
    problem:
      "A consulting team was losing context between meetings. Notes were inconsistent and action items got lost.",
    solution:
      "Automated transcription with a structured summary, action items, and follow-up draft emails.",
    stack: ["Speech-to-Text", "LLMs", "Email Integration"],
    duration: "3 weeks",
    team: "1 engineer",
  },
];

/* ── Why POCs matter ── */
const BENEFITS = [
  {
    title: "Rapid Validation",
    desc: "Get a working prototype in 2–4 weeks. Test assumptions and validate business value quickly before major investments.",
    icon: Zap,
  },
  {
    title: "Cost Efficient",
    desc: "Minimal investment to prove concept. Scale only after you've seen it work with your actual data and workflows.",
    icon: Shield,
  },
  {
    title: "Real Data Testing",
    desc: "We build with your actual data and workflows. No generic demos — real solutions designed for your real problems.",
    icon: Database,
  },
  {
    title: "Production Ready",
    desc: "POCs built with production architecture in mind. Seamless transition from proof-of-concept to full product.",
    icon: Compass,
  },
];

/* ── Delivered client POCs (from the POC page grid) ── */
const POC_PROJECTS = [
  {
    framework: "LangGraph",
    title: "Healthcare Navigator",
    subtitle: "Multi-Agent Patient Assistance System",
    desc: "Three coordinated agents that help patients find the right care, verify insurance, and book appointments.",
    outcomes: ["Symptom Assessment", "Insurance Verification", "Provider Matching", "Appointment Scheduling"],
    tech: ["LangGraph", "3 Agents", "GPT-4", "RAG"],
    icon: Activity,
  },
  {
    framework: "CrewAI",
    title: "Legal Document Analyzer",
    subtitle: "Contract Intelligence System",
    desc: "A multi-agent crew that reviews contracts, extracts key clauses, flags risks, and drafts compliance reports.",
    outcomes: ["Clause Extraction", "Risk Assessment", "Compliance Check"],
    tech: ["CrewAI", "Claude", "Vector DB"],
    icon: FileText,
  },
  {
    framework: "MCP & A2A",
    title: "Enterprise Agent Network",
    subtitle: "Agent-to-Agent Communication",
    desc: "Google's A2A protocol in action — specialized agents communicating across enterprise systems.",
    outcomes: ["Cross-System Integration", "Agent Orchestration", "MCP Tools", "A2A Protocol"],
    tech: ["MCP", "FastAPI", "AutoGen"],
    icon: Globe,
  },
  {
    framework: "AutoGen",
    title: "Financial Analyst Team",
    subtitle: "Conversational Multi-Agent Analysis",
    desc: "A team of analysts that research markets, analyze trends, and produce investment insights together.",
    outcomes: ["Market Research", "Trend Analysis", "Report Generation"],
    tech: ["AutoGen", "GPT-4", "Python"],
    icon: LineChart,
  },
  {
    framework: "Computer Vision",
    title: "Laundromat Automation",
    subtitle: "Vision-Powered Quality Control",
    desc: "Vision system for dry cleaners that automates garment inspection, stain detection, and quality checks.",
    outcomes: ["Garment Recognition", "Stain Detection", "Quality Scoring"],
    tech: ["GPT-4V", "OpenCV", "YOLO"],
    icon: Bot,
  },
  {
    framework: "CrewAI",
    title: "HR Recruitment Crew",
    subtitle: "Automated Hiring Pipeline",
    desc: "Specialized agents handling resume screening, candidate matching, interview scheduling, and feedback.",
    outcomes: ["Resume Parsing", "Skill Matching", "Auto-Scheduling"],
    tech: ["CrewAI", "RAG", "Zapier"],
    icon: Users,
  },
  {
    framework: "LangGraph",
    title: "Retail Shopping Assistant",
    subtitle: "Personalized Commerce AI",
    desc: "Conversational assistant that learns preferences, recommends products, and handles comparisons and orders.",
    outcomes: ["Product Discovery", "Personalization", "Order Tracking"],
    tech: ["LangGraph", "Commerce API", "Claude"],
    icon: ShoppingBag,
  },
  {
    framework: "AutoGen",
    title: "Supply Chain Optimizer",
    subtitle: "Intelligent Logistics Management",
    desc: "Agents that monitor inventory, forecast demand, optimize routes, and automate supplier updates.",
    outcomes: ["Demand Forecasting", "Route Optimization", "Vendor Management"],
    tech: ["AutoGen", "Python", "APIs"],
    icon: Truck,
  },
  {
    framework: "LangChain",
    title: "Real Estate Advisor",
    subtitle: "Property Intelligence Bot",
    desc: "Analyzes listings, compares market data, scores investments, and schedules viewings for buyers.",
    outcomes: ["Market Analysis", "Property Comparison", "Investment Scoring"],
    tech: ["LangChain", "RAG", "GPT-4"],
    icon: HomeIcon,
  },
];

const STACK = [
  { icon: Code2, label: "LLMs & APIs", desc: "OpenAI, Anthropic, open-source models" },
  { icon: Database, label: "Vector Databases", desc: "Pinecone, pgvector, Qdrant, Weaviate" },
  { icon: Layers, label: "Frameworks", desc: "LangChain, LlamaIndex, custom orchestration" },
  { icon: CloudCog, label: "Cloud", desc: "AWS, Azure, GCP — wherever your data lives" },
  { icon: GitBranch, label: "Eval & Monitoring", desc: "LangSmith, custom dashboards, logging" },
  { icon: Layers, label: "Frontend", desc: "React, Next.js, Tailwind for product UIs" },
];

const INDUSTRIES = [
  "Education",
  "Finance",
  "Healthcare",
  "HR & Recruiting",
  "Legal",
  "Logistics",
  "Manufacturing",
  "Marketing",
  "Real Estate",
  "Retail",
];

const APPROACH = [
  {
    title: "Start small, measure honestly",
    desc: "Every project begins with a sharp scope and a clear way to measure success. If we can't measure it, we don't build it.",
  },
  {
    title: "Working software each week",
    desc: "You see a demo every week — not status decks. Course correction is built into the rhythm.",
  },
  {
    title: "Your data, your control",
    desc: "We don't train on your data. Everything stays in your environment unless you choose otherwise.",
  },
  {
    title: "Built to hand off",
    desc: "Clean code, documentation, and a session walking your team through how it works. No lock-in.",
  },
];

export default function Page() {
  return (
    <SitePage
      title="Business Solutions — Rivira Tech | AI Products & Rapid POCs"
      desc="Rivira Tech builds production-ready AI products and rapid proofs of concept — see it working in weeks before you invest."
      keywords="AI proof of concept, AI product development, RAG, AI agents, enterprise AI, LangGraph"
    >
      <PageHero
        crumb="Business Solutions"
        eyebrow="AI products & proofs of concept"
        title="AI that ships"
        accent="and pays for itself"
        text="From enterprise products to rapid proofs of concept, we build production-ready AI and prove its value fast — so you see it working before you invest."
        image="/images/pages/business.webp"
        imageAlt="AI assistant conversation next to an hours-saved chart and ROI figures"
        actions={[{ label: "Discuss Your Project", to: "/contact" }, { label: "How We Work", href: "#approach", ghost: true }]}
        facts={[
          { icon: Rocket, label: "25+ POCs Delivered" },
          { icon: Layers, label: "12 Industries" },
          { icon: Zap, label: "2–4 Weeks to Demo" },
          { icon: ShieldCheck, label: "Your Data Stays Yours" },
        ]}
      />

      <Section tone="white">
        <SectionHead split eyebrow="Featured work" title="Problems we've turned into working products"
          text="A few recent builds — what was broken, what we shipped, and how long it took." />
        <CardGrid cols={3} items={FEATURED_PROJECTS.map((p) => ({
          icon: p.icon,
          meta: p.tag,
          title: p.title,
          text: <><strong style={{ color: "var(--rv-ink)" }}>Problem:</strong> {p.problem}<br /><br /><strong style={{ color: "var(--rv-ink)" }}>Solution:</strong> {p.solution}</>,
          list: [`${p.duration} · ${p.team}`],
          chips: p.stack,
        }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Why a POC first" title="De-risk your AI investment" />
        <CardGrid cols={4} items={BENEFITS.map((b) => ({ icon: b.icon, title: b.title, text: b.desc }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Proofs of concept" title="Delivered AI solutions" text="Multi-agent systems, retrieval and automation — built on the frameworks we teach." />
        <CardGrid cols={3} items={POC_PROJECTS.map((p) => ({ icon: p.icon, meta: p.framework, title: p.title, text: <><strong style={{ color: "var(--rv-ink)" }}>{p.subtitle}.</strong> {p.desc}</>, list: p.outcomes, chips: p.tech }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="Our stack" title="Tools we reach for" />
        <CardGrid cols={3} items={STACK.map((s) => ({ icon: s.icon, title: s.label, text: s.desc }))} />
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <p className="rv-text" style={{ marginBottom: 16, fontWeight: 600 }}>Industries we've built for</p>
          <Chips center items={INDUSTRIES} />
        </div>
      </Section>

      <Section id="approach">
        <SectionHead eyebrow="How we build" title="How we approach the build" />
        <Steps items={APPROACH.map((a) => ({ title: a.title, text: a.desc }))} />
      </Section>

      <EndBanner
        eyebrow="No NDA needed for the first conversation"
        title="Have an idea? Let's stress-test it."
        text="Send us a paragraph about the problem. We'll reply with whether AI is the right tool, and a rough sketch of how we'd approach it."
        actions={[{ label: "Start a Conversation", to: "/contact" }, { label: "Our Services", to: "/services", ghost: true }]}
      />
    </SitePage>
  );
}
