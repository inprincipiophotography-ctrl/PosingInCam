"use strict";

const API = "/api/convert";
const ME = "/api/me";
const MAX_EDGE = 2400;        // downscale before upload (Vercel ~4.5MB body limit)
const JPEG_Q = 0.9;
const STRIPE_READY = false;   // flipped on once Stripe checkout is wired

const state = { vendor: null, items: [], selected: 0 };
const $ = (id) => document.getElementById(id);
const camButtons = Array.from(document.querySelectorAll(".cam"));

const INSTRUCTIONS = {
  sony:
    "SONY — Recover Image Database is REQUIRED.\n" +
    "1. MENU → Setup → Media → Format the card (in camera).\n" +
    "2. Take one ordinary photo so DCIM/100MSDCF/ is created.\n" +
    "3. Copy all .JPG from the ZIP (DCIM/100MSDCF/) into that folder on the card.\n" +
    "4. MENU → Setup → Media → Recover Image Database → confirm.\n" +
    "5. ▶ Playback — the cards appear among your photos.",
  canon:
    "CANON — plug & play, no database rebuild.\n" +
    "1. MENU → (wrench) → Format card.\n" +
    "2. Take one photo so DCIM/100CANON/ is created.\n" +
    "3. Copy the .JPG from the ZIP into DCIM/100CANON/ on the card.\n" +
    "4. Insert the card → ▶ Playback. (Press INFO for details.)",
  nikon:
    "NIKON — copy into the folder YOUR camera created.\n" +
    "1. MENU → (wrench) → Format memory card.\n" +
    "2. Take a photo — DCIM/100NCZ_… is created (e.g. 100NCZ_8).\n" +
    "3. Copy the DSC_*.JPG from the ZIP into THAT folder (not 100NCZ_X).\n" +
    "4. If you don't see them: PLAYBACK MENU → Playback folder → All.\n" +
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
$("file").addEventListener("change", (e) => addFiles(e.target.files));
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
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
  $("screen-count").textContent = state.items.length + (state.items.length === 1 ? " card" : " cards");
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

function refresh() { $("go").disabled = !(state.vendor && state.items.length); }

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

const orientValue = () => document.querySelector('input[name="orient"]:checked').value;

/* ---------- generate ---------- */
$("go").addEventListener("click", async () => {
  if (!state.vendor || !state.items.length) return;
  if (window.__paywall && !PoseAuth.token()) { openLogin(); return; }

  const go = $("go"), status = $("status");
  $("upsell").hidden = true;
  go.disabled = true;
  status.className = "status";
  status.textContent = "Preparing images…";

  try {
    const fd = new FormData();
    fd.append("vendor", state.vendor);
    fd.append("orientation", orientValue());
    let i = 0;
    for (const it of state.items) {
      const blob = await downscale(it.file);
      fd.append("files", blob, `design-${++i}.jpg`);
    }
    status.textContent = "Converting and packaging…";

    const tok = window.__paywall ? PoseAuth.token() : null;
    const resp = await fetch(API, {
      method: "POST",
      body: fd,
      headers: tok ? { Authorization: "Bearer " + tok } : undefined,
    });

    if (resp.status === 402) {
      let j = {}; try { j = await resp.json(); } catch (_) {}
      status.className = "status err";
      status.textContent = "✗ " + (j.error || "Upgrade required.");
      showUpsell();
      renderAccount();
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
    a.download = "pose-cards.zip";
    document.body.appendChild(a); a.click(); a.remove();

    const wm = resp.headers.get("X-Watermarked") === "1";
    status.className = "status ok";
    status.textContent = "✓ Done! Your pose-cards.zip is downloading." +
      (wm ? "  (free preview — watermarked)" : "");
    showInstructions();
    renderAccount();
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

function showUpsell() {
  const el = $("upsell");
  el.hidden = false;
  el.innerHTML = STRIPE_READY
    ? '<button class="go" data-plan="pro">Go Pro</button>' +
      '<button class="link-btn" data-plan="pack20">Buy 20-pack</button>'
    : '<p class="muted">You\'ve used your free previews. Pro &amp; the 20-pack are launching soon — thanks for trying it!</p>';
}

/* ---------- auth / account ---------- */
async function renderAccount() {
  const el = $("account");
  if (!window.__paywall) { el.hidden = true; return; }
  el.hidden = false;
  const tok = PoseAuth.token();
  if (!tok) {
    el.innerHTML = '<button class="link-btn" id="signin-btn">Sign in</button>';
    $("signin-btn").onclick = openLogin;
    return;
  }
  el.innerHTML = '<span class="acct-info" id="acct-info">…</span>' +
    '<button class="link-btn" id="signout-btn">Sign out</button>';
  $("signout-btn").onclick = async () => { await PoseAuth.signOut(); };
  try {
    const r = await fetch(ME, { headers: { Authorization: "Bearer " + tok } });
    const j = await r.json();
    const who = j.email || (PoseAuth.user() && PoseAuth.user().email) || "signed in";
    let badge;
    if (j.plan === "pro") badge = "Pro";
    else if ((j.credits || 0) > 0) badge = j.credits + " credits";
    else badge = (j.free_left ?? 0) + " free left";
    $("acct-info").textContent = who + " · " + badge;
  } catch (_) {
    $("acct-info").textContent = (PoseAuth.user() && PoseAuth.user().email) || "signed in";
  }
}

/* ---------- login modal ---------- */
function openLogin() { $("login-modal").hidden = false; $("login-email").focus(); }
$("login-close").onclick = () => { $("login-modal").hidden = true; };
$("login-send").onclick = async () => {
  const email = $("login-email").value.trim();
  const st = $("login-status");
  if (!email) { st.className = "status err"; st.textContent = "Enter your email."; return; }
  st.className = "status"; st.textContent = "Sending…";
  try {
    await PoseAuth.signIn(email);
    st.className = "status ok";
    st.textContent = "Check your email for the magic link.";
  } catch (e) {
    st.className = "status err";
    st.textContent = e.message || "Could not send link.";
  }
};

/* ---------- boot ---------- */
(async function boot() {
  try {
    const j = await (await fetch(API, { method: "GET" })).json();
    window.__paywall = !!j.paywall;
  } catch (_) {
    window.__paywall = false;
  }
  if (window.__paywall && window.PoseAuth) {
    await PoseAuth.init(() => { renderAccount(); $("login-modal").hidden = true; });
  } else {
    $("account").hidden = true;
  }
})();
