/**
 * Shared date-range filter for the admin list pages (web/trainer contacts,
 * enrollees, students, certificates, events, feedbacks, tickets, ...).
 *
 * The bounds are resolved to epoch seconds *in the browser* rather than being
 * sent as plain dates for the server to interpret. The lists render their Date
 * column with toLocaleDateString (i.e. in the admin's own timezone), so
 * resolving the day boundaries here is what keeps "From 8 Feb" matching the
 * rows that actually show 8/2/2026 — a server-side conversion would drift by
 * its own UTC offset and cut the range a few hours off at each end.
 */

/** "YYYY-MM-DD" -> epoch seconds at 00:00:00 local time ("" when unset). */
export const dayStartEpoch = (d: string): string => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return "";
  return String(Math.floor(new Date(y, m - 1, day, 0, 0, 0, 0).getTime() / 1000));
};

/** "YYYY-MM-DD" -> epoch seconds at 23:59:59 local time, so `To` is inclusive. */
export const dayEndEpoch = (d: string): string => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return "";
  return String(Math.floor(new Date(y, m - 1, day, 23, 59, 59, 999).getTime() / 1000));
};

type Props = {
  /** Selected "YYYY-MM-DD" values ("" = open-ended). */
  from: string;
  to: string;
  /** Fired on every change; receives the next (from, to) pair. */
  onApply: (from: string, to: string) => void;
};

export default function DateFilter({ from, to, onApply }: Props) {
  const active = !!(from || to);

  return (
    <div className="date-filter">
      <label htmlFor="df-from">From: </label>
      <input
        id="df-from"
        type="date"
        className="form-control"
        value={from}
        // Keeps the range from being inverted into one that matches nothing.
        max={to || undefined}
        onChange={(e) => onApply(e.target.value, to)}
      />

      <label htmlFor="df-to">To: </label>
      <input
        id="df-to"
        type="date"
        className="form-control"
        value={to}
        min={from || undefined}
        onChange={(e) => onApply(from, e.target.value)}
      />

      {active && (
        <button
          type="button"
          className="btn btn-sm btn-outline-danger date-filter-clear"
          onClick={() => onApply("", "")}
          title="Clear date filter"
        >
          <i className="fa fa-times"></i> Clear
        </button>
      )}
    </div>
  );
}
