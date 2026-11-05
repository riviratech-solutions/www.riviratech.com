import { useEffect, useRef, useState } from "react";
import { useLocation, Link, NavLink } from "react-router-dom";
import SiteMarquee from "./SiteMarquee";
import { Facebook, Instagram, Send, Phone, Mail, Loader2, ChevronDown, ArrowUpRight, UserRound, Menu, X, Twitter } from "lucide-react";
import { BrandLogo, RiseTab } from "./RiviraUI";
import axios from "axios";
import NavSearch from "./NavSearch";
import FeedbackBadge from "./FeedbackBadge";
import { findDuplicateSubmission, recordSubmission } from "../utils/formSubmissionLimit";

export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || "/";
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) || "/";
export const UPLOADS_URL = (import.meta.env.VITE_UPLOADS_URL as string | undefined) || "/";
// Absolute origin for og:/twitter:/canonical tags, which must be fully-qualified URLs.
export const SITE_ORIGIN = "https://www.riviratech.com";
// Python AI-chatbot server (FastAPI). Consumed by src/components/WebAIChatbot.tsx.
export const CHATBOT_URL = (import.meta.env.VITE_CHATBOT_URL as string | undefined) || "/";
// Uploaded files are now stored on the Node server's disk and served at
// /uploads/<key> (see admin/server.js). Kept named AWS_UPLOADS so the ~40
// call sites (AWS_UPLOADS + key) don't change.
export const AWS_UPLOADS = UPLOADS_URL + "uploads/";

export const FOOTER_EMAIL = "info@riviratech.com";
export const EMAIL = "info@riviratech.com";
// Contact details as published on riviratech.com
export const PHONE = "+91 72073 01237";
export const PHONE_TEL = "+917207301237";
// Printed on student ID cards only (panel); riviratech.com publishes no address
export const ADDRESS = "11535 Park Woods Circle, Suite B, Alpharetta, GA, 30005 - USA";

export function Head({ pageTitle, pageDesc, pageKeywords }: any) {
  const location = useLocation();

  // Navbar scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const nav = document.querySelector("header.rv-header");
      if (!nav) return;
      if (window.scrollY > 50) {
        nav.classList.add("is-stuck");
      } else {
        nav.classList.remove("is-stuck");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <title>{pageTitle}</title>

      <meta name="description" content={pageDesc} />
      <meta name="keywords" content={pageKeywords} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDesc} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${SITE_ORIGIN}${location.pathname}`} />
      <meta property="og:image" content={`${SITE_ORIGIN}/images/rivira-logo-512.png`} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDesc} />
      <meta name="twitter:image" content={`${SITE_ORIGIN}/images/rivira-logo-512.png`} />

      {/* Canonical */}
      <link rel="canonical" href={`${SITE_ORIGIN}${location.pathname}`} />

      {/* SEO */}
      <meta name="author" content="Rivira Technologies" />
      <meta name="contact" content={FOOTER_EMAIL} />
      <meta
        name="robots"
        content={
          /^\/(signin|dashboard|panel|payment|logout|survey|feedback)(\/|$)/.test(location.pathname)
            ? "noindex, nofollow"
            : "index, follow"
        }
      />

      {/* Favicon */}
      <link rel="icon" type="image/png" href={`${SITE_URL}images/rivira-favicon.png`} />
    </>
  );
}

export function Header() {
  const location = useLocation();
  const [mode, setMode] = useState("");

  // Mobile menu open/closed
  const [menuOpen, setMenuOpen] = useState(false);
  const togglerRef = useRef<HTMLButtonElement>(null);

  function checkpath() {
    if (
      location.pathname.includes("/panel") ||
      location.pathname.includes("/dashboard") ||
      location.pathname.includes("/signin")
    ) {
      setMode("admin");
    } else {
      setMode("user");
    }
  }

  useEffect(() => {
    checkpath();
    setMenuOpen(false);
    setOpenDrop(null);
  }, [location.pathname]);

  function closeNavbar() {
    setMenuOpen(false);
    setOpenDrop(null);
    // After an in-page (SPA) navigation the clicked link keeps DOM focus, and the
    // dropdown's `:focus-within` rule would hold it open until the user clicks away.
    // Dropping focus lets the menu close as soon as you pick an item.
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  // Escape closes the menu and returns focus to the toggle button.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      togglerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const currentPath = (location.pathname || "/").toLowerCase().replace(/\/$/, "") || "/";
  const isAt = (...paths: string[]) => paths.includes(currentPath);

  // Sticky header on scroll
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [openDrop, setOpenDrop] = useState<string | null>(null);

  const menus: { label: string; to?: string; match?: string[]; items?: { label: string; to: string; match: string[] }[] }[] = [
    {
      label: "Explore Courses",
      match: ["/courses", "/ai-for-kids", "/ai-for-coders", "/ai-for-non-coders", "/genai-for-business", "/ai-stack", "/corporate-training"],
      items: [
        { label: "All Courses", to: "/courses", match: ["/courses"] },
        { label: "AI For Kids", to: "/ai-for-kids", match: ["/ai-for-kids"] },
        { label: "AI For Coders", to: "/ai-for-coders", match: ["/ai-for-coders"] },
        { label: "AI For Non-Coders", to: "/ai-for-non-coders", match: ["/ai-for-non-coders"] },
        { label: "GenAI For Business", to: "/genai-for-business", match: ["/genai-for-business"] },
        { label: "AI Stack", to: "/ai-stack", match: ["/ai-stack"] },
        { label: "Corporate Training", to: "/corporate-training", match: ["/corporate-training"] },
      ],
    },
    { label: "Program", to: "/programs", match: ["/programs", "/program"] },
    { label: "Course Plan", to: "/course-plan", match: ["/course-plan"] },
    { label: "Workshop", to: "/workshop", match: ["/workshop", "/workshops"] },
    { label: "Business", to: "/business", match: ["/business", "/poc", "/projects"] },
    { label: "Contact Us", to: "/contact", match: ["/contact", "/contact-us"] },
  ];

  return (
    <>
      {mode === "user" && (
        <header className={`rv-header${stuck ? " is-stuck" : ""}`}>
          <div className="rv-header__bar">
            <span className="rv-shoulder rv-shoulder--hang-l" aria-hidden="true" />
            <div className="rv-header__main">
              <nav className="rv-header__inner" aria-label="Main">
                <Link to="/" aria-label="Rivira Technologies — home" onClick={closeNavbar}>
                  <BrandLogo />
                </Link>

                <div id="menu" className={`rv-header__menu${menuOpen ? " is-open" : ""}`}>
                  <ul className="rv-nav">
                    {menus.map((m) =>
                      m.items ? (
                        <li key={m.label} className={openDrop === m.label ? "is-open" : ""}>
                          <button
                            type="button"
                            className={`rv-nav__link${m.items.some((i) => isAt(...i.match)) ? " is-active" : ""}`}
                            aria-expanded={openDrop === m.label}
                            onClick={() => setOpenDrop((d) => (d === m.label ? null : m.label))}
                          >
                            {m.label} <ChevronDown size={15} className="rv-nav__caret" aria-hidden="true" />
                          </button>
                          <ul className="rv-drop">
                            {m.items.map((i) => (
                              <li key={i.to}>
                                <Link to={i.to} className={isAt(...i.match) ? "is-active" : ""} onClick={closeNavbar}>{i.label}</Link>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ) : (
                        <li key={m.label}>
                          <Link
                            to={m.to!}
                            className={`rv-nav__link${isAt(...m.match!) ? " is-active" : ""}`}
                            aria-current={isAt(...m.match!) ? "page" : undefined}
                            onClick={closeNavbar}
                          >
                            {m.label}
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                  <div className="rv-header__menu-cta">
                    <Link to="/enroll" className="rv-btn" onClick={closeNavbar}>
                      Enroll Now <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                <div className="rv-header__actions">
                  <NavSearch />
                  <Link to="/signin" className="rv-icon-btn" aria-label="Sign in" title="Sign in" onClick={closeNavbar}>
                    <UserRound size={18} aria-hidden="true" />
                  </Link>
                  <Link to="/enroll" className="rv-btn rv-header__cta-desk" onClick={closeNavbar}>
                    Enroll Now <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <button
                    ref={togglerRef}
                    className="rv-burger"
                    type="button"
                    aria-label="Toggle navigation menu"
                    aria-controls="menu"
                    aria-expanded={menuOpen}
                    onClick={() => { setMenuOpen((open) => !open); setOpenDrop(null); }}>
                    {menuOpen ? <X size={26} aria-hidden="true" /> : <Menu size={26} aria-hidden="true" />}
                  </button>
                </div>
              </nav>
            </div>
            <span className="rv-shoulder rv-shoulder--hang-r" aria-hidden="true" />
          </div>
        </header>
      )}
      {mode === "user" && <SiteMarquee placement="header" />}
    </>
  );
}

export function Footer() {
  const location = useLocation();
  const [mode, setMode] = useState("");
  const [nlEmail, setNlEmail] = useState("");
  const [nlDone, setNlDone] = useState(false);
  const [nlBusy, setNlBusy] = useState(false);
  const [nlMsg, setNlMsg] = useState("");

  const getSecurity = async () =>
    (await axios.get(SERVER_URL + "api/security/token", { withCredentials: true })).data;

  // Newsletter subscribe (admin → Newsletter).
  const subscribeNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = nlEmail.trim();
    setNlMsg("");
    if (!/^\S+@\S+\.\S+$/.test(email)) { setNlMsg("Please enter a valid email"); return; }

    if (findDuplicateSubmission("newsletter", email, "")) {
      setNlDone(true); setNlEmail("");
      setNlMsg("You're already subscribed — thank you!");
      return;
    }

    setNlBusy(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/newsletter/subscribe",
        { email, key: security.key, token: security.token, aut: security.aut },
        { withCredentials: true }
      );
      if (res.data.success) {
        setNlDone(true); setNlEmail(""); setNlMsg(res.data.message);
        recordSubmission("newsletter", email, "");
      } else {
        setNlMsg(res.data.message || "Could not subscribe");
      }
    } catch {
      setNlMsg("Server error ❌");
    } finally {
      setNlBusy(false);
    }
  };

  useEffect(() => {
    if (
      location.pathname.includes("/panel") ||
      location.pathname.includes("/dashboard") ||
      location.pathname.includes("/signin")
    ) {
      setMode("admin");
    } else {
      setMode("user");
    }
  }, [location.pathname]);

  return (
    <>
      {mode === "user" && (
        <>
          <SiteMarquee placement="footer" />
          <footer className="rv-footer">
            <div className="rv-footer__body">
              <div className="rv-container rv-footer__grid">
                <div className="rv-footer__intro">
                  <h2 className="rv-h4">Stay Informed. Stay Ahead.</h2>
                  <p>Discover emerging AI breakthroughs, hands-on masterclasses, and enterprise intelligence strategies from Rivira Technologies.</p>
                  <form className="rv-news" onSubmit={subscribeNewsletter}>
                    <input
                      type="email"
                      required
                      aria-label="Email address"
                      value={nlEmail}
                      disabled={nlBusy}
                      onChange={(e) => setNlEmail(e.target.value)}
                      placeholder={nlDone ? "You're subscribed!" : "Email address"}
                    />
                    <button type="submit" className="rv-btn rv-btn--dark" disabled={nlBusy}>
                      {nlBusy ? <Loader2 size={15} className="footer-news-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}
                      Stay Updated
                    </button>
                  </form>
                  {nlMsg && <div className={"rv-news__msg " + (nlDone ? "ok" : "err")} role="status">{nlMsg}</div>}
                  <ul className="rv-footer__contact">
                    <li><Phone size={15} aria-hidden="true" /> Talk to an AI Advisor: <a href={`tel:${PHONE_TEL}`}>{PHONE}</a></li>
                    <li><Mail size={15} aria-hidden="true" /> <a href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
                  </ul>
                  <div className="rv-social">
                    <a aria-label="Facebook" target="_blank" rel="noopener noreferrer" href="https://facebook.com"><Facebook size={16} aria-hidden="true" /></a>
                    <a aria-label="Twitter" target="_blank" rel="noopener noreferrer" href="https://x.com"><Twitter size={16} aria-hidden="true" /></a>
                    <a aria-label="LinkedIn" target="_blank" rel="noopener noreferrer" href="https://linkedin.com"><Send size={16} aria-hidden="true" /></a>
                    <a aria-label="Instagram" target="_blank" rel="noopener noreferrer" href="https://instagram.com"><Instagram size={16} aria-hidden="true" /></a>
                  </div>
                </div>

                <div className="rv-footer__col">
                  <h2>Programs</h2>
                  <ul>
                    <li><NavLink to="/ai-for-kids">AI For Kids</NavLink></li>
                    <li><NavLink to="/ai-for-coders">AI For Coders</NavLink></li>
                    <li><NavLink to="/ai-for-non-coders">AI For Non-Coders</NavLink></li>
                    <li><NavLink to="/genai-for-business">GenAI For Business</NavLink></li>
                    <li><NavLink to="/ai-stack">AI Stack</NavLink></li>
                    <li><NavLink to="/corporate-training">Corporate Training</NavLink></li>
                  </ul>
                </div>

                <div className="rv-footer__col">
                  <h2>Resources</h2>
                  <ul>
                    <li><NavLink to="/course-plan">Course Plan</NavLink></li>
                    <li><NavLink to="/business">Business Solutions</NavLink></li>
                    <li><NavLink to="/blogs">Blog &amp; Insights</NavLink></li>
                    <li><NavLink to="/events">Events</NavLink></li>
                    <li><NavLink to="/gallery">Gallery</NavLink></li>
                    <li><NavLink to="/faq">FAQs</NavLink></li>
                  </ul>
                </div>

                <div className="rv-footer__col">
                  <h2>Company</h2>
                  <ul>
                    <li><NavLink to="/about">About Us</NavLink></li>
                    <li><NavLink to="/services">Services</NavLink></li>
                    <li><NavLink to="/contact">Contact</NavLink></li>
                    <li><NavLink to="/careers">Careers</NavLink></li>
                    <li><NavLink to="/certificate-request">Certificate Request</NavLink></li>
                    <li><NavLink to="/legal">Legal &amp; Policies</NavLink></li>
                  </ul>
                </div>
              </div>

              <RiseTab className="rv-footer__base" bodyClass="rv-footer__base-body">
                <Link to="/" aria-label="Rivira Tech — home"><BrandLogo /></Link>
                <span>
                  © {new Date().getFullYear()} All Rights Reserved – Developed by RIVIRA TECH.{" "}
                  <NavLink to="/legal/terms-and-conditions">Terms</NavLink> ·{" "}
                  <NavLink to="/legal/privacy-policy">Privacy</NavLink>
                </span>
              </RiseTab>
            </div>

            {/* "Share Your Feedback" tab — right edge */}
            <FeedbackBadge />

            <a
              className="whatsapp"
              href={`https://api.whatsapp.com/send/?phone=${encodeURIComponent(PHONE_TEL)}&text&type=phone_number&app_absent=0`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
            >
              <svg
                viewBox="0 0 40 40"
                height="40"
                preserveAspectRatio="xMidYMid meet"
                fill="none"
              >
                <title>wa-square-icon</title>
                <rect
                  width="40"
                  height="40"
                  rx="2"
                  fill="#25D366"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M7.16382 19.8867C7.16666 12.8126 12.9486 7.05882 20.0527 7.05882C23.4986 7.06024 26.7359 8.39611 29.1691 10.8205C31.6023 13.2448 32.9425 16.4695 32.9412 19.897C32.9383 26.9711 27.156 32.7255 20.0526 32.7255C17.9484 32.7248 15.8827 32.2146 14.0352 31.2426L7.58219 32.9272C7.27122 33.0084 6.989 32.7225 7.07425 32.4126L8.79752 26.1482C7.72503 24.2382 7.16292 22.0869 7.16382 19.8867ZM20.0463 30.4359H20.042C18.1611 30.4352 16.3163 29.9322 14.7069 28.9817L14.3241 28.7556L10.3569 29.7914L11.4158 25.9417L11.1666 25.547C10.1173 23.886 9.56313 21.9663 9.56399 19.9951C9.56629 14.2432 14.2686 9.5636 20.0505 9.5636C22.8502 9.56454 25.482 10.6511 27.4612 12.6231C29.4402 14.5949 30.5294 17.216 30.5283 20.0035C30.526 25.7559 25.8237 30.4359 20.0463 30.4359ZM23.5806 21.4974C23.8678 21.6029 25.4084 22.3667 25.7217 22.5247C26.4006 23.0252 26.4006 23.6574 26.1395 24.3951C25.8784 25.1326 24.6265 25.8058 24.0245 25.8964C23.4846 25.9777 22.8015 26.0116 22.0509 25.7713C17.3272 23.8281 15.3422 20.9596 14.9667 20.4169C13.6321 18.6183 13.6321 17.0721 13.6321 15.6177C14.3411 14.8553 15.0161 14.1219 15.5645 14.0429C16.4178 14.0538 16.6455 14.0525 16.87 14.5959L17.8361 16.9405C17.9145 17.0985 17.9667 17.2829 17.8622 17.4937L17.0789 18.5736C16.7587 18.9019 16.9415 19.218 17.7532 20.5681C18.6846 21.4053 19.686 22.3054 20.9974 22.8786C21.5178 23.1307 21.7007 23.1042 22.8756 21.6554C23.0845 21.3395 23.2934 21.3921 23.5806 21.4974Z"
                  fill="white"
                />
              </svg>
            </a>
          </footer>
        </>
      )}
    </>
  );
}
