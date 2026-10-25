import { EDITORIAL } from "../v4/PoseCard";

// The five poses in concept A, word for word off the real cards (assets/showcase/pack-0x.jpg and the
// Editorial card on the camera in DSC08438). All five photos are In Principio's own.
export type Pose = {
  title: string;
  card: string | "editorial"; // a card image in public/, or the vector Editorial card
  energy: string;
  camera: string;
  hack: string;
  sayTo: string;
  say: string;
};

export const POSES: Pose[] = [
  {
    title: "The First Look",
    card: "showcase/pack-02.jpg",
    energy: "Emotional anticipation",
    camera: "1/500+, burst mode",
    hack: "Idea for the first look as shown in the photo.",
    sayTo: "Say to the couple",
    say: "This is a moment just for the two of you, cameras don’t exist, relax and enjoy.",
  },
  {
    title: "Dance and Spin",
    card: "showcase/pack-01.jpg",
    energy: "Happy, playful",
    camera: "Slow/fast shutter, variations in composition",
    hack: "Have them imagine dancing their first dance.",
    sayTo: "Say to the couple",
    say: "Spin like you are in a movie, let the movement lift the wedding dress.",
  },
  {
    title: "Editorial 1/1",
    card: "editorial",
    energy: "Serious",
    camera: "Vertical, eye level or lower",
    hack: "His hand must be visible holding her, otherwise it looks like they are together by accident.",
    sayTo: "Say to the couple",
    say: EDITORIAL.say.replace(/\n/g, " "),
  },
  {
    title: "Under the Veil",
    card: "showcase/pack-03.jpg",
    energy: "Tender, romantic",
    camera: "Slow/fast shutter, close-up",
    hack: "Bonus if there’s wind.",
    sayTo: "Say to the couple",
    say: "Under the veil, hold her tight around the waist, like you won’t let go. Grab the back of his neck. Kiss – real, as if we’re not here.",
  },
  {
    title: "Vogue",
    card: "showcase/pack-04.jpg",
    energy: "Serious, editorial",
    camera: "Direct flash, vertical, below eye level",
    hack: "Arrange the dress; slight finger movement makes the frame more elegant.",
    sayTo: "Say to the bride",
    say: "One leg slightly forward, weight on the back leg. Hands relaxed over your waist, as if holding something. Shoulders down, elbows back.",
  },
];
