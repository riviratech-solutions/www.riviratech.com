export interface ComponentItem {
  name: string;
  category?: string;
  description?: string;
  html: string;
  css: string;
}

export const components: ComponentItem[] = [
  {
    name: "Hero Section (Modern Gradient)",
    category: "Headers",
    description: "Full-width gradient banner with title, excerpt, and read time badge",
    html: `
<header class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 text-white p-8 md:p-12 mb-8 shadow-xl">
  <div class="relative z-10 max-w-3xl">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide uppercase mb-4">
      <span>AI Engineering</span>
      <span>•</span>
      <span>5 min read</span>
    </div>
    <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4 text-white">
      Mastering Generative AI Workflows in 2026
    </h1>
    <p class="text-base md:text-lg text-blue-100 leading-relaxed font-normal">
      A comprehensive deep dive into building production-ready autonomous agent pipelines, tool integrations, and scalable LLM orchestration.
    </p>
  </div>
  <div class="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
</header>
`,
    css: ``,
  },

  {
    name: "Key Takeaways Box",
    category: "Callouts",
    description: "Highlighted card with checkmark bullet points for summary highlights",
    html: `
<div class="my-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
  <div class="flex items-center gap-2 mb-3">
    <span class="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">✓</span>
    <h3 class="text-lg font-bold text-emerald-950 m-0">Key Takeaways</h3>
  </div>
  <ul class="space-y-2 text-sm md:text-base text-emerald-900 list-none pl-0 mb-0">
    <li class="flex items-start gap-2">
      <span class="text-emerald-600 font-bold">•</span>
      <span><b>Agentic Architecture:</b> Multi-agent decomposition reduces complex task failures by over 40%.</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-emerald-600 font-bold">•</span>
      <span><b>Prompt Determinism:</b> Use strict schema enforcement and JSON validation for zero-hallucination tools.</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-emerald-600 font-bold">•</span>
      <span><b>Observability:</b> Implement step-by-step telemetry to audit token budgets and reasoning latency.</span>
    </li>
  </ul>
</div>
`,
    css: ``,
  },

  {
    name: "Info Callout Note",
    category: "Callouts",
    description: "Informational tip box with blue tint and accent border",
    html: `
<div class="my-5 flex items-start gap-3.5 rounded-xl border-l-4 border-blue-600 bg-blue-50/80 p-4 shadow-sm text-blue-950">
  <div class="text-blue-600 text-xl font-bold flex-shrink-0 mt-0.5">ℹ️</div>
  <div class="text-sm md:text-base leading-relaxed">
    <strong class="font-bold text-blue-900 block mb-1">Pro Tip:</strong>
    Ensure your API keys are always stored inside securely loaded environment variables and never checked into client-side bundles.
  </div>
</div>
`,
    css: ``,
  },

  {
    name: "Warning / Caution Alert",
    category: "Callouts",
    description: "High-visibility warning box for gotchas or important caveats",
    html: `
<div class="my-5 flex items-start gap-3.5 rounded-xl border-l-4 border-amber-500 bg-amber-50/90 p-4 shadow-sm text-amber-950">
  <div class="text-amber-600 text-xl font-bold flex-shrink-0 mt-0.5">⚠️</div>
  <div class="text-sm md:text-base leading-relaxed">
    <strong class="font-bold text-amber-900 block mb-1">Caution:</strong>
    Always configure strict rate limits and max-token caps before deploying public endpoints to prevent runaway billing spikes.
  </div>
</div>
`,
    css: ``,
  },

  {
    name: "Code Snippet / Terminal",
    category: "Code & Media",
    description: "Dark styled code box with Mac window buttons and syntax highlight styling",
    html: `
<div class="my-6 rounded-xl overflow-hidden bg-slate-900 text-slate-100 shadow-xl border border-slate-800">
  <div class="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60 text-xs font-mono text-slate-400">
    <div class="flex items-center gap-1.5">
      <span class="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
      <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
      <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
      <span class="ml-2 font-semibold text-slate-300">agent_pipeline.py</span>
    </div>
    <span class="uppercase tracking-wider text-[11px] text-slate-400 font-semibold">Python</span>
  </div>
  <pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-emerald-400 m-0"><code>from riviratech import Agent, ToolRegistry

agent = Agent(
    model="gemini-2.0-flash",
    system_instruction="You are a data validation specialist."
)

@agent.tool
def calculate_metrics(dataset_id: str) -> dict:
    """Computes distribution summary for specified dataset."""
    return {"status": "success", "count": 1420}

response = agent.run("Analyze dataset 2026-Q1")
print(response.output)</code></pre>
</div>
`,
    css: ``,
  },

  {
    name: "Blockquote / Editorial Quote",
    category: "Content",
    description: "Elegant testimonial or statement quote with author attribution",
    html: `
<figure class="my-8 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 p-6 md:p-8 border border-slate-200 shadow-sm relative">
  <span class="text-5xl font-serif text-blue-300 absolute top-2 left-4 select-none pointer-events-none">“</span>
  <blockquote class="relative z-10 text-base md:text-xl font-medium text-slate-800 italic leading-relaxed pl-6 mb-4">
    Generative AI isn't simply about generating text or code; it's about redefining how human cognition and automated systems collaborate to solve real-world problems.
  </blockquote>
  <figcaption class="flex items-center gap-3 pl-6">
    <div class="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">KK</div>
    <div>
      <div class="font-bold text-slate-900 text-sm">Dr. K. Raghav</div>
      <div class="text-xs text-slate-500">Chief AI Scientist & Founding Director</div>
    </div>
  </figcaption>
</figure>
`,
    css: ``,
  },

  {
    name: "Two-Column Comparison (Pros & Cons)",
    category: "Layout",
    description: "Side-by-side cards comparing benefits vs drawbacks",
    html: `
<div class="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
  <div class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
    <div class="flex items-center gap-2 mb-3">
      <span class="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">✓</span>
      <h4 class="font-bold text-emerald-950 text-base m-0">Recommended (Pros)</h4>
    </div>
    <ul class="text-sm text-emerald-900 space-y-2 list-none pl-0 m-0">
      <li class="flex items-start gap-1.5">• <span>Declarative schemas for tools</span></li>
      <li class="flex items-start gap-1.5">• <span>Sub-second streaming token response</span></li>
      <li class="flex items-start gap-1.5">• <span>Full audit trail of reasoning steps</span></li>
    </ul>
  </div>

  <div class="rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
    <div class="flex items-center gap-2 mb-3">
      <span class="w-6 h-6 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-xs">✕</span>
      <h4 class="font-bold text-rose-950 text-base m-0">Avoid (Cons)</h4>
    </div>
    <ul class="text-sm text-rose-900 space-y-2 list-none pl-0 m-0">
      <li class="flex items-start gap-1.5">• <span>Unbounded prompt contexts with high token bills</span></li>
      <li class="flex items-start gap-1.5">• <span>Hardcoded external endpoints inside prompts</span></li>
      <li class="flex items-start gap-1.5">• <span>Lack of fallback error handlers</span></li>
    </ul>
  </div>
</div>
`,
    css: ``,
  },

  {
    name: "Numbered Steps Roadmap",
    category: "Layout",
    description: "Vertical sequence of 3 numbered cards for tutorial steps",
    html: `
<div class="my-8 space-y-4">
  <div class="flex items-start gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-400 transition">
    <div class="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-base shadow">1</div>
    <div>
      <h4 class="text-base font-bold text-slate-900 mb-1">Define the Core Agent Objective</h4>
      <p class="text-sm text-slate-600 leading-relaxed m-0">
        Start by specifying the primary outcome, available system inputs, and exact output format schema required by downstream microservices.
      </p>
    </div>
  </div>

  <div class="flex items-start gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-400 transition">
    <div class="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-base shadow">2</div>
    <div>
      <h4 class="text-base font-bold text-slate-900 mb-1">Equip Curated Tool Integrations</h4>
      <p class="text-sm text-slate-600 leading-relaxed m-0">
        Supply read-only database connections, web retrieval APIs, and calculation utilities with strict validation guardrails.
      </p>
    </div>
  </div>

  <div class="flex items-start gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-400 transition">
    <div class="flex-shrink-0 w-9 h-9 rounded-xl bg-purple-600 text-white font-extrabold flex items-center justify-center text-base shadow">3</div>
    <div>
      <h4 class="text-base font-bold text-slate-900 mb-1">Deploy with Live Evaluation Loop</h4>
      <p class="text-sm text-slate-600 leading-relaxed m-0">
        Continuously evaluate execution traces against automated benchmark assertions before serving production student requests.
      </p>
    </div>
  </div>
</div>
`,
    css: ``,
  },

  {
    name: "Feature / Card Grid (3-Col)",
    category: "Layout",
    description: "Three responsive cards with icon badges and description",
    html: `
<div class="my-8 grid grid-cols-1 md:grid-cols-3 gap-5">
  <div class="p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200">
    <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xl mb-3">⚡</div>
    <h4 class="font-bold text-slate-900 text-base mb-1.5">High Throughput</h4>
    <p class="text-sm text-slate-600 leading-relaxed m-0">Optimized batch inference architecture handling up to 10k requests/min.</p>
  </div>

  <div class="p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200">
    <div class="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl mb-3">🛡️</div>
    <h4 class="font-bold text-slate-900 text-base mb-1.5">Enterprise Security</h4>
    <p class="text-sm text-slate-600 leading-relaxed m-0">Role-based access control with SOC2 compliant session isolation.</p>
  </div>

  <div class="p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200">
    <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl mb-3">📈</div>
    <h4 class="font-bold text-slate-900 text-base mb-1.5">Real-time Analytics</h4>
    <p class="text-sm text-slate-600 leading-relaxed m-0">Complete dashboard tracking latency, token usage, and user engagement.</p>
  </div>
</div>
`,
    css: ``,
  },

  {
    name: "Call To Action (CTA) Banner",
    category: "Callouts",
    description: "Conversion banner with heading, description, and link button",
    html: `
<section class="my-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8 text-center shadow-lg relative overflow-hidden">
  <div class="max-w-2xl mx-auto relative z-10">
    <h3 class="text-2xl md:text-3xl font-extrabold text-white mb-3">
      Ready to Advance Your GenAI Career?
    </h3>
    <p class="text-blue-100 text-sm md:text-base mb-6 leading-relaxed">
      Join our live instructor-led cohort with hands-on capstone projects, industry mentorship, and recognized certifications.
    </p>
    <a href="/courses" target="_blank" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-blue-700 font-bold text-sm shadow hover:bg-blue-50 transition transform hover:-translate-y-0.5 no-underline">
      Explore Upcoming Batches →
    </a>
  </div>
</section>
`,
    css: ``,
  },

  {
    name: "Responsive Comparison Table",
    category: "Content",
    description: "Clean styled table with header and row alternating background",
    html: `
<div class="my-6 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
  <table class="w-full text-left text-sm text-slate-700 border-collapse">
    <thead class="bg-slate-100 text-xs uppercase font-bold text-slate-800 border-b border-slate-200">
      <tr>
        <th class="p-3.5">Feature</th>
        <th class="p-3.5">Traditional Prompting</th>
        <th class="p-3.5 text-blue-600">Autonomous Agent</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-semibold text-slate-900">Execution Scope</td>
        <td class="p-3.5">Single-turn response</td>
        <td class="p-3.5 text-blue-700 font-medium">Multi-step goal execution</td>
      </tr>
      <tr class="hover:bg-slate-50 bg-slate-50/50">
        <td class="p-3.5 font-semibold text-slate-900">External Tools</td>
        <td class="p-3.5 text-slate-400">None / Static</td>
        <td class="p-3.5 text-blue-700 font-medium">Dynamic tool calling</td>
      </tr>
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-semibold text-slate-900">Error Correction</td>
        <td class="p-3.5 text-slate-400">Manual re-prompt</td>
        <td class="p-3.5 text-blue-700 font-medium">Autonomous feedback loop</td>
      </tr>
    </tbody>
  </table>
</div>
`,
    css: ``,
  },

  {
    name: "Image with Caption",
    category: "Code & Media",
    description: "Responsive figure with rounded borders and centered caption",
    html: `
<figure class="my-7 text-center">
  <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80" alt="Generative AI concept visualization" class="rounded-xl shadow-md mx-auto max-h-96 object-cover w-full" />
  <figcaption class="mt-2.5 text-xs md:text-sm text-slate-500 italic">
    Figure 1: High-level architectural diagram of an autonomous agent feedback loop.
  </figcaption>
</figure>
`,
    css: ``,
  },

  {
    name: "FAQ Section",
    category: "Content",
    description: "Styled Q&A list for common reader questions",
    html: `
<div class="my-8 space-y-3">
  <h3 class="text-xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h3>
  
  <div class="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
    <h5 class="text-base font-bold text-slate-900 mb-1.5">What prerequisites are needed to follow this guide?</h5>
    <p class="text-sm text-slate-600 leading-relaxed m-0">Basic familiarity with Python and understanding REST API structures is all that's required.</p>
  </div>

  <div class="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
    <h5 class="text-base font-bold text-slate-900 mb-1.5">Are code samples compatible with open-source models?</h5>
    <p class="text-sm text-slate-600 leading-relaxed m-0">Yes, the tool-calling conventions follow standard OpenAI and Ollama function calling specifications.</p>
  </div>
</div>
`,
    css: ``,
  },

  {
    name: "Author Bio Card",
    category: "Content",
    description: "End of article author presentation box",
    html: `
<div class="my-10 p-6 rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
  <div class="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl flex items-center justify-center flex-shrink-0 shadow-md">
    KK
  </div>
  <div>
    <h4 class="text-base font-bold text-slate-900 mb-1">Rivira Technologies Editorial Team</h4>
    <p class="text-xs text-blue-600 font-semibold mb-2">Research & Engineering Division</p>
    <p class="text-sm text-slate-600 leading-relaxed m-0">
      Dedicated to delivering cutting-edge tutorials, real-world industry roadmaps, and actionable AI engineering insights for students and professionals.
    </p>
  </div>
</div>
`,
    css: ``,
  },
];