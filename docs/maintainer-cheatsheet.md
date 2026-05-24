# Maintainer Cheatsheet

> Personal one-page reference za korištenje cardify-a. Sve komande kopirati direktno, ne treba ih pisati od nule.

---

## Setup (jednom u životu, po Macu)

```bash
brew install exiftool
pip3 install Pillow
```

Plus na Desktopu trebaš imati:

| Fajl | Što je | Gdje nabaviti |
|---|---|---|
| `cardify.sh` | sama skripta, `chmod +x` | pull s GitHuba (vidi dolje) |
| `TEMPLATE-A7III.JPG` | Sony template (real SOOC iz tvog A7 III, ili A7 V/A7 IV iz DPReview-a) | tvoj A7 III SOOC (najpouzdanije), ili DPReview sample |
| `TEMPLATE-R6M2.JPG` | Canon master template (Zlatkov R6 Mark II SOOC) | prijatelj Zlatkov — hardware-verified cross-body na R6 Mark II + R6 Mark III |
| `canva-exports/` | folder s Canva poza-eksportima | tvoji exports |
| `TEMPLATE-CANVA.jpg` | jedan single pose za quick testove | bilo koji Canva pose |

---

## Pull / update cardify s GitHuba

```bash
gh api -H "Accept: application/vnd.github.raw" \
  "/repos/inprincipiophotography-ctrl/PosingInCam/contents/scripts/cardify.sh?ref=claude/photography-pose-app-jGwu9" \
  > ~/Desktop/cardify.sh && chmod +x ~/Desktop/cardify.sh
```

---

## Jedan fajl (quick test, jedna poza)

```bash
~/Desktop/cardify.sh -a TEMPLATE INPUT OUTPUT
```

Flagovi: `-a` auto-detect orientation, `-l` landscape, `-p` portrait

Primjer Sony:
```bash
~/Desktop/cardify.sh -a ~/Desktop/TEMPLATE-A7III.JPG ~/Desktop/pose.jpg ~/Desktop/DSC00001.JPG
```

Primjer Canon:
```bash
~/Desktop/cardify.sh -a ~/Desktop/TEMPLATE-R6M2.JPG ~/Desktop/pose.jpg ~/Desktop/IMG_0001.JPG
```

Vendor se auto-detektira iz template-ovog Make taga (SONY → sony, Canon → canon).

---

## Bulk (cijeli paket od 30+ poza)

### Sony

## Bulk (cijeli paket od 30+ poza) — `build-pack.sh`

Wrapper around cardify koji petlja, auto-detektira vendor, automatski imenuje output. Jedna komanda umjesto šest linija bash-a.

```bash
~/Desktop/build-pack.sh <template.JPG> <input.zip ili folder> [output-dir]
```

Input može biti **ZIP fajl** (auto-extracts) ili **folder** s `.jpg` exportima. Output dir je opcionalni; ako se ne preda, defaultira na `<source-stem>-pack/` pored input-a.

### Sony

```bash
~/Desktop/build-pack.sh ~/Desktop/TEMPLATE-A7III.JPG ~/Desktop/SONY-DAY.zip
```

Producira `~/Desktop/SONY-DAY-pack/DSC00001.JPG`–`DSC0NNNNN.JPG` (5-digit, Sony konvencija).

### Canon

```bash
~/Desktop/build-pack.sh ~/Desktop/TEMPLATE-R6M2.JPG ~/Desktop/canva-canon.zip
```

Producira `~/Desktop/canva-canon-pack/IMG_0001.JPG`–`IMG_NNNN.JPG` (4-digit, Canon konvencija).

**Vendor + filename pattern se auto-pickaju iz template Make tag-a** — ne moraš ih ručno specificirati.

### Update build-pack.sh s GitHuba (kad se izmijeni)

```bash
gh api -H "Accept: application/vnd.github.raw" \
  "/repos/inprincipiophotography-ctrl/PosingInCam/contents/scripts/build-pack.sh?ref=claude/photography-pose-app-jGwu9" \
  > ~/Desktop/build-pack.sh && chmod +x ~/Desktop/build-pack.sh
```

---

## Validate jedan fajl (diagnose customer complaint)

```bash
~/Desktop/cardify.sh --validate ~/Desktop/DSC00001.JPG
```

Ispisuje `✓` ili `✗` po kategorijama (Make, Model, Encoding, Subsampling, Orientation, Thumbnail). Vendor se auto-detektira iz fajl-ovog Make taga.

---

## SD card deploy (za vlastiti shoot)

```bash
# 1. Provjeri da je SD mountan:
ls /Volumes/

# 2. Sony pack na Sony SD:
cp -p ~/Desktop/customer-pack-sony/*.JPG /Volumes/<sd>/DCIM/100MSDCF/

# Canon pack na Canon SD:
cp -p ~/Desktop/customer-pack-canon/*.JPG /Volumes/<sd>/DCIM/100CANON/

# 3. Eject čisto:
diskutil eject /Volumes/<sd>

# 4. Insert u kameru → Playback. Ako pose-i ne vide:
#    Sony: MENU → Setup → Media → Recover Image Database
#    Canon: rijetko treba — obično se odmah vide
```

---

## Vendor reference

| Vendor | EXIF Make | Output prefix | DCF folder | Output digits |
|---|---|---|---|---|
| Sony Alpha | `SONY` | `DSC0` | `100MSDCF` | 5 (`DSC00001`) |
| Canon EOS | `Canon` | `IMG_` | `100CANON` | 4 (`IMG_0001`) |
| Nikon Z | `NIKON CORPORATION` | `DSC_` | `100NCZ_X` (body-specific X) | 4 (`DSC_0001`) |

Cardify + build-pack auto-detektiraju vendor iz template Make tag-a i biraju ispravan output filename pattern. Nikon DCF folder je body-specific: Z8 → `100NCZ_8`, Z6/Z6 II/Z6 III → `100NCZ_6`, Z7/Z7 II → `100NCZ_7`, Z9 → `100NCZ_9`. Customer kopira fajlove u onaj folder koji je njegov body sam kreirao.

---

## Sources templejta (kad treba novi)

- **Sony A7 III/IV/V cluster**: jedan template iz najstarijeg dostupnog body-ja pokriva sve (BIONZ X/XR ekosystem). Real SOOC > DPReview ako body je A7 III firmware v4.01+.
- **Canon EOS R6 cluster**: Zlatkov R6 Mark II SOOC je master template — hardware-verified i na R6 Mark II i na R6 Mark III (cross-body). Jedan fajl pokriva liniju. R5 line untested ali expected da prati isti pattern.
- **Nikon Z cluster**: Z6 III iz DPReview je clean (gold-standard). Z8 iz DPReview je Photo Mechanic-touched. Hardware verifikacija na Z6 II/III ili Z8 body-ju ostaje pending.
- **Nikon/Fuji/OM**: još nije code-supported. Treba dodati `case` block u cardify (vidi `docs/SONY_Q_TABLE_DISCOVERY.md` § Sourcing strategy).

---

## Tipičan workflow tijekom dana

1. Dizajniraš nove poze u Canvi → export JPEG → drop u `~/Desktop/canva-exports/`
2. Re-run bulk loop (Sony i/ili Canon)
3. Validate par random outputa (`cardify.sh --validate`)
4. Drop nove `DSCxxxxx.JPG` / `IMG_xxxx.JPG` u tvoj testing SD
5. Test na svom A7 IV / A7 V (Sony) ili posuđen Canon (kad mogu)
6. Ako sve radi → ažuriraj customer pack ZIP-ove → spreman za prodaju

---

## Branch reference

Sve gore radi na grani **`claude/photography-pose-app-jGwu9`** (commit `03ca45a` ili noviji). Drugi developeri rade na main; ti pull-aš odavde.
