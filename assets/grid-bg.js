/* Background grid: a faint 40px line grid that drifts slowly, with a brighter
   copy revealed in a circle around the cursor. Pure decoration (aria-hidden,
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
    grid.classList.add("live");
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  // The cursor left the window: fade the spotlight out where it was.
  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget) grid.classList.remove("live");
  });
})();
