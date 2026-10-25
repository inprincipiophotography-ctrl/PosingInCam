import React from "react";
import { Img, staticFile } from "remotion";
import { SANS } from "../theme";
import { Body, CameraStrip, Card, CardAnatomy, Cta, Headline, INK, Label, M, MUTED, RED, Slide, Steps } from "./kit";

// Concept C, problem solving for the whole wedding day: the photographer runs the day from a phone (Pinterest,
// a PDF timeline, the planner, a notes app); Shoot Cards puts poses, timeline, family groups and the shot list on
// the camera screen. 9 slides. The timeline, groups and shot-list cards are drawn by the site's own renderer
// (scripts/render-cards.mjs) with the /demo page's sample couple.
const N = 9;

/** A landscape Shoot Card (timeline, groups, shot list), as the camera shows it. */
const Wide: React.FC<{ src: string; width: number; rotate?: number; style?: React.CSSProperties }> = ({ src, width, rotate = 0, style }) => (
  <div style={{ width, height: (width * 2) / 3, borderRadius: 12, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.2), 0 4px 12px rgba(40,20,10,0.1)", transform: `rotate(${rotate}deg)`, ...style }}>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);

const Hook: React.FC = () => (
  <Slide n={1} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>For wedding photographers</Label>
      <Headline size={118} style={{ marginTop: 18 }}>{"Never look *unprepared*\nin front of a\ncouple again."}</Headline>
    </div>
    {/* At a real wedding, over the photographer's shoulder: the pose card on the camera, the couple waiting. */}
    <div style={{ position: "absolute", left: M, right: M, top: 640, height: 527, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.22)" }}>
      <Img src={staticFile("carousel/wedding-pov.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
    <Body size={34} style={{ position: "absolute", left: M, right: M, top: 1200, color: INK }}>
      Poses, timeline, family groups, shot list. <b>All on the camera already in your hand.</b>
    </Body>
  </Slide>
);

const OldWay: React.FC = () => {
  const rows = [
    ["Pinterest", "for the next pose"],
    ["A PDF", "for the timeline"],
    ["The planner", "for “who’s next?”"],
    ["A notes app", "for the shot list"],
  ];
  return (
    <Slide n={2} total={N}>
      <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
        <Headline size={116}>{"The wedding day,\n*the old way:*"}</Headline>
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 500, display: "flex", flexDirection: "column", gap: 40 }}>
        {rows.map(([a, b]) => (
          <div key={a} style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 18, paddingBottom: 26, borderBottom: "1.5px solid rgba(20,20,22,0.12)" }}>
            <span style={{ position: "relative", fontFamily: SANS, fontWeight: 700, fontSize: 64, letterSpacing: "-0.03em", color: INK }}>
              {a}
              {/* struck through */}
              <span style={{ position: "absolute", left: -6, right: -6, top: "52%", height: 7, borderRadius: 4, background: RED, transform: "rotate(-2deg)" }} />
            </span>
            <span style={{ fontFamily: SANS, fontSize: 42, color: MUTED, letterSpacing: "-0.01em" }}>{b}</span>
          </div>
        ))}
      </div>
      <Body size={38} style={{ position: "absolute", left: M, right: M, top: 1200, color: INK }}>
        All on your phone, in front of your couple. <b>It looks like you don’t know what’s next.</b>
      </Body>
    </Slide>
  );
};

const AllOnCamera: React.FC = () => (
  <Slide n={3} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Headline size={112}>{"Now it’s all\n*on your camera screen.*"}</Headline>
      <Body size={32} style={{ marginTop: 14 }}>Faster, calmer, more professional. Everything within reach of the camera you’re already holding.</Body>
    </div>
    <Card card="editorial" width={430} rotate={-3} style={{ position: "absolute", left: M, top: 580 }} />
    <div style={{ position: "absolute", left: 580, top: 520, display: "flex", flexDirection: "column", gap: 20 }}>
      <Wide src="cards/timeline.png" width={370} rotate={2} />
      <Wide src="cards/groups.png" width={370} rotate={-1.5} />
      <Wide src="cards/shotlist.png" width={370} rotate={1.5} />
    </div>
  </Slide>
);

const Poses: React.FC = () => (
  <Slide n={4} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>Posing</Label>
      <Headline size={104} style={{ marginTop: 16 }}>{"Poses, with\n*the words to say.*"}</Headline>
    </div>
    <CardAnatomy top={480} />
  </Slide>
);

/** Timeline, family groups, shot list: one landscape card each, big, with what it replaces. */
const Feature: React.FC<{ n: number; label: string; title: string; src: string; line: string }> = ({ n, label, title, src, line }) => (
  <Slide n={n} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>{label}</Label>
      <Headline size={112} style={{ marginTop: 16 }}>{title}</Headline>
    </div>
    <Wide src={src} width={936} rotate={-1.2} style={{ position: "absolute", left: M, top: 520 }} />
    <Body size={36} style={{ position: "absolute", left: M, right: M, top: 1180, color: INK }}>{line}</Body>
  </Slide>
);

const How: React.FC = () => (
  <Slide n={8} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>How it works</Label>
      <Headline size={112} style={{ marginTop: 18 }}>{"Three steps,\n*zero* phone."}</Headline>
    </div>
    <Steps style={{ position: "absolute", left: M, right: M, top: 560 }} />
    <CameraStrip top={1050} />
    <div style={{ position: "absolute", left: M, right: M, top: 1268, fontFamily: SANS, fontWeight: 600, fontSize: 30, color: INK }}>
      Sony · Canon · Nikon <span style={{ color: MUTED, fontWeight: 400 }}>· no account needed</span>
    </div>
  </Slide>
);

const Close: React.FC = () => (
  <Slide n={9} total={N}>
    <Cta />
  </Slide>
);

export const SLIDES_C: React.FC[] = [
  Hook,
  OldWay,
  AllOnCamera,
  Poses,
  () => <Feature n={5} label="Timeline" title={"The timeline,\n*one swipe away.*"} src="cards/timeline.png" line="No PDF. No checking your phone between the ceremony and the family photos." />,
  () => <Feature n={6} label="Family groups" title={"Family groups,\n*in order.*"} src="cards/groups.png" line="Call the next group by name, without asking the planner." />,
  () => <Feature n={7} label="Shot list" title={"The must-haves,\n*covered.*"} src="cards/shotlist.png" line="Every shot the couple asked for, a swipe away." />,
  How,
  Close,
];
