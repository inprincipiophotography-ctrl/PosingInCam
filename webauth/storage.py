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
import re

import requests

from . import auth

BUCKET = "cards"
_TIMEOUT = 20
SIGN_TTL_SEC = 3600


def enabled() -> bool:
    return auth.paywall_enabled()


def _url(path: str) -> str:
    return f"{auth.SUPABASE_URL}/storage/v1/{path}"


_CARD_NAME = re.compile(r"^[A-Za-z0-9_]{1,40}\.(?:JPG|jpg)$")
_BATCH_KEY = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def owned_path(uid: str, prefix: str, name: str) -> str | None:
    """The bucket path of one stored card, only if it lies in this user's own
    folder. Rows are already fetched with user_id = uid; this is a second lock,
    so a bad or tampered row can never serve another user's files."""
    parts = (prefix or "").split("/")
    if len(parts) != 2 or parts[0] != uid or not _BATCH_KEY.match(parts[1]):
        return None
    if not _CARD_NAME.match(name or ""):
        return None
    return f"{prefix}/{name}"


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


# Vercel caps a function's response body at 4.5 MB. A ZIP bigger than this
# (camera q-tables are near-lossless on Canon, so ~7 photo cards already pass it)
# is handed over as a signed Storage link instead of in the response.
MAX_INLINE_ZIP = 4_000_000


def zip_link(uid: str, key: str, data: bytes) -> str | None:
    """Store a ZIP under <uid>/zips/<key>.zip and return a signed download URL
    (served as an attachment named shoot-cards.zip), or None on any failure."""
    path = f"{uid}/zips/{key}.zip"
    try:
        r = requests.post(_url(f"object/{BUCKET}/{path}"),
                          headers={"apikey": auth.SERVICE_KEY,
                                   "Authorization": f"Bearer {auth.SERVICE_KEY}",
                                   "Content-Type": "application/zip",
                                   "x-upsert": "true"},
                          data=data, timeout=60)
        if not r.ok:
            return None
    except Exception:
        return None
    url = sign_urls([path]).get(path)
    return f"{url}&download=shoot-cards.zip" if url else None


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
