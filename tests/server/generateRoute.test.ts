import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express, { type Express } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGenerateRouter } from "../../server/src/routes/generate";
import { createHistoryStore } from "../../server/src/storage/historyStore";
import { createProviderStore } from "../../server/src/storage/providerStore";

let tempDir = "";

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("generate route", () => {
  it("calls the configured provider and saves history", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const providers = createProviderStore(tempDir);
    const history = createHistoryStore(tempDir);
    const provider = await providers.create({
      name: "Test",
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test-1234567890",
      models: ["gpt-4o"],
      defaultModel: "gpt-4o",
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "SYSTEM PROMPT RESULT" } }],
        usage: { total_tokens: 42 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(express.json());
    app.use("/api/generate", createGenerateRouter(providers, history));

    const response = await requestJson(app, "/api/generate", {
      requirement: "写一个客服机器人",
      providerId: provider.id,
      generationModel: "gpt-4o",
      targetModel: "gpt-4o",
      visionEnabled: false,
      taskCategory: "none",
    });

    expect(response.status).toBe(200);
    expect(response.body.systemPrompt).toBe("SYSTEM PROMPT RESULT");
    expect(response.body.usage.total_tokens).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sk-test-1234567890" }),
      }),
    );
    expect((await history.list()).length).toBe(1);
  });

  it("rejects short requirements before calling providers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const providers = createProviderStore(tempDir);
    const history = createHistoryStore(tempDir);
    const provider = await providers.create({
      name: "Test",
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test-1234567890",
      models: ["gpt-4o"],
      defaultModel: "gpt-4o",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(express.json());
    app.use("/api/generate", createGenerateRouter(providers, history));

    const response = await requestJson(app, "/api/generate", {
      requirement: "客服",
      providerId: provider.id,
      generationModel: "gpt-4o",
      targetModel: "gpt-4o",
      visionEnabled: false,
      taskCategory: "none",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("at least 4");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

async function requestJson(app: Express, path: string, body: unknown): Promise<{ status: number; body: any }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    return await new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: text ? JSON.parse(text) : null,
            });
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
