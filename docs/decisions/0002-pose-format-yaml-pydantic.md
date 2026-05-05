# ADR 0002: Poses are authored as YAML, validated by Pydantic v2

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-05-05 |
| **Deciders** | TBD |

## Context

A pose file needs to capture: identifying metadata (id, slug, title, pack, tags), a multiline verbal cue, two short bulleted positioning blocks, camera notes, an illustration reference, and optional credits.

Authors are photographers, not engineers. The format must be:

- Easy to read in a code editor or even a plain text editor.
- Diff-friendly so PRs are reviewable.
- Tolerant of multi-line strings (the verbal cue often spans lines).
- Strictly validated so typos surface at PR time, not at render time.

## Options considered

- YAML
- TOML
- JSON
- Markdown front-matter + Markdown body
- A custom DSL

## Decision

YAML, validated by Pydantic v2 models. One YAML file per pose.

## Consequences

- Multi-line verbal cues are readable: `verbal_cue: |\n  "..."`.
- Comments are allowed.
- Schema is enforced by `posingincam validate` and CI; bad YAML never reaches a render.
- YAML's gotchas (Norway problem, indent-sensitivity) are mitigated by always running through Pydantic.
- Pydantic v2 produces clear, line-located error messages from raw YAML when paired with `ruamel.yaml` for parse-with-locations.

## Alternatives, rejected

- **TOML**: poor multi-line string ergonomics, fewer pose-authors are familiar with it.
- **JSON**: no comments, no multi-line strings without escaping. Hostile to humans.
- **Markdown front-matter**: front-matter for metadata, body for cue. Mixes formats; tooling support for validating front-matter is weaker.
- **Custom DSL**: a non-starter at our scale; reinventing what YAML already gives us.
