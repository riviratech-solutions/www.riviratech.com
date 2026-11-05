/**
 * express-session store in Postgres (table api_sessions), so every API copy of
 * the cluster (../cluster.js) sees the same sessions. The security token
 * (security-token.js) and the CSRF check (csrf.js) are tied to the session id:
 * with the default in-memory store a request answered by another copy would
 * not find the session and fail with "Security validation failed".
 *
 * A session lives until its cookie expires (1 day, set in server.js). The
 * cookie isn't renewed on each request, so neither is the row: touch() writes
 * nothing, which spares a database write per request. Expired rows are removed
 * hourly by the leader process.
 */
const session = require("express-session");
const startup = require("../shared/startup");

const DAY_MS = 24 * 60 * 60 * 1000;

class PgSessionStore extends session.Store {
    constructor(db) {
        super();
        this.pool = db.pool;
        this.ready = startup.setup("api_sessions table", () => this.ensureTable());
        startup.leaderInterval(
            "api_sessions clean-up",
            () => this.pool.query("DELETE FROM api_sessions WHERE expire < now()"),
            60 * 60 * 1000
        );
    }

    async ensureTable() {
        await this.pool.query(`CREATE TABLE IF NOT EXISTS api_sessions (
            sid TEXT PRIMARY KEY,
            sess JSONB NOT NULL,
            expire TIMESTAMPTZ NOT NULL
        )`);
        await this.pool.query("CREATE INDEX IF NOT EXISTS api_sessions_expire_idx ON api_sessions (expire)");
    }

    static expiry(sess) {
        const c = (sess && sess.cookie) || {};
        const t = c.expires ? new Date(c.expires).getTime() : Date.now() + (Number(c.originalMaxAge) || DAY_MS);
        return new Date(Number.isFinite(t) ? t : Date.now() + DAY_MS);
    }

    get(sid, cb) {
        this.ready
            .then(() => this.pool.query("SELECT sess FROM api_sessions WHERE sid = $1 AND expire > now()", [sid]))
            .then(({ rows }) => cb(null, rows.length ? rows[0].sess : null))
            .catch((err) => cb(err));
    }

    set(sid, sess, cb) {
        this.ready
            .then(() => this.pool.query(
                `INSERT INTO api_sessions (sid, sess, expire) VALUES ($1, $2::jsonb, $3)
                 ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
                [sid, JSON.stringify(sess), PgSessionStore.expiry(sess)]
            ))
            .then(() => cb && cb(null))
            .catch((err) => cb && cb(err));
    }

    destroy(sid, cb) {
        this.ready
            .then(() => this.pool.query("DELETE FROM api_sessions WHERE sid = $1", [sid]))
            .then(() => cb && cb(null))
            .catch((err) => cb && cb(err));
    }

    touch(sid, sess, cb) {
        if (cb) cb(null);
    }
}

module.exports = PgSessionStore;
