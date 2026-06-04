"use client";

import { useCallback, useState } from "react";
import styles from "./PoseCards.module.css";
import { buildCards, type Orientation, type Vendor } from "../lib/cardsApi";

const CAMERAS: { id: Vendor; name: string; note: string }[] = [
  { id: "sony", name: "Sony", note: "Alpha · A7 III/IV/V" },
  { id: "canon", name: "Canon", note: "EOS R · R6" },
  { id: "nikon", name: "Nikon", note: "Z · Z6/Z8/Z9" },
];

const INSTRUCTIONS: Record<Vendor, string> = {
  sony:
    "SONY — Recover Image Database is REQUIRED.\n" +
    "1. MENU → Setup → Media → Format the card (in camera).\n" +
    "2. Take one ordinary photo so DCIM/100MSDCF/ is created.\n" +
    "3. Copy all .JPG from the ZIP (DCIM/100MSDCF/) into that folder on the card.\n" +
    "4. MENU → Setup → Media → Recover Image Database → confirm.\n" +
    "5. ▶ Playback — the cards appear among your photos.",
  canon:
    "CANON — plug & play, no database rebuild.\n" +
    "1. MENU → (wrench) → Format card.\n" +
    "2. Take one photo so DCIM/100CANON/ is created.\n" +
    "3. Copy the .JPG from the ZIP into DCIM/100CANON/ on the card.\n" +
    "4. Insert the card → ▶ Playback. (Press INFO for details.)",
  nikon:
    "NIKON — copy into the folder YOUR camera created.\n" +
    "1. MENU → (wrench) → Format memory card.\n" +
    "2. Take a photo — DCIM/100NCZ_… is created (e.g. 100NCZ_8).\n" +
    "3. Copy the DSC_*.JPG from the ZIP into THAT folder (not 100NCZ_X).\n" +
    "4. If you don't see them: PLAYBACK MENU → Playback folder → All.\n" +
    "5. ▶ Playback.",
};

type Item = { file: File; url: string };
type Status = { msg: string; kind: "" | "ok" | "err" };

export default function PoseCards() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ msg: "", kind: "" });
  const [showInstr, setShowInstr] = useState(false);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const next: Item[] = [];
    for (const f of Array.from(list)) {
      if (f.type.startsWith("image/")) next.push({ file: f, url: URL.createObjectURL(f) });
    }
    if (next.length) {
      setItems((prev) => [...prev, ...next]);
      setSelected(0);
    }
  }, []);

  const generate = async () => {
    if (!vendor || !items.length) return;
    setBusy(true);
    setStatus({ msg: "Preparing and converting…", kind: "" });
    try {
      const blob = await buildCards(vendor, orientation, items.map((i) => i.file));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pose-cards.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus({ msg: "✓ Done! Your pose-cards.zip is downloading.", kind: "ok" });
      setShowInstr(true);
    } catch (err) {
      setStatus({ msg: "✗ " + (err as Error).message, kind: "err" });
    } finally {
      setBusy(false);
    }
  };

  const canGo = Boolean(vendor && items.length && !busy);

  return (
    <div className={styles.wrap}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Pose Reference Cards</p>
        <h1>Your poses, on your camera screen.</h1>
        <p className={styles.lede}>
          Upload your designs, download a ready-to-copy SD-card pack, and scroll through your poses
          in playback — no app, no phone, no signal. Just the camera you're already holding.
        </p>
      </section>

      {/* Step 1 — camera */}
      <section className={styles.step}>
        <h2>
          <span className={styles.num}>i</span> Choose your camera
        </h2>
        <div className={styles.cameras}>
          {CAMERAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.cam} ${vendor === c.id ? styles.camActive : ""}`}
              aria-pressed={vendor === c.id}
              onClick={() => setVendor(c.id)}
            >
              {c.name}
              <small>{c.note}</small>
            </button>
          ))}
        </div>
      </section>

      {/* Step 2 — upload */}
      <section className={styles.step}>
        <h2>
          <span className={styles.num}>ii</span> Add your designs
        </h2>
        <label
          className={`${styles.drop} ${over ? styles.dropOver : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            setOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          <span className={styles.dropTitle}>Drag images here or click to choose</span>
          <span className={styles.dropSub}>JPG, PNG, WEBP · landscape or portrait</span>
        </label>

        <div className={styles.orient}>
          <span>Orientation:</span>
          {(["auto", "landscape", "portrait"] as Orientation[]).map((o) => (
            <label key={o}>
              <input
                type="radio"
                name="orient"
                value={o}
                checked={orientation === o}
                onChange={() => setOrientation(o)}
              />{" "}
              {o === "auto" ? "Auto" : o === "landscape" ? "Landscape" : "Portrait"}
            </label>
          ))}
        </div>

        {items.length > 0 && (
          <div className={styles.screenWrap}>
            <div className={styles.screen}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.screenImg} src={items[selected]?.url} alt="" />
              <span className={styles.screenCount}>
                {items.length} {items.length === 1 ? "card" : "cards"}
              </span>
            </div>
            <div className={styles.filmstrip}>
              {items.map((it, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={it.url}
                  src={it.url}
                  alt=""
                  className={`${styles.thumb} ${i === selected ? styles.thumbSel : ""}`}
                  onClick={() => setSelected(i)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Step 3 — generate */}
      <section className={styles.step}>
        <h2>
          <span className={styles.num}>iii</span> Generate &amp; download
        </h2>
        <button type="button" className={styles.go} disabled={!canGo} onClick={generate}>
          {busy ? "Working…" : "Generate cards"}
        </button>
        <p className={`${styles.status} ${status.kind === "ok" ? styles.ok : ""} ${status.kind === "err" ? styles.err : ""}`}>
          {status.msg}
        </p>
      </section>

      {/* Step 4 — instructions */}
      {showInstr && vendor && (
        <section className={`${styles.step} ${styles.instructions}`}>
          <h2>
            <span className={styles.num}>iv</span> Put it on your card
          </h2>
          <pre>{INSTRUCTIONS[vendor]}</pre>
          <p className={styles.muted}>The same instructions are included in the downloaded ZIP.</p>
        </section>
      )}
    </div>
  );
}
