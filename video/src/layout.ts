import { useVideoConfig } from "remotion";

/**
 * One set of scenes renders as 16:9, 9:16 and 4:5, so everything is laid out
 * from the canvas centre in units of `u` (1 u = 1 px at 1080 on the short side).
 *
 * `safe` is where text and the key element must stay:
 * - 16:9 and 4:5: 5 % inside every edge.
 * - 9:16 (Reels): clear of the top 14 % and bottom 35 % that Instagram covers
 *   with its own UI, and 6 % from the sides.
 */
export function useLayout() {
  const { width: w, height: h, fps } = useVideoConfig();
  const u = Math.min(w, h) / 1080;
  const portrait = h / w > 1.5;
  const tall = h > w; // 9:16 or 4:5
  const safe = portrait
    ? { top: h * 0.14, bottom: h * 0.65, left: w * 0.06, right: w * 0.94 }
    : { top: h * 0.05, bottom: h * 0.95, left: w * 0.05, right: w * 0.95 };
  return {
    w,
    h,
    fps,
    u,
    portrait,
    tall,
    cx: w / 2,
    cy: h / 2,
    safe: { ...safe, cx: (safe.left + safe.right) / 2, cy: (safe.top + safe.bottom) / 2, w: safe.right - safe.left, h: safe.bottom - safe.top },
  };
}

export type Layout = ReturnType<typeof useLayout>;
