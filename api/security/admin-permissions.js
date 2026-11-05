/* Admin page permissions for adminers with role "Y" (Admin).

   A super admin (X) always has every permission. An Admin (Y) gets a per-page
   set of actions, saved as JSON in members.permissions:

     { "students": ["view", "edit", "status"], "blogs": ["view", "create"], ... }

   members.permissions = NULL means the account was created before permissions
   existed — it keeps full access until a super admin saves its permissions.

   Every page has "view" (open the page, list / search). The other actions are
   the page's own operations — add, edit, enable/disable, accept/reject, send,
   reorder, delete … — and each one needs "view" too.

   Inner pages (opened from another page, e.g. Batches from Courses) name that
   page as `parent`: any permission on the inner page also gives the parent's
   "view", and without the parent's "view" the inner page gets nothing.

   Page keys match the panel URLs (/panel/<key>, Dashboard = /dashboard) and the
   sidebar's active keys, so the panel uses the same keys to hide menu entries. */

// Common action labels; a page can use its own label with [key, label].
const LABELS = {
    view: "View",
    create: "Add",
    edit: "Edit",
    status: "Enable / disable",
    approve: "Accept / reject",
    reorder: "Reorder",
    delete: "Delete",
};

const page = (key, label, actions, parent) => ({
    key,
    label,
    actions: actions.map((a) => (Array.isArray(a) ? { key: a[0], label: a[1] } : { key: a, label: LABELS[a] })),
    ...(parent ? { parent } : {}),
});

const CATALOGUE = [
    { group: "Dashboard", pages: [
        page("dashboard", "Dashboard & analytics", ["view"]),
    ] },
    { group: "Student Management", pages: [
        page("students-inquiries", "Student inquiries", ["view", ["payment", "Send payment link"],
            ["subscribe", "Add subscription"], ["reject", "Reject"], ["delete", "Delete rejected"]]),
        page("enrollees", "Enrollees", ["view", "approve"]),
        page("students", "Students", ["view", "edit", "status", "delete"]),
        page("certificate-requests", "Certificate requests", ["view", "edit", "approve",
            ["account", "Create student account"]]),
        page("assignments", "Assignments", ["view", "create", "edit", "status", ["complete", "Mark complete"],
            ["review", "Accept / reject submissions"], "delete"]),
        page("live-classes", "Live classes", ["view", "create", "edit", ["cancel", "Cancel / reopen / enable / disable"],
            ["start", "Start class"], ["recording", "Add recordings"], "delete"]),
    ] },
    { group: "Training", pages: [
        page("trainers", "Trainers", ["view", "create", "edit", "status", "delete"]),
        page("trainer-contacts", "Trainer contacts", ["view"]),
        page("courses", "Courses", ["view", "create", "edit", "status", "delete"]),
        page("batches", "Batches", ["view", "create", "edit", "status", "delete"], "courses"),
        page("class-schedules", "Class schedules & course resources", ["view", "create", "edit", ["status", "Show / hide"], "delete"]),
    ] },
    { group: "Content", pages: [
        page("events", "Events", ["view", "create", "edit", "status", "delete", ["end", "End event"],
            ["notify", "Send notifications"]]),
        page("workshops", "Workshops", ["view", "create", "edit", ["status", "Activate / deactivate"], "delete"]),
        page("gallery", "Gallery", ["view", "create", "status", "reorder", "delete"]),
        page("blogs", "Blogs", ["view", "create", "edit", "status", "delete"]),
        page("blog-categories", "Blog categories", ["view", "create", "edit", "delete"], "blogs"),
        page("testimonials", "Testimonials", ["view", "create", "edit", ["status", "Show / hide"], "reorder", "delete"]),
        page("youtube", "YouTube videos", ["view", "create", "edit", ["status", "Show / hide"], "reorder", "delete"]),
        page("partners", "Partners (Trusted by)", ["view", "create", "edit", ["status", "Show / hide"], "reorder", "delete"]),
        page("marquees", "Marquee messages", ["view", "create", "edit", ["status", "Show / hide"], "reorder", "delete"]),
        page("plan-slides", "Plan slides (home)", ["view", "create", "edit", ["status", "Show / hide"], "reorder", "delete",
            ["section", "Edit section heading"]]),
    ] },
    { group: "Communication", pages: [
        page("web-contacts", "Web contacts", ["view"]),
        page("qa-session", "Q & A session", ["view", ["answer", "Answer questions"], "delete"]),
        page("feedbacks", "Feedbacks", ["view"]),
        page("newsletter", "Newsletter", ["view", "delete"]),
        page("site-feedback", "Site feedback", ["view", ["status", "Mark reviewed / new"], "delete"]),
        page("workshop-registrations", "Workshop registrations", ["view", ["status", "Mark contacted / new"], "delete"]),
        page("raised-tickets", "Raised tickets", ["view", ["status", "In progress / resolve"], "delete"]),
        page("dashboard-notices", "Dashboard notices", ["view", "create", "edit", ["status", "Show / hide"], "reorder",
            ["replies", "Handle replies"], "delete"]),
    ] },
    { group: "Business", pages: [
        page("subscriptions", "Subscriptions", ["view", "create", "edit"]),
        page("referred-friends", "Referred friends", ["view", "delete"]),
    ] },
    { group: "Administration", pages: [
        page("backup", "Backup & export", ["view", ["download", "Download backups"]]),
        page("coupons", "Stripe coupons", ["view", "create", "edit", "delete"]),
        page("promotion-codes", "Promotion codes", ["view", "create", ["status", "Activate / deactivate"]], "coupons"),
        page("forms", "Custom forms", ["view", "create", "edit", ["submissions", "View submissions"], "delete"]),
        page("pages", "Custom pages", ["view", "create", "edit", "status", "delete"]),
        page("surveys", "Surveys", ["view", "create", "edit", "status", ["responses", "View responses"],
            ["send", "Send emails"], "delete"]),
        page("jobs", "Careers / jobs", ["view", "create", "edit", ["status", "Open / close"],
            ["applications", "View applications"], "delete"]),
        page("adminers", "Adminers (list only)", ["view"]),
        page("activities", "Activity log", ["view"]),
        page("login-blocks", "Login blocks", ["view", ["create", "Add block"], ["status", "Revoke"], "delete"]),
        page("login-sessions", "Login sessions", ["view", ["status", "Sign out sessions"]]),
        page("server-logs", "Server logs", ["view"]),
    ] },
];

// One-line summary under each page in the adminer permission editor.
const DESCRIPTIONS = {
    "dashboard": "Access the dashboard overview, figures and charts.",
    "students-inquiries": "Manage student inquiries and related actions.",
    "enrollees": "Review enrolment requests and approve payments.",
    "students": "Manage student profiles and status.",
    "certificate-requests": "Review certificate requests and create accounts.",
    "assignments": "Create assignments and review submissions.",
    "live-classes": "Schedule live classes and add recordings.",
    "trainers": "Manage trainer profiles and access.",
    "trainer-contacts": "View messages sent to trainers.",
    "courses": "Manage courses and their settings.",
    "batches": "Manage batches inside courses.",
    "events": "Create events and send notifications.",
    "workshops": "Manage workshops and their status.",
    "gallery": "Upload, arrange and hide gallery images.",
    "blogs": "Write and publish blog posts.",
    "blog-categories": "Organise blog categories.",
    "testimonials": "Manage testimonials shown on the site.",
    "marquees": "Scrolling messages in the website header and footer.",
    "youtube": "Manage YouTube videos on the home page.",
    "class-schedules": "Set each batch's weekly class times and the course resources, shown to students.",
    "partners": "Manage the partner logos in the home page's \"Trusted by\" strip.",
    "plan-slides": "Manage the home page plan slider.",
    "web-contacts": "View messages from the website contact form.",
    "qa-session": "Answer and manage student questions.",
    "feedbacks": "View course feedback from students.",
    "newsletter": "Manage newsletter subscribers.",
    "site-feedback": "Review ratings and notes from the website.",
    "workshop-registrations": "Manage workshop registrations.",
    "raised-tickets": "Handle support tickets raised by students.",
    "dashboard-notices": "Post notices on the student dashboard and handle replies.",
    "subscriptions": "Manage student subscriptions.",
    "referred-friends": "View and manage referred friends.",
    "backup": "Export and download database backups.",
    "coupons": "Manage Stripe discount coupons.",
    "promotion-codes": "Manage promotion codes for coupons.",
    "forms": "Build custom forms and view submissions.",
    "pages": "Create and publish custom pages.",
    "surveys": "Run surveys, view responses and send emails.",
    "jobs": "Post job openings and view applications.",
    "adminers": "View the list of panel accounts.",
    "activities": "View the panel activity log.",
    "login-blocks": "Manage sign-in blocks for accounts and IPs.",
    "login-sessions": "View and end members' sign-in sessions.",
    "server-logs": "Read the website, API and assistant service logs.",
};

const PAGES = {};
for (const g of CATALOGUE) for (const p of g.pages) {
    PAGES[p.key] = p;
    if (DESCRIPTIONS[p.key]) p.desc = DESCRIPTIONS[p.key];
}
const PAGE_ACTIONS = {};
for (const k of Object.keys(PAGES)) PAGE_ACTIONS[k] = PAGES[k].actions.map((a) => a.key);

/* API route -> what an Admin (Y) needs to call it: "page:action", a list of
   them when several pages use the route (any one is enough), or a function of
   the request body for routes that both add and edit. Routes not listed here
   (shared lookups such as /get-courses, profile, uploads) are not gated. */
const ROUTES = {};
const R = (pageKey, action, routes) => routes.forEach((r) => {
    const need = pageKey + ":" + action;
    ROUTES[r] = ROUTES[r] ? [].concat(ROUTES[r], need) : need;
});
// one save route for add + edit: an id in the body means edit
const SAVE = (pageKey, route, idField) => {
    ROUTES[route] = (body) => pageKey + ":" + (body && body[idField] ? "edit" : "create");
};

R("dashboard", "view", ["/dashboard-stats", "/dashboard-snapshot"]);

R("students-inquiries", "view", ["/inquiries-received"]);
R("students-inquiries", "payment", ["/payment-request"]);
R("students-inquiries", "subscribe", ["/subscriptions/add"]);
R("students-inquiries", "reject", ["/reject-inquiry"]);
R("students-inquiries", "delete", ["/delete-inquiry"]);
R("enrollees", "view", ["/enrollees"]);
R("enrollees", "approve", ["/accept-enroll", "/reject-enroll"]);
R("students", "view", ["/students"]);
R("students", "edit", ["/update-student"]);
R("students", "status", ["/disable-student", "/enable-student"]);
R("students", "delete", ["/delete-student", "/purge-student"]);
R("certificate-requests", "view", ["/certificates"]);
R("certificate-requests", "edit", ["/update-certificate-request"]);
R("certificate-requests", "approve", ["/accept-certificate", "/reject-certificate"]);
R("certificate-requests", "account", ["/check-student-account", "/create-student-from-request"]);
R("assignments", "view", ["/assignments", "/sub-assignments"]);
R("assignments", "create", ["/add-assignment"]);
R("assignments", "edit", ["/update-assignment"]);
R("assignments", "status", ["/disable-assignment", "/enable-assignment"]);
R("assignments", "complete", ["/complete-assignment"]);
R("assignments", "review", ["/approve-subassignment", "/reject-subassignment"]);
R("assignments", "delete", ["/delete-assignment"]);
R("live-classes", "view", ["/live-classes", "/class-overview"]); // + the Classes page (view only)
R("live-classes", "view", ["/class-views/report", "/class-view/lock-status"]); // students' class video viewing (class-views.js)
R("live-classes", "edit", ["/class-view/lock-set"]); // a batch's "watch in order" lock
R("live-classes", "create", ["/add-class"]);
R("live-classes", "edit", ["/update-class", "/class-video-length"]);
R("live-classes", "cancel", ["/cancel-class", "/reopen-class", "/class-visibility"]);
R("live-classes", "start", ["/live-class-start"]);
R("live-classes", "recording", ["/update-class-video", "/update-class-video-link", "/class-video-retry"]);
// a browser upload to Google Drive, from the add / edit / recording forms
R("live-classes", "create", ["/class-drive-upload"]);
R("live-classes", "edit", ["/class-drive-upload"]);
R("live-classes", "recording", ["/class-drive-upload"]);
R("live-classes", "delete", ["/delete-class", "/class-video-delete-original"]);

R("trainers", "view", ["/trainers"]);
R("trainers", "create", ["/add-trainer"]);
R("trainers", "edit", ["/update-trainer"]);
R("trainers", "status", ["/disable-trainer", "/enable-trainer"]);
R("trainers", "delete", ["/delete-trainer"]);
// opening a contact marks it viewed, so that comes with view
R("trainer-contacts", "view", ["/trainer-contacts", "/viewed-trainer-contact"]);
R("courses", "view", ["/courses"]);
R("courses", "create", ["/add-course"]);
R("courses", "edit", ["/update-course"]);
R("courses", "status", ["/disable-course", "/enable-course"]);
R("courses", "delete", ["/delete-course", "/purge-course"]);
R("batches", "view", ["/batches"]);
R("batches", "create", ["/add-batch"]);
R("batches", "edit", ["/update-batch"]);
R("batches", "status", ["/disable-batch", "/enable-batch", "/batch-progress"]);
R("batches", "delete", ["/delete-batch", "/purge-batch"]);

R("class-schedules", "view", ["/class-schedules"]);
SAVE("class-schedules", "/class-schedules/save", "id");
R("class-schedules", "status", ["/class-schedules/toggle"]);
R("class-schedules", "delete", ["/class-schedules/delete"]);
R("class-schedules", "view", ["/course-resources"]);
SAVE("class-schedules", "/course-resources/save", "id");
R("class-schedules", "edit", ["/course-resources/reorder"]);
R("class-schedules", "status", ["/course-resources/toggle"]);
R("class-schedules", "delete", ["/course-resources/delete"]);

R("events", "view", ["/events", "/event/notifies"]);
R("events", "create", ["/add-event"]);
R("events", "edit", ["/update-event"]);
R("events", "status", ["/disable-event", "/enable-event"]);
R("events", "delete", ["/delete-event"]);
R("events", "end", ["/end-event"]);
R("events", "notify", ["/event/send-notifications"]);
R("workshops", "view", ["/workshop-list"]);
R("workshops", "create", ["/workshop-add", "/workshop-duplicate"]);
R("workshops", "edit", ["/workshop-update"]);
R("workshops", "status", ["/workshop-activate", "/workshop-deactivate"]);
R("workshops", "delete", ["/workshop-delete"]);
R("gallery", "view", ["/galleryimgs"]);
R("gallery", "create", ["/add-galleryimg", "/update-galleryimg"]);
R("gallery", "status", ["/disable-galleryimg", "/enable-galleryimg"]);
R("gallery", "reorder", ["/update-gallery-order"]);
R("gallery", "delete", ["/delete-galleryimg"]);
R("blogs", "view", ["/blogs", "/blogimgs", "/blog-categories"]);
// blog images are added / removed while writing a post
R("blogs", "create", ["/add-blog", "/add-blogimg", "/add-blogimgs"]);
R("blogs", "edit", ["/update-blog", "/delete-blogimg"]);
R("blogs", "status", ["/disable-blog", "/enable-blog"]);
R("blogs", "delete", ["/delete-blog"]);
R("blog-categories", "view", ["/blog-categories"]);
R("blog-categories", "create", ["/add-blog-category"]);
R("blog-categories", "edit", ["/update-blog-category"]);
R("blog-categories", "delete", ["/delete-blog-category"]);
R("marquees", "view", ["/marquees-list"]);
SAVE("marquees", "/marquees-save", "id"); // id = edit, none = create
R("marquees", "status", ["/marquees-toggle"]);
R("marquees", "reorder", ["/marquees-reorder"]);
R("marquees", "delete", ["/marquees-delete"]);
R("testimonials", "view", ["/testimonials-list"]);
R("testimonials", "create", ["/testimonials-add"]);
R("testimonials", "edit", ["/testimonials-update"]);
R("testimonials", "status", ["/testimonials-toggle"]);
R("testimonials", "reorder", ["/testimonials-reorder"]);
R("testimonials", "delete", ["/testimonials-delete"]);
R("testimonials", "view", ["/testimonials-section-get"]);
R("testimonials", "status", ["/testimonials-section-set"]); // whole section on/off
R("youtube", "view", ["/youtube-list"]);
R("youtube", "create", ["/youtube-add"]);
R("youtube", "edit", ["/youtube-update"]);
R("youtube", "status", ["/youtube-toggle"]);
R("youtube", "reorder", ["/youtube-reorder"]);
R("youtube", "delete", ["/youtube-delete"]);
R("youtube", "view", ["/youtube-section-get"]);
R("youtube", "status", ["/youtube-section-set"]); // whole section on/off

R("partners", "view", ["/partners-list", "/partners-section-get"]);
R("partners", "create", ["/partners-add"]);
R("partners", "edit", ["/partners-update"]);
R("partners", "status", ["/partners-toggle", "/partners-section-set"]);
R("partners", "reorder", ["/partners-reorder"]);
R("partners", "delete", ["/partners-delete"]);
R("plan-slides", "view", ["/plan-slides/list"]);
SAVE("plan-slides", "/plan-slides/save", "id");
R("plan-slides", "status", ["/plan-slides/toggle"]);
R("plan-slides", "reorder", ["/plan-slides/reorder"]);
R("plan-slides", "delete", ["/plan-slides/delete"]);
R("plan-slides", "section", ["/plan-slides/section"]);

R("web-contacts", "view", ["/web-contacts", "/viewed-web-contact"]);
R("qa-session", "view", ["/qa-list", "/qa-trainers"]);
R("qa-session", "answer", ["/qa-answer"]);
R("qa-session", "delete", ["/qa-delete"]);
R("feedbacks", "view", ["/feedbacks"]);
R("newsletter", "view", ["/newsletter/list"]);
R("newsletter", "delete", ["/newsletter/delete"]);
R("site-feedback", "view", ["/site-feedback/list"]);
R("site-feedback", "status", ["/site-feedback/status"]);
R("site-feedback", "delete", ["/site-feedback/delete"]);
R("workshop-registrations", "view", ["/workshop-registrations/list"]);
R("workshop-registrations", "status", ["/workshop-registrations/status"]);
R("workshop-registrations", "delete", ["/workshop-registrations/delete"]);
R("raised-tickets", "view", ["/raised-tickets"]);
R("raised-tickets", "status", ["/change-ticket"]);
R("raised-tickets", "delete", ["/delete-ticket"]);
R("dashboard-notices", "view", ["/notices-list", "/notice-replies-list", "/notice-student"]);
SAVE("dashboard-notices", "/notices-save", "id"); // id = edit, none = create
R("dashboard-notices", "status", ["/notices-toggle"]);
R("dashboard-notices", "reorder", ["/notices-reorder"]);
R("dashboard-notices", "replies", ["/notice-replies-status", "/notice-replies-delete"]);
R("dashboard-notices", "delete", ["/notices-delete"]);

R("subscriptions", "view", ["/subscriptions", "/students/search"]);
R("subscriptions", "create", ["/subscriptions/add"]);
R("subscriptions", "edit", ["/subscriptions/update"]);
R("referred-friends", "view", ["/refers"]);
R("referred-friends", "delete", ["/delete-refer"]);

R("backup", "view", ["/backup/tables"]);
R("backup", "download", ["/backup/verify-token", "/backup/table", "/backup/all-sql"]);
R("coupons", "view", ["/stripe/coupons"]);
R("coupons", "create", ["/stripe/coupon/create"]);
R("coupons", "edit", ["/stripe/coupon/update"]);
R("coupons", "delete", ["/stripe/coupon/delete"]);
R("promotion-codes", "view", ["/stripe/promotion-codes", "/stripe/coupons"]);
R("promotion-codes", "create", ["/stripe/promotion-code/create"]);
R("promotion-codes", "status", ["/stripe/promotion-code/toggle"]);
R("forms", "view", ["/forms/list", "/forms/get"]);
SAVE("forms", "/forms/save", "id");
R("forms", "submissions", ["/forms/submissions"]);
R("forms", "delete", ["/forms/delete"]);
R("pages", "view", ["/pages"]);
R("pages", "create", ["/add-page"]);
R("pages", "edit", ["/update-page"]);
R("pages", "status", ["/disable-page", "/enable-page"]);
R("pages", "delete", ["/delete-page"]);
R("surveys", "view", ["/surveys", "/surveys/get"]);
SAVE("surveys", "/surveys/save", "req_id");
R("surveys", "status", ["/surveys/disable", "/surveys/enable"]);
R("surveys", "responses", ["/surveys/responses", "/surveys/students"]);
R("surveys", "send", ["/surveys/send-email"]);
R("surveys", "delete", ["/surveys/delete"]);
R("jobs", "view", ["/jobs/list", "/jobs/get"]);
SAVE("jobs", "/jobs/save", "req_id");
R("jobs", "status", ["/jobs/toggle"]);
R("jobs", "applications", ["/jobs/applications"]);
R("jobs", "delete", ["/jobs/delete"]);
R("adminers", "view", ["/adminers"]);
R("activities", "view", ["/activities", "/activities-actor"]);
R("login-blocks", "view", ["/login-blocks/list"]);
R("login-blocks", "create", ["/login-blocks/add"]);
R("login-blocks", "status", ["/login-blocks/revoke"]);
R("login-blocks", "delete", ["/login-blocks/delete"]);
R("login-sessions", "view", ["/login-sessions/list"]);
R("login-sessions", "status", ["/login-sessions/end"]);
R("server-logs", "view", ["/server-logs/status", "/server-logs/read"]);

// Raw DB value -> { page: [actions] } with only known pages/actions, or null
// (= full access, legacy) when nothing was ever saved.
function parsePermissions(raw) {
    if (raw == null || raw === "") return null;
    let obj = raw;
    if (typeof raw === "string") {
        try { obj = JSON.parse(raw); } catch { return {}; }
    }
    return sanitizePermissions(obj);
}

// Keep only catalogue pages/actions; any action implies view, and an inner
// page implies its parent's view.
function sanitizePermissions(obj) {
    const out = {};
    if (!obj || typeof obj !== "object") return out;
    // "Certificates" was merged into "Certificate requests": keep old grants
    if (Array.isArray(obj.certificates)) {
        const cr = Array.isArray(obj["certificate-requests"]) ? obj["certificate-requests"] : [];
        obj = { ...obj, "certificate-requests": [...new Set([...cr, ...obj.certificates])] };
    }
    for (const key of Object.keys(PAGE_ACTIONS)) {
        const want = Array.isArray(obj[key]) ? obj[key] : [];
        const acts = PAGE_ACTIONS[key].filter((a) => want.includes(a));
        if (acts.length && !acts.includes("view")) acts.unshift("view");
        if (acts.length) out[key] = acts;
    }
    for (const key of Object.keys(out)) {
        const parent = PAGES[key].parent;
        if (parent && !(out[parent] || []).includes("view")) out[parent] = ["view", ...(out[parent] || [])];
    }
    return out;
}

function fullPermissions() {
    const out = {};
    for (const key of Object.keys(PAGE_ACTIONS)) out[key] = PAGE_ACTIONS[key].slice();
    return out;
}

// Is a role-Y member with these permissions allowed to call this route?
// Returns null when allowed, or a message when not.
function checkRoute(perms, routePath, body) {
    if (perms == null) return null; // legacy account: full access
    let need = ROUTES[routePath];
    if (typeof need === "function") need = need(body || {});
    if (!need) return null;
    const list = [].concat(need);
    if (list.some((n) => { const [p, a] = n.split(":"); return (perms[p] || []).includes(a); })) return null;
    const [p, a] = list[0].split(":");
    const pg = PAGES[p];
    const act = pg && pg.actions.find((x) => x.key === a);
    return "You don't have the \"" + (act ? act.label : a) + "\" permission on " +
        (pg ? pg.label.replace(/ \(.*\)$/, "") : p) + ". Ask a super admin for access.";
}

/* /dashboard-stats for an Admin (Y): drop every figure that belongs to a page
   they can't view (the panel hides the matching cards / charts). perms null =
   full access, payload returned as is. */
const DASHBOARD_STATS = {
    todayStudents: "students", totalStudents: "students", activeCourses: "courses", activeBatches: "batches",
    refers: "referred-friends",
    webContacts: "web-contacts", qaSessions: "qa-session", feedbacks: "feedbacks", customForms: "forms", surveys: "surveys",
    siteFeedback: "site-feedback", workshopRegistrations: "workshop-registrations", newsletter: "newsletter",
    raisedTickets: "raised-tickets", studentInquiries: "students-inquiries", enrolleesCount: "enrollees",
    certificateRequests: "certificate-requests",
};
const DASHBOARD_PARTS = {
    enrollees: "enrollees", paymentstats: "subscriptions", studentsinquiries: "students-inquiries",
    assignments: "assignments", coursepopularity: "courses", batchpopularity: "batches",
    recentactivities: "activities", certificaterequests: "certificate-requests", last7days: "students",
};
function filterDashboard(payload, perms) {
    if (perms == null) return payload;
    const canView = (p) => (perms[p] || []).includes("view");
    const out = { ...payload };
    if (out.stats) {
        out.stats = { ...out.stats };
        for (const [k, p] of Object.entries(DASHBOARD_STATS)) if (!canView(p)) out.stats[k] = null;
    }
    for (const [k, p] of Object.entries(DASHBOARD_PARTS)) if (!canView(p)) out[k] = null;
    return out;
}

module.exports = { CATALOGUE, ROUTES, parsePermissions, sanitizePermissions, fullPermissions, checkRoute, filterDashboard };
