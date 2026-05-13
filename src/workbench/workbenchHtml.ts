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
      description: t.description,
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
    .tool-header {
      padding: 14px 18px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .tool-header h2 {
      font-size: 1.05em; margin: 0 0 8px;
    }
    .doc-tabs {
      display: flex; gap: 0;
      margin-top: 6px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .doc-tab {
      padding: 4px 12px;
      cursor: pointer;
      font-size: 0.85em;
      color: var(--vscode-foreground);
      opacity: 0.55;
      border-bottom: 2px solid transparent;
      user-select: none;
    }
    .doc-tab:hover { opacity: 0.85; }
    .doc-tab.active {
      opacity: 1;
      border-bottom-color: var(--vscode-focusBorder, #007fd4);
    }
    .doc-stack {
      height: 180px;
      position: relative;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .doc-section {
      display: none;
      position: absolute;
      inset: 0;
      overflow-y: auto;
    }
    .doc-section.active { display: block; }
    .doc-content {
      padding: 10px 18px 14px;
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em; line-height: 1.45;
      white-space: pre-wrap;
      min-height: 100%;
      box-sizing: border-box;
    }
    .doc-content.examples,
    .doc-content.returns {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.85em;
      background: var(--vscode-textCodeBlock-background);
    }
    .field-input {
      display: flex; align-items: center; gap: 6px;
    }
    .field-input > input,
    .field-input > select,
    .field-input > textarea,
    .field-input > .field-checkbox {
      flex: 1;
    }
    .info-icon {
      position: relative;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center; justify-content: center;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 0.7em; font-weight: bold;
      cursor: help;
      opacity: 0.75;
      user-select: none;
    }
    .info-icon:hover { opacity: 1; }
    .info-icon .info-tip {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      right: calc(100% + 6px);
      top: 50%;
      transform: translateY(-50%);
      background: var(--vscode-editorHoverWidget-background, #252526);
      color: var(--vscode-editorHoverWidget-foreground, #ddd);
      border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
      padding: 6px 10px;
      border-radius: 3px;
      font-size: 0.85em;
      font-weight: normal;
      width: 280px;
      white-space: normal;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      pointer-events: none;
      transition: opacity 0.08s;
      line-height: 1.4;
    }
    .info-icon:hover .info-tip {
      visibility: visible;
      opacity: 1;
    }
    .tool-form {
      padding: 12px 18px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px 12px;
      align-items: start;
      max-width: 760px;
    }
    .tool-form.empty { display: block; }
    .tool-form .field-label {
      padding-top: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
    .tool-form .field-label.required::after {
      content: " *";
      color: var(--vscode-errorForeground, #f48771);
    }
    .tool-form .field-input input[type="text"],
    .tool-form .field-input input[type="number"],
    .tool-form .field-input select,
    .tool-form .field-input textarea {
      width: 100%;
      padding: 4px 6px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 2px;
      font: inherit;
    }
    .tool-form .field-input textarea {
      min-height: 70px;
      resize: vertical;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
    .tool-form .field-input input:focus,
    .tool-form .field-input select:focus,
    .tool-form .field-input textarea:focus {
      outline: 1px solid var(--vscode-focusBorder, #007fd4);
      outline-offset: -1px;
    }
    .tool-form .field-help {
      grid-column: 2;
      font-size: 0.82em;
      color: var(--vscode-descriptionForeground);
      opacity: 0.85;
      margin-top: 1px;
    }
    .tool-form .field-checkbox {
      display: flex; align-items: center; gap: 6px;
    }
    .tool-form .actions {
      grid-column: 1 / -1;
      display: flex; justify-content: flex-end;
      margin-top: 6px;
    }
    .run-btn {
      padding: 5px 18px; cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 2px; font: inherit;
    }
    .run-btn:hover { background: var(--vscode-button-hoverBackground); }
    .last-params {
      padding: 6px 18px;
      font-size: 0.85em;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
      color: var(--vscode-descriptionForeground);
    }
    .last-params summary {
      cursor: pointer;
      padding: 2px 0;
    }
    .last-params .lp-row {
      display: flex; gap: 8px; padding: 2px 0;
    }
    .last-params .lp-name {
      min-width: 140px;
      color: var(--vscode-descriptionForeground);
    }
    .last-params .lp-val {
      color: var(--vscode-foreground);
      font-family: var(--vscode-editor-font-family);
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

      // Wire up doc-tab switching
      panel.querySelectorAll('.doc-tab').forEach(t => {
        t.addEventListener('click', () => activateDocTab(tabId, t.dataset.docTab));
      });

      // Wire up the Run button (CSP forbids inline onclick handlers)
      panel.querySelectorAll('.run-btn[data-run-tab]').forEach(btn => {
        btn.addEventListener('click', () => runTool(btn.dataset.runTab));
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

    function parseDoc(text) {
      const result = { description: '', examples: '', args: {}, returns: '' };
      if (!text) return result;

      const lines = text.split('\\n');
      let section = 'description';
      let current = [];
      const sections = { description: [], examples: [], args: [], returns: [] };

      const flush = () => { sections[section] = current; current = []; };
      const headerRe = /^(Examples?|Args|Arguments|Parameters|Returns?|Return)\\s*:\\s*$/i;

      for (const line of lines) {
        const m = line.match(headerRe);
        if (m) {
          flush();
          const k = m[1].toLowerCase();
          if (k.startsWith('example')) section = 'examples';
          else if (k.startsWith('arg') || k === 'parameters' || k === 'arguments') section = 'args';
          else section = 'returns';
        } else {
          current.push(line);
        }
      }
      flush();

      result.description = sections.description.join('\\n').trim();
      result.examples = dedent(sections.examples);
      result.returns = dedent(sections.returns);

      // Parse "args" section into name -> help map.
      // Pattern: "    name: description text..." (possibly wrapping).
      const argLines = sections.args;
      let lastKey = null;
      const argRe = /^\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*:\\s*(.*)$/;
      for (const ln of argLines) {
        const m = ln.match(argRe);
        if (m) {
          lastKey = m[1];
          result.args[lastKey] = m[2].trim();
        } else if (lastKey && ln.trim()) {
          result.args[lastKey] += ' ' + ln.trim();
        }
      }

      return result;
    }

    function dedent(lines) {
      // Trim leading/trailing blank lines, then strip common indent.
      let start = 0, end = lines.length;
      while (start < end && !lines[start].trim()) start++;
      while (end > start && !lines[end-1].trim()) end--;
      const slice = lines.slice(start, end);
      if (slice.length === 0) return '';
      const indents = slice
        .filter(l => l.trim())
        .map(l => l.match(/^ */)[0].length);
      const minIndent = indents.length ? Math.min(...indents) : 0;
      return slice.map(l => l.slice(minIndent)).join('\\n');
    }

    function buildPanel(tool) {
      const doc = parseDoc(tool.description || '');

      // Build doc tabs (always Description; Examples and Returns only if present)
      const docTabs = [{ key: 'description', label: 'Description', content: doc.description }];
      if (doc.examples) docTabs.push({ key: 'examples', label: 'Examples', content: doc.examples });
      if (doc.returns) docTabs.push({ key: 'returns', label: 'Returns', content: doc.returns });

      const docTabsHtml = docTabs.map((t, i) =>
        '<div class="doc-tab' + (i === 0 ? ' active' : '') + '" data-doc-tab="' + t.key + '">'
        + escHtml(t.label) + '</div>'
      ).join('');

      const docSectionsHtml = docTabs.map((t, i) =>
        '<div class="doc-section' + (i === 0 ? ' active' : '') + '" data-doc-section="' + t.key + '">'
        + '<div class="doc-content ' + t.key + '">' + escHtml(t.content) + '</div>'
        + '</div>'
      ).join('');

      let html = ''
        + '<div class="tool-header">'
        + '  <h2>' + escHtml(tool.label) + '</h2>'
        + '  <div class="doc-tabs">' + docTabsHtml + '</div>'
        + '</div>'
        + '<div class="doc-stack">' + docSectionsHtml + '</div>';

      const noParams = tool.params.length === 0;
      const formClass = noParams ? 'tool-form empty' : 'tool-form';
      html += '<div class="' + formClass + '">';
      if (noParams) {
        html += '<div style="color:var(--vscode-descriptionForeground);font-size:0.9em;margin-bottom:6px">This tool has no parameters.</div>';
      }
      tool.params.forEach(p => { html += buildField(p, doc.args[p.name]); });
      html += ''
        + '  <div class="actions">'
        + '    <button class="run-btn" data-run-tab="' + tool.id + '">Run</button>'
        + '  </div>'
        + '</div>';

      html += '<details class="last-params" id="lastparams-' + tool.id + '" style="display:none">'
        + '  <summary>Parameters used</summary>'
        + '  <div class="lp-body"></div>'
        + '</details>';

      html += '<div class="results" id="results-' + tool.id + '"></div>';
      return html;
    }

    function activateDocTab(tabId, docKey) {
      const panel = document.getElementById('panel-' + tabId);
      if (!panel) return;
      panel.querySelectorAll('.doc-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.docTab === docKey));
      panel.querySelectorAll('.doc-section').forEach(s =>
        s.classList.toggle('active', s.dataset.docSection === docKey));
    }

    const TEXTAREA_PARAMS = ['xml', 'traceback', 'body', 'content', 'source', 'patterns'];

    function needsTextarea(name) {
      const lower = name.toLowerCase();
      return TEXTAREA_PARAMS.some(k => lower.includes(k));
    }

    function buildField(p, argHelp) {
      const label = p.title || p.name;
      const reqClass = p.required ? ' required' : '';
      const help = argHelp || p.description || '';
      const infoIcon = help
        ? '<span class="info-icon">?<span class="info-tip">' + escHtml(help) + '</span></span>'
        : '';

      let inputHtml;
      if (p.enum && p.enum.length > 0) {
        let opts = '';
        if (!p.required) {
          opts += '<option value="">\\u2014</option>';
        }
        p.enum.forEach(v => {
          const sel = v === p.default ? ' selected' : '';
          opts += '<option value="' + escHtml(v) + '"' + sel + '>' + escHtml(v) + '</option>';
        });
        inputHtml = '<select data-param="' + escHtml(p.name) + '">' + opts + '</select>';
      } else if (p.type === 'boolean') {
        const chk = p.default === true ? ' checked' : '';
        inputHtml = '<div class="field-checkbox">'
          + '<input type="checkbox" id="cb-' + escHtml(p.name) + '" data-param="' + escHtml(p.name) + '"' + chk + '>'
          + '<label for="cb-' + escHtml(p.name) + '">Yes</label>'
          + '</div>';
      } else if (p.type === 'integer') {
        const val = p.default !== undefined && p.default !== null ? ' value="' + p.default + '"' : '';
        inputHtml = '<input type="number" data-param="' + escHtml(p.name) + '" placeholder="' + escHtml(label) + '"' + val + '>';
      } else if (needsTextarea(p.name)) {
        inputHtml = '<textarea data-param="' + escHtml(p.name) + '" placeholder="' + escHtml(label) + '"></textarea>';
      } else {
        inputHtml = '<input type="text" data-param="' + escHtml(p.name) + '" placeholder="' + escHtml(label) + '">';
      }

      return ''
        + '<div class="field-label' + reqClass + '">' + escHtml(label) + '</div>'
        + '<div class="field-input">' + inputHtml + infoIcon + '</div>';
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

      const lp = document.getElementById('lastparams-' + tabId);
      if (lp) {
        const body = lp.querySelector('.lp-body');
        if (Object.keys(params).length === 0) {
          body.innerHTML = '<div class="lp-row"><span class="lp-name">(none)</span></div>';
        } else {
          body.innerHTML = Object.entries(params).map(([k, v]) =>
            '<div class="lp-row"><span class="lp-name">' + escHtml(k) + '</span><span class="lp-val">' + escHtml(String(v)) + '</span></div>'
          ).join('');
        }
        lp.style.display = 'block';
        lp.open = false;
      }

      const results = document.getElementById('results-' + tabId);
      if (results) results.innerHTML = '<div class="loading">Loading...</div>';
      vscode.postMessage({ command: 'search', tab: tabId, params: params });
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'activateTab') {
        ensureTab(msg.tab);
        activateTab(msg.tab);
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
