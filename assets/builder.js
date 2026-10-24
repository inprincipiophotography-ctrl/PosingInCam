"use strict";

/* Card renderer for the studio: draws a Shoot Cards card on a <canvas>.
   Landscape cards are drawn at 1920x1280 and portrait pose cards at 1280x1920,
   the exact frames the converter fills, so the server never resizes them.
   Layouts follow the example cards on the page. */
window.CardRenderer = (function () {
  const LAND = { w: 1920, h: 1280 };
  const PORT = { w: 1280, h: 1920 };
  const COL = {
    ink: "#1d1d1f", ink2: "#424245", muted: "#6e6e73", accent: "#a40000",
    rule: "#d8d8dc", soft: "#faf5f5", softLine: "#e6cfcf", blank: "#f2f2f4", blank2: "#d5d5da",
  };
  const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const SERIF = "'Instrument Serif', Georgia, serif";
  const FOOTER = "SHOOT CARDS";

  // Pose cards from your own photo copy the pose pack's look: a framed photo
  // running into a maroon strip, the notes down the left, the words to say
  // in a box laid over the photo, all in capitals.
  const POSE = {
    strip: "#7d0303", star: "#e3403d", ink: "#000000", say: "#716e63",
    stripX: 986,
    frame: { x: 391, y: 195, w: 864, h: 1362, line: 5 },
    box: { x: 30, y: 1394, w: 724, h: 476 },
  };
  const POSE_SERIF = "'Noto Serif', Georgia, serif";
  const NOTE_LINE = 49;

  // Rows that fit on one card; a longer list continues on the next (1 / 2).
  const PER_PAGE = { timeline: 6, groups: 6, shotlist: 6, settings: 3 };
  const ROW_KEYS = { timeline: ["time", "text"], groups: ["names", "rel"], shotlist: ["text"], settings: ["label", "value"] };
  // Eight full cards per list: a whole wedding, and still far under the upload cap.
  const MAX_ROWS = 48;

  const font = (weight, size, family) => weight + " " + size + "px " + family;
  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

  /* ---------- data ---------- */
  function rowsOf(type, data) {
    const keys = ROW_KEYS[type];
    if (!keys || !data) return [];
    return (data.rows || [])
      .map((r) => {
        const o = {};
        keys.forEach((k) => { o[k] = clean(r && r[k]); });
        return o;
      })
      .filter((r) => keys.some((k) => r[k]))
      .slice(0, MAX_ROWS);
  }

  const loaded = (img) => !!(img && img.complete && img.naturalWidth);

  /** How many cards this data makes (0 = nothing to make yet). */
  function pages(type, data) {
    if (!data) return 0;
    if (type === "pose") return loaded(data.mode === "photo" ? data.photo : data.sampleImg) ? 1 : 0;
    if (type === "found") return [data.name, data.phone, data.email].some((v) => clean(v)) ? 1 : 0;
    if (!PER_PAGE[type]) return 0;
    const n = rowsOf(type, data).length;
    return n ? Math.ceil(n / PER_PAGE[type]) : 0;
  }

  /* ---------- text helpers ---------- */
  function ellipsize(text, maxWidth, measure) {
    const chars = Array.from(text);
    while (chars.length > 1 && measure(chars.join("") + "…") > maxWidth) chars.pop();
    return chars.join("").trimEnd() + "…";
  }

  /** Shrink the font until text fits, down to minSize, then cut with "…".
      Leaves ctx.font set to the size it chose. */
  function fitText(ctx, text, maxWidth, weight, size, minSize, family) {
    let s = size;
    ctx.font = font(weight, s, family);
    const measure = (t) => ctx.measureText(t).width;
    while (s > minSize && measure(text) > maxWidth) {
      s -= 2;
      ctx.font = font(weight, s, family);
    }
    return measure(text) <= maxWidth ? text : ellipsize(text, maxWidth, measure);
  }

  // Tracked caps drawn letter by letter: ctx.letterSpacing isn't in every browser.
  function spacedWidth(ctx, text, spacing) {
    const chars = Array.from(text);
    let w = 0;
    chars.forEach((ch) => { w += ctx.measureText(ch).width; });
    return w + spacing * Math.max(0, chars.length - 1);
  }

  function spaced(ctx, text, x, y, spacing) {
    const align = ctx.textAlign;
    ctx.textAlign = "left";
    let cx = x;
    Array.from(text).forEach((ch) => {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    });
    ctx.textAlign = align;
  }

  function fitSpaced(ctx, text, maxWidth, weight, size, minSize, family, spacing) {
    let s = size;
    ctx.font = font(weight, s, family);
    const measure = (t) => spacedWidth(ctx, t, spacing);
    while (s > minSize && measure(text) > maxWidth) {
      s -= 2;
      ctx.font = font(weight, s, family);
    }
    return measure(text) <= maxWidth ? text : ellipsize(text, maxWidth, measure);
  }

  /** Word-wrap into at most maxLines lines; the last line ends in "…" if cut. */
  function wrap(ctx, text, maxWidth, maxLines) {
    const measure = (t) => ctx.measureText(t).width;
    const lines = [];
    let line = "";
    const push = (l) => { if (l) lines.push(l); };
    text.split(" ").filter(Boolean).forEach((word) => {
      const next = line ? line + " " + word : word;
      if (measure(next) <= maxWidth) { line = next; return; }
      push(line);
      line = word;
      // A single word wider than the line is broken by characters (each pass
      // keeps at least one, so even one impossibly wide glyph can't loop).
      while (measure(line) > maxWidth && Array.from(line).length > 1) {
        const chars = Array.from(line);
        let cut = chars.length - 1;
        while (cut > 1 && measure(chars.slice(0, cut).join("")) > maxWidth) cut--;
        lines.push(chars.slice(0, cut).join(""));
        line = chars.slice(cut).join("");
      }
    });
    push(line);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(kept[maxLines - 1] + " " + lines[maxLines], maxWidth, measure);
    return kept;
  }

  /* ---------- drawing helpers ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale, sh = h / scale;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }

  function landscapeBase(ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LAND.w, LAND.h);
    ctx.fillStyle = COL.accent;
    ctx.fillRect(1790, 0, 130, LAND.h);
  }

  function header(ctx, eyebrow, title, page, total) {
    let titleMax = 1540;
    if (total > 1) {
      const pager = (page + 1) + " / " + total;
      ctx.font = font(700, 46, SANS);
      ctx.fillStyle = COL.accent;
      ctx.textAlign = "right";
      ctx.fillText(pager, 1660, 300);
      ctx.textAlign = "left";
      titleMax -= ctx.measureText(pager).width + 48;
    }
    if (eyebrow) {
      ctx.fillStyle = COL.accent;
      spaced(ctx, fitSpaced(ctx, eyebrow.toUpperCase(), 1540, 600, 40, 28, SANS, 6), 120, 150, 6);
    }
    ctx.fillStyle = COL.ink;
    ctx.fillText(fitText(ctx, title, titleMax, 400, 132, 84, SERIF), 120, 300);
    ctx.fillStyle = COL.rule;
    ctx.fillRect(120, 360, 1540, 3);
  }

  function footer(ctx, x, y, size) {
    ctx.font = font(400, size, SANS);
    ctx.fillStyle = COL.muted;
    spaced(ctx, FOOTER, x, y, 3);
  }

  /* ---------- card types ---------- */
  function drawTimeline(ctx, d, page, total) {
    landscapeBase(ctx);
    header(ctx, clean(d.label), "Timeline", page, total);
    const per = PER_PAGE.timeline;
    rowsOf("timeline", d).slice(page * per, page * per + per).forEach((r, i) => {
      const y = 460 + i * 120;
      if (r.time) {
        ctx.fillStyle = COL.accent;
        ctx.fillText(fitText(ctx, r.time, 250, 700, 60, 40, SANS), 126, y);
      }
      ctx.fillStyle = COL.rule;
      roundRect(ctx, 400, y - 22, 14, 14, 7);
      ctx.fill();
      if (r.text) {
        ctx.fillStyle = COL.ink;
        ctx.fillText(fitText(ctx, r.text, 1190, 400, 60, 44, SANS), 470, y);
      }
    });
    footer(ctx, 120, 1210, 34);
  }

  function drawGroups(ctx, d, page, total) {
    landscapeBase(ctx);
    header(ctx, clean(d.label), "Family groups", page, total);
    const per = PER_PAGE.groups;
    rowsOf("groups", d).slice(page * per, page * per + per).forEach((r, i) => {
      const y = 460 + i * 118;
      ctx.font = font(400, 72, SERIF);
      ctx.fillStyle = COL.accent;
      ctx.fillText(String(page * per + i + 1), 126, y);
      let relWidth = 0;
      if (r.rel) {
        ctx.fillStyle = COL.muted;
        ctx.textAlign = "right";
        const rel = fitText(ctx, r.rel, 560, 400, 42, 30, SANS);
        ctx.fillText(rel, 1660, y);
        ctx.textAlign = "left";
        relWidth = ctx.measureText(rel).width + 48;
      }
      if (r.names) {
        ctx.fillStyle = COL.ink;
        ctx.fillText(fitText(ctx, r.names, 1430 - relWidth, 400, 60, 40, SANS), 230, y);
      }
    });
    footer(ctx, 120, 1210, 34);
  }

  function drawShotlist(ctx, d, page, total) {
    landscapeBase(ctx);
    header(ctx, clean(d.label), "Shot list", page, total);
    const per = PER_PAGE.shotlist;
    rowsOf("shotlist", d).slice(page * per, page * per + per).forEach((r, i) => {
      const y = 440 + i * 118;
      ctx.strokeStyle = COL.rule;
      ctx.lineWidth = 5;
      roundRect(ctx, 126, y - 46, 58, 58, 12);
      ctx.stroke();
      ctx.fillStyle = COL.ink;
      ctx.fillText(fitText(ctx, r.text, 1430, 400, 62, 44, SANS), 230, y);
    });
    footer(ctx, 120, 1210, 34);
  }

  function drawSettings(ctx, d, page, total) {
    landscapeBase(ctx);
    header(ctx, "Settings", clean(d.title) || "Settings", page, total);
    const per = PER_PAGE.settings;
    rowsOf("settings", d).slice(page * per, page * per + per).forEach((r, i) => {
      const y = 470 + i * 230;
      if (r.label) {
        ctx.fillStyle = COL.ink;
        ctx.fillText(fitText(ctx, r.label, 1534, 600, 52, 38, SANS), 126, y);
      }
      if (r.value) {
        ctx.fillStyle = COL.accent;
        ctx.fillText(fitText(ctx, r.value, 1534, 400, 62, 44, SANS), 126, y + 76);
      }
      ctx.fillStyle = COL.rule;
      ctx.fillRect(126, y + 122, 1534, 3);
    });
    footer(ctx, 120, 1210, 34);
  }

  function drawFound(ctx, d) {
    landscapeBase(ctx);
    header(ctx, "This camera belongs to", "If found", 0, 1);
    const name = clean(d.name), phone = clean(d.phone), email = clean(d.email), note = clean(d.note);
    if (name) {
      ctx.fillStyle = COL.ink;
      ctx.fillText(fitText(ctx, name, 1540, 400, 64, 44, SANS), 120, 520);
    }
    if (phone) {
      ctx.fillStyle = COL.accent;
      ctx.fillText(fitText(ctx, phone, 1540, 700, 76, 48, SANS), 120, 650);
    }
    if (email) {
      ctx.fillStyle = COL.ink2;
      ctx.fillText(fitText(ctx, email, 1540, 400, 58, 40, SANS), 120, 770);
    }
    if (note) {
      ctx.fillStyle = COL.soft;
      ctx.strokeStyle = COL.softLine;
      ctx.lineWidth = 3;
      roundRect(ctx, 120, 860, 1540, 150, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COL.ink;
      ctx.fillText(fitText(ctx, note, 1460, 400, 52, 34, SANS), 160, 955);
    }
    footer(ctx, 120, 1210, 34);
  }

  function drawPhotoPlaceholder(ctx, x, y, w, h) {
    ctx.fillStyle = COL.blank;
    ctx.fillRect(x, y, w, h);
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = COL.blank2;
    ctx.beginPath(); ctx.arc(cx - 80, cy - 110, 78, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 110, cy - 80, 64, 0, Math.PI * 2); ctx.fill();
    roundRect(ctx, cx - 210, cy, 260, 210, 110); ctx.fill();
    roundRect(ctx, cx + 20, cy + 20, 190, 190, 90); ctx.fill();
    ctx.font = font(400, 38, SANS);
    ctx.fillStyle = COL.muted;
    ctx.textAlign = "center";
    ctx.fillText("your reference photo", cx, cy + 300);
    ctx.textAlign = "left";
  }

  /** A line whose first character (the hack's "*", the quote's opening mark)
      is picked out in red, the rest in the line's own colour. */
  function markedLine(ctx, line, x, y, color) {
    ctx.fillStyle = POSE.star;
    ctx.fillText(line[0], x, y);
    ctx.fillStyle = color;
    ctx.fillText(line.slice(1), x + ctx.measureText(line[0]).width, y);
  }

  function drawPose(ctx, d) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PORT.w, PORT.h);
    if (d.mode !== "photo") {
      // A ready-made card from the pose pack, already laid out at 2:3.
      if (loaded(d.sampleImg)) drawCover(ctx, d.sampleImg, 0, 0, PORT.w, PORT.h);
      return;
    }
    const upper = (s) => clean(s).toUpperCase();
    ctx.fillStyle = POSE.strip;
    ctx.fillRect(POSE.stripX, 0, PORT.w - POSE.stripX, PORT.h);

    const title = upper(d.title) || "YOUR POSE", titleW = POSE.stripX - 60;
    ctx.fillStyle = POSE.ink;
    if (fitText(ctx, title, titleW, 600, 94, 64, POSE_SERIF) === title) ctx.fillText(title, 30, 142);
    else {
      // Too long for one line: two lines rather than shrinking out of sight.
      let size = 64;
      while (size > 48 && wrap(ctx, title, titleW, 99).length > 2) {
        size -= 2;
        ctx.font = font(600, size, POSE_SERIF);
      }
      const lines = wrap(ctx, title, titleW, 2), lh = Math.round(size * 1.08);
      lines.forEach((line, j) => ctx.fillText(line, 30, 154 - (lines.length - 1 - j) * lh));
    }

    // The photo in a thin black frame, its right edge over the strip.
    const f = POSE.frame;
    ctx.fillRect(f.x, f.y, f.w, f.h);
    const px = f.x + f.line, py = f.y + f.line, pw = f.w - 2 * f.line, ph = f.h - 2 * f.line;
    if (loaded(d.photo)) drawCover(ctx, d.photo, px, py, pw, ph);
    else drawPhotoPlaceholder(ctx, px, py, pw, ph);

    const say = upper(d.say);
    const b = POSE.box;
    const notesEnd = say ? b.y - 40 : PORT.h - 60;

    // Only the notes you filled in, top to bottom, so an empty one leaves no orphan label.
    let y = 483;
    [["ENERGY:", d.energy], ["CAMERA:", d.camera], ["HACK:", d.hack, "*"]]
      .filter(([, value]) => clean(value))
      .forEach(([label, value, mark]) => {
        const room = Math.min(5, Math.floor((notesEnd - y) / NOTE_LINE));
        if (room < 1) return;
        ctx.font = font(700, 32, SANS);
        ctx.fillStyle = POSE.ink;
        ctx.fillText(label, 30, y);
        ctx.font = font(400, 32, SANS);
        const lines = wrap(ctx, (mark || "") + upper(value), f.x - 40, room);
        lines.forEach((line, j) => {
          const ly = y + NOTE_LINE * (j + 1);
          if (mark && j === 0) markedLine(ctx, line, 30, ly, POSE.ink);
          else ctx.fillText(line, 30, ly);
        });
        y += NOTE_LINE * (lines.length + 2);
      });

    if (say) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = POSE.ink;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.font = font(700, 37, SANS);
      ctx.fillStyle = POSE.ink;
      ctx.fillText("SAY TO THE COUPLE", b.x + 21, b.y + 53);

      // 40px fits the longest the form allows; smaller only as a safety net.
      const text = "\"" + say, top = b.y + 132, bottom = b.y + b.h - 28, width = b.w - 34;
      let size = 40;
      const lineH = () => Math.round(size * 1.54);
      const room = () => Math.floor((bottom - top) / lineH()) + 1;
      ctx.font = font(400, size, SANS);
      while (size > 32 && wrap(ctx, text, width, 99).length > room()) {
        size -= 2;
        ctx.font = font(400, size, SANS);
      }
      ctx.fillStyle = POSE.say;
      wrap(ctx, text, width, room()).forEach((line, j) => {
        const ly = top + j * lineH();
        if (j === 0) markedLine(ctx, line, b.x + 21, ly, POSE.say);
        else ctx.fillText(line, b.x + 21, ly);
      });
    }

    // The credit sits at the foot of the strip: your source, or ours.
    const source = upper(d.source);
    ctx.font = font("italic 400", 24, POSE_SERIF);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    const credit = source ? wrap(ctx, "SOURCE: " + source, PORT.w - POSE.stripX - 40, 3) : [FOOTER];
    const cx = (POSE.stripX + PORT.w) / 2;
    credit.forEach((line, j) => ctx.fillText(line, cx, 1864 - (credit.length - 1 - j) * 32));
    ctx.textAlign = "left";
  }

  const DRAW = {
    pose: drawPose, timeline: drawTimeline, groups: drawGroups,
    shotlist: drawShotlist, settings: drawSettings, found: drawFound,
  };

  /** Draw one card (page is 0-based) onto canvas, sizing the canvas to fit. */
  function draw(canvas, type, data, page) {
    const size = type === "pose" ? PORT : LAND;
    if (canvas.width !== size.w) canvas.width = size.w;
    if (canvas.height !== size.h) canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const total = Math.max(1, pages(type, data));
    const p = Math.min(Math.max(0, page | 0), total - 1);
    DRAW[type](ctx, data || {}, p, total);
  }

  /* ---------- the board label on your own images ---------- */
  /** A small dark pill in the bottom-left corner of an image ("Emma's board ·
      3/12"), sized in card pixels so it reads the same on the camera whatever
      the image's own size. rect is where the image sits on ctx, and k is how
      many ctx pixels make one card pixel. */
  function tag(ctx, text, rect, k) {
    text = clean(text);
    if (!text) return;
    const pad = 38 * k, h = 108 * k, inset = 40 * k;
    const maxW = Math.max(0, rect.w - inset * 2 - pad * 2);
    ctx.save();
    ctx.font = font(600, 60 * k, SANS);
    let t = text;
    while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + "…";
    const w = ctx.measureText(t).width + pad * 2;
    const x = rect.x + inset, y = rect.y + rect.h - inset - h;
    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t, x + pad, y + h / 2 + 2 * k);
    ctx.restore();
  }

  /* ---------- fonts ---------- */
  const FACES = [font(400, 60, "Inter"), font(600, 40, "Inter"), font(700, 46, "Inter"),
                 font(400, 132, "'Instrument Serif'"),
                 font(600, 94, "'Noto Serif'"), font("italic 400", 24, "'Noto Serif'")];

  function textOf(data) {
    const parts = [];
    const walk = (v) => {
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object" && !(v instanceof HTMLImageElement)) Object.values(v).forEach(walk);
    };
    walk(data);
    const text = parts.join(" ");
    return text + " " + text.toUpperCase() + " 0123456789/·…“”" + FOOTER;
  }

  /** Make sure the web fonts (incl. the subset for these characters) are
      loaded before drawing. Never waits more than a few seconds: a blocked
      font CDN falls back to system fonts rather than stalling the download. */
  function ensureFonts(data) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const text = textOf(data || {});
    const load = Promise.all(FACES.map((f) => document.fonts.load(f, text).catch(() => null)));
    const timeout = new Promise((res) => setTimeout(res, 3000));
    return Promise.race([load, timeout]).then(() => undefined);
  }

  /* ---------- export ---------- */
  function toBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the card. Please try again."))),
        mime, quality);
    });
  }

  /** Every card for this data as image files ready for /api/convert. Text
      cards go up as PNG (crisp letters); photo cards as JPEG (smaller). */
  async function exportCards(type, data) {
    await ensureFonts(data);
    const n = pages(type, data);
    const canvas = document.createElement("canvas");
    const photo = type === "pose";
    const files = [];
    for (let p = 0; p < n; p++) {
      draw(canvas, type, data, p);
      const blob = await toBlob(canvas, photo ? "image/jpeg" : "image/png", photo ? 0.92 : undefined);
      files.push({ blob, name: type + "-" + (p + 1) + (photo ? ".jpg" : ".png") });
    }
    return files;
  }

  return { PER_PAGE, MAX_ROWS, ROW_KEYS, pages, rowsOf, draw, tag, ensureFonts, exportCards, isPortrait: (t) => t === "pose" };
})();
