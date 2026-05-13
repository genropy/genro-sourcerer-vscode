import * as vscode from "vscode";
import { loadToolDefs, type LoadOptions } from "../schema/schemaLoader";
import { GenericHttpClient } from "./httpClient";
import type { OpenApiSchemaConfig, OpenApiSchemaInstance } from "./types";

const SETTINGS_KEY = "openapi.schemas";

/**
 * In-memory registry of registered OpenAPI schemas, backed by VSCode
 * configuration (`openapi.schemas`). Loads each schema's OpenAPI
 * document on demand and parses it into `ToolDef[]` via the generic
 * `loadToolDefs`.
 */
export class SchemaRegistry {
  private _instances: Map<string, OpenApiSchemaInstance> = new Map();
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  /** Read the schemas list from settings and (re)load every schema. */
  async refresh(): Promise<void> {
    const configs = this._readConfigs();
    const next = new Map<string, OpenApiSchemaInstance>();
    for (const cfg of configs) {
      const existing = this._instances.get(cfg.id);
      const instance: OpenApiSchemaInstance =
        existing && configEquals(existing.config, cfg)
          ? existing
          : { config: cfg, tools: [] };
      next.set(cfg.id, instance);
    }
    this._instances = next;

    // Load tools for fresh / unloaded instances in parallel
    await Promise.all(
      Array.from(this._instances.values())
        .filter((i) => i.tools.length === 0 && !i.loadError)
        .map((i) => this._loadInstance(i))
    );

    this._onDidChange.fire();
  }

  /** Reload a single schema's tools (e.g. after the user clicks Reload). */
  async reload(schemaId: string): Promise<void> {
    const instance = this._instances.get(schemaId);
    if (!instance) return;
    instance.tools = [];
    instance.loadError = undefined;
    await this._loadInstance(instance);
    this._onDidChange.fire();
  }

  list(): OpenApiSchemaInstance[] {
    return Array.from(this._instances.values());
  }

  get(schemaId: string): OpenApiSchemaInstance | undefined {
    return this._instances.get(schemaId);
  }

  async addSchema(config: OpenApiSchemaConfig): Promise<void> {
    const configs = this._readConfigs().filter((c) => c.id !== config.id);
    configs.push(config);
    await this._writeConfigs(configs);
    await this.refresh();
  }

  async removeSchema(schemaId: string): Promise<void> {
    const configs = this._readConfigs().filter((c) => c.id !== schemaId);
    await this._writeConfigs(configs);
    await this.refresh();
  }

  private _readConfigs(): OpenApiSchemaConfig[] {
    const raw = vscode.workspace
      .getConfiguration()
      .get<OpenApiSchemaConfig[]>(SETTINGS_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  private async _writeConfigs(
    configs: OpenApiSchemaConfig[]
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration()
      .update(SETTINGS_KEY, configs, vscode.ConfigurationTarget.Global);
  }

  private async _loadInstance(
    instance: OpenApiSchemaInstance
  ): Promise<void> {
    try {
      const client = new GenericHttpClient(
        instance.config.url,
        instance.config.auth
      );
      const doc = await client.fetchJson(instance.config.schemaUrl);
      // Inline-fetch the document, then drive loadToolDefs through a
      // synthetic ToolRunner that just returns the already-fetched doc.
      const fakeRunner = {
        async callEndpoint(): Promise<unknown> {
          return doc;
        },
      };
      const options: LoadOptions = {
        schemaPath: "irrelevant", // fakeRunner ignores it
        pathPrefix: "",
        excludedPrefixes: [],
        excludedPaths: [],
        categoryLabels: {},
        envelopeDataKey: undefined,
      };
      instance.tools = await loadToolDefs(fakeRunner, options);
      instance.loadError = undefined;
    } catch (err) {
      instance.tools = [];
      instance.loadError =
        err instanceof Error ? err.message : String(err);
    }
  }
}

function configEquals(
  a: OpenApiSchemaConfig,
  b: OpenApiSchemaConfig
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
