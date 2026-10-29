"""
Sign-in for Shoot Cards (passwordless email link), done on the server so the
session lives in HttpOnly cookies (webauth/session.py), never in localStorage.

  POST /api/auth?action=login     {email, captcha?} -> emails a sign-in link
  GET  /api/auth?action=callback  the link lands here: ?code= or ?token_hash=
  POST /api/auth?action=migrate   {refresh_token} -> cookies (one-time move off
                                  the old localStorage session)
  POST /api/auth?action=logout    revokes the session, clears the cookies

Sign in and sign up are the same request. Every attempt is rate-limited and
logged by webauth/guard.py; past a few attempts a CAPTCHA is required.
"""

import os
import re
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify, redirect  # noqa: E402
from webauth import auth, billing, guard, session  # noqa: E402

app = Flask(__name__)
session.install(app)

_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,63}$")
_VERIFY_TYPES = {"email", "magiclink", "signup"}


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = billing.safe_origin(request.headers.get("Origin"))
    resp.headers["Vary"] = "Origin"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Cache-Control"] = "no-store"
    return resp


def _limited(verdict):
    mins = max(1, round(verdict.retry_after / 60))
    resp = jsonify(error=f"Too many sign-in attempts. Try again in {mins} minute{'s' if mins != 1 else ''}.",
                   retry_after=verdict.retry_after)
    resp.headers["Retry-After"] = str(verdict.retry_after)
    return resp, 429


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "POST", "OPTIONS"])
def handle(path):
    if request.method == "OPTIONS":
        return ("", 204)
    action = request.args.get("action") or path.rstrip("/").rsplit("/", 1)[-1]
    if not auth.paywall_enabled():
        return jsonify(error="Sign-in is not switched on."), 503
    if request.method == "GET":
        return callback() if action == "callback" else (jsonify(error="not found"), 404)
    if not session.same_origin(request):
        return jsonify(error="Cross-site request refused."), 403
    if action == "login":
        return login()
    if action == "logout":
        return logout()
    if action == "migrate":
        return migrate()
    return jsonify(error="not found"), 404


def login():
    ip = session.client_ip(request)
    body = request.get_json(silent=True) or {}
    email = str(body.get("email") or "").strip().lower()
    if len(email) > 254 or not _EMAIL.match(email):
        return jsonify(error="That doesn't look like an email address."), 400

    verdict = guard.check_link(ip, email)
    if verdict.blocked:
        guard.log("link_blocked", ip, email, verdict.why)
        return _limited(verdict)
    if verdict.captcha and guard.captcha_enabled():
        token = body.get("captcha")
        if not token:
            return jsonify(error="Please confirm you're human, then send the link again.",
                           captcha_required=True, captcha_site_key=guard.TURNSTILE_SITE_KEY), 403
        if not guard.verify_captcha(token, ip):
            guard.log("captcha_failed", ip, email)
            return jsonify(error="The check didn't pass. Try it once more.",
                           captcha_required=True, captcha_site_key=guard.TURNSTILE_SITE_KEY), 403

    origin = billing.safe_origin(request.headers.get("Origin"))
    verifier, challenge = session.new_pkce()
    try:
        r = session.send_link(email, f"{origin}/api/auth?action=callback", challenge, ip)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        guard.log("link_failed", ip, email, "supabase unreachable")
        return jsonify(error="The link didn't send. Try again in a moment."), 503
    if not r.ok:
        guard.log("link_failed", ip, email, f"supabase {r.status_code}")
        if r.status_code == 429:
            return jsonify(error="A link was sent a moment ago. Wait a minute, then try again.",
                           retry_after=60), 429
        return jsonify(error="The link didn't send."), 400
    guard.log("link_sent", ip, email)
    session.set_pkce(verifier)
    return jsonify(sent=True)


def _back(result: str):
    resp = redirect(f"/?signin={result}", code=303)
    resp.headers["Referrer-Policy"] = "no-referrer"   # keep the code out of Referer
    return resp


def callback():
    ip = session.client_ip(request)
    if guard.check_verify(ip).blocked:
        guard.log("verify_blocked", ip)
        return _back("limited")
    code = request.args.get("code", "")
    token_hash = request.args.get("token_hash", "")
    kind = request.args.get("type", "email")
    sess = None
    try:
        if token_hash and kind in _VERIFY_TYPES and len(token_hash) < 512:
            sess = session.verify_token_hash(token_hash, kind, ip)
        elif code and len(code) < 512:
            verifier = request.cookies.get(session.PKCE)
            if not verifier:
                guard.log("verify_failed", ip, detail="no verifier (other browser)")
                return _back("other-browser")
            sess = session.exchange_code(code, verifier, ip)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return _back("error")
    session.clear_pkce()
    if not sess or not sess.get("access_token") or not sess.get("refresh_token"):
        # Supabase's own error redirect (?error_description=...) lands here too.
        guard.log("verify_failed", ip, detail=request.args.get("error_code") or "bad or expired link")
        return _back("expired")
    session.set_session(sess)
    guard.log("verify_ok", ip, ((sess.get("user") or {}).get("email") or "").lower() or None)
    return _back("ok")


def migrate():
    ip = session.client_ip(request)
    verdict = guard.check_verify(ip)
    if verdict.blocked:
        guard.log("verify_blocked", ip)
        return _limited(verdict)
    rt = str((request.get_json(silent=True) or {}).get("refresh_token") or "")
    if not rt or len(rt) > 512:
        return jsonify(error="nothing to move"), 400
    try:
        sess = session.refresh(rt, ip)
    except auth.AuthError as e:
        return jsonify(error=e.message), e.status
    if not sess or not sess.get("access_token"):
        guard.log("verify_failed", ip, detail="old session refused")
        return jsonify(error="Your session ended. Sign in again."), 401
    session.set_session(sess)
    return jsonify(ok=True)


def logout():
    # Revoke on Supabase too, so a copied refresh token dies with the session.
    at, rt = request.cookies.get(session.AT), request.cookies.get(session.RT)
    try:
        auth.verify_user(f"Bearer {at}")
    except auth.AuthError:
        at = None
    if not at and rt:
        try:
            at = (session.refresh(rt) or {}).get("access_token")
        except auth.AuthError:
            at = None
    if at:
        session.revoke(at)
    session.clear_session()
    return jsonify(ok=True)
