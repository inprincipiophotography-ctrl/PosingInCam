"use strict";

/* Shoot Cards demo (/demo): a one-minute, hands-on walk through the product.
   Everything is simulated in the browser, with no API and no account. The
   camera screen is a canvas drawn with the studio's own CardRenderer
   (builder.js), so the card made here is the card the studio makes. The last
   step hands it to the studio on / (applyDemoHandoff in app.js). */
(function () {
  const R = window.CardRenderer;
  const $ = (id) => document.getElementById(id);
  const main = $("main");
  if (!R || !main) return;

  // A funnel step for the visitor stats (assets/visits.js). Ad blockers may
  // keep that file away, so the demo never depends on it.
  const track = (name, data) => { if (window.trackEvent) window.trackEvent(name, data); };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const later = (ms, fn) => setTimeout(fn, reduced ? Math.min(ms, 300) : ms);
  const viaKeys = (e) => !!e && e.detail === 0;   // a click made with Enter / Space

  const HANDOFF = "pic_demo_handoff";   // read (and removed) by applyDemoHandoff() in app.js
  const SCENES = ["start", "playback", "make", "copy", "done"];
  const STEP_NAMES = ["The moment", "Playback", "Your card", "SD card", "On the day"];
  // Links made for the longer, 8-step demo still land on the right step.
  const SCENE_ALIAS = { camera: "make", setup: "copy", shoot: "done" };
  const NEEDS_CAMERA = ["copy"];
  const PLAY = "▶︎";

  /* ---------- per camera (keep in step with INSTRUCTIONS in app.js and converter/pack.py) ---------- */
  const VENDORS = {
    sony: { name: "Sony", zip: "100MSDCF", folder: "100MSDCF", file: "DSC00001.JPG", test: "DSC00001.JPG", clash: true },
    canon: { name: "Canon", zip: "100CANON", folder: "100CANON", file: "0A0A0001.JPG", test: "IMG_0001.JPG", clash: false },
    nikon: { name: "Nikon", zip: "100NCZ_X", folder: "100NCZ_8", file: "DSC_0001.JPG", test: "DSC_0001.JPG", clash: true },
  };
  const VENDOR_KEYS = Object.keys(VENDORS);

  const SETUP = {
    sony: {
      title: "Sony: one more step <em>after copying</em>.",
      text: "Sony only plays back files it has listed. Rebuild that list each time you copy cards, or the camera shows nothing. It's the #1 reason cards don't appear.",
      task: "Press MENU, then <b>Setup › Media › Recover Image Database</b>.",
      todo: "Back in the camera: <b>Recover Image Database</b>.",
      menu: [
        { title: "Menu", items: ["Shooting", "Exposure/Color", "Playback", "Setup"], target: "Setup" },
        { title: "Setup", items: ["Area/Date", "Media", "Power Setting", "Sound Option"], target: "Media" },
        { title: "Setup › Media", items: ["Format", "Recover Image Database", "Display Media Info"], target: "Recover Image Database" },
      ],
      confirm: "Recover the image database?", ok: "Enter",
      work: "Recovering… don't remove the card.", done: "✓ Image database recovered.",
    },
    nikon: {
      title: "Nikon: check the <em>playback folder</em>.",
      text: "A Nikon can play back just one folder. Set it to All, and your cards show up next to your photos.",
      task: "Press MENU, then <b>Playback menu › Playback folder › All</b>.",
      todo: "Back in the camera: <b>Playback folder › All</b>.",
      menu: [
        { title: "Menu", items: ["Photo shooting", "Playback menu", "Setup menu", "Network"], target: "Playback menu" },
        { title: "Playback menu", items: ["Delete", "Playback folder", "Playback display", "Image review"], target: "Playback folder" },
        { title: "Playback folder", items: ["100NCZ_8", "All", "Current"], target: "All" },
      ],
      done: "✓ Playback folder: All.",
    },
    canon: {
      task: "Back in the camera: <b>nothing to set</b> on a Canon.",
      todo: "Back in the camera: <b>nothing to set</b> on a Canon.",
      done: "✓ Safe to remove. Canon is plug & play. Two card slots? Play back the slot you copied to.",
    },
  };

  // The short version of each camera's steps, for the last screen (the ZIP's README has them too).
  const CHECKLIST = {
    sony: [["Format the card in the camera", " and take one photo."], ["Copy the .JPG", " into DCIM › 100MSDCF."],
           ["Recover Image Database:", " MENU › Setup › Media."], ["Press " + PLAY + " between shots.", " It's all there."]],
    canon: [["Format the card in the camera", " and take one photo."], ["Copy the .JPG", " into DCIM › 100CANON."],
            ["Put the card back.", " Nothing to set on a Canon."], ["Press " + PLAY + " between shots.", " It's all there."]],
    nikon: [["Format the card in the camera", " and take one photo."], ["Copy the .JPG", " into the DCIM › 100NCZ_… folder your camera made."],
            ["Not showing?", " Playback menu › Playback folder › All."], ["Press " + PLAY + " between shots.", " It's all there."]],
  };

  /* ---------- the cards ---------- */
  // The example cards in playback: the studio's own examples (DEFAULTS in app.js).
  const SAMPLE = {
    timeline: { label: "Saturday", rows: [
      { time: "14:00", text: "Getting ready" }, { time: "15:30", text: "First look" },
      { time: "16:30", text: "Ceremony" }, { time: "18:00", text: "Golden hour portraits" },
      { time: "20:00", text: "First dance" }] },
    groups: { label: "After the ceremony", rows: [
      { names: "Ana & Luka + Grandma Mara", rel: "her grandma, seated" }, { names: "+ Vesna & Ivo", rel: "her parents" },
      { names: "+ Petra & Josip", rel: "her siblings" }, { names: "Ana & Luka + Sanja & Goran", rel: "his parents" },
      { names: "+ Marko", rel: "his brother" }, { names: "Everyone, both families", rel: "big group last" }] },
    shotlist: { label: "Must-have shots", rows: [
      { text: "Rings & invitation" }, { text: "Dress details" }, { text: "Mum's reaction" },
      { text: "Walk down the aisle" }, { text: "Ring exchange, close" }, { text: "Confetti exit" }] },
    settings: { title: "Tricky light", rows: [
      { label: "Church, dim", value: "f/1.8 · 1/125 · ISO 3200" },
      { label: "Golden hour", value: "f/2.0 · 1/1000 · ISO 100" },
      { label: "Reception + flash", value: "f/4.0 · 1/60 · ISO 1600" }] },
  };
  const ROLL = [
    { img: "pack-03", name: "pose card, Under the veil" },
    { card: "timeline", data: SAMPLE.timeline, name: "timeline card" },
    { img: "pack-01", name: "pose card, Dance and spin" },
    { card: "groups", data: SAMPLE.groups, name: "family groups card" },
    { img: "pack-04", name: "pose card, Vogue" },
    { card: "shotlist", data: SAMPLE.shotlist, name: "shot list card" },
    { img: "pack-02", name: "pose card, The first look" },
    { card: "settings", data: SAMPLE.settings, name: "settings card" },
  ];

  // Lines you can tap onto your own card. One card holds R.PER_PAGE[type]
  // lines (6): the demo never makes more, so it stays one free card.
  const CHIPS = {
    timeline: [
      { time: "14:00", text: "Getting ready" }, { time: "15:30", text: "First look" },
      { time: "16:30", text: "Ceremony" }, { time: "17:15", text: "Family groups" },
      { time: "18:00", text: "Golden hour portraits" }, { time: "19:00", text: "Dinner & speeches" },
      { time: "20:00", text: "First dance" }, { time: "22:00", text: "Cake & sparklers" }],
    groups: [
      { names: "+ Grandma Mara", rel: "her grandma, seated" }, { names: "+ Vesna & Ivo", rel: "her parents" },
      { names: "+ Petra & Josip", rel: "her siblings" }, { names: "+ Sanja & Goran", rel: "his parents" },
      { names: "+ Luka", rel: "his brother" }, { names: "+ Godparents", rel: "both sides" },
      { names: "+ Bridesmaids", rel: "her side" }, { names: "Everyone, both families", rel: "big group last" }],
    shotlist: [
      { text: "Rings & invitation" }, { text: "Dress details" }, { text: "Mum's reaction" },
      { text: "Walk down the aisle" }, { text: "Ring exchange, close" }, { text: "First kiss" },
      { text: "Confetti exit" }, { text: "Last dance" }],
  };
  const START_PICKS = { timeline: [0, 1, 2], groups: [1, 2, 3], shotlist: [0, 1, 2] };
  const PROMPT = { timeline: "Tap the moments of the day", groups: "Tap the family groups, in order", shotlist: "Tap your must-have shots" };
  const KIND = { timeline: "timeline", groups: "family groups", shotlist: "shot list" };
  const HOOK = {
    before: "The couple is waiting and your mind goes blank. What do you reach for?",
    after: "37 seconds of scrolling, with the couple watching. There's a faster way, and it's already in your hand.",
  };

  /* ---------- state ---------- */
  const fresh = () => ({
    type: "timeline", label: "Ana & Marko", picked: JSON.parse(JSON.stringify(START_PICKS)),
    phoned: false, roll: 0, seen: 1, built: false, made: false, job: 0,
    armed: false, misses: 0, copied: false, ejected: false,
    fixed: false, played: false, skipped: false, completed: false,
  });
  let S = fresh();
  let vendor = null;    // survives "Replay": you still shoot the same camera
  let at = 0;           // index into SCENES
  const visited = new Set();   // steps you've been on (the step bar lets you go back to them)
  const tracked = new Set();   // steps already counted in the visitor stats

  /* ---------- the camera screen ---------- */
  const W = 1920, H = 1280;
  const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const LIVE = { kind: "live", label: "Camera screen: live view, the bride in the garden at golden hour" };
  // Live view is a real photo: a 3:2 crop of the bride in pack-04.jpg (source px),
  // with the camera's focus box on her face.
  const LIVE_SRC = { img: "pack-04", x: 236, y: 250, w: 506, h: 337, face: [462, 300, 70, 84] };
  const screenBox = $("screen");
  const canvas = $("screen-canvas");
  const ctx = canvas.getContext("2d");
  const work = document.createElement("canvas");   // CardRenderer sizes and draws this one
  const IMGS = {};
  let frame = LIVE;
  let queued = false;

  function image(key) {
    if (!IMGS[key]) {
      const img = new Image();
      img.onload = repaint;
      img.src = "/assets/showcase/" + key + ".jpg";
      IMGS[key] = img;
    }
    return IMGS[key];
  }
  const loaded = (img) => !!(img && img.complete && img.naturalWidth);

  function show(f, anim) {
    frame = f;
    paint();
    if (anim && !reduced) restart(canvas, anim, ["slide-next", "slide-prev", "pop"]);
  }
  function repaint() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }
  function restart(el, cls, all) {
    (all || [cls]).forEach((c) => el.classList.remove(c));
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function blink() { if (!reduced) restart(screenBox, "flash"); }

  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (frame.kind === "live") drawLive();
    else drawCard(frame);
    canvas.setAttribute("aria-label", frame.label || "Camera screen");
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // What's in front of the lens: the bride, in warm late light.
  function drawLive() {
    const L = LIVE_SRC, img = image(L.img);
    let g;
    if (loaded(img)) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, L.x, L.y, L.w, L.h, 0, 0, W, H);
      g = ctx.createLinearGradient(0, 0, W, H);       // a touch of golden hour
      g.addColorStop(0, "rgba(255,186,110,.26)");
      g.addColorStop(0.55, "rgba(255,170,100,.08)");
      g.addColorStop(1, "rgba(80,40,20,.18)");
    } else {
      g = ctx.createLinearGradient(0, 0, 0, H);       // still loading: a quiet gradient
      g.addColorStop(0, "#6f7a5a");
      g.addColorStop(1, "#2f3427");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // the focus box on her face, then the shooting info
    const sx = W / L.w, sy = H / L.h;
    const fx = (L.face[0] - L.x) * sx, fy = (L.face[1] - L.y) * sy, fw = L.face[2] * sx, fh = L.face[3] * sy;
    ctx.strokeStyle = "rgba(120,255,140,.95)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.moveTo(x + dx * 54, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * 54);
    });
    ctx.stroke();
    g = ctx.createLinearGradient(0, H - 200, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 200, W, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "600 56px " + SANS;
    ctx.textAlign = "center";
    ctx.fillText("1/500     F2.0     ISO 100     ±0.0", W / 2, H - 52);
    ctx.font = "700 56px " + SANS;
    ctx.textAlign = "left";
    ctx.fillText("M", 64, 108);
    ctx.textAlign = "right";
    ctx.fillText("1342", W - 64, 108);
    ctx.textAlign = "left";
  }

  // A card in playback: letterboxed like the camera does it (a portrait pose
  // card stands upright between black bars), with the playback info on top.
  function drawCard(f) {
    const it = f.item;
    let src = null;
    if (it.img) {
      const img = image(it.img);
      if (loaded(img)) src = img;
    } else {
      R.draw(work, it.card, it.data, 0);
      src = work;
    }
    if (src) {
      const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
      const s = Math.min(W / sw, H / sh), dw = Math.round(sw * s), dh = Math.round(sh * s);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
    }
    ctx.font = "600 52px " + SANS;
    if (f.counter || f.file) pill(f.file ? PLAY + "  " + f.file : PLAY, 30, 16, "left");
    if (f.counter) pill(f.counter, W - 30, 16, "right");
    if (f.badge) pill(f.badge, W - 30, 16, "right", "rgba(255,255,255,.94)", "#7e0000");
  }

  function pill(text, x, y, align, bg, fg) {
    const w = ctx.measureText(text).width + 52, h = 70;
    const x0 = align === "right" ? x - w : x;
    ctx.fillStyle = bg || "rgba(0,0,0,.58)";
    rr(x0, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg || "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x0 + 26, y + h / 2 + 3);
    ctx.textBaseline = "alphabetic";
  }

  /* ---------- your card ---------- */
  function userRows() {
    const list = CHIPS[S.type];
    return S.picked[S.type].slice().sort((a, b) => a - b).map((i) => Object.assign({}, list[i]));
  }
  function userCard() {
    return { card: S.type, data: { label: S.label, rows: userRows() } };
  }
  function showUser(extra, anim) {
    const card = userCard();
    show(Object.assign({ kind: "card", item: card, label: "Camera screen: your " + KIND[S.type] + " card" }, extra), anim);
    R.ensureFonts(card.data).then(repaint);
  }
  function thumb(c) {
    const card = userCard();
    R.draw(work, card.card, card.data, 0);
    c.getContext("2d").drawImage(work, 0, 0, c.width, c.height);
  }

  // Any change to the card (or the camera) means making and copying it again.
  function resetFrom(step) {
    if (step === "card") S.built = true;
    S.made = S.copied = S.ejected = S.fixed = S.played = S.armed = false;
    S.misses = 0;
    S.job += 1;   // a "Make my card" still converting is now out of date
  }

  /* ---------- scenes ---------- */
  const sceneEls = {};
  document.querySelectorAll(".scene").forEach((el) => { sceneEls[el.dataset.scene] = el; });
  const steps = Array.from(document.querySelectorAll("#d-steps .step"));
  const stage = $("stage");
  const camWrap = $("cam-wrap"), pc = $("pc"), phone = $("phone");
  const cam = $("cam"), coach = $("coach");
  const CAM_KEYS = ["btn-play", "btn-dial", "btn-menu", "btn-shutter"];
  const COACH = { "btn-play": "Press " + PLAY, "btn-dial": "Turn the wheel", "btn-menu": "Press MENU", "btn-shutter": "Half-press" };
  const video = $("done-video");

  function view(v) {
    camWrap.hidden = v !== "camera";
    pc.hidden = v !== "pc";
    stage.dataset.view = v;
    placeCoach();
  }
  // A step in two parts (SD card, then camera; press play, then the end).
  function phase(sid, name) {
    sceneEls[sid].querySelectorAll(".phase").forEach((p) => { p.hidden = p.dataset.for !== name; });
    main.dataset.phase = name;
  }
  function heading(sid) {
    return Array.from(sceneEls[sid].querySelectorAll("h2")).find((h) => !h.closest("[hidden]"));
  }

  // The control to press gets a ring and a small label pointing at it.
  let coachFor = null;
  function cue(ids) {
    CAM_KEYS.forEach((id) => $(id).classList.toggle("cue", ids.includes(id)));
    coachFor = ids[0] || null;
    coach.hidden = !coachFor;
    if (coachFor) coach.textContent = COACH[coachFor];
    placeCoach();
  }
  function placeCoach() {
    if (!coachFor || camWrap.hidden) return;
    requestAnimationFrame(() => {
      if (!coachFor) return;
      const c = cam.getBoundingClientRect(), t = $(coachFor).getBoundingClientRect();
      coach.style.left = Math.round(t.left - c.left) + "px";
      coach.style.top = Math.round(t.top + t.height / 2 - c.top) + "px";
    });
  }
  window.addEventListener("resize", placeCoach);
  if (window.ResizeObserver) new ResizeObserver(placeCoach).observe(cam);
  function pagerOn(on) { $("pager").hidden = !on; }
  function nextBtn() { return sceneEls[SCENES[at]].querySelector(".scene-next"); }
  function unlock(strong) {
    const b = nextBtn();
    if (!b) return;
    b.hidden = false;
    b.classList.toggle("pulse", !!strong);
  }
  function lock() {
    const b = nextBtn();
    if (b) { b.hidden = true; b.classList.remove("pulse"); }
  }
  function note(id, text, kind) {
    const el = $(id);
    el.className = "scene-note" + (kind ? " " + kind : "");
    el.textContent = text;
  }
  function nope(el) { if (!reduced) restart(el, "nope"); }
  function focusIf(e, el) { if (viaKeys(e) && el && !el.hidden) el.focus({ preventScroll: true }); }
  document.addEventListener("animationend", (e) => {
    const c = e.target.classList;
    if (c && (c.contains("nope") || c.contains("spin"))) c.remove("nope", "spin");
  });

  function go(id, opts) {
    opts = opts || {};
    let i = SCENES.indexOf(id);
    if (i < 0) i = 0;
    // The SD card step depends on the camera: ask for it first.
    if (NEEDS_CAMERA.includes(SCENES[i]) && !vendor) i = SCENES.indexOf("make");
    stopPhone();
    closeMenu();
    if (drag) cancelDrag();
    main.classList.remove("need-swipe");
    at = i;
    const sid = SCENES[i];
    Object.keys(sceneEls).forEach((k) => { sceneEls[k].hidden = k !== sid; });
    main.dataset.scene = sid;
    main.dataset.step = String(i + 1);
    main.dataset.phase = "";
    visited.add(sid);
    steps.forEach((b, k) => {
      b.classList.toggle("on", k < i);
      b.classList.toggle("now", k === i);
      b.disabled = k !== i && !visited.has(SCENES[k]);
      if (k === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    $("d-count").textContent = "Step " + (i + 1) + " of " + SCENES.length;
    $("d-name").textContent = STEP_NAMES[i];
    $("d-step").textContent = "Step " + (i + 1) + " of " + SCENES.length + ": " + STEP_NAMES[i];
    $("d-back").hidden = i === 0;
    $("d-skip").hidden = i === SCENES.length - 1;
    if (sid !== "done") { try { video.pause(); } catch (_) {} }
    try { history.replaceState(null, "", location.pathname + location.search + "#" + sid); } catch (_) {}
    ENTER[sid]();
    syncCta();
    if (!tracked.has(sid)) {
      tracked.add(sid);
      track("Demo step", { step: sid });
    }
    if (!opts.quiet) {
      const h = heading(sid);
      if (h) h.focus({ preventScroll: true });
      // phones: bring the camera back into view
      if (window.scrollY > main.offsetTop) main.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
    idle.arm();
  }

  const ENTER = {
    start() {
      view("camera");
      pagerOn(false);
      cue(["btn-play"]);
      $("hook-text").textContent = S.phoned ? HOOK.after : HOOK.before;
      $("hook-phone").hidden = S.phoned;
      $("hook-phone").disabled = false;
      show(LIVE);
    },
    playback() {
      view("camera");
      pagerOn(true);
      showRoll(0, "pop");
      syncSeen();
    },
    make() {
      view("camera");
      pagerOn(false);
      cue([]);
      buildChips();
      syncMake();
      showUser({ badge: "Live preview" });
    },
    // Copy and eject on the computer; then, for Sony and Nikon, one setting in the camera.
    copy() {
      pagerOn(false);
      if (S.ejected && SETUP[vendor].menu) {
        phase("copy", "camera");
        view("camera");
        renderSetup();
      } else {
        phase("copy", "files");
        view("pc");
        cue([]);
        renderCopy();
        if (!S.ejected) note("copy-note", "");
      }
    },
    // Press play on the day; then the checklist and the way into the studio.
    done() {
      view("camera");
      pagerOn(false);
      if (S.played || S.skipped) {
        phase("done", "end");
        cue([]);
        renderDone("pop");
      } else {
        phase("done", "play");
        $("shoot-play").disabled = false;
        show(LIVE);
        cue(["btn-play"]);
      }
    },
  };
  $("d-steps").addEventListener("click", (e) => {
    const b = e.target.closest(".step");
    if (b && !b.disabled && b.dataset.go !== SCENES[at]) go(b.dataset.go);
  });

  /* ----- 1. the hook: phone or playback ----- */
  let phoneTimers = [], phoneRaf = 0;
  function phonePath() {
    if (S.phoned || !phone.hidden) return;
    track("Demo phone path");
    $("hook-phone").disabled = true;
    phone.classList.remove("away");
    phone.hidden = false;
    const caps = ["Unlock. Find the app. Scroll…", "Which board was it again?", "The bride sees you scrolling."];
    const time = $("phone-time"), cap = $("phone-cap");
    const total = reduced ? 0 : 2600, t0 = performance.now();
    const tick = (now) => {
      const p = total ? Math.min(1, (now - t0) / total) : 1;
      time.textContent = "0:" + String(Math.round(p * 37)).padStart(2, "0");
      cap.textContent = caps[Math.min(caps.length - 1, Math.floor(p * caps.length))];
      if (p < 1) phoneRaf = requestAnimationFrame(tick);
    };
    tick(t0);
    phoneTimers.push(setTimeout(() => {
      phone.classList.add("away");
      phoneTimers.push(setTimeout(() => { phone.hidden = true; }, reduced ? 0 : 320));
      S.phoned = true;
      ENTER.start();
      if (document.activeElement === $("hook-phone") || document.activeElement === document.body) {
        $("hook-play").focus({ preventScroll: true });
      }
    }, total + (reduced ? 1800 : 700)));
  }
  function stopPhone() {
    phoneTimers.forEach(clearTimeout);
    phoneTimers = [];
    cancelAnimationFrame(phoneRaf);
    phone.hidden = true;
    phone.classList.remove("away");
  }
  $("hook-phone").addEventListener("click", phonePath);
  $("hook-play").addEventListener("click", () => go("playback"));

  /* ----- 2. playback: turn the wheel ----- */
  const NEED_SEEN = 3;
  function showRoll(step, anim) {
    const n = ROLL.length;
    S.roll = (S.roll + step + n) % n;
    const it = ROLL[S.roll];
    show({ kind: "card", item: it, counter: (S.roll + 1) + "/" + n,
           label: "Camera playback, card " + (S.roll + 1) + " of " + n + ": " + it.name }, anim);
    $("pg-label").textContent = "Card " + (S.roll + 1) + " of " + n;
    if (it.card) R.ensureFonts(it.data).then(repaint);
  }
  function turn(step) {
    if (!reduced) restart($("btn-dial"), "spin");
    if (SCENES[at] !== "playback") return;
    showRoll(step, step > 0 ? "slide-next" : "slide-prev");
    S.seen += 1;
    syncSeen();
  }
  function syncSeen() {
    const ok = S.seen >= NEED_SEEN;
    $("pb-count").textContent = Math.min(S.seen, NEED_SEEN) + "/" + NEED_SEEN;
    $("pb-task").classList.toggle("done", ok);
    main.classList.toggle("need-swipe", !ok);
    cue(ok ? [] : ["btn-dial"]);
    if (ok) unlock(true); else lock();
  }

  // Swipe the screen (or tap its left / right side), like scrolling photos.
  let swipe = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointercancel", () => { swipe = null; });
  canvas.addEventListener("pointerup", (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.2) { turn(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return;
    if (SCENES[at] === "playback") {
      const r = canvas.getBoundingClientRect();
      turn(e.clientX < r.left + r.width / 3 ? -1 : 1);
      return;
    }
    // Elsewhere the screen isn't the thing to press: point at the button that is.
    const key = CAM_KEYS.map($).find((b) => b.classList.contains("cue"));
    if (key) nope(key);
  });
  $("btn-dial").addEventListener("click", () => turn(1));
  $("pg-prev").addEventListener("click", () => turn(-1));
  $("pg-next").addEventListener("click", () => turn(1));

  let wheelSum = 0, wheelAt = 0;
  $("cam").addEventListener("wheel", (e) => {
    if (SCENES[at] !== "playback") return;
    e.preventDefault();
    wheelSum += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (Math.abs(wheelSum) >= 60 && now - wheelAt > 180) {
      turn(wheelSum > 0 ? 1 : -1);
      wheelSum = 0;
      wheelAt = now;
    }
  }, { passive: false });

  document.addEventListener("keydown", (e) => {
    if (SCENES[at] !== "playback" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
  });

  /* ----- 3. make a card: tap the lines ----- */
  const chipsBox = $("mk-chips");
  function buildChips() {
    document.querySelectorAll("#mk-types .type").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.type === S.type)));
    if ($("mk-label").value !== S.label) $("mk-label").value = S.label;
    $("mk-prompt").textContent = PROMPT[S.type];
    chipsBox.innerHTML = "";
    CHIPS[S.type].forEach((row, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "type chip";
      b.dataset.i = String(i);
      if (row.time) {
        const t = document.createElement("b");
        t.textContent = row.time;
        b.append(t, row.text);
      } else {
        b.textContent = row.names ? row.names.replace(/^\+\s*/, "") + " · " + row.rel : row.text;
      }
      chipsBox.appendChild(b);
    });
    syncChips();
  }
  function syncChips() {
    const picked = S.picked[S.type], max = R.PER_PAGE[S.type];
    let hinted = false;
    chipsBox.querySelectorAll(".chip").forEach((b) => {
      const on = picked.includes(+b.dataset.i);
      const full = !on && picked.length >= max;
      b.setAttribute("aria-pressed", String(on));
      if (full) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
      // Nothing tapped yet: the first free line pulses after a few idle seconds.
      const hint = !S.built && !on && !full && !hinted;
      b.classList.toggle("hint", hint);
      if (hint) hinted = true;
    });
    $("mk-count").textContent = picked.length + " of " + max + " lines · 1 card";
    syncMake();
  }
  function cardChanged() {
    resetFrom("card");
    syncChips();
    showUser({ badge: "Live preview" });
  }
  chipsBox.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const i = +b.dataset.i, picked = S.picked[S.type];
    const k = picked.indexOf(i);
    if (k >= 0) picked.splice(k, 1);
    else if (picked.length >= R.PER_PAGE[S.type]) {
      nope(b);
      $("mk-count").textContent = R.PER_PAGE[S.type] + " lines fill a card. Untick one to swap it.";
      return;
    } else picked.push(i);
    cardChanged();
  });
  $("mk-types").addEventListener("click", (e) => {
    const b = e.target.closest(".type");
    if (!b || b.dataset.type === S.type) return;
    S.type = b.dataset.type;
    buildChips();
    cardChanged();
  });
  $("mk-label").addEventListener("input", (e) => {
    S.label = e.target.value;
    cardChanged();
  });

  /* ----- 3b. your camera, and "make my card" ----- */
  function pickVendor(v, quiet) {
    if (!VENDOR_KEYS.includes(v)) return;
    if (v !== vendor) {
      resetFrom("camera");
      if (!quiet) track("Demo camera", { camera: v });
    }
    vendor = v;
    $("cam-brand").textContent = VENDORS[v].name;
    syncCta();
  }
  function syncMake() {
    document.querySelectorAll("#d-cameras .cam").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.vendor === vendor)));
    $("d-cameras").classList.toggle("hint", !vendor);
    const make = $("d-make"), st = $("d-make-status");
    const lines = S.picked[S.type].length;
    make.disabled = !vendor || !lines || S.made;
    make.classList.toggle("pulse", !!vendor && !!lines && !S.made);
    make.hidden = S.made;   // once made, the button becomes "Next"
    if (S.made) {
      st.className = "status ok";
      st.textContent = "✓ Your shoot-cards.zip is ready. The card is " + VENDORS[vendor].file + ", the way your " + VENDORS[vendor].name + " names a photo.";
      unlock(true);
    } else {
      st.className = "status";
      st.textContent = !lines ? "Tap at least one line for your card." : !vendor ? "Pick your camera, then make your card." : "";
      lock();
    }
  }
  $("d-cameras").addEventListener("click", (e) => {
    const b = e.target.closest(".cam");
    if (!b) return;
    const changed = b.dataset.vendor !== vendor;
    pickVendor(b.dataset.vendor);
    syncMake();
    if (changed) { blink(); showUser({ badge: "Live preview" }); }
  });
  $("d-make").addEventListener("click", (e) => {
    if (!vendor || S.made) return;
    const make = $("d-make"), st = $("d-make-status");
    make.disabled = true;
    make.classList.remove("pulse");
    st.className = "status";
    st.textContent = "Converting for your " + VENDORS[vendor].name + "…";
    const job = S.job;
    later(900, () => {
      if (S.job !== job) return;   // the card or the camera changed meanwhile
      S.made = true;
      if (SCENES[at] !== "make") return;
      syncMake();
      focusIf(e, nextBtn());
    });
  });

  /* ----- 5. the SD card: drop the file in the right folder ----- */
  const fileBtn = $("pc-file");
  const drops = Array.from(document.querySelectorAll(".pc-drop"));
  function renderCopy() {
    const v = VENDORS[vendor];
    $("zip-folder").textContent = v.zip;
    $("pc-file-name").textContent = v.file;
    $("sd-folder").textContent = v.folder;
    $("sd-test-name").textContent = v.test;
    $("sd-new-name").textContent = v.file;
    $("copy-task").innerHTML = "Drag <b>" + v.file + "</b> into <b>" + v.folder + "</b> on the SD card" +
      (vendor === "nikon" ? ": the folder your camera made, not a new 100NCZ_X." : ".");
    thumb($("pc-thumb"));
    thumb($("sd-thumb"));
    fileBtn.classList.toggle("gone", S.copied);
    fileBtn.classList.toggle("hint", !S.copied);
    fileBtn.disabled = S.copied;
    setArmed(S.armed && !S.copied);
    $("sd-folder").classList.toggle("pulse", !S.copied && S.misses >= 2);
    $("sd-new").hidden = !S.copied;
    $("sd-test").hidden = S.copied && v.clash;
    $("pc-replace").hidden = true;
    $("pc-yes").classList.remove("pulse");
    const ej = $("pc-eject");
    ej.disabled = !S.copied || S.ejected;
    ej.classList.toggle("pulse", S.copied && !S.ejected);
    ej.textContent = S.ejected ? "✓ Ejected" : "⏏︎ Eject";
    $("pc-sd").classList.toggle("out", S.ejected);
    $("copy-fine").hidden = false;
    $("task-copy").classList.toggle("done", S.copied);
    $("task-eject").classList.toggle("done", S.ejected);
    syncSetupTask(false);
    if (S.ejected && !SETUP[vendor].menu) unlock(true); else lock();
  }
  // The third item on the list: the camera's one-time setting (none on a Canon).
  function syncSetupTask(inCamera) {
    const st = SETUP[vendor];
    $("setup-task").innerHTML = inCamera ? st.task : st.todo;
    $("task-setup").classList.toggle("done", S.fixed);
    $("task-setup").classList.toggle("now", inCamera && !S.fixed);
  }
  function setArmed(on) {
    S.armed = on;
    fileBtn.classList.toggle("picked", on);
    drops.forEach((d) => d.classList.toggle("armed", on));
  }
  function drop(target) {
    setArmed(false);
    const v = VENDORS[vendor], kind = target.dataset.drop;
    if (kind === "folder") {
      if (v.clash) askReplace(); else copied(false);
      return;
    }
    S.misses += 1;
    track("Demo mistake", { step: "folder", choice: kind, camera: vendor });
    nope(target);
    note("copy-note", kind === "dcim"
      ? "Almost. One level deeper: into " + v.folder + ", the folder your camera made."
      : "Not loose on the card: the camera only looks inside DCIM › " + v.folder + ".");
    if (S.misses >= 2) $("sd-folder").classList.add("pulse");
  }
  function askReplace() {
    const v = VENDORS[vendor];
    $("pc-replace-q").textContent = "“" + v.file + "” already exists in " + v.folder + ". Replace it?";
    $("pc-replace").hidden = false;
    note("copy-note", "");
    $("pc-yes").focus({ preventScroll: true });
  }
  function copied(replaced) {
    S.copied = true;
    renderCopy();
    note("copy-note", "✓ Copied" + (replaced ? ", over the test shot" : "") + ". Now eject the card.", "ok");
  }

  // Drag the file (pointer events, so it works with a finger too)...
  let drag = null, dragged = false;
  function dropAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest(".pc-drop");
  }
  function cancelDrag() {
    if (drag && drag.ghost) drag.ghost.remove();
    if (drag && drag.over) drag.over.classList.remove("over");
    drag = null;
  }
  fileBtn.addEventListener("pointerdown", (e) => {
    if (S.copied || e.button > 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ghost: null, over: null, dx: 0, dy: 0 };
    try { fileBtn.setPointerCapture(e.pointerId); } catch (_) {}
  });
  fileBtn.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      const r = fileBtn.getBoundingClientRect();
      const g = fileBtn.cloneNode(true);
      g.removeAttribute("id");
      g.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      g.classList.remove("hint", "picked");
      g.classList.add("pc-ghost");
      g.setAttribute("aria-hidden", "true");
      g.style.width = r.width + "px";
      g.querySelector("canvas").getContext("2d").drawImage(fileBtn.querySelector("canvas"), 0, 0);
      document.body.appendChild(g);
      drag.ghost = g;
      drag.dx = drag.x - r.left;
      drag.dy = drag.y - r.top;
      setArmed(true);
    }
    drag.ghost.style.transform = "translate(" + (e.clientX - drag.dx) + "px," + (e.clientY - drag.dy) + "px)";
    const t = dropAt(e.clientX, e.clientY);
    if (t !== drag.over) {
      if (drag.over) drag.over.classList.remove("over");
      if (t) t.classList.add("over");
      drag.over = t;
    }
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasDrag = !!drag.ghost;
    cancelDrag();
    if (!wasDrag) return;               // a tap: the click below picks the file up
    dragged = true;
    setTimeout(() => { dragged = false; }, 60);
    if (cancelled) { setArmed(false); return; }
    const t = dropAt(e.clientX, e.clientY);
    if (t) drop(t);
    else {
      setArmed(false);
      note("copy-note", "Drop it on the " + VENDORS[vendor].folder + " folder on the SD card.");
    }
  }
  fileBtn.addEventListener("pointerup", (e) => endDrag(e, false));
  fileBtn.addEventListener("pointercancel", (e) => endDrag(e, true));

  // ...or tap it, then tap a folder.
  fileBtn.addEventListener("click", () => {
    if (dragged || S.copied) return;
    setArmed(!S.armed);
    note("copy-note", S.armed ? "Now tap the " + VENDORS[vendor].folder + " folder on the SD card." : "");
  });
  drops.forEach((t) => t.addEventListener("click", () => {
    if (S.copied) return;
    if (!S.armed) {
      nope(fileBtn);
      note("copy-note", "First pick up your card in the ZIP: tap it, or drag it over.");
      return;
    }
    drop(t);
  }));
  $("pc-keep").addEventListener("click", () => {
    const v = VENDORS[vendor];
    track("Demo mistake", { step: "replace", choice: "keep", camera: vendor });
    note("copy-note", "“Keep both” renames your card to “" + v.file.replace(".JPG", " 2.JPG") +
      "”, a name the camera ignores. It's only your test shot: replace it.");
    $("pc-yes").classList.add("pulse");
    $("pc-yes").focus({ preventScroll: true });
  });
  $("pc-yes").addEventListener("click", () => copied(true));
  $("pc-eject").addEventListener("click", (e) => {
    if (!S.copied || S.ejected) return;
    const st = SETUP[vendor];
    S.ejected = true;
    if (!st.menu) {                     // Canon: nothing to set, you're done here
      S.fixed = true;
      renderCopy();
      note("copy-note", st.done, "ok");
      focusIf(e, nextBtn());
      return;
    }
    renderCopy();
    note("copy-note", "✓ Safe to remove. Back into the camera it goes…", "ok");
    later(1300, () => {
      if (SCENES[at] !== "copy" || S.fixed) return;
      ENTER.copy();                     // now the camera, for its one setting
      const a = document.activeElement;
      if (!a || a === document.body || pc.contains(a)) $("h-setup").focus({ preventScroll: true });
    });
  });

  /* ----- 4b. the camera's one-time setup (Sony: Recover Image Database) ----- */
  let menuAt = -1;
  function renderSetup() {
    const st = SETUP[vendor];
    $("h-setup").innerHTML = st.title;
    $("setup-text").textContent = st.text;
    syncSetupTask(true);
    note("copy-note", S.fixed ? st.done : "", "ok");
    $("setup-menu").hidden = S.fixed;
    $("copy-fine").hidden = true;
    show(LIVE);
    if (S.fixed) { cue([]); unlock(true); }
    else { cue(["btn-menu"]); lock(); }
  }
  function openMenu(level) {
    const st = SETUP[vendor];
    const lv = st.menu[level];
    menuAt = level;
    $("menu").hidden = false;
    $("menu-confirm").hidden = true;
    const list = $("menu-list");
    list.hidden = false;
    list.innerHTML = "";
    $("menu-crumb").textContent = lv.title;
    const last = level === st.menu.length - 1;
    lv.items.forEach((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "menu-item" + (name === lv.target ? " is-target" : "") + (last ? " leaf" : "");
      b.textContent = name;
      b.dataset.item = name;
      list.appendChild(b);
    });
    $("setup-menu").hidden = true;
    cue([]);
    canvas.setAttribute("aria-label", "Camera menu: " + lv.title);
    return list.querySelector(".is-target");
  }
  function closeMenu() {
    $("menu").hidden = true;
    menuAt = -1;
  }
  const inSetup = () => SCENES[at] === "copy" && main.dataset.phase === "camera";
  function pressMenu(e) {
    if (!inSetup() || S.fixed) return;
    if (menuAt >= 0) { closeMenu(); renderSetup(); return; }   // MENU again leaves the menu
    const t = openMenu(0);
    focusIf(e, t);
  }
  $("btn-menu").addEventListener("click", pressMenu);
  $("setup-menu").addEventListener("click", pressMenu);
  $("menu-list").addEventListener("click", (e) => {
    const b = e.target.closest(".menu-item");
    if (!b || menuAt < 0) return;
    const st = SETUP[vendor], lv = st.menu[menuAt];
    if (b.dataset.item !== lv.target) {
      nope(b);
      note("copy-note", "Not this one: look for “" + lv.target + "”.");
      return;
    }
    note("copy-note", "");
    if (menuAt + 1 < st.menu.length) focusIf(e, openMenu(menuAt + 1));
    else if (st.confirm) confirmMenu(e);
    else finishSetup();
  });
  function confirmMenu(e) {
    const st = SETUP[vendor];
    $("menu-list").hidden = true;
    $("menu-q").textContent = st.confirm;
    $("menu-bar").hidden = true;
    $("menu-bar").classList.remove("run");
    const ok = $("menu-ok");
    ok.hidden = false;
    ok.textContent = st.ok;
    $("menu-confirm").hidden = false;
    focusIf(e, ok);
  }
  $("menu-ok").addEventListener("click", () => {
    const st = SETUP[vendor];
    $("menu-ok").hidden = true;
    $("menu-q").textContent = st.work;
    const bar = $("menu-bar");
    bar.hidden = false;
    void bar.offsetWidth;
    bar.classList.add("run");
    later(1500, finishSetup);
  });
  function finishSetup() {
    if (!inSetup()) return;
    const st = SETUP[vendor];
    S.fixed = true;
    $("menu-list").hidden = true;
    $("menu-bar").hidden = true;
    $("menu-ok").hidden = true;
    $("menu-confirm").hidden = false;
    $("menu-q").textContent = st.done;
    later(900, () => {
      if (!inSetup()) return;
      closeMenu();
      renderSetup();
      const b = nextBtn();
      if (document.activeElement === document.body && b) b.focus({ preventScroll: true });
    });
  }

  /* ----- 5. on the day: press ▶, and your card is there ----- */
  function pressPlay(e) {
    const sid = SCENES[at];
    if (sid === "start") { go("playback"); return; }
    if (sid !== "done" || S.played || S.skipped) return;
    S.played = true;
    cue([]);
    $("shoot-play").disabled = true;
    showUser(vendor ? { file: VENDORS[vendor].file } : {}, "pop");
    later(1100, () => {
      if (SCENES[at] !== "done") return;
      phase("done", "end");
      renderDone();
      if (viaKeys(e) || document.activeElement === document.body) $("h-done").focus({ preventScroll: true });
    });
  }
  $("btn-play").addEventListener("click", pressPlay);
  $("shoot-play").addEventListener("click", pressPlay);
  $("btn-shutter").addEventListener("click", blink);

  /* ----- 5b. the end: your checklist, then the real studio ----- */
  function renderDone(anim) {
    const v = vendor && VENDORS[vendor];
    if (anim) showUser(v ? { file: v.file } : {}, anim);
    if (v) {
      const title = $("recap-title"), box = $("recap");
      title.hidden = false;
      title.textContent = "Your " + v.name + " checklist (it's in the ZIP too)";
      box.innerHTML = "";
      CHECKLIST[vendor].forEach(([lead, rest], i) => {
        const st = document.createElement("div");
        st.className = "st";
        const n = document.createElement("b");
        n.textContent = String(i + 1);
        const s = document.createElement("span");
        const k = document.createElement("strong");
        k.textContent = lead;
        s.append(k, rest);
        st.append(n, s);
        box.appendChild(st);
      });
    }
    if (!reduced) { try { video.play().catch(() => {}); } catch (_) {} }
    if (S.played && !S.completed) {
      S.completed = true;
      track("Demo completed", { camera: vendor || "none", type: S.type, rows: userRows().length });
    }
  }

  // Both "make a card" links open the studio on this card. The card itself
  // travels in localStorage (it would be in the visitor stats in the URL).
  const navCta = document.querySelector(".nav-cta");
  const doneCta = $("done-cta");
  function handoffUrl(always) {
    if (!always && !visited.has("make")) return "/#studio";
    const q = new URLSearchParams({ from: "demo", make: S.type });
    if (vendor) q.set("camera", vendor);
    return "/?" + q.toString() + "#studio";
  }
  function syncCta() {
    doneCta.href = handoffUrl(true);
    if (navCta) navCta.href = handoffUrl(false);
  }
  function handOff(e) {
    const a = e.currentTarget;
    track("Demo to studio", { at: SCENES[at], camera: vendor || "none", type: S.type });
    if (a.getAttribute("href").indexOf("from=demo") < 0) return;
    try {
      localStorage.setItem(HANDOFF, JSON.stringify({
        v: 1, at: Date.now(), type: S.type, vendor, label: S.label, rows: userRows(),
      }));
    } catch (_) {}
  }
  doneCta.addEventListener("click", handOff);
  if (navCta) navCta.addEventListener("click", handOff);

  $("done-replay").addEventListener("click", () => {
    S = fresh();
    go("start");
  });

  /* ---------- moving around ---------- */
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest(".scene-next")) go(SCENES[at + 1]);
  });
  $("d-back").addEventListener("click", () => go(SCENES[Math.max(0, at - 1)]));
  $("d-skip").addEventListener("click", () => {
    track("Demo skipped", { at: SCENES[at] });
    S.skipped = true;
    go("done");
  });
  // A step from the URL. "#setup" (an older support link) opens the camera
  // half of the SD card step, as if the card were already copied.
  function fromHash() {
    let id = location.hash.slice(1);
    if (id === "setup" && vendor) {
      S.made = S.copied = S.ejected = true;
      S.fixed = !SETUP[vendor].menu;
    }
    id = SCENE_ALIAS[id] || id;
    return SCENES.includes(id) ? id : null;
  }
  window.addEventListener("hashchange", () => {
    const raw = location.hash.slice(1), id = fromHash();
    if (id && (id !== SCENES[at] || raw !== id)) go(id);
  });

  // Nothing happening for a few seconds: the next thing to press pulses harder.
  const idle = (function () {
    let t = 0;
    return {
      arm() {
        clearTimeout(t);
        main.classList.remove("idle");
        t = setTimeout(() => main.classList.add("idle"), 4000);
      },
    };
  })();
  ["pointerdown", "keydown", "wheel"].forEach((ev) =>
    document.addEventListener(ev, () => idle.arm(), { passive: true }));
  window.addEventListener("pageshow", (e) => { if (e.persisted) { idle.arm(); syncCta(); } });

  /* ---------- boot ---------- */
  const params = new URLSearchParams(location.search);
  pickVendor(params.get("camera"), true);   // e.g. a support link: /demo?camera=sony#setup
  ["pack-03", "pack-01", "pack-04", "pack-02"].forEach(image);
  R.ensureFonts({ rows: [CHIPS, SAMPLE] }).then(repaint);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(repaint);
  track("Demo started", { ref: (params.get("ref") || "direct").slice(0, 24), camera: vendor || "none" });
  go(fromHash() || "start", { quiet: true });
})();
