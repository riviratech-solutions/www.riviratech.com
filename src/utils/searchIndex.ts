import { PHASES, PROJECT_LEVELS } from "../pages/website/coursePlanData";
import { POSTS } from "../pages/website/blogPosts";
import { FAQ_ITEMS } from "../pages/website/Faq";
import { searchText, searchTerms, termAt } from "./searchText";

export type SearchKind = "Program" | "Curriculum" | "Project" | "Article" | "Question" | "Workshop" | "Page";

export type SearchEntry = {
  title: string;
  path: string;
  kind: SearchKind;
  /** Shown under the title in the results list. */
  desc?: string;
  /** Not displayed — matched against. Topics, technologies, synonyms. */
  keywords?: string[];
};

const PROGRAMS: SearchEntry[] = [
  {
    title: "Generative AI Engineer Program",
    path: "/programs",
    kind: "Program",
    desc: "The flagship program — LLMs, RAG, agents and the full stack",
    keywords: ["flagship", "genai", "generative ai", "llm", "rag", "agents", "engineer",
               "bootcamp", "full stack", "certification", "certificate", "certified",
               "live classes"],
  },
  {
    title: "AI for Coders",
    path: "/ai-for-coders",
    kind: "Program",
    desc: "For developers, testers, analysts and architects",
    keywords: ["developer", "programmer", "python", "engineer", "technical", "software",
               "testers", "analysts", "architects"],
  },
  {
    title: "AI for Non-Coders",
    path: "/ai-for-non-coders",
    kind: "Program",
    desc: "For business users and career changers — no programming needed",
    keywords: ["no code", "nocode", "non technical", "beginner", "career change",
               "business users", "without coding"],
  },
  {
    title: "GenAI for Business",
    path: "/genai-for-business",
    kind: "Program",
    desc: "For managers, analysts and business decision makers",
    keywords: ["business", "manager", "leadership", "strategy", "decision makers",
               "roi", "automation", "operations"],
  },
  {
    title: "AI Stack",
    path: "/ai-stack",
    kind: "Program",
    desc: "AI agents, orchestration, retrieval and vector databases",
    keywords: ["agents", "ai agents", "agentic", "orchestration", "vector database",
               "embeddings", "retrieval", "mcp", "advanced", "langchain",
               "automation", "multi agent", "tools", "workflow",
               "model context protocol"],
  },
  {
    title: "AI for Kids",
    path: "/ai-for-kids",
    kind: "Program",
    desc: "Python basics, creative projects and robotics for school students",
    keywords: ["kids", "children", "school", "students", "python", "robotics",
               "games", "weekend", "beginner"],
  },
  {
    title: "Corporate Training",
    path: "/corporate-training",
    kind: "Program",
    desc: "Tailored programs for teams and enterprises",
    keywords: ["corporate", "enterprise", "team", "company", "b2b", "custom",
               "upskilling", "workforce"],
  },
  {
    title: "Foundations of AI",
    path: "/foundations-of-ai",
    kind: "Program",
    desc: "Where AI starts — concepts, models and how it fits together",
    keywords: ["foundations", "basics", "intro", "introduction", "fundamentals", "beginner"],
  },
  {
    title: "Fine-Tuning & Prompt Engineering",
    path: "/fine-tuning-prompt-engineering",
    kind: "Program",
    desc: "Getting a model to do what you need",
    keywords: ["fine tuning", "finetuning", "prompt", "prompting", "prompt engineering",
               "lora", "peft", "instruction tuning"],
  },
  {
    title: "RAG & Retrieval Systems",
    path: "/rag-retrieval-systems",
    kind: "Program",
    desc: "Retrieval-augmented generation over your own documents",
    keywords: ["rag", "retrieval", "vector", "embeddings", "chunking", "search",
               "knowledge base", "documents", "pinecone", "faiss"],
  },
  {
    title: "Computer Vision & LLMs",
    path: "/computer-vision-llms",
    kind: "Program",
    desc: "Vision models and multimodal systems",
    keywords: ["computer vision", "cv", "vision", "image", "multimodal", "opencv",
               "detection", "llm"],
  },
];

/* ── Pages that are not courses ───────────────────────────────────────────── */
const PAGES: SearchEntry[] = [
  { title: "All Programs", path: "/programs", kind: "Page",
    desc: "Every training track in one place",
    keywords: ["courses", "catalogue", "catalog", "tracks", "browse", "all"] },
  { title: "Course Plan", path: "/course-plan", kind: "Page",
    desc: "The full week-by-week curriculum",
    keywords: ["curriculum", "syllabus", "modules", "weeks", "schedule", "plan",
               "certificate", "duration", "how long"] },
  { title: "Prerequisites & Readiness", path: "/course-plan#prereq", kind: "Page",
    desc: "What you need before you start",
    keywords: ["prerequisites", "requirements", "readiness", "prep", "before you enroll"] },
  { title: "GitHub Projects", path: "/course-plan#projects", kind: "Page",
    desc: "The projects you build and ship",
    keywords: ["projects", "github", "portfolio", "build", "capstone"] },
  { title: "Free AI Workshop", path: "/workshop", kind: "Workshop",
    desc: "Start without commitment — a free practical session",
    keywords: ["workshop", "free", "webinar", "session", "demo", "taster", "event"] },
  /* /poc and /projects both redirect here, so their words live on this entry
     rather than as separate results pointing at the same page. */
  { title: "For Business", path: "/business", kind: "Page",
    desc: "AI training and POC development for organisations",
    keywords: ["business", "enterprise", "corporate", "b2b", "consulting",
               "poc", "proof of concept", "prototype", "pilot"] },
  { title: "Services", path: "/services", kind: "Page",
    desc: "What we do beyond training",
    keywords: ["services", "consulting", "development"] },
  { title: "Articles", path: "/blogs", kind: "Page",
    desc: "Writing on generative AI and how to learn it",
    keywords: ["blog", "blogs", "articles", "posts", "reading", "news"] },
  { title: "Enroll", path: "/enroll", kind: "Page",
    desc: "Join a program",
    keywords: ["enroll", "enrol", "join", "apply", "register", "sign up", "pricing",
               "cost", "fees", "price", "payment", "certificate"] },
  { title: "Events", path: "/events", kind: "Page",
    desc: "Upcoming AI events, live sessions and bootcamps",
    keywords: ["events", "event", "webinar", "bootcamp", "live", "meetup", "notify"] },
  { title: "Gallery", path: "/gallery", kind: "Page",
    desc: "Photos and videos from our workshops and events",
    keywords: ["gallery", "photos", "pictures", "videos", "moments", "expo"] },
  { title: "Careers", path: "/careers", kind: "Page",
    desc: "Open roles at Rivira Technologies",
    keywords: ["careers", "jobs", "hiring", "work", "openings", "vacancy", "apply"] },
  { title: "Frequently Asked Questions", path: "/faq", kind: "Page",
    desc: "Short answers to what most people ask",
    keywords: ["faq", "questions", "help", "answers", "support"] },
  { title: "About Us", path: "/about", kind: "Page",
    desc: "Who we are, what we do, and how we teach",
    keywords: ["about", "about us", "who", "company", "team", "story", "mission",
               "vision", "goals", "approach", "why us", "trust"] },
  { title: "Contact Us", path: "/contact", kind: "Page",
    desc: "Talk to the team",
    keywords: ["contact", "email", "phone", "reach", "talk", "support", "call"] },
  { title: "Home", path: "/", kind: "Page",
    desc: "Rivira Technologies",
    keywords: ["home", "start", "homepage", "rivira", "riviratech", "rivira tech"] },
  { title: "All Courses", path: "/courses", kind: "Page",
    desc: "The full course catalogue",
    keywords: ["courses", "catalogue", "catalog", "list", "browse"] },
  /* Legal. Rarely searched, but someone looking for "refund" or "privacy"
     should not have to hunt the footer for it. */
  { title: "Privacy Policy", path: "/legal/privacy-policy", kind: "Page",
    desc: "How we handle your data",
    keywords: ["privacy", "data", "gdpr", "policy", "personal information"] },
  { title: "Terms and Conditions", path: "/legal/terms-and-conditions", kind: "Page",
    desc: "The terms of using this site and its programs",
    keywords: ["terms", "conditions", "legal", "agreement", "t&c"] },
  { title: "Refund Policy", path: "/legal/refund-policy", kind: "Page",
    desc: "When and how refunds are given",
    keywords: ["refund", "money back", "cancel", "cancellation", "return"] },
  { title: "Accessibility", path: "/legal/accessibility", kind: "Page",
    desc: "Our accessibility commitments",
    keywords: ["accessibility", "a11y", "screen reader", "wcag", "disability"] },
  { title: "Security", path: "/legal/security", kind: "Page",
    desc: "How the platform is secured",
    keywords: ["security", "safety", "data protection", "vulnerability"] },
];

const PROJECTS: SearchEntry[] = PROJECT_LEVELS.flatMap((lvl) =>
  lvl.projects.map((pr) => ({
    title: pr.title,
    path: "/course-plan#projects",
    kind: "Project" as const,
    desc: `${lvl.heading} · ${pr.industry}`,
    keywords: [pr.industry, pr.teaches, pr.desc, lvl.tag, "project", "portfolio", "build"]
      .filter(Boolean),
  }))
);

const ARTICLES: SearchEntry[] = POSTS.map((post) => ({
  title: post.title,
  path: `/blog/${post.slug || post.id}`,
  kind: "Article" as const,
  desc: post.category,
  keywords: [post.category, post.excerpt, "article", "blog", "post", "read"].filter(Boolean),
}));

const QUESTIONS: SearchEntry[] = FAQ_ITEMS.map((f) => ({
  title: f.defaultQ,
  path: "/faq",
  kind: "Question" as const,
  desc: "Frequently asked",
  keywords: [f.defaultA, "faq", "question", "help"].filter(Boolean),
}));

const CURRICULUM: SearchEntry[] = PHASES.flatMap((phase) =>
  phase.weeks.map((w) => ({
    title: w.title,
    path: "/course-plan",
    kind: "Curriculum" as const,
    desc: `${phase.name} · ${w.tag || w.use || ""}`.replace(/ · $/, ""),
    keywords: [
      ...(w.topics || []),
      ...(w.tools ? w.tools.split(/[,·]/).map((t) => t.trim()) : []),
      w.flag || "",
      "module", "curriculum", "week",
    ].filter(Boolean),
  }))
);

export const SEARCH_INDEX: SearchEntry[] = [
  ...PROGRAMS, ...PAGES, ...CURRICULUM, ...PROJECTS, ...ARTICLES, ...QUESTIONS,
];

export function searchSite(query: string, limit = 12): SearchEntry[] {
  // Each term also matches its other names — "Artificial Intelligence" finds
  // "AI", "LLM" finds "large language models" … (utils/searchText.ts)
  if (searchText(query).trim().length < 2) return [];
  const terms = searchTerms(query);

  const scored = SEARCH_INDEX.map((e) => {
    const title = searchText(e.title).trim();
    const desc = searchText(e.desc);
    const keys = searchText((e.keywords || []).join(" "));

    let score = 0;
    for (const t of terms) {
      const inTitle = termAt(t, title);
      const inKeys = termAt(t, keys);
      const inDesc = termAt(t, desc);
      // Every term has to appear somewhere, so "ai kids" does not match a page
      // that only knows about "ai".
      if (!inTitle && !inKeys && !inDesc) return { e, score: -1 };
      let best = 0;
      if (inTitle) best = inTitle[0] === 0 ? (inTitle[1] === title.length ? 100 : 60) : 40;
      if (inKeys) best = Math.max(best, 18);
      if (inDesc) best = Math.max(best, 8);
      score += best;
    }
    // Nudge the pages people are usually after above a curriculum week that
    // happens to mention the same word.
    if (e.kind === "Program") score += 12;
    if (e.kind === "Page" || e.kind === "Workshop") score += 6;
    /* Answers and projects are useful but rarely the thing someone is
       navigating TO, so they sit below a page that matches equally well. */
    if (e.kind === "Question" || e.kind === "Project") score -= 2;
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title));

  return scored.slice(0, limit).map((x) => x.e);
}
