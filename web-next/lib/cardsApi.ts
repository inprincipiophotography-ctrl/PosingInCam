// API client for the Pose Cards page. Posts design images to the Python
// /api/convert function and returns the SD-card ZIP as a Blob.
//
// Set NEXT_PUBLIC_CARDS_API_URL to where the function lives:
//   - empty  -> same origin ("/api/convert"), if the function is co-located
//   - https://your-cards-app.vercel.app  -> the standalone deployment

export type Vendor = "sony" | "canon" | "nikon";
export type Orientation = "auto" | "landscape" | "portrait";

const BASE = (process.env.NEXT_PUBLIC_CARDS_API_URL || "").replace(/\/$/, "");
const ENDPOINT = `${BASE}/api/convert`;

const MAX_EDGE = 2400; // downscale before upload (Vercel ~4.5MB body limit)
const JPEG_Q = 0.9;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Downscale a design to <= MAX_EDGE px and re-encode as JPEG to keep uploads small. */
export async function downscale(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode failed"))),
      "image/jpeg",
      JPEG_Q,
    ),
  );
}

/** Convert designs and return the SD-card ZIP blob. Throws Error(message) on failure. */
export async function buildCards(
  vendor: Vendor,
  orientation: Orientation,
  files: File[],
): Promise<Blob> {
  const fd = new FormData();
  fd.append("vendor", vendor);
  fd.append("orientation", orientation);
  let i = 0;
  for (const f of files) {
    const blob = await downscale(f);
    fd.append("files", blob, `design-${++i}.jpg`);
  }
  const resp = await fetch(ENDPOINT, { method: "POST", body: fd });
  if (!resp.ok) {
    let msg = `Greška ${resp.status}`;
    try {
      msg = (await resp.json()).error || msg;
    } catch {
      /* non-JSON error */
    }
    throw new Error(msg);
  }
  return await resp.blob();
}
