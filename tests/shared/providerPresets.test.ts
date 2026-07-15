import { describe, expect, it } from "vitest";
import { PROVIDER_PRESETS } from "../../shared/providerPresets";

describe("provider presets", () => {
  it("includes common OpenAI-compatible channels", () => {
    expect(PROVIDER_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining([
        "google-ai-studio",
        "openrouter",
        "dashscope",
        "deepseek",
        "siliconflow-cn",
        "volcengine-ark",
      ]),
    );
  });

  it("uses base URLs that can be expanded to chat completions endpoints", () => {
    for (const preset of PROVIDER_PRESETS) {
      expect(preset.baseUrl).toMatch(/^https:\/\//);
      expect(preset.models.length).toBeGreaterThan(0);
      expect(preset.defaultModel).toBe(preset.models[0]);
      expect(preset.baseUrl).not.toMatch(/\/chat\/completions$/);
    }
  });

  it("offers OpenRouter as a Gemini fallback channel", () => {
    const preset = PROVIDER_PRESETS.find((item) => item.id === "openrouter");

    expect(preset?.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(preset?.models).toContain("google/gemini-2.5-pro");
  });
});
