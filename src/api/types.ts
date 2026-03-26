/** Envelope for all Sourcerer API responses. */
export interface ApiResponse<T> {
  ok: boolean;
  result: T;
  error?: string;
}

/** A topic node in the Knowledge Base tree. */
export interface Topic {
  id: string;
  name: string;
  hierarchical_name: string;
  parent_id: string | null;
  description: string | null;
  tags: string | null;
  children?: Topic[];
}

/** A skill in the Knowledge Base. */
export interface Skill {
  id: string;
  title: string;
  description: string | null;
  content: string;
  priority: number;
  status: "draft" | "verified";
  verified_by: string | null;
  verified_ts: string | null;
}

/** Skill summary (without full content) as returned by get_skills. */
export interface SkillSummary {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: "draft" | "verified";
}

/** Result from kb_ask triage. */
export interface AskResult {
  answer: string;
  skills: SkillSummary[];
  topics: string[];
}

/** Health check response. */
export interface HealthResponse {
  status: string;
  version: string;
}

/** Topic tree response (flat list with parent_id for tree reconstruction). */
export type TopicTree = Topic[];
