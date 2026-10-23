import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, SANS, ease } from "../theme";

type Props = {
  width: number;
  images: string[];
  query?: string;
  scrollFrom?: number; // s
  scrollTo?: number; // s
};

/** A generic phone with an image-search feed scrolling: the "looking up poses on the phone" moment. No app branding. */
export const Phone: React.FC<Props> = ({ width, images, query = "wedding poses", scrollFrom = 0, scrollTo = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = width / 400;
  const H = 820 * k;
  const pad = 14 * k;
  const col = (width - pad * 2 - 30 * k) / 2;
  // A slow scroll with a flick in the middle, like a thumb hunting for the right pose.
  const scroll = ease(frame, fps, scrollFrom, scrollTo) * 900 * k;
  const tiles = Array.from({ length: 14 }, (_, i) => ({ src: images[i % images.length], h: (i % 3 === 0 ? 300 : i % 3 === 1 ? 220 : 260) * k }));
  const cols: (typeof tiles)[] = [[], []];
  tiles.forEach((t, i) => cols[i % 2].push(t));

  return (
    <div style={{ position: "relative", width, height: H, borderRadius: 62 * k, background: "#0d0d0f", boxShadow: `0 ${40 * k}px ${80 * k}px rgba(0,0,0,0.25)` }}>
      <div style={{ position: "absolute", left: pad, top: pad, right: pad, bottom: pad, borderRadius: 50 * k, overflow: "hidden", background: "#fff" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 70 * k, bottom: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10 * k, padding: `${10 * k}px ${10 * k}px`, transform: `translateY(${-scroll}px)` }}>
            {cols.map((c, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 10 * k, width: col, marginTop: ci ? 40 * k : 0 }}>
                {c.map((t, ti) => (
                  <Img key={ti} src={staticFile(t.src)} style={{ width: col, height: t.h, objectFit: "cover", objectPosition: "70% 40%", borderRadius: 16 * k }} />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* search bar */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 70 * k, background: "#fff", display: "flex", alignItems: "flex-end", padding: `0 ${14 * k}px ${10 * k}px` }}>
          <div style={{ flex: 1, height: 40 * k, borderRadius: 20 * k, background: "#efeff1", display: "flex", alignItems: "center", gap: 8 * k, padding: `0 ${14 * k}px`, fontFamily: SANS, fontSize: 16 * k, color: C.ink2 }}>
            <div style={{ width: 12 * k, height: 12 * k, borderRadius: "50%", border: `${2.4 * k}px solid ${C.muted}` }} />
            {query}
          </div>
        </div>
      </div>
      {/* camera notch */}
      <div style={{ position: "absolute", left: width / 2 - 50 * k, top: pad + 8 * k, width: 100 * k, height: 26 * k, borderRadius: 13 * k, background: "#0d0d0f" }} />
    </div>
  );
};
