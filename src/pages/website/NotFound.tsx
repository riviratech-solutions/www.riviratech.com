import {GraduationCap, CalendarDays, Briefcase, MessageCircle} from "lucide-react";
import {SitePage, PageHero, Section, SectionHead, CardGrid} from "../../components/site/PageKit";

export default function NotFound() {
  return (
    <SitePage title="Page not found | Rivira Tech" desc="The page you were looking for isn't here. Explore Rivira Tech's AI programs, services and free workshops.">
      <PageHero
        eyebrow="Error 404"
        title="This page took"
        accent="a wrong turn"
        text="The link may be old or mistyped. Here are the places most people are looking for."
        image="/images/pagenotfound.png"
        imageAlt="404 — page not found"
        actions={[{ label: "Back to Home", to: "/" }, { label: "Contact Us", to: "/contact", ghost: true }]}
      />
      <Section tone="white">
        <SectionHead eyebrow="Popular pages" title="Where would you like to go?" />
        <CardGrid cols={4} items={[
          { icon: GraduationCap, title: "AI Programs", text: "Every track, from beginners to AI engineers.", to: "/programs", linkLabel: "Browse programs" },
          { icon: CalendarDays, title: "Free Workshop", text: "A no-commitment session to see how we teach.", to: "/workshop", linkLabel: "Join a workshop" },
          { icon: Briefcase, title: "Business Solutions", text: "AI products, POCs and automation for teams.", to: "/business", linkLabel: "See our work" },
          { icon: MessageCircle, title: "Talk to Us", text: "Call +91 72073 01237 or send a message.", to: "/contact", linkLabel: "Contact" },
        ]} />
      </Section>
    </SitePage>
  );
}
