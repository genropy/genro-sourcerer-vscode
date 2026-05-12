# ADR-001 — Workbench: a single tabbed WebviewPanel

**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato
**Date**: 2026-03-28
**Supersedes**: pre-refactor pattern (three short-lived WebviewPanels)

## Context

The pre-refactor v0.1 of Sourcerer Visual rendered tool results through
three dedicated, single-purpose `WebviewPanel` classes:

- `SearchResultsPanel` — list of matches with `<<term>>` highlights
- `DetailPanel` — structured detail views (class hierarchy, symbol info)
- `SourcePanel` — source code display

Each `*.show()` call disposed the previous instance of its kind and
created a fresh one. Three panels could coexist, all unrelated, none
remembering its previous content.

Consequences of that design that pushed us to reconsider:

- **No history**: running a second search lost the first one.
- **Wasted real estate**: opening Detail then Source then Search left
  three editor tabs scattered across the workspace.
- **Triplicated boilerplate**: three nearly identical `WebviewPanel`
  setups, three sets of CSP rules, three HTML templates.
- **No cross-tool flow**: switching between e.g. `searchCode` and
  `findUsages` could not preserve the user's working context.

At the same time, the schema-driven approach (see ADR-002) made it
obvious that the number of tools would keep growing — adding one
WebviewPanel per tool was not going to scale.

## Decision

All tool interactions are hosted in **one singleton `WebviewPanel`**
with `viewType: sourcerer.workbench`, called the **Workbench**.

- One panel at a time. `WorkbenchPanel.open(...)` reveals the existing
  panel if any, otherwise constructs it.
- Internally, the panel maintains a **tab bar** in HTML. Each tool runs
  in its own tab. Tabs are closeable, switchable, and addressable by
  tool id.
- `retainContextWhenHidden: true` so state survives the user switching
  to another editor tab.
- The panel knows nothing about specific tools: it dispatches user
  actions to `SourcererClient.callEndpoint(path, params)` and renders
  results via a generic `resultRenderer.renderResults(data, fields)`.

## Consequences

Positive:
- One mental model: "the Sourcerer panel". Always in the same place.
- History preserved across tools while the user works.
- Tab UI is familiar and lets the user compare results side-by-side
  in their head, even within one tab area.
- Adding a new tool only adds a new tab type, not a new panel class.
- CSP, theming, message protocol all live in exactly one place
  (`workbenchHtml.ts` + `workbenchPanel.ts`).

Negative:
- Cannot show two tools side-by-side as separate editor tabs (one is a
  tab inside the Workbench, the other is not directly possible).
  Mitigation: VSCode's split-editor with two Workbench instances is not
  supported by design; users who need side-by-side can open multiple
  VSCode windows.
- The singleton has a hidden lifecycle (disposed on user close, must be
  reconstructed). Bugs here would be subtle. Mitigation: covered by
  smoke test on F5 launch.
- `retainContextWhenHidden: true` keeps the webview process alive even
  when the user is not looking at it, costing some RAM. Acceptable for a
  developer tool.

## Alternatives considered

### A. Keep three specialized panels, add a tab bar inside each

Verdict: rejected. Doubles complexity without removing the multi-panel
sprawl.

### B. One panel per tool, all sharing CSS

Verdict: rejected. Scales poorly with the number of tools (currently
~25 GET endpoints, more planned).

### C. Use the VSCode sidebar / WebviewView instead of an editor-area panel

Verdict: rejected. WebviewView is narrow and stacked vertically; it is
fine for a tree view but cramped for forms + result tables.

### D. One singleton WebviewPanel with tabs (chosen)

Verdict: accepted.
