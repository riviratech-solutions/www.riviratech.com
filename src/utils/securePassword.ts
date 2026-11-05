// A random account password made with the browser's secure random generator
// (crypto.getRandomValues, not Math.random). It always has a lowercase letter,
// an uppercase letter, a digit and a symbol, and leaves out look-alike
// characters (I l 1 O 0) because students type it from their welcome email.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "@#$%*!?"; // no & < > — the password is put into an HTML email

// a uniform index below n (rejects the values that would bias the result)
const pick = (n: number) => {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
};
const from = (set: string) => set[pick(set.length)];

export function securePassword(length = 12): string {
  const all = LOWER + UPPER + DIGIT + SYMBOL;
  const chars = [from(LOWER), from(UPPER), from(DIGIT), from(SYMBOL)];
  while (chars.length < Math.max(length, 8)) chars.push(from(all));
  // shuffle so the guaranteed characters aren't always at the start
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
