import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const MEDIA = {
  desktop: "/videos/homepage-hero-v3-1080.mp4",
  mobile: "/videos/homepage-hero-v3-540.mp4",
  poster: "/videos/homepage-hero-v3-poster.webp",
};

type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

/** The initial render is a poster only, including during prerender/hydration.
 * Source attachment and playback are decided together, after preferences and
 * visibility are known. User intent is separate from the actual media state. */
export default function HomeHeroVideo() {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const toggleRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const connection = (navigator as Navigator & { connection?: Connection })
      .connection;
    let intent: "auto" | "play" | "pause" = "auto";
    let visible = false;
    let disposed = false;
    let failed = false;
    let blocked = false;
    let pending = false;
    let generation = 0;

    const constrained = () =>
      Boolean(
        connection?.saveData ||
        connection?.effectiveType === "2g" ||
        connection?.effectiveType === "slow-2g",
      );
    const shouldPlay = () =>
      !disposed &&
      !failed &&
      visible &&
      document.visibilityState === "visible" &&
      intent !== "pause" &&
      (intent === "play" || (!motion.matches && !constrained() && !blocked));

    const sync = () => {
      if (!shouldPlay()) {
        // Invalidate in-flight play promises before pausing. A late resolution
        // must never restart media after a pause, preference change or unmount.
        generation += 1;
        pending = false;
        video.pause();
        return;
      }
      if (pending || !video.paused) return;
      if (!video.getAttribute("src")) {
        // Choose once per visit: resizing must not restart an active download.
        video.src = mobile.matches ? MEDIA.mobile : MEDIA.desktop;
        video.load();
      }
      const attempt = ++generation;
      pending = true;
      void video
        .play()
        .then(() => {
          if (disposed) {
            video.pause();
            return;
          }
          if (attempt !== generation) return;
          pending = false;
          if (!shouldPlay()) video.pause();
        })
        .catch(() => {
          if (disposed || attempt !== generation) return;
          pending = false;
          blocked = true;
          intent = "auto";
          setPlaying(false);
        });
    };

    const onPlaying = () => {
      if (!shouldPlay()) {
        video.pause();
        return;
      }
      setPlaying(true);
      setHasFrame(true);
    };
    const onPause = () => {
      if (!disposed) setPlaying(false);
    };
    const onError = () => {
      failed = true;
      generation += 1;
      pending = false;
      video.pause();
      setPlaying(false);
      setHasFrame(false);
      setUnavailable(true);
    };
    const onPreferenceChange = () => {
      // A newly restrictive preference overrides an earlier manual play.
      // A new explicit click may opt into playback again.
      if (intent === "play" && (motion.matches || constrained()))
        intent = "auto";
      sync();
    };
    toggleRef.current = () => {
      if (failed) return;
      if (!video.paused || pending) {
        intent = "pause";
      } else {
        intent = "play";
        blocked = false;
      }
      sync();
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", onPreferenceChange);
    connection?.addEventListener("change", onPreferenceChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        sync();
      },
      { threshold: [0, 0.25] },
    );
    observer.observe(frame);

    return () => {
      disposed = true;
      generation += 1;
      toggleRef.current = () => {};
      observer.disconnect();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", onPreferenceChange);
      connection?.removeEventListener("change", onPreferenceChange);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="rt-hero-video-frame"
      data-has-frame={hasFrame}
    >
      <img
        className="rt-hero-video-poster"
        src={MEDIA.poster}
        alt=""
        width="1920"
        height="1080"
        decoding="async"
        aria-hidden="true"
      />
      <video
        ref={videoRef}
        className="rt-hero-video"
        muted
        loop
        playsInline
        preload="none"
        width="1920"
        height="1080"
        aria-hidden="true"
      />
      <div className="rt-hero-video-shade" aria-hidden="true" />
      <button
        type="button"
        className="rt-hero-video-toggle"
        onClick={() => toggleRef.current()}
        disabled={unavailable}
        aria-label={
          unavailable
            ? "Hero video unavailable"
            : playing
              ? "Pause hero video"
              : "Play hero video"
        }
      >
        {playing ? (
          <Pause size={16} aria-hidden="true" />
        ) : (
          <Play size={16} aria-hidden="true" />
        )}
        <span>{unavailable ? "Unavailable" : playing ? "Pause" : "Play"}</span>
      </button>
    </div>
  );
}
