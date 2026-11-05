/**
 * Client-side duplicate-submission guard for the public forms (Workshop
 * registration, Contact). Blocks the same visitor from submitting the same form
 * more than once with the same email address or phone number, from this browser.
 *
 * NOTE: this is UX / light abuse-prevention only — the authoritative dedup lives
 * in the Google Apps Script backend (isDuplicate). Because the forms post with
 * `mode: "no-cors"`, the browser can't read the backend's "duplicate" response,
 * so we track submissions locally too and give the user immediate feedback. Like
 * useAuthRateLimit, it is intentionally easy to reset (clearing localStorage / a
 * new browser) — the real guard is server-side.
 */

const STORAGE_PREFIX = "kkr_form_submits_";

interface SubmittedEntry {
  email: string;
  phone: string;
  at: number; // epoch ms
}

function storageKey(form: string) {
  return `${STORAGE_PREFIX}${form}`;
}

function read(form: string): SubmittedEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(form));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SubmittedEntry[]) : [];
  } catch {
    // localStorage unavailable / corrupt — treat as no history.
    return [];
  }
}

function write(form: string, entries: SubmittedEntry[]) {
  try {
    localStorage.setItem(storageKey(form), JSON.stringify(entries));
  } catch {
    // private mode / quota exceeded — ignore.
  }
}

/** Lowercased + trimmed so "Jane@Mail.com " and "jane@mail.com" match. */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Digits only, so "+1 (555) 000-1234" and "5550001234" match. A US +1 prefix
 * (11 digits starting with 1) is stripped so the +1 form and the bare 10-digit
 * form are treated as the same number. "" if blank.
 */
export function normalizePhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/**
 * Returns which credential already submitted this form ("email" | "phone"), or
 * null if this is a fresh submission. Pass `windowMs` to only block for a period
 * (e.g. 24h); omit it to block the same credentials once, ever, on this browser.
 */
export function findDuplicateSubmission(
  form: string,
  email: string,
  phone: string,
  windowMs?: number
): "email" | "phone" | null {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  const now = Date.now();

  for (const entry of read(form)) {
    if (windowMs && now - entry.at > windowMs) continue;
    if (e && entry.email === e) return "email";
    if (p && entry.phone && entry.phone === p) return "phone";
  }
  return null;
}

/** Record a submission so future identical ones (same email/phone) are blocked. */
export function recordSubmission(form: string, email: string, phone: string) {
  const entries = read(form);
  entries.push({
    email: normalizeEmail(email),
    phone: normalizePhone(phone),
    at: Date.now(),
  });
  // Cap history so localStorage can't grow unbounded on shared kiosks.
  write(form, entries.slice(-200));
}
