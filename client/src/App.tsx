import { Eye, ImageIcon, Link2, PencilLine, Settings, Sparkles, Type, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DOWNSTREAM_MODELS, getDownstreamModels } from "../../shared/modelCatalog";
import type { GenerateRequest, HistoryItem, MaskedProvider, ProviderInput } from "../../shared/types";
import {
  createProvider,
  deleteHistoryItem,
  deleteProvider,
  generatePrompt,
  listHistory,
  listProviders,
  updateProvider,
  type ProviderPayload,
} from "./api";
import { ForgePanel } from "./components/ForgePanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { ProviderSettings } from "./components/ProviderSettings";
import { ResultPanel } from "./components/ResultPanel";

const DEFAULT_FORM: GenerateRequest = {
  requirement: "",
  providerId: "",
  generationModel: "",
  targetModel: "gpt-4o",
  visionEnabled: false,
  taskCategory: "none",
};

export default function App() {
  const [providers, setProviders] = useState<MaskedProvider[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [form, setForm] = useState<GenerateRequest>(DEFAULT_FORM);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void refreshProviders();
    void refreshHistory();
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === form.providerId),
    [form.providerId, providers],
  );

  const downstreamOptions = useMemo(() => {
    if (form.taskCategory === "none") return [];
    return getDownstreamModels(form.taskCategory);
  }, [form.taskCategory]);

  const canGenerate = Boolean(
    form.requirement.trim().length >= 4 &&
      form.providerId &&
      form.generationModel.trim() &&
      (form.taskCategory === "none" || form.downstreamModel),
  );

  async function refreshProviders() {
    try {
      const nextProviders = await listProviders();
      setProviders(nextProviders);
      setForm((current) => {
        if (current.providerId || nextProviders.length === 0) return current;
        const first = nextProviders[0];
        return { ...current, providerId: first.id, generationModel: first.defaultModel || first.models[0] || "" };
      });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function refreshHistory() {
    try {
      setHistory(await listHistory());
    } catch (err) {
      setError(errorText(err));
    }
  }

  function updateForm(patch: Partial<GenerateRequest>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.providerId) {
        const provider = providers.find((item) => item.id === patch.providerId);
        next.generationModel = provider?.defaultModel || provider?.models[0] || "";
      }
      if (patch.taskCategory) {
        if (patch.taskCategory === "none") {
          next.downstreamModel = undefined;
        } else {
          const first = getDownstreamModels(patch.taskCategory)[0];
          next.downstreamModel = first?.value;
        }
      }
      return next;
    });
  }

  async function handleGenerate() {
    if (!canGenerate || isGenerating) return;
    setIsGenerating(true);
    setError("");
    try {
      const result = await generatePrompt(form);
      setGeneratedPrompt(result.systemPrompt);
      setHistory((current) => [result.historyItem, ...current.filter((item) => item.id !== result.historyItem.id)]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveProvider(id: string | undefined, payload: ProviderInput | ProviderPayload) {
    const saved = id ? await updateProvider(id, payload) : await createProvider(payload as ProviderInput);
    await refreshProviders();
    setForm((current) => ({
      ...current,
      providerId: saved.id,
      generationModel: saved.defaultModel || saved.models[0] || current.generationModel,
    }));
  }

  async function handleDeleteProvider(id: string) {
    await deleteProvider(id);
    const nextProviders = providers.filter((provider) => provider.id !== id);
    setProviders(nextProviders);
    setForm((current) => {
      if (current.providerId !== id) return current;
      const first = nextProviders[0];
      return { ...current, providerId: first?.id || "", generationModel: first?.defaultModel || first?.models[0] || "" };
    });
  }

  async function handleDeleteHistory(id: string) {
    await deleteHistoryItem(id);
    setHistory((current) => current.filter((item) => item.id !== id));
  }

  function restoreHistory(item: HistoryItem) {
    setForm({
      requirement: item.requirement,
      providerId: item.providerId,
      generationModel: item.generationModel,
      targetModel: item.targetModel,
      visionEnabled: item.visionEnabled,
      taskCategory: item.taskCategory,
      downstreamModel: item.downstreamModel,
    });
    setGeneratedPrompt(item.systemPrompt);
    setError("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="brand-title">提示词工坊</div>
            <div className="brand-subtitle">Prompt Forge</div>
          </div>
        </div>

        <div className="topbar-actions">
          <span className={providers.length > 0 ? "status-pill online" : "status-pill"}>
            {providers.length > 0 ? `${providers.length} 个 API Provider` : "未配置 API"}
          </span>
          <button className="icon-text-button" type="button" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            设置 API
          </button>
        </div>
      </header>

      <section className="hero-stage" aria-label="提示词工坊介绍">
        <div className="version-pill">
          <span />
          SYSTEM PROMPT FORGE · V2.0
        </div>
        <h1>
          一句话需求，<br className="mobile-break" />
          <span>锻造</span>出给 AI 的
          <br />
          系统提示词
        </h1>
        <p>
          选择大脑模型、告诉它接不接图片、要不要驱动下游生图/视频，<strong>一句话</strong>就产出一段专业的
          System Prompt，拷走即用。
        </p>
        <div className="hero-chips" aria-label="能力标签">
          <span className="billing-chip">
            <Link2 size={15} />
            本地 API · 自行计费
          </span>
          <span>
            <Type size={15} />
            文本 LLM
          </span>
          <span>
            <Eye size={15} />
            多模态 VLM
          </span>
          <span>
            <ImageIcon size={15} />
            文/图生图
          </span>
          <span>
            <PencilLine size={15} />
            图像编辑
          </span>
          <span>
            <Video size={15} />
            文/图生视频
          </span>
        </div>
      </section>

      <section className="workspace">
        <ForgePanel
          form={form}
          providers={providers}
          selectedProvider={selectedProvider}
          downstreamOptions={downstreamOptions}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          onChange={updateForm}
          onGenerate={handleGenerate}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <ResultPanel
          prompt={generatedPrompt}
          error={error}
          isGenerating={isGenerating}
          canRegenerate={canGenerate}
          onRegenerate={handleGenerate}
        />
      </section>

      <HistoryPanel history={history} onRestore={restoreHistory} onDelete={handleDeleteHistory} />

      {settingsOpen && (
        <ProviderSettings
          providers={providers}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveProvider}
          onDelete={handleDeleteProvider}
        />
      )}
    </main>
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "发生未知错误";
}

export { DOWNSTREAM_MODELS };
