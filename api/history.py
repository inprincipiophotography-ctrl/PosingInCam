"""
GET  /api/history                 -> the signed-in user's stored batches, with
                                     short-lived signed thumbnail URLs.
GET  /api/history?download=<id>   -> rebuild that batch as an SD-card ZIP.
GET  /api/history?download_project=<id>[&only=A.JPG,B.JPG]
                                  -> the whole project (or just those cards)
                                     as one SD-card ZIP.
POST /api/history {"delete_project": <id>}
                                  -> delete one of the user's projects and the
                                     cards stored for it.
POST /api/history {"delete_unfiled": true}
                                  -> delete the cards stored outside any project
                                     (the "Earlier cards" group).

Both require a signed-in session (cookie, see webauth/session.py). Cards live in
the private ``cards`` storage bucket; clients never talk to storage directly,
they only get signed URLs (or the rebuilt ZIP) from here.
"""

import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, Response, jsonify  # noqa: E402
from converter import pack  # noqa: E402
from webauth import auth, billing, session, storage  # noqa: E402

app = Flask(__name__)
session.install(app)


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = billing.safe_origin(request.headers.get("Origin"))
    resp.headers["Vary"] = "Origin"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    return resp


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "POST", "OPTIONS"])
def history(path):
    if request.method == "OPTIONS":
        return ("", 204)
    if not auth.paywall_enabled():
        return jsonify(batches=[])
    if request.method == "POST" and not session.same_origin(request):
        return jsonify(error="Cross-site request refused."), 403

    try:
        uid, _email = session.current_user(request)
    except auth.AuthError as e:
        return jsonify(error=e.message), e.status

    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        if body.get("delete_unfiled") is True:
            return _delete_unfiled(uid)
        project_id = str(body.get("delete_project") or "")
        if not project_id:
            return jsonify(error="Nothing to delete."), 400
        return _delete_project(uid, project_id)

    batch_id = request.args.get("download")
    if batch_id:
        return _download(uid, batch_id)
    project_id = request.args.get("download_project")
    if project_id:
        return _download_project(uid, project_id, request.args.get("only"))

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
            p = storage.owned_path(uid, prefix, name)
            if p:
                all_paths.append(p)
    signed = storage.sign_urls(all_paths)

    batches = []
    for row in rows:
        prefix = row.get("storage_prefix") or ""
        files = [{"name": name, "url": signed.get(storage.owned_path(uid, prefix, name) or "")}
                 for name in (row.get("files") or [])]
        batches.append({"id": row.get("id"),
                        "created_at": row.get("created_at"),
                        "vendor": row.get("vendor"),
                        "cards": row.get("cards"),
                        "watermarked": row.get("watermarked"),
                        "project_id": row.get("project_id"),
                        "files": files})
    return jsonify(batches=batches, projects=projects)


def _delete_project(uid: str, project_id: str):
    """Remove a project: its stored cards, its link to its batches, then the
    project itself. Only the owner's own project is ever touched."""
    try:
        project = auth.get_project(uid, project_id)
    except Exception:
        project = None
    if not project:
        return jsonify(error="Project not found."), 404
    try:
        rows = auth.list_project_batches(uid, project_id)
    except Exception:
        return jsonify(error="Could not delete this project. Please try again."), 503
    paths = []
    for row in rows:
        prefix = row.get("storage_prefix") or ""
        for name in (row.get("files") or []):
            p = storage.owned_path(uid, prefix, name)
            if p:
                paths.append(p)
    # Detach first: if storage cleanup then fails, the files are orphaned but
    # never shown again, which beats a project that half-exists.
    try:
        if not auth.forget_project_batches(uid, project_id) or not auth.delete_project_row(uid, project_id):
            return jsonify(error="Could not delete this project. Please try again."), 503
    except Exception:
        return jsonify(error="Could not delete this project. Please try again."), 503
    storage.remove(paths)
    return jsonify(deleted=True, cards=len(paths))


def _delete_unfiled(uid: str):
    """Remove the user's stored cards that sit in no project ("Earlier cards"),
    the same way _delete_project removes a project's."""
    try:
        rows = auth.list_unfiled_batches(uid)
    except Exception:
        return jsonify(error="Could not delete these cards. Please try again."), 503
    if not rows:
        return jsonify(error="Nothing to delete."), 404
    paths = []
    for row in rows:
        prefix = row.get("storage_prefix") or ""
        for name in (row.get("files") or []):
            p = storage.owned_path(uid, prefix, name)
            if p:
                paths.append(p)
    try:
        if not auth.forget_unfiled_batches(uid):
            return jsonify(error="Could not delete these cards. Please try again."), 503
    except Exception:
        return jsonify(error="Could not delete these cards. Please try again."), 503
    storage.remove(paths)
    return jsonify(deleted=True, cards=len(paths))


def _zip_response(uid: str, zip_bytes: bytes):
    """The ZIP itself, or — past Vercel's 4.5 MB response cap — a signed link."""
    if len(zip_bytes) <= storage.MAX_INLINE_ZIP:
        return Response(
            zip_bytes,
            mimetype="application/zip",
            headers={"Content-Disposition": 'attachment; filename="shoot-cards.zip"'},
        )
    key = "redownload-" + secrets.token_hex(6)
    url = storage.zip_link(uid, key, zip_bytes)
    if not url:
        return jsonify(error="Could not prepare this download. Please try again."), 503
    return jsonify(zip_url=url)


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
        path = storage.owned_path(uid, prefix, name)
        data = storage.download(path) if path else None
        if data is None:
            return jsonify(error="Some files of this batch are no longer stored."), 410
        cards.append((name, data))

    return _zip_response(uid, pack.zip_from_cards(cards, vendor))


MAX_PICK = 500


def _download_project(uid: str, project_id: str, only: str | None = None):
    """Merge every stored batch of a project into one SD-card ZIP. Numbering
    already continues across batches, so the files simply line up. With
    ``only`` (comma-separated card names) just those cards go in."""
    pick = None
    if only is not None:
        pick = {n for n in only.split(",")[:MAX_PICK] if n}
        if not pick:
            return jsonify(error="Pick at least one card."), 400
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
            if pick is not None and name not in pick:
                continue
            if name in seen:  # same number converted twice: keep the newest
                cards = [(n, d) for n, d in cards if n != name]
            path = storage.owned_path(uid, prefix, name)
            data = storage.download(path) if path else None
            if data is None:
                return jsonify(error="Some files of this project are no longer stored."), 410
            cards.append((name, data))
            seen.add(name)

    if not cards:
        return jsonify(error="None of these cards are in this project."), 404
    cards.sort(key=lambda c: c[0])
    return _zip_response(uid, pack.zip_from_cards(cards, vendor))
