import {
  ApiResponse,
  TopicTree,
  SkillSummary,
  Skill,
  AskResult,
  HealthResponse,
  CodeMatch,
  SymbolMatch,
  ClassHierarchyEntry,
  SymbolDetail,
  SymbolSource,
  ProjectInfo,
  SemanticMatch,
  FulltextMatch,
  RepositoryInfo,
} from "./types";

interface ClientOptions {
  cacheTtlSeconds: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * HTTP client for the Sourcerer REST API.
 *
 * Handles authentication (Bearer token), response envelope unwrapping,
 * and optional in-memory caching with TTL.
 */
export class SourcererClient {
  private _baseUrl: string;
  private _token: string;
  private _cacheTtl: number;
  private _cache = new Map<string, CacheEntry<unknown>>();

  constructor(baseUrl: string, token: string, options: ClientOptions) {
    this._baseUrl = baseUrl.replace(/\/+$/, "");
    this._token = token;
    this._cacheTtl = options.cacheTtlSeconds * 1000;
  }

  updateConfig(
    baseUrl: string,
    token: string,
    options: ClientOptions
  ): void {
    this._baseUrl = baseUrl.replace(/\/+$/, "");
    this._token = token;
    this._cacheTtl = options.cacheTtlSeconds * 1000;
    this._cache.clear();
  }

  /** Check connection to Sourcerer. */
  async health(): Promise<HealthResponse> {
    return this._get<HealthResponse>("/api/srv/health");
  }

  /** Get the full topic tree, including private (tagged) topics. */
  async getTopicTree(): Promise<TopicTree> {
    return this._get<TopicTree>("/api/kb/get_topic_tree", {
      params: { tags: "all" },
      useCache: true,
    });
  }

  /** Get skills for a given topic. */
  async getSkills(topicName: string): Promise<SkillSummary[]> {
    return this._get<SkillSummary[]>("/api/kb/get_skills", {
      params: { topic: topicName },
      useCache: true,
    });
  }

  /** Get full skill content by ID. */
  async getSkillContent(skillId: string): Promise<Skill> {
    return this._get<Skill>("/api/kb/get_skill_content", {
      params: { skill_id: skillId },
      useCache: true,
    });
  }

  /** Semantic triage query. */
  async ask(question: string): Promise<AskResult> {
    return this._get<AskResult>("/api/kb/ask", {
      params: { question },
    });
  }

  /** Find skills by semantic similarity. */
  async findSkills(question: string): Promise<AskResult> {
    return this._get<AskResult>("/api/kb/find_skills", {
      params: { question },
    });
  }

  // --- Code ---

  /** Full-text search in source code. */
  async searchCode(query: string): Promise<CodeMatch[]> {
    return this._get<CodeMatch[]>("/api/code/search_code", {
      params: { query },
    });
  }

  /** Search symbols by name pattern. */
  async searchSymbols(query: string): Promise<SymbolMatch[]> {
    return this._get<SymbolMatch[]>("/api/code/search_symbols", {
      params: { query },
    });
  }

  /** Get class hierarchy. */
  async getClassHierarchy(className: string): Promise<ClassHierarchyEntry[]> {
    return this._get<ClassHierarchyEntry[]>("/api/code/get_class_hierarchy", {
      params: { class_name: className },
    });
  }

  /** Get symbol detail. */
  async getSymbolDetail(qualifiedName: string): Promise<SymbolDetail> {
    return this._get<SymbolDetail>("/api/code/get_symbol_detail", {
      params: { qualified_name: qualifiedName },
    });
  }

  /** Get symbol source code. */
  async getSymbolSource(qualifiedName: string): Promise<SymbolSource> {
    return this._get<SymbolSource>("/api/code/get_symbol_source", {
      params: { qualified_name: qualifiedName },
    });
  }

  /** List indexed projects. */
  async listProjects(): Promise<ProjectInfo[]> {
    return this._get<ProjectInfo[]>("/api/code/list_projects", {
      useCache: true,
    });
  }

  // --- Semantic ---

  /** Semantic search over indexed codebase. */
  async askCodebase(question: string): Promise<SemanticMatch[]> {
    return this._get<SemanticMatch[]>("/api/sem/ask_codebase", {
      params: { question },
    });
  }

  /** Fulltext search across all indexed content. */
  async searchFulltext(query: string): Promise<FulltextMatch[]> {
    return this._get<FulltextMatch[]>("/api/sem/search_fulltext", {
      params: { query },
    });
  }

  // --- GitHub ---

  /** List indexed repositories. */
  async listRepositories(): Promise<RepositoryInfo[]> {
    return this._get<RepositoryInfo[]>("/api/gh/list_repositories", {
      useCache: true,
    });
  }

  /** Generic endpoint call — used by the dynamic workbench. */
  async callEndpoint(
    path: string,
    params: Record<string, string>
  ): Promise<unknown> {
    return this._get<unknown>(path, { params });
  }

  clearCache(): void {
    this._cache.clear();
  }

  // --- Private helpers ---

  private async _get<T>(
    path: string,
    options?: { params?: Record<string, string>; useCache?: boolean }
  ): Promise<T> {
    const url = new URL(path, this._baseUrl);
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, v);
      }
    }

    const cacheKey = url.toString();
    if (options?.useCache) {
      const cached = this._cache.get(cacheKey) as
        | CacheEntry<T>
        | undefined;
      if (cached && Date.now() - cached.timestamp < this._cacheTtl) {
        return cached.data;
      }
    }

    const resp = await fetch(url.toString(), {
      headers: this._headers(),
    });
    const body = (await resp.json()) as ApiResponse<T>;
    if (body.error) {
      throw new Error(body.error);
    }

    if (options?.useCache) {
      this._cache.set(cacheKey, { data: body.data, timestamp: Date.now() });
    }
    return body.data;
  }

  private _headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/json",
    };
    if (this._token) {
      h["Authorization"] = `Bearer ${this._token}`;
    }
    return h;
  }
}
