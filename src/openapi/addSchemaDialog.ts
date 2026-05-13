import * as vscode from "vscode";
import type { AuthConfig, OpenApiSchemaConfig } from "./types";

/**
 * Open a WebviewPanel hosting a form to register a new OpenAPI schema.
 * All fields are visible at once; the form survives focus changes
 * (unlike the previous showInputBox chain).
 *
 * Resolves with the new config on submit, or undefined if the user
 * closes the panel without submitting.
 */
export function openSchemaDialog(
  extensionUri: vscode.Uri
): Promise<OpenApiSchemaConfig | undefined> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      "openapi.addSchema",
      "Add OpenAPI Schema",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    const nonce = getNonce();
    panel.webview.html = renderDialogHtml(nonce);

    let settled = false;
    const settle = (value: OpenApiSchemaConfig | undefined): void => {
      if (settled) return;
      settled = true;
      resolve(value);
      panel.dispose();
    };

    panel.onDidDispose(() => settle(undefined));

    panel.webview.onDidReceiveMessage((msg: DialogMessage) => {
      if (msg.command === "submit") {
        const config = buildConfigFromForm(msg.values);
        if (config) {
          settle(config);
        }
      } else if (msg.command === "cancel") {
        settle(undefined);
      }
    });
  });
}

interface FormValues {
  name: string;
  schemaUrl: string;
  url: string;
  authType: "none" | "bearer" | "apiKey";
  authHeader: string;
  authValue: string;
}

type DialogMessage =
  | { command: "submit"; values: FormValues }
  | { command: "cancel" };

function buildConfigFromForm(values: FormValues): OpenApiSchemaConfig | undefined {
  const name = (values.name || "").trim();
  const schemaUrl = (values.schemaUrl || "").trim();
  const url = (values.url || "").trim();
  if (!name || !schemaUrl || !url) {
    return undefined;
  }

  let auth: AuthConfig;
  if (values.authType === "bearer") {
    if (!values.authValue) return undefined;
    auth = { type: "bearer", value: values.authValue };
  } else if (values.authType === "apiKey") {
    const header = (values.authHeader || "").trim();
    if (!header || !values.authValue) return undefined;
    auth = { type: "apiKey", header, value: values.authValue };
  } else {
    auth = { type: "none" };
  }

  return {
    id: slugify(name),
    name,
    url,
    schemaUrl,
    auth,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function renderDialogHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Add OpenAPI Schema</title>
</head>
<body>
  <div id="form-host"></div>
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const host = document.getElementById('form-host');
      const shadow = host.attachShadow({ mode: 'open' });

      shadow.innerHTML = \`
        <style>
          :host, * { box-sizing: border-box; }
          .root {
            font-family: var(--vscode-font-family, system-ui), sans-serif;
            font-size: var(--vscode-font-size, 13px);
            color: var(--vscode-foreground, #ddd);
            background: var(--vscode-editor-background, #1e1e1e);
            padding: 16px 18px;
            max-width: 640px;
          }
          h1 { font-size: 1.1em; margin: 0 0 6px; }
          .description {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em; line-height: 1.45;
            margin: 0 0 16px;
          }
          .field {
            display: grid;
            grid-template-columns: 160px 1fr;
            gap: 6px 12px;
            align-items: start;
            margin-bottom: 12px;
          }
          .field.required label::after {
            content: " *";
            color: var(--vscode-errorForeground, #f48771);
          }
          .field.hidden { display: none; }
          label {
            padding-top: 5px;
            color: var(--vscode-descriptionForeground);
            font-size: 0.92em;
          }
          input[type="text"], input[type="password"], select {
            width: 100%;
            padding: 5px 7px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
            border-radius: 2px;
            font: inherit;
          }
          input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder, #007fd4);
            outline-offset: -1px;
          }
          .field.error input, .field.error select {
            border-color: var(--vscode-errorForeground, #f48771);
          }
          .help {
            grid-column: 2;
            font-size: 0.82em;
            color: var(--vscode-descriptionForeground);
            opacity: 0.85;
            margin-top: 1px;
          }
          .err-msg {
            grid-column: 2;
            font-size: 0.82em;
            color: var(--vscode-errorForeground, #f48771);
            margin-top: 1px;
            display: none;
          }
          .field.error .err-msg { display: block; }
          .actions {
            margin-top: 18px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
          }
          button {
            font: inherit;
            padding: 5px 16px;
            border-radius: 2px;
            border: none;
            cursor: pointer;
          }
          button.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          button.primary:hover {
            background: var(--vscode-button-hoverBackground);
          }
          button.secondary {
            background: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #ddd);
          }
          button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground, #45494e);
          }
        </style>

        <div class="root">
          <h1>Add OpenAPI Schema</h1>
          <p class="description">
            Register any OpenAPI 3.x document by URL. Its operations
            will appear in the OpenAPI sidebar and can be run from the
            Workbench.
          </p>

          <form id="form" novalidate>
            <div class="field required" data-name="name">
              <label for="name">Schema name</label>
              <input type="text" id="name" placeholder="e.g. Petstore">
              <div class="help">Display label in the sidebar.</div>
              <div class="err-msg">Name is required.</div>
            </div>

            <div class="field required" data-name="schemaUrl">
              <label for="schemaUrl">OpenAPI document URL</label>
              <input type="text" id="schemaUrl"
                     placeholder="https://example.com/openapi.json">
              <div class="help">Full URL of the OpenAPI JSON file.</div>
              <div class="err-msg">Must be a valid URL.</div>
            </div>

            <div class="field required" data-name="url">
              <label for="url">Base URL</label>
              <input type="text" id="url"
                     placeholder="https://api.example.com">
              <div class="help">Where API calls are sent.</div>
              <div class="err-msg">Must be a valid URL.</div>
            </div>

            <div class="field" data-name="authType">
              <label for="authType">Auth type</label>
              <select id="authType">
                <option value="none" selected>None</option>
                <option value="bearer">Bearer token</option>
                <option value="apiKey">API key (header)</option>
              </select>
            </div>

            <div class="field hidden" data-name="authHeader" id="row-authHeader">
              <label for="authHeader">Header name</label>
              <input type="text" id="authHeader" value="X-API-Key">
              <div class="err-msg">Header name is required.</div>
            </div>

            <div class="field hidden" data-name="authValue" id="row-authValue">
              <label for="authValue">Auth value</label>
              <input type="password" id="authValue"
                     placeholder="paste token or key">
              <div class="err-msg">Auth value is required.</div>
            </div>

            <div class="actions">
              <button type="button" class="secondary" id="cancel">Cancel</button>
              <button type="submit" class="primary" id="submit">Add Schema</button>
            </div>
          </form>
        </div>
      \`;

      const form = shadow.getElementById('form');
      const nameI = shadow.getElementById('name');
      const schemaUrlI = shadow.getElementById('schemaUrl');
      const urlI = shadow.getElementById('url');
      const authTypeS = shadow.getElementById('authType');
      const authHeaderI = shadow.getElementById('authHeader');
      const authValueI = shadow.getElementById('authValue');
      const rowAuthHeader = shadow.getElementById('row-authHeader');
      const rowAuthValue = shadow.getElementById('row-authValue');
      const cancelBtn = shadow.getElementById('cancel');

      function updateAuthVisibility() {
        const v = authTypeS.value;
        rowAuthValue.classList.toggle('hidden', v === 'none');
        rowAuthHeader.classList.toggle('hidden', v !== 'apiKey');
      }
      updateAuthVisibility();
      authTypeS.addEventListener('change', updateAuthVisibility);

      // Auto-fill base URL from schemaUrl origin once the user has
      // typed a valid schema URL and the base URL is still empty.
      schemaUrlI.addEventListener('blur', () => {
        if (urlI.value.trim()) return;
        try {
          urlI.value = new URL(schemaUrlI.value.trim()).origin;
        } catch { /* ignore */ }
      });

      cancelBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'cancel' });
      });

      function isValidUrl(s) {
        try { new URL(s); return true; } catch { return false; }
      }

      function clearError(name) {
        const row = shadow.querySelector('.field[data-name="' + name + '"]');
        if (row) row.classList.remove('error');
      }
      function setError(name) {
        const row = shadow.querySelector('.field[data-name="' + name + '"]');
        if (row) row.classList.add('error');
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        ['name','schemaUrl','url','authHeader','authValue'].forEach(clearError);

        const values = {
          name: nameI.value.trim(),
          schemaUrl: schemaUrlI.value.trim(),
          url: urlI.value.trim(),
          authType: authTypeS.value,
          authHeader: authHeaderI.value.trim(),
          authValue: authValueI.value
        };

        let ok = true;
        if (!values.name) { setError('name'); ok = false; }
        if (!isValidUrl(values.schemaUrl)) { setError('schemaUrl'); ok = false; }
        if (!isValidUrl(values.url)) { setError('url'); ok = false; }
        if (values.authType === 'apiKey' && !values.authHeader) {
          setError('authHeader'); ok = false;
        }
        if (values.authType !== 'none' && !values.authValue) {
          setError('authValue'); ok = false;
        }
        if (!ok) return;

        vscode.postMessage({ command: 'submit', values });
      });
    }());
  </script>
</body>
</html>`;
}
