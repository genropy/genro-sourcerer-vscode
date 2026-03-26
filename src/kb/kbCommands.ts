import * as vscode from "vscode";
import type { SourcererClient } from "../api/client";
import type { KBTreeProvider } from "./kbTreeProvider";
import { SkillPreview } from "./skillPreview";

/**
 * Register all KB-related commands.
 */
export function registerKBCommands(
  context: vscode.ExtensionContext,
  client: SourcererClient,
  treeProvider: KBTreeProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sourcerer.refresh", () => {
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand(
      "sourcerer.viewSkill",
      async (skillId: string, title: string) => {
        await SkillPreview.show(
          client,
          skillId,
          title,
          context.extensionUri
        );
      }
    ),

    vscode.commands.registerCommand("sourcerer.search", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search the Knowledge Base",
        placeHolder: "e.g. formulaColumn, deploy, batch actions...",
      });
      if (!query) {
        return;
      }
      try {
        const result = await client.ask(query);
        if (result.skills.length === 0) {
          vscode.window.showInformationMessage(
            "No matching skills found."
          );
          return;
        }
        const picked = await vscode.window.showQuickPick(
          result.skills.map((s) => ({
            label: s.title,
            description: s.description ?? "",
            detail: s.status === "verified" ? "Verified" : "Draft",
            skillId: s.id,
          })),
          { placeHolder: "Select a skill to view" }
        );
        if (picked) {
          await SkillPreview.show(
            client,
            picked.skillId,
            picked.label,
            context.extensionUri
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `Search failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand("sourcerer.ask", async () => {
      const question = await vscode.window.showInputBox({
        prompt: "Ask Sourcerer",
        placeHolder: "e.g. How does formulaColumn work?",
      });
      if (!question) {
        return;
      }
      try {
        const result = await client.ask(question);
        // Show answer in a new untitled document
        const doc = await vscode.workspace.openTextDocument({
          content: result.answer,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Ask failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand(
      "sourcerer.checkConnection",
      async () => {
        try {
          const health = await client.health();
          vscode.window.showInformationMessage(
            `Connected to Sourcerer (${health.status})`
          );
        } catch (err) {
          vscode.window.showErrorMessage(
            `Connection failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    )
  );
}
