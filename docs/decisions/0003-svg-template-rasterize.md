# ADR 0003: Card layout is a Jinja2-templated SVG, rasterized at build time

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-05-05 |
| **Deciders** | TBD |

## Context

A card has fixed structural regions (header, illustration, two-column positioning, camera notes, verbal cue, footer) but variable content per pose. We need a layout system that:

- A designer can edit without writing code.
- Composes vector illustrations cleanly (no rasterization until the end).
- Outputs the same image every time given the same input (determinism).
- Renders crisply at the camera's native dimensions (e.g. 3840×2560).

## Options considered

- **Jinja2-templated SVG → cairosvg/resvg → JPEG.**
- **Pillow drawing primitives** (`ImageDraw.text`, `paste`, etc.).
- **Headless Chromium** rendering an HTML/CSS card.
- **Matplotlib / PlotNine** as a layout engine.
- **TeX / typst** via PDF intermediate.

## Decision

Jinja2-templated SVG, rasterized via cairosvg (with resvg as a fallback we may switch to).

## Consequences

- Layout lives in `src/posingincam/render/templates/card_default.svg.j2`. Designers can edit it in any SVG editor and a text editor.
- Variables come from the `Pose` Pydantic model; binding is one line of Jinja2.
- Multiple templates (default, landscape, square) can coexist for different camera aspect ratios.
- Determinism is good — cairosvg/resvg are deterministic given the same inputs and version.
- Text rendering quality is excellent (vector all the way).
- Bundled fonts in `assets/fonts/` ensure consistency across machines.

## Alternatives, rejected

- **Pillow primitives**: imperative, painful to iterate on layout. Designers hate it.
- **Headless Chromium**: huge dependency, slow startup, version-sensitive determinism.
- **Matplotlib**: not a layout engine; you fight it for typography.
- **TeX/typst**: overkill, and PDF→JPEG is an extra rasterization hop with its own quirks.
