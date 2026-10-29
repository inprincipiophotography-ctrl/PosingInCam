# Security audit: sign-in on cards.notalucis.com (October 2026)

Scope: Shoot Cards only (this repo). notalucis.com is a separate app and was not touched.

How sign-in works: passwordless. You type your email and get a magic link (Supabase Auth).
There are no passwords and no admin role. Paid features (Pro, credits, free quota) are
decided on the server in `webauth/auth.py`.

## The five findings

| # | Finding | Status before | What changed |
|---|---|---|---|
| 1 | Session token in localStorage | **True.** supabase-js kept the access and refresh tokens in `localStorage` (`sb-…-auth-token`), so any script injected into the page could read them | **Fixed.** Sign-in now runs on the server (`api/auth.py`). Tokens live only in `__Host-` cookies that are HttpOnly, Secure and SameSite=Strict (`webauth/session.py`), and they are refreshed and rotated on the server. The browser bundle of supabase-js is gone. Existing sessions move to cookies once, and the old key is deleted |
| 2 | Admin or role checks only on the client | **Not present.** There is no admin role or admin route. Every entitlement (Pro, credits, free cards, watermark, history, project ownership) is already checked on the server; the page's own checks only decide what to show | No change needed. Write endpoints now also refuse cross-site requests (CSRF), since cookies authenticate them |
| 3 | No 2FA / OTP | **Not applicable.** There is no password to back up with a second factor: the email link is a one-time code sent to your inbox, and there are no admin accounts | Not added (by decision). Recommended: set the email link to expire after 15 min instead of 1 h (checklist) |
| 4 | No rate limiting on login | **True for our server; Supabase defaults only.** Browsers called Supabase directly | **Fixed.** `webauth/guard.py`, over a 15-minute window: 5 link requests per IP, 3 per email (then that email is locked), 5 failed link verifications per IP. CAPTCHA (Turnstile) from the 3rd attempt. Backoff 15 → 30 → 60 min while someone keeps trying. Every attempt is logged to stderr and to `auth_events`, with IPs stored only as a keyed hash. The visitor's IP is forwarded to Supabase so its own limits count per visitor |
| 5 | No password strength check | **Not applicable.** There are no passwords | Not added (by decision) |

"Signup", "forgot password", "reset password" and "verify OTP" are not separate endpoints here.
Asking for a link (`?action=login`) is both sign in and sign up. Opening the link
(`?action=callback`) is the OTP check. Neither password endpoint exists. Both sign-in
endpoints are limited as described above.

## Re-audit after the fix

- **Token exposure:** page JS no longer reads any token. `/api/me` returns only the email and
  plan, and responses never include a token (`qa/test_auth.py`).
- **Cookie scope:** the `__Host-` prefix means no Domain and Path=/ only. A sibling
  `*.notalucis.com` site can't set or overwrite these cookies (no session fixation from the
  main domain).
- **Email link:** the code goes through PKCE, and its verifier sits in a 10-minute HttpOnly
  cookie. The updated email template sends a `token_hash` that the server verifies, so a link
  asked for on one device also works on another. The callback sends `Referrer-Policy:
  no-referrer` and `Cache-Control: no-store`.
- **CSRF:** cookies are SameSite=Strict. On top of that, POST endpoints refuse a foreign
  `Origin` or `Sec-Fetch-Site: cross-site|same-site` (`session.same_origin`). CORS still sends
  no `Allow-Credentials`.
- **Token checks:** only ES256/RS256 JWTs from the project JWKS are accepted, with audience
  `authenticated` and expiry enforced. HS256 is rejected, and a forged key is rejected (test).
- **Logout:** revokes the refresh token on Supabase, not just in the browser.
- **XSS:** CSP is unchanged apart from allowing `challenges.cloudflare.com` for the Turnstile
  script and frame. The inline-script hash still matches.

## What's still left (needs a dashboard, not code)

See `LAUNCH-CHECKLIST.md` → "Sign-in hardening": run `supabase/auth_security.sql`, add the
Turnstile keys, paste the new email template after the deploy, set the email OTP expiry to
15 min, and turn on IP address forwarding (needs an `sb_secret_` key).

Known limits:
- An XSS can still *use* the session while the page is open, through same-origin requests.
  It just can't steal the session and take it elsewhere anymore.
- Email scanners that open links before you do can use up a one-time link. Ask for another
  one if that happens; this was true before the change too.
- Without the `auth_events` table, limits only hold per serverless instance.

## Follow-up audit: keys, ownership, cost limits (29 Oct 2026)

**1. Keys in the browser: none.** Searched the code, the whole git history (every
branch) and the files the live site serves for Stripe, Supabase, JWT, AWS,
Google, GitHub, Slack, OpenAI and Anthropic key patterns and private keys.
Nothing secret turned up. The browser holds no Supabase key at all anymore (the
publishable key went with supabase-js). Turnstile's *site* key is public by
design. Every secret is read on the server only, through `auth.env_key()`:
`SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`TURNSTILE_SECRET_KEY` and `AUTH_LOG_SALT`. Server code, SQL, tests, docs and
`.env*` files return 404 or redirect on the live site (`.vercelignore` plus
`vercel.json` redirects). CSP `connect-src` lost the unused Supabase WebSocket
origin. Analytics strips sign-in tokens from page URLs (`assets/visits.js`).

**2. Ownership: every route checks it, and RLS is on every table.**
| Route | Data | Owner check |
|---|---|---|
| `GET /api/me` | own profile | `id = uid` from the verified session |
| `GET /api/history` | batches, projects, thumbnails | `user_id = uid` on every query, and `storage.owned_path()` signs only files under `<uid>/` |
| `GET /api/history?download=` / `download_project=` | stored cards | the row must match `user_id = uid`, and each file must pass `owned_path` (404 or 410 otherwise) |
| `POST /api/convert` | project, history, credits | `project_id` must belong to `uid`, otherwise the user's own default project is used |
| `POST /api/checkout` | Stripe | customer and user ID taken from the verified session, never from the request |
| `POST /api/webhook` | entitlements | Stripe signature verified |

- **Database:** RLS is enabled on all 5 public tables and all storage tables.
  `profiles`, `conversions` and `projects` are readable only by their owner,
  and there is no client write policy anywhere. `stripe_events` and
  `auth_events` have no client access. The credit RPCs can't be called from
  the client. The `cards` bucket is private, with no client policies.
- **Proven live** with the browser key: reads return `[]` or "permission
  denied", inserts and uploads violate RLS, a mass update matches nothing, and
  RPCs and the storage listing are refused.
- **Proven in code:** `qa/test_ownership.py` signs in as two users and covers
  every route above. Removing a single `user_id` filter makes it fail.
- **At database level:** `supabase/rls_check.sql` reads as a real user and
  must show 0 rows of anyone else's.

**3. Cost limits: no AI endpoints exist.** The app calls no AI model. Its one
costly endpoint is `/api/convert` (function time and storage), and the same
rules now apply there:
- **Auth:** signed out you get 1 watermarked card per request. More needs a session.
- **Per user:** `DAILY_CARD_CAP` (default 300 cards per 24 h, every plan
  including Pro), counted from `conversions` and checked before any work starts.
- **Per signed-out IP:** `ANON_DAILY_CAP` (default 5 per 24 h), counted
  per hashed IP in `auth_events`.
- **Bursts:** `RATE_MAX` requests per minute per IP, per instance.
- **Input:** at most 30 files and 15 MB each (Vercel caps a request at
  4.5 MB anyway). Pixel bombs and non-images are rejected (`qa/test_security.py`).
  Project names are capped at 80 characters and emails at 254.
- **Spend alerts** are set at the providers: Vercel Spend Management and the
  Supabase spend cap (see `LAUNCH-CHECKLIST.md`).
