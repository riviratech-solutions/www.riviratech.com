import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Split,
  Curriculum,
  ChipGroups,
  FaqBlock,
  EndBanner,
} from "../../components/site/PageKit";
import { getSeoByPath } from "../../utils/seo";
import {
  BookOpen,
  Rocket,
  Bot,
  Briefcase,
  Sparkles,
  Code2,
  Layers,
  Brain,
  MessageCircle,
  Target,
  Database,
  GitBranch,
  CloudCog,
  Compass,
  Zap,
  Wrench,
  GraduationCap,
  Cpu,
  Laptop,
  BarChart3,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const seo = getSeoByPath("ai-for-coders");

const HIGHLIGHTS = [
  {
    icon: BookOpen,
    title: "13+ Modules",
    desc: "Comprehensive curriculum from Python basics through agentic systems",
  },
  {
    icon: Rocket,
    title: "Production-Ready",
    desc: "Build and deploy AI applications using industry-standard tools",
  },
  {
    icon: Bot,
    title: "LLMs, RAG & Agents",
    desc: "Master the latest GenAI architectures, frameworks and patterns",
  },
  {
    icon: Briefcase,
    title: "Career Guidance",
    desc: "Portfolio development, resume optimisation and hands-on job assistance",
  },
];

const CURRICULUM: {
  id: string;
  wide?: boolean;
  icon: LucideIcon;
  title: string;
  desc: string;
  topics: string[];
  tools: string[];
}[] = [
  {
    id: "1",
    icon: Compass,
    title: "Introduction to AI & Generative AI Tools",
    desc:
      "Where generative AI sits inside AI as a whole, what the current model landscape offers, and how to judge which tool fits a task. Sets the vocabulary and the responsible-use ground rules for the track.",
    topics: [
      "Foundations of AI (ML, DL, NLP)",
      "GenAI Ecosystem & LLM Overview",
      "AI Tools Landscape (ChatGPT, Claude, Gemini)",
      "Prompt Engineering Introduction",
      "Ethical AI & Responsible Use",
      "Choosing a model for a task",
    ],
    tools: ["ChatGPT", "Claude", "Gemini"],
  },
  {
    id: "2",
    icon: Code2,
    title: "Python Fundamentals for GenAI",
    desc:
      "Python from the ground up, aimed squarely at AI work rather than general programming. Covers the core language, the notebook environments this field lives in, and a first call against the OpenAI API.",
    topics: [
      "Python Core Concepts",
      "Data Structures & Control Flow",
      "Working with Jupyter & Colab",
      "GitHub Copilot Integration",
      "OpenAI API Basics",
      "Virtual environments & packages",
    ],
    tools: ["Python", "Jupyter", "Colab"],
  },
  {
    id: "3",
    icon: Layers,
    title: "Python Intermediate + AI Packages",
    desc:
      "The step from writing Python to using it on data. Object-oriented structure and error handling, then the numerical and plotting libraries later modules depend on, plus LangChain and Hugging Face.",
    topics: [
      "OOP & Exception Handling",
      "NumPy, Pandas, Matplotlib, Seaborn",
      "OpenAI SDK & LangChain Preview",
      "Hugging Face Transformers",
      "API Integration & Data Processing",
      "File, CSV & JSON handling",
    ],
    tools: ["Pandas", "NumPy", "Seaborn"],
  },
  {
    id: "4",
    icon: Brain,
    title: "Machine Learning & Deep Learning",
    desc:
      "The classical machine learning underneath the generative layer. Supervised and unsupervised methods with Scikit-Learn, then CNNs, RNNs, LSTMs and transformers in TensorFlow and PyTorch.",
    topics: [
      "Supervised & Unsupervised Learning",
      "Scikit-Learn Algorithms",
      "Neural Networks & Architectures",
      "CNNs, RNNs, LSTMs, Transformers",
      "TensorFlow & PyTorch",
      "Model evaluation & metrics",
    ],
    tools: ["Scikit-Learn", "TensorFlow", "PyTorch"],
  },
  {
    id: "5",
    icon: MessageCircle,
    title: "Natural Language Processing",
    desc:
      "How machines represent and reason about language. Preprocessing and tokenization, embeddings, the split between BERT and GPT, and applied tasks like sentiment analysis and entity recognition.",
    topics: [
      "Text Preprocessing & Representation",
      "Word Embeddings & Tokenization",
      "BERT vs GPT Architectures",
      "NLTK, spaCy, Hugging Face",
      "Sentiment Analysis & NER",
      "Text classification pipelines",
    ],
    tools: ["spaCy", "NLTK", "Transformers"],
  },
  {
    id: "6",
    icon: Target,
    title: "Prompt Engineering & Projects",
    desc:
      "Prompting treated as engineering rather than phrasing. Reusable patterns, chain-of-thought and ReAct, a first introduction to retrieval, and LangChain projects wired into a Flask or FastAPI service.",
    topics: [
      "Advanced Prompt Patterns",
      "Chain-of-Thought & ReAct",
      "RAG Concept Introduction",
      "LangChain Projects",
      "Flask/FastAPI Integration",
      "Evaluating prompt quality",
    ],
    tools: ["LangChain", "OpenAI API", "FastAPI"],
  },
  {
    id: "7",
    icon: Sparkles,
    title: "LLMs & GenAI App Development",
    desc:
      "Building real applications on top of large language models. The transformer architecture in depth, the major provider APIs, and the embedding and vector-database layer that makes an LLM useful.",
    topics: [
      "Transformer Architecture Deep Dive",
      "OpenAI, Gemini, Claude APIs",
      "Embeddings & Vector Databases",
      "FAISS, Pinecone, Chroma",
      "Agent Frameworks Overview",
      "Streaming, context limits & token cost",
    ],
    tools: ["OpenAI API", "Pinecone", "FAISS"],
  },
  {
    id: "8",
    icon: Database,
    title: "RAG Applications & AI Agents",
    desc:
      "Retrieval-augmented generation and the agents that use it. Document parsing and chunking through to a full pipeline, then multi-agent systems in LangChain, CrewAI and AutoGen with tool use and memory.",
    topics: [
      "RAG Pipeline Architecture",
      "Document Parsing & Chunking",
      "LangChain Agents & CrewAI",
      "AutoGen Multi-Agent Systems",
      "Tool Usage & Memory",
      "Measuring retrieval accuracy",
    ],
    tools: ["LangChain", "CrewAI", "AutoGen"],
  },
  {
    id: "9",
    icon: CloudCog,
    title: "Cloud Deployment & Scalability",
    desc:
      "Getting a model out of a notebook and onto infrastructure that survives real traffic. Managed AI services on the three major clouds, containerised deployment, autoscaling, and monitoring once it is live.",
    topics: [
      "Azure, AWS, GCP AI Services",
      "Flask/FastAPI Deployment",
      "Docker & Containerization",
      "Kubernetes & Auto-scaling",
      "Monitoring with Prometheus/Grafana",
      "CI/CD for AI services",
    ],
    tools: ["Docker", "Kubernetes", "AWS/Azure/GCP"],
  },
  {
    id: "10",
    icon: GitBranch,
    title: "MCPs & Agent-to-Agent Communication",
    desc:
      "The emerging standards for letting agents talk to tools and to each other. Model Context Protocol, agent-to-agent message passing, and the security and governance questions that arrive the moment agents can act.",
    topics: [
      "Model Context Protocol Standards",
      "Multi-Agent Collaboration",
      "A2A Message Passing",
      "CrewAI & AutoGen Implementation",
      "Security & Governance",
      "Building your own MCP server",
    ],
    tools: ["MCP", "LangGraph", "OpenDevin"],
  },
  {
    id: "11A",
    wide: true,
    icon: Cpu,
    title: "Agentic Systems & Orchestration",
    desc:
      "Orchestration: several specialised agents working as a team rather than one doing everything. Planner, executor and reviewer roles, shared memory, and taking the result to production.",
    topics: [
      "Planner/Executor/Reviewer Agents",
      "Task Orchestration Frameworks",
      "Memory & Context Sharing",
      "Production Deployment",
      "Capstone Phase 2",
      "Observability for agent runs",
    ],
    tools: ["LangGraph", "CrewAI", "Streamlit"],
  },
  {
    id: "11B",
    wide: true,
    icon: Zap,
    title: "AI Copilots & Productivity Tools",
    desc:
      "The copilot tools that change how developers work day to day, compared side by side — GitHub Copilot, Microsoft 365 Copilot, Cursor, Codex, CodeWhisperer and Duet — so the choice is informed.",
    topics: [
      "GitHub Copilot Deep Dive",
      "Microsoft 365 Copilot",
      "Cursor.ai & OpenAI Codex",
      "Amazon CodeWhisperer",
      "Google Duet AI",
      "Reviewing AI-written code",
    ],
    tools: ["Copilot", "Cursor.ai", "Codex"],
  },
  {
    id: "12",
    icon: Wrench,
    title: "No-Code & Low-Code AI Tools",
    desc:
      "The no-code layer, which is often the fastest route to a working automation. Workflow tools like n8n, Zapier and Make, and orchestrating several of them into one pipeline without writing a service.",
    topics: [
      "n8n Workflow Automation",
      "Zapier & Make Integrations",
      "ClickUp, Notion AI Automation",
      "Bolt.new & Flowise AI",
      "Multi-Tool Orchestration",
      "Where no-code stops scaling",
    ],
    tools: ["n8n", "Zapier", "Notion AI", "Bolt.new"],
  },
  {
    id: "13",
    icon: GraduationCap,
    title: "Capstone, Portfolio & Career",
    desc:
      "The track's closing stretch: finish the capstone, present it, and turn the work into a portfolio, a GitHub presence and a resume that survives an interview.",
    topics: [
      "Final Project Presentation",
      "GitHub Portfolio Development",
      "LinkedIn Optimization",
      "Resume Building with AI",
      "Interview Preparation",
      "Mock technical interviews",
    ],
    tools: ["GitHub", "LinkedIn", "Portfolio"],
  },
];

const TOOL_GROUPS = [
  {
    icon: Code2,
    title: "Languages & Libraries",
    tools: ["Python", "Pandas", "NumPy", "TensorFlow", "PyTorch", "Keras"],
  },
  {
    icon: Sparkles,
    title: "LLM APIs & Frameworks",
    tools: ["OpenAI API", "Claude API", "Gemini API", "LangChain", "LangGraph"],
  },
  {
    icon: Bot,
    title: "Agent Frameworks",
    tools: ["CrewAI", "AutoGen", "FAISS", "Pinecone", "Chroma"],
  },
  {
    icon: CloudCog,
    title: "Cloud & DevOps",
    tools: ["AWS", "Azure", "GCP", "Docker", "Kubernetes"],
  },
];

const PROJECTS = [
  {
    title: "AI Knowledge Assistant with RAG",
    desc: "Build a document Q&A bot using LangChain, OpenAI, and vector databases",
    tools: ["LangChain", "FAISS", "OpenAI"],
  },
  {
    title: "Multi-Agent Research System",
    desc: "Create collaborative AI agents that plan, research, write, and review",
    tools: ["CrewAI", "LangGraph"],
  },
  {
    title: "Cloud-Deployed Chatbot",
    desc: "Deploy a production chatbot with Docker, FastAPI, and cloud services",
    tools: ["Docker", "FastAPI", "AWS/GCP"],
  },
  {
    title: "Agentic Workflow Automation",
    desc: "Build an autonomous system for email summarization and task management",
    tools: ["AutoGen", "n8n"],
  },
  {
    title: "Custom GPT Applications",
    desc: "Design and deploy specialized GPTs for business use cases",
    tools: ["OpenAI GPTs", "Gemini Studio"],
  },
  {
    title: "Capstone: Full AI Pipeline",
    desc: "End-to-end project: data ingestion → model → agents → cloud deployment",
    tools: ["Full Stack", "Portfolio Ready"],
  },
];

const CAREERS = [
  { icon: Laptop, title: "AI Developer", desc: "Build AI-powered production apps" },
  { icon: BarChart3, title: "Data Scientist", desc: "Analyse data, build models" },
  { icon: Target, title: "Prompt Engineer", desc: "Design reliable LLM prompts" },
  { icon: Settings, title: "MLOps Engineer", desc: "Deploy ML systems reliably" },
  { icon: Bot, title: "Agent Specialist", desc: "Design reliable multi-agent systems" },
];

const FAQ = [
  { q: "Do I need to know Python already?", a: "No. Module 2 teaches Python from the ground up, aimed at AI work. If you already code, the early modules move quickly and you get to LLMs, RAG and agents sooner." },
  { q: "How long is the program?", a: "About 6–8 weeks of live, instructor-led sessions, with every class recorded so you can rewatch at your own pace." },
  { q: "What will I have built by the end?", a: "Six portfolio projects, from a RAG knowledge assistant and a multi-agent research system to a cloud-deployed chatbot and a full capstone pipeline." },
  { q: "Is there career support?", a: "Yes. The final module covers your GitHub portfolio, LinkedIn, an AI-assisted resume, interview preparation and mock technical interviews." },
  { q: "Do I get a certificate?", a: "Yes. Learners who complete the program requirements receive a Rivira Tech certificate of completion they can share on LinkedIn." },
  { q: "Who should I talk to before enrolling?", a: "Call a career advisor on +91 72073 01237 or email info@riviratech.com — we'll walk you through the curriculum, timings and enrollment." },
];

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="AI for Coders"
        eyebrow="Developer track"
        title="Master AI & Generative AI"
        accent="Development"
        text="From Python fundamentals to production-ready AI agents, RAG systems and cloud deployment — built project by project with mentors who ship AI for a living."
        image="/images/pages/coders.webp"
        imageAlt="Code editor with an AI suggestion and a retrieval-quality chart"
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "View Curriculum", href: "#curriculum", ghost: true }]}
        facts={[
          { icon: BookOpen, label: "13+ Modules" },
          { icon: Rocket, label: "6 Portfolio Projects" },
          { icon: CloudCog, label: "Cloud Deployment" },
          { icon: Briefcase, label: "Career Support" },
        ]}
      />

      <Section tone="white">
        <SectionHead split eyebrow="Program highlights" title="What the track covers — and what you leave with"
          text="A complete path through the modern AI developer stack, taught hands-on and finished with a portfolio you can show." />
        <CardGrid cols={4} items={HIGHLIGHTS.map((h) => ({ icon: h.icon, title: h.title, text: h.desc }))} />
      </Section>

      <Section>
        <Split
          image="/images/ai-for-coders-card.webp"
          eyebrow="Who it's for"
          title="Built for people who already work with software"
          text="Developers, testers, analysts, data engineers and architects who want to move from using AI tools to building with them."
          bullets={[
            "Work with LLMs, RAG and AI agents in production patterns",
            "Use cloud AI services and modern AI tooling with confidence",
            "Ship a portfolio-grade project you can demo in interviews",
            "Learn live with mentors, rewatch every recorded session",
          ]}
          badge={{ value: "6–8", label: "weeks, live + recorded" }}
          actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Talk to an Advisor", to: "/contact", ghost: true }]}
        />
      </Section>

      <Section tone="white" id="curriculum">
        <SectionHead eyebrow="The curriculum" title="A complete curriculum, Python to production"
          text="Open any module to see its topics. The tools you'll use are listed under each title." />
        <Curriculum limit={6} modules={CURRICULUM.map((m) => ({ title: m.title, meta: m.tools.join(" · "), summary: m.desc, topics: m.topics }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Projects" title="Production-ready projects you'll build"
          text="Each project uses the tools from the modules before it, so your portfolio grows as you learn." />
        <CardGrid cols={3} items={PROJECTS.map((p, i) => ({ meta: `Project ${String(i + 1).padStart(2, "0")}`, title: p.title, text: p.desc, chips: p.tools }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Tools & technologies" title="The stack you'll master"
          text="From the first notebook to a deployed, monitored service." />
        <ChipGroups groups={TOOL_GROUPS.map((g) => ({ icon: g.icon, title: g.title, items: g.tools }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="After the program" title="Roles you'll be ready for" />
        <CardGrid cols={5} items={CAREERS.map((c) => ({ icon: c.icon, title: c.title, text: c.desc }))} />
      </Section>

      <Section>
        <FaqBlock items={FAQ} title="Questions about AI for Coders" />
      </Section>

      <EndBanner
        eyebrow="The future starts here"
        title="Start building with AI this month"
        text="Join IT professionals mastering AI through hands-on projects, real-world experience and career support."
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Talk to a Specialist", to: "/contact", ghost: true }]}
      />
    </SitePage>
  );
}
