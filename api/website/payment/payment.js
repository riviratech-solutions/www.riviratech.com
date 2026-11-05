/**
 * API routes for src/pages/website/Payment.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const Stripe = require("stripe");
const session = require("express-session");
const { isFullProgramPlan, fullProgramFee } = require("../../shared/program-prices");

module.exports = (router, ctx) => {
    const { db, csecure, csamesite, chttpOnly, checkStatus, validateSecurity } = ctx;

    //const stripe = require('stripe')(process.env.STRIPE_ACCESS_KEY);
    router.post("/payment/now", async (req, res) => {

        const {
            id} = req.body;

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
            return res.json(security);
        }

        /* 2️⃣ check ID */
        if (!id || id.length <= 10) {
            return res.json({
                success: false,
                message: "There was something wrong, Please try again"
            });
        }

        try {

            const dataSql = `
                  SELECT cr.*,
                         c.title AS course_name, c.fees AS course_fees
                  FROM enrollees cr
                      LEFT JOIN courses c
                          ON c.req_id = cr.course
                  WHERE cr.req_id = ?
                  ORDER BY cr.id DESC
                  LIMIT 1
                  `;

            // Fully awaited flow inside this try/catch. Previously the Stripe
            // call lived in a db.query async callback, so a Stripe/network/NaN
            // error escaped the try and left the paying user's request hanging
            // with no response (audit BE-03 / BE-04).
            const [row] = await db.promise().query(dataSql, [id]);

            /* 7️⃣ No Data */
            if (row.length === 0) {
                return res.json({
                    success: false,
                    data: [],
                    message: "No data found"
                });
            }

            const {
                req_id: dbId,
                course: c_id,
                name: name,
                email: email,
                plan: plan,
                course_name,
                course_fees,
            } = row[0];

            /* 4️⃣ Verify ID */
            if (dbId !== id) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            // Only an open request can be paid: not a rejected one ('0') and not
            // one that is already paid / approved ('2', '3').
            if (String(row[0].status) !== "1") {
                return res.json({
                    success: false,
                    message: "This enrollment request can no longer be paid online. Please contact support."
                });
            }

            // What the student is charged. The fee an admin confirmed when sending
            // the payment link (prs = 1) is used as is. Before that, only the
            // Enroll page's Full Program can be paid straight away, at the price
            // set on the server: the fee saved at enrolment came from the
            // browser, so it is never charged unreviewed.
            let fees;
            if (String(row[0].prs) === "1") {
                fees = Number(row[0].fees);
            } else if (isFullProgramPlan(plan)) {
                fees = fullProgramFee(row[0].addon, plan);
            } else {
                return res.json({
                    success: false,
                    message: "Your payment link will be emailed to you once our team has reviewed your request."
                });
            }

            const PLAN_CONFIG = {

                "Subscription · Bundle — Generative AI Engineer Program": {
                    recurring: true,
                    label: "Generative AI Engineer Program — Bundle Subscription"
                },

                "Subscription · Monthly — Generative AI Engineer Program": {
                    recurring: true,
                    label: "Generative AI Engineer Program — Monthly Subscription"
                },

                "Individual Course — Generative AI Engineer Program": {
                    recurring: false,
                    label: "Generative AI Engineer Program — Individual Course"
                }

            };

            const selectedPlan = PLAN_CONFIG[plan];

            let recurring = false;
            let stripeAmount;
            let productName;

            if (selectedPlan) {
                recurring = selectedPlan.recurring;
                productName = selectedPlan.label;
            } else {
                productName = course_name || "Course Payment";
            }

            // Guard the amount so a non-numeric/blank fee can't produce a NaN
            // charge that Stripe rejects (audit BE-06). A negative fee is
            // refused here too, not charged as a positive one.
            const amount = Math.round(Number(fees) * 100); // cents
            if (!Number.isFinite(amount) || amount <= 0) {
                return res.json({
                    success: false,
                    message: "This course does not have a valid fee for online payment"
                });
            }

            const stripe = new Stripe(process.env.STRIPE_ACCESS_KEY); // ⚠️ Secret key

            const checkoutData = {
                payment_method_types: ["card"],
                allow_promotion_codes: true, // show the "Add promotion code" field
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: productName,
                            },
                            unit_amount: amount,
                            ...(recurring ? { recurring: { interval: "month" } } : {}),
                        },
                        quantity: 1,
                    },
                ],
                mode: recurring
                    ? "subscription"
                    : "payment",
                success_url: process.env.DOMAIN + "payment?t="+id+"&s=success",
                cancel_url: process.env.DOMAIN + "payment?t="+id+"&s=cancel",
                /*
                * Keep your enrollment/payment information
                * attached to the Stripe Checkout Session.
                */
                metadata: {
                    req_id: id,
                    course_id: c_id,
                    plan: plan || "",
                    name: name || "",
                    email: email || ""
                }
            };

            if (email) {
                checkoutData.customer_email = email;
            }

            const session = await stripe.checkout.sessions.create(checkoutData);

            const datetime = Math.floor(Date.now() / 1000);

            // 1️⃣ Check if exists
            const [rows] = await db.promise().query(
                "SELECT id FROM payments WHERE mem_id=? AND crs_id=? LIMIT 1",
                [id, c_id]
            );

            const pay_id = session.id;
            const currency = session.currency;

            res.cookie("req_id", id, {
                maxAge: 360000 * 1000, // milliseconds
                httpOnly: chttpOnly, // true in live website
                secure: csecure, // true in HTTPS
                sameSite: csamesite,
                path: "/"
            });

            res.cookie("payid", session.id, {
                maxAge: 360000 * 1000, // milliseconds
                httpOnly: chttpOnly, // true in live website
                secure: csecure, // true in HTTPS
                sameSite: csamesite,
                path: "/"
            });

            req.session.c_id = id;
            req.session.payid = session.id;

            // ✅ IF EXISTS → UPDATE, ELSE → INSERT
            if (rows.length > 0) {
                await db.promise().query(
                    `UPDATE payments
                        SET pay_id=?, fees=?, currency=?, datetime=?, status=?, plan=?
                        WHERE mem_id=? AND crs_id=?`,
                    [pay_id, fees, currency, datetime, "1", plan || "", id, c_id]
                );

                return res.json({
                    success: true,
                    url: session.url,
                    payment_type: recurring
                        ? "subscription"
                        : "one_time",
                    message: recurring
                        ? "Subscription payment started"
                        : "Payment updated"
                });
            } else {
                await db.promise().query(
                    `INSERT INTO payments
                        (req_id, mem_id, crs_id, pay_id, pay_intent, currency, fees, datetime, status, plan)
                        VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?)`,
                    [id, id, c_id, pay_id, currency, fees, datetime, "1", plan || ""]
                );

                return res.json({
                    success: true,
                    url: session.url,
                    payment_type: recurring
                        ? "subscription"
                        : "one_time",
                    message: recurring
                        ? "Subscription payment started"
                        : "Payment inserted"
                });
            }

        } catch (err) {

            console.error("payment/now failed:", err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    router.post("/payment/check", async (req, res) => {

        let {id} = req.body;

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
            return res.json(security);
        }

        let pay_id = "";
        let type = id;

        if (id && id === "success" || id && id === "cancel") {
            let { req_id, payid } = req.cookies;
            id = req_id;
            pay_id = payid;
        }

        /* 2️⃣ check ID */
        if (!id || id.length <= 10) {
            return res.json({
                success: false,
                message: "There was something wrong, Please try again"
            });
        }
        if (!pay_id || pay_id.length <= 10) {
            return res.json({
                success: false,
                message: "There was something wrong, Please try again"
            });
        }

        try {

            const dataSql = `
                  SELECT cr.*,
                         c.title AS course_name, c.fees AS course_fees
                  FROM enrollees cr
                      LEFT JOIN courses c
                          ON c.req_id = cr.course
                  WHERE cr.req_id = ?
                  ORDER BY cr.id DESC
                  LIMIT 1
                  `;

            // Fully awaited so a Stripe retrieve error can't escape into an
            // unhandled rejection and hang the request (audit BE-03 / BE-04).
            const [rows] = await db.promise().query(dataSql, [id]);

            /* 7️⃣ No Data */
            if (rows.length === 0) {
                return res.json({
                    success: false,
                    data: [],
                    message: "No data found"
                });
            }

            const dbId = rows[0].req_id;
            const c_id = rows[0].course;

            /* 4️⃣ Verify ID */
            if (dbId !== id) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            const stripe = new Stripe(process.env.STRIPE_ACCESS_KEY); // ⚠️ Secret key
            const session = await stripe.checkout.sessions.retrieve(pay_id);

            // Stripe only fills payment_intent once the session is completed/paid.
            // On a cancelled or still-open session it's null — but the payments
            // column is NOT NULL, so store "" instead (it gets the real pi_… id
            // when the payment later succeeds). Same for currency, defensively.
            const pay_intent = session.payment_intent || "";
            const currency = session.currency || "";
            const payment_status = session.payment_status;
            const status = payment_status === "paid" ? "2" : "0";
            const datetime = Math.floor(Date.now() / 1000);

            // Update the payment row and (when paid) the enrolment in ONE
            // transaction, so a payment can never be recorded as paid without
            // the student also being enrolled — or vice versa (audit BE-05).
            let paymentUpdated = false;
            let enrolled = false;

            await db.withTransaction(async (tx) => {
                const [payRes] = await tx.query(
                    `UPDATE payments
                        SET pay_intent = ?, currency = ?, datetime = ?, status = ?
                        WHERE mem_id = ? AND crs_id = ? AND pay_id = ?`,
                    [pay_intent, currency, datetime, status, id, c_id, pay_id]
                );
                paymentUpdated = payRes.affectedRows >= 1;

                if (paymentUpdated && payment_status === "paid") {
                    const [enrRes] = await tx.query(
                        `UPDATE enrollees SET status = ? WHERE req_id = ?`,
                        ["2", id]
                    );
                    enrolled = enrRes.affectedRows >= 1;
                }
            });

            if (!paymentUpdated) {
                return res.json({
                    success: false,
                    status: "",
                    message: "There was something wrong, Please try again"
                });
            }

            if (payment_status === "paid") {
                if (enrolled) {
                    return res.json({
                        success: true,
                        status: "success",
                        message: "Your payment has been processed successfully. Thank you for your payment!"
                    });
                }
                return res.json({
                    success: true,
                    status: "",
                    message: "Your payment has been processed successfully. There was something wrong, Please contact administrator"
                });
            }

            return res.json({
                success: true,
                status: "failed",
                message: "Unfortunately, your payment could not be processed. Please try again or contact support."
            });

        } catch (err) {

            console.error("payment/check failed:", err);

            return res.json({
                success: false,
                message: "Server error"
            });

        }

    });

    
    router.post("/payment/details", (req, res) => {

      let {
        id,
        key,
        token,
        aut, } = req.body;

      // Session Tokens
      const security = validateSecurity(req);
      if (!security.success) {
        return res.json(security);
      }

      if (id && id === "success" || id && id === "cancel") {
        let { req_id } = req.cookies;
        id = req_id;
      }

      /* 2️⃣ check ID */
      if (!id || id.length <= 10) {
        return res.json({
          success: false,
          message: "There was something wrong, Please try again"
        });
      }

      try {

        const dataSql = `
              SELECT cr.*,
                     c.title AS course_name,c.fees AS course_fees
              FROM enrollees cr
                  LEFT JOIN courses c 
                      ON c.req_id = cr.course  

              WHERE cr.req_id = ?
              ORDER BY cr.id DESC
              LIMIT 1
              `;

        db.query(dataSql, [id], (err2, rows) => {

          if (err2) {
            console.error(err2);
            return res.json({
              success: false,
              message: "Database error"
            });
          }

          /* 7️⃣ No Data */
          if (rows.length === 0) {

            return res.json({
              success: false,
              data: [],
              message: "No data found"
            });

          }

          const dbId = rows[0].req_id;
          /* 4️⃣ Verify ID */
          if (dbId !== id) {
            return res.json({
              success: false,
              message: "There was something wrong, Please try again"
            });
          }

          const cleanRows = rows.map((u) => ({
            id: u.id,
            req_id: u.req_id,
            name: u.name,
            gender: u.gender,
            email: u.email,
            number: u.number,
            qualification: u.qualification,
            course_name: u.course_name,
            addon: u.addon,
            plan: u.plan,
            currency: u.currency,
            fees: u.fees,
            referby: u.referby,
            datetime: u.datetime,
            status: u.status,
          }));

          /* 8️⃣ Send Data */
          return res.json({
            success: true,
            data: cleanRows
          });

        });

      } catch (err) {

        console.error(err);

        return res.json({
          success: false,
          message: "Server error"
        });

      }

    });
};
