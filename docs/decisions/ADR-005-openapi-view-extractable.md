# ADR-005 — OpenAPI view, designed to be extractable

**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato
**Date**: 2026-05-13

## Context

Sourcerer Visual already has a "Tools" sidebar view that turns the
Sourcerer OpenAPI document into a sidebar tree of categories and tools,
with a rich Workbench tab (description, inline form, results) for each
operation.

Users want the same UX for **any** OpenAPI schema, not only Sourcerer:
register an external API by URL + auth, browse its endpoints, run them
from the Workbench. Industry alternatives (Thunder Client, Postman) are
either form-poor or do not refresh the schema live, which matters for
APIs under active development.

At the same time, Sourcerer Visual must keep its identity as the
Sourcerer client. The new functionality should be built so it can later
be **extracted** as a standalone "OpenAPI Client" VSCode extension,
without dragging Sourcerer-specific code with it.

## Decision

Add a third sidebar view `sourcerer.openapiExplorer` named **OpenAPI**.

Build all OpenAPI-specific logic under a single new module
`src/openapi/`. That module imports only:

- `vscode` (API)
- `src/schema/` (already generic OpenAPI parser, made truly generic in
  this change)
- `src/workbench/` (already generic UI, refined via the `ToolRunner`
  interface in this change)

It does **not** import anything Sourcerer-specific. In particular it
does not depend on `src/api/client.ts` (the `SourcererClient`).

To make this clean, three small refactors were done first:

1. `WorkbenchPanel` now accepts a `ToolRunner` interface
   (`callEndpoint(path, params): Promise<unknown>`) instead of a
   concrete `SourcererClient`. `SourcererClient` already implements
   this interface.
2. `loadToolDefs(client, options?)` accepts a `LoadOptions` config
   (excluded paths, excluded prefixes, category labels, schema URL,
   path prefix). Sourcerer keeps working by default (the export
   `SOURCERER_LOAD_OPTIONS` is the default value), while the generic
   OpenAPI loader passes an empty/permissive config.
3. New module `src/openapi/` with:
   - `types.ts` — `OpenApiSchemaConfig`, `AuthConfig`,
     `OpenApiSchemaInstance`
   - `httpClient.ts` — `GenericHttpClient` implementing `ToolRunner`,
     supporting Bearer and API-key auth
   - `schemaRegistry.ts` — read/write `openapi.schemas` setting,
     load each registered schema's tools
   - `schemasTreeProvider.ts` — three-level tree
     (Schema → Category → Tool)
   - `addSchemaDialog.ts` — chain of QuickPick / InputBox to register
     a new schema
   - `openapiCommands.ts` — `openapi.addSchema`,
     `openapi.removeSchema`, `openapi.reloadSchema`,
     `openapi.runTool`

Commands and settings use the **`openapi.*` prefix** (not
`sourcerer.openapi.*`). When the module is extracted into a standalone
extension, no command name or setting key needs to be renamed.

## Consequences

Positive:

- Users can register any OpenAPI 3.x schema (URL + auth) and call its
  endpoints with the same rich form UI as Sourcerer.
- Sourcerer functionality is unaffected: the Tools view, the KB tree,
  and all existing commands behave identically.
- Extraction path is trivial: copy `src/openapi/`, `src/schema/`,
  `src/workbench/`, `src/tools/` (TreeProvider can be reused or
  duplicated) and `src/utils/` to a new repo, change `package.json`
  manifest, done. No code rename, no API redesign.

Negative:

- Setting `openapi.schemas` stores tokens in cleartext, like
  `sourcerer.token` today. Future work: move credentials to
  `SecretStorage`.
- Three sidebar views now compete for vertical space in the Sourcerer
  container. If the user has many registered schemas the UI can feel
  crowded; mitigation is collapsibility (Schema nodes start collapsed).
- Only Bearer and API-key auth are supported in this iteration. Basic
  auth and OAuth2 would each require a separate flow.
- The first load of a registered schema requires the OpenAPI document
  to be reachable. If the schema URL is private and requires the same
  auth as the API calls, the user must enter the same credentials.
  Mitigation: the `GenericHttpClient` already applies the configured
  auth when fetching the schema document.

## Alternatives considered

### A. Reuse Thunder Client or similar marketplace extension

Verdict: rejected. Their form rendering is generic key/value, loses
enum/boolean/required widgets. They don't refresh the schema live, so
APIs under active development require manual re-imports. The Workbench
UX is strictly better for our use case.

### B. Stuff OpenAPI handling into `src/tools/`

Verdict: rejected. Would couple Sourcerer-only and generic code,
making the future extraction either expensive or impossible.

### C. Build a separate extension from day one

Verdict: rejected for now. Extracting only happens when there's
demand. Until then, shipping in Sourcerer Visual gets the UX in front
of users immediately.

### D. Use OAuth2-capable libraries upfront

Verdict: rejected. Not needed for any known use case yet. Adding
OAuth2 later is straightforward (new `AuthConfig` variant + flow).

## Notes

- Future work item: move OpenAPI credentials to `SecretStorage`.
- Future work item: support YAML OpenAPI documents (today we only
  parse JSON).
- Future work item: schema-level cache TTL similar to
  `sourcerer.cacheTtlSeconds`.
- Future work item: extraction. Track in a follow-up after at least
  one external user adopts the extension purely for OpenAPI.
