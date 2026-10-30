/* Shoot Cards · motion: one small system, used the same way everywhere.
   - headlines rise in word by word as they come into view
   - cards catch a soft light where the cursor is and tilt a little towards it
   - the main buttons lean towards the cursor (magnetic)
   - the camera picker's selection slides between Sony, Canon and Nikon
   - grids unfold like a paper map
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

  // ---------- the reel: one seamless loop at any window width ----------
  // The track scrolls by exactly one set; enough copies follow it that the
  // window never sees an edge, so the end runs into the start with no seam.
  Array.prototype.forEach.call(document.querySelectorAll(".reel-track"), function (track) {
    var set = track.querySelector(".reel-set");
    if (!set) return;
    function fit() {
      var w = set.getBoundingClientRect().width;
      if (!w) return;
      while (track.children.length < 2 || (track.children.length - 1) * w < window.innerWidth + 40) {
        track.appendChild(set.cloneNode(true));
      }
      track.style.setProperty("--reel-shift", w + "px");
      track.style.setProperty("--reel-time", Math.round(w / 38) + "s");   // ~38px a second
    }
    fit();
    window.addEventListener("resize", fit);
  });

  // ---------- grids unfold like a paper map ----------
  // Centre first, then the plus around it, then the corners: each item gets
  // its ring number as --d, and the CSS staggers the spring by it.
  function unfold(grid) {
    var items = Array.prototype.filter.call(grid.children, function (el) { return el.offsetWidth; });
    if (!items.length) return;
    var rects = items.map(function (el) { return el.getBoundingClientRect(); });
    var left = Math.min.apply(null, rects.map(function (r) { return r.left; }));
    var right = Math.max.apply(null, rects.map(function (r) { return r.right; }));
    var top = Math.min.apply(null, rects.map(function (r) { return r.top; }));
    var bottom = Math.max.apply(null, rects.map(function (r) { return r.bottom; }));
    var cx = (left + right) / 2, cy = (top + bottom) / 2;
    var ds = rects.map(function (r) {
      return Math.round((Math.abs((r.left + r.width / 2 - cx) / r.width) + Math.abs((r.top + r.height / 2 - cy) / r.height)) * 2) / 2;
    });
    // one column (phones): no centre to start from, each item unfolds as it arrives
    if (rects.every(function (r) { return Math.abs(r.left - rects[0].left) < 2; })) ds = ds.map(function () { return 0; });
    var rings = ds.slice().sort(function (a, b) { return a - b; }).filter(function (d, i, all) { return i === 0 || d !== all[i - 1]; });
    items.forEach(function (el, i) {
      el.style.setProperty("--d", String(rings.indexOf(ds[i])));
      el.style.transitionDelay = "";
      el.classList.add("unfold-item");
    });
  }
  if (!reduce) {
    Array.prototype.forEach.call(document.querySelectorAll(".tiles"), unfold);
    var prices = document.querySelector(".price-grid");
    if (prices) {
      // the price cards arrive from /api/prices: unfold them once they're in
      var mo = new MutationObserver(function () { if (prices.children.length) { unfold(prices); mo.disconnect(); } });
      mo.observe(prices, { childList: true });
      if (prices.children.length) unfold(prices);
    }
  }

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
