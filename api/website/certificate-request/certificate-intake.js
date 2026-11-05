/**
 * Public certificate requests — the form anyone can fill in, without an account.
 */
const crypto = require("crypto");

const TYPES = new Set(["course", "internship", "project", "bootcamp"]);
const GENDERS = new Set(["1", "2", "3"]);
const MAX = { name: 120, email: 180, phone: 20 };

function clean(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

function toTimestamp(value) {
    if (typeof value === "number") return Math.floor(value);
    if (typeof value !== "string" || !value.trim()) return null;
    const ms = new Date(value.trim()).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function validate(body = {}) {
    const name = clean(body.name, MAX.name);
    if (name.length < 2) return { ok: false, message: "Please enter your full name" };

    const email = clean(body.email, MAX.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, message: "Please enter a valid email address" };

    const number = clean(body.number || body.phone, MAX.phone);
    if (number.length < 6) return { ok: false, message: "Please enter a valid phone number" };

    const gender = clean(body.gender, 1);
    if (!GENDERS.has(gender)) return { ok: false, message: "Please select gender" };

    const ac_type = clean(body.ac_type, 10).toUpperCase();

    const type = clean(body.type, 20).toLowerCase();
    if (!TYPES.has(type)) return { ok: false, message: "Please select certificate type" };

    const course = clean(body.course, 64);
    if (!course) return { ok: false, message: "Please select course" };

    const batch = clean(body.batch, 64);

    const sdate = "";
    const edate = "";

    /*
    const sdate = toTimestamp(body.sdate);
    if (sdate === null) return { ok: false, message: "Please select a valid start date" };

    const edate = toTimestamp(body.edate);
    if (edate === null) return { ok: false, message: "Please select a valid end date" };

    if (edate < sdate) return { ok: false, message: "The end date cannot be before the start date" };
    */
    return { ok: true, value: { name, email, number, gender, ac_type, type, course, batch, sdate, edate } };
}

async function courseExists(db, courseReqId) {
    const [rows] = await db.promise().query(
        "SELECT 1 FROM courses WHERE req_id = ? AND status = '1' LIMIT 1",
        [courseReqId]
    );
    return rows && rows.length > 0;
}

async function pendingDuplicate(db, email, course) {
    const [rows] = await db.promise().query(
        `SELECT 1 FROM certificate_requests
          WHERE LOWER(email) = ? AND course = ? AND status = '1'
          LIMIT 1`,
        [email, course]
    );
    return rows && rows.length > 0;
}

async function insertRequest(db, value) {
    const ts = nowSeconds();
    const reqId = "a" + crypto.randomBytes(16).toString("hex");

    // Look up if this student already has an account in members table or previous requests
    let memId = "";
    try {
        const [mRows] = await db.promise().query(
            "SELECT mem_id FROM members WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1",
            [value.email]
        );
        if (mRows && mRows.length > 0 && mRows[0].mem_id) {
            memId = mRows[0].mem_id;
            /*
            if (value.ac_type) {
                await db.promise().query(
                    "UPDATE members SET ac_type = COALESCE(NULLIF(ac_type, ''), ?) WHERE mem_id = ?",
                    [value.ac_type, memId]
                );
            }
            */
        } else {
            const [pRows] = await db.promise().query(
                "SELECT mem_id FROM certificate_requests WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND mem_id IS NOT NULL AND mem_id != '' LIMIT 1",
                [value.email]
            );
            if (pRows && pRows.length > 0 && pRows[0].mem_id) {
                memId = pRows[0].mem_id;
            }
        }
    } catch (err) {
        console.error("Lookup existing member error:", err);
    }

    let finalSdate = value.sdate || "";
    let finalEdate = value.edate || "";
    if (value.batch && (!finalSdate || !finalEdate)) {
        try {
            const [bRows] = await db.promise().query(
                "SELECT sdate, edate FROM batches WHERE b_id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
                [value.batch, value.batch]
            );
            if (bRows && bRows.length > 0) {
                if (!finalSdate && bRows[0].sdate) finalSdate = String(bRows[0].sdate);
                if (!finalEdate && bRows[0].edate) finalEdate = String(bRows[0].edate);
            }
        } catch (bErr) {
            console.error("Lookup batch dates error:", bErr);
        }
    }

    await db.promise().query(
        `INSERT INTO certificate_requests
            (req_id, mem_id, name, email, number, gender, ac_type, type, course, batch,
             sdate, edate, datetime, updatetime, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1')`,
        [
            reqId,
            memId,
            value.name,
            value.email,
            value.number,
            value.gender,
            value.ac_type || "",
            value.type,
            value.course,
            value.batch || "",
            finalSdate,
            finalEdate,
            ts,
            ts,
        ]
    );

    return reqId;
}

function isPublicRequest(row) {
    return !row || !row.mem_id || String(row.mem_id).trim() === "";
}

module.exports = {
    TYPES,
    GENDERS,
    validate,
    courseExists,
    pendingDuplicate,
    insertRequest,
    isPublicRequest,
    toTimestamp,
};
