import {
  Cpu,
  Eye,
  ImageIcon,
  PencilLine,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Type,
  Video,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { TARGET_MODELS, TASK_CATEGORIES } from "../../../shared/modelCatalog";
import type { DownstreamModel, GenerateRequest, MaskedProvider, ModelFamily, TaskCategory } from "../../../shared/types";

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

const taskIcons: Record<TaskCategory, LucideIcon> = {
  none: Type,
  text2img: ImageIcon,
  img2img: ImageIcon,
  edit: PencilLine,
  text2video: Video,
  img2video: Video,
};

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
  const selectedTarget = TARGET_MODELS.find((model) => model.value === form.targetModel);
  const targetModels = useMemo(
    () =>
      TARGET_MODELS.filter((model) => {
        if (form.visionEnabled && !model.vision) return false;
        if (vendorFilter !== "all" && model.vendor !== vendorFilter) return false;
        if (familyFilter !== "all" && model.family !== familyFilter) return false;
        return true;
      }),
    [familyFilter, form.visionEnabled, vendorFilter],
  );

  function setVisionEnabled(visionEnabled: boolean) {
    const patch: Partial<GenerateRequest> = { visionEnabled };
    if (visionEnabled && !selectedTarget?.vision) {
      patch.targetModel = TARGET_MODELS.find((model) => model.vision)?.value ?? form.targetModel;
    }
    onChange(patch);
  }

  return (
    <section className="panel forge-panel" aria-label="提示词锻造控制台">
      <div className="terminal-heading">
        <div>
          <h2>
            <Cpu size={22} />
            参数配置
          </h2>
          <p>告诉 Forge 要炼什么，它给你锻出 System Prompt。</p>
        </div>
        <span>
          //
          <br />
          CONFIG.TERMINAL
        </span>
      </div>

      <div className="forge-section">
        <div className="section-label pink-dot">需求 / 使用场景</div>
        <textarea
          value={form.requirement}
          onChange={(event) => onChange({ requirement: event.target.value })}
          placeholder="参考图1的表达方式及颜色，将图2变成一样的，字体清晰无锯齿"
          rows={5}
        />
        <div className="micro-row">
          <span>写清角色、任务、输出风格、限制，提示词更贴。</span>
          <span>{form.requirement.trim().length} chars</span>
        </div>
      </div>

      <div className="divider" />

      <div className="forge-section">
        <div className="section-label cyan-dot">本地 API 接入</div>
        <div className="api-grid">
          <label>
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
          <label>
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
            <Settings size={16} />
            添加 OpenAI-Compatible API
          </button>
        )}
      </div>

      <div className="divider" />

      <div className="forge-section">
        <div className="section-label violet-dot">大脑模型能力</div>
        <div className="ability-grid">
          <button
            type="button"
            className={!form.visionEnabled ? "ability-card active" : "ability-card"}
            onClick={() => setVisionEnabled(false)}
          >
            <Type size={17} />
            <strong>纯文本</strong>
            <span>LLM 不看图片/视频，只能读文字</span>
          </button>
          <button
            type="button"
            className={form.visionEnabled ? "ability-card active" : "ability-card"}
            onClick={() => setVisionEnabled(true)}
          >
            <Eye size={17} />
            <strong>图像识别</strong>
            <span>VLM 会接收图片/视频输入，需明确读图规则</span>
          </button>
        </div>

        <div className="model-terminal">
          <div className="model-terminal-top">
            <span>大脑模型 · {targetModels.length} 可选</span>
            <div className="filter-pills" aria-label="模型过滤">
              <button className={familyFilter === "all" ? "active" : ""} type="button" onClick={() => setFamilyFilter("all")}>
                全部
              </button>
              <button className={familyFilter === "closed" ? "active" : ""} type="button" onClick={() => setFamilyFilter("closed")}>
                闭源
              </button>
              <button className={familyFilter === "open" ? "active" : ""} type="button" onClick={() => setFamilyFilter("open")}>
                开源
              </button>
              <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} aria-label="厂商过滤">
                <option value="all">全部厂商</option>
                {vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="model-card-grid">
            {targetModels.map((model) => (
              <button
                key={model.value}
                type="button"
                className={form.targetModel === model.value ? "model-card active" : "model-card"}
                onClick={() => onChange({ targetModel: model.value })}
              >
                <strong>{compactModelLabel(model.label)}</strong>
                <span>
                  {model.vendor.toUpperCase()} · {model.vision ? "VISION" : "TEXT"}
                </span>
                {model.tag && <em>{model.tag}</em>}
                <Eye size={14} className="model-eye" />
              </button>
            ))}
          </div>
          {form.visionEnabled && <p className="filter-note">* 已过滤为支持视觉输入 (VLM) 的模型</p>}
        </div>
      </div>

      <div className="divider" />

      <div className="forge-section">
        <div className="section-label cyan-dot">下游生成任务 <small>（选「不下发生成」即只写大脑 Prompt）</small></div>
        <div className="task-grid">
          {TASK_CATEGORIES.map((task) => {
            const Icon = taskIcons[task.key];
            return (
              <button
                key={task.key}
                type="button"
                className={form.taskCategory === task.key ? "task-card active" : "task-card"}
                onClick={() => onChange({ taskCategory: task.key })}
                title={task.desc}
              >
                <Icon size={20} />
                <span>{task.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {form.taskCategory !== "none" && (
        <div className="downstream-terminal">
          <div className="downstream-heading">
            <div>
              <strong>{selectedTaskName(form.taskCategory)} · 选一个具体模型</strong>
              <p>VLM 先解析参考图，再输出给下游模型的 prompt。</p>
            </div>
            <SlidersHorizontal size={16} />
          </div>
          <div className="downstream-grid">
            {downstreamOptions.map((model) => (
              <button
                key={model.value}
                type="button"
                className={form.downstreamModel === model.value ? "downstream-card active" : "downstream-card"}
                onClick={() => onChange({ downstreamModel: model.value })}
              >
                <strong>{model.label}</strong>
                <span>{model.vendor.toUpperCase()}</span>
                {model.tag && <em>{model.tag}</em>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="divider" />

      <button className="generate-button" type="button" disabled={!canGenerate || isGenerating} onClick={onGenerate}>
        <Sparkles size={18} />
        {isGenerating ? "锻造中..." : "锻造 System Prompt"}
        <Wand2 size={18} />
      </button>
      {!canGenerate && !isGenerating && <p className="hint">至少输入 4 个字，并选择 API Provider 与调用模型。</p>}
    </section>
  );
}

function compactModelLabel(label: string): string {
  return label.replace("Claude Opus ", "").replace("Claude Sonnet ", "").replace("Claude Haiku ", "");
}

function selectedTaskName(category: TaskCategory): string {
  return TASK_CATEGORIES.find((task) => task.key === category)?.name ?? "下游任务";
}
