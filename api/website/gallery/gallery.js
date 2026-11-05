/**
 * API routes for src/pages/website/Gallery.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, validateSecurity } = ctx;

    router.post("/gallery/images", async (req, res) => {

      try {

        const { q, s, n, key, token, aut } = req.body;

        /* Session Tokens */
        const security = validateSecurity(req);
        if (!security.success) {
          return res.json(security);
        }

        /* 1️⃣ Query Params */

        const search = q ? q.trim() : "";
        const sortby = s ? s.trim() : "";
        let page = n ? parseInt(n) : 1;

        /* 2️⃣ Sort */

        let orderBy = "sorting ASC, id DESC";

        if (sortby === "Old") {
          orderBy = "sorting DESC, id ASC";
        }

        /* 3️⃣ Search */

        let where = "WHERE status='1'";
        let params = [];

        /* 4️⃣ Pagination */

        const limit = 10;
        const offset = (page - 1) * limit;

        /* 5️⃣ Count */

        const countSql = `
            SELECT COUNT(id) AS total
            FROM gallaryimgs
            ${where}
        `;

        db.query(countSql, params, (err, countRows) => {

          if (err) {
            console.error(err);
            return res.json({
              success: false,
              message: "Database error"
            });
          }

          const total = countRows[0]?.total || 0;

          const lastPage = total === 0
            ? 0
            : Math.ceil(total / limit);

          if (page > lastPage && lastPage > 0) {
            page = lastPage;
          }

          /* 6️⃣ Fetch Data */

          const dataSql = `
                SELECT *
                FROM gallaryimgs
                ${where}
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
                 `;

          const dataParams = [...params, limit, offset];

          db.query(dataSql, dataParams, (err2, rows) => {

            if (err2) {
              console.error(err2);
              return res.json({
                success: false,
                message: "Database error"
              });
            }

            if (rows.length === 0) {
              return res.json({
                success: false,
                data: [],
                total,
                page,
                lastPage,
                message: "No data found"
              });
            }

            return res.json({
              success: true,
              data: rows,
              total,
              page,
              lastPage
            });

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
