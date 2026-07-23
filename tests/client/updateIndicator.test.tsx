// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateIndicator } from "../../client/src/components/UpdateIndicator";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.promptForgeUpdater;
});

describe("UpdateIndicator", () => {
  it("shows live NAS wait time and check count while a NAS update is applied", async () => {
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
    expect(screen.getByRole("button", { name: "更新中(18%)" })).toBeInTheDocument();
    expect(screen.getByText("18%")).toBeInTheDocument();
    expect(screen.getByText("更新确认进度")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(screen.getAllByText("等待服务恢复").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "更新中(72%)" })).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("2 秒")).toBeInTheDocument();
    expect(screen.getByText("第 1 次检测")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(screen.getAllByText("更新完成").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "刷新页面" })).toBeInTheDocument();
  });

  it("explains which updater endpoint failed when Watchtower cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.includes("/api/update/check")) {
          return jsonResponse({
            currentVersion: "0.1.8",
            latestVersion: "0.1.9",
            updateAvailable: true,
            releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.1.9",
          });
        }
        if (path.includes("/api/update/apply") && init?.method === "POST") {
          return jsonResponse(
            {
              status: "error",
              error: "无法连接 Watchtower 更新器：请求 http://prompt-forge-updater:8080/v1/update 失败。原始错误：fetch failed",
            },
            502,
          );
        }
        return jsonResponse({ error: "Unexpected request" }, 404);
      }),
    );

    render(<UpdateIndicator />);

    const updateButton = await screen.findByRole("button", { name: /更新到 0.1.9/ });
    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(screen.getByText(/失败位置：Watchtower 更新器/)).toBeInTheDocument();
    expect(screen.getByText(/检查 NAS Docker 项目里的 prompt-forge-updater/)).toBeInTheDocument();
  });

  it("shows the real desktop updater download percent", async () => {
    let statusCallback: ((status: any) => void) | undefined;
    window.promptForgeUpdater = {
      check: vi.fn(async () => ({
        currentVersion: "0.1.8",
        latestVersion: "0.1.9",
        updateAvailable: true,
        releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.1.9",
      })),
      download: vi.fn(
        () =>
          new Promise<any>(() => {
            statusCallback?.({
              currentVersion: "0.1.8",
              latestVersion: "0.1.9",
              updateAvailable: true,
              downloadPercent: 47.4,
              transferred: 47 * 1024 * 1024,
              total: 100 * 1024 * 1024,
              message: "正在下载 47%",
            });
          }),
      ),
      install: vi.fn(async () => undefined),
      onStatus: vi.fn((callback) => {
        statusCallback = callback;
        return () => undefined;
      }),
    };

    render(<UpdateIndicator />);

    const updateButton = await screen.findByRole("button", { name: /更新到 0.1.9/ });
    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(screen.getByText("47%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新中(47%)" })).toBeInTheDocument();
    expect(screen.getByText("下载进度")).toBeInTheDocument();
    expect(screen.getByText(/47 MB \/ 100 MB/)).toBeInTheDocument();
  });

  it("explains GHCR pull interruptions during NAS updates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.includes("/api/update/check")) {
          return jsonResponse({
            currentVersion: "0.1.8",
            latestVersion: "0.1.9",
            updateAvailable: true,
            releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.1.9",
          });
        }
        if (path.includes("/api/update/apply") && init?.method === "POST") {
          return jsonResponse(
            {
              status: "error",
              error:
                'update failed for project prompt-forge: Error response from daemon: Get "https://ghcr.io/v2/": unexpected EOF',
            },
            502,
          );
        }
        return jsonResponse({ error: "Unexpected request" }, 404);
      }),
    );

    render(<UpdateIndicator />);

    const updateButton = await screen.findByRole("button", { name: /更新到 0.1.9/ });
    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(screen.getAllByText(/GHCR 镜像仓库连接中断/).length).toBeGreaterThan(0);
    expect(screen.getByText(/可以稍后再次点击更新/)).toBeInTheDocument();
  });

  it("explains plain 502 responses from the update API gateway", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.includes("/api/update/check")) {
          return jsonResponse({
            currentVersion: "0.1.12",
            latestVersion: "0.1.13",
            updateAvailable: true,
            releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.1.13",
          });
        }
        if (path.includes("/api/update/apply") && init?.method === "POST") {
          return new Response("502 Bad Gateway: upstream disconnected", {
            status: 502,
            headers: { "Content-Type": "text/plain" },
          });
        }
        return jsonResponse({ error: "Unexpected request" }, 404);
      }),
    );

    render(<UpdateIndicator />);

    const updateButton = await screen.findByRole("button", { name: /更新到 0.1.13/ });
    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(screen.getByText(/失败位置：更新 API \/ 服务网关/)).toBeInTheDocument();
    expect(screen.getAllByText(/后端或 NAS 网关返回了 502/).length).toBeGreaterThan(0);
    expect(screen.getByText(/502 Bad Gateway: upstream disconnected/)).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
