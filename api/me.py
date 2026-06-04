"""Vercel Python function: GET /api/me -> the signed-in user's account state.

Returns {paywall:false} when the paywall env vars aren't set (open mode).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify  # noqa: E402
from webauth import auth  # noqa: E402

app = Flask(__name__)


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
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
    try:
        uid, email = auth.verify_user(request.headers.get("Authorization"))
    except auth.AuthError as e:
        return jsonify(error=e.message), e.status
    profile = auth.get_profile(uid)
    return jsonify(paywall=True, email=email, **auth.account_state(profile))
