import * as vscode from "vscode";
import { SourcererClient } from "./api/client";
import { KBTreeProvider } from "./kb/kbTreeProvider";
import { registerKBCommands } from "./kb/kbCommands";
import { ToolTreeProvider } from "./tools/toolTreeProvider";
import { WorkbenchPanel } from "./workbench/workbenchPanel";
import { loadToolDefs } from "./schema/schemaLoader";
import type { ToolDef } from "./schema/types";
import { getSettings } from "./config/settings";
import { Logger } from "./utils/logger";

let logger: Logger;
let toolDefs: ToolDef[] = [];

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger("Sourcerer");
  logger.info("Sourcerer Visual activating...");

  const settings = getSettings();
  const client = new SourcererClient(settings.apiUrl, settings.token, {
    cacheTtlSeconds: settings.cacheTtlSeconds,
  });

  // KB tree (topics & skills — static, unchanged)
  const kbProvider = new KBTreeProvider(client);
  const kbView = vscode.window.createTreeView("sourcerer.kbExplorer", {
    treeDataProvider: kbProvider,
    showCollapseAll: true,
  });

  // Tools tree (dynamic, populated from OpenAPI schema)
  const toolsProvider = new ToolTreeProvider();
  const toolsView = vscode.window.createTreeView("sourcerer.toolsExplorer", {
    treeDataProvider: toolsProvider,
    showCollapseAll: true,
  });

  // Load schema and populate tools tree
  loadSchema(client, toolsProvider);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("sourcerer.open", (tabId?: string) => {
      WorkbenchPanel.open(client, context.extensionUri, toolDefs, tabId);
    }),

    vscode.commands.registerCommand("sourcerer.reloadSchema", () => {
      loadSchema(client, toolsProvider);
      vscode.window.showInformationMessage("Sourcerer schema reloaded.");
    })
  );

  registerKBCommands(context, client, kbProvider);

  context.subscriptions.push(
    kbView,
    toolsView,
    logger,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sourcerer")) {
        const updated = getSettings();
        client.updateConfig(updated.apiUrl, updated.token, {
          cacheTtlSeconds: updated.cacheTtlSeconds,
        });
        kbProvider.refresh();
        WorkbenchPanel.updateClient(client);
        loadSchema(client, toolsProvider);
      }
    })
  );

  logger.info("Sourcerer Visual activated");
}

async function loadSchema(
  client: SourcererClient,
  toolsProvider: ToolTreeProvider
): Promise<void> {
  try {
    toolDefs = await loadToolDefs(client);
    toolsProvider.setTools(toolDefs);
    logger.info(`Loaded ${toolDefs.length} tools from OpenAPI schema`);
  } catch (err) {
    logger.error(
      `Failed to load OpenAPI schema: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
