# Signed-in audit: studio project picker and "Your projects" (October 2026)

Skills: premium-ux-states (states, recovery), Impeccable (critique: hierarchy, one primary action),
Vercel web-design-guidelines (a11y, destructive actions). Checked with Playwright against mocked
`/api/me` and `/api/history` (six projects), at 1440 and 390 px.

## Verdict
The signed-in area looked tidy but failed the two moments that matter for a returning photographer.
A new wedding silently landed in the last project, and nothing could ever be removed from the list.
Layer 1 (every state of every action) was the weakest; this pass fixes it and quiets the list.

## Layer 1: every action answers three questions

| Action | What happened | Take it back | What next |
|---|---|---|---|
| Open the studio (signed in) | Before: last project pre-selected ❌; now: "+ New project" with the name field ready | Pick a project in "Which wedding?" | Name the wedding, make cards |
| "Add cards" on a project | Studio scrolls up, the project is picked and flashes | Pick "+ New project" | Make cards; numbers continue |
| "Download ZIP" | Button reads "Preparing…", then the ZIP saves | n/a | Copy to the SD card |
| "Show batches" (⋯ menu) | The project's batches open inside its card | "Hide batches" | Download one batch |
| "Delete project" (⋯ menu) | Before: impossible ❌. Now: card leaves the list; toast "Deleted “X” and its N cards. Cards already on your SD card stay." | "Undo" in the toast for 8 s | Focus moves to the next project |
| Delete fails (server/network) | Before: n/a. Now: card comes back; toast "Couldn't delete “X”. Nothing was removed." | n/a: nothing changed | "Try again" in the toast |

S2: every button gives immediate feedback (busy "Preparing…", optimistic removal, toasts).
S3: no dead controls. The ⋯ menu works by mouse and keyboard (Enter, ↑/↓, Esc, Tab).

## Layer 2: one product
- Destructive actions now use the site's one undo pattern (the same toast as a removed line or a pasted list).
- Red is the single primary action on the page again (the studio's "Make my card"). The project list
  used to repeat five red "Download" buttons; now it is "Add cards" (secondary) and a quiet "Download ZIP".
- "Project" / "Name this job" became one label, "Which wedding?", in both the first-time and returning cases.

## Layer 3: recovery (break it on purpose)
| Condition | Before | Now |
|---|---|---|
| Delete, then change your mind | n/a | Undo for 8 s; nothing is sent to the server until then |
| Close the tab during the Undo window | n/a | The delete is sent with `keepalive` on `pagehide` |
| Server refuses or network drops | n/a | Project restored, toast says nothing was removed, "Try again" |
| List refreshes during the Undo window | n/a | The pending project stays hidden |
| Last project deleted | Section vanished | "No projects yet. Your next cards will start one." |
| Someone else's project id | n/a | 404, nothing touched (`qa/test_ownership.py`) |
| Cross-site request | n/a | 403 (`session.same_origin`) |

## What deleting does on the server
`POST /api/history {"delete_project": id}` (owner only) removes the project's stored card files,
detaches its batches (`storage_prefix`, `files`, `project_id` cleared) and deletes the project row.
The `conversions` rows stay, because the daily card cap counts them, so deleting never hands cards back.

## Fixes made (all High)
1. "+ New project" first and the default; an existing project only when picked on purpose this visit.
2. Project deletion with Undo, keepalive commit, restore on failure, owner-only API and tests.
3. "Your projects" as cards with each project's first cards on a camera screen, one secondary and one
   quiet action, and a ⋯ menu; one column of compact rows on phones; an empty state.
4. Studio picker without the box-in-a-card; shorter hints.

## Left as suggestions
- Rename a project (the ⋯ menu has room for it).
- Show which projects are watermarked (free) at a glance.
