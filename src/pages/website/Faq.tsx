import { useState } from "react";
import {HelpCircle, GraduationCap, Briefcase, MessageCircle} from "lucide-react";
import InquiryModal from "../../components/InquiryModal";
import {SitePage, PageHero, Section, FaqBlock, EndBanner} from "../../components/site/PageKit";

export const FAQ_ITEMS = [
  {
    qKey: "home.faq.q1",
    defaultQ: "Do I need coding experience to start?",
    aKey: "home.faq.a1",
    defaultA: "Not at all. We have tracks for every level — the AI for Non-IT Professionals and AI for Kids programs assume zero coding background, while the AI for Coders and AI Agents tracks go deep for developers. You'll always start at a level that fits you and build up from there.",
  },
  {
    qKey: "home.faq.q2",
    defaultQ: "Which AI course is best for a complete beginner?",
    aKey: "home.faq.a2",
    defaultA: "If you're brand new to AI, we recommend starting with AI for Non-IT Professionals or Foundations of AI. Even better, join one of our free AI workshops first — it's a no-commitment way to see how we teach before you enroll.",
  },
  {
    qKey: "home.faq.q3",
    defaultQ: "Are the programs hands-on with real projects?",
    aKey: "home.faq.a3",
    defaultA: "Yes — every program is project-based. You build and keep real applications (chatbots, RAG systems, AI agents, and more) that you can demo to employers or reuse at work. You finish each track with portfolio-ready work, not just notes.",
  },
  {
    qKey: "home.faq.q7",
    defaultQ: "What projects will I build?",
    aKey: "home.faq.a7",
    defaultA:
      "Real, working ones — an LLM-powered application, a RAG system that answers questions over your own documents, a tool-using AI agent, and an end-to-end capstone you deploy. The exact build list depends on the track you pick, and everything you make is yours to keep, demo and put in front of a hiring manager.",
  },
  {
    qKey: "home.faq.q8",
    defaultQ: "Is the program live or recorded?",
    aKey: "home.faq.a8",
    defaultA:
      "Both. You attend scheduled live sessions with an instructor and can ask questions in real time, and every session is recorded so you can rewatch the library whenever you like. Missing a class does not put you behind.",
  },
  {
    qKey: "home.faq.q9",
    defaultQ: "What are the class timings?",
    aKey: "home.faq.a9",
    defaultA:
      "Sessions are scheduled per batch and lean towards evenings and weekends, so the program works alongside a job or college. We send you the exact timetable before your batch starts — and because every class is recorded, a session you cannot attend live costs you nothing.",
  },
  {
    qKey: "home.faq.q10",
    defaultQ: "How much mentor support do I receive?",
    aKey: "home.faq.a10",
    defaultA:
      "Weekly live doubt-clearing sessions, written feedback on the projects you submit, and 1:1 guidance from people who build this professionally. Questions asked during a live class are answered there and then rather than left in a queue.",
  },
  {
    qKey: "home.faq.q11",
    defaultQ: "Is there a certificate?",
    aKey: "home.faq.a11",
    defaultA:
      "Yes — a shareable certificate of completion, issued once your projects are built and signed off. It is tied to work you actually finished rather than to attendance, which is what makes it worth showing.",
  },
  {
    qKey: "home.faq.q12",
    defaultQ: "What happens after the program?",
    aKey: "home.faq.a12",
    defaultA:
      "You finish with a portfolio of working projects, your certificate, and continued access to the recorded library. You stay in the community alongside past cohorts, and we are happy to review your portfolio and CV as you start applying.",
  },
  {
    qKey: "home.faq.q4",
    defaultQ: "Do you help with careers and job placement?",
    aKey: "home.faq.a4",
    defaultA:
      "Yes. The AI Career Path Program includes resume support tailored to AI roles, portfolio reviews, and mock interviews with practical feedback. We also advise on which roles suit your background and what hiring teams are actually looking for.",
  },
  {
    qKey: "home.faq.q13",
    defaultQ: "Can my company enroll a team?",
    aKey: "home.faq.a13",
    defaultA:
      "Yes. We run the same programs for teams, with batch scheduling that fits your working hours and content tuned to what your people actually build. See the Corporate Training page, or contact us and we will put a plan together.",
  },
  {
    qKey: "home.faq.q5",
    defaultQ: "Can businesses hire Rivira Technologies for AI development?",
    aKey: "home.faq.a5",
    defaultA:
      "Yes. Alongside training, we build proof of concepts and full AI products for startups and growth-stage teams. That covers scoping the idea, validating feasibility and cost, and delivering something you can launch and scale.",
  },
  {
    qKey: "home.faq.q6",
    defaultQ: "Are the free workshops really free?",
    aKey: "home.faq.a6",
    defaultA:
      "Yes. We run free AI workshops most Saturdays, covering generative AI, prompt engineering, agents, and career roadmaps. They are 90 minutes, fully online, and include a hands-on exercise plus live Q&A. No payment or card details are required.",
  },
];

const GROUPS = [
  { eyebrow: "Getting started", title: "Before you join", keys: ["home.faq.q1", "home.faq.q2", "home.faq.q3", "home.faq.q7"] },
  { eyebrow: "Learning with us", title: "How the programs run", keys: ["home.faq.q8", "home.faq.q9", "home.faq.q10", "home.faq.q11", "home.faq.q12"] },
  { eyebrow: "Careers & business", title: "Careers, teams and workshops", keys: ["home.faq.q4", "home.faq.q13", "home.faq.q5", "home.faq.q6"] },
];

export default function Faq() {
  const [askOpen, setAskOpen] = useState(false);
  const byKey = (k: string) => FAQ_ITEMS.find((f) => f.qKey === k)!;

  return (
    <SitePage
      title="FAQ — Common Questions | Rivira Tech"
      desc="Answers to the questions people ask most before joining a Rivira Tech program — prerequisites, which course to start with, projects, careers, business services and free workshops."
      keywords="Rivira Tech FAQ, AI training questions, AI course prerequisites, free AI workshop, AI career support"
    >
      <PageHero
        crumb="FAQ"
        eyebrow="Common questions"
        title="Honest answers,"
        accent="before you decide"
        text="Short, straight answers to what most people ask before joining. If yours isn't here, ask us directly — we reply personally."
        image="/images/pages/faq.webp"
        imageAlt="Questions and answers in chat bubbles"
        actions={[{ label: "Ask a Question", onClick: () => setAskOpen(true) }, { label: "Talk to an Advisor", href: "tel:+917207301237", ghost: true }]}
        facts={[
          { icon: HelpCircle, label: `${FAQ_ITEMS.length} common questions` },
          { icon: GraduationCap, label: "Courses & careers" },
          { icon: Briefcase, label: "Business services" },
          { icon: MessageCircle, label: "Personal replies" },
        ]}
      />

      {GROUPS.map((g, i) => (
        <Section key={g.title} tone={i % 2 === 0 ? "white" : "page"}>
          <FaqBlock eyebrow={g.eyebrow} title={g.title} items={g.keys.map((k) => ({ q: byKey(k).defaultQ, a: byKey(k).defaultA }))} />
        </Section>
      ))}

      <EndBanner
        eyebrow="Still curious?"
        title="Didn't find your answer?"
        text="Send us your question and a real person will reply — usually within one business day."
        actions={[{ label: "Ask Us a Question", onClick: () => setAskOpen(true) }, { label: "Join a Free Workshop", to: "/workshop", ghost: true }]}
      />

      {askOpen && (
        <InquiryModal open onClose={() => setAskOpen(false)} title="Didn't find your answer?"
          intro="Send us your question and we'll get back to you personally." source="faq-page" />
      )}
    </SitePage>
  );
}
