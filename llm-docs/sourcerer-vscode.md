# Sourcerer Visual — LLM Context

## What is it

VSCode extension that provides a visual interface for the Sourcerer Knowledge Base.
Connects via REST API (JSON envelope: `{ok, result, error}`). Bearer token auth.

## Architecture

```
extension.ts → SourcererClient (HTTP) → Sourcerer REST API
             → KBTreeProvider (TreeDataProvider) → sidebar tree
             → SkillPreview (WebviewPanel) → rendered markdown
```

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Entry point: activate/deactivate |
| `src/api/client.ts` | HTTP client with cache |
| `src/api/types.ts` | TypeScript interfaces |
| `src/kb/kbTreeProvider.ts` | TreeDataProvider for topics/skills |
| `src/kb/kbTreeItems.ts` | TreeItem subclasses |
| `src/kb/skillPreview.ts` | WebviewPanel for markdown |
| `src/kb/kbCommands.ts` | Command registration |
| `src/config/settings.ts` | Configuration wrapper |

## API Endpoints Used

- `GET /api/srv/health` — connection check
- `GET /api/kb/topic_tree` — full topic hierarchy
- `GET /api/kb/skills?topic=...` — skills for a topic
- `GET /api/kb/skill_content?skill_id=...` — skill content
- `POST /api/kb/ask` — semantic triage

## Commands

- `sourcerer.refresh` — reload tree
- `sourcerer.viewSkill` — preview skill
- `sourcerer.search` — search KB
- `sourcerer.ask` — natural language query
- `sourcerer.checkConnection` — health check

## Settings

- `sourcerer.apiUrl` (default: `https://sourcerer.genropy.net`)
- `sourcerer.token` (default: empty)
- `sourcerer.cacheTtlSeconds` (default: 300)

## Tech Stack

TypeScript, esbuild, VSCode Extension API, markdown-it.
