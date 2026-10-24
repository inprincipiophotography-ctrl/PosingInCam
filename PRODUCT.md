# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Wedding and portrait photographers shooting Sony, Canon or Nikon bodies. Mid-shoot they need a pose, the day's timeline or the family-groups list without reaching for a phone in front of the couple and their guests. They visit the site on a phone or a laptop in the week before a wedding to prepare that day's cards.

## Product Purpose
Shoot Cards (cards.notalucis.com) turns poses, timelines, family groups, shot lists, settings recipes, an if-found card and the photographer's own Canva/Photoshop designs into JPEGs that the camera shows in playback next to real photos. Success: the photographer copies one folder to the SD card and never opens a phone during the shoot.

## Positioning
The camera itself is the reference screen. A normal image won't show in playback; Shoot Cards writes each card in the camera's own format (size, metadata, folder) so it appears like a photo the body shot. Made and used every weekend by working wedding photographers, not a generic template app.

## Operating Context
- Preparation: in the browser, a week or a day before the shoot; first card free without an account, then email sign-in, saved projects, Pro subscription (Stripe) and a separately sold 50-pose wedding pack from the In Principio shop.
- Use: on the day, in the camera's playback, read on a 3-inch screen in two seconds, often in bright sun.
- Cards are dated 1 January 2024 so date view groups them away from the day's shoot.

## Capabilities and Constraints
- Static HTML/CSS/vanilla JS front end (`index.html`, `demo/index.html`, `assets/`), Python serverless functions on Vercel (`api/`), Supabase auth and storage.
- Strict CSP in `vercel.json`: scripts only from `'self'`, fonts only from Google Fonts, no third-party script CDNs.
- Tested bodies: Sony A7 III/IV/V, Canon R6/R6 II/R6 III, Nikon Z6/Z8/Z9. Fujifilm and Panasonic are "coming soon", not supported.
- Free cards carry a "preview" watermark; Pro removes it and all limits; 14-day money-back guarantee.
- Open: the Pro card can render a "Coming soon" button (seen on a local run without Stripe prices); whether Pro is purchasable in production is unconfirmed.

## Brand Commitments
- Shoot Cards is a NotaLucis tool and shares the NotaLucis look with notalucis.com: Inter + Instrument Serif, one red accent, light theme. These are binding; do not replace them.
- Background: a faint 40px line grid that drifts slowly, brighter in a circle around the cursor (`assets/grid-bg.js`), with lifting cards and nudging arrows on hover. Asked for by the makers in October 2026 after chaseai.io; it replaced the NotaLucis soft dot grid on this site. Whether notalucis.com follows is undecided.
- Kim & Ivan, wedding photographers at In Principio and the people behind NotaLucis (the CRM for photographers), are the makers and the main proof of credibility.
- Voice: short, concrete, a working photographer talking to another one. No marketing filler.
- Formerly called Specula; accounts and cards carry over. The site no longer mentions the old name (FAQ entry removed October 2026).

## Evidence on Hand
- Real Sony camera video and poster: `assets/showcase/hero-poster.jpg` and the hero video.
- Pose photos shot at real weddings: `assets/showcase/` (`01.jpg`–`03.jpg`, `pack-*.jpg`, `cam-shot.jpg`, `live-couple.jpg`).
- The list of hardware-tested bodies above; `docs/CAMERA_TEST_RESULTS.md`.
- There are no testimonials, user counts, ratings or press. Do not invent any, and do not add stock imagery.

## Product Principles
1. The camera is the screen: everything is judged by how it reads in two seconds on a 3-inch display.
2. Show the real thing: real camera, real weddings, real makers.
3. Free first card, no account: let the photographer prove it on their own camera before paying.
4. Say it like a photographer: plain words, specific outcomes.

## Accessibility & Inclusion
WCAG 2.1 AA on the website (contrast, keyboard, focus, touch targets); cards themselves are designed for legibility on small camera screens in sunlight.
