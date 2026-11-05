/**
 * Runs the API as a cluster: several copies of server.js answer on the same
 * PORT, plus one process that sends the queued mail (shared/mail-queue.js).
 *
 *   API_WORKERS   how many API copies (default: the CPU count, at most 4).
 *                 1 = no cluster: one process that also sends the mail.
 *
 * Start order: the first copy (the "leader") creates / updates the database
 * tables and triggers on its own (shared/startup.js). When it reports that this
 * is done, the other copies and the mail sender start; they skip that setup, so
 * two processes never change the same table at once. The leader also runs the
 * hourly clean-ups (expired sessions, rate-limit counters, temp uploads).
 *
 * A process that exits is started again, after a growing pause if it keeps
 * failing right after start. SIGTERM / SIGINT (systemctl stop / restart,
 * Ctrl+C) stop every process.
 *
 * Nothing here touches the database: the main process only starts and watches.
 */
const cluster = require("cluster");
const os = require("os");

function workerCount() {
    const n = parseInt(process.env.API_WORKERS, 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 32);
    const cpus = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
    return Math.max(1, Math.min(cpus, 4));
}

/** What this process is: "primary" | "api" | "mail" | "single" (no cluster). */
function role() {
    if (cluster.isWorker) return process.env.KKR_ROLE === "mail" ? "mail" : "api";
    return workerCount() > 1 ? "primary" : "single";
}

/** This process runs the start-up table setup and the clean-up timers. */
const isLeader = () => !cluster.isWorker || process.env.KKR_LEADER === "1";

/** Tells the main process that the start-up setup is finished (no-op without a cluster). */
function setupDone() {
    if (cluster.isWorker && process.send) process.send({ type: "kkr:setup-done" });
}

function startPrimary() {
    const total = workerCount();
    const slots = new Map(); // worker.id -> { kind, index, startedAt }
    const quickExits = {}; // "api0" -> exits in a row within 10 s of starting
    let stopping = false;
    let restStarted = false;

    const label = (s) => (s.kind === "mail" ? "mail sender" : `API copy ${s.index + 1}${s.index === 0 ? " (leader)" : ""}`);

    const spawn = (kind, index) => {
        const w = cluster.fork({
            KKR_ROLE: kind,
            KKR_WORKER_INDEX: String(index),
            KKR_LEADER: kind === "api" && index === 0 ? "1" : "0",
        });
        slots.set(w.id, { kind, index, startedAt: Date.now() });
        return w;
    };

    const startRest = () => {
        if (restStarted || stopping) return;
        restStarted = true;
        clearTimeout(setupTimer);
        for (let i = 1; i < total; i++) spawn("api", i);
        spawn("mail", 0);
        console.log(`✅ Cluster: ${total} API copies + mail sender started`);
    };

    console.log(`ℹ️  Cluster: starting ${total} API copies on port ${process.env.PORT} (main process ${process.pid})`);
    spawn("api", 0);
    // if the leader never reports back, don't wait forever
    const setupTimer = setTimeout(() => {
        console.error("⚠️  Cluster: database setup not finished after 60 s — starting the other copies anyway");
        startRest();
    }, 60000);

    cluster.on("message", (w, msg) => {
        if (msg && msg.type === "kkr:setup-done") startRest();
    });

    cluster.on("exit", (w, code, signal) => {
        const s = slots.get(w.id);
        slots.delete(w.id);
        if (stopping || !s) return;
        const key = s.kind + s.index;
        const quick = Date.now() - s.startedAt < 10000;
        quickExits[key] = quick ? (quickExits[key] || 0) + 1 : 0;
        const delay = quickExits[key] ? Math.min(30000, 1000 * 2 ** (quickExits[key] - 1)) : 0;
        console.error(`⚠️  Cluster: ${label(s)} exited (${signal || "code " + code}) — starting it again${delay ? ` in ${delay / 1000} s` : ""}`);
        setTimeout(() => { if (!stopping) spawn(s.kind, s.index); }, delay);
    });

    const stop = (sig) => {
        if (stopping) return;
        stopping = true;
        clearTimeout(setupTimer);
        console.log(`ℹ️  Cluster: received ${sig} — stopping all processes`);
        for (const w of Object.values(cluster.workers || {})) {
            if (w && !w.isDead()) w.process.kill("SIGTERM");
        }
        const check = () => { if (!Object.keys(cluster.workers || {}).length) process.exit(0); };
        cluster.on("exit", check);
        check();
        setTimeout(() => process.exit(0), 10000).unref();
    };
    ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"].forEach((sig) => process.on(sig, () => stop(sig)));
}

module.exports = { role, isLeader, setupDone, startPrimary, workerCount };
