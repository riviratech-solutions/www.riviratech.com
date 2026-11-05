/**
 * Prices of the Enroll page's "Full Program" (src/pages/website/Enroll.tsx):
 * the program price (src/utils/program.ts → priceUSD) and the OPT / STEM OPT
 * add-on (ADDON_PRICE in Enroll.tsx).
 *
 * The API charges these, never a fee sent by the browser (a student could
 * otherwise enrol with any fee and pay it), so keep them in step with those
 * two files when the price changes.
 */
const FULL_PROGRAM_USD = 750;
const OPT_ADDON_USD = 200;

// Enroll.tsx names its plans "Full Program ($750)" and
// "Full Program + OPT/STEM OPT ($950)".
const isFullProgramPlan = (plan) => /^Full Program\b/.test(String(plan || "").trim());

// Fee of a Full Program enrolment: with the add-on when either the add-on
// field or the plan name says so.
function fullProgramFee(addon, plan) {
    const withAddon = String(addon || "").trim() !== "" || /OPT/i.test(String(plan || ""));
    return FULL_PROGRAM_USD + (withAddon ? OPT_ADDON_USD : 0);
}

module.exports = { FULL_PROGRAM_USD, OPT_ADDON_USD, isFullProgramPlan, fullProgramFee };
