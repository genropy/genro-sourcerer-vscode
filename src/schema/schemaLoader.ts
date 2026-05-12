import type { SourcererClient } from "../api/client";
import type { ToolDef, ParamDef, ResponseFieldDef, RenderHint } from "./types";

const EXCLUDED_PREFIXES = ["admin", "srv"];
const EXCLUDED_PATHS = new Set([
  "/code/openapi_schema",
  "/kb/get_topic_tree",
  "/kb/get_skills",
  "/kb/export_knowledge",
]);

const CATEGORY_LABELS: Record<string, string> = {
  kb: "Knowledge Base",
  code: "Code",
  sem: "Semantic",
  gh: "GitHub",
  ctx: "Contexts",
  impact: "Impact",
  err: "Errors",
  sweeter: "Sweeter",
};

const CATEGORY_ICONS: Record<string, string> = {
  kb: "book",
  code: "code",
  sem: "search-fuzzy",
  gh: "github",
  ctx: "layers",
  impact: "pulse",
  err: "bug",
  sweeter: "bell",
};

const TOOL_ICONS: Record<string, string> = {
  ask: "comment-discussion",
  find_skills: "symbol-keyword",
  get_skill_content: "file-text",
  search_code: "search",
  search_symbols: "symbol-method",
  search_modules: "file-directory",
  get_class_hierarchy: "type-hierarchy",
  get_symbol_detail: "symbol-class",
  get_symbol_source: "file-code",
  get_module_source: "file-code",
  get_usage_examples: "references",
  find_usages: "references",
  list_projects: "folder-library",
  list_directory: "list-tree",
  batch_search_code: "list-selection",
  ask_codebase: "hubot",
  search_fulltext: "whole-word",
  find_similar: "sparkle",
  list_repositories: "repo",
  list_branches: "git-branch",
  search_issues: "issues",
  search_pull_requests: "git-pull-request",
  search_commits: "git-commit",
  analyze_impact: "pulse",
  analyze_signature_impact: "symbol-parameter",
  explain_error: "bug",
  get_context: "layers",
  get_context_tree: "list-tree",
  get_hierarchical_context: "indent",
  list_contexts: "layers",
  list_jobs: "tasklist",
  list_job_logs: "history",
  list_tickets: "note",
};

const CODE_FIELDS = new Set([
  "snippet", "document_snippet", "content", "source",
  "source_code", "source_preview", "context", "match_line",
  "code_line", "source_context", "body",
]);
const LINK_FIELDS = new Set(["html_url", "url"]);
const BADGE_FIELDS = new Set(["rank", "similarity"]);
const DOCSTRING_FIELDS = new Set(["docstring", "description", "message"]);
const LIST_FIELDS = new Set(["subclasses", "children", "frames", "callers", "references"]);

/**
 * Fetch the OpenAPI schema and produce a list of ToolDef for the UI.
 * Only GET endpoints are included. Admin/srv/meta endpoints are excluded.
 */
export async function loadToolDefs(
  client: SourcererClient
): Promise<ToolDef[]> {
  const raw = await client.callEndpoint("/api/code/openapi_schema", {});
  const schema = raw as {
    paths: Record<string, Record<string, OpenApiOperation>>;
    $defs?: Record<string, OpenApiSchema>;
  };

  const globalDefs = schema.$defs ?? {};
  const tools: ToolDef[] = [];

  for (const [path, methods] of Object.entries(schema.paths)) {
    if (EXCLUDED_PATHS.has(path)) {
      continue;
    }
    const category = path.replace(/^\//, "").split("/")[0];
    if (EXCLUDED_PREFIXES.includes(category)) {
      continue;
    }
    const op = methods["get"];
    if (!op) {
      continue; // skip non-GET (write operations)
    }

    const params = parseParams(op.parameters ?? []);
    const { fields, isArray } = parseResponse(op, globalDefs);

    const operationId = op.operationId ?? path;
    const iconKey = stripCategoryPrefix(operationId, category);
    tools.push({
      id: operationId,
      path: `/api${path}`,
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category,
      categoryIcon: CATEGORY_ICONS[category] ?? "folder",
      label: buildLabel(op),
      icon: TOOL_ICONS[iconKey] ?? "symbol-method",
      description: op.description ?? op.summary ?? "",
      params,
      responseFields: fields,
      responseIsArray: isArray,
    });
  }

  tools.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) {
      return catCmp;
    }
    return a.label.localeCompare(b.label);
  });

  return tools;
}

function buildLabel(op: OpenApiOperation): string {
  if (op.operationId) {
    const stripped = stripCategoryPrefixGuess(op.operationId);
    return stripped
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return op.summary?.split(".")[0] ?? "Unknown";
}

function stripCategoryPrefix(operationId: string, category: string): string {
  const prefix = `${category}_`;
  return operationId.startsWith(prefix)
    ? operationId.slice(prefix.length)
    : operationId;
}

function stripCategoryPrefixGuess(operationId: string): string {
  const underscore = operationId.indexOf("_");
  if (underscore <= 0) {
    return operationId;
  }
  const head = operationId.slice(0, underscore);
  if (head in CATEGORY_LABELS) {
    return operationId.slice(underscore + 1);
  }
  return operationId;
}

function parseParams(raw: OpenApiParameter[]): ParamDef[] {
  return raw.map((p) => {
    const s = p.schema ?? {};
    let type: ParamDef["type"] = "string";
    let enumValues: string[] | undefined;
    let defaultValue: unknown = undefined;

    if (s.type === "integer") {
      type = "integer";
    } else if (s.type === "boolean") {
      type = "boolean";
    }
    if (s.enum) {
      enumValues = s.enum;
    }
    if (s.default !== undefined && s.default !== null) {
      defaultValue = s.default;
    }

    // Handle anyOf (e.g. string | null)
    if (s.anyOf) {
      for (const option of s.anyOf) {
        if (option.type === "integer") {
          type = "integer";
        }
        if (option.type === "boolean") {
          type = "boolean";
        }
        if (option.enum) {
          enumValues = option.enum;
        }
      }
    }

    return {
      name: p.name,
      type,
      required: p.required ?? false,
      default: defaultValue,
      enum: enumValues,
      title: s.title ?? p.name,
    };
  });
}

function parseResponse(
  op: OpenApiOperation,
  globalDefs: Record<string, OpenApiSchema>
): { fields: ResponseFieldDef[]; isArray: boolean } {
  const content =
    op.responses?.["200"]?.content?.["application/json"]?.schema;
  if (!content) {
    return { fields: [], isArray: false };
  }

  // The envelope is {data: T, meta: object}
  const dataProp = content.properties?.data;
  if (!dataProp) {
    return { fields: [], isArray: false };
  }

  let isArray = false;
  let itemSchema: OpenApiSchema | undefined;

  if (dataProp.type === "array" && dataProp.items) {
    isArray = true;
    itemSchema = resolveRef(dataProp.items, content.$defs ?? globalDefs);
  } else if (dataProp.$ref) {
    itemSchema = resolveRef(dataProp, content.$defs ?? globalDefs);
  } else {
    itemSchema = dataProp;
  }

  if (!itemSchema?.properties) {
    return { fields: [], isArray };
  }

  const fields: ResponseFieldDef[] = [];
  for (const [name, prop] of Object.entries(itemSchema.properties)) {
    fields.push({
      name,
      type: prop.type ?? "string",
      renderHint: inferRenderHint(name),
    });
  }

  return { fields, isArray };
}

function resolveRef(
  schema: OpenApiSchema,
  defs: Record<string, OpenApiSchema>
): OpenApiSchema | undefined {
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop()!;
    return defs[refName];
  }
  return schema;
}

function inferRenderHint(name: string): RenderHint {
  if (CODE_FIELDS.has(name)) {
    return "code";
  }
  if (LINK_FIELDS.has(name)) {
    return "link";
  }
  if (BADGE_FIELDS.has(name)) {
    return "badge";
  }
  if (DOCSTRING_FIELDS.has(name)) {
    return "docstring";
  }
  if (LIST_FIELDS.has(name)) {
    return "list";
  }
  return "text";
}

// --- Minimal OpenAPI type stubs ---

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<
    string,
    { content?: { "application/json"?: { schema?: OpenApiSchema } } }
  >;
}

interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: OpenApiSchema;
}

interface OpenApiSchema {
  type?: string;
  title?: string;
  default?: unknown;
  enum?: string[];
  anyOf?: OpenApiSchema[];
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  $ref?: string;
  $defs?: Record<string, OpenApiSchema>;
}
