import * as vscode from "vscode";
import type { Topic, SkillSummary } from "../api/types";

/** Tree item representing a KB topic (folder). */
export class TopicItem extends vscode.TreeItem {
  constructor(public readonly topic: Topic) {
    super(topic.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = topic.description ?? topic.hierarchical_name;
    this.contextValue = "topic";
    this.iconPath = new vscode.ThemeIcon("symbol-folder");
  }
}

/** Tree item representing a KB skill (leaf). */
export class SkillItem extends vscode.TreeItem {
  constructor(
    public readonly skill: SkillSummary,
    public readonly topicName: string
  ) {
    super(skill.title, vscode.TreeItemCollapsibleState.None);
    this.tooltip = skill.content_preview || skill.title;
    this.contextValue = "skill";
    this.iconPath = new vscode.ThemeIcon(
      skill.status === "verified" ? "verified" : "file-text"
    );
    this.command = {
      command: "sourcerer.viewSkill",
      title: "View Skill",
      arguments: [skill.id, skill.title],
    };
  }
}
