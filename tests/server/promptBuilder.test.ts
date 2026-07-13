import { describe, expect, it } from "vitest";
import { buildPromptMessages } from "../../server/src/services/promptBuilder";

describe("prompt builder", () => {
  it("includes target model capabilities and user requirement", () => {
    const messages = buildPromptMessages({
      requirement: "我要一个小红书美妆种草助手",
      providerId: "provider-1",
      generationModel: "gpt-4o",
      targetModel: "claude-sonnet-5",
      visionEnabled: true,
      taskCategory: "none",
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain("Prompt Engineer");
    expect(messages[1].content).toContain("Claude Sonnet 5");
    expect(messages[1].content).toContain("视觉输入");
    expect(messages[1].content).toContain("小红书美妆种草助手");
  });

  it("adds downstream text-to-image schema guidance", () => {
    const messages = buildPromptMessages({
      requirement: "生成儿童绘本插画提示词助手",
      providerId: "provider-1",
      generationModel: "gpt-4o",
      targetModel: "gpt-4o",
      visionEnabled: false,
      taskCategory: "text2img",
      downstreamModel: "midjourney-v7",
    });

    expect(messages[1].content).toContain("Midjourney V7");
    expect(messages[1].content).toContain("subject");
    expect(messages[1].content).toContain("negative_prompt");
  });

  it("rejects downstream tasks without a downstream model", () => {
    expect(() =>
      buildPromptMessages({
        requirement: "生成图像 prompt",
        providerId: "provider-1",
        generationModel: "gpt-4o",
        targetModel: "gpt-4o",
        visionEnabled: false,
        taskCategory: "text2video",
      }),
    ).toThrow("Downstream model is required");
  });
});
