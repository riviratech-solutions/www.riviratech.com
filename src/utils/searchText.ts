/* Search matching shared by the site search (utils/searchIndex.ts) and the
   Courses page search.

   Text is lower-cased with hyphens and runs of spaces folded to one space, and
   a query is split into terms — a known phrase such as "machine learning" stays
   one term. Each term matches:
     - what was typed, anywhere in the text (as before), or
     - any other name for it from SYNONYMS below, so "Artificial Intelligence"
       finds "AI", "LLM" finds "large language models", and so on.
   Added short forms (ML, RAG, …) only match as whole words (with an optional
   plural "s"), so "machine learning" does not start matching "html". */

// Each group lists the names for one thing; the first is the short form.
const SYNONYMS: string[][] = [
  // AI & data
  ["ai", "artificial intelligence"],
  ["genai", "gen ai", "generative ai", "generative artificial intelligence"],
  ["agi", "artificial general intelligence"],
  ["ml", "machine learning"],
  ["dl", "deep learning"],
  ["rl", "reinforcement learning"],
  ["nn", "neural network", "neural networks"],
  ["cnn", "convolutional neural network"],
  ["rnn", "recurrent neural network"],
  ["llm", "large language model", "large language models"],
  ["slm", "small language model", "small language models"],
  ["nlp", "natural language processing"],
  ["nlu", "natural language understanding"],
  ["cv", "computer vision"],
  ["rag", "retrieval augmented generation"],
  ["gpt", "generative pre trained transformer"],
  ["ocr", "optical character recognition"],
  ["tts", "text to speech"],
  ["stt", "speech to text"],
  ["asr", "automatic speech recognition"],
  ["mlops", "ml ops", "machine learning operations"],
  ["llmops", "llm ops"],
  ["vector db", "vector database", "vector databases", "vector store"],
  ["kb", "knowledge base"],
  ["ds", "data science"],
  ["bi", "business intelligence"],
  ["etl", "extract transform load"],
  ["eda", "exploratory data analysis"],
  ["poc", "proof of concept", "proofs of concept"],
  ["mvp", "minimum viable product"],
  ["mcp", "model context protocol"],
  ["chatbot", "chat bot", "conversational ai"],
  // software & cloud
  ["api", "application programming interface"],
  ["sdk", "software development kit"],
  ["ui", "user interface"],
  ["ux", "user experience"],
  ["js", "javascript"],
  ["ts", "typescript"],
  ["db", "database"],
  ["sql", "structured query language"],
  ["aws", "amazon web services"],
  ["gcp", "google cloud platform", "google cloud"],
  ["k8s", "kubernetes"],
  ["ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
  ["devops", "dev ops"],
  ["saas", "software as a service"],
  ["iot", "internet of things"],
  ["ar", "augmented reality"],
  ["vr", "virtual reality"],
  ["oop", "object oriented programming"],
  ["dsa", "data structures and algorithms", "data structures"],
  ["qa", "quality assurance"],
  // business
  ["crm", "customer relationship management"],
  ["erp", "enterprise resource planning"],
  ["kpi", "key performance indicator", "key performance indicators"],
  ["roi", "return on investment"],
  ["hr", "human resources"],
  ["b2b", "business to business"],
  ["seo", "search engine optimization", "search engine optimisation"],
  ["faq", "frequently asked questions"],
];

export function searchText(s: string | undefined | null): string {
  return String(s || "")
    .toLowerCase()
    .replace(/(^|[^a-z0-9])a\.\s?i\.?(?=[^a-z0-9]|$)/g, "$1ai") // A.I. -> ai
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isShort = (s: string) => !s.includes(" ") && s.length <= 5;

type Alt = { re: RegExp };
export type Term = { typed: string; alts: Alt[] };

// A short form matches as a whole word ("ml", "mls"); a phrase anywhere.
// "ai" also counts inside "genai", the way the site writes GenAI.
function altFor(name: string): Alt {
  const n = searchText(name).trim();
  if (n === "ai") return { re: /(?:^|[^a-z0-9]|gen)ais?(?![a-z0-9])/ };
  if (isShort(n)) return { re: new RegExp(`(?:^|[^a-z0-9])${esc(n)}s?(?![a-z0-9])`) };
  return { re: new RegExp(esc(n)) };
}

const GROUPS = SYNONYMS.map((g) => g.map((n) => searchText(n).trim()));
const GROUP_OF = new Map<string, number>();
GROUPS.forEach((g, i) => g.forEach((n) => GROUP_OF.set(n, i)));
// phrases in the query, longest first, so "generative ai" wins over "ai"
const PHRASES = [...GROUP_OF.keys()].filter((n) => n.includes(" ")).sort((a, b) => b.length - a.length);

function groupOf(word: string): number | undefined {
  return GROUP_OF.get(word) ?? (word.length > 2 && word.endsWith("s") ? GROUP_OF.get(word.slice(0, -1)) : undefined);
}

/** Splits a query into terms, each with the other names it may match. */
export function searchTerms(query: string): Term[] {
  let q = ` ${searchText(query).trim()} `;
  const phraseTerms: string[] = [];
  for (const p of PHRASES) {
    // no lookbehind: older Safari can't parse one, and that would break search
    const re = new RegExp(`([^a-z0-9])${esc(p)}(?=[^a-z0-9])`, "g");
    q = q.replace(re, (_m, pre) => {
      phraseTerms.push(p);
      return `${pre} \u0001${phraseTerms.length - 1} `;
    });
  }
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const typed = tok.startsWith("\u0001") ? phraseTerms[Number(tok.slice(1))] : tok;
      const g = groupOf(typed);
      const alts: Alt[] = [{ re: new RegExp(esc(typed)) }];
      if (g !== undefined) GROUPS[g].filter((n) => n !== typed).forEach((n) => alts.push(altFor(n)));
      return { typed, alts };
    });
}

/** Where a term first matches in already-normalised text: [index, length], or null. */
export function termAt(term: Term, text: string): [number, number] | null {
  let best: [number, number] | null = null;
  for (const a of term.alts) {
    const m = a.re.exec(text);
    if (!m) continue;
    // a whole-word match includes the character before it; step past that
    const lead = m[0].length && /[^a-z0-9]/.test(m[0][0]) && m.index + 1 < text.length ? 1 : 0;
    const hit: [number, number] = [m.index + lead, m[0].length - lead];
    if (!best || hit[0] < best[0]) best = hit;
  }
  return best;
}

/** True when every term of the query appears in at least one of the texts. */
export function matchesQuery(query: string, texts: (string | undefined | null)[]): boolean {
  const terms = searchTerms(query);
  if (!terms.length) return true;
  const hay = texts.map(searchText);
  return terms.every((t) => hay.some((h) => termAt(t, h)));
}
