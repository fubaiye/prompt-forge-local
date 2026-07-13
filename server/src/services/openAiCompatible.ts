import type { ChatMessage, GenerateRequest, ProviderRecord } from "../../../shared/types";

export interface ChatCompletionResult {
  text: string;
  usage: unknown;
}

export async function callChatCompletion(
  provider: ProviderRecord,
  request: GenerateRequest,
  messages: ChatMessage[],
): Promise<ChatCompletionResult> {
  const response = await fetch(chatCompletionsUrl(provider.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: request.generationModel,
      messages,
      max_tokens: 4096,
      ...temperaturePayload(request.generationModel),
    }),
  });

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
