import * as vscode from "vscode";

/**
 * Generic WebviewPanel for structured detail views (class hierarchy, symbol detail, etc.)
 */
export class DetailPanel {
  private static _panel: vscode.WebviewPanel | undefined;

  static show(title: string, bodyHtml: string): void {
    if (DetailPanel._panel) {
      DetailPanel._panel.dispose();
    }

    const panel = vscode.window.createWebviewPanel(
      "sourcerer.detail",
      title,
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    DetailPanel._panel = panel;
    panel.onDidDispose(() => {
      DetailPanel._panel = undefined;
    });

    panel.webview.html = DetailPanel._wrapHtml(title, bodyHtml);
  }

  private static _wrapHtml(title: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.6;
    }
    h1 {
      font-size: 1.3em;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }
    h2 {
      font-size: 1.1em;
      margin-top: 20px;
    }
    .class-node {
      margin: 12px 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .class-header {
      background: var(--vscode-sideBar-background);
      padding: 8px 12px;
      font-weight: bold;
      font-size: 1.05em;
    }
    .class-body {
      padding: 8px 12px;
    }
    .meta-row {
      display: flex;
      gap: 8px;
      margin: 4px 0;
      font-size: 0.9em;
    }
    .meta-label {
      color: var(--vscode-descriptionForeground);
      min-width: 80px;
    }
    .meta-value {
      font-family: var(--vscode-editor-font-family);
    }
    .subclass-list {
      list-style: none;
      padding-left: 0;
      margin: 4px 0;
    }
    .subclass-list li {
      padding: 3px 0;
      font-size: 0.9em;
    }
    .subclass-list li::before {
      content: "\\251C\\2500 ";
      color: var(--vscode-descriptionForeground);
      font-family: monospace;
    }
    .subclass-list li:last-child::before {
      content: "\\2514\\2500 ";
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 0.8em;
      font-weight: normal;
    }
    .badge-class { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .badge-function { background: #3b82f655; color: inherit; }
    .badge-method { background: #8b5cf655; color: inherit; }
    .badge-module { background: #10b98155; color: inherit; }
    .mono {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
    .path {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }
    pre.source {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.4;
      border-radius: 4px;
    }
    .docstring {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      padding: 8px 12px;
      margin: 8px 0;
      font-style: italic;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
