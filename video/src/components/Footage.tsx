import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { FOOTAGE } from "../config";
import { FOOTAGE_SIZE, Shot, type View } from "./Shot";

/** The playback-scroll clip, played as its usable segments back to back (the cut reads as one more swipe). */
export const Footage: React.FC<{ views: View[]; rate?: number; width?: number; height?: number; style?: React.CSSProperties }> = ({ views, rate = 1, width, height, style }) => {
  const cfg = useVideoConfig();
  const fps = cfg.fps;
  let at = 0;
  return (
    <div style={{ position: "relative", width: width ?? cfg.width, height: height ?? cfg.height, ...style }}>
      {FOOTAGE.segments.map((seg, i) => {
        const dur = (seg.to - seg.from) / rate;
        const from = at;
        at += dur;
        // Views are in clip time, so shift them into this segment's local time.
        const local = views.map((v) => ({ ...v, t: v.t - from }));
        return (
          <Sequence key={i} from={Math.round(from * fps)} durationInFrames={Math.round(dur * fps)} layout="none">
            <div style={{ position: "absolute", inset: 0 }}>
              <Shot kind="video" src={FOOTAGE.src} media={FOOTAGE_SIZE} views={local} startFrom={seg.from} playbackRate={rate} width={width} height={height} />
            </div>
          </Sequence>
        );
      })}
    </div>
  );
};

/** Seconds the whole clip lasts at a playback rate. */
export const footageSeconds = (rate = 1) => FOOTAGE.segments.reduce((s, g) => s + (g.to - g.from), 0) / rate;
