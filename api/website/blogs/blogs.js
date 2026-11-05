/**
 * API routes for src/pages/website/Blogs.tsx.
 * Blog article pages (components/BlogArticle.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, validateSecurity } = ctx;

    /* Public: list all active blog categories (used for the filter tabs) */
    /* Public: get a single blog post by slug */
    router.post("/blogs/by-slug/:slug", async (req, res) => {
      try {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);

        const slug = (req.params.slug || "").toLowerCase().trim();
        if (!slug) return res.json({ success: false, message: "Slug required" });

        db.query(
          // slug, or req_id for old /blogs?post=<req_id> links
          `SELECT blogs.*,
              COALESCE((SELECT c.name FROM blog_categories c WHERE c.req_id = blogs.category_id LIMIT 1), 'Others') AS category_name,
              COALESCE((SELECT c.slug FROM blog_categories c WHERE c.req_id = blogs.category_id LIMIT 1), 'others') AS category_slug
           FROM blogs WHERE (slug = ? OR LOWER(req_id) = ?) AND status = '1' LIMIT 1`,
          [slug, slug],
          (err, rows) => {
            if (err) return res.json({ success: false, message: "Database error" });
            if (!rows || rows.length === 0) return res.json({ success: false, message: "Blog not found" });
            return res.json({ success: true, data: rows[0] });
          }
        );
      } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "Server error" });
      }
    });

    router.post("/blogs/categories", async (req, res) => {
      try {
        const security = validateSecurity(req);
        if (!security.success) return res.json(security);

        // blog_count = active posts per category; total = all active posts
        // (website blog filter chips show these counts)
        const [rows] = await db.promise().query(
          `SELECT c.req_id, c.name, c.slug,
              (SELECT COUNT(b.id) FROM blogs b WHERE b.category_id = c.req_id AND b.status = '1') AS blog_count
       FROM blog_categories c WHERE c.status = '1' ORDER BY c.name ASC`
        );
        const [tot] = await db.promise().query("SELECT COUNT(id) AS total FROM blogs WHERE status = '1'");
        const [otherTot] = await db.promise().query(
          `SELECT COUNT(id) AS other_count FROM blogs 
           WHERE status = '1' AND (category_id IS NULL OR category_id = '' OR category_id NOT IN (SELECT req_id FROM blog_categories WHERE status = '1'))`
        );
        const otherCount = Number(otherTot[0]?.other_count) || 0;
        const allCategories = [...(rows || [])];
        if (otherCount > 0) {
          allCategories.push({
            req_id: "others",
            name: "Others",
            slug: "others",
            blog_count: otherCount
          });
        }
        return res.json({ success: true, data: allCategories, total: Number(tot[0]?.total) || 0 });
      } catch (err) {
        console.error(err);
        return res.json({ success: false, message: "Server error" });
      }
    });

    router.post("/blogs/latest", async (req, res) => {

      try {

        const { q, s, n, l, category, key, token, aut } = req.body;

        /* Session Tokens */
        const security = validateSecurity(req);
        if (!security.success) {
          return res.json(security);
        }

        /* 1️⃣ Query Params */

        const search = q ? q.trim() : "";
        const sortby = s ? s.trim() : "";
        const categoryFilter = category ? category.trim() : "";
        let page = n ? parseInt(n) : 1;

        /* 2️⃣ Sort */

        let orderBy = "id DESC";

        if (sortby === "Old") {
          orderBy = "id ASC";
        }

        /* 3️⃣ Search */

        let where = "WHERE status='1'";
        let params = [];

        if (search) {
          where += " AND (title ILIKE ?)";
          params.push(`%${search}%`);
        }

        // the category's slug (the website) or its req_id (older links)
        if (categoryFilter) {
          if (categoryFilter.toLowerCase() === "others" || categoryFilter.toLowerCase() === "uncategorised") {
            where += " AND (category_id IS NULL OR category_id = '' OR category_id NOT IN (SELECT req_id FROM blog_categories WHERE status = '1'))";
          } else {
            where += " AND category_id IN (SELECT req_id FROM blog_categories WHERE req_id = ? OR slug = ?)";
            params.push(categoryFilter, categoryFilter);
          }
        }

        /* 4️⃣ Pagination */

        // Page size: l (website blog list sends 12), default 10, max 50
        const limit = Math.min(Math.max(parseInt(l, 10) || 10, 1), 50);

        /* 5️⃣ Count */

        const countSql = `
            SELECT COUNT(id) AS total
            FROM blogs
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

          // the category's name / slug come with each post, so the website
          // needs no ids to show it
          const dataSql = `
                SELECT blogs.*,
                    COALESCE((SELECT c.name FROM blog_categories c WHERE c.req_id = blogs.category_id LIMIT 1), 'Others') AS category_name,
                    COALESCE((SELECT c.slug FROM blog_categories c WHERE c.req_id = blogs.category_id LIMIT 1), 'others') AS category_slug
                FROM blogs
                ${where}
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
                 `;

          // offset after the page is clamped to lastPage
          const dataParams = [...params, limit, (page - 1) * limit];

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
