import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { EndCard } from "./components/EndCard";
import { footageSeconds } from "./components/Footage";
import { SafeZoneGuide } from "./components/SafeZoneGuide";
import { Soundtrack } from "./components/Soundtrack";
import { MUSIC, PHOTOS } from "./config";
import { Hook } from "./scenes/Hook";
import { Payoff } from "./scenes/Payoff";
import { PhoneProblem } from "./scenes/PhoneProblem";
import { Playback } from "./scenes/Playback";
import { StopMotion } from "./scenes/StopMotion";
import { TextCards } from "./scenes/TextCards";
import { WhoNext } from "./scenes/WhoNext";

// Storyboards: storyboards/ad-a.md, ad-b.md, ad-c.md. 13 s each; the end card always gets the last 2.7 s.
export const AD_SECONDS = 13;
const END: [number, number] = [10.3, 2.7];

const useSeq = () => {
  const { fps } = useVideoConfig();
  return ([from, dur]: [number, number]) => ({ from: Math.round(from * fps), durationInFrames: Math.round(dur * fps) });
};

/** A, "Blank": the moment your mind goes blank → the card is right there in playback. */
export const AdA: React.FC<{ guides?: boolean }> = ({ guides }) => {
  const seq = useSeq();
  return (
    <AbsoluteFill>
      <Sequence {...seq([0, 3.6])} name="Hook">
        <Hook lines={[{ text: "The couple’s waiting.", at: 0.1 }, { text: "Your mind goes *blank*.", at: 1.2 }]} outAt={3.3} dur={3.6} />
      </Sequence>
      <Sequence {...seq([3.6, 4.5])} name="Playback">
        <Playback caption="Press ▶. Your poses are *right there.*" rate={footageSeconds() / 4.5} />
      </Sequence>
      <Sequence {...seq([8.1, 2.2])} name="Words to say">
        <Payoff photo={PHOTOS.firstLook} pushAt={0} beats={[{ spot: "say", label: "With the exact words to say", at: 0.7 }]} />
      </Sequence>
      <Sequence {...seq(END)} name="Logo + CTA">
        <EndCard />
      </Sequence>
      <Soundtrack src={MUSIC.ads} />
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};

/** B, "No phone": scrolling the phone in front of the couple → just the camera. */
export const AdB: React.FC<{ guides?: boolean }> = ({ guides }) => {
  const seq = useSeq();
  return (
    <AbsoluteFill>
      <Sequence {...seq([0, 3.6])} name="Phone">
        <PhoneProblem phoneAt={0} outAt={3.3} lines={[{ text: "Still hunting for poses", at: 0.15 }, { text: "in front of the *couple?*", at: 0.75 }]} />
      </Sequence>
      <Sequence {...seq([3.6, 1.4])} name="No phone">
        <Hook lines={[{ text: "No phone.", at: 0 }, { text: "No *Pinterest.*", at: 0.4 }]} outAt={1.15} dur={1.4} />
      </Sequence>
      <Sequence {...seq([5.0, 3.6])} name="Playback">
        <StopMotion photos={[PHOTOS.firstLook, PHOTOS.editorial, PHOTOS.vogue, PHOTOS.fitCheck]} hold={0.9} caption="Just your camera’s *playback.*" />
      </Sequence>
      <Sequence {...seq([8.6, 1.7])} name="More cards">
        <TextCards order={["timeline", "groups", "shotlist"]} advanceAt={[0.6, 1.15]} lines={[]} caption={{ text: "Timeline. Family groups. *Shot list.*", at: 0.1 }} />
      </Sequence>
      <Sequence {...seq(END)} name="Logo + CTA">
        <EndCard />
      </Sequence>
      <Soundtrack src={MUSIC.ads} />
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};

/** C, "Who's next?": family groups chaos → the list in playback. */
export const AdC: React.FC<{ guides?: boolean }> = ({ guides }) => {
  const seq = useSeq();
  return (
    <AbsoluteFill>
      <Sequence {...seq([0, 3.2])} name="Who's next">
        <WhoNext at={0.1} outAt={2.9} />
      </Sequence>
      <Sequence {...seq([3.2, 5.2])} name="Cards in playback">
        <TextCards order={["groups", "timeline", "shotlist"]} advanceAt={[2.4, 3.9]} lines={[]} caption={{ text: "Your family list, *in your camera.*", at: 0.3 }} />
      </Sequence>
      <Sequence {...seq([8.4, 1.9])} name="No guessing">
        <Hook lines={[{ text: "No phone.", at: 0 }, { text: "No *guessing.*", at: 0.45 }]} outAt={1.6} dur={1.9} />
      </Sequence>
      <Sequence {...seq(END)} name="Logo + CTA">
        <EndCard />
      </Sequence>
      <Soundtrack src={MUSIC.ads} />
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};
