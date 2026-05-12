import * as vscode from "vscode";
import type { ToolDef } from "../schema/types";

type TreeNode = CategoryNode | ToolNode;

class CategoryNode extends vscode.TreeItem {
  constructor(
    public readonly category: string,
    public readonly label: string,
    icon: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "category";
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

class ToolNode extends vscode.TreeItem {
  constructor(public readonly tool: ToolDef) {
    super(tool.label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tool.description.split("\n")[0];
    this.contextValue = "tool";
    this.iconPath = new vscode.ThemeIcon(tool.icon);
    this.command = {
      command: "sourcerer.open",
      title: tool.label,
      arguments: [tool.id],
    };
  }
}

/**
 * TreeDataProvider that shows tools grouped by category.
 * Categories are expandable, tools are clickable leaves.
 * Built dynamically from ToolDef[] parsed from OpenAPI schema.
 */
export class ToolTreeProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _categories: Map<string, ToolDef[]> = new Map();

  setTools(tools: ToolDef[]): void {
    this._categories.clear();
    for (const t of tools) {
      const list = this._categories.get(t.category) ?? [];
      list.push(t);
      this._categories.set(t.category, list);
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      // Root: show categories
      const cats: CategoryNode[] = [];
      for (const [cat, tools] of this._categories) {
        const first = tools[0];
        const label = first?.categoryLabel ?? cat;
        const icon = first?.categoryIcon ?? "folder";
        cats.push(new CategoryNode(cat, label, icon));
      }
      return cats;
    }
    if (element instanceof CategoryNode) {
      const tools = this._categories.get(element.category) ?? [];
      return tools.map((t) => new ToolNode(t));
    }
    return [];
  }
}
