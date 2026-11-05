import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const THRESHOLD = 7;
/** How many cards stay visible while collapsed. */
const VISIBLE = 5;

export default function CollapsibleRows({
  count,
  noun = "modules",
  className = "biz-rows",
  collapsedClass = "biz-rows--collapsed",
  children,
}: {
  /** Number of `.biz-row` children — decides whether this truncates at all. */
  count: number;
  /** Plural noun for the button label: "Show all 14 modules". */
  noun?: string;
  /** Extra classes for the container, e.g. "biz-rows cbiz-tracks". */
  className?: string;
  collapsedClass?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  /* Where the toggle sat in the viewport at the moment it was clicked shut.
     Read in the handler, spent by the effect below, null at every other time. */
  const btnTopAtClick = useRef<number | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) {
      const btn = btnRef.current;
      const was = btnTopAtClick.current;

      if (btn && was != null) {
        const delta = btn.getBoundingClientRect().top - was;
        window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "auto" });
      }
    }
    btnTopAtClick.current = null;
    wasOpen.current = open;
  }, [open]);

  const truncates = count > THRESHOLD;
  const collapsed = truncates && !open;

  // Short list: render exactly what the pages rendered before this existed.
  if (!truncates) return <div className={className}>{children}</div>;

  return (
    <>
      <div ref={wrapRef} id={id} className={collapsed ? `${className} ${collapsedClass}` : className}>
        {children}
      </div>

      <button
        ref={btnRef}
        type="button"
        className="biz-show-more"
        onClick={() => {
          if (open) btnTopAtClick.current = btnRef.current?.getBoundingClientRect().top ?? null;
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={id}
      >
        {open ? `Show fewer ${noun}` : `Show all ${count} ${noun}`}
        <ChevronDown
          size={16}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </button>
    </>
  );
}

export { THRESHOLD as COLLAPSE_THRESHOLD, VISIBLE as COLLAPSE_VISIBLE };
