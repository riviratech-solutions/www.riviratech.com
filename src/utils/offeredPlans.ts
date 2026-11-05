/**
 * Which subscription plans are on offer, as last answered by api/get-plan-slides.
 *
 * The program page lays its hero out differently with and without plans
 * (headline + price card vs. a centered headline). Until the API answers it
 * can't know which, so it used to render one layout and then jump to the other.
 * Remembering the last answer — the home page fetches the same data — lets the
 * first render already use the right one; the fresh answer still wins.
 */
const KEY = "kkr.offeredPlans";

/** The plan keys a get-plan-slides response offers ([] when the section is off). */
export function offeredFromResponse(data: any): string[] {
  if (data?.section?.status === "0") return [];
  return (data?.data || []).map((d: any) => d.plan).filter(Boolean);
}

export function saveOfferedPlans(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* storage unavailable — the page just falls back to waiting */
  }
}

/** Last known answer, or null when there isn't one yet. */
export function readOfferedPlans(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}
