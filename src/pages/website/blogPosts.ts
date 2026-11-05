import type { Post } from "../../components/BlogArticle";

const RAW: Omit<Post, "slug" | "categorySlug">[] = [
  {
    id: "fine-tuning-vs-rag-vs-prompting",
    title: "Fine-Tuning vs. RAG vs. Prompting: How to Choose the Right Approach",
    image: "/blogs_img/c5.webp",
    category: "Engineering",
    date: "July 15, 2026",
    readTime: "8 min read",
    excerpt:
      "Three techniques, one common question: how do you get an LLM to do what you actually need? A practical guide to when each one is the right tool.",
    body: [
      "When teams first try to customise a language model, they often reach straight for fine-tuning—retraining the model on their own data. It's powerful, but it's also the heaviest and most expensive option, and it's frequently the wrong first move. Most problems can be solved more cheaply with better prompting or retrieval.",
      "Start with prompting: clear instructions, a few good examples, and a defined output structure solve a surprising number of use cases with zero extra infrastructure. When the model needs facts it was never trained on—your documents, your product catalogue, last week's data—reach for RAG (Retrieval-Augmented Generation), which fetches the right context at question time. Fine-tuning earns its place when you need a consistent style, a specialised output format, or lower latency at scale.",
      "A useful rule of thumb: prompt for behaviour, retrieve for knowledge, fine-tune for form. Many production systems combine all three. We walk through choosing and building each approach in our Fine-Tuning & Prompt Engineering and RAG & Retrieval Systems courses.",
    ],
  },
  {
    id: "evaluating-ai-output",
    title: "How to Tell If an AI's Answer Is Actually Good",
    image: "/blogs_img/c6.webp",
    category: "Foundations",
    date: "July 3, 2026",
    readTime: "6 min read",
    excerpt:
      "A confident-sounding answer isn't the same as a correct one. Here's how to judge AI output like a professional—and catch mistakes before they cost you.",
    body: [
      "Large language models are fluent by design, which is exactly what makes them tricky: a wrong answer can sound just as polished as a right one. The first habit to build is separating tone from truth—fluency is not evidence.",
      "Three quick checks go a long way. First, ask the model for its sources or reasoning and verify them; if it can't point to where an answer comes from, treat it as a draft. Second, test it with questions you already know the answer to. Third, run the same prompt twice—wildly different answers are a sign the model is guessing rather than knowing.",
      "For anything that matters, build a small 'eval set': a handful of real questions paired with known-good answers, which you re-run whenever you change a prompt or a model. It's the single most underrated skill in applied AI, and it's woven through every hands-on project in our programs.",
    ],
  },
  {
    id: "embeddings-vector-databases",
    title: "Embeddings and Vector Databases, Explained Without the Math",
    image: "/blogs_img/c7.webp",
    category: "Engineering",
    date: "June 20, 2026",
    readTime: "7 min read",
    excerpt:
      "Embeddings and vector databases are the engine behind semantic search and RAG. Here's an intuitive, math-free explanation of how they actually work.",
    body: [
      "An embedding is a way of turning text (or images, or audio) into a list of numbers that captures its meaning. Things that mean similar things end up with similar numbers—close together on a high-dimensional 'map' of meaning. That's the whole trick.",
      "A vector database stores these embeddings and answers one very specific question, very fast: 'which stored items are closest in meaning to this one?' That's what powers semantic search—finding results by intent rather than exact keywords—and it's the retrieval step inside every RAG system.",
      "You don't need linear algebra to use them well; you need to understand chunking (how you split documents), similarity (how 'closeness' is measured), and indexing (how the database stays fast as data grows). Our RAG & Retrieval Systems course has students build a working vector-search pipeline from scratch.",
    ],
  },
  {
    id: "learn-ai-90-day-roadmap",
    title: "Your First 90 Days Learning AI: A Beginner's Roadmap",
    image: "/blogs_img/c8.webp",
    category: "Education",
    date: "June 5, 2026",
    readTime: "7 min read",
    excerpt:
      "Overwhelmed by where to start with AI? This 90-day roadmap turns a vague goal into a clear, week-by-week path—no computer science degree required.",
    body: [
      "The biggest mistake beginners make is trying to learn everything at once—maths, model theory, ten frameworks—and burning out by week two. A better approach is to learn just enough to build something small, then let real projects pull you forward.",
      "A simple 90-day arc works well. Month one: get comfortable using AI tools daily and learn the core vocabulary—tokens, prompts, context, hallucination. Month two: pick one track (coding or no-code) and build a first project, like a document assistant or an automated workflow. Month three: go deep on one area—agents, RAG, or fine-tuning—and polish a portfolio piece you can actually show.",
      "Consistency beats intensity: an hour a day of building beats a passive weekend of watching. Our programs are structured around exactly this build-first rhythm, with weekly projects and mentorship so you're never learning in a vacuum. Whether you're a student, a working professional, or completely new to tech, there's a track for you.",
    ],
  },
  {
    id: "what-is-generative-ai",
    title: "What Is Generative AI, Really? A Plain-English Primer",
    image: "/blogs_img/c1.webp",
    category: "Foundations",
    date: "May 12, 2026",
    readTime: "6 min read",
    excerpt:
      "Everyone is talking about generative AI, but what does it actually mean? We break down the core ideas—models, tokens, and prompts—without the jargon.",
    body: [
      "Generative AI refers to systems that can create new content—text, images, code, audio—rather than simply classifying or predicting from fixed options. Under the hood, these systems are trained on vast amounts of data and learn the statistical patterns of language and imagery.",
      "The most familiar examples are large language models (LLMs) like the ones powering modern chat assistants. They work by predicting the next 'token' (roughly, a word fragment) given everything that came before. String enough of these predictions together and you get coherent paragraphs, working code, or a polished email.",
      "For learners and businesses, the important takeaway is this: you don't need a PhD to use these tools effectively. What you need is an understanding of how to communicate with them—clear prompts, useful context, and a feedback loop. That's exactly what our foundational courses focus on.",
    ],
  },
  {
    id: "rag-explained",
    title: "RAG Explained: How AI Answers Questions From Your Own Documents",
    image: "/blogs_img/c2.webp",
    category: "Engineering",
    date: "May 2, 2026",
    readTime: "8 min read",
    excerpt:
      "Retrieval-Augmented Generation lets an LLM answer questions grounded in your data. Here's how it works and why it reduces hallucinations.",
    body: [
      "One of the biggest limitations of a raw language model is that it only 'knows' what it saw during training. Ask it about your company's internal policy and it will either refuse or, worse, make something up. Retrieval-Augmented Generation (RAG) solves this.",
      "The idea is simple: before the model answers, we search a knowledge base for the most relevant passages and hand them to the model as context. The model then answers using that retrieved material, and can even cite its sources.",
      "This architecture powers most enterprise AI assistants today. It keeps answers grounded, makes updates as easy as adding a document, and dramatically reduces hallucinations. In our RAG & Retrieval Systems course, students build one end-to-end.",
    ],
  },
  {
    id: "ai-agents-intro",
    title: "From Chatbots to Agents: When AI Starts Taking Action",
    image: "/blogs_img/c3.webp",
    category: "AI Agents",
    date: "April 21, 2026",
    readTime: "7 min read",
    excerpt:
      "An agent doesn't just answer—it plans, uses tools, and completes multi-step tasks. Here's the shift that's redefining AI applications.",
    body: [
      "A chatbot responds to a message. An agent pursues a goal. That distinction is the story of the last year in AI. Agents can break a task into steps, call external tools (search, code execution, APIs), observe the results, and adjust their plan.",
      "Frameworks like LangGraph and CrewAI make it possible to orchestrate multiple specialised agents that collaborate—one researches, one writes, one reviews. This unlocks automation for workflows that were previously too complex for a single prompt.",
      "With great capability comes the need for guardrails: agents need clear boundaries, monitoring, and human oversight. Our AI Agents & Automation program covers both the building and the governing.",
    ],
  },
  {
    id: "prompt-engineering-tips",
    title: "5 Prompt Engineering Habits That Instantly Improve Your Results",
    image: "/blogs_img/c4.webp",
    category: "Prompting",
    date: "April 8, 2026",
    readTime: "5 min read",
    excerpt:
      "Small changes in how you ask can produce dramatically better output. Here are five practical habits you can start using today.",
    body: [
      "1. Give context first. Tell the model who it is, who the audience is, and what success looks like before you ask for the task.",
      "2. Show, don't just tell. A single good example (few-shot prompting) often beats paragraphs of instructions.",
      "3. Ask for structure. Requesting a table, bullet list, or JSON format makes output easier to use and more consistent.",
      "4. Iterate out loud. Ask the model to critique its own answer, then improve it. This 'reflection' step catches errors.",
      "5. Constrain the output. Word limits, tone, and 'do not include X' instructions keep results focused. We go deep on all of these in our Prompt Engineering & Fine-Tuning course.",
    ],
  },
  {
    id: "ai-for-kids-why",
    title: "Why Every Child Should Learn AI (Not Just Coding)",
    image: "/blogs_img/AI for kids.png",
    category: "Education",
    date: "March 25, 2026",
    readTime: "6 min read",
    excerpt:
      "AI literacy is becoming as fundamental as reading and math. Here's how to introduce it to kids in a way that's fun and empowering.",
    body: [
      "The generation growing up today will live and work alongside AI in every field. Teaching kids to be thoughtful creators—not just passive consumers—of this technology is one of the most valuable things we can do.",
      "Good AI education for kids isn't about heavy math. It's about curiosity: how do machines 'see' an image? Why does a chatbot sometimes get things wrong? What makes a good question? These concepts can be taught through play, games, and creative projects.",
      "Our AI for Kids program (ages 8–16) blends hands-on building with critical thinking, so young learners come away confident, capable, and safe.",
    ],
  },
  {
    id: "ai-in-business",
    title: "Where to Start With AI in Your Business (Without Wasting Money)",
    image: "/blogs_img/App development.png",
    category: "Business",
    date: "March 10, 2026",
    readTime: "7 min read",
    excerpt:
      "The smartest AI adopters don't start with the flashiest project. They start with a focused proof-of-concept. Here's the playbook.",
    body: [
      "The temptation is to chase the most ambitious AI project first. The reality is that the companies seeing real returns start small: they pick one painful, repetitive, well-defined problem and validate a solution in weeks, not months.",
      "A proof-of-concept (POC) built on your real data answers the only question that matters: does this actually work for us? From there, scaling is a business decision backed by evidence rather than hype.",
      "This is exactly the approach we take with our POC development service and our Generative AI for Business program—start focused, prove value, then scale with confidence.",
    ],
  },
];

export const POSTS: Post[] = RAW.map((p) => ({
  ...p,
  slug: p.id,
  categorySlug: p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
}));
