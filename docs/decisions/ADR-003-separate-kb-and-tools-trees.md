# ADR-003 — Keep KB Explorer and Tools Explorer as two separate trees

**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato
**Date**: 2026-03-28

## Context

The refactor consolidated four sidebar views into one when those views
were really "tool menus" of different categories
(`searchTools` / `codeTools` / `semTools` / `ghTools`). All four were
static lists of clickable commands, semantically identical, separated
only by topic. Collapsing them into a single category-grouped Tools tree
was an obvious win (see ADR-002).

The remaining view, **Knowledge Base**, looked different:

- The KB tree shows **topics and skills**, a real taxonomy.
- Each leaf renders a **markdown document** (the skill body) in a
  dedicated WebviewPanel.
- Users **browse** it — they expand topics, scan titles, open a skill
  to read it. The interaction pattern is wiki-like.

The Tools tree shows query endpoints. Each leaf runs an action and
shows a structured result. Users **invoke** it — they pick a tool,
fill a form, look at the answer. The interaction pattern is
command-palette-like.

The natural question: do we merge KB and Tools into one view too?

For example, we could imagine a single tree:
```
Sourcerer
├── Knowledge Base
│   ├── Topic A
│   └── Topic B
└── Tools
    ├── Code
    └── KB Queries
```
This would put everything under one roof and reduce the number of
top-level views to one.

## Decision

**Keep two peer views under the Sourcerer activity bar**:
`sourcerer.kbExplorer` and `sourcerer.toolsExplorer`.

They both live under the same activity-bar container (the Sourcerer
logo), so they show up together — but they are independent trees, with
independent `TreeDataProvider` implementations, separate refresh
semantics, and separate command surfaces.

## Consequences

Positive:
- The two interaction patterns stay clean: KB for browsing, Tools for
  invoking. Mixing them in one tree would force one model on the other.
- Each tree's empty state, error state, refresh button, and context
  menu are tuned for its own purpose.
- The KB tree can keep its dedicated commands (`viewSkill`,
  `refreshTopic`, future "Add to favorites", etc.) without polluting
  the Tools surface.
- Power users learn two short trees instead of one deep one.

Negative:
- Two views means vertical space is split. The user sometimes has to
  scroll within a small pane to find what they want. Mitigation: the
  Tools tree is category-grouped and collapsible, the KB tree is
  topic-grouped and collapsible, both default to a compact layout.
- A future "ask a question about this skill" feature crosses both
  worlds and needs to route between trees. That's fine — it would be a
  command, not a tree node.

## Alternatives considered

### A. One unified tree (KB + Tools as siblings under a root)

Verdict: rejected. Forces a single mental model on two genuinely
different things. The depth and the cross-category navigation would
become awkward.

### B. KB as a section of the Tools tree (one category among many)

Verdict: rejected. The KB is a taxonomy with rich content; reducing it
to a category label demotes the dominant feature of the extension.

### C. Two peer trees (chosen)

Verdict: accepted.

## Notes

If we later add a third view (e.g. `claudeSessionsExplorer`, see
`docs/design/claude-sessions-view.md`), it would be a third peer under
the same activity-bar container, governed by the same principle: a
distinct interaction pattern deserves a distinct tree.
