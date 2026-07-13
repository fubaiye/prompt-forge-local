export type ModelFamily = "open" | "closed";

export type TaskCategory = "none" | "text2img" | "img2img" | "edit" | "text2video" | "img2video";

export interface TargetModel {
  value: string;
  label: string;
  vendor: string;
  vision: boolean;
  reasoning?: boolean;
  tag?: string;
  family: ModelFamily;
}

export interface DownstreamModel {
  value: string;
  label: string;
  category: Exclude<TaskCategory, "none">;
  vendor: string;
  tag?: string;
  family: ModelFamily;
}

export interface ProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  defaultModel?: string;
}

export interface ProviderRecord extends ProviderInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaskedProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  models: string[];
  defaultModel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateRequest {
  requirement: string;
  providerId: string;
  generationModel: string;
  targetModel: string;
  visionEnabled: boolean;
  taskCategory: TaskCategory;
  downstreamModel?: string;
}

export interface HistoryItem extends GenerateRequest {
  id: string;
  systemPrompt: string;
  createdAt: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
