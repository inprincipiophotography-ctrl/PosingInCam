"""Vercel Python function: GET /api/me -> the signed-in user's account state.

Returns {paywall:false} when the paywall env vars aren't set (open mode), and
{signed_in:false} without a valid session cookie. The page learns who is
signed in only from here: it never sees the session token itself.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify  # noqa: E402
from webauth import auth, billing, session  # noqa: E402

app = Flask(__name__)
session.install(app)


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = billing.safe_origin(request.headers.get("Origin"))
    resp.headers["Vary"] = "Origin"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    return resp


@app.route("/", defaults={"path": ""}, methods=["GET", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "OPTIONS"])
def me(path):
    if request.method == "OPTIONS":
        return ("", 204)
    if not auth.paywall_enabled():
        return jsonify(paywall=False)
    if not session.has_session(request):
        return jsonify(paywall=True, signed_in=False)
    try:
        uid, email = session.current_user(request)
    except auth.AuthError as e:
        if e.status == 401:
            return jsonify(paywall=True, signed_in=False)
        return jsonify(error=e.message), e.status
    profile = auth.get_profile(uid, email)
    return jsonify(paywall=True, signed_in=True, email=email, **auth.account_state(profile, email))
