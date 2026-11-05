/* Upload progress for a form that sends files with a signed upload URL
   (api/shared/uploads.js) and then saves:
     uploading  "Uploading video (1 of 2) · 42%", a bar that follows the bytes
                smoothly, and "820 MB of 2.0 GB · 12.4 MB/s · about 2 min left"
     preparing  total 0 (asking for the upload URL): "Preparing upload…", moving bar
     saving     once the bytes are sent (or when there was nothing to upload):
                a moving bar and "Saving…"
   Pass `up` = null while only saving. */

export type UploadState = {
  label: string; // "Uploading video", "Uploading document (2 of 2)"
  loaded: number;
  total: number;
  start: number; // performance.now() when this file started
  saving?: boolean; // every byte sent, waiting for the server
} | null;

const fmtBytes = (n: number) => {
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1) + " GB";
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(n >= 100 * 1024 ** 2 ? 0 : 1) + " MB";
  return Math.max(1, Math.round(n / 1024)) + " KB";
};
const fmtLeft = (s: number) => {
  if (s < 10) return "a few seconds left";
  if (s < 60) return `about ${Math.round(s / 5) * 5} s left`;
  if (s < 3600) return `about ${Math.round(s / 60)} min left`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return `about ${h} h${m ? ` ${m} min` : ""} left`;
};

export default function UploadProgress({ up, className = "" }: { up: UploadState; className?: string }) {
  const preparing = !!up && !up.total; // asking for the upload URL
  const saving = !up || up.saving || (up.total > 0 && up.loaded >= up.total);
  const moving = saving || preparing; // no byte count yet: a moving bar
  const pct = up && up.total > 0 ? Math.min(100, Math.floor((up.loaded * 100) / up.total)) : 0;

  let detail = "";
  if (up && !moving) {
    const secs = (performance.now() - up.start) / 1000;
    const rate = secs > 0.5 ? up.loaded / secs : 0; // bytes / s, averaged since the start
    detail = `${fmtBytes(up.loaded)} of ${fmtBytes(up.total)}`;
    if (rate > 0 && up.loaded > 0) detail += ` · ${fmtBytes(rate)}/s · ${fmtLeft((up.total - up.loaded) / rate)}`;
  }

  return (
    <div className={"upx " + className}>
      <style>{CSS}</style>
      <div className="upx-head">
        <span className="upx-label">{saving ? "Saving…" : up!.label}</span>
        {!moving && <span className="upx-pct">{pct}%</span>}
      </div>
      <div
        className={"upx-track" + (moving ? " is-saving" : "")}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={moving ? undefined : pct}
      >
        {/* new element per mode, so it never animates from one mode's width to the other */}
        <div key={moving ? "moving" : "count"} className="upx-bar" style={moving ? undefined : { width: `${pct}%` }} />
      </div>
      {detail && <div className="upx-detail">{detail}</div>}
    </div>
  );
}

const CSS = `
.upx { margin: 0 0 14px; }
.upx-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px; font-size: 13px; }
.upx-label { font-weight: 600; color: #334155; }
.upx-pct { font-weight: 700; color: var(--ad-brand); font-variant-numeric: tabular-nums; }
.upx-track { position: relative; height: 10px; border-radius: 999px; overflow: hidden; background: rgba(var(--ad-brand-rgb), 0.12); }
.upx-bar {
  position: absolute; top: 0; bottom: 0; left: 0; width: 0; border-radius: inherit;
  transition: width 0.35s linear;
  background-color: var(--ad-brand);
  background-image: linear-gradient(45deg, rgba(255,255,255,.18) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.18) 50%, rgba(255,255,255,.18) 75%, transparent 75%, transparent);
  background-size: 16px 16px;
  animation: upx-stripes 0.8s linear infinite;
}
.upx-track.is-saving .upx-bar { width: 35%; transition: none; animation: upx-slide 1.3s ease-in-out infinite; }
.upx-detail { margin-top: 5px; font-size: 12px; color: #64748b; font-variant-numeric: tabular-nums; }
.panel-dark .upx-label { color: #e2e8f0; }
.panel-dark .upx-detail { color: #94a3b8; }
@keyframes upx-stripes { from { background-position: 16px 0; } to { background-position: 0 0; } }
@keyframes upx-slide { 0% { left: -35%; } 100% { left: 100%; } }
@media (prefers-reduced-motion: reduce) {
  .upx-bar { animation: none; transition: none; }
  .upx-track.is-saving .upx-bar { left: 0; width: 100%; opacity: .55; }
}
`;
