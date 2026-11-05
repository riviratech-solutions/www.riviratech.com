/**
 * API routes for src/pages/panel/admin/ServerLogs.tsx.
 *
 * Reads the systemd journal of the three services on the server, the same as
 *   sudo journalctl -u riviratech-<web|api|assistant> -n 1000 --no-pager
 *
 * Only these three units can be read, the line count is one of a fixed set, and
 * journalctl runs without a shell (execFile), so nothing from the request ends
 * up in a command line. It runs as the API's own user first; if that user can't
 * read the system journal it tries `sudo -n` (never prompts). The clean setup is
 * to add the API's user to the systemd-journal group — see `noaccess` below.
 *
 * Passwords, tokens, keys and database URLs in log lines are masked before they
 * are sent to the browser.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */
const cp = require("child_process");
const os = require("os");

const UNITS = {
    web: { unit: "riviratech-web", label: "Website" },
    api: { unit: "riviratech-api", label: "API" },
    assistant: { unit: "riviratech-assistant", label: "Assistant" },
};
const LINE_CHOICES = [200, 500, 1000, 2000];

function run(cmd, args) {
    return new Promise((resolve) => {
        cp.execFile(
            cmd,
            args,
            {
                timeout: 20000,
                maxBuffer: 32 * 1024 * 1024,
                windowsHide: true,
                env: { ...process.env, SYSTEMD_COLORS: "0", SYSTEMD_PAGER: "", LC_ALL: "C.UTF-8" },
            },
            (err, stdout, stderr) =>
                resolve({
                    ok: !err,
                    missing: !!err && err.code === "ENOENT",
                    stdout: String(stdout || ""),
                    stderr: String(stderr || ""),
                }),
        );
    });
}

// journalctl exits 0 but reads nothing when the user may not open the system journal
const noAccess = (r) => /insufficient permissions|not seeing messages from other users|permission denied/i.test(r.stderr);

async function readJournal(unit, lines) {
    const args = ["-u", unit, "-n", String(lines), "--no-pager", "-o", "short-iso"];
    const r = await run("journalctl", args);
    if (r.missing) return { error: "notfound" };
    if (r.ok && !noAccess(r)) return { out: r.stdout, via: "journalctl" };
    // sudo -n: only works if sudo is set up for this without a password
    const s = await run("sudo", ["-n", "journalctl", ...args]);
    if (s.ok && !noAccess(s)) return { out: s.stdout, via: "sudo" };
    return { error: "noaccess", detail: (r.stderr || s.stderr).trim().split("\n")[0].slice(0, 300) };
}

async function unitStatus(unit) {
    const r = await run("systemctl", [
        "show", unit, "--no-pager",
        "-p", "ActiveState", "-p", "SubState", "-p", "ActiveEnterTimestamp",
        "-p", "MainPID", "-p", "MemoryCurrent", "-p", "NRestarts", "-p", "LoadState",
    ]);
    if (!r.ok) return null;
    const v = {};
    r.stdout.split("\n").forEach((l) => {
        const i = l.indexOf("=");
        if (i > 0) v[l.slice(0, i)] = l.slice(i + 1).trim();
    });
    const mem = Number(v.MemoryCurrent);
    return {
        loaded: v.LoadState !== "not-found",
        active: v.ActiveState || "",
        sub: v.SubState || "",
        since: v.ActiveEnterTimestamp || "",
        pid: Number(v.MainPID) || 0,
        memory: Number.isFinite(mem) && mem > 0 && mem < 2 ** 60 ? mem : 0,
        restarts: Number(v.NRestarts) || 0,
    };
}

// Mask secrets that apps sometimes print (request bodies, connection strings, keys,
// the "OTP: 123456" lines older API versions logged for password resets).
function redact(line) {
    return line
        .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, "$1[hidden]@")
        .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [hidden]")
        .replace(/\b(sk|pk|rk|whsec)_(live|test)?_?[A-Za-z0-9]{12,}/g, "[hidden-key]")
        .replace(
            /((?:password|passwd|pwd\d?|secret|token|api[_-]?key|authorization|cookie|captcha|otp)["']?\s*[:=]\s*["']?)([^\s"',;&}]+)/gi,
            "$1[hidden]",
        );
}

module.exports = (router, ctx) => {
    const { verifyAccount } = ctx;

    // Which of the three services are running (for the tabs).
    router.post("/server-logs/status", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const out = {};
            await Promise.all(
                Object.entries(UNITS).map(async ([key, u]) => {
                    out[key] = { label: u.label, unit: u.unit, status: await unitStatus(u.unit) };
                }),
            );
            return res.json({ success: true, data: out });
        } catch (err) {
            console.error("server-logs/status:", err.message);
            return res.json({ success: false, message: "Server error" });
        }
    });

    // The last N journal lines of one service.
    router.post("/server-logs/read", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const u = UNITS[String(req.body.unit || "")];
            if (!u) return res.json({ success: false, message: "Unknown service" });
            const n = Number(req.body.lines);
            const lines = LINE_CHOICES.includes(n) ? n : 1000;

            const [j, status] = await Promise.all([readJournal(u.unit, lines), unitStatus(u.unit)]);
            res.set("Cache-Control", "no-store");
            if (j.error === "notfound") {
                return res.json({
                    success: false,
                    code: "notfound",
                    message: "Server logs can only be read on the Linux server where the services run — journalctl isn't available on this machine.",
                });
            }
            if (j.error === "noaccess") {
                return res.json({
                    success: false,
                    code: "noaccess",
                    user: os.userInfo().username,
                    unit: u.unit,
                    detail: j.detail,
                    message: "The API isn't allowed to read the system journal yet.",
                });
            }
            const out = j.out.split("\n").filter((l) => l.length).map(redact);
            return res.json({
                success: true,
                unit: u.unit,
                label: u.label,
                lines: out,
                via: j.via,
                status,
                fetchedAt: Date.now(),
            });
        } catch (err) {
            console.error("server-logs/read:", err.message);
            return res.json({ success: false, message: "Could not read the logs" });
        }
    });
};
