"""
GET  /api/history                 -> the signed-in user's stored batches, with
                                     short-lived signed thumbnail URLs.
GET  /api/history?download=<id>   -> rebuild that batch as an SD-card ZIP.

Both require a Supabase access token (Authorization: Bearer ...). Cards live in
the private ``cards`` storage bucket; clients never talk to storage directly,
they only get signed URLs (or the rebuilt ZIP) from here.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, Response, jsonify  # noqa: E402
from converter import pack  # noqa: E402
from webauth import auth, billing, storage  # noqa: E402

app = Flask(__name__)


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = billing.safe_origin(request.headers.get("Origin"))
    resp.headers["Vary"] = "Origin"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization"
    return resp


@app.route("/", defaults={"path": ""}, methods=["GET", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "OPTIONS"])
def history(path):
    if request.method == "OPTIONS":
        return ("", 204)
    if not auth.paywall_enabled():
        return jsonify(batches=[])

    try:
        uid, _email = auth.verify_user(request.headers.get("Authorization"))
    except auth.AuthError as e:
        return jsonify(error=e.message), e.status

    batch_id = request.args.get("download")
    if batch_id:
        return _download(uid, batch_id)

    try:
        rows = auth.list_history(uid)
    except Exception:
        # History columns not installed yet (or REST hiccup): empty, not an error.
        return jsonify(batches=[])

    # One signing round-trip for every thumbnail of every batch.
    all_paths = []
    for row in rows:
        prefix = row.get("storage_prefix") or ""
        for name in (row.get("files") or []):
            all_paths.append(f"{prefix}/{name}")
    signed = storage.sign_urls(all_paths)

    batches = []
    for row in rows:
        prefix = row.get("storage_prefix") or ""
        files = [{"name": name, "url": signed.get(f"{prefix}/{name}")}
                 for name in (row.get("files") or [])]
        batches.append({"id": row.get("id"),
                        "created_at": row.get("created_at"),
                        "vendor": row.get("vendor"),
                        "cards": row.get("cards"),
                        "watermarked": row.get("watermarked"),
                        "files": files})
    return jsonify(batches=batches)


def _download(uid: str, batch_id: str):
    try:
        bid = int(batch_id)
    except ValueError:
        return jsonify(error="Batch not found."), 404
    try:
        batch = auth.get_batch(uid, bid)
    except Exception:
        batch = None
    if not batch or not batch.get("files"):
        return jsonify(error="Batch not found."), 404

    vendor = batch.get("vendor") or "sony"
    prefix = batch.get("storage_prefix") or ""
    cards = []
    for name in batch["files"]:
        data = storage.download(f"{prefix}/{name}")
        if data is None:
            return jsonify(error="Some files of this batch are no longer stored."), 410
        cards.append((name, data))

    zip_bytes = pack.zip_from_cards(cards, vendor)
    return Response(
        zip_bytes,
        mimetype="application/zip",
        headers={"Content-Disposition": 'attachment; filename="camera-cards.zip"'},
    )
