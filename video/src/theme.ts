import { loadFont } from "@remotion/fonts";
import { Easing, cancelRender, continueRender, delayRender, interpolate, spring, staticFile } from "remotion";

// NotaLucis look (assets/styles.css on the site): light, one red accent, Inter + Instrument Serif.
export const C = {
  bg: "#fbfbfd",
  surface: "#ffffff",
  ink: "#1d1d1f",
  ink2: "#424245",
  muted: "#6e6e73",
  accent: "#a40000",
  accentStrong: "#7e0000",
  accentBright: "#c01818",
  rule: "#d8d8dc",
  dot: "rgba(29, 29, 31, 0.09)",
  body: "#141416",
};

export const SANS = "Inter";
export const SERIF = "Instrument Serif";
// The pose cards' own title face (builder.js: Noto Serif, 87.5 % width), for the vector card.
export const CARD_SERIF = "Noto Serif Condensed";

// Local font files (public/fonts) so a render never falls back to Times New Roman.
// Remotion holds the first frame until these resolve.
export const fontsReady = Promise.all([
  loadFont({ family: SANS, url: staticFile("fonts/Inter-latin.woff2"), weight: "100 900" }),
  loadFont({ family: SERIF, url: staticFile("fonts/InstrumentSerif-latin.woff2"), weight: "400" }),
  loadFont({ family: SERIF, url: staticFile("fonts/InstrumentSerif-italic-latin.woff2"), weight: "400", style: "italic" }),
  loadFont({ family: CARD_SERIF, url: staticFile("fonts/NotoSerifCondensed-600-latin.woff2"), weight: "600" }),
  loadFont({ family: CARD_SERIF, url: staticFile("fonts/NotoSerifCondensed-italic-latin.woff2"), weight: "400", style: "italic" }),
]);

// No silent fallback: if a brand face did not load, stop the render with a message that says which.
const fontCheck = delayRender("Checking brand fonts");
fontsReady
  .then(() => {
    const missing = [`400 100px "${SANS}"`, `600 100px "${SANS}"`, `400 100px "${SERIF}"`, `italic 400 100px "${SERIF}"`, `600 100px "${CARD_SERIF}"`, `italic 400 100px "${CARD_SERIF}"`].filter((f) => !document.fonts.check(f));
    if (missing.length) throw new Error(`Brand font not available: ${missing.join(", ")}. Check video/public/fonts/.`);
    continueRender(fontCheck);
  })
  .catch((err) => cancelRender(err));

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const EASE = {
  inOut: Easing.bezier(0.65, 0, 0.35, 1), // camera moves: easy ease
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0), // exits
};

// Seconds → frames at the composition's fps.
export const f = (sec: number, fps: number) => Math.round(sec * fps);

/** Entrance 0 → 1 over ~0.5 s with a slight overshoot (spring, damping 14). */
export function pop(frame: number, fps: number, atSec: number, durSec = 0.5) {
  return spring({
    frame: frame - f(atSec, fps),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.9 },
    durationInFrames: f(durSec, fps),
  });
}

/** Exit 0 → 1, faster than the entrance (~60 %), ease-in. */
export function leave(frame: number, fps: number, atSec: number, durSec = 0.3) {
  return interpolate(frame, [f(atSec, fps), f(atSec + durSec, fps)], [0, 1], { ...clamp, easing: EASE.in });
}

/** Eased 0 → 1 between two times (camera moves, wipes). */
export function ease(frame: number, fps: number, fromSec: number, toSec: number, easing = EASE.inOut) {
  return interpolate(frame, [f(fromSec, fps), f(toSec, fps)], [0, 1], { ...clamp, easing });
}

/** Click press: scale 1 → 0.96 → 1 over ~8 frames at 60 fps. */
export function press(frame: number, fps: number, atSec: number) {
  const s = f(atSec, fps);
  const d = Math.max(2, Math.round(fps * 0.065));
  return interpolate(frame, [s, s + d, s + 2 * d], [1, 0.96, 1], clamp);
}

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
