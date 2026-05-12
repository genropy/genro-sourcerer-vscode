# Workbench refactor — operational plan to close it

**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato
**Last Updated**: 2026-05-12
**Audience**: maintainer (you) and any LLM picking this up cold

## Context

A large refactor was started on 2026-03-26 and reached a near-complete
working tree on 2026-03-28, then paused. Today is 2026-05-12. The repo
is on `main`, aligned with `origin/main`, with two commits in the
history:

- `290b003` Initial commit: Sourcerer Visual VSCode extension
- `a6ef238` Add multi-section sidebar and WebviewPanel rendering

Everything since `a6ef238` is uncommitted in the working tree.

The refactor's intent is documented in `ARCHITECTURE.md` and rationalized
in `docs/decisions/ADR-001..003`. This document is the **plan to
finish** it, not the rationale.

## Current state — what is done

Structural work — done:

- Two sidebar views (`kbExplorer`, `toolsExplorer`) instead of five.
- Three new modules: `src/schema/`, `src/workbench/`, with their full
  content (8 new files, ~940 lines).
- `extension.ts` rewritten to wire the new layout.
- `kbCommands.ts` slimmed: removed `sourcerer.search`,
  `sourcerer.ask`, `sourcerer.findSkills` (moved into the Workbench).
- `client.ts` gained `callEndpoint(path, params)`, the generic dispatch
  point used by the Workbench.
- `toolTreeProvider.ts` rewritten: now dynamic, category-grouped,
  driven by `setTools(ToolDef[])`.
- `package.json` `contributes` updated: 14 commands → 3, four `views`
  entries → two.
- Six deprecated files marked for deletion in git (the old
  `code/`, `gh/`, `sem/` command modules and the three short-lived
  WebviewPanels).
- `.gitignore` updated to ignore `temp/`.

## Current state — what is broken

`tsc --noEmit` on the working tree reports four errors:

1. `src/schema/schemaLoader.ts:23` — `CATEGORY_ICONS` is declared but
   never used.
2. `src/schema/schemaLoader.ts:34` — `TOOL_ICONS` is declared but never
   used.
3. `src/schema/schemaLoader.ts:112` — the object pushed into `tools[]`
   is missing the `categoryIcon` and `icon` fields required by
   `ToolDef`.
4. `src/tools/toolTreeProvider.ts:44` — `_tools` is assigned but never
   read.

In addition, `dist/extension.js` is dated 2026-03-28 and reflects an
intermediate state of the refactor. Reloading the Extension Development
Host today does not exercise the current sources.

## What's missing — the close-out checklist

The fixes are small and self-contained. In order:

### Step 1. Wire the icon lookups in `schemaLoader.ts`

The two maps `CATEGORY_ICONS` and `TOOL_ICONS` exist precisely to feed
the `categoryIcon` and `icon` fields of `ToolDef`. The push at line 112
just needs the two extra fields:

```ts
tools.push({
  id: op.operationId ?? path,
  path: `/api${path}`,
  category,
  categoryLabel: CATEGORY_LABELS[category] ?? category,
  categoryIcon: CATEGORY_ICONS[category] ?? "folder",
  label: buildLabel(op),
  icon: TOOL_ICONS[op.operationId ?? ""] ?? "symbol-method",
  description: op.description ?? op.summary ?? "",
  params,
  responseFields: fields,
  responseIsArray: isArray,
});
```

This fixes errors 1, 2, and 3 in one edit. The two lookup maps are no
longer "unused", and the produced object satisfies `ToolDef`.

### Step 2. Use the icons in `toolTreeProvider.ts`

Currently `CategoryNode` and `ToolNode` hardcode their icons
(`"folder"` and `"symbol-method"`). With Step 1 done, they should read
from the data:

```ts
class CategoryNode extends vscode.TreeItem {
  constructor(category: string, label: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "category";
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

class ToolNode extends vscode.TreeItem {
  constructor(tool: ToolDef) {
    super(tool.label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tool.description.split("\n")[0];
    this.contextValue = "tool";
    this.iconPath = new vscode.ThemeIcon(tool.icon);
    this.command = {
      command: "sourcerer.open",
      title: tool.label,
      arguments: [tool.id],
    };
  }
}
```

And in `getChildren()`, pass `tools[0].categoryIcon` when constructing
the `CategoryNode`. (One representative tool is enough; the icon comes
from the category map, not from the tool.)

### Step 3. Decide what to do with `_tools` in `toolTreeProvider.ts`

`_tools` is currently set in `setTools()` and never read again. Two
options:

- **Drop it**: only `_categories` is needed; remove the field.
- **Keep it for a lookup**: add a `getTool(id): ToolDef | undefined`
  method, useful if other code needs to resolve a tool by id.

Recommendation: **drop it for now**. There is no second reader. If
`getTool()` becomes useful later, add it then and rebuild the map. This
keeps the code honest about what's actually in use.

### Step 4. Rebuild `dist/`

```bash
npm run compile
```

Then check that `dist/extension.js` is newer than the most recent
source file, and that the build produces no errors.

### Step 5. Smoke test in Extension Development Host

Press **F5** in VSCode to launch the Extension Development Host:

1. Sourcerer activity bar shows two views: Knowledge Base and Tools.
2. KB Explorer loads topics (verify with `Sourcerer: Check Connection`).
3. Tools Explorer populates within a second; categories appear with
   their icons, tools appear under each category with their icons.
4. Click a tool with no required parameters: the Workbench opens, the
   tab activates, the tool runs automatically, results render.
5. Click a tool with required parameters: the Workbench opens, the form
   is visible, submitting it runs the tool.
6. Open a second tool: a second tab appears, switching works, closing
   one tab does not affect the other.
7. Change `sourcerer.apiUrl` in settings: KB tree refreshes, Tools tree
   re-fetches schema, Workbench's internal client updates.
8. Run `Sourcerer: Reload Schema` from the command palette: Tools tree
   refreshes.

If anything in steps 1–8 fails, capture the failure with logs from the
`Sourcerer` output channel and the Developer Tools console of the
Extension Development Host webview.

### Step 6. Commit

Single commit, scoped to the refactor. Suggested message:

```
Refactor sidebar to schema-driven Workbench

- One singleton WebviewPanel (Workbench) replaces three short-lived
  WebviewPanels (SearchResultsPanel, DetailPanel, SourcePanel).
- Two sidebar views (Knowledge Base, Tools) instead of five; the
  Tools tree is populated dynamically from the Sourcerer OpenAPI
  schema.
- Collapse 14 dedicated VSCode commands into 2 generic ones
  (sourcerer.open, sourcerer.reloadSchema), plus the KB-specific
  commands that remain.
- Remove src/code/, src/gh/, src/sem/, and the three deprecated
  panel files. Net diff: -1027 +1006 lines.
- Add ARCHITECTURE.md and docs/decisions/ADR-001..003 documenting
  the new layout and the reasoning behind it.
```

No Claude co-author, no AI-generated marker (project policy).

## Open questions

1. **Should `dist/` be versioned?**
   Currently `dist/` is tracked. For a VSCode extension distributed via
   `.vsix`, the build artefact is what users install — so versioning
   `dist/` means a clone-and-package workflow needs no extra
   build step. The cost: large diffs on every build, easy merge
   conflicts. Worth a dedicated ADR (ADR-004) before deciding.

2. **How aggressive should `RenderHint` inference be?**
   Today it is a fixed allowlist of field names. Should we extend it
   to also infer from field type (e.g. `string + name ends in _url`)?
   Defer until we see real cases where the current rules miss.

3. **What's the right activation event?**
   `package.json` currently does not declare `activationEvents`
   explicitly. VSCode 1.85+ infers them from `contributes`. Verify
   during the smoke test that activation happens early enough that the
   Tools tree is populated before the user clicks it; otherwise add an
   explicit `onView:sourcerer.toolsExplorer` activation event.

4. **`llm-docs/sourcerer-vscode.md` is stale.**
   It still describes the v0.1 layout. Decide whether to update it now
   (mirrors `ARCHITECTURE.md` but condensed for LLM context) or delete
   it in favor of pointing LLMs to `ARCHITECTURE.md` directly. Not
   blocking for the refactor itself.

## Out of scope (do not start until this is closed)

- The Genropy Debug module (`docs/design/genropy-debug.md`).
- The Claude Sessions View (`docs/design/claude-sessions-view.md`,
  staged in `temp/claude-sessions-view/`).
- Any new endpoints or new render hints not already in the codebase.

## When to delete this document

After the commit from Step 6 lands, this document's job is done. Move
it to `docs/decisions/ADR-NNN-refactor-closeout.md` as a historical
record (a one-page summary of what was actually done vs. this plan), or
just delete it. The architecture lives in `ARCHITECTURE.md`, the
rationale lives in the ADRs.
