import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Head } from "../../components/Includes";
import { getSeoByPath } from "../../utils/seo";
import {
  BlogImage,
  CategoryChip,
  accentFor,
  fetchCategories,
  fetchPostBySlug,
  fetchPostsPage,
  type BlogCategory,
  type Post,
} from "../../components/BlogArticle";
import { POSTS } from "./blogPosts";
import { PageHero } from "../../components/site/PageKit";

const seo = getSeoByPath("blogs");

// ── Automation config ──
const ROTATE_MS = 6000; // time each featured post stays on screen
const LIMIT = 12; // posts per page

function categoriesOf(posts: Post[], live: BlogCategory[]) {
  const order = new Map(live.map((c, i) => [c.slug, i]));
  const accents = new Map(live.map((c) => [c.slug, c.accent]));

  const seen = new Map<string, { name: string; slug: string; accent: string; count: number }>();
  for (const p of posts) {
    const slug = p.categorySlug || (p.category?.toLowerCase() === "others" ? "others" : "others");
    const existing = seen.get(slug);
    if (existing) existing.count += 1;
    else
      seen.set(slug, {
        name: p.category || "Others",
        slug,
        accent: accents.get(slug) || accentFor(p),
        count: 1,
      });
  }

  return Array.from(seen.values()).sort((a, b) => {
    const ai = order.has(a.slug) ? (order.get(a.slug) as number) : Number.MAX_SAFE_INTEGER;
    const bi = order.has(b.slug) ? (order.get(b.slug) as number) : Number.MAX_SAFE_INTEGER;
    return ai !== bi ? ai - bi : a.name.localeCompare(b.name);
  });
}

export default function Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeCategory = searchParams.get("category") || "All";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const legacyPost = searchParams.get("post");

  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Admin → Blog Categories, with post counts (null until loaded)
  const [cats, setCats] = useState<{ ok: boolean; categories: BlogCategory[]; total: number | null } | null>(null);

  // The current page of posts (server-side pagination)
  const [posts, setPosts] = useState<Post[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(0);
  const [loading, setLoading] = useState(true);
  // API unavailable → page through the bundled POSTS instead
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    document.body.classList.add("rt-home");
    return () => document.body.classList.remove("rt-home");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCategories().then((c) => { if (!cancelled) setCats(c); });
    return () => { cancelled = true; };
  }, []);

  const loadFallback = () => {
    const all = activeCategory === "All"
      ? POSTS
      : POSTS.filter((p) => (p.categorySlug || (p.category?.toLowerCase() === "others" ? "others" : "others")) === activeCategory);
    const last = Math.ceil(all.length / LIMIT);
    const pg = Math.min(page, Math.max(last, 1));
    setPosts(all.slice((pg - 1) * LIMIT, pg * LIMIT));
    setTotal(all.length);
    setLastPage(last);
    setFallback(true);
  };

  useEffect(() => {
    if (!cats) return;
    let cancelled = false;

    // Categories request failed → treat the API as down
    if (!cats.ok) {
      loadFallback();
      setLoading(false);
      return;
    }

    const categoryId = activeCategory === "All"
      ? ""
      : activeCategory.toLowerCase() === "others"
      ? "others"
      : cats.categories.find((c) => c.slug === activeCategory)?.id;

    setLoading(true);
    setFeaturedIdx(0);

    if (categoryId === undefined) {
      // ?category= names no category we have
      setPosts([]); setTotal(0); setLastPage(0); setFallback(false);
      setLoading(false);
      return;
    }

    fetchPostsPage(page, LIMIT, categoryId, cats.categories)
      .then((res) => {
        if (cancelled) return;
        setPosts(res.posts);
        setTotal(res.total);
        setLastPage(res.lastPage);
        setFallback(false);
      })
      .catch(() => { if (!cancelled) loadFallback(); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [cats, activeCategory, page]);

  // Old /blogs?post=<req_id or slug> links → the article's own URL
  useEffect(() => {
    if (!legacyPost) return;
    const offline = () => POSTS.find((x) => x.id === legacyPost || x.slug === legacyPost);
    fetchPostBySlug(legacyPost)
      .then((p) => {
        const match = p || offline();
        if (match) navigate(`/blog/${match.slug}`, { replace: true });
      })
      .catch(() => {
        const match = offline();
        if (match) navigate(`/blog/${match.slug}`, { replace: true });
      });
  }, [legacyPost, navigate]);

  // Filter chips: server counts, or counts from the bundled POSTS when offline
  // Filter chips: every active category from admin → Blog Categories (counts
  // when the API reports them), or the bundled POSTS' categories when offline.
  // Categories with 0 posts are excluded from the filter chips.
  const CATEGORIES: { name: string; slug: string; accent: string; count: number | null }[] =
    (fallback
      ? categoriesOf(POSTS, [])
      : (cats?.categories || []).map((c) => ({ name: c.name, slug: c.slug, accent: c.accent, count: c.blogCount }))
    ).filter((c) => c.count == null || c.count > 0);
  const allCount: number | null = fallback
    ? POSTS.length
    : cats?.total ?? (activeCategory === "All" && !loading ? listtotal : null);

  const gridPosts = posts;

  // Featured carousel: the first four posts, on page 1 only
  const FEATURED = page === 1 ? gridPosts.slice(0, 4) : [];
  const featured = FEATURED[featuredIdx] || FEATURED[0];

  useEffect(() => {
    if (paused || FEATURED.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setFeaturedIdx((i) => (i + 1) % FEATURED.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, featuredIdx, FEATURED.length]);

  const setCategory = (slug: string) => {
    /* "All" clears the parameter rather than writing ?category=All — a canonical
       /blogs is what should be indexed and shared for the unfiltered view.
       A new category always starts again at page 1. */
    if (slug === "All") setSearchParams({});
    else setSearchParams({ category: slug });
  };

  const setPage = (p: number) => {
    const next: Record<string, string> = {};
    if (activeCategory !== "All") next.category = activeCategory;
    if (p > 1) next.page = String(p);
    setSearchParams(next);
    // Bring the list (on page 1, the featured hero) back into view
    const top = (listRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const openPost = (post: Post) => navigate(`/blog/${post.slug}`);

  return (
    <main className="bg-white">
      <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
      <style>{`
        @keyframes rtBlogFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes rtBlogProgress { from { width: 0%; } to { width: 100%; } }
      `}</style>

      {/* Same hero as the Business page (enroll-hero inside .enroll-page.biz-page) */}
      <div className="enroll-page biz-page">
        <PageHero
          crumb="Blog"
          eyebrow="Insights"
          title="The Rivira Tech"
          accent="blog"
          text="Tutorials, insights and practical guides on generative AI, LLMs, agents, RAG and AI education — written by people who build with them."
          image="/images/pages/blog.webp"
          imageAlt="Article cards about prompting, RAG and agents"
          actions={[{ label: "Join a Free Workshop", to: "/workshop" }, { label: "Explore Programs", to: "/programs", ghost: true }]}
        />
      </div>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-6" ref={listRef}>
          {/* Featured post — auto-rotating carousel */}
          {featured && (
            <>
              <article
                onClick={() => openPost(featured)}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                className="rt-card rt-card-featured group relative grid cursor-pointer overflow-hidden lg:grid-cols-2"
              >
                {/* Rotation progress bar */}
                <span
                  key={`progress-${featuredIdx}-${activeCategory}`}
                  className="absolute inset-x-0 top-0 z-10 h-1"
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(90deg, ${accentFor(featured)}, ${accentFor(featured)}66)`,
                    animationName: FEATURED.length > 1 ? "rtBlogProgress" : undefined,
                    animationDuration: `${ROTATE_MS}ms`,
                    animationTimingFunction: "linear",
                    animationPlayState: paused ? "paused" : "running",
                  }}
                />
                {/* The image half is dropped entirely for a post with no picture, so
                    the hero is not a half-empty two-column panel. */}
                {featured.image && (
                  <div className="relative h-56 overflow-hidden lg:h-auto lg:min-h-[380px]">
                    <BlogImage
                      imgKey={`img-${featured.id}`}
                      src={featured.image}
                      alt={featured.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 lg:object-contain lg:p-5"
                      style={{ animation: "rtBlogFade 0.6s ease both" }}
                    />
                    <span
                      className="absolute left-4 top-4 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-sm"
                      style={{ background: accentFor(featured) }}
                    >
                      Featured Article
                    </span>
                  </div>
                )}
                <div
                  key={`content-${featured.id}`}
                  className={`flex flex-col justify-center p-7 sm:p-9 ${featured.image ? "" : "lg:col-span-2"}`}
                  style={{ animation: "rtBlogFade 0.6s ease both" }}
                >
                  {!featured.image && (
                    <span
                      className="mb-3 self-start rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white"
                      style={{ background: accentFor(featured) }}
                    >
                      Featured Article
                    </span>
                  )}
                  <CategoryChip category={featured.category} readTime={featured.readTime} accent={accentFor(featured)} />
                  <h2
                    className="mt-4 text-2xl font-bold text-[var(--color-ink-soft)] sm:text-3xl"
                    style={{ fontFamily: "var(--font-display)", lineHeight: 1.2 }}
                  >
                    {featured.title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-[var(--color-muted)]">{featured.excerpt}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-brand-700)]">
                    Read article
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </article>

              {/* Carousel dots — only where there is more than one thing to cycle. */}
              {FEATURED.length > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Featured articles">
                  {FEATURED.map((p, i) => (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={i === featuredIdx}
                      aria-label={`Show featured article ${i + 1}: ${p.title}`}
                      onClick={() => setFeaturedIdx(i)}
                      className="rounded-full transition-all duration-300"
                      style={{
                        height: 8,
                        width: i === featuredIdx ? 26 : 8,
                        background: i === featuredIdx ? accentFor(featured) : "rgba(100,116,139,0.35)",
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {CATEGORIES.length > 0 && (
            <div className="rt-blog-filters mt-10" role="group" aria-label="Filter articles by category">
              <button
                onClick={() => setCategory("All")}
                aria-pressed={activeCategory === "All"}
                className="rt-blog-chip"
                data-active={activeCategory === "All"}
                style={{ ["--chip" as string]: "#2563EB" }}
              >
                All
                {allCount != null && <span className="rt-blog-chip-count">{allCount}</span>}
              </button>
              {CATEGORIES.map((c) => {
                const active = c.slug === activeCategory;
                return (
                  <button
                    key={c.slug}
                    onClick={() => setCategory(c.slug)}
                    aria-pressed={active}
                    className="rt-blog-chip"
                    data-active={active}
                    style={{ ["--chip" as string]: c.accent }}
                  >
                    {c.name}
                    {c.count != null && <span className="rt-blog-chip-count">{c.count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Grid of the current page of articles */}
          {loading ? (
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading articles">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rt-card flex flex-col overflow-hidden">
                  <div className="rt-skel aspect-[16/9] w-full" />
                  <div className="p-6">
                    <div className="rt-skel h-5 w-28 rounded-full" />
                    <div className="rt-skel mt-4 h-5 w-full rounded" />
                    <div className="rt-skel mt-2 h-5 w-2/3 rounded" />
                    <div className="rt-skel mt-5 h-3 w-full rounded" />
                    <div className="rt-skel mt-2 h-3 w-5/6 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : gridPosts.length === 0 ? (
            /* Reachable by hand-editing ?category= to something with no posts.
               A bare empty grid looks like a page that failed to load. */
            <div className="rt-blog-empty mt-10">
              <p className="rt-blog-empty-title">No articles in this category yet</p>
              <p className="rt-blog-empty-body">
                New pieces are published regularly — try another category, or browse everything.
              </p>
              <button onClick={() => setCategory("All")} className="rt-cta-primary mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3">
                Browse all articles <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {gridPosts.map((post) => {
                const accent = accentFor(post);
                return (
                  <article
                    key={`${activeCategory}-${post.id}`}
                    onClick={() => openPost(post)}
                    className="rt-card group flex cursor-pointer flex-col overflow-hidden"
                    style={{ animation: "rtBlogFade 0.4s ease both" }}
                  >
                    {post.image ? (
                      <div className="relative aspect-[16/9] overflow-hidden bg-[var(--color-cloud)]">
                        <BlogImage
                          src={post.image}
                          alt={post.title}
                          loading="lazy"
                          className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                        <span
                          className="absolute inset-x-0 top-0 h-1"
                          style={{ background: `linear-gradient(90deg, ${accent}, ${accent}66)` }}
                          aria-hidden="true"
                        />
                      </div>
                    ) : (
                      /* The accent bar is the card's category cue and normally
                         lives in the image block, so it is kept when that goes. */
                      <span
                        className="block h-1 w-full"
                        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}66)` }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      <CategoryChip category={post.category} readTime={post.readTime} accent={accent} />
                      <h3
                        className="mt-3 line-clamp-3 min-h-[3.9em] text-[1.05rem] font-semibold text-[var(--color-ink-soft)]"
                        style={{ fontFamily: "var(--font-display)", lineHeight: 1.3 }}
                      >
                        {post.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-muted)]">
                        {post.excerpt}
                      </p>
                      <Link
                        to={`/blog/${post.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-bold transition-all group-hover:gap-2.5"
                        style={{ color: accent }}
                      >
                        Read article <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && (
            <Pagination
              page={page}
              total={listtotal}
              limit={LIMIT}
              lastPage={lastPage}
              onPageChange={(p: number) => setPage(p)}
            />
          )}
        </div>
      </section>
    </main>
  );

  function Pagination({
    page,
    total,
    limit,
    lastPage,
    onPageChange,
  }: any) {
    if (total === 0 || lastPage <= 1) return null;

    const start = (page - 1) * limit + 1;
    const end = Math.min(start + posts.length - 1, total);

    let pagstart = 1;
    let pagend = 10;

    if (page >= 6) {
      pagstart = page - 3;
      pagend = page + 7;
    }

    if (pagend >= lastPage) {
      pagstart = lastPage - 9;
      pagend = lastPage + 1;
    }

    if (pagstart <= 0) pagstart = 1;

    const pages = [];

    for (let i = pagstart; i < pagend && i <= lastPage; i++) {
      pages.push(i);
    }

    return (
      <nav className="pagepagination rt-blog-pager" aria-label="Blog pages">
        <div className="dt-start">
          <div className="dt-info" role="status">
            Showing {start} to {end} of {total} articles
          </div>
        </div>

        <div className="dt-end">
          <div className="dt-paging paging_full_numbers">

            {page >= 2 && (
              <button
                className="dt-paging-button first"
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
              >
                «
              </button>
            )}

            {pages.map((p) => (
              <button
                key={p}
                className={`dt-paging-button ${p === page ? "current" : ""}`}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ))}

            {page >= 1 && page < lastPage && (
              <button
                className="dt-paging-button last"
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
              >
                »
              </button>
            )}

          </div>
        </div>
      </nav>
    );
  }
}
