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
- [ ] Stripe → Settings → Public details: business name + statement descriptor `SPECULA`
- [ ] Once settled: make the old-URL redirect in `vercel.json` permanent

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
