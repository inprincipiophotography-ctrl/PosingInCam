"""
Vercel Python serverless function: POST design images -> SD-card ZIP.

When the paywall env vars (SUPABASE_*) are set, requests must carry a Supabase
access token (Authorization: Bearer ...) and are metered:
  Free: 3 cards, watermarked · 20-pack: credits · Pro: unlimited.
Without those env vars the converter stays open (no login, no watermark).

Uses the repo's converter/ + webauth/ packages (bundled via vercel.json).
The original scripts/cardify.sh CLI is not involved.
"""

import os
import sys
import threading
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, Response, jsonify  # noqa: E402
from converter import pack, encoder  # noqa: E402
from webauth import auth, billing  # noqa: E402

app = Flask(__name__)

MAX_FILES = 30
MAX_BYTES_PER_FILE = 15 * 1024 * 1024

# --- best-effort per-IP rate limit ------------------------------------------
# Serverless instances don't share memory, so this caps abuse per warm instance
# rather than globally — a cheap first layer on top of the per-account metering
# (free/credits/pro) the paywall already enforces. Tunable via env; RATE_MAX=0
# disables it.
_RL_WINDOW = int(os.environ.get("RATE_WINDOW_SEC", "60"))
_RL_MAX = int(os.environ.get("RATE_MAX", "20"))
_rl_lock = threading.Lock()
_rl_hits = {}  # ip -> [timestamps within the window]


def _client_ip():
    # Vercel sets x-real-ip to the actual peer; x-forwarded-for's first hop is
    # client-spoofable, so prefer x-real-ip and fall back conservatively.
    ip = request.headers.get("x-real-ip")
    if ip:
        return ip.strip()
    xff = request.headers.get("x-forwarded-for", "")
    return (xff.split(",")[0].strip() if xff else request.remote_addr) or "?"


def _rate_limited(ip):
    if _RL_MAX <= 0:
        return False
    now = time.time()
    cutoff = now - _RL_WINDOW
    with _rl_lock:
        hits = [t for t in _rl_hits.get(ip, ()) if t >= cutoff]
        limited = len(hits) >= _RL_MAX
        if not limited:
            hits.append(now)
        _rl_hits[ip] = hits
        if len(_rl_hits) > 4096:  # bound memory on busy instances
            for k in [k for k, v in _rl_hits.items() if not v or v[-1] < cutoff]:
                _rl_hits.pop(k, None)
        return limited


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = billing.safe_origin(request.headers.get("Origin"))
    resp.headers["Vary"] = "Origin"
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

    if _rate_limited(_client_ip()):
        resp = jsonify(error="Too many requests — please wait a moment and try again.")
        resp.headers["Retry-After"] = str(_RL_WINDOW)
        return resp, 429

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
            uid, email = auth.verify_user(request.headers.get("Authorization"))
        except auth.AuthError as e:
            return jsonify(error=e.message), e.status
        profile = auth.get_profile(uid)
        decision = auth.decide(profile, len(designs), email)
        if not decision["allowed"]:
            return jsonify(error=decision["message"], need_payment=True,
                           free_left=decision.get("free_left"),
                           credits=decision.get("credits")), 402
        watermark = decision["watermark"]
        tier = decision["tier"]

    try:
        zip_bytes = pack.build_zip(designs, vendor, orientation, watermark=watermark)
    except (FileNotFoundError, ValueError) as e:
        return jsonify(error=str(e)), 400
    except Exception:  # pragma: no cover
        traceback.print_exc(file=sys.stderr)  # surfaces in Vercel runtime logs
        return jsonify(error="conversion failed"), 500

    if auth.paywall_enabled() and uid:
        auth.consume(uid, profile, len(designs), tier, vendor)

    return Response(
        zip_bytes,
        mimetype="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="camera-cards.zip"',
            "X-Tier": tier,
            "X-Watermarked": "1" if watermark else "0",
        },
    )
