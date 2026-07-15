import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProviderStore } from "../../server/src/storage/providerStore";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("provider store", () => {
  it("masks API keys when listing providers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const store = createProviderStore(tempDir);
    const provider = await store.create({
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1/",
      apiKey: "sk-test-1234567890",
      models: ["openai/gpt-4o"],
      defaultModel: "openai/gpt-4o",
    });

    const list = await store.listMasked();
    const raw = await store.get(provider.id);

    expect(raw?.apiKey).toBe("sk-test-1234567890");
    expect(provider.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect("apiKey" in list[0]).toBe(false);
    expect(list[0].apiKeyMasked).toBe("sk-t••••7890");
  });

  it("updates providers without requiring a new API key", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const store = createProviderStore(tempDir);
    const provider = await store.create({
      name: "Local",
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "ollama-local-key",
      models: ["qwen3"],
      defaultModel: "qwen3",
    });

    const updated = await store.update(provider.id, {
      name: "Local Ollama",
      baseUrl: "http://127.0.0.1:11434/v1/",
      models: ["qwen3", "deepseek-r1"],
      defaultModel: "deepseek-r1",
    });

    expect(updated.name).toBe("Local Ollama");
    expect(updated.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(updated.apiKey).toBe("ollama-local-key");
    expect(updated.models).toEqual(["qwen3", "deepseek-r1"]);
  });

  it("rejects API keys containing full-width punctuation", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const store = createProviderStore(tempDir);

    await expect(
      store.create({
        name: "Gemini",
        baseUrl: "https://example.test/v1",
        apiKey: "API Key：sk-test",
        models: ["gemini-3.5-pro"],
        defaultModel: "gemini-3.5-pro",
      }),
    ).rejects.toThrow("API Key 包含中文或全角字符");
  });
});
