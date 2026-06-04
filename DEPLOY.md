# Deploy the Pose Cards web app on Vercel

This is the standalone testing version of the web app (static UI + one Python
serverless function). The original `scripts/cardify.sh` CLI is untouched.

## What's here
```
index.html            static branded UI (no build step)
assets/               styles.css + app.js
api/convert.py        Vercel Python function (Flask) -> SD-card ZIP
converter/            conversion core (Pillow + piexif), bundled via vercel.json
requirements.txt      Pillow, piexif, Flask  (for the Python function)
vercel.json           includeFiles: converter/** so the function can import it
```

## Deploy (no CLI needed)
1. Push this branch (already done) or merge it to `main`.
2. Vercel → **Add New… → Project** → import `inprincipiophotography-ctrl/PosingInCam`.
3. **Framework Preset: Other.** Root Directory: `./` (leave default). No build command needed.
4. **Deploy.** Vercel will:
   - serve `index.html` + `assets/` as static files,
   - build `api/convert.py` as a Python function (installs `requirements.txt`),
   - bundle `converter/**` with the function (`vercel.json`).
5. Open the deployment URL → pick **Sony** → upload a design → **Generiraj kartice** →
   `pose-cards.zip` downloads. Then test on the camera (see in-app instructions; Sony
   needs **Recover Image Database**).

## Notes / limits
- **Request body ~4.5 MB** on Vercel. The page already downscales each image to
  ≤2400 px before upload, so a handful of cards fits. For big batches use the
  CLI (`python -m converter.cli`) or the future Wedding-manager- integration.
- **Python**: Vercel uses 3.12 by default — compatible (no `cgi` dependency).
- **Canon / Nikon**: add real SOOC templates `converter/templates/canon.JPG` and
  `nikon.JPG`, then redeploy. Sony works out of the box (bootstrapped template).
- If the function logs `ModuleNotFoundError: converter`, confirm `vercel.json`
  `includeFiles` is deployed (it is in this repo).

## Local check (optional)
```bash
pip install -r requirements.txt
python -m converter.selftest        # spec validation, all checks pass
python -m converter.cli --vendor sony --out cards.zip design1.png design2.jpg
```
