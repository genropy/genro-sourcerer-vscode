import * as vscode from "vscode";
import type { ToolDef } from "../schema/types";
import type { SchemaRegistry } from "./schemaRegistry";
import type { OpenApiSchemaInstance } from "./types";

type TreeNode = SchemaNode | CategoryNode | ToolNode | ErrorNode;

class SchemaNode extends vscode.TreeItem {
  constructor(public readonly instance: OpenApiSchemaInstance) {
    super(
      instance.config.name,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    this.id = `schema:${instance.config.id}`;
    this.contextValue = "openapiSchema";
    this.iconPath = new vscode.ThemeIcon("globe");
    this.description = instance.config.url;
    if (instance.loadError) {
      this.description = "load error";
      this.tooltip = `Failed to load schema:\n${instance.loadError}`;
    }
  }
}

class CategoryNode extends vscode.TreeItem {
  constructor(
    public readonly schemaId: string,
    public readonly category: string,
    public readonly label: string,
    public readonly tools: ToolDef[],
    icon: string | undefined
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `cat:${schemaId}:${category}`;
    this.contextValue = "openapiCategory";
    if (icon) {
      this.iconPath = new vscode.ThemeIcon(icon);
    }
  }
}

class ToolNode extends vscode.TreeItem {
  constructor(
    public readonly schemaId: string,
    public readonly tool: ToolDef
  ) {
    super(tool.label, vscode.TreeItemCollapsibleState.None);
    this.id = `tool:${schemaId}:${tool.id}`;
    this.tooltip = tool.description.split("\n")[0];
    this.contextValue = "openapiTool";
    if (tool.icon) {
      this.iconPath = new vscode.ThemeIcon(tool.icon);
    }
    this.command = {
      command: "openapi.runTool",
      title: tool.label,
      arguments: [schemaId, tool.id],
    };
  }
}

class ErrorNode extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("error");
  }
}

/**
 * TreeDataProvider with three levels:
 *   root           -> SchemaNode (one per registered OpenAPI schema)
 *   schema         -> CategoryNode (one per first-path-segment)
 *   category       -> ToolNode (one per OpenAPI operation)
 */
export class SchemasTreeProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly _registry: SchemaRegistry) {
    this._registry.onDidChange(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this._registry.list().map((i) => new SchemaNode(i));
    }
    if (element instanceof SchemaNode) {
      if (element.instance.loadError) {
        return [new ErrorNode(element.instance.loadError)];
      }
      const byCategory = new Map<string, ToolDef[]>();
      for (const t of element.instance.tools) {
        const list = byCategory.get(t.category) ?? [];
        list.push(t);
        byCategory.set(t.category, list);
      }
      return Array.from(byCategory.entries()).map(([cat, tools]) => {
        const first = tools[0];
        const label = first?.categoryLabel ?? cat;
        return new CategoryNode(
          element.instance.config.id,
          cat,
          label,
          tools,
          first?.categoryIcon
        );
      });
    }
    if (element instanceof CategoryNode) {
      return element.tools.map((t) => new ToolNode(element.schemaId, t));
    }
    return [];
  }
}
