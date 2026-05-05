# Product Requirements Document — PosingInCam

| Field | Value |
| --- | --- |
| **Status** | Draft v0.1 |
| **Owner** | TBD |
| **Last updated** | 2026-05-05 |
| **Target launch** | MVP in 8 weeks (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)) |

## 1. Background and problem

Wedding and portrait photographers routinely interrupt shoots to consult posing references. The reference is almost always on the photographer's phone — Pinterest boards, Instagram saves, Notes app, Together Cards PDF, or a posing app like Unscripted. Pulling out a phone mid-shoot has three concrete costs:

1. **Trust erosion with subjects.** A bride mid-shoot whose photographer is staring at a phone reads as: "this person is winging it." Eye contact with the couple is the trust currency of the session.
2. **Pace breakage.** Switching contexts from camera-in-hand to phone-unlock-app-scroll-find-pose-relock-recompose costs 20–60 seconds per pose lookup. A 60-pose engagement shoot can lose 30+ minutes to phone fumbling.
3. **Workflow brittleness.** Phones die, glove-handed photographers can't unlock with FaceID, sun glare washes out the screen, the app needs an update, the wedding venue has no signal for an Instagram saved post.

[Cue (shootwithcue.com)](https://www.shootwithcue.com) demonstrated the obvious-in-hindsight solution: ship the references as JPEGs that load in the camera's native playback. We are building the same primitive as an open, programmatic, extensible library.

## 2. Goals and non-goals

### Goals

- **G1.** Ship a curated library of 100+ posing reference cards rendered as camera-native JPEGs.
- **G2.** Support the major mirrorless ecosystems used by working professionals: Sony Alpha, Canon EOS R, Nikon Z, Fujifilm X, Panasonic Lumix S.
- **G3.** Generation must be programmatic. New poses, fixed typos, refreshed art, new camera support — all shippable via a CLI run, not a Photoshop session.
- **G4.** Each card's embedded EXIF thumbnail must be the line-art only, so the camera's grid view becomes a wordless pose finder.
- **G5.** Total library size 20–100 MB. Individual cards target 50–300 KB.
- **G6.** A pose contributor with no programming background should be able to author a new pose by editing one YAML file.

### Non-goals (for v1)

- Live, in-camera mutation of the cards (cameras don't expose APIs for this).
- An iOS/Android companion app. The whole pitch is *no phone*.
- AI-generated illustrations. Art is hand-authored or commissioned; the generator only composes layouts.
- Personalization at runtime. Branding/customization happens at build time.
- Video pose references. JPEG only.
- A storefront. v1 is the open-source generator + library; commercial packaging is downstream.

## 3. Users and personas

### Primary: working couples/wedding photographer

- 5–80 sessions per year, mostly couples and weddings.
- Shoots Sony A7 IV / Canon R6 II / Nikon Z6 III class bodies.
- Has a personal "go-to" mental list of ~20 poses but freezes under time pressure with new clients or at unfamiliar venues.
- Currently uses: phone Notes / Pinterest / Together Cards PDF / Cue.
- **Will pay** for a library that's good enough to replace the phone reflex.

### Secondary: second shooter / assistant

- Less experience, leans more heavily on references.
- Often shoots whatever body the lead hands them.
- Needs the cross-camera support more than anyone.

### Tertiary: pose contributor / community

- Senior photographers who want to publish their pose sets.
- Possibly co-branded packs (e.g. "The India Earl Pack").
- Need a contribution flow that doesn't require git wizardry.

## 4. User stories

| ID | Story | Priority |
| --- | --- | --- |
| US-01 | As a photographer, I drop a folder onto my SD card and the cards appear in playback alongside my photos. | P0 |
| US-02 | As a photographer, I scroll the grid view and recognize poses by their line drawing alone (no text needed). | P0 |
| US-03 | As a photographer, I zoom into a card and clearly read the positioning and verbal cue. | P0 |
| US-04 | As a photographer, I never accidentally delete a pose card when I'm bulk-deleting a session. | P1 |
| US-05 | As a photographer, the cards never show up in my Lightroom import. | P1 |
| US-06 | As a contributor, I add a pose by writing one YAML file and opening a PR. | P1 |
| US-07 | As a maintainer, I ship a typo fix as a re-build, not a re-shoot. | P0 |
| US-08 | As a photographer with two bodies (e.g. Sony + Canon backup), I can build the library for both. | P1 |
| US-09 | As a photographer, I can pick a subset (e.g. only "Wedding Day" pack) to keep card count low. | P1 |
| US-10 | As a photographer, I can rebrand the cards with my logo / studio colors. | P2 |
| US-11 | As a photographer, the cards work in continuous playback on cards I haven't formatted recently. | P0 |
| US-12 | As a maintainer, I can ship an update without breaking existing card numbering on users' SD cards. | P2 |

## 5. Functional requirements

### 5.1 Pose card content

Each rendered card must include, in this order, top-to-bottom:

1. **Header**: pose title (e.g. "Forehead Touch — Walking In") and pose ID (e.g. `P-042`).
2. **Illustration area** (~40–50% of card): line-art drawing of the pose. Vector-sourced (SVG) so it scales cleanly. Must be the same image used in the embedded thumbnail.
3. **Two-column positioning block**:
   - **HER**: 1–3 short bullets describing her stance, weight, hands, gaze.
   - **HIM**: same, for him.
4. **Camera notes**: lens recommendation, focal length range, aperture, shooting angle, subject distance.
5. **Say to the couple**: the *exact* verbal cue. This is the core IP — it's what the photographer says out loud to get the pose.
6. **Footer**: pack name, difficulty (1–3 dots), variation hints.

### 5.2 Embedded thumbnail

- The EXIF thumbnail segment must contain the line illustration only — no text, no border, no header.
- Size: 160×120 (DCF spec). Cameras use this for grid view.
- Must be valid EXIF/JPEG so the camera renders it instead of falling back to decoding the full image.

### 5.3 File and folder layout

The output for a given camera profile must be a DCF-compliant tree drop-in:

```
<output>/
  DCIM/
    100POSEX/                       # folder name varies by camera profile
      DSC00001.JPG                  # filename pattern varies by camera profile
      DSC00002.JPG
      ...
```

Camera-specific naming conventions are codified per profile (see [CAMERA_COMPATIBILITY.md](CAMERA_COMPATIBILITY.md)). Folder numbering must not collide with the user's working numbering (we default to a folder number unlikely to be in use, e.g. `199POSEX`, configurable).

### 5.4 Image specifications

- **Format**: baseline JPEG, EXIF 2.31 metadata.
- **Dimensions**: per-camera-profile, but defaults: 3840×2560 (3:2) for full-frame bodies. Smaller bodies / older bodies may use 2400×1600.
- **Color space**: sRGB.
- **Quality**: q=85, mozjpeg if available, target ≤300 KB per card.
- **EXIF Make/Model**: set to the target camera's identifier so playback treats them as native (e.g. `Make: SONY`, `Model: ILCE-7M4`). Optional.
- **EXIF DateTimeOriginal**: set to a stable, distinguishable date (e.g. 2000-01-01) so they sort to one end of the timeline and don't intermix with real shoots.
- **EXIF UserComment / ImageDescription**: include `posingincam:<pose-id>:<version>` so cards are programmatically identifiable.

### 5.5 Card protection (best-effort)

Cards should be hard to delete by accident:

- Set the file's "read only" attribute at copy time (CLI `install` command).
- Optionally mark protected via DPOF (where supported) — investigate per camera in M3.
- Filename and EXIF tagging make them easy to filter/exclude in Lightroom imports via a saved filter.

### 5.6 CLI commands (v1)

| Command | Purpose |
| --- | --- |
| `posingincam build --camera <id> [--pack <name>] [--pose <id>] --out <dir>` | Render JPEGs for a camera. |
| `posingincam install --camera <id> --target <sd-mount>` | Build (if needed) and copy to SD card root. |
| `posingincam validate [poses/]` | Lint pose YAMLs against the schema. |
| `posingincam cameras list` | List supported camera profiles. |
| `posingincam cameras add` | Wizard to create a new camera profile (advanced). |
| `posingincam preview <pose-id>` | Render a single card and open it locally. |
| `posingincam doctor` | Diagnose SD card / mount issues. |

### 5.7 Pose pack curation

- Cards are organized into packs (e.g. `essential`, `wedding-day`, `engagement`, `boudoir`, `families`, `golden-hour`, `posing-prompts`).
- Each pose belongs to one pack but can be tagged for cross-pack discovery.
- Packs can be built and installed independently to keep card count manageable.

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Total library after build ≤ 100 MB for all 100+ cards. |
| NFR-02 | A single `build --camera X` for the full library completes in ≤ 60 s on a modern laptop. |
| NFR-03 | Single-card render in ≤ 1 s. |
| NFR-04 | The renderer is deterministic — running it twice on the same input produces byte-identical JPEGs (modulo timestamps we explicitly set). |
| NFR-05 | All output passes a DCF validator (custom test, see ARCHITECTURE §Testing). |
| NFR-06 | A new contributor can submit a pose without installing Python (web-based PR flow with CI rendering, M4). |
| NFR-07 | `posingincam` runs on macOS, Linux, Windows (via Python 3.11+). |
| NFR-08 | No network calls at build or install time. The library is fully offline. |
| NFR-09 | Generator code coverage ≥ 80%. |

## 7. Compatibility scope

See [CAMERA_COMPATIBILITY.md](CAMERA_COMPATIBILITY.md) for the full matrix. Summary for v1:

| Tier | Bodies | Status |
| --- | --- | --- |
| Tier 1 (must work, owner-tested) | Sony A7 IV, Sony A7 III, Canon R6 Mark II, Canon R5, Nikon Z6 III, Nikon Z8 | MVP |
| Tier 2 (profile shipped, community-tested) | Fujifilm X-T5, Panasonic S5 II, Sony A7R V, Canon R7, Nikon Zf | M3 |
| Tier 3 (best-effort, generic profile) | Older Sony Alpha, older Canon EOS, older Nikon DSLR | Post-v1 |

## 8. Success metrics

We are pre-launch, so metrics are aspirational and tied to milestones:

| Metric | Target |
| --- | --- |
| Cards in library at v1 launch | ≥ 100 |
| Camera profiles at v1 launch | ≥ 6 (Tier 1) |
| Time from CLI invocation to SD-ready output (full library) | ≤ 60 s |
| Round-trip "edit one YAML → installed on SD card" | ≤ 90 s |
| Beta photographers reporting "I stopped reaching for my phone" | ≥ 7/10 |

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Some cameras refuse to display non-native JPEGs (corrupt thumbnail, missing EXIF tags). | High | Per-camera profile tested with real hardware in M2; fallback EXIF templates. |
| EXIF Make/Model spoofing causes camera firmware confusion. | Medium | Make this opt-in; default profile uses a generic Make/Model that still passes DCF. |
| Card images get pulled into Lightroom imports and clutter clients' galleries. | Medium | Tag in EXIF with `posingincam:` marker; ship Lightroom smart-collection filter; recommend the user keep poses on a dedicated SD card or in a high folder number. |
| Folder/file numbering collides with user's actual photos and the camera renumbers things. | Medium | Default to high folder number (`199POSEX`), document the trade-off, allow override. |
| Hand-illustrating 100+ poses is slow / expensive. | High | Start with 30 poses commissioned, build the generator against those, then scale art production in parallel with engineering. |
| Cue (or another competitor) builds an exclusive deal with a manufacturer. | Low | Open-source moat; a programmatic library is a different product than a polished SaaS. |

## 10. Open questions

- **OQ-01.** Do we attempt EXIF Make/Model spoofing per camera by default? (Higher compatibility, but unclear legality/firmware ramifications.) → resolve in M2 after hardware testing.
- **OQ-02.** Is the v1 license MIT (community contributions easy, anyone can fork and sell), or AGPL (protect against commercial fork)? → resolve before M5.
- **OQ-03.** Do we ship a small Tauri/Electron desktop app for non-CLI users in v1.1? → revisit after MVP feedback.
- **OQ-04.** Should pose IDs be globally stable (`P-042` forever) or pack-scoped (`essential-042`)? → resolve in pose-schema lock-down.
- **OQ-05.** How do we handle pose updates on an SD card that already has v1 cards? Overwrite by filename? Append? → ADR in M3.

## 11. Out of scope for this PRD (tracked elsewhere)

- Branding / logo / studio identity for the project itself.
- Pricing model and storefront for commercial packs.
- Pose authoring style guide (visual + verbal voice consistency).
- Hiring / commissioning the illustrator.
