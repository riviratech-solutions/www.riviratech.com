/**
 * Sign-in, sign-out, password reset, the security token and the signed-in
 * member's own sessions — used by every panel (admin, student, trainer) and
 * the website.
 *
 * Mounted by ../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../shared/core.js.
 */
const { hashPassword, verifyPassword, burnVerifyTime, needsRehash } = require("../security/passwords");
const sendMail = require("../shared/mail");
const { queueMail } = sendMail; // returns once queued; retried if it fails
const { verifyTurnstile } = require("../security/turnstile");
const loginGuard = require("../security/login-guard");
const otpStore = require("../security/otps");
const loginSessions = require("../security/login-sessions");
const panelHeader = require("./panel-header");
const { issueToken } = require("../security/security-token");

module.exports = (router, ctx) => {
    const {
        db, csecure, csamesite, chttpOnly, cdomain, md5, checkStatus, validateSecurity, verifyAccount,
        addactivity, sendSessions, randomId
    } = ctx;

    // Sign-in is blocked: tell the page what is blocked and until when.
    const blockedReply = (res, { ipBlock, acctBlock, ip, label }) => {
        const blocks = [];
        if (acctBlock) blocks.push({ ...loginGuard.describe(acctBlock, "account"), label });
        if (ipBlock) blocks.push({ ...loginGuard.describe(ipBlock, "ip"), label: ip });
        const perm = blocks.some((b) => b.type === "perm");
        const until = Math.max(0, ...blocks.map((b) => b.until));
        return res.json({
            success: false,
            type: "error",
            blocked: true,
            blocks,
            message: perm
                ? "Sign-in is blocked. Please contact support to restore access."
                : "Too many failed sign-in attempts. Sign-in is blocked until " + loginGuard.fmtTime(until) + ".",
        });
    };

    // A wrong password (or unknown account): count it, and block on the 3rd.
    const signinFailed = async (res, { ip, ident, acct }) => {
        const fails = await loginGuard.recordFailure(db, { ip, ident, mem_id: acct ? acct.mem_id : "" });
        if (fails >= loginGuard.MAX_FAILS) {
            const reason = fails + " failed sign-in attempts";
            const ipBlock = await loginGuard.addBlock(db, { kind: "ip", value: ip, label: ip, reason, attempts: fails });
            let acctBlock = null;
            const label = acct ? (acct.email || acct.number || acct.name || "") : "";
            if (acct) {
                acctBlock = await loginGuard.addBlock(db, { kind: "account", value: acct.mem_id, label, reason, attempts: fails });
            }
            await loginGuard.clearFailures(db, { ip, mem_id: acct ? acct.mem_id : "" });
            if (acct && acct.email) {
                // fire-and-forget: the reply must not wait on the mail server
                queueMail(acct.email, "Sign-in blocked on your Rivira Technologies account",
                    loginGuard.blockEmail({ name: acct.name, ip, until: ipBlock.expires, perm: false, attempts: fails }))
                    .catch((err) => console.error("block email:", err.message));
            }
            return blockedReply(res, { ipBlock, acctBlock, ip, label });
        }
        // Plain message before the block — the attempt count isn't shown; the
        // 3rd wrong attempt returns the block details (blockedReply) instead.
        return res.json({
            success: false,
            type: "warning",
            message: "You entered invalid login details. Try with the right details.",
        });
    };

    const isEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const isNumber = (val) => {
        return /^\d+$/.test(val);
    };

    router.get("/check-login", async (req, res) => {

        const { key, token, aut, id } = req.cookies;

        const isValid =
            typeof key === "string" && key.length >= 10 &&
            typeof token === "string" && token.length >= 10 &&
            typeof aut === "string" && aut.length >= 10;

        // ...and the sign-in session (login_sessions) must still be active, so a
        // logged-out / expired session sends the panel to sign-in instead of
        // opening pages whose API calls would all be refused
        let sessionOk = false;
        let checkFailed = false;
        if (key && token && aut && isValid) {
            try {
                const [mrows] = await db.promise().query(
                    "SELECT id, pwd3 FROM members WHERE mem_id = ? AND pwd1 = ? AND pwd2 = ? LIMIT 1", [key, token, aut]
                );
                sessionOk = mrows.length > 0 &&
                    await loginSessions.verify(db, { sid: req.cookies.sid, uid: req.cookies.uid, key, memberId: mrows[0].id, pwd3: mrows[0].pwd3, ip: req.ip || "" });
            } catch (err) { console.error("check-login session:", err.message); checkFailed = true; }
        }

        // Couldn't check (e.g. the database dropped a connection): say so, rather
        // than "logged out" — the panel retries instead of signing the user out.
        if (checkFailed) {
            return res.status(503).json({ loggedIn: null, message: "Could not check the session, please try again" });
        }

        if (sessionOk) {
            return res.json({ loggedIn: true, key: key, token: token, aut: aut, id: id });
        }

        res.json({ loggedIn: false, key: key, token: token, aut: aut, id: id });
    });

    router.post("/signin", async (req, res) => {

        const { email, password} = req.body;

        const remail = email;
        const rnumber = email;

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
            return res.json(security);
        }

        if (!req.body.captcha) {
            return res.json({
                success: false,
                message: "Captcha token is missing."
            });
        }

        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }

        let message = "";

        if (!email || !password) {
            message = "All fields are required";

        } else if (email.length <= 7 && !isNumber(email)) {

            message = "Please enter email";

        } else if (!isEmail(email) && !isNumber(email)) {

            message = "Please enter valid email";

        } else if (
            (email.length <= 9 && isNumber(email)) ||
            (email.length >= 11 && isNumber(email))
        ) {

            message = "Please enter valid number";

        } else if (password.length <= 1) {

            message = "Please enter password";

        } else if (password.length <= 5) {

            message = "Please enter correct password";

        }

        if (message.length >= 8) {

            return res.json({
                success: false,
                type: "warning",
                message: message
            });

        } else {

            /* ---------- Sign-in protection (login-guard.js) ---------- */
            const ip = req.ip || "";
            const loginIdent = email; // the callback below declares its own `email`
            const byNumber = email.length >= 9 && /^\d+$/.test(email);
            const [acctRows] = await db.promise().query(
                `SELECT mem_id, name, email, number, status FROM members WHERE ${byNumber ? "number" : "email"} = ? ORDER BY id ASC LIMIT 1`,
                [email]
            );
            const acct = acctRows[0] || null;
            const ipBlock = await loginGuard.activeBlock(db, "ip", ip);
            const acctBlock = acct ? await loginGuard.activeBlock(db, "account", acct.mem_id) : null;
            if (ipBlock || acctBlock) {
                return blockedReply(res, { ipBlock, acctBlock, ip, label: acct ? (acct.email || acct.number || "") : "" });
            }

            let sql = "";
            let logintype = "";

            // Check if login by number
            if (email.length >= 9 && /^\d+$/.test(email)) {

                sql = `
                    SELECT * FROM members
                    WHERE number=?
                    ORDER BY id ASC
                `;

                logintype = "1";

            } else {

                // Login by email
                sql = `
                    SELECT * FROM members
                    WHERE email=?
                    ORDER BY id ASC
                `;

                logintype = "2";
            }

            db.query(sql, [email], async (err, rows) => {

                if (err) {
                    return res.json({
                        success: false,
                        type: "error",
                        message: "Server error"
                    });
                }

                // No user found — spend the same time a password check would
                if (!rows.length) {
                    await burnVerifyTime();
                    return signinFailed(res, { ip, ident: loginIdent, acct });
                }

                // The account whose password matches (an address can appear twice).
                // Passwords are bcrypt now; legacy MD5 hashes still verify (audit N2).
                let user = null;
                for (const row of rows) {
                    if (await verifyPassword(password, row.pwd3)) {
                        user = row;
                        break;
                    }
                }
                if (!user) {
                    return signinFailed(res, { ip, ident: loginIdent, acct });
                }

                const {
                    name,
                    mem_id,
                    email,
                    number,
                    pwd1,
                    pwd2,
                    pwd3,
                    status
                } = user;

                // Same validation as PHP
                const validLogin =
                    md5(remail) === md5(email) ||
                    md5(rnumber) === md5(email);

                if (!validLogin) {
                    return signinFailed(res, { ip, ident: loginIdent, acct });
                }

                /* ---------- Status Check ---------- */

                if (status.includes("S")) {

                    return res.json({
                        success: false,
                        message: "Sorry, your account was suspended, please contact administrator"
                    });

                }

                if (status.includes("P")) {

                    return res.json({
                        success: false,
                        message: "Sorry, your account was not activated, please contact administrator"
                    });

                }

                // correct password: start the count afresh
                await loginGuard.clearFailures(db, { ip, mem_id });

                // Move a legacy MD5 hash onto bcrypt now that the password is known.
                // The sign-in session below is bound to the stored hash, so it uses
                // the new one (other devices on the old hash sign in again once).
                let sessionPwd3 = pwd3;
                if (needsRehash(pwd3)) {
                    try {
                        sessionPwd3 = await hashPassword(password);
                        await db.promise().query("UPDATE members SET pwd3 = ? WHERE mem_id = ?", [sessionPwd3, mem_id]);
                    } catch (rehashErr) {
                        console.error("password rehash:", rehashErr.message);
                        sessionPwd3 = pwd3;
                    }
                }

                const datetime = Math.floor(Date.now() / 1000);

                const [loginupdate] = await db.promise().query(
                    `UPDATE members
                    SET lastdatetime = ?
                    WHERE mem_id = ? LIMIT 1`,
                    [datetime, mem_id]
                );

                /* ---------- Sign-in session (login_sessions) ---------- */
                // "Remember this device" → R: cookies kept 30 days; otherwise N:
                // cookies end when the browser closes.
                const remember = req.body.remember === true || req.body.remember === "1" || req.body.remember === 1;
                let loginSession = { token: "", days: remember ? loginSessions.REMEMBER_DAYS : loginSessions.NORMAL_DAYS };
                try {
                    loginSession = await loginSessions.start(db, {
                        memberId: user.id,
                        ip,
                        pwd3: sessionPwd3,
                        remember,
                        device: loginSessions.describeDevice(req, req.body.client && typeof req.body.client === "object" ? req.body.client : {}),
                    });
                } catch (sessErr) {
                    console.error("login_sessions:", sessErr.message);
                }
                const cookieAge = {
                    ...(remember ? { maxAge: loginSession.days * 24 * 60 * 60 * 1000 } : {}),
                    ...(cdomain ? { domain: cdomain } : {})
                };

                if (loginSession.token) {
                    res.cookie("sid", loginSession.token, {
                        ...cookieAge,
                        httpOnly: chttpOnly,
                        secure: csecure,
                        sameSite: csamesite,
                        path: "/"
                    });
                    // this sign-in's UID — checked together with sid (security/login-sessions.js)
                    res.cookie("uid", loginSession.uid, {
                        ...cookieAge,
                        httpOnly: chttpOnly,
                        secure: csecure,
                        sameSite: csamesite,
                        path: "/"
                    });
                }

                /* ---------- Set Session (Instead of Cookies) ---------- */

                req.session.user = {
                    id: mem_id,
                    token: pwd1,
                    aut: pwd2,
                    status: status
                };

                res.cookie("key", mem_id, {
                    ...cookieAge, // remembered: 30 days; else until the browser closes
                    httpOnly: chttpOnly, // true in live website
                    secure: csecure, // true in HTTPS
                    sameSite: csamesite,
                    path: "/"
                });

                res.cookie("token", pwd1, {
                    ...cookieAge,
                    httpOnly: chttpOnly,
                    secure: csecure,
                    sameSite: csamesite,
                    path: "/"
                });

                res.cookie("aut", pwd2, {
                    ...cookieAge,
                    httpOnly: chttpOnly,
                    secure: csecure,
                    sameSite: csamesite,
                    path: "/"
                });

                let cross = md5(pwd1 + "KKR" + status + "GenAi");

                res.cookie("cross", cross, {
                    ...cookieAge,
                    httpOnly: chttpOnly,
                    secure: csecure,
                    sameSite: csamesite,
                    path: "/"
                });

                res.cookie("id", status, {
                    ...cookieAge,
                    httpOnly: false,
                    secure: false,
                    sameSite: csamesite,
                    path: "/"
                });

                return res.json({
                    success: true,
                    message: "Successfully logged in...",
                    redirect: "/",
                    data: {
                        name,
                        mem_id,
                        email: remail,
                        number: rnumber,
                        status
                    }
                });

            }
            );

        }

    });

    /* ================= RESET REQUEST ================= */

    router.post("/reset-request", async (req, res) => {

        const { email} = req.body;

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
            return res.json(security);
        }

        if (!req.body.captcha) {
            return res.json({
                success: false,
                message: "Captcha token is missing."
            });
        }

        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }

        const user = email.trim();
        /* ---------- Check Number ---------- */

        const isNumber = /^\d+$/.test(user);
        const number = isNumber ? user : "";
        const firstDigit = user.length ? user[0] : "0";

        /* ---------- Validations ---------- */

        if (user.length <= 7) {
            return res.json({
                success: false,
                message: "Please enter email address or phone number"
            });
        }

        if (!isNumber && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
            return res.json({
                success: false,
                message: "Please enter valid email"
            });
        }

        if (isNumber && user.length <= 7) {
            return res.json({
                success: false,
                message: "Please enter mobile number without country code"
            });
        }

        if (isNumber && user.length <= 9) {
            return res.json({
                success: false,
                message: "Please enter valid number"
            });
        }

        if (isNumber && firstDigit <= "5") {
            return res.json({
                success: false,
                message: "Please enter valid number without country code"
            });
        }

        /* ---------- Find User ---------- */
        const sql = isNumber
            ? "SELECT * FROM members WHERE number=? LIMIT 1"
            : "SELECT * FROM members WHERE email=? LIMIT 1";
        db.query(sql, [user], async (err, rows) => {

            if (err) {
                return res.json({
                    success: false,
                    type: "error",
                    message: "Server error"
                });
            }

            if (!rows.length) {
                return res.json({
                    success: false,
                    message: "Email or number not found in our records, please register"
                });
            }

            const userData = rows[0];

            const {
                mem_id,
                name,
                status,
                email,
                number
            } = userData;

            /* ---------- Status Check ---------- */

            if (status.includes("S")) {
                return res.json({
                    success: false,
                    message: "Sorry, your account was suspended, please contact the administrator"
                });
            }

            if (status.includes("P")) {
                return res.json({
                    success: false,
                    message: "Your account was not activated, please check your mail"
                });
            }

            // new "reset" code in the otps table (replaces any earlier one)
            let otp = "";
            otpStore.issue(db, { mem_id, type: "reset" }).then((code) => { otp = code; return null; }, (e) => e).then(async (e2) => {

                if (e2) {
                    return res.json({
                        success: false,
                        message: "Something went wrong, try again"
                    });
                }

                const fullName =
                    name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                if (!isNumber) {

                    const html = `
                        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">

                            <h2 style="color:#2c3e50;">
                            🔐 Password Reset Request
                            </h2>

                            <p>Dear ${userData.name || "User"},</p>

                            <p>
                            We received a request to reset your password for your
                            <b>Rivira Technologies</b> account.
                            </p>

                            <p>
                            Please use the following One-Time Password (OTP) to proceed:
                            </p>

                            <div style="
                            background:#f3f6fa;
                            padding:20px;
                            margin:20px 0;
                            text-align:center;
                            border-radius:8px;
                            border:1px dashed #3498db;
                            ">

                            <h1 style="
                                margin:0;
                                font-size:32px;
                                letter-spacing:4px;
                                color:#2c3e50;
                            ">
                                ${otp}
                            </h1>

                            </div>

                            <p>
                            ⏰ This OTP is valid for <b>10 minutes</b> only.
                            </p>

                            <p>
                            Do <b>NOT</b> share this code with anyone.
                            </p>

                            <br />

                            <p>
                            If you did not request this password reset,
                            please ignore this email.
                            </p>

                            <hr />

                            <p style="font-size:13px; color:#777;">
                            Regards,<br />
                            <b>Rivira Technologies Team</b><br />
                            🌐 www.riviratech.com
                            </p>

                        </div>
                        `;
                    const subject =
                        `Hi ${fullName}, You requested for a password reset`;

                    // Send Mail (the code itself is never logged: the API log is
                    // readable from Panel → Server Logs)
                    const sent = await sendMail(
                        email,
                        subject,
                        html
                    );

                    if (!sent) {
                        return res.json({
                            success: false,
                            message: "OTP sending failed.. try again"
                        });
                    }

                    return res.json({
                        success: true,
                        message: "OTP has been sent to your email address. Kindly check and verify.",
                        stage: "verify"
                    });

                }
                /* === Send SMS (Optional) === */
                else {

                    // If you have SMS API, integrate here (never log the code)

                    return res.json({
                        success: true,
                        message: "OTP has been sent to your mobile number. Kindly check and verify.",
                        stage: "verify"
                    });

                }

            });

        }
        );
    });

    /* ================= VERIFY OTP ================= */

    router.post("/verify-otp", async (req, res) => {

        const { email, otp} = req.body;

        if (!email) {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (!email || !otp) {
            return res.json({
                success: false,
                type: "warning",
                message: "OTP is required"
            });
        }

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
            return res.json(security);
        }

        if (!req.body.captcha) {
            return res.json({
                success: false,
                message: "Captcha token is missing."
            });
        }

        // ---------------- CAPTCHA ----------------
        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }

        const user = email.trim();

        /* ---------- Check Number ---------- */
        const isNumber = /^\d+$/.test(user);
        const firstDigit = user.length ? user[0] : "0";

        /* ---------- Validations ---------- */

        if (!isNumber && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (isNumber && user.length <= 7) {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (isNumber && firstDigit <= "5") {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (!otp || otp.length <= 0) {
            return res.json({
                success: false,
                message: "Please enter OTP"
            });
        }

        if (!/^\d+$/.test(otp) || otp.length <= 5) {
            return res.json({
                success: false,
                message: "Please enter valid OTP"
            });
        }

        const sql = isNumber
            ? "SELECT * FROM members WHERE number=? LIMIT 1"
            : "SELECT * FROM members WHERE email=? LIMIT 1";
        db.query(sql, [user], async (err, rows) => {

            if (err) {
                return res.json({
                    success: false,
                    message: "Something went wrong, try again"
                });
            }

            if (!rows.length) {
                return res.json({
                    success: false,
                    message: "Please enter valid OTP"
                });
            }

            const users = rows[0];

            const {
                mem_id,
                email: dbEmail,
                number: dbNumber,
                pwd2,
                pwd3
            } = users;

            // the code from the otps table ("reset", not expired)
            const otpState = await otpStore.check(db, { mem_id, type: "reset", otp });
            if (otpState === "expired") {
                return res.json({
                    success: false,
                    message: "This OTP has expired, please request a new one"
                });
            }

            /* ---------- Match Check (Same as PHP) ---------- */
            const valid =
                otpState === "ok" &&
                (md5(dbEmail) === md5(email) || md5(dbNumber) === md5(email));

            if (!valid) {
                return res.json({
                    success: false,
                    message: "Please enter valid OTP"
                });
            }

            /* ---------- Success ---------- */

            const nextid = md5(mem_id + pwd2 + pwd3);

            return res.json({
                success: true,
                message: "Now you can reset your password",
                stage: "reset",
                id: nextid,
                otp: otp
            });

        }
        );
    });

    /* ================= RESET PASSWORD ================= */

    router.post("/reset-password", async (req, res) => {

        const { email, otp, id, password, rpassword} = req.body;

        // req.ip honours the trust-proxy setting; the raw header is client-controlled
        const userIP = req.ip || req.socket.remoteAddress;

        const nextid = id;

        if (!email) {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (!email || !otp) {
            return res.json({
                success: false,
                type: "warning",
                message: "OTP is required"
            });
        }

        // Session Tokens
        const security = validateSecurity(req);
        if (!security.success) {
            return res.json(security);
        }

        if (!req.body.captcha) {
            return res.json({
                success: false,
                message: "Captcha token is missing."
            });
        }

        // ---------------- CAPTCHA ----------------
        if (!(await verifyTurnstile(req.body.captcha, req.ip))) {
            return res.json({ success: false, message: "Captcha verification failed, please try again" });
        }

        const user = email.trim();

        /* ---------- Check Number ---------- */
        const isNumber = /^\d+$/.test(user);
        const firstDigit = user.length ? user[0] : "0";

        /* ---------- Validations ---------- */

        if (!isNumber && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (isNumber && user.length <= 7) {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (isNumber && firstDigit <= "5") {
            return res.json({
                success: false,
                message: "Something went wrong, try again"
            });
        }

        if (!otp || otp.length <= 0) {
            return res.json({
                success: false,
                message: "Please enter OTP"
            });
        }

        if (!/^\d+$/.test(otp) || otp.length <= 5) {
            return res.json({
                success: false,
                message: "Please enter valid OTP"
            });
        }

        if (!password || password.length <= 1) {
            return res.json({
                success: false,
                message: "Please enter password"
            });
        }

        if (password.length <= 7) {
            return res.json({
                success: false,
                message: "Please enter min 8 characters password"
            });
        }

        if (password.length >= 16) {
            return res.json({
                success: false,
                message: "Please enter below 15 characters password"
            });
        }

        if (!rpassword || rpassword.length <= 1) {
            return res.json({
                success: false,
                message: "Please enter confirm password"
            });
        }

        if (rpassword.length <= 7) {
            return res.json({
                success: false,
                message: "Please enter min 8 characters confirm password"
            });
        }

        if (password !== rpassword) {
            return res.json({
                success: false,
                message: "Password did not match with confirm password, try again.."
            });
        }
        /* ---------- Find User ---------- */
        const sql = isNumber
            ? "SELECT * FROM members WHERE number=? LIMIT 1"
            : "SELECT * FROM members WHERE email=? LIMIT 1";
        db.query(sql, [user], async (err, rows) => {

            if (err || !rows.length) {
                return res.json({
                    success: false,
                    message: "Something went wrong, try again"
                });
            }

            const users = rows[0];

            const {
                mem_id,
                email: dbEmail,
                number: dbNumber,
                pwd1,
                pwd2,
                pwd3
            } = users;

            const otpState = await otpStore.check(db, { mem_id, type: "reset", otp });
            if (otpState === "expired") {
                return res.json({
                    success: false,
                    message: "This OTP has expired, please request a new one"
                });
            }

            /* ---------- Match Check ---------- */

            const valid =
                otpState === "ok" &&
                (
                    (md5(dbEmail) === md5(email) && !isNumber) ||
                    (md5(dbNumber) === md5(email) && isNumber)
                );

            if (!valid) {
                return res.json({
                    success: false,
                    message: "Something went wrong, try again"
                });
            }

            /* ---------- Verify nextid ---------- */

            const nextidCheck = md5(mem_id + pwd2 + pwd3);

            if (md5(nextid) !== md5(nextidCheck)) {
                return res.json({
                    success: false,
                    message: "Something went wrong, try again"
                });
            }

            /* ---------- Generate New Password Tokens ---------- */
            // pwd1 / pwd2 are the token / aut sign-in cookies: random, not guessable

            const newPwd1 = randomId();

            const newPwd2 = randomId();

            const newPwd3 = await hashPassword(password);

            /* ---------- Update DB ---------- */

            const updateSql = `
                UPDATE members
                SET pwd1=?, pwd2=?, pwd3=?
                WHERE mem_id=? AND pwd1=? AND pwd2=?
                LIMIT 1
            `;

            db.query(
                updateSql,
                [
                    newPwd1,
                    newPwd2,
                    newPwd3,
                    mem_id,
                    pwd1,
                    pwd2
                ],
                async (e2, result) => {

                    if (e2 || !result.affectedRows) {

                        return res.json({
                            success: false,
                            message: "Something went wrong, try again"
                        });
                    }

                    // the code is used up
                    await otpStore.consume(db, { mem_id, type: "reset" });

                    const html = `
                        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">

                            <h2 style="color:#2c3e50;">
                            ✅ Password Successfully Reset
                            </h2>

                            <p>Dear ${users.name || "User"},</p>

                            <p>
                            This is to confirm that the password for your
                            <b>Rivira Technologies</b> account
                            has been changed successfully.
                            </p>

                            <div style="
                            background:#f3f6fa;
                            padding:15px;
                            margin:20px 0;
                            border-left:4px solid #27ae60;
                            ">
                            <b>Date & Time:</b> ${new Date().toLocaleString()}<br/>
                            <b>IP Address:</b> ${userIP || "Unknown"}
                            </div>

                            <p>
                            If you made this change, no further action is required.
                            </p>

                            <p style="color:#c0392b;">
                            ⚠️ If you did NOT request this password reset,
                            please contact our support team immediately.
                            </p>

                            <hr/>

                            <p style="font-size:13px; color:#777;">
                            Regards,<br/>
                            <b>Rivira Technologies Team</b><br/>
                            🌐 www.riviratech.com
                            </p>

                        </div>
                        `;

                    const subject = "✅ Your Password Has Been Reset - Rivira Technologies";

                    // Send Mail
                    const sent = await sendMail(
                        users.email,
                        subject,
                        html
                    );

                    /* ---------- Success ---------- */

                    return res.json({
                        success: true,
                        message: "Your password was successfully changed..",
                        redirect: "/signin",
                        delay: 5000
                    });

                }
            );

        }
        );
    });

    router.post("/logout", async (req, res) => {

        const opts = {
            httpOnly: process.env.NODE_HTTPONLY,
            secure: process.env.NODE_SECURE,
            sameSite: process.env.NODE_SAMESITE,
            path: "/",
        };

        // this device's sign-in session → logged_out
        try { await loginSessions.end(db, req.cookies.sid); } catch (err) { console.error("login_sessions logout:", err.message); }

        res.clearCookie("key", opts);
        res.clearCookie("token", opts);
        res.clearCookie("aut", opts);
        res.clearCookie("cross", opts);
        res.clearCookie("id", opts);
        res.clearCookie("sid", opts);
        res.clearCookie("uid", opts);

        req.session?.destroy();

        const vopts = {
            expires: new Date(0), // past date
            httpOnly: chttpOnly,
            secure: csecure,
            sameSite: csamesite,
            path: "/",
            ...(cdomain ? { domain: cdomain } : {}),
        };

        res.cookie("key", "", vopts);
        res.cookie("token", "", vopts);
        res.cookie("aut", "", vopts);
        res.cookie("cross", "", vopts);
        res.cookie("id", "", vopts);
        res.cookie("sid", "", { ...vopts, httpOnly: true });
        res.cookie("uid", "", { ...vopts, httpOnly: true });

        return res.json({
            success: true,
            message: "Successfully logged out...",
            redirect: "/",
        });

    });

    // everyone: their own sessions (profile menu → My sessions)
    router.post("/my-sessions/list", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y,1,2,3"))) return;
        return sendSessions(req, res, req.cookies.key);
    });

    // everyone: sign out one of their own sessions
    router.post("/my-sessions/end", async (req, res) => {
        try {
            if (!(await verifyAccount(req, res, "X,Y,1,2,3"))) return;
            const { key: ukey } = req.cookies;
            const id = parseInt(req.body.id, 10);
            if (!id) return res.json({ success: false, message: "Invalid session" });
            const [upd] = await db.promise().query(
                `UPDATE login_sessions SET status = 'logged_out'
                 WHERE id = ? AND status = 'active' AND mem_id = (SELECT id FROM members WHERE mem_id = ? LIMIT 1)`,
                [id, ukey]
            );
            if (!(upd.affectedRows >= 1)) return res.json({ success: false, message: "That session has already ended" });
            addactivity(ukey, String(id), "login_sessions", "Signed out one of their own sessions", "", "");
            return res.json({ success: true, message: "Session signed out" });
        } catch (err) {
            console.error("my-sessions/end:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    /* ---- Panel header: /me, global search, notifications (panel-header.js) ---- */
    panelHeader.register(router, db, checkStatus);

    router.get("/security/token", (req, res) => {
      // Make sure the session (and its cookie) exists, so the token's session
      // binding survives to the next request.
      if (!req.session.secv) req.session.secv = 1;
      const t = issueToken(req);
      req.session.save((err) => {
        if (err) console.error("Session Save Error:", err);
        res.set("Cache-Control", "no-store");
        res.json(t);
      });
    });
};
