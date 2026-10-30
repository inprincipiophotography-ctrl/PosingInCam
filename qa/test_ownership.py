"""Ownership and cost-limit tests: one signed-in user can never read or change
another's data, and nobody can convert without limit.

Two real users (Ana and Bruno) with real ES256 session tokens run against the
real /api/me, /api/history and /api/convert apps. The fake Supabase applies
PostgREST filters the way the real one does, so a missing user_id filter in our
code would leak rows here. Database-level policies (RLS) are checked
separately in supabase/rls_check.sql.
Run: python qa/test_ownership.py
"""

import importlib.util
import io
import os
import sys
import time
import uuid

os.environ.update({
    "SUPABASE_URL": "https://fake.supabase.test",
    "SUPABASE_SERVICE_KEY": "sb_secret_fake",
    "SUPABASE_JWT_SECRET": "unused",
    "RATE_MAX": "0",
})
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import jwt  # noqa: E402
import requests  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from PIL import Image  # noqa: E402
from webauth import auth, session, storage  # noqa: E402

KEY = ec.generate_private_key(ec.SECP256R1())
auth._jwks_client = type("J", (), {"get_signing_key_from_jwt": lambda self, t: type("K", (), {"key": KEY.public_key()})()})()


def token(uid, email):
    now = int(time.time())
    return jwt.encode({"sub": uid, "email": email, "aud": "authenticated", "iat": now, "exp": now + 3600},
                      KEY, algorithm="ES256")


class R:
    def __init__(self, status, body=None, content=b""):
        self.status_code, self.ok, self._body, self.content = status, 200 <= status < 300, body, content

    def json(self):
        return self._body

    def raise_for_status(self):
        if not self.ok:
            raise requests.HTTPError(str(self.status_code))


def _match(row, key, cond):
    v = row.get(key)
    if cond.startswith("eq."):
        return str(v) == cond[3:]
    if cond == "not.is.null":
        return v is not None
    if cond.startswith("in.("):
        return str(v) in cond[4:-1].split(",")
    if cond.startswith("gte."):
        return str(v) >= cond[4:]
    raise AssertionError(f"filter not modelled: {key}={cond}")


class FakeSupabase:
    """PostgREST + Storage with real filtering; the service role sees all rows,
    exactly like production, so only our own filters protect other users."""

    def __init__(self):
        self.tables = {"profiles": [], "projects": [], "conversions": [], "auth_events": []}
        self.objects = {}
        self.next_id = 1

    def _rows(self, table, params):
        rows = self.tables[table]
        for k, cond in (params or {}).items():
            if k in ("select", "order", "limit"):
                continue
            rows = [r for r in rows if _match(r, k, cond)]
        if (params or {}).get("order", "").endswith(".desc"):
            rows = sorted(rows, key=lambda r: str(r.get(params["order"].split(".")[0])), reverse=True)
        return rows[: int(params.get("limit", 10000))] if params else rows

    def get(self, url, params=None, headers=None, timeout=None):
        path = url.split(".test", 1)[1]
        if path.startswith("/rest/v1/"):
            return R(200, [dict(r) for r in self._rows(path[9:], params)])
        if path.startswith("/storage/v1/object/cards/"):
            key = path[len("/storage/v1/object/cards/"):]
            return R(200, content=self.objects[key]) if key in self.objects else R(404)
        raise AssertionError(f"GET {path}")

    def post(self, url, params=None, json=None, data=None, headers=None, timeout=None):
        path = url.split(".test", 1)[1]
        if path.startswith("/rest/v1/rpc/"):
            return R(204)
        if path.startswith("/rest/v1/"):
            table = path[9:]
            row = dict(json)
            row.setdefault("created_at", time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()))
            if table == "projects":
                row.setdefault("id", str(uuid.uuid4()))
            elif table == "conversions":
                row.setdefault("id", self.next_id)
                self.next_id += 1
            if table == "profiles" and any(r["id"] == row["id"] for r in self.tables[table]):
                return R(201, [])
            self.tables[table].append(row)
            return R(201, [row])
        if path.startswith("/storage/v1/object/sign/cards"):
            return R(200, [{"path": p, "signedURL": f"/object/sign/cards/{p}?token=t"} for p in json["paths"]])
        if path.startswith("/storage/v1/object/cards/"):
            self.objects[path[len("/storage/v1/object/cards/"):]] = data
            return R(200, {})
        raise AssertionError(f"POST {path}")

    def patch(self, url, params=None, json=None, headers=None, timeout=None):
        path = url.split(".test", 1)[1]
        if path.startswith("/rest/v1/") and params:
            for row in self._rows(path[9:], params):
                row.update(json or {})
        return R(204, [])

    def delete(self, url, params=None, json=None, headers=None, timeout=None):
        path = url.split(".test", 1)[1]
        if path == "/storage/v1/object/cards":
            for key in (json or {}).get("prefixes", []):
                self.objects.pop(key, None)
            return R(200, [])
        if path.startswith("/rest/v1/") and params:
            table = path[9:]
            gone = self._rows(table, params)
            self.tables[table] = [r for r in self.tables[table] if r not in gone]
            return R(204, [])
        raise AssertionError(f"DELETE {path}")


FAKE = FakeSupabase()
requests.get, requests.post, requests.patch, requests.delete = FAKE.get, FAKE.post, FAKE.patch, FAKE.delete


def _load(name):
    spec = importlib.util.spec_from_file_location(f"own_{name}", os.path.join(ROOT, "api", f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ME, HISTORY = _load("me").app.test_client(use_cookies=False), _load("history").app.test_client(use_cookies=False)
CONVERT_API = _load("convert")
CONVERT = CONVERT_API.app.test_client(use_cookies=False)
ORIGIN = "https://cards.notalucis.com"


class User:
    def __init__(self, email, credits=0):
        self.uid, self.email = str(uuid.uuid4()), email
        FAKE.tables["profiles"].append({"id": self.uid, "email": email, "free_used": 0,
                                        "credits": credits, "plan": "free"})
        self.cookie = f"{session.AT}={token(self.uid, email)}"

    def get(self, client, url):
        return client.get(url, headers={"Cookie": self.cookie})

    def delete_project(self, project_id, origin=ORIGIN):
        return HISTORY.post("/api/history", json={"delete_project": project_id},
                            headers={"Cookie": self.cookie, "Origin": origin})

    def convert(self, **form):
        return convert_as({"Cookie": self.cookie}, **form)


def convert_as(headers, **form):
    buf = io.BytesIO()
    Image.new("RGB", (600, 400), (40, 90, 160)).save(buf, "JPEG")
    data = {"vendor": "sony", **form, "files": (io.BytesIO(buf.getvalue()), "pose.jpg")}
    return CONVERT.post("/api/convert", data=data, content_type="multipart/form-data",
                        headers={"Origin": ORIGIN, **headers})


ANA = User("ana@example.com", credits=20)
BRUNO = User("bruno@example.com", credits=20)
r = ANA.convert(project_name="Ana & Marko wedding")
assert r.status_code == 200, r.get_json()
ANA_PROJECT = r.headers["X-Project-Id"]
ANA_BATCH = next(c["id"] for c in FAKE.tables["conversions"] if c["user_id"] == ANA.uid)


def test_me_returns_only_the_callers_profile():
    assert ANA.get(ME, "/api/me").get_json()["email"] == "ana@example.com"
    assert BRUNO.get(ME, "/api/me").get_json()["email"] == "bruno@example.com"


def test_history_lists_only_own_batches_and_projects():
    j = BRUNO.get(HISTORY, "/api/history").get_json()
    assert j["batches"] == [] and j["projects"] == [], j
    mine = ANA.get(HISTORY, "/api/history").get_json()
    assert [b["id"] for b in mine["batches"]] == [ANA_BATCH]
    assert all(f["url"] and f"/{ANA.uid}/" in f["url"] for b in mine["batches"] for f in b["files"])


def test_cannot_download_another_users_batch():
    assert ANA.get(HISTORY, f"/api/history?download={ANA_BATCH}").status_code == 200
    r = BRUNO.get(HISTORY, f"/api/history?download={ANA_BATCH}")
    assert r.status_code == 404 and r.mimetype == "application/json", r.status_code


def test_cannot_download_another_users_project():
    assert ANA.get(HISTORY, f"/api/history?download_project={ANA_PROJECT}").status_code == 200
    assert BRUNO.get(HISTORY, f"/api/history?download_project={ANA_PROJECT}").status_code == 404


def test_cannot_convert_into_another_users_project():
    before = len([c for c in FAKE.tables["conversions"] if c.get("project_id") == ANA_PROJECT])
    r = BRUNO.convert(project_id=ANA_PROJECT)
    assert r.status_code == 200
    assert r.headers["X-Project-Id"] != ANA_PROJECT               # landed in Bruno's own project
    after = [c for c in FAKE.tables["conversions"] if c.get("project_id") == ANA_PROJECT]
    assert len(after) == before and all(c["user_id"] == ANA.uid for c in after)


def test_a_tampered_row_never_serves_another_users_files():
    # Even if a row of Bruno's pointed into Ana's folder, nothing of Ana's comes out.
    ana_prefix = next(c["storage_prefix"] for c in FAKE.tables["conversions"] if c["user_id"] == ANA.uid)
    FAKE.tables["conversions"].append({"id": 999, "user_id": BRUNO.uid, "vendor": "sony", "cards": 1,
                                       "storage_prefix": ana_prefix, "files": ["DSC00001.JPG"],
                                       "created_at": "2026-10-29T00:00:00+00:00"})
    try:
        j = BRUNO.get(HISTORY, "/api/history").get_json()
        assert all(f["url"] is None for b in j["batches"] if b["id"] == 999 for f in b["files"]), j
        assert BRUNO.get(HISTORY, "/api/history?download=999").status_code == 410
    finally:
        FAKE.tables["conversions"].pop()


def test_owned_path_rejects_traversal_and_foreign_folders():
    uid = ANA.uid
    assert storage.owned_path(uid, f"{uid}/20261029-1-ab", "DSC00001.JPG")
    for prefix, name in [(f"{BRUNO.uid}/20261029-1-ab", "DSC00001.JPG"),
                         (f"{uid}/../{BRUNO.uid}", "DSC00001.JPG"),
                         (f"{uid}/20261029-1-ab", "../../x.JPG"),
                         (f"{uid}", "DSC00001.JPG"),
                         (f"{uid}/a/b", "DSC00001.JPG"),
                         (f"{uid}/20261029-1-ab", "x.png")]:
        assert storage.owned_path(uid, prefix, name) is None, (prefix, name)


def test_daily_card_cap_per_user():
    carla = User("carla@example.com", credits=20)
    old, CONVERT_API.DAILY_CARD_CAP = CONVERT_API.DAILY_CARD_CAP, 2
    try:
        assert carla.convert().status_code == 200
        assert carla.convert().status_code == 200
        r = carla.convert()
        assert r.status_code == 429 and "daily limit" in r.get_json()["error"], r.get_json()
        assert len([c for c in FAKE.tables["conversions"] if c["user_id"] == carla.uid]) == 2
        assert ANA.convert().status_code == 200          # one user's cap never blocks another
    finally:
        CONVERT_API.DAILY_CARD_CAP = old


def test_daily_cap_for_signed_out_previews_per_ip():
    old, CONVERT_API.ANON_DAILY_CAP = CONVERT_API.ANON_DAILY_CAP, 2
    try:
        ip = {"X-Real-IP": "198.51.100.23"}
        assert convert_as(ip).headers.get("X-Tier") == "anon"
        assert convert_as(ip).status_code == 200
        r = convert_as(ip)
        assert r.status_code == 429 and r.get_json()["need_signin"], r.get_json()
        assert convert_as({"X-Real-IP": "198.51.100.24"}).status_code == 200   # other visitors fine
    finally:
        CONVERT_API.ANON_DAILY_CAP = old


def test_input_is_capped():
    r = convert_as({"Cookie": ANA.cookie}, project_name="x" * 5000)
    assert r.status_code == 200
    names = [p["name"] for p in FAKE.tables["projects"] if p["user_id"] == ANA.uid]
    assert max(len(n) for n in names) <= 80
    too_many = {"vendor": "sony", "files": [(io.BytesIO(b"x"), f"{i}.jpg") for i in range(31)]}
    r = CONVERT.post("/api/convert", data=too_many, content_type="multipart/form-data",
                     headers={"Origin": ORIGIN, "Cookie": ANA.cookie})
    assert r.status_code == 400 and "max 30" in r.get_json()["error"]


def _ana_files():
    return [k for k in FAKE.objects if k.startswith(ANA.uid + "/")]


def test_cannot_delete_another_users_project():
    files, rows = _ana_files(), len(FAKE.tables["conversions"])
    assert BRUNO.delete_project(ANA_PROJECT).status_code == 404
    assert any(p["id"] == ANA_PROJECT for p in FAKE.tables["projects"])
    assert _ana_files() == files and len(FAKE.tables["conversions"]) == rows
    assert ANA.get(HISTORY, f"/api/history?download_project={ANA_PROJECT}").status_code == 200


def test_delete_needs_a_session_and_the_same_site():
    no_session = HISTORY.post("/api/history", json={"delete_project": ANA_PROJECT}, headers={"Origin": ORIGIN})
    assert no_session.status_code == 401
    assert ANA.delete_project(ANA_PROJECT, origin="https://evil.example").status_code == 403
    assert any(p["id"] == ANA_PROJECT for p in FAKE.tables["projects"])


def test_delete_own_project_removes_it_and_its_cards_but_not_the_count():
    r = ANA.convert(project_name="To delete")
    assert r.status_code == 200
    pid = r.headers["X-Project-Id"]
    stored = [k for k in FAKE.objects if k.startswith(ANA.uid + "/")]
    batch = next(c for c in FAKE.tables["conversions"] if c.get("project_id") == pid)
    files = [f"{batch['storage_prefix']}/{n}" for n in batch["files"]]
    assert files and all(f in stored for f in files)
    rows = len(FAKE.tables["conversions"])

    r = ANA.delete_project(pid)
    assert r.status_code == 200 and r.get_json()["deleted"] is True
    assert not any(p["id"] == pid for p in FAKE.tables["projects"])
    assert not any(f in FAKE.objects for f in files)
    assert len(FAKE.tables["conversions"]) == rows        # the daily cap still counts them
    j = ANA.get(HISTORY, "/api/history").get_json()
    assert pid not in {p["id"] for p in j["projects"]}
    assert all(b["project_id"] != pid for b in j["batches"])
    # the other project is untouched
    assert ANA.get(HISTORY, f"/api/history?download_project={ANA_PROJECT}").status_code == 200
    assert ANA.delete_project(pid).status_code == 404


def test_no_session_no_data():
    assert HISTORY.get("/api/history").status_code == 401
    assert HISTORY.get(f"/api/history?download={ANA_BATCH}").status_code == 401
    assert ME.get("/api/me").get_json() == {"paywall": True, "signed_in": False}


if __name__ == "__main__":
    fns = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok:", fn.__name__)
    print(f"\nAll {len(fns)} ownership tests passed.")
