import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { applyUpdate, checkUpdate, type UpdateCheckResponse } from "../api";

type UpdateStatus = "checking" | "idle" | "available" | "applying" | "complete" | "error";
type UpdatePhase = "triggering" | "pulling" | "restarting" | "complete" | "manual" | "error";

interface UpdateProgress {
  phase: UpdatePhase;
  targetVersion?: string;
  message: string;
}

interface DesktopUpdateCheck {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  message?: string;
}

interface DesktopUpdater {
  check(): Promise<DesktopUpdateCheck>;
  download(): Promise<DesktopUpdateCheck>;
  install(): Promise<void>;
  onStatus?(callback: (status: DesktopUpdateCheck) => void): () => void;
}

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

const NAS_PROGRESS_STEPS: Array<{ phase: UpdatePhase; label: string; percent: number }> = [
  { phase: "triggering", label: "触发更新器", percent: 20 },
  { phase: "pulling", label: "拉取新版本", percent: 55 },
  { phase: "restarting", label: "等待服务恢复", percent: 82 },
  { phase: "complete", label: "更新完成", percent: 100 },
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
        setUpdate(normalizeDesktopUpdate(nextStatus));
        setStatus(nextStatus.updateAvailable ? "available" : "idle");
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
      targetVersion: update.latestVersion,
      message: `正在触发更新到 ${update.latestVersion ?? "最新版本"}。`,
    });

    try {
      if (window.promptForgeUpdater) {
        setProgress({
          phase: "pulling",
          targetVersion: update.latestVersion,
          message: "正在下载安装包，完成后应用会自动安装。",
        });
        await window.promptForgeUpdater.download();
        setProgress({
          phase: "restarting",
          targetVersion: update.latestVersion,
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
          targetVersion: result.latestVersion,
          message: `当前已经是最新版本 ${result.currentVersion}。`,
        });
        setUpdate(result);
        setStatus("complete");
        return;
      }
      if (result.status === "started") {
        setProgress({
          phase: "pulling",
          targetVersion: result.latestVersion,
          message: "更新器已收到请求，正在拉取新镜像并准备重启服务。",
        });
        await waitForUpdateCompletion(result.latestVersion);
        return;
      }
      setStatus("available");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "更新失败");
      setProgress({
        phase: "error",
        targetVersion: update.latestVersion,
        message: error instanceof Error ? error.message : "更新失败",
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
            targetVersion,
            message: `已更新到 ${targetVersion}，刷新页面后即可使用新版本。`,
          });
          setStatus("complete");
          return;
        }
        setProgress({
          phase: attempt < 2 ? "pulling" : "restarting",
          targetVersion,
          message: "更新器仍在处理。拉取镜像、替换容器和重启服务可能需要几分钟。",
        });
      } catch {
        setProgress({
          phase: "restarting",
          targetVersion,
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
          ? "更新异常"
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

function UpdateProgressPanel({
  progress,
  onRefresh,
  showRefresh,
}: {
  progress: UpdateProgress;
  onRefresh(): void;
  showRefresh: boolean;
}) {
  const percent = progress.phase === "manual" || progress.phase === "error" ? 100 : progressPercent(progress.phase);
  return (
    <div className="update-progress-panel" role="status" aria-live="polite">
      <div className="update-progress-heading">
        <strong>{progressTitle(progress.phase)}</strong>
        {progress.targetVersion && <span>目标版本 {progress.targetVersion}</span>}
      </div>
      <div className="update-progress-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
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

function progressPercent(phase: UpdatePhase): number {
  return NAS_PROGRESS_STEPS.find((step) => step.phase === phase)?.percent ?? 0;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
