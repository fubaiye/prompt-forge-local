import { Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { TARGET_MODELS, TASK_CATEGORIES } from "../../../shared/modelCatalog";
import type { DownstreamModel, GenerateRequest, MaskedProvider, ModelFamily } from "../../../shared/types";

interface ForgePanelProps {
  form: GenerateRequest;
  providers: MaskedProvider[];
  selectedProvider?: MaskedProvider;
  downstreamOptions: DownstreamModel[];
  canGenerate: boolean;
  isGenerating: boolean;
  onChange(patch: Partial<GenerateRequest>): void;
  onGenerate(): void;
  onOpenSettings(): void;
}

export function ForgePanel({
  form,
  providers,
  selectedProvider,
  downstreamOptions,
  canGenerate,
  isGenerating,
  onChange,
  onGenerate,
  onOpenSettings,
}: ForgePanelProps) {
  const [vendorFilter, setVendorFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState<ModelFamily | "all">("all");

  const vendors = useMemo(() => Array.from(new Set(TARGET_MODELS.map((model) => model.vendor))).sort(), []);
  const targetModels = useMemo(
    () =>
      TARGET_MODELS.filter((model) => {
        if (vendorFilter !== "all" && model.vendor !== vendorFilter) return false;
        if (familyFilter !== "all" && model.family !== familyFilter) return false;
        return true;
      }),
    [familyFilter, vendorFilter],
  );

  return (
    <section className="panel forge-panel" aria-label="提示词锻造控制台">
      <div className="panel-heading">
        <span className="eyebrow">SYSTEM PROMPT FORGE</span>
        <h1>一句话需求，锻造可上线的系统提示词</h1>
      </div>

      <label className="field-block">
        <span>需求 / 使用场景</span>
        <textarea
          value={form.requirement}
          onChange={(event) => onChange({ requirement: event.target.value })}
          placeholder="例：我要一个能帮我写小红书美妆种草文案的助手，风格活泼，每条不超过 200 字，结尾带 3 个话题。"
          rows={5}
        />
      </label>

      <div className="field-grid">
        <label className="field-block">
          <span>API Provider</span>
          <select value={form.providerId} onChange={(event) => onChange({ providerId: event.target.value })}>
            <option value="">选择本地 API</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>调用模型</span>
          <input
            value={form.generationModel}
            onChange={(event) => onChange({ generationModel: event.target.value })}
            list="generation-models"
            placeholder={selectedProvider ? "输入或选择模型 ID" : "先添加 API Provider"}
          />
          <datalist id="generation-models">
            {selectedProvider?.models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>
      </div>

      {providers.length === 0 && (
        <button className="secondary-action full" type="button" onClick={onOpenSettings}>
          添加 OpenAI-Compatible API
        </button>
      )}

      <div className="filter-row">
        <label>
          <span>厂商</span>
          <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}>
            <option value="all">全部厂商</option>
            {vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>模型族</span>
          <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value as ModelFamily | "all")}>
            <option value="all">全部</option>
            <option value="closed">闭源</option>
            <option value="open">开源</option>
          </select>
        </label>
      </div>

      <label className="field-block">
        <span>目标大脑模型</span>
        <select value={form.targetModel} onChange={(event) => onChange({ targetModel: event.target.value })}>
          {targetModels.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label} · {model.vendor}
            </option>
          ))}
        </select>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.visionEnabled}
          onChange={(event) => onChange({ visionEnabled: event.target.checked })}
        />
        <span>目标提示词需要处理图片/视频输入</span>
      </label>

      <div className="field-block">
        <span>下游生成任务</span>
        <div className="segmented">
          {TASK_CATEGORIES.map((task) => (
            <button
              key={task.key}
              type="button"
              className={form.taskCategory === task.key ? "active" : ""}
              onClick={() => onChange({ taskCategory: task.key })}
              title={task.desc}
            >
              {task.name}
            </button>
          ))}
        </div>
      </div>

      {form.taskCategory !== "none" && (
        <label className="field-block">
          <span>下游模型</span>
          <select value={form.downstreamModel || ""} onChange={(event) => onChange({ downstreamModel: event.target.value })}>
            {downstreamOptions.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label} · {model.vendor}
              </option>
            ))}
          </select>
        </label>
      )}

      <button className="generate-button" type="button" disabled={!canGenerate || isGenerating} onClick={onGenerate}>
        <Wand2 size={18} />
        {isGenerating ? "锻造中..." : "锻造 System Prompt"}
      </button>
      {!canGenerate && !isGenerating && <p className="hint">至少输入 4 个字，并选择 API Provider 与调用模型。</p>}
    </section>
  );
}
