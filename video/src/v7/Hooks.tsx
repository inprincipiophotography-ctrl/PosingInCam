import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Shot } from "../components/Shot";
import { SHOOT } from "../config";
import { Grade } from "../v2/Grade";
import { CAMERA } from "../v2/motion";
import { BoxCaption } from "../v4/BoxCaption";
import { Bottom, Punch, Top, clamp } from "./frame";
import TL from "./timeline.json";

// The three openings of Ad A v7 (0–3 s) and the scene each hands over to (3–5 s), for a Meta A/B test on one body.
//   H1 pain:  the couple waits, the frame goes blank          → the answer in the camera
//   H2 phone: the couple waits, "still checking your phone?"   → the answer in the camera
//   H3 POV:   v4's hook, the card on the camera in her hands   → the couple in the pose (v4)
export type HookId = "H1" | "H2" | "H3";

const HOOK_LEN = TL.hook.to - TL.hook.from;
const SECOND_LEN = TL.second.to - TL.second.from;

/** The couple, waiting: the sharp end of the take in slow motion, wide, the photographer's shoulder in the dark bottom. */
const CoupleShot: React.FC<{ len: number; rate: number; blankAt?: number }> = ({ len, rate, blankAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // "Your mind goes blank": the picture washes out and loses focus, and stays that way until the cut.
  const b = blankAt == null ? 0 : interpolate(frame / fps, [blankAt, blankAt + 0.5], [0, 1], { ...clamp, easing: CAMERA });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: `blur(${b * 14}px) saturate(${1 - b * 0.8}) brightness(${1 + b * 0.35})`, transform: `scale(${1 + b * 0.03})` }}>
        <Shot
          kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={TL.couple.source} playbackRate={rate}
          views={[{ t: 0, x: 0.5, y: 0.47, zoom: 1.12 }, { t: len, x: 0.5, y: 0.47, zoom: 1.18 }]}
        />
      </AbsoluteFill>
      <Grade top={0.2} bottom={0.75} vignette={0.3} grain={0} />
    </AbsoluteFill>
  );
};

/** The camera in her hands, the pose card on its screen, framed so the screen sits in the middle of the safe area. */
const CameraShot: React.FC<{ len: number }> = ({ len }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={0.2} views={[
        // The camera drifts left in her hands over the take: the frame follows its screen (tracked off the card's red bar).
        { t: 0, x: 0.57, y: 0.6, zoom: 1.04 },
        { t: 0.8, x: 0.525, y: 0.6, zoom: 1.07 },
        { t: 1.2, x: 0.52, y: 0.6, zoom: 1.08 },
        { t: 1.6, x: 0.475, y: 0.6, zoom: 1.1 },
        { t: len, x: 0.45, y: 0.6, zoom: 1.12 },
      ]} />
    <Grade top={0.3} vignette={0.3} grain={0} />
  </AbsoluteFill>
);

const H1: React.FC = () => (
  <AbsoluteFill>
    <CoupleShot len={HOOK_LEN} rate={TL.couple.rate} blankAt={TL.hook.blank} />
    <Bottom lines={2}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
        {/* A beat early, so the first frame already reads. */}
        <BoxCaption lines={["Your couple is waiting."]} at={-0.45} outAt={HOOK_LEN - 0.2} size={84} />
        <BoxCaption lines={["Your mind goes [blank]."]} at={TL.hook.blank - 0.1} outAt={HOOK_LEN - 0.2} size={84} />
      </div>
    </Bottom>
  </AbsoluteFill>
);

const H2: React.FC = () => (
  <AbsoluteFill>
    <CoupleShot len={HOOK_LEN} rate={TL.couple.rate} />
    <Bottom lines={2}>
      <BoxCaption lines={["Still checking your [phone]", "in front of the couple?"]} at={-0.45} outAt={HOOK_LEN - 0.2} size={84} />
    </Bottom>
  </AbsoluteFill>
);

const H3: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={0.2} views={[{ t: 0, x: 0.55, y: 0.52, zoom: 1.0 }, { t: 3, x: 0.53, y: 0.54, zoom: 1.1 }]} />
    <Grade top={0.3} vignette={0.3} grain={0} />
    <Top>
      <BoxCaption lines={["POV: your camera", "tells you the", "[next pose.]"]} at={-0.45} outAt={HOOK_LEN - 0.2} size={92} />
    </Top>
  </AbsoluteFill>
);

export const HOOKS: Record<HookId, React.FC> = { H1, H2, H3 };

/** 3–5 s: after a couple hook, the answer (the camera); after the POV hook, the couple in the pose (as in v4). */
export const Second: React.FC<{ hook: HookId }> = ({ hook }) =>
  hook === "H3" ? (
    <Punch>
      <CoupleShot len={SECOND_LEN} rate={0.55} />
      <Bottom>
        <BoxCaption lines={["Glance. Pose. [Shoot.]"]} at={0.1} outAt={SECOND_LEN - 0.2} size={92} />
      </Bottom>
    </Punch>
  ) : (
    <Punch>
      <CameraShot len={SECOND_LEN} />
      <Top>
        <BoxCaption lines={["Not on your phone.", "In your [camera]."]} at={0.05} outAt={SECOND_LEN - 0.2} size={84} />
      </Top>
    </Punch>
  );
