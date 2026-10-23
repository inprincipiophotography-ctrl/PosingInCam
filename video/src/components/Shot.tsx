import React from "react";
import { Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CameraPhoto } from "../config";
import { EASE, mix } from "../theme";

/**
 * A camera move over a photo or a clip. `views` are keyframes, eased in and out:
 *  - x, y: the point of the media at the centre of the frame (0–1 of its width/height)
 *  - zoom: 1 = the media just covers the box
 *  - card: instead of zoom, make the camera screen's card fill this share of the box
 */
export type View = { t: number; x?: number; y?: number; zoom?: number; card?: number };

type Props = {
  src: string;
  kind?: "photo" | "video";
  media: { w: number; h: number };
  views: View[];
  photo?: CameraPhoto; // needed for `card` views
  width?: number; // box size, defaults to the whole frame
  height?: number;
  playbackRate?: number;
  startFrom?: number; // seconds into the clip
  style?: React.CSSProperties;
};

export const Shot: React.FC<Props> = ({ src, kind = "photo", media, views, photo, width, height, playbackRate = 1, startFrom = 0, style }) => {
  const frame = useCurrentFrame();
  const cfg = useVideoConfig();
  const W = width ?? cfg.width;
  const H = height ?? cfg.height;
  const t = frame / cfg.fps;
  const cover = Math.max(W / media.w, H / media.h);

  const resolve = (v: View) => {
    if (v.card != null && photo) {
      const c = photo.card;
      const zoom = Math.min((v.card * H) / (c.h * media.h * cover), (v.card * W) / (c.w * media.w * cover));
      return { x: v.x ?? c.x + c.w / 2, y: v.y ?? c.y + c.h / 2, zoom: Math.max(1, zoom) };
    }
    return { x: v.x ?? 0.5, y: v.y ?? 0.5, zoom: v.zoom ?? 1 };
  };

  // Current view: ease between the two keyframes around t.
  let i = 0;
  while (i < views.length - 1 && t > views[i + 1].t) i++;
  const a = resolve(views[i]);
  const b = resolve(views[Math.min(i + 1, views.length - 1)]);
  const span = Math.max(0.0001, views[Math.min(i + 1, views.length - 1)].t - views[i].t);
  const p = EASE.inOut(Math.min(1, Math.max(0, (t - views[i].t) / span)));
  // Golden rule: a slow micro push on top, so a held view never fully stops.
  const zoom = mix(a.zoom, b.zoom, p) * (1 + 0.006 * t);
  const x = mix(a.x, b.x, p);
  const y = mix(a.y, b.y, p);

  const s = cover * zoom;
  const dw = media.w * s;
  const dh = media.h * s;
  const left = Math.min(0, Math.max(W - dw, W / 2 - x * dw));
  const top = Math.min(0, Math.max(H - dh, H / 2 - y * dh));

  const mediaStyle: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: dw, height: dh, transform: `translate(${left}px, ${top}px)` };
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", ...style }}>
      {kind === "video" ? (
        <OffthreadVideo src={staticFile(src)} muted playbackRate={playbackRate} startFrom={Math.round(startFrom * cfg.fps)} style={mediaStyle} />
      ) : (
        <Img src={staticFile(src)} style={mediaStyle} />
      )}
    </div>
  );
};

export const PHOTO_SIZE = { w: 2400, h: 3200 };
export const FOOTAGE_SIZE = { w: 2160, h: 3840 };
