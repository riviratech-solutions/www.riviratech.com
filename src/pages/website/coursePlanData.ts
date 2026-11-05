export interface Week {
  n: number;
  /** Day range from the brochure's "16 Weeks at a Glance" table, e.g. "Days 1–7". */
  days: string;
  title: string;
  /** The "You ship" line shown in the card header. */
  use: string;
  tag: string;
  topics: string[];
  tools: string;
  /** The brochure's ✓ CHECKPOINT paragraph. */
  check: string;
  flag?: string;
  /** Capstone weeks (blue card variant). */
  cap?: boolean;
}

export interface Phase {
  idx: string;
  name: string;
  range: string;
  weeks: Week[];
  cap?: boolean;
}

/** One project in the GitHub portfolio library (GitHub Projects view). */
export interface PortfolioProject {
  title: string;
  industry: string;
  desc: string;
  /** Plain text rendered after the bold "Teaches:" label. */
  teaches: string;
}

export interface ProjectLevel {
  /** e.g. "L1 · Beginner" — the gold pill in the level header. */
  tag: string;
  heading: string;
  count: string;
  projects: PortfolioProject[];
}

export const PHASES: Phase[] = [
  {
    idx: "PHASE 01", name: "Foundations", range: "Weeks 1–4",
    weeks: [
      { n: 1, days: "Days 1–7", title: "AI Foundations: Python for AI Engineers",
        use: "Your first LLM call from your own environment",
        tag: "The map of AI on day one, then the Python every model and agent will stand on.",
        topics: ["The AI landscape: ML vs DL vs NLP vs GenAI", "The stack: model → prompt → context → harness → loop → graph", "Python I–IV: syntax, control flow, functions, OOP", "Python V: generators, iterators, decorators", "Environment setup: Python, git & API keys"],
        tools: "Python · git · API keys · your first LLM call from code",
        check: "The week closes with your environment fully working: Python written across five sessions, git and API keys configured, and your first LLM call made from your own code. You leave knowing exactly where ML, DL, NLP and GenAI sit in the stack." },
      { n: 2, days: "Days 8–14", title: "Machine Learning Fundamentals",
        use: "Your first trained and evaluated ML model",
        tag: "The discipline underneath everything: teach a machine to learn from data.",
        topics: ["Supervised vs unsupervised vs reinforcement", "Regression & classification, hands on", "Train/test splits, overfitting & regularization", "Evaluation: accuracy, precision, recall", "Clustering & dimensionality reduction"],
        tools: "scikit-learn · pandas · NumPy · an ML mini-project end to end",
        check: "You now understand how machines learn from data: framing a problem, training regression and classification models, splitting data honestly, and reading accuracy, precision and recall. Your evaluated mini-project proves you can run the full ML workflow end to end." },
      { n: 3, days: "Days 15–21", title: "Deep Learning & NLP Fundamentals",
        use: "A neural text classifier, trained and tested by you",
        tag: "From neurons to language: the road that leads straight to the transformer.",
        topics: ["Neural networks & backpropagation intuition", "A taste of PyTorch: build a small network", "Tokenization & embeddings: vectors of meaning", "NLP tasks: classification, NER, summarization", "From RNNs to attention: why transformers won"],
        tools: "PyTorch · Hugging Face · embeddings · NLP pipelines",
        check: "Neural networks are no longer a black box: you have built one, trained it in PyTorch, and turned text into embeddings. With tokenization, classic NLP tasks and the road from RNNs to attention behind you, the transformer is ready to be understood." },
      { n: 4, days: "Days 22–28", title: "Prompt Engineering",
        use: "A production-grade system prompt with its own evaluation",
        tag: "Shape a single call to the model, then hit the prompt's ceiling deliberately.",
        topics: ["System prompt engineering", "Prompt anatomy: zero / one / few-shot", "Chain-of-Thought & reasoning-time techniques", "Evaluating, optimising & attacking prompts", "Why the prompt alone is not enough"],
        tools: "Frontier chat models · API playgrounds · prompt evals",
        check: "You can now engineer a prompt the way production teams do: structured system prompts, shot-based and reasoning techniques, and a proper evaluation loop that catches failures. You have also felt the prompt's ceiling, which is exactly why the next weeks exist." },
    ],
  },
  {
    idx: "PHASE 02", name: "The Prompt & the Model", range: "Weeks 5–6",
    weeks: [
      { n: 5, days: "Days 29–35", title: "LLM Fundamentals & the Claude Family",
        use: "A working Claude API app, and a transformer you can explain",
        tag: "Look inside the model you have been steering, right after learning to steer it.",
        topics: ["Transformer architecture I & II: attention & weights", "Training vs inference · context windows & sampling", "Why models hallucinate, and what it means", "The Claude model family & the Messages API", "Your first Claude API application, built live"],
        tools: "Claude models · Messages API · tokens & sampling controls",
        check: "You have looked inside the model itself: attention, weights, training versus inference, context windows and sampling, and why hallucination happens. On top of that understanding sits your first working Claude application, built live with the Messages API." },
      { n: 6, days: "Days 36–42", title: "Context Engineering",
        use: "A context-managed assistant that survives long conversations",
        tag: "Engineer everything that enters the window, and manage it before it rots.",
        topics: ["Context engineering as a discipline", "The elements of context", "RAG & tools as context supply strategies", "Context rot: why more context is worse", "WSCI: Write, Select, Compress, Isolate"],
        tools: "Context assembly patterns · long-conversation memory strategies",
        check: "Everything that enters the window is now under your control: the elements of context, RAG and tools as supply strategies, context rot, and the WSCI discipline. Your assistant survives long conversations because you engineered its memory, not because you got lucky." },
    ],
  },
  {
    idx: "PHASE 03", name: "Context, RAG & the Harness", range: "Weeks 7–8",
    weeks: [
      { n: 7, days: "Days 43–49", title: "LangChain, RAG & Tools",
        use: "The Resume Matcher: your first shipped RAG application",
        tag: "The two mechanisms that fill the window: retrieval and computation.",
        topics: ["LangChain foundations & structured output", "RAG I: embeddings & the indexing side", "RAG II: the retrieval side", "Agents & tools primer", "Guided build: the AI Resume Matcher"],
        tools: "LangChain · vector stores · embeddings · tool calling",
        check: "Retrieval and computation are now in your toolkit: LangChain composition, the full RAG pipeline from embedding to injection, and tool calling. The shipped Resume Matcher proves you can take a RAG application from empty repo to working product." },
      { n: 8, days: "Days 50–56", title: "Harness Engineering",
        use: "A working coding agent: tools, sandbox, permission layer",
        tag: "The model is not the product; the system around it is.",
        topics: ["What a harness is & harness design principles", "Coding agent I: environment & tools", "Coding agent II: the context assembler", "Coding agent III: policy, safety & humans", "Harness evaluation & failure taxonomy"],
        tools: "Tool sandboxes · permission layers · harness evals",
        check: "You can now design the system around the model: a coding agent with its environment, tools, context assembler, policy layer and human controls, plus an evaluation and failure taxonomy. The harness, not the model, is what you engineer from here." },
    ],
  },
  {
    idx: "PHASE 04", name: "MCP & Loops", range: "Weeks 9–10",
    weeks: [
      { n: 9, days: "Days 57–63", title: "MCP: Model Context Protocol",
        use: "Your coding agent, extended with live MCP servers",
        tag: "The open standard that turns your harness into an ecosystem.",
        topics: ["Why a protocol at all", "MCP client & MCP server: both sides of the wire", "MCP in practice: real servers, real tools", "Extending your coding agent with MCP", "MCP integration lab"],
        tools: "MCP clients & servers · filesystem, web & spreadsheet tools",
        check: "Your agent now speaks the industry's open standard: you understand MCP clients and servers on both sides of the wire, and your coding agent operates live MCP servers for real tools. What you built is no longer an island; it is part of an ecosystem." },
      { n: 10, days: "Days 64–70", title: "Loop Engineering",
        use: "A self-correcting agent loop with budgets and brakes",
        tag: "A harness that runs once is a function; in a controlled loop, it is an agent.",
        topics: ["The agentic loop", "Loop control: termination, budgets, brakes", "Verification & self-correction loops", "Loop failure modes & hardening lab", "The failure modes that bankrupt teams"],
        tools: "Loop budgets · brakes · verification & tracing",
        check: "Autonomy is now under control: the agentic loop with termination, budgets and brakes, verification and self-correction, and the failure modes that bankrupt teams caught before they run. Your agent corrects itself inside limits you designed." },
    ],
  },
  {
    idx: "PHASE 05", name: "Graphs & Certification", range: "Weeks 11–12",
    weeks: [
      { n: 11, days: "Days 71–77", title: "Graph Engineering & LangGraph",
        use: "Your agent as a typed, checkpointed LangGraph graph",
        tag: "Loops buy autonomy at the cost of control; graphs buy the control back.",
        topics: ["Why graphs: from loops to topologies", "LangGraph fundamentals & persistence", "Human-in-the-loop & checkpointing", "Graph topologies", "Lab: your agent rebuilt as a state machine"],
        tools: "LangGraph · checkpoints · human gates · time travel",
        check: "Your agent is now a typed, checkpointed LangGraph state machine with human gates and time travel. You can choose a topology deliberately, explain why graphs buy control back from loops, and rebuild an existing agent into one." },
      { n: 12, days: "Days 78–84", flag: "★ Certification week · graded build project & assessment",
        title: "Claude AI Certification",
        use: "YOUR CLAUDE AI CERTIFICATION: earned, not attended",
        tag: "A full week on the Claude ecosystem, ending in a certification you earn.",
        topics: ["Claude Projects, Artifacts & Claude Code", "Building with the Messages API", "Constitutional AI & responsible use", "Certification preparation", "The build project & the assessment"],
        tools: "Claude ecosystem · Anthropic certification program",
        check: "The Claude ecosystem is now yours end to end: Projects, Artifacts, Claude Code, the Messages API and Constitutional AI, closed out by the certification build project and assessment. The certification on your profile was earned in a build, not attended." },
    ],
  },
  {
    idx: "PHASE 06", name: "GPU & Capstone Builds", range: "Weeks 13–14",
    weeks: [
      { n: 13, days: "Days 85–91", title: "GPU Lab & Cloud Deployment",
        use: "A fine-tuned model on real hardware, deployed to the cloud",
        tag: "Fine-tune on real hardware, then deploy on the big three clouds.",
        topics: ["LoRA/PEFT fine-tuning on the RTX 5090", "Fine-tune vs prompt vs RAG: when each wins", "Deploying on Azure OpenAI", "Deploying on AWS Bedrock & Vertex AI", "Cost, keys & monitoring in production"],
        tools: "NVIDIA RTX 5090 · LoRA/PEFT · Azure · Bedrock · Vertex AI",
        check: "You have fine-tuned a real model on the RTX 5090 with LoRA/PEFT and deployed on Azure OpenAI, AWS Bedrock and Vertex AI. You can now argue, with evidence, when to fine-tune, when to prompt and when to RAG, and what each costs to run." },
      { n: 14, days: "Days 92–98", cap: true, title: "Capstone I: Enterprise Knowledge Assistant",
        use: "A working Enterprise Knowledge Assistant, ready to ship",
        tag: "Your production RAG capstone begins: a real system, not a demo.",
        topics: ["Problem definition, goals & system design", "RAG architecture & guardrails", "The data pipeline", "The RAG pipeline", "The application layer"],
        tools: "Your full RAG stack · mentor build reviews",
        check: "Capstone I stands: a production Enterprise Knowledge Assistant with its data pipeline, RAG pipeline, guardrails and application layer designed and built by you, reviewed with your mentor and ready for deployment in the final week." },
    ],
  },
  {
    idx: "PHASE 07", name: "Ship & Launch", range: "Weeks 15–16", cap: true,
    weeks: [
      { n: 15, days: "Days 99–105", cap: true, title: "Capstone II: Multi-Agent Support System",
        use: "A working multi-agent support system, ready to ship",
        tag: "Your multi-agent capstone: orchestrated, checkpointed and human-gated.",
        topics: ["Problem definition & multi-agent design", "The data & tooling layer", "Agent orchestration in LangGraph", "The application layer", "Checkpoints & human gates in place"],
        tools: "LangGraph orchestration · multi-agent tracing",
        check: "Capstone II stands: a multi-agent support system orchestrated in LangGraph, with its data and tooling layers, checkpoints and human gates in place. Two production-grade systems now carry your name into the final week." },
      { n: 16, days: "Days 106–112", cap: true, title: "Ship, Operate & Career Launch",
        use: "CAPSTONES SHIPPED + your career launch kit",
        tag: "Both capstones shipped and operated, and your career launched with them.",
        topics: ["CI/CD & evaluation gates for both capstones", "Governance, cost models & tracing", "30-project GitHub portfolio: wrap & polish", "AI résumé, LinkedIn & interview prep", "Demo Day, graduation & certificates"],
        tools: "CI/CD · evals · observability · your portfolio",
        check: "Both capstones are live behind CI/CD with evaluation gates and observability; your 30-project portfolio is polished; your resume, LinkedIn and interview preparation are done. Demo Day closes the program with your work presented and your career launch under way." },
    ],
  },
];

export const PROJECT_LEVELS: ProjectLevel[] = [
  {
    tag: "L1 · Beginner", heading: "Beginner Projects", count: "10 foundation projects",
    projects: [
      { title: "Medical Symptom Summarizer", industry: "Healthcare",
        desc: "A Streamlit app that accepts patient-reported symptoms and generates a clean, structured clinical summary using GPT.",
        teaches: "prompt engineering and medical text processing." },
      { title: "Invoice Data Extractor", industry: "Finance",
        desc: "Uses GPT-4o's vision capabilities to extract structured fields (vendor, amount, dates, line items) from uploaded invoice PDFs or images.",
        teaches: "multimodal AI and document parsing." },
      { title: "Product Description Generator", industry: "E-commerce",
        desc: "Takes product attributes and auto-generates compelling product descriptions. Integrates with the Notion API to save outputs directly to a database.",
        teaches: "structured output + external API integration." },
      { title: "Contract Clause Classifier", industry: "Legal",
        desc: "A full-stack app (FastAPI backend + JS frontend) that classifies contract clauses by type (liability, indemnification, termination, etc.) using the Claude API.",
        teaches: "classification prompting and REST API design." },
      { title: "Personalized Study Plan Builder", industry: "Education",
        desc: "Builds a custom multi-week study plan based on a student's topic, goals, and available time. Saves the plan to Notion.",
        teaches: "structured generation and tool integration." },
      { title: "Patient Discharge Instruction Generator", industry: "Healthcare",
        desc: "Generates plain-language discharge instructions from clinical notes using Claude. Built with a FastAPI backend and React frontend.",
        teaches: "full-stack AI app development." },
      { title: "Customer Refund Request Classifier", industry: "E-commerce",
        desc: "Reads refund request emails (via Gmail API), classifies them by urgency and policy eligibility, and produces a summary report.",
        teaches: "email automation and classification pipelines." },
      { title: "Financial News Summarizer with Sentiment", industry: "Finance",
        desc: "Fetches real financial headlines via NewsAPI, summarizes them using GPT, and assigns a market sentiment score.",
        teaches: "real-time data pipelines and sentiment analysis." },
      { title: "AI Meeting Notes & Action Item Extractor", industry: "Universal",
        desc: "Transcribes meeting audio using Whisper, then uses GPT-4o to extract structured notes, decisions, and action items. Saves to Notion.",
        teaches: "audio + text AI pipelines." },
      { title: "Multi-Tone Marketing Copy Generator", industry: "Universal",
        desc: "Generates marketing copy in multiple tones (professional, casual, witty, urgent) from a product brief. Saves outputs to ClickUp.",
        teaches: "tone control, prompt parameterization, and project management API integration." },
    ],
  },
  {
    tag: "L2 · Intermediate", heading: "Intermediate Projects", count: "10 projects · multiple domains",
    projects: [
      { title: "Clinical Trials Research Assistant", industry: "Healthcare",
        desc: "A RAG pipeline that ingests clinical trial PDFs into a FAISS vector store and answers researcher questions with grounded answers and source citations.",
        teaches: "document ingestion, chunking strategy, and retrieval-augmented generation with LangChain." },
      { title: "SEC Filing Analyst Bot", industry: "Finance",
        desc: "A conversational RAG system over SEC filings (10-K, 10-Q) stored in Pinecone with ticker/year metadata. Supports multi-turn conversation memory so analysts can ask follow-up questions naturally.",
        teaches: "Pinecone metadata filtering and ConversationalRetrievalChain." },
      { title: "Intelligent Product Recommendation Engine", industry: "E-Commerce",
        desc: "A two-stage recommendation engine: fast semantic retrieval of 20 candidates from Pinecone, then GPT-4o re-ranks to the top 5 with personalised reasoning.",
        teaches: "vector search at scale and LLM re-ranking patterns." },
      { title: "Legal Precedent Finder", industry: "Legal",
        desc: "A local FAISS-based RAG system for querying case law and statute documents. Uses on-premise storage (no cloud vector DB) to respect attorney-client privilege.",
        teaches: "legal text chunking and citation-enforcing prompts." },
      { title: "AI Candidate Screening Agent", industry: "HR / Recruitment",
        desc: "A LangGraph multi-node agent that parses CVs, scores candidates against a job description, and writes results directly to Airtable.",
        teaches: "StateGraph design, node isolation, and external API integration within an agent workflow." },
      { title: "Adaptive Quiz Generator", industry: "EdTech",
        desc: "An adaptive quiz system that adjusts difficulty (Easy/Medium/Hard) based on the learner's running score and generates fresh questions grounded in course syllabus content via RAG.",
        teaches: "adaptive logic, Pydantic validation, and Streamlit session state." },
      { title: "Medical Coding Automation Tool", industry: "Healthcare",
        desc: "A RAG-powered ICD-10 code suggestion tool: retrieves relevant codes from Pinecone, passes them with the clinical note to GPT-4o, and returns suggestions with confidence scores (green/orange/red).",
        teaches: "confidence scoring and medical domain RAG." },
      { title: "Compliance Document Monitor", industry: "Legal / Compliance",
        desc: "An n8n workflow that monitors regulatory RSS feeds daily, summarises updates with GPT-4o, identifies gaps against current policy using structured JSON output, and logs findings to Notion automatically.",
        teaches: "workflow automation without code." },
      { title: "AI Customer Support Agent with Memory", industry: "SaaS / Customer Service",
        desc: "A LangGraph support agent with intent classification (keyword-based), Pinecone knowledge base retrieval, per-session conversation memory, and automatic ticket creation on escalation.",
        teaches: "multi-node agents with conditional routing and state management." },
      { title: "Automated Weekly Business Report Generator", industry: "Business / Analytics",
        desc: "An n8n workflow that runs every Monday at 8am, fetches HubSpot deals and Google Analytics data, aggregates KPIs in a Code node, generates executive commentary with GPT-4o, and delivers the report to Slack.",
        teaches: "business automation with real-world API integrations." },
    ],
  },
  {
    tag: "L3 · Advanced", heading: "Advanced Projects", count: "10 projects · multiple domains",
    projects: [
      { title: "Radiology Report Multi-Agent System", industry: "Healthcare",
        desc: "A CrewAI 3-agent pipeline that reads DICOM metadata, drafts a structured radiology report (ACR format), and flags critical findings for urgent review. Deployed as AWS Lambda. All agent steps traced in LangSmith.",
        teaches: "multi-agent task handoffs, Instructor validation, and serverless AI deployment in a regulated domain." },
      { title: "Algorithmic Trading Signal Engine", industry: "Finance",
        desc: "Fine-tunes a transformer model on financial news headlines to classify Buy / Sell / Hold signals. Two training paths: LoRA/QLoRA on a free Colab GPU, or the OpenAI Fine-tuning API. Backtests against historical price data and deploys as a FastAPI inference service on GCP Vertex AI.",
        teaches: "parameter-efficient fine-tuning, W&B experiment tracking, and GCP deployment." },
      { title: "Autonomous E-commerce Catalog Manager", industry: "E-Commerce",
        desc: "A LangGraph ReAct agent with 4 real tools: price scraper, listing rewriter, inventory updater, and promotion trigger (Shopify Admin API). MCP configures tool access. Webhook-triggered. All tool calls traced in LangSmith.",
        teaches: "autonomous agent tool routing, Shopify API integration, and conditional decision-making." },
      { title: "AI Legal Contract Negotiation Agent", industry: "Legal",
        desc: "A CrewAI 3-agent system where Buyer and Seller agents negotiate clause-by-clause and an Arbitrator produces a final redlined DOCX with tracked changes via python-docx. Instructor validates structured negotiation outputs. Deployed on Azure Container Apps.",
        teaches: "adversarial agent design, structured output validation, and document generation." },
      { title: "Talent Intelligence Platform", industry: "HR / Recruitment",
        desc: "Fine-tunes a text classification model on synthetic hire outcome data to predict candidate fit (0–100 score). Deployed as a REST API via AWS SageMaker. ATS webhook integration. Full W&B experiment tracking with bias testing across demographic groups.",
        teaches: "fine-tuning for classification, SageMaker deployment, and responsible AI evaluation." },
      { title: "Adaptive Learning OS", industry: "EdTech",
        desc: "Full-stack adaptive learning platform: RAG over course materials (Pinecone), fine-tuned tutor model, LangGraph difficulty orchestrator, Next.js dashboard, and PostgreSQL session storage. Backend on GCP Cloud Run, frontend on Vercel.",
        teaches: "full-stack AI product architecture combining RAG, fine-tuning, agents, and a production frontend." },
      { title: "Clinical Decision Support System", industry: "Healthcare",
        desc: "A LangGraph multi-node agent that processes patient symptoms against a medical knowledge base (RAG over clinical guidelines), recommends diagnostic steps, checks drug interactions, and enforces safety guardrails (no final diagnoses — human review required). Deployed on AWS Lambda. W&B tracks decision quality.",
        teaches: "safety-first agent design in a regulated domain." },
      { title: "Real-Time Fraud Detection Pipeline", industry: "Finance",
        desc: "A complete streaming fraud detection pipeline: PyTorch transformer trained on synthetic transaction data, Kafka producer for local development, AWS Kinesis + Lambda for cloud, and a Streamlit live alert dashboard. Target latency: <200ms. W&B tracks model training metrics.",
        teaches: "streaming ML system design and real-time inference architecture." },
      { title: "Autonomous SEO Content Production Pipeline", industry: "Universal",
        desc: "A CrewAI 3-agent pipeline: Researcher (Serper API for keyword + competitor analysis), Writer (1500–2500 word article), Editor (brand voice + SEO polish). Instructor validates ArticleOutput schema. TokenBudget controls cost. Deployed on GCP Cloud Run.",
        teaches: "content automation, web search tool integration, and structured output enforcement." },
      { title: "Intelligent Customer Onboarding Agent", industry: "Universal",
        desc: "A LangGraph stateful onboarding agent that personalises welcome flows, answers product questions via Pinecone RAG, sends SMS check-ins via Twilio, schedules follow-up calls via Google Calendar, and tracks milestone completion in DynamoDB. PII guardrails before any external API call. Deployed as AWS Lambda + API Gateway.",
        teaches: "complex multi-integration agent design with production safety controls." },
    ],
  },
];
