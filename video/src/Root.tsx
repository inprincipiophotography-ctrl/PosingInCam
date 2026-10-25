import React from "react";
import { Composition, Still } from "remotion";
import { AD_SECONDS, AdA, AdB, AdC } from "./Ads";
import { LAUNCH_SECONDS, Launch } from "./Launch";
import { AD_A2_SECONDS, AdA2 } from "./v2/AdA2";
import { HOOK_SECONDS, Hook1, Hook2, Hook3 } from "./v2/Hooks";
import { AD_POV_SECONDS, AdPov } from "./v3/AdPov";
import { AD_A4_SECONDS, AdA4 } from "./v4/AdA4";
import { CardPreview } from "./v4/Preview";
import { AD_A5_SECONDS, AdA5 } from "./v5/AdA5";
import { AD_A6_SECONDS, AdA6 } from "./v6/AdA6";
import { AD_A7_SECONDS, AdA7 } from "./v7/AdA7";
import { AD_A8_SECONDS, AdA8 } from "./v8/AdA8";
import { SLIDES_A } from "./carousel/ConceptA";
import { SLIDES_B } from "./carousel/ConceptB";
import { SLIDES_C } from "./carousel/ConceptC";
import "./theme";

const FORMATS = {
  "16x9": { width: 1920, height: 1080 },
  "9x16": { width: 1080, height: 1920 },
  "4x5": { width: 1080, height: 1350 },
};

// Launch master at 60 fps (launch-motion spec); Meta ads at 30 fps.
const VIDEOS = [
  { id: "Launch", component: Launch, seconds: LAUNCH_SECONDS, fps: 60, formats: ["16x9", "9x16", "4x5"] },
  { id: "AdA", component: AdA, seconds: AD_SECONDS, fps: 30, formats: ["9x16", "4x5"] },
  { id: "AdB", component: AdB, seconds: AD_SECONDS, fps: 30, formats: ["9x16", "4x5"] },
  { id: "AdC", component: AdC, seconds: AD_SECONDS, fps: 30, formats: ["9x16", "4x5"] },
] as const;

export const Root: React.FC = () => (
  <>
    {VIDEOS.flatMap((v) =>
      v.formats.map((fmt) => (
        <Composition
          key={`${v.id}-${fmt}`}
          id={`${v.id}-${fmt}`}
          component={v.component}
          durationInFrames={v.seconds * v.fps}
          fps={v.fps}
          {...FORMATS[fmt]}
          defaultProps={{ guides: false }}
        />
      )),
    )}
    {/* Ad A v2: rebuilt on the Relay motion rules, with its own music (scripts/music.py). */}
    <Composition id="AdA2-9x16" component={AdA2} durationInFrames={AD_A2_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ guides: false }} />
    {/* Ad POV (Ad A v3): built on hook 1, Reels-native captions, its own music. */}
    <Composition id="AdPOV-9x16" component={AdPov} durationInFrames={AD_POV_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ guides: false }} />
    {/* Ad A v4: the card as vector UI, one rhythm, an end card for Meta's own button. */}
    <Composition id="AdA4-9x16" component={AdA4} durationInFrames={AD_A4_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ guides: false }} />
    <Composition id="AdA6-9x16" component={AdA6} durationInFrames={AD_A6_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ guides: false }} />
    <Composition id="AdA8-9x16" component={AdA8} durationInFrames={AD_A8_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ guides: false }} />
    {/* Instagram carousel: concept A (value first), B (direct sale) and C (the whole wedding day), 3:4 for the feed and 4:5 for ads. */}
    {(
      [
        ["A", SLIDES_A],
        ["B", SLIDES_B],
        ["C", SLIDES_C],
      ] as const
    ).flatMap(([c, slides]) =>
      ([["3x4", 1440], ["4x5", 1350]] as const).flatMap(([r, h]) =>
        slides.map((S, i) => <Still key={`${c}${r}${i}`} id={`Carousel${c}-${r}-${String(i + 1).padStart(2, "0")}`} component={S} width={1080} height={h} />),
      ),
    )}
    <Composition id="AdA7-H1-9x16" component={AdA7} durationInFrames={AD_A7_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ hook: "H1" as const, guides: false }} />
    <Composition id="AdA7-H2-9x16" component={AdA7} durationInFrames={AD_A7_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ hook: "H2" as const, guides: false }} />
    <Composition id="AdA7-H3-9x16" component={AdA7} durationInFrames={AD_A7_SECONDS * 30} fps={30} width={1080} height={1920} defaultProps={{ hook: "H3" as const, guides: false }} />
    <Composition id="AdA5-9x16" component={AdA5} durationInFrames={Math.round(AD_A5_SECONDS * 30)} fps={30} width={1080} height={1920} defaultProps={{ guides: false }} />
    {/* The vector pose card at its native size, to compare with the real card. */}
    <Composition id="CardPreview" component={CardPreview} durationInFrames={1} fps={30} width={1280} height={1920} />
    {/* Hook prototypes for Ad A: pick one, then the ad is rebuilt around it. */}
    {[Hook1, Hook2, Hook3].map((Hook, i) => (
      <Composition key={i} id={`Hook${i + 1}-9x16`} component={Hook} durationInFrames={HOOK_SECONDS * 30} fps={30} width={1080} height={1920} />
    ))}
  </>
);
