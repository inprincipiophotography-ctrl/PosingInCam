"""Sign-in security tests: cookie sessions, rate limits, lockout, CAPTCHA, CSRF.

Runs the real /api/auth, /api/me and /api/checkout Flask apps against a fake
Supabase (Auth + the auth_events table). Access tokens are real ES256 JWTs
checked by the real verify_user, with the fake JWKS holding the public key.
Run: python qa/test_auth.py
"""

import base64
import datetime as dt
import hashlib
import importlib.util
import os
import sys
import time
import uuid
from http.cookies import SimpleCookie

os.environ.update({
    "SUPABASE_URL": "https://fake.supabase.test",
    "SUPABASE_SERVICE_KEY": "sb_secret_fake",
    "SUPABASE_JWT_SECRET": "unused",
    "STRIPE_SECRET_KEY": "sk_test_fake",
    "STRIPE_PRICE_PRO_MONTHLY": "price_monthly",
})
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import jwt  # noqa: E402
import requests  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from webauth import auth, guard, session  # noqa: E402

KEY = ec.generate_private_key(ec.SECP256R1())
ORIGIN = "https://cards.notalucis.com"


class _Jwks:
    def get_signing_key_from_jwt(self, _token):
        return type("K", (), {"key": KEY.public_key()})()


auth._jwks_client = _Jwks()


def make_jwt(uid, email, ttl=3600):
    now = int(time.time())
    return jwt.encode({"sub": uid, "email": email, "aud": "authenticated",
                       "iat": now, "exp": now + ttl}, KEY, algorithm="ES256")


class R:
    def __init__(self, status, body=None):
        self.status_code = status
        self.ok = 200 <= status < 300
        self._body = body

    def json(self):
        return self._body

    def raise_for_status(self):
        if not self.ok:
            raise requests.HTTPError(str(self.status_code))


class FakeSupabase:
    def __init__(self):
        self.users = {}            # email -> uid
        self.codes = {}            # auth_code -> (email, code_challenge)
        self.hashes = {}           # token_hash -> email
        self.refresh_tokens = {}   # refresh_token -> email
        self.revoked = []
        self.events = []           # auth_events rows
        self.events_table = True
        self.otp_calls = []
        self.forwarded = []
        self.captcha_ok = True
        self.ttl = 3600

    def session_for(self, email):
        uid = self.users.setdefault(email, str(uuid.uuid4()))
        rt = "rt_" + uuid.uuid4().hex
        self.refresh_tokens[rt] = email
        return {"access_token": make_jwt(uid, email, self.ttl), "refresh_token": rt,
                "expires_in": 3600, "user": {"id": uid, "email": email}}

    def post(self, url, params=None, json=None, data=None, headers=None, timeout=None):
        if url.startswith("https://challenges.cloudflare.com"):
            return R(200, {"success": self.captcha_ok and data.get("response") == "good-token"})
        path = url.split(".test", 1)[1]
        self.forwarded.append((headers or {}).get("Sb-Forwarded-For"))
        if path == "/auth/v1/otp":
            self.otp_calls.append((json, params))
            code = "code_" + uuid.uuid4().hex
            self.codes[code] = (json["email"], json["code_challenge"])
            self.hashes["pkce_" + code] = json["email"]
            return R(200, {})
        if path == "/auth/v1/token" and params["grant_type"] == "pkce":
            entry = self.codes.pop(json["auth_code"], None)
            if not entry:
                return R(400, {"error": "invalid code"})
            want = base64.urlsafe_b64encode(hashlib.sha256(json["code_verifier"].encode()).digest()).rstrip(b"=").decode()
            if want != entry[1]:
                return R(400, {"error": "bad verifier"})
            return R(200, self.session_for(entry[0]))
        if path == "/auth/v1/token" and params["grant_type"] == "refresh_token":
            email = self.refresh_tokens.pop(json["refresh_token"], None)
            return R(200, self.session_for(email)) if email else R(400, {"error": "invalid_grant"})
        if path == "/auth/v1/verify":
            email = self.hashes.pop(json["token_hash"], None)
            return R(200, self.session_for(email)) if email else R(403, {"error": "expired"})
        if path == "/auth/v1/logout":
            self.revoked.append(headers.get("Authorization"))
            return R(204)
        if path == "/rest/v1/auth_events":
            if not self.events_table:
                return R(404, {"code": "PGRST205"})
            self.events.append({**json, "created_at": dt.datetime.now(dt.timezone.utc).isoformat()})
            return R(201)
        if path == "/rest/v1/profiles":
            return R(201)
        raise AssertionError(f"unexpected POST {path}")

    def get(self, url, params=None, headers=None, timeout=None):
        path = url.split(".test", 1)[1]
        if path == "/rest/v1/auth_events":
            if not self.events_table:
                return R(404, {"code": "PGRST205"})
            field = "ip_hash" if "ip_hash" in params else "email"
            value = params[field][3:]
            kinds = params["kind"][4:-1].split(",")
            since = dt.datetime.fromisoformat(params["created_at"][4:])
            rows = [e for e in self.events if e.get(field) == value and e["kind"] in kinds
                    and dt.datetime.fromisoformat(e["created_at"]) >= since]
            return R(200, sorted(rows, key=lambda e: e["created_at"], reverse=True))
        if path == "/rest/v1/profiles":
            return R(200, [])
        raise AssertionError(f"unexpected GET {path}")

    def delete(self, url, params=None, headers=None, timeout=None):
        return R(204)


FAKE = FakeSupabase()
requests.post, requests.get, requests.delete = FAKE.post, FAKE.get, FAKE.delete


def _load(name):
    spec = importlib.util.spec_from_file_location(f"api_{name}", os.path.join(ROOT, "api", f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.app.test_client(use_cookies=False)


AUTH, ME, CHECKOUT = _load("auth"), _load("me"), _load("checkout")
_ip = [0]


def fresh_ip():
    _ip[0] += 1
    return f"203.0.113.{_ip[0]}"


def reset():
    FAKE.__init__()
    guard._table_ok = None
    guard._mem.clear()
    guard.TURNSTILE_SITE_KEY = guard.TURNSTILE_SECRET = ""


def cookies_of(resp):
    """{name: Morsel} for every Set-Cookie on a response."""
    out = {}
    for h in resp.headers.getlist("Set-Cookie"):
        c = SimpleCookie()
        c.load(h)
        for k, m in c.items():
            out[k] = (m, h)
    return out


def cookie_header(d):
    return "; ".join(f"{k}={v}" for k, v in d.items())


def login(email, ip, captcha=None, origin=ORIGIN):
    body = {"email": email, **({"captcha": captcha} if captcha else {})}
    return AUTH.post("/api/auth?action=login", json=body,
                     headers={"Origin": origin, "X-Real-IP": ip})


def sign_in(email="kim@example.com", ip=None):
    """Full magic-link round trip; returns the session cookies the browser holds."""
    ip = ip or fresh_ip()
    r = login(email, ip)
    assert r.status_code == 200, r.get_json()
    verifier = cookies_of(r)[session.PKCE][0].value
    code = list(FAKE.codes)[-1]
    cb = AUTH.get(f"/api/auth?action=callback&code={code}",
                  headers={"Cookie": f"{session.PKCE}={verifier}", "X-Real-IP": ip})
    assert cb.status_code == 303 and cb.headers["Location"] == "/?signin=ok", cb.headers.get("Location")
    got = cookies_of(cb)
    return {session.AT: got[session.AT][0].value, session.RT: got[session.RT][0].value}


# --- 1. session tokens: HttpOnly cookies, never in a response body ------------
def test_login_never_returns_a_token_and_sets_a_locked_down_pkce_cookie():
    reset()
    r = login("kim@example.com", fresh_ip())
    assert r.status_code == 200 and r.get_json() == {"sent": True}
    morsel, raw = cookies_of(r)[session.PKCE]
    assert morsel["httponly"] and morsel["secure"] and morsel["path"] == "/", raw
    assert "SameSite=Lax" in raw, raw
    body, params = FAKE.otp_calls[-1]
    assert body["code_challenge_method"] == "s256" and body["code_challenge"] != morsel.value
    assert params["redirect_to"] == f"{ORIGIN}/api/auth?action=callback"


def test_callback_sets_httponly_secure_strict_session_cookies():
    reset()
    ip = fresh_ip()
    r = login("ivan@example.com", ip)
    verifier = cookies_of(r)[session.PKCE][0].value
    code = list(FAKE.codes)[-1]
    cb = AUTH.get(f"/api/auth?action=callback&code={code}",
                  headers={"Cookie": f"{session.PKCE}={verifier}", "X-Real-IP": ip})
    assert cb.status_code == 303 and cb.headers["Location"] == "/?signin=ok"
    got = cookies_of(cb)
    for name in (session.AT, session.RT):
        morsel, raw = got[name]
        assert name.startswith("__Host-") and morsel["httponly"] and morsel["secure"], raw
        assert "SameSite=Strict" in raw and morsel["path"] == "/" and not morsel["domain"], raw
    assert got[session.PKCE][0]["max-age"] == "0"          # verifier used up
    assert b"access_token" not in cb.data and b"rt_" not in cb.data
    assert cb.headers["Referrer-Policy"] == "no-referrer"


def test_token_hash_link_works_on_any_device():
    reset()
    ip = fresh_ip()
    login("kim@example.com", ip)
    token_hash = list(FAKE.hashes)[-1]
    cb = AUTH.get(f"/api/auth?action=callback&token_hash={token_hash}&type=email",
                  headers={"X-Real-IP": fresh_ip()})                  # no verifier cookie
    assert cb.headers["Location"] == "/?signin=ok"
    assert session.AT in cookies_of(cb)


def test_code_without_verifier_is_refused():
    reset()
    login("kim@example.com", fresh_ip())
    code = list(FAKE.codes)[-1]
    cb = AUTH.get(f"/api/auth?action=callback&code={code}", headers={"X-Real-IP": fresh_ip()})
    assert cb.headers["Location"] == "/?signin=other-browser"
    assert session.AT not in cookies_of(cb)


def test_me_reads_the_cookie_and_never_echoes_tokens():
    reset()
    jar = sign_in("kim@example.com")
    r = ME.get("/api/me", headers={"Cookie": cookie_header(jar)})
    j = r.get_json()
    assert j["signed_in"] is True and j["email"] == "kim@example.com", j
    assert jar[session.AT] not in r.get_data(as_text=True)
    anon = ME.get("/api/me").get_json()
    assert anon == {"paywall": True, "signed_in": False}, anon


def test_expired_access_token_is_refreshed_and_rotated():
    reset()
    FAKE.ttl = -10                                  # every issued token is already expired
    jar = sign_in("kim@example.com")
    FAKE.ttl = 3600
    r = ME.get("/api/me", headers={"Cookie": cookie_header(jar), "X-Real-IP": fresh_ip()})
    assert r.get_json()["signed_in"] is True
    got = cookies_of(r)
    assert got[session.RT][0].value != jar[session.RT]          # rotated
    assert "SameSite=Strict" in got[session.AT][1]
    assert r.headers["Cache-Control"] == "no-store"


def test_dead_refresh_token_signs_out_and_clears_cookies():
    reset()
    r = ME.get("/api/me", headers={"Cookie": f"{session.RT}=rt_stolen_or_old",
                                   "X-Real-IP": fresh_ip()})
    assert r.get_json()["signed_in"] is False
    got = cookies_of(r)
    assert got[session.AT][0]["max-age"] == "0" and got[session.RT][0]["max-age"] == "0"
    assert any(e["kind"] == "verify_failed" for e in FAKE.events)


def test_forged_token_is_rejected():
    reset()
    other = ec.generate_private_key(ec.SECP256R1())
    now = int(time.time())
    forged = jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": now + 600},
                        other, algorithm="ES256")
    r = ME.get("/api/me", headers={"Cookie": f"{session.AT}={forged}"})
    assert r.get_json()["signed_in"] is False


def test_logout_revokes_and_clears():
    reset()
    jar = sign_in("kim@example.com")
    r = AUTH.post("/api/auth?action=logout", headers={"Cookie": cookie_header(jar), "Origin": ORIGIN})
    assert r.status_code == 200
    got = cookies_of(r)
    assert got[session.AT][0]["max-age"] == "0" and got[session.RT][0]["max-age"] == "0"
    assert FAKE.revoked == [f"Bearer {jar[session.AT]}"]


def test_old_localstorage_session_moves_to_cookies_once():
    reset()
    old = FAKE.session_for("kim@example.com")["refresh_token"]
    r = AUTH.post("/api/auth?action=migrate", json={"refresh_token": old},
                  headers={"Origin": ORIGIN, "X-Real-IP": fresh_ip()})
    assert r.status_code == 200 and session.AT in cookies_of(r)
    again = AUTH.post("/api/auth?action=migrate", json={"refresh_token": old},
                      headers={"Origin": ORIGIN, "X-Real-IP": fresh_ip()})
    assert again.status_code == 401                                 # single use


# --- CSRF: cookies make cross-site writes the new risk -----------------------
def test_cross_site_writes_are_refused():
    reset()
    jar = sign_in("kim@example.com")
    evil = CHECKOUT.post("/api/checkout", json={"kind": "monthly"},
                         headers={"Cookie": cookie_header(jar), "Origin": "https://evil.example"})
    assert evil.status_code == 403
    sibling = CHECKOUT.post("/api/checkout", json={"kind": "monthly"},
                            headers={"Cookie": cookie_header(jar), "Sec-Fetch-Site": "same-site"})
    assert sibling.status_code == 403
    assert login("kim@example.com", fresh_ip(), origin="https://evil.example").status_code == 403


# --- 4. rate limits, lockout, CAPTCHA, backoff, logging ----------------------
def test_ip_limit_five_per_window():
    reset()
    ip = fresh_ip()
    for i in range(guard.LINK_IP_MAX):
        assert login(f"user{i}@example.com", ip).status_code == 200
    r = login("user99@example.com", ip)
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 0, r.get_json()
    assert len(FAKE.otp_calls) == guard.LINK_IP_MAX                 # Supabase never asked
    assert login("user99@example.com", fresh_ip()).status_code == 200   # other visitors unaffected


def test_email_is_locked_after_repeated_requests():
    reset()
    for _ in range(guard.LINK_EMAIL_MAX):
        assert login("kim@example.com", fresh_ip()).status_code == 200
    r = login("kim@example.com", fresh_ip())                         # any IP
    assert r.status_code == 429, r.get_json()
    assert any(e["kind"] == "link_blocked" and e["detail"] == "email" for e in FAKE.events)


def test_captcha_required_after_three_attempts():
    reset()
    guard.TURNSTILE_SITE_KEY, guard.TURNSTILE_SECRET = "site-key", "secret"
    ip = fresh_ip()
    for i in range(guard.CAPTCHA_AFTER):
        assert login(f"a{i}@example.com", ip).status_code == 200
    r = login("a9@example.com", ip)
    j = r.get_json()
    assert r.status_code == 403 and j["captcha_required"] and j["captcha_site_key"] == "site-key"
    bad = login("a9@example.com", ip, captcha="bad-token")
    assert bad.status_code == 403 and any(e["kind"] == "captcha_failed" for e in FAKE.events)
    ok = login("a9@example.com", ip, captcha="good-token")
    assert ok.status_code == 200, ok.get_json()


def test_failed_link_verifications_lock_the_ip():
    reset()
    ip = fresh_ip()
    for _ in range(guard.VERIFY_FAIL_MAX):
        cb = AUTH.get("/api/auth?action=callback&token_hash=guess&type=email", headers={"X-Real-IP": ip})
        assert cb.headers["Location"] == "/?signin=expired"
    login("kim@example.com", fresh_ip())
    good = list(FAKE.hashes)[-1]
    cb = AUTH.get(f"/api/auth?action=callback&token_hash={good}&type=email", headers={"X-Real-IP": ip})
    assert cb.headers["Location"] == "/?signin=limited"              # even a real link waits
    assert good in FAKE.hashes                                       # never sent to Supabase


def test_backoff_doubles_and_is_capped():
    now = time.time()
    waits = []
    for n in (5, 6, 7, 12):
        times = [now - i for i in range(n)]
        waits.append(guard._retry_after(times, 5))
    assert waits[0] < waits[1] < waits[2] == waits[3] <= guard.MAX_LOCK + 1, waits
    assert guard._retry_after([now - 1] * 4, 5) == 0


def test_every_attempt_is_logged_with_hashed_ip():
    reset()
    ip = "198.51.100.7"
    login("kim@example.com", ip)
    AUTH.get("/api/auth?action=callback&token_hash=nope", headers={"X-Real-IP": ip})
    kinds = [e["kind"] for e in FAKE.events]
    assert kinds == ["link_sent", "verify_failed"], kinds
    assert all(e["ip_hash"] and ip not in str(e) for e in FAKE.events)


def test_limits_still_hold_before_the_table_exists():
    reset()
    FAKE.events_table = False
    ip = fresh_ip()
    for i in range(guard.LINK_IP_MAX):
        assert login(f"m{i}@example.com", ip).status_code == 200
    assert login("m9@example.com", ip).status_code == 429


def test_visitor_ip_is_forwarded_to_supabase():
    reset()
    login("kim@example.com", "192.0.2.44")
    assert "192.0.2.44" in FAKE.forwarded


def test_bad_email_rejected():
    reset()
    assert login("not-an-email", fresh_ip()).status_code == 400
    assert login("a@b.c" + "x" * 300, fresh_ip()).status_code == 400


if __name__ == "__main__":
    fns = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok:", fn.__name__)
    print(f"\nAll {len(fns)} auth tests passed.")
