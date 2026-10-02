"use strict";

const API = "/api/convert";
const ME = "/api/me";
const MAX_EDGE = 2400;        // downscale uploads before sending (Vercel ~4.5MB body limit)
const JPEG_Q = 0.9;
const MAX_FILES = 30;         // matches the server-side cap (api/convert.py)
const MAX_BODY = 4_000_000;   // Vercel request-body limit is ~4.5MB
const STORE_URL = "https://www.inprincipioweddings.com/store/in-camera-posing";
// Stripe availability comes from the API health flag (window.__stripe).

const state = { vendor: null, items: [], selected: 0, projects: [], account: null };
const NEW_PROJECT = "__new__";
const $ = (id) => document.getElementById(id);
const camButtons = Array.from(document.querySelectorAll("#cameras .cam"));
const VENDOR_LABEL = { sony: "Sony", canon: "Canon", nikon: "Nikon" };
const R = window.CardRenderer;

const isSignedIn = () => !!(window.PoseAuth && PoseAuth.token());
// Until /api/convert answers, assume production (paywall on) so labels don't flicker.
const paywallOn = () => window.__paywall !== false;

// Signed-in users get the studio first. We remember sign-in in localStorage so
// the inline <head> script can reorder before paint (no flash) on return visits.
function syncSignedInLayout() {
  const signedIn = isSignedIn();
  document.documentElement.classList.toggle("signed-in", signedIn);
  try {
    if (signedIn) localStorage.setItem("pic_signed_in", "1");
    else localStorage.removeItem("pic_signed_in");
  } catch (_) {}
  if (!signedIn) {
    // Signing out drops the plan too, so the next visitor gets the plain pitch.
    document.documentElement.classList.remove("is-pro", "is-free");
    try { localStorage.removeItem("pic_plan"); } catch (_) {}
    state.account = null;
    const nudge = $("upgrade-nudge");
    if (nudge) nudge.hidden = true;
  } else {
    // They know the product: skip the demo video, show their card.
    showPreview();
  }
  refresh();
}

// Remembered pre-paint (inline <head> script) so the pricing section doesn't
// jump position once /api/me answers.
function setPlanClasses(plan) {
  const pro = plan === "pro";
  document.documentElement.classList.toggle("is-pro", pro);
  document.documentElement.classList.toggle("is-free", !pro);
  try { localStorage.setItem("pic_plan", pro ? "pro" : "free"); } catch (_) {}
}

const INSTRUCTIONS = {
  sony:
    "SONY: Recover Image Database is REQUIRED.\n" +
    "1. MENU → Setup → Media → Format the card (in camera).\n" +
    "2. Take one ordinary photo so DCIM/100MSDCF/ is created.\n" +
    "3. Copy all .JPG from the ZIP (DCIM/100MSDCF/) into that folder on the card.\n" +
    "4. MENU → Setup → Media → Recover Image Database → confirm.\n" +
    "5. ▶ Playback. The cards appear among your photos.",
  canon:
    "CANON: plug & play, no database rebuild.\n" +
    "1. MENU → (wrench) → Format card.\n" +
    "2. Take one photo so DCIM/100CANON/ is created.\n" +
    "3. Copy the .JPG from the ZIP into DCIM/100CANON/ on the card.\n" +
    "4. Insert the card → ▶ Playback. (Press INFO for details.)",
  nikon:
    "NIKON: copy into the folder YOUR camera created.\n" +
    "1. MENU → (wrench) → Format memory card.\n" +
    "2. Take a photo. DCIM/100NCZ_… is created (e.g. 100NCZ_8).\n" +
    "3. Copy the DSC_*.JPG from the ZIP into THAT folder (not 100NCZ_X).\n" +
    "4. If you don't see them: PLAYBACK MENU → Playback folder → All.\n" +
    "5. ▶ Playback.",
};

function setStatus(kind, text) {
  const st = $("status");
  st.className = "status" + (kind ? " " + kind : "");
  st.textContent = text;
}

/* ---------- studio: every card type in one place ---------- */
const TYPES = ["pose", "timeline", "groups", "shotlist", "settings", "found", "upload"];
const LIST_TYPES = ["timeline", "groups", "shotlist", "settings"];

const LIST_UI = {
  timeline: {
    head: "Heading", headKey: "label", headPh: "e.g. Saturday",
    fields: [{ key: "time", label: "Time", ph: "14:00", cls: "c-time", max: 12 },
             { key: "text", label: "What happens", ph: "e.g. First look", max: 60 }],
    paste: "Time first, one per line:\n14:00 Getting ready\n15:30 First look\n16:30 Ceremony",
  },
  groups: {
    head: "Heading", headKey: "label", headPh: "e.g. After the ceremony",
    fields: [{ key: "names", label: "Who, by name", ph: "e.g. Ana & Luka + Vesna & Ivo", max: 70 },
             { key: "rel", label: "Who they are", ph: "e.g. her parents", cls: "c-rel", max: 30 }],
    paste: "One group per line, names | who they are:\nAna & Luka + Vesna & Ivo | her parents\n+ Petra & Josip | her siblings",
  },
  shotlist: {
    head: "Heading", headKey: "label", headPh: "e.g. Must-have shots",
    fields: [{ key: "text", label: "Shot", ph: "e.g. Mum's reaction", max: 60 }],
    paste: "One shot per line:\nRings & invitation\nMum's reaction\nConfetti exit",
  },
  settings: {
    head: "Title", headKey: "title", headPh: "e.g. Tricky light",
    fields: [{ key: "label", label: "Situation", ph: "e.g. Church, dim", max: 40 },
             { key: "value", label: "Settings", ph: "e.g. f/1.8 · 1/125 · ISO 3200", max: 40 }],
    paste: "One per line, situation | settings:\nChurch, dim | f/1.8 · 1/125 · ISO 3200\nGolden hour | f/2.0 · 1/1000 · ISO 100",
  },
};

// Every type opens with a filled-in example, so one click already makes a real card.
const DEFAULTS = {
  timeline: { label: "Saturday", rows: [
    { time: "14:00", text: "Getting ready" }, { time: "15:30", text: "First look" },
    { time: "16:30", text: "Ceremony" }, { time: "18:00", text: "Golden hour portraits" },
    { time: "20:00", text: "First dance" }] },
  groups: { label: "After the ceremony", rows: [
    { names: "Ana & Luka + Grandma Mara", rel: "her grandma, seated" },
    { names: "+ Vesna & Ivo", rel: "her parents" },
    { names: "+ Petra & Josip", rel: "her siblings" },
    { names: "Ana & Luka + Sanja & Goran", rel: "his parents" },
    { names: "+ Marko", rel: "his brother" },
    { names: "Everyone, both families", rel: "big group last" }] },
  shotlist: { label: "Must-have shots", rows: [
    { text: "Rings & invitation" }, { text: "Dress details" }, { text: "Mum's reaction" },
    { text: "Walk down the aisle" }, { text: "Ring exchange, close" }, { text: "Confetti exit" }] },
  settings: { title: "Tricky light", rows: [
    { label: "Church, dim", value: "f/1.8 · 1/125 · ISO 3200" },
    { label: "Golden hour", value: "f/2.0 · 1/1000 · ISO 100" },
    { label: "Reception + flash", value: "f/4.0 · 1/60 · ISO 1600" }] },
  found: { name: "Your name · Your studio", phone: "+00 000 000 0000",
           email: "hello@yourstudio.com", note: "Reward offered. No questions asked." },
};
const clone = (o) => JSON.parse(JSON.stringify(o));

const studio = {
  type: "pose",
  pose: { mode: "sample", sample: "pack-03", photo: null, photoUrl: null,
          title: "", energy: "", camera: "", hack: "", say: "" },
  lists: { timeline: clone(DEFAULTS.timeline), groups: clone(DEFAULTS.groups),
           shotlist: clone(DEFAULTS.shotlist), settings: clone(DEFAULTS.settings) },
  found: clone(DEFAULTS.found),
  page: 0,
  previewing: false,
};

// Pose-pack samples (the same files as the picker thumbnails, so already cached).
const SAMPLES = {};
function sampleImage(key) {
  if (!SAMPLES[key]) {
    const img = new Image();
    img.onload = () => { refresh(); schedulePreview(); };
    img.src = "/assets/showcase/" + key + ".jpg";
    SAMPLES[key] = img;
  }
  return SAMPLES[key];
}

function cardData(type = studio.type) {
  if (type === "pose") {
    const p = studio.pose;
    return { mode: p.mode, sampleImg: sampleImage(p.sample), photo: p.photo,
             title: p.title, energy: p.energy, camera: p.camera, hack: p.hack, say: p.say };
  }
  if (type === "found") return studio.found;
  return studio.lists[type];
}

function pagesNow() {
  return studio.type === "upload" ? state.items.length : R.pages(studio.type, cardData());
}

function selectType(type, quiet) {
  if (!TYPES.includes(type)) return;
  studio.type = type;
  studio.page = 0;
  document.querySelectorAll("#types .type").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.type === type)));
  const panel = LIST_TYPES.includes(type) ? "list" : type;
  document.querySelectorAll("#studio .panel").forEach((p) => { p.hidden = p.dataset.panel !== panel; });
  closePaste();
  if (LIST_TYPES.includes(type)) renderListEditor();
  if (type === "found") fillFound();
  if (type === "pose") syncPoseMode();
  if (quiet) { refresh(); schedulePreview(); } else touched();
}

$("types").addEventListener("click", (e) => {
  const b = e.target.closest(".type");
  if (!b) return;
  if (b.dataset.type !== studio.type) selectType(b.dataset.type);
  else touched();
});

// Any edit: show the live preview instead of the demo video and redraw.
function touched() {
  showPreview();
  schedulePreview();
  refresh();
  R.ensureFonts(cardData()).then(schedulePreview);
}

/* ----- pose ----- */
function syncPoseMode() {
  const own = studio.pose.mode === "photo";
  $("pose-pick").hidden = own;
  $("pose-own").hidden = !own;
}

$("pose-samples").addEventListener("click", (e) => {
  const b = e.target.closest(".pz[data-sample]");
  if (!b) return;
  studio.pose.sample = b.dataset.sample;
  document.querySelectorAll("#pose-samples .pz[data-sample]").forEach((x) =>
    x.setAttribute("aria-pressed", String(x === b)));
  touched();
});

$("pose-own-btn").addEventListener("click", () => {
  studio.pose.mode = "photo";
  syncPoseMode();
  touched();
  if (!studio.pose.photo) $("pose-photo").click();
});

$("pose-back").addEventListener("click", () => {
  studio.pose.mode = "sample";
  syncPoseMode();
  touched();
  const sel = document.querySelector('#pose-samples .pz[aria-pressed="true"]');
  if (sel) sel.focus();
});

$("pose-photo").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (file) setPosePhoto(file);
});

const photoDrop = $("photo-drop");
["dragenter", "dragover"].forEach((ev) =>
  photoDrop.addEventListener(ev, (e) => { e.preventDefault(); photoDrop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  photoDrop.addEventListener(ev, (e) => { e.preventDefault(); photoDrop.classList.remove("over"); }));
photoDrop.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) setPosePhoto(file);
});

async function setPosePhoto(file) {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    setStatus("err", "✗ That file isn't an image. Use a JPG, PNG, WEBP or HEIC photo.");
    return;
  }
  if (!(await canDecode(file))) {
    setStatus("err", "✗ This browser can't open that photo. HEIC photos work in Safari on iPhone and Mac; elsewhere export it as JPG or PNG.");
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (studio.pose.photoUrl) URL.revokeObjectURL(studio.pose.photoUrl);
    studio.pose.photo = img;
    studio.pose.photoUrl = url;
    $("photo-drop-title").textContent = "Photo added · choose another";
    photoDrop.classList.add("has-photo");
    setStatus("", "");
    touched();
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("err", "✗ Couldn't open that photo. Try a JPG or PNG.");
  };
  img.src = url;
}

document.querySelectorAll("[data-pose]").forEach((el) =>
  el.addEventListener("input", () => { studio.pose[el.dataset.pose] = el.value; touched(); }));

/* ----- timeline / groups / shot list / settings ----- */
function renderListEditor() {
  const type = studio.type, ui = LIST_UI[type], data = studio.lists[type];
  $("list-label-name").textContent = ui.head;
  const label = $("list-label");
  label.placeholder = ui.headPh;
  label.value = data[ui.headKey] || "";
  const box = $("rows");
  box.innerHTML = "";
  box.dataset.type = type;
  data.rows.forEach((row, i) => box.appendChild(rowEl(type, row, i)));
  $("paste-text").placeholder = ui.paste;
  $("row-add").disabled = data.rows.length >= R.MAX_ROWS;
  updateRowsNote();
}

function rowEl(type, row, i) {
  const el = document.createElement("div");
  el.className = "row";
  LIST_UI[type].fields.forEach((f) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "row-in" + (f.cls ? " " + f.cls : "");
    input.value = row[f.key] || "";
    input.placeholder = f.ph;
    input.maxLength = f.max;
    input.dataset.i = String(i);
    input.dataset.key = f.key;
    input.setAttribute("aria-label", f.label + ", line " + (i + 1));
    el.appendChild(input);
  });
  const x = document.createElement("button");
  x.type = "button";
  x.className = "row-x";
  x.dataset.i = String(i);
  x.setAttribute("aria-label", "Remove line " + (i + 1));
  x.textContent = "×";
  el.appendChild(x);
  return el;
}

function updateRowsNote() {
  if (!LIST_TYPES.includes(studio.type)) return;
  const n = R.rowsOf(studio.type, studio.lists[studio.type]).length;
  const cards = R.pages(studio.type, studio.lists[studio.type]);
  const per = R.PER_PAGE[studio.type];
  $("rows-note").textContent = n
    ? n + (n === 1 ? " line" : " lines") + " · " + cards + (cards === 1 ? " card" : " cards") +
      " (" + per + " lines fit on a card)"
    : "";
}

function addRow() {
  const rows = studio.lists[studio.type].rows;
  if (rows.length >= R.MAX_ROWS) return null;
  const empty = {};
  LIST_UI[studio.type].fields.forEach((f) => { empty[f.key] = ""; });
  rows.push(empty);
  renderListEditor();
  return $("rows").querySelector('.row-in[data-i="' + (rows.length - 1) + '"]');
}

$("rows").addEventListener("input", (e) => {
  const t = e.target;
  if (!t.classList.contains("row-in")) return;
  const row = studio.lists[studio.type].rows[Number(t.dataset.i)];
  if (row) row[t.dataset.key] = t.value;
  updateRowsNote();
  touched();
});

$("rows").addEventListener("click", (e) => {
  const x = e.target.closest(".row-x");
  if (!x) return;
  const rows = studio.lists[studio.type].rows;
  const i = Number(x.dataset.i);
  rows.splice(i, 1);
  renderListEditor();
  const next = $("rows").querySelector('.row-x[data-i="' + Math.min(i, rows.length - 1) + '"]');
  (next || $("row-add")).focus();
  touched();
});

// Enter moves down the list (and adds a line at the end), like a checklist app.
$("rows").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.classList.contains("row-in") || e.isComposing) return;
  e.preventDefault();
  const i = Number(e.target.dataset.i);
  const below = $("rows").querySelector('.row-in[data-i="' + (i + 1) + '"]');
  const next = below || addRow();
  if (next) { next.focus(); touched(); }
});

$("list-label").addEventListener("input", (e) => {
  studio.lists[studio.type][LIST_UI[studio.type].headKey] = e.target.value;
  touched();
});

$("row-add").addEventListener("click", () => {
  const input = addRow();
  if (input) input.focus();
  touched();
});

function openPaste() {
  $("paste").hidden = false;
  $("paste-toggle").setAttribute("aria-expanded", "true");
  $("paste-text").focus();
}
function closePaste() {
  $("paste").hidden = true;
  $("paste-toggle").setAttribute("aria-expanded", "false");
  $("paste-text").value = "";
}
$("paste-toggle").addEventListener("click", () => ($("paste").hidden ? openPaste() : closePaste()));
$("paste-cancel").addEventListener("click", closePaste);
$("paste-apply").addEventListener("click", () => {
  const rows = parseList(studio.type, $("paste-text").value);
  if (!rows.length) { $("paste-text").focus(); return; }
  const cut = rows.length > R.MAX_ROWS;
  studio.lists[studio.type].rows = rows.slice(0, R.MAX_ROWS);
  closePaste();
  renderListEditor();
  if (cut) $("rows-note").textContent += " · kept the first " + R.MAX_ROWS + " lines";
  touched();
});

/** Turn pasted text (from an email, WhatsApp, a doc) into rows: one per line,
    bullets and numbering dropped, "|" or a spaced dash splits two columns. */
function parseList(type, text) {
  const lines = String(text || "").split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·▪●–—]|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean);
  return lines.map((line) => {
    if (type === "timeline") {
      const m = line.match(/^(\d{1,2}(?:[:.h]\d{2}h?)?\s*(?:[ap]\.?m\.?)?)(?=[\s\-–—|:])\s*(?:[-–—|:]\s*)?(\S.*)$/i);
      return m ? { time: m[1].trim(), text: m[2].trim() } : { time: "", text: line };
    }
    if (type === "shotlist") return { text: line };
    const parts = line.split(/\s*\|\s*|\t+|\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
    const first = parts.shift() || "";
    const rest = parts.join(" · ");
    return type === "groups" ? { names: first, rel: rest } : { label: first, value: rest };
  });
}

/* ----- if found ----- */
function fillFound() {
  document.querySelectorAll("[data-found]").forEach((el) => { el.value = studio.found[el.dataset.found] || ""; });
}
document.querySelectorAll("[data-found]").forEach((el) =>
  el.addEventListener("input", () => { studio.found[el.dataset.found] = el.value; touched(); }));

// The example details are there to show the layout; they must not end up on a real camera.
function foundStillExample() {
  return ["name", "phone", "email"].some((k) =>
    (studio.found[k] || "").trim() && studio.found[k].trim() === DEFAULTS.found[k]);
}

/* ----- your own design: file input + drag/drop ----- */
const drop = $("drop");
// Snapshot the list first: addFiles is async, and clearing the input can
// empty the FileList out from under it.
$("file").addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  e.target.value = "";
  addFiles(files);
});
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(Array.from(e.dataTransfer.files || [])));

// Can this browser actually paint the file? Safari on iOS/macOS decodes HEIC
// natively, so we ask instead of rejecting by file extension and shutting out
// the very phones our customers shoot on.
function canDecode(file) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(true); };
    img.onerror = () => { URL.revokeObjectURL(url); res(false); };
    img.src = url;
  });
}

async function addFiles(fileList) {
  let skipped = 0, overflow = 0, added = 0;
  for (const file of fileList) {
    if (!file.type.startsWith("image/") &&
        !/\.(heic|heif)$/i.test(file.name)) continue;   // some browsers report no MIME for HEIC
    if (state.items.length >= MAX_FILES) { overflow++; continue; }
    if (!(await canDecode(file))) { skipped++; continue; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = schedulePreview;
    img.src = url;
    state.items.push({ file, url, img });
    added++;
  }
  if (skipped || overflow) {
    setStatus("err", skipped
      ? `✗ This browser can't open ${skipped === 1 ? "that file" : "those files"}. HEIC photos work in Safari on iPhone and Mac; elsewhere set Settings → Camera → Formats → Most Compatible, or export as JPG/PNG.`
      : `✗ Max ${MAX_FILES} images per batch. Kept the first ${MAX_FILES}, skipped ${overflow}.`);
  }
  if (added) state.selected = state.items.length - added;
  renderFilmstrip();
  touched();
}

function renderFilmstrip() {
  const wrap = $("preview");
  if (!state.items.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const strip = $("filmstrip");
  strip.innerHTML = "";
  state.items.forEach((it, i) => {
    const w = document.createElement("div");
    w.className = "thumb-wrap" + (i === state.selected ? " sel" : "");
    const t = document.createElement("button");
    t.type = "button";
    t.className = "thumb-btn";
    t.setAttribute("aria-label", "Preview " + (it.file.name || "image " + (i + 1)));
    const img = document.createElement("img");
    img.src = it.url;
    img.alt = "";
    img.className = "thumb";
    t.appendChild(img);
    t.addEventListener("click", () => { state.selected = i; renderFilmstrip(); touched(); });
    const x = document.createElement("button");
    x.type = "button";
    x.className = "thumb-x";
    x.textContent = "×";
    x.setAttribute("aria-label", "Remove " + (it.file.name || "image " + (i + 1)));
    x.addEventListener("click", (e) => { e.stopPropagation(); removeItem(i); });
    w.appendChild(t);
    w.appendChild(x);
    strip.appendChild(w);
  });
}

function removeItem(i) {
  try { URL.revokeObjectURL(state.items[i].url); } catch (_) {}
  state.items.splice(i, 1);
  if (state.selected >= state.items.length) state.selected = Math.max(0, state.items.length - 1);
  renderFilmstrip();
  touched();
}

$("clear-all").addEventListener("click", () => {
  state.items.forEach((it) => { try { URL.revokeObjectURL(it.url); } catch (_) {} });
  state.items = [];
  state.selected = 0;
  renderFilmstrip();
  touched();
});

document.querySelectorAll('input[name="orient"]').forEach((r) => r.addEventListener("change", touched));
const orientValue = () => document.querySelector('input[name="orient"]:checked').value;

/* ----- live preview ----- */
const previewCanvas = $("preview-canvas");
let previewQueued = false;

function showPreview() {
  if (studio.previewing) return;
  studio.previewing = true;
  document.documentElement.classList.add("previewing");
  $("vid").hidden = true;
  $("cam-preview").hidden = false;
  $("mini").hidden = false;
  const v = document.querySelector(".hero-media");
  if (v) { try { v.pause(); } catch (_) {} }
  schedulePreview();
  updateCaption();
}

function schedulePreview() {
  if (!studio.previewing || previewQueued) return;
  previewQueued = true;
  requestAnimationFrame(() => { previewQueued = false; drawPreview(); });
}

/** Your own design, letterboxed exactly like the converter will. */
function drawUpload(canvas) {
  const it = state.items[state.selected];
  const img = it && it.img;
  const ready = !!(img && img.complete && img.naturalWidth);
  const o = orientValue();
  const portrait = ready && (o === "portrait" || (o === "auto" && img.naturalHeight > img.naturalWidth));
  const w = portrait ? 1280 : 1920, h = portrait ? 1920 : 1280;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = ready ? "#ffffff" : "#f2f2f4";
  ctx.fillRect(0, 0, w, h);
  if (ready) {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = Math.round(img.naturalWidth * s), dh = Math.round(img.naturalHeight * s);
    ctx.drawImage(img, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  } else {
    ctx.fillStyle = "#6e6e73";
    ctx.font = "400 56px Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Your design shows up here", w / 2, h / 2);
    ctx.textAlign = "left";
  }
  return portrait;
}

function drawPreview() {
  const n = pagesNow();
  studio.page = Math.min(studio.page, Math.max(0, n - 1));
  let portrait;
  if (studio.type === "upload") {
    portrait = drawUpload(previewCanvas);
  } else {
    portrait = R.isPortrait(studio.type);
    R.draw(previewCanvas, studio.type, cardData(), studio.page);
  }
  $("cam-body").classList.toggle("portrait", portrait);
  const pager = $("pager");
  pager.hidden = n <= 1;
  if (n > 1) {
    $("pg-label").textContent = "Card " + (studio.page + 1) + " of " + n;
    $("pg-prev").disabled = studio.page === 0;
    $("pg-next").disabled = studio.page >= n - 1;
  }
  previewCanvas.setAttribute("aria-label", n > 1
    ? "Preview of card " + (studio.page + 1) + " of " + n
    : "Preview of your card");

  // Phones: a small copy next to the form, tap to flip through the cards.
  const mini = $("mini-canvas");
  const mw = portrait ? 320 : 480, mh = portrait ? 480 : 320;
  if (mini.width !== mw) mini.width = mw;
  if (mini.height !== mh) mini.height = mh;
  mini.getContext("2d").drawImage(previewCanvas, 0, 0, mw, mh);
  $("mini").classList.toggle("portrait", portrait);
  $("mini-pages").textContent = n > 1 ? "Card " + (studio.page + 1) + " of " + n + " · tap for the next" : "";
}

function flipPage(step) {
  const n = pagesNow();
  if (n <= 1) return;
  studio.page = (studio.page + step + n) % n;
  schedulePreview();
}
$("pg-prev").addEventListener("click", () => flipPage(-1));
$("pg-next").addEventListener("click", () => flipPage(1));
$("mini").addEventListener("click", () => flipPage(1));

const cleanCards = () => {
  const a = state.account;
  return !paywallOn() || !!(a && (a.plan === "pro" || (a.credits || 0) > 0));
};

function updateCaption() {
  const cap = $("cam-cap");
  if (!studio.previewing) {
    cap.textContent = "Turn the wheel, the next pose appears. Straight from the SD card.";
    return;
  }
  const on = state.vendor ? ", as it shows on your " + VENDOR_LABEL[state.vendor] : "";
  cap.textContent = "Live preview" + on + "." + (cleanCards() ? "" : " Free cards get a light preview watermark.");
}

// Redraw once the web fonts arrive (the first paint may use fallbacks).
if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedulePreview);

/* ---------- camera picker ---------- */
camButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.vendor = btn.dataset.vendor;
    camButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    $("cameras").classList.remove("attention");
    refresh();
  });
});

/* ---------- the button and its hint ---------- */
function emptyHint() {
  if (studio.type === "pose") {
    return studio.pose.mode === "photo" ? "Add your reference photo to make this card." : "Loading the pose, one moment…";
  }
  if (studio.type === "found") return "Add your name, phone or email.";
  if (studio.type === "upload") return "Add an image: a Canva export, a screenshot or a photo.";
  return "Add at least one line.";
}

// Signed out, the free card is a single card (the server allows one per request).
const freeLimitHit = (n) => paywallOn() && !isSignedIn() && n > 1;

function hintText(n) {
  if (n === 0) return emptyHint();
  if (freeLimitHit(n)) {
    return studio.type === "upload"
      ? "Your free card is one image. Remove the others, or sign in free to convert up to 3."
      : "This makes " + n + " cards and your free card is one: trim it to " +
        R.PER_PAGE[studio.type] + " lines, or sign in free for up to 3.";
  }
  if (!state.vendor) return "Pick your camera, then make your card.";
  return (isSignedIn() || !paywallOn() ? "" : "Free, no account. ") +
    "You get a ZIP with a ready-to-copy SD-card folder and instructions.";
}

function refresh() {
  const n = pagesNow();
  const go = $("go");
  if (!paywallOn() || isSignedIn()) {
    go.textContent = studio.type === "upload"
      ? (n > 1 ? "Convert " + n + " images →" : "Convert & download →")
      : (n > 1 ? "Make " + n + " cards →" : "Make my card →");
  } else {
    go.textContent = "Make my free card →";
  }
  $("go-hint").textContent = hintText(n);
  updateCaption();
}

/* ---------- downscale (your own designs) ---------- */
function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
async function downscale(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";          // flatten any transparency to white (JPEG has no alpha)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  try { URL.revokeObjectURL(img.src); } catch (_) {}
  return await new Promise((res) => canvas.toBlob(res, "image/jpeg", JPEG_Q));
}

/* ---------- make & download ---------- */
$("go").addEventListener("click", makeCards);

function focusEmpty() {
  if (studio.type === "pose") { if (studio.pose.mode === "photo") $("pose-photo").focus(); return; }
  if (studio.type === "found") { document.querySelector('[data-found="name"]').focus(); return; }
  if (studio.type === "upload") { $("file").focus(); return; }
  const first = $("rows").querySelector(".row-in");
  (first || $("row-add")).focus();
}

async function makeCards() {
  $("upsell").hidden = true;
  const n = pagesNow();
  if (!state.vendor) {
    setStatus("err", "✗ Pick your camera first: Sony, Canon or Nikon.");
    $("cameras").classList.add("attention");
    camButtons[0].focus();
    return;
  }
  if (n === 0) {
    setStatus("err", "✗ " + emptyHint());
    focusEmpty();
    return;
  }
  if (studio.type === "found" && foundStillExample()) {
    setStatus("err", "✗ Put your own name, number and email on the card first (the example details are still there).");
    document.querySelector('[data-found="name"]').focus();
    return;
  }
  if (freeLimitHit(n)) {
    setStatus("err", "✗ " + hintText(n));
    showSignupOffer();
    return;
  }
  if (newProjectUnnamed()) {
    setStatus("err", "✗ Name your new project first (or pick an existing one).");
    $("project-new").focus();
    return;
  }
  await convert();
}

// "+ New project…" picked but not named yet: say so before drawing anything.
function newProjectUnnamed() {
  if (!window.__paywall || $("project-field").hidden || !state.projects.length) return false;
  return $("project-select").value === NEW_PROJECT && !($("project-new").value || "").trim();
}

function appendProject(fd) {
  if (window.__paywall) {
    // Numbering continues within the chosen project (server-side).
    const sel = $("project-select"), fresh = $("project-new");
    if (sel && !$("project-field").hidden) {
      const first = !state.projects.length;
      if (first || sel.value === NEW_PROJECT) {
        const name = (fresh.value || "").trim();
        if (name) fd.append("project_name", name);
        else if (!first) {
          setStatus("err", "✗ Name your new project first (or pick an existing one).");
          fresh.focus();
          return false;
        }
        // First project left unnamed: the server files it under "My cards".
      } else if (sel.value) {
        fd.append("project_id", sel.value);
      }
    }
  } else {
    // The open/dev flow keeps its own counter locally so batches don't clash.
    let prev = 0;
    try { prev = parseInt(localStorage.getItem("pic_start_" + state.vendor) || "0", 10) || 0; } catch (_) {}
    fd.append("start", String(prev));
  }
  return true;
}

async function convert() {
  const go = $("go");
  go.disabled = true;
  setStatus("", "Making your cards…");

  try {
    const fd = new FormData();
    fd.append("vendor", state.vendor);
    let files;
    if (studio.type === "upload") {
      fd.append("orientation", orientValue());
      files = [];
      let i = 0;
      for (const it of state.items) files.push({ blob: await downscale(it.file), name: `design-${++i}.jpg` });
    } else {
      fd.append("orientation", "auto");
      files = await R.exportCards(studio.type, cardData());
    }
    if (!appendProject(fd)) return;
    let total = 0;
    files.forEach((f) => { total += f.blob.size; fd.append("files", f.blob, f.name); });
    if (total > MAX_BODY) {
      setStatus("err", `✗ That's ${(total / 1e6).toFixed(1)} MB of images, a bit much for one go. Convert fewer at a time (upload limit is ~4 MB).`);
      return;  // the finally block re-enables the button
    }
    setStatus("", "Converting for your camera…");

    const tok = window.__paywall ? PoseAuth.token() : null;
    const resp = await fetch(API, {
      method: "POST",
      body: fd,
      headers: tok ? { Authorization: "Bearer " + tok } : undefined,
    });

    if (resp.status === 402) {
      let j = {}; try { j = await resp.json(); } catch (_) {}
      setStatus("err", "✗ " + (j.error || "Upgrade required."));
      showUpsell();
      renderAccount();
      return;
    }
    if (resp.status === 401) {
      let j = {}; try { j = await resp.json(); } catch (_) {}
      setStatus("err", "✗ " + (j.error || "Sign in to continue."));
      if (j.need_signin) openLogin();
      return;
    }
    if (!resp.ok) {
      let msg = "Error " + resp.status;
      try { msg = (await resp.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }

    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "camera-cards.zip";
    document.body.appendChild(a); a.click(); a.remove();

    const wm = resp.headers.get("X-Watermarked") === "1";
    const first = resp.headers.get("X-First-File"), last = resp.headers.get("X-Last-File");
    const range = first && last
      ? (first === last ? ` Your card is ${first}.` : ` Your cards are ${first} to ${last}.`)
      : "";
    const anon = resp.headers.get("X-Tier") === "anon";
    setStatus("ok", "✓ Done! Your camera-cards.zip is downloading." + range +
      (wm ? "  (free, watermarked)" : ""));
    if (anon) showSignupNudge();
    if (!window.__paywall && last) {
      // Anonymous flow: remember where this batch ended so the next one continues.
      const m = last.match(/(\d{4})\.JPG$/i);
      if (m) try { localStorage.setItem("pic_start_" + state.vendor, m[1]); } catch (_) {}
    }
    // Keep working in the project we just converted into (it may be brand new).
    const pid = resp.headers.get("X-Project-Id");
    if (pid) state.activeProject = pid;
    showInstructions();
    renderAccount();
    loadHistory();
  } catch (err) {
    setStatus("err", "✗ " + err.message);
  } finally {
    go.disabled = false;
  }
}

function showInstructions() {
  $("instr-text").textContent = INSTRUCTIONS[state.vendor] || "";
  $("instructions").hidden = false;
  $("instructions").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Shown after a signed-out visitor's free card: they have seen it work, so this
// is the moment an account is worth something.
function showSignupNudge() {
  const el = $("upsell");
  el.hidden = false;
  el.innerHTML =
    '<p class="muted upsell-text">That one was on us, with a light watermark. Sign in with your email for ' +
    '3 more free cards and keep your projects, so you never redo a list. Pro makes every card clean and unlimited.</p>' +
    '<div class="buy-row"><button class="go" type="button" id="nudge-signin">Sign in with an email link</button>' +
    '<a class="link-btn" href="#pricing">See Pro</a></div>';
  const btn = $("nudge-signin");
  if (btn) btn.addEventListener("click", openLogin);
}

// Signed out and the list makes more than the one free card.
function showSignupOffer() {
  const el = $("upsell");
  el.hidden = false;
  el.innerHTML =
    '<p class="muted upsell-text">Sign in free with an email link (no password) to make up to 3 cards, ' +
    'or go Pro for unlimited cards with no watermark.</p>' +
    '<div class="buy-row"><button class="go" type="button" id="offer-signin">Sign in free</button>' +
    '<a class="link-btn" href="#pricing">See Pro</a></div>';
  const btn = $("offer-signin");
  if (btn) btn.addEventListener("click", openLogin);
}

function showUpsell() {
  const el = $("upsell");
  el.hidden = false;
  if (window.__stripe) {
    el.innerHTML =
      '<p class="muted upsell-text">You\'ve used your free cards. Go Pro for unlimited cards with no watermark, or buy a card pack:</p>' +
      '<div class="buy-row">' +
        '<button class="go" type="button" data-kind="monthly">Go Pro (monthly)</button>' +
        '<button class="go ghost" type="button" data-kind="yearly">Pro (yearly)</button>' +
        '<button class="link-btn" type="button" data-kind="pack20">Buy 20 cards</button>' +
      '</div>';
    el.querySelectorAll("[data-kind]").forEach((b) =>
      b.addEventListener("click", () => startCheckout(b.dataset.kind, b)));
  } else {
    el.innerHTML = '<p class="muted upsell-text">You\'ve used your free cards. Paid plans are launching soon. Thanks for trying it!</p>';
  }
}

// Picked a plan while signed out: remember it, so after the email link the
// checkout opens by itself instead of leaving them to find the button again.
const PENDING_BUY = "pic_pending_checkout";
const PLAN_KINDS = ["monthly", "yearly", "pack20"];

async function startCheckout(kind, btn) {
  const tok = PoseAuth.token();
  if (!tok) {
    try { localStorage.setItem(PENDING_BUY, JSON.stringify({ kind, at: Date.now() })); } catch (_) {}
    openLogin("checkout");
    return;
  }
  if (btn) btn.disabled = true;
  try {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || "Could not start checkout.");
    window.location.href = j.url;
  } catch (e) {
    setStatus("err", "✗ " + e.message);
    if (btn) btn.disabled = false;
  }
}

// Back from the email link with a plan still pending: carry on to checkout.
function resumePendingCheckout() {
  if (!isSignedIn() || !window.__stripe) return;   // keep it until they're signed in
  let p = null;
  try { p = JSON.parse(localStorage.getItem(PENDING_BUY) || "null"); } catch (_) {}
  try { localStorage.removeItem(PENDING_BUY); } catch (_) {}
  if (!p || !PLAN_KINDS.includes(p.kind) || !(Date.now() - p.at < 3600e3)) return;
  if (state.account && state.account.plan === "pro") return;   // nothing left to buy
  setStatus("", "Taking you to checkout…");
  startCheckout(p.kind);
}

async function startPortal() {
  const tok = PoseAuth.token();
  if (!tok) return;
  try {
    const r = await fetch("/api/portal", { method: "POST", headers: { Authorization: "Bearer " + tok } });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || "Could not open billing.");
    window.location.href = j.url;
  } catch (e) {
    setStatus("err", "✗ " + e.message);
  }
}

/* ---------- pricing section ---------- */
function currencySym(o) {
  return o.currency === "EUR" ? "€" : (o.currency || "") + " ";
}

function fmtMoney(o) {
  if (!o || o.amount == null) return null;
  const n = Number(o.amount);
  return currencySym(o) + (Number.isInteger(n) ? n : n.toFixed(2));
}

async function renderPricing() {
  const grid = $("price-grid");
  const toggle = $("price-toggle");
  const extra = $("price-extra");
  if (!grid) return;

  let data = { prices: {}, free_limit: 3, pack_size: 20 };
  try { data = await (await fetch("/api/prices")).json(); } catch (_) {}
  const P = data.prices || {};
  const freeN = data.free_limit ?? 3;
  const packN = data.pack_size ?? 20;
  const hasM = !!P.monthly, hasY = !!P.yearly, hasPack = !!P.pack20;

  let cycle = hasM ? "monthly" : (hasY ? "yearly" : "monthly");
  toggle.hidden = !(hasM && hasY);
  if (hasM && hasY) {
    const save = Math.round((1 - P.yearly.amount / (P.monthly.amount * 12)) * 100);
    if (save > 0) toggle.querySelector('[data-cycle="yearly"]').textContent = "Yearly · save " + save + "%";
  }

  const card = (o) =>
    '<div class="price-card' + (o.featured ? " featured" : "") + '">' +
      (o.badge ? '<span class="price-badge">' + o.badge + "</span>" : "") +
      '<div class="price-name">' + o.name + "</div>" +
      '<div class="price-amount">' + o.amount +
        (o.per ? '<span class="per">' + o.per + "</span>" : "") + "</div>" +
      '<p class="price-note">' + (o.note || "") + "</p>" +
      '<ul class="price-feats">' + o.feats.map((f) => "<li>" + f + "</li>").join("") + "</ul>" +
      o.cta +
    "</div>";

  function paint() {
    const pro = P[cycle];
    const proAmt = fmtMoney(pro);
    let proNote = "Every wedding you shoot";
    if (cycle === "yearly" && hasY) {
      proNote = currencySym(P.yearly) + (P.yearly.amount / 12).toFixed(2) + "/mo, billed yearly";
    }

    grid.innerHTML =
      card({
        name: "Free",
        amount: "€0",
        note: "No credit card",
        feats: ["Your first card, no account", freeN + " more when you sign in",
                "Every card type", "Light preview watermark"],
        cta: '<button class="btn btn-ghost" type="button" data-make="pose">Make a free card</button>',
      }) +
      card({
        name: "Pose pack",
        amount: "50",
        per: " poses",
        note: "Ready-made, bought once",
        feats: ["Couples, bridal and group poses", "What to say to the couple",
                "Sony, Canon &amp; Nikon", "From our In Principio store"],
        cta: '<a class="btn btn-ghost" href="' + STORE_URL + '" target="_blank" rel="noopener">See the pose pack</a>',
      }) +
      card({
        featured: true,
        badge: "Best value",
        name: "Pro",
        amount: proAmt || "",
        per: proAmt ? (cycle === "yearly" ? "/yr" : "/mo") : "",
        note: proNote,
        feats: ["Unlimited cards, every type", "No watermark",
                "A project per wedding", "Your own designs, converted", "Cancel anytime"],
        cta: (hasM || hasY)
          ? '<button class="btn btn-primary" type="button" data-buy="' + cycle + '">Go Pro</button>'
          : '<button class="btn btn-primary" type="button" disabled>Coming soon</button>',
      });

    grid.querySelectorAll("[data-buy]").forEach((b) =>
      b.addEventListener("click", () => startCheckout(b.dataset.buy, b)));
  }

  if (hasPack && extra) {
    extra.innerHTML = "Shooting just one wedding? " +
      '<button class="link-btn" type="button" data-buy="pack20">Get ' + packN + " cards for " +
      fmtMoney(P.pack20) + "</button>, once, no subscription.";
    extra.querySelector("[data-buy]").addEventListener("click", (e) => startCheckout("pack20", e.currentTarget));
    extra.hidden = false;
  }

  toggle.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      cycle = b.dataset.cycle;
      toggle.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      paint();
    }));
  toggle.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.cycle === cycle));

  paint();
}

/* ---------- auth / account ---------- */
// The phone menu's copies of Billing / Sign out (CSS shows them on phones only).
function setMenuAccount(signedIn, billing) {
  const nb = $("nav-billing"), ns = $("nav-signout");
  if (ns) { ns.hidden = !signedIn; ns.onclick = async () => { await PoseAuth.signOut(); }; }
  if (nb) { nb.hidden = !(signedIn && billing); nb.onclick = startPortal; }
}

// "email · plan": the email shrinks first so the plan always shows.
function setAcctInfo(who, plan) {
  const info = $("acct-info");
  info.textContent = "";
  info.className = "acct-info split" + (plan ? " has-plan" : "");
  const add = (cls, text) => {
    const s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    info.appendChild(s);
  };
  add("acct-email", who);
  if (plan) { add("acct-sep", " · "); add("acct-plan", plan); }
  info.title = plan ? who + " · " + plan : who;
}

async function renderAccount() {
  const el = $("account"), nudge = $("upgrade-nudge");
  if (!window.__paywall) { el.hidden = true; if (nudge) nudge.hidden = true; setMenuAccount(false); return; }
  el.hidden = false;
  const tok = PoseAuth.token();
  if (!tok) {
    el.innerHTML = '<button class="link-btn" type="button" id="signin-btn">Sign in</button>';
    $("signin-btn").onclick = openLogin;
    if (nudge) nudge.hidden = true;
    setMenuAccount(false);
    return;
  }
  el.innerHTML = '<span class="acct-info" id="acct-info">…</span>' +
    '<button class="link-btn" type="button" id="manage-btn" hidden>Billing</button>' +
    '<button class="link-btn" type="button" id="signout-btn">Sign out</button>';
  $("signout-btn").onclick = async () => { await PoseAuth.signOut(); };
  $("manage-btn").onclick = startPortal;
  setMenuAccount(true, false);
  try {
    const r = await fetch(ME, { headers: { Authorization: "Bearer " + tok } });
    const j = await r.json();
    const who = j.email || (PoseAuth.user() && PoseAuth.user().email) || "signed in";
    let badge;
    state.account = j;
    // Subscribers have nothing left to buy: .is-pro hides pricing and the nudge.
    setPlanClasses(j.plan);
    renderUpgradeNudge(j);
    if (j.plan === "pro") {
      // Cancelled but paid up: still Pro, and say until when.
      const ends = j.pro_ends ? shortDate(j.pro_ends) : "";
      badge = ends ? "Pro · ends " + ends : "Pro";
      if (window.__stripe) { $("manage-btn").hidden = false; setMenuAccount(true, true); }
    }
    else if ((j.credits || 0) > 0) badge = j.credits + " credits";
    else badge = (j.free_left ?? 0) + " free left";
    setAcctInfo(who, badge);
  } catch (_) {
    setAcctInfo((PoseAuth.user() && PoseAuth.user().email) || "signed in", "");
  }
  updateCaption();
}

// "2 Nov" (with the year when it isn't this year), in the page's language.
function shortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const opts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-GB", opts);
}

/* ---------- upgrade nudge ---------- */
/* Free and credit users see where to upgrade before they hit the wall; the
   old upsell only appeared after a 402. */
function renderUpgradeNudge(j) {
  const box = $("upgrade-nudge"), text = $("nudge-text"), cta = $("nudge-cta");
  if (!box) return;
  if (!j || j.plan === "pro") { box.hidden = true; return; }

  const credits = j.credits || 0;
  const left = j.free_left ?? 0;
  const limit = j.free_limit ?? 3;
  const spent = !credits && left <= 0;

  if (credits > 0) {
    text.innerHTML = "<strong>" + credits + "</strong> credit" + (credits === 1 ? "" : "s") +
      " left. Go Pro for unlimited cards, no watermark.";
  } else if (spent) {
    text.innerHTML = "You've used all <strong>" + limit + "</strong> free cards. " +
      "Go Pro for unlimited cards, no watermark.";
  } else {
    text.innerHTML = "<strong>" + left + "</strong> of " + limit + " free card" +
      (limit === 1 ? "" : "s") + " left, watermarked. Go Pro to remove both limits.";
  }
  box.classList.toggle("spent", spent);

  // Without Stripe there is no checkout to start, so point at the plans instead.
  cta.textContent = window.__stripe ? "Go Pro" : "See plans";
  cta.onclick = window.__stripe
    ? () => startCheckout("monthly", cta)
    : () => document.getElementById("pricing").scrollIntoView({ behavior: "smooth" });
  box.hidden = false;
}

/* ---------- projects + history ---------- */
const MAX_HISTORY_THUMBS = 8;

function renderProjectPicker() {
  const field = $("project-field"), sel = $("project-select");
  if (!field) return;
  const signedIn = !!(window.__paywall && window.PoseAuth && PoseAuth.token());
  if (!signedIn) { field.hidden = true; return; }
  field.hidden = false;

  // No projects yet: nothing to pick from, so it's just a name field.
  if (!state.projects.length) {
    sel.hidden = true;
    sel.value = NEW_PROJECT;
    state.activeProject = null;
    syncProjectRow();
    return;
  }

  const keep = state.activeProject || sel.value;
  sel.hidden = false;
  sel.innerHTML = "";
  state.projects.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    sel.appendChild(o);
  });
  const o = document.createElement("option");
  o.value = NEW_PROJECT;
  o.textContent = "+ New project…";
  sel.appendChild(o);

  // A refresh (after a conversion, or a background token renewal) must not undo
  // "+ New project…" while someone is typing its name.
  if (keep === NEW_PROJECT) sel.value = NEW_PROJECT;
  else sel.value = state.projects.some((p) => p.id === keep) ? keep : state.projects[0].id;
  state.activeProject = sel.value === NEW_PROJECT ? null : sel.value;
  syncProjectRow();
}

function syncProjectRow() {
  const sel = $("project-select"), fresh = $("project-new");
  const hint = $("project-hint"), label = $("project-label");
  if (!sel) return;
  const first = !state.projects.length;
  const creating = first || sel.value === NEW_PROJECT;
  fresh.hidden = !creating;
  if (!creating) fresh.value = "";
  label.textContent = first ? "Name this job" : "Project";
  // With no <select> showing, point the label at the box people actually type in.
  label.htmlFor = first ? "project-new" : "project-select";
  hint.textContent = first
    ? "Group a wedding under one name, so you can make its cards in several goes and the numbers keep counting up."
    : creating
      ? "A new project starts its card numbers at 0001."
      : "Cards in this project keep counting up, so you can make a wedding's cards in several goes.";
}

async function loadHistory() {
  const section = $("history");
  const tok = window.__paywall && window.PoseAuth ? PoseAuth.token() : null;
  if (!tok) {
    state.projects = [];
    renderProjectPicker();
    if (section) section.hidden = true;
    if ($("nav-projects")) $("nav-projects").hidden = true;
    return;
  }
  try {
    const r = await fetch("/api/history", { headers: { Authorization: "Bearer " + tok } });
    if (!r.ok) throw new Error("history unavailable");
    const j = await r.json();
    state.projects = j.projects || [];
    renderProjectPicker();
    renderHistory(j.batches || [], state.projects);
  } catch (_) {
    renderProjectPicker();
    if (section) section.hidden = true;
    if ($("nav-projects")) $("nav-projects").hidden = true;
  }
}

function renderHistory(batches, projects) {
  const section = $("history"), list = $("history-list");
  // The nav link only makes sense once there is a section to jump to.
  if ($("nav-projects")) $("nav-projects").hidden = !batches.length;
  if (!batches.length) { section.hidden = true; return; }

  // Group batches under their project, newest project first. Batches from
  // before projects existed (or whose project was deleted) go in their own group.
  const names = {};
  (projects || []).forEach((p) => { names[p.id] = p.name; });
  const groups = [];
  const byId = new Map();
  batches.forEach((b) => {
    const key = b.project_id || "_none";
    let g = byId.get(key);
    if (!g) {
      g = { id: b.project_id || null, name: names[b.project_id] || "Earlier cards", batches: [], cards: 0 };
      byId.set(key, g);
      groups.push(g);
    }
    g.batches.push(b);
    g.cards += b.cards || 0;
  });

  list.innerHTML = "";
  groups.forEach((g) => list.appendChild(projectBlock(g)));
  section.hidden = false;
}

function projectBlock(group) {
  const block = document.createElement("div");
  block.className = "project-block";

  const head = document.createElement("div");
  head.className = "project-block-head";
  const title = document.createElement("h3");
  title.className = "project-name";
  title.textContent = group.name;
  const meta = document.createElement("span");
  meta.className = "project-meta";
  meta.textContent = group.cards + (group.cards === 1 ? " card" : " cards") + " · " +
    group.batches.length + (group.batches.length === 1 ? " batch" : " batches");
  head.appendChild(title);
  head.appendChild(meta);
  block.appendChild(head);

  if (group.id) {
    const all = document.createElement("button");
    all.type = "button";
    all.className = "btn btn-primary project-dl";
    all.textContent = "Download whole project";
    all.addEventListener("click", () =>
      downloadZip("/api/history?download_project=" + encodeURIComponent(group.id), all));
    block.appendChild(all);
  }

  group.batches.forEach((b) => block.appendChild(batchRow(b)));
  return block;
}

function batchRow(b) {
  const item = document.createElement("div");
  item.className = "history-item";

  const head = document.createElement("div");
  head.className = "history-head";
  const when = b.created_at ? new Date(b.created_at) : null;
  const files = b.files || [];
  const range = files.length
    ? files[0].name.replace(/\.JPG$/i, "") + (files.length > 1 ? "–" + files[files.length - 1].name.replace(/\.JPG$/i, "") : "")
    : "";
  const title = document.createElement("span");
  title.className = "history-title";
  title.textContent = (VENDOR_LABEL[b.vendor] || b.vendor || "") + " · " +
    b.cards + (b.cards === 1 ? " card" : " cards") + (range ? " · " + range : "") +
    (b.watermarked ? " · watermarked" : "");
  const dateEl = document.createElement("span");
  dateEl.className = "history-date";
  dateEl.textContent = when ? when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  head.appendChild(title);
  head.appendChild(dateEl);

  const strip = document.createElement("div");
  strip.className = "history-thumbs";
  files.slice(0, MAX_HISTORY_THUMBS).forEach((f) => {
    if (!f.url) return;
    const img = document.createElement("img");
    img.src = f.url;
    img.alt = f.name || "card";
    img.loading = "lazy";
    strip.appendChild(img);
  });
  if (files.length > MAX_HISTORY_THUMBS) {
    const more = document.createElement("span");
    more.className = "history-more";
    more.textContent = "+" + (files.length - MAX_HISTORY_THUMBS);
    strip.appendChild(more);
  }

  const actions = document.createElement("div");
  actions.className = "history-actions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-ghost history-dl";
  btn.textContent = "Download this batch";
  btn.addEventListener("click", () =>
    downloadZip("/api/history?download=" + encodeURIComponent(b.id), btn));
  actions.appendChild(btn);

  item.appendChild(head);
  item.appendChild(strip);
  item.appendChild(actions);
  return item;
}

async function downloadZip(url, btn) {
  const tok = PoseAuth.token();
  if (!tok) { openLogin(); return; }
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing…";
  try {
    const r = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
    if (!r.ok) {
      let msg = "Could not rebuild this download.";
      try { msg = (await r.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "camera-cards.zip";
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) {
    btn.textContent = "✗ " + e.message;
    setTimeout(() => { btn.textContent = label; }, 4000);
    btn.disabled = false;
    return;
  }
  btn.textContent = label;
  btn.disabled = false;
}

const _projectSelect = document.getElementById("project-select");
if (_projectSelect) {
  _projectSelect.addEventListener("change", () => {
    state.activeProject = _projectSelect.value === NEW_PROJECT ? null : _projectSelect.value;
    syncProjectRow();
    if (_projectSelect.value === NEW_PROJECT) $("project-new").focus();
  });
}

/* ---------- login modal ---------- */
let _loginReturnFocus = null;
function openLogin(reason) {
  _loginReturnFocus = document.activeElement;
  const buying = reason === "checkout";   // event handlers pass an Event here
  // A plain sign-in drops a plan picked earlier: no surprise trip to checkout.
  if (!buying) { try { localStorage.removeItem(PENDING_BUY); } catch (_) {} }
  $("login-title").textContent = buying ? "Sign in to continue" : "Sign in";
  const sub = $("login-sub");
  if (sub) {
    sub.textContent = buying
      ? "We'll email you a magic link. Open it and you go straight on to checkout. No password."
      : "We'll email you a magic link. No password.";
  }
  $("login-modal").hidden = false;
  $("login-email").focus();
}
function closeLogin() {
  $("login-modal").hidden = true;
  try { if (_loginReturnFocus && _loginReturnFocus.focus) _loginReturnFocus.focus(); } catch (_) {}
}
$("login-close").onclick = closeLogin;
$("login-modal").addEventListener("click", (e) => { if (e.target === $("login-modal")) closeLogin(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("login-modal").hidden) closeLogin();
});
$("login-modal").addEventListener("keydown", (e) => {   // keep Tab inside the dialog
  if (e.key !== "Tab") return;
  const f = [$("login-email"), $("login-send"), $("login-close")].filter((el) => el && !el.disabled);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("login-email").value.trim();
  const st = $("login-status");
  if (!email) { st.className = "status err"; st.textContent = "Enter your email."; return; }
  st.className = "status"; st.textContent = "Sending…";
  try {
    await PoseAuth.signIn(email);
    st.className = "status ok";
    st.textContent = "Check your email for the magic link.";
  } catch (err) {
    st.className = "status err";
    st.textContent = err.message || "Could not send link.";
  }
});

/* ---------- jump to a card type from anywhere on the page ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-make]");
  if (!b) return;
  const type = b.dataset.make;
  if (type === "pose" && studio.pose.mode === "photo" && !studio.pose.photo) {
    studio.pose.mode = "sample";   // "try one free" means one of ours
  }
  if (type !== studio.type) selectType(type);
  else touched();
  if (type === "pose") syncPoseMode();
  $("studio").scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ---------- phone menu ---------- */
(function navMenu() {
  const nav = $("nav"), btn = $("nav-toggle"), links = $("nav-links");
  if (!nav || !btn || !links) return;
  const close = () => { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => { if (e.target.closest("a, button")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.addEventListener("click", (e) => { if (!nav.contains(e.target)) close(); });
})();

/* ---------- boot ---------- */
selectType("pose", true);

(async function boot() {
  try {
    const j = await (await fetch(API, { method: "GET" })).json();
    window.__paywall = !!j.paywall;
    window.__stripe = !!j.stripe;
  } catch (_) {
    window.__paywall = false;
    window.__stripe = false;
  }
  if (window.__paywall && !window.supabase) {
    // vendor auth script failed to load — say so instead of a dead Sign in button
    const el = $("account");
    el.hidden = false;
    el.innerHTML = '<span class="acct-info">Sign-in temporarily unavailable. Refresh and try again.</span>';
  } else if (window.__paywall && window.PoseAuth) {
    await PoseAuth.init(async () => {
      $("login-modal").hidden = true;
      syncSignedInLayout();
      loadHistory();
      await renderAccount();
      resumePendingCheckout();
    });
  } else {
    $("account").hidden = true;
  }
  syncSignedInLayout();
  renderPricing();
  handleCheckoutReturn();
})();

function handleCheckoutReturn() {
  const c = new URLSearchParams(location.search).get("checkout");
  if (!c) return;
  if (c === "success") {
    setStatus("ok", "✓ Payment received. Your account is updating. Thank you!");
    $("status").scrollIntoView({ behavior: "smooth", block: "center" });
    // Stripe tells our server a moment later (webhook): keep checking for up to
    // half a minute and say so once the plan or the credits show up.
    let n = 0;
    const check = async () => {
      await renderAccount();
      const a = state.account;
      if (a && (a.plan === "pro" || (a.credits || 0) > 0)) {
        setStatus("ok", a.plan === "pro"
          ? "✓ You're on Pro: every card is clean and unlimited. Thank you!"
          : "✓ " + a.credits + " credits are on your account. Thank you!");
      } else if (++n < 15) {
        setTimeout(check, 2000);
      } else {
        setStatus("ok", "✓ Payment received. It can take a minute to show here: refresh the page shortly.");
      }
    };
    setTimeout(check, 1500);
  }
  history.replaceState({}, "", location.pathname);
}

/* ---------- hero video: slow playback for a smoother, cinematic loop ---------- */
(function heroVideo() {
  const v = document.querySelector(".hero-media");
  if (!v) return;
  const RATE = 0.6;
  const apply = () => { try { v.playbackRate = RATE; } catch (_) {} };
  ["loadedmetadata", "canplay", "play"].forEach((e) => v.addEventListener(e, apply));
  apply();
  // The video autoplays (muted) via the HTML attribute — most reliable on mobile.
  // A belt-and-suspenders play() in case a browser ignored autoplay-on-load.
  if (!studio.previewing && v.play) v.play().catch(() => {});
  // Honour reduced-motion: stop the loop and leave the still poster frame.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    try { v.autoplay = false; v.pause(); } catch (_) {}
  }
})();

/* ---------- scroll polish: reveal on scroll + nav shadow ---------- */
(function scrollPolish() {
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const groups = [
    ".packs .pack-stack, .packs .packs-copy",
    ".more .eyebrow, .more .section-h, .more-lede",
    "stagger:.more .tile",
    ".why .eyebrow, .why .section-h, .why-table, .why-safe",
    ".pricing .eyebrow, .pricing .section-h, .price-grid",
    ".faq .eyebrow, .faq .section-h",
    "stagger:.faq .faq-item",
    ".final .final-card",
  ];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

  groups.forEach((g) => {
    const stagger = g.startsWith("stagger:");
    const sel = stagger ? g.slice(8) : g;
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add("reveal");
      if (stagger) el.style.transitionDelay = Math.min(i, 6) * 70 + "ms";
      io.observe(el);
    });
  });
})();
