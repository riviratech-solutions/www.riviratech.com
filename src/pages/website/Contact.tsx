import { anim } from "../../utils/riviraReveal";
import { Mail, Phone, MessageCircle, Clock } from "lucide-react";
import { EMAIL, PHONE, PHONE_TEL } from "../../components/Includes";
import InquiryForm from "../../components/InquiryForm";
import { getSeoByPath } from "../../utils/seo";
import {
  SitePage,
  PageHero,
  Section,
  SectionHead,
  CardGrid,
  Checklist,
  Actions,
} from "../../components/site/PageKit";

const seo = getSeoByPath("Contact");

const CHANNELS = [
  {
    icon: Mail,
    label: "Email",
    value: EMAIL,
    desc: "Best for detailed questions, proposals, and async chats.",
    href: `mailto:${EMAIL}`,
  },
  {
    icon: Phone,
    label: "Phone",
    value: PHONE,
    desc: "Mon–Fri, 9am–6pm ET. Leave a message and we'll call back.",
    href: `tel:${PHONE.replace(/[^+\d]/g, "")}`,
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "Message us",
    desc: "Quick questions, scheduling, or to follow up on an inquiry.",
    href: `https://api.whatsapp.com/send/?phone=${encodeURIComponent(PHONE_TEL)}`,
  },
  {
    icon: Clock,
    label: "Book a call",
    value: "Book Free Career Call",
    desc: "Prefer to talk? A call with a career advisor is often quicker.",
    href: `tel:${PHONE_TEL}`,
  },
];

export default function Page() {
  return (
    <SitePage title={seo.title} desc={seo.description} keywords={seo.keywords}>
      <PageHero
        crumb="Contact Us"
        eyebrow="Get in touch"
        title="Let's talk about"
        accent="your AI goals"
        text="Picking a learning path, exploring an AI project or planning team training — tell us where you are and we'll get back to you within one business day."
        image="/images/pages/contact.webp"
        imageAlt="Contact options: WhatsApp, career advisor, booking a call and email"
        actions={[{ label: "Send a Message", href: "#send-a-message" }, { label: `Call ${PHONE}`, href: `tel:${PHONE_TEL}`, ghost: true }]}
        facts={[
          { icon: Clock, label: "Reply within one business day" },
          { icon: Phone, label: PHONE },
          { icon: Mail, label: EMAIL },
        ]}
      />

      <Section tone="white">
        <SectionHead eyebrow="Reach us" title="Pick the channel that suits you" text="We monitor all of them and reply personally." />
        <CardGrid cols={4} items={CHANNELS.map((c) => ({ icon: c.icon, meta: c.label, title: c.value, text: c.desc, href: c.href, linkLabel: c.label === "Email" ? "Write to us" : c.label === "WhatsApp" ? "Open WhatsApp" : "Call now" }))} />
      </Section>

      <Section id="send-a-message">
        <div className="rv-split">
          <div {...anim("fadeInLeft", 100)}>
            <span className="rv-eyebrow">Send a message</span>
            <h2 className="rv-h2">Let's talk about your AI journey</h2>
            <p className="rv-text rv-split__text">
              Whether you want to learn AI, join a free workshop, or build an AI product for your business, we're here to help.
            </p>
            <Checklist items={[
              "Honest guidance on the right starting point",
              "Programs for IT, non-IT and student learners",
              "Real project support, not just slides",
              "Career direction with portfolio and resume help",
            ]} />
            <div style={{ marginTop: 28 }}>
              <Actions items={[{ label: "WhatsApp Us", href: `https://api.whatsapp.com/send/?phone=${encodeURIComponent(PHONE_TEL)}` }, { label: "Email Us", href: `mailto:${EMAIL}`, ghost: true }]} />
            </div>
          </div>
          <div className="rv-formcard contact-page" {...anim("fadeInRight", 200)}>
            <InquiryForm source="contact" />
          </div>
        </div>
      </Section>
    </SitePage>
  );
}
