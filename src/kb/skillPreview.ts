import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import type { SourcererClient } from "../api/client";

const md = new MarkdownIt({ html: false, linkify: true });

/**
 * Opens or updates a WebviewPanel showing rendered skill content.
 */
export class SkillPreview {
  private static _panels = new Map<string, vscode.WebviewPanel>();

  static async show(
    client: SourcererClient,
    skillId: string,
    title: string,
    extensionUri: vscode.Uri
  ): Promise<void> {
    const existing = SkillPreview._panels.get(skillId);
    if (existing) {
      existing.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "sourcerer.skillPreview",
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: false,
        localResourceRoots: [extensionUri],
      }
    );

    SkillPreview._panels.set(skillId, panel);
    panel.onDidDispose(() => SkillPreview._panels.delete(skillId));

    try {
      const skill = await client.getSkillContent(skillId);
      panel.webview.html = SkillPreview._renderHtml(
        skill.title,
        skill.content,
        skill.status
      );
    } catch (err) {
      panel.webview.html = SkillPreview._renderHtml(
        "Error",
        `Failed to load skill: ${err instanceof Error ? err.message : String(err)}`,
        "draft"
      );
    }
  }

  private static _renderHtml(
    title: string,
    content: string,
    status: string
  ): string {
    const rendered = md.render(content);
    const badge =
      status === "verified"
        ? '<span style="color: green;">&#x2713; Verified</span>'
        : '<span style="color: orange;">Draft</span>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SkillPreview._escapeHtml(title)}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.6;
    }
    h1 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
    code { background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; }
    pre { background: var(--vscode-textCodeBlock-background); padding: 12px; overflow-x: auto; }
    .badge { font-size: 0.85em; margin-left: 8px; }
  </style>
</head>
<body>
  <h1>${SkillPreview._escapeHtml(title)} <span class="badge">${badge}</span></h1>
  ${rendered}
</body>
</html>`;
  }

  private static _escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
