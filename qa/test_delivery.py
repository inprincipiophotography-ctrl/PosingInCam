"""Big ZIPs past Vercel's 4.5 MB response cap go out as a signed Storage link.

A full batch of photo cards (Canon q-tables are near-lossless) easily passes the
cap, and Vercel would answer 413 with no ZIP. These tests drive api/convert.py
and api/history.py with Supabase stubbed out.
Run: python qa/test_delivery.py
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "api"))

from PIL import Image  # noqa: E402

import convert as convert_api  # noqa: E402
import history as history_api  # noqa: E402
from webauth import auth, storage  # noqa: E402


def _png():
    buf = io.BytesIO()
    Image.new("RGB", (600, 400), (40, 90, 160)).save(buf, "PNG")
    return buf.getvalue()


class _Stubs:
    """Signed-in user, paywall on, storage on; records what got charged."""

    def __init__(self, link="https://fake.supabase.test/storage/v1/object/sign/cards/x.zip?token=t"):
        self.link = link
        self.consumed = []
        self.saved = {}

    def __enter__(self):
        self.saved = {
            (auth, "paywall_enabled"): auth.paywall_enabled,
            (auth, "verify_user"): auth.verify_user,
            (auth, "get_profile"): auth.get_profile,
            (auth, "decide"): auth.decide,
            (auth, "get_or_create_default_project"): auth.get_or_create_default_project,
            (auth, "cards_in_project"): auth.cards_in_project,
            (auth, "consume"): auth.consume,
            (storage, "enabled"): storage.enabled,
            (storage, "upload_cards"): storage.upload_cards,
            (storage, "zip_link"): storage.zip_link,
            (storage, "MAX_INLINE_ZIP"): storage.MAX_INLINE_ZIP,
        }
        auth.paywall_enabled = lambda: True
        auth.verify_user = lambda header: ("user-1", "a@b.c")
        auth.get_profile = lambda uid, email: {"plan": "pro"}
        auth.decide = lambda profile, n, email: {"allowed": True, "watermark": False, "tier": "pro"}
        auth.get_or_create_default_project = lambda uid: {"id": 7}
        auth.cards_in_project = lambda uid, pid: 0
        auth.consume = lambda *a, **k: self.consumed.append(a)
        storage.enabled = lambda: True
        storage.upload_cards = lambda uid, key, cards: True
        storage.zip_link = lambda uid, key, data: self.link
        storage.MAX_INLINE_ZIP = 1000  # every real ZIP is "too big"
        return self

    def __exit__(self, *exc):
        for (mod, name), value in self.saved.items():
            setattr(mod, name, value)


def _post(n=2, vendor="canon"):
    client = convert_api.app.test_client()
    files = [(io.BytesIO(_png()), f"d{i}.png") for i in range(n)]
    return client.post("/", data={"vendor": vendor, "files": files},
                       headers={"Authorization": "Bearer t"},
                       content_type="multipart/form-data")


def test_big_batch_comes_back_as_a_signed_link():
    with _Stubs() as s:
        r = _post()
        assert r.status_code == 200, r.data
        assert r.is_json and r.json["zip_url"] == s.link
        assert r.headers["X-First-File"] == "0A0A0001.JPG"
        assert r.headers["X-Last-File"] == "0A0A0002.JPG"
        assert len(s.consumed) == 1, "a delivered batch is charged once"


def test_failed_link_costs_nothing():
    with _Stubs(link=None) as s:
        r = _post()
        assert r.status_code == 413
        assert "too big" in r.json["error"]
        assert s.consumed == [], "nothing may be charged when the ZIP can't be delivered"


def test_small_batch_is_still_inline():
    with _Stubs() as s:
        storage.MAX_INLINE_ZIP = 4_000_000
        r = _post(1)
        assert r.status_code == 200
        assert r.mimetype == "application/zip"
        assert len(s.consumed) == 1


def test_history_redownload_uses_the_link_when_big():
    with _Stubs() as s:
        with history_api.app.test_request_context():
            r = history_api._zip_response("user-1", b"x" * 5000)
            assert r.is_json and r.json["zip_url"] == s.link
            storage.MAX_INLINE_ZIP = 10_000
            r = history_api._zip_response("user-1", b"x" * 5000)
            assert r.mimetype == "application/zip"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok:", fn.__name__)
    print(f"\nAll {len(fns)} tests passed.")
