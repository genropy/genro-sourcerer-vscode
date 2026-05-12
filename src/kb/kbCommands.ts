import * as vscode from "vscode";
import type { SourcererClient } from "../api/client";
import type { KBTreeProvider } from "./kbTreeProvider";
import { SkillPreview } from "./skillPreview";

/**
 * Register KB-specific commands (tree refresh, skill preview, connection check).
 * Search/Ask/FindSkills are now handled by the Workbench panel.
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
