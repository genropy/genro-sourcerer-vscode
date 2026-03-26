import * as vscode from "vscode";
import { SourcererClient } from "./api/client";
import { KBTreeProvider } from "./kb/kbTreeProvider";
import { registerKBCommands } from "./kb/kbCommands";
import { getSettings } from "./config/settings";
import { Logger } from "./utils/logger";

let logger: Logger;

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger("Sourcerer");
  logger.info("Sourcerer Visual activating...");

  const settings = getSettings();
  const client = new SourcererClient(settings.apiUrl, settings.token, {
    cacheTtlSeconds: settings.cacheTtlSeconds,
  });

  const treeProvider = new KBTreeProvider(client);

  const treeView = vscode.window.createTreeView("sourcerer.kbExplorer", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  registerKBCommands(context, client, treeProvider);

  context.subscriptions.push(
    treeView,
    logger,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sourcerer")) {
        const updated = getSettings();
        client.updateConfig(updated.apiUrl, updated.token, {
          cacheTtlSeconds: updated.cacheTtlSeconds,
        });
        treeProvider.refresh();
      }
    })
  );

  logger.info("Sourcerer Visual activated");
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
