"""
Auth + entitlement for the Pose Cards paywall.

Active ONLY when SUPABASE_URL, SUPABASE_SERVICE_KEY and SUPABASE_JWT_SECRET are
present in the environment. Without them the converter stays open (no login, no
watermark) so the site keeps working until the paywall is switched on.

Unit = one converted card (image):
  Free:    FREE_LIMIT cards, watermarked
  20-pack: credits (one-time), no watermark
  Pro:     unlimited, no watermark
"""

from __future__ import annotations

import os
import datetime as dt

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

FREE_LIMIT = 3
_TIMEOUT = 10

# Comp accounts: emails that always get Pro for free (no Stripe). Set PRO_EMAILS
# in the env as a comma-separated list, e.g. "me@example.com, friend@example.com".
COMP_EMAILS = {e.strip().lower() for e in os.environ.get("PRO_EMAILS", "").split(",") if e.strip()}


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def paywall_enabled() -> bool:
    return bool(SUPABASE_URL and SERVICE_KEY and JWT_SECRET)


def _headers(extra: dict | None = None) -> dict:
    h = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
         "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _future(ts) -> bool:
    if not ts:
        return False
    try:
        return dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00")) > dt.datetime.now(dt.timezone.utc)
    except Exception:
        return False


_ASYM = {"ES256", "RS256", "ES384", "RS384", "ES512", "RS512"}
_jwks_client = None


def _jwks():
    global _jwks_client
    if _jwks_client is None:
        from jwt import PyJWKClient
        _jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    return _jwks_client


def verify_user(authorization: str | None) -> tuple[str, str]:
    """Verify a Supabase access token and return (user_id, email).

    This project signs access tokens with asymmetric keys (ES256/RS256) exposed
    via JWKS, so we accept ONLY those. HS256 (the legacy shared-secret path) is
    rejected, so even a leaked JWT secret can never be used to forge a token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError(401, "Sign in to continue.")
    token = authorization.split(" ", 1)[1].strip()
    import jwt
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
        if alg in _ASYM:
            key = _jwks().get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=[alg], audience="authenticated")
        else:
            raise AuthError(401, f"Unsupported token algorithm: {alg or 'none'}.")
    except AuthError:
        raise
    except Exception as e:
        raise AuthError(401, f"Session invalid ({e.__class__.__name__}). Sign in again.")
    uid = claims.get("sub")
    if not uid:
        raise AuthError(401, "Session invalid.")
    return uid, claims.get("email", "")


def get_profile(uid: str) -> dict:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/profiles",
                     params={"id": f"eq.{uid}", "select": "*"},
                     headers=_headers(), timeout=_TIMEOUT)
    r.raise_for_status()
    rows = r.json()
    if rows:
        return rows[0]
    # Trigger creates the row on signup; default to a fresh free profile if absent.
    return {"id": uid, "free_used": 0, "credits": 0, "plan": "free",
            "subscription_status": None, "current_period_end": None}


def is_pro(profile: dict) -> bool:
    if profile.get("plan") != "pro":
        return False
    if profile.get("subscription_status") not in ("active", "trialing"):
        return False
    # Active/trialing subscription grants Pro. A recorded period_end must still be
    # in the future (backstop for a missed cancellation); a missing/unparseable
    # end does NOT lock out an otherwise-active subscriber.
    cpe = profile.get("current_period_end")
    return cpe is None or _future(cpe)


def is_comp(email: str | None) -> bool:
    """True for comp (free Pro) accounts listed in PRO_EMAILS."""
    return bool(email) and email.strip().lower() in COMP_EMAILS


def decide(profile: dict, n: int, email: str = "") -> dict:
    """Decide whether n cards are allowed and whether to watermark."""
    credits = int(profile.get("credits") or 0)
    free_used = int(profile.get("free_used") or 0)
    if is_pro(profile) or is_comp(email):
        return {"allowed": True, "watermark": False, "tier": "pro"}
    if credits >= n:
        return {"allowed": True, "watermark": False, "tier": "credits"}
    free_left = max(0, FREE_LIMIT - free_used)
    if n <= free_left:
        return {"allowed": True, "watermark": True, "tier": "free"}
    return {"allowed": False, "tier": "blocked", "free_left": free_left, "credits": credits,
            "message": (f"Not enough left ({free_left} free preview(s), {credits} credit(s)) "
                        f"for {n} card(s). Buy a 20-pack or go Pro for unlimited.")}


def _rpc(name: str, payload: dict) -> bool:
    """Call a Supabase RPC as the service role. Returns True on HTTP 2xx."""
    try:
        r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/{name}",
                          headers=_headers(), json=payload, timeout=_TIMEOUT)
        return r.ok
    except Exception:
        return False


def _patch_profile(uid: str, patch: dict) -> None:
    requests.patch(f"{SUPABASE_URL}/rest/v1/profiles", params={"id": f"eq.{uid}"},
                   headers=_headers({"Prefer": "return=minimal"}),
                   json={**patch, "updated_at": _now()}, timeout=_TIMEOUT)


def consume(uid: str, profile: dict, n: int, tier: str, vendor: str) -> None:
    """Atomically decrement credits / increment free usage and log the conversion.
    Never raises — a metering hiccup must not fail the user's download. Prefers
    Postgres RPCs for atomic counters (no lost updates under concurrency), falling
    back to a read-then-write PATCH if those functions aren't installed yet."""
    try:
        if tier == "credits":
            if not _rpc("spend_credits", {"p_uid": uid, "p_n": n}):
                _patch_profile(uid, {"credits": max(0, int(profile.get("credits") or 0) - n)})
        elif tier == "free":
            if not _rpc("add_free_used", {"p_uid": uid, "p_n": n}):
                _patch_profile(uid, {"free_used": int(profile.get("free_used") or 0) + n})
        requests.post(f"{SUPABASE_URL}/rest/v1/conversions",
                      headers=_headers({"Prefer": "return=minimal"}),
                      json={"user_id": uid, "cards": n, "vendor": vendor, "tier": tier}, timeout=_TIMEOUT)
    except Exception:
        pass


def account_state(profile: dict, email: str = "") -> dict:
    """Compact entitlement summary for the account bar."""
    return {"plan": "pro" if (is_pro(profile) or is_comp(email)) else "free",
            "credits": int(profile.get("credits") or 0),
            "free_left": max(0, FREE_LIMIT - int(profile.get("free_used") or 0)),
            "free_limit": FREE_LIMIT}
