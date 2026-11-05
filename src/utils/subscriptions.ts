export type PlanKey = "bundle" | "monthly" | "individual";

export type Plan = {
  key: PlanKey;
  /** Small-caps label above the price. */
  tier: string;
  /** Rendered as-is. */
  price: string;
  /** Numeric dollars, recorded on the enrolment row for the admin's reference. */
  amount: number;
  unit: string;
  /** Struck-through original, where there is a genuine discount. */
  was?: string;
  /** e.g. "10% off" — only shown alongside `was`. */
  off?: string;
  note: string;
  features: string[];
  /** Spans both columns of the plan tab strip (the two subscriptions pair up). */
  wide?: boolean;
};

export const PLANS: Plan[] = [
  {
    key: "bundle",
    tier: "Subscription · Bundle",
    price: "$40", amount: 40, unit: "/ month",
    note: "Billed monthly · all programs · cancel anytime",
    features: [
      "Access to every Rivira Technologies program & track",
      "Full recorded video library",
      "2 new batches every year — join anytime",
      "Hands-on projects with expert feedback",
      "Program certificate on completion",
    ],
  },
  {
    key: "monthly",
    tier: "Subscription · Monthly",
    price: "$50", amount: 50, unit: "/ month",
    note: "Billed monthly · one program · cancel anytime",
    features: [
      "One program of your choice",
      "Live classes + recorded videos while subscribed",
      "Month-to-month flexibility",
      "1:1 mentor support & doubt sessions",
      "Program certificate on completion",
    ],
  },
  {
    key: "individual",
    tier: "Individual Course",
    price: "$450", amount: 450, unit: "/ one-time payment",
    was: "$500", off: "10% off",
    wide: true,
    note: "Pay once · lifetime access to this program",
    features: [
      "Finish the program in your own time",
      "Lifetime access to the recorded video library",
      "Hands-on projects with expert feedback",
      "Personalized project reviews",
      "Program certificate on completion",
    ],
  },
];

export const SUBSCRIPTIONS_ENABLED = true;

export const PLANS_PUBLISHED = true;
