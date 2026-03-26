import * as vscode from "vscode";
import type { SourcererClient } from "../api/client";
import type { ClassHierarchyEntry } from "../api/types";
import { SearchResultsPanel } from "../tools/searchResultsPanel";
import { DetailPanel, escapeHtml } from "../tools/detailPanel";
import { SourcePanel } from "../tools/sourcePanel";

/**
 * Register all Code-related commands.
 */
export function registerCodeCommands(
  context: vscode.ExtensionContext,
  client: SourcererClient
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sourcerer.searchCode", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search in source code",
        placeHolder: "e.g. def main, import os, class MyHandler...",
      });
      if (!query) {
        return;
      }
      try {
        const results = await client.searchCode(query);
        if (results.length === 0) {
          vscode.window.showInformationMessage("No code matches found.");
          return;
        }
        SearchResultsPanel.show(
          query,
          results.map((m) => ({
            title: `${m.repo_name}/${m.module_path}:${m.lineno}`,
            subtitle: m.match_line.trim(),
            code: m.context,
          }))
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Search code failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand("sourcerer.searchSymbols", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search symbols (classes, functions, methods)",
        placeHolder: "e.g. GnrWebPage, formulaColumn...",
      });
      if (!query) {
        return;
      }
      try {
        const results = await client.searchSymbols(query);
        if (results.length === 0) {
          vscode.window.showInformationMessage("No symbols found.");
          return;
        }
        const picked = await vscode.window.showQuickPick(
          results.map((s) => ({
            label: s.name,
            description: `${s.kind} — ${s.repo_name}/${s.module_path}:${s.lineno}`,
            detail: s.signature ?? "",
            qualifiedName: s.qualified_name,
          })),
          { placeHolder: "Select a symbol to view source" }
        );
        if (picked) {
          try {
            const source = await client.getSymbolSource(picked.qualifiedName);
            SourcePanel.show(
              picked.qualifiedName,
              source.source,
              picked.description ?? undefined
            );
          } catch {
            vscode.window.showErrorMessage(
              `Could not load source for ${picked.qualifiedName}`
            );
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `Search symbols failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand("sourcerer.classHierarchy", async () => {
      const className = await vscode.window.showInputBox({
        prompt: "Enter class name",
        placeHolder: "e.g. GnrWebPage, BaseComponent...",
      });
      if (!className) {
        return;
      }
      try {
        const entries = await client.getClassHierarchy(className);
        if (entries.length === 0) {
          vscode.window.showInformationMessage("Class not found.");
          return;
        }
        const body = renderClassHierarchy(className, entries);
        DetailPanel.show(`Class Hierarchy: ${className}`, body);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Class hierarchy failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand("sourcerer.symbolDetail", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter qualified symbol name",
        placeHolder: "e.g. GnrWebPage, Table.config_db...",
      });
      if (!name) {
        return;
      }
      try {
        const detail = await client.getSymbolDetail(name);
        const kindBadge = detail.kind === "class" ? "badge-class"
          : detail.kind === "function" ? "badge-function"
          : detail.kind === "method" ? "badge-method"
          : "badge-module";

        let bodyHtml = `<h1>${escapeHtml(detail.qualified_name)} <span class="badge ${kindBadge}">${escapeHtml(detail.kind)}</span></h1>`;

        bodyHtml += `<div class="meta-row"><span class="meta-label">Module</span><span class="meta-value">${escapeHtml(detail.repo_name)}/${escapeHtml(detail.module_path)}:${detail.lineno}-${detail.end_lineno}</span></div>`;

        if (detail.signature) {
          bodyHtml += `<div class="meta-row"><span class="meta-label">Signature</span><span class="mono">${escapeHtml(detail.signature)}</span></div>`;
        }
        if (detail.bases) {
          bodyHtml += `<div class="meta-row"><span class="meta-label">Bases</span><span class="mono">${escapeHtml(detail.bases)}</span></div>`;
        }
        if (detail.decorators) {
          bodyHtml += `<div class="meta-row"><span class="meta-label">Decorators</span><span class="mono">${escapeHtml(detail.decorators)}</span></div>`;
        }
        if (detail.docstring) {
          bodyHtml += `<h2>Docstring</h2><div class="docstring">${escapeHtml(detail.docstring)}</div>`;
        }

        DetailPanel.show(detail.qualified_name, bodyHtml);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Symbol detail failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand("sourcerer.symbolSource", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter qualified symbol name",
        placeHolder: "e.g. GnrWebPage, Table.config_db...",
      });
      if (!name) {
        return;
      }
      try {
        const result = await client.getSymbolSource(name);
        SourcePanel.show(name, result.source);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Symbol source failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }),

    vscode.commands.registerCommand("sourcerer.listProjects", async () => {
      try {
        const projects = await client.listProjects();
        if (projects.length === 0) {
          vscode.window.showInformationMessage("No indexed projects found.");
          return;
        }
        const picked = await vscode.window.showQuickPick(
          projects.map((p) => ({
            label: p.project_name,
            description: `${p.project_type} — ${p.repo_name}`,
            detail: `Packages: ${p.n_packages} | Modules: ${p.n_modules} | Symbols: ${p.n_symbols}`,
          })),
          { placeHolder: "Indexed projects" }
        );
        if (picked) {
          vscode.window.showInformationMessage(
            `${picked.label}: ${picked.detail}`
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `List projects failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );
}

function renderClassHierarchy(
  className: string,
  entries: ClassHierarchyEntry[]
): string {
  let html = `<h1>Class Hierarchy: ${escapeHtml(className)}</h1>`;

  for (const entry of entries) {
    html += `<div class="class-node">`;
    html += `<div class="class-header">${escapeHtml(entry.qualified_name)}</div>`;
    html += `<div class="class-body">`;
    html += `<div class="meta-row"><span class="meta-label">Bases</span><span class="mono">${escapeHtml(entry.bases || "none")}</span></div>`;
    html += `<div class="meta-row"><span class="meta-label">Module</span><span class="path">${escapeHtml(entry.repo_name)}/${escapeHtml(entry.module_path)}</span></div>`;

    if (entry.subclasses && entry.subclasses.length > 0) {
      html += `<div class="meta-row"><span class="meta-label">Subclasses</span></div>`;
      html += `<ul class="subclass-list">`;
      for (const sub of entry.subclasses) {
        html += `<li><span class="mono">${escapeHtml(sub.qualified_name)}</span> <span class="path">(${escapeHtml(sub.repo_name)}/${escapeHtml(sub.module_path)})</span></li>`;
      }
      html += `</ul>`;
    }

    html += `</div></div>`;
  }

  return html;
}
