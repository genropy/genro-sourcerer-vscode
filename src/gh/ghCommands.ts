import * as vscode from "vscode";
import type { SourcererClient } from "../api/client";

/**
 * Register GitHub-related commands.
 */
export function registerGhCommands(
  context: vscode.ExtensionContext,
  client: SourcererClient
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sourcerer.listRepositories", async () => {
      try {
        const repos = await client.listRepositories();
        if (repos.length === 0) {
          vscode.window.showInformationMessage(
            "No indexed repositories found."
          );
          return;
        }
        const picked = await vscode.window.showQuickPick(
          repos.map((r) => ({
            label: r.full_name,
            description: r.description ?? "",
            detail: [
              `Issues: ${r.issues_count} (${r.open_issues} open)`,
              `PRs: ${r.prs_count} (${r.open_prs} open)`,
              `Commits: ${r.commits_count}`,
              r.archived ? "ARCHIVED" : "",
              r.private ? "PRIVATE" : "",
            ]
              .filter(Boolean)
              .join(" | "),
            url: r.html_url,
          })),
          { placeHolder: "Select a repository" }
        );
        if (picked) {
          vscode.env.openExternal(vscode.Uri.parse(picked.url));
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `List repositories failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );
}
