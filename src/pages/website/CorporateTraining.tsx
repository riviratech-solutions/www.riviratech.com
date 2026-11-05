import { getSeoByPath } from "../../utils/seo";
import {
  Building2,
  Laptop,
  Briefcase,
  Cloud,
  SquarePen,
  UserCheck,
  BookOpen,
  RefreshCw,
  Compass,
  KeyRound,
  Database,
  Sparkles,
  Brain,
  Rocket,
  Workflow,
  Layers,
  ShieldCheck,
  Factory,
  Target,
  Trophy,
  MessageSquare,
  PenTool,
  Megaphone,
  BarChart3,
  Presentation,
  Gauge,
  Users,
  Library,
  Bot,
  Map as MapIcon,
  Zap,
  Smile,
  Settings,
  TrendingUp,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Curriculum,
  Chips,
  EndBanner,
} from "../../components/site/PageKit";

const seo = getSeoByPath("corporate-training");

const TRACKS = [
  {
    icon: Laptop,
    title: "AI for Technical Teams",
    audience: "Best for: Developers, Engineers, Data Scientists",
    desc: "Technical training across Python, LLMs, RAG, AI agents and cloud deployment.",
    features: [
      "Python & AI/ML libraries",
      "LLMs, prompting & RAG",
      "AI agents & orchestration",
      "Cloud deployment",
      "Production projects",
    ],
    tools: ["Python", "LangChain", "LangGraph"],
    href: "/ai-for-coders",
  },
  {
    icon: Briefcase,
    title: "AI for Business Teams",
    audience: "Best for: Managers, Analysts, Non-Technical Staff",
    desc: "Business-focused AI training, no coding required — AI tools for strategy and operations.",
    features: [
      "AI fundamentals & strategy",
      "No-code AI tools",
      "Marketing & customer service AI",
      "Ethics, privacy & compliance",
      "Implementation roadmap",
    ],
    tools: ["Microsoft Copilot", "Zapier", "HubSpot"],
    href: "/genai-for-business",
  },
  {
    icon: Cloud,
    title: "Cloud AI Platforms",
    audience: "Best for: Cloud Engineers, DevOps, IT Teams",
    desc: "AI services across the major cloud platforms — Azure OpenAI, AWS Bedrock and Google Vertex.",
    features: [
      "Platform setup & IAM",
      "AutoML & model training",
      "Deployment & endpoints",
      "ML pipelines & automation",
      "Security & compliance",
    ],
    tools: ["Azure OpenAI", "AWS Bedrock", "Google Vertex"],
    href: "/corporate-training#curriculum",
  },
  {
    icon: SquarePen,
    title: "Prompt Engineering",
    audience: "Best for: All Professionals",
    desc: "Effective prompting, prompt libraries, custom GPTs and AI-powered workflows.",
    features: [
      "Prompt design & optimization",
      "Content generation & marketing",
      "Data analysis with AI",
      "Custom GPT development",
      "AI strategy & integration",
    ],
    tools: ["ChatGPT", "Claude", "Gemini"],
    href: "/fine-tuning-prompt-engineering",
  },
];

const CLOUD_MODULES = [
  {
    id: "1",
    icon: Compass,
    title: "Intro to Cloud AI Platforms",
    desc:
      "The three major platforms set side by side — Google Vertex, Azure OpenAI and AWS Bedrock — and what the IaaS, PaaS and SaaS distinction actually means when choosing between them.",
    topics: [
      "Google Vertex, Azure OpenAI, AWS Bedrock",
      "Platform comparison",
      "Service models: IaaS, PaaS, SaaS",
    ],
  },
  {
    id: "2",
    icon: KeyRound,
    title: "Environments & Access",
    desc:
      "Getting a team onto a platform safely: account and environment setup, identity and access management, and the security practices that should be in place before any data arrives.",
    topics: ["Account setup & configuration", "IAM & permissions", "Security best practices"],
  },
  {
    id: "3",
    icon: Database,
    title: "Data Management",
    desc:
      "The data layer underneath every model. Warehouses and lakes across BigQuery, S3 and equivalents, the ETL pipelines that feed them, and keeping the whole thing secure.",
    topics: ["BigQuery, Data Lake, S3", "ETL pipelines", "Data security"],
  },
  {
    id: "4",
    icon: Sparkles,
    title: "AutoML Solutions",
    desc:
      "Automated machine learning, where the platform handles model selection and tuning. Vertex AutoML, Azure AutoML and SageMaker Autopilot, and where each is the right call.",
    topics: ["Vertex AutoML", "Azure AutoML", "SageMaker Autopilot"],
  },
  {
    id: "5",
    icon: Brain,
    title: "Model Training",
    desc:
      "Training a custom model when AutoML is not enough — running the job, tuning the hyperparameters, and evaluating the result honestly rather than optimistically.",
    topics: ["Custom model training", "Hyperparameter tuning", "Model evaluation"],
  },
  {
    id: "6",
    icon: Rocket,
    title: "Deployment",
    desc:
      "Getting a trained model into service. Real-time against batch inference, exposing it behind an API endpoint, and versioning and rollback for when a new model is worse than the old one.",
    topics: ["Real-time vs batch", "API endpoints", "Versioning & rollback"],
  },
  {
    id: "7",
    icon: Workflow,
    title: "ML Pipelines",
    desc:
      "Automating the whole cycle so retraining is routine: Vertex Pipelines, Azure ML Pipelines and AWS Step Functions, and what belongs in a pipeline rather than a notebook.",
    topics: ["Vertex Pipelines", "Azure ML Pipelines", "AWS Step Functions"],
  },
  {
    id: "8",
    icon: Layers,
    title: "Advanced AI Services",
    desc:
      "The managed services that solve common problems without a custom model — language, vision and generative AI offerings, and when reaching for one beats building.",
    topics: ["NLP services", "Vision APIs", "Generative AI models"],
  },
  {
    id: "9",
    icon: ShieldCheck,
    title: "Security & Compliance",
    desc:
      "The compliance layer: GDPR and HIPAA obligations, encryption at rest and in transit, and the governance a regulated organisation has to evidence.",
    topics: ["GDPR, HIPAA", "Data encryption", "Governance"],
  },
  {
    id: "10",
    icon: Factory,
    title: "Industry Use Cases",
    desc:
      "Applied use cases across finance, healthcare and retail, taken from proof of concept through to the metrics that decide whether it goes further.",
    topics: ["Finance, Healthcare, Retail", "PoC Development", "Success metrics"],
  },
  {
    id: "11",
    icon: Target,
    title: "Final Project – Part 1",
    desc:
      "The final project begins: scoping something real, setting up the data and the model, and getting a first deployment running.",
    topics: ["Project scoping", "Data & model setup", "Initial deployment"],
  },
  {
    id: "12",
    icon: Trophy,
    title: "Final Project – Part 2",
    desc:
      "The final project completed — full deployment, the documentation that lets someone else run it, and a presentation of the result.",
    topics: ["Complete deployment", "Documentation", "Presentation"],
  },
];

const PROMPT_MODULES = [
  {
    id: "1",
    icon: MessageSquare,
    title: "AI Prompting Essentials",
    desc:
      "The shift to working AI-first, and the frameworks that make prompting repeatable rather than improvised. Establishes which categories of prompt return the most for the least effort.",
    topics: ["AI-first mindset", "Prompting frameworks", "High-value prompt types"],
  },
  {
    id: "2",
    icon: PenTool,
    title: "Developing Prompts",
    desc:
      "Writing a prompt, then improving it. Drafting, evaluating the output against what you actually wanted, refining, and personalising to your own voice and context.",
    topics: ["Prompt creation", "Evaluation & refinement", "Personalization"],
  },
  {
    id: "3",
    icon: Briefcase,
    title: "Business Problems",
    desc:
      "Pointing all of that at a real business problem — scenarios from your own work, planned properly, and built into a reusable playbook.",
    topics: ["Real-world scenarios", "Project planning", "Playbook project"],
  },
  {
    id: "4",
    icon: Megaphone,
    title: "Marketing & Content",
    desc:
      "Marketing and content: positioning, matching the message to the audience, and producing brand-consistent material at a pace manual writing cannot match.",
    topics: ["AI for positioning", "Audience alignment", "Brand content"],
  },
  {
    id: "5",
    icon: BookOpen,
    title: "Content Customization",
    desc:
      "Adapting one piece of content to every format it needs to appear in — emails, blog posts, social copy and formal business documents.",
    topics: ["Emails & blog posts", "Social media", "Business documents"],
  },
  {
    id: "6",
    icon: Target,
    title: "Marketing Campaigns",
    desc:
      "Whole campaigns rather than single pieces. Data-driven strategy, audience segmentation, and personalised content built per segment.",
    topics: ["Data-driven strategy", "Audience segmentation", "Personalized content"],
  },
  {
    id: "7",
    icon: BarChart3,
    title: "Data Analysis",
    desc:
      "Using AI on quantitative work: analysing figures, spotting and visualising trends, and generating the insight rather than just the chart.",
    topics: ["Quantitative analysis", "Trend visualization", "Insight generation"],
  },
  {
    id: "8",
    icon: Presentation,
    title: "Data Presentation",
    desc:
      "Turning that analysis into something an audience can act on — summarising, identifying the themes that matter, and building presentations around them.",
    topics: ["Summarizing data", "Theme identification", "Custom presentations"],
  },
  {
    id: "9",
    icon: Gauge,
    title: "AI Productivity",
    desc:
      "Personal productivity, which is where most people feel the difference first. Meetings, research support, and thinking a decision through with AI as a foil.",
    topics: ["Meeting optimization", "Research assistance", "Decision-making"],
  },
  {
    id: "10",
    icon: Users,
    title: "Communication",
    desc:
      "Communicating well with AI's help: structuring an argument, planning how to upskill a team, and building a go-to-market presentation.",
    topics: ["Thought structuring", "Upskilling plans", "Go-to-Market presentation"],
  },
  {
    id: "11",
    icon: Library,
    title: "Prompt Libraries",
    desc:
      "Building a prompt library so the work compounds instead of being redone. Organisation, consistency across a team, and the practices that keep it useful.",
    topics: ["Building libraries", "Efficiency & consistency", "Best practices"],
  },
  {
    id: "12",
    icon: Bot,
    title: "Custom GPTs",
    desc:
      "Custom GPTs: using the builder to package a workflow into a tool colleagues can use, aimed at a genuine business challenge.",
    topics: ["GPT Builder", "Business challenges", "Advanced techniques"],
  },
  {
    id: "13",
    icon: MapIcon,
    title: "AI Strategy",
    desc:
      "Integration into how the organisation actually works — fitting AI into existing workflows, implementing it, and managing the change.",
    topics: ["Workflow integration", "Implementation", "Change management"],
  },
  {
    id: "14",
    icon: Zap,
    title: "Advanced Techniques",
    desc:
      "The harder techniques: multi-step prompts, chaining several calls into a pipeline, and handling the failures that come with both.",
    topics: ["Multi-step prompts", "Chaining", "Error handling"],
  },
  {
    id: "15",
    icon: Smile,
    title: "Summarization & Sentiment",
    desc:
      "Summarisation and sentiment at volume — condensing long reports, tracking sentiment trends over time, and pulling decisions out of both.",
    topics: ["Report summarization", "Sentiment trends", "Decision insights"],
  },
  {
    id: "16",
    icon: Trophy,
    title: "Final Project",
    desc:
      "The closing project: showcase the work, review peers' and take feedback, and look at where the field is going next.",
    topics: ["Project showcase", "Peer review", "Future trends"],
  },
];

const WHY_US = [
  {
    title: "Customized Curriculum",
    desc: "Tailored content for your industry, technology stack, and business objectives",
  },
  {
    title: "Expert Instructors",
    desc: "Industry practitioners with real-world AI implementation experience",
  },
  {
    title: "Hands-On Projects",
    desc: "Work on your company's actual use cases and data during training",
  },
  {
    title: "Measurable ROI",
    desc: "Pre/post skills assessment and certification to track progress",
  },
];

const DELIVERY = [
  {
    icon: Building2,
    title: "On-Site Training",
    desc: "Instructors come to you for immersive, in-person sessions",
  },
  {
    icon: Laptop,
    title: "Virtual Sessions",
    desc: "Live online training with interactive workshops and Q&A",
  },
  {
    icon: RefreshCw,
    title: "Hybrid Model",
    desc: "Combination of on-site kickoff with ongoing virtual sessions",
  },
  {
    icon: UserCheck,
    title: "Self-Paced + Mentoring",
    desc: "Flexible learning plus regular booked mentor support calls",
  },
];

const INDUSTRIES = [
  "Finance & Banking",
  "Healthcare",
  "Retail & E-commerce",
  "Manufacturing",
  "Technology & IT",
  "Telecommunications",
  "Automotive",
  "Energy & Utilities",
];

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="Corporate Training"
        eyebrow="For teams & enterprises"
        title="AI training"
        accent="for your enterprise"
        text="Customized programs for teams of every size — from technical deep-dives for engineers to AI strategy for leaders — delivered on-site, online or hybrid."
        image="/images/pages/corporate.webp"
        imageAlt="A team connected to an AI enablement dashboard"
        actions={[{ label: "Request a Consultation", to: "/contact" }, { label: "View Training Tracks", href: "#tracks", ghost: true }]}
        facts={[
          { icon: Layers, label: "4 Training Tracks" },
          { icon: Settings, label: "Customized Programs" },
          { icon: Building2, label: "Flexible Delivery" },
          { icon: TrendingUp, label: "Measurable ROI" },
        ]}
      />

      <Section tone="white" id="tracks">
        <SectionHead split eyebrow="Training tracks" title="Pick a track — or let us build one around your team"
          text="Every track is hands-on and tailored to your tools, data and industry." actions={[{ label: "Request a Consultation", to: "/contact" }]} />
        <CardGrid cols={2} items={TRACKS.map((t) => ({ icon: t.icon, meta: t.audience.replace(/^Best for:\s*/, "For "), title: t.title, text: t.desc, list: t.features, chips: t.tools, to: t.href, linkLabel: "View the program" }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Detailed curriculum" title="Cloud AI platforms" text="Twelve modules across Google Vertex, Azure OpenAI and AWS Bedrock." />
        <Curriculum limit={5} modules={CLOUD_MODULES.map((m) => ({ title: m.title, summary: m.desc, topics: m.topics }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Why Rivira Tech" title="Why teams choose us for corporate training" />
        <CardGrid cols={4} items={WHY_US.map((w) => ({ title: w.title, text: w.desc }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="Detailed curriculum" title="Prompt engineering for teams" text="Sixteen short modules that make every role more productive with AI." />
        <Curriculum limit={5} modules={PROMPT_MODULES.map((m) => ({ title: m.title, summary: m.desc, topics: m.topics }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Delivery" title="Flexible delivery options" />
        <CardGrid cols={4} items={DELIVERY.map((d) => ({ icon: d.icon, title: d.title, text: d.desc }))} />
      </Section>

      <Section tone="white" tight>
        <SectionHead eyebrow="Industries" title="Industries we serve" />
        <Chips center items={INDUSTRIES} />
      </Section>

      <EndBanner
        eyebrow="Let's plan it together"
        title="Upskill your whole team with practical AI"
        text="Tell us about your team and goals — we'll propose a track, schedule and format that fits."
        actions={[{ label: "Request a Consultation", to: "/contact" }, { label: "Call +91 72073 01237", href: "tel:+917207301237", ghost: true }]}
      />
    </SitePage>
  );
}
