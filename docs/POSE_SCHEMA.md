# Pose Schema

| Field | Value |
| --- | --- |
| **Status** | Draft v0.1 |
| **Last updated** | 2026-05-05 |

This document is the source of truth for the YAML schema each pose file must conform to. The CLI's `validate` command enforces it, and the Pydantic model in `src/posingincam/pose/schema.py` is the implementation.

## File location and naming

Each pose lives in its own file under `poses/`:

```
poses/
  p-001-walking-hand-in-hand.yaml
  p-002-forehead-touch.yaml
  ...
  _packs/
    essential.yaml
    wedding-day.yaml
  _template/
    pose.yaml          # copy this when authoring a new pose
```

Filenames: `p-NNN-<slug>.yaml` where `NNN` is the three-digit pose ID and `<slug>` is the kebab-cased title.

## Schema

```yaml
# Required
id: P-042                         # string, must match pattern P-\d{3}, globally unique
slug: forehead-touch-walking-in   # kebab-case, must match the slug in the filename
title: Forehead Touch — Walking In # human-readable, ≤ 60 chars
pack: essential                   # one of the registered packs
illustration: illustrations/forehead-touch-walking-in.svg  # path relative to repo root
positioning:
  her:                            # 1–4 strings, each ≤ 80 chars
    - Walk slightly ahead, body angled 30° toward him.
    - Lead hand brushes his at hip height.
  him:                            # 1–4 strings, each ≤ 80 chars
    - Match her pace, half a step behind.
    - Free hand at his side, relaxed.
camera_notes:
  lens: 35mm or 50mm prime        # ≤ 60 chars
  aperture: f/1.8 – f/2.8         # ≤ 30 chars
  angle: Eye level, slight low.   # ≤ 60 chars
  distance: 8–12 ft, lead the walk. # ≤ 60 chars
verbal_cue: |                     # the literal sentence(s) you say out loud, ≤ 240 chars
  "Walk toward me holding hands.
   When you're three steps out, lean in
   and touch foreheads — keep walking."

# Optional
difficulty: 1                     # int 1..3, default 1
tags: [intimate, walking, golden-hour]  # array of registered tag strings
camera_notes.notes: Burst at 5–7 fps; the moment is the contact, not the approach.  # ≤ 200 chars
variations:                       # 0–3 strings, each ≤ 100 chars
  - Stop on contact instead of walking through.
  - Add a laugh prompt: "Now whisper something dumb."
authored_by: Jane Doe             # contributor name (optional, displayed in footer)
art_credit: Studio X              # illustrator credit (optional)
version: 1                        # int, increment when content changes after publish
```

## Field reference

### Required fields

| Field | Type | Constraint |
| --- | --- | --- |
| `id` | string | matches `^P-\d{3}$`; globally unique across the library |
| `slug` | string | kebab-case, must match the slug part of the filename |
| `title` | string | ≤ 60 chars |
| `pack` | string | must be a registered pack ID |
| `illustration` | path | relative path to a `.svg` file that exists |
| `positioning.her` | list[string] | 1..4 items, each ≤ 80 chars |
| `positioning.him` | list[string] | 1..4 items, each ≤ 80 chars |
| `camera_notes.lens` | string | ≤ 60 chars |
| `camera_notes.aperture` | string | ≤ 30 chars |
| `camera_notes.angle` | string | ≤ 60 chars |
| `camera_notes.distance` | string | ≤ 60 chars |
| `verbal_cue` | string (multiline) | ≤ 240 chars total |

### Optional fields

| Field | Type | Default | Constraint |
| --- | --- | --- | --- |
| `difficulty` | int | 1 | 1..3 |
| `tags` | list[string] | `[]` | each must be a registered tag |
| `camera_notes.notes` | string | none | ≤ 200 chars |
| `variations` | list[string] | `[]` | 0..3 items, each ≤ 100 chars |
| `authored_by` | string | none | ≤ 60 chars |
| `art_credit` | string | none | ≤ 60 chars |
| `version` | int | 1 | ≥ 1 |

## ID assignment

- IDs are stable forever. Once `P-042` is published, that ID never gets reused for a different pose.
- New poses get the next available `P-NNN`.
- A pose can be deprecated (`status: deprecated` field, post-v1 addition), which removes it from default builds but keeps the ID reserved.

## Verbal cue style guide

The verbal cue is the heart of the card. It's what the photographer says to the couple out loud. Style rules:

1. **Quote it.** Wrap in `"..."` to signal "say this".
2. **One imperative per beat.** "Walk toward me. Touch foreheads. Keep walking." not "Together, both of you should walk while embracing."
3. **Concrete, not abstract.** "Look at her left ear" beats "look at each other intimately."
4. **Length budget**: ~30 words, max two short sentences.
5. **No photographer jargon.** The couple shouldn't need to know what "lead with your trailing hip" means.

## Tag taxonomy (v0.1)

Registered tags. New tags require a small PR to update this list.

- Intent: `intimate`, `playful`, `editorial`, `candid`, `dramatic`, `documentary`
- Setting: `walking`, `seated`, `standing`, `dancing`, `embrace`, `kiss`
- Light/time: `golden-hour`, `blue-hour`, `harsh-light`, `flash`, `indoor`, `outdoor`
- Body: `full-body`, `half-body`, `close-up`, `hands`, `feet`, `silhouette`
- Composition: `wide`, `medium`, `tight`, `from-above`, `from-below`, `over-shoulder`

## Validation

`posingincam validate poses/` runs all checks and prints failures with file:line locations. Run before opening a PR; CI will run it on PR.

## Example: full minimal pose

```yaml
id: P-001
slug: walking-hand-in-hand
title: Walking Hand in Hand
pack: essential
illustration: illustrations/walking-hand-in-hand.svg
positioning:
  her:
    - Step in time with him, on his right side.
    - Look toward him, soft chin.
  him:
    - Lead by half a pace, hand low and relaxed.
    - Keep eyes ahead, jaw soft.
camera_notes:
  lens: 35mm or 50mm prime
  aperture: f/2.0
  angle: Slightly below eye level.
  distance: 10–15 ft, walking toward camera.
verbal_cue: |
  "Walk toward me, hand in hand.
   Eyes on each other on the count of three."
```
