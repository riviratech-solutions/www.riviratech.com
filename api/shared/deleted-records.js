/**
 * Deleted-row archive.
 *
 * Every DELETE on an archived table first copies the whole row, as JSON, into
 * deleted_records. A Postgres trigger does the copy, so it also catches
 * deletes that don't come through these routes (FK cascades, psql, scripts).
 *
 *   deleted_records(id, table_name, category, record_id, deleted_data JSONB,
 *                   deleted_by, deleted_at, transaction_id)
 *
 * Each page file under api/ lists the tables it owns in `module.exports.tables`
 * (e.g. admin/activities/activities.js -> activities), and its rows are filed
 * under that page: category "admin/activities". routes.js collects the lists
 * and calls ensure() once at startup. A shared table is split between pages
 * with `when`, a condition on OLD (members by status, contacts and feedbacks
 * by type). A table no page lists — e.g. one added later — is filed under
 * "other" automatically, unless it's in SKIP below.
 *
 * deleted_by is the signed-in member's mem_id: checkStatus calls setActor()
 * and pgdb.js hands it to Postgres with each DELETE. Deletes with nobody
 * signed in keep the database user (CURRENT_USER).
 *
 * The copy runs in the same transaction as the delete: if the copy fails, the
 * delete is rolled back too, so a row is never removed without its copy.
 */
const { AsyncLocalStorage } = require("async_hooks");

// Member rows that no page claims (status "D", or none).
const OTHER = {
    category: "other",
    tables: [{ table: "members", when: "left(COALESCE(OLD.status, ''), 1) NOT IN ('1', '2', 'X', 'Y')" }],
};

// Never archived.
const SKIP = [
    "deleted_records",
    "login_attempts", // failed sign-in counters, cleared on every successful sign-in
    "login_sessions", // holds sign-in session tokens
    "otps",           // holds one-time passwords
    // cluster / mail queue (server.js, shared/mail-queue.js): emptied by
    // clean-up jobs, and sessions hold security secrets
    "api_sessions",
    "rate_limits",
    "security_token_fails",
    "mail_queue",
    "liveclass_hls_queue",     // class video processing queue (admin/live-classes/class-video.js)
    "liveclass_drive_files", // which Drive file holds each HLS piece (admin/live-classes/class-drive.js)
];

/* ---- who is deleting (per request) ------------------------------------ */
const context = new AsyncLocalStorage();

// Router middleware: give each request its own slot for the actor.
function trackRequest(req, res, next) {
    context.run({}, next);
}

function setActor(memId) {
    const store = context.getStore();
    if (store && memId) store.actor = String(memId);
}

function actor() {
    const store = context.getStore();
    return (store && store.actor) || "";
}

/* ---- table + trigger --------------------------------------------------- */
const NAME = /^[a-z_][a-z0-9_]*$/;
const CATEGORY = /^[a-z][a-z0-9/_-]*$/;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function installSql(categories) {
    const wanted = [];  // "table.trigger" pairs that should exist
    const listed = new Set();
    const skipped = new Set(SKIP);
    const creates = [];

    for (const { category, tables = [] } of [...categories, OTHER]) {
        if (!CATEGORY.test(category)) throw new Error(`deleted-records: bad category "${category}"`);
        for (const { table, when } of tables) {
            if (!NAME.test(table)) throw new Error(`deleted-records: bad table "${table}"`);
            const trigger = `archive_del_${category.replace(/[^a-z0-9]+/g, "_")}`;
            wanted.push(`${table}.${trigger}`);
            listed.add(table);
            // Skipped quietly when the table doesn't exist in this database.
            creates.push(
                `IF to_regclass(${lit("public." + table)}) IS NOT NULL THEN
                    CREATE OR REPLACE TRIGGER ${trigger} AFTER DELETE ON public.${table}
                    FOR EACH ROW ${when ? `WHEN (${when}) ` : ""}EXECUTE FUNCTION archive_deleted_row(${lit(category)});
                END IF;`
            );
        }
    }
    const arr = (set) => `ARRAY[${[...set].map(lit).join(",")}]::text[]`;

    return `
        CREATE TABLE IF NOT EXISTS deleted_records (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            table_name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'other',
            record_id TEXT,
            deleted_data JSONB NOT NULL,
            deleted_by TEXT DEFAULT CURRENT_USER,
            deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            transaction_id BIGINT DEFAULT txid_current()
        );
        CREATE INDEX IF NOT EXISTS deleted_records_category_idx ON deleted_records (category, deleted_at DESC);
        CREATE INDEX IF NOT EXISTS deleted_records_record_idx ON deleted_records (table_name, record_id);

        CREATE OR REPLACE FUNCTION archive_deleted_row() RETURNS trigger LANGUAGE plpgsql AS $fn$
        BEGIN
            INSERT INTO deleted_records (table_name, category, record_id, deleted_data, deleted_by)
            VALUES (
                TG_TABLE_NAME,
                COALESCE(TG_ARGV[0], 'other'),
                to_jsonb(OLD) ->> 'id',
                to_jsonb(OLD),
                COALESCE(NULLIF(current_setting('app.deleted_by', true), ''), CURRENT_USER)
            );
            RETURN OLD;
        END
        $fn$;

        DO $do$
        DECLARE
            r record;
            wanted text[] := ${arr(wanted)};
            listed text[] := ${arr(listed)};
            skipped text[] := ${arr(skipped)};
        BEGIN
            -- drop triggers left over from a table moving category
            FOR r IN
                SELECT t.tgname, c.relname
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname LIKE 'archive_del_%'
            LOOP
                IF NOT (r.relname || '.' || r.tgname = ANY (wanted))
                   AND NOT (r.tgname = 'archive_del_other' AND NOT (r.relname = ANY (listed)) AND NOT (r.relname = ANY (skipped))) THEN
                    EXECUTE format('DROP TRIGGER %I ON public.%I', r.tgname, r.relname);
                END IF;
            END LOOP;

            ${creates.join("\n            ")}

            -- any table no category lists (e.g. added later) goes under "other"
            FOR r IN
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND NOT (tablename = ANY (listed)) AND NOT (tablename = ANY (skipped))
            LOOP
                EXECUTE format(
                    'CREATE OR REPLACE TRIGGER archive_del_other AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION archive_deleted_row(%L)',
                    r.tablename, 'other'
                );
            END LOOP;
        END
        $do$;`;
}

let ready = null;
// categories: [{ category: "admin/activities", tables: [{ table, when? }] }, ...]
function ensure(db, categories) {
    if (!ready) {
        // One round trip; pool.query with no params allows several statements.
        ready = db.pool.query(installSql(categories)).catch((err) => {
            ready = null; // try again on the next call
            throw err;
        });
    }
    return ready;
}

module.exports = { ensure, trackRequest, setActor, actor };
