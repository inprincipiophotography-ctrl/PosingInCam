# Design audit: cards.notalucis.com (October 2026)

Tools: Impeccable (`.claude/skills/impeccable`, `impeccable detect`), TasteSkill v2 linter
(`.claude/skills/taste-skill/scripts/lint.mjs`), and Playwright screenshots at 375, 768 and 1280 px.
Product context is in `PRODUCT.md`.

**Ground rule:** the NotaLucis look (Inter + Instrument Serif, one red accent, dot grid, soft
shadows, italic-serif eyebrows) is binding. Both tools list several of these as typical AI defaults.
Here they are a deliberate brand, so those findings are ignored.

## Fixed

| Finding | Where | Fix |
|---|---|---|
| Uppercase, letter-spaced pill label above the hero heading (a common AI tell) | `.eyebrow-pill` | Uses the brand's own italic-serif eyebrow, the same style as every other section |
| Rounded-square number tiles beside each step and each pose-pack part | `.st b`, `.parts .n` | Plain serif numerals in the accent colour |
| Four boxed, shadowed cards stacked in the pose-pack list | `.parts li` | A single list split by hairlines |
| Eleven separate floating FAQ cards | `.faq-list`, `.faq-item` | One surface with dividers; an open question turns accent-coloured |
| Side-stripe accent border | `.instructions pre` | Removed the 3px left stripe |
| 10.5px functional text on phones (below the 11px floor) | `.pz-own` (mobile) | 11.5px |
| Orphans and ragged headings | `.section-h`, hero h1, final CTA | `text-wrap: balance` on headings, `pretty` on body copy |
| "3-inch" breaking at the hyphen | pose-pack lede | Non-breaking hyphen |

## Reviewed and kept

- **Inter / Instrument Serif, the red gradient on the final CTA card and the brand mark, the button glow:** brand.
- **64 × "1.0:1 contrast" on `#1c1c1e`:** false positive. The text is SVG on the white card screen inside the dark tile bezel.
- **`border-left:8px` at `styles.css:276`:** a CSS triangle used as the play icon, not a stripe.
- **"Children flush against border" on `.strip`, `.why-table` and `.faq-list`:** full-width rows by design; each row carries its own padding.
- **Demo `.dkey.deco` contrast at 2.6:1:** a decorative camera button inside the illustration.
- **TasteSkill bans (all shadows, eyebrows, 1px borders, gradients):** that house style conflicts with the brand. Its linter is useful only as a second opinion.

## Open ideas (not done)

- The Pro card shows "Coming soon" when `/api/prices` is unreachable. That only happens locally, but a softer fallback would help if the API ever fails in production.
- `/impeccable critique` on the demo page (`demo/index.html`) as a separate pass.
- img2threejs: a 3D camera in the hero. This was ruled out for now because of weight (three.js) and the CSP.
