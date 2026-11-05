/**
 * express-rate-limit store in Postgres (table rate_limits), so the cluster's
 * API copies (../cluster.js) share one count. Used for the strict sign-in /
 * OTP / password-reset limit in server.js: with a count per copy, 4 copies
 * would allow 4 times the attempts. (The coarse whole-API limit stays per copy:
 * a shared count would cost a database call on every request.)
 *
 * Each key is one row: hits, and when its window ends. Old rows are removed
 * hourly by the leader process.
 */
const db = require("../shared/pgdb");
const startup = require("../shared/startup");

const ready = startup.setup("rate_limits table", async () => {
    await db.pool.query(`CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        hits INTEGER NOT NULL,
        reset_at TIMESTAMPTZ NOT NULL
    )`);
});
startup.leaderInterval(
    "rate_limits clean-up",
    () => db.pool.query("DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'"),
    60 * 60 * 1000
);

class PgRateStore {
    constructor({ prefix = "rl:" } = {}) {
        this.prefix = prefix;
        this.localKeys = false;
        this.windowMs = 60 * 1000;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async get(key) {
        await ready;
        const { rows } = await db.pool.query(
            "SELECT hits, reset_at FROM rate_limits WHERE key = $1 AND reset_at > now()",
            [this.prefix + key]
        );
        return rows.length ? { totalHits: rows[0].hits, resetTime: rows[0].reset_at } : undefined;
    }

    // one statement, so two copies counting the same key at once can't lose a hit
    async increment(key) {
        await ready;
        const { rows } = await db.pool.query(
            `INSERT INTO rate_limits (key, hits, reset_at)
             VALUES ($1, 1, now() + make_interval(secs => $2::double precision))
             ON CONFLICT (key) DO UPDATE SET
                hits = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
                reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
             RETURNING hits, reset_at`,
            [this.prefix + key, this.windowMs / 1000]
        );
        return { totalHits: rows[0].hits, resetTime: rows[0].reset_at };
    }

    async decrement(key) {
        await ready;
        await db.pool.query(
            "UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1 AND reset_at > now()",
            [this.prefix + key]
        );
    }

    async resetKey(key) {
        await ready;
        await db.pool.query("DELETE FROM rate_limits WHERE key = $1", [this.prefix + key]);
    }

    async resetAll() {
        await ready;
        await db.pool.query("DELETE FROM rate_limits WHERE key LIKE $1", [this.prefix.replace(/[\\%_]/g, "\\$&") + "%"]);
    }
}

module.exports = PgRateStore;
