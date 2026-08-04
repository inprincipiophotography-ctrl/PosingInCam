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
    project_id = request.args.get("download_project")
    if project_id:
        return _download_project(uid, project_id)

    try:
        rows = auth.list_history(uid)
    except Exception:
        # History columns not installed yet (or REST hiccup): empty, not an error.
        rows = []
    try:
        projects = auth.list_projects(uid)
    except Exception:
        projects = []

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
                        "project_id": row.get("project_id"),
                        "files": files})
    return jsonify(batches=batches, projects=projects)


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


def _download_project(uid: str, project_id: str):
    """Merge every stored batch of a project into one SD-card ZIP. Numbering
    already continues across batches, so the files simply line up."""
    try:
        project = auth.get_project(uid, project_id)
        rows = auth.list_project_batches(uid, project_id) if project else []
    except Exception:
        project, rows = None, []
    if not project or not rows:
        return jsonify(error="Project not found or has no stored batches."), 404

    vendor = rows[0].get("vendor") or "sony"
    cards, seen = [], set()
    for row in rows:
        prefix = row.get("storage_prefix") or ""
        for name in (row.get("files") or []):
            if name in seen:  # same number converted twice: keep the newest
                cards = [(n, d) for n, d in cards if n != name]
            data = storage.download(f"{prefix}/{name}")
            if data is None:
                return jsonify(error="Some files of this project are no longer stored."), 410
            cards.append((name, data))
            seen.add(name)

    cards.sort(key=lambda c: c[0])
    zip_bytes = pack.zip_from_cards(cards, vendor)
    return Response(
        zip_bytes,
        mimetype="application/zip",
        headers={"Content-Disposition": 'attachment; filename="camera-cards.zip"'},
    )
