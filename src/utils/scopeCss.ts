/* Confine admin-written CSS to one element: every selector is prefixed with
   `scope`, so "p { color: red }" becomes ".mq-123 p { color: red }" and can't
   restyle the rest of the site. :root / html / body / & become the scope itself.
   @media / @supports / @container / @layer are scoped inside; @keyframes and
   @font-face are kept as written; @import and other at-rules are dropped. */

const NESTING = /^@(media|supports|container|layer)\b/i;
const KEEP = /^@(-webkit-)?(keyframes|font-face)\b/i;

// Split "a, b:is(c, d)" on top-level commas only.
function splitSelectors(sel: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
    else if (c === "," && depth === 0) { out.push(sel.slice(start, i)); start = i + 1; }
  }
  out.push(sel.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function scopeSelector(sel: string, scope: string): string {
  const root = sel.match(/^(:root|html|body|&)(?![\w-])/i);
  if (root) {
    const rest = sel.slice(root[0].length).trim();
    return rest ? `${scope} ${rest.replace(/^(body|html)(?![\w-])/i, "").trim()}`.trim() : scope;
  }
  return `${scope} ${sel}`;
}

function scopeBlock(css: string, scope: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i);
    const semi = css.indexOf(";", i);
    if (brace === -1) break;
    if (semi !== -1 && semi < brace) { i = semi + 1; continue; } // stray "a: b;" or @charset
    const prelude = css.slice(i, brace).trim();
    // find the matching "}"
    let depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    if (NESTING.test(prelude)) out += `${prelude}{${scopeBlock(body, scope)}}`;
    else if (KEEP.test(prelude)) out += `${prelude}{${body}}`;
    else if (!prelude.startsWith("@") && prelude) {
      out += `${splitSelectors(prelude).map((s) => scopeSelector(s, scope)).join(",")}{${body}}`;
    }
    i = j;
  }
  return out;
}

export function scopeCss(css: string, scope: string): string {
  if (!css) return "";
  const clean = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<\s*\/?\s*style[^>]*>/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(|(javascript|vbscript)\s*:|-moz-binding|behavior\s*:/gi, "");
  return scopeBlock(clean, scope);
}
