"""POST /api/webhook — Stripe webhook. Verifies the signature and writes
entitlement (Pro / credits) into Supabase. Configure the endpoint in Stripe with
events: checkout.session.completed, customer.subscription.updated,
customer.subscription.deleted, invoice.paid."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify  # noqa: E402
from webauth import billing  # noqa: E402

app = Flask(__name__)


@app.route("/", defaults={"path": ""}, methods=["POST"])
@app.route("/<path:path>", methods=["POST"])
def webhook(path):
    if not billing.enabled():
        return ("", 200)  # nothing configured; acknowledge and ignore
    payload = request.get_data()  # raw body required for signature verification
    sig = request.headers.get("Stripe-Signature", "")
    try:
        billing.handle_webhook(payload, sig)
    except Exception as e:  # bad signature / processing error
        return jsonify(error=str(e)), 400
    return jsonify(received=True)
