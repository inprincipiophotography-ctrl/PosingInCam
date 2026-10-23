import React from "react";
import { Img, staticFile } from "remotion";
import { CARD_SERIF, SANS } from "../theme";

// A pose card as vector UI, laid out exactly like builder.js's drawPose (1280 × 1920, the frame the camera shows).
// Drawn as DOM instead of a photo of the camera screen, so its words stay sharp at any zoom.
export const CARD = { w: 1280, h: 1920 };
const POSE = {
  strip: "#7d0303", star: "#e3403d", ink: "#000000", say: "#716e63",
  stripX: 986,
  frame: { x: 391, y: 195, w: 864, h: 1362, line: 5 },
  box: { x: 30, y: 1394, w: 724, h: 476 },
};
const NOTE_LINE = 49;

// Regions the camera and the callouts aim at, in card pixels.
export const REGIONS = {
  photo: { x: POSE.frame.x, y: POSE.frame.y, w: POSE.frame.w, h: POSE.box.y - POSE.frame.y - 20 },
  say: { x: POSE.box.x, y: POSE.box.y, w: POSE.box.w, h: POSE.box.h },
  notes: { x: 22, y: 590, w: 362, h: 650 }, // camera settings + the hack
};
export type Region = keyof typeof REGIONS;

export type PoseCardData = {
  title: string;
  energy: string;
  camera: string;
  hack: string;
  say: string;
  source: string;
  photo: string; // staticFile path
  noteSize?: number; // px; a long hack needs a smaller size to stay clear of the photo
};

/** Text placed by its baseline, like the canvas does. */
const At: React.FC<{ x: number; base: number; size: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, base, size, children, style }) => (
  <div style={{ position: "absolute", left: x, top: base - size * 0.92, fontSize: size, lineHeight: 1, whiteSpace: "nowrap", ...style }}>{children}</div>
);

export const PoseCard: React.FC<{ data: PoseCardData; children?: React.ReactNode }> = ({ data, children }) => {
  const f = POSE.frame;
  const b = POSE.box;
  const notes: [string, string, boolean][] = [
    ["ENERGY:", data.energy, false],
    ["CAMERA:", data.camera, false],
    ["HACK:", data.hack, true],
  ];
  let y = 483;
  return (
    <div style={{ position: "relative", width: CARD.w, height: CARD.h, background: "#fff", overflow: "hidden", fontFamily: SANS, color: POSE.ink }}>
      <div style={{ position: "absolute", left: POSE.stripX, top: 0, width: CARD.w - POSE.stripX, height: CARD.h, background: POSE.strip }} />
      <At x={30} base={142} size={94} style={{ fontFamily: CARD_SERIF, fontWeight: 600, letterSpacing: "-0.005em" }}>{data.title.toUpperCase()}</At>
      {/* The photo in a thin black frame, its right edge over the strip. */}
      <div style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.h, background: POSE.ink }} />
      <Img src={staticFile(data.photo)} style={{ position: "absolute", left: f.x + f.line, top: f.y + f.line, width: f.w - 2 * f.line, height: f.h - 2 * f.line, objectFit: "cover" }} />
      {notes.map(([label, value, mark]) => {
        const lines = value.toUpperCase().split("\n");
        const top = y;
        y += NOTE_LINE * (lines.length + 2);
        return (
          <React.Fragment key={label}>
            <At x={30} base={top} size={data.noteSize ?? 32} style={{ fontWeight: 700 }}>{label}</At>
            {lines.map((line, j) => (
              <At key={j} x={30} base={top + NOTE_LINE * (j + 1)} size={data.noteSize ?? 32} style={{ fontWeight: 400 }}>
                {mark && j === 0 ? <span style={{ color: POSE.star }}>*</span> : null}
                {line}
              </At>
            ))}
          </React.Fragment>
        );
      })}
      {/* "Say to the couple" box over the photo's lower left corner. */}
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background: "#fff", boxShadow: `inset 0 0 0 3px ${POSE.ink}` }} />
      <At x={b.x + 21} base={b.y + 53} size={37} style={{ fontWeight: 700 }}>SAY TO THE COUPLE</At>
      {data.say.toUpperCase().split("\n").map((line, j) => (
        <At key={j} x={b.x + 21} base={b.y + 132 + j * 62} size={40} style={{ color: POSE.say }}>
          {j === 0 ? <span style={{ color: POSE.star }}>"</span> : null}
          {line}
        </At>
      ))}
      <div style={{ position: "absolute", left: POSE.stripX, width: CARD.w - POSE.stripX, top: 1800, textAlign: "center", fontFamily: CARD_SERIF, fontStyle: "italic", fontSize: 24, lineHeight: "32px", color: "#fff" }}>
        {data.source.toUpperCase().split("\n").map((l, j) => <div key={j}>{l}</div>)}
      </div>
      {children}
    </div>
  );
};

// The card on the camera in the wedding take and in DSC08438, word for word.
export const EDITORIAL: PoseCardData = {
  title: "Editorial 1/1",
  energy: "Serious",
  camera: "Vertical\neye level or lower",
  hack: "His hand must be\nvisible holding her,\notherwise it looks\nlike they are\ntogether by\naccident.\nHer shoulders\nslightly back.",
  say: "Stand in front of him, pop\nthe leg, one arm relaxed by\nyour side, other on your hip,\nchin slightly down. He holds\nyour elbow or waist.",
  source: "Source: In Principio\nweddings",
  photo: "showcase/editorial-photo.jpg",
  noteSize: 27,
};

export const FIRST_LOOK: PoseCardData = {
  title: "The First Look",
  energy: "Emotional\nanticipation",
  camera: "1/500+\nburst mode",
  hack: "Idea for first look\nas shown in the\nphoto.",
  say: "This is a moment just for the\ntwo of you, cameras don’t\nexist, relax and enjoy.",
  source: "Source: In Principio\nweddings",
  photo: "showcase/first-look-photo.jpg",
};
