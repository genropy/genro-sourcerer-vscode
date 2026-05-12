/** Definition of a single API parameter (from OpenAPI). */
export interface ParamDef {
  name: string;
  type: "string" | "integer" | "boolean";
  required: boolean;
  default?: unknown;
  enum?: string[];
  title?: string;
}

/** Hint for how to render a response field. */
export type RenderHint =
  | "code"
  | "link"
  | "badge"
  | "docstring"
  | "list"
  | "text";

/** Definition of a single field in the response model. */
export interface ResponseFieldDef {
  name: string;
  type: string;
  renderHint: RenderHint;
}

/** Full definition of a tool (one OpenAPI GET endpoint). */
export interface ToolDef {
  id: string;
  path: string;
  category: string;
  categoryLabel: string;
  categoryIcon: string;
  label: string;
  icon: string;
  description: string;
  params: ParamDef[];
  responseFields: ResponseFieldDef[];
  responseIsArray: boolean;
}
