# Pose Cards — go-live checklist

Tracked so nothing gets lost between sessions. (Excluded from the public deploy.)

## 📌 Open items (parked 29 Oct 2026, pick up later)
- [ ] Legal name (obrt / d.o.o.), address and country of the business → add to the Organization
      JSON-LD in `index.html` (`address` as PostalAddress) and to `/privacy` in `agent/pages.js`
      (then `node scripts/build-pages.mjs`)
- [ ] Have someone review the privacy policy (`/privacy`): it matches what the code does, but it
      is not legal advice
- [ ] Google Search Console: add `cards.notalucis.com`, submit `https://cards.notalucis.com/sitemap.xml`,
      then re-run https://is-agentic.com/scan/cards.notalucis.com (was 68/100)
- [ ] Prices are written in three places (JSON-LD in `index.html`, `agent/pages.js`, `llms.txt`):
      update all three whenever the Stripe price changes (`qa/test_agents.py` checks they agree)

## 🚀 Go live: Pro €29.99 once, straight in live mode (one pass, in this order)
The subscription (€3.99/mo, €30/yr) and the 20-pack are gone; Pro is €29.99 once. Test mode is
skipped: the code is covered by `qa/test_billing.py`, and one real purchase + refund proves the rest.

**Blockers before the first real euro**
- [ ] Legal name (obrt / d.o.o.) settled (open item above): Stripe activation and the invoices need it
- [ ] Accountant: VAT for EU consumers (OSS) and fiskalizacija for card payments; turn on Stripe Tax
      if they say so
- [ ] Vercel → Settings → Billing: Hobby → **Pro** (Hobby is non-commercial only); Spend Management
      e.g. $20/month, notifications 50/75/100 %, pause production deployments at 100 %

**Stripe (live mode, toggle top right OFF "Test mode")**
- [ ] Activate the account: business details, bank account for payouts
- [ ] Product catalog → "Shoot Cards Pro" → one-off price €29.99 → copy the live `price_…`
- [ ] Developers → Webhooks → add endpoint `https://cards.notalucis.com/api/webhook`, events
      `checkout.session.completed` + `checkout.session.async_payment_succeeded` → copy `whsec_…`
- [ ] Developers → API keys → copy the live secret key `sk_live_…` (never paste it in a chat)
- [ ] Settings → Customer emails: "Successful payments" ON (receipt). Checkout also creates an
      invoice for every purchase (small Stripe fee per invoice)

**Vercel (`posing-in-cam` → Settings → Environment Variables, Production)**
- [ ] `STRIPE_SECRET_KEY` = `sk_live_…`, `STRIPE_WEBHOOK_SECRET` = live `whsec_…`,
      `STRIPE_PRICE_PRO` = live `price_…`
- [ ] Delete `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PACK20`
- [ ] Merge the "Pro becomes one payment" branch → the production deploy picks up the new env

**Prove it**
- [ ] Buy Pro with your own card → `/api/me` says `plan: pro`, the watermark is gone, the receipt
      and invoice arrive by email
- [ ] Refund it in Stripe, then reset the plan (below)
- [ ] Test-mode leftovers: delete the old test webhook endpoint; roll the test secret key (it was
      shared in chat)

**Refunds (14-day guarantee), every time:** refund in Stripe, then Supabase → `profiles` → that
user: `plan = 'free'`, `subscription_status = null`

- [ ] Live test of the sign-in limits: 6 link requests in a row get "Too many sign-in
      attempts", and the CAPTCHA shows from the 4th

## Setup
- [ ] Supabase: run `supabase/schema.sql` in the SQL Editor
- [ ] Supabase: Authentication → Email provider ON (magic link)
- [ ] Supabase: Auth → URL Configuration → Site URL = `https://cards.notalucis.com`, Redirect URLs = `https://cards.notalucis.com/**` (keep `https://posing-in-cam.vercel.app/**` while the old URL redirects)
- [ ] Vercel (`posing-in-cam`) env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`
- [ ] Stripe + Vercel env: see "Go live" above

## Move to cards.notalucis.com (in this order)
- [ ] Vercel → `posing-in-cam` → Domains: add `cards.notalucis.com` (DNS is automatic, notalucis.com is on Vercel DNS)
- [ ] Supabase: Site URL + Redirect URLs as above; paste the updated `supabase/email-template.html`
- [ ] Deploy. `posing-in-cam.vercel.app` now redirects to `cards.notalucis.com`, except `/api/*` (Stripe does not follow redirects)
- [ ] Stripe → Webhooks: edit the existing endpoint's URL to `https://cards.notalucis.com/api/webhook` (same `whsec_`, no env change)
- [ ] Stripe → Settings → Public details: the account is shared with the wedding site, so keep the
      studio's statement descriptor there (shortened descriptor ≤ 10 chars). Every purchase adds the
      suffix in code (`<prefix>* SHOOTCARDS`)
- [x] Old-URL redirect in `vercel.json` is permanent (308), still sparing `/api/*`
- [ ] Vercel → `posing-in-cam` → Analytics → enable Web Analytics (no cookies; `assets/visits.js`
      queues page views and funnel events until it is on; custom events show on the Pro plan)

## Sign-in hardening (October 2026, in this order)
Sessions moved from localStorage to HttpOnly cookies, with rate limits, lockout and
CAPTCHA on `/api/auth` (see `docs/security-audit-auth.md`).
- [x] Supabase SQL Editor: run `supabase/auth_security.sql` (attempt log; without it the
      limits only hold per serverless instance)
- [x] Vercel env (optional but recommended): `AUTH_LOG_SALT` = a long random string (keys the
      IP hashes; falls back to the service key)
- [x] Cloudflare → Turnstile → add widget for `cards.notalucis.com` (Managed) → Vercel env
      `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. Without them everything works, just no CAPTCHA
- [x] Deploy. Signed-in users stay signed in: their old localStorage session moves to cookies on first visit
- [x] AFTER the deploy: paste the updated `supabase/email-template.html` into Auth → Email Templates →
      "Magic Link" AND "Confirm signup" (the link now goes to `/api/auth` and works on any device;
      before that, links still work, but only in the browser they were asked from)
- [x] Supabase → Auth → Providers → Email → Email OTP Expiration: `900` (15 min; default is an hour)
- [x] Supabase → Auth → Rate Limits → IP Address Forwarding ON. Only honoured with an `sb_secret_…`
      key in `SUPABASE_SERVICE_KEY` (Settings → API Keys); with a legacy `service_role` JWT Supabase
      counts every visitor as Vercel's IP for its own limits
- [ ] Test: sign in on the phone from a link asked for on the laptop (done); sign out; 6 link requests in a
      row get "Too many sign-in attempts"

## Cost limits (29 Oct 2026)
- [x] `/api/convert` daily caps: `DAILY_CARD_CAP` (300 cards / 24 h per user, every plan) and
      `ANON_DAILY_CAP` (5 signed-out cards / 24 h per IP). Change via Vercel env; 0 turns a cap off
- [ ] Vercel → Settings → Billing: on **Hobby** nothing can be charged (limits pause the site
      instead); on **Pro** open Spend Management, set a monthly amount (e.g. $20), notifications
      at 50/75/100 % and "pause production deployments" at 100 %
- [x] Supabase org "In Principio" is on the **Free** plan: no charges possible. If it moves to Pro,
      keep Billing → Spend Cap ON
- [x] Supabase SQL Editor: run `supabase/rls_check.sql` once (expect 0 in every others_* /
      *_visible column)

## ⚠️ After everything works
- [x] **ROTATE Supabase `secret` key + `JWT secret`** (done 29 Oct 2026): new secret key
      `vercel_cards_2026_10b` in `SUPABASE_SERVICE_KEY`, the old `sb_secret_lR0pX…` deleted, legacy
      JWT-based API keys disabled and the legacy HS256 JWT secret revoked. `SUPABASE_JWT_SECRET` in
      Vercel is now a dead value; leave it set, `paywall_enabled()` still checks it is non-empty.

> Reminder owner: Claude will surface the rotation step when the full paywall is verified live.
