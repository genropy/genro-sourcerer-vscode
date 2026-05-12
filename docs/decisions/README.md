# Architecture Decision Records

This directory holds short, dated records of architectural decisions
taken during the development of Sourcerer Visual.

## Format

Each ADR is a single Markdown file named
`ADR-NNN-short-slug.md`. The structure is intentionally minimal:

- **Status** — one of: 🔴 DA REVISIONARE, 🟡 APPROVATO PARZIALMENTE,
  🟢 APPROVATO, ⚫ SUPERSEDED.
- **Date** — when the decision was effectively taken or last revised.
- **Context** — what problem prompted the decision.
- **Decision** — what was decided, in one or two sentences.
- **Consequences** — what changes because of this decision (positive and
  negative).
- **Alternatives considered** — short list with one-line verdicts.

ADRs are immutable in spirit: when a decision is reversed, we add a new
ADR that supersedes the old one (and mark the old one ⚫ SUPERSEDED with
a link to the new one), instead of editing history.

## Index

- [ADR-001 — Workbench singleton](ADR-001-workbench-singleton.md)
- [ADR-002 — Schema-driven tools](ADR-002-schema-driven-tools.md)
- [ADR-003 — Separate KB and Tools trees](ADR-003-separate-kb-and-tools-trees.md)
