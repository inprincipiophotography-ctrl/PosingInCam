"""POST /api/portal -> { url } Stripe billing portal (manage/cancel subscription)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify  # noqa: E402
from webauth import auth, billing  # noqa: E402

app = Flask(__name__)


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    return resp


@app.route("/", defaults={"path": ""}, methods=["POST", "OPTIONS"])
@app.route("/<path:path>", methods=["POST", "OPTIONS"])
def portal(path):
    if request.method == "OPTIONS":
        return ("", 204)
    if not billing.enabled():
        return jsonify(error="Billing is not configured yet."), 503
    try:
        uid, _email = auth.verify_user(request.headers.get("Authorization"))
    except auth.AuthError as e:
        return jsonify(error=e.message), e.status
    customer = auth.get_profile(uid).get("stripe_customer_id")
    if not customer:
        return jsonify(error="No billing account yet — subscribe first."), 400
    origin = request.headers.get("Origin") or "https://posing-in-cam.vercel.app"
    try:
        url = billing.create_portal(customer, origin)
    except Exception as e:  # pragma: no cover
        return jsonify(error=f"portal failed: {e}"), 400
    return jsonify(url=url)
