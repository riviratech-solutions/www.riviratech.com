/**
 * Mail queue (table mail_queue) and the sender that works through it.
 *
 * Routes call shared/mail.js:
 *   sendMail(to, subject, html)   queues the mail and waits for the result
 *                                 (true / false), as before — for mail the
 *                                 user is told about (OTP, contact form, ...).
 *                                 Tried once, like before.
 *   queueMail(to, subject, html)  queues it and returns at once. The sender
 *                                 tries again after 1, 5, 15 and 60 minutes
 *                                 if it fails, then marks it failed.
 *
 * The sender is its own process in a cluster (../cluster.js) and runs inside
 * the API when there is no cluster. It is woken at once through Postgres
 * NOTIFY, and also looks every 15 seconds. Rows are claimed with
 * FOR UPDATE SKIP LOCKED, so two senders never take the same mail.
 *
 * Each mail is tagged with the machine that queued it (MAIL_QUEUE_ORIGIN, or
 * the host name), and a sender only sends its own machine's mail: a local or
 * test server on the same database never sends the live site's mail, or the
 * other way round.
 *
 * Mail bodies can hold sign-in details and one-time codes, so the html is
 * cleared once a mail is sent or has failed for good. Sent rows are kept 30
 * days and failed ones 90 (subject, address, error) for checking, then removed.
 */
const os = require("os");
const db = require("./pgdb");
const startup = require("./startup");
const { deliver } = require("./mail-transport");

const ORIGIN = String(process.env.MAIL_QUEUE_ORIGIN || os.hostname() || "api").slice(0, 100);
const CHANNEL = "kkr_mail";
const RETRY_MINUTES = [1, 5, 15, 60]; // pauses before tries 2..5 of a queued mail
const QUEUED_TRIES = RETRY_MINUTES.length + 1;
const WAIT_MS = 25 * 1000; // how long sendMail() waits for the result
const STALE_MINUTES = 10; // a mail "sending" this long belongs to a sender that stopped
const PARALLEL = 3; // mails sent at the same time

const ready = startup.setup("mail_queue table", async () => {
    await db.pool.query(`CREATE TABLE IF NOT EXISTS mail_queue (
        id BIGSERIAL PRIMARY KEY,
        origin TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        cc JSONB NOT NULL DEFAULT '[]'::jsonb,
        subject TEXT NOT NULL DEFAULT '',
        html TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'queued',
        tries INTEGER NOT NULL DEFAULT 0,
        max_tries INTEGER NOT NULL DEFAULT 1,
        next_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        locked_at TIMESTAMPTZ,
        sent_from TEXT,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        sent_at TIMESTAMPTZ
    )`);
    await db.pool.query("CREATE INDEX IF NOT EXISTS mail_queue_pick_idx ON mail_queue (origin, status, next_at)");
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const addressText = (to) => (Array.isArray(to) ? to.filter(Boolean).join(", ") : String(to || "")).trim();
const ccList = (cc) => (Array.isArray(cc) ? cc : cc ? [cc] : []).map(String).filter(Boolean);

/* ------------------------------------------------------------- queueing */

let wakeLocal = null; // set when the sender runs in this process

async function enqueue({ to, subject, html, cc, maxTries }) {
    await ready;
    const { rows } = await db.pool.query(
        `INSERT INTO mail_queue (origin, to_addr, cc, subject, html, max_tries)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6) RETURNING id`,
        [ORIGIN, addressText(to), JSON.stringify(ccList(cc)), String(subject || ""), String(html || ""), maxTries]
    );
    // wake the sender (its own process in a cluster)
    db.pool.query("SELECT pg_notify($1, $2)", [CHANNEL, ORIGIN]).catch(() => {});
    if (wakeLocal) wakeLocal();
    return rows[0].id;
}

async function waitFor(id) {
    const until = Date.now() + WAIT_MS;
    let pause = 150;
    while (Date.now() < until) {
        await sleep(pause);
        pause = Math.min(pause * 1.5, 1000);
        const { rows } = await db.pool.query("SELECT status FROM mail_queue WHERE id = $1", [id]);
        const status = rows[0] && rows[0].status;
        if (status === "sent") return true;
        if (status === "failed" || !status) return false;
    }
    console.error(`mail queue: mail ${id} not sent within ${WAIT_MS / 1000} s — is the mail sender running?`);
    return false;
}

/**
 * Queue a mail. wait: true resolves to true / false once it is sent or has
 * failed; wait: false resolves to true as soon as it is queued.
 * If the queue can't be used (database down), the mail is sent directly.
 */
async function send({ to, subject, html, cc = [], wait }) {
    if (!addressText(to)) return false;
    let id;
    try {
        id = await enqueue({ to, subject, html, cc, maxTries: wait ? 1 : QUEUED_TRIES });
    } catch (err) {
        console.error("mail queue unavailable, sending directly:", err.message);
        const direct = deliver(to, subject, html, ccList(cc)).then((r) => r.ok, () => false);
        return wait ? direct : true;
    }
    if (!wait) return true;
    try {
        return await waitFor(id);
    } catch (err) {
        console.error("mail queue: could not read the result of mail", id, "-", err.message);
        return false;
    }
}

/* --------------------------------------------------------------- sender */

let running = false;
let again = false;
let stopped = false;

async function claim() {
    const { rows } = await db.pool.query(
        `UPDATE mail_queue q SET status = 'sending', locked_at = now(), tries = q.tries + 1
         WHERE q.id IN (
            SELECT id FROM mail_queue
            WHERE origin = $1 AND (
                (status = 'queued' AND next_at <= now())
                OR (status = 'sending' AND locked_at < now() - make_interval(mins => $2) AND tries < max_tries))
            ORDER BY id
            LIMIT 10
            FOR UPDATE SKIP LOCKED)
         RETURNING q.id, q.to_addr, q.cc, q.subject, q.html, q.tries, q.max_tries`,
        [ORIGIN, STALE_MINUTES]
    );
    return rows;
}

async function finish(job) {
    let r;
    try {
        r = await deliver(job.to_addr, job.subject, job.html, ccList(job.cc));
    } catch (err) {
        r = { ok: false, error: err.message || String(err) };
    }
    const error = r.ok ? null : String(r.error || "Unknown error").slice(0, 1000);
    if (r.ok) {
        await db.pool.query(
            "UPDATE mail_queue SET status = 'sent', sent_at = now(), sent_from = $2, html = '', last_error = NULL, locked_at = NULL WHERE id = $1",
            [job.id, r.from || null]
        );
    } else if (job.tries >= job.max_tries) {
        await db.pool.query(
            "UPDATE mail_queue SET status = 'failed', html = '', last_error = $2, locked_at = NULL WHERE id = $1",
            [job.id, error]
        );
        if (job.max_tries > 1) console.error(`mail queue: mail ${job.id} to ${job.to_addr} failed after ${job.tries} tries — ${error}`);
    } else {
        const mins = RETRY_MINUTES[Math.min(job.tries, RETRY_MINUTES.length) - 1];
        await db.pool.query(
            "UPDATE mail_queue SET status = 'queued', next_at = now() + make_interval(mins => $2), last_error = $3, locked_at = NULL WHERE id = $1",
            [job.id, mins, error]
        );
        console.error(`mail queue: mail ${job.id} to ${job.to_addr} failed (try ${job.tries} of ${job.max_tries}), trying again in ${mins} min — ${error}`);
    }
}

// work through everything that is due, a few mails at a time
async function kick() {
    if (stopped) return;
    if (running) { again = true; return; }
    running = true;
    try {
        do {
            again = false;
            for (;;) {
                const jobs = await claim();
                if (!jobs.length) break;
                for (let i = 0; i < jobs.length; i += PARALLEL) {
                    await Promise.all(jobs.slice(i, i + PARALLEL).map((j) => finish(j).catch((err) => console.error("mail queue:", err.message))));
                }
                if (stopped) break;
            }
        } while (again && !stopped);
    } catch (err) {
        console.error("mail sender:", err.message);
    } finally {
        running = false;
    }
}

async function cleanUp() {
    // a mail that was waited for and stuck in "sending" isn't tried again (it may have gone out)
    await db.pool.query(
        `UPDATE mail_queue SET status = 'failed', html = '', last_error = 'The sender stopped while sending', locked_at = NULL
         WHERE origin = $1 AND status = 'sending' AND locked_at < now() - make_interval(mins => $2) AND tries >= max_tries`,
        [ORIGIN, STALE_MINUTES]
    );
    await db.pool.query(
        `DELETE FROM mail_queue WHERE origin = $1 AND (
            (status = 'sent' AND created_at < now() - interval '30 days')
            OR (status = 'failed' AND created_at < now() - interval '90 days'))`,
        [ORIGIN]
    );
}

// a dedicated connection that LISTENs, so a queued mail goes out at once
async function listen() {
    while (!stopped) {
        let client;
        try {
            client = await db.pool.connect();
            await new Promise((resolve, reject) => {
                client.on("notification", (msg) => { if (msg.payload === ORIGIN) kick(); });
                client.on("error", reject);
                client.on("end", () => reject(new Error("connection closed")));
                client.query(`LISTEN ${CHANNEL}`).catch(reject);
                kick(); // anything queued while not listening
            });
        } catch (err) {
            if (!stopped) console.error("mail sender: listen connection lost —", err.message, "(reconnecting in 5 s)");
        } finally {
            if (client) { try { client.release(true); } catch { /* already gone */ } }
        }
        if (!stopped) await sleep(5000);
    }
}

/**
 * Start the sender. standalone: this process is the cluster's mail sender
 * (keeps itself alive, stops on SIGTERM); otherwise it runs inside the API.
 */
function runSender({ standalone = false } = {}) {
    wakeLocal = () => kick();

    if (standalone) {
        process.on("unhandledRejection", (reason) => console.error("⚠️  mail sender: unhandled rejection:", reason));
        process.on("uncaughtException", (err) => console.error("⚠️  mail sender: uncaught exception:", err && err.stack ? err.stack : err));
        ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"].forEach((sig) => process.on(sig, async () => {
            stopped = true;
            const until = Date.now() + 8000;
            while (running && Date.now() < until) await sleep(100); // let the mails being sent finish
            process.exit(0);
        }));
    }

    ready.then(() => {
        listen();
        const poll = setInterval(kick, 15 * 1000);
        if (!standalone) poll.unref();
        const tidy = () => cleanUp().catch((err) => console.error("mail queue clean-up:", err.message));
        setTimeout(tidy, 2 * 60 * 1000).unref();
        setInterval(tidy, 6 * 60 * 60 * 1000).unref();
        console.log(`📮 Mail sender ready (${standalone ? "own process" : "inside the API"}, origin "${ORIGIN}")`);
    });
}

module.exports = { send, runSender, ORIGIN };
