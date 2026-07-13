// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../client/src/App";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the prompt forge workbench shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.includes("/api/providers")) return jsonResponse([]);
        if (path.includes("/api/history")) return jsonResponse([]);
        if (path.includes("/api/update/check")) {
          return jsonResponse({
            currentVersion: "0.1.0",
            latestVersion: "0.2.0",
            updateAvailable: true,
            releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.2.0",
          });
        }
        return jsonResponse({ error: "Unexpected request" }, 404);
      }),
    );

    render(<App />);

    expect(await screen.findByText("Prompt Forge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /设置 API/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生成 System Prompt/ })).toBeDisabled();
    expect(screen.getByPlaceholderText("搜索模型或厂商")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "结果" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "历史版本" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /更新到 0.2.0/ })).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
