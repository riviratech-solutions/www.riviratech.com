/**
 * Opens a link someone typed into the panel (a class's zoom link, a recorded-
 * video link) in a new tab — only when it is a web link. window.open() runs a
 * "javascript:" link on this site, as whoever clicked it, so anything that isn't
 * http(s) is refused. A bare "zoom.us/j/…" gets https:// in front.
 * Returns false (and opens nothing) for anything else.
 */
export function openWebLink(url: unknown): boolean {
  const u = String(url ?? "").trim();
  let href = "";
  if (/^https?:\/\/\S+$/i.test(u)) href = u;
  else if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) href = "https://" + u;
  if (!href) return false;
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}
