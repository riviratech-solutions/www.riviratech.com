import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Head, EMAIL, PHONE } from "../../components/Includes";
import {
  Mail, Phone, Scale, ArrowRight, ArrowLeft, Printer,
  ShieldCheck, FileText, RotateCcw, Accessibility, Lock, CalendarDays, Clock, ListOrdered,
  type LucideIcon,
} from "lucide-react";
import { getSeoByPath } from "../../utils/seo";
import { LEGAL_DOCS } from "./legalDocs";

/* Per-document icon and one-line summary for the policy switcher. */
const DOC_META: Record<string, { icon: LucideIcon; blurb: string }> = {
  "privacy-policy": { icon: Lock, blurb: "What we collect and how we use it" },
  "terms-and-conditions": { icon: FileText, blurb: "The rules for our site and programs" },
  "refund-policy": { icon: RotateCcw, blurb: "Cancellations, refunds and transfers" },
  accessibility: { icon: Accessibility, blurb: "Our commitment to an accessible site" },
  security: { icon: ShieldCheck, blurb: "How we protect your information" },
};

/* Sections sit below the fixed site header. Positions are computed (not
   scrollIntoView) because the site CSS makes scrolling smooth and the global
   ScrollToTop also animates to a #hash — two animations ended up short. */
const HEADER_OFFSET = 96;
function scrollToSection(id: string, behavior: ScrollBehavior) {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}

/* "3. How We Use Your Information" -> number "3", label "How We Use…", id "how-we-use-your-information" */
function splitTitle(title: string, i: number) {
  const m = title.match(/^\s*(\d+)\.\s*(.*)$/);
  const label = m ? m[2] : title;
  const num = m ? m[1] : String(i + 1);
  const id = label.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `section-${num}`;
  return { num, label, id };
}

export default function Legal() {
  const { doc: docId } = useParams();
  const idx = LEGAL_DOCS.findIndex((d) => d.id === docId);
  const doc = idx === -1 ? null : LEGAL_DOCS[idx];

  const sections = useMemo(
    () => (doc ? doc.sections.map((s, i) => ({ ...s, ...splitTitle(s.title, i) })) : []),
    [doc],
  );
  const minutes = useMemo(() => {
    const words = doc ? doc.sections.reduce((n, s) => n + s.body.join(" ").split(/\s+/).length, 0) : 0;
    return Math.max(1, Math.round(words / 200));
  }, [doc]);

  const [activeId, setActiveId] = useState("");

  // A new document starts at the top — unless the link points at a section.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const target = hash && document.getElementById(hash);
    setActiveId(hash || sections[0]?.id || "");
    if (!target) {
      window.scrollTo(0, 0);
      return;
    }
    /* Jump now (instant also cancels ScrollToTop's smooth scroll), then once
       more after fonts and the hero settle, unless the reader has scrolled. */
    scrollToSection(hash, "instant");
    let landed = window.scrollY;
    let cancelled = false;
    const settle = () => {
      if (cancelled || Math.abs(window.scrollY - landed) > 4) return;
      scrollToSection(hash, "instant");
      landed = window.scrollY;
    };
    const timer = window.setTimeout(settle, 350);
    document.fonts?.ready.then(() => requestAnimationFrame(settle));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // "On this page": the current section is the last one whose heading has
  // scrolled past the header line (an observer only reports sections that just
  // changed, which made a neighbour win after a jump).
  useEffect(() => {
    if (!sections.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= HEADER_OFFSET + 24) current = s.id;
      }
      // at the very bottom, the last section is the one being read
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1].id;
      }
      setActiveId(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sections]);

  // On narrow screens the policy switcher scrolls sideways — bring the current
  // policy into view (scrollLeft only, so the page itself doesn't jump).
  useEffect(() => {
    const strip = document.querySelector(".lx-docs") as HTMLElement | null;
    const on = strip?.querySelector(".lx-doc.is-active") as HTMLElement | null;
    if (strip && on && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;
    }
  }, [docId]);

  // /legal on its own, or a path that names no document we have.
  if (!doc) return <Navigate to={`/legal/${LEGAL_DOCS[0].id}`} replace />;

  // Per-document metadata, which is why legalDocs keeps each seoMatch.
  const seo = getSeoByPath(doc.seoMatch);
  const prev = idx > 0 ? LEGAL_DOCS[idx - 1] : null;
  const next = idx < LEGAL_DOCS.length - 1 ? LEGAL_DOCS[idx + 1] : null;
  const DocIcon = DOC_META[doc.id]?.icon || Scale;

  const jumpTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToSection(id, "smooth");
    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  return (
    <div className="lgl-page lx-page">
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />

      {/* ── Hero: compact, same dark grid + glow as the rest of the site ── */}
      <section className="lgl-hero lx-hero">
        <div className="lgl-hero-grid" />
        <div className="lgl-hero-glow-left" />
        <div className="lgl-hero-glow-right" />
        <div className="lx-hero-inner">
          <nav className="lx-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span>/</span><span>Legal</span><span>/</span><span aria-current="page">{doc.title}</span>
          </nav>
          <div className="lx-hero-icon"><DocIcon size={26} /></div>
          <h1>{doc.title}</h1>
          <p>{DOC_META[doc.id]?.blurb ? `${DOC_META[doc.id].blurb} — ` : ""}written in plain language by Rivira Technologies.</p>
          <div className="lx-hero-meta">
            <span><CalendarDays size={15} /> Effective {doc.effectiveDate}</span>
            <span><ListOrdered size={15} /> {sections.length} sections</span>
            <span><Clock size={15} /> {minutes} min read</span>
          </div>
        </div>
      </section>

      {/* ── Policy switcher, overlapping the hero ── */}
      <div className="lx-docs-wrap">
        <nav className="lx-docs" aria-label="Policies">
          {LEGAL_DOCS.map((d) => {
            const Icon = DOC_META[d.id]?.icon || Scale;
            const on = d.id === doc.id;
            return (
              <Link key={d.id} to={`/legal/${d.id}`} className={`lx-doc${on ? " is-active" : ""}`} aria-current={on ? "page" : undefined}>
                <span className="lx-doc-icon"><Icon size={18} /></span>
                <span className="lx-doc-text">
                  <b>{d.title}</b>
                  <small>{DOC_META[d.id]?.blurb}</small>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Body ── */}
      <section className="lx-body">
        <div className="lx-grid">

          {/* On this page */}
          <aside className="lx-toc" aria-label="On this page">
            <div className="lx-toc-card">
              <p className="lx-toc-label">On this page</p>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} onClick={jumpTo(s.id)} className={activeId === s.id ? "is-active" : ""}>
                      <span className="lx-toc-num">{s.num}</span>{s.label}
                    </a>
                  </li>
                ))}
              </ol>
              <button type="button" className="lx-print" onClick={() => window.print()}>
                <Printer size={15} /> Print or save as PDF
              </button>
            </div>
          </aside>

          <div className="lx-main">
            <article className="lx-article">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="lx-sec">
                  <h2>
                    <span className="lx-sec-num">{s.num}</span>
                    <span>{s.label}</span>
                    <a href={`#${s.id}`} onClick={jumpTo(s.id)} className="lx-anchor" aria-label={`Link to ${s.label}`}>#</a>
                  </h2>
                  {s.body.map((p, j) => <p key={j}>{p}</p>)}
                </section>
              ))}
            </article>

            {/* Straight line through all five, for anyone reading the lot. */}
            <div className="lx-pager">
              {prev ? (
                <Link to={`/legal/${prev.id}`} className="lx-pager-card">
                  <small><ArrowLeft size={14} /> Previous</small><b>{prev.title}</b>
                </Link>
              ) : <span />}
              {next ? (
                <Link to={`/legal/${next.id}`} className="lx-pager-card is-next">
                  <small>Next <ArrowRight size={14} /></small><b>{next.title}</b>
                </Link>
              ) : <span />}
            </div>

            <div className="lx-contact">
              <div>
                <h3>Questions about this policy?</h3>
                <p>We're happy to help — reach out any time.</p>
              </div>
              <div className="lx-contact-row">
                <a href={`mailto:${EMAIL}`}><Mail size={16} /> {EMAIL}</a>
                <a href={`tel:${PHONE.replace(/[^+\d]/g, "")}`}><Phone size={16} /> {PHONE}</a>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
