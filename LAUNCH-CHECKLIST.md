# Pose Cards — go-live checklist

Tracked so nothing gets lost between sessions. (Excluded from the public deploy.)

## Setup
- [ ] Supabase: run `supabase/schema.sql` in the SQL Editor
- [ ] Supabase: Authentication → Email provider ON (magic link)
- [ ] Supabase: Auth → URL Configuration → Site URL + Redirect URL = `https://posing-in-cam.vercel.app`
- [ ] Vercel (`posing-in-cam`) env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`
- [ ] Stripe: create 3 prices (Pro monthly, Pro yearly, 20-pack) → send price IDs + secret key
- [ ] Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PACK20`
- [ ] Stripe: add webhook endpoint (URL provided once `/api/webhook` is built)

## ⚠️ After everything works
- [ ] **ROTATE Supabase `secret` key + `JWT secret`** (Dashboard → Settings → API).
      They were shared in chat during setup; anon/publishable keys are public and fine.
      → After rotating, update `SUPABASE_SERVICE_KEY` + `SUPABASE_JWT_SECRET` in Vercel and redeploy.
- [ ] (optional) Enable Stripe Tax for EU VAT.

> Reminder owner: Claude will surface the rotation step when the full paywall is verified live.
