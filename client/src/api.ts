import type { GenerateRequest, HistoryItem, MaskedProvider, ProviderInput } from "../../shared/types";

export interface GenerateResponse {
  systemPrompt: string;
  usage: unknown;
  historyItem: HistoryItem;
}

export type ProviderPayload = ProviderInput | Partial<ProviderInput>;

export interface UpdateCheckResponse {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  error?: string;
}

export interface UpdateApplyResponse extends UpdateCheckResponse {
  status: "latest" | "manual" | "started" | "error";
  message?: string;
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }
  return data as T;
}

export async function apiEmpty(path: string, options: RequestInit = {}): Promise<void> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }
}

export function listProviders(): Promise<MaskedProvider[]> {
  return apiJson<MaskedProvider[]>("/api/providers");
}

export function createProvider(payload: ProviderInput): Promise<MaskedProvider> {
  return apiJson<MaskedProvider>("/api/providers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProvider(id: string, payload: ProviderPayload): Promise<MaskedProvider> {
  return apiJson<MaskedProvider>(`/api/providers/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProvider(id: string): Promise<void> {
  return apiEmpty(`/api/providers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listHistory(): Promise<HistoryItem[]> {
  return apiJson<HistoryItem[]>("/api/history");
}

export function deleteHistoryItem(id: string): Promise<void> {
  return apiEmpty(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function generatePrompt(payload: GenerateRequest): Promise<GenerateResponse> {
  return apiJson<GenerateResponse>("/api/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkUpdate(): Promise<UpdateCheckResponse> {
  return apiJson<UpdateCheckResponse>("/api/update/check");
}

export function applyUpdate(): Promise<UpdateApplyResponse> {
  return apiJson<UpdateApplyResponse>("/api/update/apply", { method: "POST" });
}
