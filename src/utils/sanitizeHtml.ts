/**
 * Allowlist sanitiser for stored HTML (blog bodies, job descriptions, event
 * copy). Everything the admin editors save is rendered through
 * dangerouslySetInnerHTML, so a script that reaches the database would run on
 * the public site and on admin pages (security audit F9).
 *
 * Only known-safe tags survive; unknown wrappers are unwrapped so their text is
 * kept; script/style/iframe-style elements are dropped whole, because unwrapping
 * them would spill their source into the page as visible prose. Attributes are
 * allowlisted per tag, every on* handler is removed, and URLs are checked.
 *
 * This is the last line, not the only one: content should also be cleaned when
 * it is saved. Needs a DOM, so it returns "" during server-side rendering.
 */
const ALLOWED = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "strong", "b", "em", "i", "u", "s", "sup", "sub", "mark",
  "a", "img", "figure", "figcaption", "span", "div",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
]);

const DROP = new Set([
  "script", "style", "iframe", "object", "embed", "noscript",
  "form", "input", "button", "select", "textarea", "link", "meta", "svg", "math",
]);

const ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
};

/* Browsers ignore tabs, newlines and other control characters inside a URL's
   scheme ("java\tscript:" runs as "javascript:"), so the check looks at the URL
   with all of them taken out. */
const URL_NOISE = /[\u0000-\u0020\u007f-\u009f]/g;

/** Blocks javascript:/vbscript:/file: and data: URLs other than inline images. */
export function safeUrl(v: string): boolean {
  const u = v.replace(URL_NOISE, "").toLowerCase();
  if (u.startsWith("data:")) return u.startsWith("data:image/");
  return !/^(javascript|vbscript|file):/.test(u);
}

/* safeMarkup: for markup admins build that must keep its own structure —
   custom pages, event copy with icon markup. Unlike sanitizeHtml it is not an
   allowlist: every tag, class, style, svg and embed stays, but whatever can run
   script goes — script / object / embed / base / meta elements, on* handlers,
   srcdoc, and javascript: / vbscript: / non-image data: URLs in any attribute.
   Parsed in a <template>, so nothing in it loads or runs while it's cleaned. */
const SCRIPT_TAGS = "script, object, embed, applet, base, meta, frame, frameset, portal";
const URL_ATTRS = new Set([
  "href", "src", "xlink:href", "action", "formaction", "data", "poster",
  "background", "ping", "lowsrc", "dynsrc", "codebase", "cite", "longdesc",
]);

export function safeMarkup(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll(SCRIPT_TAGS).forEach((el) => el.remove());

  for (const el of Array.from(tpl.content.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const plain = attr.value.replace(URL_NOISE, "").toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        (URL_ATTRS.has(name) && !safeUrl(attr.value)) ||
        // e.g. <svg><set attributeName="href" to="javascript:…">
        /(java|vb)script:/.test(plain)
      ) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName.toLowerCase() === "a" && el.getAttribute("target") === "_blank") {
      el.setAttribute("rel", "noopener noreferrer");
    }
  }

  return tpl.innerHTML;
}

/* opts.keepClassStyle: also keep class and style attributes on allowed tags
   (style values without url()/expression()), so admin-written CSS can target
   the markup — used for marquee messages. Off for everything else. */
export function sanitizeHtml(html: string, opts: { keepClassStyle?: boolean } = {}): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = el.tagName.toLowerCase();

    if (DROP.has(tag)) {
      el.remove();
      continue;
    }
    if (!ALLOWED.has(tag)) {
      // Unknown but harmless wrapper — keep the text, lose the element.
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const allowed = ATTRS[tag];
      if (opts.keepClassStyle && !name.startsWith("on") && (name === "class" || name === "style")) {
        if (name === "style" && /url\s*\(|expression\s*\(|javascript:|-moz-binding|behavior\s*:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
        continue;
      }
      // on* handlers are the main inline-script vector and are never allowed.
      if (name.startsWith("on") || !allowed || !allowed.has(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && !safeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === "a" && el.getAttribute("target") === "_blank") {
      // Without this an opened tab can reach back through window.opener.
      el.setAttribute("rel", "noopener noreferrer");
    }
  }

  return doc.body.innerHTML;
}
