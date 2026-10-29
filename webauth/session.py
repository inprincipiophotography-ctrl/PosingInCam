"""
Cookie sessions for the Shoot Cards API.

The Supabase session never reaches page JavaScript. /api/auth signs in on the
server and keeps the tokens in cookies that scripts can't read:

  __Host-sc_at    access token (JWT, ~1 h)    HttpOnly; Secure; SameSite=Strict
  __Host-sc_rt    refresh token (30 days)     HttpOnly; Secure; SameSite=Strict
  __Host-sc_pkce  PKCE verifier (10 min)      HttpOnly; Secure; SameSite=Lax

The __Host- prefix pins each cookie to this exact host (no Domain, Path=/), so
a sibling *.notalucis.com site can't plant or overwrite one. The verifier is
Lax because the email link arrives as a cross-site navigation; it is useless
without the one-time code from the email.

Every API endpoint resolves the user through current_user(): it verifies the
access token and, once that has expired, refreshes it with the refresh token
and re-sets both cookies on the response (install() wires that up).
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from urllib.parse import urlsplit

import requests
from flask import g

from . import auth, billing

AT = "__Host-sc_at"
RT = "__Host-sc_rt"
PKCE = "__Host-sc_pkce"
REFRESH_MAX_AGE = 30 * 24 * 3600
PKCE_MAX_AGE = 10 * 60
_TIMEOUT = 10


# --- talking to Supabase Auth ------------------------------------------------
def _auth_headers(ip: str | None = None, token: str | None = None) -> dict:
    h = {"apikey": auth.SERVICE_KEY, "Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if ip:
        # Lets Supabase rate-limit by the visitor rather than by Vercel's IP.
        # Honoured with an sb_secret_ key once IP forwarding is switched on.
        h["Sb-Forwarded-For"] = ip
    return h


def _post(path: str, body: dict, ip: str | None = None, params: dict | None = None,
          token: str | None = None):
    return requests.post(f"{auth.SUPABASE_URL}/auth/v1/{path}", params=params, json=body,
                         headers=_auth_headers(ip, token), timeout=_TIMEOUT)


def new_pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def send_link(email: str, redirect_to: str, challenge: str, ip: str):
    """Ask Supabase to email a sign-in link (creates the account on first use)."""
    return _post("otp", {"email": email, "create_user": True,
                         "code_challenge": challenge, "code_challenge_method": "s256"},
                 ip=ip, params={"redirect_to": redirect_to})


def exchange_code(code: str, verifier: str, ip: str) -> dict | None:
    """The ?code= a default {{ .ConfirmationURL }} link brings back (same browser)."""
    r = _post("token", {"auth_code": code, "code_verifier": verifier}, ip=ip,
              params={"grant_type": "pkce"})
    return r.json() if r.ok else None


def verify_token_hash(token_hash: str, kind: str, ip: str) -> dict | None:
    """The ?token_hash= link of supabase/email-template.html (any device)."""
    r = _post("verify", {"token_hash": token_hash, "type": kind}, ip=ip)
    return r.json() if r.ok else None


def refresh(refresh_token: str, ip: str | None = None) -> dict | None:
    """New session for a refresh token; None when Supabase refuses it."""
    r = _post("token", {"refresh_token": refresh_token}, ip=ip,
              params={"grant_type": "refresh_token"})
    if r.ok:
        return r.json()
    if r.status_code >= 500 or r.status_code == 429:
        raise auth.AuthError(503, "Sign-in is busy right now. Try again in a moment.")
    return None


def revoke(access_token: str) -> None:
    try:
        _post("logout", {}, params={"scope": "local"}, token=access_token)
    except Exception:
        pass


# --- cookies -----------------------------------------------------------------
def _queue(name: str, value: str, max_age: int, samesite: str = "Strict") -> None:
    if "_sc_cookies" not in g:
        g._sc_cookies = {}
    g._sc_cookies[name] = (value, max_age, samesite)


def set_session(sess: dict) -> None:
    _queue(AT, sess["access_token"], int(sess.get("expires_in") or 3600))
    _queue(RT, sess["refresh_token"], REFRESH_MAX_AGE)


def clear_session() -> None:
    _queue(AT, "", 0)
    _queue(RT, "", 0)


def set_pkce(verifier: str) -> None:
    _queue(PKCE, verifier, PKCE_MAX_AGE, "Lax")


def clear_pkce() -> None:
    _queue(PKCE, "", 0, "Lax")


def install(app) -> None:
    """Write queued cookies onto every response, and keep them out of caches."""
    @app.after_request
    def _apply(resp):
        for name, (value, max_age, samesite) in (g.get("_sc_cookies") or {}).items():
            resp.set_cookie(name, value, max_age=max_age, path="/", secure=True,
                            httponly=True, samesite=samesite)
        if g.get("_sc_cookies"):
            resp.headers["Cache-Control"] = "no-store"
        return resp


# --- who is calling ----------------------------------------------------------
def has_session(request) -> bool:
    return bool(request.cookies.get(AT) or request.cookies.get(RT)
                or request.headers.get("Authorization"))


def current_user(request) -> tuple[str, str]:
    """(user_id, email) of the caller, refreshing an expired session on the way.

    Cookies first; an Authorization: Bearer header still works for scripts and
    API clients that hold their own token. Raises auth.AuthError(401) when
    there is no valid session (and clears dead cookies).
    """
    at = request.cookies.get(AT)
    rt = request.cookies.get(RT)
    if not at and not rt:
        return auth.verify_user(request.headers.get("Authorization"))
    if at:
        try:
            return auth.verify_user("Bearer " + at)
        except auth.AuthError:
            if not rt:
                clear_session()
                raise
    from . import guard  # late import: guard imports auth too
    ip = client_ip(request)
    if guard.check_verify(ip).blocked:
        raise auth.AuthError(429, "Too many sign-in attempts. Try again later.")
    sess = refresh(rt, ip)
    if not sess or not sess.get("access_token"):
        guard.log("verify_failed", ip, detail="refresh token refused")
        clear_session()
        raise auth.AuthError(401, "Your session ended. Sign in again.")
    set_session(sess)
    return auth.verify_user("Bearer " + sess["access_token"])


def client_ip(request) -> str:
    # Vercel sets x-real-ip to the actual peer; x-forwarded-for's first hop is
    # client-spoofable, so prefer x-real-ip and fall back conservatively.
    ip = request.headers.get("x-real-ip")
    if ip:
        return ip.strip()
    xff = request.headers.get("x-forwarded-for", "")
    return (xff.split(",")[0].strip() if xff else request.remote_addr) or "?"


def same_origin(request) -> bool:
    """CSRF backstop for cookie-authenticated writes, on top of SameSite=Strict:
    a browser's cross-site POST carries a foreign Origin or Sec-Fetch-Site."""
    if request.headers.get("Sec-Fetch-Site") in ("cross-site", "same-site"):
        return False
    origin = request.headers.get("Origin")
    if not origin:
        return True
    if origin in billing.ALLOWED_ORIGINS:
        return True
    return urlsplit(origin).netloc == request.host
