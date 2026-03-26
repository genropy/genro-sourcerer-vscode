import * as vscode from "vscode";

/**
 * WebviewPanel that shows source code with syntax-like formatting.
 */
export class SourcePanel {
  private static _panel: vscode.WebviewPanel | undefined;

  static show(title: string, source: string, meta?: string): void {
    if (SourcePanel._panel) {
      SourcePanel._panel.dispose();
    }

    const panel = vscode.window.createWebviewPanel(
      "sourcerer.source",
      title,
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    SourcePanel._panel = panel;
    panel.onDidDispose(() => {
      SourcePanel._panel = undefined;
    });

    panel.webview.html = SourcePanel._renderHtml(title, source, meta);
  }

  private static _renderHtml(
    title: string,
    source: string,
    meta?: string
  ): string {
    const escaped = SourcePanel._escapeHtml(source);
    const lines = escaped.split("\n");
    const numberedLines = lines
      .map((line, i) => {
        const num = i + 1;
        return `<span class="ln">${String(num).padStart(4)}</span>  ${line}`;
      })
      .join("\n");

    const metaHtml = meta
      ? `<div class="meta">${SourcePanel._escapeHtml(meta)}</div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SourcePanel._escapeHtml(title)}</title>
  <style>
    body {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 0;
      margin: 0;
      line-height: 1.4;
    }
    .header {
      font-family: var(--vscode-font-family);
      padding: 8px 16px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-weight: bold;
    }
    .meta {
      font-family: var(--vscode-font-family);
      padding: 4px 16px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    pre {
      margin: 0;
      padding: 8px 16px;
      overflow-x: auto;
      white-space: pre;
    }
    .ln {
      color: var(--vscode-editorLineNumber-foreground);
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="header">${SourcePanel._escapeHtml(title)}</div>
  ${metaHtml}
  <pre>${numberedLines}</pre>
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
