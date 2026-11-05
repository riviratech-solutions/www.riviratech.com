/**
 * Wall-clock date + time in a named time zone ("Asia/Kolkata", "America/New_York")
 * → a Unix timestamp. Used for class times (admin/live-classes/live-classes.js): the
 * admin picks the class's time zone, everyone sees the time in their own
 * (src/utils/classTime.ts). No library: Intl knows every zone and its DST rules.
 */

/** A zone Intl knows ("" and anything else → false). */
function validTz(tz) {
    if (!tz || typeof tz !== "string" || tz.length > 64) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

// minutes the zone is ahead of UTC at the instant `ms`
function offsetMin(ms, tz) {
    const p = {};
    for (const x of new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ms))) p[x.type] = x.value;
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** "2026-10-30", "14:30" in `tz` → Unix seconds; NaN when the input isn't a date / time.
    Twice round the offset, so a time near a daylight-saving change lands right. */
function zonedToEpoch(date, time, tz) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || "").trim());
    const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(time || "00:00").trim());
    if (!d || !t) return NaN;
    const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], +(t[3] || 0));
    let ms = wall - offsetMin(wall, tz) * 60000;
    ms = wall - offsetMin(ms, tz) * 60000;
    return Math.floor(ms / 1000);
}

module.exports = { validTz, zonedToEpoch, offsetMin };
