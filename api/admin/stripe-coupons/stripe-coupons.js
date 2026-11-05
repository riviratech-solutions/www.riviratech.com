/**
 * API routes for src/pages/panel/admin/StripeCoupons.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { verifyAccount, getStripe } = ctx;

    // ---- List coupons ----
    router.post("/stripe/coupons", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const stripe = getStripe();
            const list = await stripe.coupons.list({ limit: 100 });
            return res.json({ success: true, data: list.data });
        } catch (err) {
            console.error("stripe coupons list:", err.message);
            return res.json({ success: false, message: err.message || "Stripe error" });
        }
    });

    // ---- Create coupon ----
    router.post("/stripe/coupon/create", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;

            const {
                name, discountType, percentOff, amountOff, currency,
                duration, durationInMonths, maxRedemptions, redeemBy, code,
            } = req.body;

            const params = {};
            if (name && String(name).trim()) params.name = String(name).trim();

            if (discountType === "amount") {
                const a = Number(amountOff);
                if (!Number.isFinite(a) || a <= 0) return res.json({ success: false, message: "Enter a valid amount off" });
                params.amount_off = Math.round(a * 100); // smallest currency unit
                params.currency = String(currency || "usd").toLowerCase();
            } else {
                const p = Number(percentOff);
                if (!Number.isFinite(p) || p <= 0 || p > 100) return res.json({ success: false, message: "Enter a valid percent (1–100)" });
                params.percent_off = p;
            }

            params.duration = duration || "once";
            if (params.duration === "repeating") {
                const m = Number(durationInMonths);
                if (!Number.isFinite(m) || m <= 0) return res.json({ success: false, message: "Enter duration in months" });
                params.duration_in_months = m;
            }

            if (maxRedemptions && Number(maxRedemptions) > 0) params.max_redemptions = Number(maxRedemptions);
            if (redeemBy) {
                const ts = Math.floor(new Date(redeemBy).getTime() / 1000);
                if (Number.isFinite(ts) && ts > 0) params.redeem_by = ts;
            }
            if (code && String(code).trim()) params.id = String(code).trim();

            const stripe = getStripe();
            const coupon = await stripe.coupons.create(params);
            return res.json({ success: true, data: coupon, message: "Coupon created" });
        } catch (err) {
            console.error("stripe coupon create:", err.message);
            return res.json({ success: false, message: err.message || "Stripe error" });
        }
    });

    // ---- Update coupon (Stripe only allows editing name / metadata) ----
    router.post("/stripe/coupon/update", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { id, name } = req.body;
            if (!id) return res.json({ success: false, message: "Missing coupon id" });
            const stripe = getStripe();
            const coupon = await stripe.coupons.update(String(id), { name: String(name || "").trim() });
            return res.json({ success: true, data: coupon, message: "Coupon updated" });
        } catch (err) {
            console.error("stripe coupon update:", err.message);
            return res.json({ success: false, message: err.message || "Stripe error" });
        }
    });

    // ---- Delete coupon ----
    router.post("/stripe/coupon/delete", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Missing coupon id" });
            const stripe = getStripe();
            const del = await stripe.coupons.del(String(id));
            return res.json({ success: true, data: del, message: "Coupon deleted" });
        } catch (err) {
            console.error("stripe coupon delete:", err.message);
            return res.json({ success: false, message: err.message || "Stripe error" });
        }
    });
};
