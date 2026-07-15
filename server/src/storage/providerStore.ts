import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { MaskedProvider, ProviderInput, ProviderRecord } from "../../../shared/types";
import { assertHttpHeaderSafe, isNonEmptyString, maskApiKey, normalizeBaseUrl } from "../../../shared/validation";
import { createJsonFileStore } from "./jsonFileStore";

export interface ProviderUpdateInput {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
  defaultModel?: string;
}

export interface ProviderStore {
  create(input: ProviderInput): Promise<ProviderRecord>;
  update(id: string, input: ProviderUpdateInput): Promise<ProviderRecord>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<ProviderRecord | undefined>;
  listRaw(): Promise<ProviderRecord[]>;
  listMasked(): Promise<MaskedProvider[]>;
}

export function createProviderStore(dataDir: string): ProviderStore {
  const store = createJsonFileStore<ProviderRecord[]>(join(dataDir, "providers.json"), []);

  return {
    async create(input) {
      const cleaned = cleanCreateInput(input);
      const now = new Date().toISOString();
      const record: ProviderRecord = {
        id: randomUUID(),
        ...cleaned,
        createdAt: now,
        updatedAt: now,
      };
      const providers = await store.read();
      providers.unshift(record);
      await store.write(providers);
      return record;
    },

    async update(id, input) {
      const providers = await store.read();
      const index = providers.findIndex((provider) => provider.id === id);
      if (index < 0) throw new Error("Provider not found");

      const current = providers[index];
      const next: ProviderRecord = {
        ...current,
        name: cleanOptionalString(input.name, current.name),
        baseUrl: input.baseUrl === undefined ? current.baseUrl : normalizeBaseUrl(requiredString(input.baseUrl, "baseUrl")),
        apiKey: input.apiKey && input.apiKey.trim().length > 0 ? cleanApiKey(input.apiKey) : current.apiKey,
        models: input.models === undefined ? current.models : cleanModels(input.models),
        defaultModel: cleanDefaultModel(input.defaultModel, input.models ?? current.models, current.defaultModel),
        updatedAt: new Date().toISOString(),
      };

      providers[index] = next;
      await store.write(providers);
      return next;
    },

    async delete(id) {
      const providers = await store.read();
      await store.write(providers.filter((provider) => provider.id !== id));
    },

    async get(id) {
      const providers = await store.read();
      return providers.find((provider) => provider.id === id);
    },

    async listRaw() {
      return store.read();
    },

    async listMasked() {
      const providers = await store.read();
      return providers.map(toMaskedProvider);
    },
  };
}

function cleanCreateInput(input: ProviderInput): ProviderInput {
  const models = cleanModels(input.models);
  return {
    name: requiredString(input.name, "name"),
    baseUrl: normalizeBaseUrl(requiredString(input.baseUrl, "baseUrl")),
    apiKey: cleanApiKey(input.apiKey),
    models,
    defaultModel: cleanDefaultModel(input.defaultModel, models),
  };
}

function cleanApiKey(value: unknown): string {
  return assertHttpHeaderSafe(requiredString(value, "apiKey"), "API Key");
}

function cleanModels(models: string[]): string[] {
  if (!Array.isArray(models)) throw new Error("models must be an array");
  const cleaned = Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
  if (cleaned.length === 0) throw new Error("At least one model is required");
  return cleaned;
}

function cleanDefaultModel(defaultModel: string | undefined, models: string[], fallback?: string): string {
  const candidate = defaultModel?.trim() || fallback?.trim() || models[0];
  return models.includes(candidate) ? candidate : models[0];
}

function cleanOptionalString(value: string | undefined, fallback: string): string {
  return value === undefined ? fallback : requiredString(value, "name");
}

function requiredString(value: unknown, field: string): string {
  if (!isNonEmptyString(value)) throw new Error(`${field} is required`);
  return value.trim();
}

function toMaskedProvider(provider: ProviderRecord): MaskedProvider {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKeyMasked: maskApiKey(provider.apiKey),
    models: provider.models,
    defaultModel: provider.defaultModel,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}
