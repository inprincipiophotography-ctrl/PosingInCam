// Draw real Shoot Cards with the site's own renderer (assets/builder.js) and
// save them as PNGs in video/public/cards/. Same sample data as the /demo page,
// so the video shows exactly what the studio makes.
//   node scripts/render-cards.mjs
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = join(here, "..", "public", "cards");
mkdirSync(out, { recursive: true });

const CARDS = {
  timeline: {
    type: "timeline",
    data: { label: "Emma & James · Saturday", rows: [
      { time: "14:00", text: "Getting ready" }, { time: "15:30", text: "First look" },
      { time: "16:30", text: "Ceremony" }, { time: "17:15", text: "Family groups" },
      { time: "19:30", text: "Golden hour portraits" }, { time: "21:00", text: "First dance" }] },
  },
  groups: {
    type: "groups",
    data: { label: "After the ceremony", rows: [
      { names: "Emma & James + Grandma Rose", rel: "her grandma, seated" }, { names: "+ Sarah & David", rel: "her parents" },
      { names: "+ Lucy & Tom", rel: "her siblings" }, { names: "Emma & James + Helen & Mark", rel: "his parents" },
      { names: "+ Oliver", rel: "his brother" }, { names: "Everyone, both families", rel: "big group last" }] },
  },
  shotlist: {
    type: "shotlist",
    data: { label: "Must-haves", rows: [
      { text: "Rings on the invitation" }, { text: "Dad seeing her first" },
      { text: "Grandma's brooch, close" }, { text: "Confetti exit, wide" },
      { text: "Sparklers, both sides" }, { text: "Cake cut, from behind" }] },
  },
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium",
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=Noto+Serif:ital,wdth,wght@0,87.5,600;1,87.5,400&display=swap" rel="stylesheet" />
  </head><body></body></html>`, { waitUntil: "networkidle" });
await page.addScriptTag({ path: join(root, "assets", "builder.js") });

for (const [name, { type, data }] of Object.entries(CARDS)) {
  const b64 = await page.evaluate(async ({ type, data }) => {
    await window.CardRenderer.ensureFonts(data);
    const c = document.createElement("canvas");
    window.CardRenderer.draw(c, type, data, 0);
    return c.toDataURL("image/png").split(",")[1];
  }, { type, data });
  writeFileSync(join(out, `${name}.png`), Buffer.from(b64, "base64"));
  console.log(`✓ public/cards/${name}.png`);
}

const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
console.log("fonts loaded:", [...new Set(fonts)].join(", ") || "NONE (fallback!)");
await browser.close();
