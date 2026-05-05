# Architecture Decision Records (ADRs)

We log non-trivial decisions as numbered, immutable records here. The format is small on purpose: context, options, decision, consequences. We prefer many small ADRs over a few mega ones.

When you make a non-trivial decision in a PR, drop a new file: `NNNN-short-slug.md`, copying the structure of any existing ADR. Use the next free number.

## Index

| # | Title | Status |
| --- | --- | --- |
| 0001 | [Implementation language is Python 3.11+](0001-language-python.md) | Accepted |
| 0002 | [Poses are authored as YAML, validated by Pydantic v2](0002-pose-format-yaml-pydantic.md) | Accepted |
| 0003 | [Card layout is a Jinja2-templated SVG, rasterized at build time](0003-svg-template-rasterize.md) | Accepted |

## Pending (placeholders, will be drafted in their owning milestone)

| # | Title | Owning milestone |
| --- | --- | --- |
| 0004 | EXIF Make/Model spoofing strategy per profile | M2 |
| 0005 | Folder numbering convention (default `199`) | M3 |
| 0006 | Stable pose ID scheme (`P-NNN`) | M3 |
| 0007 | Determinism guarantee (byte-identical rebuilds) | M3 |
| 0008 | Update strategy on a card with previous-version cards | M4 |
