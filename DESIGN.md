---
name: Shoot Cards
description: Pose, timeline and shot-list cards that show up in your camera's playback, by NotaLucis.
colors:
  record-red: "#a40000"
  record-red-deep: "#7e0000"
  record-red-soft: "rgba(164,0,0,.08)"
  record-red-line: "rgba(164,0,0,.18)"
  record-red-wash: "#fff4f4"
  paper: "#fbfbfd"
  surface: "#ffffff"
  surface-sunk: "#f4f3f1"
  ink: "#1d1d1f"
  ink-soft: "#424245"
  muted: "#6e6e73"
  border: "rgba(0,0,0,.12)"
  border-soft: "rgba(0,0,0,.08)"
  camera-black: "#1c1c1e"
  ok: "#047857"
  error: "#be123c"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(40px, 5.2vw, 66px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(30px, 4.4vw, 48px)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.06em"
  accent-italic:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  control: "10px"
  button: "12px"
  card-sm: "16px"
  card: "20px"
  panel: "22px"
  feature: "28px"
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
    rounded: "{rounded.button}"
    padding: "13px 24px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.record-red-deep}"
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
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "30px 26px"
  camera-screen:
    backgroundColor: "{colors.camera-black}"
    rounded: "{rounded.card-sm}"
    padding: "9px"
---

# Design System: Shoot Cards

## Overview

**Creative North Star: "The Camera Back"**

The back of a camera is a calm, dark, exact surface where everything has to read in two seconds: a lit screen, a few firm buttons, one red dot that means something is happening. Shoot Cards borrows that discipline for a light web page. The page itself stays quiet (cool paper, black ink, a faint grid), so the real heroes, the camera body, the cards on its screen and the wedding photographs, carry the colour and the emotion.

Density is moderate and editorial: generous section spacing, short copy, one clear action per block. Type pairs a condensed, slightly literary serif for headlines with a precise grotesque for everything you read or press. The red is rare on purpose; when it appears it marks the action, the selected state or the word that matters.

Controls feel like a camera's own dials and buttons: precise and tactile. They have firm edges, a definite pressed state, and a small lift with a deeper shadow under the finger or cursor.

**Key Characteristics:**
- Light, cool paper with a faint 40px line grid that drifts and brightens around the cursor.
- One red accent (Record Red), used for action, selection and emphasis only.
- Instrument Serif for display and headlines, Inter for body, labels and controls.
- Real camera bodies and real wedding photographs; cards framed as camera screens.
- Precise, tactile controls: lift on hover, press on click, visible focus rings.

## Colors

A near-monochrome, cool-white paper palette with a single camera-red signal.

### Primary
- **Record Red** (`record-red`): primary buttons, selected states, focus rings, italic emphasis in the hero headline, card accents. The camera's record dot: it means "this is the action".
- **Record Red Deep** (`record-red-deep`): hover on primary buttons and red text on white (links, eyebrows, numerals) where the brighter red would be too loud for small type.
- **Record Red Soft** (`record-red-soft`): tinted fills behind upsells, nudges and the 4px focus halo on drop zones.
- **Record Red Line** (`record-red-line`): the hairline around a red-tinted fill, and text selection.
- **Record Red Wash** (`record-red-wash`): selected chips, the "Shoot Cards" column of the comparison table, hover on the white button inside the red closing card.

### Neutral
- **Paper** (`paper`): page background and inset fields; a cool off-white, never warm cream.
- **Surface** (`surface`): cards, the studio panel, pricing, FAQ, table.
- **Surface Sunk** (`surface-sunk`): segmented controls (camera picker, price toggle) and pressed-in areas.
- **Ink** (`ink`): headings and primary text. **Ink Soft** (`ink-soft`): body copy and secondary lines. **Muted** (`muted`): captions, notes, meta (darkened to pass AA).
- **Border** / **Border Soft**: control outlines and section dividers.
- **Camera Black** (`camera-black`): the bezel around card previews and the camera bodies; the only dark surface on the page.

### Status
- **OK** (`ok`) for success messages and "yes" ticks; **Error** (`error`) for failures and destructive hovers.

**The Record Dot Rule.** Red marks action, selection or the single emphasised word, never decoration. If a screen has more than one red-filled element competing above the fold, one of them is wrong.

**The Paper Stays Cool Rule.** Backgrounds are cool off-white (`paper`) and pure white (`surface`). No warm creams, beiges or tinted section bands.

## Typography

**Display Font:** Instrument Serif (with Georgia, serif)
**Body Font:** Inter (with -apple-system, Segoe UI, Roboto, sans-serif)
**Card Font:** Noto Serif (semi-condensed 600 and italic 400), only inside the pose cards the studio draws on canvas; never on the page itself.

**Character:** A tall, condensed serif with a handwritten-italic voice for headlines, paired with a neutral, exact grotesque for reading and pressing. The serif speaks; Inter instructs.

### Hierarchy
- **Display** (400, clamp(40px, 5.2vw, 66px), 0.98): the hero headline only. The italic serif word in Record Red carries the hook ("blank").
- **Headline** (400, clamp(30px, 4.4vw, 48px), 1.06): section headings, balanced (`text-wrap: balance`).
- **Accent Italic** (400 italic, 19–20px, 1.2): the short serif italic line above a section heading and the serif numerals (1, 2, 3) in lists and steps.
- **Title** (700, 15.5–17px): card and panel titles, list item leads.
- **Body** (400, 16–18.5px, 1.6): copy in Ink Soft, measure capped around 34–46em/ch; `text-wrap: pretty`.
- **Label** (600, 11–13px, 0.05–0.06em, uppercase): pricing tier names, table headers, badges.

**The Two Voices Rule.** Serif for what we say, sans for what you do. Buttons, fields, labels and data are always Inter; headlines and the occasional emphasised italic are always Instrument Serif.

## Layout

A centred single column of sections, each capped at 1060px (content) or 1180px (wide), with a fluid side gutter of clamp(16px, 4vw, 40px) and section padding of clamp(48px, 7vw, 96px). The hero is a two-column grid (pitch + studio on the left, the sticky camera video on the right) that collapses to one column below 980px. Card grids run three across, two below 980px, one below 640px; pricing stacks below 880px with the purchasable Pro plan first.

The background grid is 40px; it is decoration, not a layout grid, and content does not snap to it.

On touch screens every tappable control has a 44px-tall hit area. Anchor sections keep a 76px scroll margin for the sticky nav.

## Elevation & Depth

Layered and soft. Surfaces sit on the paper with long, low-opacity ambient shadows; depth increases as a response to interaction. The only dark, heavy object is the camera itself, which gets a deep shadow of its own.

### Shadow Vocabulary
- **Ambient** (`0 1px 2px rgba(0,0,0,.04), 0 10px 30px rgba(0,0,0,.05)`): tiles, FAQ, table, pricing cards at rest.
- **Lifted** (`0 2px 6px rgba(0,0,0,.05), 0 24px 60px rgba(0,0,0,.10)`): the studio panel, the video, the pose stack, hovered cards.
- **Hover contact** (`0 8px 20px rgba(0,0,0,.08)`, added under Lifted): the tighter shadow that appears as a card rises 4px.
- **Accent** (`0 6px 20px rgba(164,0,0,.24)` at rest, `0 10px 26px rgba(164,0,0,.3)` on hover): primary buttons only.
- **Camera** (`0 36px 70px rgba(0,0,0,.24), 0 4px 10px rgba(0,0,0,.18)`): the camera body in the live preview.

**The Lift On Touch Rule.** Surfaces are calm at rest. Hover lifts a card 4px (a button 2px) and deepens its shadow; pressing snaps a button 1px down in 50ms. With reduced motion, nothing moves; colour and border still change.

## Shapes

Rounded, consistent and slightly generous: corners grow with the size of the object. Fields 10px, buttons 12px, small cards and camera screens 16px, cards 20px, the studio panel 22px, the video and the closing card 26–28px, chips and badges fully pill-shaped. Borders are 1px hairlines; a selected state adds an inset 1px Record Red ring rather than a thicker border.

## Components

### Buttons
- **Shape:** gently rounded (12px); small buttons 10px.
- **Primary:** Record Red fill, white Inter 600 text, 13px × 24px padding, Accent shadow. Hover: Record Red Deep, lifts 2px, larger Accent shadow. Active: 1px down. Disabled: 50% opacity, no shadow, no lift.
- **Ghost:** white fill, hairline border, Ink text; hover turns border Record Red and text Record Red Deep.
- **Text buttons and links:** Record Red Deep, 600, underline on hover (3px offset); trailing arrows nudge 3px forward on hover and never wrap away from their last word.
- **Focus:** 2px Record Red outline, 2px offset, on every control.

### Chips
- **Style:** white pills with a hairline border, Ink Soft 500 text.
- **State:** hover tints the border red; selected gets Record Red Wash, an inset red ring and 600 weight.

### Cards / Containers
- **Corner Style:** 20px (pricing, table), 22px (studio), 16px (FAQ list, tiles).
- **Background:** Surface on Paper.
- **Shadow Strategy:** Ambient at rest, Lifted plus hover contact on hover.
- **Border:** Border Soft hairline; on hover a pricing card's border warms to 25% Record Red and its tier name turns red. The featured plan keeps a full Record Red ring.
- **Internal Padding:** 26–30px.

### Inputs / Fields
- **Style:** Paper fill, hairline border, 10px radius, 9px × 11px padding, 15px text (16px on phones to stop iOS zoom).
- **Focus:** 2px Record Red outline, border turns red, fill turns white.
- **Drop zones:** dashed 1.5px border; hover/drag/focus turns it red with a 4px Record Red Soft halo; filled turns solid green.

### Navigation
- Sticky, translucent paper bar (86% opacity, 20px blur, saturate 180%) with a hairline bottom border and a soft shadow once scrolled. Links Ink Soft 500 14px, hover Ink. Below 860px the links fold into a menu panel; the primary CTA shortens to "Free card".

### Camera Screen (signature)
- Card previews always sit inside a Camera Black bezel (16px radius, 9px padding), and live previews inside a full camera body (dark gradient, viewfinder hump, dial and buttons). Cards are never shown floating on paper without the camera around them, except in the fanned pose stack.
- The camera bodies (the live preview on the homepage, the camera in `/demo`) are drawn in 3D with three.js (`assets/cam3d.js` loads `assets/cam3d-scene.js` only once a camera is on screen). The model is built in code and measured off the CSS camera it covers, so its screen lands on the CSS screen canvas. The CSS camera keeps drawing the card, turning the wheel and pressing keys; the 3D model reads that state and only renders when something changes. It turns 10° to show its grip side, follows the mouse by up to 7°, and holds still with reduced motion or a touch screen. Without WebGL2 the CSS camera is shown, unchanged.

### Motion (assets/motion.js, signature)
- One system, used the same way everywhere: headlines (hero, section headings, closing card) rise in word by word as they come into view, and the hero's italic "blank" gets a red stroke drawn under it. Cards (projects, card-type tiles, pricing, the FAQ list) catch a soft light where the cursor is and tilt up to 5° towards it; project covers and the pose-pack stack fan out. The main buttons lean up to 6px towards the cursor. The camera picker's selection slides. A slow reel of real pose cards and the bride's-board photos runs under the hero and pauses on hover.
- Dialogs (sign-in, "Delete project?") dim the page and pop the card in; no backdrop blur (a blur over the looping video made Chromium flash the page).
- A closer look at a stored card: hover (or keyboard focus) shows it large beside the thumbnail; on touch screens a long press opens it full screen. A click or tap still picks the card.
- Shape, not fade (borrowed from a product-launch motion brief, October 2026): things change shape instead of crossfading or blurring in. The hero video and the studio camera open through a hexagonal iris. "Make my card" turns into a black pill that says what it is doing ("Making your card…", "Converting for Sony…", "Packing your ZIP…", "✓ Downloaded"), then springs back. Grids (card-type tiles, pricing) unfold like a paper map, centre first, then the plus, then the corners; on one column each item unfolds as it arrives. Ticks and numbers pop from zero on a spring (`--spring`, a `linear()` under-damped curve). Saved projects pop in once, one after another. On scroll the wordmark squeezes into its red mark. A link to the demo floods the page black from the click point; the demo contracts the flood on arrival. No glows, particles or glass.
- Reduced motion: headlines show at once, nothing tilts, leans, slides, scrolls, unfolds or floods; touch screens get no cursor effects.

### Background Grid (signature)
- A 40px line grid in Muted at 6% opacity drifts diagonally (40px every 22s); a 40% copy shows in a 200px radial circle around the cursor and fades out when the cursor leaves; a soft Record Red glow (10%, drawn as a radial gradient, not a blur filter) sits off the top-right corner. The lines are drawn on a canvas and move like a calm water surface: two slow waves (7px over 520px at 55px/s, 3px over 300px at 35px/s) lift and bend them, and the main wave's crests run diagonally a little brighter (5% to 14%); 30 fps, paused while the tab is hidden. With reduced motion it is the still CSS grid. Fixed behind content, pointer-events none, still under reduced motion, no cursor spotlight on touch.

## Do's and Don'ts

### Do:
- **Do** show the real thing: real camera bodies, real cards in a camera bezel, photographs from real weddings.
- **Do** keep Record Red for the action, the selection and the one emphasised word.
- **Do** use Instrument Serif for headlines and Inter for everything you read in detail or press.
- **Do** lift cards 4px and buttons 2px on hover, with the matching shadow step, and keep the 2px Record Red focus ring.
- **Do** give every tappable control a 44px hit area on touch screens.

### Don't:
- **Don't** introduce a second accent colour or warm the paper toward cream.
- **Don't** replace Inter or Instrument Serif; both are part of the shared NotaLucis identity.
- **Don't** use stock imagery or invented testimonials, ratings or counts.
- **Don't** show a card preview without its camera bezel.
- **Don't** add motion that ignores `prefers-reduced-motion`.
