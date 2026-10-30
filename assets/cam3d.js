// Shoot Cards · 3D camera loader.
// Every [data-cam3d] camera is drawn in CSS first. When one comes on screen and
// the browser has WebGL2, the three.js scene is loaded and takes over its look;
// the CSS camera stays underneath for layout, state and as the fallback.
const hosts = document.querySelectorAll("[data-cam3d]");

function webgl2() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch (_) { return false; }
}

if (hosts.length && "IntersectionObserver" in window && webgl2()) {
  let scene = null;
  const load = () => (scene = scene || import("./cam3d-scene.js"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      load().then((m) => m.mount(e.target)).catch(() => {});
    });
  }, { rootMargin: "200px" });
  hosts.forEach((h) => io.observe(h));
  // The homepage camera only appears once you start a card: start loading on
  // the first touch of the studio, so it is ready by the time it shows.
  const studio = document.getElementById("studio");
  if (studio && matchMedia("(min-width: 981px)").matches) {
    const early = () => { load().catch(() => {}); studio.removeEventListener("pointerdown", early); studio.removeEventListener("focusin", early); };
    studio.addEventListener("pointerdown", early, { passive: true });
    studio.addEventListener("focusin", early);
  }
}
