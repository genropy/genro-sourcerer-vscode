<p align="center">
  <img src="docs/assets/logo.png" alt="Sourcerer Visual Logo" width="200">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=genropy.genro-sourcerer-vscode"><img src="https://img.shields.io/visual-studio-marketplace/v/genropy.genro-sourcerer-vscode" alt="VS Marketplace"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://github.com/genropy/genro-sourcerer-vscode/actions/workflows/ci.yml"><img src="https://github.com/genropy/genro-sourcerer-vscode/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://genro-sourcerer-vscode.readthedocs.io/"><img src="https://readthedocs.org/projects/genro-sourcerer-vscode/badge/?version=latest" alt="Documentation"></a>
</p>

# Sourcerer Visual

> Visual explorer for the Sourcerer Knowledge Base in VSCode

Part of the [Genro](https://github.com/genropy) ecosystem.

Sourcerer Visual connects to [Sourcerer](https://sourcerer.genropy.net) and provides a visual interface for browsing the Knowledge Base, viewing skills, searching code, and querying the indexed codebase — all without leaving your editor.

## Features

- **KB Explorer** — Tree view of topics and skills in the sidebar
- **Skill Preview** — Rendered markdown preview of skills in a webview panel
- **Search** — Full-text and semantic search across the Knowledge Base
- **Ask** — Natural language queries against the indexed codebase
- **Authentication** — Token-based access to Sourcerer API

## Installation

### From Marketplace

Search for "Sourcerer Visual" in the VSCode Extensions panel, or:

```
ext install genropy.genro-sourcerer-vscode
```

### From VSIX

```bash
code --install-extension genro-sourcerer-vscode-0.1.0.vsix
```

## Configuration

Open Settings and search for "Sourcerer":

| Setting | Default | Description |
|---------|---------|-------------|
| `sourcerer.apiUrl` | `https://sourcerer.genropy.net` | Sourcerer API base URL |
| `sourcerer.token` | _(empty)_ | Authentication token |
| `sourcerer.cacheTtlSeconds` | `300` | Cache TTL for API responses |

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Lint
npm run lint

# Run tests
npm test

# Package VSIX
npm run package
```

Press **F5** in VSCode to launch the Extension Development Host.

## Documentation

Full documentation at [genro-sourcerer-vscode.readthedocs.io](https://genro-sourcerer-vscode.readthedocs.io/).

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

Copyright 2026 Softwell S.r.l.
