import { getSeoByPath } from "../../utils/seo";
import {
  Layers,
  Cpu,
  BookOpen,
  Plug,
  Bot,
  Workflow,
  Zap,
  CalendarDays,
  Code2,
  Network,
  Cloud,
  ShieldHalf,
  MessagesSquare,
  Building2,
  FileText,
  Phone,
  Scale,
  HeartPulse,
  BarChart3,
  Lock,
  ShoppingCart,
  Truck,
  GraduationCap,
  FlaskConical,
  Receipt,
  Users,
  Plus,
  Hand,
  Factory,
  Briefcase,
  GitBranch,
  FolderOpen,
  UserCheck,
  Search,
  Settings,
  Database,
  Award,
  Megaphone,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Split,
  Steps,
  Curriculum,
  ChipGroups,
  Chips,
  EndBanner,
} from "../../components/site/PageKit";

const seo = getSeoByPath("ai-stack");

const HIGHLIGHTS = [
  {
    icon: CalendarDays,
    title: "16-Week Program",
    desc: "14 teaching weeks + 2 dedicated project weeks",
  },
  {
    icon: Layers,
    title: "6 Core Technologies",
    desc: "Agents, Agentic AI, LLMs, RAG, MCP and Automation",
  },
  { icon: Workflow, title: "30+ Projects", desc: "Hands-on projects across three steadily harder skill levels" },
  {
    icon: Zap,
    title: "100% Live Implementation",
    desc: "Live coding and real builds, never recorded slideware",
  },
];

const STACK_LAYERS = [
  { icon: Cpu, n: "01", title: "LLM", desc: "The engine — reasoning and language" },
  {
    icon: BookOpen,
    n: "02",
    title: "RAG",
    desc: "Its knowledge — grounded, cited answers from your data",
  },
  {
    icon: Plug,
    n: "03",
    title: "Tools & MCP",
    desc: "Its hands — reach real systems and data safely",
  },
  { icon: Bot, n: "04", title: "AI Agents", desc: "Autonomy — decide, call tools, take action" },
  {
    icon: Network,
    n: "05",
    title: "Agentic Orchestration",
    desc: "Teamwork — agents plan, delegate and review",
  },
  {
    icon: Zap,
    n: "06",
    title: "Automation",
    desc: "The job — business outcomes delivered unattended",
  },
];

const MODULES = [
  {
    id: "1",
    icon: Bot,
    title: "AI Agents",
    desc:
      "One agent, done properly. The perceive-reason-act loop and the ReAct pattern, tool calling and memory, and the guardrails, retries and human approvals that separate a demo from something you would let near production.",
    topics: [
      "Perceive → reason → act → observe",
      "The ReAct pattern in practice",
      "Deciding when to act vs answer",
      "Stopping conditions & loop limits",
      "What one agent can and can't do",
      "Function / tool calling in depth",
      "Tool schemas, routing & selection",
      "Short-term conversation memory",
      "Long-term memory via vector stores",
      "State management across turns",
      "Guardrails on actions the agent takes",
      "Confidence thresholds & fallbacks",
      "Retries, timeouts & error handling",
      "Human approval before risky actions",
      "Tracing and debugging one agent",
    ],
    build: "A single production-grade agent that calls real tools, remembers context, handles failure and escalates when unsure.",
    tools: ["OpenAI", "Claude", "Gemini", "LangChain", "LangGraph"],
  },
  {
    id: "2",
    icon: Network,
    title: "Agentic AI",
    desc:
      "Why several specialised agents often beat one large prompt, and when they do not. Planner-executor-reviewer structures, supervisor crews, shared state, and LangGraph, CrewAI and AutoGen compared on their real differences.",
    topics: [
      "Specialisation beats one giant prompt",
      "Working around context-window limits",
      "Separation of concerns & testability",
      "The cost & latency you trade away",
      "When NOT to go multi-agent",
      "Planner → Executor → Reviewer",
      "Supervisor / worker crews",
      "Sequential vs parallel execution",
      "Conditional routing & handoffs",
      "Shared state & memory synchronisation",
      "Goal decomposition & planning",
      "Self-review and critique loops",
      "Agent-to-Agent (A2A) messaging",
      "Failure recovery & loop detection",
      "LangGraph · CrewAI · AutoGen compared",
    ],
    build: "A multi-agent workflow where a planner delegates, executors work in parallel and a reviewer validates the result before it ships.",
    tools: ["LangGraph", "CrewAI", "AutoGen", "OpenDevin"],
  },
  {
    id: "3",
    icon: Cpu,
    title: "Large Language Models",
    desc:
      "The model layer itself. Transformers, tokens and context windows, the reasoning models, prompt and function calling, structured output, and the fine-tuning-versus-RAG-versus-prompting decision — plus what each option costs.",
    topics: [
      "Foundation models & transformers",
      "Tokens, embeddings & context windows",
      "Inference, temperature & sampling",
      "Reasoning models",
      "Open-source vs commercial",
      "Prompt engineering & system prompts",
      "Function calling & tool use",
      "Structured outputs (JSON mode)",
      "Fine-tuning vs RAG vs prompting",
      "Cost, latency & rate limits",
      "GPT · Claude · Gemini",
      "Llama · Mistral · DeepSeek",
      "Choosing the right model per task",
      "Running open models locally",
      "How enterprises deploy them",
    ],
    build: "An LLM application with function calling and validated structured output — plus a fine-tuned model trained on our RTX 5090 GPU lab.",
    tools: ["OpenAI", "Anthropic", "Google", "Hugging Face", "Ollama", "PEFT/LoRA"],
  },
  {
    id: "4",
    icon: BookOpen,
    title: "Retrieval-Augmented Generation",
    desc:
      "Retrieval in depth, because this is what most enterprise AI actually is. Chunking and embeddings, vector databases, hybrid search and re-ranking, citation assembly, and permission-aware retrieval on real corpora.",
    topics: [
      "Hallucination & stale knowledge",
      "Grounded, cited answers",
      "RAG vs fine-tuning vs context",
      "Keeping company data private",
      "Evaluating retrieval quality",
      "Chunking strategies & embeddings",
      "Vector databases & indexing",
      "Semantic + hybrid search",
      "Re-ranking & metadata filtering",
      "Context assembly & citations",
      "Internal knowledge assistants",
      "PDF & document chatbots",
      "Policy, contract & compliance search",
      "Support & FAQ grounding",
      "Permission-aware retrieval",
    ],
    build: "A complete RAG pipeline — ingest → chunk → embed → retrieve → re-rank → answer with citations — then evaluate its accuracy.",
    tools: ["LangChain", "LlamaIndex", "FAISS", "Chroma", "Pinecone", "Weaviate", "RAGAS"],
  },
  {
    id: "5",
    icon: Plug,
    title: "Model Context Protocol (MCP)",
    desc:
      "Model Context Protocol: the standard that lets one agent reach GitHub, a database, Drive, Slack or a CRM without a bespoke integration each time — and the auth, injection defence and audit trail that has to come with it.",
    topics: [
      "What MCP is & why it's becoming standard",
      "MCP clients & MCP servers",
      "Tools, resources & prompts",
      "Request → context → response flow",
      "Standardising across providers",
      "GitHub & developer tooling",
      "Databases & internal APIs",
      "Drive, Notion & Slack",
      "Ticketing & CRM systems",
      "Line-of-business systems",
      "Auth & permission checks",
      "Preventing context leakage",
      "Prompt-injection defence",
      "Audit trails & observability",
      "Human-in-the-loop approvals",
    ],
    build: "Working MCP-connected tools inside your agents — so one assistant can search, look up and act across real systems safely.",
    tools: ["MCP SDK", "LangChain MCP", "CrewAI", "AutoGen"],
  },
  {
    id: "6",
    icon: Zap,
    title: "AI Automation",
    desc:
      "Automation as the point of all the preceding layers. Trigger-process-deliver pipelines, scheduled and event-driven runs, approval checkpoints, and the tools that carry it across email, CRM, HR and support.",
    topics: [
      "Workflow & intelligent automation",
      "Trigger → process → deliver pipelines",
      "Scheduled & event-driven runs",
      "Decision automation",
      "Human approval checkpoints",
      "Email & inbox automation",
      "CRM & sales workflows",
      "HR & onboarding processes",
      "Customer support routing",
      "Reporting & data processing",
      "n8n · Zapier · Make",
      "LangGraph · CrewAI · AutoGen",
      "LangChain & LLM APIs",
      "Power Automate & Copilot",
      "Custom API integrations",
    ],
    build: "End-to-end automations that classify, generate and deliver — running on their own, without you.",
    tools: ["n8n", "Zapier", "Make", "LangGraph", "Power Automate"],
  },
  {
    id: "7",
    icon: ShieldHalf,
    title: "Evaluation, Guardrails & Observability",
    desc:
      "The layer that decides whether any of this is safe to ship. Groundedness and RAG metrics, golden datasets and regression testing, injection and PII defence, and tracing, cost and audit trails once it is running.",
    topics: [
      "Groundedness & hallucination rate",
      "RAG metrics: context precision, recall, faithfulness",
      "Answer relevance & citation accuracy",
      "Golden datasets & regression testing",
      "Comparing prompts, models & versions",
      "Prompt injection & jailbreak defence",
      "PII detection, redaction & data privacy",
      "Input / output validation & schemas",
      "Scoping tool & data permissions",
      "Content safety and refusal behaviour",
      "Tracing multi-step agent runs",
      "Token cost & latency monitoring",
      "Audit trails for every action taken",
      "Bias & fairness review",
      "Human-in-the-loop approval design",
    ],
    build: "An evaluation harness and guardrail layer over your own RAG assistant — so you can measure accuracy before and after a change instead of guessing.",
    tools: ["RAGAS", "LangSmith", "Guardrails AI", "OpenTelemetry", "Pydantic"],
  },
];

const LIVE_DEMOS = [
  "Live coding, end to end",
  "Enterprise architecture walkthroughs",
  "Real API integrations",
  "Production deployment on Azure, AWS & GCP",
  "Debugging & troubleshooting sessions",
  "Performance & cost optimisation",
  "Security, guardrails & PII handling",
  "Scalability & monitoring",
  "Best practices & live Q&A",
];

const USE_CASES = [
  { icon: MessagesSquare, title: "Customer Support AI Chatbot", tag: "SaaS · E-commerce" },
  { icon: Building2, title: "Enterprise Knowledge Assistant", tag: "Enterprise IT · Consulting" },
  { icon: FileText, title: "Resume Screening & Job Matching", tag: "HR · Recruitment" },
  { icon: Phone, title: "Sales Call Intelligence System", tag: "Sales · CRM · RevOps" },
  { icon: Scale, title: "Legal Document & Contract Review", tag: "Legal · Compliance" },
  { icon: HeartPulse, title: "Healthcare Document Summarization", tag: "Healthcare · Clinical Ops" },
  { icon: BarChart3, title: "Finance Risk Analysis Assistant", tag: "Finance · Risk" },
  { icon: Lock, title: "Banking Fraud Detection System", tag: "Banking · FinTech" },
  { icon: ShoppingCart, title: "Product Recommendation Engine", tag: "Retail · E-commerce" },
  { icon: Truck, title: "Supply Chain Delay Prediction", tag: "Logistics · Manufacturing" },
  { icon: GraduationCap, title: "Education Tutoring Assistant", tag: "Education · EdTech" },
  { icon: FlaskConical, title: "Research Paper Assistant", tag: "Research · Academia · R&D" },
  { icon: Receipt, title: "Insurance Claims Automation", tag: "Insurance" },
  { icon: Users, title: "HR Employee Support Assistant", tag: "HR · Enterprise Ops" },
  { icon: Megaphone, title: "Marketing Content & Campaign Assistant", tag: "Marketing · Content Ops" },
  { icon: Plus, title: "30 more hands-on projects", tag: "3 levels · GitHub access" },
];

const ROADMAP = [
  {
    id: "01",
    weeks: "Weeks 1–5",
    title: "Foundations, Data & Predictive AI",
    desc: "AI foundations & prompt engineering · core AI libraries · ML, DL & NLP · first industry use case.",
  },
  {
    id: "02",
    weeks: "Weeks 6–10",
    title: "LLMs, RAG & Agentic AI",
    desc: "LLM app development · RAG pipelines · agents, orchestration, MCP & A2A · two full industry use cases.",
  },
  {
    id: "03",
    weeks: "Weeks 11–12",
    title: "Deploy, Automate & Ship",
    desc: "Cloud deployment on Azure OpenAI, AWS Bedrock & Google Vertex AI · copilots, no-code automation & speech.",
  },
  {
    id: "04",
    weeks: "Weeks 13–14",
    title: "Claude Certification, GPU Training & Governance",
    desc: "Complete Claude AI training & certification · model training on our RTX 5090 GPU lab · evaluation, governance & responsible AI.",
  },
  {
    id: "05",
    weeks: "Weeks 15–16",
    title: "Rivira Technologies End to End Real Time Projects",
    desc: "Build sprint on a full real-time system · showcase day, portfolio, résumé & career launch.",
  },
];

const WEEK_BITS = [
  "Theory",
  "Hands-on coding",
  "Live enterprise demo",
  "Industry use cases",
  "Project implementation",
  "Assignments",
  "Q&A sessions",
  "Graded checkpoint",
];

const DIFFERENTIATORS = [
  { icon: Hand, title: "100% hands-on", desc: "You ship something every week" },
  { icon: Factory, title: "Enterprise-grade", desc: "Production-ready architecture" },
  { icon: Layers, title: "The latest stack", desc: "Agents, MCP, A2A, RAG" },
  { icon: Code2, title: "Live coding", desc: "Never recorded slideware" },
  { icon: Briefcase, title: "Real industry use cases", desc: "Across many domains" },
  { icon: GitBranch, title: "Parallel tracks", desc: "For coders and non-coders" },
  { icon: Cpu, title: "GPU lab access", desc: "For real model training" },
  { icon: FolderOpen, title: "Portfolio-ready", desc: "Projects & final showcase" },
  { icon: UserCheck, title: "Mentor feedback", desc: "Interview prep & career guidance" },
  { icon: Award, title: "Claude certification", desc: "Complete training & certification" },
];

const TOOL_GROUPS = [
  {
    icon: Cpu,
    title: "Languages & LLMs",
    tools: [
      "Python",
      "OpenAI",
      "Claude",
      "Gemini",
      "Llama",
      "Mistral",
      "DeepSeek",
      "Hugging Face",
      "Ollama",
    ],
  },
  {
    icon: Bot,
    title: "Frameworks & Agents",
    tools: [
      "LangChain",
      "LangGraph",
      "LlamaIndex",
      "CrewAI",
      "AutoGen",
      "MCP",
      "FastAPI",
      "Streamlit",
    ],
  },
  {
    icon: Database,
    title: "Vector & Data Stores",
    tools: [
      "Pinecone",
      "ChromaDB",
      "FAISS",
      "Weaviate",
      "Milvus",
      "Elasticsearch",
      "PostgreSQL",
      "MongoDB",
      "Redis",
    ],
  },
  {
    icon: Cloud,
    title: "Cloud & Deployment",
    tools: [
      "Azure OpenAI",
      "AWS Bedrock",
      "Google Vertex AI",
      "Docker",
      "Kubernetes",
    ],
  },
  {
    icon: Zap,
    title: "ML Training & Automation",
    tools: [
      "PyTorch",
      "TensorFlow",
      "scikit-learn",
      "n8n",
      "Zapier",
      "Make",
    ],
  },
  {
    icon: Settings,
    title: "Eval, Governance & Tooling",
    tools: [
      "RAGAS",
      "LangSmith",
      "Guardrails AI",
      "GitHub",
      "VS Code",
    ],
  },
];

const ROLES = [
  { icon: Bot, title: "AI Engineer", desc: "Build AI-powered production apps" },
  { icon: Users, title: "Agent Specialist", desc: "Design reliable multi-agent systems" },
  { icon: Search, title: "RAG Engineer", desc: "Build grounded retrieval systems" },
  { icon: Settings, title: "MLOps Engineer", desc: "Deploy AI systems reliably" },
  { icon: Zap, title: "AI Automation Specialist", desc: "Automate repetitive business workflows" },
];

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="AI Stack"
        eyebrow="16-week enterprise program"
        title="Master the"
        accent="AI Stack"
        text="Agents, agentic AI, LLMs, RAG, MCP and AI automation — the full enterprise stack, taught through live implementation, real use cases and production deployment."
        image="/images/pages/stack.webp"
        imageAlt="Layered diagram of the AI stack from Python and cloud up to automation"
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "View Curriculum", href: "#curriculum", ghost: true }]}
        facts={[
          { icon: CalendarDays, label: "16 Weeks" },
          { icon: Bot, label: "Agents & Agentic AI" },
          { icon: Cpu, label: "LLMs · RAG · MCP" },
          { icon: Workflow, label: "AI Automation" },
        ]}
      />

      <Section tone="white">
        <SectionHead split eyebrow="Program highlights" title="An enterprise stack, built live with you"
          text="Fourteen teaching weeks and two project weeks, for coders and technical non-coders alike." />
        <CardGrid cols={4} items={HIGHLIGHTS.map((h) => ({ icon: h.icon, title: h.title, text: h.desc }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="How it all connects" title="Six layers, one working system"
          text="Each layer builds on the one before it — this is the map the whole program follows." />
        <CardGrid cols={3} items={STACK_LAYERS.map((l) => ({ icon: l.icon, meta: `Layer ${l.n}`, title: l.title, text: l.desc }))} />
      </Section>

      <Section tone="white" id="curriculum">
        <SectionHead eyebrow="The curriculum" title="Seven modules across the stack" text="Open a module for its topics and what you'll build." />
        <Curriculum
          modules={MODULES.map((m) => ({
            title: m.title,
            meta: m.tools.join(" · "),
            summary: <>{m.desc} <strong style={{ color: "var(--rv-ink)" }}>You'll build:</strong> {m.build}</>,
            topics: m.topics,
          }))}
        />
      </Section>

      <Section>
        <Split
          image="/images/hero-projects-card.webp"
          eyebrow="Live enterprise demos"
          title="See it built, end to end"
          text="Every week includes live implementation by practitioners — the same way the work is done in production."
          bullets={LIVE_DEMOS}
          badge={{ value: "16", label: "weeks, live + recorded" }}
        />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="Use cases" title="Enterprise use cases you'll work with" />
        <CardGrid cols={4} items={USE_CASES.map((u) => ({ icon: u.icon, title: u.title, meta: u.tag }))} />
      </Section>

      <Section tone="dark">
        <SectionHead light eyebrow="Roadmap" title="Your 16-week learning roadmap" />
        <Steps light items={ROADMAP.map((r) => ({ title: r.title, text: <><strong style={{ color: "var(--rv-cyan)" }}>{r.weeks}</strong><br />{r.desc}</> }))} />
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <p className="rv-on-dark" style={{ marginBottom: 16, fontWeight: 600 }}>Every week includes</p>
          <Chips center items={WEEK_BITS} />
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="Why this program" title="What makes it different" />
        <CardGrid cols={5} items={DIFFERENTIATORS.map((d) => ({ icon: d.icon, title: d.title, text: d.desc }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="Technologies" title="Frameworks and platforms you'll master" />
        <ChipGroups groups={TOOL_GROUPS.map((g) => ({ icon: g.icon, title: g.title, items: g.tools }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="After the program" title="Career opportunities" />
        <CardGrid cols={5} items={ROLES.map((r) => ({ icon: r.icon, title: r.title, text: r.desc }))} />
      </Section>

      <EndBanner
        eyebrow="The future starts here"
        title="Build the AI systems companies are hiring for"
        text="Enroll now, or talk to a specialist about prerequisites, timings and the roadmap."
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Talk to a Specialist", to: "/contact", ghost: true }]}
      />
    </SitePage>
  );
}
