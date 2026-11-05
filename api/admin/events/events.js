/**
 * API routes for src/pages/panel/admin/Events.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const sendMail = require("../../shared/mail");
const startup = require("../../shared/startup");
const { validTz, zonedToEpoch } = require("../../shared/timezone");

// Events saved before the time-zone field were entered in India time.
const DEFAULT_TZ = "Asia/Kolkata";

module.exports = (router, ctx) => {
    const { db, md5, dateRangeFilter, verifyAccount, addactivity } = ctx;

    // the zone the event's date + time were entered in (the website shows each
    // visitor the time in their own zone)
    const ready = startup.setup("events.timezone column", () =>
        db.pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT '${DEFAULT_TZ}'`));

    router.post("/events", async (req, res) => {
        try {
            /* ---------------- AUTH CHECK ---------------- */
            if (!(await verifyAccount(req, res, "X,Y"))) return;

            /* ---------------- BODY DATA ---------------- */
            const { cid, bid, q, s, n } = req.body;

            /* ---------------- SEARCH & SORT ---------------- */

            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            let orderBy = "id DESC";
            if (sortby === "Old") {
                orderBy = "id ASC";
            }

            /* ---------------- WHERE CONDITION ---------------- */

            /* Full-table stats for the cards above the table (whole table, not this page) */
            let stats = null;
            try {
                const [statsRows] = await db.promise().query(
                    `SELECT
                     COUNT(id) AS total,
                     COUNT(CASE WHEN status = '1' THEN 1 END) AS ongoing,
                     COUNT(CASE WHEN status = '2' THEN 1 END) AS ended,
                     COUNT(CASE WHEN status IN ('0','1S') THEN 1 END) AS disabled
                     FROM events
                     WHERE status IN ('0','1','1S','2')`,
                    []
                );
                if (statsRows && statsRows[0]) {
                    const r = statsRows[0];
                    stats = { 
                total:    Number(r.total || 0),
                ongoing:  Number(r.ongoing || 0),
                ended:    Number(r.ended || 0),
                disabled: Number(r.disabled || 0),
             };
                }
            } catch (statErr) {
                console.error("events stats error:", statErr);
            }

            let where = "WHERE status IN ('0','1','1S','2')";
            let params = [];

            const searchFields = [
                "badge", "title", "description",
                "a_badge", "a_title", "a_description",
                "b_badge", "b_title", "b_description",
                "b_event_date", "b_event_time", "b_features", "b_tags", "b_link",
                "c_badge", "c_title", "c_description",
                "d_badge", "d_title", "bootcamp", "newbatch",
                "timer_title",
                "timer_desc",
                "learnings_title",
                "audiences_title",
                "note_title", "note_desc"
            ];

            if (search) {
                where += `
                    AND (${searchFields.map(f => `${f} ILIKE ?`).join(" OR ")})
                `;

                const likeSearch = `%${search}%`;
                searchFields.forEach(() => params.push(likeSearch));
            }

            /* ---------------- DATE FILTER ---------------- */

            const dr = dateRangeFilter(req.body.df, req.body.dt);
            params.push(...dr.params);

            /* ---------------- PAGINATION ---------------- */

            const limit = 10;
            const offset = (page - 1) * limit;

            /* ---------------- COUNT QUERY ---------------- */

            const countSql = `
            SELECT COUNT(id) AS total
            FROM events
            ${where} ${dr.clause()}
            `;

            const [countRows] = await db.promise().query(countSql, params);

            const total = countRows[0]?.total || 0;
            const lastPage = total === 0 ? 0 : Math.ceil(total / limit);

            if (page > lastPage && lastPage > 0) {
                page = lastPage;
            }

            /* ---------------- FETCH EVENTS ---------------- */

            const dataSql = `
            SELECT *
            FROM events
            ${where} ${dr.clause()}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
            `;

            const dataParams = [...params, limit, offset];

            const [rows] = await db.promise().query(dataSql, dataParams);

            if (rows.length === 0) {
                return res.json({
                    success: false,
                    data: [],
                    page,
                    lastPage,
                    message: "No data found",
                });
            }

            /* ---------------- FETCH RELATED TABLES ---------------- */

            const eventIds = rows.map(r => r.event_id);

            const [learnRows] = await db.promise().query(
                `SELECT * FROM event_learnings WHERE event_id = ANY(?)`,
                [eventIds]
            );

            const [audienceRows] = await db.promise().query(
                `SELECT * FROM event_audience WHERE event_id = ANY(?)`,
                [eventIds]
            );

            const [timerRows] = await db.promise().query(
                `SELECT * FROM event_timer WHERE event_id = ANY(?)`,
                [eventIds]
            );

            /* ---------------- ATTACH LISTS ---------------- */

            rows.forEach(event => {
                event.learnings = learnRows.filter(
                    l => l.event_id == event.event_id
                );

                event.audience = audienceRows.filter(
                    a => a.event_id == event.event_id
                );

                event.timers = timerRows.filter(
                    a => a.event_id == event.event_id
                );
            });

            /* ---------------- RESPONSE ---------------- */

            return res.json({
                success: true,
                data: rows,
                total,
                page,
                lastPage,
                stats,
            });

        } catch (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });

    router.post("/add-event", async (req, res) => {
        const {
            badge,
            title,
            description,

            a_badge,
            a_title,
            a_description,

            b_badge,
            b_title,
            b_description,
            b_event_date,
            b_event_time,
            b_features,
            b_tags,
            b_link,
            timezone,

            c_badge,
            c_title,
            c_description,

            d_badge,
            d_title,
            d_description,
            bootcamp,
            newbatch,

            learnings_title,
            audiences_title,
            timer_title,

            note_title,
            note_desc,

            learnings,
            audience,
            timers,
        } = req.body;

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        // ✅ VALIDATIONS
        if (!title || title.trim().length <= 2) {
            return res.json({
                success: false,
                message: "Please enter main title",
            });
        }

        if (!b_event_date) {
            return res.json({
                success: false,
                message: "Please select event date",
            });
        }

        if (!b_event_time) {
            return res.json({
                success: false,
                message: "Please select event time",
            });
        }

        /*
        if (!bootcamp || bootcamp.trim().length <= 2) {
            return res.json({
                success: false,
                message: "Please enter bootcamp details",
            });
        }

        if (learnings && learnings.length >= 1 && learnings_title.length === 0) {
            return res.json({
                success: false,
                message: "Please enter learning section title",
            });
        }

        if (audience && audience.length >= 1 && audiences_title.length === 0) {
            return res.json({
                success: false,
                message: "Please enter audience section title",
            });
        }
        */

        const eventTz = validTz(timezone) ? timezone : DEFAULT_TZ;
        const eventTimestamp = zonedToEpoch(b_event_date, b_event_time, eventTz);
        if (!Number.isFinite(eventTimestamp)) {
            return res.json({ success: false, message: "Please select a valid event date and time" });
        }
        await ready;

        const datetime = Math.floor(Date.now() / 1000);

        const event_id =
            "a" + md5(Math.random() + Date.now() + datetime);

        const eventSql = `
            INSERT INTO events (
                event_id,
                badge, title, description,
                a_badge, a_title, a_description,
                b_badge, b_title, b_description,
                b_event_date, b_event_time, b_features, b_tags, b_link, timezone,
                c_badge, c_title, c_description,
                d_badge, d_title, d_description, bootcamp, newbatch,
                learnings_title, audiences_title, timer_title, 
                note_title, note_desc, datetime, 
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

        // Run the parent event + all child rows in one real transaction so a
        // failure can't leave a half-built event or hang the request. The old
        // code passed an async function as a db.query callback and dead 3-arg
        // callbacks to VALUES ? inserts, so child-insert errors became unhandled
        // rejections that never responded (audit BE-01 / BE-04 / BE-05).
        try {
            await db.withTransaction(async (tx) => {
                await tx.query(eventSql, [
                    event_id,
                    badge, title, description,
                    a_badge, a_title, a_description,
                    b_badge, b_title, b_description,
                    eventTimestamp, b_event_time, b_features, b_tags, b_link, eventTz,
                    c_badge, c_title, c_description,
                    d_badge, d_title, d_description, bootcamp, newbatch,
                    learnings_title, audiences_title, timer_title,
                    note_title, note_desc, datetime,
                    "1"
                ]);

                // Insert Learnings
                if (learnings.length) {
                    const learningValues = learnings.map((l) => [
                        event_id,
                        l.title,
                        l.description,
                    ]);
                    await tx.query(
                        "INSERT INTO event_learnings (event_id, title, description) VALUES ?",
                        [learningValues]
                    );
                }

                // Insert Audience
                if (audience.length) {
                    const audienceValues = audience.map((a) => [
                        event_id,
                        a.icon,
                        a.title,
                        a.subtitle,
                    ]);
                    await tx.query(
                        "INSERT INTO event_audience (event_id, icon, title, subtitle) VALUES ?",
                        [audienceValues]
                    );
                }

                // Insert timer
                if (timers.length) {
                    const timerValues = timers.map((a) => [
                        event_id,
                        a.icon,
                        a.title,
                        a.subtitle,
                    ]);
                    await tx.query(
                        "INSERT INTO event_timer (event_id, icon, title, subtitle) VALUES ?",
                        [timerValues]
                    );
                }
            });

            res.json({
                success: true,
                message: "Full Event Created Successfully",
            });
        } catch (err) {
            console.error("add-event failed:", err);
            res.status(500).json({ success: false, message: "Failed to create event" });
        }

    });

    router.post("/update-event", async (req, res) => {

        try {

            const {
                event_id,

                badge,
                title,
                description,

                a_badge,
                a_title,
                a_description,

                b_badge,
                b_title,
                b_description,
                b_event_date,
                b_event_time,
                b_features,
                b_tags,
                b_link,
                timezone,

                c_badge,
                c_title,
                c_description,

                d_badge,
                d_title,
                d_description,
                bootcamp,
                newbatch,

                note_title,
                note_desc,

                learnings_title,
                audiences_title,
                timer_title,

                learnings = [],
                audience = [],
                timers = []
            } = req.body;

            if (!(await verifyAccount(req, res, "X,Y"))) return;

            if (!event_id) {
                return res.json({ success: false, message: "Invalid event id" });
            }

            // ✅ VALIDATIONS
            if (!title || title.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter event title",
                });
            }

            if (!b_event_date) {
                return res.json({
                    success: false,
                    message: "Please select event date",
                });
            }

            if (!b_event_time) {
                return res.json({
                    success: false,
                    message: "Please select event time",
                });
            }

            /*
            if (!bootcamp || bootcamp.trim().length <= 2) {
                return res.json({
                    success: false,
                    message: "Please enter bootcamp details",
                });
            }

            if (learnings && learnings.length >= 1 && learnings_title.length === 0) {
                return res.json({
                    success: false,
                    message: "Please enter learning section title",
                });
            }

            if (audience && audience.length >= 1 && audiences_title.length === 0) {
                return res.json({
                    success: false,
                    message: "Please enter audience section title",
                });
            }
            */
            /* ---------------- UPDATE MAIN EVENT ---------------- */

            const eventTz = validTz(timezone) ? timezone : DEFAULT_TZ;
            const eventDateUnix = zonedToEpoch(b_event_date, b_event_time, eventTz);
            if (!Number.isFinite(eventDateUnix)) {
                return res.json({ success: false, message: "Please select a valid event date and time" });
            }
            await ready;

            const updateSql = `
                UPDATE events SET
                    badge=?,
                    title=?,
                    description=?,
                    a_badge=?,
                    a_title=?,
                    a_description=?,
                    b_badge=?,
                    b_title=?,
                    b_description=?,
                    b_event_date=?,
                    b_event_time=?,
                    b_features=?,
                    b_tags=?,
                    b_link=?,
                    timezone=?,
                    c_badge=?,
                    c_title=?,
                    c_description=?,
                    d_badge=?,
                    d_title=?,
                    d_description=?,
                    bootcamp=?,
                    newbatch=?,
                    learnings_title=?,
                    audiences_title=?,
                    timer_title=?,
                    note_title=?,
                    note_desc=?
                WHERE event_id=?
                `;

            // Update the event and rebuild its child rows atomically. Without a
            // transaction, a failure after the DELETEs would leave the event with
            // zero learnings/audience/timers (audit BE-05).
            await db.withTransaction(async (tx) => {

                await tx.query(updateSql, [
                    badge,
                    title,
                    description,
                    a_badge,
                    a_title,
                    a_description,
                    b_badge,
                    b_title,
                    b_description,
                    eventDateUnix,
                    b_event_time,
                    b_features,
                    b_tags,
                    b_link,
                    eventTz,
                    c_badge,
                    c_title,
                    c_description,
                    d_badge,
                    d_title,
                    d_description,
                    bootcamp,
                    newbatch,
                    learnings_title,
                    audiences_title,
                    timer_title,
                    note_title,
                    note_desc,
                    event_id,
                ]);

                /* ---------------- DELETE OLD CHILD DATA ---------------- */

                await tx.query(
                    "DELETE FROM event_learnings WHERE event_id=?",
                    [event_id]
                );

                await tx.query(
                    "DELETE FROM event_audience WHERE event_id=?",
                    [event_id]
                );

                await tx.query(
                    "DELETE FROM event_timer WHERE event_id=?",
                    [event_id]
                );

                /* ---------------- INSERT NEW LEARNINGS ---------------- */

                if (learnings.length > 0) {
                    const learningValues = learnings.map((l) => [
                        event_id,
                        l.title,
                        l.description,
                    ]);

                    await tx.query(
                        "INSERT INTO event_learnings (event_id, title, description) VALUES ?",
                        [learningValues]
                    );
                }

                /* ---------------- INSERT NEW AUDIENCE ---------------- */

                if (audience.length > 0) {
                    const audienceValues = audience.map((a) => [
                        event_id,
                        a.icon,
                        a.title,
                        a.subtitle,
                    ]);

                    await tx.query(
                        "INSERT INTO event_audience (event_id, icon, title, subtitle) VALUES ?",
                        [audienceValues]
                    );
                }

                /* ---------------- INSERT NEW TIMER ---------------- */

                if (timers.length > 0) {
                    const timerValues = timers.map((a) => [
                        event_id,
                        a.icon,
                        a.title,
                        a.subtitle,
                    ]);

                    await tx.query(
                        "INSERT INTO event_timer (event_id, icon, title, subtitle) VALUES ?",
                        [timerValues]
                    );
                }
            });

            /* ---------------- COMMIT ---------------- */

            return res.json({
                success: true,
                message: "Event Updated Successfully",
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });

    router.post("/disable-event", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Active */
            const sql = `
            SELECT * 
            FROM events 
            WHERE event_id = ? AND status = '1'
            LIMIT 1
            `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                const dbId = rows[0].event_id;
                const title = rows[0].title;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Disable Batch */
                const updateSql = `
                    UPDATE events 
                    SET status = '1S' 
                    WHERE event_id = ? AND status = '1'
                    LIMIT 1
                `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Event info disabled to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "events", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Event details was successfully disabled"
                        });

                    } else {

                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });

                    }

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

    router.post("/enable-event", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT *
                FROM events
                WHERE event_id = ? AND status = '1S'
                LIMIT 1
                `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                const dbId = rows[0].event_id;
                const title = rows[0].title;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE events
                    SET status = '1'
                    WHERE event_id = ? AND status = '1S'
                    LIMIT 1
                `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Event info enabled to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "events", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Event details was successfully enabled"
                        });

                    } else {

                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });

                    }

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

    router.post("/end-event", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { id} = req.body;

            /* 2️⃣ check ID */
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            /* 3️⃣ Check Batch Exists & Disabled */
            const sql = `
                SELECT *
                FROM events
                WHERE event_id = ?
                LIMIT 1
                `;

            db.query(sql, [id], (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length !== 1) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                const dbId = rows[0].event_id;
                const title = rows[0].title;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Enable Batch */
                const updateSql = `
                    UPDATE events
                    SET status = '2'
                    WHERE event_id = ? 
                    LIMIT 1
                `;

                db.query(updateSql, [id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Event info ended to '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "events", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Event details was successfully saved as ended"
                        });

                    } else {

                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });

                    }

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

    router.post("/delete-event", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id } = req.body;
            if (!id || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "Invalid event ID. Please try again."
                });
            }

            const [rows] = await db.promise().query(
                "SELECT * FROM events WHERE event_id = ? LIMIT 1",
                [id]
            );

            if (rows.length === 0) {
                return res.json({
                    success: false,
                    message: "Event not found or already deleted"
                });
            }

            const event = rows[0];

            await db.withTransaction(async (tx) => {
                await tx.query("DELETE FROM event_learnings WHERE event_id = ?", [id]);
                await tx.query("DELETE FROM event_audience WHERE event_id = ?", [id]);
                await tx.query("DELETE FROM event_timer WHERE event_id = ?", [id]);
                await tx.query("DELETE FROM eventnotifies WHERE evt_id = ?", [id]);
                await tx.query("DELETE FROM events WHERE event_id = ?", [id]);
            });

            addactivity(ukey, id, "events", `Event deleted '${event.title || ""}'`, "", "");

            return res.json({
                success: true,
                message: "Event deleted successfully"
            });
        } catch (err) {
            console.error("delete-event error:", err);
            return res.status(500).json({
                success: false,
                message: "Server error deleting event"
            });
        }
    });

    /* event notifications list */
    router.post("/event/notifies", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const { q, s, n } = req.body;

            /* SEARCH */
            const search = q ? q.trim() : "";

            /* SORT */
            let orderBy = "id DESC";

            if (s === "Old") {
                orderBy = "id ASC";
            }

            /* PAGE */
            let page = n ? parseInt(n) : 1;

            /* WHERE */
            let where = "WHERE status='1' OR status='2'";
            let params = [];

            if (search) {
                where = "WHERE (email ILIKE ?) AND (status='1' OR status='2')";
                params.push(`%${search}%`);
            }

            /* PAGINATION */
            const limit = 10;
            const offset = (page - 1) * limit;

            /* COUNT */
            const countSql = `
            SELECT COUNT(id) AS total
            FROM eventnotifies
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

                /* FETCH DATA */

                const dataSql = `
                SELECT *
                FROM eventnotifies
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

    router.post("/event/send-notifications", async (req, res) => {

        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {

            const sql = `
            SELECT id,email
            FROM eventnotifies
            WHERE status='1'
            LIMIT 100
            `;

            db.query(sql, async (err, rows) => {

                if (err) {
                    console.error(err);
                    return res.json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (rows.length === 0) {
                    return res.json({
                        success: true,
                        message: "No pending emails"
                    });
                }

                /* collect emails */
                const emails = rows.map(r => r.email);

                let link = process.env.DOMAIN + "event";

                const html = `
                    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">

                        <h2 style="color:#2c3e50;">
                        🚀 Next AI Webinar / Bootcamp Open
                        </h2>

                        <p>Hello,</p>

                        <p>
                        The <b>next AI Webinar / Bootcamp</b> has officially opened.
                        </p>

                        <p>
                        You subscribed to get notified when a new event opens.
                        </p>

                        <div style="
                            background:#f3f6fa;
                            padding:20px;
                            margin:20px 0;
                            text-align:center;
                            border-radius:8px;
                            border:1px dashed #3498db;
                        ">

                            <a href="${link}"
                            style="
                            background:#3498db;
                            color:#fff;
                            text-decoration:none;
                            padding:12px 25px;
                            font-size:16px;
                            border-radius:6px;
                            display:inline-block;
                            ">
                            View Upcoming Events
                            </a>

                        </div>

                        <p>Seats are limited. Register soon.</p>

                        <hr>

                        <p style="font-size:13px;color:#777">
                        Regards<br>
                        <b>Rivira Tech Team</b><br>
                        🌐 www.riviratech.com
                        </p>

                    </div>
                    `;

                const subject = "🚀 Next AI Webinar / Bootcamp Registration Open";

                /* send mail */
                const sent = await sendMail(
                    "noreply@riviratech.com", // main receiver
                    subject,
                    html,
                    emails // CC list
                );

                if (!sent) {
                    return res.json({
                        success: false,
                        message: "Email sending failed"
                    });
                }

                /* update status */

                const ids = rows.map(r => r.id);

                const updateSql = `
                UPDATE eventnotifies
                SET status='2'
                WHERE id = ANY(?)
                 `;

                db.query(updateSql, [ids]);

                return res.json({
                    success: true,
                    message: "Emails sent successfully",
                    count: rows.length
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
// the category "admin/events" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "events" },
    { table: "event_audience" },
    { table: "event_learnings" },
    { table: "event_timer" },
    { table: "eventnotifies" },
];
