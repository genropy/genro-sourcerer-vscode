import type { ToolDef } from "../schema/types";

/** Auth configuration for a registered OpenAPI schema. */
export type AuthConfig =
  | { type: "none" }
  | { type: "bearer"; value: string }
  | { type: "apiKey"; header: string; value: string };

/** Persisted configuration of one OpenAPI schema. */
export interface OpenApiSchemaConfig {
  /** Stable id used in commands and tree node ids. Slug-friendly. */
  id: string;
  /** Display name shown in the tree. */
  name: string;
  /** Base URL for actual API calls. */
  url: string;
  /** Full URL of the OpenAPI document (JSON or YAML). */
  schemaUrl: string;
  /** Auth applied to every request to this schema. */
  auth: AuthConfig;
}

/** Runtime state of a registered schema (config + loaded tools). */
export interface OpenApiSchemaInstance {
  config: OpenApiSchemaConfig;
  /** Tools loaded from the schema document. Empty until first load. */
  tools: ToolDef[];
  /** Last error encountered while loading, if any. */
  loadError?: string;
}
