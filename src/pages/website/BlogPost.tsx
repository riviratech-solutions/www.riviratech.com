import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Head } from "../../components/Includes";
import { getSeoByPath } from "../../utils/seo";
import {
  ArticleBody,
  BlogImage,
  accentFor,
  fetchPostBySlug,
  type Post,
} from "../../components/BlogArticle";
import { POSTS } from "./blogPosts";

const seo = getSeoByPath("blogs");

type State =
  | { phase: "loading" }
  | { phase: "found"; post: Post }
  | { phase: "missing" };

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    document.body.classList.add("rt-home");
    return () => document.body.classList.remove("rt-home");
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });

    fetchPostBySlug(slug)
      .then((post) => {
        if (cancelled) return;
        if (post) return setState({ phase: "found", post });
        const offline = POSTS.find((p) => p.slug === slug);
        setState(offline ? { phase: "found", post: offline } : { phase: "missing" });
      })
      .catch(() => {
        if (cancelled) return;
        const offline = POSTS.find((p) => p.slug === slug);
        setState(offline ? { phase: "found", post: offline } : { phase: "missing" });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.phase === "loading") {
    return (
      <main className="bg-white">
        <Head pageTitle={seo.title} pageDesc={seo.description} pageKeywords={seo.keywords} />
        <section className="rt-hero-dark relative pt-24 pb-12">
          <div className="relative mx-auto w-[min(92vw,64rem)] px-6">
            <div className="rt-skel h-9 w-44 rounded-full" />
            <div className="mt-7 rt-skel h-6 w-32 rounded-full" />
            <div className="mt-4 rt-skel h-11 w-full max-w-3xl rounded-lg" />
            <div className="mt-3 rt-skel h-11 w-2/3 max-w-xl rounded-lg" />
          </div>
        </section>
        <article className="mx-auto w-[min(92vw,64rem)] px-6 py-10 sm:py-12">
          <div className="rt-skel mb-8 h-64 w-full rounded-2xl" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rt-skel mb-4 h-4 rounded" style={{ width: `${92 - (i % 3) * 12}%` }} />
          ))}
        </article>
      </main>
    );
  }

  if (state.phase === "missing") {
    return (
      <main className="bg-white">
        <Head
          pageTitle="Article not found | Rivira Technologies Blog"
          pageDesc="This article may have been moved or unpublished."
          pageKeywords={seo.keywords}
        />
        <section className="rt-hero-dark relative pt-24 pb-14">
          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <h1
              className="font-bold text-white"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.2vw, 44px)", lineHeight: 1.15 }}
            >
              We couldn't find that article
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/70">
              It may have been moved, renamed, or taken down. The rest of the blog is still here.
            </p>
            <button
              onClick={() => navigate("/blogs")}
              className="rt-cta-primary mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3"
            >
              Browse all articles <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>
    );
  }

  const post = state.post;
  const accent = accentFor(post);

  return (
    <main className="bg-white">
      {/* The article's own title and summary, not the generic blog SEO block —
          this is the page that gets shared and indexed individually. */}
      <Head
        pageTitle={`${post.title} | Rivira Technologies Blog`}
        pageDesc={post.excerpt || seo.description}
        pageKeywords={seo.keywords}
      />

      {/* Clean dark header — title sits on a solid gradient, never fighting the
          image (blog images are diagrams/screenshots, not photos). */}
      <section className="rt-hero-dark relative pt-24 pb-12">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            WebkitMaskImage: "linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)",
            maskImage: "linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)",
          }}
        />
        {/* Same fluid measure as the article below, so the headline and the
            body it introduces share one left edge at every width. */}
        <div className="relative mx-auto w-[min(92vw,64rem)] px-6">
          <Link
            to="/blogs"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" /> Back to all articles
          </Link>
          <div className="mt-7 flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            <Link
              to={`/blogs?category=${encodeURIComponent(post.categorySlug || "")}`}
              className="rounded-full px-2.5 py-1 uppercase tracking-wider text-white transition hover:brightness-110"
              style={{ background: accent }}
            >
              {post.category}
            </Link>
            {post.readTime && (
              <span className="inline-flex items-center gap-1 text-white/70">
                <Clock className="h-3.5 w-3.5" /> {post.readTime}
              </span>
            )}
          </div>
          <h1
            className="mt-4 font-bold text-white"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.4vw, 46px)", lineHeight: 1.14 }}
          >
            {post.title}
          </h1>
          {post.date && <p className="mt-3 text-sm text-white/60">{post.date}</p>}
        </div>
      </section>

      <article className="mx-auto w-[min(92vw,64rem)] px-6 py-10 sm:py-12">
        {post.image && (
          <figure className="mb-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-cloud)] p-3">
            <BlogImage
              src={post.image}
              alt={post.title}
              className="mx-auto max-h-[440px] w-full rounded-xl object-contain"
            />
          </figure>
        )}
        {post.html ? (
          <ArticleBody html={post.html} />
        ) : (
          /* The bundled fallback posts carry plain paragraphs rather than markup. */
          <div className="space-y-5">
            {post.body.map((p, i) => (
              <p
                key={i}
                className="leading-[1.8] text-[var(--color-ink-soft)]"
                // Same fluid ramp as .rt-article, so a fallback post reads
                // identically to an html-backed one.
                style={{ fontSize: "clamp(17px, 0.42vw + 15.6px, 19.5px)" }}
              >
                {p}
              </p>
            ))}
          </div>
        )}

        <div
          className="mt-10 flex flex-col items-start gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: `${accent}0F`, border: `1px solid ${accent}26` }}
        >
          <div>
            <h3
              className="text-lg font-semibold text-[var(--color-ink-soft)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Want to build this yourself?
            </h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Explore hands-on courses that turn these ideas into skills.
            </p>
          </div>
          <Link to="/courses" className="rt-cta-primary inline-flex flex-shrink-0 items-center gap-2 rounded-full px-6 py-3">
            Explore courses <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>
    </main>
  );
}
