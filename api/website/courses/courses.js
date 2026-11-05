/**
 * Course and batch lists for website forms (Enroll, Certificate Request,
 * Program GenAI).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, validateSecurity } = ctx;

    router.post("/courses/get", (req, res) => {

      // Session Tokens
      const security = validateSecurity(req);
      if (!security.success) {
        return res.json(security);
      }

      // "not enrollable" courses only for the Certificate Request form (all: "1")
      const onlyEnrollable = String(req.body.all || "") !== "1" ? " AND COALESCE(enrollable, '1') <> '0'" : "";
      db.query(
        `SELECT req_id, title FROM courses WHERE status='1'${onlyEnrollable} ORDER BY title ASC`,
        (err, rows) => {
          if (err) {
            console.error(err);
            return res.status(500).json({
              success: false,
              message: "DB Error",
            });
          }

          res.json({
            success: true,
            data: rows,
          });
        }
      );
    });

    router.post("/batches/get", async (req, res) => {

      // Session Tokens
      const security = validateSecurity(req);
      if (!security.success) {
        return res.json(security);
      }

      try {

        const { c_id, status } = req.body;

        // SQL with JOIN (Best way)
        let sql = `
              SELECT *
              FROM batches
              WHERE 1=1
          `;
        const params = [];

        if (status === "1") {
          sql += ` AND status = ?`;
          params.push("1");
        } else {
          sql += ` AND status = ?`;
          params.push("1");
        }

        if (c_id && c_id.length >= 10) {
          sql += ` AND c_id = ?`;
          params.push(c_id);
        }

        sql += ` LIMIT 100`;

        db.query(sql, params, (err, rows) => {

          if (err) {
            console.error(err);
            return res.json({
              success: false,
              message: "Database error"
            });
          }

          if (rows.length === 0) {
            return res.json({
              success: false,
              message: "No Batches"
            });
          }

          return res.json({
            success: true,
            data: rows,
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
