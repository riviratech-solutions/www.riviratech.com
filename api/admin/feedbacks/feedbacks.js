/**
 * API routes for src/pages/panel/admin/Feedbacks.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, dateRangeFilter, verifyAccount } = ctx;

    router.post("/feedbacks", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id, q, s, n } = req.body;

            /* 1️⃣ Get Query Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort */
            let orderBy = "id DESC";

            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* 3️⃣ Search Filter */
            let where = "WHERE type='f' AND status='1'";
            let params = [];

            if (search) {
                where =
                    "WHERE type='f' AND feedback ILIKE ? AND status='1'";
                params.push(`%${search}%`);
            }

            /* 3️⃣.5 Date Filter */
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* 4️⃣ Pagination */
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            const offset = (page - 1) * limit;

            let stats = {
                star1: 0,
                star2: 0,
                star3: 0,
                star4: 0,
                star5: 0,
                total: 0
            };

            /* 5️⃣ Count Total */
            const countSql = `
                SELECT COUNT(id) AS total, rating
                FROM feedbacks
                ${where} ${dr.clause("datetime::text")}
                GROUP BY rating
                `;

            db.query(countSql, params, (err, countRows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                countRows.forEach((row) => {

                    if (row.rating === "1") {
                        stats.star1 = row.total;
                    }
                    if (row.rating === "2") {
                        stats.star2 = row.total;
                    }
                    if (row.rating === "3") {
                        stats.star3 = row.total;
                    }
                    if (row.rating === "4") {
                        stats.star4 = row.total;
                    }
                    if (row.rating === "5") {
                        stats.star5 = row.total;
                    }

                    stats.total += row.total;

                });

                const lastPage = stats.total === 0
                    ? 0
                    : Math.ceil(stats.total / limit);

                /* Fix Page Overflow */
                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSqls = `
                    SELECT
                        *
                    FROM feedbacks
                    ${where} ${dr.clause("datetime::text")}
                    ORDER BY ${orderBy}
                    LIMIT ? OFFSET ?
                    `;

                const dataSql = `
                    SELECT 
                        cr.*,
                        MAX(c.title) AS course,
                        COALESCE(MAX(m.name), cr.name) AS name
                    FROM feedbacks cr 
                    LEFT JOIN courses c 
                        ON c.req_id = cr.course_id   
                    LEFT JOIN members m 
                         ON m.mem_id = cr.mem_id 
                    ${where.replaceAll("feedback", "cr.feedback").replaceAll("note", "cr.note").replaceAll("status", "cr.status").replaceAll("type=", "cr.type=")} ${dr.clause("cr.datetime::text")}
                    GROUP BY cr.id
                    ORDER BY ${orderBy.replaceAll("id", "cr.id")}
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

                    /* 7️⃣ No Data */
                    if (rows.length === 0) {

                        return res.json({
                            success: false,
                            data: [],
                            stats,
                            page,
                            lastPage,
                            message: "No data found"
                        });

                    }

                    /* 8️⃣ Send Data */
                    return res.json({
                        success: true,
                        data: rows,
                        stats,
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

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/feedbacks" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "feedbacks", when: "COALESCE(OLD.type, '') <> 's'" },
];
