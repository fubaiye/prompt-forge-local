import { Settings, Sparkles } from "lucide-react";
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
import { ProviderSettings } from "./components/ProviderSettings";
import { ResultPanel } from "./components/ResultPanel";
import { UpdateIndicator } from "./components/UpdateIndicator";

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
      if (patch.visionEnabled === false) {
        next.imageAttachments = undefined;
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
    const hasImageSummaries = Boolean(item.imageAttachments?.length);
    setForm({
      requirement: item.requirement,
      providerId: item.providerId,
      generationModel: item.generationModel,
      targetModel: item.targetModel,
      visionEnabled: hasImageSummaries ? false : item.visionEnabled,
      taskCategory: item.taskCategory,
      downstreamModel: item.downstreamModel,
      imageAttachments: undefined,
    });
    setGeneratedPrompt(item.systemPrompt);
    setError(hasImageSummaries ? "这条历史记录使用过图片。历史只保留图片摘要，重新生成前请重新上传对应图片。" : "");
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
          <UpdateIndicator />
          <button className="icon-text-button" type="button" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            设置 API
          </button>
        </div>
      </header>

      <section className="hero-stage" aria-label="提示词工坊介绍">
        <h1>
          生成专业的 <span>System Prompt</span>
        </h1>
        <p>
          选择目标模型、视觉能力和下游任务，用你自己的 API 快速生成可编辑、可复用的系统提示词。
        </p>
      </section>

      <section className="workspace">
        <ForgePanel
          form={form}
          providers={providers}
          selectedProvider={selectedProvider}
          downstreamOptions={downstreamOptions}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          generationError={error}
          onChange={updateForm}
          onGenerate={handleGenerate}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <ResultPanel
          prompt={generatedPrompt}
          error={error}
          isGenerating={isGenerating}
          canRegenerate={canGenerate}
          history={history}
          onPromptChange={setGeneratedPrompt}
          onRegenerate={handleGenerate}
          onRestore={restoreHistory}
          onDeleteHistory={handleDeleteHistory}
        />
      </section>

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
