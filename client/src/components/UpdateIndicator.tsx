import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { applyUpdate, checkUpdate, type UpdateCheckResponse } from "../api";

type UpdateStatus = "checking" | "idle" | "available" | "applying" | "error";

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

declare global {
  interface Window {
    promptForgeUpdater?: DesktopUpdater;
  }
}

export function UpdateIndicator() {
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const [update, setUpdate] = useState<UpdateCheckResponse | null>(null);
  const [message, setMessage] = useState("");

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

    try {
      if (window.promptForgeUpdater) {
        await window.promptForgeUpdater.download();
        await window.promptForgeUpdater.install();
        return;
      }

      const result = await applyUpdate();
      setMessage(result.message ?? "");
      if (result.status === "manual" && result.releaseUrl) {
        window.open(result.releaseUrl, "_blank", "noopener,noreferrer");
      }
      setStatus(result.status === "started" ? "idle" : "available");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "更新失败");
    }
  }

  if (status === "idle" || (status === "checking" && !update)) return null;

  const label =
    status === "checking"
      ? "检查更新"
      : status === "applying"
        ? "更新中..."
        : status === "error"
          ? "更新异常"
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
        {status === "applying" || status === "checking" ? <RefreshCw size={15} /> : <Download size={15} />}
        {label}
      </button>
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
