"use strict";

const API = "/api/convert";
const ME = "/api/me";
const MAX_EDGE = 2400;        // downscale before upload (Vercel ~4.5MB body limit)
const JPEG_Q = 0.9;
// Stripe availability comes from the API health flag (window.__stripe).

const state = { vendor: null, items: [], selected: 0 };
const $ = (id) => document.getElementById(id);
const camButtons = Array.from(document.querySelectorAll(".cam"));

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
$("file").addEventListener("change", (e) => addFiles(e.target.files));
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

function addFiles(fileList) {
  let skipped = 0;
  for (const file of fileList) {
    if (!file.type.startsWith("image/")) continue;
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) { skipped++; continue; }
    state.items.push({ file, url: URL.createObjectURL(file) });
  }
  if (skipped) {
    const st = $("status");
    st.className = "status err";
    st.textContent = "✗ HEIC photos aren't supported in browsers yet. On iPhone: Settings → Camera → Formats → Most Compatible, or export the image as JPG/PNG.";
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
    a.download = "camera-cards.zip";
    document.body.appendChild(a); a.click(); a.remove();

    const wm = resp.headers.get("X-Watermarked") === "1";
    status.className = "status ok";
    status.textContent = "✓ Done! Your camera-cards.zip is downloading." +
      (wm ? "  (free, watermarked)" : "");
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
  if (window.__stripe) {
    el.innerHTML =
      '<p class="muted" style="margin:0 0 12px">You\'ve used your free conversions. Go unlimited or buy a credit pack:</p>' +
      '<div class="buy-row">' +
        '<button class="go" data-kind="monthly">Go Pro (monthly)</button>' +
        '<button class="go ghost" data-kind="yearly">Pro (yearly)</button>' +
        '<button class="link-btn" data-kind="pack20">Buy 20 credits</button>' +
      '</div>';
    el.querySelectorAll("[data-kind]").forEach((b) =>
      b.addEventListener("click", () => startCheckout(b.dataset.kind, b)));
  } else {
    el.innerHTML = '<p class="muted">You\'ve used your free conversions. Paid plans are launching soon. Thanks for trying it!</p>';
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
        feats: ["Sony · Canon · Nikon", freeN + " conversions", "Watermarked"],
        cta: '<button class="btn btn-ghost" data-go="tool">Start free</button>',
      }) +
      card({
        featured: true,
        badge: "Most popular",
        name: "Pro",
        amount: proAmt || "",
        per: proAmt ? (cycle === "yearly" ? "/yr" : "/mo") : "",
        note: proNote,
        feats: ["Unlimited conversions", "No watermark", "All three brands", "Cancel anytime"],
        cta: (hasM || hasY)
          ? '<button class="btn btn-primary" data-buy="' + cycle + '">Go Pro</button>'
          : '<button class="btn btn-primary" disabled>Coming soon</button>',
      }) +
      card({
        name: "Credits",
        amount: hasPack ? fmtMoney(P.pack20) : "",
        per: hasPack ? " once" : "",
        note: "One-time, no subscription",
        feats: [packN + " conversions", "No watermark", "Never expires"],
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
    '<button class="link-btn" id="manage-btn" hidden>Billing</button>' +
    '<button class="link-btn" id="signout-btn">Sign out</button>';
  $("signout-btn").onclick = async () => { await PoseAuth.signOut(); };
  $("manage-btn").onclick = startPortal;
  try {
    const r = await fetch(ME, { headers: { Authorization: "Bearer " + tok } });
    const j = await r.json();
    const who = j.email || (PoseAuth.user() && PoseAuth.user().email) || "signed in";
    let badge;
    if (j.plan === "pro") { badge = "Pro"; if (window.__stripe) $("manage-btn").hidden = false; }
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
    window.__stripe = !!j.stripe;
  } catch (_) {
    window.__paywall = false;
    window.__stripe = false;
  }
  if (window.__paywall && window.PoseAuth) {
    await PoseAuth.init(() => { renderAccount(); $("login-modal").hidden = true; });
  } else {
    $("account").hidden = true;
  }
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
