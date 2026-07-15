export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function assertHttpHeaderSafe(value: string, label: string): string {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 255) {
      throw new Error(
        `${label} 包含中文或全角字符，无法作为 HTTP 请求头发送。请只填写密钥本身，不要包含“API Key：”等标签或中文标点。`,
      );
    }
  }
  return value;
}

export function maskApiKey(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
