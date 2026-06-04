"""
Vercel Python serverless function: POST design images -> SD-card ZIP.

Deployed by Vercel at /api/convert (any file under /api is a function).
Uses the repo's converter/ package (bundled via vercel.json includeFiles).

The original scripts/cardify.sh CLI is not involved.
"""

import os
import sys

# Make the top-level converter/ package importable (it sits next to /api).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, Response, jsonify  # noqa: E402
from converter import pack, encoder  # noqa: E402

app = Flask(__name__)

MAX_FILES = 30
MAX_BYTES_PER_FILE = 15 * 1024 * 1024  # individual image cap


@app.after_request
def _cors(resp):
    # Same-origin in the standalone app; permissive so the page can also be
    # hosted elsewhere (e.g. later embedded from the NotaLucis web) during testing.
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "POST", "OPTIONS"])
def convert(path):
    if request.method == "OPTIONS":
        return ("", 204)
    if request.method == "GET":
        return jsonify(ok=True, vendors=sorted(encoder.VENDORS))

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

    try:
        zip_bytes = pack.build_zip(designs, vendor, orientation)
    except FileNotFoundError as e:
        # Missing vendor template (e.g. canon/nikon not uploaded yet).
        return jsonify(error=str(e)), 400
    except Exception as e:  # pragma: no cover
        return jsonify(error=f"conversion failed: {e}"), 500

    return Response(
        zip_bytes,
        mimetype="application/zip",
        headers={"Content-Disposition": 'attachment; filename="pose-cards.zip"'},
    )
