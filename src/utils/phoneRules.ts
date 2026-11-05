/* How many digits the local (national) phone number has, per country — the
   number typed after the flag picker's dial code (/js/phoneinput.js), without
   the leading 0 some countries dial at home. Countries not listed get a general
   6–14 digits. Used by the website's custom forms (pages/website/PublicForm.tsx). */

const LENGTHS: Record<string, number[]> = {
  in: [10], us: [10], ca: [10], gb: [9, 10], ie: [9], au: [9], nz: [8, 9, 10],
  ae: [8, 9], sa: [9], qa: [8], kw: [8], om: [8], bh: [8], jo: [8, 9],
  sg: [8], my: [9, 10], th: [9], ph: [10], id: [9, 10, 11, 12], vn: [9, 10],
  cn: [11], jp: [10], kr: [9, 10], hk: [8], tw: [9],
  pk: [10], bd: [10], np: [10], lk: [9], mv: [7], af: [9],
  za: [9], ng: [10], ke: [9], gh: [9], eg: [10], ug: [9], tz: [9], et: [9],
  fr: [9], de: [10, 11], it: [9, 10], es: [9], pt: [9], nl: [9], be: [8, 9],
  ch: [9], at: [10, 11, 12, 13], se: [7, 8, 9], no: [8], dk: [8], fi: [9, 10],
  pl: [9], ru: [10], ua: [9], tr: [10], il: [9], gr: [10],
  br: [10, 11], mx: [10], ar: [10], cl: [9], co: [10], pe: [9],
};

export type PhoneLimits = { min: number; max: number; lengths: number[] | null };

export function phoneLimits(iso2?: string): PhoneLimits {
  const l = LENGTHS[String(iso2 || "").toLowerCase()];
  return l ? { min: Math.min(...l), max: Math.max(...l), lengths: l } : { min: 6, max: 14, lengths: null };
}

/** Digits only; a home-dialling leading 0 is dropped when the number has one digit too many. */
export function normalizeLocal(value: string, iso2?: string): string {
  const d = String(value || "").replace(/\D/g, "");
  const { max } = phoneLimits(iso2);
  return d.length === max + 1 && d.startsWith("0") ? d.slice(1) : d;
}

/** Most digits the box should take for this country (one extra while it starts with 0). */
export function maxTyped(value: string, iso2?: string): number {
  const { max } = phoneLimits(iso2);
  return String(value || "").startsWith("0") ? max + 1 : max;
}

/** true when the local number has a valid length for the country (and the whole number fits E.164's 15 digits). */
export function isValidLocal(local: string, iso2?: string, dial?: string): boolean {
  const d = normalizeLocal(local, iso2);
  const { min, max, lengths } = phoneLimits(iso2);
  const okLen = lengths ? lengths.includes(d.length) : d.length >= min && d.length <= max;
  return okLen && (String(dial || "") + d).length <= 15;
}

/** "10 digits" / "9 or 10 digits" / "6 to 14 digits", for the error message. */
export function lengthText(iso2?: string): string {
  const { min, max, lengths } = phoneLimits(iso2);
  if (!lengths) return `${min} to ${max} digits`;
  if (lengths.length === 1) return `${lengths[0]} digits`;
  const sorted = [...lengths].sort((a, b) => a - b);
  return sorted.length === 2 ? `${sorted[0]} or ${sorted[1]} digits` : `${sorted[0]} to ${sorted[sorted.length - 1]} digits`;
}
