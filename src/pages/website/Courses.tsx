import { useState } from "react";
import { Head } from "../../components/Includes";
import { getSeoByPath } from "../../utils/seo";
import { matchesQuery } from "../../utils/searchText";
import { Link } from "react-router-dom";
import {
  Gamepad2, Code2, Wand2, TrendingUp, Layers, Building2,
  type LucideIcon,
} from "lucide-react";
import { PageHero } from "../../components/site/PageKit";

const seo = getSeoByPath("courses");

type LevelId = "beginner" | "intermediate" | "advanced";
type AudienceId = "students" | "developers" | "data" | "working" | "managers" | "leaders";

const LEVELS: { id: LevelId; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

interface Accent { fg: string; bg: string; border: string; tileTo: string }

const COURSE_ACCENT: Record<string, Accent> = {
  aiforkids:          { fg: "#7A5403", bg: "#FDF5E9", border: "#E9D4B5", tileTo: "#F8EBD7" },
  aiforcoders:        { fg: "#445993", bg: "#F0F6FF", border: "#CAD7F8", tileTo: "#E4EDFF" },
  aifornoncoders:     { fg: "#006D6D", bg: "#E9FAF9", border: "#B4E2E1", tileTo: "#D7F4F3" },
  genaiforbusiness:   { fg: "#8B4538", bg: "#FFF2EE", border: "#F6CDC4", tileTo: "#FFE6E0" },
  aiagentsautomation: { fg: "#00658A", bg: "#EAF8FF", border: "#B9DEF2", tileTo: "#DAF1FE" },
  corporatetraining:  { fg: "#306B3B", bg: "#EEF9EF", border: "#C3E1C6", tileTo: "#E0F3E2" },
};

/* Fallback rather than `!`: a course added without an accent gets the brand
   gold and a readable card, not a crash on `undefined.fg`. */
const FALLBACK_ACCENT: Accent = COURSE_ACCENT.aiforkids;
const accentFor = (category: string): Accent => COURSE_ACCENT[category] ?? FALLBACK_ACCENT;

const AUDIENCES: { id: AudienceId; label: string; short: string }[] = [
  { id: "students", label: "Students / Fresh Graduates", short: "Students" },
  { id: "developers", label: "Developers", short: "Developers" },
  { id: "data", label: "Data Professionals", short: "Data pros" },
  { id: "working", label: "Working Professionals", short: "Working pros" },
  { id: "managers", label: "Business Managers", short: "Managers" },
  { id: "leaders", label: "Leaders / Decision-Makers", short: "Leaders" },
];

/** The level a course STARTS at — what "Easiest first" orders on. */
function entryLevel(levels: LevelId[]): LevelId {
  const order = LEVELS.map(l => l.id);
  return levels.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
}

function levelText(levels: LevelId[]): string {
  const order = LEVELS.map(l => l.id);
  const idx = levels.map(l => order.indexOf(l)).sort((a, b) => a - b);
  const contiguous = idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
  const name = (i: number) => LEVELS[i].label;
  if (idx.length === 1) return name(idx[0]);
  if (contiguous) return `${name(idx[0])} → ${name(idx[idx.length - 1])}`;
  return idx.map(name).join(" · ");
}

interface Course {
  category: string;
  badge: string;
  title: string;
  desc: string;
  link: string;
  icon: LucideIcon;
  levels: LevelId[];
  audiences: AudienceId[];
}

const COURSES: Course[] = [
  {
    category: "aiforkids",
    badge: "AI For Kids",
    title: "Unlock the Future with Artificial Intelligence",
    desc: "Empowering the next generation with AI skills through fun, interactive, project-based learning. No prior experience needed!",
    link: "/ai-for-kids",
    icon: Gamepad2,
    /* "No prior experience needed!" and "built for beginners" -- AIForKids.tsx.
       School students, which is the only place "Students" applies literally. */
    levels: ["beginner"],
    audiences: ["students"],
  },
  {
    category: "aiforcoders",
    badge: "AI For Coders",
    title: "Master AI & Generative AI Development",
    desc: "From Python fundamentals to deploying production-ready AI agents, RAG systems, and cloud-based solutions.",
    link: "/ai-for-coders",
    icon: Code2,
    levels: ["beginner", "intermediate", "advanced"],
    audiences: ["students", "developers", "data"],
  },
  {
    category: "aifornoncoders",
    badge: "AI For Non Coders",
    title: "AI for Business & Non-Technical Professionals",
    desc: "Harness the power of AI without writing code. Leverage no-code AI tools for business decisions, marketing automation, and intelligent workflows.",
    link: "/ai-for-non-coders",
    icon: Wand2,
    levels: ["beginner"],
    audiences: ["working", "managers"],
  },
  {
    category: "genaiforbusiness",
    badge: "GenAI For Business",
    title: "Identify and Implement AI Opportunities in Your Organization",
    desc: "Apply generative AI to real business challenges. Automate workflows, enhance marketing, improve customer service, and make data-driven decisions.",
    link: "/genai-for-business",
    icon: TrendingUp,
    levels: ["beginner"],
    audiences: ["working", "managers", "leaders"],
  },
  {
    category: "aiagentsautomation",
    badge: "AI Stack",
    title: "The Complete Enterprise AI Stack",
    desc: "Agents, Agentic AI, LLMs, RAG, MCP and AI Automation — the full enterprise stack, taught with live implementation, real industry use cases and production deployment.",
    link: "/ai-stack",
    icon: Layers,
    levels: ["intermediate", "advanced"],
    audiences: ["developers", "data"],
  },
  {
    category: "corporatetraining",
    badge: "Corporate Training",
    title: "AI Training for Your Enterprise",
    desc: "Customized AI training programs for teams of all sizes. Upskill your workforce with hands-on, industry-relevant AI education.",
    link: "/corporate-training",
    icon: Building2,
    levels: ["beginner", "intermediate", "advanced"],
    audiences: ["developers", "data", "working", "managers"],
  },
];

/* {id, label} rather than {category, badge}, so it is the same shape as LEVELS
   and AUDIENCES and all three groups can go through one FilterGroup. */
const FILTER_LABELS = COURSES.map(c => ({ id: c.category, label: c.badge }));

/** aria-controls target for the phone Filters toggle. */
const FILTER_PANEL_ID = "courses-filter-panel";

function FilterGroup<T extends string>({
  title,
  options,
  selected,
  onToggle,
  count,
}: {
  title: string;
  options: { id: T; label: string }[];
  selected: T[];
  onToggle: (id: T) => void;
  count?: (id: T) => number;
}) {
  return (
    <fieldset style={{ border: 0, margin: "0 0 18px", padding: 0, minWidth: 0 }}>
      <legend style={{
        fontSize: 12, fontWeight: 700,
        color: "#0B1220", marginBottom: 10, padding: 0,
        fontFamily: "var(--font-display)",
      }}>{title}</legend>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {options.map(({ id, label }) => {
          const on = selected.includes(id);
          return (
            <label
              key={id}
              className={`courses-filter-row${on ? " is-on" : ""}`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(id)}
                className="courses-filter-box"
              />
              <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
              {count && <span className="courses-filter-n">{count(id)}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Courses() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("curated");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedLevels, setSelectedLevels] = useState<LevelId[]>([]);
  const [selectedAudiences, setSelectedAudiences] = useState<AudienceId[]>([]);

  /* One toggle for all three groups. Typed on the setter rather than on a
     loose string[], so a level id cannot be pushed into the audience list. */
  function toggle<T extends string>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    value: T,
  ) {
    setter(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]));
  }

  const handleCategoryChange = (category: string) => toggle(setSelectedCategories, category);

  // Split out so the sidebar can count what each filter would yield from the
  // current search, without the category selection folded in.
  // Every word must appear in the title, description or badge; each also
  // matches its other names — "Artificial Intelligence" finds "AI" … (utils/searchText.ts)
  const searchMatches = COURSES.filter(course =>
    matchesQuery(searchQuery, [course.title, course.desc, course.badge])
  );

  const matchesCategory = (c: Course) =>
    selectedCategories.length === 0 || selectedCategories.includes(c.category);
  const matchesLevel = (c: Course) =>
    selectedLevels.length === 0 || c.levels.some(l => selectedLevels.includes(l));
  const matchesAudience = (c: Course) =>
    selectedAudiences.length === 0 || c.audiences.some(a => selectedAudiences.includes(a));

  const totalSelected =
    selectedCategories.length + selectedLevels.length + selectedAudiences.length;

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedLevels([]);
    setSelectedAudiences([]);
  };

  const ORDER = LEVELS.map(l => l.id);
  const filteredCourses = searchMatches
    .filter(course => matchesCategory(course) && matchesLevel(course) && matchesAudience(course))
    .sort((a, b) => {
      if (sortBy === "az") return a.title.localeCompare(b.title);
      if (sortBy === "level") {
        const entry = (c: Course) => ORDER.indexOf(entryLevel(c.levels));
        const reach = (c: Course) => Math.max(...c.levels.map(l => ORDER.indexOf(l)));
        return entry(a) - entry(b) || reach(a) - reach(b);
      }
      return 0;
    });

  return (
    <>
      <Head
        pageTitle={seo?.title || "Explore AI Training Courses | Rivira Technologies"}
        pageDesc={seo?.description || "Browse our practical, guided AI courses and curriculum programs."}
        pageKeywords={seo?.keywords || "AI courses, prompt engineering, machine learning"}
      />


      {/* ── Hero — same as the Business page (enroll-hero inside .enroll-page.biz-page) ── */}
      <div className="enroll-page biz-page">
        <PageHero
          crumb="Courses"
          eyebrow="All programs"
          title="Explore"
          accent="AI courses"
          text={`${COURSES.length} practical, project-first programs for students, IT teams and non-technical professionals — code and no-code tracks.`}
          image="/images/pages/courses.webp"
          imageAlt="A learning path of four course modules with progress bars"
        >
          {/* Search — above 900px; phones use the one in the sidebar */}
            <div className="courses-hero-search" style={{ position: "relative", maxWidth: 480, margin: "26px 0 0" }}>
              <svg style={{
                position: "absolute", left: 16, top: "50%", zIndex: 1,
                transform: "translateY(-50%)", pointerEvents: "none",
              }} width="17" height="17" fill="none" viewBox="0 0 24 24"
                stroke="#CBD5E1" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                placeholder="Search courses..."
                aria-label="Search courses"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "13px 16px 13px 46px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#F1F5F9",
                  fontSize: 14,
                  outline: "none",
                  backdropFilter: "blur(8px)",
                }}
              />
            </div>
        </PageHero>
      </div>

      {/* ── Main Layout ──────────────────────────────────────────── */}
      <div style={{ background: "#FBFBFD", minHeight: "60vh" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "44px 24px 80px" }}>
          <div className="courses-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

            {/* ── Sidebar ───────────────────────────────────────── */}
            <aside className="courses-sidebar" style={{
              width: 232, flexShrink: 0,
              position: "sticky", top: 80,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 20px -8px rgba(15,23,42,0.08)",
              padding: "20px 18px",
            }}>
              {/* Search — phone only, the counterpart to .courses-hero-search
                  above. Above 900px the hero input is the visible one. */}
              <div className="courses-side-search" style={{ marginBottom: 18, position: "relative" }}>
                <svg style={{
                  position: "absolute", left: 10, top: "50%",
                  transform: "translateY(-50%)", pointerEvents: "none",
                }} width="14" height="14" fill="none" viewBox="0 0 24 24"
                  stroke="#94A3B8" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                </svg>
                <input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "8px 10px 8px 32px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    fontSize: 13, color: "#334155",
                    outline: "none", background: "#F8FAFC",
                  }}
                />
              </div>

              <button
                type="button"
                className="courses-filter-toggle"
                onClick={() => setFiltersOpen(v => !v)}
                aria-expanded={filtersOpen}
                aria-controls={FILTER_PANEL_ID}
              >
                <span>Filters</span>
                {totalSelected > 0 && (
                  <span className="courses-filter-count">{totalSelected}</span>
                )}
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginLeft: "auto", transform: filtersOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <div
                id={FILTER_PANEL_ID}
                className={`courses-filter-body${filtersOpen ? " is-open" : ""}`}
              >
              {/* Redundant beside the toggle on a phone, so CSS hides it
                  there — the button already says "Filters". */}
              <p className="courses-filter-eyebrow" style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase", color: "#94A3B8", marginBottom: 10,
              }}>Filters</p>

              <FilterGroup
                title="Course Type"
                options={FILTER_LABELS}
                selected={selectedCategories}
                onToggle={handleCategoryChange}
              />

              <FilterGroup
                title="Difficulty Level"
                options={LEVELS}
                selected={selectedLevels}
                onToggle={id => toggle(setSelectedLevels, id)}
                count={id => searchMatches.filter(c =>
                  c.levels.includes(id) && matchesCategory(c) && matchesAudience(c)).length}
              />

              <FilterGroup
                title="Audience"
                options={AUDIENCES}
                selected={selectedAudiences}
                onToggle={id => toggle(setSelectedAudiences, id)}
                count={id => searchMatches.filter(c =>
                  c.audiences.includes(id) && matchesCategory(c) && matchesLevel(c)).length}
              />

              {totalSelected > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    marginTop: 2, background: "none", border: "none",
                    color: "#0B3D7A", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", padding: 0,
                  }}
                >
                  ✕ Clear filters
                </button>
              )}
              </div>
            </aside>

            {/* ── Course Grid ───────────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="courses-toolbar" style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 24, flexWrap: "wrap", gap: 12,
              }}>
                <span style={{
                  padding: "0 0 8px", margin: 0,
                  fontSize: 14, fontWeight: 700,
                  color: "#0B3D7A",
                  borderBottom: "2px solid #0B3D7A",
                  fontFamily: "var(--font-display)",
                  whiteSpace: "nowrap",
                }}>
                  {sortBy === "az" ? "A to Z"
                    : sortBy === "level" ? "Easiest First"
                    : "All Programs"}
                </span>

                <div className="courses-toolbar-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>
                    <strong style={{ color: "#0B1220", fontVariantNumeric: "tabular-nums" }}>
                      {filteredCourses.length}
                    </strong>
                    {" "}of {COURSES.length} courses
                  </span>
                  <select
                    aria-label="Sort courses"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      background: "white", fontSize: 13,
                      color: "#0B1220", cursor: "pointer", outline: "none",
                    }}
                  >
                    <option value="curated">Recommended</option>
                    <option value="level">Easiest first</option>
                    <option value="az">A to Z</option>
                  </select>
                </div>
              </div>

              {/* Cards */}
              {filteredCourses.length > 0 ? (
                <div
                  key={filteredCourses.map(c => c.category).join("|")}
                  style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(290px, 100%), 1fr))",
                  gap: 20,
                }}>
                  {filteredCourses.map((course, i) => (
                    <CourseCard key={course.category} course={course} index={i} />
                  ))}
                </div>
              ) : (
                <div className="courses-empty" style={{
                  textAlign: "center", padding: "60px 24px",
                  background: "#fff", borderRadius: 16,
                  border: "1px solid #E2E8F0",
                }}>
                  <p style={{
                    fontSize: 18, fontWeight: 700, color: "#334155",
                    fontFamily: "var(--font-display)",
                  }}>No courses found</p>
                  <p style={{ fontSize: 14, color: "#64748B", marginTop: 8 }}>
                    Try adjusting your filters or search keywords.
                  </p>
                  <button
                    onClick={() => { setSearchQuery(""); clearAll(); }}
                    style={{
                      marginTop: 16,
                      background: "linear-gradient(135deg,#1F5FAF 0%,#5AA9F0 100%)", color: "#fff",
                      border: "none", borderRadius: 999,
                      padding: "10px 24px", fontSize: 14,
                      fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LevelMeter({ levels }: { levels: LevelId[] }) {
  const covered = new Set(levels);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span aria-hidden="true" style={{ display: "inline-flex", gap: 3 }}>
        {LEVELS.map((l, i) => (
          <span
            key={l.id}
            className={`courses-meter-dot${covered.has(l.id) ? " is-on" : ""}`}
            style={{ ["--dot-i" as string]: i }}
          />
        ))}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
        {levelText(levels)}
      </span>
    </span>
  );
}

function CourseCard({ course, index }: { course: Course; index: number }) {
  const [hovered, setHovered] = useState(false);
  const accent = accentFor(course.category);
  const Icon = course.icon;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="courses-card-in"
      style={{ display: "flex", flexDirection: "column", ["--card-i" as string]: index }}
    >
    <div
      className="courses-card"
      style={{
        ["--accent-fg" as string]: accent.fg,
        ["--accent-bg" as string]: accent.bg,
        ["--accent-border" as string]: accent.border,
        ["--accent-tile-to" as string]: accent.tileTo,
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        position: "relative",
        border: hovered
          ? `1.5px solid ${accent.border}`
          : "1.5px solid #E6EAF0",
        boxShadow: hovered
          ? `0 20px 44px -12px ${accent.fg}33`
          : "0 6px 22px -14px rgba(15,23,42,0.18)",
        transform: hovered ? "translateY(-5px)" : "translateY(0)",
        // Not `all`: that animates layout properties (border, size) as well,
        // so every frame of the transition could reflow the grid.
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <span aria-hidden="true" className="courses-card-rule" />

      {/* Content */}
      <div className="courses-card-body" style={{ padding: "18px 18px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex", alignItems: "center",
          gap: 10, marginBottom: 12,
        }}>
          <span aria-hidden="true" className="courses-card-icon">
            <Icon size={19} strokeWidth={2} />
          </span>
          <span className="courses-card-badge">{course.badge}</span>
        </div>

        <h3 className="courses-card-title" style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          lineHeight: 1.3, color: "#0B1220",
          margin: "0 0 8px", letterSpacing: "-0.015em",
        }}>
          {course.title}
        </h3>

        <p style={{
          fontSize: 13, lineHeight: 1.65,
          color: "#64748B", flex: 1, margin: "0 0 14px",
        }}>
          {course.desc}
        </p>

        <dl style={{
          margin: "0 0 14px", display: "grid",
          gridTemplateColumns: "auto 1fr", gap: "6px 8px",
          fontSize: 12, lineHeight: 1.45,
        }}>
          <dt style={{
            position: "absolute", width: 1, height: 1,
            overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
          }}>Level</dt>
          <dd style={{ margin: 0, gridColumn: "1 / -1" }}>
            <LevelMeter levels={course.levels} />
          </dd>

          <dt style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "#94A3B8", paddingTop: 1,
          }}>For</dt>
          <dd className="courses-card-for">
            {course.audiences
              .map(id => AUDIENCES.find(a => a.id === id)?.short)
              .filter(Boolean)
              .join(", ")}
          </dd>
        </dl>

        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
          <Link
            to={course.link}
            className="courses-card-cta"
            aria-label={`Know More about ${course.title}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 13, fontWeight: 700,
              color: accent.fg,
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            Know More
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
    </div>
  );
}
