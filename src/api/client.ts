import {
  ApiResponse,
  TopicTree,
  SkillSummary,
  Skill,
  AskResult,
  HealthResponse,
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

  /** Get the full topic tree. */
  async getTopicTree(): Promise<TopicTree> {
    return this._get<TopicTree>("/api/kb/topic_tree", { useCache: true });
  }

  /** Get skills for a given topic. */
  async getSkills(topicName: string): Promise<SkillSummary[]> {
    return this._get<SkillSummary[]>("/api/kb/skills", {
      params: { topic: topicName },
      useCache: true,
    });
  }

  /** Get full skill content by ID. */
  async getSkillContent(skillId: string): Promise<Skill> {
    return this._get<Skill>("/api/kb/skill_content", {
      params: { skill_id: skillId },
      useCache: true,
    });
  }

  /** Semantic triage query. */
  async ask(question: string): Promise<AskResult> {
    return this._post<AskResult>("/api/kb/ask", { question });
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
    if (!body.ok) {
      throw new Error(body.error ?? `API error: ${resp.status}`);
    }

    if (options?.useCache) {
      this._cache.set(cacheKey, { data: body.result, timestamp: Date.now() });
    }
    return body.result;
  }

  private async _post<T>(
    path: string,
    payload: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(path, this._baseUrl);
    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...this._headers(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = (await resp.json()) as ApiResponse<T>;
    if (!body.ok) {
      throw new Error(body.error ?? `API error: ${resp.status}`);
    }
    return body.result;
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
