// Step 2 of the certificate rebrand (see certificates.py): lays the Rivira Tech
// mark and name over the cleaned bases and writes public/certicates/*.png.
//   node design/artwork/certificates.cjs        (RENDER_TO=<dir> to preview)
const fs = require("fs");
const path = require("path");
const puppeteer = require(process.env.PUPPETEER_PATH || "puppeteer-core");

const ROOT = path.resolve(__dirname, "..", "..");
const BASE = path.join(__dirname, "cert-base");
const layout = JSON.parse(fs.readFileSync(path.join(BASE, "layout.json"), "utf8"));
const mark = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "assets", "rivira-mark.png")).toString("base64");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NAVY = "#0F1F4D";

function overlay({ box: [x0, y0, x1, y1], overlay }) {
  const w = x1 - x0, h = y1 - y0;
  const at = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px`;
  switch (overlay) {
    case "lockup":
      return `<div class="o" style="${at};flex-direction:column;align-items:flex-start;justify-content:center;padding-left:10px">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="${mark}" style="height:76px">
          <div style="line-height:.95"><div class="sans" style="font-size:36px;font-weight:800;color:${NAVY};letter-spacing:-.5px">RIVIRA</div>
          <div class="sans" style="font-size:24px;font-weight:700;color:${NAVY};letter-spacing:7px;opacity:.85">TECH</div></div>
        </div>
        <div class="sans" style="margin-top:10px;font-size:17px;font-weight:700;color:#1F5FAF">Learn. Build. Lead With AI</div></div>`;
    case "lockup-center":
      return `<div class="o" style="${at};gap:14px">
          <img src="${mark}" style="height:96px">
          <div style="line-height:.95"><div class="round" style="font-size:52px;font-weight:900;color:${NAVY}">RIVIRA</div>
          <div class="round" style="font-size:32px;font-weight:800;color:#1F5FAF;letter-spacing:9px">TECH</div></div></div>`;
    case "header":
      return `<div class="o geo" style="${at};font-size:25px;font-weight:600;color:${NAVY};letter-spacing:.42em;padding-left:.42em">RIVIRA TECH</div>`;
    case "director-serif":
      return `<div class="o serif" style="${at};font-size:19px;color:${NAVY};letter-spacing:.06em">RIVIRA TECH</div>`;
    case "director-sans":
      return `<div class="o round" style="${at};font-size:21px;font-weight:600;color:${NAVY}">Rivira Tech</div>`;
    case "mini-mark":
      return `<div class="o" style="${at}"><div style="width:${Math.round(w * .82)}px;height:${Math.round(h * .74)}px;border-radius:10px;background:#fff;
        box-shadow:0 0 0 3px #1F3E7A;display:flex;align-items:center;justify-content:center"><img src="${mark}" style="width:82%"></div></div>`;
  }
  return "";
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 1024, deviceScaleFactor: 1 });
  for (const [name, regions] of Object.entries(layout)) {
    const base = "data:image/png;base64," + fs.readFileSync(path.join(BASE, name)).toString("base64");
    await page.setContent(`<!doctype html><html><head>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600&family=Libre+Baskerville&family=Nunito:wght@600;800;900&family=Plus+Jakarta+Sans:wght@700;800&display=block">
      <style>html,body{margin:0}.o{position:absolute;display:flex;align-items:center;justify-content:center;white-space:nowrap}
      .sans{font-family:'Plus Jakarta Sans',Arial,sans-serif}.geo{font-family:Montserrat,Arial,sans-serif}
      .serif{font-family:'Libre Baskerville',Georgia,serif}.round{font-family:Nunito,Arial,sans-serif}</style></head>
      <body><div style="position:relative;width:1536px;height:1024px"><img src="${base}" style="display:block">${regions.map(overlay).join("")}</div></body></html>`,
      { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]));
    const out = path.join(process.env.RENDER_TO || path.join(ROOT, "public", "certicates"), name);
    await page.screenshot({ path: out, type: "png", clip: { x: 0, y: 0, width: 1536, height: 1024 } });
    console.log("wrote", out);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
