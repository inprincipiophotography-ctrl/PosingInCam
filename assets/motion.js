/* Shoot Cards · motion: one small system, used the same way everywhere.
   - headlines rise in word by word as they come into view
   - cards catch a soft light where the cursor is and tilt a little towards it
   - the main buttons lean towards the cursor (magnetic)
   - the camera picker's selection slides between Sony, Canon and Nikon
   Decoration only: nothing here changes content or behaviour. With reduced
   motion the headlines simply show and nothing tilts, leans or slides; touch
   screens get no cursor effects. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // ---------- headlines, word by word ----------
  function split(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement("span"), inner = document.createElement("span");
            w.className = "w";
            inner.textContent = part;
            inner.style.setProperty("--i", String(i++));
            w.appendChild(inner);
            frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    el.classList.add("split");
  }
  if (!reduce && "IntersectionObserver" in window) {
    var heads = document.querySelectorAll(".pitch h1, .section-h, .final-card h2");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("lit"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    Array.prototype.forEach.call(heads, function (h) { split(h); io.observe(h); });
  }

  // ---------- the camera picker's sliding selection ----------
  Array.prototype.forEach.call(document.querySelectorAll(".cameras"), function (group) {
    var ind = document.createElement("span");
    ind.className = "cam-ind";
    ind.setAttribute("aria-hidden", "true");
    group.insertBefore(ind, group.firstChild);
    group.classList.add("has-ind");
    function place() {
      var on = group.querySelector('.cam[aria-pressed="true"]');
      ind.style.opacity = on ? "1" : "0";
      if (!on) return;
      ind.style.width = on.offsetWidth + "px";
      ind.style.transform = "translateX(" + (on.offsetLeft - 3) + "px)";
    }
    place();
    new MutationObserver(place).observe(group, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    window.addEventListener("resize", place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  });

  if (!fine) return;

  // ---------- cursor light and tilt on cards; magnetic buttons ----------
  var LIT = ".proj, .tile, .price-card, .faq-list";
  var TILT = ".proj:not(.open), .tile, .price-card";
  var MAG = ".go, .final-btn, .nav-cta";
  var MAX_TILT = 5, MAX_PULL = 6;
  var ev = null, raf = 0, lastLit = null, lastMag = null;

  function frame() {
    raf = 0;
    var t = ev.target && ev.target.closest ? ev.target : null;
    var lit = t && t.closest(LIT), mag = t && t.closest(MAG);
    if (lastLit && lastLit !== lit) { lastLit.style.removeProperty("--rx"); lastLit.style.removeProperty("--ry"); }
    if (lastMag && lastMag !== mag) lastMag.style.translate = "";
    lastLit = lit; lastMag = mag;
    if (lit) {
      var r = lit.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      lit.style.setProperty("--mx", x + "px");
      lit.style.setProperty("--my", y + "px");
      if (!reduce && lit.matches(TILT)) {
        lit.style.setProperty("--ry", ((x / r.width - 0.5) * 2 * MAX_TILT).toFixed(2) + "deg");
        lit.style.setProperty("--rx", ((0.5 - y / r.height) * 2 * MAX_TILT).toFixed(2) + "deg");
      }
    }
    if (mag && !reduce && !mag.disabled) {
      var b = mag.getBoundingClientRect();
      var dx = (ev.clientX - (b.left + b.width / 2)) * 0.2, dy = (ev.clientY - (b.top + b.height / 2)) * 0.3;
      dx = Math.max(-MAX_PULL, Math.min(MAX_PULL, dx));
      dy = Math.max(-MAX_PULL, Math.min(MAX_PULL, dy));
      mag.style.translate = dx.toFixed(1) + "px " + dy.toFixed(1) + "px";
    }
  }
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    ev = e;
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  document.addEventListener("mouseout", function (e) {
    if (e.relatedTarget) return;
    if (lastLit) { lastLit.style.removeProperty("--rx"); lastLit.style.removeProperty("--ry"); }
    if (lastMag) lastMag.style.translate = "";
    lastLit = lastMag = null;
  });
})();
