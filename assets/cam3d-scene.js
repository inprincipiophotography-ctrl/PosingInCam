// Shoot Cards · the camera in 3D (three.js).
// A mirrorless body seen from the back, built from code, no model files. It is
// measured off the CSS camera it covers, so its screen lands where the CSS screen
// is (the demo's drag targets still point at that canvas). The CSS camera keeps
// drawing the screen, turning the wheel and pressing keys; this scene reads that
// state and only renders when something changes.
import * as THREE from "./vendor/three/three.module.min.js";
import { RoundedBoxGeometry } from "./vendor/three/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "./vendor/three/addons/RoomEnvironment.js";

const DEG = Math.PI / 180;
const FOV = 16;
const BASE = { x: 7 * DEG, y: -10 * DEG };   // a little from above, grip side turned in
const TILT = { x: 4 * DEG, y: 7 * DEG };     // how far the mouse can turn it
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;

// ---------- textures drawn once, shared by every camera on the page ----------

const cache = new Map();
function once(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

function canvas2d(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

// Tileable value noise, the grain of leatherette and of the magnesium body.
function grain(size, cells, seed) {
  const rnd = (i, j) => {
    const n = Math.sin(((i % cells) + cells) % cells * 127.1 + (((j % cells) + cells) % cells) * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / size * cells, fy = y / size * cells;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = rnd(i, j), b = rnd(i + 1, j), c = rnd(i, j + 1), d = rnd(i + 1, j + 1);
    out[y * size + x] = a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  }
  return out;
}

function normalMap(key, cellsA, cellsB, strength) {
  return once(key, () => {
    const S = 256, h1 = grain(S, cellsA, 1), h2 = grain(S, cellsB, 2);
    const h = (x, y) => { const i = ((y + S) % S) * S + ((x + S) % S); return h1[i] * 0.65 + h2[i] * 0.35; };
    const [c, g] = canvas2d(S, S), img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1), o = (y * S + x) * 4;
      img.data[o] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[o + 1] = (-dy / l * 0.5 + 0.5) * 255;
      img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

// A key's face: a dark domed button with its label, like the CSS one.
function keyFace(label, w, h, round) {
  return once("key:" + label + w + "x" + h, () => {
    const s = 4, [c, g] = canvas2d(w * s, h * s);
    const gr = g.createRadialGradient(c.width * 0.36, c.height * 0.3, 0, c.width * 0.5, c.height * 0.5, Math.max(c.width, c.height) * 0.62);
    gr.addColorStop(0, "#56565c"); gr.addColorStop(0.62, "#29292d"); gr.addColorStop(1, "#1d1d20");
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    if (label === "play") {
      const cx = c.width * 0.53, cy = c.height / 2, r = c.height * 0.2;
      g.fillStyle = "#e1e1e6";
      g.beginPath(); g.moveTo(cx - r * 0.75, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx - r * 0.75, cy + r); g.closePath(); g.fill();
    } else if (label) {
      g.fillStyle = round ? "#9a9aa1" : "#d4d4d9";
      g.font = "700 " + Math.round(c.height * (round ? 0.27 : 0.32)) + "px Inter, system-ui, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      if ("letterSpacing" in g) g.letterSpacing = "1px";
      g.fillText(label, c.width / 2, c.height / 2 + c.height * 0.02);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

// The control wheel's ridged face (seen from the back) and the dials' knurled edges.
function wheelFace() {
  return once("wheel", () => {
    const [c, g] = canvas2d(512, 512), r = 256;
    for (let a = 0; a < 360; a += 5) {
      g.fillStyle = (a / 5) % 2 ? "#3d3d42" : "#26262a";
      g.beginPath(); g.moveTo(r, r); g.arc(r, r, r, a * DEG, (a + 5) * DEG); g.closePath(); g.fill();
    }
    const shade = g.createRadialGradient(r * 0.8, r * 0.7, 0, r, r, r);
    shade.addColorStop(0, "rgba(255,255,255,.06)"); shade.addColorStop(1, "rgba(0,0,0,.35)");
    g.fillStyle = shade; g.beginPath(); g.arc(r, r, r, 0, 7); g.fill();
    g.strokeStyle = "#18181b"; g.lineWidth = 18; g.beginPath(); g.arc(r, r, r - 9, 0, 7); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

function knurl() {
  return once("knurl", () => {
    const [c, g] = canvas2d(256, 16);
    for (let x = 0; x < 256; x += 4) { g.fillStyle = (x / 4) % 2 ? "#3c3c41" : "#232326"; g.fillRect(x, 0, 4, 16); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  });
}

// The viewfinder glass: a deep green-black eye, as in the CSS.
function eyeGlass() {
  return once("eye", () => {
    const [c, g] = canvas2d(256, 160);
    g.fillStyle = "#09090a"; g.fillRect(0, 0, 256, 160);
    const e = g.createRadialGradient(128, 72, 0, 128, 72, 120);
    e.addColorStop(0, "#21443b"); e.addColorStop(0.22, "#132823"); e.addColorStop(0.45, "#0a0b0c"); e.addColorStop(1, "#08080a");
    g.fillStyle = e; g.fillRect(0, 0, 256, 160);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// A soft shadow on whatever the camera floats over.
function softShadow() {
  return once("shadow", () => {
    const [c, g] = canvas2d(256, 256);
    const s = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    s.addColorStop(0, "rgba(14,18,10,.55)"); s.addColorStop(0.55, "rgba(14,18,10,.22)"); s.addColorStop(1, "rgba(14,18,10,0)");
    g.fillStyle = s; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  });
}

// The light catching the screen glass, the same diagonal as the CSS sheen.
function sheen() {
  return once("sheen", () => {
    const [c, g] = canvas2d(256, 256);
    const s = g.createLinearGradient(0, 0, 256, 120);
    s.addColorStop(0, "rgba(255,255,255,.16)"); s.addColorStop(0.32, "rgba(255,255,255,.03)"); s.addColorStop(0.33, "rgba(255,255,255,0)");
    g.fillStyle = s; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// ---------- measuring the CSS camera ----------

// Layout boxes relative to the host, before any CSS transform (the demo turns
// and scales the whole camera; the model turns with it inside .cam-wrap).
function box(el, host) {
  let x = 0, y = 0, n = el;
  while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function pseudoBox(host, which) {
  const cs = getComputedStyle(host, which);
  if (!cs || cs.content === "none" || cs.display === "none") return null;
  const n = (v) => parseFloat(v) || 0;
  return { x: n(cs.left), y: n(cs.top), w: n(cs.width), h: n(cs.height) };
}

function measure(host, variant) {
  const W = host.offsetWidth, H = host.offsetHeight;
  const cs = getComputedStyle(host);
  const m = { W, H, radius: parseFloat(cs.borderTopLeftRadius) || 20, keys: [] };
  if (variant === "demo") {
    m.bezel = box(host.querySelector(".dcam-screen"), host);
    m.display = box(host.querySelector(".dcam-screen canvas"), host);
    m.hump = box(host.querySelector(".dcam-evf"), host);
    m.eye = box(host.querySelector(".dcam-evf i"), host);
    m.dial = box(host.querySelector(".dcam-dial"), host);
    m.shutter = box(host.querySelector(".dcam-shutter"), host);
    m.grip = pseudoBox(host, "::before");
    host.querySelectorAll(".dcam-keys > *").forEach((el) => {
      const b = box(el, host);
      const kind = el.classList.contains("dwheel") ? "wheel" : el.classList.contains("dkey-play") ? "play"
        : el.classList.contains("dkey-menu") ? "pill" : "round";
      m.keys.push({ el, kind, label: kind === "play" ? "play" : el.textContent.trim(), ...b });
    });
    m.screenColor = 0x000000;
  } else {
    m.bezel = box(host.querySelector(".cam-screen"), host);
    m.display = box(host.querySelector(".cam-screen canvas"), host);
    m.hump = pseudoBox(host, "::before");
    host.querySelectorAll(".cam-buttons i").forEach((el) => {
      const kind = el.classList.contains("dial") ? "wheel" : el.classList.contains("play") ? "play" : "round";
      m.keys.push({ el, kind, label: kind === "play" ? "play" : "", ...box(el, host) });
    });
    m.screenColor = 0xffffff;
  }
  return m;
}

// ---------- the model ----------

function build(m, mats) {
  const g = new THREE.Group();
  const { W, H } = m;
  const D = Math.round(H * 0.42);                 // body depth, back face at z = 0
  const at = (b) => [b.x + b.w / 2 - W / 2, H / 2 - (b.y + b.h / 2)];
  const add = (geo, mat, x, y, z, setup) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (setup) setup(mesh);
    g.add(mesh);
    return mesh;
  };
  const rbox = (w, h, d, r, seg = 5) => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.5, Math.min(r, w / 2 - 0.1, h / 2 - 0.1, d / 2 - 0.1)));

  // body, and the grip that bulges out the front under the right hand
  add(rbox(W, H, D, Math.min(m.radius, D * 0.48), 8), mats.body, 0, 0, -D / 2);
  const gw = W * 0.2, gd = D * 0.62;
  add(rbox(gw, H * 0.94, gd + D * 0.3, gw * 0.42, 8), mats.leather, W / 2 - gw / 2 - W * 0.012, -H * 0.02, -D - gd / 2 + D * 0.15);
  // the lens, mostly hidden behind the body; it shows when the camera turns
  const lr = H * 0.34, ll = H * 0.62;
  add(new THREE.CylinderGeometry(lr, lr * 0.96, ll, 64, 1), mats.lens, -W * 0.08, -H * 0.06, -D - ll / 2 + 2, (o) => { o.rotation.x = Math.PI / 2; });
  add(new THREE.TorusGeometry(lr * 0.99, lr * 0.05, 12, 64), mats.metal, -W * 0.08, -H * 0.06, -D - ll * 0.18);
  // strap lugs
  [-1, 1].forEach((s) => add(new THREE.TorusGeometry(H * 0.022, H * 0.007, 10, 24), mats.lug,
    s * (W / 2 + H * 0.006), H * 0.26, -D * 0.42, (o) => { o.rotation.y = Math.PI / 2; }));

  // thumb rest on the back, with the leather grain
  if (m.grip && m.grip.w > 0) {
    const [x, y] = at(m.grip);
    add(rbox(m.grip.w, m.grip.h, 6, Math.min(m.grip.w * 0.45, 30)), mats.leather, x - 1, y, 1);
  }

  // the viewfinder hump and its rubber eyecup
  if (m.hump && m.hump.w > 0) {
    const side = m.hump.x < 0 ? "left" : "top";
    const [x, y] = at(m.hump);
    if (side === "top") {
      const h = m.hump.h + H * 0.06;
      add(rbox(m.hump.w, h, D * 0.82, Math.min(m.hump.w, h) * 0.24), mats.top, x, y - H * 0.03, -D * 0.42);
      const cupH = m.eye ? m.eye.h * 1.3 : m.hump.h * 0.86, cupW = m.eye ? m.eye.w * 1.18 : m.hump.w * 0.82;
      const cy = m.eye ? at(m.eye)[1] : y;
      add(rbox(cupW, cupH, H * 0.13, cupH * 0.32), mats.rubber, x, cy, H * 0.065 - 2);
      const gw = m.eye ? m.eye.w * 0.92 : cupW * 0.72, gh = m.eye ? m.eye.h * 0.86 : cupH * 0.62;
      add(new THREE.PlaneGeometry(gw, gh), mats.eye, x, cy, H * 0.13 - 1.6);
    } else {
      const w = m.hump.w + H * 0.06;
      add(rbox(w, m.hump.h, D * 0.82, Math.min(w, m.hump.h) * 0.24), mats.top, x + H * 0.03, y, -D * 0.42);
      add(rbox(w * 0.7, m.hump.h * 0.78, H * 0.1, m.hump.h * 0.2), mats.rubber, x, y, H * 0.05 - 2);
      add(new THREE.PlaneGeometry(w * 0.5, m.hump.h * 0.5), mats.eye, x, y, H * 0.1 - 1.6);
    }
  }

  // the top plate: mode dial, shutter button with its silver collar
  if (m.dial) {
    const [x] = at(m.dial), r = m.dial.w / 2, h = m.dial.h;
    add(new THREE.CylinderGeometry(r, r, h, 64, 1), [mats.knurl, mats.top, mats.top], x, H / 2 + h / 2 - 3, -D * 0.4);
  }
  if (m.shutter) {
    const [x] = at(m.shutter), r = m.shutter.w / 2, h = m.shutter.h;
    add(new THREE.CylinderGeometry(r, r, h * 0.55, 48, 1), mats.metal, x, H / 2 + h * 0.2, -D * 0.62);
    add(new THREE.CylinderGeometry(r * 0.62, r * 0.66, h, 48, 1), mats.button, x, H / 2 + h * 0.5, -D * 0.62);
  }

  // the screen: bezel, the live card, glass on top
  const [bx, by] = at(m.bezel), [dx, dy] = at(m.display);
  const bez = add(rbox(m.bezel.w + 6, m.bezel.h + 6, 3, Math.min(14, m.bezel.h * 0.05)), mats.bezel, bx, by, 1.5);
  bez.renderOrder = 0;
  add(new THREE.PlaneGeometry(m.display.w + 2, m.display.h + 2), new THREE.MeshBasicMaterial({ color: m.screenColor }), dx, dy, 3.05);
  const screen = add(new THREE.PlaneGeometry(m.display.w, m.display.h), mats.screen, dx, dy, 3.1);
  add(new THREE.PlaneGeometry(m.bezel.w, m.bezel.h), mats.glass, bx, by, 3.3);
  add(new THREE.PlaneGeometry(m.bezel.w, m.bezel.h), mats.sheen, bx, by, 3.35);

  // keys and the control wheel
  const keys = [];
  m.keys.forEach((k) => {
    const [x, y] = at(k), node = new THREE.Group();
    node.position.set(x, y, 0);
    g.add(node);
    if (k.kind === "wheel") {
      const r = k.w / 2, spin = new THREE.Group();
      node.add(spin);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, 5, 72, 1), [mats.knurl, mats.button, mats.button]);
      rim.rotation.x = Math.PI / 2; rim.position.z = 2.5; spin.add(rim);
      const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.985, 72), new THREE.MeshStandardMaterial({ map: wheelFace(), roughness: 0.42, metalness: 0.35 }));
      face.position.z = 5.05; spin.add(face);
      const ok = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.46, r * 0.47, 7, 48, 1), mats.button);
      ok.rotation.x = Math.PI / 2; ok.position.z = 3.5; node.add(ok);
      const okFace = new THREE.Mesh(new THREE.CircleGeometry(r * 0.455, 48), new THREE.MeshStandardMaterial({ map: keyFace("", 64, 64, true), roughness: 0.35, metalness: 0.25 }));
      okFace.position.z = 7.05; node.add(okFace);
      keys.push({ k, node, spin, faces: [face.material, okFace.material] });
    } else {
      const pill = k.kind === "pill", depth = 4.5;
      const body = pill
        ? new THREE.Mesh(rbox(k.w, k.h, depth, k.h * 0.3), mats.button)
        : new THREE.Mesh(new THREE.CylinderGeometry(k.w / 2, k.w / 2 * 1.05, depth, 48, 1), mats.button);
      if (!pill) body.rotation.x = Math.PI / 2;
      body.position.z = depth / 2; node.add(body);
      const faceGeo = pill ? new THREE.PlaneGeometry(k.w * 0.94, k.h * 0.86) : new THREE.CircleGeometry(k.w / 2 * 0.97, 48);
      const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({
        map: keyFace(k.label, Math.round(k.w), Math.round(k.h), !pill && k.label !== "play"), roughness: 0.38, metalness: 0.2,
      }));
      face.position.z = depth + 0.05; node.add(face);
      keys.push({ k, node, faces: [face.material] });
    }
  });

  // the shadow it casts on the page behind it
  add(new THREE.PlaneGeometry(W * 1.3, H * 1.45), mats.shadow, 0, -H * 0.1, -D - H * 0.7);

  return { group: g, keys, screen };
}

function materials(screenTex) {
  const fine = normalMap("fine", 64, 160, 1.4), leather = normalMap("leather", 40, 96, 4.5);
  const body = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1e, roughness: 0.58, metalness: 0.08, clearcoat: 0.3, clearcoatRoughness: 0.55, normalMap: fine, normalScale: new THREE.Vector2(0.18, 0.18) });
  body.normalMap.repeat.set(3, 3);
  return {
    body,
    top: new THREE.MeshPhysicalMaterial({ color: 0x232327, roughness: 0.42, metalness: 0.15, clearcoat: 0.45, clearcoatRoughness: 0.4 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.82, metalness: 0, normalMap: leather, normalScale: new THREE.Vector2(0.9, 0.9) }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9, metalness: 0 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.55, metalness: 0.2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9c9ca3, roughness: 0.28, metalness: 1 }),
    lug: new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.35, metalness: 1 }),
    button: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.38, metalness: 0.35 }),
    knurl: new THREE.MeshStandardMaterial({ map: knurl(), roughness: 0.4, metalness: 0.4 }),
    bezel: new THREE.MeshPhysicalMaterial({ color: 0x060607, roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15 }),
    eye: new THREE.MeshBasicMaterial({ map: eyeGlass() }),
    screen: new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 2.2 }),
    sheen: new THREE.MeshBasicMaterial({ map: sheen(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    shadow: new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false }),
  };
}

function screenTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- mounting ----------

export async function mount(host) {
  const variant = host.dataset.cam3d === "home" ? "home" : "demo";
  const display = host.querySelector("canvas");
  if (!display || host.dataset.cam3dReady != null) return;
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  const gl = renderer.domElement;
  gl.className = "cam3d-gl";
  gl.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-0.6, 1, 1.4);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
  rim.position.set(1.2, 0.4, -0.6);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  let screenTex = screenTexture(display);
  let mats = materials(screenTex);
  let model = null, m = null, texSize = display.width + "x" + display.height;
  const pivot = new THREE.Group();
  scene.add(pivot);

  // Size the GL canvas around the host with room for the hump, the tilt and
  // the shadow, and put the camera where z = 0 maps 1:1 onto CSS pixels.
  function layout() {
    m = measure(host, variant);
    if (!m.W || !m.H) return false;
    const mx = Math.round(m.W * 0.16), my = Math.round(Math.max(m.W, m.H) * 0.2);
    const cw = m.W + mx * 2, ch = m.H + my * 2;
    Object.assign(gl.style, { left: -mx + "px", top: -my + "px", width: cw + "px", height: ch + "px" });
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.position.set(0, 0, (ch / 2) / Math.tan(FOV / 2 * DEG));
    camera.near = camera.position.z * 0.5;
    camera.far = camera.position.z * 1.6;
    camera.updateProjectionMatrix();
    if (model) {
      pivot.remove(model.group);
      const shared = new Set(Object.values(mats));
      model.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        [].concat(o.material || []).forEach((mt) => { if (!shared.has(mt)) mt.dispose(); });
      });
    }
    model = build(m, mats);
    pivot.add(model.group);
    return true;
  }

  // what the CSS camera is doing right now
  function sync() {
    let busy = false;
    model.keys.forEach(({ k, node, spin, faces }) => {
      const down = k.el.classList.contains("down");
      const z = down ? -1.6 : 0;
      if (node.position.z !== z) { node.position.z = z; busy = true; }
      faces.forEach((f) => f.emissive.setScalar(down ? 0.035 : 0));
      if (spin) {
        const deg = parseFloat((/rotate\((-?[\d.]+)deg\)/.exec(k.el.style.transform) || [])[1]) || 0;
        const r = -deg * DEG;
        if (spin.rotation.z !== r) { spin.rotation.z = r; busy = true; }
      }
    });
    return busy;
  }

  const target = { x: BASE.x, y: BASE.y }, now = { x: BASE.x, y: BASE.y - (reduced ? 0 : 12 * DEG) };
  let visible = true, queued = false, dirty = true;
  function frame() {
    queued = false;
    if (!visible || !model) return;
    sync();
    now.x += (target.x - now.x) * (reduced ? 1 : 0.075);
    now.y += (target.y - now.y) * (reduced ? 1 : 0.075);
    pivot.rotation.set(now.x, now.y, 0);
    renderer.render(scene, camera);
    if (host.dataset.cam3dReady == null) host.dataset.cam3dReady = "";
    const moving = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.0004;
    if (moving || dirty) { dirty = false; kick(); }
  }
  function kick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

  if (!layout()) return;
  host.prepend(gl);
  kick();

  // a new card on the CSS screen
  display.addEventListener("cam:drawn", () => {
    const size = display.width + "x" + display.height;
    if (size !== texSize) {
      texSize = size;
      screenTex.dispose();
      screenTex = screenTexture(display);
      mats.screen.map = screenTex;
      mats.screen.needsUpdate = true;
      layout();
    } else screenTex.needsUpdate = true;
    kick();
  });
  // keys go down, the wheel turns, the camera stands up (home: .portrait)
  new MutationObserver((list) => {
    if (list.some((r) => r.target === host && r.attributeName === "class")) requestAnimationFrame(() => { layout(); kick(); });
    else kick();
  }).observe(host, { subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  new ResizeObserver(() => { if (layout()) kick(); }).observe(host);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(host);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) kick(); });

  if (finePointer && !reduced) {
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      target.y = BASE.y + nx * TILT.y;
      target.x = BASE.x + ny * TILT.x;
      kick();
    }, { passive: true });
  }

  // Lost the GPU: hand the look back to the CSS camera.
  gl.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    visible = false;
    delete host.dataset.cam3dReady;
    gl.remove();
  });
}
