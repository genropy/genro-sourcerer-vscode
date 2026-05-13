import * as vscode from "vscode";
import type { ToolDef } from "../schema/types";
import { getWorkbenchHtml } from "./workbenchHtml";
import { renderResults } from "./resultRenderer";

/**
 * Minimal interface a Workbench client must implement.
 * Decouples the panel from any specific HTTP client.
 */
export interface ToolRunner {
  callEndpoint(
    path: string,
    params: Record<string, string>
  ): Promise<unknown>;
}

/**
 * Singleton WebviewPanel that hosts all tool tabs.
 * Tools, forms, and rendering are all driven by the OpenAPI schema.
 */
export class WorkbenchPanel {
  private static _instance: WorkbenchPanel | undefined;

  private _panel: vscode.WebviewPanel;
  private _client: ToolRunner;
  private _toolMap: Map<string, ToolDef>;

  private constructor(
    client: ToolRunner,
    extensionUri: vscode.Uri,
    tools: ToolDef[]
  ) {
    this._client = client;
    this._toolMap = new Map(tools.map((t) => [t.id, t]));

    const nonce = getNonce();
    this._panel = vscode.window.createWebviewPanel(
      "sourcerer.workbench",
      "Sourcerer",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    this._panel.webview.html = getWorkbenchHtml(tools, nonce);
    this._panel.onDidDispose(() => {
      WorkbenchPanel._instance = undefined;
    });
    this._panel.webview.onDidReceiveMessage((msg) =>
      this._onMessage(msg)
    );
  }

  static open(
    client: ToolRunner,
    extensionUri: vscode.Uri,
    tools: ToolDef[],
    tabId?: string
  ): void {
    if (WorkbenchPanel._instance) {
      WorkbenchPanel._instance._panel.reveal();
    } else {
      WorkbenchPanel._instance = new WorkbenchPanel(
        client,
        extensionUri,
        tools
      );
    }
    if (tabId) {
      WorkbenchPanel._instance._panel.webview.postMessage({
        command: "activateTab",
        tab: tabId,
      });
    }
  }

  static updateClient(client: ToolRunner): void {
    if (WorkbenchPanel._instance) {
      WorkbenchPanel._instance._client = client;
    }
  }

  private async _onMessage(msg: {
    command: string;
    tab: string;
    params: Record<string, string>;
  }): Promise<void> {
    if (msg.command !== "search") {
      return;
    }
    const tool = this._toolMap.get(msg.tab);
    if (!tool) {
      this._postError(msg.tab, `Unknown tool: ${msg.tab}`);
      return;
    }
    try {
      const data = await this._client.callEndpoint(
        tool.path,
        msg.params
      );
      const html = renderResults(data, tool.responseFields);
      this._panel.webview.postMessage({
        command: "results",
        tab: msg.tab,
        html,
      });
    } catch (err) {
      this._postError(
        msg.tab,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  private _postError(tab: string, message: string): void {
    this._panel.webview.postMessage({
      command: "error",
      tab,
      message,
    });
  }
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
