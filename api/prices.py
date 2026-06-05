"""GET /api/prices -> public pricing read from Stripe (no auth)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify  # noqa: E402
from webauth import auth, billing  # noqa: E402

app = Flask(__name__)


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return resp


@app.route("/", defaults={"path": ""}, methods=["GET", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "OPTIONS"])
def prices(path):
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify(prices=billing.get_prices(),
                   free_limit=auth.FREE_LIMIT, pack_size=billing.PACK20_CREDITS)
