# Illustration Pipeline

How to produce a high-quality line-art SVG for a pose, and where to put it.

This is the "art" half of the project. The generator (`posingincam`) only
**composites** illustrations into camera-ready cards — it does not draw them.
A pose without a real illustration ships with the placeholder stick-figure,
which is fine for development but **not** for v1 release.

| Field | Value |
| --- | --- |
| **Status** | Draft v0.1 |
| **Last updated** | 2026-05-06 |

---

## The brief

Each pose needs **one** SVG illustration that shows the pose at a glance.
Looking at our reference benchmark (Cue), the bar is:

- Hand-drawn, gestural line art. Not photoreal.
- Single line color (we render in white-on-dark for the card,
  dark-on-light for the embedded thumbnail — same SVG, themed via
  `currentColor`).
- No fills (or only minimal accents like joined hands).
- Anatomically plausible: rounded shoulders, hair flow, clothing drape.
- Compositionally readable at 160×120 (the camera grid-view thumbnail).

A bare stick figure does not pass. A photo does not pass (won't theme,
won't simplify to thumbnail). A 3D rendered figure does not pass (too
busy at thumbnail size).

## Three production paths

Pick one based on what you have access to.

### Path A — Commission an illustrator (best quality)

Brief them with the [style guide](#style-guide) below. Roughly $5–25 per
illustration on Fiverr / Upwork; $50–200 from a brand illustrator. For 100+
poses, batch in groups of 10 with one consistent illustrator for visual
unity. Cue clearly went this route.

### Path B — AI generate, then vector-trace (fastest)

Use Midjourney v6, DALL-E 3, or Stable Diffusion + ControlNet. Prompt
template that we've found works:

```
minimal continuous line drawing, single white stroke on solid black background,
[POSE DESCRIPTION], clean gestural illustration, no shading, no color fills,
hand-drawn aesthetic, 3:2 aspect ratio, vector-art style, --ar 3:2 --no text
```

Replace `[POSE DESCRIPTION]` with something like:

- "couple walking toward camera holding hands, full body, three-quarter view"
- "couple cheek to cheek embracing, upper body portrait, intimate"
- "engagement pose with bride leaning into groom, golden-hour silhouette feel"

After generation:

1. **Pick the strongest image**. Look for: clean closed lines, no muddy
   sections, anatomically passable.
2. **Vectorize it.** Free tools that work:
   - [vectorizer.io](https://vectorizer.io)
   - [vectormagic.com](https://vectormagic.com)
   - Adobe Illustrator → Image Trace → Sketch Art preset
   - Inkscape → Path → Trace Bitmap → Brightness threshold
3. **Clean the SVG** (see [Cleanup checklist](#cleanup-checklist)).
4. **Drop into `assets/illustrations/<pose-slug>.svg`.**

Time per illustration: 5–15 minutes once you have the prompt dialed.

### Path C — Trace from a real photo (hybrid)

If you photograph the pose yourself (with a friend, partner, or model
release), you control the source. Then either:

- Run through ControlNet's `lineart_anime` or `scribble` model.
- Manually trace in Illustrator / Procreate over the photo.

Same cleanup pipeline as Path B.

---

## Style guide

### Visual

- **Aspect ratio**: 3:2 (e.g. `viewBox="0 0 600 400"`). Same as the camera
  card aspect. Other ratios get letter-boxed.
- **Stroke**: 2–4px in source units, **rounded line caps and joins**.
- **Stroke color**: always `currentColor` so the card template can theme.
- **Fills**: `none` on all path elements. Exception: a single solid dot
  for "joined hands" or similar anchors, also `fill="currentColor"`.
- **No shading, hatching, gradients, or color**.
- **No text** in the illustration. The card adds title/labels separately.
- **Composition**: subjects centered with breathing room. The camera's
  grid view scales this to 160×120 — anything subtler than ~1/8 of the
  long edge gets lost.
- **Stylistic continuity** across the library matters more than any one
  illustration's perfection. If you're using AI, use the same prompt
  formula and seed strategy across a batch so they look like a set.

### Technical (SVG)

- One root `<svg>` element, no nested.
- `viewBox` set, `width`/`height` either set or omitted.
- All visible elements inside one `<g>` with shared stroke attrs.
- Use `stroke="currentColor"` (not hard-coded `#000` or `#fff`).
- File size under 50 KB after cleanup. If yours is larger, the trace
  picked up too much noise — simplify the path count.

### Cleanup checklist

After exporting from a vectorizer, before committing:

- [ ] Open in a text editor. Confirm one root `<svg>`.
- [ ] Replace any `stroke="#000000"`, `stroke="#FFFFFF"`, etc. with
      `stroke="currentColor"`.
- [ ] Remove any `<rect>` background fills (we provide our own bg).
- [ ] Confirm `fill="none"` on all line elements.
- [ ] Run through [SVGOMG](https://jakearchibald.github.io/svgomg/) to
      compress (defaults are fine; **uncheck** "remove viewBox").
- [ ] Open in a browser on a dark background — does it read?
- [ ] Resize to 160×120 in your browser — does it still read?
- [ ] If yes to both, drop in `assets/illustrations/<your-slug>.svg`.

---

## Reference: how the SVG flows through our pipeline

```
assets/illustrations/<slug>.svg
        │
        │  loaded by render/layout.py via xml.etree.ElementTree
        │  (handles nested svg, single quotes, CDATA)
        ▼
     <svg ... viewBox="0 0 600 400">
       <g stroke="currentColor" fill="none">
         <path d="..."/>
         ...
       </g>
     </svg>
        │
        │  inlined into card template (white-on-dark via wrapping
        │  <g color="#FFFFFF">)
        │  also inlined into the EXIF thumbnail (160x120, dark on light)
        ▼
     final JPEG with both renderings
```

If your illustration looks great as standalone but breaks inside the card,
it's almost always because:

1. You hard-coded a stroke color instead of `currentColor`. Fix in the SVG.
2. You set `width`/`height` in pixels instead of relying on `viewBox`.
   Remove the `width`/`height` attrs or set them in `%`.
3. You included a `<rect>` background covering the card. Remove it.

---

## Open questions

- **Do we standardize on a single illustrator/AI for the v1 library?**
  Visual unity matters. TBD before M4 starts.
- **How do we handle illustrations of identifiable people?** We
  default to anonymous silhouettes / partial faces. If a contributor
  submits an illustration of a recognizable person, we need their model
  release, archived in `assets/illustrations/_releases/`. (M4 work.)
- **Multiple variants per pose?** Cue ships Light + Dark and Portrait +
  Landscape. We currently render one card per pose. If we add variants,
  the illustration is the same — only the card template changes. Probably
  M5+ work.
