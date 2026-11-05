import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/* Shimmering placeholders shown while a page's data is on its way (styles:
   "loading system" in public/css/panel.css). Each one is shaped like what
   replaces it, so nothing jumps when the real content arrives. Screen readers
   hear "Loading…" once (role="status"); the bars themselves are hidden from them. */

const W = ["72%", "48%", "86%", "60%", "40%", "78%", "54%", "66%"]; // varied bar widths, so rows don't look stamped

/** One shimmering bar or block. */
export function Skeleton({
  w = "100%",
  h = 12,
  r,
  className = "",
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={"sk " + className}
      style={{ width: w, height: h, ...(r !== undefined ? { borderRadius: r } : null), ...style }}
      aria-hidden="true"
    />
  );
}

const Busy = () => <span className="visually-hidden">Loading…</span>;

/** Skeleton rows inside an existing <tbody>; the column count comes from the
    table's own header row (or `cols`). */
export function SkeletonRows({ rows = 6, cols }: { rows?: number; cols?: number }) {
  const ref = useRef<HTMLTableRowElement>(null);
  const [n, setN] = useState(cols || 0);
  useLayoutEffect(() => {
    if (cols) return;
    const table = ref.current?.closest("table");
    const head = table?.tHead?.rows[0];
    const count = head ? Array.from(head.cells).reduce((t, c) => t + (c.colSpan || 1), 0) : 0;
    setN(count || 5);
  }, [cols]);
  const c = n || 1;
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} ref={i === 0 ? ref : undefined} className="sk-row" role={i === 0 ? "status" : undefined}>
          {Array.from({ length: c }, (_, j) => (
            <td key={j}>
              {j === 0 && i === 0 && <Busy />}
              <Skeleton w={W[(i * 3 + j) % W.length]} h={j === 0 ? 14 : 11} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A whole table placeholder (header + rows), for cards that hide their table while loading. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="sk-table" role="status">
      <Busy />
      <div className="sk-table-head" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }, (_, j) => (
          <Skeleton key={j} w={j === 0 ? "55%" : "40%"} h={10} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-table-row" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, j) => (
            <Skeleton key={j} w={W[(i * 3 + j) % W.length]} h={j === 0 ? 14 : 11} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card placeholders: "list" = full-width rows (icon, text, actions), like the
    Live Classes / Assignments cards; "grid" = tiles, like galleries and media. */
export function SkeletonCards({ count = 4, variant = "list" }: { count?: number; variant?: "list" | "grid" }) {
  return (
    <div className={"sk-cards " + variant} role="status">
      <Busy />
      {Array.from({ length: count }, (_, i) =>
        variant === "grid" ? (
          <div key={i} className="sk-card">
            <Skeleton h={140} r={10} />
            <Skeleton w={W[i % W.length]} h={14} style={{ marginTop: 14 }} />
            <Skeleton w="45%" h={11} style={{ marginTop: 8 }} />
          </div>
        ) : (
          <div key={i} className="sk-card sk-card-list">
            <Skeleton w={120} h={88} r={12} className="sk-thumb" />
            <div className="sk-card-body">
              <Skeleton w={W[i % W.length]} h={16} />
              <div className="sk-card-meta">
                <Skeleton w={90} h={11} />
                <Skeleton w={110} h={11} />
                <Skeleton w={80} h={11} />
              </div>
            </div>
            <div className="sk-card-actions">
              <Skeleton w={34} h={34} r={8} />
              <Skeleton w={110} h={34} r={8} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/** Dashboard statistic cards (same box as .adb-stat). */
export function SkeletonStats({ count = 4, five = false }: { count?: number; five?: boolean }) {
  return (
    <div className={"adb-stats" + (five ? " five" : "")} role="status">
      <Busy />
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="adb-stat sk-stat" aria-hidden="true">
          <Skeleton w={five ? 50 : 58} h={five ? 50 : 58} r={14} />
          <div className="adb-stat-body" style={{ flex: 1 }}>
            <Skeleton w="62%" h={10} style={{ marginTop: 4 }} />
            <Skeleton w="38%" h={24} style={{ marginTop: 10 }} r={7} />
            <Skeleton w="50%" h={10} style={{ marginTop: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A chart card: title + bars. */
export function SkeletonChart({ height = 250, title = true }: { height?: number; title?: boolean }) {
  const bars = [46, 68, 38, 82, 57, 74, 50, 90, 62, 44];
  return (
    <div className="adb-card sk-chart" aria-hidden="true">
      {title && (
        <div className="adb-card-head">
          <Skeleton w={180} h={14} />
          <Skeleton w={90} h={26} r={8} />
        </div>
      )}
      <div className="sk-chart-bars" style={{ height }}>
        {bars.map((b, i) => (
          <Skeleton key={i} h={`${b}%`} r="6px 6px 2px 2px" />
        ))}
      </div>
    </div>
  );
}

/** A list of entries (activity feeds, notices): avatar + two lines. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="sk-list" role="status">
      <Busy />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-list-row">
          <Skeleton w={36} h={36} r="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton w={W[i % W.length]} h={12} />
            <Skeleton w="35%" h={10} style={{ marginTop: 7 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A form or detail panel: label + field pairs. */
export function SkeletonForm({ fields = 6 }: { fields?: number }) {
  return (
    <div className="sk-form" role="status">
      <Busy />
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="sk-form-field">
          <Skeleton w={i % 2 ? 110 : 140} h={10} />
          <Skeleton h={40} r={10} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
