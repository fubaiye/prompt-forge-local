import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";

interface ResultPanelProps {
  prompt: string;
  error: string;
  isGenerating: boolean;
  canRegenerate: boolean;
  onRegenerate(): void;
}

export function ResultPanel({ prompt, error, isGenerating, canRegenerate, onRegenerate }: ResultPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="panel result-panel" aria-label="生成结果">
      <div className="result-toolbar">
        <div>
          <span className="eyebrow">OUTPUT</span>
          <h2>system-prompt.md</h2>
        </div>
        <div className="tool-group">
          <button type="button" className="icon-button" onClick={copyPrompt} disabled={!prompt} title="复制">
            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
          <button type="button" className="icon-button" onClick={onRegenerate} disabled={!canRegenerate || isGenerating} title="重新生成">
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="prompt-surface">
        {isGenerating && !prompt ? (
          <div className="skeleton-stack" aria-label="正在生成">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : prompt ? (
          <pre>{prompt}</pre>
        ) : (
          <div className="empty-result">
            <p>结果将在这里显示</p>
            <span>左侧填需求、选模型和下游任务，点「锻造 System Prompt」。</span>
          </div>
        )}
      </div>

      <p className="result-note">AI 生成仅供骨架，建议人工复核关键约束与 few-shot 示例再上线。</p>
    </section>
  );
}
