# Design proposal: Claude Sessions sidebar view

**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato
**Last Updated**: 2026-05-12
**Audience**: Sourcerer Visual maintainers
**Source material**: `temp/claude-sessions-view/` (working code + integration
notes, untracked)

## Summary

Add a third tree view to the Sourcerer activity-bar container, named
**Claude Sessions**. The view lists every Claude Code tab currently
open in the same VSCode window, auto-refreshes on tab events, and
activates the chosen tab on click.

Working code already exists in `temp/claude-sessions-view/`:

- `claudeSessionsProvider.ts` — complete `TreeDataProvider`
  (~80 lines), tested in a previous spike.
- `integration-snippets.md` — diffs for `package.json`, `extension.ts`,
  and an optional `viewsWelcome` block.

This document promotes that work from "staged in temp/" to a formal
proposal so it can be reviewed, accepted, and tracked alongside the
other work items.

## Motivation

### What problem

Developers running multiple Claude Code sessions in one VSCode window
have no central place to see what's open. The standard tab bar shows
the labels but mixes them with regular editor tabs. Power users (us)
end up with a dozen tabs and lose track of which Claude session is
which.

### Why fix it here

We already own a VSCode extension that has a sidebar container. Adding
one more `TreeDataProvider` next to "Knowledge Base" and "Tools" is
cheap and reuses the existing activity-bar entry. No new extension to
install, no separate maintenance surface.

The information we need (open tabs, their labels, their type) is fully
exposed by the public VSCode API — `vscode.window.tabGroups`,
`TabInputWebview.viewType`. No private API, no filesystem reads, no
dependency on Anthropic-side internals.

### Origin

The code came out of a separate spike called `claude-commander`
(unpublished, sandbox-only) whose original goal was richer:
cross-session prompt injection and a "single thread of repo evolution"
view. That broader exploration concluded:

- **Cross-session prompt injection is not feasible** with public VSCode
  / Anthropic-extension APIs in a clean way.
- **Reading another session's `.jsonl`** from `~/.claude/projects/` is
  trivial and covers most realistic use cases.
- **"Thread of repo evolution"** is a knowledge-management problem that
  belongs in Sourcerer's backend (an events table keyed by repo,
  package, developer), not in a VSCode extension.

`claude-commander` was therefore closed as a standalone project, but
the "registry of open Claude Code tabs" piece has standalone value and
fits naturally inside Sourcerer Visual. Hence this proposal.

## What the view does, v1

In scope:

- Lists every editor tab whose input is a `TabInputWebview` with
  `viewType === "mainThreadWebview-claudeVSCodePanel"`. That string is
  the stable identifier of Claude Code tabs in the official Anthropic
  extension.
- Label = `tab.label` (the name shown in the VSCode tab bar).
- Description = `"active"` when the tab is the currently focused tab.
- Refresh triggers:
  - `vscode.window.tabGroups.onDidChangeTabs` (open/close/rename/active-change)
  - `vscode.window.tabGroups.onDidChangeTabGroups`
  - Manual `Sourcerer: Claude Sessions: Refresh` command
- Click on an entry → activates that tab.

Explicitly **not** in scope for v1:

- Mapping a tab to its session UUID (would require reading
  `~/.claude/projects/<slug>/*.jsonl` and matching by label).
- Reading another session's `.jsonl` from this view.
- Writing into Claude Code's session files (never — they belong to
  another system).

## Architectural fit

The view is consistent with the rest of the extension:

- Same activity-bar container (`sourcerer`).
- A peer `TreeDataProvider`, not nested inside the existing two.
- Per ADR-003, distinct interaction patterns deserve distinct trees:
  - KB Explorer = browse taxonomy.
  - Tools Explorer = invoke queries.
  - Claude Sessions = navigate live tabs.

Each is a separate, focused tree.

## Implementation outline

The work is essentially **transcribing** what's in `temp/`:

### Move the file

```
temp/claude-sessions-view/claudeSessionsProvider.ts
  → src/claudeSessions/claudeSessionsProvider.ts
```

(or wherever you prefer; `src/claudeSessions/` parallels `src/kb/`,
`src/tools/`, `src/workbench/`.)

### `package.json` additions

Three changes:

1. Add a third entry to `contributes.views.sourcerer`:
   ```json
   { "id": "sourcerer.claudeSessions", "name": "Claude Sessions" }
   ```
2. Add two commands to `contributes.commands`:
   - `sourcerer.claudeSessions.refresh` (icon `$(refresh)`)
   - `sourcerer.claudeSessions.activate`
3. Add a `view/title` menu entry that puts the refresh icon in the
   view's toolbar.
4. (Optional) Add a `viewsWelcome` block with placeholder copy when no
   Claude Code tabs are open.

### `src/extension.ts` integration

In `activate(context)`:

```ts
const claudeSessionsProvider = new ClaudeSessionsProvider();
const claudeSessionsView = vscode.window.createTreeView(
  "sourcerer.claudeSessions",
  { treeDataProvider: claudeSessionsProvider, showCollapseAll: false }
);
context.subscriptions.push(
  claudeSessionsView,
  vscode.commands.registerCommand(
    "sourcerer.claudeSessions.refresh",
    () => claudeSessionsProvider.refresh()
  ),
  vscode.commands.registerCommand(
    "sourcerer.claudeSessions.activate",
    (tab: vscode.Tab) => activateClaudeSessionTab(tab)
  ),
  vscode.window.tabGroups.onDidChangeTabs(() =>
    claudeSessionsProvider.refresh()
  ),
  vscode.window.tabGroups.onDidChangeTabGroups(() =>
    claudeSessionsProvider.refresh()
  )
);
```

Five new disposables. Nothing else changes in the extension wiring.

## Field-tested gotchas (carried over from the spike)

These are documented in `temp/claude-sessions-view/README.md`; copied
here so the design document is self-contained:

1. **Stable filter for Claude Code tabs**:
   `tab.input instanceof TabInputWebview &&
    tab.input.viewType === "mainThreadWebview-claudeVSCodePanel"`.
   All tabs from the official Anthropic extension share that exact
   `viewType`. Not a guess — observed in the spike.
2. **`onDidChangeTabs` fires on rename**, not only on open/close/
   active-change. One listener covers all the refresh cases.
3. **No public `Tab.activate()`**. To programmatically activate a tab,
   the provider uses the combination
   `workbench.action.focusNthEditorGroup` (1..8) +
   `workbench.action.openEditorAtIndexN` (1..9). Works for the first 8
   editor groups, up to 9 tabs each. Edge case in practice.
4. **`tab.label` is readable** from our extension even though the
   webview belongs to another extension. So the user-visible name is
   accessible without ever looking at the `.jsonl`.

## Future directions (out of scope for v1)

- **Tab → session UUID mapping**: correlate `tab.label` with the
  `customTitle` / `aiTitle` field inside the `.jsonl` files under
  `~/.claude/projects/<slug>/`. Adds a "session details" view, a
  jump-to-jsonl command, possibly inline previews.
- **Read another session's recent activity**: tail the `.jsonl` of a
  selected session and show the last N user/assistant exchanges in a
  side panel. Useful for cross-session handoffs.
- **Cross-session navigation**: deep-link a Sourcerer KB skill or a
  source location from one Claude session to another.

These are stand-alone follow-ups, each justifiable independently. None
is required to ship v1.

## Sequencing relative to the Workbench refactor

This proposal **must wait** until the Workbench refactor described in
`docs/design/workbench-refactor.md` is closed and committed. Two
reasons:

- The refactor touches `extension.ts` and `package.json`. Adding the
  Claude Sessions view in parallel would create avoidable conflicts.
- The refactor reduces the cognitive load of the file. Landing it
  first means the Claude Sessions integration is a small, clean diff
  on a stable base.

After the refactor commit lands, the Claude Sessions integration is
expected to take well under a day.

## Acceptance criteria for v1

- A new tree view "Claude Sessions" appears under the Sourcerer
  activity bar, as a peer of "Knowledge Base" and "Tools".
- Opening 2–3 Claude Code tabs in VSCode makes 2–3 entries appear in
  the tree, with the correct labels.
- The currently focused Claude tab is marked "active".
- Renaming a tab updates the corresponding entry.
- Closing a tab removes its entry.
- Clicking an entry activates the corresponding tab.
- The view's refresh button works.
- No regression in the existing KB and Tools views.
- The smoke test sequence in `temp/claude-sessions-view/
  integration-snippets.md §4` passes.

## Cleanup

Once this design is approved and the work is implemented:

- Move `claudeSessionsProvider.ts` from `temp/` to `src/claudeSessions/`.
- Delete `temp/claude-sessions-view/` entirely.
- Update `ARCHITECTURE.md` to mention the third view.
