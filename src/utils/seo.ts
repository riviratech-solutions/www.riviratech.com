export function getSeoByPath(path: any) {
  // Guard against a non-string / empty path (would otherwise throw on .toLowerCase()).
  if (!path || typeof path !== "string") {
    return {
      title: "Rivira Technologies",
      description: "AI Training & Solutions Leader",
      keywords: "AI, GenAI, Machine Learning"
    };
  }
  const seoData = [
    {
      match: "home",
      title: "Rivira Technologies | AI Training, Products & Solutions",
      description: "Transform your career with world-class AI training. From beginners to enterprises—master AI agents, RAG, LLMs & more with hands-on, project-first learning.",
      keywords: "AI training, GenAI courses, AI education, learn artificial intelligence, AI bootcamp, machine learning training, LLM courses, AI certification, generative AI training, AI career, AI skills development, AI for kids, AI for non-coders, corporate AI training, AI for developers"
    },
    {
      match: "certificate-request",
      title: "Request Your Certificate | Rivira Technologies",
      description: "Completed a course with Rivira Technologies? Request your certificate of completion and we'll email it to you once your details are verified.",
      keywords: "Rivira Technologies certificate, request certificate, course completion certificate, AI training certificate, certificate of completion"
    },
    {
      match: "certificate-requests",
      title: "Certificate Requests Management | Admin Panel | Rivira Technologies",
      description: "Manage incoming certificate requests, review student credentials, create student accounts, and approve certificates.",
      keywords: "Rivira Technologies certificate requests, admin certificate requests, issue certificate, student credentials"
    },
    {
      match: "programs",
      title: "AI Training Programs | Rivira Technologies",
      description: "Explore Rivira Technologies's AI training tracks for kids, coders, non-coders, business teams and enterprises — practical, project-first programs with real outcomes.",
      keywords: "AI training programs, AI courses, AI for kids, AI for coders, AI for non-coders, GenAI for business, corporate AI training, AI Stack"
    },
    {
      match: "services",
      title: "AI Services — Training, POCs & Product Development | Rivira Technologies",
      description: "AI training, proof-of-concept sprints, AI product development, business automation, consulting and career guidance from Rivira Technologies.",
      keywords: "AI services, AI consulting, AI POC development, AI product development, business automation, AI training services, career guidance"
    },
    {
      match: "careers",
      title: "Careers at Rivira Technologies | Join Our Team",
      description: "Open roles at Rivira Technologies. Help us teach and build practical AI with students, professionals and businesses.",
      keywords: "Rivira Technologies careers, AI jobs, AI trainer jobs, AI engineer jobs, work at Rivira Technologies"
    },
    {
      match: "gallery",
      title: "Gallery | Rivira Technologies",
      description: "Photos from Rivira Technologies workshops, classes, events and learner showcases.",
      keywords: "Rivira Technologies gallery, AI workshop photos, AI training events, learner showcase"
    },
    {
      match: "events",
      title: "Events | Rivira Technologies",
      description: "Upcoming and past Rivira Technologies events, live sessions and AI meetups. Get notified about the next one.",
      keywords: "AI events, AI meetups, AI live sessions, Rivira Technologies events, generative AI events"
    },
    {
      match: "about",
      title: "About Rivira Technologies | AI Training & Solutions Leader",
      description: "Rivira Technologies: Premier AI education and consulting. Empowering individuals and enterprises worldwide with practical AI skills and production solutions.",
      keywords: "Rivira Technologies, AI training company, AI education provider, GenAI consulting, AI learning platform, AI skills development, AI workforce training, AI consulting firm, generative AI experts, AI bootcamp provider, AI course creators, enterprise AI partner"
    },
    {
      match: "Contact",
      title: "Contact Rivira Technologies | Get Started with AI Training & Solutions",
      description: "Connect with Rivira Technologies. Inquire about AI training, corporate programs, consulting, or proof-of-concepts. Offices in USA and India. Let's talk AI.",
      keywords: "contact Rivira Technologies, AI training inquiry, AI consulting contact, GenAI support, AI course enrollment, corporate AI training inquiry, AI POC consultation, AI education contact, reach AI experts, AI training providers contact, how to enroll in AI training courses, request corporate AI training quote, schedule AI consulting call, contact AI education company"
    },
    {
      match: "ai-stack",
      title: "The AI Stack · Rivira Technologies — Agents, Agentic AI, RAG, MCP, LLMs & Automation",
      description: "Enterprise AI training covering AI Agents, Agentic AI, LLMs, RAG, MCP and AI Automation — with live implementation, real industry use cases and production deployment.",
      keywords: "AI stack, AI agents course, agentic AI, LLMs, RAG training, Model Context Protocol, MCP course, AI automation training, LangGraph course, multi-agent systems, CrewAI training, AutoGen course, autonomous AI agents, agent orchestration, tool-using agents, AI agent frameworks, enterprise AI program"
    },
    {
      match: "ai-for-coders",
      title: "AI for Coders | LLM & AI Engineering for Developers | Rivira Technologies",
      description: "Level up as a developer with production AI skills. Build LLM apps, AI agents, and RAG pipelines with LangChain, Python, and modern AI APIs.",
      keywords: "AI for developers, AI engineering course, LLM development, AI for programmers, LangChain training, AI agent development, machine learning for developers, LLM engineering, AI API integration, Python AI development, production AI systems"
    },
    {
      match: "ai-for-kids",
      title: "AI for Kids | Fun AI & Coding Classes for Ages 8-16 | Rivira Technologies",
      description: "Spark your child's future with hands-on AI education. Fun, safe, and engaging AI & coding courses designed for kids ages 8-16. Build chatbots, games & more!",
      keywords: "AI for kids, AI classes for children, coding for kids, kids AI course, artificial intelligence for children, AI education kids, STEM for kids, coding classes for children, kids programming, AI summer camp, machine learning for kids"
    },
    {
      match: "ai-for-non-coders",
      title: "AI for Non-Coders | No-Code AI Training & Certification | Rivira Technologies",
      description: "Master AI without writing code. Learn to build AI workflows, automate tasks, and leverage ChatGPT, Claude & no-code tools. Perfect for business professionals.",
      keywords: "AI for non-coders, no-code AI, AI for beginners, AI without coding, AI for business professionals, no-code automation, ChatGPT training, AI for non-technical, learn AI without programming, AI tools for beginners, citizen developer AI"
    },
    {
      match: "computer-vision-llms",
      title: "Computer Vision & LLMs Course | Multimodal AI Training | Rivira Technologies",
      description: "Combine vision and language AI for powerful multimodal applications. Master GPT-4V, image analysis, video processing, and visual AI automation systems.",
      keywords: "computer vision course, multimodal AI, vision language models, GPT-4 Vision training, image recognition AI, visual AI course, LLM vision integration, OCR AI, video analysis AI, multimodal LLM, image-to-text AI, visual question answering"
    },
    {
      match: "corporate-training",
      title: "Corporate AI Training | Enterprise GenAI Programs | Rivira Technologies",
      description: "Upskill your workforce with customized AI training. Enterprise-grade programs for teams of all sizes. On-site, virtual, or hybrid delivery. Measurable ROI.",
      keywords: "corporate AI training, enterprise AI courses, AI training for companies, business AI upskilling, AI workforce development, corporate machine learning training, executive AI education, team AI training, B2B AI courses, AI reskilling programs, organizational AI adoption"
    },
    {
      match: "blogs",
      title: "Blog | AI Insights, Tutorials & News | Rivira Technologies",
      description: "Read the latest on generative AI, LLMs, AI agents, and practical machine learning. Tutorials, industry insights, and news from the Rivira Technologies team.",
      keywords: "AI blog, generative AI articles, LLM tutorials, AI news, machine learning blog, AI insights, GenAI updates, AI education blog"
    },
    {
      match: "courses",
      title: "AI Courses & Training Programs | Learn AI | Rivira Technologies",
      description: "Explore comprehensive AI courses from beginner to advanced. Hands-on training in AI agents, RAG, LLMs, computer vision & prompt engineering. Enroll now!",
      keywords: "AI courses, AI training programs, learn AI, GenAI courses, AI agents course, RAG training, LLM course, prompt engineering, computer vision training, AI certification, machine learning courses, AI bootcamp"
    },
    {
      match: "workshop",
      title: "Free AI Workshop | Live Hands-On GenAI Session | Rivira Technologies",
      description: "Join a free, live hands-on Generative AI workshop. Build something real in one session — no prior AI experience needed. Seats are limited; register now.",
      keywords: "free AI workshop, GenAI workshop, live AI training session, hands-on AI class, AI bootcamp preview, learn generative AI free, AI workshop registration, introduction to AI workshop"
    },
    {
      match: "enroll",
      title: "Enroll Now | Join AI Training Programs | Rivira Technologies",
      description: "Enroll in Rivira Technologies's AI training programs today. From AI for Kids to Corporate Training—start your transformation journey. Fill the form & we'll guide you!",
      keywords: "enroll AI course, AI training enrollment, join AI program, register AI course, AI course registration, GenAI enrollment, AI bootcamp signup, AI training application, enroll in AI training program, sign up for AI course online, register AI bootcamp Atlanta"
    },
    {
      match: "fine-tuning-prompt-engineering",
      title: "Prompt Engineering & Fine-Tuning Course | Rivira Technologies",
      description: "Master advanced prompting techniques and model fine-tuning. Learn chain-of-thought, few-shot learning & LLM optimization. Extract maximum value from AI models!",
      keywords: "prompt engineering course, LLM fine-tuning, advanced prompting, chain-of-thought prompting, few-shot learning, zero-shot prompting, prompt optimization, LLM customization, AI prompt templates, model tuning"
    },
    {
      match: "foundations-of-ai",
      title: "AI Foundations Course | Learn AI & Machine Learning Basics | Rivira Technologies",
      description: "Start your AI journey with solid foundations. Understand LLMs, machine learning, neural networks, and core AI concepts. Perfect for beginners and career changers.",
      keywords: "AI foundations course, learn AI basics, introduction to artificial intelligence, AI for beginners, machine learning fundamentals, LLM basics, neural networks introduction, AI concepts, beginner AI course, understand artificial intelligence, AI literacy, AI 101"
    },
    {
      match: "genai-for-business",
      title: "Generative AI for Business | AI Strategy & Implementation | Rivira Technologies",
      description: "Apply generative AI to real business challenges. Learn AI strategy, use-case identification, ROI measurement, and implementation for competitive advantage.",
      keywords: "generative AI for business, AI business strategy, enterprise AI implementation, AI for business leaders, AI use cases business, AI ROI, business AI transformation, AI competitive advantage, AI decision making, generative AI applications, AI business automation, AI-driven business"
    },
    {
      match: "poc",
      title: "AI Proof of Concepts | Validate Ideas in Weeks | Rivira Technologies",
      description: "De-risk AI investments with rapid proof-of-concepts. See working demos in 2-4 weeks using LangGraph, CrewAI, and production frameworks. 94% success rate.",
      keywords: ""
    },
    {
      match: "projects",
      title: "Student AI Projects | Portfolio Showcase | Rivira Technologies",
      description: "Explore AI projects built by our students. From autonomous agents to RAG systems—real portfolio work demonstrating job-ready skills and practical expertise.",
      keywords: ""
    },
    {
      match: "rag-retrieval-systems",
      title: "RAG & Retrieval Systems Course | Build AI Knowledge Bases | Rivira Technologies",
      description: "Master Retrieval-Augmented Generation. Build production RAG pipelines, vector databases, and AI-powered knowledge systems. Reduce hallucinations, increase accuracy.",
      keywords: "RAG course, retrieval augmented generation, vector database training, AI knowledge base, LangChain RAG, Pinecone training, embeddings course, semantic search AI, document QA system, enterprise search AI, knowledge retrieval AI, RAG pipeline development"
    },
    {
      match: "legal",
      title: "Legal & Policies | Rivira Technologies",
      description: "Privacy, terms and conditions, refunds and cancellations, accessibility, and security — every Rivira Technologies policy in one place.",
      keywords: "Rivira Technologies legal, privacy policy, terms and conditions, refund policy, cancellation policy, accessibility statement, security overview"
    },
    {
      match: "TermsConditions",
      title: "Terms and Conditions | Rivira Technologies",
      description: "Read the Terms and Conditions for using Rivira Technologies website and services. Learn about our policies, user rights, and guidelines.",
      keywords: ""
    },
    {
      match: "PrivacyPolicy",
      title: "Privacy Policy | Rivira Technologies",
      description: "Learn how Rivira Technologies collects, uses, and protects your personal information. Read our Privacy Policy for complete data protection details.",
      keywords: ""
    },
    {
      match: "RefundPolicy",
      title: "Refund & Cancellation Policy | Rivira Technologies",
      description: "How refunds, cancellations, and transfers work for Rivira Technologies programs.",
      keywords: ""
    },
    {
      match: "Accessibility",
      title: "Accessibility Statement | Rivira Technologies",
      description: "Our commitment to making the Rivira Technologies website and programs accessible, and how to request help.",
      keywords: ""
    },
    {
      match: "SecurityOverview",
      title: "Security Overview | Rivira Technologies",
      description: "A plain-language overview of how Rivira Technologies protects your data across accounts, payments, and forms.",
      keywords: ""
    },
    {
      match: "sad35ffsf",
      title: "",
      description: "",
      keywords: ""
    },
    {
      match: "sad325wffsf",
      title: "",
      description: "",
      keywords: ""
    },
    {
      match: "sad32de4",
      title: "",
      description: "",
      keywords: ""
    }
  ];

  const matched = seoData.find(item =>
    path.toLowerCase().includes(item.match.toLowerCase())
  );

  return matched || {
    title: "Rivira Technologies",
    description: "AI Training & Solutions Leader",
    keywords: "AI, GenAI, Machine Learning"
  };
}
