import { Check, Copy, Download, Expand, FileText, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { HistoryItem } from "../../../shared/types";
import { Button, Card, EmptyState, Tabs } from "./ui";

interface ResultPanelProps {
  prompt: string;
  error: string;
  isGenerating: boolean;
  canRegenerate: boolean;
  history: HistoryItem[];
  onPromptChange(value: string): void;
  onRegenerate(): void;
  onRestore(item: HistoryItem): void;
  onDeleteHistory(id: string): void;
}

export function ResultPanel({
  prompt,
  error,
  isGenerating,
  canRegenerate,
  history,
  onPromptChange,
  onRegenerate,
  onRestore,
  onDeleteHistory,
}: ResultPanelProps) {
  const [activeTab, setActiveTab] = useState("result");
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success">("idle");
  const [fullscreen, setFullscreen] = useState(false);

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadPrompt() {
    if (!prompt) return;
    const blob = new Blob([prompt], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "system-prompt.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  function markSaved() {
    if (!prompt) return;
    setSaveStatus("success");
    window.setTimeout(() => setSaveStatus("idle"), 1600);
  }

  return (
    <Card className={fullscreen ? "result-panel fullscreen" : "result-panel"} aria-label="生成结果">
      <div className="result-header">
        <div>
          <span>OUTPUT</span>
          <h2>结果工作区</h2>
        </div>
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "result", label: "结果" },
            { value: "history", label: "历史版本", count: history.length },
          ]}
        />
      </div>

      {activeTab === "result" ? (
        <>
          <div className="editor-toolbar" aria-label="结果操作">
            <Button type="button" variant="icon" onClick={copyPrompt} disabled={!prompt} title="复制">
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </Button>
            <Button type="button" variant="icon" onClick={downloadPrompt} disabled={!prompt} title="下载">
              <Download size={17} />
            </Button>
            <Button type="button" variant="icon" onClick={onRegenerate} disabled={!canRegenerate || isGenerating} title="重新生成">
              <RefreshCw size={17} />
            </Button>
            <Button type="button" variant="icon" onClick={() => setFullscreen((value) => !value)} title="全屏">
              <Expand size={17} />
            </Button>
            <Button type="button" variant="secondary" status={saveStatus} onClick={markSaved} disabled={!prompt} title="保存版本">
              <Save size={16} />
              {saveStatus === "success" ? "已保存" : "保存版本"}
            </Button>
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="editor-shell">
            <div className="editor-titlebar">
              <FileText size={15} />
              <span>system-prompt.md</span>
            </div>
            {isGenerating && !prompt ? (
              <div className="skeleton-stack" aria-label="正在生成">
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : prompt ? (
              <textarea
                className="prompt-editor"
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                spellCheck={false}
                aria-label="System Prompt 编辑器"
              />
            ) : (
              <EmptyState
                icon={<Sparkles size={24} />}
                title="结果将在这里显示"
                description="左侧完成配置后点击生成，内容会以 Markdown 编辑器形式显示。"
              />
            )}
          </div>
        </>
      ) : (
        <div className="history-tab">
          {history.length === 0 ? (
            <EmptyState icon={<Save size={24} />} title="暂无历史版本" description="生成成功后会自动保存到本机历史。" />
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <article key={item.id} className="history-row">
                  <button type="button" onClick={() => onRestore(item)}>
                    <strong>{item.requirement}</strong>
                    <span>{historyMeta(item)}</span>
                  </button>
                  <Button type="button" variant="icon" onClick={() => onDeleteHistory(item.id)} title="删除历史">
                    <Trash2 size={16} />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function historyMeta(item: HistoryItem): string {
  const parts = [item.targetModel, item.taskCategory, new Date(item.createdAt).toLocaleString()];
  if (item.imageAttachments?.length) {
    parts.push(`图片摘要 ${item.imageAttachments.length} 张，需重新上传`);
  }
  return parts.join(" · ");
}
