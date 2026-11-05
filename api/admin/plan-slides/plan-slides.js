/**
 * API routes for src/pages/panel/admin/PlanSlides.tsx.
 * The routes and tables live in ./plan-slides-core.js; this registers them.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const planSlides = require("./plan-slides-core");

module.exports = (router, ctx) => {
    const { db, verifyAccount } = ctx;

    /* ---- Home plan slider: admin CRUD + public read (plan-slides-core.js) ---- */
    planSlides.register(router, db, verifyAccount);
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/plan-slides" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "plan_section" },
    { table: "plan_slides" },
];
