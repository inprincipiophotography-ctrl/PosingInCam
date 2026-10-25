import React from "react";
import { Img, staticFile } from "remotion";
import { CARD, EDITORIAL, PoseCard, REGIONS } from "../v4/PoseCard";
import { SANS, SERIF } from "../theme";
import { POSES, type Pose } from "./data";
import { Body, Card, Cta, Fan, Founders, Headline, INK, Label, M, MUTED, RED, Slide, Steps, W } from "./kit";

// Concept A, value first: five real poses with the exact words to say (what people save and share), then the
// twist that all of them can live in the camera, how, who made it, and the free card. 10 slides.
const N = 10;

const Hook: React.FC = () => (
  <Slide n={1} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 170 }}>
      <Headline size={128}>{"5 poses that work\non *every couple*"}</Headline>
      <Body size={38} style={{ marginTop: 26, color: INK }}>…and the exact words to say to them.</Body>
    </div>
    <Fan cardWidth={370} spread={132} style={{ position: "absolute", left: (W - 370) / 2, top: 610 }} />
  </Slide>
);

const Insight: React.FC = () => {
  // The "Say to the couple" box of the real card, up close, with a red outline: where the magic is.
  const r = REGIONS.say;
  const s = 1.18;
  return (
    <Slide n={2} total={N}>
      <div style={{ position: "absolute", left: M, right: M, top: 170 }}>
        <Headline size={112}>{"The pose isn’t\nthe hard part.\n*The words are.*"}</Headline>
        <Body style={{ marginTop: 30, maxWidth: 880 }}>
          Couples don’t know what to do with their hands. What you say in that second decides the photo. So every pose here comes with the exact words.
        </Body>
      </div>
      <div style={{ position: "absolute", left: M, top: 830, width: r.w * s * 0.92, height: r.h * s * 0.92, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.2)", outline: `5px solid ${RED}`, outlineOffset: 10 }}>
        <div style={{ transform: `scale(${s * 0.92}) translate(${-r.x}px, ${-r.y}px)`, transformOrigin: "0 0", width: CARD.w, height: CARD.h }}>
          <PoseCard data={EDITORIAL} />
        </div>
      </div>
    </Slide>
  );
};

/** One pose: its name, the card, its notes big enough to read, and the words to say as a quote. */
const PoseSlide: React.FC<{ pose: Pose; i: number }> = ({ pose, i }) => {
  const cw = 440;
  const long = pose.say.length > 110;
  return (
    <Slide n={3 + i} total={N}>
      <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
        <Label>Pose {String(i + 1).padStart(2, "0")} of 05</Label>
        <Headline size={104} style={{ marginTop: 14 }}>{pose.title}</Headline>
      </div>
      <Card card={pose.card} width={cw} rotate={-2} style={{ position: "absolute", left: M, top: 330 }} />
      <div style={{ position: "absolute", left: M + cw + 50, right: M, top: 360, display: "flex", flexDirection: "column", gap: 34 }}>
        {(
          [
            ["Energy", pose.energy],
            ["Camera", pose.camera],
            ["The hack", pose.hack],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <Label color={MUTED} style={{ fontSize: 20 }}>{k}</Label>
            <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.32, color: INK, marginTop: 8, fontWeight: k === "The hack" ? 600 : 400 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 1030, borderLeft: `5px solid ${RED}`, paddingLeft: 30 }}>
        <Label>{pose.sayTo}</Label>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: long ? 44 : 54, lineHeight: 1.12, color: INK, marginTop: 12 }}>“{pose.say}”</div>
      </div>
    </Slide>
  );
};

const Twist: React.FC = () => (
  <Slide n={8} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Headline size={112}>{"Now imagine them\nall *in your camera.*"}</Headline>
    </div>
    <div style={{ position: "absolute", left: M, right: M, top: 440, height: 760, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.2)" }}>
      <Img src={staticFile("photos/DSC08438.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%" }} />
    </div>
    <Body size={34} style={{ position: "absolute", left: M, right: M, top: 1232, color: INK }}>
      No phone in front of the couple. <b>The next pose is one swipe away in playback.</b>
    </Body>
  </Slide>
);

const How: React.FC = () => (
  <Slide n={9} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>Shoot Cards · how it works</Label>
      <Headline size={112} style={{ marginTop: 18 }}>{"Three steps,\n*zero* phone."}</Headline>
    </div>
    <Steps style={{ position: "absolute", left: M, right: M, top: 560 }} />
    <div style={{ position: "absolute", left: M, right: M, top: 1110, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Founders />
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: INK }}>Sony · Canon · Nikon</div>
    </div>
  </Slide>
);

const Close: React.FC = () => (
  <Slide n={10} total={N}>
    <Cta />
  </Slide>
);

export const SLIDES_A: React.FC[] = [Hook, Insight, ...POSES.map((p, i) => () => <PoseSlide pose={p} i={i} />), Twist, How, Close];
