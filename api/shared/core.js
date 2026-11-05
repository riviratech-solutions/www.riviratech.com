/**
 * Helpers shared by many pages' routes, and one-time table setup.
 *
 * routes.js calls this once with the router and db, before any page file
 * registers its routes, and passes the returned object to every page as `ctx`.
 * Everything here was moved unchanged from admin.routes.js (md5, escapeHtml and
 * the cookie settings also replace server.js' own copies).
 */
const crypto = require("crypto");
const Stripe = require("stripe");
const adminPerms = require("../security/admin-permissions");
const loginGuard = require("../security/login-guard");
const otpStore = require("../security/otps");
const loginSessions = require("../security/login-sessions");
const planSlides = require("../admin/plan-slides/plan-slides-core");
const deletedRecords = require("./deleted-records");
const startup = require("./startup");
const fsp = require("fs/promises");
const path = require("path");

module.exports = (router, db) => {
    /* ---------------- Local file storage ----------------
       Uploads are kept on the server's own disk under admin/uploads/ and served by
       the Node server at /uploads/<key> (see server.js). This replaces the old
       AWS S3 flow: DB rows still store the same `riviratech/<category>/<file>` keys, so
       nothing downstream changes — only where the bytes live.

       The browser can't send session cookies with the direct PUT it does after
       /get-upload-url, so — exactly like an S3 presigned URL — the upload endpoint
       is authorised by a short-lived HMAC signature baked into the returned URL,
       not by a cookie. */
    const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
    // No hard-coded fallback: anyone can read a fallback from the source and sign
    // their own upload URLs (audit N4). server.js refuses to start without a secret.
    const UPLOAD_SECRET = process.env.SESSION_SECRET || process.env.ENCRYPT_KEY;
    const UPLOAD_TTL_MS = 5 * 60 * 1000; // signed upload URL valid for 5 minutes

    // `max` (bytes) is the largest file the URL accepts; it is part of what is
    // signed, so a caller can't raise it.
    function signUpload(key, exp, max) {
        const msg = String(key) + "|" + String(exp) + (max ? "|" + String(max) : "");
        return crypto.createHmac("sha256", UPLOAD_SECRET).update(msg).digest("hex");
    }

    // Resolve a storage key to an absolute path, refusing any key that would escape
    // UPLOADS_DIR (path traversal). Returns null if the key is unsafe.
    function resolveUploadPath(key) {
        const rel = String(key || "").replace(/^[\\/]+/, "");
        const abs = path.resolve(UPLOADS_DIR, rel);
        if (abs !== UPLOADS_DIR && !abs.startsWith(UPLOADS_DIR + path.sep)) return null;
        return abs;
    }

    // Absolute public base for building upload/file URLs. Behind a proxy in prod,
    // set UPLOAD_PUBLIC_BASE (e.g. https://api.example.com); otherwise derive it
    // from the request so dev "just works".
    function publicBase(req) {
        return (process.env.UPLOAD_PUBLIC_BASE || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
    }
    // These run in one process only (startup.js): in a cluster the leader copy
    // does them before the other copies start.
    // Sign-in protection tables (login_attempts, login_blocks) — see login-guard.js
    startup.setup("login-guard tables", () => loginGuard.ensureTables(db));
    // One-time passwords live in the otps table (members.otp is migrated + dropped) — see otps.js
    startup.setup("otps table", () => otpStore.ensureTable(db));
    // "Remember this device" sign-in sessions — see login-sessions.js
    startup.setup("login_sessions table", () => loginSessions.ensureTable(db));
    // Home "Learn your way" plan slider (plan_section, plan_slides) — see admin/plan-slides/plan-slides-core.js
    startup.setup("plan slides tables", () => planSlides.ensureTables(db));
    router.use(deletedRecords.trackRequest);

    /* ================= LOGIN ================= */

    // NOTE (audit SEC-04): these auth cookies are intentionally NOT httpOnly.
    // The React admin panel reads key/token/aut/id via js-cookie to gate login
    // state and render role-based menus, so httpOnly:true would make the panel
    // believe the user is logged out. Fully closing the XSS token-theft risk
    // requires a frontend refactor (stop reading auth cookies in JS; use a
    // server "whoami" endpoint). Until then httpOnly stays false, but transport
    // is hardened below: cookies are marked Secure (HTTPS-only) in production.

    const csecure = process.env.NODE_SECURE === "true";
    const csamesite = process.env.NODE_SAMESITE || "lax";
    const chttpOnly = process.env.NODE_HTTPONLY === "true";
    const cdomain = process.env.COOKIE_DOMAIN || undefined;

    console.log("Cookie config:", {
        secure: csecure,
        sameSite: csamesite,
        httpOnly: chttpOnly,
        domain: cdomain
    });

    function md5(data) {
        const datax = data + "";
        return crypto.createHash("md5").update(datax).digest("hex");
    }

    // A random id / secret in the usual "a" + 32 hex form, from the system's
    // secure random source — for anything that must not be guessable (the pwd1 /
    // pwd2 sign-in secrets, payment-link ids). Math.random() is predictable.
    const randomId = () => "a" + crypto.randomBytes(16).toString("hex");

    const formatDate = (ts) => {
        if (!ts) return "";
        return new Date(ts * 1000).toLocaleDateString("en-IN");
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(
            /[&<>"']/g,
            (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            }[c])
        );
    }

    /**
     * ALL / Pending / Viewed selector for the contact-request lists
     * (/web-contacts, /trainer-contacts). status '1' = Pending, '2' = Viewed;
     * anything else (including "") means All and adds no condition.
     *
     * This narrows the LIST ROWS ONLY. The caller deliberately keeps counting
     * every status so the "Request Status" card above the table still reports
     * the full Pending/Viewed split — filtering the count too would render
     * "Viewed: 0" and a single-slice pie the moment you picked Pending, hiding
     * the very number you need in order to switch. The row total the list
     * paginates over is instead derived from that same grouped count.
     *
     * `st` is whitelisted rather than interpolated, and the clause must be
     * appended AFTER the WHERE + date fragments so its placeholder stays in
     * param order. Pass the query's alias wherever a JOIN brings in a second
     * `status` column (members has one, so the trainer list needs cr.status).
     */
    function statusFilter(st) {
        const val = ["1", "2"].includes(String(st ?? "")) ? String(st) : "";
        return {
            value: val,
            params: val ? [val] : [],
            clause(col = "status") {
                return val ? ` AND ${col} = ?` : "";
            },
        };
    }

    /**
     * Date-range condition for the admin list endpoints (Web/Trainer contacts,
     * enrollees, students, certificates, events, ...).
     *
     * `datetime` is a TEXT column holding unix seconds ("1770508800"), but a few
     * legacy `contacts` rows still hold "YYYY-MM-DD HH:MM:SS" from the MySQL era,
     * so the column is normalised to epoch before comparing. A row in neither
     * format drops out of the range instead of erroring the whole query — a bare
     * ::bigint cast would abort the request on that legacy data.
     *
     * `df`/`dt` arrive as epoch seconds already resolved in the browser, so the
     * range lines up with the dates the admin actually sees in the Date column
     * (rendered via toLocaleDateString in their own timezone) rather than the
     * server's.
     *
     * Usage — the clause must be appended AFTER the WHERE fragment at every call
     * site so its placeholders stay in param order, and the column must carry the
     * query's alias wherever a JOIN brings in a second `datetime`:
     *
     *   const dr = dateRangeFilter(df, dt);
     *   params.push(...dr.params);            // after the search params
     *   `... ${where} ${dr.clause("cr.datetime")} ORDER BY ...`
     *
     * NOTE: this SQL must never contain a literal `?` — pgdb's toPg() rewrites
     * every `?` into a $n placeholder, including ones inside string literals.
     */
    function dateRangeFilter(df, dt) {
        const bounds = [];
        const from = parseInt(df, 10);
        const to = parseInt(dt, 10);

        if (Number.isFinite(from)) bounds.push({ op: ">=", val: from });
        if (Number.isFinite(to)) bounds.push({ op: "<=", val: to });

        return {
            active: bounds.length > 0,
            params: bounds.map((b) => b.val),
            clause(col = "datetime") {
                if (!bounds.length) return "";
                const epoch =
                    `(CASE WHEN ${col} ~ '^[0-9]+$' THEN ${col}::bigint` +
                    ` WHEN ${col} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN EXTRACT(EPOCH FROM ${col}::timestamp)::bigint` +
                    ` ELSE NULL END)`;
                return " AND " + bounds.map((b) => `${epoch} ${b.op} ?`).join(" AND ");
            },
        };
    }

    function checkLogin(req, res, next) {

        const { key, token, aut, cross, sid, id } = req.cookies;

        let crossx = md5(token + "KKR" + id + "GenAi");

        if (key && token && aut && cross && sid && id && crossx===cross) {
            // Already logged in. This endpoint is called by axios (XHR), so a
            // res.redirect("/") sends a 302 the browser silently follows to the
            // API server's root — which has no route and 404s ("No content
            // available because this request was redirected"). Return JSON the
            // frontend can act on instead; the client already routes logged-in
            // visitors to the dashboard.
            return res.json({ success: false, loggedIn: true, message: "You are already logged in.", redirect: "/dashboard" });
        }

        next(); // continue
    }

    async function checkStatus(req, requiredStatus) {
        try {

            const {
                key,
                token,
                aut,
                sid,
                cross,
                id: userStatus,
            } = req.cookies;
            
            let crossx = md5(token + "KKR" + userStatus + "GenAi");

            // ❌ Not logged in
            if (!key || !token || !aut || !cross || !userStatus) {
                return {
                    success: false,
                    message: "Not logged in",
                };
            }


            if (
                !key ||
                !token ||
                !aut ||
                !sid ||
                !cross ||
                !userStatus ||
                crossx !== cross
            ) {
                return {
                    success: false,
                    message: "Not logged in",
                };
            }

            /* Allowed roles */
            const allowed = requiredStatus
                .toString()
                .split(",")
                .map((s) => s.trim());

            const verifyCross = md5(token + "KKR" + userStatus + "GenAi");

            if (!allowed.includes(userStatus) || cross !== verifyCross) {
                return {
                    success: false,
                    message: "Unauthorized access",
                };
            }

            /* Get user */
            const [rows] = await db.promise().query(
                `SELECT *
                FROM members
                WHERE mem_id = ?
                    AND pwd1 = ?
                    AND pwd2 = ?
                    AND status = ?
                LIMIT 1
                `,
                [key, token, aut, userStatus]
            );

            if (!rows.length) {
                return {
                    success: false,
                    message: "Unauthorized access",
                };
            }

            const users = rows;
            const user = rows[0];

            /* Validate session */
            const validLogin =
                md5(user.mem_id) === md5(key) &&
                md5(user.pwd1) === md5(token) &&
                md5(user.pwd2) === md5(aut);

            if (!validLogin) {
                return {
                    success: false,
                    message: "Unauthorized access",
                };
            }

            /* Sign-in session (login_sessions): active, unexpired, and the sid
               and uid cookies still fit this member's sign-in and current password
               (see verify in security/login-sessions.js; not tied to the IP) */
            if (!(await loginSessions.verify(db, { sid: req.cookies.sid, uid: req.cookies.uid, key, memberId: user.id, pwd3: user.pwd3, ip: req.ip || "" }))) {
                return {
                    success: false,
                    message: "Your session has ended, please sign in again",
                };
            }

            /* Check account status */
            if (!["X", "Y", "1", "2", "3"].includes(user.status)) {
                return {
                    success: false,
                    message: "Account blocked",
                };
            }

            // deleted_records.deleted_by for anything this request deletes
            deletedRecords.setActor(user.mem_id);

            /* Get courses */
            const [courses] = await db.promise().query(
                `
                SELECT cr.*,
                    bt.name AS batch_name,
                    c.title AS course_name
                FROM member_courses  cr
                    LEFT JOIN courses c 
                        ON c.req_id = cr.c_id  
                    LEFT JOIN batches bt
                        ON bt.b_id = cr.b_id
                WHERE cr.mem_id = ? AND cr.status = '1'
                ORDER BY cr.id DESC
                LIMIT 100
                `,
                [user.mem_id]
            );

            // ✅ SUCCESS
            return {
                success: true,
                user: users,
                courses,
            };

        } catch (err) {

            console.error("checkStatus error:", err);

            return {
                success: false,
                message: "Server error",
            };
        }
    }

    // No checkLogin guard: it blocked re-login when auth cookies already existed,
    // which deadlocked users whose token/aut cookies were stale/HttpOnly (JS
    // couldn't read them, yet the server refused a fresh login to reissue them).
    // A fresh signin re-sets all cookies (non-HttpOnly per chttpOnly), overwriting
    // any stale ones. Client-side useEffect handles redirecting logged-in visitors.

    // Signed per-request tokens, enforced — see security-token.js (audit Finding 4)
    const { validateSecurity } = require("../security/security-token");

    // admin auth + CSRF token check (mirrors the existing route pattern)
    async function verifyAccount(req, res, s) {
        const ok = await checkStatus(req, s);
        if (!ok.success) {
            res.status(401).json({ success: false, message: ok.message });
            return false;
        }
        const security = validateSecurity(req);
        if (!security.success) {
            res.json(security);
            return false;
        }
        // Admin (Y): the page permissions a super admin gave this account
        const user = ok.user && ok.user[0];
        if (user && user.status === "Y") {
            req.adminPerms = adminPerms.parsePermissions(user.permissions); // null = full access
            const denied = adminPerms.checkRoute(req.adminPerms, req.path, req.body);
            if (denied) {
                res.json({ success: false, message: denied, permissionDenied: true });
                return false;
            }
        }
        return true;
    }

    // Promote a freshly-uploaded temp file to its final key (local disk move).
    // Name kept as moveS3File so the ~15 call sites don't change.
    async function moveS3File(oldKey, newKey) {
        try {
            // 🔒 Security (audit SEC-07): only move files out of the upload temp
            // prefix. Every legitimate caller passes a freshly-uploaded
            // `riviratech/temp/...` key. Refusing anything else prevents a client
            // from supplying an arbitrary key as the move source — which is then
            // removed — to read or destroy other users' / system files.
            if (
                !oldKey ||
                typeof oldKey !== "string" ||
                !oldKey.startsWith("riviratech/temp/")
            ) {
                console.error("moveS3File: refused non-temp source key:", oldKey);
                return "";
            }

            const src = resolveUploadPath(oldKey);
            const dest = resolveUploadPath(newKey);
            if (!src || !dest) {
                console.error("moveS3File: unsafe path", { oldKey, newKey });
                return "";
            }

            await fsp.mkdir(path.dirname(dest), { recursive: true });
            // rename is atomic within the same filesystem; fall back to copy+unlink
            // if the temp and final dirs ever live on different mounts (EXDEV).
            try {
                await fsp.rename(src, dest);
            } catch (e) {
                if (e.code !== "EXDEV") throw e;
                await fsp.copyFile(src, dest);
                await fsp.unlink(src);
            }

            return newKey;

        } catch (error) {
            console.error("File Move Error:", error);
            return "";
        }
    }

    async function deleteS3File(fileKey) {
        try {
            if (!fileKey) return false;

            const abs = resolveUploadPath(fileKey);
            if (!abs) return false;

            await fsp.unlink(abs);
            return true;

        } catch (error) {
            if (error && error.code === "ENOENT") return true; // already gone
            console.error("File Delete Error:", error);
            return false;
        }
    }

    async function addactivity(mem_id, to_id, ntable, info, fromtxt, totxt) {
        try {
            const datetime = Math.floor(Date.now() / 1000);
            const insertSql = `
                    INSERT INTO activities
                    (mem_id, to_id, ntable, info, fromtxt, totxt, datetime)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
            await db.promise().query(
                insertSql,
                [mem_id, to_id, ntable, info, fromtxt, totxt, datetime]
            );

            return true;

        } catch (error) {
            console.log("Activity", error);
            return false;
        }
    }

    /* ===================== Login sessions (Panel → Login Sessions) =====================
       A member's sign-in sessions from login_sessions — opened from the
       Sessions button on Adminers, Trainers and Students. "Sign out" sets an
       active session to 'revoked', which checkStatus() then refuses. */
    const ROLE_NAMES = { X: "Super Admin", Y: "Admin", "1": "Student", "2": "Trainer", "3": "Member" };

    // one member's sessions — shared by the admin page and "My sessions"
    const sendSessions = async (req, res, memKey) => {
        try {
            if (!memKey) return res.json({ success: false, message: "No member selected" });
            const [mrows] = await db.promise().query(
                "SELECT id, mem_id, name, email, number, status, lastdatetime FROM members WHERE mem_id = ? LIMIT 1", [memKey]
            );
            if (!mrows.length) return res.json({ success: false, message: "Member not found" });
            const m = mrows[0];
            const roleKey = String(m.status || "").replace(/[^XY123]/g, "").charAt(0);

            const st = ["active", "ended"].includes(req.body.st) ? req.body.st : "";
            const live = "status = 'active' AND (expires_at IS NULL OR expires_at > NOW())";
            const where = "WHERE mem_id = ?" + (st === "active" ? " AND " + live : st === "ended" ? " AND NOT (" + live + ")" : "");
            const limit = 10;
            const [[cnt]] = await db.promise().query(`SELECT COUNT(id)::int AS total FROM login_sessions ${where}`, [m.id]);
            const lastPage = Math.max(1, Math.ceil(cnt.total / limit));
            let page = Math.min(Math.max(1, parseInt(req.body.n, 10) || 1), lastPage);
            const [rows] = await db.promise().query(
                `SELECT id, token, device, type, status, host(ip_address) AS ip,
                        EXTRACT(EPOCH FROM created_at)::bigint AS created,
                        EXTRACT(EPOCH FROM expires_at)::bigint AS expires,
                        (${live}) AS live
                 FROM login_sessions ${where}
                 ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
                [m.id, limit, (page - 1) * limit]
            );
            const mine = String(req.cookies.sid || "");
            const data = rows.map((r) => {
                let device = {};
                try { device = JSON.parse(r.device || "{}"); } catch { device = {}; }
                const state = r.live ? "active"
                    : r.status === "active" ? "expired"
                    : r.status === "logged_out" ? "logged_out"
                    : r.status === "revoked" ? "revoked" : String(r.status || "ended");
                return {
                    id: r.id, type: r.type, ip: r.ip || "", created: Number(r.created) || 0, expires: Number(r.expires) || 0,
                    state, device, thisDevice: !!mine && mine === r.token,
                };
            });
            const [[stats]] = await db.promise().query(
                `SELECT COUNT(*) FILTER (WHERE ${live})::int AS active,
                        COUNT(*) FILTER (WHERE type = 'R')::int AS remembered,
                        COUNT(*)::int AS total,
                        EXTRACT(EPOCH FROM MAX(created_at))::bigint AS last
                 FROM login_sessions WHERE mem_id = ?`, [m.id]
            );
            return res.json({
                success: true,
                member: { mem_id: m.mem_id, name: m.name, email: m.email, number: m.number, role: ROLE_NAMES[roleKey] || "Member" },
                stats: { ...stats, last: Number(stats.last) || 0 },
                data, total: cnt.total, lastPage, page,
            });
        } catch (err) {
            console.error("login-sessions/list:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    };

    /* ================= HOME CONTENT: TESTIMONIALS + YOUTUBE ================= */

    async function nextSortNo(table) {
        const [r] = await db.promise().query(
            `SELECT COALESCE(MAX(sortno), 0) + 1 AS n FROM ${table}`
        );
        return r[0].n;
    }

    async function applyReorder(table, ids, res) {
        if (!Array.isArray(ids) || !ids.length)
            return res.json({ success: false, message: "Invalid order" });
        for (let i = 0; i < ids.length; i++) {
            await db.promise().query(
                `UPDATE ${table} SET sortno = ? WHERE id = ?`,
                [i + 1, ids[i]]
            );
        }
        res.json({ success: true, message: "Order saved" });
    }

    /* ===================== Stripe Coupons (admin CRUD via Stripe API) =====================
       List / create / update (name) / delete Stripe coupons from the admin panel.
       Guarded by the same admin session check as every other panel endpoint. */

    const getStripe = () => new Stripe(process.env.STRIPE_ACCESS_KEY);
    /* ===================== Custom Forms (Google-Forms-style builder) =====================
       Admin builds forms; the public renders them at /form/:slug and submits;
       submissions are viewed back in the admin panel per form. */
    const safeParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

    /* ===================== Custom Pages (HTML/CSS pages published at a URL) =====================
       Admin builds pages; the public renders them at /:slug (or /:a/:b — the slug may contain a
       slash). CRUD + enable/disable, mirroring the Blogs admin flow. */

    // Slug that may span path segments: slugify each segment, keep the "/" separators.
    const pageSlugify = (s) => String(s || "").toLowerCase().trim()
        .split("/")
        .map((seg) => seg.replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
        .filter(Boolean)
        .join("/");

    /* ---- Helpers ---- */
    function safeJsonParse(str, fallback) {
        try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
    }

    function linesToJson(str) {
        if (!str || !str.trim()) return JSON.stringify([]);
        const lines = str.split("\n").map(l => l.trim()).filter(Boolean);
        return JSON.stringify(lines);
    }

    function linksToJson(str) {
        if (!str || !str.trim()) return JSON.stringify([]);
        const lines = str.split("\n").map(l => l.trim()).filter(Boolean);
        const result = lines.map(l => {
            const idx = l.indexOf("|");
            if (idx === -1) return { label: l, url: "" };
            return { label: l.slice(0, idx).trim(), url: l.slice(idx + 1).trim() };
        });
        return JSON.stringify(result);
    }

    return {
        db, UPLOADS_DIR, UPLOAD_SECRET, UPLOAD_TTL_MS, signUpload, resolveUploadPath,
        publicBase, safeJsonParse, linesToJson, linksToJson, csecure, csamesite, chttpOnly, cdomain,
        md5, randomId, formatDate, escapeHtml, statusFilter, dateRangeFilter, checkLogin, checkStatus,
        validateSecurity, verifyAccount, moveS3File, deleteS3File, addactivity, ROLE_NAMES,
        sendSessions, nextSortNo, applyReorder, getStripe, safeParse, pageSlugify,
    };
};
