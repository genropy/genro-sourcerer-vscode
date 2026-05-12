import type { ResponseFieldDef } from "../schema/types";

const TITLE_FIELDS = [
  "title", "name", "qualified_name", "full_name",
  "project_name", "branch_name",
];

/**
 * Render API result data as HTML cards using response field definitions.
 */
export function renderResults(
  data: unknown,
  fields: ResponseFieldDef[]
): string {
  if (data === null || data === undefined) {
    return '<div class="empty">No data.</div>';
  }
  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) {
    return '<div class="empty">No results.</div>';
  }
  return items.map((item) => renderCard(item, fields)).join("");
}

function renderCard(
  item: Record<string, unknown>,
  fields: ResponseFieldDef[]
): string {
  const header = findTitle(item);
  let body = "";

  for (const field of fields) {
    const value = item[field.name];
    if (value === null || value === undefined || value === "") {
      continue;
    }
    // Skip field if it was used as the header
    if (TITLE_FIELDS.includes(field.name) && String(value) === header) {
      continue;
    }
    body += renderField(field, value);
  }

  return `<div class="card"><div class="card-header">${esc(header)}</div>${body}</div>`;
}

function findTitle(item: Record<string, unknown>): string {
  for (const key of TITLE_FIELDS) {
    if (item[key] && typeof item[key] === "string") {
      return item[key] as string;
    }
  }
  // Fallback: first string value
  for (const v of Object.values(item)) {
    if (typeof v === "string" && v.length > 0 && v.length < 120) {
      return v;
    }
  }
  return "Result";
}

function renderField(
  field: ResponseFieldDef,
  value: unknown
): string {
  switch (field.renderHint) {
    case "code":
      return `<div class="card-body">${renderCode(value)}</div>`;
    case "link":
      return `<div class="card-sub"><a class="link" href="${esc(String(value))}">${esc(String(value))}</a></div>`;
    case "badge":
      return `<span class="badge-inline">${esc(field.name)}: ${formatBadge(value)}</span> `;
    case "docstring":
      return `<div class="docstring">${esc(String(value))}</div>`;
    case "list":
      return renderList(field.name, value);
    default:
      return `<div class="detail-row"><span class="detail-label">${esc(field.name)}</span><span class="detail-value">${esc(String(value))}</span></div>`;
  }
}

function renderCode(value: unknown): string {
  const text = String(value);
  // If it contains <mark> tags from the server, pass them through
  if (text.includes("<mark>")) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/&lt;mark&gt;/g, "<mark>")
      .replace(/&lt;\/mark&gt;/g, "</mark>");
  }
  return esc(text);
}

function formatBadge(value: unknown): string {
  const num = Number(value);
  if (!isNaN(num) && num <= 1) {
    return `${(num * 100).toFixed(0)}%`;
  }
  return String(value);
}

function renderList(name: string, value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return "";
  }
  const items = value
    .map((v) => {
      if (typeof v === "string") {
        return `<li>${esc(v)}</li>`;
      }
      if (typeof v === "object" && v !== null) {
        const label =
          (v as Record<string, unknown>).qualified_name ??
          (v as Record<string, unknown>).name ??
          JSON.stringify(v);
        return `<li>${esc(String(label))}</li>`;
      }
      return `<li>${esc(String(v))}</li>`;
    })
    .join("");
  return `<div class="detail-row"><span class="detail-label">${esc(name)}</span></div><ul class="subclass-list">${items}</ul>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
