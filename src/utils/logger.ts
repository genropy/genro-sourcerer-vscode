import * as vscode from "vscode";

/**
 * Simple logger wrapping a VSCode OutputChannel.
 */
export class Logger implements vscode.Disposable {
  private readonly _channel: vscode.OutputChannel;

  constructor(name: string) {
    this._channel = vscode.window.createOutputChannel(name);
  }

  info(message: string): void {
    this._channel.appendLine(`[INFO] ${message}`);
  }

  warn(message: string): void {
    this._channel.appendLine(`[WARN] ${message}`);
  }

  error(message: string): void {
    this._channel.appendLine(`[ERROR] ${message}`);
  }

  dispose(): void {
    this._channel.dispose();
  }
}
