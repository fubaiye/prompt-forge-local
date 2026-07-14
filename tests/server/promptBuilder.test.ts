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

  it("frames downstream image tasks as image generation instead of non-generation disclaimers", () => {
    const messages = buildPromptMessages({
      requirement: "参考图1的表达方式及颜色，将图2变成一样的，字体清晰无锯齿",
      providerId: "provider-1",
      generationModel: "qwen3-vl-plus",
      targetModel: "qwen3-vl-72b",
      visionEnabled: true,
      taskCategory: "img2img",
      downstreamModel: "nano-banana-pro-i2i",
    });

    const userText = messageText(messages[1].content);
    expect(userText).toContain("最终目标是生成图像");
    expect(userText).toContain("不得包含否定生图能力");
    expect(userText).toContain("不要写成限制性免责声明");
    expect(userText).not.toContain("不生成图像");
  });

  it("builds multimodal prompt messages for uploaded images", () => {
    const messages = buildPromptMessages({
      requirement: "Reference image 1 style and edit image 2 for Nano Banana.",
      providerId: "provider-1",
      generationModel: "qwen3-vl-plus",
      targetModel: "qwen3-vl-72b",
      visionEnabled: true,
      taskCategory: "img2img",
      downstreamModel: "nano-banana-pro-i2i",
      imageAttachments: [
        {
          id: "image-1",
          name: "style.png",
          mimeType: "image/png",
          size: 68,
          dataUrl: SAMPLE_PNG_DATA_URL,
        },
      ],
    } as any);

    expect(Array.isArray(messages[1].content)).toBe(true);
    expect(messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: expect.stringContaining("图1") }),
        expect.objectContaining({ type: "image_url", image_url: { url: SAMPLE_PNG_DATA_URL, detail: "auto" } }),
      ]),
    );
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

const SAMPLE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function messageText(content: any): string {
  if (typeof content === "string") return content;
  return content.map((part: any) => (part.type === "text" ? part.text : "")).join("\n");
}
