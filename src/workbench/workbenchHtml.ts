import type { ToolDef } from "../schema/types";

/**
 * Generate the Workbench HTML. Starts with empty tab bar.
 * Tabs are added dynamically via postMessage from the extension.
 * Tool definitions are embedded as JSON for client-side tab creation.
 */
export function getWorkbenchHtml(
  tools: ToolDef[],
  nonce: string
): string {
  // Serialize tool defs for client-side use
  const toolsJson = JSON.stringify(
    tools.map((t) => ({
      id: t.id,
      label: t.label,
      params: t.params,
    }))
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sourcerer Workbench</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex; flex-direction: column;
      height: 100vh; overflow: hidden;
    }
    .tab-bar {
      display: flex; flex-wrap: wrap; gap: 0;
      background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-sideBar-background));
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0; min-height: 30px;
    }
    .tab {
      display: flex; align-items: center; gap: 4px;
      background: none; border: none; color: var(--vscode-foreground);
      padding: 4px 4px 4px 10px; cursor: pointer; font-size: 0.85em;
      border-right: 1px solid var(--vscode-panel-border);
      opacity: 0.6; white-space: nowrap;
    }
    .tab:hover { opacity: 0.9; background: var(--vscode-list-hoverBackground); }
    .tab.active {
      opacity: 1;
      background: var(--vscode-editor-background);
      border-bottom: 2px solid var(--vscode-focusBorder);
    }
    .tab .close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border: none; background: none;
      color: var(--vscode-foreground); cursor: pointer;
      border-radius: 3px; font-size: 14px; opacity: 0.5;
      line-height: 1;
    }
    .tab .close:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.2)); }
    .tab-panel { display: none; flex-direction: column; flex: 1; overflow: hidden; }
    .tab-panel.active { display: flex; }
    .empty-state {
      flex: 1; display: flex; align-items: center; justify-content: center;
      color: var(--vscode-descriptionForeground); font-size: 0.9em;
    }
    .input-bar {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0; align-items: center;
    }
    .input-bar input[type="text"], .input-bar input[type="number"] {
      padding: 4px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 3px; font-family: inherit; font-size: inherit;
    }
    .input-bar input[type="text"] { flex: 1; min-width: 150px; }
    .input-bar input[type="number"] { width: 70px; }
    .input-bar select {
      padding: 4px 8px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border));
      border-radius: 3px; font-family: inherit; font-size: inherit;
    }
    .input-bar label {
      display: flex; align-items: center; gap: 4px; font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }
    .input-bar textarea {
      flex: 1; min-width: 150px; min-height: 80px; max-height: 300px;
      padding: 4px 8px; resize: vertical;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 3px; font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
    .run-btn {
      padding: 4px 14px; cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 3px; font-family: inherit;
    }
    .run-btn:hover { background: var(--vscode-button-hoverBackground); }
    details.options {
      padding: 4px 12px; font-size: 0.85em;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    details.options summary {
      cursor: pointer; color: var(--vscode-descriptionForeground); padding: 2px 0;
    }
    details.options .opt-row {
      display: flex; gap: 6px; align-items: center; padding: 3px 0;
    }
    details.options .opt-label {
      min-width: 100px; color: var(--vscode-descriptionForeground);
    }
    .results { flex: 1; overflow-y: auto; padding: 8px 12px; }
    .loading { text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); }
    .empty { padding: 20px; text-align: center; color: var(--vscode-descriptionForeground); }

    .card {
      margin-bottom: 10px; border: 1px solid var(--vscode-panel-border);
      border-radius: 4px; overflow: hidden;
    }
    .card-header {
      background: var(--vscode-sideBar-background);
      padding: 5px 10px; font-weight: bold; font-size: 0.9em;
    }
    .card-sub {
      padding: 2px 10px; font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    .card-body {
      padding: 8px 10px; font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      white-space: pre-wrap; word-wrap: break-word; line-height: 1.4;
      background: var(--vscode-textCodeBlock-background);
    }
    mark {
      background: var(--vscode-editor-findMatchHighlightBackground, #ea5c0055);
      color: inherit; padding: 1px 2px; border-radius: 2px;
    }
    .detail-row { display: flex; gap: 8px; padding: 3px 10px; font-size: 0.9em; }
    .detail-label { color: var(--vscode-descriptionForeground); min-width: 80px; }
    .detail-value { font-family: var(--vscode-editor-font-family); }
    .badge-inline {
      display: inline-block; padding: 1px 6px; border-radius: 3px;
      font-size: 0.8em; background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground); margin: 2px 4px;
    }
    .docstring {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      padding: 6px 10px; margin: 4px 10px; font-style: italic; white-space: pre-wrap;
    }
    .subclass-list { list-style: none; padding-left: 22px; margin: 2px 0; }
    .subclass-list li::before { content: "\\251C\\2500 "; color: var(--vscode-descriptionForeground); font-family: monospace; }
    .subclass-list li:last-child::before { content: "\\2514\\2500 "; }
    .link { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="tab-bar" id="tab-bar"></div>
  <div id="panels-container" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
    <div class="empty-state" id="empty-state">Select a tool from the sidebar</div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const TOOLS = ${toolsJson};
    const toolMap = {};
    TOOLS.forEach(t => { toolMap[t.id] = t; });

    const openTabs = new Set();

    function ensureTab(tabId) {
      if (openTabs.has(tabId)) return;
      const tool = toolMap[tabId];
      if (!tool) return;
      openTabs.add(tabId);

      // Hide empty state
      document.getElementById('empty-state').style.display = 'none';

      // Create tab button
      const tabBar = document.getElementById('tab-bar');
      const btn = document.createElement('div');
      btn.className = 'tab';
      btn.dataset.tab = tabId;
      btn.innerHTML = '<span class="tab-label">' + escHtml(tool.label) + '</span>'
        + '<button class="close" data-tab="' + escHtml(tabId) + '">&times;</button>';
      btn.querySelector('.tab-label').addEventListener('click', () => activateTab(tabId));
      btn.querySelector('.close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tabId);
      });
      tabBar.appendChild(btn);

      // Create panel
      const panel = document.createElement('div');
      panel.className = 'tab-panel';
      panel.id = 'panel-' + tabId;
      panel.innerHTML = buildPanel(tool);
      document.getElementById('panels-container').appendChild(panel);

      // Wire up enter key on text inputs
      panel.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') runTool(tabId);
        });
      });
    }

    function activateTab(tabId) {
      document.querySelectorAll('.tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tabId));
      document.querySelectorAll('.tab-panel').forEach(p =>
        p.classList.toggle('active', p.id === 'panel-' + tabId));
      const firstInput = document.querySelector('#panel-' + tabId + ' input');
      if (firstInput) firstInput.focus();
    }

    function closeTab(tabId) {
      openTabs.delete(tabId);
      const tab = document.querySelector('.tab[data-tab="' + tabId + '"]');
      if (tab) tab.remove();
      const panel = document.getElementById('panel-' + tabId);
      if (panel) panel.remove();

      // Activate another tab or show empty state
      if (openTabs.size > 0) {
        activateTab(openTabs.values().next().value);
      } else {
        document.getElementById('empty-state').style.display = 'flex';
      }
    }

    function buildPanel(tool) {
      const required = tool.params.filter(p => p.required);
      const optional = tool.params.filter(p => !p.required);

      let html = '<div class="input-bar">';
      if (required.length === 0 && optional.length === 0) {
        html += '<span style="color:var(--vscode-descriptionForeground);font-size:0.85em">No parameters</span>';
      }
      required.forEach(p => { html += buildInput(p); });
      html += '<button class="run-btn" onclick="runTool(\\''+tool.id+'\\')">Run</button></div>';

      if (optional.length > 0) {
        html += '<details class="options"><summary>Options (' + optional.length + ')</summary>';
        optional.forEach(p => {
          html += '<div class="opt-row"><span class="opt-label">' + escHtml(p.title || p.name) + '</span>' + buildInput(p) + '</div>';
        });
        html += '</details>';
      }

      html += '<div class="results" id="results-' + tool.id + '"></div>';
      return html;
    }

    const TEXTAREA_PARAMS = ['xml', 'traceback', 'body', 'content', 'source', 'patterns'];

    function needsTextarea(name) {
      const lower = name.toLowerCase();
      return TEXTAREA_PARAMS.some(k => lower.includes(k));
    }

    function buildInput(p) {
      if (p.enum && p.enum.length > 0) {
        let opts = '<option value="">\\u2014 ' + escHtml(p.title || p.name) + ' \\u2014</option>';
        p.enum.forEach(v => {
          const sel = v === p.default ? ' selected' : '';
          opts += '<option value="' + escHtml(v) + '"' + sel + '>' + escHtml(v) + '</option>';
        });
        return '<select data-param="' + escHtml(p.name) + '">' + opts + '</select>';
      }
      if (p.type === 'boolean') {
        const chk = p.default === true ? ' checked' : '';
        return '<label><input type="checkbox" data-param="' + escHtml(p.name) + '"' + chk + '> ' + escHtml(p.title || p.name) + '</label>';
      }
      if (p.type === 'integer') {
        const val = p.default !== undefined && p.default !== null ? ' value="' + p.default + '"' : '';
        return '<input type="number" data-param="' + escHtml(p.name) + '" placeholder="' + escHtml(p.title || p.name) + '"' + val + '>';
      }
      if (needsTextarea(p.name)) {
        return '<textarea data-param="' + escHtml(p.name) + '" placeholder="' + escHtml(p.title || p.name) + '"></textarea>';
      }
      return '<input type="text" data-param="' + escHtml(p.name) + '" placeholder="' + escHtml(p.title || p.name) + '">';
    }

    function runTool(tabId) {
      const panel = document.getElementById('panel-' + tabId);
      if (!panel) return;
      const params = {};
      panel.querySelectorAll('[data-param]').forEach(el => {
        const name = el.dataset.param;
        if (el.type === 'checkbox') {
          if (el.checked) params[name] = 'true';
        } else if (el.value && el.value.trim()) {
          params[name] = el.value.trim();
        }
      });
      const results = document.getElementById('results-' + tabId);
      if (results) results.innerHTML = '<div class="loading">Loading...</div>';
      vscode.postMessage({ command: 'search', tab: tabId, params: params });
    }

    // Make runTool available to onclick
    window.runTool = runTool;

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'activateTab') {
        ensureTab(msg.tab);
        activateTab(msg.tab);
        if (msg.autoRun) runTool(msg.tab);
      }
      if (msg.command === 'results') {
        const container = document.getElementById('results-' + msg.tab);
        if (container) container.innerHTML = msg.html;
      }
      if (msg.command === 'error') {
        const container = document.getElementById('results-' + msg.tab);
        if (container) container.innerHTML = '<div class="empty">Error: ' + escHtml(msg.message) + '</div>';
      }
    });

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
  </script>
</body>
</html>`;
}
