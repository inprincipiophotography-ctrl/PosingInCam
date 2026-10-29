"""
Vercel Python serverless function: POST design images -> SD-card ZIP.

When the paywall env vars (SUPABASE_*) are set, requests must carry a signed-in
session (HttpOnly cookie, see webauth/session.py) and are metered:
  Free: 3 cards, watermarked · old 20-pack credits · Pro (bought once): unlimited.
Without those env vars the converter stays open (no login, no watermark).

Uses the repo's converter/ + webauth/ packages (bundled via vercel.json).
The original scripts/cardify.sh CLI is not involved.
"""

import datetime as dt
import os
import secrets
import sys
import threading
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, Response, jsonify  # noqa: E402
from converter import pack, encoder  # noqa: E402
from webauth import auth, billing, guard, session, storage  # noqa: E402

app = Flask(__name__)
session.install(app)

MAX_FILES = 30
MAX_BYTES_PER_FILE = 15 * 1024 * 1024

# One watermarked card without an account, so a visitor reaches the "it really
# is on my camera" moment before being asked for an email. Abuse is bounded by
# the per-IP rate limit below rather than a stored quota: keeping a durable
# per-IP counter would mean storing IP addresses, and the worst case here is a
# few extra watermarked cards.
ANON_MAX_CARDS = 1

# Daily caps on what one person can convert, whatever their plan: conversion
# costs function time and storage, so a script on a Pro account or a loop of
# signed-out previews can't run up the bill. Far above real use (a whole
# wedding is under 100 cards). Durable across instances: signed-in cards are
# counted from the conversions table, signed-out ones per hashed IP in
# auth_events. Tunable via env; 0 disables a cap.
DAILY_CARD_CAP = int(os.environ.get("DAILY_CARD_CAP", "300"))
ANON_DAILY_CAP = int(os.environ.get("ANON_DAILY_CAP", "5"))

# --- best-effort per-IP rate limit ------------------------------------------
# Serverless instances don't share memory, so this caps abuse per warm instance
# rather than globally — a cheap first layer on top of the per-account metering
# (free/credits/pro) the paywall already enforces. Tunable via env; RATE_MAX=0
# disables it.
_RL_WINDOW = int(os.environ.get("RATE_WINDOW_SEC", "60"))
_RL_MAX = int(os.environ.get("RATE_MAX", "20"))
_rl_lock = threading.Lock()
_rl_hits = {}  # ip -> [timestamps within the window]


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
    resp.headers["Access-Control-Expose-Headers"] = "X-Tier, X-Watermarked, X-First-File, X-Last-File, X-Project-Id"
    return resp


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "POST", "OPTIONS"])
def convert(path):
    if request.method == "OPTIONS":
        return ("", 204)
    if request.method == "GET":
        return jsonify(ok=True, vendors=sorted(encoder.VENDORS),
                       paywall=auth.paywall_enabled(), stripe=billing.enabled())

    if not session.same_origin(request):
        return jsonify(error="Cross-site request refused."), 403
    if _rate_limited(session.client_ip(request)):
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
    if auth.paywall_enabled() and not session.has_session(request):
        # Signed-out preview: one watermarked card, no account, no history.
        if len(designs) > ANON_MAX_CARDS:
            return jsonify(
                error=("Sign in to convert more than one image at a time. "
                       "It's a one-time email link, no password."),
                need_signin=True), 401
        if ANON_DAILY_CAP and guard.anon_cards_today(session.client_ip(request)) + len(designs) > ANON_DAILY_CAP:
            resp = jsonify(error=("That's today's free preview cards from here. Sign in free "
                                  "(a one-time email link) to keep making cards."),
                           need_signin=True)
            resp.headers["Retry-After"] = "3600"
            return resp, 429
        watermark = True
        tier = "anon"
    elif auth.paywall_enabled():
        try:
            uid, email = session.current_user(request)
        except auth.AuthError as e:
            return jsonify(error=e.message), e.status
        if DAILY_CARD_CAP and auth.cards_last_24h(uid) + len(designs) > DAILY_CARD_CAP:
            resp = jsonify(error=(f"That's the daily limit of {DAILY_CARD_CAP} cards. It resets over the "
                                  "next 24 hours; if you need more, write to notalucis.dev@gmail.com."))
            resp.headers["Retry-After"] = "3600"
            return resp, 429
        profile = auth.get_profile(uid, email)
        decision = auth.decide(profile, len(designs), email)
        if not decision["allowed"]:
            return jsonify(error=decision["message"], need_payment=True,
                           free_left=decision.get("free_left"),
                           credits=decision.get("credits")), 402
        watermark = decision["watermark"]
        tier = decision["tier"]

    # --- projects + numbering. A project is one job (e.g. one wedding): batches
    # inside a project continue numbering (0001..0015, then 0016..0030) so a
    # multi-upload project never collides on the card, while a NEW project
    # starts from 0001 again. Clients send project_id (existing) or
    # project_name (create new); with neither, a default project is used.
    project = None
    if uid:
        project_id = (request.form.get("project_id") or "").strip()
        project_name = " ".join((request.form.get("project_name") or "").split())[:80]
        try:
            if project_id:
                project = auth.get_project(uid, project_id)
            if project is None and project_name:
                project = auth.create_project(uid, project_name)
            if project is None:
                project = auth.get_or_create_default_project(uid)
        except Exception:
            project = None
        # Fallback (projects table not installed yet): the old all-time counter.
        start = (auth.cards_in_project(uid, project["id"]) if project
                 else auth.cards_so_far(uid, vendor))
    else:
        try:
            start = max(0, int(request.form.get("start") or 0))
        except ValueError:
            start = 0
    if start + len(designs) > 9999:  # DCF numbers end at 9999
        start = 0

    try:
        cards = pack.convert_cards(designs, vendor, orientation, watermark=watermark, start=start)
        zip_bytes = pack.zip_from_cards(cards, vendor)
    except (FileNotFoundError, ValueError) as e:
        return jsonify(error=str(e)), 400
    except Exception:  # pragma: no cover
        traceback.print_exc(file=sys.stderr)  # surfaces in Vercel runtime logs
        return jsonify(error="conversion failed"), 500

    batch_key = (dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
                 + "-" + secrets.token_hex(3))
    headers = {
        "X-Tier": tier,
        "X-Watermarked": "1" if watermark else "0",
        "X-First-File": cards[0][0],
        "X-Last-File": cards[-1][0],
        **({"X-Project-Id": str(project["id"])} if project else {}),
    }

    # Too big for one Vercel response: hand it over as a signed Storage link.
    # Decided before anything is charged, so a failure here costs no credits.
    zip_url = None
    if len(zip_bytes) > storage.MAX_INLINE_ZIP:
        if uid and storage.enabled():
            zip_url = storage.zip_link(uid, batch_key, zip_bytes)
        if not zip_url:
            return jsonify(error=("That batch is too big to download in one go. "
                                  "Convert fewer images at a time.")), 413

    if auth.paywall_enabled() and uid:
        # Keep a copy of the batch so it shows up under "Your previous cards".
        # Strictly best-effort: any storage/schema failure only skips history.
        extra = None
        if storage.enabled() and storage.upload_cards(uid, batch_key, cards):
            extra = {"storage_prefix": f"{uid}/{batch_key}",
                     "files": [name for name, _ in cards],
                     "start_number": start + 1,
                     "watermarked": watermark}
        if project:
            extra = {**(extra or {}), "project_id": project["id"]}
        auth.consume(uid, profile, len(designs), tier, vendor, extra)

    if tier == "anon":
        for _ in designs:
            guard.log("anon_convert", session.client_ip(request))

    if zip_url:
        resp = jsonify(zip_url=zip_url)
        resp.headers.update(headers)
        return resp
    return Response(
        zip_bytes,
        mimetype="application/zip",
        headers={"Content-Disposition": 'attachment; filename="shoot-cards.zip"', **headers},
    )
