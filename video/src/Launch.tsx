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
import { Steps } from "./scenes/Steps";

// Storyboard: storyboards/launch.md. Start and length of every scene, in seconds (30.0 s total).
export const LAUNCH = {
  hook: [0, 4],
  problem: [4, 6],
  steps: [10, 3],
  playback: [13, 6],
  payoff: [19, 6],
  end: [25, 5],
} as const;
export const LAUNCH_SECONDS = 30;

export const Launch: React.FC<{ guides?: boolean }> = ({ guides }) => {
  const { fps } = useVideoConfig();
  const seq = ([from, dur]: readonly [number, number]) => ({ from: Math.round(from * fps), durationInFrames: Math.round(dur * fps) });
  return (
    <AbsoluteFill>
      <Sequence {...seq(LAUNCH.hook)} name="1 Hook">
        <Hook lines={[{ text: "The couple’s waiting.", at: 0.25 }, { text: "Your mind goes *blank*.", at: 1.5 }]} outAt={3.65} dur={4} />
      </Sequence>
      <Sequence {...seq(LAUNCH.problem)} name="2 Problem">
        <PhoneProblem phoneAt={0.1} outAt={5.6} lines={[{ text: "So you reach\nfor your phone.", at: 0.35 }, { text: "In front of the couple.\n*Again.*", at: 2.4 }]} />
      </Sequence>
      <Sequence {...seq(LAUNCH.steps)} name="3a Fix: how">
        <Steps title="Put the poses *in your camera.*" at={0.1} outAt={2.7} />
      </Sequence>
      <Sequence {...seq(LAUNCH.playback)} name="3b Fix: playback">
        <Playback caption="Your poses, right in *playback*." line="No phone. No Pinterest." rate={footageSeconds() / LAUNCH.playback[1]} />
      </Sequence>
      <Sequence {...seq(LAUNCH.payoff)} name="4 Payoff">
        <Payoff
          photo={PHOTOS.firstLook}
          beats={[
            { spot: "notes", label: "Settings + a posing hack", at: 1.1 },
            { spot: "photo", label: "The pose to copy", at: 2.2 },
            { spot: "say", label: "The exact words to say", at: 3.3 },
          ]}
          bodiesAt={4.5}
        />
      </Sequence>
      <Sequence {...seq(LAUNCH.end)} name="5 Logo + CTA">
        <EndCard />
      </Sequence>
      <Soundtrack src={MUSIC.launch} />
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};
