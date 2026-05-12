/** Envelope for all Sourcerer API responses. */
export interface ApiResponse<T> {
  data: T;
  meta: Record<string, unknown>;
  error?: string;
}

/** A topic node in the Knowledge Base tree. */
export interface Topic {
  id: string;
  name: string;
  hierarchical_name: string;
  parent_id: string | null;
  depth: number;
  child_count: number;
  description?: string;
  tags?: string;
}

/** A skill in the Knowledge Base (full content). */
export interface Skill {
  id: string;
  title: string;
  content: string;
  status: "draft" | "verified";
  topic_path: string;
}

/** Skill summary (without full content) as returned by get_skills. */
export interface SkillSummary {
  id: string;
  title: string;
  status: "draft" | "verified";
  topic_path: string;
  content_preview: string;
  is_alias: boolean;
}

/** A skill returned by kb_ask with similarity score and full content. */
export interface AskSkill {
  id: string;
  title: string;
  status: string | null;
  topic_path: string;
  similarity: number;
  content: string;
}

/** Result from kb_ask triage. */
export interface AskResult {
  skills: AskSkill[];
  branches: string[] | null;
  suggested_tool: string | null;
}

/** Health check response. */
export interface HealthResponse {
  status: string;
  version: string;
}

/** Topic tree response (flat list with parent_id for tree reconstruction). */
export type TopicTree = Topic[];

// --- Code types ---

/** A code search match. */
export interface CodeMatch {
  repo_name: string;
  module_path: string;
  lineno: number;
  match_line: string;
  context: string;
}

/** A symbol search result. */
export interface SymbolMatch {
  name: string;
  kind: string;
  qualified_name: string;
  signature: string | null;
  lineno: number;
  end_lineno: number;
  module_path: string;
  repo_name: string;
}

/** Class hierarchy entry. */
export interface ClassHierarchyEntry {
  name: string;
  qualified_name: string;
  bases: string;
  module_path: string;
  repo_name: string;
  subclasses?: ClassHierarchyEntry[];
}

/** Symbol detail. */
export interface SymbolDetail {
  id: string;
  name: string;
  kind: string;
  qualified_name: string;
  signature: string | null;
  return_annotation: string | null;
  decorators: string;
  bases: string;
  docstring: string | null;
  lineno: number;
  end_lineno: number;
  module_path: string;
  repo_name: string;
}

/** Symbol source. */
export interface SymbolSource {
  source: string;
  qualified_name?: string;
  module_path?: string;
  lineno?: number;
}

/** Indexed project. */
export interface ProjectInfo {
  project_name: string;
  project_type: string;
  repo_name: string;
  n_packages: number;
  n_modules: number;
  n_symbols: number;
}

// --- Semantic types ---

/** Semantic code search result. */
export interface SemanticMatch {
  id: string;
  qualified_name: string;
  kind: string;
  signature: string | null;
  docstring: string | null;
  lineno: number;
  end_lineno: number;
  module_path: string;
  repo_name: string;
}

/** Fulltext search result. */
export interface FulltextMatch {
  document_type: string;
  name: string;
  author_name: string | null;
  repo_name: string | null;
  document_snippet: string;
  rank: number;
}

// --- GitHub types ---

/** Repository info. */
export interface RepositoryInfo {
  full_name: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  org: string | null;
  html_url: string;
  issues_count: number;
  open_issues: number;
  prs_count: number;
  open_prs: number;
  commits_count: number;
}
