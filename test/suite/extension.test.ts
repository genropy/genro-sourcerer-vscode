import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  test("Extension should be present", () => {
    const ext = vscode.extensions.getExtension(
      "genropy.genro-sourcerer-vscode"
    );
    assert.ok(ext, "Extension not found");
  });

  test("Extension should activate", async () => {
    const ext = vscode.extensions.getExtension(
      "genropy.genro-sourcerer-vscode"
    );
    assert.ok(ext, "Extension not found");
    await ext.activate();
    assert.ok(ext.isActive, "Extension did not activate");
  });
});
