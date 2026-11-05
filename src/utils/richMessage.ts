import { sanitizeHtml } from "./sanitizeHtml";
import { scopeCss } from "./scopeCss";

/* Admin-written HTML that may carry its own <style> blocks (a custom form's
   success message). The HTML is cleaned with sanitizeHtml, keeping class and
   style attributes; the CSS is confined to `scope`, so its rules only reach the
   message. Plain text comes through as it is. The API cleans it on save as well
   (api/security/markup-clean.js). */
export function richMessage(src: string, scope: string): { html: string; css: string } {
  const sheets: string[] = [];
  const html = String(src || "").replace(/<\s*style\b[^>]*>([\s\S]*?)<\s*\/\s*style\s*>/gi, (_m, css: string) => {
    sheets.push(css);
    return "";
  });
  return {
    html: sanitizeHtml(html, { keepClassStyle: true }),
    css: sheets.length ? scopeCss(sheets.join("\n"), scope) : "",
  };
}
