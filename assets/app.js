"use strict";

const API = "/api/convert";          // same-origin Vercel function
const MAX_EDGE = 2400;               // downscale before upload (Vercel ~4.5MB body limit)
const JPEG_Q = 0.9;

const state = { vendor: null, items: [], selected: 0 };

const $ = (id) => document.getElementById(id);
const camButtons = Array.from(document.querySelectorAll(".cam"));

const INSTRUCTIONS = {
  sony:
    "SONY — Recover Image Database je OBAVEZAN korak.\n" +
    "1. MENU → Setup → Media → Format (formatiraj karticu u aparatu).\n" +
    "2. Snimi jednu običnu fotku da nastane DCIM/100MSDCF/.\n" +
    "3. Kopiraj sve .JPG iz ZIP-a (DCIM/100MSDCF/) u istu mapu na kartici.\n" +
    "4. MENU → Setup → Media → Recover Image Database → potvrdi.\n" +
    "5. ▶ Playback — kartice su među fotkama.",
  canon:
    "CANON — plug & play, bez rebuilda baze.\n" +
    "1. MENU → (alat) → Format card.\n" +
    "2. Snimi jednu fotku da nastane DCIM/100CANON/.\n" +
    "3. Kopiraj .JPG iz ZIP-a u DCIM/100CANON/ na kartici.\n" +
    "4. Ubaci karticu → ▶ Playback. (INFO za detalje.)",
  nikon:
    "NIKON — kopiraj u mapu koju je TVOJ aparat napravio.\n" +
    "1. MENU → (alat) → Format memory card.\n" +
    "2. Snimi fotku — nastane DCIM/100NCZ_… (npr. 100NCZ_8).\n" +
    "3. Kopiraj DSC_*.JPG iz ZIP-a u TU mapu (ne u 100NCZ_X).\n" +
    "4. Ako ne vidiš: PLAYBACK MENU → Playback folder → All.\n" +
    "5. ▶ Playback.",
};

/* ---------- camera picker ---------- */
camButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.vendor = btn.dataset.vendor;
    camButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    refresh();
  });
});

/* ---------- file input + drag/drop ---------- */
const drop = $("drop");
const fileInput = $("file");
fileInput.addEventListener("change", (e) => addFiles(e.target.files));
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
);
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
);
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

function addFiles(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith("image/")) continue;
    state.items.push({ file, url: URL.createObjectURL(file) });
  }
  state.selected = 0;
  renderPreview();
  refresh();
}

/* ---------- preview ---------- */
function renderPreview() {
  const wrap = $("preview");
  if (!state.items.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  $("screen-img").src = state.items[state.selected].url;
  $("screen-count").textContent =
    state.items.length + (state.items.length === 1 ? " kartica" : " kartice/kartica");
  const strip = $("filmstrip");
  strip.innerHTML = "";
  state.items.forEach((it, i) => {
    const t = document.createElement("img");
    t.src = it.url;
    t.className = i === state.selected ? "sel" : "";
    t.addEventListener("click", () => { state.selected = i; renderPreview(); });
    strip.appendChild(t);
  });
}

/* ---------- enable/disable ---------- */
function refresh() {
  $("go").disabled = !(state.vendor && state.items.length);
}

/* ---------- downscale ---------- */
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
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return await new Promise((res) => canvas.toBlob(res, "image/jpeg", JPEG_Q));
}

/* ---------- generate ---------- */
const orientValue = () => document.querySelector('input[name="orient"]:checked').value;

$("go").addEventListener("click", async () => {
  if (!state.vendor || !state.items.length) return;
  const go = $("go"), status = $("status");
  go.disabled = true;
  status.className = "status";
  status.textContent = "Pripremam slike…";

  try {
    const fd = new FormData();
    fd.append("vendor", state.vendor);
    fd.append("orientation", orientValue());
    let i = 0;
    for (const it of state.items) {
      const blob = await downscale(it.file);
      fd.append("files", blob, `design-${++i}.jpg`);
    }
    status.textContent = "Konvertiram i pakiram…";

    const resp = await fetch(API, { method: "POST", body: fd });
    if (!resp.ok) {
      let msg = "Greška " + resp.status;
      try { msg = (await resp.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pose-cards.zip";
    document.body.appendChild(a); a.click(); a.remove();

    status.className = "status ok";
    status.textContent = "✓ Gotovo! Preuzimanje pose-cards.zip je krenulo.";
    showInstructions();
  } catch (err) {
    status.className = "status err";
    status.textContent = "✗ " + err.message;
  } finally {
    go.disabled = false;
  }
});

function showInstructions() {
  $("instr-text").textContent = INSTRUCTIONS[state.vendor] || "";
  $("instructions").hidden = false;
  $("instructions").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
