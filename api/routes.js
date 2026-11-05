/**
 * Every /api route. server.js mounts this router at /api.
 *
 * Routes live next to the page that uses them:
 *   account/          sign-in, sign-out, password reset, own sessions, security token
 *   admin/<page>/     one folder per admin panel page (src/pages/panel/admin)
 *   student/<page>/   the student panel (src/pages/panel/student)
 *   trainer/<page>/   the trainer panel (src/pages/panel/trainer)
 *   website/<page>/   the public website (src/pages/website)
 *   shared/           helpers (core.js), file uploads and lookups used by many pages
 *
 * Each page file exports (router, ctx) => { ...routes }, and optionally `tables`:
 * the tables whose deleted rows are filed under that page in deleted_records.
 */
const express = require("express");
const deletedRecords = require("./shared/deleted-records");
const startup = require("./shared/startup");

const router = express.Router();

const PAGES = {
    // account
    "account": require("./account/account"),
    // shared
    "shared/uploads": require("./shared/uploads"),
    "shared/lookups": require("./shared/lookups"),
    // admin panel
    "admin/activities": require("./admin/activities/activities"),
    "admin/adminers": require("./admin/adminers/adminers"),
    "admin/ai-chatbot": require("./admin/ai-chatbot/ai-chatbot"),
    "admin/assignments": require("./admin/assignments/assignments"),
    "admin/backup": require("./admin/backup/backup"),
    "admin/batches": require("./admin/batches/batches"),
    "admin/blog-categories": require("./admin/blog-categories/blog-categories"),
    "admin/blogimgs": require("./admin/blogimgs/blogimgs"),
    "admin/blogs": require("./admin/blogs/blogs"),
    "admin/certificate-requests": require("./admin/certificate-requests/certificate-requests"),
    "admin/certificates": require("./admin/certificates/certificates"),
    "admin/courses": require("./admin/courses/courses"),
    "admin/custom-forms": require("./admin/custom-forms/custom-forms"),
    "admin/custom-pages": require("./admin/custom-pages/custom-pages"),
    "admin/dashboard": require("./admin/dashboard/dashboard"),
    "admin/enrollees": require("./admin/enrollees/enrollees"),
    "admin/events": require("./admin/events/events"),
    "admin/feedbacks": require("./admin/feedbacks/feedbacks"),
    "admin/gallery": require("./admin/gallery/gallery"),
    "admin/jobs": require("./admin/jobs/jobs"),
    "admin/live-classes": require("./admin/live-classes/live-classes"),
    "admin/login-blocks": require("./admin/login-blocks/login-blocks"),
    "admin/login-sessions": require("./admin/login-sessions/login-sessions"),
    "admin/my-profile": require("./admin/my-profile/my-profile"),
    "admin/newsletter": require("./admin/newsletter/newsletter"),
    "admin/plan-slides": require("./admin/plan-slides/plan-slides"),
    "admin/surveys": require("./admin/surveys/surveys"),
    "admin/qa-session": require("./admin/qa-session/qa-session"),
    "admin/raisedtickets": require("./admin/raisedtickets/raisedtickets"),
    "admin/referredfriends": require("./admin/referredfriends/referredfriends"),
    "admin/site-feedback": require("./admin/site-feedback/site-feedback"),
    "admin/stripe-coupons": require("./admin/stripe-coupons/stripe-coupons"),
    "admin/stripe-promo-codes": require("./admin/stripe-promo-codes/stripe-promo-codes"),
    "admin/students": require("./admin/students/students"),
    "admin/students-inquiries": require("./admin/students-inquiries/students-inquiries"),
    "admin/subscriptions": require("./admin/subscriptions/subscriptions"),
    "admin/testimonials": require("./admin/testimonials/testimonials"),
    "admin/marquees": require("./admin/marquees/marquees"),
    "admin/server-logs": require("./admin/server-logs/server-logs"),
    "admin/dashboard-notices": require("./admin/dashboard-notices/dashboard-notices"),
    "admin/trainercontacts": require("./admin/trainercontacts/trainercontacts"),
    "admin/trainers": require("./admin/trainers/trainers"),
    "admin/webcontacts": require("./admin/webcontacts/webcontacts"),
    "admin/workshop-registrations": require("./admin/workshop-registrations/workshop-registrations"),
    "admin/workshops": require("./admin/workshops/workshops"),
    "admin/youtube": require("./admin/youtube/youtube"),
    "admin/partners": require("./admin/partners/partners"),
    "admin/class-schedules": require("./admin/class-schedules/class-schedules"),
    // student panel
    "student/dashboard": require("./student/dashboard/dashboard"),
    "student/assignments": require("./student/assignments/assignments"),
    "student/live-classes": require("./student/live-classes/live-classes"),
    "student/my-feedback": require("./student/my-feedback/my-feedback"),
    "student/my-tickets": require("./student/my-tickets/my-tickets"),
    "student/trainer-contacts": require("./student/trainer-contacts/trainer-contacts"),
    "student/surveys": require("./student/surveys/surveys"),
    // trainer panel
    "trainer/dashboard": require("./trainer/dashboard/dashboard"),
    "trainer/trainer-contacts": require("./trainer/trainer-contacts/trainer-contacts"),
    // website
    "website/home": require("./website/home/home"),
    "website/contact": require("./website/contact/contact"),
    "website/enroll": require("./website/enroll/enroll"),
    "website/courses": require("./website/courses/courses"),
    "website/gallery": require("./website/gallery/gallery"),
    "website/blogs": require("./website/blogs/blogs"),
    "website/events": require("./website/events/events"),
    "website/payment": require("./website/payment/payment"),
    "website/program-genai": require("./website/program-genai/program-genai"),
    "website/workshop": require("./website/workshop/workshop"),
    "website/careers": require("./website/careers/careers"),
    "website/public-form": require("./website/public-form/public-form"),
    "website/custom-page": require("./website/custom-page/custom-page"),
    "website/certificate-download": require("./website/certificate-download/certificate-download"),
    "website/certificate-request": require("./website/certificate-request/certificate-request"),
    "website/surveys": require("./website/surveys/surveys"),
    "website/newsletter": require("./website/newsletter/newsletter"),
};

module.exports = (db) => {
    // Shared helpers and one-time table setup; runs before any page registers.
    const ctx = require("./shared/core")(router, db);

    for (const register of Object.values(PAGES)) register(router, ctx);

    // Copy every deleted row to deleted_records, filed under its page.
    const categories = Object.entries(PAGES)
        .filter(([, page]) => page.tables)
        .map(([category, page]) => ({ category, tables: page.tables }));
    // Pages that create their own tables (module.exports.init) go first, so
    // every table exists when the deleted_records triggers are installed.
    // One process only (shared/startup.js): the cluster's leader copy.
    startup.setup("deleted_records", () =>
        Promise.all(Object.values(PAGES).map((page) => (page.init ? page.init(db).catch(() => {}) : null)))
            .then(() => deletedRecords.ensure(db, categories)));

    return router;
};
