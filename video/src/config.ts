// Every word, number and asset path the videos use, in one place.
// A client revision ("change the CTA", "swap the photo") is a one-line edit here.

export const COPY = {
  url: "cards.notalucis.com",
  cta: "Make my free card",
  ctaNote: "First card free · no account",
  tagline: "Never go blank on a shoot again.",
  sub: "Pose cards in your camera’s playback, with the exact words to say to your couple.",
  brand: "Shoot Cards",
  byline: "by NotaLucis",
  bodies: "Sony · Canon · Nikon",
  // The button Meta draws under the ad (pick the same one in Ads Manager).
  metaCta: "Learn more",
};

// Real camera photos from video/source/ (resized into public/photos/ by scripts/prepare-assets.sh).
// `card` is the camera screen's card in the photo, as fractions of the photo's width/height,
// so a shot can push in on it without knowing the pixel size.
export type CameraPhoto = { src: string; title: string; card: { x: number; y: number; w: number; h: number } };

// Only cards whose photo is "Source: In Principio Weddings". DSC08437 (The Almost Kiss) is credited
// to Bruno Weddings, so it stays out of paid ads until they and the couple say yes.
export const PHOTOS = {
  firstLook: { src: "photos/DSC08435.jpg", title: "The First Look", card: { x: 0.368, y: 0.256, w: 0.256, h: 0.288 } },
  // Measured from the pixels: the card is 1281 × 1922 at (1632, 1527) in the 4538 × 6051 original.
  editorial: { src: "photos/DSC08438.jpg", title: "Editorial 1/1", card: { x: 0.3596, y: 0.2524, w: 0.2823, h: 0.3176 } },
  vogue: { src: "photos/DSC08439.jpg", title: "Vogue", card: { x: 0.367, y: 0.262, w: 0.26, h: 0.288 } },
  fitCheck: { src: "photos/DSC08440.jpg", title: "Fit Check", card: { x: 0.377, y: 0.275, w: 0.257, h: 0.288 } },
} satisfies Record<string, CameraPhoto>;

// The hand scrolling through cards in playback (4K vertical, 24 fps, 5.58 s).
// 2.30–2.90 s is cut: Shoulder Touch and The Almost Kiss are Bruno Weddings photos.
export const FOOTAGE = {
  src: "footage/VIDEO1.mp4",
  segments: [
    { from: 0, to: 2.3 },
    { from: 2.9, to: 5.55 },
  ],
};

// At a real wedding: the photographer glances at a pose card on the camera, then the couple in that pose.
// Landscape HD, 50 fps, 7.25 s, no sound (source/wedding-shoot.mov). The couple needs a signed release for paid ads.
export const SHOOT = { src: "footage/wedding-shoot.mp4", size: { w: 1920, h: 1080 } };

// Text cards drawn by the site's own renderer (scripts/render-cards.mjs).
export const CARDS = {
  timeline: "cards/timeline.png",
  groups: "cards/groups.png",
  shotlist: "cards/shotlist.png",
};

// Pose-pack cards from the website (In Principio's own weddings, 760×1140).
export const PACK = ["showcase/pack-01.jpg", "showcase/pack-02.jpg", "showcase/pack-03.jpg", "showcase/pack-04.jpg"];
// The generic photo feed on the phone in the "problem" shots.
export const PHONE_GRID = ["showcase/pack-01.jpg", "showcase/live-couple.jpg", "showcase/pack-02.jpg", "showcase/pack-03.jpg", "showcase/pack-04.jpg", "showcase/live-couple.jpg"];

// Music, once licensed for paid ads: drop the file in public/music/ and set the path, e.g. "music/track.mp3".
// adA2 and adPov are composed and synthesised by scripts/music.py on each ad's own timeline: no licence needed.
export const MUSIC: { launch: string | null; ads: string | null; adA2: string | null; adPov: string | null; adA4: string | null; adA5: string | null; adA6: string | null } = {
  launch: null,
  ads: null,
  adA2: "music/ad-a-v2.wav",
  adPov: "music/ad-pov.wav",
  adA4: "music/ad-a-v4.wav",
  adA6: "music/ad-a-v6.wav", // v4's track on v6's clock
  adA5: "music/ad-a-v5.wav", // quiet bed (pad + arpeggio) under the v5 sound design
};
