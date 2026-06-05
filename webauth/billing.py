"""
Stripe billing for the Pose Cards paywall.

Active only when STRIPE_SECRET_KEY + at least one price ID are set. Handles:
  - Checkout sessions (Pro monthly/yearly subscriptions, 20-pack one-time)
  - Webhook events -> writes entitlement into Supabase (via webauth.auth)
  - Billing portal (manage/cancel subscription)

Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
     STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_PACK20
"""

from __future__ import annotations

import os
import json
import datetime as dt

import requests

from . import auth

STRIPE_SECRET = os.environ.get("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
PRICE_FOR = {
    "monthly": os.environ.get("STRIPE_PRICE_PRO_MONTHLY", ""),
    "yearly": os.environ.get("STRIPE_PRICE_PRO_YEARLY", ""),
    "pack20": os.environ.get("STRIPE_PRICE_PACK20", ""),
}
PACK20_CREDITS = 20
_TIMEOUT = 10


def enabled() -> bool:
    return bool(STRIPE_SECRET and any(PRICE_FOR.values()))


def _stripe():
    import stripe
    stripe.api_key = STRIPE_SECRET
    return stripe


# --- Supabase writes (service role, bypasses RLS) ---------------------------
def _patch(match_field: str, match_val: str, patch: dict) -> None:
    requests.patch(
        f"{auth.SUPABASE_URL}/rest/v1/profiles",
        params={match_field: f"eq.{match_val}"},
        headers=auth._headers({"Prefer": "return=minimal"}),
        json={**patch, "updated_at": auth._now()},
        timeout=_TIMEOUT,
    )


def _iso(unix_ts) -> str | None:
    if not unix_ts:
        return None
    return dt.datetime.fromtimestamp(int(unix_ts), dt.timezone.utc).isoformat()


def _period_end(sub) -> str | None:
    """Subscription period end, tolerant of API versions: recent versions
    (2025-basil / 2026-dahlia) moved current_period_end onto the items."""
    cpe = sub.get("current_period_end")
    if not cpe:
        try:
            cpe = sub["items"]["data"][0]["current_period_end"]
        except (KeyError, IndexError, TypeError):
            cpe = None
    return _iso(cpe)


# --- Checkout / portal ------------------------------------------------------
def create_checkout(uid: str, email: str, kind: str, origin: str) -> str:
    price = PRICE_FOR.get(kind)
    if not price:
        raise ValueError(f"unknown or unconfigured plan: {kind}")
    stripe = _stripe()
    mode = "payment" if kind == "pack20" else "subscription"
    session = stripe.checkout.Session.create(
        mode=mode,
        line_items=[{"price": price, "quantity": 1}],
        client_reference_id=uid,
        customer_email=email or None,
        customer_creation="always" if mode == "payment" else None,
        allow_promotion_codes=True,
        success_url=f"{origin}/?checkout=success",
        cancel_url=f"{origin}/?checkout=cancel",
    )
    return session.url


def create_portal(customer_id: str, origin: str) -> str:
    stripe = _stripe()
    return stripe.billing_portal.Session.create(customer=customer_id, return_url=f"{origin}/").url


# --- Webhook ----------------------------------------------------------------
def _retrieve_sub(stripe, sub_id) -> dict:
    """Retrieve a subscription as a plain dict (stripe>=15 objects aren't dicts)."""
    return json.loads(str(stripe.Subscription.retrieve(sub_id)))


def handle_webhook(payload: bytes, sig: str) -> None:
    stripe = _stripe()
    stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)  # verify signature only
    # stripe-python >=15 objects are NOT dicts (.get() raises AttributeError);
    # use the raw verified JSON as plain dicts instead.
    event = json.loads(payload)
    etype = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    if etype == "checkout.session.completed":
        uid = obj.get("client_reference_id")
        customer = obj.get("customer")
        if obj.get("mode") == "subscription":
            _set_pro(uid, customer, _retrieve_sub(stripe, obj.get("subscription")))
        else:  # one-time 20-pack
            _add_credits(uid, customer, PACK20_CREDITS)

    elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        _sync_subscription(obj)

    elif etype == "invoice.paid":
        sub_id = obj.get("subscription")
        if not sub_id:  # newer API versions nest it under parent
            sub_id = ((obj.get("parent") or {}).get("subscription_details") or {}).get("subscription")
        if sub_id:
            _sync_subscription(_retrieve_sub(stripe, sub_id))


def _set_pro(uid: str, customer: str, sub) -> None:
    if not uid:
        return
    _patch("id", uid, {
        "plan": "pro",
        "subscription_status": sub.get("status"),
        "current_period_end": _period_end(sub),
        "stripe_customer_id": customer,
    })


def _add_credits(uid: str, customer: str, n: int) -> None:
    if not uid:
        return
    current = int(auth.get_profile(uid).get("credits") or 0)
    _patch("id", uid, {"credits": current + n, "stripe_customer_id": customer})


def _sync_subscription(sub) -> None:
    customer = sub.get("customer")
    if not customer:
        return
    active = sub.get("status") in ("active", "trialing")
    _patch("stripe_customer_id", customer, {
        "plan": "pro" if active else "free",
        "subscription_status": sub.get("status"),
        "current_period_end": _period_end(sub),
    })
