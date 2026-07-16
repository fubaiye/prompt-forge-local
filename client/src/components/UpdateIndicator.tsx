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
      percent: window.promptForgeUpdater ? 0 : undefined,
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
          elapsedSeconds: 0,
          checks: 0,
          message: "更新器已收到请求，Docker 镜像拉取由 NAS / Watchtower 执行中。",
        });
        await waitForUpdateCompletion(result.latestVersion);
        return;
      }
      setStatus("available");
    } catch (error) {
      const errorMessage = describeUpdateError(error);
      setStatus("error");
      setMessage(errorMessage);
      setProgress({
        phase: "error",
        source: window.promptForgeUpdater ? "desktop" : "nas",
        targetVersion: update.latestVersion,
        message: errorMessage,
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
        setProgress({
          phase: attempt < 2 ? "pulling" : "restarting",
          source: "nas",
          targetVersion,
          elapsedSeconds: elapsedSecondsForAttempt(attempt),
          checks: attempt + 1,
          message: "更新器仍在处理。Docker 拉取镜像、替换容器和重启服务可能需要几分钟。",
        });
      } catch {
        setProgress({
          phase: "restarting",
          source: "nas",
          targetVersion,
          elapsedSeconds: elapsedSecondsForAttempt(attempt),
          checks: attempt + 1,
          message: "服务正在重启或网络暂时不可达，正在继续等待恢复。",
        });
      }
    }
    throw new Error("更新已触发，但等待服务恢复超时。请稍后刷新页面，或查看 NAS Docker 日志。");
  }

  if (status === "idle" || (status === "checking" && !update)) return null;

  const label =
    status === "checking"
      ? "检查更新"
      : status === "applying"
        ? "更新中..."
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

function describeUpdateError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "更新失败";
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("ghcr.io") && normalized.includes("unexpected eof")) {
    return `GHCR 镜像仓库连接中断：NAS 在拉取 Docker 镜像时下载流提前断开。可以稍后再次点击更新，或在 Docker 项目里重新部署。原始错误：${rawMessage}`;
  }

  if (
    normalized.includes("ghcr.io") &&
    (normalized.includes("client.timeout") ||
      normalized.includes("request canceled") ||
      normalized.includes("waiting for connection"))
  ) {
    return `GHCR 镜像仓库连接超时：NAS 访问 GitHub Container Registry 不稳定。可以稍后再次点击更新，或在 Docker 项目里重新部署。原始错误：${rawMessage}`;
  }

  return rawMessage;
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
    <div className="update-progress-panel" role="status" aria-live="polite">
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
      <p>{progress.message}</p>
      {showRefresh && (
        <button type="button" className="secondary-action update-refresh-action" onClick={onRefresh}>
          刷新页面
        </button>
      )}
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
    return {
      value: `${Math.round(clampPercent(progress.percent))}%`,
      label: progress.source === "desktop" && progress.phase !== "complete" ? "下载进度" : "完成进度",
      detail: progress.transferred && progress.total ? `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}` : undefined,
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
