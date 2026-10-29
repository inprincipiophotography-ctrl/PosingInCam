"use strict";

const API = "/api/convert";

// A funnel step for the visitor stats (assets/visits.js). Ad blockers may
// keep that file away, so the app never depends on it.
function track(name, data) {
  if (window.trackEvent) window.trackEvent(name, data);
}
const ME = "/api/me";
const MAX_EDGE = 1920;        // a card is 1920x1280: more pixels would only be thrown away
const JPEG_Q = 0.9;
// How to paste on this computer (the hint under "Any image" and its messages).
const PASTE_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘V" : "Ctrl+V";
const MAX_FILES = 30;         // matches the server-side cap (api/convert.py)
// Vercel caps one request (and one response) at ~4.5 MB, so a big batch goes up
// in several requests and comes back as one merged ZIP. Each request is sized so
// both what goes up and the ZIP that comes back stay under the cap. A card's
// size depends on the camera's q-tables (Canon's are near-lossless): estimated
// as upload size × ratio, at most a per-card ceiling — measured on real photos
// at 1920 px (worst seen: Canon 820 KB, Sony 490 KB, Nikon 340 KB).
const REQUEST_BUDGET = 3_500_000;
const RESPONSE_BUDGET = 3_600_000;
const CARD_ESTIMATE = { sony: [1.8, 550_000], nikon: [1.3, 400_000], canon: [3, 900_000] };
const MAX_FILE_BYTES = 4_000_000;
const STORE_URL = "https://www.inprincipioweddings.com/store/in-camera-posing";
// Stripe availability comes from the API health flag (window.__stripe).

const state = { vendor: null, items: [], selected: 0, projects: [], account: null };
const NEW_PROJECT = "__new__";
const $ = (id) => document.getElementById(id);
const camButtons = Array.from(document.querySelectorAll("#cameras .cam"));
const VENDOR_LABEL = { sony: "Sony", canon: "Canon", nikon: "Nikon" };
const R = window.CardRenderer;

const isSignedIn = () => !!(window.PoseAuth && PoseAuth.signedIn());
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
    "SONY: copy into DCIM/100MSDCF, next to your photos. No formatting.\n" +
    "1. No DCIM/100MSDCF/ folder on the card yet? Take one ordinary photo and the camera creates it.\n" +
    "2. Copy all .JPG from the ZIP (DCIM/100MSDCF/) into that folder on the card.\n" +
    "3. ▶ Playback. The cards appear among your photos.\n" +
    "Not showing? MENU → Setup → Media → Recover Image Database → confirm.\n" +
    "Still not showing (older bodies such as the A7 III)? On the computer, delete the AVF_INFO folder on the card, put it back in and confirm Recover Image Database.",
  canon:
    "CANON: plug & play, no database rebuild, no formatting.\n" +
    "1. No DCIM/100CANON/ folder on the card yet? Take one ordinary photo and the camera creates it.\n" +
    "2. Copy the .JPG from the ZIP into DCIM/100CANON/ on the card, next to your photos.\n" +
    "3. Insert the card → ▶ Playback. (Press INFO for details.)",
  nikon:
    "NIKON: copy into the folder YOUR camera created. No formatting.\n" +
    "1. No DCIM/100NCZ_… folder on the card yet? Take one ordinary photo and the camera creates it (e.g. 100NCZ_8).\n" +
    "2. Copy the DSC_*.JPG from the ZIP into THAT folder, next to your photos (not 100NCZ_X).\n" +
    "3. If you don't see them: PLAYBACK MENU → Playback folder → All.\n" +
    "4. ▶ Playback.",
};

function setStatus(kind, text) {
  const st = $("status");
  st.className = "status" + (kind ? " " + kind : "");
  st.textContent = text;
}

// A request that failed for reasons on our side or the network's: say what
// happened in plain words and offer the way out, never a bare status code.
const SUPPORT_MAIL = "notalucis.dev@gmail.com";
function failMessage(status, serverMsg) {
  if (serverMsg) return serverMsg;
  if (status === 0) return "We couldn't reach the converter. Check your connection and try again.";
  if (status === 413) return "That's too much to send in one go. Remove a few images and try again.";
  if (status === 429) return "Lots of cards in a short time. Wait a minute, then try again.";
  return "The converter didn't answer (error " + status + "). Your card is still here, so try again in a moment.";
}
function retryable(status, serverMsg) {
  return Object.assign(new Error(failMessage(status, serverMsg)), { retry: true });
}
function addRecovery() {
  const st = $("status");
  const again = document.createElement("button");
  again.type = "button";
  again.className = "link-btn status-act";
  again.textContent = "Try again";
  again.addEventListener("click", makeCards);
  const mail = document.createElement("a");
  mail.className = "status-act";
  mail.href = "mailto:" + SUPPORT_MAIL + "?subject=" + encodeURIComponent("Shoot Cards: a card didn't make");
  mail.textContent = "Tell us";
  st.append(" ", again, " · ", mail);
}
/* ---------- toast: undo, and news that isn't about the studio ---------- */
// One pattern for "that happened, here's the way back": a removed line, a pasted
// list, a checkout that didn't open. Fixed at the bottom so it shows wherever
// you are on the page.
let toastTimer = 0;
function toast(text, opts = {}) {
  const el = $("toast");
  clearTimeout(toastTimer);
  el.className = "toast" + (opts.kind ? " " + opts.kind : "");
  el.textContent = "";
  const msg = document.createElement("span");
  msg.textContent = text;
  el.appendChild(msg);
  if (opts.action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-act";
    b.textContent = opts.actionLabel || "Undo";
    b.addEventListener("click", () => { hideToast(); opts.action(); });
    el.appendChild(b);
  }
  if (opts.support) {
    const a = document.createElement("a");
    a.className = "toast-act";
    a.href = "mailto:" + SUPPORT_MAIL + "?subject=" + encodeURIComponent("Shoot Cards: " + opts.support);
    a.textContent = "Contact us";
    el.appendChild(a);
  }
  const x = document.createElement("button");
  x.type = "button";
  x.className = "toast-x";
  x.setAttribute("aria-label", "Dismiss");
  x.textContent = "×";
  x.addEventListener("click", hideToast);
  el.appendChild(x);
  el.hidden = false;
  toastTimer = setTimeout(hideToast, opts.ms || (opts.action ? 8000 : 6000));
}
function hideToast() {
  clearTimeout(toastTimer);
  $("toast").hidden = true;
}

/* ---------- one way to say how many cards are left ---------- */
// The account badge, the nudge above the studio and every refusal read the
// same: used / total, that free cards don't renew, and how to get more.
// Free and paid cards don't add up within one make (webauth/auth.py decide()).
function allowance(a) {
  const limit = a && a.free_limit != null ? a.free_limit : (state.freeLimit || 3);
  const left = Math.max(0, a && a.free_left != null ? a.free_left : limit);
  const paid = (a && a.credits) || 0;
  return { limit, left, used: Math.max(0, limit - left), paid, canMake: Math.max(left, paid) };
}
const cardsWord = (n) => n + (n === 1 ? " card" : " cards");
function limitRefusal(a, need) {
  const x = allowance(a);
  if (!x.canMake) {
    return x.used + " of " + x.limit + " free cards used, and free cards don't renew. " +
      "Get Pro once for unlimited cards with no watermark.";
  }
  return "This makes " + cardsWord(need) + " and you can make " + x.canMake + " now (" +
    (x.paid ? cardsWord(x.paid).replace("card", "paid card") : x.used + " of " + x.limit + " free cards used") +
    "). Trim it to " + cardsWord(x.canMake) + ", or get Pro once for unlimited.";
}

// An error from the last card type shouldn't hang around under the next one.
function clearError() {
  if ($("status").classList.contains("err")) setStatus("", "");
  $("cameras").classList.remove("attention");
}

/* ---------- studio: every card type in one place ---------- */
const TYPES = ["pose", "timeline", "groups", "shotlist", "settings", "found", "upload"];
const LIST_TYPES = ["timeline", "groups", "shotlist", "settings"];
// Shown behind "+ 3 more" so the first choice is between four.
const MORE_TYPES = ["settings", "found", "upload"];

const LIST_UI = {
  timeline: {
    head: "Heading", headKey: "label", headPh: "e.g. Saturday",
    fields: [{ key: "time", label: "Time", ph: "14:00", cls: "c-time", max: 12 },
             { key: "text", label: "What happens", ph: "e.g. First look", max: 60 }],
    paste: "Time first, one per line:\n14:00 Getting ready\n15:30 First look\n16:30 Ceremony",
  },
  groups: {
    head: "Heading", headKey: "label", headPh: "e.g. After the ceremony",
    fields: [{ key: "names", label: "Who, by name", ph: "e.g. Emma & James + Sarah & David", max: 70 },
             { key: "rel", label: "Who they are", ph: "e.g. her parents", cls: "c-rel", max: 30 }],
    paste: "One group per line, names | who they are:\nEmma & James + Sarah & David | her parents\n+ Lucy & Tom | her siblings",
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
    { time: "16:30", text: "Ceremony" }, { time: "19:30", text: "Golden hour portraits" },
    { time: "21:00", text: "First dance" }] },
  groups: { label: "After the ceremony", rows: [
    { names: "Emma & James + Grandma Rose", rel: "her grandma, seated" },
    { names: "+ Sarah & David", rel: "her parents" },
    { names: "+ Lucy & Tom", rel: "her siblings" },
    { names: "Emma & James + Helen & Mark", rel: "his parents" },
    { names: "+ Oliver", rel: "his brother" },
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
          title: "", energy: "", camera: "", hack: "", say: "", source: "" },
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
             title: p.title, energy: p.energy, camera: p.camera, hack: p.hack, say: p.say, source: p.source };
  }
  if (type === "found") return studio.found;
  return studio.lists[type];
}

function pagesNow() {
  return studio.type === "upload" ? state.items.length : R.pages(studio.type, cardData());
}

function selectType(type, quiet) {
  if (!TYPES.includes(type)) return;
  if (type !== studio.type && !quiet) clearError();
  if (type !== studio.type) studio.pasteCut = false;
  studio.type = type;
  studio.page = 0;
  if (MORE_TYPES.includes(type)) showMoreTypes();
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

function showMoreTypes() {
  $("types-extra").hidden = false;
  $("types-more").hidden = true;
  $("types-more").setAttribute("aria-expanded", "true");
}
$("types-more").addEventListener("click", () => {
  showMoreTypes();
  $("types-extra").querySelector(".type").focus();
});

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
  saveDraft();
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
  setPoseSample(b.dataset.sample);
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

function updateRowsNote(cutLines = 0) {
  if (!LIST_TYPES.includes(studio.type)) return;
  const n = R.rowsOf(studio.type, studio.lists[studio.type]).length;
  const cards = R.pages(studio.type, studio.lists[studio.type]);
  const per = R.PER_PAGE[studio.type];
  const note = $("rows-note");
  note.textContent = n
    ? n + (n === 1 ? " line" : " lines") + " · " + cards + (cards === 1 ? " card" : " cards") +
      " (" + per + " lines fit on a card)"
    : "";
  if (studio.pasteCut) note.textContent += " · kept the first " + R.MAX_ROWS + " lines";
  if (cutLines) {
    note.textContent += " · " + (cutLines === 1 ? "1 line is" : cutLines + " lines are") +
      " too long and will end in \u2026 on the card (marked red)";
  }
  note.classList.toggle("warn", !!cutLines);
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
  const type = studio.type, rows = studio.lists[type].rows;
  const i = Number(x.dataset.i);
  const [gone] = rows.splice(i, 1);
  renderListEditor();
  const next = $("rows").querySelector('.row-x[data-i="' + Math.min(i, rows.length - 1) + '"]');
  (next || $("row-add")).focus();
  touched();
  const said = LIST_UI[type].fields.map((f) => gone[f.key]).filter(Boolean).join(" ");
  toast("Removed line " + (i + 1) + (said ? ": " + said.slice(0, 40) : "") + ".", {
    action: () => {
      studio.lists[type].rows.splice(i, 0, gone);
      if (studio.type !== type) selectType(type); else renderListEditor();
      touched();
    },
  });
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
  const type = studio.type, before = clone(studio.lists[type].rows);
  studio.lists[type].rows = rows.slice(0, R.MAX_ROWS);
  closePaste();
  studio.pasteCut = cut;
  renderListEditor();
  touched();
  const kept = studio.lists[type].rows.length;
  toast("Pasted " + kept + (kept === 1 ? " line" : " lines") + ", replacing the " + before.length + " you had.", {
    action: () => {
      studio.lists[type].rows = before;
      studio.pasteCut = false;
      if (studio.type !== type) selectType(type); else renderListEditor();
      touched();
    },
  });
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

/* ----- any image (her pins, a moodboard, your own designs): file input, drag/drop, paste ----- */
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
drop.addEventListener("drop", (e) => {
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length) { addFiles(files); return; }
  // An image dragged out of another tab can arrive as just its address. We
  // don't fetch it (the CSP allows no outside hosts, and it isn't ours to
  // pull), so say how to bring the picture itself.
  if (Array.from(e.dataTransfer.types || []).some((t) => t === "text/uri-list" || t === "text/html")) {
    setStatus("err", "✗ That came in as a link, not a picture. Right-click the image, choose Copy image and press " +
      PASTE_KEY + " here, or save it and add the file.");
  }
});

// Copy image on Pinterest (or anywhere), then paste here. Lands in the pose
// card when that's waiting for a photo, otherwise in Any image.
document.querySelectorAll(".paste-key").forEach((k) => { k.textContent = PASTE_KEY; });
document.addEventListener("paste", (e) => {
  const dt = e.clipboardData;
  if (!dt) return;
  // Text pasted into a field stays text, even when the clipboard carries a picture too.
  if (e.target.closest && e.target.closest("input, textarea") && Array.from(dt.types || []).includes("text/plain")) return;
  let files = Array.from(dt.files || []);
  if (!files.length) {
    files = Array.from(dt.items || []).filter((it) => it.kind === "file").map((it) => it.getAsFile()).filter(Boolean);
  }
  files = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  if (!files.length) return;
  e.preventDefault();
  track("Pasted image", { type: studio.type, n: files.length });
  if (studio.type === "pose" && studio.pose.mode === "photo") { setPosePhoto(files[0]); return; }
  if (studio.type !== "upload") selectType("upload", true);
  addFiles(files);
  const st = $("studio");
  if (st && st.getBoundingClientRect().bottom < 0) st.scrollIntoView({ behavior: "smooth", block: "start" });
});

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
  if (state.items.length > 1 && !confirm("Remove all " + state.items.length + " images?")) return;
  state.items.forEach((it) => { try { URL.revokeObjectURL(it.url); } catch (_) {} });
  state.items = [];
  state.selected = 0;
  renderFilmstrip();
  touched();
});

document.querySelectorAll('input[name="orient"]').forEach((r) => r.addEventListener("change", touched));
const orientValue = () => document.querySelector('input[name="orient"]:checked').value;
// Which way the converter frames an image of this size (encoder._resolve_orientation).
const portraitFor = (w, h) => orientValue() === "portrait" || (orientValue() === "auto" && h > w);

// The optional label on every image: "Emma's board · 3/12".
$("board-label").addEventListener("input", touched);
function tagText(i, n) {
  const label = ($("board-label").value || "").trim();
  return label ? label + " · " + (i + 1) + "/" + n : "";
}

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
  const portrait = ready && portraitFor(img.naturalWidth, img.naturalHeight);
  const w = portrait ? 1280 : 1920, h = portrait ? 1920 : 1280;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = ready ? "#ffffff" : "#f2f2f4";
  ctx.fillRect(0, 0, w, h);
  if (ready) {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = Math.round(img.naturalWidth * s), dh = Math.round(img.naturalHeight * s);
    const x = Math.round((w - dw) / 2), y = Math.round((h - dh) / 2);
    ctx.drawImage(img, x, y, dw, dh);
    R.tag(ctx, tagText(state.selected, state.items.length), { x, y, w: dw, h: dh }, 1);
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
  // For your own designs the card shown is the image picked in the filmstrip.
  studio.page = Math.min(studio.type === "upload" ? state.selected : studio.page, Math.max(0, n - 1));
  let portrait;
  if (studio.type === "upload") {
    portrait = drawUpload(previewCanvas);
  } else {
    portrait = R.isPortrait(studio.type);
    R.draw(previewCanvas, studio.type, cardData(), studio.page);
  }
  $("cam-body").classList.toggle("portrait", portrait);
  previewCanvas.dispatchEvent(new Event("cam:drawn"));
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
  markCutLines();
}

// Lines too long for the card even at the smallest type end in "…" on the
// camera: mark them in the editor so it's a choice, not a surprise.
function markCutLines() {
  if (!LIST_TYPES.includes(studio.type)) return;
  const cut = R.cutTexts(studio.type, cardData());
  let lines = 0;
  $("rows").querySelectorAll(".row").forEach((rowEl) => {
    let hit = false;
    rowEl.querySelectorAll(".row-in").forEach((input) => {
      const long = cut.has(R.clean(input.value));
      input.classList.toggle("cut", long);
      if (long) { input.title = "Too long for the card: it ends in \u2026"; hit = true; }
      else input.removeAttribute("title");
    });
    if (hit) lines++;
  });
  const head = $("list-label");
  head.classList.toggle("cut", cut.has(R.clean(head.value)));
  updateRowsNote(lines);
}

function flipPage(step) {
  const n = pagesNow();
  if (n <= 1) return;
  if (studio.type === "upload") {
    // Your own designs: the pager walks through the uploaded images.
    state.selected = (state.selected + step + n) % n;
    renderFilmstrip();
  } else {
    studio.page = (studio.page + step + n) % n;
  }
  schedulePreview();
}
$("pg-prev").addEventListener("click", () => flipPage(-1));
$("pg-next").addEventListener("click", () => flipPage(1));
$("mini").addEventListener("click", () => flipPage(1));
$("mini").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipPage(1); }
});

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
const CAMERA_KEY = "pic_camera";
function setVendor(vendor) {
  state.vendor = vendor;
  camButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vendor === vendor)));
  $("cameras").classList.remove("attention");
  $("cam-q").textContent = "Your camera";
  // Almost nobody switches brands between weddings: keep it for next time.
  try { localStorage.setItem(CAMERA_KEY, vendor); } catch (_) {}
  if ($("status").textContent.startsWith("✗ Pick your camera")) setStatus("", "");
  refresh();
}
camButtons.forEach((btn) => {
  btn.addEventListener("click", () => setVendor(btn.dataset.vendor));
});

/* ---------- the button and its hint ---------- */
function emptyHint() {
  if (studio.type === "pose") {
    return studio.pose.mode === "photo" ? "Add your reference photo to make this card." : "Loading the pose, one moment…";
  }
  if (studio.type === "found") return "Add your name, phone or email.";
  if (studio.type === "upload") return "Add an image: the bride's Pinterest pins, a Canva export, a screenshot or a photo (or paste one with " + PASTE_KEY + ").";
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
async function downscale(file, tag) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";          // flatten any transparency to white (JPEG has no alpha)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  if (tag) {
    // Sized for the card this image becomes, so the label reads the same on
    // the camera whatever the image's own size.
    const fw = portraitFor(w, h) ? 1280 : 1920, fh = portraitFor(w, h) ? 1920 : 1280;
    R.tag(ctx, tag, { x: 0, y: 0, w, h }, Math.max(w / fw, h / fh));
  }
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

// Split files, in order, into requests whose upload and expected ZIP both stay
// under the budgets above.
function chunkFiles(files, vendor) {
  const [ratio, ceiling] = CARD_ESTIMATE[vendor] || CARD_ESTIMATE.canon;
  const chunks = [];
  let cur = [], up = 0, down = 0;
  for (const f of files) {
    const out = Math.min(f.blob.size * ratio, ceiling);
    if (cur.length && (up + f.blob.size > REQUEST_BUDGET || down + out > RESPONSE_BUDGET)) {
      chunks.push(cur); cur = []; up = 0; down = 0;
    }
    cur.push(f);
    up += f.blob.size;
    down += out;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function convert() {
  const go = $("go");
  go.disabled = true;
  go.setAttribute("aria-busy", "true");
  go.textContent = "Making your card…";
  setStatus("", "Making your cards…");
  const made = [];   // [first, last] file name of every request the server converted

  // After a failure midway, say which cards already exist (and are paid for).
  const partial = () => {
    if (!made.length) return "";
    const first = made[0][0], last = made[made.length - 1][1];
    return " Cards " + first + " to " + last + " were already made" +
      (window.__paywall ? " and are under Your previous cards." : ".");
  };

  try {
    let files, orientation;
    if (studio.type === "upload") {
      orientation = orientValue();
      files = [];
      let i = 0;
      for (const it of state.items) {
        files.push({ blob: await downscale(it.file, tagText(i, state.items.length)), name: `design-${++i}.jpg` });
      }
    } else {
      orientation = "auto";
      files = await R.exportCards(studio.type, cardData());
    }
    if (files.some((f) => f.blob.size > MAX_FILE_BYTES)) {
      setStatus("err", "✗ One image is too big to send. Export it smaller (under 4 MB) and try again.");
      return;  // the finally block re-enables the button
    }
    const chunks = chunkFiles(files, state.vendor);
    if (chunks.length > 1 && window.__paywall) {
      // Several requests are charged one by one: check the whole batch fits
      // first, so it never stops halfway with only some cards paid for.
      const a = state.account;
      if (!a) {
        setStatus("err", "✗ Still loading your account. Try again in a moment.");
        renderAccount();
        return;
      }
      const n = files.length;
      if (!(a.plan === "pro" || (a.credits || 0) >= n || (a.free_left || 0) >= n)) {
        track("Hit free limit", { type: studio.type });
        setStatus("err", "✗ " + limitRefusal(a, n));
        showUpsell();
        return;
      }
    }

    const zips = [];
    let resp = null, pid = null;
    for (let c = 0; c < chunks.length; c++) {
      const fd = new FormData();
      fd.append("vendor", state.vendor);
      fd.append("orientation", orientation);
      if (pid) fd.append("project_id", pid);        // later requests: same project, numbering continues
      else if (!appendProject(fd)) return;
      chunks[c].forEach((f) => fd.append("files", f.blob, f.name));
      setStatus("", "Converting for your camera…" + (chunks.length > 1 ? ` (${c + 1} of ${chunks.length})` : ""));

      try {
        resp = await fetch(API, { method: "POST", body: fd });
      } catch (_) {
        throw retryable(0);
      }

      if (resp.status === 402) {
        let j = {}; try { j = await resp.json(); } catch (_) {}
        track("Hit free limit", { type: studio.type });
        const known = j.free_left != null || j.credits != null;
        const msg = known
          ? limitRefusal({ free_left: j.free_left, credits: j.credits, free_limit: state.account && state.account.free_limit }, files.length)
          : (j.error || "You've used your free cards. Get Pro once for unlimited cards.");
        setStatus("err", "✗ " + msg + partial());
        showUpsell();
        renderAccount();
        return;
      }
      if (resp.status === 401) {
        let j = {}; try { j = await resp.json(); } catch (_) {}
        setStatus("err", "✗ " + (j.error || "Your sign-in has expired. Sign in again; your card is still here.") + partial());
        if (j.need_signin) openLogin();
        else if (isSignedIn()) await PoseAuth.signOut();   // the session ended on the server
        return;
      }
      if (!resp.ok) {
        let msg = "";
        try { msg = (await resp.json()).error || ""; } catch (_) {}
        throw retryable(resp.status, msg);
      }

      const first = resp.headers.get("X-First-File"), last = resp.headers.get("X-Last-File");
      if (first && last) made.push([first, last]);
      pid = resp.headers.get("X-Project-Id") || pid;
      if (!window.__paywall && last) {
        // Open flow: remember where this batch ended so the next one continues.
        const m = last.match(/(\d{4})\.JPG$/i);
        if (m) try { localStorage.setItem("pic_start_" + state.vendor, m[1]); } catch (_) {}
      }
      if (chunks.length === 1) await saveZip(resp, true);
      else zips.push(await zipBytes(resp));
    }
    if (zips.length) downloadBlob(mergeZips(zips));

    const wm = resp.headers.get("X-Watermarked") === "1";
    const first = made.length ? made[0][0] : null, last = made.length ? made[made.length - 1][1] : null;
    const range = first && last
      ? (first === last ? ` Your card is ${first}.` : ` Your cards are ${first} to ${last}.`)
      : "";
    const anon = resp.headers.get("X-Tier") === "anon";
    track("Card made", { type: studio.type, camera: state.vendor, tier: resp.headers.get("X-Tier") || "unknown",
                         src: state.fromDemo ? "demo" : "studio" });
    setStatus("ok", "✓ Done! Your shoot-cards.zip is downloading." + range +
      (wm ? "  (free, watermarked)" : "") + " ");
    // If the browser held the download back, the same file is one click away.
    if (state.lastZip) {
      const again = document.createElement("button");
      again.type = "button";
      again.className = "link-btn status-act";
      again.textContent = "Download again";
      again.addEventListener("click", () => clickDownload(state.lastZip));
      $("status").append(again);
    }
    if (anon) showSignupNudge();
    // Keep working in the project we just converted into (it may be brand new).
    if (pid) state.activeProject = pid;
    showInstructions();
    renderAccount();
    loadHistory();
  } catch (err) {
    setStatus("err", "✗ " + err.message + partial());
    if (err.retry) addRecovery();
  } finally {
    go.disabled = false;
    go.removeAttribute("aria-busy");
    refresh();
  }
}

function showInstructions() {
  $("instr-text").textContent = INSTRUCTIONS[state.vendor] || "";
  $("instr-demo").href = "/demo?camera=" + state.vendor + "&ref=instructions#copy";
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
    'or get Pro once for unlimited cards with no watermark.</p>' +
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
      '<p class="muted upsell-text">Pay once for unlimited cards with no watermark. No subscription.</p>' +
      '<div class="buy-row">' +
        '<button class="go" type="button" data-kind="pro">' + proLabel() + '</button>' +
      '</div>';
    el.querySelector("[data-kind]").addEventListener("click", (e) => startCheckout("pro", e.currentTarget));
  } else {
    el.innerHTML = '<p class="muted upsell-text">You\'ve used your free cards. Paid plans are launching soon. Thanks for trying it!</p>';
  }
}

// Picked a plan while signed out: remember it, so after the email link the
// checkout opens by itself instead of leaving them to find the button again.
const PENDING_BUY = "pic_pending_checkout";
const PLAN_KINDS = ["pro"];

async function startCheckout(kind, btn) {
  if (!isSignedIn()) {
    try { localStorage.setItem(PENDING_BUY, JSON.stringify({ kind, at: Date.now() })); } catch (_) {}
    openLogin("checkout");
    return;
  }
  const label = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "Opening checkout…"; }
  track("Checkout started", { plan: kind });
  try {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    let j = {}; try { j = await r.json(); } catch (_) {}
    if (!r.ok || !j.url) throw new Error(j.error || "");
    window.location.href = j.url;
  } catch (_) {
    toast("Checkout didn't open, so nothing was charged. Try again in a moment.",
          { kind: "err", support: "checkout didn't open", ms: 12000 });
    if (btn) { btn.disabled = false; btn.textContent = label; }
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

/* ---------- pricing section ---------- */
function currencySym(o) {
  return o.currency === "EUR" ? "€" : (o.currency || "") + " ";
}

function fmtMoney(o) {
  if (!o || o.amount == null) return null;
  const n = Number(o.amount);
  return currencySym(o) + (Number.isInteger(n) ? n : n.toFixed(2));
}

// "Get Pro · €29.99" once the price has loaded, "Get Pro" until then.
function proLabel() {
  const amt = fmtMoney(state.proPrice);
  return amt ? "Get Pro · " + amt : "Get Pro";
}

async function renderPricing() {
  const grid = $("price-grid");
  if (!grid) return;

  let data = { prices: {}, free_limit: 3 };
  try { data = await (await fetch("/api/prices")).json(); } catch (_) {}
  const pro = (data.prices || {}).pro;
  const freeN = data.free_limit ?? 3;
  state.freeLimit = freeN;
  state.proPrice = pro || null;

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
              "Sony, Canon &amp; Nikon", "From our wedding studio, In Principio"],
      cta: '<a class="btn btn-ghost" href="' + STORE_URL + '" target="_blank" rel="noopener">See the pose pack</a>',
    }) +
    card({
      featured: true,
      badge: "Pay once",
      name: "Pro",
      amount: fmtMoney(pro) || "",
      per: pro ? " once" : "",
      note: "No subscription. Nothing to renew.",
      feats: ["Unlimited cards, every type", "No watermark",
              "A project per wedding", "The bride's pins &amp; your designs, converted",
              "New cameras as we add them"],
      cta: pro
        ? '<button class="btn btn-primary" type="button" data-buy="pro">' + proLabel() + '</button>'
        : '<button class="btn btn-primary" type="button" disabled>Coming soon</button>',
    });

  grid.querySelectorAll("[data-buy]").forEach((b) =>
    b.addEventListener("click", () => startCheckout(b.dataset.buy, b)));
  // The account bar can load first: give its button the price too.
  if (state.account) renderUpgradeNudge(state.account);
}

/* ---------- auth / account ---------- */
// The phone menu's copy of Sign out (CSS shows it on phones only).
function setMenuAccount(signedIn) {
  const ns = $("nav-signout");
  if (ns) { ns.hidden = !signedIn; ns.onclick = async () => { await PoseAuth.signOut(); }; }
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
  if (!isSignedIn()) {
    el.innerHTML = '<button class="link-btn" type="button" id="signin-btn">Sign in</button>';
    $("signin-btn").onclick = openLogin;
    if (nudge) nudge.hidden = true;
    setMenuAccount(false);
    return;
  }
  el.innerHTML = '<span class="acct-info" id="acct-info">…</span>' +
    '<button class="link-btn" type="button" id="signout-btn">Sign out</button>';
  $("signout-btn").onclick = async () => { await PoseAuth.signOut(); };
  setMenuAccount(true);
  try {
    const r = await fetch(ME, { cache: "no-store" });
    const j = await r.json();
    if (j.signed_in === false) { await PoseAuth.signOut(); return; }   // session ended
    const who = j.email || (PoseAuth.user() && PoseAuth.user().email) || "signed in";
    let badge;
    state.account = j;
    // Pro has nothing left to buy: .is-pro hides pricing and the nudge.
    setPlanClasses(j.plan);
    renderUpgradeNudge(j);
    if (j.plan === "pro") badge = "Pro";
    else if ((j.credits || 0) > 0) badge = cardsWord(j.credits).replace("card", "paid card");
    else { const x = allowance(j); badge = x.used + " of " + x.limit + " free used"; }
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

  const x = allowance(j);
  const spent = !x.paid && x.left <= 0;

  if (x.paid > 0) {
    text.innerHTML = "<strong>" + cardsWord(x.paid).replace("card", "paid card") + "</strong> left, no watermark. " +
      "Get Pro once for unlimited.";
  } else if (spent) {
    text.innerHTML = "<strong>" + x.used + " of " + x.limit + " free cards used.</strong> Free cards don't renew. " +
      "Get Pro once for unlimited cards with no watermark.";
  } else {
    text.innerHTML = "<strong>" + x.used + " of " + x.limit + " free cards used</strong>, watermarked. " +
      "Get Pro once for unlimited cards with no watermark.";
  }
  box.classList.toggle("spent", spent);

  // Without Stripe there is no checkout to start, so point at the plans instead.
  cta.textContent = window.__stripe ? proLabel() : "See plans";
  cta.onclick = window.__stripe
    ? () => startCheckout("pro", cta)
    : () => document.getElementById("pricing").scrollIntoView({ behavior: "smooth" });
  box.hidden = false;
}

/* ---------- projects + history ---------- */
const MAX_HISTORY_THUMBS = 6;

function renderProjectPicker() {
  const field = $("project-field"), sel = $("project-select");
  if (!field) return;
  const signedIn = !!window.__paywall && isSignedIn();
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
  if (!window.__paywall || !isSignedIn()) {
    state.projects = [];
    renderProjectPicker();
    if (section) section.hidden = true;
    if ($("nav-projects")) $("nav-projects").hidden = true;
    return;
  }
  try {
    const r = await fetch("/api/history");
    if (!r.ok) throw new Error("history unavailable");
    const j = await r.json();
    state.projects = j.projects || [];
    renderProjectPicker();
    renderHistory(j.batches || [], state.projects);
  } catch (_) {
    renderProjectPicker();
    if (!section) return;
    // Signed in but the list didn't come: say so, the cards themselves are safe.
    section.hidden = false;
    $("proj-tools").hidden = true;
    $("proj-more").hidden = true;
    const list = $("history-list");
    list.innerHTML = "";
    const p = document.createElement("p");
    p.className = "proj-none";
    p.textContent = "Couldn't load your projects just now. Your cards are saved on your account. ";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "link-btn";
    again.textContent = "Try again";
    again.addEventListener("click", () => { p.textContent = "Loading your projects…"; loadHistory(); });
    p.appendChild(again);
    list.appendChild(p);
  }
}

// Your projects: one compact row per project, newest activity first. A row's
// batches open on demand; five rows show, the rest behind "Show all", and a
// search box appears once there are more than five.
const PROJECTS_SHOWN = 5;
const hist = { groups: [], open: new Set(), all: false, query: "" };

const plural = (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s"));
// "kreso" finds "Krešo": case and accents don't matter when searching.
const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function renderHistory(batches, projects) {
  const section = $("history");
  // The nav link only makes sense once there is a section to jump to.
  if ($("nav-projects")) $("nav-projects").hidden = !batches.length;
  if (!batches.length) { section.hidden = true; return; }

  // Group batches under their project. They arrive newest first, so groups come
  // out ordered by latest activity. Batches from before projects existed (or
  // whose project was deleted) share an "Earlier cards" group.
  const names = {};
  (projects || []).forEach((p) => { names[p.id] = p.name; });
  const byId = new Map();
  hist.groups = [];
  batches.forEach((b) => {
    const key = b.project_id || "_none";
    let g = byId.get(key);
    if (!g) {
      g = { key, id: b.project_id || null, name: names[b.project_id] || "Earlier cards", batches: [], cards: 0 };
      byId.set(key, g);
      hist.groups.push(g);
    }
    g.batches.push(b);
    g.cards += b.cards || 0;
  });
  section.hidden = false;
  paintHistory();
}

function paintHistory() {
  const list = $("history-list"), more = $("proj-more");
  const total = hist.groups.length;
  $("proj-tools").hidden = total <= PROJECTS_SHOWN;
  $("proj-count").textContent = plural(total, "project");
  const q = fold(hist.query.trim());
  const matches = q ? hist.groups.filter((g) => fold(g.name).includes(q)) : hist.groups;
  const shown = q || hist.all ? matches : matches.slice(0, PROJECTS_SHOWN);
  list.innerHTML = "";
  shown.forEach((g) => list.appendChild(projectRow(g)));
  if (!shown.length) {
    const none = document.createElement("p");
    none.className = "proj-none";
    none.textContent = "No project matches “" + hist.query.trim() + "”.";
    list.appendChild(none);
  }
  more.hidden = !!q || total <= PROJECTS_SHOWN;
  more.textContent = hist.all ? "Show fewer" : "Show all " + plural(total, "project");
  more.setAttribute("aria-expanded", String(hist.all));
}

function projectRow(g) {
  const row = document.createElement("div");
  row.className = "proj";
  const isOpen = hist.open.has(g.key);
  const latest = g.batches[0];

  const head = document.createElement("div");
  head.className = "proj-head";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "proj-toggle";
  const panelId = "proj-b-" + String(g.key).replace(/[^\w-]/g, "");
  toggle.setAttribute("aria-controls", panelId);
  toggle.setAttribute("aria-expanded", String(isOpen));

  const thumb = document.createElement("span");
  thumb.className = "proj-thumb";
  const first = (latest.files || []).find((f) => f.url);
  if (first) {
    const img = document.createElement("img");
    img.src = first.url;
    img.alt = "";
    img.loading = "lazy";
    thumb.appendChild(img);
  }
  const text = document.createElement("span");
  text.className = "proj-text";
  const name = document.createElement("span");
  name.className = "proj-name";
  name.textContent = g.name;
  const meta = document.createElement("span");
  meta.className = "proj-meta";
  meta.textContent = [plural(g.cards, "card"), plural(g.batches.length, "batch", "batches"),
    latest.created_at ? shortDate(latest.created_at) : ""].filter(Boolean).join(" · ");
  text.append(name, meta);
  const chev = document.createElement("span");
  chev.className = "proj-chev";
  chev.setAttribute("aria-hidden", "true");
  toggle.append(thumb, text, chev);
  head.appendChild(toggle);

  if (g.id) {
    const actions = document.createElement("div");
    actions.className = "proj-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-ghost btn-sm";
    add.textContent = "Add cards";
    add.title = "Make more cards in this project";
    add.addEventListener("click", () => useProject(g.id));
    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "btn btn-primary btn-sm";
    dl.textContent = "Download";
    dl.title = "All " + plural(g.cards, "card") + " in one ZIP";
    dl.addEventListener("click", () =>
      downloadZip("/api/history?download_project=" + encodeURIComponent(g.id), dl));
    actions.append(add, dl);
    head.appendChild(actions);
  }

  // Batches (and their thumbnails) are only built when the row is opened.
  const panel = document.createElement("div");
  panel.className = "proj-batches";
  panel.id = panelId;
  panel.hidden = !isOpen;
  const fill = () => { if (!panel.childElementCount) g.batches.forEach((b) => panel.appendChild(batchRow(b))); };
  if (isOpen) fill();
  row.classList.toggle("open", isOpen);
  toggle.addEventListener("click", () => {
    const open = panel.hidden;
    if (open) fill();
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    row.classList.toggle("open", open);
    if (open) hist.open.add(g.key); else hist.open.delete(g.key);
  });
  row.append(head, panel);
  return row;
}

function batchRow(b) {
  const item = document.createElement("div");
  item.className = "batch";
  const files = b.files || [];
  const range = files.length
    ? files[0].name.replace(/\.JPG$/i, "") + (files.length > 1 ? "–" + files[files.length - 1].name.replace(/\.JPG$/i, "") : "")
    : "";
  const info = document.createElement("div");
  info.className = "batch-info";
  const title = document.createElement("span");
  title.className = "batch-title";
  title.textContent = [VENDOR_LABEL[b.vendor] || b.vendor || "", plural(b.cards || 0, "card")].filter(Boolean).join(" · ") +
    (b.watermarked ? " · watermarked" : "");
  const sub = document.createElement("span");
  sub.className = "batch-sub";
  sub.textContent = [range, b.created_at ? shortDate(b.created_at) : ""].filter(Boolean).join(" · ");
  info.append(title, sub);

  const strip = document.createElement("div");
  strip.className = "batch-thumbs";
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
    more.className = "batch-more";
    more.textContent = "+" + (files.length - MAX_HISTORY_THUMBS);
    strip.appendChild(more);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "link-btn batch-dl";
  btn.textContent = "Download";
  btn.title = "This batch as a ZIP";
  btn.addEventListener("click", () =>
    downloadZip("/api/history?download=" + encodeURIComponent(b.id), btn));
  item.append(info, strip, btn);
  return item;
}

// "Add cards": carry on with that project in the studio.
function useProject(id) {
  const sel = $("project-select"), field = $("project-field");
  if (sel && Array.from(sel.options).some((o) => o.value === id)) {
    sel.value = id;
    state.activeProject = id;
    syncProjectRow();
  }
  $("studio").scrollIntoView({ behavior: "smooth", block: "start" });
  if (field) {
    field.classList.remove("flash");
    void field.offsetWidth;          // restart the highlight
    field.classList.add("flash");
  }
}

(function projectsControls() {
  const search = $("proj-search"), more = $("proj-more");
  if (search) search.addEventListener("input", () => { hist.query = search.value; paintHistory(); });
  if (more) more.addEventListener("click", () => { hist.all = !hist.all; paintHistory(); });
})();

// A ZIP comes back either inline, or (past Vercel's 4.5 MB response cap) as
// JSON {zip_url}: a short-lived signed Storage link served as an attachment.
async function zipBytes(resp) {
  if ((resp.headers.get("Content-Type") || "").includes("application/json")) {
    const j = await resp.json();
    if (!j.zip_url) throw new Error(j.error || "Download failed. Please try again.");
    const r = await fetch(j.zip_url);
    if (!r.ok) throw new Error("Download failed. Please try again.");
    return await r.arrayBuffer();
  }
  return await resp.arrayBuffer();
}

function clickDownload(z) {
  const a = document.createElement("a");
  a.href = z.href;
  if (z.download) a.download = z.download;
  document.body.appendChild(a); a.click(); a.remove();
}
// The last studio ZIP, kept for "Download again" (a signed link lasts an hour).
function rememberZip(z) {
  if (state.lastZip && state.lastZip.blob) { try { URL.revokeObjectURL(state.lastZip.href); } catch (_) {} }
  state.lastZip = z;
}

function downloadBlob(blob) {
  const z = { href: URL.createObjectURL(blob), download: "shoot-cards.zip", blob: true };
  rememberZip(z);
  clickDownload(z);
}

// Merge the server's ZIPs (Python zipfile: no ZIP64, sizes in the local
// headers) into one. Local records are copied byte for byte; the central
// directory is rebuilt with new offsets. A name already taken (README.txt) is
// skipped.
function mergeZips(buffers) {
  const bad = () => new Error("A download came back damaged. Please try again.");
  const parts = [], central = [], seen = new Set(), names = new TextDecoder();
  let offset = 0;
  for (const buf of buffers) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = u8.length - 22;
    while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
    if (eocd < 0) throw bad();
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw bad();
      const nameLen = dv.getUint16(p + 28, true);
      const cdLen = 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
      const name = names.decode(u8.subarray(p + 46, p + 46 + nameLen));
      if (!seen.has(name)) {
        seen.add(name);
        const local = dv.getUint32(p + 42, true);
        if (dv.getUint32(local, true) !== 0x04034b50) throw bad();
        let len = 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true) + dv.getUint32(p + 20, true);
        if (dv.getUint16(local + 6, true) & 8) {   // data descriptor follows the data
          len += dv.getUint32(local + len, true) === 0x08074b50 ? 16 : 12;
        }
        parts.push(u8.subarray(local, local + len));
        const cd = u8.slice(p, p + cdLen);
        new DataView(cd.buffer).setUint32(42, offset, true);
        central.push(cd);
        offset += len;
      }
      p += cdLen;
    }
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

async function saveZip(resp, keep) {
  let z;
  if ((resp.headers.get("Content-Type") || "").includes("application/json")) {
    const j = await resp.json();
    if (!j.zip_url) throw new Error(j.error || "Download failed. Please try again.");
    z = { href: j.zip_url };
  } else {
    z = { href: URL.createObjectURL(await resp.blob()), download: "shoot-cards.zip", blob: true };
  }
  if (keep) rememberZip(z);
  clickDownload(z);
}

async function downloadZip(url, btn) {
  if (!isSignedIn()) { openLogin(); return; }
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing…";
  try {
    const r = await fetch(url);
    if (!r.ok) {
      let msg = "Could not rebuild this download.";
      try { msg = (await r.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    await saveZip(r);
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
  // A fresh dialog each time: no "Send again" or old message from last time.
  $("login-send").textContent = "Send magic link";
  $("login-send").disabled = false;
  $("login-status").className = "status";
  $("login-status").textContent = "";
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
// CAPTCHA (Cloudflare Turnstile), only once the server asks for it: after a
// few sign-in attempts from this address or for this email.
const captcha = { id: null, token: null };
function loadTurnstile() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    sc.async = true;
    sc.onload = resolve;
    sc.onerror = reject;
    document.head.appendChild(sc);
  });
}
async function showCaptcha(siteKey) {
  const box = $("login-captcha");
  box.hidden = false;
  captcha.token = null;
  await loadTurnstile();
  if (captcha.id != null) { window.turnstile.reset(captcha.id); return; }
  captcha.id = window.turnstile.render(box, {
    sitekey: siteKey,
    callback: (t) => { captcha.token = t; },
    "expired-callback": () => { captcha.token = null; },
  });
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("login-email").value.trim();
  const st = $("login-status"), send = $("login-send");
  if (!email) { st.className = "status err"; st.textContent = "Enter your email."; $("login-email").focus(); return; }
  send.disabled = true;
  send.textContent = "Sending…";
  st.className = "status"; st.textContent = "";
  const token = captcha.token;
  if (captcha.id != null) { captcha.token = null; try { window.turnstile.reset(captcha.id); } catch (_) {} }
  try {
    await PoseAuth.signIn(email, token);
    track("Sign-in link sent");
    st.className = "status ok";
    st.textContent = "✓ Link sent to " + email + ". Open it on this device and you're signed in. " +
      "Not there in a minute? Check spam, or send it again.";
    send.textContent = "Send again";
  } catch (err) {
    st.className = "status err";
    if (err.captcha) {
      st.textContent = "✗ " + err.message;
      showCaptcha(err.captcha).catch(() => {
        st.textContent = "✗ The human check didn't load. Refresh the page and try again.";
      });
    } else if (err.retryAfter) {
      st.textContent = "✗ " + err.message;
    } else {
      st.textContent = "✗ " + (err.message || "The link didn't send.") + " Check the address and try again.";
    }
    send.textContent = "Send magic link";
  } finally {
    send.disabled = false;
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

/* ---------- arriving from the demo (/demo) ---------- */
// The demo's last step links here as /?from=demo&make=<type>&camera=<vendor>#studio
// and leaves the card it built in localStorage (never in the URL, which the
// visitor stats see). Open the studio on that card. It is clamped to one card,
// so the free card without an account still works (ANON_MAX_CARDS in api/convert.py).
const DEMO_HANDOFF = "pic_demo_handoff";
const DEMO_TYPES = ["timeline", "groups", "shotlist"];
const DEMO_VENDORS = ["sony", "canon", "nikon"];

function demoCard(type) {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(DEMO_HANDOFF) || "null"); } catch (_) {}
  try { localStorage.removeItem(DEMO_HANDOFF); } catch (_) {}
  if (!DEMO_TYPES.includes(type)) return null;
  if (!p || p.v !== 1 || p.type !== type || !(Date.now() - p.at < 30 * 60 * 1000)) return null;
  const text = (v, max) => Array.from(String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim())
    .slice(0, max).join("");
  const ui = LIST_UI[type];
  const rows = (Array.isArray(p.rows) ? p.rows : []).slice(0, R.PER_PAGE[type]).map((r) => {
    const row = {};
    ui.fields.forEach((f) => { row[f.key] = text(r && r[f.key], f.max); });
    return row;
  }).filter((row) => ui.fields.some((f) => row[f.key]));
  if (!rows.length) return null;
  return { [ui.headKey]: text(p.label, 40), rows };
}

function applyDemoHandoff() {
  const q = new URLSearchParams(location.search);
  if (q.get("from") !== "demo") return;
  const type = q.get("make"), vendor = q.get("camera");
  history.replaceState(null, "", location.pathname + location.hash);   // a reload shouldn't apply it again
  const card = demoCard(type);
  if (!DEMO_TYPES.includes(type)) return;
  if (card) studio.lists[type] = card;
  selectType(type);   // not quiet: the preview shows the card straight away
  if (DEMO_VENDORS.includes(vendor)) setVendor(vendor);
  setStatus("", "Your card from the demo is ready. Change anything you like, then make it.");
  state.fromDemo = true;
  track("Demo handoff", { type, camera: DEMO_VENDORS.includes(vendor) ? vendor : "none", rows: card ? card.rows.length : 0 });
}

/* ---------- draft: what you typed survives a reload or a trip to the FAQ ---------- */
// Lists, the if-found details, your pose notes and the board label are kept in
// this browser only; your own photos are not (they can be large).
const DRAFT_KEY = "pic_draft";
const FIELD_MAX = { found: { name: 60, phone: 30, email: 60, note: 60 },
                    pose: { title: 40, energy: 60, camera: 60, hack: 60, say: 160, source: 40 } };
let draftTimer = 0;

function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const p = studio.pose, pose = { mode: p.mode, sample: p.sample };
    Object.keys(FIELD_MAX.pose).forEach((k) => { pose[k] = p[k]; });
    const d = { v: 1, at: Date.now(), type: studio.type, lists: studio.lists, found: studio.found,
                pose, board: $("board-label").value || "" };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (_) {}
  }, 400);
}

const sameAs = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SAMPLE_KEYS = Array.from(document.querySelectorAll("#pose-samples .pz[data-sample]")).map((b) => b.dataset.sample);

function setPoseSample(key) {
  studio.pose.sample = key;
  document.querySelectorAll("#pose-samples .pz[data-sample]").forEach((x) =>
    x.setAttribute("aria-pressed", String(x.dataset.sample === key)));
}

function restoreDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (_) {}
  if (!d || d.v !== 1 || typeof d !== "object") return false;
  const text = (v, max) => Array.from(String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ")).slice(0, max).join("");
  let mine = false;

  const lists = {};
  LIST_TYPES.forEach((t) => {
    const src = d.lists && d.lists[t], ui = LIST_UI[t];
    if (!src || !Array.isArray(src.rows)) { lists[t] = studio.lists[t]; return; }
    const rows = src.rows.slice(0, R.MAX_ROWS).map((r) => {
      const row = {};
      ui.fields.forEach((f) => { row[f.key] = text(r && r[f.key], f.max); });
      return row;
    });
    lists[t] = { [ui.headKey]: text(src[ui.headKey], 40), rows };
    if (!sameAs(lists[t], DEFAULTS[t])) mine = true;
  });
  const found = {};
  Object.keys(FIELD_MAX.found).forEach((k) => { found[k] = text(d.found && d.found[k], FIELD_MAX.found[k]); });
  if (!sameAs(found, DEFAULTS.found)) mine = true;
  const pose = {};
  Object.keys(FIELD_MAX.pose).forEach((k) => {
    pose[k] = text(d.pose && d.pose[k], FIELD_MAX.pose[k]);
    if (pose[k]) mine = true;
  });
  const board = text(d.board, 30);
  if (board) mine = true;
  // Only bring back what you actually changed; an untouched example isn't a draft.
  if (!mine) return false;

  studio.lists = lists;
  studio.found = found;
  Object.assign(studio.pose, pose);
  studio.pose.mode = d.pose && d.pose.mode === "photo" ? "photo" : "sample";
  if (d.pose && SAMPLE_KEYS.includes(d.pose.sample)) setPoseSample(d.pose.sample);
  document.querySelectorAll("[data-pose]").forEach((el) => { el.value = studio.pose[el.dataset.pose] || ""; });
  $("board-label").value = board;
  // Your own images aren't kept, so an "Any image" draft reopens on the pose card.
  const type = TYPES.includes(d.type) && d.type !== "upload" ? d.type : "pose";
  selectType(type, true);
  touched();
  setStatus("", "Picked up where you left off. ");
  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.className = "link-btn status-act";
  fresh.textContent = "Start fresh";
  fresh.addEventListener("click", startFresh);
  $("status").append(fresh);
  return true;
}

function startFresh() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  LIST_TYPES.forEach((t) => { studio.lists[t] = clone(DEFAULTS[t]); });
  studio.found = clone(DEFAULTS.found);
  Object.keys(FIELD_MAX.pose).forEach((k) => { studio.pose[k] = ""; });
  studio.pose.mode = "sample";
  setPoseSample("pack-03");
  document.querySelectorAll("[data-pose]").forEach((el) => { el.value = ""; });
  $("board-label").value = "";
  setStatus("", "");
  selectType("pose", true);
  fillFound();
  touched();
}

function restoreCamera() {
  let v = null;
  try { v = localStorage.getItem(CAMERA_KEY); } catch (_) {}
  if (VENDOR_LABEL[v]) setVendor(v);
}

/* ---------- the nav button steps back while the studio is on screen ---------- */
// One red button at a time: when "Make my card" is in view, the nav CTA goes quiet.
(function quietNavCta() {
  const cta = document.querySelector(".nav-cta");
  if (!cta || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => cta.classList.toggle("quiet", e.isIntersecting), { threshold: 0.2 })
    .observe($("studio"));
})();

/* ---------- boot ---------- */
selectType("pose", true);
restoreCamera();
restoreDraft();
applyDemoHandoff();

(async function boot() {
  try {
    const j = await (await fetch(API, { method: "GET" })).json();
    window.__paywall = !!j.paywall;
    window.__stripe = !!j.stripe;
  } catch (_) {
    window.__paywall = false;
    window.__stripe = false;
  }
  if (window.__paywall && window.PoseAuth) {
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
  handleSigninReturn();
  handleCheckoutReturn();
})();

// Back from the email link: /api/auth set the session cookie (or said why not).
function handleSigninReturn() {
  const params = new URLSearchParams(location.search);
  const r = params.get("signin");
  if (!r) return;
  params.delete("signin");
  const q = params.toString();
  history.replaceState({}, "", location.pathname + (q ? "?" + q : ""));
  if (r === "ok") { track("Signed in"); return; }
  const why = {
    expired: "That sign-in link has expired or was already used. Send yourself a new one.",
    "other-browser": "Open the sign-in link in the same browser you asked for it from, or send a new one here.",
    limited: "Too many sign-in attempts from here. Wait a few minutes, then send a new link.",
  }[r] || "Sign-in didn't finish. Send yourself a new link.";
  toast(why, { kind: "err", ms: 12000 });
  openLogin();
}

function handleCheckoutReturn() {
  const c = new URLSearchParams(location.search).get("checkout");
  if (!c) return;
  if (c === "cancel") {
    toast("Checkout cancelled. Nothing was charged.");
  }
  if (c === "success") {
    track("Checkout completed");
    setStatus("ok", "✓ Payment received. Your account is updating. Thank you!");
    $("status").scrollIntoView({ behavior: "smooth", block: "center" });
    // Stripe tells our server a moment later (webhook): keep checking for up to
    // half a minute and say so once Pro shows up.
    let n = 0;
    const check = async () => {
      await renderAccount();
      const a = state.account;
      if (a && a.plan === "pro") {
        setStatus("ok", "✓ Pro is yours: unlimited cards, no watermark. Your receipt and invoice are on their way by email. Thank you!");
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
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    try { v.autoplay = false; v.pause(); } catch (_) {}
    return;
  }
  // Play only while it is on screen and the sign-in dialog isn't over it: a
  // looping video behind the dialog made Chromium (Brave) flash the page.
  const modal = $("login-modal");
  let onScreen = true;
  const sync = () => {
    if (studio.previewing) return;
    try {
      if (onScreen && (!modal || modal.hidden)) v.play().catch(() => {});
      else v.pause();
    } catch (_) {}
  };
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(v);
  if (modal) new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ["hidden"] });
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
