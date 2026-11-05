/**
 * API routes for src/pages/panel/admin/StripePromoCodes.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { verifyAccount, getStripe } = ctx;

    /* ---- Promotion Codes (customer-facing codes that reference a coupon) ----
       These add: customer-specific restriction, per-code single-use / usage
       limit, expiry, and first-time-only / minimum-amount rules. Remaining
       usage = max_redemptions - times_redeemed (shown by the UI). */

    // List promotion codes (optionally for one coupon).
    router.post("/stripe/promotion-codes", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const query = { limit: 100 };
            if (req.body.coupon) query.coupon = String(req.body.coupon);
            const stripe = getStripe();
            const list = await stripe.promotionCodes.list(query);
            const data = list.data.map((pc) => ({
                ...pc,
                customer_id: typeof pc.customer === "string" ? pc.customer : (pc.customer && pc.customer.id) || null,
            }));
            return res.json({ success: true, data });
        } catch (err) {
            console.error("stripe promo list:", err.message);
            return res.json({ success: false, message: err.message || "Stripe error" });
        }
    });

    // Create a promotion code (customer-specific / single-use / limit + expiry).
    router.post("/stripe/promotion-code/create", async (req, res) => {
        try {

            if (!(await verifyAccount(req, res, "X,Y"))) return;

            const {
                coupon,
                code,
                customerEmail,
                maxRedemptions,
                expiresAt,
                firstTimeOnly,
                minimumAmount,
                currency,
            } = req.body;

            if (!coupon) {
                return res.json({
                    success: false,
                    message: "Select a coupon for this promotion code"
                });
            }

            const stripe = getStripe();

            /*
             * ============================================================
             * PROMOTION CODE
             * ============================================================
             *
             * New Stripe API:
             *
             * promotion: {
             *     type: "coupon",
             *     coupon: "coupon_xxx"
             * }
             */

            const params = {
                promotion: {
                    type: "coupon",
                    coupon: String(coupon)
                }
            };

            /*
             * Customer-facing promotion code
             *
             * Example:
             * WELCOME10
             */

            if (code && String(code).trim()) {
                params.code = String(code).trim();
            }

            /*
             * ============================================================
             * CUSTOMER RESTRICTION
             * ============================================================
             */

            if (customerEmail && String(customerEmail).trim()) {

                const email = String(customerEmail).trim();

                const found = await stripe.customers.list({
                    email,
                    limit: 1
                });

                const cust =
                    found.data[0] ||
                    await stripe.customers.create({
                        email
                    });

                params.customer = cust.id;
            }

            /*
             * ============================================================
             * MAX REDEMPTIONS
             * ============================================================
             */

            if (
                maxRedemptions &&
                Number(maxRedemptions) > 0
            ) {
                params.max_redemptions =
                    Number(maxRedemptions);
            }

            /*
             * ============================================================
             * EXPIRATION
             * ============================================================
             */

            if (expiresAt) {

                const ts = Math.floor(
                    new Date(expiresAt).getTime() / 1000
                );

                if (Number.isFinite(ts) && ts > 0) {
                    params.expires_at = ts;
                }
            }

            /*
             * ============================================================
             * RESTRICTIONS
             * ============================================================
             */

            const restrictions = {};

            /*
             * First-time customers only
             */

            if (firstTimeOnly) {
                restrictions.first_time_transaction = true;
            }

            /*
             * Minimum order amount
             *
             * Example:
             * minimumAmount = 100
             * becomes 10000 cents
             */

            if (
                minimumAmount &&
                Number(minimumAmount) > 0
            ) {

                restrictions.minimum_amount =
                    Math.round(
                        Number(minimumAmount) * 100
                    );

                restrictions.minimum_amount_currency =
                    String(currency || "usd").toLowerCase();
            }

            if (Object.keys(restrictions).length > 0) {
                params.restrictions = restrictions;
            }

            /*
             * ============================================================
             * CREATE PROMOTION CODE
             * ============================================================
             */

            const pc =
                await stripe.promotionCodes.create(params);

            return res.json({
                success: true,
                data: pc,
                message: "Promotion code created"
            });

        } catch (err) {

            console.error(
                "stripe promo create:",
                err
            );

            return res.json({
                success: false,
                message:
                    err.message ||
                    "Stripe error"
            });
        }
    });

    // Enable / disable a promotion code (Stripe cannot delete them).
    router.post("/stripe/promotion-code/toggle", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { id, active } = req.body;
            if (!id) return res.json({ success: false, message: "Missing promotion code id" });
            const stripe = getStripe();
            const pc = await stripe.promotionCodes.update(String(id), { active: !!active });
            return res.json({ success: true, data: pc, message: active ? "Promotion code activated" : "Promotion code deactivated" });
        } catch (err) {
            console.error("stripe promo toggle:", err.message);
            return res.json({ success: false, message: err.message || "Stripe error" });
        }
    });
};
