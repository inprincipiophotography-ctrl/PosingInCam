// Render the Instagram carousels: every Carousel* still → renders/carousel/<concept>-<ratio>/NN.jpg, plus a contact
// sheet per set (scripts/carousel-sheet.py).
//   node scripts/carousel.mjs [A|B|C]
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const browserExecutable = process.env.REMOTION_CHROME || null;
const only = process.argv[2];
const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), publicDir: join(root, "public") });
const comps = (await getCompositions(serveUrl, { browserExecutable })).filter((c) => c.id.startsWith(`Carousel${only ?? ""}`));
const sets = new Set();
for (const composition of comps) {
  const [, set, n] = composition.id.match(/^Carousel([ABC]-\dx\d)-(\d+)$/);
  const dir = join(root, "renders", "carousel", set);
  mkdirSync(dir, { recursive: true });
  await renderStill({ serveUrl, composition, output: join(dir, `${n}.jpg`), imageFormat: "jpeg", jpegQuality: 95, browserExecutable, overwrite: true });
  sets.add(dir);
}
for (const dir of sets) execFileSync("python3", [join(root, "scripts", "carousel-sheet.py"), dir], { stdio: "inherit" });
console.log(`✓ ${comps.length} slides → renders/carousel/`);
