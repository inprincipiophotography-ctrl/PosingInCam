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
    "SONY — Recover Image Database je OBAVEZAN korak.\n" +
    "1. MENU → Setup → Media → Format (formatiraj karticu u aparatu).\n" +
    "2. Snimi jednu običnu fotku da nastane DCIM/100MSDCF/.\n" +
    "3. Kopiraj sve .JPG iz ZIP-a (DCIM/100MSDCF/) u istu mapu na kartici.\n" +
    "4. MENU → Setup → Media → Recover Image Database → potvrdi.\n" +
    "5. ▶ Playback — kartice su među fotkama.",
  canon:
    "CANON — plug & play, bez rebuilda baze.\n" +
    "1. MENU → (alat) → Format card.\n" +
    "2. Snimi jednu fotku da nastane DCIM/100CANON/.\n" +
    "3. Kopiraj .JPG iz ZIP-a u DCIM/100CANON/ na kartici.\n" +
    "4. Ubaci karticu → ▶ Playback. (INFO za detalje.)",
  nikon:
    "NIKON — kopiraj u mapu koju je TVOJ aparat napravio.\n" +
    "1. MENU → (alat) → Format memory card.\n" +
    "2. Snimi fotku — nastane DCIM/100NCZ_… (npr. 100NCZ_8).\n" +
    "3. Kopiraj DSC_*.JPG iz ZIP-a u TU mapu (ne u 100NCZ_X).\n" +
    "4. Ako ne vidiš: PLAYBACK MENU → Playback folder → All.\n" +
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
    setStatus({ msg: "Pripremam i konvertiram…", kind: "" });
    try {
      const blob = await buildCards(vendor, orientation, items.map((i) => i.file));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pose-cards.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus({ msg: "✓ Gotovo! Preuzimanje pose-cards.zip je krenulo.", kind: "ok" });
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
        <h1>Tvoje poze, na ekranu aparata.</h1>
        <p className={styles.lede}>
          Uploadaj svoje dizajne, preuzmi gotov paket za SD karticu i listaj poze u playbacku —
          bez aplikacije, bez telefona, bez signala. Samo aparat koji već držiš.
        </p>
      </section>

      {/* Step 1 — camera */}
      <section className={styles.step}>
        <h2>
          <span className={styles.num}>i</span> Odaberi aparat
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
          <span className={styles.num}>ii</span> Dodaj svoje dizajne
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
          <span className={styles.dropTitle}>Povuci slike ovamo ili klikni za odabir</span>
          <span className={styles.dropSub}>JPG, PNG, WEBP · landscape ili portrait</span>
        </label>

        <div className={styles.orient}>
          <span>Orijentacija:</span>
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
                {items.length} {items.length === 1 ? "kartica" : "kartice/kartica"}
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
          <span className={styles.num}>iii</span> Generiraj &amp; preuzmi
        </h2>
        <button type="button" className={styles.go} disabled={!canGo} onClick={generate}>
          {busy ? "Radim…" : "Generiraj kartice"}
        </button>
        <p className={`${styles.status} ${status.kind === "ok" ? styles.ok : ""} ${status.kind === "err" ? styles.err : ""}`}>
          {status.msg}
        </p>
      </section>

      {/* Step 4 — instructions */}
      {showInstr && vendor && (
        <section className={`${styles.step} ${styles.instructions}`}>
          <h2>
            <span className={styles.num}>iv</span> Stavi na karticu
          </h2>
          <pre>{INSTRUCTIONS[vendor]}</pre>
          <p className={styles.muted}>Iste upute (HR + EN) nalaze se i u preuzetom ZIP-u.</p>
        </section>
      )}
    </div>
  );
}
