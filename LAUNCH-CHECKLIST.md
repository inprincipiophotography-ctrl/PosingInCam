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

## 📣 Prije oglašavanja (skaliranje)
Cijela analiza (5000 posjetitelja / 1000 kupaca odjednom) je u `docs/SCALING-REVIEW.md`.
Kod se skalira dobro, a pucaju planovi i kvote, pa ove stavke odraditi PRIJE prvog oglasa.

Računi i postavke (bez koda):
- [ ] Supabase → Auth → SMTP: vlastiti SMTP (Resend / Postmark / SES, plaćeni plan) + SPF/DKIM.
      Bez toga magic link ide samo članovima tima, ~2 maila/h
- [ ] Supabase → Auth → Rate Limits: "emails per hour" podići (npr. 1000+; zadano je 30/h čak i s vlastitim SMTP-om)
- [ ] Supabase org → Pro ($25/mj: 100 GB storage, 250 GB egress, backupi) + spend cap/alerti;
      razmisliti o zasebnoj organizaciji (dijeli se s Wedding Managerom)
- [ ] Vercel → Pro ($20/mj): Hobby ne dopušta komercijalnu upotrebu i pauzira projekt kad potroši kvotu
- [ ] Vercel → Spend Management alert
- [ ] Vercel Firewall: rate-limit pravilo po IP-u na `/api/convert` i `/api/history` (npr. 30/min)

Izmjene koda (detalji i verifikacija u `docs/SCALING-REVIEW.md` → Faza 1):
- [ ] CDN cache (`Cache-Control: s-maxage`) na `GET /api/convert` i `GET /api/prices`
- [ ] Mali thumbnailovi za povijest umjesto punih kartica (egress)
- [ ] Jedan `requests.Session()` za sve pozive prema Supabaseu
- [ ] Dnevni Vercel Cron koji briše privremene ZIP-ove (`zips/`)
- [ ] Paralelno skidanje kartica kod ponovnog downloada (`api/history.py`)
- [ ] Indeks `projects(user_id)` u `supabase/projects.sql`
- [ ] Test: magic link na 3–4 adrese izvan tima + mali load test na preview deployu

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
