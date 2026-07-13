import { Check, Copy, RefreshCw, Sparkles, Zap } from "lucide-react";
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
          <h2>
            <Zap size={22} />
            生成结果
          </h2>
          <p>拷走使用，或存到历史记录以后复用。</p>
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

      <div className="prompt-window">
        <div className="prompt-window-title">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <strong>SYSTEM-PROMPT.MD</strong>
        </div>
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
              <div className="empty-sigil">
                <Sparkles size={38} />
              </div>
              <p>结果将在这里显示</p>
              <span>左侧填需求、选大脑模型和下游任务，点「锻造 System Prompt」，一秒出结果。</span>
            </div>
          )}
        </div>
      </div>

      <div className="result-footer">
        <p className="result-note">AI 生成仅供骨架，建议人工复核关键约束与 few-shot 示例再上线。</p>
        <button type="button" className="ghost-save" disabled>
          {prompt ? "已存历史" : "存到历史"}
        </button>
      </div>
    </section>
  );
}
