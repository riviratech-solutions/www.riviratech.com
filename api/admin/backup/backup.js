/**
 * API routes for src/pages/panel/admin/Backup.tsx.
 *
 * Mounted by ../../routes.js. Helpers used by several pages (sign-in checks,
 * md5, addactivity, ...) come in through `ctx` from ../../shared/core.js.
 */

module.exports = (router, ctx) => {
    const { db, verifyAccount, addactivity } = ctx;
    const { checkSecurityToken } = require("../../security/backup-token");

    // every download needs the security token (BACKUP_SECURITY_TOKEN in .env)
    const tokenOk = async (req, res) => {
        let t;
        try { t = await checkSecurityToken(req.cookies.key, req.body.security_token); }
        catch (err) { console.error("security token check:", err.message); t = { ok: false, message: "Could not check the security token, please try again" }; }
        if (!t.ok) res.status(403).json({ success: false, message: t.message, token: false });
        return t.ok;
    };

    /* ================= DATABASE BACKUP ================= */

    /* Sign-in secrets. With them a copy of the database is enough to sign in as
       anyone: pwd1 / pwd2 are the token / aut cookies, pwd3 the password hash
       the session id is built from, login_sessions the live sessions, otps the
       open password-reset codes. A super admin (X) gets a full, restorable
       backup; for an Admin (Y) these columns are masked, so the Backup
       permission can't be used to take over the super admin's account. */
    const SECRET_COLUMNS = {
        members: ["pwd1", "pwd2", "pwd3"],
        login_sessions: ["token", "uid"],
        otps: ["otp"],
    };
    const MASK = "[hidden]";

    function maskSecrets(table, rows, req) {
        if (req.cookies.id === "X") return rows;
        const cols = SECRET_COLUMNS[table];
        // deleted_records keeps deleted members' rows as JSON — mask those too
        if (table === "deleted_records") {
            return rows.map((r) => {
                const hide = SECRET_COLUMNS[r.table_name];
                if (!hide || !r.deleted_data || typeof r.deleted_data !== "object") return r;
                const data = { ...r.deleted_data };
                for (const c of hide) if (c in data) data[c] = MASK;
                return { ...r, deleted_data: data };
            });
        }
        if (!cols) return rows;
        return rows.map((r) => {
            const out = { ...r };
            for (const c of cols) if (c in out) out[c] = MASK;
            return out;
        });
    }

    async function listBackupTables() {
        const [rows] = await db.promise().query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
             ORDER BY table_name`
        );
        return rows.map((r) => r.table_name);
    }

    function backupStamp() {
        return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    }

    function rowsToCsv(rows) {
        if (!rows.length) return "";
        const cols = Object.keys(rows[0]);
        const esc = (v) => {
            if (v === null || v === undefined) return "";
            if (v instanceof Date) v = v.toISOString();
            else if (typeof v === "object") v = JSON.stringify(v);
            v = String(v);
            return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        return (
            cols.join(",") +
            "\n" +
            rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n")
        );
    }

    function sqlLiteral(v) {
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (v instanceof Date) v = v.toISOString();
        else if (typeof v === "object") v = JSON.stringify(v);
        return "'" + String(v).replace(/'/g, "''") + "'";
    }

    function rowsToSql(table, rows) {
        if (!rows.length) return `-- ${table}: 0 rows\n`;
        const cols = Object.keys(rows[0]);
        const colList = cols.map((c) => `"${c}"`).join(", ");
        let out = `-- ${table} (${rows.length} rows)\n`;
        for (const r of rows) {
            out += `INSERT INTO "${table}" (${colList}) VALUES (${cols
                .map((c) => sqlLiteral(r[c]))
                .join(", ")});\n`;
        }
        return out;
    }

    // list all tables with row counts
    router.post("/backup/tables", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        try {
            const tables = await listBackupTables();
            const out = [];
            for (const t of tables) {
                const [c] = await db.promise().query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
                out.push({ name: t, rows: c[0].c });
            }
            res.json({ success: true, tables: out });
        } catch (err) {
            console.error(err);
            res.json({ success: false, message: "Failed to list tables" });
        }
    });

    // the token form on the Backup page
    router.post("/backup/verify-token", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        let t;
        try { t = await checkSecurityToken(req.cookies.key, req.body.security_token); }
        catch (err) { console.error("security token check:", err.message); t = { ok: false, message: "Could not check the security token, please try again" }; }
        res.json(t.ok ? { success: true, message: "Security token verified" } : { success: false, message: t.message });
    });

    // download a single table as json | csv | sql
    router.post("/backup/table", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        if (!(await tokenOk(req, res))) return;
        try {
            const name = String(req.body.name || "");
            const format = String(req.body.format || "json").toLowerCase();

            const tables = await listBackupTables();
            if (!tables.includes(name)) {
                return res.status(400).json({ success: false, message: "Unknown table" });
            }

            const [all] = await db.promise().query(`SELECT * FROM "${name}" ORDER BY 1`);
            const rows = maskSecrets(name, all, req);

            let content, mime, ext;
            if (format === "csv") {
                content = rowsToCsv(rows);
                mime = "text/csv";
                ext = "csv";
            } else if (format === "sql") {
                content = rowsToSql(name, rows);
                mime = "application/sql";
                ext = "sql";
            } else {
                content = JSON.stringify(rows, null, 2);
                mime = "application/json";
                ext = "json";
            }

            addactivity(req.cookies.key, name, "backup", "Downloaded the " + name + " table (" + ext + ")", "", "");
            res.setHeader("Content-Type", mime + "; charset=utf-8");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${name}_${backupStamp()}.${ext}"`
            );
            res.send(content);
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Export failed" });
        }
    });

    // download the whole database as one .sql file
    router.post("/backup/all-sql", async (req, res) => {
        if (!(await verifyAccount(req, res, "X,Y"))) return;
        if (!(await tokenOk(req, res))) return;
        try {
            const tables = await listBackupTables();
            let out =
                `-- Rivira Tech full database backup\n-- Generated ${new Date().toISOString()}\n\n`;
            for (const t of tables) {
                const [rows] = await db.promise().query(`SELECT * FROM "${t}" ORDER BY 1`);
                out += rowsToSql(t, maskSecrets(t, rows, req)) + "\n";
            }
            addactivity(req.cookies.key, "all", "backup", "Downloaded the full database backup", "", "");
            res.setHeader("Content-Type", "application/sql; charset=utf-8");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="full_backup_${backupStamp()}.sql"`
            );
            res.send(out);
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Backup failed" });
        }
    });
};
