/**
 * API routes for src/pages/website/Events.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, validateSecurity } = ctx;

    router.post("/event-latest", async (req, res) => {
        try {

            const security = validateSecurity(req);
            if (!security.success) {
                return res.json(security);
            }

            /* ---------------- FETCH LATEST EVENT ---------------- */

            const [rows] = await db.promise().query(`
                SELECT *
                FROM events
                WHERE status IN ('1')
                ORDER BY id DESC
                LIMIT 1
                `);

            if (rows.length === 0) {
                return res.json({
                    success: false,
                    message: "No event found",
                });
            }

            const event = rows[0];

            /* ---------------- FETCH RELATED TABLES ---------------- */

            const [learnRows] = await db.promise().query(
                `SELECT * FROM event_learnings WHERE event_id = ? ORDER BY id ASC`,
                [event.event_id]
            );

            const [audienceRows] = await db.promise().query(
                `SELECT * FROM event_audience WHERE event_id = ? ORDER BY id ASC`,
                [event.event_id]
            );

            const [timerRows] = await db.promise().query(
                `SELECT * FROM event_timer WHERE event_id = ? ORDER BY id ASC`,
                [event.event_id]
            );

            /* ---------------- ATTACH LISTS ---------------- */

            event.learnings = learnRows;
            event.audience = audienceRows;
            event.timers = timerRows;

            /* ---------------- RESPONSE ---------------- */

            return res.json({
                success: true,
                data: event,
            });

        } catch (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });

    router.post("/event/notify", (req, res) => {
      const { evt_id, email, key,
        token,
        aut, } = req.body;

      // Session Tokens
      const security = validateSecurity(req);
      if (!security.success) {
        return res.json(security);
      }

      // Validation
      if (!email || !evt_id) {
        return res.json({
          success: false,
          message: "Email required",
        });
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.json({
          success: false,
          message: "Invalid email",
        });
      }

      // Duplicate check
      db.query(
        "SELECT id FROM eventnotifies WHERE evt_id=? AND email=? LIMIT 1",
        [evt_id, email],
        (err, rows) => {
          if (err)
            return res.json({
              success: false,
              message: "DB Error",
            });

          if (rows.length > 0) {
            return res.json({
              success: false,
              message: "Already submited",
            });
          }

          const datetime = Math.floor(Date.now() / 1000);
          // Insert
          db.query(
            `
        INSERT INTO eventnotifies
        (evt_id,email,datetime,status)
        VALUES (?,?,?,'1')
      `,
            [evt_id, email, datetime],
            (err2) => {
              if (err2)
                return res.json({
                  success: false,
                  message: "Insert failed",
                });

              res.json({
                success: true,
                message:
                  "Thank you! We will nofity you shortly.",
              });
            }
          );
        }
      );
    });
};
