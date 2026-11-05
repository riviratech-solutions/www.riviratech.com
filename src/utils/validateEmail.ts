const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export const EMAIL_PATTERN = "[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)*\\.[A-Za-z]{2,}";

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  // Guard the length before the regex: the local part is capped at 64 and the
  // whole address at 254 by RFC, and it keeps pathological input cheap.
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

/** Message to show when isValidEmail fails. Kept here so it reads the same everywhere. */
export const EMAIL_ERROR = "Please enter a valid email address, e.g. jane@example.com";
