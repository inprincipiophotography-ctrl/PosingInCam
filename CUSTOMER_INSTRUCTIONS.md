# Kako koristiti pose kartice u svom aparatu

Bok! Hvala što si kupio paket pose kartica. Evo kako da ih za par minuta ubaciš na SD karticu i koristiš direktno iz aparata, bez vađenja telefona usred shootinga.

---

## Što je u ZIP-u

```
PosingCards-<paket>-Sony/
├── DCIM/
│   └── 100MSDCF/
│       ├── DSC00099.JPG
│       ├── DSC00100.JPG
│       └── ... (sve kartice paketa)
└── KAKO_KORISTITI.md  ← ovo
```

`DCIM/100MSDCF/` je standardna struktura koju Sony aparati koriste. Sve kartice idu u taj folder.

---

## Korak 1 — pripremi SD karticu

**Najsigurnije**: koristi novu/dediciranu SD karticu samo za pose kartice. Tako ti se ne miješaju s pravim fotkama sa shootova.

Ako ćeš koristiti karticu na kojoj već imaš fotke:

1. Ubaci karticu u aparat.
2. Idi na **MENU → Setup → Media → Format** i formatiraj (po želji — ovo briše sve s kartice; preskoči ako želiš zadržati postojeće fotke).
3. Snimi jednu običnu fotku — to forsira aparat da kreira `DCIM/100MSDCF/` strukturu na kartici.
4. Izvuci karticu iz aparata.

---

## Korak 2 — kopiraj kartice na SD

1. Ubaci SD u Mac/PC (preko USB čitača ili slota).
2. Otvori SD karticu — vidjet ćeš već postojeći `DCIM/100MSDCF/` folder (ako si snimio fotku u koraku 1).
3. Iz ovog ZIP-a, **kopiraj sav sadržaj iz `DCIM/100MSDCF/` foldera** u taj isti folder na SD kartici.

Krajnji rezultat na SD treba izgledati ovako:
```
SD-kartica/
└── DCIM/
    └── 100MSDCF/
        ├── DSC00001.JPG     ← tvoja stara fotka (ako postoji)
        ├── DSC00099.JPG     ← pose kartica iz paketa
        ├── DSC00100.JPG     ← pose kartica iz paketa
        └── ...
```

4. **Eject SD karticu čisto** (na Macu: cmd+E ili klik na eject ikonu pored kartice u Finderu; na Windows-u: "Safely Remove Hardware"). Nemoj fizički izvući karticu prije ejecta — Sony je osjetljiv na nepotpune zapise.

---

## Korak 3 — KRITIČAN — Recover Image Database

> ⚠️ **Ovo je najvažniji korak. Bez njega aparat neće prikazati pose kartice.**

Sony aparati čuvaju interni indeks svih fotki na kartici. Kad ručno dodaš fajl na karticu (preko računala), aparat ga ne vidi dok ne osvježi indeks.

1. Ubaci SD karticu u aparat.
2. Idi na: **MENU → Setup → Media → Recover Image Database** (na nekim firmware verzijama: **Recover Image DB**).
3. Odaberi karticu koju koristiš.
4. Pričekaj 10–30 sekundi da završi.

Aparat će sad indeksirati sve fajlove, uključujući pose kartice.

---

## Korak 4 — koristi u playbacku

1. Pritisni **▶ Playback** dugme.
2. Skrolaj kroz fotke — pose kartice se pojavljuju zajedno s tvojim shootovima.
3. **Tip**: postavi karticu kao "starting frame" prije svake pose i koristi back/forward navigaciju da se prebacuješ između reference i live shoota.

Auto-rotacija radi: portrait kartice se uspravljaju kad držiš aparat vertikalno.

---

## Najčešći problemi

### "Ubacim karticu i ne vidim kartice u playbacku"

99% slučajeva: **nisi pokrenuo Recover Image Database** (Korak 3). Pokreni ga.

### "Vidim kartice ali nakon par dana ponovo nestanu"

Aparat je vjerojatno opet rebuild-ao DB nakon što si snimao na drugi shoot. Ponovi Korak 3.

### "Kartice se miješaju s mojim pravim fotkama u Date View"

Kartice su date-stamped na 2024-01-01 baš da budu daleko od tvojih realnih datuma. Ako shootash arhivu iz 2024, prebaci playback na **Folder View** umjesto Date View: **MENU → Playback → View Mode → Folder View**.

### "Cannot read image" greška

Kartica je vjerojatno korumpirana na SD (greška pri kopiranju). Re-formatiraj SD u aparatu (Korak 1) i ponovno kopiraj (Korak 2).

### "Pojavljuje se ali je rotirano krivo"

Javi nam — to ne bi smjelo biti moguće s validnim fajlovima. Pošalji nam screenshot i kažemo dalje.

---

## Treba ti pomoć?

Pošalji nam mail s opisom problema i, ako možeš, fotkom ekrana aparata. Riješimo brzo.
