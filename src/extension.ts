import * as vscode from "vscode";
import { SourcererClient } from "./api/client";
import { KBTreeProvider } from "./kb/kbTreeProvider";
import { registerKBCommands } from "./kb/kbCommands";
import { registerCodeCommands } from "./code/codeCommands";
import { registerSemCommands } from "./sem/semCommands";
import { registerGhCommands } from "./gh/ghCommands";
import { ToolTreeProvider } from "./tools/toolTreeProvider";
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

  // KB tree (existing)
  const kbProvider = new KBTreeProvider(client);
  const kbView = vscode.window.createTreeView("sourcerer.kbExplorer", {
    treeDataProvider: kbProvider,
    showCollapseAll: true,
  });

  // Search & Ask tools
  const searchProvider = new ToolTreeProvider([
    { label: "Search KB", icon: "search", commandId: "sourcerer.search" },
    { label: "Ask KB", icon: "comment-discussion", commandId: "sourcerer.ask" },
    { label: "Find Skills", icon: "symbol-keyword", commandId: "sourcerer.findSkills" },
  ]);
  const searchView = vscode.window.createTreeView("sourcerer.searchTools", {
    treeDataProvider: searchProvider,
  });

  // Code tools
  const codeProvider = new ToolTreeProvider([
    { label: "Search Code", icon: "search", commandId: "sourcerer.searchCode" },
    { label: "Search Symbols", icon: "symbol-method", commandId: "sourcerer.searchSymbols" },
    { label: "Class Hierarchy", icon: "type-hierarchy", commandId: "sourcerer.classHierarchy" },
    { label: "Symbol Detail", icon: "symbol-class", commandId: "sourcerer.symbolDetail" },
    { label: "Symbol Source", icon: "file-code", commandId: "sourcerer.symbolSource" },
    { label: "Projects", icon: "folder-library", commandId: "sourcerer.listProjects" },
  ]);
  const codeView = vscode.window.createTreeView("sourcerer.codeTools", {
    treeDataProvider: codeProvider,
  });

  // Semantic tools
  const semProvider = new ToolTreeProvider([
    { label: "Ask Codebase", icon: "hubot", commandId: "sourcerer.askCodebase" },
    { label: "Fulltext Search", icon: "whole-word", commandId: "sourcerer.fulltextSearch" },
  ]);
  const semView = vscode.window.createTreeView("sourcerer.semTools", {
    treeDataProvider: semProvider,
  });

  // GitHub tools
  const ghProvider = new ToolTreeProvider([
    { label: "Repositories", icon: "repo", commandId: "sourcerer.listRepositories" },
  ]);
  const ghView = vscode.window.createTreeView("sourcerer.ghTools", {
    treeDataProvider: ghProvider,
  });

  // Register all commands
  registerKBCommands(context, client, kbProvider);
  registerCodeCommands(context, client);
  registerSemCommands(context, client);
  registerGhCommands(context, client);

  context.subscriptions.push(
    kbView,
    searchView,
    codeView,
    semView,
    ghView,
    logger,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sourcerer")) {
        const updated = getSettings();
        client.updateConfig(updated.apiUrl, updated.token, {
          cacheTtlSeconds: updated.cacheTtlSeconds,
        });
        kbProvider.refresh();
      }
    })
  );

  logger.info("Sourcerer Visual activated");
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
