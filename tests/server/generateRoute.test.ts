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

  it("sends uploaded images as multimodal content and stores only summaries", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const providers = createProviderStore(tempDir);
    const history = createHistoryStore(tempDir);
    const provider = await providers.create({
      name: "Vision Test",
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test-1234567890",
      models: ["qwen3-vl-plus"],
      defaultModel: "qwen3-vl-plus",
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "VISION SYSTEM PROMPT" } }],
        usage: { total_tokens: 64 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(express.json({ limit: "50mb" }));
    app.use("/api/generate", createGenerateRouter(providers, history));

    const response = await requestJson(app, "/api/generate", {
      requirement: "Use image 1 style and transform image 2 for Nano Banana.",
      providerId: provider.id,
      generationModel: "qwen3-vl-plus",
      targetModel: "qwen3-vl-72b",
      visionEnabled: true,
      taskCategory: "img2img",
      downstreamModel: "nano-banana-pro-i2i",
      imageAttachments: [
        {
          id: "image-1",
          name: "reference.png",
          mimeType: "image/png",
          size: 68,
          dataUrl: SAMPLE_PNG_DATA_URL,
        },
      ],
    });

    expect(response.status).toBe(200);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as any)[1]?.body));
    const userContent = body.messages[1].content;
    expect(Array.isArray(userContent)).toBe(true);
    expect(userContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: expect.stringContaining("图1") }),
        expect.objectContaining({ type: "image_url", image_url: { url: SAMPLE_PNG_DATA_URL, detail: "auto" } }),
      ]),
    );

    const items = await history.list();
    expect((items[0] as any).imageAttachments).toEqual([
      { id: "image-1", name: "reference.png", mimeType: "image/png", size: 68 },
    ]);
  });

  it("accepts a single uploaded image up to the 20MB per-image limit", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const providers = createProviderStore(tempDir);
    const history = createHistoryStore(tempDir);
    const provider = await providers.create({
      name: "Vision Test",
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test-1234567890",
      models: ["qwen3-vl-plus"],
      defaultModel: "qwen3-vl-plus",
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "LARGE IMAGE PROMPT" } }],
        usage: { total_tokens: 96 },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(express.json({ limit: "50mb" }));
    app.use("/api/generate", createGenerateRouter(providers, history));

    const imageBytes = 9 * 1024 * 1024;
    const response = await requestJson(app, "/api/generate", {
      requirement: "Use this uploaded reference image to improve the prompt.",
      providerId: provider.id,
      generationModel: "qwen3-vl-plus",
      targetModel: "qwen3-vl-72b",
      visionEnabled: true,
      taskCategory: "img2img",
      downstreamModel: "nano-banana-pro-i2i",
      imageAttachments: [
        {
          id: "large-image",
          name: "large-reference.png",
          mimeType: "image/png",
          size: imageBytes,
          dataUrl: pngDataUrl(imageBytes),
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.systemPrompt).toBe("LARGE IMAGE PROMPT");
    expect(fetchMock).toHaveBeenCalledOnce();
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

  it("rejects unsupported image attachments before calling providers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const providers = createProviderStore(tempDir);
    const history = createHistoryStore(tempDir);
    const provider = await providers.create({
      name: "Test",
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test-1234567890",
      models: ["qwen3-vl-plus"],
      defaultModel: "qwen3-vl-plus",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(express.json({ limit: "50mb" }));
    app.use("/api/generate", createGenerateRouter(providers, history));

    const response = await requestJson(app, "/api/generate", {
      requirement: "Use the uploaded reference image to improve this prompt.",
      providerId: provider.id,
      generationModel: "qwen3-vl-plus",
      targetModel: "qwen3-vl-72b",
      visionEnabled: true,
      taskCategory: "none",
      imageAttachments: [
        {
          id: "bad",
          name: "notes.txt",
          mimeType: "text/plain",
          size: 12,
          dataUrl: "data:text/plain;base64,aGVsbG8=",
        },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Unsupported image type");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects spoofed image data before calling providers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const providers = createProviderStore(tempDir);
    const history = createHistoryStore(tempDir);
    const provider = await providers.create({
      name: "Test",
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test-1234567890",
      models: ["qwen3-vl-plus"],
      defaultModel: "qwen3-vl-plus",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(express.json({ limit: "50mb" }));
    app.use("/api/generate", createGenerateRouter(providers, history));

    const response = await requestJson(app, "/api/generate", {
      requirement: "Use the uploaded reference image to improve this prompt.",
      providerId: provider.id,
      generationModel: "qwen3-vl-plus",
      targetModel: "qwen3-vl-72b",
      visionEnabled: true,
      taskCategory: "none",
      imageAttachments: [
        {
          id: "spoof",
          name: "fake.png",
          mimeType: "image/png",
          size: 5,
          dataUrl: "data:image/png;base64,aGVsbG8=",
        },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("does not match image type");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const SAMPLE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function pngDataUrl(size: number): string {
  const bytes = Buffer.alloc(size);
  bytes.set(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

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
