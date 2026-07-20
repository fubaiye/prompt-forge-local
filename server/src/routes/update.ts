import { spawn } from "node:child_process";
import { Router } from "express";
import { APP_VERSION, GITHUB_REPOSITORY } from "../../../shared/appMetadata";
import { isNewerVersion, stripVersionPrefix } from "../../../shared/version";

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  name?: string;
}

export interface UpdateRouterOptions {
  currentVersion?: string;
  repository?: string;
  updateCommand?: string;
  updateWebhookUrl?: string;
  updateWebhookToken?: string;
  fetchLatestRelease?: (repository: string) => Promise<GitHubRelease>;
  fetchUpdateWebhook?: typeof fetch;
}

export function createUpdateRouter(options: UpdateRouterOptions = RouterDefaultOptions) {
  const router = Router();
  const currentVersion = options.currentVersion ?? process.env.PROMPT_FORGE_VERSION ?? process.env.npm_package_version ?? APP_VERSION;
  const repository = options.repository ?? process.env.PROMPT_FORGE_GITHUB_REPO ?? GITHUB_REPOSITORY;
  const fetchLatestRelease = options.fetchLatestRelease ?? fetchGitHubLatestRelease;
  const updateCommand = options.updateCommand ?? process.env.PROMPT_FORGE_UPDATE_COMMAND;
  const updateWebhookUrl = options.updateWebhookUrl ?? process.env.PROMPT_FORGE_UPDATE_WEBHOOK_URL;
  const updateWebhookToken = options.updateWebhookToken ?? process.env.PROMPT_FORGE_UPDATE_WEBHOOK_TOKEN;
  const fetchUpdateWebhook = options.fetchUpdateWebhook ?? fetch;

  router.get("/check", async (_req, res) => {
    try {
      const release = await fetchLatestRelease(repository);
      res.json(toUpdateCheck(release, currentVersion));
    } catch (error) {
      res.status(502).json({
        currentVersion,
        updateAvailable: false,
        error: error instanceof Error ? error.message : "检查更新失败",
      });
    }
  });

  router.post("/apply", async (_req, res) => {
    try {
      const release = await fetchLatestRelease(repository);
      const check = toUpdateCheck(release, currentVersion);

      if (!check.updateAvailable) {
        res.json({ status: "latest", ...check });
        return;
      }

      if (updateWebhookUrl) {
        await callUpdateWebhook(fetchUpdateWebhook, updateWebhookUrl, updateWebhookToken, check);
        res.json({ status: "started", message: "NAS Docker update has been triggered.", ...check });
        return;
      }

      if (!updateCommand) {
        res.json({
          status: "manual",
          message: "NAS 自动更新命令未配置，请打开发布页手动更新或设置 PROMPT_FORGE_UPDATE_COMMAND。",
          ...check,
        });
        return;
      }

      const child = spawn(updateCommand, {
        shell: true,
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          PROMPT_FORGE_TARGET_VERSION: check.latestVersion,
          PROMPT_FORGE_RELEASE_URL: check.releaseUrl ?? "",
        },
      });
      child.unref();

      res.json({ status: "started", message: "更新命令已启动。", ...check });
    } catch (error) {
      res.status(502).json({ status: "error", error: error instanceof Error ? error.message : "启动更新失败" });
    }
  });

  return router;
}

const RouterDefaultOptions: UpdateRouterOptions = {};

async function callUpdateWebhook(
  fetcher: typeof fetch,
  url: string,
  token: string | undefined,
  check: ReturnType<typeof toUpdateCheck>,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        targetVersion: check.latestVersion,
        releaseUrl: check.releaseUrl ?? "",
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`无法连接 Watchtower 更新器：请求 ${url} 失败。请检查 prompt-forge-updater 容器是否运行、服务名是否可解析、HTTP API 端口是否为 8080。原始错误：${detail}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Watchtower 更新器鉴权失败：请求 ${url} 返回 ${response.status}。请检查 PROMPT_FORGE_UPDATE_WEBHOOK_TOKEN 是否与 WATCHTOWER_HTTP_API_TOKEN 一致。${detail ? `原始响应：${detail}` : ""}`,
      );
    }
    throw new Error(
      `Watchtower 更新器请求失败：请求 ${url} 返回 ${response.status}。请查看 prompt-forge-updater 容器日志。${detail ? `原始响应：${detail}` : ""}`,
    );
  }
}

function toUpdateCheck(release: GitHubRelease, currentVersion: string) {
  const latestVersion = stripVersionPrefix(release.tag_name);

  return {
    currentVersion,
    latestVersion,
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    releaseUrl: release.html_url,
  };
}

async function fetchGitHubLatestRelease(repository: string): Promise<GitHubRelease> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "prompt-forge-local-update-check",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub release check failed with ${response.status}`);
  }

  return (await response.json()) as GitHubRelease;
}
