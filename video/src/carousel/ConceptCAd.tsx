import React from "react";
import { Img, staticFile } from "remotion";
import { SANS } from "../theme";
import { Body, Card, CardAnatomy, Chip, Cta, Founders, Headline, HerBoard, INK, Label, M, MUTED, ShowUrl, Slide, Steps, TextScale, Wide } from "./kit";

// Carousel C as a Meta ad, v2: 8 cards, 4:5, run from the In Principio Weddings page as an ad only (its followers
// are couples). It leads with what's new, not with fear; Sony · Canon · Nikon on the first card and "we use it at
// our own weddings" on the second; the address on every card; type 25 % bigger than the organic sets so it reads
// on a phone, where a 1080 px card is ~390 pt wide.
type P = { n: number; total: number };

const fade =
  "linear-gradient(to bottom, transparent 0%, #000 5%, #000 82%, transparent 96%), linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%)";

const Hook: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    {/* the real thing, upright and whole: a hand on the camera, thumb on the dial, The First Look on the screen */}
    <div style={{ position: "absolute", left: 170, top: 505, width: 740, height: 987, WebkitMaskImage: fade, maskImage: fade, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}>
      <Img src={staticFile("carousel/hook-camera.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
    <div style={{ position: "absolute", left: M, right: M, top: 145 }}>
      <Label>New · for wedding photographers</Label>
      <Headline size={100} style={{ marginTop: 16 }}>{"Your wedding day plan,\n*now inside your camera.*"}</Headline>
      <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
        <Chip>Sony</Chip>
        <Chip>Canon</Chip>
        <Chip>Nikon</Chip>
      </div>
    </div>
  </Slide>
);

const Proof: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>Made by wedding photographers</Label>
      <Headline size={104} style={{ marginTop: 16 }}>{"We use it at every\n*wedding we shoot.*"}</Headline>
    </div>
    {/* our own wedding, over the photographer's shoulder: the pose card on the camera, the couple waiting */}
    <div style={{ position: "absolute", left: M, right: M, top: 470, height: 527, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.22)" }}>
      <Img src={staticFile("carousel/wedding-pov.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
    <Founders style={{ position: "absolute", left: M, top: 1045 }} />
    <Body size={34} style={{ position: "absolute", left: M, right: M, top: 1210, color: INK }}>Glance, swipe, shoot. <b>The couple never sees a phone.</b></Body>
  </Slide>
);

const AllOnCamera: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Headline size={104}>{"Everything for the day,\n*one swipe away.*"}</Headline>
      <Body size={34} style={{ marginTop: 16 }}>Faster, calmer, more professional.</Body>
    </div>
    <Card card="editorial" width={420} rotate={-3} style={{ position: "absolute", left: M, top: 560 }} />
    <div style={{ position: "absolute", left: 572, top: 500, display: "flex", flexDirection: "column", gap: 18 }}>
      <Wide src="cards/timeline.png" width={380} rotate={2} />
      <Wide src="cards/groups.png" width={380} rotate={-1.5} />
      <Wide src="cards/shotlist.png" width={380} rotate={1.5} />
    </div>
  </Slide>
);

const Poses: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>Posing</Label>
      <Headline size={104} style={{ marginTop: 16 }}>{"Poses, with\n*the words to say.*"}</Headline>
    </div>
    <CardAnatomy top={470} />
  </Slide>
);

const DayPlan: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>Timeline · family groups</Label>
      <Headline size={104} style={{ marginTop: 16 }}>{"Your timeline and\ngroups, *in order.*"}</Headline>
    </div>
    <Wide src="cards/timeline.png" width={590} rotate={-1.5} style={{ position: "absolute", left: M, top: 465 }} />
    <Wide src="cards/groups.png" width={590} rotate={1.5} style={{ position: "absolute", left: 1080 - M - 590, top: 862 }} />
    <Body size={34} style={{ position: "absolute", left: M, right: M, top: 1262, color: INK }}>
      No PDF. <b>No asking the planner who’s next.</b>
    </Body>
  </Slide>
);

const AnyImage: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>Any image</Label>
      <Headline size={104} style={{ marginTop: 16 }}>{"Her Pinterest board,\n*on your camera.*"}</Headline>
    </div>
    <HerBoard width={900} style={{ position: "absolute", left: M + 18, top: 470 }} />
    <Body size={34} style={{ position: "absolute", left: M, right: M, top: 1110, color: INK }}>
      Pins, moodboards, your own Canva designs: <b>any image shows up in your playback.</b>
    </Body>
  </Slide>
);

const How: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>How it works</Label>
      <Headline size={112} style={{ marginTop: 16 }}>{"Three steps,\n*zero* phone."}</Headline>
    </div>
    <Steps style={{ position: "absolute", left: M, right: M, top: 520 }} />
    <div style={{ position: "absolute", left: M, right: M, top: 1225, fontFamily: SANS, fontWeight: 700, fontSize: 38, color: INK }}>
      Sony · Canon · Nikon <span style={{ color: MUTED, fontWeight: 400 }}>· no account</span>
    </div>
  </Slide>
);

const Close: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <Cta variant="ad" />
  </Slide>
);

const ORDER: React.FC<P>[] = [Hook, Proof, AllOnCamera, Poses, DayPlan, AnyImage, How, Close];

export const SLIDES_C_AD: React.FC[] = ORDER.map((S, i) => () => (
  <ShowUrl.Provider value>
    <TextScale.Provider value={1.25}>
      <S n={i + 1} total={ORDER.length} />
    </TextScale.Provider>
  </ShowUrl.Provider>
));
