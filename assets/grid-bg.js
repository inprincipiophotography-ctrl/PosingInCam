/* Background grid: a faint 40px line grid that drifts slowly, with a brighter
   copy revealed in a circle around the cursor and a pulse of light through
   the squares every few seconds. Pure decoration (aria-hidden,
   no pointer events); the look lives under "background grid" in styles.css. */
(function () {
  var grid = document.createElement("div");
  grid.className = "bg-grid";
  grid.setAttribute("aria-hidden", "true");
  grid.innerHTML =
    '<div class="bg-grid-lines"></div>' +
    '<div class="bg-grid-spot"><div class="bg-grid-lines"></div></div>' +
    '<div class="bg-grid-glow"></div>';
  document.body.prepend(grid);

  var mouse = null;   // the cursor, when there is one: a wave can start there
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) wave();

  // Every 9 s a ring of light runs out through the squares and dies away, like
  // a pulse. Drawn on a canvas only while it runs (1.8 s); nothing between
  // waves, none while the tab is hidden, none with reduced motion.
  function wave() {
    var cv = document.createElement("canvas");
    var g = cv.getContext && cv.getContext("2d");
    if (!g) return;
    cv.className = "bg-grid-wave";
    grid.insertBefore(cv, grid.querySelector(".bg-grid-glow"));
    var lines = grid.querySelector(".bg-grid-lines");
    var EVERY = 9000, RUN = 1800, CELL = 40, DRIFT = 22000, SIGMA = 45, PEAK = 0.11;
    var turn = 0, t0 = 0, ox = 0, oy = 0, reach = 0;

    // The lines drift 40px every 22 s (gridDrift); squares must sit between them.
    function drift() {
      var a = lines.getAnimations ? lines.getAnimations()[0] : null;
      var t = a && a.currentTime != null ? Number(a.currentTime) : 0;
      return (t % DRIFT) / DRIFT * CELL;
    }
    function start() {
      if (document.hidden) { setTimeout(start, EVERY); return; }
      var w = window.innerWidth, h = window.innerHeight, pick = turn++ % 3;
      cv.width = w; cv.height = h;
      if (pick === 0) { ox = w * 0.92; oy = h * 0.06; }        // from the red glow
      else if (pick === 1 && mouse) { ox = mouse[0]; oy = mouse[1]; }
      else { ox = w / 2; oy = h / 2; }
      reach = Math.sqrt(Math.pow(Math.max(ox, w - ox), 2) + Math.pow(Math.max(oy, h - oy), 2)) + 3 * SIGMA;
      t0 = performance.now();
      requestAnimationFrame(frame);
    }
    function frame(now) {
      var p = Math.min(1, (now - t0) / RUN);
      var r = (1 - Math.pow(1 - p, 1.6)) * reach; // a gentle ease-out: the ring travels the whole run
      var fade = Math.pow(1 - p, 1.3);
      var w = cv.width, h = cv.height, d = drift();
      g.clearRect(0, 0, w, h);
      if (p >= 1) { setTimeout(start, EVERY - RUN); return; }
      for (var y = d - CELL; y < h; y += CELL) {
        for (var x = d - CELL; x < w; x += CELL) {
          var dx = x + CELL / 2 - ox, dy = y + CELL / 2 - oy;
          var off = Math.sqrt(dx * dx + dy * dy) - r;
          if (off > 3 * SIGMA || off < -3 * SIGMA) continue;
          g.fillStyle = "rgba(164,0,0," + (PEAK * fade * Math.exp(-off * off / (2 * SIGMA * SIGMA))).toFixed(3) + ")";
          g.fillRect(x + 1, y + 1, CELL - 1, CELL - 1);
        }
      }
      requestAnimationFrame(frame);
    }
    setTimeout(start, 2500);
  }

  // Touch screens have no cursor to follow.
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var spot = grid.querySelector(".bg-grid-spot");
  var x = 0, y = 0, queued = false;
  function paint() {
    queued = false;
    spot.style.setProperty("--mx", x + "px");
    spot.style.setProperty("--my", y + "px");
  }
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    mouse = [x, y];
    grid.classList.add("live");
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  // The cursor left the window: fade the spotlight out where it was.
  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget) { grid.classList.remove("live"); mouse = null; }
  });
})();
