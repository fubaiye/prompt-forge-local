import type { ChatMessage, GenerateRequest, ProviderRecord } from "../../../shared/types";
import { assertHttpHeaderSafe } from "../../../shared/validation";

export interface ChatCompletionResult {
  text: string;
  usage: unknown;
}

export async function callChatCompletion(
  provider: ProviderRecord,
  request: GenerateRequest,
  messages: ChatMessage[],
): Promise<ChatCompletionResult> {
  const endpoint = chatCompletionsUrl(provider.baseUrl);
  const apiKey = assertHttpHeaderSafe(provider.apiKey, "API Key");
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.generationModel,
        messages,
        max_tokens: 4096,
        ...temperaturePayload(request.generationModel),
      }),
    });
  } catch (error) {
    throw new Error(providerConnectionError(provider, endpoint, error));
  }

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Provider request failed with ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Provider returned an empty response");
  }

  return { text: text.trim(), usage: data.usage ?? null };
}

function chatCompletionsUrl(baseUrl: string): string {
  const cleaned = baseUrl.replace(/\/+$/, "");
  return /\/chat\/completions$/i.test(cleaned) ? cleaned : `${cleaned}/chat/completions`;
}

function temperaturePayload(model: string): { temperature?: number } {
  return /gpt-?5/i.test(model) ? {} : { temperature: 0.7 };
}

function providerConnectionError(provider: ProviderRecord, endpoint: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return [
    `无法连接 API Provider "${provider.name}"。`,
    `请求地址: ${endpoint}`,
    "请确认 Base URL 是 OpenAI-Compatible 的 /chat/completions 地址，并且当前设备或 NAS 可以访问该域名。",
    `原始错误: ${detail}`,
  ].join(" ");
}
