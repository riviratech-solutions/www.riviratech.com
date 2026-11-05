import { getSeoByPath } from "../../utils/seo";
import {
  Sparkles,
  Layers,
  Laptop,
  Users,
  Medal,
  Gamepad2,
  Smile,
  Shield,
  GraduationCap,
  Compass,
  Repeat,
  Code2,
  Database,
  Brain,
  BarChart3,
  Network,
  MessageCircle,
  Scale,
  Trophy,
  Bot,
  TrendingUp,
  Image as ImageIcon,
  Wand2,
  Award,
} from "lucide-react";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Split,
  Curriculum,
  FaqBlock,
  EndBanner,
} from "../../components/site/PageKit";

const seo = getSeoByPath("ai-for-kids");

const HIGHLIGHTS = [
  {
    icon: Layers,
    title: "12 Modules",
    desc: "Structured learning from AI basics to advanced ideas, built for beginners.",
  },
  {
    icon: Laptop,
    title: "Hands-On Projects",
    desc: "Build real AI applications, including chatbots, games, image classifiers and more.",
  },
  {
    icon: Users,
    title: "Expert Instructors",
    desc: "Learn from working professionals who make AI fun, clear and age-appropriate.",
  },
  {
    icon: Medal,
    title: "Certificate",
    desc: "Earn a verified certificate upon completion to showcase your AI achievement.",
  },
];

const MODULES = [
  {
    num: "1",
    icon: Compass,
    title: "Introduction to AI",
    desc:
      "Start with what artificial intelligence actually is, where the idea came from, and how much of it a learner already uses in a normal day — recommendations, voice assistants, camera filters. The module ends on small builds so the ideas land as something made rather than something read.",
    topics: [
      "What is AI?",
      "History of AI",
      "AI in everyday life",
      "Simple AI projects",
      "How AI is different from a person",
      "Where AI gets things wrong",
    ],
  },
  {
    num: "2",
    icon: Repeat,
    title: "Understanding Algorithms",
    desc:
      "An algorithm is just a set of steps, and the way to understand that is to write some. Learners put data in order and search through it, then play the same ideas out as games so the logic sticks before any code is involved.",
    topics: [
      "What is an algorithm?",
      "Creating simple algorithms",
      "Sorting & searching",
      "Algorithm games",
      "Thinking in steps",
      "Comparing two solutions",
    ],
  },
  {
    num: "3",
    icon: Code2,
    title: "Basics of Programming",
    desc:
      "The first real code. Python from zero: storing values, the different kinds of data a program handles, doing arithmetic on them, and getting information in and out of a program.",
    topics: [
      "Introduction to Python",
      "Variables & data types",
      "Operators",
      "Input/output",
      "Comments & readable code",
      "Finding your first bugs",
    ],
  },
  {
    num: "4",
    icon: Network,
    title: "Control Structures",
    desc:
      "Programs that make decisions and repeat themselves. Conditions and loops are the two ideas that turn a flat list of instructions into something that behaves differently depending on what it is given — practised through exercises and small games.",
    topics: [
      "Conditional statements",
      "Loops",
      "Practical exercises",
      "Mini games",
      "Conditions inside conditions",
      "Stopping a loop early",
    ],
  },
  {
    num: "5",
    icon: Database,
    title: "Data Handling",
    desc:
      "Machine learning is mostly data work, so this module covers gathering data, fixing what is missing or wrong, shaping it into a form a model can use, and drawing it as charts that can actually be read.",
    topics: [
      "Collecting data",
      "Cleaning data",
      "Preprocessing basics",
      "Data visualisation",
      "Spotting data that looks wrong",
      "Reading a chart carefully",
    ],
  },
  {
    num: "6",
    icon: Brain,
    title: "Intro to Machine Learning",
    desc:
      "Where the computer works the rules out from examples instead of being handed them. The module separates the main families of machine learning: learning from labelled examples, and finding structure in data that carries no labels at all.",
    topics: [
      "What is ML?",
      "Types of ML",
      "Supervised learning",
      "Unsupervised learning",
      "Features & labels",
      "When rules beat learning",
    ],
  },
  {
    num: "7",
    icon: BarChart3,
    title: "Building ML Models",
    desc:
      "A working model, end to end. Learners split their data so the model is judged on examples it has never seen, fit a first prediction, measure how wrong it is, and then improve it — which is the part that teaches the most.",
    topics: [
      "Training & testing data",
      "Linear regression",
      "Model evaluation",
      "Improving accuracy",
      "Why a model can memorise",
      "Making your first prediction",
    ],
  },
  {
    num: "8",
    icon: Sparkles,
    title: "Neural Networks",
    desc:
      "How the models behind modern AI are put together. Layers and deep learning are explained in plain terms, then used to build a small network of the learner's own that recognises images.",
    topics: [
      "What are neural networks?",
      "Deep learning basics",
      "Building simple NN",
      "Image recognition",
      "Neurons, layers & weights",
      "Learning from examples",
    ],
  },
  {
    num: "9",
    icon: Gamepad2,
    title: "AI in Games",
    desc:
      "Game AI is a different craft from research AI, and an easier one to see working. Learners give non-player characters behaviour and decisions to make, then build a game AI project of their own.",
    topics: [
      "AI in video games",
      "Creating game AI",
      "NPCs and behaviours",
      "Game AI project",
      "Pathfinding basics",
      "Making a game fair",
    ],
  },
  {
    num: "10",
    icon: MessageCircle,
    title: "Natural Language Processing",
    desc:
      "Teaching a program to work with language. Text gets broken down and cleaned, judged for whether it reads as positive or negative, and finally put to work in a chatbot that can hold a conversation.",
    topics: [
      "Introduction to NLP",
      "Text processing",
      "Sentiment analysis",
      "Building a chatbot",
      "Turning words into numbers",
      "Testing your chatbot",
    ],
  },
  {
    num: "11",
    icon: Scale,
    title: "AI Ethics & Future",
    desc:
      "What AI should and should not be used for, why safety is an engineering problem rather than only a philosophical one, where the field looks to be heading, and the kinds of work it is opening up.",
    topics: [
      "Ethical considerations",
      "AI safety",
      "Future of AI",
      "Career opportunities",
      "Bias in AI you already use",
      "Using AI honestly at school",
    ],
  },
  {
    num: "12",
    icon: Trophy,
    title: "Final Project",
    desc:
      "Everything so far, aimed at one project of the learner's own choosing: planned, built, and then presented to an audience. The showcase is what the certificate is awarded on.",
    topics: [
      "Project planning",
      "Building your AI",
      "Presentation skills",
      "Showcase & certificate",
      "Choosing your idea",
      "Feedback & improving it",
    ],
  },
];

/* Each project carries the proof-of-concept detail that used to be hidden
   behind a hover overlay — see .cbiz-cell-link in course-editorial.css. */
const PROJECTS = [
  {
    icon: Bot,
    title: "Simple Chatbot",
    desc: "Build your own AI assistant that can answer questions and have conversations.",
    poc: {
      tag: "NLP Project",
      title: "AI Chatbot with Python & NLTK",
      desc: "Train a rule-based chatbot using intent classification, response templates, and a simple web UI.",
      chips: ["Python", "NLTK", "Flask", "HTML/CSS"],
    },
  },
  {
    icon: Gamepad2,
    title: "Game AI Character",
    desc: "Create an intelligent game character that can make decisions and react to the player.",
    poc: {
      tag: "Game AI",
      title: "Smart NPC with Decision Trees",
      desc: "Build NPCs using Pygame and decision tree algorithms for pathfinding and behavior.",
      chips: ["Python", "Pygame", "Decision Trees"],
    },
  },
  {
    icon: ImageIcon,
    title: "Image Classifier",
    desc: "Train AI to recognise and categorise different images using machine learning.",
    poc: {
      tag: "Computer Vision",
      title: "CNN Image Classifier",
      desc: "Train a convolutional neural network with TensorFlow/Keras to classify images into categories.",
      chips: ["Python", "TensorFlow", "Keras", "NumPy"],
    },
  },
  {
    icon: BarChart3,
    title: "Data Detective",
    desc: "Take a messy set of real numbers and turn it into charts that actually say something.",
    poc: {
      tag: "Data & Charts",
      title: "Data Explorer with Pandas",
      desc: "Collect a small dataset, clean out what is missing or wrong, then plot it and work out what the shape of it is telling you.",
      chips: ["Python", "Pandas", "Matplotlib", "CSV"],
    },
  },
  {
    icon: TrendingUp,
    title: "Prediction Machine",
    desc: "Train a model on what already happened, then use it to predict what comes next.",
    poc: {
      tag: "Machine Learning",
      title: "Score Predictor with Linear Regression",
      desc: "Split the data into training and testing halves, fit a regression line, then measure how close the predictions actually land.",
      chips: ["Python", "Scikit-Learn", "NumPy"],
    },
  },
  /* Stays last: it is the capstone, and the grid reads in order. */
  {
    icon: Wand2,
    title: "Personal AI Assistant",
    desc: "Your final project — a fully functional AI helper you designed from scratch.",
    poc: {
      tag: "Capstone Project",
      title: "Multi-Modal AI Assistant",
      desc: "Combine NLP and basic computer vision into one assistant that listens and sees.",
      chips: ["Python", "OpenAI API", "Speech-to-Text"],
    },
  },
];

const BENEFITS = [
  {
    icon: Gamepad2,
    title: "Fun & Interactive",
    desc: "Games, activities and hands-on projects make learning genuinely exciting.",
  },
  {
    icon: Smile,
    title: "Age-Appropriate",
    desc: "Content is designed specifically for young learners aged 10–20.",
  },
  {
    icon: Shield,
    title: "Safe Environment",
    desc: "A moderated, secure learning platform with full parental visibility.",
  },
  {
    icon: GraduationCap,
    title: "Real Certificate",
    desc: "Earn a certificate upon completion to showcase your achievement.",
  },
];

const FAQ = [
  { q: "Does my child need any experience?", a: "No. The program starts from what AI is and builds up step by step with games and small projects. Curiosity is the only requirement." },
  { q: "What age is it designed for?", a: "Learners from about 10 to 20 years old. Activities scale from playful first builds to real Python and machine-learning projects." },
  { q: "How long does it run?", a: "Twelve modules over roughly 24 weeks, so ideas have time to land as things your child has actually built." },
  { q: "What will they build?", a: "Six projects — from a simple chatbot and a game character to an image classifier — each one something they can show family and friends." },
  { q: "Is it a safe learning environment?", a: "Yes. Sessions are instructor-led, age-appropriate and focused on responsible, ethical use of AI." },
  { q: "Do they get a certificate?", a: "Yes. Learners who complete the program receive a Rivira Tech AI for Kids certificate of completion." },
];

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="AI for Kids"
        eyebrow="Ages 10–20 · No experience needed"
        title="Unlock the future with"
        accent="Artificial Intelligence"
        text="Fun, interactive, project-based AI learning for the next generation — from 'what is AI?' to building real games, chatbots and image classifiers."
        image="/images/pages/kids.webp"
        imageAlt="A friendly robot next to coding blocks and a first AI game"
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "See the Curriculum", href: "#curriculum", ghost: true }]}
        facts={[
          { icon: Layers, label: "12 Modules" },
          { icon: Gamepad2, label: "Games & Activities" },
          { icon: Bot, label: "6 Build Projects" },
          { icon: Award, label: "Certificate" },
        ]}
      />

      <Section tone="white">
        <SectionHead split eyebrow="Why kids love it" title="Learning AI that feels like play"
          text="Games, activities and hands-on projects keep learners curious, while expert instructors make sure the ideas really stick." />
        <CardGrid cols={4} items={BENEFITS.map((b) => ({ icon: b.icon, title: b.title, text: b.desc }))} />
      </Section>

      <Section>
        <Split
          image="/images/hero-courses-card.webp"
          eyebrow="The journey"
          title="A 24-week AI adventure"
          text="A structured path from AI basics to advanced ideas, built for beginners and paced so every concept turns into something made."
          bullets={HIGHLIGHTS.map((h) => `${h.title} — ${h.desc}`)}
          badge={{ value: "24", label: "weeks of guided learning" }}
          actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Talk to Us", to: "/contact", ghost: true }]}
        />
      </Section>

      <Section tone="white" id="curriculum">
        <SectionHead eyebrow="What you'll learn" title="Twelve modules, one step at a time"
          text="Each module ends with something to build. Open a module to see what's inside." />
        <Curriculum limit={6} modules={MODULES.map((m) => ({ title: m.title, summary: m.desc, topics: m.topics }))} />
      </Section>

      <Section tone="grad">
        <SectionHead light eyebrow="Projects" title="Cool projects you'll build"
          text="Real projects with real tools — each one a proud moment to share." />
        <CardGrid cols={3} items={PROJECTS.map((p) => ({ icon: p.icon, meta: p.poc.tag, title: p.title, text: p.desc, chips: p.poc.chips }))} />
      </Section>

      <Section>
        <FaqBlock items={FAQ} title="Questions parents ask" />
      </Section>

      <EndBanner
        eyebrow="The future starts here"
        title="Give your child a head start in AI"
        text="Enroll today, or talk to us about the right starting point for your child."
        actions={[{ label: "Enroll Now", to: "/enroll" }, { label: "Talk to Us", to: "/contact", ghost: true }]}
      />
    </SitePage>
  );
}
