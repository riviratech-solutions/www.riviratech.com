/* Class times across time zones. A class is saved in the time zone the admin
   picks (api/shared/timezone.js turns its date + times into timestamps); every
   student, trainer and admin then sees those timestamps in their own zone, with
   its short name ("IST", "EDT", "GMT+4") so it's clear which zone that is. */

// Browsers still report some zones by their old names (Chrome: "Asia/Calcutta");
// one name per zone keeps the list free of doubles and the saved zones consistent.
const ALIAS: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Etc/UTC": "UTC",
  "Etc/GMT": "UTC",
};
export const canonicalTz = (tz: string) => ALIAS[tz] || tz;

/** This browser's time zone, e.g. "Asia/Kolkata". */
export function browserTz(): string {
  try {
    return canonicalTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  } catch {
    return "UTC";
  }
}

// the viewer's own locale names zones the way they know them (IST in India, EDT in the US)
const viewerLocale = () => (typeof navigator !== "undefined" && navigator.language) || "en-US";

/** The short name of a zone at a moment: the viewer's own zone unless `tz` is given. */
export function tzShort(ts?: number | string, tz?: string): string {
  const n = Number(ts);
  const d = n > 0 ? new Date(n < 1e10 ? n * 1000 : n) : new Date();
  try {
    const fmt = (loc: string) =>
      new Intl.DateTimeFormat(loc, { timeZoneName: "short", ...(tz ? { timeZone: tz } : {}) })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value || "";
    let name = fmt(viewerLocale());
    // India's zone is "GMT+5:30" in most locales; en-IN calls it IST
    if (/^GMT\+5:30$/.test(name)) name = fmt("en-IN") || name;
    return name;
  } catch {
    return "";
  }
}

/** Minutes a zone is ahead of UTC now (or at `at`, ms). */
export function tzOffsetMin(tz: string, at = Date.now()): number {
  try {
    const p: Record<string, string> = {};
    for (const x of new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(at))) p[x.type] = x.value;
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

const offsetText = (min: number) => {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
};

/** "(UTC+05:30) Asia/Kolkata" */
export const tzLabel = (tz: string) => `(${offsetText(tzOffsetMin(tz))}) ${tz.replace(/_/g, " ")}`;

// zones people here pick most, shown first
const COMMON = [
  "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "UTC",
];

/** Every zone this browser knows, sorted by UTC offset (a short list on old browsers). */
export function tzAll(): string[] {
  let all: string[] = [];
  try {
    all = (Intl as any).supportedValuesOf?.("timeZone") || [];
  } catch {
    all = [];
  }
  if (!all.length) all = COMMON;
  const now = Date.now();
  return [...new Set([...all.map(canonicalTz), "UTC"])].sort((a, b) => tzOffsetMin(a, now) - tzOffsetMin(b, now) || a.localeCompare(b));
}

/** Common zones (the browser's own first), for the top of the list. */
export const tzCommon = () => [...new Set([browserTz(), ...COMMON])];

/* ---- the searchable time-zone picker (components/PickerSelect) ---- */

// shown first, in this order: India, then US Eastern
const PINNED = ["Asia/Kolkata", "America/New_York"];
const NAMES: Record<string, { label: string; words: string }> = {
  "Asia/Kolkata": { label: "India — Kolkata", words: "india indian ist mumbai delhi new delhi chennai bangalore bengaluru hyderabad pune kolkata calcutta" },
  "America/New_York": { label: "US Eastern — New York", words: "est edt eastern us usa america united states new york washington boston miami atlanta" },
  "America/Chicago": { label: "US Central — Chicago", words: "cst cdt central us usa america united states chicago dallas houston" },
  "America/Denver": { label: "US Mountain — Denver", words: "mst mdt mountain us usa america united states denver" },
  "America/Phoenix": { label: "US Mountain (no DST) — Phoenix", words: "mst arizona us usa america united states phoenix" },
  "America/Los_Angeles": { label: "US Pacific — Los Angeles", words: "pst pdt pacific us usa america united states los angeles san francisco seattle" },
  "America/Anchorage": { label: "US Alaska — Anchorage", words: "akst akdt alaska us usa america" },
  "Pacific/Honolulu": { label: "US Hawaii — Honolulu", words: "hst hawaii us usa america" },
  "Europe/London": { label: "UK — London", words: "gmt bst uk united kingdom britain england london" },
  "Asia/Dubai": { label: "UAE — Dubai", words: "gst gulf uae united arab emirates dubai abu dhabi" },
  "Asia/Singapore": { label: "Singapore", words: "sgt singapore" },
  "Australia/Sydney": { label: "Australia — Sydney", words: "aest aedt australia sydney melbourne" },
};

const zoneName = (tz: string, style: "short" | "long", loc: string) => {
  try {
    return new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: style }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
};

export type TzOption = { value: string; label: string; group: string; keywords: string; hint: string };
let tzOptionsCache: TzOption[] | null = null;

/** Every zone for the picker: India and US Eastern first, then this browser's zone
    (if neither), then all zones by UTC offset; each searchable by city, country,
    abbreviation (IST, EST, PST…), full name and offset. */
export function tzPickerOptions(): TzOption[] {
  if (tzOptionsCache) return tzOptionsCache;
  const now = Date.now();
  const mine = browserTz();
  const make = (tz: string, group: string): TzOption => {
    const off = tzOffsetMin(tz, now);
    const known = NAMES[tz];
    const shortUs = zoneName(tz, "short", "en-US");
    const shortIn = zoneName(tz, "short", "en-IN");
    // a real abbreviation (IST, EDT…), not "GMT+4"
    const abbr = [shortIn, shortUs].find((n) => n && !/^(GMT|UTC)/.test(n)) || "";
    const a = Math.abs(off), h = Math.floor(a / 60), m = a % 60, sign = off < 0 ? "-" : "+";
    const offsets = [`utc${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, `gmt${sign}${h}${m ? ":" + m : ""}`, `${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`];
    return {
      value: tz,
      label: `(${offsetText(off)}) ${known ? known.label : tz.replace(/_/g, " ")}`,
      group,
      hint: abbr + (tz === mine ? (abbr ? " · yours" : "yours") : ""),
      keywords: [tz.replace(/[_/]/g, " "), known?.words || "", zoneName(tz, "long", "en-US"), shortUs, shortIn, ...offsets, tz === mine ? "your mine local" : ""]
        .join(" ")
        .toLowerCase(),
    };
  };
  const pinned = PINNED.map((tz) => make(tz, "India & US Eastern"));
  const yours = PINNED.includes(mine) ? [] : [make(mine, "Your time zone")];
  const rest = tzAll()
    .filter((tz) => !PINNED.includes(tz) && tz !== mine)
    .map((tz) => make(tz, "All time zones"));
  tzOptionsCache = [...pinned, ...yours, ...rest];
  return tzOptionsCache;
}

/** A timestamp as the form's date + 24-hour time inputs, in `tz`. */
export function inputsInTz(ts: number | string, tz: string): { date: string; time: string } {
  const n = Number(ts);
  if (!(n > 0)) return { date: "", time: "" };
  try {
    const p: Record<string, string> = {};
    for (const x of new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(n * 1000))) p[x.type] = x.value;
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` };
  } catch {
    return { date: "", time: "" };
  }
}

/** The form's date + time in `tz` → a timestamp (seconds); NaN if incomplete. */
export function zonedToEpoch(date: string, time: string, tz: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  const t = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
  if (!d || !t) return NaN;
  const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let ms = wall - tzOffsetMin(tz, wall) * 60000;
  ms = wall - tzOffsetMin(tz, ms) * 60000;
  return Math.floor(ms / 1000);
}
