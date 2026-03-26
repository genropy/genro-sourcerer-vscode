import * as vscode from "vscode";

export interface SearchResultEntry {
  title: string;
  subtitle?: string;
  code: string;
  language?: string;
}

/**
 * WebviewPanel that shows search results with highlighted matches.
 *
 * The server uses <<term>> markers to indicate matched text.
 * This panel converts those markers to <mark> HTML tags.
 */
export class SearchResultsPanel {
  private static _panel: vscode.WebviewPanel | undefined;

  static show(query: string, entries: SearchResultEntry[]): void {
    if (SearchResultsPanel._panel) {
      SearchResultsPanel._panel.dispose();
    }

    const panel = vscode.window.createWebviewPanel(
      "sourcerer.searchResults",
      `Search: ${query}`,
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    SearchResultsPanel._panel = panel;
    panel.onDidDispose(() => {
      SearchResultsPanel._panel = undefined;
    });

    panel.webview.html = SearchResultsPanel._renderHtml(query, entries);
  }

  private static _renderHtml(
    query: string,
    entries: SearchResultEntry[]
  ): string {
    const resultsHtml = entries
      .map((entry) => {
        const titleHtml = SearchResultsPanel._escapeHtml(entry.title);
        const subtitleHtml = entry.subtitle
          ? `<div class="subtitle">${SearchResultsPanel._escapeHtml(entry.subtitle)}</div>`
          : "";
        const codeHtml = SearchResultsPanel._highlightMatches(
          SearchResultsPanel._escapeHtml(entry.code)
        );
        const lang = entry.language ?? "python";
        return `
          <div class="result">
            <div class="result-header">${titleHtml}</div>
            ${subtitleHtml}
            <pre class="code" data-lang="${lang}">${codeHtml}</pre>
          </div>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search: ${SearchResultsPanel._escapeHtml(query)}</title>
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
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
      font-size: 1.3em;
    }
    .count {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin-left: 8px;
    }
    .result {
      margin-bottom: 20px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      overflow: hidden;
    }
    .result-header {
      background: var(--vscode-sideBar-background);
      padding: 6px 12px;
      font-weight: bold;
      font-size: 0.9em;
    }
    .subtitle {
      padding: 2px 12px;
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    pre.code {
      margin: 0;
      padding: 12px;
      background: var(--vscode-textCodeBlock-background);
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.4;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    mark {
      background: var(--vscode-editor-findMatchHighlightBackground, #ea5c0055);
      color: inherit;
      padding: 1px 2px;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <h1>${SearchResultsPanel._escapeHtml(query)}<span class="count">${entries.length} results</span></h1>
  ${resultsHtml}
</body>
</html>`;
  }

  /** Convert <<matched>> markers to <mark>matched</mark> tags. */
  private static _highlightMatches(escaped: string): string {
    return escaped.replace(
      /&lt;&lt;(.+?)&gt;&gt;/g,
      "<mark>$1</mark>"
    );
  }

  private static _escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
