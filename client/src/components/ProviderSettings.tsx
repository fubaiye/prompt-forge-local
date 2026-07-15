import { KeyRound, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { PROVIDER_PRESETS, type ProviderPreset } from "../../../shared/providerPresets";
import type { MaskedProvider, ProviderInput } from "../../../shared/types";
import type { ProviderPayload } from "../api";

interface ProviderSettingsProps {
  providers: MaskedProvider[];
  onClose(): void;
  onSave(id: string | undefined, payload: ProviderInput | ProviderPayload): Promise<void>;
  onDelete(id: string): Promise<void>;
}

const EMPTY_FORM = {
  name: "",
  baseUrl: "",
  apiKey: "",
  models: "",
  defaultModel: "",
};

export function ProviderSettings({ providers, onClose, onSave, onDelete }: ProviderSettingsProps) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const editingProvider = useMemo(() => providers.find((provider) => provider.id === editingId), [editingId, providers]);

  function startEdit(provider: MaskedProvider) {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: "",
      models: provider.models.join("\n"),
      defaultModel: provider.defaultModel || provider.models[0] || "",
    });
    setError("");
  }

  function resetForm() {
    setEditingId(undefined);
    setForm(EMPTY_FORM);
    setError("");
  }

  function applyPreset(preset: ProviderPreset) {
    setEditingId(undefined);
    setForm({
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: form.apiKey,
      models: preset.models.join("\n"),
      defaultModel: preset.defaultModel,
    });
    setError("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const models = parseModels(form.models);
      if (models.length === 0) throw new Error("至少填写一个模型 ID");
      if (!editingId && !form.apiKey.trim()) throw new Error("新增 Provider 需要 API Key");
      const payload: ProviderPayload = {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        models,
        defaultModel: form.defaultModel.trim() || models[0],
      };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      await onSave(editingId, payload as ProviderInput);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="API Provider 设置">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">LOCAL API</span>
            <h2>Provider 设置</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="settings-layout">
          <div className="provider-list">
            {providers.length === 0 ? (
              <p className="history-empty">还没有 Provider。添加一个 OpenAI-Compatible 接口即可开始。</p>
            ) : (
              providers.map((provider) => (
                <article key={provider.id} className="provider-card">
                  <div>
                    <strong>{provider.name}</strong>
                    <span>{provider.baseUrl}</span>
                    <small>
                      <KeyRound size={13} /> {provider.apiKeyMasked} · {provider.models.length} models
                    </small>
                  </div>
                  <div className="tool-group">
                    <button type="button" className="icon-button" onClick={() => startEdit(provider)} title="编辑">
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="icon-button danger" onClick={() => onDelete(provider.id)} title="删除">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <form className="provider-form" onSubmit={handleSubmit}>
            <h3>{editingProvider ? `编辑 ${editingProvider.name}` : "添加 Provider"}</h3>
            <div className="preset-panel">
              <div className="preset-heading">
                <span>API 通道预设</span>
                <small>选择通道后只需要粘贴该平台自己的 API Key。</small>
              </div>
              <div className="preset-grid">
                {PROVIDER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={form.baseUrl === preset.baseUrl ? "preset-card selected" : "preset-card"}
                    onClick={() => applyPreset(preset)}
                  >
                    <span className="preset-card-title">
                      <strong>{preset.name}</strong>
                      <em>{preset.badge}</em>
                    </span>
                    <span>{preset.description}</span>
                    <small>{preset.keyHint}</small>
                  </button>
                ))}
              </div>
            </div>
            <label className="field-block">
              <span>名称</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="OpenRouter" />
            </label>
            <label className="field-block">
              <span>Base URL</span>
              <input
                value={form.baseUrl}
                onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="field-block">
              <span>API Key {editingId ? "(留空则不修改)" : ""}</span>
              <input
                value={form.apiKey}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                placeholder="sk-..."
                type="password"
              />
            </label>
            <label className="field-block">
              <span>模型列表</span>
              <textarea
                value={form.models}
                onChange={(event) => setForm({ ...form, models: event.target.value })}
                placeholder={"google/gemini-2.5-pro\nqwen3-vl-plus\ndeepseek-v4-pro"}
                rows={6}
              />
            </label>
            <label className="field-block">
              <span>默认调用模型</span>
              <input
                value={form.defaultModel}
                onChange={(event) => setForm({ ...form, defaultModel: event.target.value })}
                placeholder="留空则使用第一个模型"
              />
            </label>
            {error && <div className="error-box">{error}</div>}
            <div className="form-actions">
              {editingId && (
                <button type="button" className="secondary-action" onClick={resetForm}>
                  取消编辑
                </button>
              )}
              <button type="submit" className="primary-action" disabled={saving}>
                {saving ? "保存中..." : "保存 Provider"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function parseModels(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean)));
}
