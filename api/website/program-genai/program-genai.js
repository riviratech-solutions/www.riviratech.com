/**
 * API routes for src/pages/website/ProgramGenAI.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const Stripe = require("stripe");
const planSlides = require("../../admin/plan-slides/plan-slides-core");
const session = require("express-session");

module.exports = (router, ctx) => {
    const { db, validateSecurity } = ctx;

    /* ---- Public: Generative-AI program checkout (Stripe) ----
           Bundle & Monthly are recurring subscriptions (Checkout mode:"subscription",
           which drives POST /v1/subscriptions under the hood — see Stripe docs). The
           Individual course is a one-time payment. Prices are inline price_data, so no
           pre-created Price IDs are needed. */
    const PROGRAM_PLANS = {
        bundle: { amount: 4000, recurring: true, label: "Generative AI Engineer Program — Bundle Subscription" },
        monthly: { amount: 5000, recurring: true, label: "Generative AI Engineer Program — Monthly Subscription" },
        individual: { amount: 45000, recurring: false, label: "Generative AI Engineer Program — Individual Course" },
    };
    router.post("/program/checkout", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        try {
            const { plan, email, name } = req.body;
            // enrolment request this payment belongs to (from /api/enroll)
            const reqId = /^[a-zA-Z0-9]{10,64}$/.test(String(req.body.req_id || "")) ? String(req.body.req_id) : "";
            const cfg = PROGRAM_PLANS[plan];
            if (!cfg) return res.json({ success: false, message: "Invalid plan" });
            // plans switched off in Panel → Plan Slides can't be bought
            if (!(await planSlides.offeredPlans(db)).includes(plan))
                return res.json({ success: false, message: "This plan isn't available right now" });
            if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.json({ success: false, message: "A valid email is required" });

            const stripe = new Stripe(process.env.STRIPE_ACCESS_KEY);
            const base = process.env.DOMAIN || "";
            const session = await stripe.checkout.sessions.create({
                mode: cfg.recurring ? "subscription" : "payment",
                payment_method_types: ["card"],
                customer_email: email,
                allow_promotion_codes: true, // show the "Add promotion code" field
                line_items: [{
                    quantity: 1,
                    price_data: {
                        currency: "usd",
                        product_data: { name: cfg.label },
                        unit_amount: cfg.amount,
                        ...(cfg.recurring ? { recurring: { interval: "month" } } : {}),
                    },
                }],
                // back to /payment, which asks /program/checkout-status what happened
                success_url: base + "payment?t=plan-success&session_id={CHECKOUT_SESSION_ID}",
                cancel_url: base + "payment?t=plan-cancel",
                metadata: { plan, name: name || "", email, req_id: reqId },
                ...(cfg.recurring ? { subscription_data: { metadata: { plan, req_id: reqId } } } : {}),
            });
            return res.json({ success: true, url: session.url });
        } catch (err) { console.error("program/checkout:", err.message); return res.json({ success: false, message: "Payment could not be started, please try again" }); }
    });

    /* ---- Public: result of a program checkout (the /payment return page) ----
           Asks Stripe for the session, and when it is paid marks the linked
           enrolment request as Paid (status 2) so the admin sees it in Enrollees. */
    router.post("/program/checkout-status", async (req, res) => {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);
        try {
            const sid = String(req.body.session_id || "");
            if (!/^cs_[a-zA-Z0-9_]{10,200}$/.test(sid)) return res.json({ success: false, message: "Invalid payment reference" });
            const stripe = new Stripe(process.env.STRIPE_ACCESS_KEY);
            const session = await stripe.checkout.sessions.retrieve(sid);
            const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
            const md = session.metadata || {};
            const cfg = PROGRAM_PLANS[md.plan] || null;
            if (paid && md.req_id) {
                // Record what was actually bought and paid: the enrolment's own plan
                // text and fee came from the browser, and a cheaper plan's checkout
                // could otherwise mark a pricier enrolment as paid.
                const paidFee = Number(session.amount_total || 0) / 100;
                await db.promise().query(
                    "UPDATE enrollees SET status = '2', plan = COALESCE(?, plan), fees = ? WHERE req_id = ? AND status = '1'",
                    [cfg ? cfg.label : null, paidFee, md.req_id]
                );
            }
            return res.json({
                success: true,
                paid,
                plan: md.plan || "",
                label: cfg ? cfg.label : "",
                recurring: cfg ? cfg.recurring : false,
                email: session.customer_email || md.email || "",
                message: paid
                    ? (cfg && cfg.recurring
                        ? "Your subscription is active. We'll email your class access details shortly."
                        : "Your payment was received. We'll email your course access details shortly.")
                    : "Your payment hasn't completed yet.",
            });
        } catch (err) { console.error("program/checkout-status:", err.message); return res.json({ success: false, message: "We couldn't confirm the payment just now" }); }
    });
};
