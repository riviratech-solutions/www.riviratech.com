import { useEffect, useRef, useState, type CSSProperties } from "react";
import axios from "axios";
import { SERVER_URL, AWS_UPLOADS } from "./Includes";
import { useCurrentUser } from "../utils/currentUser";
import { useClassViewTracking } from "../utils/classViewTracking";

/* A class recording, however it is stored (api/admin/live-classes/class-video.js):
     video_mode ""     an older public upload: played from /uploads as before
     video_mode "mp4"  the private original, streamed by GET api/class-video/<class>
                       (the sign-in cookies go with the request)
     video_mode "hls"  encrypted HLS (AES-128): the playlist + segments are public
                       files, the key comes from GET api/hls-key/... for viewers who
                       may watch. Played with hls.js (loaded only when needed), or
                       natively by Safari. While FFmpeg prepares it, a "being
                       prepared" card checks back every 15 seconds.
   For students, what they watch is saved and a recording stays locked until the
   batch's previous one is watched (utils/classViewTracking.ts, class-views.js);
   it resumes where they left off. */

type Item = {
  req_id?: string;
  file?: string;
  video_mode?: string;
  video_status?: string;
  video_progress?: number;
  video_error?: string;
  hls_playlist?: string;
};

export default function ClassVideo({
  item,
  autoPlay = false,
  showWatermark = true,
  className,
  style,
  onGoTo,
}: {
  item: Item;
  autoPlay?: boolean;
  showWatermark?: boolean;
  className?: string;
  style?: CSSProperties;
  /** a locked recording's "Go to the previous class" button (the class list's select) */
  onGoTo?: (reqId: string) => void;
}) {
  const user = useCurrentUser();
  const fileStr = String(item.file || "");
  const isHls = item.video_mode === "hls" || !!item.hls_playlist || fileStr.startsWith("gdrive-hls:");
  const mode = isHls ? "hls" : String(item.video_mode || (fileStr.startsWith("gdrive:") ? "mp4" : ""));
  const derivedPlaylist = item.hls_playlist || (fileStr.startsWith("gdrive-hls:") && item.req_id ? `api/class-hls/${item.req_id}/${fileStr.slice(11)}/index.m3u8` : "");
  const [status, setStatus] = useState(String(item.video_status || (fileStr.startsWith("gdrive-hls:") ? "ready" : "")));
  const [progress, setProgress] = useState(Number(item.video_progress) || 0);
  const [playlist, setPlaylist] = useState(String(derivedPlaylist));
  const [broken, setBroken] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");
  const [buffering, setBuffering] = useState(true);
  const [retrySeq, setRetrySeq] = useState(0);
  const ref = useRef<HTMLVideoElement | null>(null);

  // students: the lock, viewing progress, resume (a recording that can be played now)
  const tracked = user?.status === "1" && !!item.req_id && (mode !== "hls" || status === "ready");
  const { gate, handlers, resumedAt, info, ended, clearEnded } = useClassViewTracking(String(item.req_id || ""), tracked);
  // "Class completed" for a few seconds, when this viewing completes it
  const [doneNote, setDoneNote] = useState(false);
  useEffect(() => {
    if (!info?.justCompleted) return;
    setDoneNote(true);
    const tm = window.setTimeout(() => setDoneNote(false), 7000);
    return () => window.clearTimeout(tm);
  }, [info?.justCompleted]);
  const [resumeNote, setResumeNote] = useState(false);
  useEffect(() => {
    if (!(resumedAt > 0)) return;
    setResumeNote(true);
    const tm = window.setTimeout(() => setResumeNote(false), 8000);
    return () => window.clearTimeout(tm);
  }, [resumedAt]);
  const waitGate = gate.state === "checking" || gate.state === "locked";

  // another class: start again without the previous one's retry state
  useEffect(() => {
    setRetrySeq(0);
  }, [item.req_id]);

  useEffect(() => {
    const f = String(item.file || "");
    const curPlaylist = item.hls_playlist || (f.startsWith("gdrive-hls:") && item.req_id ? `api/class-hls/${item.req_id}/${f.slice(11)}/index.m3u8` : "");
    setStatus(String(item.video_status || (f.startsWith("gdrive-hls:") ? "ready" : "")));
    setProgress(Number(item.video_progress) || 0);
    setPlaylist(String(curPlaylist));
    setBroken(false);
    setErrorDetail("");
    setBuffering(true);
  }, [item.req_id, item.video_status, item.hls_playlist, item.file, retrySeq]);

  // waiting for the conversion: check back now and then
  useEffect(() => {
    if (mode !== "hls" || status === "ready" || status === "failed" || !item.req_id) return;
    const t = window.setInterval(async () => {
      try {
        const r = await axios.get(SERVER_URL + "api/class-video-status/" + item.req_id, { withCredentials: true });
        if (r.data && r.data.success) {
          setStatus(String(r.data.status || ""));
          setPlaylist(String(r.data.playlist || ""));
          setProgress(Number(r.data.progress) || 0);
          if (r.data.error) setErrorDetail(String(r.data.error));
        }
      } catch {
        /* try again next time */
      }
    }, status === "processing" || status === "uploading" ? 5000 : 15000); // quicker while it is converting / uploading
    return () => window.clearInterval(t);
  }, [mode, status, item.req_id]);

  // play the encrypted stream
  useEffect(() => {
    if (mode !== "hls" || status !== "ready" || !playlist || !ref.current || waitGate) return;
    const video = ref.current;
    // on Google Drive the playlist is served by the API (api/class-hls/...)
    const src = (playlist.startsWith("api/") ? SERVER_URL : AWS_UPLOADS) + playlist;
    let hls: any = null;
    let cancelled = false;
    // After a failure (or a manual "Retry Playback"), playlist + segment requests get a
    // cache-busting query so the browser can't keep replaying a bad cached copy.
    let bust = retrySeq > 0 ? `${retrySeq}-${Date.now().toString(36)}` : "";
    let netRetries = 0;
    let mediaRetries = 0;
    let retryTimer = 0;
    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        // Drive-backed segments come through the API: allow a slower first byte and
        // more retries than hls.js's defaults before calling it an error.
        const policy = (ttfb: number, tries: number) => ({
          default: {
            maxTimeToFirstByteMs: ttfb,
            maxLoadTimeMs: 120000,
            timeoutRetry: { maxNumRetry: tries, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
            errorRetry: { maxNumRetry: tries, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
          },
        });
        hls = new Hls({
          fragLoadPolicy: policy(30000, 6),
          keyLoadPolicy: policy(20000, 4),
          manifestLoadPolicy: policy(20000, 4),
          playlistLoadPolicy: policy(20000, 4),
          xhrSetup: (xhr: XMLHttpRequest, url: string) => {
            // the key, and a Drive stream's playlist + segments, come from the API (sign-in cookies)
            if (url.includes("/api/")) xhr.withCredentials = true;
          },
        });
        hls.on(Hls.Events.ERROR, (_e: unknown, data: any) => {
          if (!data || !data.fatal) return; // hls.js retries non-fatal errors itself
          const code = data.response?.code;
          console.warn("Class video error:", data.type, data.details, code ?? "");
          if (code === 403) {
            setErrorDetail("You are not authorized to watch this course video. Please sign in again.");
            setBroken(true);
            setBuffering(false);
            return;
          }
          // a dropped / slow segment from Drive: wait a moment, then carry on loading
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 4) {
            netRetries++;
            bust = `${retrySeq}-${Date.now().toString(36)}`;
            setBuffering(true);
            retryTimer = window.setTimeout(() => hls && hls.startLoad(), 1500 * netRetries);
            return;
          }
          // a segment that wouldn't decrypt / decode (e.g. a cut-off copy): re-fetch it fresh
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 3) {
            mediaRetries++;
            bust = `${retrySeq}-${Date.now().toString(36)}`;
            if (mediaRetries === 2) hls.swapAudioCodec();
            hls.recoverMediaError();
            return;
          }
          setErrorDetail(
            code === 404
              ? "The video stream was not found on the server or Google Drive."
              : `Network or stream error while loading the video (${data.details || data.type}).`,
          );
          setBroken(true);
          setBuffering(false);
        });
        // a segment played fine: reset the retry budgets
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          netRetries = 0;
          mediaRetries = 0;
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        if (autoPlay) hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = bust ? src + "?cb=" + bust : src; // Safari plays HLS (and fetches the key) itself
        if (autoPlay) video.play().catch(() => {});
      } else {
        setErrorDetail("Your browser does not support HLS video playback.");
        setBroken(true);
        setBuffering(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      if (hls) hls.destroy();
    };
  }, [mode, status, playlist, autoPlay, retrySeq, waitGate]);

  const watermarkText = user
    ? [user.name, user.email, user.mem_id ? `ID: ${user.mem_id.slice(0, 8)}` : ""].filter(Boolean).join(" • ")
    : "";

  const box = (text: string, sub?: string, spin = false, pct = 0, canRetry = false) => (
    <div className={"cv-box " + (className || "")} style={style} role="status">
      {spin && <span className="cv-spin" />}
      <b>{text}</b>
      {pct > 0 && (
        <span className="cv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: pct + "%" }} />
        </span>
      )}
      {sub && <small>{sub}</small>}
      {canRetry && (
        <button
          type="button"
          className="cv-retry-btn"
          onClick={() => {
            setBroken(false);
            setErrorDetail("");
            setBuffering(true);
            setRetrySeq((n) => n + 1);
          }}
        >
          Retry Playback
        </button>
      )}
      <style>{CSS}</style>
    </div>
  );

  const renderPlayer = (videoSrc?: string) => (
    <div className={"cv-player-wrap " + (className || "")} style={style}>
      {buffering && (
        <div className="cv-loading-overlay" role="status" aria-live="polite">
          <span className="cv-spin" />
          <small>Loading video stream…</small>
        </div>
      )}
      <video
        key={videoSrc ? `${videoSrc}-${retrySeq}` : `hls-${item.req_id}-${retrySeq}`}
        ref={ref}
        className="cv-video-el"
        controls
        playsInline
        autoPlay={autoPlay}
        preload="metadata"
        controlsList="nodownload"
        src={videoSrc}
        {...handlers}
        onLoadStart={() => setBuffering(true)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => setBuffering(false)}
        onLoadedData={() => setBuffering(false)}
        onError={(e) => {
          // HLS: hls.js owns error handling (and recovers from most errors), so the
          // element's own error event must not end playback on its own.
          if (mode === "hls") return;
          const err = (e.currentTarget as HTMLVideoElement).error;
          // one quiet retry (fresh, uncached request) before showing the error card
          if (retrySeq === 0) {
            setRetrySeq(1);
            return;
          }
          setBuffering(false);
          setErrorDetail(
            "Unable to load or play this video stream" +
              (err ? ` (media error ${err.code}${err.message ? ": " + err.message : ""})` : "") +
              ". Please check your connection or permissions and try again.",
          );
          setBroken(true);
        }}
      />
      {showWatermark && watermarkText && (
        <div className="cv-watermark" aria-hidden="true">
          {watermarkText}
        </div>
      )}
      {resumeNote && (
        <div className="cv-resume" role="status">
          Resumed at {clock(resumedAt)}
          <button
            type="button"
            onClick={() => {
              if (ref.current) ref.current.currentTime = 0;
              setResumeNote(false);
            }}
          >
            Start over
          </button>
        </div>
      )}
      {/* reached the end without watching enough of it: say why the next class stays locked */}
      {ended && info && !info.completed && (
        <div className="cv-note" role="status">
          <b>Not completed yet</b>
          <span>
            You've watched {info.percent < 1 ? "less than 1%" : info.percent + "%"} of this class. Watch at least{" "}
            {info.need}% of it to complete it and unlock the next class — skipping ahead doesn't count.
          </span>
          <div className="cv-note-btns">
            <button
              type="button"
              onClick={() => {
                clearEnded();
                if (ref.current) {
                  ref.current.currentTime = 0;
                  ref.current.play().catch(() => {});
                }
              }}
            >
              Watch from the start
            </button>
            <button type="button" className="ghost" onClick={clearEnded}>
              Close
            </button>
          </div>
        </div>
      )}
      {doneNote && (
        <div className="cv-resume cv-done" role="status">
          ✓ Class completed — you can go on to the next class
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );

  // checking the lock, or locked
  if (gate.state === "checking") return box("Loading video…", undefined, true);
  if (gate.state === "locked") {
    const prev = gate.prev;
    return (
      <div className={"cv-box " + (className || "")} style={style} role="status">
        <span className="cv-lock" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <b>This class is locked</b>
        <small>{prev ? `Watch "${prev.title}" first to unlock this recording.` : "Watch the previous class first to unlock this recording."}</small>
        {prev && onGoTo && (
          <button type="button" className="cv-retry-btn" onClick={() => onGoTo(prev.req_id)}>
            Go to the previous class
          </button>
        )}
        <style>{CSS}</style>
      </div>
    );
  }

  if (mode === "hls") {
    if (status === "failed") {
      return box(
        "This video couldn't be prepared",
        errorDetail || item.video_error || "Please try again later.",
      );
    }
    if (status !== "ready" || !playlist) {
      const pct = status === "processing" || status === "uploading" ? progress : 0;
      const label =
        status === "uploading"
          ? pct > 0
            ? `Uploading video to Google Drive… ${pct}%`
            : "Uploading video to Google Drive…"
          : pct > 0
            ? `Your video is being prepared… ${pct}%`
            : "Your video is being prepared…";
      return box(label, "This takes a few minutes; it starts here when ready.", true, pct);
    }
    if (broken) {
      return box(
        "This video can't be played right now",
        errorDetail || "Please reload the page, or try again.",
        false,
        0,
        true,
      );
    }
    return renderPlayer(undefined);
  }

  if (broken) {
    return box(
      "This video can't be played right now",
      errorDetail || "Please reload the page, or try again.",
      false,
      0,
      true,
    );
  }

  const base = mode === "mp4" ? SERVER_URL + "api/class-video/" + item.req_id : AWS_UPLOADS + String(item.file || "");
  // after a failure, a fresh (uncached) request
  const src = retrySeq > 0 ? base + (base.includes("?") ? "&" : "?") + "cb=" + retrySeq : base;
  return renderPlayer(src);
}

const clock = (sec: number) => {
  const x = Math.max(0, Math.floor(sec));
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), ss = String(x % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const CSS = `
.cv-box {
  position: relative; width: 100%; height: 100%; aspect-ratio: 16 / 9; min-height: 280px; max-height: 75vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px;
  border-radius: 14px; background: radial-gradient(120% 120% at 20% 10%, #2e2052 0%, #140d2b 60%, #0b0718 100%);
  color: #e9e4ff; box-sizing: border-box;
}
.cv-box b { font-size: 1.05rem; color: #fff; }
.cv-box small { color: #c9bff0; font-size: .88rem; max-width: 480px; }
.cv-bar { width: min(280px, 75%); height: 6px; border-radius: 999px; background: rgba(255,255,255,.18); overflow: hidden; }
.cv-bar span { display: block; height: 100%; border-radius: inherit; background: #fff; transition: width .6s ease; }
.cv-spin { width: 32px; height: 32px; border-radius: 50%; border: 3px solid rgba(255,255,255,.22); border-top-color: #fff; animation: cv-spin .9s linear infinite; }
.cv-retry-btn { margin-top: 10px; padding: 7px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,.3); background: rgba(255,255,255,.12); color: #fff; font-size: .88rem; font-weight: 600; cursor: pointer; transition: background .2s; }
.cv-retry-btn:hover { background: rgba(255,255,255,.22); }
.cv-player-wrap {
  position: relative; width: 100%; height: 100%; aspect-ratio: 16 / 9; min-height: 280px; max-height: 75vh;
  background: #000; border-radius: 14px; overflow: hidden; box-sizing: border-box;
}
.cv-video-el {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; display: block; background: #000;
}
.cv-loading-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; background: rgba(11, 7, 24, 0.72); backdrop-filter: blur(4px); color: #fff; z-index: 2; pointer-events: none;
}
.cv-loading-overlay small { font-size: 0.9rem; font-weight: 500; letter-spacing: 0.02em; color: rgba(255, 255, 255, 0.88); }
.cv-watermark {
  position: absolute; top: 14px; right: 16px; padding: 5px 12px; border-radius: 6px;
  background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); color: rgba(255, 255, 255, 0.8);
  font-size: 0.76rem; font-weight: 500; letter-spacing: 0.02em; pointer-events: none; user-select: none;
  z-index: 3; max-width: 85%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cv-lock { width: 56px; height: 56px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,.12); color: #fff; }
.cv-resume {
  position: absolute; left: 14px; bottom: 64px; z-index: 3; display: inline-flex; align-items: center; gap: 10px;
  padding: 7px 8px 7px 14px; border-radius: 999px; background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(3px);
  color: #fff; font-size: 0.82rem; font-weight: 500; animation: cv-fade .25s ease;
}
.cv-resume button { border: 0; border-radius: 999px; padding: 4px 11px; background: rgba(255,255,255,.18); color: #fff; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
.cv-resume button:hover { background: rgba(255,255,255,.3); }
.cv-done { padding-right: 14px; background: rgba(22, 163, 74, 0.9); }
.cv-note {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 4; width: min(440px, calc(100% - 32px));
  display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border-radius: 14px; text-align: center;
  background: rgba(11, 7, 24, 0.88); backdrop-filter: blur(4px); color: #e9e4ff; animation: cv-fade .25s ease;
}
.cv-note b { color: #fff; font-size: 1rem; }
.cv-note span { font-size: .86rem; line-height: 1.45; }
.cv-note-btns { display: flex; gap: 8px; justify-content: center; margin-top: 4px; flex-wrap: wrap; }
.cv-note-btns button { border: 0; border-radius: 8px; padding: 7px 14px; background: #fff; color: #1e1340; font-size: .84rem; font-weight: 700; cursor: pointer; }
.cv-note-btns button.ghost { background: rgba(255,255,255,.14); color: #fff; }
@keyframes cv-fade { from { opacity: 0; transform: translateY(4px); } }
@keyframes cv-spin { to { transform: rotate(360deg); } }
`;
