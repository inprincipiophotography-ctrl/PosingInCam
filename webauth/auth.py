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

FREE_LIMIT = 2
_TIMEOUT = 10


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


def verify_user(authorization: str | None) -> tuple[str, str]:
    """Verify a Supabase access token (HS256). Returns (user_id, email)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError(401, "Sign in to continue.")
    token = authorization.split(" ", 1)[1].strip()
    import jwt  # lazy: keeps module import light and avoids needing jwt in open mode
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], audience="authenticated")
    except Exception as e:  # expired / bad signature / wrong aud
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
    return (profile.get("plan") == "pro"
            and profile.get("subscription_status") in ("active", "trialing")
            and _future(profile.get("current_period_end")))


def decide(profile: dict, n: int) -> dict:
    """Decide whether n cards are allowed and whether to watermark."""
    credits = int(profile.get("credits") or 0)
    free_used = int(profile.get("free_used") or 0)
    if is_pro(profile):
        return {"allowed": True, "watermark": False, "tier": "pro"}
    if credits >= n:
        return {"allowed": True, "watermark": False, "tier": "credits"}
    free_left = max(0, FREE_LIMIT - free_used)
    if n <= free_left:
        return {"allowed": True, "watermark": True, "tier": "free"}
    return {"allowed": False, "tier": "blocked", "free_left": free_left, "credits": credits,
            "message": (f"Not enough left ({free_left} free preview(s), {credits} credit(s)) "
                        f"for {n} card(s). Buy a 20-pack or go Pro for unlimited.")}


def consume(uid: str, profile: dict, n: int, tier: str, vendor: str) -> None:
    """Decrement credits / increment free usage and log the conversion.
    Never raises — a logging/decrement hiccup must not fail the user's download."""
    try:
        if tier == "credits":
            patch = {"credits": max(0, int(profile.get("credits") or 0) - n), "updated_at": _now()}
        elif tier == "free":
            patch = {"free_used": int(profile.get("free_used") or 0) + n, "updated_at": _now()}
        else:
            patch = None
        if patch is not None:
            requests.patch(f"{SUPABASE_URL}/rest/v1/profiles", params={"id": f"eq.{uid}"},
                           headers=_headers({"Prefer": "return=minimal"}), json=patch, timeout=_TIMEOUT)
        requests.post(f"{SUPABASE_URL}/rest/v1/conversions",
                      headers=_headers({"Prefer": "return=minimal"}),
                      json={"user_id": uid, "cards": n, "vendor": vendor, "tier": tier}, timeout=_TIMEOUT)
    except Exception:
        pass


def account_state(profile: dict) -> dict:
    """Compact entitlement summary for the account bar."""
    return {"plan": "pro" if is_pro(profile) else "free",
            "credits": int(profile.get("credits") or 0),
            "free_left": max(0, FREE_LIMIT - int(profile.get("free_used") or 0)),
            "free_limit": FREE_LIMIT}
