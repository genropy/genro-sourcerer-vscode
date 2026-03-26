import * as vscode from "vscode";

export interface ToolEntry {
  label: string;
  icon: string;
  commandId: string;
}

export class ToolItem extends vscode.TreeItem {
  constructor(entry: ToolEntry) {
    super(entry.label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(entry.icon);
    this.command = {
      command: entry.commandId,
      title: entry.label,
    };
  }
}

/**
 * Generic TreeDataProvider that renders a static list of clickable tool entries.
 * Each entry triggers a VS Code command when clicked.
 */
export class ToolTreeProvider
  implements vscode.TreeDataProvider<ToolItem>
{
  private readonly _items: ToolItem[];

  constructor(entries: ToolEntry[]) {
    this._items = entries.map((e) => new ToolItem(e));
  }

  getTreeItem(element: ToolItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ToolItem[] {
    return this._items;
  }
}
