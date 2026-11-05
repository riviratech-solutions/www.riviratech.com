import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import axios from "axios";
import { SERVER_URL } from "../components/Includes";
import { csrfTokenNow } from "./csrf";

/* What a student watches of a class recording (api/admin/live-classes/class-views.js).

   ClassVideo.tsx uses this for students only:
     - opening the recording asks api/class-view/start: locked (the batch's
       previous recording isn't watched yet), or a session + where to resume;
     - while it plays, the parts actually played (from the <video> element's own
       timeupdate events; seeking never counts) are sent to api/class-view/progress
       every 15 s and on pause, seek, end, hiding the tab and leaving the page
       (fetch keepalive, so it gets there while the page closes);
     - each answer fires CLASS_PROGRESS_EVENT ({ class_id, percent, completed,
       just_completed }) so the class list can show it and unlock the next one. */

export const CLASS_PROGRESS_EVENT = "rt-class-progress";
export type ClassProgressDetail = { class_id: string; percent: number; completed: boolean; just_completed: boolean };

export type ViewGate =
  | { state: "off" } // not tracked: play as before
  | { state: "checking" }
  | { state: "locked"; prev: { req_id: string; title: string } | null }
  | { state: "open"; resume: number };

const SAVE_EVERY_MS = 15000;
const r1 = (v: number) => Math.round(v * 10) / 10;

type Tracker = {
  sid: string;
  vid: string;
  seq: number;
  lastT: number | null; // where the last timeupdate was
  cur: [number, number] | null; // the range being extended
  ranges: [number, number][]; // played since the last save
  played: number;
  dur: number;
  sentPos: number;
  inFlight: boolean;
  again: boolean;
  el: HTMLVideoElement | null;
};
const fresh = (): Tracker => ({
  sid: "", vid: "", seq: 0, lastT: null, cur: null, ranges: [], played: 0, dur: 0, sentPos: -1, inFlight: false, again: false, el: null,
});

/** How far the student is with this recording (from the server's answers). */
export type ViewInfo = { percent: number; completed: boolean; need: number; justCompleted: boolean };

export function useClassViewTracking(classId: string, enabled: boolean) {
  const [gate, setGate] = useState<ViewGate>(enabled && classId ? { state: "checking" } : { state: "off" });
  const [info, setInfo] = useState<ViewInfo | null>(null);
  const [ended, setEnded] = useState(false); // played to the end (or jumped there) this time
  const takeInfo = (d: any, just = false) =>
    setInfo({
      percent: Number(d.percent) || 0,
      completed: !!d.class_completed,
      need: Number(d.complete_pct) || 90,
      justCompleted: just,
    });
  const t = useRef<Tracker>(fresh());
  const resumed = useRef(false);
  // one key per player + class, so a repeated start (React re-running the effect) is the same session
  const cks = useRef<Record<string, string>>({});

  const flush = useCallback(
    (event: string, keepalive = false) => {
      const s = t.current;
      if (!s.sid) return;
      const pos = s.el ? s.el.currentTime || 0 : Math.max(0, s.sentPos);
      if (event === "tick" && s.played < 0.5 && Math.abs(pos - s.sentPos) < 1) return; // nothing new
      if (s.inFlight && !keepalive) {
        s.again = true;
        return;
      }
      const body = {
        class_id: classId,
        video_id: s.vid,
        session_id: s.sid,
        seq: ++s.seq,
        position: r1(pos),
        duration: r1(s.dur || (s.el && isFinite(s.el.duration) ? s.el.duration : 0)),
        ranges: s.ranges.map(([a, b]) => [r1(a), r1(b)]),
        played: r1(s.played),
        event,
      };
      const sentRanges = s.ranges;
      const sentPlayed = s.played;
      s.ranges = [];
      s.cur = null;
      s.played = 0;
      s.sentPos = pos;
      if (keepalive) {
        fetch(SERVER_URL + "api/class-view/progress", {
          method: "POST",
          keepalive: true,
          credentials: "include",
          headers: { "content-type": "application/json", "x-csrf-token": csrfTokenNow() },
          body: JSON.stringify(body),
        }).catch(() => {});
        return;
      }
      s.inFlight = true;
      axios
        .post(SERVER_URL + "api/class-view/progress", body, { withCredentials: true })
        .then((r) => {
          const d = r.data || {};
          if (d.success) {
            takeInfo(d, !!d.just_completed);
            window.dispatchEvent(
              new CustomEvent<ClassProgressDetail>(CLASS_PROGRESS_EVENT, {
                detail: { class_id: classId, percent: Number(d.percent) || 0, completed: !!d.class_completed, just_completed: !!d.just_completed },
              }),
            );
          }
        })
        .catch(() => {
          // not saved: send it again with the next save
          s.ranges = [...sentRanges, ...s.ranges];
          s.played += sentPlayed;
        })
        .finally(() => {
          s.inFlight = false;
          if (s.again) {
            s.again = false;
            flush("tick");
          }
        });
    },
    [classId],
  );

  // open: the lock, the session, where to resume
  useEffect(() => {
    if (!enabled || !classId) {
      setGate({ state: "off" });
      return;
    }
    let live = true;
    t.current = fresh();
    resumed.current = false;
    setInfo(null);
    setEnded(false);
    const ck = (cks.current[classId] ||= Math.random().toString(36).slice(2) + Date.now().toString(36));
    setGate({ state: "checking" });
    axios
      .post(SERVER_URL + "api/class-view/start", { class_id: classId, ck }, { withCredentials: true })
      .then((r) => {
        if (!live) return;
        const d = r.data || {};
        if (d.success && d.locked) return setGate({ state: "locked", prev: d.prev || null });
        if (d.success && d.session_id) {
          t.current.sid = String(d.session_id);
          t.current.vid = String(d.video_id || "");
          if (Number(d.duration) > 0) t.current.dur = Number(d.duration);
          takeInfo(d);
          return setGate({ state: "open", resume: Number(d.resume) || 0 });
        }
        setGate({ state: "open", resume: 0 }); // not tracked (the stream itself still checks access)
      })
      .catch(() => live && setGate({ state: "open", resume: 0 }));
    return () => {
      live = false;
      flush("exit", true);
    };
  }, [classId, enabled, flush]);

  // save now and then, and when the tab is hidden or the page closes
  useEffect(() => {
    if (gate.state !== "open") return;
    const iv = window.setInterval(() => flush("tick"), SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && flush("hide", true);
    const onLeave = () => flush("exit", true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [gate.state, flush]);

  // <video> events (the element's own playback, not the controls)
  const handlers = {
    onLoadedMetadata: (e: SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      const s = t.current;
      s.el = el;
      if (isFinite(el.duration) && el.duration > 0) s.dur = s.dur || el.duration;
      if (gate.state === "open" && gate.resume > 0 && !resumed.current) {
        resumed.current = true;
        try {
          el.currentTime = gate.resume;
        } catch {
          /* starts from the beginning */
        }
      }
    },
    onPlay: (e: SyntheticEvent<HTMLVideoElement>) => {
      setEnded(false);
      t.current.el = e.currentTarget;
      t.current.lastT = e.currentTarget.currentTime;
    },
    onTimeUpdate: (e: SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      const s = t.current;
      s.el = el;
      const now = el.currentTime;
      if (el.seeking || el.paused) {
        s.lastT = now;
        s.cur = null;
        return;
      }
      if (s.lastT != null) {
        const d = now - s.lastT;
        // played on: a small step forward (timeupdate comes ~4x a second)
        if (d > 0 && d <= 1.5 * (el.playbackRate || 1) + 0.75) {
          if (s.cur && Math.abs(s.cur[1] - s.lastT) < 0.001) s.cur[1] = now;
          else {
            s.cur = [s.lastT, now];
            s.ranges.push(s.cur);
          }
          s.played += d;
        } else s.cur = null; // a jump: not watched
      }
      s.lastT = now;
    },
    onSeeking: () => {
      t.current.lastT = null;
      t.current.cur = null;
    },
    onSeeked: (e: SyntheticEvent<HTMLVideoElement>) => {
      t.current.lastT = e.currentTarget.currentTime;
      flush("seek");
    },
    onPause: () => flush("pause"),
    onEnded: () => {
      setEnded(true);
      flush("end");
    },
  };

  return {
    gate,
    handlers,
    resumedAt: gate.state === "open" ? gate.resume : 0,
    info,
    ended,
    clearEnded: () => setEnded(false),
  };
}
