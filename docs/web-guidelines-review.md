# Web Interface Guidelines review: cards.notalucis.com (October 2026)

Skill: Vercel `web-design-guidelines` (`.claude/skills/web-design-guidelines`, from vercel-labs/agent-skills @1a2c79d).
Rules: `vercel-labs/web-interface-guidelines/command.md`, fetched fresh on 28 October 2026.
Scope: `index.html`, `demo/index.html`, `404.html`, `assets/styles.css`, `assets/demo.css`, `assets/app.js`, `assets/demo.js`,
`assets/cam3d.js`, `assets/cam3d-scene.js`, `assets/grid-bg.js`. Also checked live with Playwright: a Tab walk through
every focusable element (desktop and phone), accessible names and labels, image dimensions, and reduced motion.

Tags: **fixed** in this pass · **suggestion** (needs a decision) · **kept** (deliberate: brand, voice, or does not apply).

## index.html

index.html:84 - `#project-new` had no label when shown under the project select → aria-label + name + autocomplete=off (**fixed**)
index.html:124-129 - pose inputs lacked `name` and `autocomplete` → added, autocomplete=off (**fixed**)
index.html:139 - `#list-label` lacked name/autocomplete (**fixed**)
index.html:148 - `#paste-text` lacked name/autocomplete (**fixed**)
index.html:159-162 - if-found fields lacked `name`; email lacked `spellcheck=false`; note lacked autocomplete=off (**fixed**)
index.html:174 - `#board-label` lacked name (**fixed**)
index.html:189 - `.mini` preview (phones) paged cards on click only: a div with a click handler and no keyboard path → role=button, tabindex, aria-label, Enter/Space (**fixed**)
index.html:364 - Monthly/Yearly toggle showed its state by colour only → aria-pressed, kept in sync in app.js (**fixed**)
index.html:380-382 - straight quotes in FAQ copy ("Any image", "preview", "Emma's board") → curly quotes (**fixed**)
index.html:417 - login email had a placeholder but no label → aria-label; spellcheck=false (**fixed**; no `name`, so the address can never land in a URL if JS fails)
index.html:35 - brand name could be machine-translated → translate="no" (**fixed**, also demo/index.html:33)
index.html:21 - theme-color `#a40000` (red) vs page background `#fbfbfd` (**suggestion**: rule says match the background; a red browser bar may be a brand choice)
index.html:124-129 - placeholders "e.g. …" do not end with `…` (**kept**: they are examples, not patterns)
index.html:221 - hero video loops >5 s beside content with no pause control (**suggestion**: add a small pause button; it already stops under reduced motion)
index.html:221 - poster is the above-the-fold image (**suggestion**: `<link rel="preload" as="image" fetchpriority="high">` for hero-poster.jpg)
index.html:89, :259, :273 … - headings in sentence case, not Title Case (**kept**: house style)
index.html:378-388 - "we" voice in FAQ (**kept**: Kim & Ivan speak as the makers, per PRODUCT.md)

## demo/index.html

demo/index.html:141 - `#end-name` lacked name (**fixed**)
demo/index.html:55 - caption region is aria-live and changes every few seconds while the film autoplays (**suggestion**: announce only when the user is driving: paused or seeking)
demo/index.html:19 - theme-color as above (**suggestion**)

## 404.html

✓ pass

## assets/styles.css

assets/styles.css:50-52 - no `touch-action: manipulation`, tap highlight never set → manipulation on interactive elements, brand-tinted tap highlight (**fixed**)
assets/styles.css:499 - modal had no `overscroll-behavior: contain` (**fixed**)
assets/styles.css:426 - price amounts change with the Monthly/Yearly toggle without tabular figures (**fixed**)
assets/styles.css:260 - "Card 1 of 3" counter without tabular figures (**fixed**)
assets/styles.css:257 - `.mini` focus ring for its new keyboard role (**fixed**)
✓ no `transition: all`; focus-visible rings on every control (checked live); reduced motion honoured (video paused, grid drift off, reveals off)

## assets/demo.css

assets/demo.css:38 - `.cap-title:focus{outline:none}` (**kept**: a non-interactive heading that receives programmatic focus with tabindex=-1)

## assets/app.js

assets/app.js:1421, :1427 - toggle state now mirrored in aria-pressed (**fixed**)
assets/app.js:860 - Enter/Space pages the phone preview (**fixed**)
assets/app.js:1322 - currency symbol and `toFixed(2)` by hand (**suggestion**: `Intl.NumberFormat("en", {style: "currency", currency})`)
assets/app.js:1505 - dates via `toLocaleDateString("en-GB")` (**kept**: an English site with one locale)

## assets/demo.js, assets/cam3d.js, assets/cam3d-scene.js, assets/grid-bg.js

✓ pass. The play button's label follows its state (Play/Pause/Watch again). The 3D camera and grid are aria-hidden, stop for reduced motion and touch, and read layout only on mount/resize and in pointer events.

## Live checks (Playwright)

- Tab walk: 55 stops on the homepage, 14 in the demo; every stop has a visible focus ring; none hidden under the sticky nav (the skip link sits above it, z-index 100).
- Accessible names: before → 2 inputs without a label (`#project-new`, `#login-email`); after → none.
- Images: all have width and height; below-the-fold ones are lazy.
- Reduced motion: hero video paused, background grid not animating, scroll reveals off.
