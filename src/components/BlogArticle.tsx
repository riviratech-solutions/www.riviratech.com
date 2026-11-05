import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { AWS_UPLOADS } from "./Includes";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { siteFetch } from "../utils/siteCache";

export type Post = {
  id: string;
  slug: string;
  title: string;
  image: string;
  category: string;
  categorySlug: string;
  accent?: string;
  date: string;
  readTime: string;
  excerpt: string;
  body: string[];
  html?: string;
};

// Per-category accent so cards and chips read as a colour-coded system.
export const CATEGORY_COLORS: Record<string, string> = {
  Foundations: "#2563EB",
  Engineering: "#7C3AED",
  "AI Agents": "#06B6D4",
  Prompting: "#DB2777",
  Education: "#059669",
  Business: "#EA580C",
  Others: "#64748B",
};
export const accentOf = (c: string) => CATEGORY_COLORS[c] ?? "#2563EB";
export const accentFor = (p: { category: string; accent?: string }) =>
  p.accent || accentOf(p.category);

export function resolveImage(b: any): string {
  const raw = String(b.image || b.thumbnail || b.thumbnail_url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return AWS_UPLOADS + raw.replace(/^\/+/, "");
}

/* The editor stores the headline again as the first heading, and the page
   already shows it as the hero <h1> — keeping both prints it twice. */
function stripLeadingHeading(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const first = doc.body.firstElementChild;
  if (first && /^h[1-6]$/i.test(first.tagName)) first.remove();
  return doc.body.innerHTML;
}

/** "July 15, 2026" from the epoch seconds the table stores. */
function formatDate(epoch: any): string {
  const n = Number(epoch);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Plain text of an html body, with tags and entities resolved. */
function textOf(html: string): string {
  if (typeof window === "undefined") return String(html || "").replace(/<[^>]*>/g, " ");
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  return doc.body.textContent || "";
}

/** "8 min read", at 200 words per minute and never less than one. */
function readTimeOf(html: string): string {
  const words = textOf(html).trim().split(/\s+/).filter(Boolean).length;
  if (!words) return "";
  return Math.max(1, Math.round(words / 200)) + " min read";
}

/** First ~180 characters of prose, cut on a word boundary. */
function excerptOf(html: string): string {
  const text = textOf(html).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= 180) return text;
  const cut = text.slice(0, 180);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "") + "…";
}

// Map an API blog record onto the Post shape the pages render.
export function toPost(b: any): Post {
  const html = String(b.html || "");
  const bodyFromHtml = () =>
    html
      .split(/<\/p>/i)
      .map((s) => s.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean);

  const categoryName = b.category_name || b.category || "Others";
  const categorySlug = b.category_slug || (categoryName.toLowerCase() === "others" ? "others" : "");

  return {
    id: b.req_id || String(b.id || b.slug || ""),
    slug: b.slug || b.req_id || String(b.id || ""),
    title: b.title || "Untitled",
    image: resolveImage(b),
    category: categoryName,
    categorySlug: categorySlug,
    accent: b.category_accent || undefined,
    date: b.date || formatDate(b.datetime),
    readTime: b.readTime || b.readtime || readTimeOf(html),
    excerpt: b.excerpt || excerptOf(html),
    body: Array.isArray(b.body) && b.body.length ? b.body : bodyFromHtml(),
    html,
  };
}

/** One published article by slug (or legacy req_id), or null when there is no such post. */
// The website keeps these lists for 10 minutes (utils/siteCache.ts): each
// page / category / article is saved on its own.
export async function fetchPostBySlug(slug: string): Promise<Post | null> {
  const res = await siteFetch("api/blogs/by-slug/" + encodeURIComponent(slug), { method: "post" });

  if (!res.data?.success || !res.data.data) return null;
  const { categories } = await fetchCategories();
  return toPost(withCategory(res.data.data, categories));
}

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  accent: string;
  description: string;
  /** Published posts in this category; null when the API doesn't report it. */
  blogCount: number | null;
};

/** Active blog categories (admin → Blog Categories) with post counts, plus the
    total number of published posts (null when the API doesn't report counts). */
export async function fetchCategories(): Promise<{ ok: boolean; categories: BlogCategory[]; total: number | null }> {
  try {
    const res = await siteFetch("api/blogs/categories", { method: "post" });
    if (!res.data?.success || !Array.isArray(res.data.data)) return { ok: false, categories: [], total: null };
    return {
      ok: true,
      categories: res.data.data.map((c: any) => ({
        // the slug is the category's id on the website (filters, links); saved
        // website lists carry no database ids (utils/siteCache.ts)
        id: String(c.slug || c.req_id || ""),
        name: c.name || "",
        slug: c.slug || "",
        accent: accentOf(c.name || ""),
        description: "",
        blogCount: c.blog_count == null ? null : Number(c.blog_count) || 0,
      })),
      total: res.data.total == null ? null : Number(res.data.total) || 0,
    };
  } catch {
    return { ok: false, categories: [], total: null };
  }
}

// The API sends each post's category name / slug (category_name / _slug); an
// older API sent only category_id, matched against the categories list.
function withCategory(b: any, cats: BlogCategory[]) {
  if (b.category_name) return { ...b, category: b.category_name, category_slug: b.category_slug || "" };
  const c = cats.find((x) => x.id && x.id === String(b.category_id || ""));
  return c ? { ...b, category: c.name, category_slug: c.slug } : b;
}

export type PostsPage = { posts: Post[]; total: number; lastPage: number };

/** One page of published posts, newest first (server-side pagination).
    categoryId is the category slug (or req_id), "" for all. */
export async function fetchPostsPage(
  page: number,
  limit: number,
  categoryId: string,
  cats: BlogCategory[]
): Promise<PostsPage> {
  const res = await siteFetch("api/blogs/latest", {
    method: "post",
    params: { q: "", s: "New", n: page, l: limit, category: categoryId },
  });

  if (res.data?.success && Array.isArray(res.data.data)) {
    return {
      posts: res.data.data.map((b: any) => toPost(withCategory(b, cats))),
      total: Number(res.data.total) || 0,
      lastPage: Number(res.data.lastPage) || 0,
    };
  }
  // "No data found" is an empty page, not a failure
  if (res.data?.lastPage === 0) return { posts: [], total: 0, lastPage: 0 };
  throw new Error(res.data?.message || "bad blogs response");
}

export function BlogImage({
  src,
  alt,
  className,
  style,
  loading,
  imgKey,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
  imgKey?: string;
}) {
  const [dead, setDead] = useState(false);
  if (!src || dead) return null;
  return (
    <img
      key={imgKey}
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      style={style}
      onError={() => setDead(true)}
    />
  );
}

export function ArticleBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const clean = useMemo(() => stripLeadingHeading(sanitizeHtml(html)), [html]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll("img"));
    const hide = (e: Event) => {
      const el = e.currentTarget as HTMLImageElement;
      (el.closest("figure") ?? el).remove();
    };
    for (const img of imgs) {
      // Already-failed images fire no further error event.
      if (img.complete && img.naturalWidth === 0) (img.closest("figure") ?? img).remove();
      else img.addEventListener("error", hide);
    }
    return () => imgs.forEach((i) => i.removeEventListener("error", hide));
  }, [clean]);

  return (
    <>
      <style>{`
        .rt-article {
          color: var(--color-ink-soft);
          font-size: clamp(17px, 0.42vw + 15.6px, 19.5px);
          line-height: 1.8;
        }
        .rt-article > * + * { margin-top: 1.15em; }
        .rt-article h1, .rt-article h2, .rt-article h3,
        .rt-article h4, .rt-article h5, .rt-article h6 {
          font-family: var(--font-display);
          color: var(--color-ink);
          font-weight: 700;
          line-height: 1.25;
          margin-top: 1.9em;
        }
        .rt-article h1 { font-size: 30px; }
        .rt-article h2 { font-size: 26px; }
        .rt-article h3 { font-size: 22px; }
        .rt-article h4 { font-size: 20px; }
        .rt-article h5, .rt-article h6 { font-size: 18px; }
        .rt-article > :first-child { margin-top: 0; }
        .rt-article a { color: var(--color-brand-700); text-decoration: underline; text-underline-offset: 2px; }
        .rt-article strong, .rt-article b { font-weight: 700; color: var(--color-ink); }
        .rt-article ul, .rt-article ol { padding-left: 1.4em; }
        .rt-article ul { list-style: disc; }
        .rt-article ol { list-style: decimal; }
        .rt-article li + li { margin-top: 0.45em; }
        .rt-article blockquote {
          border-left: 3px solid var(--color-border);
          padding-left: 1em;
          color: var(--color-muted);
          font-style: italic;
        }
        .rt-article pre {
          background: var(--color-cloud);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 14px 16px;
          overflow-x: auto;
          font-size: 14px;
          line-height: 1.6;
        }
        .rt-article code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.9em;
          background: var(--color-cloud);
          border-radius: 6px;
          padding: 0.15em 0.4em;
        }
        .rt-article pre code { background: none; padding: 0; }
        /* Diagrams and screenshots, not photos — shown whole on a mat rather
           than cropped to a fixed box. */
        .rt-article figure { margin: 1.9em 0; }
        .rt-article img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 0 auto;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          background: var(--color-cloud);
        }
        .rt-article figcaption {
          margin-top: 0.6em;
          text-align: center;
          font-size: 13.5px;
          color: var(--color-muted);
        }
        .rt-article table { width: 100%; border-collapse: collapse; font-size: 15px; display: block; overflow-x: auto; }
        .rt-article th, .rt-article td { border: 1px solid var(--color-border); padding: 8px 10px; text-align: left; }
        .rt-article th { background: var(--color-cloud); font-weight: 700; }
        .rt-article hr { border: 0; border-top: 1px solid var(--color-border); margin: 2em 0; }
      `}</style>
      <div ref={ref} className="rt-article" dangerouslySetInnerHTML={{ __html: clean }} />
    </>
  );
}

export function CategoryChip({
  category,
  readTime,
  accent: accentProp,
}: {
  category: string;
  readTime: string;
  /* The category's configured colour. Optional so the offline fallback posts,
     which have no accent, still get one from CATEGORY_COLORS. */
  accent?: string;
}) {
  const accent = accentProp || accentOf(category);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold leading-none">
      <span
        className="rounded-full px-2 py-1 uppercase tracking-[0.08em]"
        style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}2e` }}
      >
        {category}
      </span>
      {/* The clock is dropped with the text — an icon on its own reads as a
          missing value rather than as "no read time for this post". */}
      {readTime && (
        <>
          <span aria-hidden="true" className="text-[var(--color-muted)] opacity-40">
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-[var(--color-muted)]">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {readTime}
          </span>
        </>
      )}
    </div>
  );
}
