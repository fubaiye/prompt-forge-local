import { Clock3, Save, Trash2 } from "lucide-react";
import type { HistoryItem } from "../../../shared/types";

interface HistoryPanelProps {
  history: HistoryItem[];
  onRestore(item: HistoryItem): void;
  onDelete(id: string): void;
}

export function HistoryPanel({ history, onRestore, onDelete }: HistoryPanelProps) {
  return (
    <section className="history-band" aria-label="锻造记录">
      <div className="history-heading">
        <div>
          <h2>
            <Clock3 size={22} />
            锻造记录
          </h2>
          <p>已保存的提示词，点一条即可回填复用。</p>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="history-empty-box">
          <Save size={28} />
          <p>还没有锻造记录，生成一条点「存到历史」。</p>
        </div>
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
