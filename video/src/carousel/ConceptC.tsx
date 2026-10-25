import React from "react";
import { Img, staticFile } from "remotion";
import { SANS } from "../theme";
import { Body, CameraStrip, Card, CardAnatomy, Cta, Headline, HerBoard, INK, Label, M, MUTED, RED, ShowUrl, Slide, Steps, Wide } from "./kit";

// Concept C, problem solving for the whole wedding day: the photographer runs the day from a phone (Pinterest,
// a PDF timeline, the planner, a notes app); Shoot Cards puts poses, timeline, family groups and the shot list on
// the camera screen, plus any image (her Pinterest pins, a moodboard, your own designs). 12 slides. The timeline, groups and shot-list cards are drawn by the site's own renderer
// (scripts/render-cards.mjs) with the /demo page's sample couple.
// Slides take their number and the set's length, so the same slides make the 12-slide post and the 10-card ad.
type P = { n: number; total: number };

const Hook: React.FC<P> = ({ n, total }) => {
  // The real thing, upright and whole: a hand on the camera, thumb on the dial, The First Look on the screen.
  // Its light wall melts into the paper at every edge.
  const fade = "linear-gradient(to bottom, transparent 0%, #000 5%, #000 82%, transparent 96%), linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%)";
  return (
    <Slide n={n} total={total}>
      {/* cropped from the full-size original (source/DSC08435.jpg) so the camera fills the slide */}
      <div style={{ position: "absolute", left: 140, top: 468, width: 800, height: 1067, WebkitMaskImage: fade, maskImage: fade, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}>
        <Img src={staticFile("carousel/hook-camera.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
        <Label>For wedding photographers</Label>
        <Headline size={98} style={{ marginTop: 16 }}>{"Never look *unprepared*\nin front of a couple again."}</Headline>
        <Body size={32} style={{ marginTop: 18, color: INK }}>Poses · timeline · family groups · shot list. <b style={{ color: RED }}>On your camera.</b></Body>
      </div>

    </Slide>
  );
};

const OldWay: React.FC<P> = ({ n, total }) => {
  const rows = [
    ["Pinterest", "for the next pose"],
    ["A PDF", "for the timeline"],
    ["The planner", "for “who’s next?”"],
    ["A notes app", "for the shot list"],
  ];
  return (
    <Slide n={n} total={total}>
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

const AllOnCamera: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
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

/** At a real wedding: the photographer glances at the card, the couple waits for the next pose. */
const MidShoot: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>Mid-shoot</Label>
      <Headline size={112} style={{ marginTop: 16 }}>{"Glance down.\nSwipe. *Shoot.*"}</Headline>
    </div>
    <div style={{ position: "absolute", left: M, right: M, top: 560, height: 527, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.22)" }}>
      <Img src={staticFile("carousel/wedding-pov.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
    <Body size={34} style={{ position: "absolute", left: M, right: M, top: 1130, color: INK }}>
      The couple never sees you reach for your phone. <b>You just know what’s next.</b>
    </Body>
  </Slide>
);

const Poses: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>Posing</Label>
      <Headline size={104} style={{ marginTop: 16 }}>{"Poses, with\n*the words to say.*"}</Headline>
    </div>
    <CardAnatomy top={480} />
  </Slide>
);

/** Timeline, family groups, shot list: one landscape card each, big, with what it replaces. */
const Feature: React.FC<P & { label: string; title: string; src: string; line: string }> = ({ n, total, label, title, src, line }) => (
  <Slide n={n} total={total}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>{label}</Label>
      <Headline size={112} style={{ marginTop: 16 }}>{title}</Headline>
    </div>
    <Wide src={src} width={936} rotate={-1.2} style={{ position: "absolute", left: M, top: 520 }} />
    <Body size={36} style={{ position: "absolute", left: M, right: M, top: 1180, color: INK }}>{line}</Body>
  </Slide>
);

/** "Any image": her Pinterest pins, a moodboard, your own designs, labelled and in playback (the site's "Her board"). */
const AnyImage: React.FC<P> = ({ n, total }) => {
  return (
    <Slide n={n} total={total}>
      <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
        <Label>Any image</Label>
        <Headline size={108} style={{ marginTop: 16 }}>{"If it’s an image,\n*it’s in your camera.*"}</Headline>
      </div>
      <HerBoard width={880} style={{ position: "absolute", left: M + 28, top: 495 }} />
      <Body size={33} style={{ position: "absolute", left: M, right: M, top: 1118, color: INK }}>
        Her Pinterest pins, a moodboard, your own Canva designs, a screenshot. <b>Upload any image and it shows up in your playback.</b>
      </Body>
      <div style={{ position: "absolute", left: M, right: M, top: 1268, fontFamily: SANS, fontSize: 26, color: MUTED }}>JPG · PNG · WEBP · HEIC · up to 30 at once</div>
    </Slide>
  );
};

/** Be ready for anything: what goes wrong on a wedding day, and the card that already has the answer. */
const Ready: React.FC<P> = ({ n, total }) => {
  const rows = [
    ["The couple freezes.", "The next pose, and the words to say, are a swipe away."],
    ["The day runs late.", "The timeline is on your camera, not in a PDF."],
    ["“Did we get Grandma?”", "The family groups, in order, one by one."],
    ["She shows you her Pinterest.", "Her board is already in your playback."],
  ];
  return (
    <Slide n={n} total={total}>
      <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
        <Label>Be ready for anything</Label>
        <Headline size={112} style={{ marginTop: 16 }}>{"Better prepared\n*than sorry.*"}</Headline>
        <Body style={{ marginTop: 22, maxWidth: 900 }}>Every wedding throws something at you. Walk in with the answers already in your hand.</Body>
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 640, display: "flex", flexDirection: "column", gap: 26 }}>
        {rows.map(([q, a]) => (
          <div key={q} style={{ display: "flex", gap: 24, alignItems: "flex-start", paddingBottom: 24, borderBottom: "1.5px solid rgba(20,20,22,0.12)" }}>
            <div style={{ width: 34, height: 34, borderRadius: 17, background: RED, color: "#fff", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 22, marginTop: 6 }}>✓</div>
            <div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 38, letterSpacing: "-0.02em", color: INK }}>{q}</div>
              <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.35, color: MUTED, marginTop: 6 }}>{a}</div>
            </div>
          </div>
        ))}
      </div>
    </Slide>
  );
};

const How: React.FC<P> = ({ n, total }) => (
  <Slide n={n} total={total}>
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

const Close: React.FC<P & { ad?: boolean }> = ({ n, total, ad }) => (
  <Slide n={n} total={total}>
    <Cta variant={ad ? "ad" : "organic"} />
  </Slide>
);

const Timeline: React.FC<P> = (p) => <Feature {...p} label="Timeline" title={"The timeline,\n*one swipe away.*"} src="cards/timeline.png" line="No PDF. No checking your phone between the ceremony and the family photos." />;
const Groups: React.FC<P> = (p) => <Feature {...p} label="Family groups" title={"Family groups,\n*in order.*"} src="cards/groups.png" line="Call the next group by name, without asking the planner." />;
const ShotList: React.FC<P> = (p) => <Feature {...p} label="Shot list" title={"The must-haves,\n*covered.*"} src="cards/shotlist.png" line="Every shot the couple asked for, a swipe away." />;

const set = (order: React.FC<P>[], url = false): React.FC[] =>
  order.map((S, i) => () => (
    <ShowUrl.Provider value={url}>
      <S n={i + 1} total={order.length} />
    </ShowUrl.Provider>
  ));

/** The organic post (12 slides, comment POSE). */
export const SLIDES_C = set([Hook, OldWay, AllOnCamera, MidShoot, Poses, Timeline, Groups, ShotList, AnyImage, Ready, How, Close]);
