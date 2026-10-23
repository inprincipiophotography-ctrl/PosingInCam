// Render every composition (or the ones named) to out/<id>.mp4: H.264, yuv420p, CRF 16.
//   node scripts/render-all.mjs [compositionId…]
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const browserExecutable = process.env.REMOTION_CHROME || null;
const only = process.argv.slice(2);

const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), publicDir: join(root, "public") });
const comps = await getCompositions(serveUrl, { browserExecutable });

for (const composition of comps) {
  if (only.length && !only.includes(composition.id)) continue;
  const outputLocation = join(root, "out", `${composition.id}.mp4`);
  const started = Date.now();
  let last = -1;
  await renderMedia({
    serveUrl, composition, outputLocation, browserExecutable,
    codec: "h264", crf: 16, pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "jpeg", jpegQuality: 95, overwrite: true,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) { last = pct; process.stdout.write(`  ${composition.id} ${pct}%\n`); }
    },
  });
  console.log(`✓ out/${composition.id}.mp4 (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
