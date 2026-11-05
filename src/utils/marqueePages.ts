/* Website pages a marquee message can be shown on (admin Marquees page) and
   how a URL maps to them (SiteMarquee). "*" = every page. A path no entry
   matches counts as "other" (custom pages, forms, projects, ...). */

export type MarqueePage = { key: string; label: string; match?: string[] };

export const MARQUEE_PAGES: MarqueePage[] = [
  { key: "home", label: "Home", match: ["/"] },
  { key: "about", label: "About", match: ["/about", "/about-us"] },
  { key: "programs", label: "Programs", match: ["/programs", "/program/*"] },
  { key: "courses", label: "Courses", match: ["/courses"] },
  { key: "ai-for-kids", label: "AI for Kids", match: ["/ai-for-kids"] },
  { key: "ai-for-coders", label: "AI for Coders", match: ["/ai-for-coders"] },
  { key: "ai-for-non-coders", label: "AI for Non-Coders", match: ["/ai-for-non-coders"] },
  { key: "genai-for-business", label: "GenAI for Business", match: ["/genai-for-business"] },
  { key: "corporate-training", label: "Corporate Training", match: ["/corporate-training"] },
  { key: "ai-stack", label: "AI Stack", match: ["/ai-stack"] },
  { key: "course-plan", label: "Course Plan", match: ["/course-plan", "/course-plan/*"] },
  { key: "workshop", label: "Workshop", match: ["/workshop", "/workshops"] },
  { key: "business", label: "Business & Services", match: ["/business", "/services"] },
  { key: "events", label: "Events", match: ["/events"] },
  { key: "gallery", label: "Gallery", match: ["/gallery"] },
  { key: "blogs", label: "Blog (list and posts)", match: ["/blogs", "/blogs/*", "/blog/*"] },
  { key: "careers", label: "Careers", match: ["/careers", "/careers/*"] },
  { key: "faq", label: "FAQ", match: ["/faq"] },
  { key: "contact", label: "Contact", match: ["/contact"] },
  { key: "enroll", label: "Enroll & Payment", match: ["/enroll", "/payment"] },
  { key: "certificates", label: "Certificate request / download", match: ["/certificate-request", "/request-certificate", "/certificate/*"] },
  { key: "legal", label: "Legal & Policies", match: ["/legal", "/legal/*", "/privacy-policy", "/terms-and-conditions", "/refund-policy", "/accessibility", "/security"] },
  { key: "other", label: "Other pages (custom pages, forms, projects)" },
];

/** The page key for a URL path, e.g. "/blog/my-post" -> "blogs". */
export function marqueePageOf(pathname: string): string {
  const path = (pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  for (const p of MARQUEE_PAGES) {
    for (const m of p.match || []) {
      if (m.endsWith("/*") ? path.startsWith(m.slice(0, -1)) : path === m) return p.key;
    }
  }
  return "other";
}

/** Does a message with these page keys show on this path? */
export function marqueeShowsOn(pages: string[], pathname: string): boolean {
  if (!Array.isArray(pages) || !pages.length) return false;
  return pages.includes("*") || pages.includes(marqueePageOf(pathname));
}
