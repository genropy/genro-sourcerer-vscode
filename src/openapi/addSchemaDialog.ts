import * as vscode from "vscode";
import type { AuthConfig, OpenApiSchemaConfig } from "./types";

/**
 * Walk the user through registering a new OpenAPI schema:
 *  1. name (display label)
 *  2. schema URL (where to fetch the OpenAPI document)
 *  3. base URL (where API calls are sent; defaults to schema URL's origin)
 *  4. auth type (none / bearer / apiKey)
 *  5. auth value (and header name if apiKey)
 *
 * Returns the new config, or undefined if the user cancelled.
 */
export async function promptForSchemaConfig(): Promise<
  OpenApiSchemaConfig | undefined
> {
  const name = await vscode.window.showInputBox({
    prompt: "Schema name (display label)",
    placeHolder: "e.g. GitHub API",
    validateInput: (v) => (v.trim() ? undefined : "Name is required"),
  });
  if (!name) return undefined;

  const schemaUrl = await vscode.window.showInputBox({
    prompt: "OpenAPI document URL (JSON)",
    placeHolder: "https://api.example.com/openapi.json",
    validateInput: validateUrl,
  });
  if (!schemaUrl) return undefined;

  const defaultBase = deriveOrigin(schemaUrl);
  const url = await vscode.window.showInputBox({
    prompt: "Base URL for API calls",
    value: defaultBase,
    validateInput: validateUrl,
  });
  if (!url) return undefined;

  const authType = await vscode.window.showQuickPick(
    [
      { label: "None", value: "none" },
      { label: "Bearer token", value: "bearer" },
      { label: "API key (header)", value: "apiKey" },
    ],
    { placeHolder: "Authentication type" }
  );
  if (!authType) return undefined;

  let auth: AuthConfig;
  if (authType.value === "none") {
    auth = { type: "none" };
  } else if (authType.value === "bearer") {
    const value = await vscode.window.showInputBox({
      prompt: "Bearer token",
      password: true,
      validateInput: (v) => (v ? undefined : "Token is required"),
    });
    if (!value) return undefined;
    auth = { type: "bearer", value };
  } else {
    const header = await vscode.window.showInputBox({
      prompt: "API key header name",
      value: "X-API-Key",
      validateInput: (v) => (v.trim() ? undefined : "Header is required"),
    });
    if (!header) return undefined;
    const value = await vscode.window.showInputBox({
      prompt: "API key value",
      password: true,
      validateInput: (v) => (v ? undefined : "Value is required"),
    });
    if (!value) return undefined;
    auth = { type: "apiKey", header, value };
  }

  return {
    id: slugify(name),
    name,
    url,
    schemaUrl,
    auth,
  };
}

function validateUrl(v: string): string | undefined {
  try {
    new URL(v);
    return undefined;
  } catch {
    return "Invalid URL";
  }
}

function deriveOrigin(urlStr: string): string {
  try {
    return new URL(urlStr).origin;
  } catch {
    return "";
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
