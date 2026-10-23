// Review stills: key frames of every composition, plus one contact sheet per video.
//   node scripts/stills.mjs [compositionId…]
// 9:16 stills carry the Reels safe-zone overlay (blue = covered by Instagram's UI).
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const browserExecutable = process.env.REMOTION_CHROME || null;

const TIMES = {
  Launch: [1.0, 3.0, 5.5, 8.5, 11.5, 14.5, 17.5, 20.3, 22.6, 24.2, 26.0, 29.5],
  Ad: [0.8, 2.8, 4.5, 6.5, 8.8, 9.8, 11.0, 12.8],
};

const only = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), publicDir: join(root, "public") });
const comps = await getCompositions(serveUrl, { browserExecutable });

for (const comp of comps) {
  if (only.length && !only.includes(comp.id)) continue;
  const times = comp.id.startsWith("Launch") ? TIMES.Launch : TIMES.Ad;
  const dir = join(root, "out", "stills", comp.id);
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const [i, t] of times.entries()) {
    const output = join(dir, `${String(i).padStart(2, "0")}-${t.toFixed(1)}s.jpg`);
    await renderStill({
      serveUrl, output, browserExecutable, imageFormat: "jpeg", jpegQuality: 88,
      composition: { ...comp, props: { ...comp.props, guides: comp.height / comp.width > 1.5 } },
      frame: Math.min(comp.durationInFrames - 1, Math.round(t * comp.fps)),
    });
    files.push(output);
  }
  const cols = comp.width > comp.height ? 3 : 4;
  const sheet = join(root, "out", "stills", `${comp.id}.jpg`);
  const w = comp.width > comp.height ? 640 : 400;
  execFileSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex",
    files.map((_, i) => `[${i}]scale=${w}:-2[s${i}]`).join(";") + ";" + files.map((_, i) => `[s${i}]`).join("") +
    `xstack=inputs=${files.length}:layout=` + files.map((_, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = c === 0 ? "0" : Array(c).fill("w0").join("+");
      const y = r === 0 ? "0" : Array(r).fill("h0").join("+");
      return `${x}_${y}`;
    }).join("|") + `:fill=white`, sheet]);
  console.log(`✓ ${comp.id}: ${files.length} stills → out/stills/${comp.id}.jpg`);
}
