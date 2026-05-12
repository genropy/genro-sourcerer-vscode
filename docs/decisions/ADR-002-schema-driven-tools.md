# ADR-002 — Tools are derived from the OpenAPI schema, not hardcoded

**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato
**Date**: 2026-03-28
**Supersedes**: pre-refactor pattern (one VSCode command per endpoint)

## Context

In v0.1 each Sourcerer endpoint we wanted to expose became a dedicated
VSCode command, registered statically in `package.json` and implemented
by hand in a per-category command file:

- `src/code/codeCommands.ts` — `sourcerer.searchCode`,
  `sourcerer.searchSymbols`, `sourcerer.classHierarchy`,
  `sourcerer.symbolDetail`, `sourcerer.symbolSource`,
  `sourcerer.listProjects`.
- `src/sem/semCommands.ts` — `sourcerer.askCodebase`,
  `sourcerer.fulltextSearch`, find similar.
- `src/gh/ghCommands.ts` — `sourcerer.listRepositories`.
- `src/kb/kbCommands.ts` — `sourcerer.search`, `sourcerer.ask`,
  `sourcerer.findSkills` (plus the genuinely KB-specific commands).

Each command did the same five things: ask for an input via `InputBox`,
call the corresponding `client.*` method, handle the empty case, build
a `QuickPick`, dispatch to one of three WebviewPanels.

Two problems with that:

1. **Scaling**: Sourcerer's surface keeps growing (impact analysis,
   context tree, error explanation, sweeter tickets, …). Each addition
   needs a `package.json` entry, a TypeScript handler, an icon choice,
   and a place in the sidebar. ~25 endpoints today, more planned.
2. **Drift**: the extension's view of an endpoint (parameter names,
   defaults, response fields) is hand-typed and drifts away from the
   server's contract over time. A field rename or a new optional
   parameter requires a coordinated client update.

The Sourcerer server already publishes a complete OpenAPI document at
`/api/code/openapi_schema`. The schema knows the operation id, the
parameters with their types and defaults, the response envelope, the
fields and their types. Hand-coding what the schema already says is
duplicate work that ages badly.

## Decision

**Tools are generated dynamically from the OpenAPI schema** at
extension activation.

- `loadToolDefs(client)` fetches the schema and produces `ToolDef[]`:
  one entry per GET endpoint, with parameters, response fields, and
  category derived from the path.
- The sidebar Tools tree renders that list, grouped by category.
- The Workbench renders each tool's form from `params: ParamDef[]` and
  its results from `responseFields: ResponseFieldDef[]` plus the
  inferred `RenderHint` for each field.
- Activation calls `loadSchema()` asynchronously. The user gets an
  empty tree for a moment, then it populates.
- The `sourcerer.reloadSchema` command lets the user re-fetch on demand
  (e.g. after the server is updated).

What stays hand-coded:

- The KB tree (topic_tree + skills + markdown preview). It is a stable
  shape worth a dedicated UX.
- The few endpoints excluded from introspection (admin, srv, the
  schema endpoint itself, the four KB endpoints already covered by the
  KB tree).

## Consequences

Positive:
- New read endpoints become available in the extension **without an
  extension release**. The user runs "Sourcerer: Reload Schema" and
  the new tool appears.
- The extension's view of parameters and response fields is the
  server's view, by construction.
- The category grouping in the sidebar and the form generation in the
  Workbench are written once, work for all tools.
- The number of registered VSCode commands collapsed from 14 to 3
  (`sourcerer.open`, `sourcerer.reloadSchema`, plus the existing KB
  ones).

Negative:
- A tool's UX is only as good as the heuristics. The current
  `RenderHint` inference relies on a fixed allowlist of field names
  (`snippet`, `docstring`, `url`, …). New field names fall back to
  plain text until the allowlist is extended.
- Per-tool affordances (e.g. "open this source file in the editor")
  cannot be hardcoded; they have to be expressible via the same
  generic mechanism (renderHint, link fields, etc.) or skipped.
- Activation depends on a live Sourcerer connection. If the server is
  unreachable, the Tools tree is empty (the KB tree degrades the same
  way). The Workbench can still open but every tab fails. Acceptable
  trade-off: the whole extension is useless without the server anyway.
- An OpenAPI schema change with breaking semantics (e.g. envelope shape
  changes from `{data, meta}` to `{result, meta}`) breaks the extension
  silently. Mitigation: contract-level test on a fixture schema; treat
  the envelope shape as part of the public contract.

## Alternatives considered

### A. Keep hardcoded commands, add a code generator

Approach: generate the per-tool TypeScript files from the schema at
build time.

Verdict: rejected. Same drift surface as today, plus a build step.
Generated TS does not solve the "release-to-see-new-tools" problem.

### B. Pure runtime introspection with no allowlists

Approach: derive everything (icons, render hints, labels) automatically
from the schema, no hand-keyed lookup maps.

Verdict: rejected for v0.2. The icon and render hint mappings are small
enough that a curated list gives a noticeably better UX. Revisit when
the lookup tables become a maintenance burden.

### C. Schema-driven tools + dynamic introspection (chosen)

Verdict: accepted. Curated icon and render-hint maps as a hybrid; the
schema does the structural work, the maps do the UX polish.
