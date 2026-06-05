"""
Vercel Python serverless function: POST design images -> SD-card ZIP.

When the paywall env vars (SUPABASE_*) are set, requests must carry a Supabase
access token (Authorization: Bearer ...) and are metered:
  Free: 2 cards, watermarked · 20-pack: credits · Pro: unlimited.
Without those env vars the converter stays open (no login, no watermark).

Uses the repo's converter/ + webauth/ packages (bundled via vercel.json).
The original scripts/cardify.sh CLI is not involved.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, Response, jsonify  # noqa: E402
from converter import pack, encoder  # noqa: E402
from webauth import auth, billing  # noqa: E402

app = Flask(__name__)

MAX_FILES = 30
MAX_BYTES_PER_FILE = 15 * 1024 * 1024


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    resp.headers["Access-Control-Expose-Headers"] = "X-Tier, X-Watermarked"
    return resp


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "POST", "OPTIONS"])
def convert(path):
    if request.method == "OPTIONS":
        return ("", 204)
    if request.method == "GET":
        return jsonify(ok=True, vendors=sorted(encoder.VENDORS),
                       paywall=auth.paywall_enabled(), stripe=billing.enabled())

    vendor = (request.form.get("vendor") or "sony").strip().lower()
    orientation = (request.form.get("orientation") or "auto").strip().lower()
    if vendor not in encoder.VENDORS:
        return jsonify(error=f"unknown vendor: {vendor}"), 400
    if orientation not in ("auto", "landscape", "portrait"):
        return jsonify(error=f"bad orientation: {orientation}"), 400

    files = request.files.getlist("files")
    if not files:
        return jsonify(error="no images uploaded (field name must be 'files')"), 400
    if len(files) > MAX_FILES:
        return jsonify(error=f"too many images (max {MAX_FILES})"), 400

    designs = []
    for f in files:
        data = f.read()
        if not data:
            continue
        if len(data) > MAX_BYTES_PER_FILE:
            return jsonify(error=f"{f.filename}: too large (max 15MB each)"), 400
        designs.append((f.filename or "design", data))
    if not designs:
        return jsonify(error="uploaded files were empty"), 400

    # --- paywall (active only when SUPABASE_* env vars are set) ---
    watermark = False
    uid = profile = None
    tier = "open"
    if auth.paywall_enabled():
        try:
            uid, _email = auth.verify_user(request.headers.get("Authorization"))
        except auth.AuthError as e:
            return jsonify(error=e.message), e.status
        profile = auth.get_profile(uid)
        decision = auth.decide(profile, len(designs))
        if not decision["allowed"]:
            return jsonify(error=decision["message"], need_payment=True,
                           free_left=decision.get("free_left"),
                           credits=decision.get("credits")), 402
        watermark = decision["watermark"]
        tier = decision["tier"]

    try:
        zip_bytes = pack.build_zip(designs, vendor, orientation, watermark=watermark)
    except FileNotFoundError as e:
        return jsonify(error=str(e)), 400
    except Exception as e:  # pragma: no cover
        return jsonify(error=f"conversion failed: {e}"), 500

    if auth.paywall_enabled() and uid:
        auth.consume(uid, profile, len(designs), tier, vendor)

    return Response(
        zip_bytes,
        mimetype="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="pose-cards.zip"',
            "X-Tier": tier,
            "X-Watermarked": "1" if watermark else "0",
        },
    )
