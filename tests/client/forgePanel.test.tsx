// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateRequest, MaskedProvider } from "../../shared/types";
import { ForgePanel } from "../../client/src/components/ForgePanel";

const provider: MaskedProvider = {
  id: "provider-google",
  name: "Gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  apiKeyMasked: "sk-***",
  models: ["gemini-2.5-flash-image", "gemini-2.5-pro"],
  defaultModel: "gemini-2.5-flash-image",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

const baseForm: GenerateRequest = {
  requirement: "参考图1的表达方式及颜色，将图2变成一样的，字体清晰无锯齿",
  providerId: provider.id,
  generationModel: "gemini-2.5-flash-image",
  targetModel: "gpt-4o",
  visionEnabled: true,
  taskCategory: "text2img",
  downstreamModel: "nano-banana-pro",
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ForgePanel configuration layout", () => {
  it("keeps header, section navigation and action bar outside the scroll area", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "参数配置" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "配置分区" });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "需求描述" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("configuration-scroll-area")).toBeInTheDocument();
    expect(screen.getByTestId("configuration-action-bar")).toContainElement(
      screen.getByRole("button", { name: "生成 System Prompt" }),
    );
  });

  it("collapses model settings by default and expands them from the summary row", () => {
    renderPanel();

    expect(screen.getByText("Gemini · gemini-2.5-flash-image")).toBeInTheDocument();
    expect(screen.queryByLabelText("API Provider")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /展开模型设置/ }));

    expect(screen.getByLabelText("API Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("调用模型")).toBeInTheDocument();
  });

  it("expands and focuses model settings when generation fails from provider configuration", async () => {
    renderPanel({ generationError: "fetch failed" });

    const modelInput = await screen.findByLabelText("调用模型");
    await waitFor(() => expect(modelInput).toHaveFocus());
  });

  it("scrolls to a section from the navigation and respects reduced motion", () => {
    vi.mocked(matchMedia).mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    renderPanel();
    const nav = screen.getByRole("navigation", { name: "配置分区" });

    fireEvent.click(within(nav).getByRole("button", { name: "参考图片" }));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(within(nav).getByRole("button", { name: "参考图片" })).toHaveAttribute("aria-current", "true");
  });

  it("submits with Ctrl or Cmd Enter but ignores IME composition", () => {
    const onGenerate = vi.fn();
    renderPanel({ onGenerate });

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true, isComposing: true });
    expect(onGenerate).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("keeps the disabled reason inside the fixed action bar", () => {
    renderPanel({
      canGenerate: false,
      form: {
        ...baseForm,
        requirement: "",
      },
    });

    const actionBar = screen.getByTestId("configuration-action-bar");
    expect(within(actionBar).getByText("至少输入 4 个字。")).toBeInTheDocument();
  });

  it("uses a compact image grid after images have been uploaded", () => {
    renderPanel({
      form: {
        ...baseForm,
        imageAttachments: [
          {
            id: "image-1",
            name: "reference.png",
            mimeType: "image/png",
            size: 1024,
            dataUrl: "data:image/png;base64,iVBORw0KGgo=",
          },
        ],
      },
    });

    expect(screen.getByRole("img", { name: "图1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除图1" })).toBeInTheDocument();
    expect(screen.getByText("添加图片")).toBeInTheDocument();
    expect(screen.queryByText("点击或拖拽上传图片")).not.toBeInTheDocument();
  });
});

function renderPanel(overrides: Partial<Parameters<typeof ForgePanel>[0]> = {}) {
  const props: Parameters<typeof ForgePanel>[0] = {
    form: baseForm,
    providers: [provider],
    selectedProvider: provider,
    downstreamOptions: [],
    canGenerate: true,
    isGenerating: false,
    onChange: vi.fn(),
    onGenerate: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  return render(<ForgePanel {...props} />);
}
