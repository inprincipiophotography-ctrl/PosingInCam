"""
Supabase Storage helpers for the per-user card history.

Converted cards are copied into the private ``cards`` bucket under
``<user_id>/<batch_key>/<card_filename>`` so a signed-in user can browse and
re-download earlier batches instead of converting the same designs again.
Everything here runs with the service role; clients only ever see short-lived
signed URLs handed out by /api/history.

All writes are best-effort: a storage hiccup must never fail the user's
download, it just means that batch won't show up in their history.
"""

from __future__ import annotations

import concurrent.futures

import requests

from . import auth

BUCKET = "cards"
_TIMEOUT = 20
SIGN_TTL_SEC = 3600


def enabled() -> bool:
    return auth.paywall_enabled()


def _url(path: str) -> str:
    return f"{auth.SUPABASE_URL}/storage/v1/{path}"


def upload_cards(uid: str, batch_key: str, cards: list[tuple[str, bytes]]) -> bool:
    """Upload a batch's converted cards. Returns True only if every file made it."""
    def _put(item):
        filename, data = item
        r = requests.post(
            _url(f"object/{BUCKET}/{uid}/{batch_key}/{filename}"),
            headers={"apikey": auth.SERVICE_KEY,
                     "Authorization": f"Bearer {auth.SERVICE_KEY}",
                     "Content-Type": "image/jpeg",
                     "x-upsert": "true"},
            data=data, timeout=_TIMEOUT)
        return r.ok

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            return all(pool.map(_put, cards))
    except Exception:
        return False


def sign_urls(paths: list[str], ttl: int = SIGN_TTL_SEC) -> dict[str, str]:
    """Batch-sign bucket-relative paths -> {path: absolute signed URL}."""
    if not paths:
        return {}
    try:
        r = requests.post(_url(f"object/sign/{BUCKET}"),
                          headers={"apikey": auth.SERVICE_KEY,
                                   "Authorization": f"Bearer {auth.SERVICE_KEY}",
                                   "Content-Type": "application/json"},
                          json={"paths": paths, "expiresIn": ttl}, timeout=_TIMEOUT)
        if not r.ok:
            return {}
        out = {}
        for row in r.json():
            path, signed = row.get("path"), row.get("signedURL")
            if path and signed:
                out[path] = f"{auth.SUPABASE_URL}/storage/v1{signed}"
        return out
    except Exception:
        return {}


def download(path: str) -> bytes | None:
    """Fetch one object (bucket-relative path) as the service role."""
    try:
        r = requests.get(_url(f"object/{BUCKET}/{path}"),
                         headers={"apikey": auth.SERVICE_KEY,
                                  "Authorization": f"Bearer {auth.SERVICE_KEY}"},
                         timeout=_TIMEOUT)
        return r.content if r.ok else None
    except Exception:
        return None
