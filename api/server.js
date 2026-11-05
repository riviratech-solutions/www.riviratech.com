require("dotenv").config();

/* ---------- Cluster (cluster.js) ----------
   With API_WORKERS above 1 (the default on a multi-core machine) this file runs
   in several processes: the main one only starts and watches the others, one
   sends the queued mail, and the rest are copies of the API below. */
const kkrCluster = require("./cluster");
const ROLE = kkrCluster.role(); // "primary" | "api" | "mail" | "single"
if (ROLE === "primary") {
  kkrCluster.startPrimary();
  return;
}
if (ROLE === "mail") {
  require("./shared/mail-queue").runSender({ standalone: true });
  return;
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const helmet = require("helmet");
const compression = require("compression");

const app = express();
app.disable("x-powered-by");

if (!process.env.SESSION_SECRET && !process.env.ENCRYPT_KEY) {
  console.error("❌ SESSION_SECRET (or ENCRYPT_KEY) is not set — refusing to start. Sessions, security tokens and upload links are signed with it.");
  process.exit(1);
}

/* Keep the server alive if a stray async error slips through a route.
   Node terminates the process on an unhandled rejection by default, which
   looks like the server "auto-disconnecting". Log it and keep serving. */
process.on("unhandledRejection", (reason) => {
  console.error("⚠️  Unhandled promise rejection (server kept alive):", reason);
});

/* An uncaught synchronous throw — or, more commonly here, an 'error' event with
   no listener from an external client (a dropped S3 / Postgres / SMTP socket, a
   DNS blip, a firewall reset) — terminates Node by default, with little or no
   output. That is what makes the process silently "auto close" right after
   startup on some machines. Log it and keep the API up instead of exiting. */
process.on("uncaughtException", (err) => {
  console.error(
    "⚠️  Uncaught exception (server kept alive):",
    err && err.stack ? err.stack : err
  );
});

app.use((req, res, next) => {
  if (req.url.includes(".env")) {
    return res.status(403).send("Forbidden");
  }
  next();
});

/* ---------- CORS ---------- */
// Reflecting any Origin (origin:true) with credentials lets any site read
// authenticated responses. Restrict to an explicit allow-list (audit SEC-09).
// Configure extra origins via CORS_ORIGINS (comma-separated) in the env.
// In production, local dev origins never belong on the list: any page served from
// localhost on a visitor's machine could otherwise make credentialed calls here
// (security audit, Finding 9). Dropped automatically if CORS_ORIGINS still has them.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean)
  .filter(o => process.env.NODE_ENV !== "production" || !LOCAL_ORIGIN.test(o));

function isAllowedOrigin(origin) {
  // Requests without an Origin header, such as some server-to-server
  // requests, are handled separately by your API security rules.
  if (!origin) return true;

  let parsedOrigin;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  // Reject non-web origins.
  if (!["http:", "https:"].includes(parsedOrigin.protocol)) {
    return false;
  }

  // An origin must not contain a path, query, or fragment.
  if (
    parsedOrigin.origin !== origin ||
    parsedOrigin.username ||
    parsedOrigin.password
  ) {
    return false;
  }

  return allowedOrigins.some((allowed) => {
    // Exact origin match.
    if (!allowed.startsWith("*.")) {
      return allowed === parsedOrigin.origin;
    }

    // Wildcard domain, e.g. *.riviratech.com
    const domain = allowed.substring(2).toLowerCase();
    const hostname = parsedOrigin.hostname.toLowerCase();

    return (
      hostname === domain ||
      hostname.endsWith(`.${domain}`)
    );
  });
}

/*
app.use((req, res, next) => {
  console.log("Cookie Header:", req.headers.cookie);
  console.log("Cookies:", req.cookies);
  next();
});
*/

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
app.use(cors((req, done) => done(null, {
  credentials: true,
  origin: (origin, cb) => {
    if (origin && LOCAL_ORIGIN.test(origin) && !LOCAL_HOST.test(String(req.headers.host || ""))) {
      return cb(null, false);
    }
    //console.log("Origin:", origin);
    //console.log("Allowed:", isAllowedOrigin(origin));

    if (isAllowedOrigin(origin)) {
      return cb(null, true);
    }

    // Refuse quietly: no CORS headers, so the browser blocks the response.
    // Throwing here produced a 500 with a stack trace and server paths.
    return cb(null, false);
  },
})));

const isProd = process.env.NODE_ENV === "production";

function trustProxySetting() {
  const v = String(process.env.TRUST_PROXY ?? "").trim().toLowerCase();
  if (v === "") return isProd ? 1 : false; // production sits behind one proxy
  if (v === "false" || v === "0") return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v; // an address / subnet list, which Express also accepts
}
//app.set("trust proxy", trustProxySetting());

// Trust only the local reverse proxy (Nginx).
app.set("trust proxy", "loopback");

console.log("Project Mode : " + process.env.NODE_ENV);
/*
app.use((req, res, next) => {
  console.log("IP:", req.ip);
  console.log("X-Forwarded-For:", req.headers["x-forwarded-for"]);
  next();
});
*/
console.log("trust proxy =", app.get("trust proxy"));

// Adds secure HTTP headers to help protect against common web vulnerabilities
// (XSS, clickjacking, MIME sniffing, etc.)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Compresses HTTP responses (Gzip/Brotli when supported)
// to reduce bandwidth usage and improve page/API response speed
app.use(compression());

/* ---------- Body Parser ---------- */
app.use(express.json());
app.use(cookieParser());
/* ---------- Database (Postgres) ---------- */
const db = require("./shared/pgdb");

/* ---------- Session ---------- */
// Session middleware. In a cluster, sessions are kept in Postgres
// (security/session-store.js) so every API copy sees the same ones. A single
// process (API_WORKERS=1) keeps them in memory as before — no database call
// per request, which matters on a machine far from the database.
const CLUSTERED = ROLE === "api";
const PgSessionStore = require("./security/session-store");
app.use(
  session({
    store: CLUSTERED ? new PgSessionStore(db) : undefined,
    // Prefer a dedicated SESSION_SECRET; fall back to ENCRYPT_KEY so existing
    // deploys keep working. Set SESSION_SECRET to a fresh random value (SEC-10).
    secret: process.env.SESSION_SECRET || process.env.ENCRYPT_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // page scripts never read it — keeps it out of reach of XSS
      sameSite: process.env.NODE_SAMESITE || "lax",
      // Secure cookies require HTTPS; enabling on plain http would silently drop
      // the session. On in production, or on any HTTPS host via NODE_SECURE=true.
      secure: isProd || process.env.NODE_SECURE === "true",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);


// Global soft limiter — coarse DoS guard for the whole API.
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requests per IP
  // a class recording streams in many byte-range requests (signed-in viewers only)
  skip: (req) => req.path.startsWith("/class-video/"),
});
app.use("/api", limiter);

// CSRF: double-submit cookie (security/csrf.js). The page gets a token from
// GET /api/csrf-token and sends it as "x-csrf-token" on every state-changing
// request; anything without a valid one is refused before it reaches a route.
const csrf = require("./security/csrf");
app.get("/api/csrf-token", csrf.tokenRoute);
app.use("/api", csrf.protect);

// Strict limiter for authentication / OTP / password-reset endpoints to blunt
// credential brute-force and OTP guessing (audit SEC-11). 10 attempts / 15 min.
// In a cluster it is counted in Postgres (security/rate-store.js), shared by
// every API copy; if the database can't be reached the request is let through,
// not refused. A single process counts in memory as before.
const PgRateStore = require("./security/rate-store");
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  ...(CLUSTERED ? { store: new PgRateStore({ prefix: "auth:" }), passOnStoreError: true } : {}),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});
app.use(
  ["/api/signin", "/api/reset-request", "/api/verify-otp", "/api/reset-password"],
  authLimiter
);


/* ---------- Database (Postgres) ---------- */
// (db is required above, before the session store)

// Test Connection
db.getConnection((err, conn) => {
  if (err) {
    console.error("DB Error:", err);
  } else {
    console.log("✅ Postgres connected");
    conn.release();
  }
});

/* ---------- Local file uploads ----------
   Uploads live on the server's own disk under admin/uploads/ and are served
   publicly at /uploads/<key> — the same role used to play.
   shared/uploads.js writes here via /api/upload-file and promotes temp files on
   save. */
const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
// Public, cache-friendly static serving (files were public on S3 too). The
// /api rate-limiter is path-scoped, so asset loads here never touch it.
// These assets are embedded cross-origin by the frontend (e.g. Vite on :5173
// or the deployed site pulling from the API host), so mark them explicitly as
// cross-origin — otherwise the browser blocks the <img> with
// ERR_BLOCKED_BY_RESPONSE.NotSameOrigin (Cross-Origin-Resource-Policy).
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    // A class recording's original (riviratech/classes/<course>/<batch>/<class>/<file>)
    // is never served here: it plays only through /api/class-video and the HLS key
    // checks (admin/live-classes/class-video.js). Older recordings, stored directly
    // in riviratech/classes/, are still served as before.
    if (/^\/riviratech\/classes\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.(mp4|m4v|mov|mkv|webm|avi)$/i.test(req.path)) {
      return res.status(404).end();
    }
    // encrypted class streams (playlist + segments) are read by the player with
    // XHR; they are useless without the key (/api/hls-key), so any origin may read
    if (/^\/riviratech\/classes\/.+\/hls\//.test(req.path)) res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(UPLOADS_DIR, { maxAge: "7d", fallthrough: true })
);
console.log("✅ Local uploads dir:", UPLOADS_DIR);


/* ---------- Routes ----------
   Every /api route, grouped by page: see routes.js. */
const authRoutes = require("./routes")(db);
app.use("/api", authRoutes);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err && (err.status || err.statusCode)) || 500;
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid request body." });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request is too large." });
  }
  if (status >= 500) console.error("Unhandled error on", req.method, req.path, err);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    message: status >= 500 ? "Something went wrong. Please try again." : "Bad request.",
  });
});

const server = app.listen(process.env.PORT, () => {
  console.log(`Server running on ${process.env.PORT}` + (ROLE === "api" ? ` (API copy ${Number(process.env.KKR_WORKER_INDEX) + 1}, pid ${process.pid})` : ""));
});
// Node ends a request still sending its body after 5 minutes by default; a class
// video upload (up to 5 GB, shared/uploads.js) can take far longer on a slow line.
// Live, nginx still drops a client that stops sending (client_body_timeout).
server.requestTimeout = 4 * 60 * 60 * 1000;

/* The leader copy (or the single process) runs the start-up table setup
   (shared/startup.js); the main process starts the other copies once it's done.
   Without a cluster this process also sends the queued mail. */
const startup = require("./shared/startup");
if (startup.runsSetup) {
  startup.done().then(() => {
    console.log("✅ Database setup finished");
    kkrCluster.setupDone();
  });
}
if (ROLE === "single") require("./shared/mail-queue").runSender({ standalone: false });

/* If the port is busy (a stale server.js still running) or listening otherwise
   fails, listen() emits 'error' instead of the callback. Without a listener that
   error would crash the process — surface a clear message instead. */
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${process.env.PORT} is already in use — another server.js is still ` +
      `running. Close it (or kill the process holding that port) and start again.`
    );
  } else {
    console.error("❌ HTTP server error:", err);
  }
});

/* Belt-and-suspenders keep-alive. On some machines the process was exiting the
   instant startup finished — the tell-tale sign of the event loop draining even
   though app.listen() should hold it open. This no-op timer (fires ~every 12
   days) guarantees the loop never empties, so the server cannot silently close.
   Costs nothing and is trivially removable if the real cause is later found. */
const keepAlive = setInterval(() => { }, 1 << 30);

/* Diagnostics — if the process ever does go down, say exactly how, instead of
   just returning to the prompt with no explanation. */
process.on("beforeExit", (code) => {
  console.log(`ℹ️  Event loop empty — Node about to exit (code ${code}).`);
});
process.on("exit", (code) => {
  console.log(`ℹ️  Process 'exit' fired (code ${code}).`);
});
["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"].forEach((sig) => {
  process.on(sig, () => {
    console.log(`ℹ️  Received ${sig} — shutting down.`);
    clearInterval(keepAlive);
    server.close(() => process.exit(0));
    // Force-exit if close hangs.
    setTimeout(() => process.exit(0), 2000).unref();
  });
});
