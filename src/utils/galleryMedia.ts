/* Helpers for showing gallery videos in LightGallery (website Gallery and the
   admin panel's Gallery page). */

// Map a stored file key's extension to a video MIME type for the LightGallery player.
export const videoMime = (src: string) => {
  const s = (src || "").toLowerCase();
  if (s.endsWith(".webm")) return "video/webm";
  if (s.endsWith(".mov")) return "video/quicktime";
  if (s.endsWith(".mkv")) return "video/x-matroska";
  if (s.endsWith(".avi")) return "video/x-msvideo";
  return "video/mp4";
};

// LightGallery's thumbnail strip needs an <img> — videos have none, so it renders
// blank. Give video slides this inline "play" placeholder as their data-thumb.
export const VIDEO_THUMB =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="#1b1338"/><circle cx="60" cy="45" r="20" fill="rgba(255,255,255,.15)"/><path d="M54 34l18 11-18 11z" fill="#fff"/></svg>`,
  );

/* data-video for a LightGallery slide. No data-poster: with one, LightGallery
   shows its own play button and then calls play() itself, which browsers often
   refuse as "not a user gesture" — the slide stuck on a spinner. Without it the
   real <video> appears with native controls, and pressing play there always works. */
export const videoSlide = (url: string, key: string) =>
  JSON.stringify({
    source: [{ src: url, type: videoMime(key) }],
    attributes: { preload: "metadata", controls: true, playsinline: true },
  });
