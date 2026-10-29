"""
Stripe billing for the Pose Cards paywall.

Active only when STRIPE_SECRET_KEY + the Pro price ID are set. Handles:
  - Checkout sessions (Pro, one payment, no subscription)
  - Webhook events -> writes entitlement into Supabase (via webauth.auth)

Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO
"""

from __future__ import annotations

import json

import requests

from . import auth

STRIPE_SECRET = auth.env_key("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = auth.env_key("STRIPE_WEBHOOK_SECRET")
PRICE_FOR = {
    "pro": auth.env_key("STRIPE_PRICE_PRO"),
}
STATEMENT_SUFFIX = "SHOOTCARDS"
_TIMEOUT = 10

# Stripe redirect targets are locked to our own origins (anti open-redirect).
CANONICAL_ORIGIN = "https://cards.notalucis.com"
ALLOWED_ORIGINS = {
    CANONICAL_ORIGIN,
    "https://posing-in-cam.vercel.app",
    "https://posing-in-cam-in-principios-projects.vercel.app",
}


def safe_origin(origin: str | None) -> str:
    return origin if origin in ALLOWED_ORIGINS else CANONICAL_ORIGIN


def enabled() -> bool:
    return bool(STRIPE_SECRET and any(PRICE_FOR.values()))


_prices_cache = None


def get_prices() -> dict:
    """Public pricing for the page: {kind: {amount, currency}}.
    Read once from Stripe and cached per warm instance."""
    global _prices_cache
    if _prices_cache is not None:
        return _prices_cache
    out = {}
    if enabled():
        stripe = _stripe()
        for kind, pid in PRICE_FOR.items():
            if not pid:
                continue
            try:
                p = json.loads(str(stripe.Price.retrieve(pid)))  # stripe>=15 objs aren't dicts
                out[kind] = {
                    "amount": (p.get("unit_amount") or 0) / 100.0,
                    "currency": (p.get("currency") or "eur").upper(),
                }
            except Exception:
                pass
    _prices_cache = out
    return out


def _stripe():
    import stripe
    stripe.api_key = STRIPE_SECRET
    return stripe


# --- Supabase writes (service role, bypasses RLS) ---------------------------
def _patch(match_field: str, match_val: str, patch: dict) -> None:
    r = requests.patch(
        f"{auth.SUPABASE_URL}/rest/v1/profiles",
        params={match_field: f"eq.{match_val}"},
        headers=auth._headers({"Prefer": "return=representation"}),
        json={**patch, "updated_at": auth._now()},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()  # raise on failure so the webhook 4xx's and Stripe retries
    # A PATCH that matches nothing still succeeds; for a buyer that would mean a
    # payment recorded nowhere, so fail loudly (and let Stripe retry) instead.
    if not r.json():
        raise RuntimeError(f"no profile row matched {match_field}={match_val}")


# --- Checkout ---------------------------------------------------------------
def create_checkout(uid: str, email: str, kind: str, origin: str) -> str:
    price = PRICE_FOR.get(kind)
    if not price:
        raise ValueError(f"unknown or unconfigured plan: {kind}")
    stripe = _stripe()
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"price": price, "quantity": 1}],
        client_reference_id=uid,
        customer_email=email or None,
        customer_creation="always",
        # The webhook unlocks Pro only for sessions marked as ours: the Stripe
        # account is shared with the wedding site.
        metadata={"kind": kind},
        # The account's descriptor stays the studio's; card statements read
        # "<prefix>* SHOOTCARDS" (no space: with the account's prefix of up to
        # 10 characters it stays within Stripe's 22).
        payment_intent_data={"statement_descriptor_suffix": STATEMENT_SUFFIX,
                             "metadata": {"kind": kind}},
        # Photographers buy this for their business: an invoice, with their VAT
        # number on it if they give one.
        invoice_creation={"enabled": True},
        tax_id_collection={"enabled": True},
        allow_promotion_codes=True,
        success_url=f"{origin}/?checkout=success",
        cancel_url=f"{origin}/?checkout=cancel",
    )
    return session.url


# --- Webhook ----------------------------------------------------------------
def _claim_event(eid) -> bool:
    """Record the Stripe event id for idempotency. Returns True if it was ALREADY
    processed (caller should skip). Degrades gracefully — if the stripe_events
    table is missing or unreachable, proceeds without dedup (current behaviour)."""
    if not eid:
        return False
    try:
        r = requests.post(f"{auth.SUPABASE_URL}/rest/v1/stripe_events",
                          headers=auth._headers({"Prefer": "return=minimal"}),
                          json={"id": eid}, timeout=_TIMEOUT)
    except Exception:
        return False
    return r.status_code == 409  # primary-key conflict -> this event is a duplicate


def _release_event(eid) -> None:
    """Undo a claim so Stripe's retry can reprocess a failed event."""
    if not eid:
        return
    try:
        requests.delete(f"{auth.SUPABASE_URL}/rest/v1/stripe_events",
                        params={"id": f"eq.{eid}"}, headers=auth._headers(), timeout=_TIMEOUT)
    except Exception:
        pass


def handle_webhook(payload: bytes, sig: str) -> None:
    stripe = _stripe()
    stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)  # verify signature only
    # stripe-python >=15 objects are NOT dicts (.get() raises AttributeError);
    # use the raw verified JSON as plain dicts instead.
    event = json.loads(payload)
    eid = event.get("id")
    if _claim_event(eid):           # already handled (Stripe retry / duplicate delivery)
        return
    try:
        _process_event(event)
    except Exception:
        _release_event(eid)         # let Stripe's retry reprocess this event
        raise


def _process_event(event: dict) -> None:
    # completed: card payments, paid at once. async_payment_succeeded: methods
    # like SEPA Debit, whose session completes unpaid and is paid days later.
    if event.get("type") not in ("checkout.session.completed",
                                 "checkout.session.async_payment_succeeded"):
        return
    obj = (event.get("data") or {}).get("object") or {}
    if (obj.get("metadata") or {}).get("kind") != "pro" or obj.get("payment_status") != "paid":
        return
    uid = obj.get("client_reference_id")
    email = obj.get("customer_email") or (obj.get("customer_details") or {}).get("email") or ""
    # Only our checkouts carry a Shoot Cards user id. The Stripe account is
    # shared with the wedding site, whose checkouts arrive here too: skip
    # those quietly (a failure would make Stripe retry them for days).
    if not auth.ensure_profile(uid, email):
        return
    _set_pro(uid, obj.get("customer"))


def _set_pro(uid: str, customer: str | None) -> None:
    """Pro bought once: no renewal date, nothing to cancel."""
    _patch("id", uid, {
        "plan": "pro",
        "subscription_status": auth.PAID_ONCE,
        "current_period_end": None,
        "stripe_customer_id": customer,
    })
