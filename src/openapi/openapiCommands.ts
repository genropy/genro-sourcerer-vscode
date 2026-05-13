import * as vscode from "vscode";
import { WorkbenchPanel } from "../workbench/workbenchPanel";
import { openSchemaDialog } from "./addSchemaDialog";
import { GenericHttpClient } from "./httpClient";
import type { SchemaRegistry } from "./schemaRegistry";

/**
 * Register all OpenAPI-related commands. The view (`openapi.schemasExplorer`)
 * and its title-bar `+` button trigger `openapi.addSchema`. Tool nodes
 * trigger `openapi.runTool` with `(schemaId, toolId)` arguments.
 */
export function registerOpenApiCommands(
  context: vscode.ExtensionContext,
  registry: SchemaRegistry
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("openapi.addSchema", async () => {
      const config = await openSchemaDialog(context.extensionUri);
      if (!config) return;
      await registry.addSchema(config);
      vscode.window.showInformationMessage(
        `OpenAPI schema "${config.name}" registered.`
      );
    }),

    vscode.commands.registerCommand(
      "openapi.removeSchema",
      async (node: { instance?: { config?: { id?: string } } } | undefined) => {
        const schemaId = node?.instance?.config?.id;
        if (!schemaId) {
          vscode.window.showWarningMessage(
            "Run this command from a schema's right-click menu."
          );
          return;
        }
        const confirm = await vscode.window.showWarningMessage(
          `Remove OpenAPI schema "${schemaId}"?`,
          { modal: true },
          "Remove"
        );
        if (confirm !== "Remove") return;
        await registry.removeSchema(schemaId);
      }
    ),

    vscode.commands.registerCommand(
      "openapi.reloadSchema",
      async (node: { instance?: { config?: { id?: string } } } | undefined) => {
        const schemaId = node?.instance?.config?.id;
        if (!schemaId) return;
        await registry.reload(schemaId);
      }
    ),

    vscode.commands.registerCommand(
      "openapi.runTool",
      (schemaId: string, toolId: string) => {
        const instance = registry.get(schemaId);
        if (!instance) {
          vscode.window.showErrorMessage(
            `Unknown OpenAPI schema: ${schemaId}`
          );
          return;
        }
        const client = new GenericHttpClient(
          instance.config.url,
          instance.config.auth
        );
        WorkbenchPanel.open(
          client,
          context.extensionUri,
          instance.tools,
          toolId
        );
      }
    )
  );
}
