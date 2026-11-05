// Renders design/artwork/svg/*.svg (see manifest.json) into the files the site
// serves, with headless Chrome so fonts and filters match the browser.
//   node design/artwork/render.cjs [scene-name ...]
// RENDER_TO=<dir> writes into that folder instead of public/ (for previews).
// Needs puppeteer-core (npm i -D puppeteer-core) and a local Chrome; set CHROME_PATH if not the default.
const fs = require("fs");
const path = require("path");
const puppeteer = require(process.env.PUPPETEER_PATH || "puppeteer-core");

const ROOT = path.resolve(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
const only = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  for (const s of manifest) {
    if (only.length && !only.includes(s.name)) continue;
    const svg = fs.readFileSync(path.join(ROOT, s.svg), "utf8");
    const [ow, oh] = s.size;
    const scale = ow / s.w;
    await page.setViewport({ width: ow, height: oh, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=block">
       <style>html,body{margin:0;background:transparent}svg{display:block;width:${ow}px;height:${oh}px}</style></head>
       <body>${svg.replace("<svg ", `<svg preserveAspectRatio="none" `)}</body></html>`,
      { waitUntil: "load", timeout: 60000 },
    );
    // fonts come from Google Fonts: wait for them, but never hang on a slow network
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]));
    const out = process.env.RENDER_TO ? path.join(process.env.RENDER_TO, path.basename(s.out)) : path.join(ROOT, s.out);
    const type = s.fmt === "jpeg" ? "jpeg" : s.fmt;
    await page.screenshot({
      path: out,
      type,
      ...(type !== "png" ? { quality: s.quality } : {}),
      omitBackground: !!s.transparent || type === "png",
      clip: { x: 0, y: 0, width: ow, height: oh },
    });
    console.log(`${s.name} -> ${s.out} (${ow}x${oh}${scale !== 1 ? `, drawn at ${s.w}x${s.h}` : ""})`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
