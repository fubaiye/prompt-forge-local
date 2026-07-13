import { describe, expect, it, vi, afterEach } from "vitest";
import { callChatCompletion } from "../../server/src/services/openAiCompatible";
import type { GenerateRequest, ProviderRecord } from "../../shared/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const request: GenerateRequest = {
  requirement: "write a short prompt",
  providerId: "provider-1",
  generationModel: "qwen3-vl-plus",
  targetModel: "gpt-4o",
  visionEnabled: false,
  taskCategory: "none",
};

const providerBase: Omit<ProviderRecord, "baseUrl"> = {
  id: "provider-1",
  name: "DashScope",
  apiKey: "sk-test",
  models: ["qwen3-vl-plus"],
  defaultModel: "qwen3-vl-plus",
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
};

describe("openAI compatible provider calls", () => {
  it("uses a complete chat completions endpoint without appending the path twice", async () => {
    const fetchMock = mockSuccessfulFetch();

    await callChatCompletion(
      {
        ...providerBase,
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      },
      request,
      [{ role: "user", content: "ping" }],
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      expect.any(Object),
    );
  });
});

function mockSuccessfulFetch() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "ok" } }],
      usage: { total_tokens: 1 },
    }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
