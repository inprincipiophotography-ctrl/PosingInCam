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
    "STRIPE_PRICE_PRO_MONTHLY": "price_monthly",
    "STRIPE_PRICE_PRO_YEARLY": "price_yearly",
    "STRIPE_PRICE_PACK20": "price_pack20",
})
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests  # noqa: E402
import stripe  # noqa: E402
from webauth import auth, billing  # noqa: E402

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
DEFAULT_ROW = {"email": None, "free_used": 0, "credits": 0, "plan": "free",
               "subscription_status": None, "current_period_end": None, "stripe_customer_id": None}


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


SUBS = {}


def setup():
    fake = FakeSupabase()
    auth.requests = billing.requests = _Requests(fake)
    billing._retrieve_sub = lambda _stripe, sub_id: SUBS[sub_id]
    return fake


def subscription(sub_id, customer, status="active", price="price_monthly", days=30):
    sub = {"id": sub_id, "object": "subscription", "status": status, "customer": customer,
           "items": {"data": [{"price": {"id": price},
                               "current_period_end": int(time.time()) + days * 86400}]}}
    SUBS[sub_id] = sub
    return sub


def event(etype, obj, eid=None):
    return {"id": eid or "evt_" + uuid.uuid4().hex, "object": "event", "type": etype,
            "data": {"object": obj}}


def checkout_done(uid, mode, customer="cus_1", sub_id=None):
    obj = {"id": "cs_test_" + uuid.uuid4().hex[:8], "object": "checkout.session", "mode": mode,
           "client_reference_id": uid, "customer": customer, "payment_status": "paid"}
    if sub_id:
        obj["subscription"] = sub_id
    return event("checkout.session.completed", obj)


def deliver(evt, secret="whsec_test_secret"):
    payload = json.dumps(evt).encode()
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    billing.handle_webhook(payload, f"t={t},v1={sig}")


# --- 20-pack ----------------------------------------------------------------
def test_pack20_adds_20_credits():
    fake = setup()
    uid = fake.add_user()
    deliver(checkout_done(uid, "payment", customer="cus_pack"))
    row = fake.profiles[uid]
    assert row["credits"] == 20, row
    assert row["stripe_customer_id"] == "cus_pack", row
    d = auth.decide(auth.get_profile(uid), 1)
    assert d["allowed"] and not d["watermark"] and d["tier"] == "credits", d


def test_pack20_when_the_profile_row_is_missing():
    # An account made before the signup trigger existed has no profiles row;
    # every entitlement write is an UPDATE, so the purchase must create it.
    fake = setup()
    uid = fake.add_user(with_profile=False)
    deliver(checkout_done(uid, "payment"))
    assert uid in fake.profiles, "payment recorded nowhere: no profile row"
    assert fake.profiles[uid]["credits"] == 20, fake.profiles[uid]


def test_duplicate_delivery_credits_once():
    fake = setup()
    uid = fake.add_user()
    evt = checkout_done(uid, "payment")
    deliver(evt)
    deliver(evt)                                    # Stripe retry / duplicate
    assert fake.profiles[uid]["credits"] == 20, fake.profiles[uid]


def test_outage_is_retried_not_lost():
    fake = setup()
    uid = fake.add_user()
    evt = checkout_done(uid, "payment")
    fake.outage = ("PATCH", "/rest/v1/profiles")    # a write fails mid-way
    try:
        deliver(evt)
        raise AssertionError("an outage must fail the webhook so Stripe retries")
    except requests.HTTPError:
        pass
    assert evt["id"] not in fake.events, "claim kept: the retry would be skipped"
    deliver(evt)                                    # Stripe's retry
    assert fake.profiles[uid]["credits"] == 20, fake.profiles[uid]


# --- Pro --------------------------------------------------------------------
def test_pro_subscription_unlocks_pro():
    fake = setup()
    uid = fake.add_user()
    subscription("sub_pro", "cus_pro")
    deliver(checkout_done(uid, "subscription", customer="cus_pro", sub_id="sub_pro"))
    p = auth.get_profile(uid)
    assert p["plan"] == "pro" and p["subscription_status"] == "active", p
    assert auth.is_pro(p), p
    assert auth.account_state(p)["plan"] == "pro"
    d = auth.decide(p, 25)
    assert d["allowed"] and not d["watermark"] and d["tier"] == "pro", d


def test_pro_when_the_profile_row_is_missing():
    fake = setup()
    uid = fake.add_user(with_profile=False)
    subscription("sub_new", "cus_new", price="price_yearly", days=365)
    deliver(checkout_done(uid, "subscription", customer="cus_new", sub_id="sub_new"))
    assert uid in fake.profiles, "payment recorded nowhere: no profile row"
    assert auth.is_pro(fake.profiles[uid]), fake.profiles[uid]


def test_renewal_and_cancellation():
    fake = setup()
    uid = fake.add_user()
    subscription("sub_r", "cus_r", days=3)
    deliver(checkout_done(uid, "subscription", customer="cus_r", sub_id="sub_r"))
    renewed = subscription("sub_r", "cus_r", days=33)
    deliver(event("invoice.paid", {"id": "in_1", "object": "invoice", "subscription": "sub_r"}))
    assert fake.profiles[uid]["current_period_end"] > billing._period_end(subscription("tmp", "x", days=30))
    cancelled = dict(renewed, status="canceled")
    deliver(event("customer.subscription.deleted", cancelled))
    p = fake.profiles[uid]
    assert p["plan"] == "free" and not auth.is_pro(p), p


# --- events that are not ours -----------------------------------------------
def test_other_sites_checkouts_are_ignored():
    # The Stripe account is shared with the wedding site.
    fake = setup()
    deliver(checkout_done(None, "payment"))                      # no client_reference_id
    deliver(checkout_done(str(uuid.uuid4()), "payment"))         # not one of our users
    deliver(checkout_done("order-1234", "payment"))              # not even a uuid
    other = subscription("sub_other", "cus_other", price="price_wedding")
    deliver(checkout_done(None, "subscription", customer="cus_other", sub_id="sub_other"))
    deliver(event("customer.subscription.updated", other))
    assert fake.profiles == {}, fake.profiles


def test_bad_signature_rejected():
    fake = setup()
    uid = fake.add_user()
    try:
        deliver(checkout_done(uid, "payment"), secret="whsec_wrong")
        raise AssertionError("forged webhook accepted")
    except stripe.SignatureVerificationError:
        pass
    assert fake.profiles[uid]["credits"] == 0


# --- reading the account ------------------------------------------------------
def test_get_profile_creates_a_missing_row():
    fake = setup()
    uid = fake.add_user(with_profile=False)
    p = auth.get_profile(uid)
    assert p["plan"] == "free" and p["credits"] == 0, p
    assert uid in fake.profiles, "free usage would never be counted without a row"


def test_spending_credits_after_purchase():
    fake = setup()
    uid = fake.add_user()
    deliver(checkout_done(uid, "payment"))
    p = auth.get_profile(uid)
    d = auth.decide(p, 3)
    auth.consume(uid, p, 3, d["tier"], "sony")
    assert fake.profiles[uid]["credits"] == 17, fake.profiles[uid]


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
        origin = "https://posing-in-cam.vercel.app"
        assert billing.create_checkout(uid, "kim@example.com", "pack20", origin) == _Session.url
        assert billing.create_checkout(uid, "kim@example.com", "monthly", origin) == _Session.url
        assert billing.create_checkout(uid, "kim@example.com", "yearly", origin) == _Session.url
    finally:
        stripe.checkout.Session.create = orig
    pack, monthly, yearly = seen
    assert pack["mode"] == "payment" and pack["customer_creation"] == "always", pack
    assert pack["line_items"] == [{"price": "price_pack20", "quantity": 1}], pack
    assert monthly["mode"] == "subscription" and monthly["customer_creation"] is None, monthly
    assert monthly["line_items"] == [{"price": "price_monthly", "quantity": 1}], monthly
    assert yearly["line_items"] == [{"price": "price_yearly", "quantity": 1}], yearly
    for s in seen:
        assert s["client_reference_id"] == uid and s["customer_email"] == "kim@example.com", s
        assert s["success_url"] == origin + "/?checkout=success", s
        assert s["cancel_url"] == origin + "/?checkout=cancel", s
    assert billing.safe_origin("https://evil.example") == origin


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
