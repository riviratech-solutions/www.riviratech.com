/* Home page "Learn your way" plan slider — managed from Panel → Plan Slides.

   plan_section  one row (id = 1): the heading above the slider
                 eyebrow, title, subtitle, autoplay (seconds, 0 = off),
                 status '1' shown / '0' hidden, updated
   plan_slides   one row per card
                 plan (bundle | monthly | individual — picks the program page
                 plan and the Stripe checkout the buttons lead to), tag, title,
                 description, points (JSON array), cta, link_text, price, unit,
                 badge, theme (a | b | c), sortno, status '1' shown / '1S'
                 hidden, datetime, updated

   Both tables are created on start and seeded with the slider's original
   content the first time. Prices on a slide are display text: the amount
   actually charged comes from the plan (PROGRAM_PLANS in website/program-genai/program-genai.js). */

const PLAN_KEYS = ["bundle", "monthly", "individual"];
const THEMES = ["a", "b", "c"];
const now = () => Math.floor(Date.now() / 1000);

const SEED_SECTION = {
    eyebrow: "Flexible Access",
    title: "Learn your way — subscribe or own it",
    subtitle: "Live classes and recorded videos on every plan. Choose the access that fits you.",
    autoplay: 6,
};

const SEED_SLIDES = [
    {
        plan: "bundle", tag: "Bundle Subscription", title: "All-Access Bundle",
        description: "Unlock every Rivira Tech program for one monthly price — full recorded video library, with new batches through the year.",
        points: ["All programs & tracks", "recorded classes", "Cancel anytime"],
        cta: "Explore the Bundle", price: "$40", unit: "/ month", theme: "a",
    },
    {
        plan: "monthly", tag: "Monthly Subscription", title: "One Program, Month-to-Month",
        description: "Pick a single program and pay month to month. Attend live sessions and rewatch recorded videos anytime while you're subscribed.",
        points: ["One program of your choice", "Live + recorded access", "1:1 mentor support"],
        cta: "Start Monthly", price: "$50", unit: "/ month", theme: "b",
    },
    {
        plan: "individual", tag: "Individual Course", title: "Lifetime Individual Access",
        description: "Prefer to pay once? Get lifetime access to a single program's recorded library, hands-on projects and a completion certificate.",
        points: ["Pay once, learn forever", "Lifetime recorded access", "Personalized project reviews"],
        cta: "Get Lifetime Access", price: "$450", unit: "/ one-time", theme: "c",
    },
];

async function ensureTables(db) {
    const q = (sql, p = []) => db.promise().query(sql, p);
    await q(`CREATE TABLE IF NOT EXISTS plan_section (
        id INTEGER PRIMARY KEY DEFAULT 1,
        eyebrow TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        subtitle TEXT NOT NULL DEFAULT '',
        autoplay INTEGER NOT NULL DEFAULT 6,
        status TEXT NOT NULL DEFAULT '1',
        updated BIGINT NOT NULL DEFAULT 0
    )`);
    await q(`CREATE TABLE IF NOT EXISTS plan_slides (
        id BIGSERIAL PRIMARY KEY,
        plan TEXT NOT NULL,
        tag TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        points TEXT NOT NULL DEFAULT '[]',
        cta TEXT NOT NULL DEFAULT '',
        link_text TEXT NOT NULL DEFAULT 'View program details →',
        price TEXT NOT NULL DEFAULT '',
        unit TEXT NOT NULL DEFAULT '',
        badge TEXT NOT NULL DEFAULT 'Live + Recorded',
        theme TEXT NOT NULL DEFAULT 'a',
        sortno INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT '1',
        datetime BIGINT NOT NULL DEFAULT 0,
        updated BIGINT NOT NULL DEFAULT 0
    )`);

    const [sec] = await q(`SELECT id FROM plan_section WHERE id = 1`);
    if (!sec.length) {
        await q(`INSERT INTO plan_section (id, eyebrow, title, subtitle, autoplay, status, updated) VALUES (1, ?, ?, ?, ?, '1', ?)`,
            [SEED_SECTION.eyebrow, SEED_SECTION.title, SEED_SECTION.subtitle, SEED_SECTION.autoplay, now()]);
        // first run only: an existing site that emptied its slides keeps them empty
        const [[c]] = await q(`SELECT COUNT(*)::int AS n FROM plan_slides`);
        if (!c.n) {
            let i = 0;
            for (const s of SEED_SLIDES) {
                await q(`INSERT INTO plan_slides (plan, tag, title, description, points, cta, price, unit, theme, sortno, status, datetime, updated)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?)`,
                    [s.plan, s.tag, s.title, s.description, JSON.stringify(s.points), s.cta, s.price, s.unit, s.theme, ++i, now(), now()]);
            }
        }
    }
}

const parsePoints = (v) => {
    try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
};
const shapeSlide = (r) => r && ({
    ...r, id: Number(r.id), points: parsePoints(r.points),
    ...(r.sortno != null ? { sortno: Number(r.sortno) } : {}),
});
const shapeSection = (r) => ({
    eyebrow: r?.eyebrow ?? SEED_SECTION.eyebrow,
    title: r?.title ?? SEED_SECTION.title,
    subtitle: r?.subtitle ?? SEED_SECTION.subtitle,
    autoplay: Number(r?.autoplay ?? SEED_SECTION.autoplay),
    status: r?.status ?? "1",
});

const str = (v, max) => String(v ?? "").trim().slice(0, max);

// Validated slide fields from a request body, or { error }.
function readSlide(b) {
    const s = {
        plan: str(b.plan, 20),
        tag: str(b.tag, 60),
        title: str(b.title, 120),
        description: str(b.description, 600),
        points: (Array.isArray(b.points) ? b.points : []).map((p) => str(p, 80)).filter(Boolean).slice(0, 6),
        cta: str(b.cta, 40),
        link_text: str(b.link_text, 60),
        price: str(b.price, 20),
        unit: str(b.unit, 30),
        badge: str(b.badge, 40),
        theme: str(b.theme, 2),
    };
    if (!PLAN_KEYS.includes(s.plan)) return { error: "Please choose a plan" };
    if (!s.title) return { error: "Please enter a title" };
    if (!s.price) return { error: "Please enter the price shown on the card" };
    if (!s.cta) return { error: "Please enter the button text" };
    if (!THEMES.includes(s.theme)) s.theme = "a";
    return { slide: s };
}

/* Plans currently on offer: those with at least one shown slide, none at all
   while the whole section is switched off. The program page and its Stripe
   checkout only offer / accept these. */
async function offeredPlans(db) {
    const [secRows] = await db.promise().query(`SELECT status FROM plan_section WHERE id = 1`);
    if (secRows[0] && secRows[0].status === "0") return [];
    const [rows] = await db.promise().query(`SELECT DISTINCT plan FROM plan_slides WHERE status = '1'`);
    return rows.map((r) => r.plan).filter((k) => PLAN_KEYS.includes(k));
}

function register(router, db, verifyAccount) {
    const q = (sql, p = []) => db.promise().query(sql, p).then(([r]) => r);
    const fail = (res, err, msg = "Something went wrong") => {
        if (err) console.error("plan-slides:", err.message);
        return res.json({ success: false, message: msg });
    };

    /* ---- Public read for the home page (no auth) ---- */
    router.get("/get-plan-slides", async (req, res) => {
        try {
            const [sec] = await q(`SELECT * FROM plan_section WHERE id = 1`);
            const rows = await q(`SELECT id, plan, tag, title, description, points, cta, link_text, price, unit, badge, theme
                                  FROM plan_slides WHERE status = '1' ORDER BY sortno ASC, id ASC`);
            res.json({ success: true, section: shapeSection(sec), data: rows.map(shapeSlide) });
        } catch (err) {
            console.error("get-plan-slides:", err.message);
            res.json({ success: false, data: [] });
        }
    });

    /* ---- Admin ---- */
    router.post("/plan-slides/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const [sec] = await q(`SELECT * FROM plan_section WHERE id = 1`);
            const rows = await q(`SELECT * FROM plan_slides ORDER BY sortno ASC, id ASC`);
            res.json({ success: true, section: shapeSection(sec), data: rows.map(shapeSlide) });
        } catch (err) { fail(res, err, "Failed to load slides"); }
    });

    // add (no id) or edit (id)
    router.post("/plan-slides/save", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const { slide: s, error } = readSlide(req.body);
            if (error) return fail(res, null, error);
            const id = Number(req.body.id) || 0;
            const vals = [s.plan, s.tag, s.title, s.description, JSON.stringify(s.points), s.cta, s.link_text, s.price, s.unit, s.badge, s.theme];
            let rowId = id;
            if (id) {
                await q(
                    `UPDATE plan_slides SET plan=?, tag=?, title=?, description=?, points=?, cta=?, link_text=?, price=?, unit=?, badge=?, theme=?, updated=? WHERE id=?`,
                    [...vals, now(), id]);
            } else {
                const [{ n }] = await q(`SELECT COALESCE(MAX(sortno), 0) + 1 AS n FROM plan_slides`);
                const ok = await q(
                    `INSERT INTO plan_slides (plan, tag, title, description, points, cta, link_text, price, unit, badge, theme, sortno, status, datetime, updated)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?)`,
                    [...vals, Number(n), now(), now()]);
                rowId = ok.insertId;
            }
            const [saved] = await q(`SELECT * FROM plan_slides WHERE id = ?`, [rowId]);
            if (!saved) return fail(res, null, "Slide not found");
            res.json({ success: true, data: shapeSlide(saved), message: id ? "Slide updated" : "Slide added" });
        } catch (err) { fail(res, err); }
    });

    router.post("/plan-slides/toggle", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const active = !!req.body.active;
            await q(`UPDATE plan_slides SET status = ?, updated = ? WHERE id = ?`, [active ? "1" : "1S", now(), Number(req.body.id) || 0]);
            res.json({ success: true, message: active ? "Slide shown on the home page" : "Slide hidden from the home page" });
        } catch (err) { fail(res, err); }
    });

    router.post("/plan-slides/reorder", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
            if (!ids.length) return fail(res, null, "Invalid order");
            for (let i = 0; i < ids.length; i++) await q(`UPDATE plan_slides SET sortno = ? WHERE id = ?`, [i + 1, ids[i]]);
            res.json({ success: true, message: "Order saved" });
        } catch (err) { fail(res, err); }
    });

    router.post("/plan-slides/delete", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            await q(`DELETE FROM plan_slides WHERE id = ?`, [Number(req.body.id) || 0]);
            res.json({ success: true, message: "Slide deleted" });
        } catch (err) { fail(res, err); }
    });

    // heading above the slider + autoplay + show / hide the whole section
    router.post("/plan-slides/section", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const b = req.body;
            const title = str(b.title, 120);
            if (!title) return fail(res, null, "Please enter the section heading");
            const autoplay = Math.min(30, Math.max(0, parseInt(b.autoplay, 10) || 0));
            const vals = [str(b.eyebrow, 40), title, str(b.subtitle, 300), autoplay, b.status === "0" ? "0" : "1", now()];
            await q(`INSERT INTO plan_section (id, eyebrow, title, subtitle, autoplay, status, updated) VALUES (1, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (id) DO UPDATE SET eyebrow = EXCLUDED.eyebrow, title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
                       autoplay = EXCLUDED.autoplay, status = EXCLUDED.status, updated = EXCLUDED.updated`, vals);
            const [sec] = await q(`SELECT * FROM plan_section WHERE id = 1`);
            res.json({ success: true, section: shapeSection(sec), message: "Section saved" });
        } catch (err) { fail(res, err); }
    });
}

module.exports = { ensureTables, register, offeredPlans, PLAN_KEYS };
