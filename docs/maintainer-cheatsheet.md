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
| `TEMPLATE-A7III.JPG` | Sony template (real SOOC iz A7 III) | prijatelj Ivan, ili A7 V/A7 IV iz DPReview-a |
| `TEMPLATE-R5M2.JPG` | Canon template (DPReview R5 Mark II clean) | DPReview sample galleries |
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
~/Desktop/cardify.sh -a ~/Desktop/TEMPLATE-R5M2.JPG ~/Desktop/pose.jpg ~/Desktop/IMG_0001.JPG
```

Vendor se auto-detektira iz template-ovog Make taga (SONY → sony, Canon → canon).

---

## Bulk (cijeli paket od 30+ poza)

### Sony

```bash
TEMPLATE=~/Desktop/TEMPLATE-A7III.JPG
INPUT_DIR=~/Desktop/canva-exports
OUTPUT_DIR=~/Desktop/customer-pack-sony

mkdir -p "$OUTPUT_DIR"
counter=1
for input in $(ls "$INPUT_DIR"/*.jpg | sort -V); do
  output="$OUTPUT_DIR/$(printf "DSC%05d.JPG" "$counter")"
  ~/Desktop/cardify.sh -a "$TEMPLATE" "$input" "$output"
  counter=$((counter + 1))
done
```

### Canon

```bash
TEMPLATE=~/Desktop/TEMPLATE-R5M2.JPG
INPUT_DIR=~/Desktop/canva-exports
OUTPUT_DIR=~/Desktop/customer-pack-canon

mkdir -p "$OUTPUT_DIR"
counter=1
for input in $(ls "$INPUT_DIR"/*.jpg | sort -V); do
  output="$OUTPUT_DIR/$(printf "IMG_%04d.JPG" "$counter")"
  ~/Desktop/cardify.sh -a "$TEMPLATE" "$input" "$output"
  counter=$((counter + 1))
done
```

**Razlika**: Sony output `DSC00001.JPG` (5 digit), Canon output `IMG_0001.JPG` (4 digit). Cardify zna oba — samo treba pravilno output filename.

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

Cardify auto-detektira vendor iz template Make taga; output filename ti zadaješ ručno (mora matchati prefix/digit konvenciju vendora ili Sony/Canon firmware odbija u playbacku).

---

## Sources templejta (kad treba novi)

- **Sony A7 III/IV/V cluster**: jedan template iz najstarijeg dostupnog body-ja pokriva sve (BIONZ X/XR ekosystem). Real SOOC > DPReview ako body je A7 III firmware v4.01+.
- **Canon EOS R cluster**: R5 Mark II je clean iz DPReview. R5/R6/R6 Mark III su Photo Mechanic-touched (možda neće raditi na strožim bodijima). Real SOOC od prijatelja je idealno.
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
