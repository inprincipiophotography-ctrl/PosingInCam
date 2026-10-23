"use strict";

/* Shoot Cards demo (/demo): a 40-second film in five chapters.
   Everything in it is drawn in the browser. The camera screen is a canvas
   painted with the studio's own CardRenderer (builder.js), so the card in the
   film is the card the studio makes. The film is a pure function of time
   (render(t)): play, pause, the chapter bar, Skip and links into a chapter all
   just seek. At the end you make the card your own and take it to the studio
   (applyDemoHandoff in app.js). */
(function () {
  const R = window.CardRenderer;
  const $ = (id) => document.getElementById(id);
  const film = $("film");
  if (!R || !film) return;

  // A funnel step for the visitor stats (assets/visits.js). Ad blockers may
  // keep that file away, so the demo never depends on it.
  const track = (name, data) => { if (window.trackEvent) window.trackEvent(name, data); };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  const HANDOFF = "pic_demo_handoff";   // read (and removed) by applyDemoHandoff() in app.js
  const PLAY = "▶︎";

  /* ---------- per camera (keep in step with INSTRUCTIONS in app.js and converter/pack.py) ---------- */
  const VENDORS = {
    sony: { name: "Sony", file: "DSC00001.JPG", folder: "DCIM › 100MSDCF", where: "Into DCIM › 100MSDCF, next to your photos." },
    canon: { name: "Canon", file: "0A0A0001.JPG", folder: "DCIM › 100CANON", where: "Into DCIM › 100CANON, next to your photos." },
    nikon: { name: "Nikon", file: "DSC_0001.JPG", folder: "DCIM › 100NCZ_…", where: "Into the DCIM › 100NCZ_… folder your camera made." },
  };
  const VENDOR_KEYS = Object.keys(VENDORS);

  /* ---------- the film: chapters, words and moves (ms) ---------- */
  const CHAPTERS = [
    { id: "moment", name: "The moment", at: 0 },
    { id: "playback", name: "Playback", at: 8000 },
    { id: "make", name: "Make yours", at: 17000 },
    { id: "sd", name: "SD card", at: 28000 },
    { id: "day", name: "On the day", at: 35000 },
  ];
  const END = 42000;
  // Links into the older, step-by-step demo still land on the right chapter.
  const FROM_HASH = { moment: 0, start: 0, playback: 1, make: 2, camera: 2, sd: 3, copy: 3, setup: 3, day: 4, shoot: 4, done: 4 };

  const HOOK = "4:12&nbsp;pm. The couple is waiting. <em>What's the next pose?</em>";
  const CAPTIONS = [
    { at: 0, title: HOOK, text: "Golden hour is fading, and your mind goes blank." },
    { at: 3200, title: HOOK, text: "So you reach for your phone. Unlock, find the board, scroll…" },
    { at: 5800, title: "There's a faster way. <em>It's already in your hand.</em>", text: "" },
    { at: 8000, title: "Your poses live in <em>playback</em>.", text: "Right next to your photos: the shot, the settings and the words to say." },
    { at: 17000, title: "Make your own <em>in a minute</em>.", text: "Type the names, tap the moments. No Canva, no design." },
    { at: 28000, title: "Copy one folder to your <em>SD card</em>.", text: null },   // per camera: VENDORS[].where
    { at: 35000, title: "Between shots, <em>press play</em>.", text: "The couple is waiting again. This time the plan is in your hand." },
    { at: 38400, title: "Your plan, <em>right there</em>.", text: "No phone, no paper. Nobody sees you scroll." },
  ];

  // 1. the moment: the phone comes up, the seconds tick away
  const PHONE_IN = 1600, PHONE_OUT = 5600, TIMER = [1900, 5200];
  // 2. playback: press play, then turn the wheel through the cards
  const PLAY_1 = 8800, TURNS = [10400, 11900, 13400, 14900];
  // 3. make yours: type the names, tick the moments, pick the camera, make it
  const NAME = "Ana & Marko", TYPE_AT = 17900, TYPE_MS = 95;
  const TICKS = [[19800, 0], [20700, 1], [21600, 2], [22500, 4]];
  const CAM_AT = 23600, GO_AT = 24500, MADE_AT = 25700;
  // 4. SD card: the ZIP goes onto the card, the card goes into the camera
  const COPY_AT = 29200, COPIED_AT = 30300, INSERT_AT = 31500, INSERTED_AT = 32800;
  // 5. on the day: press play, and your card is there
  const PLAY_2 = 36200;

  // Where a finger presses (it glides between taps that follow closely).
  const TAPS = [
    { at: PLAY_1, el: "btn-play" },
    ...TURNS.map((at) => ({ at, el: "btn-dial" })),
    { at: 17600, el: "st-name" },
    ...TICKS.map(([at, i]) => ({ at, el: "chip-" + i })),
    { at: CAM_AT, el: "cam-pill" },
    { at: GO_AT, el: "st-go" },
    { at: 28900, el: "zipchip", to: "sdcard", until: COPY_AT + 950 },
    { at: PLAY_2, el: "btn-play" },
  ];

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
  };
  const ROLL = [
    { img: "pack-03", name: "pose card, Under the veil" },
    { card: "timeline", data: SAMPLE.timeline, name: "timeline card" },
    { img: "pack-01", name: "pose card, Dance and spin" },
    { card: "groups", data: SAMPLE.groups, name: "family groups card" },
    { img: "pack-02", name: "pose card, The first look" },
  ];
  const ROLL_OF = 8;   // the counter reads like a bigger pack: 1/8, 2/8…
  // The lines in the studio (chip-0…chip-5 in the page), as card rows.
  const LINES = [
    { time: "14:00", text: "Getting ready" }, { time: "15:30", text: "First look" },
    { time: "16:30", text: "Ceremony" }, { time: "17:15", text: "Family groups" },
    { time: "18:00", text: "Golden hour portraits" }, { time: "20:00", text: "First dance" }];
  const PICKS = TICKS.map(([, i]) => i).sort((a, b) => a - b);

  /* ---------- state ---------- */
  let vendor = "sony";
  let label = NAME;             // the couple, once you make the card your own
  let t = 0;                    // where the film is (ms)
  let playing = false;
  let raf = 0, lastNow = 0;
  let resumeOnShow = false;
  let watched = false;          // reached the last chapter by watching, not skipping
  const reached = new Set();    // chapters already counted in the visitor stats

  /* ---------- the camera screen ---------- */
  const W = 1920, H = 1280;
  const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
  // Live view is a real photo: a 3:2 crop of the bride in pack-04.jpg (source px),
  // with the camera's focus box on her face.
  const LIVE_SRC = { img: "pack-04", x: 236, y: 250, w: 506, h: 337, face: [462, 300, 70, 84] };
  const screenBox = $("screen");
  const canvas = $("screen-canvas");
  const ctx = canvas.getContext("2d");
  const work = document.createElement("canvas");   // CardRenderer sizes and draws this one
  const IMGS = {};
  let shownKey = null;

  function image(key) {
    if (!IMGS[key]) {
      const img = new Image();
      img.onload = () => { shownKey = null; render(false); };
      img.src = "/assets/showcase/" + key + ".jpg";
      IMGS[key] = img;
    }
    return IMGS[key];
  }
  const loaded = (img) => !!(img && img.complete && img.naturalWidth);

  function restart(el, cls, all) {
    (all || [cls]).forEach((c) => el.classList.remove(c));
    void el.offsetWidth;
    el.classList.add(cls);
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

  function paint(f) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (f.kind === "live") drawLive();
    else if (f.kind === "off") drawOff();
    else drawCard(f);
    canvas.setAttribute("aria-label", f.label);
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

  // The card is out of the camera, in the computer.
  function drawOff() {
    ctx.fillStyle = "#060607";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.font = "600 60px " + SANS;
    ctx.textAlign = "center";
    ctx.fillText("NO MEMORY CARD", W / 2, H / 2 + 20);
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

  /* ---------- the film at time t ---------- */
  const chapterAt = (ms) => { let k = 0; CHAPTERS.forEach((c, i) => { if (ms >= c.at) k = i; }); return k; };
  const turnsBy = (ms) => TURNS.filter((at) => ms >= at).length;
  const typedBy = (ms) => (ms < TYPE_AT ? "" : NAME.slice(0, clamp(Math.floor((ms - TYPE_AT) / TYPE_MS) + 1, 0, NAME.length)));
  const ticksBy = (ms) => TICKS.filter(([at]) => ms >= at).map(([, i]) => i);
  const rowsOf = (picks) => picks.slice().sort((a, b) => a - b).map((i) => Object.assign({}, LINES[i]));

  function myCard(name, picks) {
    return { card: "timeline", data: { label: name, rows: rowsOf(picks) } };
  }

  // What the camera shows: a key (repaint only when it changes) and the frame.
  function screenAt(ms) {
    const LIVE = { key: "live", f: { kind: "live", label: "Camera screen: live view, the bride in the garden at golden hour" } };
    const mine = (name) => ({
      key: "mine:" + name + ":" + vendor,
      f: { kind: "card", item: myCard(name, PICKS), file: VENDORS[vendor].file, label: "Camera playback: your timeline card, " + VENDORS[vendor].file },
    });
    if (ms >= END) return mine(label);
    const c = CHAPTERS[chapterAt(ms)].id;
    if (c === "moment") return LIVE;
    if (c === "playback") {
      if (ms < PLAY_1) return LIVE;
      const i = turnsBy(ms), it = ROLL[i];
      return { key: "roll:" + i, anim: i ? "slide-next" : "pop",
               f: { kind: "card", item: it, counter: (i + 1) + "/" + ROLL_OF, label: "Camera playback, card " + (i + 1) + ": " + it.name } };
    }
    if (c === "make") {
      const name = typedBy(ms), picks = ticksBy(ms);
      return { key: "make:" + name + ":" + picks.join(","),
               f: { kind: "card", item: myCard(name, picks), badge: "Live preview", label: "Camera screen: your timeline card, live preview" } };
    }
    if (c === "sd") return ms < INSERTED_AT ? { key: "off", f: { kind: "off", label: "Camera screen: no memory card" } } : Object.assign({ anim: "flash" }, LIVE);
    return ms < PLAY_2 ? LIVE : Object.assign({ anim: "pop" }, mine(NAME));
  }

  function beatAt(ms) {
    if (ms >= END) return ["end", ""];
    const c = CHAPTERS[chapterAt(ms)].id;
    if (c === "moment") return [c, ms >= PHONE_IN && ms < PHONE_OUT ? "phone" : ""];
    if (c === "playback") return [c, ms >= PLAY_1 ? "on" : ""];
    if (c === "make") return [c, ms >= MADE_AT ? "made" : ""];
    if (c === "sd") return [c, ms >= INSERTED_AT ? "inserted" : ms >= INSERT_AT ? "insert" : ms >= COPIED_AT ? "copied" : ms >= COPY_AT ? "copy" : "zip"];
    return [c, ms >= PLAY_2 ? "on" : ""];
  }

  /* ---------- drawing it ---------- */
  const stage = $("stage");
  const finger = $("finger");
  const cache = {};
  // Write to the page only when a value changes (render runs every frame).
  function put(key, value, apply) {
    if (cache[key] === value) return false;
    cache[key] = value;
    apply(value);
    return true;
  }

  function center(id) {
    const el = id === "cam-pill" ? document.querySelector('#st-cams [data-v="' + vendor + '"]') : $(id);
    if (!el) return null;
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
  }

  // The finger: where it is, how solid, and the ring when it presses.
  function fingerAt(ms) {
    if (reduced || ms >= END) return null;
    const CHAIN = 1700;   // taps closer than this: the finger glides on instead of lifting
    for (let k = 0; k < TAPS.length; k++) {
      const p = TAPS[k], prev = TAPS[k - 1], next = TAPS[k + 1];
      const done = p.until || p.at;
      const chainedIn = !!prev && p.at - (prev.until || prev.at) < CHAIN;
      const chainedOut = !!next && next.at - done < CHAIN;
      const start = chainedIn ? p.at - 200 : p.at - 550;
      const stop = done + (chainedOut ? 220 : 380);
      if (ms < start) return null;
      if (ms <= stop) {
        let pos = center(p.el);
        if (p.to && ms > p.at) {                     // a drag: it carries the thing along
          const b = center(p.to), q = ease(clamp((ms - p.at) / (p.until - p.at), 0, 1));
          if (pos && b) pos = { x: pos.x + (b.x - pos.x) * q, y: pos.y + (b.y - pos.y) * q };
        }
        if (!pos) return null;
        let o = 1;
        if (!chainedIn) o = Math.min(o, clamp((ms - (p.at - 550)) / 220, 0, 1));
        if (!chainedOut) o = Math.min(o, clamp((stop - ms) / 220, 0, 1));
        const down = p.to ? ms >= p.at && ms <= p.until : ms >= p.at && ms < p.at + 170;
        return { x: pos.x, y: pos.y, o, ring: ms < p.at ? 1 : clamp((ms - p.at) / 460, 0, 1), down };
      }
      if (chainedOut && ms < next.at - 200) {        // on its way to the next tap
        const a = center(p.to || p.el), b = center(next.el);
        if (!a || !b) return null;
        const q = ease((ms - stop) / (next.at - 200 - stop));
        return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, o: 1, ring: 1, down: false };
      }
    }
    return null;
  }

  function render(live) {
    const ch = chapterAt(t), chapter = CHAPTERS[ch];
    const [scene, beat] = beatAt(t);
    put("scene", scene, (v) => { film.dataset.scene = v; });
    put("beat", beat, (v) => { film.dataset.beat = v; });

    // the words
    if (t < END) {
      put("n", ch, () => {
        $("cap-n").textContent = String(ch + 1);
        $("cap-ch").textContent = chapter.name;
        $("bar-n").textContent = (ch + 1) + "/" + CHAPTERS.length;
        $("bar-name").textContent = chapter.name;
      });
      let c = CAPTIONS[0];
      CAPTIONS.forEach((x) => { if (t >= x.at) c = x; });
      const text = c.text === null ? VENDORS[vendor].where + " The steps come in the ZIP." : c.text;
      put("cap", c.title + "|" + text, () => {
        $("cap-title").innerHTML = c.title;
        $("cap-text").textContent = text;
        $("cap-text").hidden = !text;
        if (live && !reduced) restart($("cap"), "in");
      });
    }
    $("end").hidden = t < END;

    // the camera screen
    const s = screenAt(t);
    if (s.key !== shownKey) {
      const was = shownKey;
      shownKey = s.key;
      paint(s.f);
      if (live && !reduced && was !== null && s.anim) {
        if (s.anim === "flash") restart(screenBox, "flash");
        else restart(canvas, s.anim, ["slide-next", "pop"]);
      }
    }

    // the wheel turns, a button goes down
    let deg = 0;
    TURNS.forEach((at) => { deg += 36 * ease(clamp((t - at) / 320, 0, 1)); });
    put("wheel", Math.round(deg), (v) => { $("btn-dial").style.transform = "rotate(" + v + "deg)"; });
    const down = (at) => t >= at && t < at + 170;
    put("play-down", down(PLAY_1) || down(PLAY_2), (v) => $("btn-play").classList.toggle("down", v));
    put("dial-down", TURNS.some(down), (v) => $("btn-dial").classList.toggle("down", v));

    // 1. the phone
    const tp = clamp((t - TIMER[0]) / (TIMER[1] - TIMER[0]), 0, 1);
    put("timer", Math.round(tp * 37), (v) => { $("phone-time").textContent = "0:" + String(v).padStart(2, "0"); });
    put("feed", Math.round(tp * 400), (v) => { $("phone-grid").style.transform = "translateY(" + (-v / 10) + "%)"; });

    // 3. the studio
    const typed = typedBy(t), picks = ticksBy(t);
    put("typed", typed, (v) => { $("st-name").textContent = v; });
    put("typing", t >= 17400 && t < TYPE_AT + NAME.length * TYPE_MS + 500, (v) => $("studio").classList.toggle("typing", v));
    put("picks", picks.join(","), () => {
      LINES.forEach((_, i) => $("chip-" + i).classList.toggle("on", picks.includes(i)));
    });
    put("cam-on", (t >= CAM_AT ? vendor : "") + ":" + vendor, () => {
      document.querySelectorAll("#st-cams [data-v]").forEach((b) => b.classList.toggle("on", t >= CAM_AT && b.dataset.v === vendor));
    });
    const go = t >= MADE_AT ? "made" : t >= GO_AT ? "busy" : "idle";
    put("go", go, (v) => {
      const b = $("st-go");
      b.className = "studio-go is-" + v;
      b.textContent = v === "made" ? "✓ shoot-cards.zip" : v === "busy" ? "Converting…" : "Make my card →";
    });

    // the finger
    const f = fingerAt(t);
    if (f) {
      finger.style.transform = "translate(" + f.x.toFixed(1) + "px," + f.y.toFixed(1) + "px)";
      finger.style.opacity = f.o.toFixed(3);
      finger.style.setProperty("--ring", f.ring.toFixed(3));
      finger.classList.toggle("down", f.down);
    } else if (cache.finger !== "off") {
      finger.style.opacity = "0";
    }
    cache.finger = f ? "on" : "off";

    // the chapter bar
    CHAPTERS.forEach((c, k) => {
      const to = (CHAPTERS[k + 1] || { at: END }).at;
      const w = clamp((t - c.at) / (to - c.at), 0, 1);
      put("fill" + k, Math.round(w * 1000), (v) => { bars[k].fill.style.transform = "scaleX(" + v / 1000 + ")"; });
      put("now" + k, t < END && k === ch, (v) => {
        bars[k].btn.classList.toggle("now", v);
        if (v) bars[k].btn.setAttribute("aria-current", "step"); else bars[k].btn.removeAttribute("aria-current");
      });
    });
    const state = playing ? "pause" : t >= END ? "replay" : "play";
    put("btn", state, (v) => {
      const b = $("bar-play");
      b.dataset.state = v;
      b.setAttribute("aria-label", v === "pause" ? "Pause" : v === "replay" ? "Watch again" : "Play");
    });

    // reaching a chapter: count it once, and keep it in the link
    const id = t >= END ? "end" : chapter.id;
    put("hash", id, (v) => {
      try { history.replaceState(null, "", location.pathname + location.search + "#" + v); } catch (_) {}
      if (v !== "end" && !reached.has(v)) {
        reached.add(v);
        track("Demo step", { step: v });
      }
    });
  }
  const bars = Array.from(document.querySelectorAll("#bar-chs .ch")).map((btn) => ({ btn, fill: btn.querySelector(".ch-track i") }));

  /* ---------- play, pause, seek ---------- */
  function tick(now) {
    if (!playing) return;
    t = Math.min(END, t + Math.min(100, now - lastNow));
    lastNow = now;
    if (t >= PLAY_2) watched = watched || chapterAt(t - 1) === 4;
    if (t >= END) {
      playing = false;
      render(true);
      ended();
      return;
    }
    render(true);
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (playing) return;
    if (t >= END) seek(0);
    playing = true;
    lastNow = performance.now();
    render(false);
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    render(false);
  }
  // A jump: everything goes straight to where it is at that moment.
  function seek(ms) {
    t = clamp(ms, 0, END);
    film.classList.add("cut");
    render(false);
    void film.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => film.classList.remove("cut")));
  }
  function ended() {
    if (watched) {
      watched = false;
      track("Demo completed", { camera: vendor });
    }
  }

  $("bar-play").addEventListener("click", () => { if (playing) pause(); else play(); });
  $("bar-chs").addEventListener("click", (e) => {
    const b = e.target.closest(".ch");
    if (!b) return;
    seek(CHAPTERS[+b.dataset.ch].at);
    play();
  });
  $("bar-skip").addEventListener("click", (e) => {
    track("Demo skipped", { at: t >= END ? "end" : CHAPTERS[chapterAt(t)].id });
    pause();
    seek(END);
    if (e.detail === 0) $("h-end").focus({ preventScroll: true });   // keyboard: on to the end panel
  });
  $("end-replay").addEventListener("click", () => { seek(0); play(); });

  // Space (or K) plays and pauses, as in a video player.
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest("input, textarea, button, a, select")) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      if (playing) pause(); else play();
    }
  });
  // A hidden tab doesn't play to nobody.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing) { resumeOnShow = true; pause(); }
    else if (!document.hidden && resumeOnShow) { resumeOnShow = false; play(); }
  });
  window.addEventListener("resize", () => render(false));

  /* ---------- the end: make it yours, take it to the studio ---------- */
  function setVendor(v) {
    if (!VENDOR_KEYS.includes(v)) return;
    vendor = v;
    const V = VENDORS[v];
    $("cam-brand").textContent = V.name;
    $("zip-file").textContent = V.file;
    $("sd-folder").textContent = V.folder;
    document.querySelectorAll("#end-cams .cam").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vendor === v)));
    syncCta();
    shownKey = null;
    cache.cap = cache["cam-on"] = null;
    render(false);
  }
  function syncCta() {
    $("end-cta").href = "/?" + new URLSearchParams({ from: "demo", make: "timeline", camera: vendor }).toString() + "#studio";
  }
  function zipThumb() {
    const c = $("zip-thumb");
    R.draw(work, "timeline", myCard(NAME, PICKS).data, 0);
    c.getContext("2d").drawImage(work, 0, 0, c.width, c.height);
  }

  $("end-name").addEventListener("input", (e) => {
    label = e.target.value;
    render(false);
  });
  $("end-cams").addEventListener("click", (e) => {
    const b = e.target.closest(".cam");
    if (!b || b.dataset.vendor === vendor) return;
    track("Demo camera", { camera: b.dataset.vendor });
    setVendor(b.dataset.vendor);
  });
  // The card travels in localStorage (in the URL it would be in the visitor stats).
  $("end-cta").addEventListener("click", () => {
    track("Demo to studio", { at: "end", camera: vendor, type: "timeline" });
    try {
      localStorage.setItem(HANDOFF, JSON.stringify({
        v: 1, at: Date.now(), type: "timeline", vendor, label, rows: rowsOf(PICKS),
      }));
    } catch (_) {}
  });
  const navCta = document.querySelector(".nav-cta");
  if (navCta) navCta.addEventListener("click", () => {
    track("Demo to studio", { at: t >= END ? "end" : CHAPTERS[chapterAt(t)].id, camera: vendor, type: "none" });
  });

  /* ---------- start ---------- */
  const params = new URLSearchParams(location.search);
  const h = location.hash.slice(1);   // read before the first render rewrites the link
  setVendor(VENDOR_KEYS.includes(params.get("camera")) ? params.get("camera") : "sony");
  [LIVE_SRC.img].concat(ROLL.filter((r) => r.img).map((r) => r.img)).forEach(image);
  R.ensureFonts({ rows: [LINES, SAMPLE] }).then(() => { shownKey = null; zipThumb(); render(false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { shownKey = null; render(false); });
  zipThumb();
  track("Demo started", { ref: (params.get("ref") || "direct").slice(0, 24), camera: vendor });
  seek(h === "end" ? END : h in FROM_HASH ? CHAPTERS[FROM_HASH[h]].at : 0);
  if (!reduced && t < END) setTimeout(play, 400);
})();
