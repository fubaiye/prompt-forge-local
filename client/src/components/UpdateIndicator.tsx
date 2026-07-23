import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { applyUpdate, checkUpdate, type UpdateCheckResponse } from "../api";

type UpdateStatus = "checking" | "idle" | "available" | "applying" | "complete" | "error";
type UpdatePhase = "triggering" | "pulling" | "restarting" | "complete" | "manual" | "error";
type UpdateProgressSource = "desktop" | "nas" | "manual";

interface UpdateProgress {
  phase: UpdatePhase;
  source: UpdateProgressSource;
  targetVersion?: string;
  message: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  elapsedSeconds?: number;
  checks?: number;
  issue?: UpdateIssue;
}

interface UpdateIssue {
  location: string;
  reason: string;
  suggestion: string;
  rawMessage: string;
  percent?: number;
}

interface DesktopUpdateCheck {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  message?: string;
  downloadPercent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
}

interface DesktopUpdater {
  check(): Promise<DesktopUpdateCheck>;
  download(): Promise<DesktopUpdateCheck>;
  install(): Promise<void>;
  onStatus?(callback: (status: DesktopUpdateCheck) => void): () => void;
}

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

const NAS_PROGRESS_STEPS: Array<{ phase: UpdatePhase; label: string }> = [
  { phase: "triggering", label: "触发更新器" },
  { phase: "pulling", label: "拉取新版本" },
  { phase: "restarting", label: "等待服务恢复" },
  { phase: "complete", label: "更新完成" },
];

declare global {
  interface Window {
    promptForgeUpdater?: DesktopUpdater;
  }
}

export function UpdateIndicator() {
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const [update, setUpdate] = useState<UpdateCheckResponse | null>(null);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = window.promptForgeUpdater?.onStatus?.((nextStatus) => {
      if (!cancelled) {
        const desktopProgress = desktopProgressFromStatus(nextStatus);
        setUpdate(normalizeDesktopUpdate(nextStatus));
        if (desktopProgress) {
          setProgress(desktopProgress);
          setStatus(desktopProgress.phase === "complete" ? "complete" : "applying");
        } else {
          setStatus(nextStatus.updateAvailable ? "available" : "idle");
        }
        setMessage(nextStatus.message ?? "");
      }
    });

    void refresh(cancelled);

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function refresh(cancelled = false) {
    setStatus("checking");
    setMessage("");
    try {
      const nextUpdate = window.promptForgeUpdater
        ? normalizeDesktopUpdate(await window.promptForgeUpdater.check())
        : await checkUpdate();
      if (cancelled) return;
      setUpdate(nextUpdate);
      setStatus(nextUpdate.updateAvailable ? "available" : "idle");
      if (!nextUpdate.updateAvailable) setProgress(null);
    } catch (error) {
      if (cancelled) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "检查更新失败");
    }
  }

  async function handleUpdate() {
    if (!update?.updateAvailable) {
      await refresh();
      return;
    }

    setStatus("applying");
    setMessage("");
    setProgress({
      phase: "triggering",
      source: window.promptForgeUpdater ? "desktop" : "nas",
      targetVersion: update.latestVersion,
      percent: window.promptForgeUpdater ? 0 : nasPercentForPhase("triggering"),
      elapsedSeconds: window.promptForgeUpdater ? undefined : 0,
      checks: window.promptForgeUpdater ? undefined : 0,
      message: `正在触发更新到 ${update.latestVersion ?? "最新版本"}。`,
    });

    try {
      if (window.promptForgeUpdater) {
        setProgress({
          phase: "pulling",
          source: "desktop",
          targetVersion: update.latestVersion,
          percent: 0,
          message: "正在下载安装包，完成后应用会自动安装。",
        });
        await window.promptForgeUpdater.download();
        setProgress({
          phase: "complete",
          source: "desktop",
          targetVersion: update.latestVersion,
          percent: 100,
          message: "安装包已下载，正在准备重启应用。",
        });
        await window.promptForgeUpdater.install();
        return;
      }

      const result = await applyUpdate();
      setMessage(result.message ?? "");
      if (result.status === "manual" && result.releaseUrl) {
        setProgress({
          phase: "manual",
          source: "manual",
          targetVersion: result.latestVersion,
          message: "当前环境未配置自动更新，已打开 GitHub Release 页面，请手动下载更新。",
        });
        window.open(result.releaseUrl, "_blank", "noopener,noreferrer");
        setStatus("available");
        return;
      }
      if (result.status === "latest") {
        setProgress({
          phase: "complete",
          source: "manual",
          targetVersion: result.latestVersion,
          percent: 100,
          message: `当前已经是最新版本 ${result.currentVersion}。`,
        });
        setUpdate(result);
        setStatus("complete");
        return;
      }
      if (result.status === "started") {
        setProgress({
          phase: "pulling",
          source: "nas",
          targetVersion: result.latestVersion,
          percent: nasPercentForPhase("pulling"),
          elapsedSeconds: 0,
          checks: 0,
          message: "更新器已收到请求，正在等待 NAS Docker 完成拉取、替换容器和版本确认。",
        });
        await waitForUpdateCompletion(result.latestVersion);
        return;
      }
      setStatus("available");
    } catch (error) {
      const issue = describeUpdateError(error);
      setStatus("error");
      setMessage(issue.reason);
      setProgress({
        phase: "error",
        source: window.promptForgeUpdater ? "desktop" : "nas",
        targetVersion: update.latestVersion,
        percent: issue.percent ?? 0,
        message: issue.reason,
        issue,
      });
    }
  }

  async function waitForUpdateCompletion(targetVersion: string | undefined) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      await delay(POLL_INTERVAL_MS);
      try {
        const nextUpdate = await checkUpdate();
        setUpdate(nextUpdate);
        if (targetVersion && isCurrentVersion(nextUpdate, targetVersion)) {
          setProgress({
            phase: "complete",
            source: "nas",
            targetVersion,
            percent: 100,
            elapsedSeconds: elapsedSecondsForAttempt(attempt),
            checks: attempt + 1,
            message: `已更新到 ${targetVersion}，刷新页面后即可使用新版本。`,
          });
          setStatus("complete");
          return;
        }
        const nextPhase = attempt < 2 ? "pulling" : "restarting";
        setProgress({
          phase: nextPhase,
          source: "nas",
          targetVersion,
          percent: nasPercentForAttempt(nextPhase, attempt),
          elapsedSeconds: elapsedSecondsForAttempt(attempt),
          checks: attempt + 1,
          message: `仍检测到旧版本 ${nextUpdate.currentVersion}。如果 NAS 正在拉取镜像，这是正常等待；若长时间停住，请查看 prompt-forge-updater 日志。`,
        });
      } catch {
        setProgress({
          phase: "restarting",
          source: "nas",
          targetVersion,
          percent: nasPercentForAttempt("restarting", attempt),
          elapsedSeconds: elapsedSecondsForAttempt(attempt),
          checks: attempt + 1,
          message: "服务正在重启或网络暂时不可达，正在继续等待恢复。",
        });
      }
    }
    throw new Error(`等待服务恢复超时：已检测 ${MAX_POLL_ATTEMPTS} 次仍未确认目标版本。请查看 NAS Docker 项目日志，重点检查 prompt-forge 与 prompt-forge-updater 容器。`);
  }

  if (status === "idle" || (status === "checking" && !update)) return null;

  const label =
    status === "checking"
      ? "检查更新"
      : status === "applying"
        ? typeof progress?.percent === "number"
          ? `更新中(${Math.round(clampPercent(progress.percent))}%)`
          : "更新中..."
        : status === "error"
          ? update?.updateAvailable
            ? "重试更新"
            : "更新异常"
          : status === "complete"
            ? "更新完成"
            : `更新到 ${update?.latestVersion}`;

  return (
    <div className="update-indicator">
      <button
        className={status === "available" ? "update-button available" : "update-button"}
        type="button"
        onClick={handleUpdate}
        disabled={status === "applying"}
        title={message || label}
      >
        {status === "complete" ? (
          <CheckCircle2 size={15} />
        ) : status === "applying" || status === "checking" ? (
          <RefreshCw size={15} />
        ) : (
          <Download size={15} />
        )}
        {label}
      </button>
      {progress && (
        <UpdateProgressPanel
          progress={progress}
          onRefresh={() => window.location.reload()}
          showRefresh={status === "complete"}
        />
      )}
    </div>
  );
}

function normalizeDesktopUpdate(update: DesktopUpdateCheck): UpdateCheckResponse {
  return {
    currentVersion: update.currentVersion,
    latestVersion: update.latestVersion,
    updateAvailable: update.updateAvailable,
    releaseUrl: update.releaseUrl,
  };
}

function desktopProgressFromStatus(update: DesktopUpdateCheck): UpdateProgress | null {
  if (typeof update.downloadPercent !== "number") return null;

  const percent = clampPercent(update.downloadPercent);
  return {
    phase: percent >= 100 ? "complete" : "pulling",
    source: "desktop",
    targetVersion: update.latestVersion,
    percent,
    transferred: update.transferred,
    total: update.total,
    bytesPerSecond: update.bytesPerSecond,
    message: update.message ?? `正在下载 ${Math.round(percent)}%`,
  };
}

function describeUpdateError(error: unknown): UpdateIssue {
  const rawMessage = error instanceof Error ? error.message : "更新失败";
  const normalized = rawMessage.toLowerCase();

  if (rawMessage.includes("无法连接 Watchtower 更新器") || normalized.includes("prompt-forge-updater")) {
    return {
      location: "Watchtower 更新器",
      reason: "应用已经尝试触发 NAS 自动更新，但没有连上 Watchtower HTTP API。",
      suggestion: "检查 NAS Docker 项目里的 prompt-forge-updater 容器是否正在运行、项目内服务名是否仍为 prompt-forge-updater，并确认 8080 端口和 HTTP API 已启用。",
      rawMessage,
      percent: nasPercentForPhase("triggering"),
    };
  }

  if (rawMessage.includes("Watchtower 更新器鉴权失败") || normalized.includes("401") || normalized.includes("403")) {
    return {
      location: "Watchtower 更新器鉴权",
      reason: "Watchtower 收到了更新请求，但拒绝了当前 token。",
      suggestion: "检查 docker-compose.nas.yml 中 PROMPT_FORGE_UPDATE_WEBHOOK_TOKEN 和 WATCHTOWER_HTTP_API_TOKEN 是否完全一致，然后重新部署项目。",
      rawMessage,
      percent: nasPercentForPhase("triggering"),
    };
  }

  if (normalized.includes("ghcr.io") && normalized.includes("unexpected eof")) {
    return {
      location: "GHCR 镜像仓库",
      reason: "GHCR 镜像仓库连接中断：NAS 在拉取 Docker 镜像时下载流提前断开。",
      suggestion: "可以稍后再次点击更新；如果仍失败，在 NAS Docker 项目里重新部署，或导入 Release 里的 linux-amd64 本地镜像 tar。",
      rawMessage,
      percent: nasPercentForPhase("pulling"),
    };
  }

  if (
    normalized.includes("ghcr.io") &&
    (normalized.includes("client.timeout") ||
      normalized.includes("request canceled") ||
      normalized.includes("waiting for connection"))
  ) {
    return {
      location: "GHCR 镜像仓库",
      reason: "NAS 访问 GitHub Container Registry 超时或连接不稳定。",
      suggestion: "稍后重试；如果 NAS 网络到 ghcr.io 不稳定，优先下载 Release 的 linux-amd64 本地镜像 tar 后在 Docker 中导入。",
      rawMessage,
      percent: nasPercentForPhase("pulling"),
    };
  }

  if (normalized.includes("waiting service") || rawMessage.includes("等待服务恢复超时")) {
    return {
      location: "服务恢复检测",
      reason: "更新已触发，但应用一直没有检测到目标版本上线。",
      suggestion: "查看 NAS Docker 项目日志，重点检查 prompt-forge 容器是否被替换、prompt-forge-updater 是否有拉取镜像失败记录。",
      rawMessage,
      percent: 92,
    };
  }

  if (normalized.includes("error response from daemon") || normalized.includes("docker")) {
    return {
      location: "Docker 引擎",
      reason: "Docker 在拉取、创建或替换容器时返回错误。",
      suggestion: "打开 NAS Docker 项目日志，查看 daemon 原始错误；常见原因是镜像拉取失败、存储空间不足或 docker.sock 权限异常。",
      rawMessage,
      percent: nasPercentForPhase("pulling"),
    };
  }

  if (
    normalized.includes("request failed with 502") ||
    normalized.includes("bad gateway") ||
    normalized.includes("/api/update/apply")
  ) {
    return {
      location: "更新 API / 服务网关",
      reason: "后端或 NAS 网关返回了 502，更新请求没有进入可正常返回诊断信息的服务路径。",
      suggestion: "先查看 prompt-forge 容器日志和 NAS Docker 项目事件；如果日志里没有更新请求，重点检查 NAS 的反向代理、端口映射和容器是否刚好在重启。",
      rawMessage,
      percent: nasPercentForPhase("triggering"),
    };
  }

  return {
    location: "更新流程",
    reason: "更新请求没有完成，应用收到一个未分类错误。",
    suggestion: "保留下面的原始错误，再重试一次；如果重复出现，请查看 NAS Docker 项目日志。",
    rawMessage,
    percent: 0,
  };
}

function UpdateProgressPanel({
  progress,
  onRefresh,
  showRefresh,
}: {
  progress: UpdateProgress;
  onRefresh(): void;
  showRefresh: boolean;
}) {
  const percent = typeof progress.percent === "number" ? clampPercent(progress.percent) : undefined;
  const metric = progressMetric(progress);
  return (
    <div className={progress.phase === "error" ? "update-progress-panel error" : "update-progress-panel"} role="status" aria-live="polite">
      <div className="update-progress-heading">
        <strong>{progressTitle(progress.phase)}</strong>
        {progress.targetVersion && <span>目标版本 {progress.targetVersion}</span>}
      </div>
      {metric && (
        <div className="update-progress-metric">
          <strong>{metric.value}</strong>
          <span>{metric.label}</span>
          {metric.detail && <small>{metric.detail}</small>}
        </div>
      )}
      {progress.source === "nas" && progress.phase !== "error" && progress.phase !== "complete" && (
        <div className="update-progress-facts">
          {typeof progress.elapsedSeconds === "number" && <span>{formatElapsed(progress.elapsedSeconds)}</span>}
          {typeof progress.checks === "number" && <span>第 {progress.checks} 次检测</span>}
          <span>Watchtower 执行镜像拉取</span>
        </div>
      )}
      <div className={percent === undefined ? "update-progress-bar indeterminate" : "update-progress-bar"} aria-hidden="true">
        <span style={percent === undefined ? undefined : { width: `${percent}%` }} />
      </div>
      <ol className="update-progress-steps">
        {NAS_PROGRESS_STEPS.map((step) => (
          <li key={step.phase} className={stepClass(step.phase, progress.phase)}>
            <span />
            {step.label}
          </li>
        ))}
      </ol>
      {progress.issue && <UpdateDiagnostics issue={progress.issue} />}
      <p>{progress.message}</p>
      {showRefresh && (
        <button type="button" className="secondary-action update-refresh-action" onClick={onRefresh}>
          刷新页面
        </button>
      )}
    </div>
  );
}

function UpdateDiagnostics({ issue }: { issue: UpdateIssue }) {
  return (
    <div className="update-diagnostics">
      <strong>失败位置：{issue.location}</strong>
      <span>{issue.reason}</span>
      <span>建议：{issue.suggestion}</span>
      <small>原始错误：{issue.rawMessage}</small>
    </div>
  );
}

function progressTitle(phase: UpdatePhase): string {
  if (phase === "manual") return "需要手动更新";
  if (phase === "error") return "更新异常";
  return NAS_PROGRESS_STEPS.find((step) => step.phase === phase)?.label ?? "更新中";
}

function progressMetric(progress: UpdateProgress): { value: string; label: string; detail?: string } | null {
  if (typeof progress.percent === "number") {
    const nasDetail = progress.source === "nas" ? "此百分比来自触发、版本检测和服务恢复状态；Watchtower 不提供镜像字节流。" : undefined;
    return {
      value: `${Math.round(clampPercent(progress.percent))}%`,
      label:
        progress.source === "desktop" && progress.phase !== "complete"
          ? "下载进度"
          : progress.source === "nas" && progress.phase !== "complete"
            ? "更新确认进度"
            : "完成进度",
      detail: progress.transferred && progress.total ? `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}` : nasDetail,
    };
  }

  if (typeof progress.elapsedSeconds === "number") {
    return {
      value: formatElapsed(progress.elapsedSeconds),
      label: `第 ${progress.checks ?? 0} 次检测`,
      detail: "NAS Docker 镜像拉取进度由 Watchtower 执行，应用会用版本检测确认完成。",
    };
  }

  return null;
}

function nasPercentForPhase(phase: UpdatePhase): number {
  if (phase === "triggering") return 8;
  if (phase === "pulling") return 18;
  if (phase === "restarting") return 72;
  if (phase === "complete") return 100;
  return 0;
}

function nasPercentForAttempt(phase: UpdatePhase, attempt: number): number {
  if (phase === "pulling") return Math.min(58, 28 + attempt * 10);
  if (phase === "restarting") return Math.min(92, 72 + Math.max(0, attempt - 1) * 3);
  return nasPercentForPhase(phase);
}

function stepClass(step: UpdatePhase, current: UpdatePhase): string {
  const stepIndex = NAS_PROGRESS_STEPS.findIndex((item) => item.phase === step);
  const currentIndex = NAS_PROGRESS_STEPS.findIndex((item) => item.phase === current);
  if (current === "error" || current === "manual") return "";
  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "active";
  return "";
}

function isCurrentVersion(update: UpdateCheckResponse, targetVersion: string): boolean {
  return normalizeVersion(update.currentVersion) === normalizeVersion(targetVersion);
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function elapsedSecondsForAttempt(attempt: number): number {
  return Math.round(((attempt + 1) * POLL_INTERVAL_MS) / 1000);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes} 分钟` : `${minutes} 分 ${remainingSeconds} 秒`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
