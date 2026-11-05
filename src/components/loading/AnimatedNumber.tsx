import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Skeleton } from "./Skeleton";

/* A number that counts to its value: from 0 the first time real data arrives,
   then from the old value to the new one whenever it changes (never on renders
   where it stays the same). Takes a number or a formatted string ("₹1,463",
   "12.5%", "-3"): the prefix, suffix, decimals and thousands separators are kept.
   Anything else (text, an element) is shown as it is.

   pending: shows a shimmer instead of a misleading 0 until the first real value
   has loaded; once a value was shown, later reloads keep it and animate the change.
   Screen readers get the final value only; reduced motion skips the counting.

   id: remembers the value for this visit to the page, so a card that React
   mounts again (a component defined inside a page) shows it without counting
   again; a new visit to the page counts up from 0 once more. */

type Props = {
  value: unknown;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  pending?: boolean;
  id?: string;
  className?: string;
};

const memory = new Map<string, number>(); // "<visit>:<id>" -> last value shown

type Parsed = { num: number; prefix: string; suffix: string; decimals: number; grouping: boolean };

function parse(v: unknown): Parsed | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const dec = Number.isInteger(v) ? 0 : Math.min(2, (String(v).split(".")[1] || "").length);
    return { num: v, prefix: "", suffix: "", decimals: dec, grouping: true };
  }
  if (typeof v !== "string") return null;
  const m = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(\D*)$/.exec(v.trim());
  if (!m) return null;
  const digits = m[2];
  const num = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  return { num, prefix: m[1], suffix: m[3], decimals: (digits.split(".")[1] || "").length, grouping: digits.includes(",") };
}

const reduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function AnimatedNumber({
  value,
  duration = 800,
  decimals,
  prefix,
  suffix,
  locale = "en-IN",
  pending = false,
  id,
  className = "",
}: Props) {
  const visit = useLocation().key;
  const memKey = id ? visit + ":" + id : "";
  const p = parse(value);
  const target = p ? p.num : null;
  const dec = decimals ?? (p ? p.decimals : 0);
  const pre = prefix ?? (p ? p.prefix : "");
  const suf = suffix ?? (p ? p.suffix : "");
  const grouping = p ? p.grouping : true;

  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(memKey && memory.has(memKey) ? (memory.get(memKey) as number) : null); // on screen now (mid-count too)
  const loaded = useRef(shown.current !== null); // a real value has been shown
  if (!pending && target !== null) loaded.current = true;

  const fmt = (n: number) =>
    pre +
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
      useGrouping: grouping,
    }).format(n) +
    suf;

  useEffect(() => {
    const el = ref.current;
    if (target === null || !el) return; // nothing to count, or the shimmer is showing
    const from = shown.current ?? 0;
    if (memKey) memory.set(memKey, target);
    if (from === target || reduced()) {
      shown.current = target;
      el.textContent = fmt(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3); // ease-out
      const n = k < 1 ? from + (target - from) * eased : target;
      shown.current = n;
      el.textContent = fmt(k < 1 ? Number(n.toFixed(dec)) : target);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // fmt depends only on the values below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, dec, pre, suf, locale, grouping, duration, pending, memKey]);

  if (pending && !loaded.current) {
    return <Skeleton w="2.2em" h="0.9em" r={6} className="sk-num" />;
  }
  if (p === null) return <>{value as ReactNode}</>;
  const start = shown.current ?? (reduced() ? (target as number) : 0);
  return (
    <span className={"anum " + className}>
      <span aria-hidden="true" ref={ref}>
        {fmt(start)}
      </span>
      <span className="visually-hidden">{fmt(target as number)}</span>
    </span>
  );
}
