# Pose Cards — go-live checklist

Tracked so nothing gets lost between sessions. (Excluded from the public deploy.)

## Setup
- [ ] Supabase: run `supabase/schema.sql` in the SQL Editor
- [ ] Supabase: Authentication → Email provider ON (magic link)
- [ ] Supabase: Auth → URL Configuration → Site URL = `https://cards.notalucis.com`, Redirect URLs = `https://cards.notalucis.com/**` (keep `https://posing-in-cam.vercel.app/**` while the old URL redirects)
- [ ] Vercel (`posing-in-cam`) env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`
- [ ] Stripe: create 3 prices (Pro monthly, Pro yearly, 20-pack) → send price IDs + secret key
- [ ] Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PACK20`
- [ ] Stripe: add webhook endpoint (URL provided once `/api/webhook` is built)

## Move to cards.notalucis.com (in this order)
- [ ] Vercel → `posing-in-cam` → Domains: add `cards.notalucis.com` (DNS is automatic, notalucis.com is on Vercel DNS)
- [ ] Supabase: Site URL + Redirect URLs as above; paste the updated `supabase/email-template.html`
- [ ] Deploy. `posing-in-cam.vercel.app` now redirects to `cards.notalucis.com`, except `/api/*` (Stripe does not follow redirects)
- [ ] Stripe → Webhooks: edit the existing endpoint's URL to `https://cards.notalucis.com/api/webhook` (same `whsec_`, no env change)
- [ ] Stripe → Settings → Public details: the account is shared with the wedding site, so keep the
      studio's statement descriptor there (shortened descriptor ≤ 10 chars). Pack purchases add the
      suffix in code (`<prefix>* SHOOTCARDS`)
- [ ] Stripe → Product catalog → Pro product → statement descriptor `NOTALUCIS SHOOT CARDS` (subscriptions
      can't take a suffix from Checkout; the product's descriptor wins over the account's)
- [x] Old-URL redirect in `vercel.json` is permanent (308), still sparing `/api/*`
- [ ] Vercel → `posing-in-cam` → Analytics → enable Web Analytics (no cookies; `assets/visits.js`
      queues page views and funnel events until it is on; custom events show on the Pro plan)

## Sign-in hardening (October 2026, in this order)
Sessions moved from localStorage to HttpOnly cookies, with rate limits, lockout and
CAPTCHA on `/api/auth` (see `docs/security-audit-auth.md`).
- [ ] Supabase SQL Editor: run `supabase/auth_security.sql` (attempt log; without it the
      limits only hold per serverless instance)
- [ ] Vercel env (optional but recommended): `AUTH_LOG_SALT` = a long random string (keys the
      IP hashes; falls back to the service key)
- [ ] Cloudflare → Turnstile → add widget for `cards.notalucis.com` (Managed) → Vercel env
      `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. Without them everything works, just no CAPTCHA
- [ ] Deploy. Signed-in users stay signed in: their old localStorage session moves to cookies on first visit
- [ ] AFTER the deploy: paste the updated `supabase/email-template.html` into Auth → Email Templates →
      "Magic Link" AND "Confirm signup" (the link now goes to `/api/auth` and works on any device;
      before that, links still work, but only in the browser they were asked from)
- [ ] Supabase → Auth → Providers → Email → Email OTP Expiration: `900` (15 min; default is an hour)
- [ ] Supabase → Auth → Rate Limits → IP Address Forwarding ON. Only honoured with an `sb_secret_…`
      key in `SUPABASE_SERVICE_KEY` (Settings → API Keys); with a legacy `service_role` JWT Supabase
      counts every visitor as Vercel's IP for its own limits
- [ ] Test: sign in on the phone from a link asked for on the laptop; sign out; 6 link requests in a
      row get "Too many sign-in attempts"

## ⚠️ After everything works
- [ ] **ROTATE Supabase `secret` key + `JWT secret`** (Dashboard → Settings → API).
      They were shared in chat during setup; anon/publishable keys are public and fine.
      → After rotating, update `SUPABASE_SERVICE_KEY` + `SUPABASE_JWT_SECRET` in Vercel and redeploy.
- [ ] **ROTATE the Stripe test secret key** (Developers → API keys → roll) — also shared in chat.
- [ ] (optional) Enable Stripe Tax for EU VAT.

## 🚀 Go live (test → live)
Everything above is in Stripe **test/sandbox** mode. To take real payments:
- [ ] Activate the Stripe account fully (business details + bank account for payouts).
- [ ] Recreate the 3 prices in **live** mode; create a **live** webhook endpoint
      (`https://cards.notalucis.com/api/webhook`, same 4 events) → get `whsec_…`.
- [ ] In Vercel, swap the 5 Stripe env vars to live values
      (`sk_live_…`, live `price_…` ×3, live `whsec_…`) → Redeploy.
- [ ] Re-test once with a real card, then refund/cancel.

> Reminder owner: Claude will surface the rotation step when the full paywall is verified live.
