import React from "react";
import { Composition } from "remotion";
import { AD_SECONDS, AdA, AdB, AdC } from "./Ads";
import { LAUNCH_SECONDS, Launch } from "./Launch";
import { AD_A2_SECONDS, AdA2 } from "./v2/AdA2";
import { HOOK_SECONDS, Hook1, Hook2, Hook3 } from "./v2/Hooks";
import { AD_POV_SECONDS, AdPov } from "./v3/AdPov";
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
    {/* Hook prototypes for Ad A: pick one, then the ad is rebuilt around it. */}
    {[Hook1, Hook2, Hook3].map((Hook, i) => (
      <Composition key={i} id={`Hook${i + 1}-9x16`} component={Hook} durationInFrames={HOOK_SECONDS * 30} fps={30} width={1080} height={1920} />
    ))}
  </>
);
