import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage } from "../components/Footage";
import { Shot } from "../components/Shot";
import { PHOTOS, SHOOT, type CameraPhoto } from "../config";
import { useLayout } from "../layout";
import { SANS } from "../theme";
import { Grade } from "./Grade";
import { Caption, RED } from "../v3/Caption";
import { enter, move } from "./motion";

// Three 3-second hook prototypes for Ad A: the product on screen from frame 0, the line readable inside a second.
const FULL = { w: 4538, h: 6051 };
const FIRST_LOOK_FULL: CameraPhoto = { ...PHOTOS.firstLook, src: "photos/full/DSC08435.jpg" };

/** 1 · POV: on the wedding, the pose card on the camera in her hands. */
export const Hook1: React.FC = () => {
  const { safe } = useLayout();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={0.2} views={[{ t: 0, x: 0.55, y: 0.5, zoom: 1.0 }, { t: 3, x: 0.52, y: 0.52, zoom: 1.12 }]} />
      <Grade top={0.55} vignette={0.35} grain={0.06} />
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10 }}>
        <Caption lines={["POV: your camera", "tells you the", "[next] [pose.]"]} at={0} size={104} />
      </div>
    </AbsoluteFill>
  );
};

/** 2 · Call-out over the sharp 4K playback clip, "Pinterest" struck through. */
export const Hook2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe } = useLayout();
  const strike = move(frame, fps, 0.75, 1.05);
  const after = enter(frame, fps, 1.05, 0, 0.35);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Footage plays only the segments without the Bruno Weddings cards. */}
      <Footage views={[{ t: 0, x: 0.5, y: 0.58, zoom: 1.25 }, { t: 3, x: 0.5, y: 0.58, zoom: 1.4 }]} />
      <Grade top={0.6} vignette={0.35} grain={0.06} />
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10, textAlign: "center" }}>
        <div
          style={{
            display: "inline-block", fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: "0.06em", color: "#fff", background: RED,
            padding: "8px 18px", borderRadius: 8, textTransform: "uppercase", opacity: Math.min(1, enter(frame, fps, 0, 0, 0.25) * 2),
          }}
        >
          Wedding photographers
        </div>
        <div style={{ height: 14 }} />
        <Caption lines={["Stop checking"]} at={0.15} size={110} />
        <div style={{ position: "relative", display: "inline-block" }}>
          <Caption lines={["Pinterest"]} at={0.35} size={110} />
          <div style={{ position: "absolute", left: -8, top: "52%", height: 12, width: `calc(${strike * 100}% + 16px)`, background: RED, borderRadius: 6 }} />
        </div>
        <div style={{ opacity: Math.min(1, after * 2), transform: `translateY(${(1 - after) * 30}px)` }}>
          <Caption lines={["mid-shoot."]} at={1.05} size={110} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3 · Macro pull-out: open on the words on the card (sharp 27 MP), pull out to the camera in a hand. */
export const Hook3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, h, safe } = useLayout();
  const c = FIRST_LOOK_FULL.card;
  const cover = Math.max(w / FULL.w, h / FULL.h);
  const macro = { x: c.x + c.w * 0.3, y: c.y + c.h * 0.86, zoom: 2.1 / cover };
  const wide = { x: c.x + c.w / 2, y: c.y + c.h * 0.62, zoom: 1.12 };
  // The first line leaves (fast, 5 frames) before the second one starts.
  const gone = interpolate(frame, [Math.round(1.35 * fps), Math.round(1.35 * fps) + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Shot src={FIRST_LOOK_FULL.src} media={FULL} views={[{ t: 0, ...macro }, { t: 0.55, ...macro, zoom: macro.zoom * 0.96 }, { t: 1.55, ...wide }, { t: 3, ...wide, zoom: 1.18 }]} />
      <Grade top={0.6} vignette={0.4} grain={0.06} />
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10 }}>
        <div style={{ opacity: 1 - gone, transform: `translateY(${-gone * 30}px)` }}>
          <Caption lines={["Say this to", "your [couple:]"]} at={0} size={110} />
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: frame >= Math.round(1.5 * fps) ? 1 : 0 }}>
          <Caption lines={["It’s on your", "[camera.] Not your", "phone."]} at={1.5} size={104} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const HOOK_SECONDS = 3;
