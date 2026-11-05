/**
 * First-pass cleaning of admin-written HTML / CSS before it is stored (marquee
 * messages, custom-form success messages). The browser cleans it again when it
 * shows it (src/utils/sanitizeHtml.ts, src/utils/scopeCss.ts); this pass keeps
 * scripts and the obvious tricks out of the database.
 */

/* Elements that can run or load something, event handlers, and script / data
   URLs in href / src. */
function cleanHtml(html) {
    return String(html || "")
        .slice(0, 20000)
        .replace(/<\s*(script|style|iframe|object|embed|form|link|meta|base|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
        .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|link|meta|base|svg|math)\b[^>]*>/gi, "")
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\b(href|src)\s*=\s*(["'])\s*(javascript|vbscript|data:text)[^"']*\2/gi, '$1="#"');
}

/* A style sheet without imports, script URLs or old IE / Firefox binding tricks,
   and without a closing </style> that could end the sheet early. */
function cleanCss(css) {
    return String(css || "")
        .slice(0, 20000)
        .replace(/<\s*\/?\s*style[^>]*>/gi, "")
        .replace(/@import[^;]*;?/gi, "")
        .replace(/expression\s*\(/gi, "")
        .replace(/(javascript|vbscript)\s*:/gi, "")
        .replace(/-moz-binding|behavior\s*:/gi, "");
}

/* HTML that may carry its own <style> blocks (e.g. a form's success message):
   the CSS is cleaned as CSS and kept as one <style> block in front; the rest is
   cleaned as HTML. */
function cleanHtmlWithStyle(src) {
    const sheets = [];
    const html = String(src || "")
        .slice(0, 20000)
        .replace(/<\s*style\b[^>]*>([\s\S]*?)<\s*\/\s*style\s*>/gi, (m, css) => {
            sheets.push(cleanCss(css));
            return "";
        });
    const css = sheets.join("\n").trim();
    return (css ? `<style>${css}</style>` : "") + cleanHtml(html);
}

module.exports = { cleanHtml, cleanCss, cleanHtmlWithStyle };
