// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateIndicator } from "../../client/src/components/UpdateIndicator";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("UpdateIndicator", () => {
  it("shows staged progress while a NAS update is applied", async () => {
    let checkCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.includes("/api/update/check")) {
          checkCount += 1;
          if (checkCount === 1) {
            return jsonResponse({
              currentVersion: "0.1.5",
              latestVersion: "0.1.6",
              updateAvailable: true,
              releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.1.6",
            });
          }
          if (checkCount === 2) throw new TypeError("fetch failed");
          return jsonResponse({
            currentVersion: "0.1.6",
            latestVersion: "0.1.6",
            updateAvailable: false,
            releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.1.6",
          });
        }
        if (path.includes("/api/update/apply") && init?.method === "POST") {
          return jsonResponse({
            status: "started",
            currentVersion: "0.1.5",
            latestVersion: "0.1.6",
            updateAvailable: true,
            releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.1.6",
            message: "NAS Docker update has been triggered.",
          });
        }
        return jsonResponse({ error: "Unexpected request" }, 404);
      }),
    );

    render(<UpdateIndicator />);

    const updateButton = await screen.findByRole("button", { name: /更新到 0.1.6/ });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(screen.getAllByText("触发更新器").length).toBeGreaterThan(0);
    expect(screen.getAllByText("拉取新版本").length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(screen.getAllByText("等待服务恢复").length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(screen.getAllByText("更新完成").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "刷新页面" })).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
