# KB Explorer

The KB Explorer is a tree view in the VSCode sidebar that displays the Sourcerer Knowledge Base hierarchy.

## Overview

After configuring your connection, click the **Sourcerer** icon in the Activity Bar to open the KB Explorer. The tree shows:

- **Topics** — Folders representing knowledge areas (e.g., "GenroPy/Model", "GenroPy/UI")
- **Skills** — Individual knowledge items within topics

## Browsing

- Click a **topic** to expand it and see sub-topics and skills
- Click a **skill** to open its content in a preview panel
- Verified skills show a checkmark icon; draft skills show a document icon

## Commands

| Command | Description |
|---------|-------------|
| **Sourcerer: Refresh** | Reload the topic tree from the API |
| **Sourcerer: Search Knowledge Base** | Full-text/semantic search across skills |
| **Sourcerer: Ask** | Ask a natural language question |
| **Sourcerer: View Skill** | Open a specific skill preview |
| **Sourcerer: Check Connection** | Verify API connectivity |

## Refresh

Click the refresh icon in the KB Explorer title bar, or run **Sourcerer: Refresh** from the Command Palette.

The tree is also refreshed automatically when you change Sourcerer settings.
