/* Background grid: a faint 40px line grid that moves like a calm water
   surface. Two slow waves lift and bend the lines, and their crests run
   diagonally across the page a little brighter; a brighter copy shows in a
   circle around the cursor; a soft accent glow sits off the top right.
   Drawn on a canvas at 30 fps, paused while the tab is hidden. With reduced
   motion (or no canvas) it falls back to the still CSS grid in styles.css.
   Pure decoration (aria-hidden, no pointer events). */
(function () {
  var grid = document.createElement("div");
  grid.className = "bg-grid";
  grid.setAttribute("aria-hidden", "true");
  document.body.prepend(grid);
  var glow = '<div class="bg-grid-glow"></div>';
  // Touch screens have no cursor to follow.
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cv = still ? null : document.createElement("canvas");
  var g = cv && cv.getContext ? cv.getContext("2d") : null;

  // The cursor, for the spotlight: calls back with its position, or null when it leaves.
  function follow(cb) {
    if (!fine) return;
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") cb(e.clientX, e.clientY);
    }, { passive: true });
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget) cb(null);
    });
  }

  if (!g) {
    // The still CSS grid, with the spotlight as a masked copy of it.
    grid.innerHTML = '<div class="bg-grid-lines"></div>' +
      '<div class="bg-grid-spot"><div class="bg-grid-lines"></div></div>' + glow;
    var spotEl = grid.querySelector(".bg-grid-spot"), queued = false, sx = 0, sy = 0;
    follow(function (x, y) {
      if (x === null) { grid.classList.remove("live"); return; }
      sx = x; sy = y;
      grid.classList.add("live");
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        spotEl.style.setProperty("--mx", sx + "px");
        spotEl.style.setProperty("--my", sy + "px");
      });
    });
    return;
  }

  cv.className = "bg-grid-canvas";
  grid.appendChild(cv);
  grid.insertAdjacentHTML("beforeend", glow);

  var CELL = 40, STEP = 20, FPS = 30, SPOT = 200;
  var LO = 0.05, HI = 0.14;            // line opacity in the troughs and on the crests
  var DRIFT = CELL / 22;               // px per second, as the old CSS drift
  var hex = (getComputedStyle(document.documentElement).getPropertyValue("--muted") || "").trim() || "#6e6e73";
  var rgb = hex.length === 7
    ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)].join(",")
    : "110,110,115";
  // two waves: amplitude, wavelength, speed (px), direction
  function wave(a, l, v, deg) { return { a: a, k: 2 * Math.PI / l, l: l, v: v, dx: Math.cos(deg * Math.PI / 180), dy: Math.sin(deg * Math.PI / 180) }; }
  var A = wave(7, 520, 55, 35), B = wave(3, 300, 35, -25);
  function lift(x, y, t) {
    return A.a * Math.sin((x * A.dx + y * A.dy - A.v * t) * A.k) +
           B.a * Math.sin((x * B.dx + y * B.dy - B.v * t) * B.k);
  }

  var W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, fine ? 2 : 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  function draw(t) {
    var d = (t * DRIFT) % CELL, x, y, z, first;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.beginPath();
    for (y = d - CELL; y < H + CELL; y += CELL) {
      first = true;
      for (x = -CELL; x <= W + CELL; x += STEP) {
        z = lift(x, y, t);
        if (first) { g.moveTo(x + z * 0.35, y + z); first = false; } else g.lineTo(x + z * 0.35, y + z);
      }
    }
    for (x = d - CELL; x < W + CELL; x += CELL) {
      first = true;
      for (y = -CELL; y <= H + CELL; y += STEP) {
        z = lift(x, y, t);
        if (first) { g.moveTo(x + z * 0.35, y + z); first = false; } else g.lineTo(x + z * 0.35, y + z);
      }
    }
    // the crests of the main wave, a little brighter, running across the page
    var p0 = Math.min(0, W * A.dx, H * A.dy, W * A.dx + H * A.dy);
    var p1 = Math.max(0, W * A.dx, H * A.dy, W * A.dx + H * A.dy);
    var shade = g.createLinearGradient(p0 * A.dx, p0 * A.dy, p1 * A.dx, p1 * A.dy);
    for (var i = 0; i <= 24; i++) {
      var p = p0 + (p1 - p0) * i / 24;
      var c = (1 + Math.sin((p - A.v * t) * A.k)) / 2;
      shade.addColorStop(i / 24, "rgba(" + rgb + "," + (LO + (HI - LO) * c * c).toFixed(3) + ")");
    }
    g.lineWidth = 1;
    g.strokeStyle = shade;
    g.stroke();
    if (spot > 0.01) {
      var ring = g.createRadialGradient(mx, my, 0, mx, my, SPOT);
      ring.addColorStop(0, "rgba(" + rgb + "," + (0.4 * spot).toFixed(3) + ")");
      ring.addColorStop(1, "rgba(" + rgb + ",0)");
      g.strokeStyle = ring;
      g.stroke();
    }
  }

  var mx = -9999, my = -9999, spot = 0, aim = 0;
  follow(function (x, y) {
    if (x === null) { aim = 0; return; }
    mx = x; my = y; aim = 1;
  });

  var t0 = performance.now(), last = 0, running = false;
  function frame(now) {
    if (document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    if (now - last < 1000 / FPS - 2) return;
    last = now;
    spot += (aim - spot) * 0.15;      // the spotlight fades in and out, like the old .4s
    draw((now - t0) / 1000);
  }
  function run() { if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); } }
  size();
  window.addEventListener("resize", size);
  document.addEventListener("visibilitychange", run);
  run();
})();
