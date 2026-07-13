import { describe, expect, it } from "vitest";
import {
  DOWNSTREAM_MODELS,
  TARGET_MODELS,
  getDownstreamModels,
  getTargetModel,
} from "../../shared/modelCatalog";

describe("model catalog", () => {
  it("seeds a rich target model catalog", () => {
    expect(TARGET_MODELS.length).toBeGreaterThanOrEqual(30);
    expect(getTargetModel("gpt-4o")?.vendor).toBe("OpenAI");
    expect(getTargetModel("qwen3-vl-72b")?.vision).toBe(true);
  });

  it("filters downstream models by task category", () => {
    expect(DOWNSTREAM_MODELS.length).toBeGreaterThanOrEqual(60);
    expect(getDownstreamModels("text2img").every((model) => model.category === "text2img")).toBe(true);
    expect(getDownstreamModels("img2video").some((model) => model.label.includes("Veo"))).toBe(true);
  });
});
