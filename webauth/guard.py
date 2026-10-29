"""
Brute-force protection for the sign-in endpoints (/api/auth).

Sign-in is a passwordless email link, so the attempts worth limiting are:
  link   asking for a sign-in link (sign in and sign up are the same request)
  verify opening a link: a bad or expired code, or a refresh token that
         doesn't work (counts per IP; a link carries no email we could trust)

Limits, over a 15-minute window:
  - IP:    LINK_IP_MAX link requests, VERIFY_FAIL_MAX failed verifications
  - email: LINK_EMAIL_MAX link requests, then that address is locked
  - CAPTCHA (Cloudflare Turnstile) from CAPTCHA_AFTER attempts on, when
    TURNSTILE_SECRET_KEY is set
Every further attempt while locked is logged too, so a client that keeps
hammering waits longer and longer: 15, then 30, then 60 minutes (exponential
backoff, capped at an hour so an attacker can't lock a real user out for days).

Attempts are logged to stderr (Vercel runtime logs) and to the auth_events
table (supabase/auth_security.sql), which is what makes the limits hold across
serverless instances. IPs are stored only as a keyed hash. Until that table
exists the counts live in this instance's memory: weaker, but never open.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import os
import random
import sys
import threading
import time

import requests

from . import auth

WINDOW = 15 * 60
LOOKBACK = 60 * 60
MAX_LOCK = 60 * 60
LINK_IP_MAX = 5
LINK_EMAIL_MAX = 3
VERIFY_FAIL_MAX = 5
CAPTCHA_AFTER = 3
RETENTION_DAYS = 30

TURNSTILE_SITE_KEY = auth.env_key("TURNSTILE_SITE_KEY")
TURNSTILE_SECRET = auth.env_key("TURNSTILE_SECRET_KEY")
_TIMEOUT = 10

# Kinds that count against a key. "link" covers sent, refused and blocked link
# requests alike; "verify_failed" covers bad links and bad refresh tokens.
LINK_KINDS = ("link_sent", "link_failed", "link_blocked", "captcha_failed")
VERIFY_KINDS = ("verify_failed", "verify_blocked")


def captcha_enabled() -> bool:
    return bool(TURNSTILE_SITE_KEY and TURNSTILE_SECRET)


def ip_key(ip: str) -> str:
    """Keyed hash of an IP: enough to count attempts, useless to read back."""
    secret = (os.environ.get("AUTH_LOG_SALT") or auth.SERVICE_KEY or "dev").encode()
    return hmac.new(secret, ("ip:" + (ip or "?")).encode(), hashlib.sha256).hexdigest()[:32]


# --- event store -------------------------------------------------------------
_mem_lock = threading.Lock()
_mem = []            # [(ts, kind, ip_hash, email)] while auth_events is missing
_table_ok = None     # None = not tried yet; False = table missing on this instance


def _iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat()


def _ts(iso: str) -> float:
    return dt.datetime.fromisoformat(str(iso).replace("Z", "+00:00")).timestamp()


def log(kind: str, ip: str, email: str | None = None, detail: str = "") -> None:
    """Record an attempt. Never raises: logging must not break sign-in."""
    ih = ip_key(ip)
    print("[auth] " + json.dumps({"event": kind, "ip": ih, "email": email or None,
                                  "detail": detail or None}), file=sys.stderr)
    global _table_ok
    now = time.time()
    if _table_ok is not False and auth.SUPABASE_URL:
        try:
            r = requests.post(f"{auth.SUPABASE_URL}/rest/v1/auth_events",
                              headers=auth._headers({"Prefer": "return=minimal"}),
                              json={"kind": kind, "ip_hash": ih, "email": email or None,
                                    "detail": (detail or None) and detail[:200]},
                              timeout=_TIMEOUT)
            _table_ok = r.ok or r.status_code not in (400, 404)
            if r.ok and random.random() < 0.02:
                _prune()
            if r.ok:
                return
        except Exception:
            pass
    with _mem_lock:
        _mem.append((now, kind, ih, email or None))
        cutoff = now - LOOKBACK
        while _mem and _mem[0][0] < cutoff:
            _mem.pop(0)


def _prune() -> None:
    try:
        requests.delete(f"{auth.SUPABASE_URL}/rest/v1/auth_events",
                        params={"created_at": f"lt.{_iso(time.time() - RETENTION_DAYS * 86400)}"},
                        headers=auth._headers(), timeout=_TIMEOUT)
    except Exception:
        pass


def _times(field: str, value: str, kinds: tuple) -> list[float]:
    """Attempt timestamps for one key over the last hour, newest first."""
    since = time.time() - LOOKBACK
    if _table_ok is not False and auth.SUPABASE_URL:
        try:
            r = requests.get(f"{auth.SUPABASE_URL}/rest/v1/auth_events",
                             params={field: f"eq.{value}", "kind": f"in.({','.join(kinds)})",
                                     "created_at": f"gte.{_iso(since)}", "select": "created_at",
                                     "order": "created_at.desc", "limit": "200"},
                             headers=auth._headers(), timeout=_TIMEOUT)
            if r.ok:
                return [_ts(row["created_at"]) for row in r.json()]
        except Exception:
            pass
    idx = 2 if field == "ip_hash" else 3
    with _mem_lock:
        return sorted((t for t, k, *key in _mem
                       if t >= since and k in kinds and key[idx - 2] == value), reverse=True)


def _retry_after(times: list[float], limit: int) -> int:
    """Seconds this key must wait, 0 when it may go ahead."""
    if not times:
        return 0
    now = time.time()
    recent = [t for t in times if t >= now - WINDOW]
    if len(recent) < limit and len(times) < 2 * limit:
        return 0
    over = max(0, len(times) - limit)
    lock = min(MAX_LOCK, WINDOW * 2 ** min(over, 2))
    return max(0, int(times[0] + lock - now) + 1)


# --- checks ------------------------------------------------------------------
class Verdict:
    def __init__(self, retry_after: int = 0, captcha: bool = False, why: str = ""):
        self.retry_after = retry_after
        self.captcha = captcha
        self.why = why

    @property
    def blocked(self) -> bool:
        return self.retry_after > 0


def check_link(ip: str, email: str) -> Verdict:
    """May this IP ask for a sign-in link for this email right now?"""
    ih = ip_key(ip)
    by_ip = _times("ip_hash", ih, LINK_KINDS)
    by_email = _times("email", email, LINK_KINDS) if email else []
    failed = _times("ip_hash", ih, VERIFY_KINDS)
    wait_ip = _retry_after(by_ip, LINK_IP_MAX)
    wait_email = _retry_after(by_email, LINK_EMAIL_MAX)
    if wait_ip or wait_email:
        return Verdict(max(wait_ip, wait_email), why="ip" if wait_ip >= wait_email else "email")
    now = time.time()
    seen = max(len([t for t in by_ip if t >= now - WINDOW]),
               len([t for t in by_email if t >= now - WINDOW]),
               len([t for t in failed if t >= now - WINDOW]))
    return Verdict(captcha=seen >= CAPTCHA_AFTER)


def check_verify(ip: str) -> Verdict:
    """May this IP try another link or session token right now?"""
    return Verdict(_retry_after(_times("ip_hash", ip_key(ip), VERIFY_KINDS), VERIFY_FAIL_MAX),
                   why="ip")


def verify_captcha(token: str | None, ip: str) -> bool:
    """Server-side Turnstile check. True when CAPTCHA isn't configured."""
    if not captcha_enabled():
        return True
    if not token or len(token) > 2048:
        return False
    try:
        r = requests.post("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                          data={"secret": TURNSTILE_SECRET, "response": token, "remoteip": ip},
                          timeout=_TIMEOUT)
        return bool(r.ok and r.json().get("success"))
    except Exception:
        return False
