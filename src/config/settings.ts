import * as vscode from "vscode";

export interface SourcererSettings {
  apiUrl: string;
  token: string;
  cacheTtlSeconds: number;
}

/**
 * Read current Sourcerer settings from workspace configuration.
 */
export function getSettings(): SourcererSettings {
  const config = vscode.workspace.getConfiguration("sourcerer");
  return {
    apiUrl: config.get<string>("apiUrl", "https://sourcerer.genropy.net"),
    token: config.get<string>("token", ""),
    cacheTtlSeconds: config.get<number>("cacheTtlSeconds", 300),
  };
}
