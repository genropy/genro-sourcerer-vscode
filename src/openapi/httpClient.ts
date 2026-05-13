import type { ToolRunner } from "../workbench/workbenchPanel";
import type { AuthConfig } from "./types";

/**
 * Generic HTTP client for OpenAPI schemas. Implements `ToolRunner`
 * (so it can drive the Workbench directly) and a `fetchJson` helper
 * used to load the OpenAPI document itself.
 *
 * Supports two auth schemes:
 *   - `bearer` -> `Authorization: Bearer <value>`
 *   - `apiKey` -> `<header>: <value>`
 *
 * No response envelope unwrapping: returns whatever the server sends.
 */
export class GenericHttpClient implements ToolRunner {
  constructor(
    private readonly _baseUrl: string,
    private readonly _auth: AuthConfig
  ) {}

  /**
   * Fetch and parse a JSON document at the given absolute URL.
   *
   * The schema document often lives on a different host than the API
   * (e.g. GitHub's OpenAPI is on raw.githubusercontent.com while the
   * API is on api.github.com). We deliberately do NOT send the API
   * auth headers here, because:
   *   - the schema URL is usually public;
   *   - some hosts reject unexpected Authorization headers with 404.
   * Only `Accept: application/json` is sent, and we tolerate other
   * content types (raw.githubusercontent.com serves text/plain).
   */
  async fetchJson(url: string): Promise<unknown> {
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      throw new Error(
        `HTTP ${resp.status} ${resp.statusText} on ${url}`
      );
    }
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(
        `Failed to parse JSON from ${url}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Call an API endpoint with query parameters. `path` is appended to
   * `baseUrl`. The Workbench passes `params: Record<string, string>`
   * which we turn into URL query parameters.
   */
  async callEndpoint(
    path: string,
    params: Record<string, string>
  ): Promise<unknown> {
    // WHATWG URL would treat an absolute `path` as replacing the
    // base URL's pathname entirely, dropping any path segment of
    // the base URL (e.g. "/api/v3"). Join manually to preserve it.
    const trimmedBase = this._baseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(trimmedBase + normalizedPath);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const resp = await fetch(url.toString(), { headers: this._headers() });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(
        `HTTP ${resp.status} ${resp.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`
      );
    }
    return resp.json();
  }

  private _headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this._auth.type === "bearer") {
      h["Authorization"] = `Bearer ${this._auth.value}`;
    } else if (this._auth.type === "apiKey") {
      h[this._auth.header] = this._auth.value;
    }
    return h;
  }
}
