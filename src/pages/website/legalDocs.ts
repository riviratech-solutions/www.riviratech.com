export type LegalSection = { title: string; body: string[] };

export type LegalDoc = {
  /** Anchor on /legal, and the legacy route that redirects to it. */
  id: string;
  /** Heading shown for the document. */
  title: string;
  effectiveDate: string;
  /** Key into getSeoByPath(), kept so the legacy metadata stays reachable. */
  seoMatch: string;
  sections: LegalSection[];
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    id: "privacy-policy",
    title: "Privacy Policy",
    effectiveDate: "January 1, 2026",
    seoMatch: "PrivacyPolicy",
    sections: [
    {
      title: "1. Introduction",
      body: [
        "Rivira Technologies (\"we\", \"us\", or \"our\") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains what information we collect, how we use it, and the choices you have.",
      ],
    },
    {
      title: "2. Information We Collect",
      body: [
        "We collect information you provide directly to us, such as your name, email address, phone number, and any details you submit through our enrollment, contact, or workshop registration forms. We may also collect limited technical information automatically—such as your browser type, device, and pages visited—to help us improve our website.",
      ],
    },
    {
      title: "3. How We Use Your Information",
      body: [
        "We use your information to respond to inquiries, process enrollments, deliver our training and consulting services, send program updates and relevant communications, and improve our offerings. We do not sell your personal information to third parties.",
      ],
    },
    {
      title: "4. Communications",
      body: [
        "If you contact us or enroll in a program, we may send you emails related to your request or program. You can opt out of non-essential marketing communications at any time by contacting us or using the unsubscribe option in our emails.",
      ],
    },
    {
      title: "5. Cookies & Analytics",
      body: [
        "Our website may use cookies and similar technologies to remember your preferences and understand how visitors use the site. You can control cookies through your browser settings; disabling them may affect some website functionality.",
      ],
    },
    {
      title: "6. Service Providers We Use",
      body: [
        "We share information only with the service providers that operate our website and deliver our services, strictly for those purposes. As of the effective date these include: Google (Sheets and Apps Script, which store form submissions and send our notification emails via Gmail); Supabase (account sign-in and authentication, hosted in the United States); Stripe (payment processing — your full card details are entered on Stripe and are never stored on our servers); Skool (our learning community); Cloudflare (content delivery and bot protection via Turnstile); and our hosting provider (Hostinger) for the website server. Each provider processes your information only to provide its service to us. We may also disclose information where required by law.",
        "This list reflects our current setup and may change as our services evolve.",
      ],
    },
    {
      title: "7. Data Security",
      body: [
        "We take reasonable technical and organizational measures to protect your personal information against unauthorized access, loss, or misuse. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
      ],
    },
    {
      title: "8. Your Rights",
      body: [
        "Depending on your location, you may have the right to access, correct, or delete the personal information we hold about you, or to object to certain processing. To exercise these rights, please contact us using the details below.",
      ],
    },
    {
      title: "9. Children's Privacy",
      body: [
        "For our programs designed for children (such as AI for Kids), we collect information from a parent or guardian during enrollment. We do not knowingly collect personal information directly from children without appropriate parental consent.",
      ],
    },
    {
      title: "10. Changes to This Policy",
      body: [
        "We may update this Privacy Policy periodically. The current version will always be posted on this page with an updated effective date.",
      ],
    },
    {
      title: "11. Contact Us",
      body: [
        "If you have questions about this Privacy Policy or how we handle your data, please reach out:",
      ],
    },
  ],
  },
  {
    id: "terms-and-conditions",
    title: "Terms & Conditions",
    effectiveDate: "January 1, 2026",
    seoMatch: "TermsConditions",
    sections: [
    {
      title: "1. Acceptance of Terms",
      body: [
        "By accessing or using the Rivira Technologies website, enrolling in any of our training programs, or using our services, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our website or services.",
      ],
    },
    {
      title: "2. Services",
      body: [
        "Rivira Technologies provides AI education, training programs, workshops, corporate training, and proof-of-concept (POC) development services. Course content, schedules, pricing, and availability may change at our discretion. We will make reasonable efforts to notify enrolled participants of material changes that affect their program.",
      ],
    },
    {
      title: "3. Enrollment & Payment",
      body: [
        "Enrollment in a course or program is confirmed once payment (or an agreed payment arrangement) is received. Fees are quoted in the currency indicated at checkout and are exclusive of any applicable taxes unless stated otherwise. You are responsible for providing accurate billing and contact information.",
      ],
    },
    {
      title: "4. Refunds & Cancellations",
      body: [
        "Refund eligibility depends on the specific program and the timing of your request. Unless a separate written agreement states otherwise, requests made before a program begins may be eligible for a refund, while requests made after a program has started may be pro-rated or declined. To request a refund or cancellation, contact us using the details below.",
      ],
    },
    {
      title: "5. Intellectual Property",
      body: [
        "All course materials, curricula, videos, code samples, slides, and other content provided by Rivira Technologies are the intellectual property of Rivira Technologies or its licensors. You are granted a limited, non-transferable license to use these materials for your own learning. You may not reproduce, redistribute, resell, or publicly share course materials without prior written permission.",
      ],
    },
    {
      title: "6. Acceptable Use",
      body: [
        "You agree to use our website and services lawfully and respectfully. You must not attempt to disrupt our services, gain unauthorized access to our systems, harass other participants or staff, or use our materials to build competing training offerings.",
      ],
    },
    {
      title: "7. Limitation of Liability",
      body: [
        "Our training and consulting services are provided on an \"as is\" and \"as available\" basis. While we strive for high-quality outcomes, we do not guarantee specific career, business, or financial results. To the maximum extent permitted by law, Rivira Technologies shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or services.",
      ],
    },
    {
      title: "8. Third-Party Tools & Links",
      body: [
        "Our programs may reference or integrate third-party tools, platforms, and services. We are not responsible for the content, availability, or practices of any third-party services, and your use of them is governed by their respective terms.",
      ],
    },
    {
      title: "9. Changes to These Terms",
      body: [
        "We may update these Terms and Conditions from time to time. The most current version will always be posted on this page with an updated effective date. Your continued use of our website or services after changes are posted constitutes acceptance of the revised terms.",
      ],
    },
    {
      title: "10. Contact Us",
      body: [
        "If you have any questions about these Terms and Conditions, please reach out to us:",
      ],
    },
  ],
  },
  {
    id: "refund-policy",
    title: "Refund & Cancellation Policy",
    effectiveDate: "January 1, 2026",
    seoMatch: "RefundPolicy",
    sections: [
    {
      title: "1. Overview",
      body: [
        "This Refund & Cancellation Policy explains how refunds and cancellations work for our paid programs. It is written to be fair and clear; specific programs may have additional written terms, which take precedence where they conflict with this page.",
      ],
    },
    {
      title: "2. Before a Program Begins",
      body: [
        "If you cancel before your cohort or program start date, you may request a refund of amounts paid. Contact us as early as possible so we can process your request promptly.",
      ],
    },
    {
      title: "3. After a Program Begins",
      body: [
        "Once a program has started, refunds may be pro-rated or declined depending on how much of the program has been delivered and any non-recoverable costs already incurred. We review these requests individually and in good faith.",
      ],
    },
    {
      title: "4. Add-Ons",
      body: [
        "Optional add-ons (such as the Training + Placement Support Bundle) may have their own refund conditions because work on them can begin immediately. We will tell you the applicable terms when you request a refund for an add-on.",
      ],
    },
    {
      title: "5. Transfers",
      body: [
        "In some cases you may transfer your enrollment to a later cohort instead of requesting a refund. Contact us to discuss availability.",
      ],
    },
    {
      title: "6. How Refunds Are Issued",
      body: [
        "Approved refunds are returned to the original payment method through our payment processor, Stripe. The time for the funds to appear depends on your bank or card issuer.",
      ],
    },
    {
      title: "7. How to Request a Refund or Cancellation",
      body: [
        "To request a refund, cancellation, or transfer, contact us using the details below with your name, the email you enrolled with, and the program name. We will confirm receipt and let you know the next steps.",
      ],
    },
  ],
  },
  {
    id: "accessibility",
    title: "Accessibility Statement",
    effectiveDate: "January 1, 2026",
    seoMatch: "Accessibility",
    sections: [
    {
      title: "1. Our Commitment",
      body: [
        "Rivira Technologies wants our website and programs to be usable by as many people as possible, including people who use assistive technologies. We are working to improve accessibility over time and welcome feedback that helps us do better.",
      ],
    },
    {
      title: "2. What We Aim For",
      body: [
        "We aim to follow widely recognized accessibility best practices, using the Web Content Accessibility Guidelines (WCAG) 2.1 as a reference. This is a goal we are actively working toward; we do not claim full conformance at this time.",
      ],
    },
    {
      title: "3. Known Limitations",
      body: [
        "We are aware that some areas of the site can be improved — for example, labels on certain interactive controls, color-contrast in places, and consistent heading structure. We are addressing these as part of ongoing improvements.",
      ],
    },
    {
      title: "4. Requesting Help or an Accommodation",
      body: [
        "If you have trouble accessing any part of our website or programs, or you need information in a different format, please contact us using the details below and we will do our best to help.",
      ],
    },
  ],
  },
  {
    id: "security",
    title: "Security Overview",
    effectiveDate: "January 1, 2026",
    seoMatch: "SecurityOverview",
    sections: [
    {
      title: "1. Purpose",
      body: [
        "This overview describes, in plain language, how we protect the information you share with us. It reflects our current setup and is provided for transparency; it is not a compliance certification.",
      ],
    },
    {
      title: "2. Data in Transit",
      body: [
        "Our website is served over HTTPS, so traffic between your browser and our site is encrypted. We use Cloudflare in front of the site for content delivery and to help protect against automated abuse.",
      ],
    },
    {
      title: "3. Accounts & Authentication",
      body: [
        "Accounts are handled by Supabase. Access to paid program materials is controlled on the server using server-side account attributes that the browser cannot modify, so a user cannot grant themselves paid access.",
      ],
    },
    {
      title: "4. Payments",
      body: [
        "Payments are processed by Stripe. Your full card details are entered directly with Stripe and are never stored on our servers. Access is granted only after Stripe confirms a completed payment, and access is revoked automatically on a full refund or dispute.",
      ],
    },
    {
      title: "5. Form Submissions",
      body: [
        "Contact, workshop, and enrollment forms are stored in a Google Sheet via Google Apps Script, which also sends our notification emails. Submitted content is sanitized before it is recorded, and submissions are rate-limited to prevent abuse.",
      ],
    },
    {
      title: "6. Infrastructure",
      body: [
        "The website runs on a dedicated server (Hostinger) with access restricted to key-based administrator login only. We keep the platform and dependencies updated and monitor for known vulnerabilities in the software we use.",
      ],
    },
    {
      title: "7. Reporting a Security Concern",
      body: [
        "If you believe you have found a security issue, please contact us using the details below so we can investigate and respond. We appreciate responsible disclosure and will work with you in good faith.",
      ],
    },
  ],
  },
];

/** Latest effective date across every document, for the page header. */
export const LEGAL_EFFECTIVE_DATE = LEGAL_DOCS[0].effectiveDate;
