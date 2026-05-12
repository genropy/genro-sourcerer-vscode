# Sourcerer Visual — Architecture

**Version**: 0.2.0 (post-refactor, in progress)
**Last Updated**: 2026-05-12
**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato

## Scope

This document describes the **target architecture** of the Sourcerer Visual
VSCode extension after the schema-driven refactor currently in flight. It
supersedes the architecture sketch in `llm-docs/sourcerer-vscode.md`, which
still reflects the pre-refactor state (v0.1.0, five sidebar views and
fourteen dedicated commands).

For decision rationale see `docs/decisions/ADR-001`, `ADR-002`, `ADR-003`.
For the open work items needed to reach this target, see
`docs/design/workbench-refactor.md`.

## What the extension is

A VSCode extension that gives developers a visual interface to the
Sourcerer Knowledge Base and code index. Pure REST client over the
Sourcerer HTTP API (Bearer token, JSON envelope `{data, meta}`). Single
runtime dependency (`markdown-it`). No MCP, no WebSocket, no language
server.

## High-level shape

```
VSCode Extension Host
  └── extension.ts (activate / deactivate)
       ├── SourcererClient        ──► HTTP to Sourcerer REST API
       │     • Bearer auth, in-memory cache, generic callEndpoint()
       │
       ├── KBTreeProvider         ──► sidebar view "Knowledge Base"
       │     • static tree shape: topics → skills
       │     • populated from /api/kb/topic_tree + /api/kb/skills
       │     • leaves trigger SkillPreview (WebviewPanel)
       │
       ├── ToolTreeProvider       ──► sidebar view "Tools"
       │     • dynamic, populated from OpenAPI introspection
       │     • categories (kb, code, sem, gh, ctx, impact, err, sweeter)
       │     • leaves trigger sourcerer.open with the tool id
       │
       └── WorkbenchPanel         ──► singleton tabbed WebviewPanel
             • one tab per active tool
             • form auto-generated from ParamDef[]
             • results rendered from ResponseFieldDef[] + renderHint
```

Two views in the sidebar, one panel in the editor area. Everything else
flows from the OpenAPI schema fetched at activation.

## Module layout

```
src/
├── extension.ts           # activate(), wires everything together
├── api/
│   ├── client.ts          # SourcererClient: HTTP, cache, generic callEndpoint
│   └── types.ts           # response types (Topic, Skill, etc.)
├── config/
│   └── settings.ts        # typed read of workspace configuration
├── utils/
│   └── logger.ts          # OutputChannel wrapper
├── kb/
│   ├── kbTreeProvider.ts  # TreeDataProvider for topics/skills
│   ├── kbTreeItems.ts     # TreeItem subclasses
│   ├── kbCommands.ts      # refresh, viewSkill, checkConnection
│   └── skillPreview.ts    # WebviewPanel for markdown preview of a skill
├── schema/
│   ├── types.ts           # ToolDef, ParamDef, ResponseFieldDef, RenderHint
│   └── schemaLoader.ts    # fetch /api/code/openapi_schema → ToolDef[]
├── tools/
│   └── toolTreeProvider.ts # TreeDataProvider for ToolDef[], grouped by category
└── workbench/
    ├── workbenchPanel.ts   # singleton WebviewPanel, dispatches tool calls
    ├── workbenchHtml.ts    # static HTML shell + JS client for tab UI
    └── resultRenderer.ts   # server-side HTML rendering per response field
```

The `kb/` module is hand-coded because the KB tree shape (topics, skills,
markdown content) is a stable contract worth a dedicated UX. Everything
else under `tools/`, `workbench/`, and `schema/` is generic and driven
by the OpenAPI document.

## Activation flow

1. `activate(context)` reads `settings` and constructs `SourcererClient`.
2. Two `TreeDataProvider` instances are created:
   - `KBTreeProvider` (eagerly usable, queries `/api/kb/topic_tree`).
   - `ToolTreeProvider` (initially empty, awaits schema).
3. Two `TreeView` are registered on the `sourcerer` activity-bar container.
4. `loadSchema(client, toolsProvider)` is fired asynchronously: it calls
   `/api/code/openapi_schema`, runs `loadToolDefs()` to build a
   `ToolDef[]`, and pushes it into the tools provider with
   `setTools()`, which fires `onDidChangeTreeData`.
5. Commands are registered:
   - `sourcerer.open [tabId?]` — open (or reveal) the Workbench, optionally
     activating a specific tab.
   - `sourcerer.reloadSchema` — re-run `loadSchema()`.
   - `sourcerer.refresh`, `sourcerer.viewSkill`, `sourcerer.checkConnection`
     — KB-specific.
6. A `workspace.onDidChangeConfiguration("sourcerer")` listener rebuilds
   the client, refreshes the KB tree, updates the Workbench client,
   and reloads the schema.

## The OpenAPI-driven model

The single most important architectural change vs. v0.1 is that
**tools are not hardcoded**. The Sourcerer server publishes a complete
OpenAPI document; the extension introspects it and derives:

- The **list of tools** to expose (one per GET endpoint, with admin/srv
  and a few meta paths excluded).
- The **category** of each tool (first segment of the path: `kb`,
  `code`, `sem`, `gh`, `ctx`, `impact`, `err`, `sweeter`).
- The **input form** of each tool (one field per OpenAPI parameter, with
  type, default, enum, required flag).
- The **output rendering** of each tool (one column per response field,
  with a `renderHint` inferred from the field name: `code`, `link`,
  `badge`, `docstring`, `list`, `text`).

Consequence: adding a new endpoint server-side automatically makes a new
tool appear in the sidebar with a working form and rendered results. No
extension code needs to change for new read endpoints.

Limitations of the heuristic (intentional, documented):
- Only GET endpoints are introspected. Write operations would need a
  different flow (confirmation, side-effects).
- The renderHint inference uses a fixed allowlist of field names; new
  field names default to `text` until the allowlist is extended.
- Icons for categories and individual tools come from lookup maps
  (`CATEGORY_ICONS`, `TOOL_ICONS`) keyed by hand. Unknown keys fall back
  to generic icons.

## The Workbench

A single `WebviewPanel` (`viewType: sourcerer.workbench`) that hosts all
tool interactions. Key properties:

- **Singleton**: only one Workbench at a time. Subsequent
  `sourcerer.open` calls reveal the existing panel and switch tab.
- **Retained context**: `retainContextWhenHidden: true` so the panel
  state survives the user switching to another editor tab.
- **CSP-locked HTML**: nonce-protected inline script, no remote
  resources, no `unsafe-eval`. The only inline content allowed is the
  small JS client that drives the tab UI.
- **Message protocol** (extension ⇄ webview):
  - `webview → ext`: `{command:"search", tab, params}`
  - `ext → webview`: `{command:"activateTab", tab, autoRun}` |
    `{command:"results", tab, html}` |
    `{command:"error", tab, message}`
- **Auto-run**: when a tool has no required parameters, opening its tab
  runs it immediately. Otherwise the user fills the form and submits.

The Workbench knows nothing about specific tools — it dispatches calls
to `SourcererClient.callEndpoint(path, params)` and asks
`resultRenderer.renderResults(data, responseFields)` to produce the
result HTML.

## The KB Explorer (separate)

The KB tree is intentionally **not** unified with the Tools tree. They
serve different mental models:

- KB Explorer = "what knowledge exists, organized by topic". It is a
  taxonomy. Users browse it like a wiki.
- Tools Explorer = "what queries can I run". It is an action menu.
  Users click it like a command palette.

Merging them would force one mental model on the other. They remain two
peers under the same activity-bar container.

See ADR-003 for the full reasoning.

## Settings

Three workspace-scoped settings (under `sourcerer.*`):

| Key | Type | Default | Effect |
|---|---|---|---|
| `apiUrl` | string | `https://sourcerer.genropy.net` | Base URL of the Sourcerer REST API |
| `token` | string | `""` | Bearer token (required for non-public endpoints) |
| `cacheTtlSeconds` | number | `300` | TTL of the HTTP response cache |

Changes are observed via `onDidChangeConfiguration` and propagated to
the live client and the live Workbench instance without requiring a
reload.

## Build and packaging

- TypeScript strict mode, no `any`, no implicit returns.
- Bundled with `esbuild` to a single `dist/extension.js` (CommonJS,
  Node target, source maps in dev).
- `dist/` is **build output, not source** — must be regenerated whenever
  sources change (see ADR-004 if/when we decide whether to version it).
- Single runtime dependency: `markdown-it`. Everything else is a
  dev-time concern.

## Testing

Smoke testing in the Extension Development Host (F5) is the primary
gate today. The pre-refactor `test/suite/` contains a basic activation
test via `@vscode/test-electron`. The refactor needs:

- A unit test for `schemaLoader.loadToolDefs()` with a fixture OpenAPI
  document, asserting the produced `ToolDef[]` shape.
- A unit test for `resultRenderer.renderResults()` per `RenderHint`.
- A manual smoke test of the full Workbench against a live Sourcerer
  instance.

Full end-to-end coverage is explicitly out of scope: the extension is a
thin REST client whose value is in the UX, not in business logic.

## Non-goals

Listed here so they do not creep in by accident:

- No bundled MCP server. Sourcerer is REST; the MCP bridge lives elsewhere.
- No Sourcerer write operations from the extension (POST/PUT/DELETE).
  Write flows go through the Sourcerer web UI or admin tools.
- No local caching of the OpenAPI schema across sessions. It is fetched
  fresh on activation.
- No language server / completion / hover providers. The extension does
  not analyze the user's code.
- No telemetry.

## See also

- `docs/decisions/ADR-001-workbench-singleton.md`
- `docs/decisions/ADR-002-schema-driven-tools.md`
- `docs/decisions/ADR-003-separate-kb-and-tools-trees.md`
- `docs/design/workbench-refactor.md` (active work)
- `docs/design/genropy-debug.md` (deferred work item)
- `docs/design/claude-sessions-view.md` (deferred work item)
