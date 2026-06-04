# web-next — Pose Cards page for the NotaLucis web (Next.js / React)

Drop-in version of the Pose Cards tool as a React page, ready to paste into the
`Wedding-manager-` (NotaLucis web) app. It calls the same Python `/api/convert`
function as the standalone build — only the UI layer differs.

## Files
```
app/pose-cards/page.tsx          App Router page (route: /pose-cards)
components/PoseCards.tsx          the wizard (client component, no extra deps)
components/PoseCards.module.css   scoped styles, In Principio theme (no Tailwind needed)
lib/cardsApi.ts                   client: downscale + POST -> ZIP blob
```

## Integrate

### App Router (`app/`)
1. Copy `components/PoseCards.tsx`, `components/PoseCards.module.css`, and
   `lib/cardsApi.ts` into the NotaLucis app (keep the relative import paths, or
   adjust them to your alias e.g. `@/components`, `@/lib`).
2. Copy `app/pose-cards/page.tsx` to add the `/pose-cards` route — or just render
   `<PoseCards />` wherever you want it (e.g. inside an existing landing section).
3. Add a nav/menu link to `/pose-cards`.

### Pages Router (`pages/`)
Create `pages/pose-cards.tsx`:
```tsx
import dynamic from "next/dynamic";
const PoseCards = dynamic(() => import("../components/PoseCards"), { ssr: false });
export default function PoseCardsPage() {
  return <PoseCards />;
}
```

## Point it at the converter API
The page posts to `${NEXT_PUBLIC_CARDS_API_URL}/api/convert`.

- **Co-located** (recommended): also copy the repo's `api/convert.py`, `converter/`,
  `requirements.txt`, and `vercel.json` into the NotaLucis project. Leave
  `NEXT_PUBLIC_CARDS_API_URL` unset → the page calls the same origin `/api/convert`.
- **Separate**: keep the standalone deployment and set, in the NotaLucis project's
  Vercel env, `NEXT_PUBLIC_CARDS_API_URL=https://<your-cards-app>.vercel.app`.
  (The function already sends permissive CORS headers.)

## Theme
Colors/fonts are CSS variables on `.wrap` in `PoseCards.module.css`
(`--ink #1a2620`, `--accent #a83e2f`, `--bg #fbf8f2`, Georgia serif). Override them
to match the surrounding NotaLucis page if needed.

## Note
Untested in a real build here (the `Wedding-manager-` repo isn't in this session).
It's standard React with no extra dependencies; once that repo is added to the
session I can wire it in and run its build/lint.
