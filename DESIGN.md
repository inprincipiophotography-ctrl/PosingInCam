---
name: Shoot Cards
description: Pose, timeline and shot-list cards that show up in your camera's playback, by NotaLucis.
colors:
  record-red: "#a40000"
  record-red-deep: "#7e0000"
  record-red-soft: "rgba(164,0,0,.08)"
  record-red-line: "rgba(164,0,0,.18)"
  record-red-wash: "#fff4f4"
  galactic-violet: "#7b3bff"
  bubblegum-pink: "#ff5fb4"
  bubblegum-ink: "#b0246e"
  bubblegum-soft: "rgba(255,95,180,.16)"
  bloom-pink: "oklch(.66 .22 345)"
  bloom-violet: "oklch(.58 .24 295)"
  marshmallow: "#f0f0f0"
  surface: "#ffffff"
  surface-sunk: "#e7e8ee"
  well: "rgba(240,240,243,.72)"
  glass-edge: "rgba(255,255,255,.95)"
  ink: "#15161c"
  ink-soft: "#3c3e48"
  muted: "#62646e"
  border: "rgba(20,28,58,.13)"
  border-soft: "rgba(20,28,58,.08)"
  camera-black: "#1c1c1e"
  ok: "#047857"
  error: "#be123c"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(58px, 6.4vw, 94px)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(30px, 4.4vw, 48px)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.012em"
  numeral:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  control: "10px"
  button: "12px"
  bevel-button: "14px 8px 14px 8px"
  card-sm: "16px"
  tile-screen: "18px"
  nav: "20px"
  panel: "22px"
  price: "24px"
  studio: "26px"
  bevel-studio: "30px 18px 30px 18px"
  video: "30px"
  pane: "40px"
  bevel-frame: "56px 40px 56px 40px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  grid: "40px"
  section: "clamp(48px, 7vw, 96px)"
  content: "1060px"
  wide: "1180px"
components:
  button-primary:
    backgroundColor: "{colors.record-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.bevel-button}"
    padding: "13px 24px"
  button-primary-hover:
    backgroundColor: "{colors.record-red-deep}"
  button-nav-cta:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "13px 24px"
  button-ghost-hover:
    textColor: "{colors.record-red-deep}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "7px 13px"
  chip-selected:
    backgroundColor: "{colors.record-red-wash}"
    textColor: "{colors.record-red-deep}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  glass-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "30px 26px"
  price-badge:
    backgroundColor: "{colors.bubblegum-pink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  camera-screen:
    backgroundColor: "{colors.camera-black}"
    rounded: "{rounded.tile-screen}"
    padding: "9px"
---

# Design System: Shoot Cards

## Overview

**Creative North Star: "Marshmallow Glass"**

The page is one frosted pane on a marshmallow-white ground, lit from its lower left by a Bubblegum Pink to Galactic Violet bloom; the real camera is the subject the HUD points at. Every panel is the same material: a white glass gradient with a bright top edge and a cool shadow, holding paler wells for inputs and lists the way a dashboard card holds its chart. Bevelled corners, diagonal hatch marks and ringed HUD nodes give the glass an instrument's precision, so it reads as equipment rather than candy.

Density is moderate and editorial: generous section spacing, short copy, one clear action per block. Instrument Serif speaks in headlines; Inter instructs in everything you read in detail or press. Record Red is the only action colour. Galactic Violet and Bubblegum Pink are light, not ink: they live in the bloom and in a handful of small marks, never on a button.

The camera keeps its own world inside this one. Camera bodies, bezels and the cards drawn on their screens stay camera black and keep the card's own colours; the glass frames them, it never tints them.

**Key Characteristics:**
- Marshmallow #F0F0F0 ground under a faint 40px line grid that rolls like calm water, with two soft blooms.
- Frosted glass panels with white hairline edges, cool shadows and darker inner wells.
- Record Red for every action, selection and focus; Galactic Violet and Bubblegum Pink only as bloom and small HUD marks.
- The OKLCH bloom (Bubblegum Pink through magenta to Galactic Violet) rising from a corner of each large pane.
- Bevelled corners (`corner-shape: bevel`) on the hero frame, studio, panes, primary buttons and closing card.
- Real camera bodies and real wedding photographs; cards always shown in a camera bezel.
- Shape, not fade: things rise, unfold, iris open and blink; nothing crossfades.

## Colors

A pale, cool marshmallow ground and white glass, one red signal for action (the NotaLucis Record Red), and a Bubblegum Pink to Galactic Violet light that only ever glows.

### Primary
- **Record Red** (`record-red`): primary buttons, the studio's "Make my card", selected chips and camera picker, the featured plan's ring, focus outlines, the italic "blank" in the hero headline, caret and accent-color. The camera's record dot: it means "this is the action".
- **Record Red Deep** (`record-red-deep`): hover on primary buttons and every small red text: links, link buttons, the white closing button's label.
- **Record Red Soft** (`record-red-soft`): tinted fills behind upsells and nudges, focus halos on drop zones.
- **Record Red Line** (`record-red-line`): hairline on a tinted fill, text selection, link underlines on text pages.
- **Record Red Wash** (`record-red-wash`): selected chips and the Shoot Cards column of the comparison table.

### Secondary and tertiary: the light
- **Galactic Violet** (`galactic-violet`): the far end of the bloom, the ring of the HUD nodes, the field of the closing card (white text on it), the brand mark's glow.
- **Bubblegum Pink** (`bubblegum-pink`): the near end of the bloom, the dot in the "Real Sony" HUD chip, the diagonal hatch stripes beside "Made for wedding & portrait photographers" and the upgrade line, and the one "Pay once" badge on the featured plan (Ink text on it).
- **Bubblegum Ink** (`bubblegum-ink`): Bubblegum dark enough for text (5.5:1 on Marshmallow): the serif step numerals in "how it works" and the numbered parts lists.
- **Bubblegum Soft** (`bubblegum-soft`): the 4px halo around the HUD chip's dot.
- **Bloom Pink** (`bloom-pink`) and **Bloom Violet** (`bloom-violet`): the middle stops of the bloom. Used only inside bloom gradients, at 24–50% alpha.

### Neutral
- **Marshmallow** (`marshmallow`): the page ground. Cool and neutral, never cream.
- **Surface** (`surface`): solid white for dialogs, menus, the peek preview, focused inputs and the base of the glass gradient.
- **Surface Sunk** (`surface-sunk`): pressed-in areas, inline code on text pages.
- **Well** (`well`): the paler inset a glass panel holds: inputs, drop zones, the camera picker, project batches, code blocks.
- **Glass Edge** (`glass-edge`): the white hairline around every glass panel and pane.
- **Ink** (`ink`): headings, primary text, the black nav pill and the "Make my card" busy pill. **Ink Soft** (`ink-soft`): body copy. **Muted** (`muted`): captions, notes, meta, and the grid lines (5.2:1 on Marshmallow).
- **Border** / **Border Soft**: control outlines and dividers, tinted cool navy rather than black.
- **Camera Black** (`camera-black`): the bezel around card previews and the camera bodies; the only dark surface besides the ink pills.

### Status
- **OK** (`ok`) for success and "yes" ticks; **Error** (`error`) for failures and destructive hovers.

### The Bloom
The bloom is `linear-gradient(in oklch 120deg, #ff5fb4, #7b3bff)` for strokes and the brand mark, and a stack of radial gradients (Bubblegum Pink at the corner, Bloom Pink, Bloom Violet, then Galactic Violet farthest out) for panes. The hero frame anchors it lower left; the card-types and pricing panes anchor it lower right so they answer the hero; the closing card carries it at full strength (Bubblegum Pink lower left over a Galactic Violet-to-magenta OKLCH field, white text). The live camera preview sits in a soft conic Violet/Pink halo.

**The One Signal Rule.** Record Red marks the action, the selection and the focus; nothing else on the page is red-filled. The nav CTA is black precisely so it never competes with the studio's red button.

**The Light Never Acts Rule.** Galactic Violet and Bubblegum Pink are light, not paint: bloom, HUD node rings, the HUD dot, hatch marks, numerals (as Bubblegum Ink), the closing card's field and the single "Pay once" badge. They never fill a button, a chip or a body of text, and they never mark a selection.

**The Camera Keeps Its Colours Rule.** Cards rendered for the camera (pose cards with their red bars, the card-type tile SVGs, everything `assets/builder.js` draws) keep their own palette. That is product output, not site UI; the site palette never recolours it.

## Typography

**Display Font:** Instrument Serif (with Georgia, serif)
**Body Font:** Inter (with -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif)
**Card Font:** Noto Serif, only inside the cards the studio draws on canvas; never on the page itself.

**Character:** A tall, condensed serif with a handwritten-italic voice for headlines and numerals, paired with a neutral, exact grotesque for reading and pressing. The serif speaks; Inter instructs. Both are binding NotaLucis identity.

### Hierarchy
- **Display** (400, clamp(58px, 6.4vw, 94px), 0.95, -0.028em on desktop; clamp(40px, 5.2vw, 66px) below 981px; clamp(36px, 10.5vw, 44px) on phones): the hero headline only, centred over the studio and camera. The italic "blank" is Galactic Violet over a bloom stroke.
- **Headline** (400, clamp(30px, 4.4vw, 48px), 1.06): section headings and the closing card (up to 52px, white), balanced.
- **Numeral** (400, 28px, 1): serif step numbers in Bubblegum Ink; they pop in on the spring.
- **Title** (700, 17px, -0.01em): studio and panel titles, list item leads.
- **Body** (400, 16–18.5px, 1.6): copy in Ink Soft, measure capped around 34–40em (68ch on text pages at 16.5px/1.7); `text-wrap: pretty`.
- **Label** (600, 11–13px, 0.04–0.06em, uppercase): pricing tier names, table headers, the "Made for…" line under the hero copy.

**The Two Voices Rule.** Serif for what we say, sans for what you do. Buttons, fields, labels and data are always Inter; headlines, numerals and the emphasised italic word are always Instrument Serif.

**The Heading Stands Alone Rule.** No kicker, eyebrow or tagline line above a heading. A section opens on its serif headline.

## Layout

A centred column of sections capped at 1060px (content) or 1180px (wide), with a fluid gutter of clamp(16px, 4vw, 40px) and section padding of clamp(48px, 7vw, 96px). Large panes (the hero frame, card types, pricing) are inset from the viewport by `gutter - 22px` so their glass edge sits just outside the content.

On desktop (981px and up) the hero headline runs centred across the top of the frame; under it the studio card (left) and the camera video (right) sit level at the top, the video stretching to the studio's height. While a card is being made, the two columns go equal and the camera stays level with the middle of the screen. Below 981px the hero stacks pitch, video, studio; the frame drops its border and keeps only the bloom. Card-type tiles run three across, two below 981px, one below 641px; pricing stacks below 881px with the purchasable Pro plan first.

The background grid is 40px; it is decoration, not a layout grid, and content does not snap to it. On touch screens every tappable control has a 44px-tall hit area. Anchor sections keep a 76px scroll margin for the floating nav.

## Elevation & Depth

Layered glass. Depth comes from translucency, a bright inset top edge and long, cool, low-opacity shadows tinted navy (`rgba(20,28,58,…)`), never black. The bloom lights panes from behind. The camera body is the one heavy dark object and gets a deep shadow of its own. Backdrop blur is used on the studio (22px), pricing cards (16px), HUD chips (12px) and the nav (20px), never on dialogs or over the looping video at page scale.

### Shadow Vocabulary
- **Glass** (`inset 0 1px 0 rgba(255,255,255,.95), 0 1px 2px rgba(20,28,58,.05), 0 18px 44px rgba(20,28,58,.09)`): every glass panel at rest.
- **Ambient** (`0 1px 2px rgba(20,28,58,.05), 0 12px 32px rgba(20,28,58,.07)`): tile screens and small surfaces.
- **Lifted** (`0 2px 6px rgba(20,28,58,.05), 0 28px 64px rgba(20,28,58,.12)`): the video, the featured plan, hovered cards.
- **Pane** (`inset 0 1px 0 #fff, 0 30px 70px rgba(20,28,58,.07)`): the hero frame and the card-type and pricing panes.
- **Accent** (`0 6px 20px rgba(164,0,0,.24)` at rest, `0 10px 26px rgba(164,0,0,.3)` on hover): red primary buttons only.
- **Ink pill** (`0 6px 16px rgba(20,22,28,.18)`, `0 10px 22px rgba(20,22,28,.24)` on hover): the black nav CTA and the demo play button.
- **Rim** (`0 0 0 6–8px rgba(255,255,255,.38–.55)`): a white halo ring around the video, tile screens and project covers, so dark screens sit inside the glass.

**The Glass Is The Material Rule.** Every panel (studio, pricing, FAQ, table, projects, dialogs, menus, the how-it-works strip) is the same glass: the white 90%→64% gradient, the white hairline edge, the Glass shadow. Inner content sits in Wells a step darker. Don't invent a second panel material.

**The Lift On Touch Rule.** Surfaces are calm at rest. Hover lifts a card 4px (a button 2px) and deepens its shadow; pressing snaps a button 1px down. With reduced motion, nothing moves; colour and border still change.

## Shapes

Rounded glass with bevelled cuts. Corners grow with the object: fields 10px, small buttons 10px, buttons 12px, the floating nav 20px, panels 22px, price cards 24px, the studio 26px, the video 30px, large panes 40px, chips, badges and the nav CTA fully pill-shaped.

Where `corner-shape: bevel` is supported, the defining objects alternate bevel and round corners (`bevel round bevel round`): the hero frame (56px/40px), the studio and the featured plan (30px/18px), the closing card (44px/28px), primary buttons (14px/8px) and the brand mark. The card-types and pricing panes flip the pattern (`round bevel round bevel`, 40px/56px). The nav links sit on one tab bevelled at its two lower corners. Elsewhere the same objects fall back to plain rounding.

**Hatch marks** are the system's measuring ticks: 30px squares of 135° diagonal lines (`rgba(20,28,58,.16)`, 2px on 7px) in the top-left and top-right corners of the hero frame and each pane; small 120° Bubblegum Pink stripe bars beside the "Made for…" label and the upgrade line; white 120° stripes in the closing card's lower right.

Borders are 1px hairlines; a selected state adds an inset 1px Record Red ring rather than a thicker border.

## Components

### Buttons
- **Shape:** bevelled 14px/8px where supported, else 12px; small buttons 10px.
- **Primary:** Record Red fill, white Inter 600 16px, 13px × 24px padding, Accent shadow (red). Hover: Record Red Deep, lifts 2px, larger Accent shadow, leans up to 6px towards the cursor. Active: 1px down. Disabled: 50% opacity, no shadow.
- **Nav CTA:** a black Ink pill (999px, 10px × 20px), white text, Ink pill shadow; hover goes pure black. It stays black even while the studio's own button is on screen. On phones it shortens to "Free card".
- **Ghost:** 72% white glass, hairline border, Ink text; hover turns white with a Red border and Red Deep text.
- **Closing button:** white on the bloom card, Red Deep label, turning Ink on hover.
- **Text buttons and links:** Record Red Deep, underline on hover (3px offset); trailing arrows nudge forward and never wrap away from their last word.
- **Focus:** 2px Record Red outline, 2px offset, on every control.

### Chips
- **Style:** 70% white pills with a hairline border, Ink Soft 500 13.5px; "+ 3 more" is a dashed transparent pill.
- **State:** hover tints the border red; selected gets Red Wash, Red Deep text, an inset Red ring and 600 weight.

### Cards / Containers
- **Corner Style:** see Shapes; price cards 24px, FAQ and table 22px, projects 22px.
- **Background:** the glass gradient on Marshmallow; dialogs, menus and the peek preview are solid white.
- **Shadow Strategy:** Glass at rest, Lifted on hover; cursor light and tilt up to 5°.
- **Border:** Glass Edge hairline. The featured plan carries a full Record Red ring and the Bubblegum Pink "Pay once" badge; other tier names turn Red Deep on hover.
- **Internal Padding:** 26–30px.
- **Panes:** card types and pricing sit in their own large bevelled glass panes with hatch marks top-left and top-right and the bloom anchored lower right.

### Inputs / Fields
- **Style:** Well fill, Border hairline, 10px radius, 9px × 11px padding, 15px text (16px on phones to stop iOS zoom).
- **Focus:** 2px Red outline, Red border, fill turns white.
- **Drop zones:** dashed border at 28% Red over a Well; hover, drag and focus turn it Red with a Red Soft halo; filled turns solid green.

### Navigation
- A frosted bar floating 10px below the top of the page, inset from the edges, 20px radius, white hairline edge and an inset highlight, its shadow deepening once scrolled. On desktop the links (Ink Soft 500 14px, hover Ink) sit together on one bevelled white tab; the brand mark is a small bevelled square filled with the bloom. Below 861px the links fold into a menu panel behind a round glass toggle.

### HUD Callouts (signature)
- On desktop, signed out, the hero video carries two ringed nodes on the camera's screen (white core, Violet ring, white outer ring, a slow white ping on a 2.6s loop, staggered) with white 1.25px leader lines running to two glass chips: "Real Sony · scrolling pose cards" with a Bubblegum Pink dot and halo, and "Try it yourself →", which turns white with Red Deep text on hover. Chips are 80% white with 12px backdrop blur. The ping stops with reduced motion; phones and the signed-in view show the chips without the nodes and lines.

### Camera Screen (signature)
- Card previews always sit inside a Camera Black bezel (18px radius on tiles, 9px padding) with a white Rim halo, and live previews inside a full camera body (dark gradient, viewfinder hump, dial and buttons). Cards are never shown floating on the glass without the camera around them, except in the fanned pose stack. The bezel stays camera black; only its caption picks up red on hover.
- The camera bodies (the live preview on the homepage, the camera in `/demo`) are drawn in 3D with three.js (`assets/cam3d.js` loads `assets/cam3d-scene.js` only once a camera is on screen). The model is built in code and measured off the CSS camera it covers, so its screen lands on the CSS screen canvas. The CSS camera keeps drawing the card, turning the wheel and pressing keys; the 3D model reads that state and only renders when something changes. It turns 10° to show its grip side, follows the mouse by up to 7°, and holds still with reduced motion or a touch screen. Without WebGL2 the CSS camera is shown, unchanged.
- Signed in, the live camera preview floats in a soft conic Violet-and-Pink halo beside the studio.

### Motion (assets/motion.js, signature)
- One system, used the same way everywhere: headlines (hero, section headings, closing card) rise in word by word as they come into view, and the hero's italic "blank" gets a bloom stroke (Bubblegum Pink to Galactic Violet) drawn under it. Cards (projects, card-type tiles, pricing, the FAQ list) catch a soft light where the cursor is and tilt up to 5° towards it; project covers and the pose-pack stack fan out. The main buttons lean up to 6px towards the cursor. The camera picker's selection slides. A slow reel of real pose cards and the bride's-board photos runs under the hero and pauses on hover.
- Dialogs (sign-in, "Delete project?") dim the page to a cool ink (`rgba(20,24,40,.32)`) and pop the card in; no backdrop blur on dialogs (a blur over the looping video made Chromium flash the page).
- A closer look at a stored card: hover (or keyboard focus) shows it large beside the thumbnail; on touch screens a long press opens it full screen. A click or tap still picks the card.
- Shape, not fade: things change shape instead of crossfading or blurring in. The hero video and the studio camera open through a hexagonal iris. "Make my card" turns into a black Ink pill that says what it is doing ("Making your card…", "Converting for Sony…", "Packing your ZIP…", "✓ Downloaded"), then springs back. Grids (card-type tiles, pricing) unfold like a paper map, centre first, then the plus, then the corners; on one column each item unfolds as it arrives. Ticks and numbers pop from zero on a spring (`--spring`, a `linear()` under-damped curve). Saved projects pop in once, one after another. On scroll the wordmark squeezes into its bloom mark. Going to another page is one shutter blink: the page closes from top and bottom over near-black and the next one opens from the middle (a native cross-document view transition, about 0.3s; browsers without it just navigate). Glass and the bloom are the material; there are still no particles, and no glow that moves.
- Reduced motion: headlines show at once, nothing tilts, leans, slides, scrolls, unfolds, pings or blinks; touch screens get no cursor effects.

### Background Grid (signature)
- A 40px line grid in Muted at 6% opacity drifts diagonally (40px every 22s); a 40% copy shows in a 200px radial circle around the cursor and fades out when the cursor leaves. Two soft blooms sit behind it, drawn as radial gradients, not a blur filter: Galactic Violet (12%) off the top-right corner and Bubblegum Pink (10%) off the bottom-left. The lines are drawn on a canvas and move like a calm water surface: two slow waves (7px over 520px at 55px/s, 3px over 300px at 35px/s) lift and bend them, and the main wave's crests run diagonally a little brighter (5% to 14%); 30 fps, paused while the tab is hidden. With reduced motion it is the still CSS grid. Fixed behind content, pointer-events none, no cursor spotlight on touch.

## Do's and Don'ts

### Do:
- **Do** show the real thing: real camera bodies, real cards in a camera bezel, photographs from real weddings.
- **Do** build every panel from the one glass material, with Wells for the content it holds.
- **Do** keep Record Red for the action, the selection and the focus, with the 2px Red focus ring on every control.
- **Do** keep Galactic Violet and Bubblegum Pink to the bloom, HUD marks, hatch stripes, Bubblegum Ink numerals, the closing card and the single "Pay once" badge.
- **Do** interpolate the bloom in OKLCH so Pink runs cleanly into Violet.
- **Do** use Instrument Serif for headlines and numerals, Inter for everything you read in detail or press.
- **Do** lift cards 4px and buttons 2px on hover, with the matching shadow step.
- **Do** give every tappable control a 44px hit area on touch screens.

### Don't:
- **Don't** put a kicker, eyebrow or tagline line above a heading.
- **Don't** fill a button, chip or body text with Violet or Pink, or add a second action colour.
- **Don't** recolour cards rendered for the camera to the site palette.
- **Don't** warm the Marshmallow ground toward cream or tint shadows black; shadows stay cool navy.
- **Don't** replace Inter or Instrument Serif; both are part of the shared NotaLucis identity.
- **Don't** use stock imagery or invented testimonials, ratings or counts.
- **Don't** show a card preview without its camera bezel.
- **Don't** blur a dialog backdrop or use a blur() filter for the blooms; draw them as gradients.
- **Don't** add motion that ignores `prefers-reduced-motion`.
