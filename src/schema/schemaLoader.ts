import type { ToolRunner } from "../workbench/workbenchPanel";
import type { ToolDef, ParamDef, ResponseFieldDef, RenderHint } from "./types";

/**
 * Sourcerer-specific defaults. Kept exported so existing callers
 * continue to work, and so a future extraction can drop these
 * without breaking the generic loader.
 */
export const SOURCERER_LOAD_OPTIONS: LoadOptions = {
  schemaPath: "/api/code/openapi_schema",
  pathPrefix: "/api",
  excludedPrefixes: ["admin", "srv"],
  excludedPaths: [
    "/code/openapi_schema",
    "/kb/get_topic_tree",
    "/kb/get_skills",
    "/kb/export_knowledge",
  ],
  categoryLabels: {
    kb: "Knowledge Base",
    code: "Code",
    sem: "Semantic",
    gh: "GitHub",
    ctx: "Contexts",
    impact: "Impact",
    err: "Errors",
    sweeter: "Sweeter",
  },
  envelopeDataKey: undefined,
};

export interface LoadOptions {
  /** Path to fetch the OpenAPI document from. */
  schemaPath: string;
  /** Prefix to prepend to each tool's `path`. Sourcerer uses "/api". */
  pathPrefix: string;
  /** First-path-segment prefixes to skip entirely (e.g. "admin"). */
  excludedPrefixes: string[];
  /** Specific paths to skip (the schema endpoint itself, KB tree ops, etc.). */
  excludedPaths: string[];
  /** Pretty labels for first-path-segment categories. */
  categoryLabels: Record<string, string>;
  /**
   * If set, the loader unwraps `response[envelopeDataKey]` before reading
   * the OpenAPI document. Sourcerer wraps it under `data`; pure OpenAPI
   * endpoints typically don't wrap at all (leave undefined).
   */
  envelopeDataKey?: string;
}

// Category icons are sourced from OpenAPI per-operation extension
// `x-category-icon`. We collect the first non-empty value we encounter
// for each category while iterating paths. Tool icons come from
// `x-icon` on each operation. Missing values mean: no icon rendered.

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
  client: ToolRunner,
  options: LoadOptions = SOURCERER_LOAD_OPTIONS
): Promise<ToolDef[]> {
  const raw = await client.callEndpoint(options.schemaPath, {});
  const doc = options.envelopeDataKey
    ? (raw as Record<string, unknown>)[options.envelopeDataKey]
    : raw;
  const schema = doc as {
    paths: Record<string, Record<string, OpenApiOperation>>;
    $defs?: Record<string, OpenApiSchema>;
  };

  const excludedPaths = new Set(options.excludedPaths);
  const globalDefs = schema.$defs ?? {};
  const tools: ToolDef[] = [];

  for (const [path, methods] of Object.entries(schema.paths)) {
    if (excludedPaths.has(path)) {
      continue;
    }
    const category = path.replace(/^\//, "").split("/")[0];
    if (options.excludedPrefixes.includes(category)) {
      continue;
    }
    const op = methods["get"];
    if (!op) {
      continue; // skip non-GET (write operations)
    }

    const params = parseParams(op.parameters ?? []);
    const { fields, isArray } = parseResponse(op, globalDefs);

    const operationId = op.operationId ?? path;
    tools.push({
      id: operationId,
      path: `${options.pathPrefix}${path}`,
      category,
      categoryLabel: options.categoryLabels[category] ?? category,
      categoryIcon: op["x-category-icon"],
      label: buildLabel(op, options.categoryLabels),
      icon: op["x-icon"],
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

function buildLabel(
  op: OpenApiOperation,
  categoryLabels: Record<string, string>
): string {
  if (op.operationId) {
    const stripped = stripCategoryPrefixGuess(op.operationId, categoryLabels);
    return stripped
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return op.summary?.split(".")[0] ?? "Unknown";
}

function stripCategoryPrefixGuess(
  operationId: string,
  categoryLabels: Record<string, string>
): string {
  const underscore = operationId.indexOf("_");
  if (underscore <= 0) {
    return operationId;
  }
  const head = operationId.slice(0, underscore);
  if (head in categoryLabels) {
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
  "x-icon"?: string;
  "x-category-icon"?: string;
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
