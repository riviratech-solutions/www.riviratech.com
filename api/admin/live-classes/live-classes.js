/**
 * API routes for src/pages/panel/admin/LiveClasses.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const crypto = require("crypto");
const { validTz, zonedToEpoch } = require("../../shared/timezone");

module.exports = (router, ctx) => {
    const fs = require("fs");
    const fsp = require("fs/promises");
    const { db, md5, verifyAccount, moveS3File, deleteS3File, addactivity, resolveUploadPath } = ctx;
    const { checkSecurityToken } = require("../../security/backup-token");

    // Recordings: private storage, FFmpeg HLS (AES-128) and playback for the
    // people allowed to watch — see class-video.js.
    const video = require("./class-video")(ctx);
    const drive = require("./class-drive");
    video.register(router);

    // Zoom / recorded-video links are opened straight from the panels (Join,
    // Watch), so only real web links are kept — a "javascript:" link would run
    // as whoever clicks it.
    // Where a class's files live: riviratech/classes/<course id>/<batch id>/<class id>/<file>.
    // The ids must be plain ids, so a request can't point the path anywhere else.
    const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
    const classFileKey = (cid, bid, classId, tempKey) => {
        const parts = [cid, bid, classId].map((x) => String(x || ""));
        if (!parts.every((p) => SAFE_ID.test(p))) return "";
        return "riviratech/classes/" + parts.join("/") + "/" + String(tempKey || "").split("/").pop();
    };

    // A class document: a fresh server upload moved into the class's folder, or a
    // browser upload to Google Drive ("gdrive:<id>") checked and moved into the
    // class's Drive folder. Returns the stored key, or "".
    async function storeDoc(dfile, cid, bid, classId, storage) {
        if (drive.isDrive(dfile)) {
            if (!drive.enabled()) throw new Error("Google Drive is not configured on the server.");
            return await drive.claim(drive.idOf(dfile), "doc", cid, bid, classId);
        }
        if (storage === "gdrive" && String(dfile || "").startsWith("riviratech/temp/")) {
            if (!drive.enabled()) throw new Error("Google Drive is not configured on the server.");
            const src = resolveUploadPath && resolveUploadPath(dfile);
            if (src && fs.existsSync(src)) {
                const driveKey = await drive.storeServerFile(src, String(dfile).split("/").pop(), "doc", cid, bid, classId);
                await fsp.rm(src, { force: true }).catch(() => {});
                return driveKey;
            }
        }
        const newKey = classFileKey(cid, bid, classId, dfile);
        return newKey ? (await moveS3File(dfile, newKey)) || "" : "";
    }
    // an old video / document that was replaced: on this server or on Drive
    const removeStored = async (v) => {
        const k = String(v || "");
        if (drive.isDrive(k)) return await drive.trash(drive.idOf(k));
        if (k.startsWith("gdrive-hls:")) return; // a Secure stream on Drive: class-video.js removes it
        return await deleteS3File(k);
    };

    const isWebLink = (v) => /^https?:\/\/[^\s]+$/i.test(String(v || "").trim());

    // A student sees a course / batch's classes only when enrolled in it.
    async function studentEnrolled(memId, cid, bid) {
        const [rows] = await db.promise().query(
            "SELECT 1 FROM member_courses WHERE mem_id = ? AND c_id = ? AND COALESCE(b_id, '') = ? AND status = '1' LIMIT 1",
            [memId, String(cid || ""), String(bid || "")]
        );
        return rows.length > 0;
    }

    /* Classes page (src/pages/panel/admin/Classes.tsx — view only, every role):
       how many students the batch has, and the course's reviews — the visible
       course feedback students give on My Feedback (feedbacks type 'f'). Names
       are shortened to first name + initial; no emails. Same access as the class
       list: a student only for a course / batch they are enrolled in. */
    router.post("/class-overview", async (req, res) => {
        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;
        try {
            const cid = String(req.body.cid || "");
            const bid = String(req.body.bid || "");
            if (!cid) return res.json({ success: false, message: "Please choose a course" });
            if (ustatus === "1" && !(await studentEnrolled(ukey, cid, bid))) {
                return res.json({ success: false, message: "No data found" });
            }
            const [[cnt]] = await db.promise().query(
                `SELECT COUNT(DISTINCT mc.mem_id)::int AS n
                 FROM member_courses mc JOIN members m ON m.mem_id = mc.mem_id
                 WHERE mc.c_id = ? AND COALESCE(mc.b_id, '') = ? AND mc.status = '1' AND m.status = '1'`,
                [cid, bid]
            );
            const [rows] = await db.promise().query(
                `SELECT id, name, rating, feedback, datetime FROM feedbacks
                 WHERE type = 'f' AND status = '1' AND course_id = ?
                 ORDER BY datetime DESC, id DESC LIMIT 200`,
                [cid]
            );
            const shortName = (name) => {
                const parts = String(name || "").trim().split(" ").filter(Boolean);
                if (!parts.length) return "Student";
                return parts.length > 1 ? parts[0] + " " + parts[parts.length - 1].charAt(0).toUpperCase() + "." : parts[0];
            };
            const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            let sum = 0;
            const reviews = [];
            for (const r of rows) {
                const rating = parseInt(r.rating, 10);
                if (!(rating >= 1 && rating <= 5)) continue;
                dist[rating]++;
                sum += rating;
                reviews.push({ id: r.id, name: shortName(r.name), rating, text: String(r.feedback || ""), datetime: Number(r.datetime) || 0 });
            }
            return res.json({
                success: true,
                students: cnt ? cnt.n : 0,
                rating: { avg: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : 0, count: reviews.length, dist },
                reviews,
            });
        } catch (err) {
            console.error("class-overview:", err.message);
            return res.json({ success: false, message: "Database error" });
        }
    });

    router.post("/live-classes", async (req, res) => {

        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,1,2"))) return;

        try {
            const { cid, bid, q, s, n } = req.body;
            // all: "1" — every class of the batch in one answer (up to 500), for the
            // Classes page's course-content list (src/pages/panel/admin/Classes.tsx)
            const all = req.body.all === "1";

            // The rows carry the zoom link, passcode and recordings: a student
            // gets them only for a course / batch they are enrolled in.
            if (ustatus === "1" && !(await studentEnrolled(ukey, cid, bid))) {
                return res.json({ success: false, data: [], total: 0, page: 1, lastPage: 0, message: "No data found" });
            }

            /* 1️⃣ Get Query Params */
            const search = q ? q.trim() : "";
            const sortby = s ? s.trim() : "";
            let page = n ? parseInt(n) : 1;

            /* 2️⃣ Sort by Class Start Time (stimings) */
            let orderBy = "COALESCE(lc.stimings, 0) DESC, lc.id DESC";

            if (sortby === "Old" || (all && sortby !== "New")) {
                orderBy = "COALESCE(lc.stimings, 0) ASC, lc.id ASC";
            }

            /* 3️⃣ Search Filter */
            let params = [];

            let where = "";
            if (ustatus === "1") {
                where = "WHERE c_id = ? AND b_id = ? AND (status='0' OR status='1' OR status='2' OR status='3')";
                params.push(`${cid}`);
                params.push(`${bid}`);

                if (search) {
                    where =
                        "WHERE c_id = ? AND b_id = ? AND (title ILIKE ?) AND (status='0' OR status='1' OR status='2' OR status='3')";
                    params.push(`%${search}%`);
                }

            } else {
                // If all === "1" (for Classes.tsx view-only course plan): only active classes
                // If all !== "1" (admin/trainer panel LiveClasses.tsx): include deleted classes (status LIKE '%D')
                const statusCond = all
                    ? "(status='0' OR status='1' OR status='2' OR status='3' OR status='2S')"
                    : "(status='0' OR status='1' OR status='2' OR status='3' OR status='2S' OR status LIKE '%D')";
                where = `WHERE c_id = ? AND b_id = ? AND ${statusCond}`;
                params.push(`${cid}`);
                params.push(`${bid}`);

                if (search) {
                    where = `WHERE c_id = ? AND b_id = ? AND (title ILIKE ?) AND ${statusCond}`;
                    params.push(`%${search}%`);
                }

            }

            /* 4️⃣ Pagination */
            if (all) page = 1;
            const limit = all ? 500 : 10;
            const offset = (page - 1) * limit;

            let stats = {
                pending: 0,
                canceled: 0,
                upcoming: 0,
                completed: 0,
                deleted: 0,
                total: 0
            };

            /* 5️⃣ Count Total */
            let countSql = `
                SELECT COUNT(id) AS total, 
                CASE
                    WHEN status LIKE '%D' THEN 'deleted'
                    WHEN stimings >= extract(epoch from now()) AND status='1' THEN '1up'
                    ELSE status
                END AS status 
                FROM liveclasses 
                ${where} 
                GROUP BY CASE
                    WHEN status LIKE '%D' THEN 'deleted'
                    WHEN stimings >= extract(epoch from now()) AND status='1' THEN '1up'
                    ELSE status
                END;
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

                    if (row.status === "0") {
                        stats.canceled = Number(row.total);
                    }

                    if (row.status === "1") {
                        stats.pending = Number(row.total);
                    }

                    if (row.status === "2") {
                        stats.completed += Number(row.total);
                    }
                    if (row.status === "2S") {
                        stats.completed += Number(row.total); // disabled completed classes still count as completed
                    }

                    if (row.status === "1up") {
                        stats.upcoming = Number(row.total);
                    }

                    if (row.status === "deleted") {
                        stats.deleted = Number(row.total);
                    }

                    if (row.status !== "deleted") {
                        stats.total += Number(row.total);
                    }

                });

                const lastPage = stats.total === 0
                    ? 0
                    : Math.ceil(stats.total / limit);

                /* Fix Page Overflow */
                if (page > lastPage && lastPage > 0) {
                    page = lastPage;
                }

                /* 6️⃣ Fetch Data */
                const dataSql = `
                    SELECT 
                        lc.*, 
                        MAX(s.name) AS tname, MAX(s.email) AS temail, MAX(s.number) AS tphone
                    FROM liveclasses lc 
                    LEFT JOIN members s
                        ON s.mem_id = lc.trainer 

                    ${where.replaceAll("title", "lc.title")
                        .replaceAll("c_id", "lc.c_id")
                        .replaceAll("b_id", "lc.b_id")
                        .replaceAll("status", "lc.status")
                    }

                    GROUP BY lc.id
                    ORDER BY (lc.status LIKE '%D') ASC, ${orderBy}
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

    router.post("/add-class", async (req, res) => {
        try {
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,2"))) return;

            /* 2️⃣ Body Fields */
            const {
                status,
                c_id,
                b_id,
                title,
                trainer,
                classdate,
                cst,
                cet,
                file,
                vfile,
                pwd,
                dfile,
                zoom_link,
                passcode,
                notes,
                description,
            } = req.body;

            /* 3️⃣ Validations */
            if (!status) return res.json({ success: false, message: "Please select class type" });
            if (!c_id) return res.json({ success: false, message: "Please select course" });
            if (!b_id) return res.json({ success: false, message: "Please select batch" });
            if (!title) return res.json({ success: false, message: "Please enter title" });
            if (!trainer) return res.json({ success: false, message: "Please select trainer" });
            if (!classdate) return res.json({ success: false, message: "Please select class date" });
            if (!cst || !cet) return res.json({ success: false, message: "Please select class time" });

            /* 4️⃣ File Handling */

            if (!zoom_link && status === "1") {
                return res.json({
                    success: false,
                    message: "Please provide zoom link",
                });
            }
            if (zoom_link && !isWebLink(zoom_link)) {
                return res.json({
                    success: false,
                    message: "The zoom link must start with https://",
                });
            }
            if (vfile.length == 0 && status === "2") {
                return res.json({
                    success: false,
                    message: "Please upload class video",
                });
            }
            if (file.length == 0 && status === "3") {
                return res.json({
                    success: false,
                    message: "Please enter class video link",
                });
            }

            /* 5️⃣ Date Conversion — the date and times are wall-clock times in the
               class's time zone (the form's Time zone; every viewer then sees them
               in their own). Without one (an older page) the server's zone, as before. */
            const timezone = validTz(req.body.timezone) ? req.body.timezone : "";
            const toEpoch = (time) =>
                timezone ? zonedToEpoch(classdate, time, timezone) : Math.floor(new Date(classdate + " " + time).getTime() / 1000);
            const classdatex = timezone ? zonedToEpoch(classdate, "00:00", timezone) : Math.floor(new Date(classdate).getTime() / 1000);
            const stimings = toEpoch(cst);
            const etimings = toEpoch(cet);
            if (![classdatex, stimings, etimings].every(Number.isFinite)) return res.json({ success: false, message: "Please select a valid class date and time" });
            const datetime = Math.floor(Date.now() / 1000);

            if (status === "1" && stimings <= datetime) {
                return res.json({ success: false, message: "Please select class date & time more than current date & time" });
            }
            if (status !== "1" && stimings >= datetime) {
                return res.json({ success: false, message: "Please select class date & time less than current date & time" });
            }
            if (etimings <= stimings) {
                return res.json({ success: false, message: "Please select start time more than end time" });
            }

            // the new class's id — its files go into a folder named after it
            const req_id =
                "a" + crypto.createHash("md5").update(Date.now().toString() + title).digest("hex");

            let nvfile_key = "";
            if (vfile.length >= 10) {
                try {
                    // the recording goes to private storage (class-video.js)
                    nvfile_key = await video.storeUpload(vfile, c_id, b_id, req_id, req.body.storage, req.body.delivery);
                } catch (uploadErr) {
                    return res.json({ success: false, message: uploadErr.message || "Failed to store video" });
                }
                if (!nvfile_key) return res.json({ success: false, message: "Video file missing or not a supported video" });
            }

            let ndfile_key = "";
            if (dfile.length >= 10) {
                try {
                    ndfile_key = await storeDoc(dfile, c_id, b_id, req_id, req.body.storage);
                } catch (docErr) {
                    return res.json({ success: false, message: docErr.message || "Failed to store document" });
                }
                if (!ndfile_key) return res.json({ success: false, message: "Document missing or not a supported file" });
            }
            let cstatus = status;
            let type = "";
            if (status == "2") {
                type = "1";
                cstatus = "2";
            } else if (status == "3") {
                type = "2";
                cstatus = "2";
            }
            if (status === "3") {
                nvfile_key = file;
            }
            const storageVal = req.body.storage === "gdrive" || drive.isDrive(nvfile_key) || drive.isDrive(ndfile_key) ? "gdrive" : "server";

            /* 6️⃣ Insert */
            const insertSql = `
                INSERT INTO liveclasses
                (req_id, c_id, b_id, trainer, title, description, classdate, stimings, etimings,
                zoom_link, passcode, notes, file, pwd, type, doc, video_storage, datetime, status, timezone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertSql,
                [req_id,
                    c_id,
                    b_id,
                    trainer,
                    title,
                    // column is NOT NULL DEFAULT '' — an omitted field would bind
                    // as null and violate that, so normalise it here.
                    description || "",
                    classdatex,
                    stimings,
                    etimings,
                    zoom_link,
                    passcode,
                    notes,
                    nvfile_key,
                    pwd,
                    type,
                    ndfile_key,
                    storageVal,
                    datetime,
                    cstatus,
                    timezone,
                ],
                async (err, result) => {

                    if (err) {
                        console.error(err);
                        return res.json({
                            success: false,
                            message: "Database error",
                        });
                    }

                    if (result.affectedRows === 1) {
                        // delivery: "mp4" (private stream) or "hls" (encrypted, prepared in the background)
                        if (vfile.length >= 10 && nvfile_key) {
                            try {
                                await video.afterSave(req_id, nvfile_key, req.body.delivery, req.body.delete_original, req.body.storage, {
                                    name: req.body.video_name,
                                    size: req.body.video_size,
                                });
                            } catch (e) {
                                console.error("add-class video:", e.message);
                            }
                        }

                        let info = "New class added '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, req_id, "liveclasses", info, fromtxt, totxt);

                        const dataSql = `
                            SELECT 
                                lc.*, 
                                MAX(s.name) AS tname, MAX(s.email) AS temail, MAX(s.number) AS tphone
                            FROM liveclasses lc 
                            LEFT JOIN members s
                                ON s.mem_id = lc.trainer 
                            WHERE req_id = ? 
                            GROUP BY lc.id
                            ORDER BY lc.id DESC
                            LIMIT 1
                            `;
                        db.query(
                            dataSql,
                            [req_id], (err2, rows) => {

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
                                        message: "No data found"
                                    });

                                }

                                /* 8️⃣ Send Data */
                                return res.json({
                                    success: true,
                                    data: rows[0],
                                    message: "Class details successfully submitted",
                                });

                            });

                    } else {
                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                }
            );

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error",
            });
        }
    }
    );

    router.post("/update-class", async (req, res) => {
        try {
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,2"))) return;

            /* 2️⃣ Body Fields */
            const {
                req_id,
                status,
                c_id,
                b_id,
                title,
                trainer,
                classdate,
                cst,
                cet,
                vfile,
                dfile,
                zoom_link,
                passcode,
                notes,
                description,
            } = req.body;

            /* 3️⃣ Validations */
            if (!status) return res.json({ success: false, message: "Please select class type" });
            if (!c_id) return res.json({ success: false, message: "Please select course" });
            if (!b_id) return res.json({ success: false, message: "Please select batch" });
            if (!title) return res.json({ success: false, message: "Please enter title" });
            if (!trainer) return res.json({ success: false, message: "Please select trainer" });
            if (!classdate) return res.json({ success: false, message: "Please select class date" });
            if (!cst || !cet) return res.json({ success: false, message: "Please select class time" });

            /* 4️⃣ File Handling */

            // a live class needs its Zoom link; a completed one has a recording instead
            const isLive = status === "1";
            if (isLive && !zoom_link) {
                return res.json({
                    success: false,
                    message: "Please provide zoom link",
                });
            }
            if (zoom_link && !isWebLink(zoom_link)) {
                return res.json({
                    success: false,
                    message: "The zoom link must start with https://",
                });
            }

            /* 5️⃣ Date Conversion — the date and times are wall-clock times in the
               class's time zone (the form's Time zone; every viewer then sees them
               in their own). Without one (an older page) the server's zone, as before. */
            const timezone = validTz(req.body.timezone) ? req.body.timezone : "";
            const toEpoch = (time) =>
                timezone ? zonedToEpoch(classdate, time, timezone) : Math.floor(new Date(classdate + " " + time).getTime() / 1000);
            const classdatex = timezone ? zonedToEpoch(classdate, "00:00", timezone) : Math.floor(new Date(classdate).getTime() / 1000);
            const stimings = toEpoch(cst);
            const etimings = toEpoch(cet);
            if (![classdatex, stimings, etimings].every(Number.isFinite)) return res.json({ success: false, message: "Please select a valid class date and time" });
            const datetime = Math.floor(Date.now() / 1000);

            if (status === "1" && stimings <= datetime) {
                return res.json({ success: false, message: "Please select class date & time more than current date & time" });
            }
            if (!isLive && stimings >= datetime) {
                return res.json({ success: false, message: "Please select class date & time less than current date & time" });
            }
            if (etimings <= stimings) {
                return res.json({ success: false, message: "Please select start time more than end time" });
            }

            const sql = `
            SELECT * 
            FROM liveclasses 
            WHERE req_id = ?
            LIMIT 1
            `;

            db.query(sql, [req_id], async (err, rows) => {

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
                        message: "There was something wrong, Please try again1"
                    });
                }

                const dbreqId = rows[0].req_id;
                const dbfile = rows[0].file;
                const dbdoc = rows[0].doc;

                /* 4️⃣ Verify ID */
                if (md5(dbreqId) !== md5(req_id)) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again2"
                    });
                }

                let nvfile_key = dbfile;
                if (vfile.length >= 10) {
                    try {
                        // a replacement recording goes to private storage (class-video.js)
                        nvfile_key = await video.storeUpload(vfile, c_id, b_id, dbreqId, req.body.storage, req.body.delivery);
                    } catch (uploadErr) {
                        return res.json({ success: false, message: uploadErr.message || "Failed to store video" });
                    }
                    if (!nvfile_key) return res.json({ success: false, message: "Video file missing or not a supported video" });
                }

                let ndfile_key = dbdoc;
                if (dfile.length >= 10) {
                    try {
                        ndfile_key = await storeDoc(dfile, c_id, b_id, dbreqId, req.body.storage);
                    } catch (docErr) {
                        return res.json({ success: false, message: docErr.message || "Failed to store document" });
                    }
                    if (!ndfile_key) return res.json({ success: false, message: "Document missing or not a supported file" });
                }
                const storageVal = req.body.storage === "gdrive" || drive.isDrive(nvfile_key) || drive.isDrive(ndfile_key) ? "gdrive" : (req.body.storage === "server" ? "server" : (rows[0].video_storage || "server"));

                /* 6️⃣ Insert */
                const updateSql = `
                UPDATE liveclasses
                SET c_id = ?, b_id = ?, trainer = ?, title = ?, description = ?, classdate = ?, stimings = ?, etimings = ?, zoom_link = ?, passcode = ?, notes = ?, file = ?, doc = ?, video_storage = ?,
                    timezone = CASE WHEN ? = '' THEN timezone ELSE ? END
                WHERE req_id = ?
                LIMIT 1
                `;
                db.query(
                    updateSql,
                    [
                        c_id,
                        b_id,
                        trainer,
                        title,
                        description || "", // NOT NULL column — see /add-class
                        classdatex,
                        stimings,
                        etimings,
                        zoom_link,
                        passcode,
                        notes,
                        nvfile_key,
                        ndfile_key,
                        storageVal,
                        timezone,
                        timezone,
                        req_id
                    ],
                    async (err, result) => {
                        // a new recording: delivery mode, old media removed, HLS queued
                        if (!err && vfile.length >= 10 && nvfile_key !== dbfile) {
                            try {
                                await video.afterSave(req_id, nvfile_key, req.body.delivery, req.body.delete_original, req.body.storage, {
                                    name: req.body.video_name,
                                    size: req.body.video_size,
                                });
                            } catch (e) {
                                console.error("update-class video:", e.message);
                            }
                        }

                        if (err) {
                            console.error(err);
                            return res.json({
                                success: false,
                                message: "Database error",
                            });
                        }

                        if (result.affectedRows === 1) {

                            let info = "Class info updated '" + title.trim() + "'";
                            let fromtxt = "";
                            let totxt = "";
                            addactivity(ukey, req_id, "liveclasses", info, fromtxt, totxt);

                            if (dbfile.length >= 10 && vfile.length >= 10) {
                                removeStored(dbfile);
                            }
                            if (dbdoc.length >= 10 && dfile.length >= 10) {
                                removeStored(dbdoc);
                            }

                            const dataSql = `
                            SELECT 
                                lc.*, 
                                MAX(s.name) AS tname, MAX(s.email) AS temail, MAX(s.number) AS tphone
                            FROM liveclasses lc 
                            LEFT JOIN members s
                                ON s.mem_id = lc.trainer 
                            WHERE req_id = ? 
                            GROUP BY lc.id
                            ORDER BY lc.id DESC
                            LIMIT 1
                            `;
                            db.query(
                                dataSql,
                                [req_id], (err2, rows) => {

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
                                            message: "No data found"
                                        });

                                    }

                                    /* 8️⃣ Send Data */
                                    return res.json({
                                        success: true,
                                        data: rows[0],
                                        message: "Class details successfully updated",
                                    });

                                });

                        } else {
                            return res.json({
                                success: false,
                                message: "Something went wrong, try again33"
                            });
                        }

                    }
                );

            });

        } catch (err) {
            console.error(err);
            return res.json({
                success: false,
                message: "Server error",
            });
        }
    }
    );

    /* Enable / disable a completed class. Disabled ("2S") is hidden from students —
       their class lists and dashboards only show 0 / 1 / 2 / 3 — while admins and the
       class's trainer still see it on Live Classes. */
    /* Google Drive storage (class-drive.js): offered when it's set up, and the
       browser sends a video / document straight to Drive through a one-file upload
       session opened here (into Drive's temp/ until the class is saved). */
    router.get("/class-drive-status", async (req, res) => {
        const st = await ctx.checkStatus(req, "X,Y,2");
        if (!st.success) return res.json({ success: false });
        const quota = await drive.verifyStorage(1);
        return res.json({
            success: true,
            enabled: drive.enabled(),
            maxBytes: drive.MAX_BYTES,
            quotaOk: quota.ok,
            quotaMessage: quota.error || "",
            isSharedDrive: !!quota.isSharedDrive,
            folderName: quota.folderName || "",
            ...(drive.getAuthInfo(String(req.headers.origin || "").replace(/\/$/, "") ? `${String(req.headers.origin || "").replace(/\/$/, "")}/panel/google-drive` : "")),
            saEmail: quota.saEmail || "",
            ownerEmail: quota.ownerEmail || "",
            limitBytes: quota.limitBytes ?? null,
            usageBytes: quota.usageBytes ?? 0,
            remainingBytes: quota.remainingBytes ?? null,
        });
    });

    router.post("/google-drive/auth-url", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const origin = String(req.headers.origin || "").replace(/\/$/, "");
            const redirectUri = String(req.body.redirectUri || (origin ? `${origin}/panel/google-drive` : "")).trim();
            const out = drive.generateOAuthUrl(redirectUri);
            return res.json({ success: true, ...out });
        } catch (err) {
            return res.json({ success: false, message: err.message || "Could not generate Google OAuth URL" });
        }
    });

    router.post("/google-drive/exchange-code", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const origin = String(req.headers.origin || "").replace(/\/$/, "");
            const redirectUri = String(req.body.redirectUri || (origin ? `${origin}/panel/google-drive` : "")).trim();
            const code = String(req.body.code || "").trim();
            const out = await drive.exchangeOAuthCode(code, redirectUri);
            await addactivity(ukey, "google-drive", "liveclasses", "Google Drive OAuth token authorized & verified", "", "");
            return res.json({ success: true, ...out });
        } catch (err) {
            const msg = err?.response?.data?.error_description || err?.response?.data?.error?.message || err.message || "Authorization failed";
            return res.json({ success: false, message: msg });
        }
    });

    router.get("/google-drive/oauth2callback", async (req, res) => {
        const st = await ctx.checkStatus(req, "X,Y");
        const baseDomain = String(process.env.DOMAIN || "/").replace(/\/$/, "");
        const panelUrl = `${baseDomain}/panel/google-drive`;
        if (!st.success) {
            return res.redirect(`${panelUrl}?error=${encodeURIComponent("Admin login required")}`);
        }
        const code = String(req.query.code || "").trim();
        const errParam = String(req.query.error || "").trim();
        if (errParam || !code) {
            return res.redirect(`${panelUrl}?error=${encodeURIComponent(errParam || "Access was not granted")}`);
        }
        try {
            const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
            const host = req.headers["x-forwarded-host"] || req.get("host");
            const callbackUri = `${proto}://${host}${req.baseUrl || "/api"}/google-drive/oauth2callback`;
            await drive.exchangeOAuthCode(code, callbackUri);
            return res.redirect(`${panelUrl}?connected=1`);
        } catch (err) {
            const msg = err?.response?.data?.error_description || err.message || "Sign-in failed";
            return res.redirect(`${panelUrl}?error=${encodeURIComponent(msg)}`);
        }
    });

    router.post("/google-drive/test-token", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const out = await drive.testRefreshToken();
            return res.json({ success: true, ...out });
        } catch (err) {
            const msg = err?.response?.data?.error_description || err?.response?.data?.error || err.message || "Token refresh failed";
            return res.json({ success: false, message: String(msg) });
        }
    });

    router.post("/google-drive/test-upload", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const tempKey = String(req.body.tempKey || "").trim();
            const fileName = String(req.body.fileName || "").trim();
            const keepFile = Boolean(req.body.keepFile);
            let localPath = "";
            if (tempKey && tempKey.startsWith("riviratech/temp/")) {
                localPath = (resolveUploadPath && resolveUploadPath(tempKey)) || "";
            }
            const out = await drive.testUploadCheck(localPath, fileName, keepFile);
            if (localPath && fs.existsSync(localPath)) {
                await fsp.rm(localPath, { force: true }).catch(() => {});
            }
            return res.json({ success: true, ...out });
        } catch (err) {
            const msg = err?.response?.data?.error?.message || err.message || "Test upload failed";
            return res.json({ success: false, message: msg });
        }
    });

    router.post("/class-drive-upload", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;
        try {
            if (!drive.enabled()) return res.json({ success: false, message: "Google Drive isn't set up on the server" });
            const { kind, fileName, fileType, size } = req.body;
            let origin = String(req.headers.origin || "");
            if (!origin && req.headers.referer) {
                try { origin = new URL(req.headers.referer).origin; } catch {}
            }
            if (!origin) origin = "https://www.riviratech.com";
            const r = await drive.browserUpload({
                kind: kind === "doc" ? "doc" : "video",
                fileName: String(fileName || ""),
                fileType: String(fileType || ""),
                size: Number(size) || 0,
                origin,
            });
            if (r.error) return res.json({ success: false, message: r.error });
            return res.json({ success: true, uploadURL: r.uploadURL });
        } catch (err) {
            console.error("class-drive-upload:", err.message);
            return res.json({ success: false, message: "Couldn't start the upload to Google Drive" });
        }
    });

    /* Prepare a secure (HLS) video again after the conversion failed. */
    router.post("/class-video-retry", async (req, res) => {
        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;
        try {
            const id = String(req.body.id || "");
            const [rows] = await db.promise().query("SELECT req_id, title, trainer FROM liveclasses WHERE req_id = ? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Class not found" });
            if (ustatus === "2" && rows[0].trainer !== ukey) return res.json({ success: false, message: "Only the class's trainer can do this" });
            const problem = await video.retry(id);
            if (problem) return res.json({ success: false, message: problem });
            addactivity(ukey, id, "liveclasses", "Class video conversion restarted '" + String(rows[0].title || "").trim() + "'", "", "");
            return res.json({ success: true, message: "Preparing the secure video again" });
        } catch (err) {
            console.error("class-video-retry:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    /* The length (seconds, 0 = unknown) of a class's current recording, so the
       edit form can set Class End Time = start + length. */
    router.post("/class-video-length", async (req, res) => {
        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;
        try {
            const id = String(req.body.id || "");
            const [rows] = await db.promise().query("SELECT req_id, trainer FROM liveclasses WHERE req_id = ? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Class not found" });
            if (ustatus === "2" && rows[0].trainer !== ukey) return res.json({ success: false, message: "Only the class's trainer can do this" });
            return res.json({ success: true, duration: await video.videoLength(id) });
        } catch (err) {
            console.error("class-video-length:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    /* Delete a secure (HLS) class's uploaded original once its stream is ready, to
       free disk space; the stream keeps playing. Admins only (Live Classes "delete"). */
    router.post("/class-video-delete-original", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const id = String(req.body.id || "");
            const [rows] = await db.promise().query("SELECT req_id, title FROM liveclasses WHERE req_id = ? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Class not found" });
            const problem = await video.deleteOriginal(id);
            if (problem) return res.json({ success: false, message: problem });
            addactivity(ukey, id, "liveclasses", "Class video original deleted '" + String(rows[0].title || "").trim() + "'", "", "");
            return res.json({ success: true, message: "Original video file deleted — the secure stream keeps playing" });
        } catch (err) {
            console.error("class-video-delete-original:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    router.post("/class-visibility", async (req, res) => {
        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;
        try {
            const id = String(req.body.id || "");
            const enable = String(req.body.enable) === "1";
            if (id.length <= 10) return res.json({ success: false, message: "There was something wrong, Please try again" });
            const [rows] = await db.promise().query("SELECT req_id, title, status, trainer FROM liveclasses WHERE req_id = ? LIMIT 1", [id]);
            if (!rows.length) return res.json({ success: false, message: "Class not found" });
            const c = rows[0];
            if (ustatus === "2" && c.trainer !== ukey) return res.json({ success: false, message: "Only the class's trainer can change it" });
            if (c.status !== (enable ? "2S" : "2")) {
                return res.json({ success: false, message: enable ? "This class is not disabled" : "Only completed classes can be disabled" });
            }
            const to = enable ? "2" : "2S";
            await db.promise().query("UPDATE liveclasses SET status = ? WHERE req_id = ?", [to, id]);
            addactivity(ukey, id, "liveclasses", (enable ? "Class enabled '" : "Class disabled '") + String(c.title || "").trim() + "'", "", "");
            return res.json({ success: true, status: to, message: enable ? "Class enabled — students can see it again" : "Class disabled — hidden from students" });
        } catch (err) {
            console.error("class-visibility:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    router.post("/cancel-class", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

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
                FROM liveclasses
                WHERE req_id = ?
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

                const dbId = rows[0].req_id;
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
                    UPDATE liveclasses
                    SET status = ?
                    WHERE req_id = ?
                    LIMIT 1
                `;

                db.query(updateSql, ["0", id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Class canceled '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "liveclasses", info, fromtxt, totxt);

                        let msg = "Class details was successfully canceled";
                        return res.json({
                            success: true,
                            message: msg,
                            status: "0"
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

    router.post("/reopen-class", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

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
                FROM liveclasses
                WHERE req_id = ?
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

                const dbId = rows[0].req_id;
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
                    UPDATE liveclasses
                    SET status = ?
                    WHERE req_id = ?
                    LIMIT 1
                `;

                db.query(updateSql, ["1", id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Class reopened '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "liveclasses", info, fromtxt, totxt);

                        let msg = "Class details was successfully reopened";
                        return res.json({
                            success: true,
                            message: msg,
                            status: "0"
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

    router.post("/delete-class", async (req, res) => {

        const { key: ukey} = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

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
                FROM liveclasses
                WHERE req_id = ?
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

                const dbId = rows[0].req_id;
                const title = rows[0].title;
                const status = rows[0].status;

                /* 4️⃣ Verify ID */
                if (dbId !== id) {
                    return res.json({
                        success: false,
                        message: "There was something wrong, Please try again"
                    });
                }

                /* 5️⃣ Soft Delete Class */
                const newStatus = status.endsWith("D") ? status : status + "D";
                const updateSql = `
                    UPDATE liveclasses
                    SET status = ?
                    WHERE req_id = ?
                    LIMIT 1
                `;

                db.query(updateSql, [newStatus, id], (err2, result) => {

                    if (err2) {
                        console.error(err2);
                        return res.json({
                            success: false,
                            message: "There was something wrong, Please try again"
                        });
                    }

                    if (result.affectedRows === 1) {

                        let info = "Class deleted '" + title.trim() + "'";
                        let fromtxt = "";
                        let totxt = "";
                        addactivity(ukey, id, "liveclasses", info, fromtxt, totxt);

                        return res.json({
                            success: true,
                            message: "Class details was successfully deleted"
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

    router.post("/restore-class", async (req, res) => {
        const { key: ukey, id: ustatus } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y,2"))) return;

        try {
            const { id } = req.body;
            if (!id || typeof id !== "string" || id.length <= 10) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            const [rows] = await db.promise().query(
                "SELECT req_id, title, status, trainer FROM liveclasses WHERE req_id = ? LIMIT 1",
                [id]
            );

            if (!rows.length) {
                return res.json({
                    success: false,
                    message: "Class not found"
                });
            }

            const cls = rows[0];
            if (ustatus === "2" && cls.trainer !== ukey) {
                return res.json({
                    success: false,
                    message: "Only the assigned trainer or an admin can restore this class"
                });
            }

            if (!String(cls.status || "").endsWith("D")) {
                return res.json({
                    success: false,
                    message: "This class is not deleted"
                });
            }

            const restoredStatus = cls.status.slice(0, -1);
            const [result] = await db.promise().query(
                "UPDATE liveclasses SET status = ? WHERE req_id = ? LIMIT 1",
                [restoredStatus, id]
            );

            if (result && result.affectedRows === 1) {
                let info = "Class restored '" + String(cls.title || "").trim() + "'";
                addactivity(ukey, id, "liveclasses", info, "", "");
                return res.json({
                    success: true,
                    message: "Class was successfully restored"
                });
            } else {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }
        } catch (err) {
            console.error("restore-class error:", err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }
    });

    router.post("/purge-class", async (req, res) => {
        const { key: ukey } = req.cookies;
        if (!(await verifyAccount(req, res, "X,Y"))) return;

        try {
            const { id, security_token } = req.body;
            if (!id || typeof id !== "string" || id.length <= 10 || id.length > 100) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            const tok = await checkSecurityToken(ukey, security_token);
            if (!tok.ok) return res.json({ success: false, message: tok.message, token: false });

            const [rows] = await db.promise().query(
                "SELECT * FROM liveclasses WHERE req_id = ? AND status LIKE '%D' LIMIT 1",
                [id]
            );

            if (!rows.length) {
                return res.json({
                    success: false,
                    message: "Only a deleted class can be deleted permanently."
                });
            }

            const cls = rows[0];

            // 1️⃣ Delete video files from storage
            try { if (cls.file) await removeStored(cls.file); } catch (e) {}
            try { if (cls.video_private && cls.video_private !== cls.file) await video.removeMedia(cls.video_private); } catch (e) {}
            try { if (cls.hls_playlist || cls.video_mode === "hls") await video.removeHls(id, cls.hls_playlist); } catch (e) {}

            // 2️⃣ Delete document from storage
            try { if (cls.doc) await removeStored(cls.doc); } catch (e) {}

            // 3️⃣ Delete local class folder
            const localClassFolder = resolveUploadPath("riviratech/classes/" + cls.c_id + "/" + cls.b_id + "/" + cls.req_id);
            if (localClassFolder) {
                try { await fsp.rm(localClassFolder, { recursive: true, force: true }); } catch (e) {}
            }

            // 4️⃣ Delete Google Drive class folder
            if (drive.enabled()) {
                try {
                    const fldId = await drive.classFolder(cls.c_id, cls.b_id, cls.req_id);
                    if (fldId) await drive.trash(fldId);
                } catch (e) {
                    console.error("purge-class drive trash error:", e.message);
                }
            }

            // 5️⃣ Delete database records
            await db.promise().query("DELETE FROM attendance WHERE req_id = ?", [id]);
            await db.promise().query("DELETE FROM liveclass_hls_queue WHERE req_id = ?", [id]);
            await db.promise().query("DELETE FROM liveclass_drive_files WHERE req_id = ?", [id]);
            const [delResult] = await db.promise().query("DELETE FROM liveclasses WHERE req_id = ?", [id]);

            if (!delResult || delResult.affectedRows !== 1) {
                return res.json({
                    success: false,
                    message: "There was something wrong, Please try again"
                });
            }

            addactivity(ukey, id, "liveclasses", "Class deleted permanently '" + String(cls.title || "").trim() + "'", "", "");
            return res.json({
                success: true,
                message: "Class and its storage files were deleted permanently"
            });
        } catch (err) {
            console.error("purge-class error:", err);
            return res.json({
                success: false,
                message: "Server error"
            });
        }
    });

    router.post("/update-class-video", async (req, res) => {
        try {
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,2"))) return;
            const { req_id, title, vfile } = req.body;

            let message = "";

            if (!req_id) {
                message = "Please select class";
            } else if (!vfile) {
                message = "Please enter recorded video";
            } else {

                let nvfile_key = "";
                if (vfile.length >= 10) {
                    const [cls] = await db.promise().query("SELECT req_id, c_id, b_id FROM liveclasses WHERE req_id = ? LIMIT 1", [String(req_id)]);
                    if (!cls.length) return res.json({ success: false, message: "Class not found" });
                    try {
                        // the recording goes to private storage (class-video.js)
                        nvfile_key = await video.storeUpload(vfile, cls[0].c_id, cls[0].b_id, cls[0].req_id, req.body.storage, req.body.delivery);
                    } catch (uploadErr) {
                        return res.json({ success: false, message: uploadErr.message || "Failed to store video" });
                    }
                    if (!nvfile_key) return res.json({ success: false, message: "Video file missing or not a supported video" });
                }

                if (nvfile_key.length >= 10) {

                    const [result] = await db.promise().query(
                        `
                    UPDATE liveclasses
                    SET file = ?, pwd = ?, type = '1', status = '2'
                    WHERE req_id = ?
                    LIMIT 1
                    `,
                        [nvfile_key, "", req_id]
                    );

                    if (result.affectedRows === 0) {
                        return res.json({
                            success: false,
                            message: "Failed to update, please try again1",
                        });
                    }

                    // ✅ Only runs if update success
                    try {
                        await video.afterSave(req_id, nvfile_key, req.body.delivery, req.body.delete_original, req.body.storage, {
                            name: req.body.video_name,
                            size: req.body.video_size,
                        });
                    } catch (e) {
                        console.error("update-class-video:", e.message);
                    }
                    const info = `Class video added '${title.trim()}'`;

                    await addactivity(
                        ukey,
                        req_id,
                        "liveclasses",
                        info,
                        "",
                        ""
                    );

                    const [updatedRows] = await db.promise().query("SELECT * FROM liveclasses WHERE req_id = ? LIMIT 1", [String(req_id)]);

                    return res.json({
                        success: true,
                        file: nvfile_key,
                        data: updatedRows[0] || null,
                        message: "Class video was successfully updated",
                    });

                } else {
                    message = "Failed to update, please try again2";
                    return res.json({
                        success: false,
                        message,
                    });
                }

            }

            return res.json({
                success: false,
                message,
            });

        } catch (err) {

            console.error("Update class video error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });

    router.post("/update-class-video-link", async (req, res) => {
        try {
            const { key: ukey} = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,2"))) return;
            const { req_id, title, link, pin } = req.body;

            let message = "";
            if (!req_id) {
                message = "Please select class";
            } else if (!link) {
                message = "Please enter recorded video link";
            } else if (!isWebLink(link)) {
                message = "The video link must start with https://";
            } else {

                const [result] = await db.promise().query(
                    `
                    UPDATE liveclasses
                    SET file = ?, pwd = ?, type = '2', status = '2'
                    WHERE req_id = ? AND status != '2'
                    LIMIT 1
                    `,
                    [link.trim(), pin, req_id]
                );

                if (result.affectedRows > 0) {

                    let info = "Class video link added '" + title.trim() + "'";
                    let fromtxt = "";
                    let totxt = "";
                    addactivity(ukey, req_id, "liveclasses", info, fromtxt, totxt);

                    message = "Class video link was successfully updated";
                    return res.json({
                        success: true,
                        message,
                    });
                } else {
                    message = "Failed to update, please try again";
                    return res.json({
                        success: false,
                        message,
                    });
                }
            }

            return res.json({
                success: false,
                message,
            });

        } catch (err) {

            console.error("Update class video error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });

    router.post("/delete-class-video", async (req, res) => {
        try {
            const { key: ukey, id: ustatus } = req.cookies;
            if (!(await verifyAccount(req, res, "X,Y,2"))) return;
            const id = String(req.body.id || "").trim();
            if (!id || id.length <= 10) {
                return res.json({ success: false, message: "Please select a valid class" });
            }
            const [rows] = await db.promise().query("SELECT * FROM liveclasses WHERE req_id = ? LIMIT 1", [id]);
            if (!rows.length) {
                return res.json({ success: false, message: "Class not found" });
            }
            const cls = rows[0];
            if (ustatus === "2" && cls.trainer !== ukey) {
                return res.json({ success: false, message: "Only the assigned trainer or an admin can delete this video" });
            }
            if (cls.file) await removeStored(cls.file);
            if (cls.video_private && cls.video_private !== cls.file) await video.removeMedia(cls.video_private);
            if (cls.hls_playlist) await video.removeHls(id, cls.hls_playlist);

            await db.promise().query(
                `UPDATE liveclasses
                 SET file = '', pwd = '', type = '', video_mode = '', video_status = '', video_private = '',
                     hls_playlist = '', hls_key_id = '', video_name = '', video_size = 0, video_error = '', video_progress = 0
                 WHERE req_id = ? LIMIT 1`,
                [id]
            );
            await addactivity(ukey, id, "liveclasses", "Class video deleted '" + String(cls.title || "").trim() + "'", "", "");
            return res.json({
                success: true,
                message: "Class video was successfully deleted",
            });
        } catch (err) {
            console.error("Delete class video error:", err);
            return res.status(500).json({ success: false, message: "Server error" });
        }
    });

    router.post("/live-class-start", async (req, res) => {
        try {
            const {
                key: ukey
            } = req.cookies;

            if (!(await verifyAccount(req, res, "X,Y,2"))) return;

            const { req_id, title } = req.body;

            // ❗ Early return if missing
            if (!req_id) {
                return res.json({
                    success: false,
                    message: "Please select class",
                });
            }

            const datetime = Math.floor(Date.now() / 1000);

            const [result] = await db.promise().query(
                `
                UPDATE liveclasses
                SET started = ?
                WHERE req_id = ?
                    AND status != '2'
                LIMIT 1
                `,
                [datetime, req_id]
            );

            if (result.affectedRows > 0) {

                const info = `Live Class started to '${title?.trim() || ""}'`;

                await addactivity(
                    ukey,
                    req_id,
                    "liveclasses",
                    info,
                    "",
                    ""
                );

                return res.json({
                    success: true,
                    message: "Class started successfully",
                });
            }

            // ❗ Only reaches here if update failed
            return res.json({
                success: false,
                message: "Failed to update, please try again",
            });

        } catch (err) {

            console.error("Live class start error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    });
};

// Tables this page owns: their deleted rows are copied to deleted_records under
// the category "admin/live-classes" (see ../../shared/deleted-records.js).
module.exports.tables = [
    { table: "liveclasses" },
    { table: "attendance" },
];
