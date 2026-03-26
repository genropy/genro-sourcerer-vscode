import * as vscode from "vscode";
import type { SourcererClient } from "../api/client";
import type { Topic } from "../api/types";
import { TopicItem, SkillItem } from "./kbTreeItems";

type KBTreeItem = TopicItem | SkillItem;

/**
 * TreeDataProvider for the KB Explorer sidebar.
 *
 * Root level shows top-level topics. Expanding a topic shows its
 * children (sub-topics) and skills.
 */
export class KBTreeProvider
  implements vscode.TreeDataProvider<KBTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    KBTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _topicMap = new Map<string, Topic>();

  constructor(private readonly _client: SourcererClient) {}

  refresh(): void {
    this._topicMap.clear();
    this._client.clearCache();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KBTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: KBTreeItem): Promise<KBTreeItem[]> {
    if (!element) {
      return this._getRootTopics();
    }
    if (element instanceof TopicItem) {
      return this._getTopicChildren(element.topic);
    }
    return [];
  }

  private async _getRootTopics(): Promise<TopicItem[]> {
    try {
      const topics = await this._client.getTopicTree();
      this._topicMap.clear();
      for (const t of topics) {
        this._topicMap.set(t.id, t);
      }
      const roots = topics.filter((t) => t.parent_id === null);
      return roots.map((t) => new TopicItem(t));
    } catch {
      return [];
    }
  }

  private async _getTopicChildren(
    topic: Topic
  ): Promise<KBTreeItem[]> {
    const items: KBTreeItem[] = [];

    // Sub-topics
    const allTopics = Array.from(this._topicMap.values());
    const children = allTopics.filter((t) => t.parent_id === topic.id);
    for (const child of children) {
      items.push(new TopicItem(child));
    }

    // Skills
    try {
      const skills = await this._client.getSkills(
        topic.hierarchical_name
      );
      for (const skill of skills) {
        items.push(new SkillItem(skill, topic.hierarchical_name));
      }
    } catch {
      // Skills fetch failed — show sub-topics only
    }

    return items;
  }
}
