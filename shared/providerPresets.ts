export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  badge: string;
  description: string;
  keyHint: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "google-ai-studio",
    name: "Google AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
    defaultModel: "gemini-2.5-pro",
    badge: "Gemini",
    description: "Google 官方 OpenAI-Compatible 通道。NAS 需要能访问 Google API 域名。",
    keyHint: "使用 AI Studio 生成的 API key。",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["google/gemini-2.5-pro", "google/gemini-2.5-flash", "openai/gpt-4o", "anthropic/claude-sonnet-4"],
    defaultModel: "google/gemini-2.5-pro",
    badge: "聚合",
    description: "统一调用 Google、OpenAI、Anthropic 等模型。适合作为 Gemini 直连失败时的备用通道。",
    keyHint: "需要 OpenRouter 自己的 API key，不能使用 AI Studio key。",
  },
  {
    id: "dashscope",
    name: "阿里云百炼 DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen3-vl-plus", "qwen-plus", "qwen-max", "qwen-long"],
    defaultModel: "qwen3-vl-plus",
    badge: "国内",
    description: "阿里云 OpenAI-Compatible 通道，适合国内网络和视觉模型。",
    keyHint: "使用阿里云百炼 API Key。",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-v4-pro",
    badge: "推理",
    description: "DeepSeek 官方 OpenAI-Compatible 通道，适合文本提示词优化。",
    keyHint: "使用 DeepSeek 平台 API key。",
  },
  {
    id: "siliconflow-cn",
    name: "SiliconFlow 中国站",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["Qwen/Qwen2.5-VL-72B-Instruct", "deepseek-ai/DeepSeek-V3", "zai-org/GLM-5.1"],
    defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    badge: "国内",
    description: "硅基流动国内 OpenAI-Compatible 通道，可选择多家开源模型。",
    keyHint: "使用 SiliconFlow 中国站 API key。",
  },
  {
    id: "siliconflow-global",
    name: "SiliconFlow Global",
    baseUrl: "https://api.siliconflow.com/v1",
    models: ["Qwen/Qwen2.5-VL-72B-Instruct", "deepseek-ai/DeepSeek-V3", "zai-org/GLM-5.1"],
    defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    badge: "Global",
    description: "硅基流动国际站 OpenAI-Compatible 通道。",
    keyHint: "使用 SiliconFlow 国际站 API key。",
  },
  {
    id: "volcengine-ark",
    name: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: ["doubao-1-5-pro-32k-250115", "doubao-1-5-lite-32k-250115", "doubao-seed-1-6-250615"],
    defaultModel: "doubao-1-5-pro-32k-250115",
    badge: "国内",
    description: "火山方舟 OpenAI-Compatible V3 通道，模型 ID 以控制台接入点为准。",
    keyHint: "使用火山方舟 API key。",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4.5v", "glm-4.5", "glm-4-flash"],
    defaultModel: "glm-4.5v",
    badge: "国内",
    description: "智谱 OpenAI-Compatible 通道，可用于 GLM 文本和视觉模型。",
    keyHint: "使用智谱开放平台 API key。",
  },
  {
    id: "moonshot",
    name: "Moonshot / Kimi",
    baseUrl: "https://api.moonshot.ai/v1",
    models: ["kimi-k2.5", "kimi-k2", "moonshot-v1-128k"],
    defaultModel: "kimi-k2.5",
    badge: "长上下文",
    description: "Kimi OpenAI-Compatible 通道，适合长文本需求整理。",
    keyHint: "使用 Moonshot / Kimi 平台 API key。",
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    models: ["MiniMax-M3", "MiniMax-Text-01"],
    defaultModel: "MiniMax-M3",
    badge: "多模态",
    description: "MiniMax OpenAI-Compatible 通道，MiniMax-M3 支持视觉输入。",
    keyHint: "使用 MiniMax 平台 API key。",
  },
];
