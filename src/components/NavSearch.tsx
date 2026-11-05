import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, CornerDownLeft } from "lucide-react";
import { searchSite, type SearchEntry } from "../utils/searchIndex";

export default function NavSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // A <div> now the results are grouped into sections, not one flat <ul>.
  const listRef = useRef<HTMLDivElement | null>(null);
  const mouseMoved = useRef(false);

  const results = useMemo(() => searchSite(q), [q]);

  const groups = useMemo(() => {
    const out: { kind: string; items: { entry: SearchEntry; i: number }[] }[] = [];
    results.forEach((entry, i) => {
      const label = entry.kind === "Question" ? "Answers"
                  : entry.kind === "Curriculum" ? "Curriculum"
                  : `${entry.kind}s`;
      const g = out.find((x) => x.kind === label);
      if (g) g.items.push({ entry, i });
      else out.push({ kind: label, items: [{ entry, i }] });
    });
    return out;
  }, [results]);

  useEffect(() => { setActive(0); mouseMoved.current = false; }, [q]);

  /* Global shortcuts. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setOpen(true); return;
      }
      if (e.key === "/" && !typing && !open) { e.preventDefault(); setOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      mouseMoved.current = false;
      window.setTimeout(() => inputRef.current?.focus(), 30);
      const arm = () => { mouseMoved.current = true; };
      document.addEventListener("mousemove", arm, { once: true });
      return () => document.removeEventListener("mousemove", arm);
    }
    setQ(""); setActive(0);
  }, [open]);

  /* The page must not scroll behind an open overlay. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => { setOpen(false); buttonRef.current?.focus(); };

  const go = (entry: SearchEntry) => {
    setOpen(false);
    // A path with a hash has to go through navigate() as one string or the
    // anchor is dropped and the visitor lands at the top of the page.
    navigate(entry.path);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  };

  /* Keep the highlighted row in view when arrowing past the fold. */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-hit="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rt-navsearch__btn"
        aria-label="Search the site"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Search size={19} aria-hidden="true" />
        <span className="rt-navsearch__btn-label" aria-hidden="true">Search…</span>
      </button>

      {open && (
        <div
          className="rt-navsearch__scrim"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="rt-navsearch__dialog" role="dialog" aria-modal="true" aria-label="Search">
            <div className="rt-navsearch__field">
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search courses, topics and more"
                aria-label="Search courses, topics and more"
                aria-controls="rt-navsearch-results"
                autoComplete="off"
              />
              <button type="button" className="rt-navsearch__close" onClick={close} aria-label="Close search">
                <X size={17} />
              </button>
            </div>

            {q.trim().length >= 2 && (
              <>
                {results.length > 0 && (
                  <p className="rt-navsearch__count" aria-live="polite">
                    {results.length} result{results.length === 1 ? "" : "s"}
                  </p>
                )}
                {results.length === 0 ? (
                  <p className="rt-navsearch__empty">
                    Nothing matched “{q.trim()}”. Try a topic like <em>RAG</em>, <em>agents</em> or <em>prompt engineering</em>.
                  </p>
                ) : (
                  <div className="rt-navsearch__results" id="rt-navsearch-results" ref={listRef}>
                    {groups.map((g) => (
                      <div key={g.kind} className="rt-navsearch__group">
                        <p className="rt-navsearch__grouphead">{g.kind}</p>
                        <ul role="listbox" aria-label={g.kind}>
                          {g.items.map(({ entry: r, i }) => (
                            <li key={`${r.path}-${r.title}`} role="option" aria-selected={i === active}>
                              <button
                                type="button"
                                data-hit={i}
                                className={`rt-navsearch__hit${i === active ? " on" : ""}`}
                                onMouseEnter={() => { if (mouseMoved.current) setActive(i); }}
                                onClick={() => go(r)}
                              >
                                <span className="rt-navsearch__hit-main">
                                  <span className="rt-navsearch__hit-title">{r.title}</span>
                                  {r.desc && <span className="rt-navsearch__hit-desc">{r.desc}</span>}
                                </span>
                                <span className="rt-navsearch__hit-go" aria-hidden="true">↵</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="rt-navsearch__hint">
              <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
              <span><kbd><CornerDownLeft size={11} /></kbd> to open</span>
              <span><kbd>esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
