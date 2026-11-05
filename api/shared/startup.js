/**
 * Start-up database setup (CREATE TABLE, new columns, triggers) and clean-up
 * timers. Only one process runs them: the single API process, or the cluster's
 * leader copy (see ../cluster.js). The other copies start once the leader has
 * finished and skip all of it, so two processes never change the same table at
 * the same time.
 */
const { isLeader } = require("../cluster");

const runsSetup = isLeader();
const pending = [];

/** Run one setup step (a function returning a promise) — in the setup process only.
    A failure is logged and doesn't stop the other steps. */
function setup(label, fn) {
    if (!runsSetup) return Promise.resolve();
    const p = Promise.resolve()
        .then(fn)
        .catch((err) => console.error(`${label}:`, err && err.message ? err.message : err));
    pending.push(p);
    return p;
}

/** Resolves when every setup step started so far has finished. */
async function done() {
    let n;
    do {
        n = pending.length;
        await Promise.allSettled(pending.slice());
    } while (n !== pending.length);
}

/** A repeating clean-up job — in the setup process only. */
function leaderInterval(label, fn, everyMs, firstAfterMs = 60 * 1000) {
    if (!runsSetup) return;
    const run = () => Promise.resolve().then(fn).catch((err) => console.error(`${label}:`, err && err.message ? err.message : err));
    setTimeout(run, firstAfterMs).unref();
    setInterval(run, everyMs).unref();
}

module.exports = { runsSetup, setup, done, leaderInterval };
