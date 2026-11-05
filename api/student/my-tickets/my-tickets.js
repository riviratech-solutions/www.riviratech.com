/**
 * API routes for src/pages/panel/student/MyTickets.tsx.
 * /raise-ticket is the Raise a ticket form (components/RaiseTicketModal.tsx).
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, addactivity } = ctx;

    /* ===================== Support tickets =====================
       Students raise tickets from the panel menu ("Raise a Ticket"); admins
       manage them at /panel/raised-tickets. tickets.status: 1 open,
       2 in progress, 3 resolved. priority: 1 low, 2 medium, 3 high. */
    // the topics in src/utils/ticketTopics.ts (the first six older values kept)
    const TICKET_TYPES = ["enrollment", "community", "payments", "account", "classes", "assignments", "certificates",
        "placement", "corporate", "workshops", "website", "referrals", "other"];
    const TICKET_CATEGORIES = ["technical", "content", "billing", "general"];

    // Generate unique Ticket ID in format: TID-AA10AA05
    // (TID-[2 letters A-Z][2-digit month][2 letters A-Z][2-digit day of month])
    function generateTicketId(d = new Date()) {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const rand2 = () =>
            letters.charAt(Math.floor(Math.random() * letters.length)) +
            letters.charAt(Math.floor(Math.random() * letters.length));
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `TID-${rand2()}${mm}${rand2()}${dd}`;
    }

    async function getUniqueTicketId(db, d = new Date()) {
        for (let i = 0; i < 50; i++) {
            const tid = generateTicketId(d);
            const [rows] = await db.promise().query(
                "SELECT 1 FROM tickets WHERE t_id = ? LIMIT 1",
                [tid]
            );
            if (!rows || rows.length === 0) return tid;
        }
        return generateTicketId(d);
    }

    // ---- Student: raise a ticket ----
    router.post("/raise-ticket", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "1"))) return;
            const { key: ukey } = req.cookies;

            const type = String(req.body.type || "").trim();
            const category = String(req.body.category || "").trim();
            const priority = parseInt(req.body.priority, 10);
            const msg = String(req.body.msg || "").trim();

            if (!TICKET_TYPES.includes(type)) return res.json({ success: false, message: "Select concern type" });
            if (!TICKET_CATEGORIES.includes(category)) return res.json({ success: false, message: "Select a category" });
            if (![1, 2, 3].includes(priority)) return res.json({ success: false, message: "Select a priority" });
            if (msg.length < 10) return res.json({ success: false, message: "Please describe your concern (at least 10 characters)" });
            if (msg.length > 2000) return res.json({ success: false, message: "Please keep your message under 2000 characters" });

            // at most 5 open tickets per student, so the queue can't be flooded
            const [[open]] = await db.promise().query(
                "SELECT COUNT(id)::int AS n FROM tickets WHERE mem_id = ? AND status = '1'", [ukey]
            );
            if (open.n >= 5) return res.json({ success: false, message: "You already have 5 open tickets — please wait for a reply" });

            const t_id = await getUniqueTicketId(db);
            const datetime = Math.floor(Date.now() / 1000);
            await db.promise().query(
                `INSERT INTO tickets (t_id, mem_id, type, msg, category, priority, datetime, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, '1')`,
                [t_id, ukey, type, msg, category, priority, String(datetime)]
            );
            addactivity(ukey, t_id, "tickets", "Ticket raised (" + type + ", " + category + ")", "", "");
            return res.json({ success: true, t_id, message: "Ticket submitted — our team will get back to you soon" });
        } catch (err) {
            console.error("raise-ticket:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // ---- Student: their own tickets ----
    router.post("/my-tickets", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "1"))) return;
            const { key: ukey } = req.cookies;
            const [rows] = await db.promise().query(
                `SELECT t_id, type, category, priority, msg, datetime, status
                 FROM tickets WHERE mem_id = ? ORDER BY id DESC LIMIT 50`, [ukey]
            );
            return res.json({ success: true, data: rows });
        } catch (err) {
            console.error("my-tickets:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });
};
