import * as vscode from "vscode";
import type { SourcererClient } from "../api/client";
import { SearchResultsPanel } from "../tools/searchResultsPanel";
import { SourcePanel } from "../tools/sourcePanel";

/**
 * Register Semantic search commands.
 */
export function registerSemCommands(
  context: vscode.ExtensionContext,
  client: SourcererClient
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sourcerer.askCodebase", async () => {
      const question = await vscode.window.showInputBox({
        prompt: "Semantic search over the codebase",
        placeHolder: "e.g. how is authentication handled?",
      });
      if (!question) {
        return;
      }
      try {
        const results = await client.askCodebase(question);
        if (results.length === 0) {
          vscode.window.showInformationMessage("No semantic matches found.");
          return;
        }
        const picked = await vscode.window.showQuickPick(
          results.map((m) => ({
            label: m.qualified_name,
            description: `${m.kind} — ${m.repo_name}/${m.module_path}:${m.lineno}`,
            detail: m.docstring
              ? m.docstring.substring(0, 120)
              : m.signature ?? "",
            qualifiedName: m.qualified_name,
          })),
          { placeHolder: "Select a symbol to view source" }
        );
        if (picked) {
          try {
            const source = await client.getSymbolSource(picked.qualifiedName);
            SourcePanel.show(
              picked.qualifiedName,
              source.source,
              picked.description ?? undefined
            );
          } catch {
            vscode.window.showErrorMessage(
              `Could not load source for ${picked.qualifiedName}`
            );
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `Ask codebase failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand("sourcerer.fulltextSearch", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Fulltext search across all indexed content",
        placeHolder: "e.g. GnrWebPage, formulaColumn...",
      });
      if (!query) {
        return;
      }
      try {
        const results = await client.searchFulltext(query);
        if (results.length === 0) {
          vscode.window.showInformationMessage("No fulltext matches found.");
          return;
        }
        SearchResultsPanel.show(
          query,
          results.map((m) => ({
            title: `${m.document_type} (rank: ${m.rank.toFixed(4)})`,
            code: m.snippet,
          }))
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Fulltext search failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );
}
