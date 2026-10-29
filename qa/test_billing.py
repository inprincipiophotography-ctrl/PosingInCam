"""Purchase -> entitlement tests: signed Stripe webhook events against a fake
Supabase, so a payment is proven to end up on the buyer's account.

The fake PostgREST keeps the behaviours that matter here: a PATCH or an RPC
UPDATE that matches no row is a silent success, and inserting a profile honours
the auth.users foreign key. Stripe's own signature check runs for real.
Run: python qa/test_billing.py
"""

import hashlib
import hmac
import json
import os
import re
import sys
import time
import uuid

os.environ.update({
    "SUPABASE_URL": "https://fake.supabase.test",
    "SUPABASE_SERVICE_KEY": "service-key",
    "SUPABASE_JWT_SECRET": "unused",
    "STRIPE_SECRET_KEY": "sk_test_fake",
    "STRIPE_WEBHOOK_SECRET": "whsec_test_secret",
    "STRIPE_PRICE_PRO": "price_pro",
})
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests  # noqa: E402
import stripe  # noqa: E402
from webauth import auth, billing  # noqa: E402

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
DEFAULT_ROW = {"email": None, "free_used": 0, "credits": 0, "plan": "free",
               "subscription_status": None, "current_period_end": None, "stripe_customer_id": None,
               "cancel_at": None}


class FakeResponse:
    def __init__(self, status, body=None):
        self.status_code = status
        self.ok = 200 <= status < 300
        self._body = body

    def json(self):
        return self._body

    def raise_for_status(self):
        if not self.ok:
            raise requests.HTTPError(f"{self.status_code} from fake Supabase")


class FakeSupabase:
    def __init__(self):
        self.users = set()       # auth.users ids
        self.profiles = {}       # id -> row
        self.events = set()      # stripe_events ids
        self.outage = None       # (method, path): answer the next such call with 503

    def add_user(self, with_profile=True):
        uid = str(uuid.uuid4())
        self.users.add(uid)
        if with_profile:          # what the signup trigger does
            self.profiles[uid] = {"id": uid, **DEFAULT_ROW}
        return uid

    def _rows(self, params):
        (field, cond), = [(k, v) for k, v in (params or {}).items() if k != "select"]
        assert cond.startswith("eq."), cond
        if field == "id" and not _UUID.match(cond[3:]):
            return None                                           # Postgres: invalid uuid
        return [r for r in self.profiles.values() if str(r.get(field)) == cond[3:]]

    def handle(self, method, url, params=None, json=None, headers=None, timeout=None):
        path = url.split(".test", 1)[1]
        prefer = (headers or {}).get("Prefer", "")
        if self.outage == (method, path):
            self.outage = None
            return FakeResponse(503, {"message": "service unavailable"})
        if path == "/rest/v1/profiles" and method in ("GET", "PATCH") and self._rows(params) is None:
            return FakeResponse(400, {"code": "22P02"})
        if path == "/rest/v1/profiles":
            if method == "GET":
                return FakeResponse(200, [dict(r) for r in self._rows(params)])
            if method == "POST":
                uid = json.get("id")
                if not isinstance(uid, str) or not _UUID.match(uid):
                    return FakeResponse(400, {"code": "22P02"})
                if uid not in self.users:
                    return FakeResponse(409, {"code": "23503"})     # foreign key
                if uid in self.profiles:
                    if "ignore-duplicates" in prefer:
                        return FakeResponse(201)
                    return FakeResponse(409, {"code": "23505"})
                self.profiles[uid] = {"id": uid, **DEFAULT_ROW, **json}
                return FakeResponse(201)
            if method == "PATCH":
                rows = self._rows(params)
                for r in rows:
                    r.update(json)
                if "return=representation" in prefer:
                    return FakeResponse(200, [dict(r) for r in rows])
                return FakeResponse(204)                          # even when nothing matched
        if path.startswith("/rest/v1/rpc/"):
            row = self.profiles.get(json["p_uid"])
            if row:                                               # UPDATE ... WHERE id = p_uid
                name, n = path.rsplit("/", 1)[1], json["p_n"]
                if name == "add_credits":
                    row["credits"] += n
                elif name == "spend_credits":
                    row["credits"] = max(0, row["credits"] - n)
                elif name == "add_free_used":
                    row["free_used"] += n
            return FakeResponse(204)
        if path == "/rest/v1/stripe_events":
            if method == "POST":
                if json["id"] in self.events:
                    return FakeResponse(409, {"code": "23505"})
                self.events.add(json["id"])
                return FakeResponse(201)
            if method == "DELETE":
                self.events.discard(params["id"][3:])
                return FakeResponse(204)
        if path == "/rest/v1/conversions":
            return FakeResponse(201)
        raise AssertionError(f"unexpected request {method} {url}")


class _Requests:
    """Stands in for the requests module inside webauth."""
    HTTPError = requests.HTTPError

    def __init__(self, fake):
        self.fake = fake

    def get(self, url, **kw):
        return self.fake.handle("GET", url, **kw)

    def post(self, url, **kw):
        return self.fake.handle("POST", url, **kw)

    def patch(self, url, **kw):
        return self.fake.handle("PATCH", url, **kw)

    def delete(self, url, **kw):
        return self.fake.handle("DELETE", url, **kw)


def setup():
    fake = FakeSupabase()
    auth.requests = billing.requests = _Requests(fake)
    return fake


def event(etype, obj, eid=None):
    return {"id": eid or "evt_" + uuid.uuid4().hex, "object": "event", "type": etype,
            "data": {"object": obj}}


def checkout_done(uid, customer="cus_1", kind="pro", paid="paid", etype="checkout.session.completed"):
    obj = {"id": "cs_test_" + uuid.uuid4().hex[:8], "object": "checkout.session", "mode": "payment",
           "client_reference_id": uid, "customer": customer, "payment_status": paid,
           "metadata": {"kind": kind} if kind else {}}
    return event(etype, obj)


def deliver(evt, secret="whsec_test_secret"):
    payload = json.dumps(evt).encode()
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    billing.handle_webhook(payload, f"t={t},v1={sig}")


# --- Pro, bought once -------------------------------------------------------
def test_buying_pro_unlocks_pro_for_good():
    fake = setup()
    uid = fake.add_user()
    deliver(checkout_done(uid, customer="cus_pro"))
    p = auth.get_profile(uid)
    assert p["plan"] == "pro" and p["subscription_status"] == "lifetime", p
    assert p["current_period_end"] is None and p["stripe_customer_id"] == "cus_pro", p
    assert auth.is_pro(p), p
    assert auth.account_state(p) == {"plan": "pro", "credits": 0, "free_left": 3, "free_limit": 3}
    d = auth.decide(p, 25)
    assert d["allowed"] and not d["watermark"] and d["tier"] == "pro", d


def test_pro_when_the_profile_row_is_missing():
    # An account made before the signup trigger existed has no profiles row;
    # every entitlement write is an UPDATE, so the purchase must create it.
    fake = setup()
    uid = fake.add_user(with_profile=False)
    deliver(checkout_done(uid))
    assert uid in fake.profiles, "payment recorded nowhere: no profile row"
    assert auth.is_pro(fake.profiles[uid]), fake.profiles[uid]


def test_duplicate_delivery_is_harmless():
    fake = setup()
    uid = fake.add_user()
    evt = checkout_done(uid)
    deliver(evt)
    deliver(evt)                                    # Stripe retry / duplicate
    assert evt["id"] in fake.events and auth.is_pro(fake.profiles[uid])


def test_outage_is_retried_not_lost():
    fake = setup()
    uid = fake.add_user()
    evt = checkout_done(uid)
    fake.outage = ("PATCH", "/rest/v1/profiles")    # a write fails mid-way
    try:
        deliver(evt)
        raise AssertionError("an outage must fail the webhook so Stripe retries")
    except requests.HTTPError:
        pass
    assert evt["id"] not in fake.events, "claim kept: the retry would be skipped"
    deliver(evt)                                    # Stripe's retry
    assert auth.is_pro(fake.profiles[uid]), fake.profiles[uid]


def test_delayed_payment_unlocks_when_it_clears():
    # SEPA Debit and the like: the session completes unpaid, then succeeds later.
    fake = setup()
    uid = fake.add_user()
    deliver(checkout_done(uid, paid="unpaid"))
    assert not auth.is_pro(fake.profiles[uid]), "Pro before the money arrived"
    deliver(checkout_done(uid, etype="checkout.session.async_payment_succeeded"))
    assert auth.is_pro(fake.profiles[uid]), fake.profiles[uid]


def test_old_subscriptions_still_end():
    # Rows from the Pro subscription keep working until their paid period ends.
    fake = setup()
    uid = fake.add_user()
    row = fake.profiles[uid]
    row.update(plan="pro", subscription_status="active",
               current_period_end=auth._now())
    assert not auth.is_pro(row), "a lapsed subscription still counts as Pro"
    row["current_period_end"] = None
    assert auth.is_pro(row)


def test_credits_from_the_old_pack_still_spend():
    fake = setup()
    uid = fake.add_user()
    fake.profiles[uid]["credits"] = 20
    p = auth.get_profile(uid)
    d = auth.decide(p, 3)
    assert d["allowed"] and not d["watermark"] and d["tier"] == "credits", d
    auth.consume(uid, p, 3, d["tier"], "sony")
    assert fake.profiles[uid]["credits"] == 17, fake.profiles[uid]


# --- events that are not ours -----------------------------------------------
def test_other_sites_checkouts_are_ignored():
    # The Stripe account is shared with the wedding site.
    fake = setup()
    deliver(checkout_done(None, kind=None))                      # no client_reference_id
    deliver(checkout_done(str(uuid.uuid4())))                    # not one of our users
    deliver(checkout_done("order-1234"))                         # not even a uuid
    deliver(event("customer.subscription.updated", {"id": "sub_x", "customer": "cus_x",
                                                    "status": "active"}))
    assert fake.profiles == {}, fake.profiles
    uid = fake.add_user()
    deliver(checkout_done(uid, kind=None))                       # a wedding-site order by a user
    assert not auth.is_pro(fake.profiles[uid]), fake.profiles[uid]


def test_bad_signature_rejected():
    fake = setup()
    uid = fake.add_user()
    try:
        deliver(checkout_done(uid), secret="whsec_wrong")
        raise AssertionError("forged webhook accepted")
    except stripe.SignatureVerificationError:
        pass
    assert fake.profiles[uid]["plan"] == "free"


# --- reading the account ------------------------------------------------------
def test_get_profile_creates_a_missing_row():
    fake = setup()
    uid = fake.add_user(with_profile=False)
    p = auth.get_profile(uid)
    assert p["plan"] == "free" and p["credits"] == 0, p
    assert uid in fake.profiles, "free usage would never be counted without a row"


def test_spent_free_cards_point_to_pro():
    d = auth.decide({"free_used": 3, "credits": 0, "plan": "free"}, 1)
    assert not d["allowed"] and "Get Pro once" in d["message"] and "20-pack" not in d["message"], d


# --- checkout session ---------------------------------------------------------
def test_checkout_session_parameters():
    setup()
    seen = []

    class _Session:
        url = "https://checkout.stripe.com/c/pay/cs_test_x"

    orig = stripe.checkout.Session.create
    stripe.checkout.Session.create = lambda **kw: seen.append(kw) or _Session()
    try:
        uid = str(uuid.uuid4())
        origin = "https://cards.notalucis.com"
        assert billing.create_checkout(uid, "kim@example.com", "pro", origin) == _Session.url
        for gone in ("monthly", "yearly", "pack20"):
            try:
                billing.create_checkout(uid, "kim@example.com", gone, origin)
                raise AssertionError(f"{gone} still sells")
            except ValueError:
                pass
    finally:
        stripe.checkout.Session.create = orig
    s, = seen
    assert s["mode"] == "payment" and s["customer_creation"] == "always", s
    assert s["line_items"] == [{"price": "price_pro", "quantity": 1}], s
    assert s["metadata"] == {"kind": "pro"}, s
    # Card statements read "<prefix>* SHOOTCARDS".
    assert s["payment_intent_data"] == {"statement_descriptor_suffix": "SHOOTCARDS",
                                        "metadata": {"kind": "pro"}}, s
    assert s["invoice_creation"] == {"enabled": True}, s
    assert s["tax_id_collection"] == {"enabled": True}, s
    assert s["client_reference_id"] == uid and s["customer_email"] == "kim@example.com", s
    assert s["success_url"] == origin + "/?checkout=success", s
    assert s["cancel_url"] == origin + "/?checkout=cancel", s
    assert billing.safe_origin("https://evil.example") == origin
    # The old Vercel URL stays allowed while it redirects to the new domain.
    assert billing.safe_origin("https://posing-in-cam.vercel.app") == "https://posing-in-cam.vercel.app"


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  ok    {name}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  FAIL  {name}: {e.__class__.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} billing tests passed")
    sys.exit(1 if failed else 0)
