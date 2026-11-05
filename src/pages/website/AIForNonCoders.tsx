import { getSeoByPath } from "../../utils/seo";
import {
  Briefcase,
  Target,
  Laptop,
  Megaphone,
  Scale,
  Compass,
  TrendingUp,
  Bot,
  Sparkles,
  Lock,
  Rocket,
  Telescope,
  BarChart3,
  ListChecks,
  Zap,
  Palette,
  BookOpen,
  Mic,
  Users,
  MessagesSquare,
  Newspaper,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Curriculum,
  ChipGroups,
  FaqBlock,
  EndBanner,
} from "../../components/site/PageKit";

const seo = getSeoByPath("ai-for-non-coders");

const LEARN = [
  {
    icon: Target,
    title: "Identify AI Opportunities",
    desc: "Spot areas across your business where AI can add measurable value",
  },
  {
    icon: Laptop,
    title: "Use No-Code AI Tools",
    desc: "Build AI solutions using platforms like DataRobot, Salesforce Einstein, and more",
  },
  {
    icon: Megaphone,
    title: "AI for Marketing",
    desc: "Use AI for tailored marketing, customer segments, chatbots and live support",
  },
  {
    icon: Scale,
    title: "Navigate AI Ethics",
    desc: "Understand bias, compliance under GDPR and CCPA, and responsible AI deployment",
  },
];

const HIGHLIGHTS = [
  {
    tag: "Module 02",
    title: "Case studies from real adopters",
    desc:
      "What Amazon and Google actually did, how AI differs from traditional analytics, and where the return comes from.",
  },
  {
    tag: "Module 03",
    title: "Hands-on tool workshops",
    desc:
      "Build and test a working model in DataRobot, H2O.ai and MonkeyLearn — used in the session, not shown on a slide.",
  },
  {
    tag: "Module 04",
    title: "Marketing and customer service",
    desc:
      "Personalisation and segmentation through HubSpot and Adobe Sensei, then support with Drift, Intercom and ChatGPT.",
  },
  {
    tag: "Modules 05 · 06",
    title: "Bias, GDPR and CCPA",
    desc:
      "Where bias enters a system and what reduces it, and the compliance ground to stand on before a customer sees it.",
  },
  {
    tag: "Module 07",
    title: "From pilot to production",
    desc:
      "Find the opportunities worth pursuing, build or buy the team, and manage the change as the business keeps running.",
  },
  {
    tag: "Module 08",
    title: "A route to keep learning",
    desc:
      "Where the field goes next: the metaverse, blockchain and sustainability, and how to keep your skills current.",
  },
];

const CURRICULUM = [
  {
    num: "1",
    icon: Compass,
    title: "Introduction to AI",
    desc:
      "The concepts everything else rests on, explained without code: what separates machine learning, deep learning and NLP, how the field arrived here, and where it is already at work across healthcare, finance and retail.",
    topics: [
      "What is AI? Key concepts",
      "Machine Learning, Deep Learning, NLP",
      "History and evolution of AI",
      "AI in everyday life",
      "Industry impact: Healthcare, Finance, Retail",
      "Common myths about AI",
    ],
    tools: [] as string[],
  },
  {
    num: "2",
    icon: Briefcase,
    title: "AI in Business",
    desc:
      "AI as a business question rather than a technical one. How it changes operations, what the well-known adopters actually did, how it differs from traditional analytics, and how to think about return on the investment.",
    topics: [
      "How AI transforms operations",
      "Case studies: Amazon, Google",
      "AI vs Traditional Analytics",
      "Benefits in decision-making",
      "ROI of AI implementation",
      "Build, buy or partner",
    ],
    tools: [],
  },
  {
    num: "3",
    icon: Bot,
    title: "No-Code AI Tools",
    desc:
      "The platforms that let you build working AI without writing code — DataRobot, H2O.ai, MonkeyLearn, Salesforce Einstein, Zoho and IBM Watson — used hands-on rather than demonstrated.",
    topics: [
      "DataRobot, H2O.ai, MonkeyLearn",
      "Building AI models without code",
      "Salesforce Einstein, Zoho AI",
      "IBM Watson overview",
      "Practical tool workshops",
      "Choosing the right tool for a task",
    ],
    tools: ["DataRobot", "H2O.ai"],
  },
  {
    num: "4",
    icon: Megaphone,
    title: "AI in Marketing",
    desc:
      "Marketing is where most organisations meet AI first. Personalisation and segmentation, the tooling around HubSpot and Adobe Sensei, and conversational support through Drift, Intercom and ChatGPT.",
    topics: [
      "Personalized marketing with AI",
      "Customer segmentation",
      "HubSpot, Adobe Sensei",
      "Chatbots: Drift, Intercom",
      "ChatGPT for customer service",
      "Measuring campaign lift",
    ],
    tools: ["HubSpot", "ChatGPT"],
  },
  {
    num: "5",
    icon: Scale,
    title: "AI Ethics",
    desc:
      "Why ethical AI is a practical concern and not a formality. Where bias enters a system, what can be done to reduce it, and what responsible deployment looks like when real customers are on the other end.",
    topics: [
      "Importance of ethical AI",
      "Bias in AI systems",
      "How to mitigate bias",
      "Responsible AI deployment",
      "Building trust with AI",
      "Explaining an AI decision",
    ],
    tools: [],
  },
  {
    num: "6",
    icon: Lock,
    title: "Regulations & Privacy",
    desc:
      "The regulatory ground: GDPR and CCPA obligations, what they mean for data you already hold, and the privacy-preserving techniques that let you use it without exposing the people in it.",
    topics: [
      "GDPR compliance",
      "CCPA requirements",
      "Data privacy concerns",
      "Privacy-preserving AI",
      "Differential privacy basics",
      "Vendor & data-processing agreements",
    ],
    tools: [],
  },
  {
    num: "7",
    icon: Rocket,
    title: "Implementing AI",
    desc:
      "Turning intent into a plan. Finding the opportunities worth pursuing, building or buying the team, working with vendors, and managing the change through an organisation that has to keep running meanwhile.",
    topics: [
      "Identifying AI opportunities",
      "Developing AI strategy",
      "Building an AI team",
      "Working with AI vendors",
      "Change management",
      "Taking a pilot to production",
    ],
    tools: [],
  },
  {
    num: "8",
    icon: Telescope,
    title: "Future of AI",
    desc:
      "Where the field is heading and how to keep pace with it — emerging trends, AI alongside the metaverse and blockchain, sustainability applications, and a route to carry on learning after the program ends.",
    topics: [
      "Emerging trends",
      "AI in Metaverse",
      "AI & Blockchain",
      "AI for sustainability",
      "Continuous learning path",
      "Keeping your skills current",
    ],
    tools: [],
  },
];

const TOOL_GROUPS = [
  {
    icon: Bot,
    title: "AI/ML Platforms",
    tools: ["DataRobot", "H2O.ai", "MonkeyLearn", "IBM Watson"],
  },
  {
    icon: Briefcase,
    title: "Business AI Tools",
    tools: ["Salesforce Einstein", "Zoho AI", "Power BI", "Tableau"],
  },
  {
    icon: Sparkles,
    title: "Marketing & Personalisation",
    tools: ["HubSpot", "Adobe Sensei"],
  },
  {
    icon: MessagesSquare,
    title: "Conversational AI & Support",
    tools: ["Drift", "Intercom", "ChatGPT"],
  },
];

const CAREERS = [
  { icon: BarChart3, title: "AI Analyst", desc: "Spot AI opportunities early" },
  { icon: ListChecks, title: "AI Project Manager", desc: "Lead AI implementation projects" },
  { icon: Zap, title: "Automation Specialist", desc: "Build no-code AI workflows" },
  { icon: Palette, title: "AI Product Designer", desc: "Design AI-powered product experiences" },
  { icon: TrendingUp, title: "BI Lead", desc: "Drive data-driven business decisions" },
];

const RESOURCES = [
  {
    icon: BookOpen,
    title: "Recommended Books",
    items: [`"AI Superpowers" by Kai-Fu Lee`, `"Prediction Machines" by Ajay Agrawal`],
  },
  {
    icon: Mic,
    title: "Podcasts",
    items: [`"AI in Business"`, `"The AI Alignment Podcast"`],
  },
  {
    icon: Users,
    title: "Communities",
    items: ["AI for Business LinkedIn Group", "AI in Business Reddit Forum"],
  },
  {
    icon: Newspaper,
    title: "Industry Reports",
    items: [`"State of AI" by McKinsey`, `"AI Index Report" by Stanford HAI`],
  },
];

const FAQ = [
  { q: "Do I need any coding or technical background?", a: "None. Every module uses no-code tools and plain-language explanations, built for business and non-technical professionals." },
  { q: "Which tools will I use?", a: "No-code AI platforms, business-intelligence tools, marketing and automation tools — thirteen in all, grouped under 'tools you'll master' above." },
  { q: "How is it taught?", a: "Live, instructor-led sessions with real case studies, plus recordings of every class so you can catch up at your own pace." },
  { q: "What roles does it prepare me for?", a: "AI analyst, AI project manager, automation specialist, AI product designer and similar business-facing AI roles." },
  { q: "Do I get a certificate?", a: "Yes — a Rivira Tech certificate of completion once you finish the program requirements." },
  { q: "Can my whole team join?", a: "Yes. For teams we also run this as corporate training, tailored to your organisation and industry." },
];

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="AI for Non-Coders"
        eyebrow="No coding required"
        title="AI for business &"
        accent="non-technical professionals"
        text="Harness AI without writing code. Learn the no-code tools that improve decisions, automate marketing and build intelligent workflows into your day."
        image="/images/pages/nocode.webp"
        imageAlt="A no-code workflow connecting an AI assistant, a summary step and a report"
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "View Curriculum", href: "#curriculum", ghost: true }]}
        facts={[
          { icon: BookOpen, label: "8 Modules" },
          { icon: Zap, label: "13 No-Code Tools" },
          { icon: Target, label: "Business Case Studies" },
          { icon: Briefcase, label: "5 Career Tracks" },
        ]}
      />

      <Section tone="white">
        <SectionHead split eyebrow="What you'll learn" title="Practical AI for the work you already do"
          text="Spot where AI adds value, then put it to work with tools you can use the same day." />
        <CardGrid cols={4} items={LEARN.map((l) => ({ icon: l.icon, title: l.title, text: l.desc }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Module highlights" title="Real cases, real tools, real results"
          text="A few of the moments learners remember most from the eight modules." />
        <CardGrid cols={3} items={HIGHLIGHTS.map((h) => ({ meta: h.tag, title: h.title, text: h.desc }))} />
      </Section>

      <Section tone="white" id="curriculum">
        <SectionHead eyebrow="The curriculum" title="Eight modules, zero code"
          text="Open any module to see its topics." />
        <Curriculum modules={CURRICULUM.map((m) => ({ title: m.title, meta: m.tools.length ? m.tools.join(" · ") : undefined, summary: m.desc, topics: m.topics }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Tools" title="No-code tools you'll master" />
        <ChipGroups groups={TOOL_GROUPS.map((g) => ({ icon: g.icon, title: g.title, items: g.tools }))} />
      </Section>

      <Section tone="white">
        <SectionHead eyebrow="After the program" title="Career opportunities" />
        <CardGrid cols={5} items={CAREERS.map((c) => ({ icon: c.icon, title: c.title, text: c.desc }))} />
      </Section>

      <Section>
        <SectionHead eyebrow="Keep learning" title="Additional learning resources" />
        <CardGrid cols={4} items={RESOURCES.map((r) => ({ icon: r.icon, title: r.title, list: r.items }))} />
      </Section>

      <Section tone="white">
        <FaqBlock items={FAQ} title="Questions about AI for Non-Coders" />
      </Section>

      <EndBanner
        eyebrow="The future starts here"
        title="Put AI to work in your role"
        text="Enroll today, or talk to a specialist about the curriculum, timings and enrollment."
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Talk to a Specialist", to: "/contact", ghost: true }]}
      />
    </SitePage>
  );
}
