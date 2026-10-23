import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useLayout } from "../layout";
import { C, SANS, clamp, ease, f, pop } from "../theme";

type Props = {
  at: number; // s
  from: { x: number; y: number }; // the point on the card, px
  to: { x: number; y: number }; // where the label sits, px
  label: string;
  side: "left" | "right"; // which side of `to` the label text runs
};

/** A dot on the card, a line drawing out to a label: "this is the line to say". */
export const Callout: React.FC<Props> = ({ at, from, to, label, side }) => {
  const frame = useCurrentFrame();
  const { u, fps } = useLayout();
  const dot = pop(frame, fps, at, 0.4);
  const line = ease(frame, fps, at + 0.08, at + 0.45);
  const text = pop(frame, fps, at + 0.3);
  const o = interpolate(frame, [f(at + 0.3, fps), f(at + 0.5, fps)], [0, 1], clamp);
  const ex = from.x + (to.x - from.x) * line;
  const ey = from.y + (to.y - from.y) * line;
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <line x1={from.x} y1={from.y} x2={ex} y2={ey} stroke={C.accent} strokeWidth={3 * u} strokeLinecap="round" />
        <circle cx={from.x} cy={from.y} r={11 * u * dot} fill={C.accent} />
        <circle cx={from.x} cy={from.y} r={20 * u * dot} fill="none" stroke={C.accent} strokeOpacity={0.35} strokeWidth={3 * u} />
      </svg>
      <div
        style={{
          position: "absolute", top: to.y, left: side === "right" ? to.x + 16 * u : undefined, right: side === "left" ? `calc(100% - ${to.x - 16 * u}px)` : undefined,
          transform: `translateY(-50%) translateX(${(1 - text) * (side === "right" ? -18 : 18) * u}px)`, opacity: o,
          background: C.surface, color: C.ink, fontFamily: SANS, fontWeight: 600, fontSize: 34 * u, whiteSpace: "nowrap",
          padding: `${14 * u}px ${22 * u}px`, borderRadius: 16 * u, boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.12)`,
          border: `${1.5 * u}px solid ${C.rule}`,
        }}
      >
        {label}
      </div>
    </>
  );
};
