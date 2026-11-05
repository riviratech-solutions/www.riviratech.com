import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Minus, Plus } from "lucide-react";
import { Head } from "../Includes";
import { anim, useRiviraReveal } from "../../utils/riviraReveal";

/* Building blocks for every public page, in the same design language as the
   home page (styles: public/css/rivira-design.css, "PAGE KIT"). A page is a
   <SitePage> holding a <PageHero> and a run of <Section>s. */

type Icon = ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" }>;

export type Action = { label: string; to?: string; href?: string; onClick?: () => void; ghost?: boolean };

/** A button or link: internal route (to), external / anchor (href) or a click handler. */
export function ActionButton({ a, light = false, small = false }: { a: Action; light?: boolean; small?: boolean }) {
  const cls = ["rv-btn", small && "rv-btn--sm", a.ghost && (light ? "rv-btn--ghost-light" : "rv-btn--ghost")].filter(Boolean).join(" ");
  const inner = (
    <>
      {a.label}
      {!a.ghost && <ArrowRight size={small ? 13 : 15} aria-hidden="true" />}
    </>
  );
  if (a.onClick) return <button type="button" className={cls} onClick={a.onClick}>{inner}</button>;
  if (a.to) return <Link to={a.to} className={cls}>{inner}</Link>;
  const external = a.href?.startsWith("http");
  return <a href={a.href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{inner}</a>;
}

export function Actions({ items, light = false, center = false }: { items?: Action[]; light?: boolean; center?: boolean }) {
  if (!items?.length) return null;
  return (
    <div className="rv-btn-row" style={center ? { justifyContent: "center" } : undefined}>
      {items.map((a) => <ActionButton key={a.label} a={a} light={light} />)}
    </div>
  );
}

/** Page shell: SEO head, scroll-reveal root and the light page background. */
export function SitePage({ title, desc, keywords, children }: { title: string; desc: string; keywords?: string; children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  useRiviraReveal(rootRef);
  useEffect(() => {
    document.body.classList.add("rt-home");
    return () => document.body.classList.remove("rt-home");
  }, []);
  // data-reveal: utils/autoReveal.ts leaves these pages to the Rivira animations
  return (
    <main className="rv-page" ref={rootRef} data-reveal="rivira">
      <Head pageTitle={title} pageDesc={desc} pageKeywords={keywords} />
      {children}
    </main>
  );
}

export type Fact = { icon: Icon; label: string };

/** Inner-page hero: copy on the left, artwork on the right, quick facts on a curved tab. */
export function PageHero({ eyebrow, title, accent, text, actions, image, imageAlt = "", facts, crumb, children }: {
  eyebrow?: string; title: string; accent?: string; text?: ReactNode; actions?: Action[];
  image?: string; imageAlt?: string; facts?: Fact[]; crumb?: string; children?: ReactNode;
}) {
  return (
    <section className="rv-phero">
      <div className="rv-container rv-phero__grid">
        <div className="rv-phero__copy" {...anim("fadeInUp", 100)}>
          {crumb && (
            <nav className="rv-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{crumb}</span>
            </nav>
          )}
          {eyebrow && <span className="rv-eyebrow rv-eyebrow--cyan">{eyebrow}</span>}
          <h1 className="rv-phero__title">
            {title}{accent && <> <span className="rv-phero__accent">{accent}</span></>}
          </h1>
          {text && <p className="rv-phero__text">{text}</p>}
          <Actions items={actions} light />
          {children}
          {facts?.length ? (
            <ul className="rx-feats">
              {facts.map((f) => <li key={f.label}><f.icon size={20} aria-hidden="true" /> {f.label}</li>)}
            </ul>
          ) : null}
        </div>
        {image && (
          <div className="rv-phero__media" {...anim("zoomIn", 250)}>
            <img src={image} alt={imageAlt} width={1200} height={675} />
          </div>
        )}
      </div>
    </section>
  );
}

/** A page band. tone: page (light grey), white, dark (navy) or grad (charcoal gradient). */
export function Section({ id, tone = "page", tight = false, children }: {
  id?: string; tone?: "page" | "white" | "dark" | "grad"; tight?: boolean; children: ReactNode;
}) {
  const cls = ["rv-section", tone === "white" && "rv-section--white", tone === "dark" && "rv-section--dark", tone === "grad" && "rv-why", tight && "rv-section--tight"]
    .filter(Boolean).join(" ");
  return <section id={id} className={cls}><div className="rv-container">{children}</div></section>;
}

/** Section heading: eyebrow, title, intro; centered or split (title left, text + actions right). */
export function SectionHead({ eyebrow, title, text, light = false, split = false, actions }: {
  eyebrow?: string; title: ReactNode; text?: ReactNode; light?: boolean; split?: boolean; actions?: Action[];
}) {
  if (split) {
    return (
      <div className="rv-split-head" {...anim("fadeInUp")}>
        <div>
          {eyebrow && <span className={`rv-eyebrow${light ? " rv-eyebrow--cyan" : ""}`}>{eyebrow}</span>}
          <h2 className={`rv-h2${light ? " rv-light" : ""}`}>{title}</h2>
        </div>
        <div className="rv-split-head__side">
          {text && <p className={`rv-text${light ? " rv-on-dark" : ""}`}>{text}</p>}
          {actions && <div style={{ marginTop: 20 }}><Actions items={actions} light={light} /></div>}
        </div>
      </div>
    );
  }
  return (
    <div className="rv-shead" {...anim("fadeInUp")}>
      {eyebrow && <span className={`rv-eyebrow${light ? " rv-eyebrow--cyan" : ""}`}>{eyebrow}</span>}
      <h2 className={`rv-h2${light ? " rv-light" : ""}`}>{title}</h2>
      {text && <p className={`rv-text${light ? " rv-on-dark" : ""}`}>{text}</p>}
      {actions && <div style={{ marginTop: 22 }}><Actions items={actions} light={light} center /></div>}
    </div>
  );
}

export type CardItem = { icon?: Icon; title: string; text?: ReactNode; meta?: string; list?: string[]; chips?: string[]; to?: string; href?: string; linkLabel?: string };

/** Grid of icon cards. */
export function CardGrid({ items, cols = 3, dark = false }: { items: CardItem[]; cols?: 2 | 3 | 4 | 5; dark?: boolean }) {
  return (
    <div className={`rv-icards rv-icards--${cols}`}>
      {items.map((c, i) => (
        <article key={c.title} className={`rv-icard rv-lift${dark ? " rv-icard--dark" : ""}`} {...anim("fadeInUp", (i % cols) * 90)}>
          {c.icon && <span className="rv-icard__icon"><c.icon size={24} aria-hidden="true" /></span>}
          {c.meta && <span className="rv-icard__meta">{c.meta}</span>}
          <h3 className="rv-h5">{c.title}</h3>
          {c.text && <p>{c.text}</p>}
          {c.list && <Checklist items={c.list} />}
          {c.chips && <div className="rv-chips">{c.chips.map((t) => <span key={t} className="rv-chip">{t}</span>)}</div>}
          {c.to && (
            <Link to={c.to} className="rv-icard__link">
              {c.linkLabel || "Learn more"} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
          {c.href && (
            <a href={c.href} className="rv-icard__link" {...(c.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {c.linkLabel || "Open"} <ArrowRight size={14} aria-hidden="true" />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}

export type ImageCardItem = { image: string; title: string; text?: ReactNode; meta?: string; to?: string; list?: string[] };

/** Image cards with the curved title tab (home "services" style). */
export function ImageCards({ items, cols = 3 }: { items: ImageCardItem[]; cols?: 2 | 3 }) {
  return (
    <div className={`rv-services${cols === 2 ? " rv-services--2" : ""}`}>
      {items.map((c, i) => (
        <article key={c.title} className="rv-scard rv-lift" {...anim("fadeInUp", (i % cols) * 90)}>
          <div className="rv-scard__media">
            <img src={c.image} alt="" loading="lazy" />
            <div className="rv-scard__tab">
              <span className="rv-shoulder rv-shoulder--rise-l" aria-hidden="true" />
              <div className="rv-scard__tab-body">{c.title}</div>
              <span className="rv-shoulder rv-shoulder--rise-r" aria-hidden="true" />
            </div>
          </div>
          {c.meta && <span className="rv-icard__meta" style={{ marginTop: 16 }}>{c.meta}</span>}
          {c.text && <p>{c.text}</p>}
          {c.list && <div style={{ textAlign: "left", padding: "0 8px" }}><Checklist items={c.list} /></div>}
          {c.to && <div style={{ marginTop: 18 }}><ActionButton a={{ label: "Learn more", to: c.to }} small /></div>}
        </article>
      ))}
    </div>
  );
}

export function Checklist({ items, light = false }: { items: ReactNode[]; light?: boolean }) {
  return (
    <ul className={`rv-checks${light ? " rv-checks--light" : ""}`}>
      {items.map((t, i) => (
        <li key={typeof t === "string" ? t : i}><Check size={15} aria-hidden="true" /> <span>{t}</span></li>
      ))}
    </ul>
  );
}

/** Image beside text: eyebrow, title, copy, bullets, actions. */
export function Split({ image, imageAlt = "", eyebrow, title, text, bullets, actions, reverse = false, badge, children }: {
  image: string; imageAlt?: string; eyebrow?: string; title: ReactNode; text?: ReactNode; bullets?: ReactNode[];
  actions?: Action[]; reverse?: boolean; badge?: { value: string; label: string }; children?: ReactNode;
}) {
  return (
    <div className={`rv-split${reverse ? " rv-split--reverse" : ""}`}>
      <div className="rv-split__media" {...anim(reverse ? "fadeInRight" : "fadeInLeft", 100)}>
        <img src={image} alt={imageAlt} loading="lazy" />
        {badge && (
          <div className="rv-split__badge">
            <strong>{badge.value}</strong>
            <span>{badge.label}</span>
          </div>
        )}
      </div>
      <div className="rv-split__copy" {...anim(reverse ? "fadeInLeft" : "fadeInRight", 200)}>
        {eyebrow && <span className="rv-eyebrow">{eyebrow}</span>}
        <h2 className="rv-h2">{title}</h2>
        {text && <div className="rv-text rv-split__text">{text}</div>}
        {bullets && <Checklist items={bullets} />}
        {children}
        {actions && <div style={{ marginTop: 26 }}><Actions items={actions} /></div>}
      </div>
    </div>
  );
}

/** Numbered process steps joined by a line. */
export function Steps({ items, light = false }: { items: { title: string; text?: ReactNode; icon?: Icon }[]; light?: boolean }) {
  return (
    <ol className={`rv-steps rv-steps--${Math.min(items.length, 5)}${light ? " rv-steps--light" : ""}`}>
      {items.map((s, i) => (
        <li key={s.title} className="rv-step" {...anim("fadeInUp", i * 100)}>
          <span className="rv-step__num">{s.icon ? <s.icon size={22} aria-hidden="true" /> : String(i + 1).padStart(2, "0")}</span>
          <h3 className="rv-h5">{s.title}</h3>
          {s.text && <p>{s.text}</p>}
        </li>
      ))}
    </ol>
  );
}

export type Module = { title: string; summary?: ReactNode; topics?: string[]; meta?: string };

/** Curriculum accordion: numbered modules that open to show their topics. */
export function Curriculum({ modules, initiallyOpen = 0, limit }: { modules: Module[]; initiallyOpen?: number | null; limit?: number }) {
  const [open, setOpen] = useState<number | null>(initiallyOpen);
  const [all, setAll] = useState(!limit || modules.length <= limit);
  const shown = all ? modules : modules.slice(0, limit);
  return (
    <div className="rv-curr">
      {shown.map((m, i) => {
        const isOpen = open === i;
        return (
          <div key={m.title} className={`rv-curr__item${isOpen ? " is-open" : ""}`} {...anim("fadeInUp", Math.min(i, 4) * 60)}>
            <button type="button" className="rv-curr__btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
              <span className="rv-curr__num">{String(i + 1).padStart(2, "0")}</span>
              <span className="rv-curr__title">
                {m.title}
                {m.meta && <small>{m.meta}</small>}
              </span>
              <span className="rv-curr__toggle">{isOpen ? <Minus size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}</span>
            </button>
            <div className="rv-acc__panel">
              <div>
                <div className="rv-curr__body">
                  {m.summary && <p>{m.summary}</p>}
                  {m.topics?.length ? <Checklist items={m.topics} /> : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {!all && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button type="button" className="rv-btn rv-btn--ghost" onClick={() => setAll(true)}>
            Show all {modules.length} modules
          </button>
        </div>
      )}
    </div>
  );
}

/** Groups of chips, e.g. tools by category. */
export function ChipGroups({ groups, light = false }: { groups: { title: string; items: string[]; icon?: Icon }[]; light?: boolean }) {
  return (
    <div className={`rv-chipgroups${light ? " rv-chipgroups--light" : ""}`}>
      {groups.map((g, i) => (
        <div key={g.title} className="rv-chipgroup" {...anim("fadeInUp", (i % 3) * 90)}>
          <h3 className="rv-h5">{g.icon && <g.icon size={20} aria-hidden="true" />} {g.title}</h3>
          <div className="rv-chips">
            {g.items.map((t) => <span key={t} className="rv-chip">{t}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Simple row of chips. */
export function Chips({ items, center = false }: { items: string[]; center?: boolean }) {
  return (
    <div className="rv-chips" style={center ? { justifyContent: "center" } : undefined} {...anim("fadeIn", 100)}>
      {items.map((t) => <span key={t} className="rv-chip">{t}</span>)}
    </div>
  );
}

/** Row of big numbers. */
export function StatRow({ stats, light = false }: { stats: { value: string; label: string }[]; light?: boolean }) {
  return (
    <div className={`rv-statrow${light ? " rv-statrow--light" : ""}`}>
      {stats.map((s, i) => (
        <div key={s.label} className="rv-statrow__item" {...anim("fadeInUp", i * 80)}>
          <strong>{s.value}</strong>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Photo band with a glass box, as on the home page. */
export function CtaBand({ eyebrow, title, text, actions, image = "/images/corporate-training-card.webp" }: {
  eyebrow?: string; title: string; text?: ReactNode; actions?: Action[]; image?: string;
}) {
  return (
    <div className="rv-cta">
      <div className="rv-cta__bg" style={{ backgroundImage: `url(${image})` }} aria-hidden="true" />
      <div className="rv-container">
        <div className="rv-cta__box" {...anim("fadeInLeft")}>
          {eyebrow && <span className="rv-eyebrow rv-eyebrow--cyan">{eyebrow}</span>}
          <h2 className="rv-h2 rv-light">{title}</h2>
          {text && <p>{text}</p>}
          <Actions items={actions} light />
        </div>
      </div>
    </div>
  );
}

/** Two-column FAQ accordion (home page style). */
export function FaqBlock({ items, eyebrow = "Common Questions", title = "Everything you need to know", children }: {
  items: { q: string; a: ReactNode }[]; eyebrow?: string; title?: string; children?: ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const half = Math.ceil(items.length / 2);
  const cols = [items.slice(0, half), items.slice(half)];
  return (
    <>
      <div className="rv-faq__head" {...anim("fadeInUp")}>
        <span className="rv-eyebrow">{eyebrow}</span>
        <h2 className="rv-h2">{title}</h2>
      </div>
      <div className="rv-faq">
        {cols.map((col, ci) => (
          <div key={ci} className="rv-faq__col">
            {col.map((item, j) => {
              const idx = ci * half + j;
              const isOpen = open === idx;
              return (
                <div key={item.q} className={`rv-acc${isOpen ? " is-open" : ""}`}>
                  <button type="button" className="rv-acc__btn" onClick={() => setOpen(isOpen ? null : idx)} aria-expanded={isOpen}>
                    {item.q}
                    {isOpen ? <Minus size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  </button>
                  <div className="rv-acc__panel"><div><p>{item.a}</p></div></div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {children}
    </>
  );
}

/** Gradient banner closing a page (dark charcoal with logo-blue glow). */
export function EndBanner({ eyebrow, title, text, actions }: { eyebrow?: string; title: string; text?: ReactNode; actions?: Action[] }) {
  return (
    <section className="rv-section" style={{ paddingTop: 0 }}>
      <div className="rv-container">
        <div className="rv-endbanner" {...anim("zoomIn")}>
          {eyebrow && <span className="rv-eyebrow rv-eyebrow--cyan">{eyebrow}</span>}
          <h2 className="rv-h2 rv-light">{title}</h2>
          {text && <p>{text}</p>}
          <Actions items={actions} light center />
        </div>
      </div>
    </section>
  );
}
