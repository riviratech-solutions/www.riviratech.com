/**
 * API routes for src/pages/panel/admin/Raisedtickets.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, dateRangeFilter, verifyAccount, addactivity } = ctx;

    const TOPIC_NAMES = {
        enrollment: "Enrollment & onboarding", community: "Skool & WhatsApp access",
        payments: "Payments, refunds & invoices", account: "Account & sign-in", classes: "Live classes & batches",
        assignments: "Assignments & projects", certificates: "Certificates", placement: "Placement & career support",
        corporate: "Corporate, B2B & POC", workshops: "Workshops & events",
        website: "Website, accessibility & security", referrals: "Referrals", other: "Something else",
    };
    const CATEGORY_NAMES = { technical: "Technical issue", content: "Course content", billing: "Billing", general: "General question" };

    // ---- Admin: list (search, sort, 10 per page) + status counts ----
    router.post("/raised-tickets", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const q = String(req.body.q || "").trim();
            const old = String(req.body.s || "") === "Old";
            const limit = req.body.export_all === "1" ? 5000 : 10; // export_all: the admin's "export all matching rows" (one page)
            let page = Math.max(1, parseInt(req.body.n, 10) || 1);

            // filters (Webcontacts-style): search, raised-on date range, status
            const params = [];
            const conds = [];
            if (q) {
                const like = "%" + q + "%";
                // the names students pick (src/utils/ticketTopics.ts) match too:
                // the table keeps short values such as "community"
                const named = (map) => Object.keys(map).filter((k) => map[k].toLowerCase().includes(q.toLowerCase()));
                const types = named(TOPIC_NAMES), cats = named(CATEGORY_NAMES);
                conds.push(`(m.name ILIKE ? OR m.email ILIKE ? OR m.number ILIKE ? OR t.msg ILIKE ?
                          OR t.category ILIKE ? OR t.type ILIKE ? OR t.t_id ILIKE ?` +
                    (types.length ? ` OR t.type IN (${types.map(() => "?").join(",")})` : "") +
                    (cats.length ? ` OR t.category IN (${cats.map(() => "?").join(",")})` : "") + ")");
                params.push(like, like, like, like, like, like, like, ...types, ...cats);
            }
            const dr = dateRangeFilter(req.body.df, req.body.dt);
            if (dr.active) {
                conds.push("TRUE" + dr.clause("t.datetime"));
                params.push(...dr.params);
            }
            const st = ["1", "2", "3"].includes(String(req.body.st || "")) ? String(req.body.st) : "";
            if (st) {
                conds.push("t.status = ?");
                params.push(st);
            }
            const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

            const [[cnt]] = await db.promise().query(
                `SELECT COUNT(t.id)::int AS total FROM tickets t LEFT JOIN members m ON m.mem_id = t.mem_id ${where}`,
                params
            );
            const lastPage = Math.max(1, Math.ceil(cnt.total / limit));
            if (page > lastPage) page = lastPage;

            const [rows] = await db.promise().query(
                `SELECT t.id, t.t_id, t.mem_id, t.type, t.category, t.priority, t.msg, t.datetime, t.status,
                        m.name, m.email, m.number, m.gender, m.qualification, m.profile
                 FROM tickets t LEFT JOIN members m ON m.mem_id = t.mem_id
                 ${where}
                 ORDER BY t.id ${old ? "ASC" : "DESC"}
                 LIMIT ? OFFSET ?`,
                [...params, limit, (page - 1) * limit]
            );

            const [byStatus] = await db.promise().query(
                "SELECT status, COUNT(id)::int AS n FROM tickets GROUP BY status"
            );
            const stats = { open: 0, progress: 0, resolved: 0, total: 0 };
            byStatus.forEach((r) => {
                if (r.status === "1") stats.open = r.n;
                else if (r.status === "2") stats.progress = r.n;
                else if (r.status === "3") stats.resolved = r.n;
                stats.total += r.n;
            });

            return res.json({ success: true, data: rows, stats, lastPage, total: cnt.total });
        } catch (err) {
            console.error("raised-tickets:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // ---- Admin: open → in progress → resolved ----
    router.post("/change-ticket", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { key: ukey } = req.cookies;
            const { id, type } = req.body;
            const status = type === "progress" ? "2" : type === "resolved" ? "3" : "";
            if (!id || !status) return res.json({ success: false, message: "Invalid request" });
            const [rows] = await db.promise().query("SELECT status FROM tickets WHERE t_id = ? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Ticket not found" });
            await db.promise().query("UPDATE tickets SET status = ? WHERE t_id = ?", [status, id]);
            addactivity(ukey, id, "tickets", "Ticket marked " + (status === "2" ? "In Progress" : "Resolved"), "", "");
            return res.json({
                success: true,
                status,
                message: status === "2" ? "Ticket marked In Progress" : "Ticket marked Resolved",
            });
        } catch (err) {
            console.error("change-ticket:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // ---- Admin: delete ----
    router.post("/delete-ticket", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y"))) return;
            const { key: ukey } = req.cookies;
            const { id } = req.body;
            if (!id) return res.json({ success: false, message: "Invalid request" });
            const [del] = await db.promise().query("DELETE FROM tickets WHERE t_id = ?", [id]);
            if (!(del.affectedRows >= 1)) return res.json({ success: false, message: "Ticket not found" });
            addactivity(ukey, id, "tickets", "Ticket deleted", "", "");
            return res.json({ success: true, message: "Ticket deleted" });
        } catch (err) {
            console.error("delete-ticket:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/raisedtickets" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "tickets" },
];
