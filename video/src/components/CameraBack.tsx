import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, SANS, ease, press } from "../theme";

type Props = {
  width: number; // body width in px; everything else scales from it
  cards: string[]; // landscape card images, in playback order
  /** Times (s) the thumb presses ▶ / ▷ to go to the next card. */
  advanceAt?: number[];
  label?: string; // the file-name strip at the top of the playback screen
};

/**
 * A generic mirrorless body seen from the back, in playback. No maker's logo or
 * button labels, so it stands for Sony, Canon and Nikon alike. Cards slide in
 * like the camera's own playback when the right key is pressed.
 */
export const CameraBack: React.FC<Props> = ({ width, cards, advanceAt = [], label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = width / 1000; // drawn at 1000 px wide
  const H = 620 * k;
  const screen = { x: 70 * k, y: 120 * k, w: 600 * k, h: 400 * k };

  // Which card is showing, and how far the slide to the next one has gone.
  let shown = 0;
  let slide = 0;
  advanceAt.forEach((at, i) => {
    const p = ease(frame, fps, at, at + 0.35);
    if (p >= 1) shown = i + 1;
    else if (p > 0) slide = p;
  });
  const lastPress = advanceAt.filter((a) => frame >= Math.round(a * fps) - 2).pop();
  const btn = lastPress == null ? 1 : press(frame, fps, lastPress - 0.03);

  const card = (src: string | undefined, offset: number) =>
    src ? (
      <Img
        src={staticFile(src)}
        style={{ position: "absolute", left: offset * screen.w, top: 0, width: screen.w, height: screen.h, objectFit: "contain", background: "#000" }}
      />
    ) : null;

  return (
    <div style={{ position: "relative", width, height: H }}>
      {/* body */}
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: 70 * k,
          background: "linear-gradient(180deg, #2a2a2e 0%, #161618 55%, #0e0e10 100%)",
          boxShadow: `0 ${40 * k}px ${90 * k}px rgba(0,0,0,0.28), inset 0 ${2 * k}px 0 rgba(255,255,255,0.08)`,
        }}
      />
      {/* top plate */}
      <div style={{ position: "absolute", left: 60 * k, top: -34 * k, width: 300 * k, height: 70 * k, borderRadius: 26 * k, background: "#1c1c1f" }} />
      {/* viewfinder eyecup */}
      <div style={{ position: "absolute", left: 90 * k, top: 18 * k, width: 230 * k, height: 86 * k, borderRadius: 32 * k, background: "#0a0a0b", boxShadow: "inset 0 0 0 2px #2b2b2f" }} />
      {/* grip */}
      <div style={{ position: "absolute", right: 0, top: 0, width: 230 * k, height: H, borderRadius: `0 ${70 * k}px ${70 * k}px 0`, background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(0,0,0,0.25))" }} />
      {/* screen */}
      <div
        style={{
          position: "absolute", left: screen.x - 14 * k, top: screen.y - 14 * k, width: screen.w + 28 * k, height: screen.h + 28 * k,
          borderRadius: 18 * k, background: "#050506", boxShadow: "inset 0 0 0 2px #26262a",
        }}
      />
      <div style={{ position: "absolute", left: screen.x, top: screen.y, width: screen.w, height: screen.h, overflow: "hidden", borderRadius: 6 * k, background: "#000" }}>
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${-slide * screen.w}px)` }}>
          {card(cards[shown], 0)}
          {card(cards[shown + 1], 1)}
        </div>
        {label ? (
          <div style={{ position: "absolute", left: 10 * k, top: 8 * k, fontFamily: SANS, fontSize: 15 * k, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 2px rgba(0,0,0,0.6)", letterSpacing: "0.02em" }}>
            {label.replace("{n}", String(shown + 1))}
          </div>
        ) : null}
        {/* glass */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(125deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 38%)" }} />
      </div>
      {/* control dial + buttons, unlabelled */}
      <div style={{ position: "absolute", left: 770 * k, top: 290 * k, width: 150 * k, height: 150 * k, borderRadius: "50%", background: "radial-gradient(circle, #2c2c30 0 34%, #1a1a1d 35% 100%)", boxShadow: `inset 0 0 0 ${4 * k}px #2f2f34` }} />
      <div
        style={{
          position: "absolute", left: 815 * k, top: 335 * k, width: 60 * k, height: 60 * k, borderRadius: "50%",
          background: "#2a2a2e", transform: `scale(${btn})`,
          boxShadow: lastPress != null && frame - lastPress * fps < fps * 0.3 ? `0 0 0 ${4 * k}px ${C.accentBright}` : "none",
        }}
      />
      {[{ x: 760, y: 150 }, { x: 860, y: 150 }, { x: 760, y: 500 }, { x: 860, y: 500 }].map((b, i) => (
        <div key={i} style={{ position: "absolute", left: b.x * k, top: b.y * k, width: 54 * k, height: 54 * k, borderRadius: "50%", background: "#232326", boxShadow: "inset 0 0 0 2px #2f2f34" }} />
      ))}
      {/* playback key */}
      <div style={{ position: "absolute", left: 70 * k, top: 545 * k, width: 54 * k, height: 40 * k, borderRadius: 10 * k, background: "#232326", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 0, height: 0, borderLeft: `${16 * k}px solid ${C.accentBright}`, borderTop: `${10 * k}px solid transparent`, borderBottom: `${10 * k}px solid transparent`, marginLeft: 4 * k }} />
      </div>
    </div>
  );
};
