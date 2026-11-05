export const PROGRAM = {
  name: "AI Launchpad Program",
  durationWeeks: 16,
  priceUSD: 750,
  priceINRLabel: "71,000 INR",
  learnersLabel: null as string | null,
  enrollmentOpen: true,
} as const;

/** e.g. "16-Week Program" — used in badges and section labels. */
export const durationLabel = `${PROGRAM.durationWeeks}-Week`;
