import { Trash2 } from "lucide-react";
import type { HistoryItem } from "../../../shared/types";

interface HistoryPanelProps {
  history: HistoryItem[];
  onRestore(item: HistoryItem): void;
  onDelete(id: string): void;
}

export function HistoryPanel({ history, onRestore, onDelete }: HistoryPanelProps) {
  return (
    <section className="history-band" aria-label="历史记录">
      <div className="history-heading">
        <span className="eyebrow">HISTORY</span>
        <h2>最近锻造</h2>
      </div>
      {history.length === 0 ? (
        <p className="history-empty">暂无历史。生成成功后会自动保存到本机。</p>
      ) : (
        <div className="history-list">
          {history.slice(0, 8).map((item) => (
            <article key={item.id} className="history-card">
              <button type="button" onClick={() => onRestore(item)}>
                <span>{item.requirement}</span>
                <small>
                  {item.targetModel} · {item.taskCategory}
                </small>
              </button>
              <button type="button" className="delete-button" onClick={() => onDelete(item.id)} title="删除历史">
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
