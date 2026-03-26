# Claude Code Instructions — Sourcerer Visual (VSCode Extension)

## Project Context

**genro-sourcerer-vscode** is a VSCode extension ("Sourcerer Visual") that provides a visual interface
for the Sourcerer Knowledge Base and code index. It connects to the Sourcerer REST API.

Part of **Genro** ecosystem (Apache 2.0 license).

## Repository Structure

```
genro-sourcerer-vscode/
├── src/
│   ├── extension.ts          # activate/deactivate entry point
│   ├── api/
│   │   ├── client.ts         # SourcererClient — HTTP + auth + cache
│   │   └── types.ts          # TypeScript interfaces (Topic, Skill, etc.)
│   ├── kb/
│   │   ├── kbTreeProvider.ts # TreeDataProvider for KB Explorer
│   │   ├── kbTreeItems.ts    # TopicItem, SkillItem (TreeItem subclasses)
│   │   ├── skillPreview.ts   # WebviewPanel for skill markdown preview
│   │   └── kbCommands.ts     # Command registration for KB
│   ├── config/
│   │   └── settings.ts       # Typed wrapper for workspace configuration
│   └── utils/
│       └── logger.ts         # OutputChannel wrapper
├── test/
│   ├── suite/
│   │   ├── index.ts          # Mocha runner setup
│   │   └── extension.test.ts # Basic activation test
│   └── runTest.ts            # @vscode/test-electron entry
├── resources/icons/           # SVG icons for sidebar and tree items
├── docs/                      # Sphinx + myst_parser documentation
├── llm-docs/                  # Condensed docs for LLM context
├── dist/                      # esbuild output (gitignored)
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript config (strict)
├── esbuild.config.mjs         # Build configuration
└── .eslintrc.json             # ESLint config
```

## Development Commands

```bash
npm run compile    # Build with esbuild
npm run watch      # Build + watch
npm run lint       # ESLint
npm test           # Run tests via @vscode/test-electron
npm run package    # Create .vsix
```

Press F5 in VSCode to launch Extension Development Host.

## Architecture

```
VSCode Extension Host
  └── extension.ts (activate)
       ├── SourcererClient (api/client.ts)
       │     └── HTTP requests to Sourcerer REST API
       ├── KBTreeProvider (kb/kbTreeProvider.ts)
       │     └── TreeDataProvider → sidebar tree view
       └── SkillPreview (kb/skillPreview.ts)
             └── WebviewPanel → rendered markdown
```

The extension is a pure REST client — no MCP, no WebSocket. It calls the Sourcerer
JSON API (same routes exposed via MCP bridge, but accessed directly via HTTP).

## Code Conventions

- TypeScript strict mode, no `any`
- All code, comments, and commit messages in **English**
- Use `vscode.workspace.getConfiguration('sourcerer')` via `settings.ts` wrapper
- Tree items extend `vscode.TreeItem` — keep them lightweight
- WebviewPanel for rich content (skill preview) — use Content Security Policy
- Single dependency (markdown-it) — keep bundle small

## API Contract

The extension consumes the Sourcerer REST API. Response format: JSON with
`{ok: boolean, result: ...}` envelope. All endpoints require Bearer token.

Key endpoints used:
- `GET /api/kb/topic_tree` — hierarchical topic list
- `GET /api/kb/skills?topic=...` — skills for a topic
- `GET /api/kb/skill_content?skill_id=...` — skill markdown content
- `POST /api/kb/ask` — semantic triage query
- `GET /api/srv/health` — connection check

## Git Commit Authorship

- **NEVER** include Claude as a co-author in commits
- **ALWAYS** remove the "Co-Authored-By: Claude" line

## Language Policy

- All code, comments, and commit messages in **English**
