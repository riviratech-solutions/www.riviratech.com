/**
 * pgdb.js — mysql2-compatible shim over node-postgres (pg).
 *
 * Lets the existing ~290 `db.query(...)` / `db.promise().query(...)` calls keep
 * working against Postgres with minimal changes:
 *   - translates `?` placeholders -> `$1,$2,...`
 *   - strips `LIMIT n` from UPDATE/DELETE (unsupported in Postgres)
 *   - returns mysql2-shaped results:
 *       SELECT           -> [rows, fields]
 *       INSERT/UPDATE/DEL -> [{ affectedRows, insertId }, fields]
 *
 * Still needs manual conversion for mysql-only syntax: `SET ?` / `VALUES ?`
 * object expansion, `??` identifiers, and `IN (?)` array expansion. Those are
 * handled case-by-case in the route files (see routes.js).
 */
const { Pool, types } = require("pg");
const deletedRecords = require("./deleted-records");

// Return bigint (int8) and numeric as JS numbers, closer to mysql2 behaviour.
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const useUrl = !!process.env.DATABASE_URL;
const host = process.env.DATABASE_HOST || "";
const isLocal = useUrl
  ? /(@|\/\/)(127\.0\.0\.1|localhost|\[::1\]|::1)[:/]/.test(process.env.DATABASE_URL)
  : ["127.0.0.1", "localhost", "::1"].includes(host);
const isProduction = process.env.NODE_ENV === "production";
// Enable SSL for any REMOTE database (e.g. Supabase, which refuses non-SSL
// connections), not only in production — a local Postgres stays plain.
const useSsl = isProduction || !isLocal;

// Connections per process. In a cluster (../cluster.js) every API copy has its
// own pool, so each takes fewer: 4 copies x 6 + the mail sender's 3 stays well
// under the database's limit. PG_POOL_MAX in the env overrides it.
const POOL_MAX =
  Number(process.env.PG_POOL_MAX) ||
  (process.env.KKR_ROLE === "mail" ? 3 : process.env.KKR_ROLE === "api" ? 6 : 10);

const pool = new Pool(
  useUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: POOL_MAX,
        keepAlive: true,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host,
        port: Number(process.env.DATABASE_PORT || 5432),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: POOL_MAX,
        keepAlive: true,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

// node-postgres emits 'error' on the pool when an IDLE client hits a problem
// (Postgres closing an idle connection, a network blip, a DB restart, ...).
// Without this handler it becomes an uncaught exception and the whole server
// process exits — which looks like the connection "auto-disconnecting".
// The bad client is removed from the pool automatically; the next query just
// opens a fresh one, so logging and continuing is safe.
pool.on("error", (err) => {
  console.error("⚠️  Postgres pool idle-client error (recovered):", err.message);
});

/* ---- dialect helpers --------------------------------------------------- */
function stripWriteLimit(sql) {
  const head = sql.trimStart().slice(0, 6).toUpperCase();
  if (head === "UPDATE" || head === "DELETE") {
    // Postgres UPDATE/DELETE do not accept LIMIT — targets are unique keys here.
    return sql.replace(/\s+LIMIT\s+\d+\s*;?\s*$/i, " ");
  }
  return sql;
}

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => "$" + ++i);
}

// mysql2 exposes result.insertId on INSERTs. Postgres needs RETURNING.
// Every table in this schema has an `id` PK, so append it when absent.
function addReturningId(sql) {
  const head = sql.trimStart().slice(0, 6).toUpperCase();
  if (head === "INSERT" && !/\breturning\b/i.test(sql)) {
    return sql.replace(/;?\s*$/, "") + " RETURNING id";
  }
  return sql;
}

// mysql2 bulk insert: `INSERT ... VALUES ?` with params [ [[...],[...]] ]
// -> Postgres `VALUES ($1,$2),($3,$4),...` with a flat param list.
function expandBulk(sql, params) {
  if (
    /values\s*\?\s*;?\s*$/i.test(sql) &&
    params.length === 1 &&
    Array.isArray(params[0]) &&
    Array.isArray(params[0][0])
  ) {
    const rows = params[0];
    const flat = [];
    let ph = 0;
    const tuples = rows
      .map((r) => "(" + r.map(() => "$" + ++ph).join(",") + ")")
      .join(",");
    rows.forEach((r) => r.forEach((v) => flat.push(v === undefined ? null : v)));
    return { text: sql.replace(/values\s*\?\s*;?\s*$/i, "VALUES " + tuples), values: flat };
  }
  return null;
}

function shape(res) {
  const cmd = res.command;
  if (cmd === "SELECT" || cmd === "WITH" || cmd === "SHOW" || cmd === "EXPLAIN") {
    return [res.rows, res.fields];
  }
  // INSERT / UPDATE / DELETE -> mysql2-style OkPacket
  const ok = {
    affectedRows: res.rowCount,
    changedRows: res.rowCount,
    rowCount: res.rowCount,
    // populated when the statement uses `RETURNING id`
    insertId: res.rows && res.rows[0] ? res.rows[0].id : 0,
  };
  return [ok, res.fields];
}

// Deleted rows are copied to deleted_records by a trigger (shared/deleted-records.js).
// Tell it who is deleting: set_config(..., true) lasts only for this
// statement's transaction, and putting it in the WHERE costs no extra round trip.
function tagDelete(sql, params) {
  const who = deletedRecords.actor();
  const m = who && !/\breturning\b/i.test(sql) && sql.match(/^\s*DELETE\s+FROM\s+([\w."]+)\s+WHERE\s+([\s\S]*?)\s*;?\s*$/i);
  if (!m) return null;
  return {
    sql: `DELETE FROM ${m[1]} WHERE set_config('app.deleted_by', ?, true) IS NOT NULL AND (${m[2]})`,
    params: [who, ...params],
  };
}

// Run one statement against `runner` (the pool for autocommit, or a checked-out
// client inside a transaction). Both expose the same .query(text, values) API.
async function execOn(runner, sql, params) {
  const clean = (params || []).map((p) => (p === undefined ? null : p));
  const bulk = expandBulk(sql, clean);
  const tagged = bulk ? null : tagDelete(stripWriteLimit(sql), clean);
  const text = bulk ? bulk.text : toPg(tagged ? tagged.sql : stripWriteLimit(sql));
  const values = bulk ? bulk.values : tagged ? tagged.params : clean;
  const res = await runner.query(addReturningId(text), values);
  return shape(res);
}

async function run(sql, params) {
  return execOn(pool, sql, params);
}

// Real transaction helper (audit BE-05). Checks out a single pooled client,
// wraps `work` in BEGIN/COMMIT, and ROLLBACKs on any throw so multi-write flows
// (e.g. charge payment + enrol student) are atomic — never partially applied.
//
//   await db.withTransaction(async (tx) => {
//     await tx.query("UPDATE payments SET ... WHERE ...", [...]);
//     await tx.query("UPDATE enrollees SET ... WHERE ...", [...]);
//   });
//
// `tx.query(sql, params)` returns the same mysql2-style [rows|ok, fields] shape
// as `db.promise().query`. Throwing inside `work` rolls everything back.
async function withTransaction(work) {
  const client = await pool.connect();
  const tx = { query: (sql, params) => execOn(client, sql, params) };
  try {
    await client.query("BEGIN");
    const result = await work(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("⚠️  Transaction rollback failed:", rbErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/* ---- mysql2-compatible surface ---------------------------------------- */
const api = {
  // callback style: db.query(sql, cb) | db.query(sql, params, cb)
  query(sql, params, cb) {
    if (typeof params === "function") {
      cb = params;
      params = [];
    }
    run(sql, params).then(
      ([rows]) => cb && cb(null, rows),
      (err) => cb && cb(err)
    );
  },

  // promise style: await db.promise().query(sql, params) -> [rows, fields]
  promise() {
    return { query: (sql, params) => run(sql, params) };
  },

  // Atomic multi-statement flows. See withTransaction() above (audit BE-05).
  withTransaction,

  // used by server.js startup test
  getConnection(cb) {
    pool.connect().then(
      (client) => cb(null, { release: () => client.release() }),
      (err) => cb(err)
    );
  },

  // No-op transaction shims. The routes call db.rollback() in error paths but
  // never begin/commit a transaction (pool-level auto-commit), so these just
  // invoke the callback to preserve the existing control flow.
  beginTransaction(cb) { cb && cb(null); },
  commit(cb) { cb && cb(null); },
  rollback(cb) { cb && cb(null); },

  pool,
};

module.exports = api;
