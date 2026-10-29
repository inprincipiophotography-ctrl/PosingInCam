// Markdown versions of the site's pages, served by middleware.js to agents
// that ask for text/markdown (and at /index.md, /demo.md, ...). Keep them in
// step with the HTML pages; qa/test_agents.py checks that every page has one.
// Prices mirror the live Stripe prices (GET /api/prices); update both together.

const SITE = "https://cards.notalucis.com";
const MAIL = "notalucis.dev@gmail.com";

const FOOT = `
---
Shoot Cards is a NotaLucis tool, made by wedding photographers Kim & Ivan.
[Home](${SITE}/) · [Demo](${SITE}/demo) · [About](${SITE}/about) · [Contact](${SITE}/contact) · [Privacy](${SITE}/privacy) · [llms.txt](${SITE}/llms.txt) · [Sitemap](${SITE}/sitemap.xml)
`;

export const PAGES = {
  "/": `# Shoot Cards: pose cards in your camera's playback

> Shoot Cards turns poses, a wedding timeline, family groups, a shot list, settings recipes, an "if found" contact card and your own designs into JPEG cards that Sony, Canon and Nikon cameras show in playback, next to your real photos. For wedding and portrait photographers. Made by Kim & Ivan (In Principio, NotaLucis).

## What it does

A normal image copied to an SD card does not show up in a camera's playback: cameras only display files saved in their own format (size, metadata, folder and file name). Shoot Cards writes each card exactly the way the camera writes its own photos, so the photographer can press play between shots and read the plan on the camera instead of a phone or paper.

- **Pose cards:** a reference photo, the exact words to say to the couple, camera settings, the posing hack and the energy to aim for. Pick one of ours or use your own photo.
- **Timeline:** the day's schedule, to the minute.
- **Family groups:** every group by name, in order.
- **Shot list:** every must-have frame.
- **Settings:** recipes for tricky light.
- **If found:** the owner's contact card, in case the camera goes missing.
- **Any image:** the couple's Pinterest pins, a moodboard, Canva or Photoshop exports. Up to 30 at once, with an optional label ("Emma's board · 3/12").

Long lists are split across several cards automatically so each one reads at a glance on a 3-inch screen.

## How it works

1. Make the cards on ${SITE}/ (pick a type, fill in a few lines, choose Sony, Canon or Nikon).
2. Download the ZIP and copy its one folder to the SD card (instructions are inside the ZIP).
3. On the day, press ▶ between shots. The cards are dated 1 January 2024, so they sit in their own group in date view.

## Cameras

Tested on Sony A7 III, A7 IV and A7 V, Canon R6, R6 II and R6 III, and Nikon Z6, Z8 and Z9. Expected to work on most current Sony Alpha, Canon EOS R and Nikon Z bodies. Fujifilm and Panasonic are not supported yet. The cards are ordinary JPEGs: nothing is installed and existing photos are untouched.

## Pricing

- **Free:** the first card needs no account. Signing in with an email link (no password) adds 3 more free cards and saved projects. Free cards carry a light "preview" watermark.
- **Pro:** €29.99 once, no subscription. No watermark and no card limits, every card type, saved projects. Nothing renews; a receipt and an invoice come by email.
- **Wedding pose pack:** 50 ready-made wedding poses, sold separately in the In Principio shop: https://www.inprincipioweddings.com/store/in-camera-posing
- 14-day money-back guarantee: if the cards don't show up on the camera, email ${MAIL} for a full refund.

## Good to know

- No Canva or design skills needed.
- The couple's Pinterest pictures stay a private reference; nothing is shared.
- Most Sony bodies show the cards straight away; if one doesn't, the included instructions have a one-minute fix (Recover Image Database).
- Pro is one payment: nothing renews and there is nothing to cancel.

## Links

- Make a card: ${SITE}/#studio
- One-minute demo: ${SITE}/demo
- About the makers: ${SITE}/about
- Contact and support: ${SITE}/contact
- Privacy: ${SITE}/privacy
- For agents: ${SITE}/llms.txt
${FOOT}`,

  "/demo": `# See how Shoot Cards works, in a minute

> A one-minute film on ${SITE}/demo showing pose cards in a real camera's playback, why an ordinary picture won't show, the couple's Pinterest board on the camera, and how a card is made, copied to the SD card and there between shots.

## What the film shows

1. **Between shots:** the photographer presses play and turns the wheel; the next pose card appears, straight from the SD card.
2. **Why not just copy any picture:** the camera ignores files that are not in its own format, so an ordinary JPEG or PNG never shows in playback.
3. **The bride's board:** her Pinterest pins and moodboard as numbered cards on the camera.
4. **Making a card:** pick a type, fill in a few lines, choose the camera brand, download.
5. **Onto the card:** copy one folder to the SD card, put it back in the camera, press play.

The demo needs JavaScript in a browser. Everything it shows can be done for free on ${SITE}/#studio (the first card needs no account).
${FOOT}`,

  "/about": `# About Shoot Cards

Shoot Cards is made by **Kim & Ivan**, wedding photographers at In Principio (https://www.inprincipioweddings.com) and the people behind NotaLucis (https://notalucis.com), the CRM for photographers. Shoot Cards is a NotaLucis tool.

## Why we built it

At a wedding there is no good moment to take out a phone. Guests see someone scrolling, the screen glares in the sun, and the couple waits while you look for the next pose or the list of family groups. Printed lists get lost in a pocket and need reprinting for every wedding. We wanted the plan in the one place our hand already is: the camera.

Cameras only show files saved in their own format, so we worked out how each brand writes its photos (image size, metadata, folder and file names) and built a converter that writes cards the same way. Then we used it on our own weddings, weekend after weekend, before opening it to other photographers.

## What it is today

- Pose cards with a reference photo, the words to say to the couple, settings, a posing hack and the energy to aim for.
- Timeline, family groups, shot list, settings recipes and an "if found" contact card.
- Any image: the couple's Pinterest pins, moodboards, your Canva or Photoshop designs.
- Tested on Sony A7 III/IV/V, Canon R6/R6 II/R6 III and Nikon Z6/Z8/Z9.
- The first card is free with no account; Pro removes the watermark and the limits.

## Who is behind it

- **Kim & Ivan**, In Principio: wedding photography. The 50-pose wedding pack comes from our own shoots.
- **NotaLucis**: our software for photographers (client management), of which Shoot Cards is one tool.

Questions, a camera that doesn't show the cards, or ideas: ${SITE}/contact
${FOOT}`,

  "/contact": `# Contact Shoot Cards

Email: **${MAIL}**

We are Kim & Ivan, the two wedding photographers who make Shoot Cards. Every message is read by us, not a ticket system.

## Write to us about

- **A camera that doesn't show the cards.** Tell us the exact camera model, which folder you copied the cards into, and what playback shows (a screenshot or phone photo of the screen helps). Most cases are fixed in a minute.
- **A refund.** If the cards don't show up on your camera within 14 days of buying, you get a full refund. Write from the email you signed in with.
- **Billing.** Pro is one payment, so there is nothing to cancel. For a copy of your invoice or anything else about a payment, email us.
- **Your data.** Ask for a copy of your data or for your account and stored cards to be deleted. See ${SITE}/privacy.
- **Ideas and camera support.** Fujifilm and Panasonic support is coming; tell us which body you shoot.

## Elsewhere

- Wedding pose pack and our studio: https://www.inprincipioweddings.com
- NotaLucis, the CRM for photographers: https://notalucis.com
${FOOT}`,

  "/privacy": `# Privacy at Shoot Cards

Last updated: 29 October 2026

Shoot Cards (${SITE}) is run by Kim & Ivan, the wedding photographers behind In Principio and NotaLucis. Questions or requests about your data: **${MAIL}**.

## What we collect and why

- **Your email address**, when you sign in. We use it to send the sign-in link, to keep your account and to tell you about payments. Sign-in is passwordless; there is no password to store.
- **The images you upload.** They are converted into camera cards on our server. The originals are not kept. If you are signed in, the converted cards are stored in your account so you can download them again under "Your projects". Signed-out preview cards are not stored.
- **What you made:** number of cards, camera brand, time, and project names you give. Used for your history, your free and paid allowance, and limits that prevent abuse.
- **Payments.** Stripe handles card details; we never see them. We keep your Stripe customer ID and your plan.
- **Security logs.** Sign-in attempts (email address and a keyed hash of your IP address, never the IP itself) are kept for 30 days to stop abuse. Our hosting keeps short technical logs.

We do not sell your data, show ads or build marketing profiles.

## Cookies and storage in your browser

- Strictly necessary cookies only: \`__Host-sc_at\` and \`__Host-sc_rt\` keep you signed in, \`__Host-sc_pkce\` (10 minutes) completes the sign-in link. They are HttpOnly and secure and cannot be read by scripts.
- Your browser's local storage remembers your camera choice, an unfinished card and similar preferences. It stays on your device.
- Visitor statistics (Vercel Web Analytics) use no cookies and no personal identifiers.

## Who processes data for us

- **Vercel** (hosting and serverless functions).
- **Supabase** (sign-in, database and file storage, in the EU, Ireland).
- **Stripe** (payments).
- **Cloudflare Turnstile** (the human check shown after repeated sign-in attempts).
- **Google Fonts** (the site's fonts are loaded from Google, which receives your IP address).

## How long we keep it

Your account, history and stored cards stay until you ask us to delete them. Security logs are deleted after 30 days. Payment records are kept as long as accounting law requires.

## Your rights

You can ask for a copy of your data, a correction, deletion of your account and stored cards, or restriction of processing, and you can object to processing. Email ${MAIL} from the address you signed in with. You can also complain to your data protection authority.

## Legal basis

Providing the service you asked for (account, cards, payments), our legitimate interest in keeping the service secure (logs and limits), and legal obligations (payment records).
${FOOT}`,
};

// Aliases: trailing slash and .md spellings of every page.
for (const path of Object.keys(PAGES)) {
  const md = path === "/" ? "/index.md" : `${path}.md`;
  PAGES[md] = PAGES[path];
  if (path !== "/") PAGES[`${path}/`] = PAGES[path];
}

export const NOT_FOUND = `# Page not found

There is no page at this address on Shoot Cards (${SITE}).

Shoot Cards makes pose cards, timelines, family groups and shot lists that show up in Sony, Canon and Nikon camera playback. Everything lives on a few pages:

- Homepage: ${SITE}/ (Markdown: ${SITE}/index.md)
- Demo: ${SITE}/demo
- About: ${SITE}/about · Contact: ${SITE}/contact · Privacy: ${SITE}/privacy
- For agents: ${SITE}/llms.txt
- Sitemap: ${SITE}/sitemap.xml
`;
