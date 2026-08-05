"use strict";

const API = "/api/convert";
const ME = "/api/me";
const MAX_EDGE = 2400;        // downscale before upload (Vercel ~4.5MB body limit)
const JPEG_Q = 0.9;
const MAX_FILES = 30;         // matches the server-side cap (api/convert.py)
// Stripe availability comes from the API health flag (window.__stripe).

const state = { vendor: null, items: [], selected: 0, projects: [] };
const NEW_PROJECT = "__new__";
const $ = (id) => document.getElementById(id);
const camButtons = Array.from(document.querySelectorAll(".cam"));
const stepDots = Array.from(document.querySelectorAll(".step-dot"));
const GO_HINT_READY = "You get a ZIP with a ready-to-copy SD-card folder and instructions.";

// Signed-in users get the converter first. We remember sign-in in localStorage so
// the inline <head> script can reorder before paint (no flash) on return visits.
function syncSignedInLayout() {
  const signedIn = !!(window.PoseAuth && PoseAuth.token());
  document.documentElement.classList.toggle("signed-in", signedIn);
  try {
    if (signedIn) localStorage.setItem("pic_signed_in", "1");
    else localStorage.removeItem("pic_signed_in");
  } catch (_) {}
  if (!signedIn) {
    // Signing out drops the plan too, so the next visitor gets the plain pitch.
    document.documentElement.classList.remove("is-pro", "is-free");
    try { localStorage.removeItem("pic_plan"); } catch (_) {}
    const nudge = $("upgrade-nudge");
    if (nudge) nudge.hidden = true;
  }
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
$("file").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

function addFiles(fileList) {
  let skipped = 0, overflow = 0;
  for (const file of fileList) {
    // check HEIC first — some browsers report an empty MIME type for it
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) { skipped++; continue; }
    if (!file.type.startsWith("image/")) continue;
    if (state.items.length >= MAX_FILES) { overflow++; continue; }
    state.items.push({ file, url: URL.createObjectURL(file) });
  }
  if (skipped || overflow) {
    const st = $("status");
    st.className = "status err";
    st.textContent = skipped
      ? "✗ HEIC photos aren't supported in browsers yet. On iPhone: Settings → Camera → Formats → Most Compatible, or export the image as JPG/PNG."
      : `✗ Max ${MAX_FILES} images per batch. Kept the first ${MAX_FILES}, skipped ${overflow}.`;
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
  $("screen-img").alt = "Preview: " + (state.items[state.selected].file.name || "image " + (state.selected + 1));
  $("screen-count").textContent = state.items.length + (state.items.length === 1 ? " card" : " cards");
  const strip = $("filmstrip");
  strip.innerHTML = "";
  state.items.forEach((it, i) => {
    const w = document.createElement("div");
    w.className = "thumb-wrap" + (i === state.selected ? " sel" : "");
    const t = document.createElement("img");
    t.src = it.url;
    t.className = "thumb";
    t.addEventListener("click", () => { state.selected = i; renderPreview(); });
    const x = document.createElement("button");
    x.type = "button";
    x.className = "thumb-x";
    x.textContent = "×";
    x.title = "Remove";
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
  renderPreview();
  refresh();
}

$("clear-all").addEventListener("click", () => {
  state.items.forEach((it) => { try { URL.revokeObjectURL(it.url); } catch (_) {} });
  state.items = [];
  state.selected = 0;
  renderPreview();
  refresh();
});

function refresh() {
  const hasCam = !!state.vendor, hasImgs = state.items.length > 0;
  $("go").disabled = !(hasCam && hasImgs);
  // tick off steps 1–2 as they're completed
  if (stepDots[0]) { stepDots[0].classList.toggle("done", hasCam); stepDots[0].textContent = hasCam ? "✓" : "1"; }
  if (stepDots[1]) { stepDots[1].classList.toggle("done", hasImgs); stepDots[1].textContent = hasImgs ? "✓" : "2"; }
  // say exactly what's missing instead of a silently disabled button
  const hint = document.querySelector(".go-hint");
  if (hint) {
    hint.textContent =
      !hasCam && !hasImgs ? "First choose your camera, then add your images."
      : hasCam && !hasImgs ? "Now add at least one image."
      : !hasCam ? "Choose your camera above (step 1)."
      : GO_HINT_READY;
  }
}
refresh();

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
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";          // flatten any transparency to white (JPEG has no alpha)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
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
    if (window.__paywall) {
      // Numbering continues within the chosen project (server-side).
      const sel = $("project-select"), fresh = $("project-new");
      if (sel && !$("project-field").hidden) {
        if (sel.value === NEW_PROJECT) {
          const name = (fresh.value || "").trim();
          if (!name) {
            status.className = "status err";
            status.textContent = "✗ Name your new project first (or pick an existing one).";
            fresh.focus();
            return;
          }
          fd.append("project_name", name);
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
    let i = 0, total = 0;
    for (const it of state.items) {
      const blob = await downscale(it.file);
      total += blob.size;
      fd.append("files", blob, `design-${++i}.jpg`);
    }
    if (total > 4_000_000) {  // Vercel request-body limit is ~4.5MB
      status.className = "status err";
      status.textContent = `✗ That's ${(total / 1e6).toFixed(1)} MB of images, a bit much for one go. Convert fewer at a time (upload limit is ~4 MB).`;
      return;  // the finally block re-enables the button
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
    a.download = "camera-cards.zip";
    document.body.appendChild(a); a.click(); a.remove();

    const wm = resp.headers.get("X-Watermarked") === "1";
    const first = resp.headers.get("X-First-File"), last = resp.headers.get("X-Last-File");
    const range = first && last
      ? (first === last ? ` Your card is ${first}.` : ` Your cards are ${first} to ${last}.`)
      : "";
    status.className = "status ok";
    status.textContent = "✓ Done! Your camera-cards.zip is downloading." + range +
      (wm ? "  (free, watermarked)" : "");
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
  if (window.__stripe) {
    el.innerHTML =
      '<p class="muted" style="margin:0 0 12px">You\'ve used your free images. Go unlimited or buy a credit pack:</p>' +
      '<div class="buy-row">' +
        '<button class="go" data-kind="monthly">Go Pro (monthly)</button>' +
        '<button class="go ghost" data-kind="yearly">Pro (yearly)</button>' +
        '<button class="link-btn" data-kind="pack20">Buy 20 credits</button>' +
      '</div>';
    el.querySelectorAll("[data-kind]").forEach((b) =>
      b.addEventListener("click", () => startCheckout(b.dataset.kind, b)));
  } else {
    el.innerHTML = '<p class="muted">You\'ve used your free images. Paid plans are launching soon. Thanks for trying it!</p>';
  }
}

async function startCheckout(kind, btn) {
  const tok = PoseAuth.token();
  if (!tok) { openLogin(); return; }
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
    $("status").className = "status err";
    $("status").textContent = "✗ " + e.message;
    if (btn) btn.disabled = false;
  }
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
    $("status").className = "status err";
    $("status").textContent = "✗ " + e.message;
  }
}

/* ---------- pricing section ---------- */
function fmtMoney(o) {
  if (!o || o.amount == null) return null;
  const sym = o.currency === "EUR" ? "€" : (o.currency || "") + " ";
  const n = Number(o.amount);
  return sym + (Number.isInteger(n) ? n : n.toFixed(2));
}

async function renderPricing() {
  const grid = $("price-grid");
  const toggle = $("price-toggle");
  if (!grid) return;

  let data = { prices: {}, free_limit: 3, pack_size: 20 };
  try { data = await (await fetch("/api/prices")).json(); } catch (_) {}
  const P = data.prices || {};
  const freeN = data.free_limit ?? 3;
  const packN = data.pack_size ?? 20;
  const hasM = !!P.monthly, hasY = !!P.yearly, hasPack = !!P.pack20;

  let cycle = hasM ? "monthly" : (hasY ? "yearly" : "monthly");
  toggle.hidden = !(hasM && hasY);

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
    let proNote = "Unlimited, no watermark";
    if (cycle === "yearly" && hasY) {
      const sym = P.yearly.currency === "EUR" ? "€" : P.yearly.currency + " ";
      proNote = sym + (P.yearly.amount / 12).toFixed(2) + "/mo, billed yearly";
    }

    grid.innerHTML =
      card({
        name: "Free",
        amount: "€0",
        per: "",
        note: "No credit card",
        feats: ["Sony · Canon · Nikon", freeN + " images", "Watermarked"],
        cta: '<button class="btn btn-ghost" data-go="tool">Start free</button>',
      }) +
      card({
        featured: true,
        badge: "Most popular",
        name: "Pro",
        amount: proAmt || "",
        per: proAmt ? (cycle === "yearly" ? "/yr" : "/mo") : "",
        note: proNote,
        feats: ["Unlimited images", "No watermark", "Ready for every shoot", "Cancel anytime"],
        cta: (hasM || hasY)
          ? '<button class="btn btn-primary" data-buy="' + cycle + '">Go Pro</button>'
          : '<button class="btn btn-primary" disabled>Coming soon</button>',
      }) +
      card({
        name: "Credits",
        amount: hasPack ? fmtMoney(P.pack20) : "",
        per: hasPack ? " once" : "",
        note: "One-time, no subscription",
        feats: [packN + " images", "No watermark", "Never expires"],
        cta: hasPack
          ? '<button class="btn btn-ghost" data-buy="pack20">Buy ' + packN + " credits</button>"
          : '<button class="btn btn-ghost" disabled>Coming soon</button>',
      });

    grid.querySelectorAll("[data-buy]").forEach((b) =>
      b.addEventListener("click", () => startCheckout(b.dataset.buy, b)));
    grid.querySelectorAll('[data-go="tool"]').forEach((b) =>
      b.addEventListener("click", () =>
        document.getElementById("tool").scrollIntoView({ behavior: "smooth" })));
  }

  toggle.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      cycle = b.dataset.cycle;
      toggle.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      paint();
    }));

  paint();
}

/* ---------- auth / account ---------- */
async function renderAccount() {
  const el = $("account"), nudge = $("upgrade-nudge");
  if (!window.__paywall) { el.hidden = true; if (nudge) nudge.hidden = true; return; }
  el.hidden = false;
  const tok = PoseAuth.token();
  if (!tok) {
    el.innerHTML = '<button class="link-btn" id="signin-btn">Sign in</button>';
    $("signin-btn").onclick = openLogin;
    if (nudge) nudge.hidden = true;
    return;
  }
  el.innerHTML = '<span class="acct-info" id="acct-info">…</span>' +
    '<button class="link-btn" id="manage-btn" hidden>Billing</button>' +
    '<button class="link-btn" id="signout-btn">Sign out</button>';
  $("signout-btn").onclick = async () => { await PoseAuth.signOut(); };
  $("manage-btn").onclick = startPortal;
  try {
    const r = await fetch(ME, { headers: { Authorization: "Bearer " + tok } });
    const j = await r.json();
    const who = j.email || (PoseAuth.user() && PoseAuth.user().email) || "signed in";
    let badge;
    // Subscribers have nothing left to buy: .is-pro hides pricing and the nudge.
    setPlanClasses(j.plan);
    renderUpgradeNudge(j);
    if (j.plan === "pro") { badge = "Pro"; if (window.__stripe) $("manage-btn").hidden = false; }
    else if ((j.credits || 0) > 0) badge = j.credits + " credits";
    else badge = (j.free_left ?? 0) + " free left";
    $("acct-info").textContent = who + " · " + badge;
  } catch (_) {
    $("acct-info").textContent = (PoseAuth.user() && PoseAuth.user().email) || "signed in";
  }
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
const VENDOR_LABEL = { sony: "Sony", canon: "Canon", nikon: "Nikon" };
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

  sel.value = state.projects.some((p) => p.id === keep) ? keep : state.projects[0].id;
  state.activeProject = sel.value;
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
  hint.textContent = first
    ? "Group a job under one name, so you can upload it in several goes and the cards keep counting up."
    : creating
      ? "A new project starts its card numbers at 0001."
      : "Cards in this project keep counting up, so you can upload a job in several goes.";
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
function openLogin() {
  _loginReturnFocus = document.activeElement;
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

/* ---------- boot ---------- */
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
    await PoseAuth.init(() => { renderAccount(); $("login-modal").hidden = true; syncSignedInLayout(); loadHistory(); });
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
    const status = $("status");
    status.className = "status ok";
    status.textContent = "✓ Payment received. Your account is updating. Thank you!";
    status.scrollIntoView({ behavior: "smooth", block: "center" });
    let n = 0;
    const t = setInterval(() => { renderAccount(); if (++n >= 4) clearInterval(t); }, 2000);
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
  v.play && v.play().catch(() => {});
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
    ".flow .eyebrow, .flow .section-h, .flow-sub, .flow-stage, .flow-trust, .flow-safe",
    ".ideas .eyebrow, .ideas .section-h",
    "stagger:.ideas .idea",
    ".how .eyebrow, .how .section-h",
    "stagger:.how .how-step",
    ".tool .eyebrow, .tool .section-h, .tool-sub, .tool-card",
    ".pricing .eyebrow, .pricing .section-h, .pricing-sub, .price-grid",
    ".packs .eyebrow, .packs .section-h, .packs-lede, .packs-track, .pack-includes, .packs-cta",
    ".faq .eyebrow, .faq .section-h",
    "stagger:.faq .faq-item",
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
