import {
  Brain,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  ImageIcon,
  PencilLine,
  Search,
  Settings,
  Type,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TARGET_MODELS, TASK_CATEGORIES } from "../../../shared/modelCatalog";
import type {
  DownstreamModel,
  GenerateRequest,
  ImageAttachment,
  MaskedProvider,
  ModelFamily,
  TaskCategory,
} from "../../../shared/types";
import { Button, Card, ModelItem, SelectCard } from "./ui";

interface ForgePanelProps {
  form: GenerateRequest;
  providers: MaskedProvider[];
  selectedProvider?: MaskedProvider;
  downstreamOptions: DownstreamModel[];
  canGenerate: boolean;
  isGenerating: boolean;
  generationError?: string;
  onChange(patch: Partial<GenerateRequest>): void;
  onGenerate(): void;
  onOpenSettings(): void;
}

type SectionId = "requirement" | "images" | "models";

const SECTION_NAV: Array<{ id: SectionId; label: string }> = [
  { id: "requirement", label: "需求描述" },
  { id: "images", label: "参考图片" },
  { id: "models", label: "模型设置" },
];

const taskIcon = {
  none: FileText,
  text2img: ImageIcon,
  img2img: ImageIcon,
  edit: PencilLine,
  text2video: Video,
  img2video: Video,
} satisfies Record<TaskCategory, typeof FileText>;

const MAX_IMAGE_ATTACHMENTS = 6;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 24 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MODEL_SETTINGS_STORAGE_KEY = "prompt-forge-model-settings-open";

export function ForgePanel({
  form,
  providers,
  selectedProvider,
  downstreamOptions,
  canGenerate,
  isGenerating,
  generationError = "",
  onChange,
  onGenerate,
  onOpenSettings,
}: ForgePanelProps) {
  const [vendorFilter, setVendorFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState<ModelFamily | "all">("all");
  const [modelQuery, setModelQuery] = useState("");
  const [imageError, setImageError] = useState("");
  const [isReadingImages, setIsReadingImages] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("requirement");
  const [modelSettingsOpen, setModelSettingsOpen] = useState(readStoredModelSettingsOpen);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const requirementRef = useRef<HTMLElement | null>(null);
  const imagesRef = useRef<HTMLElement | null>(null);
  const modelsRef = useRef<HTMLElement | null>(null);
  const requirementInputRef = useRef<HTMLTextAreaElement | null>(null);
  const providerSelectRef = useRef<HTMLSelectElement | null>(null);
  const generationModelRef = useRef<HTMLInputElement | null>(null);

  const imageAttachments = form.imageAttachments ?? [];
  const selectedTarget = TARGET_MODELS.find((model) => model.value === form.targetModel);
  const vendors = useMemo(() => Array.from(new Set(TARGET_MODELS.map((model) => model.vendor))).sort(), []);
  const hasModelConfigError = isModelConfigError(generationError);

  const targetModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    return TARGET_MODELS.filter((model) => {
      if (form.visionEnabled && !model.vision) return false;
      if (vendorFilter !== "all" && model.vendor !== vendorFilter) return false;
      if (familyFilter !== "all" && model.family !== familyFilter) return false;
      if (!query) return true;
      return [model.label, model.vendor, model.value, model.tag ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [familyFilter, form.visionEnabled, modelQuery, vendorFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_SETTINGS_STORAGE_KEY, String(modelSettingsOpen));
    } catch {
      // Local storage can be unavailable in hardened browser contexts.
    }
  }, [modelSettingsOpen]);

  useEffect(() => {
    const field = requirementInputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 288)}px`;
  }, [form.requirement]);

  useEffect(() => {
    if (!hasModelConfigError) return;
    setModelSettingsOpen(true);
    setActiveSection("models");
    window.setTimeout(() => {
      if (!form.providerId) providerSelectRef.current?.focus();
      else generationModelRef.current?.focus();
    }, 0);
  }, [form.providerId, generationError, hasModelConfigError]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const composing = event.isComposing || event.keyCode === 229;
      if (composing || event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
      if (!canGenerate || isGenerating || isReadingImages) return;
      event.preventDefault();
      onGenerate();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canGenerate, isGenerating, isReadingImages, onGenerate]);

  useEffect(() => {
    const root = scrollAreaRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const sections: Array<[SectionId, HTMLElement | null]> = [
      ["requirement", requirementRef.current],
      ["images", imagesRef.current],
      ["models", modelsRef.current],
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const nextId = sections.find(([, element]) => element === visible?.target)?.[0];
        if (nextId) setActiveSection(nextId);
      },
      { root, threshold: [0.24, 0.48, 0.72], rootMargin: "-10% 0px -58% 0px" },
    );
    sections.forEach(([, element]) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [modelSettingsOpen, form.taskCategory]);

  function setVisionEnabled(visionEnabled: boolean) {
    const patch: Partial<GenerateRequest> = { visionEnabled };
    if (!visionEnabled) patch.imageAttachments = undefined;
    if (visionEnabled && !selectedTarget?.vision) {
      patch.targetModel = TARGET_MODELS.find((model) => model.vision)?.value ?? form.targetModel;
    }
    onChange(patch);
  }

  function scrollToSection(sectionId: SectionId) {
    const target = sectionId === "requirement" ? requirementRef.current : sectionId === "images" ? imagesRef.current : modelsRef.current;
    setActiveSection(sectionId);
    target?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  async function addImageFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    if (isGenerating) {
      setImageError("生成中不能添加图片");
      return;
    }
    if (isReadingImages) {
      setImageError("图片仍在读取中，请稍后再添加");
      return;
    }
    setImageError("");
    const current = form.imageAttachments ?? [];
    const files = Array.from(fileList);
    if (current.length + files.length > MAX_IMAGE_ATTACHMENTS) {
      setImageError(`最多上传 ${MAX_IMAGE_ATTACHMENTS} 张图片`);
      return;
    }
    const totalBytes = current.reduce((sum, image) => sum + image.size, 0) + files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      setImageError("图片总大小不能超过 24MB");
      return;
    }

    setIsReadingImages(true);
    try {
      const attachments = await Promise.all(files.map(fileToAttachment));
      const patch: Partial<GenerateRequest> = {
        imageAttachments: [...current, ...attachments],
        visionEnabled: true,
      };
      if (!selectedTarget?.vision) {
        patch.targetModel = TARGET_MODELS.find((model) => model.vision)?.value ?? form.targetModel;
      }
      onChange(patch);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "图片读取失败");
    } finally {
      setIsReadingImages(false);
    }
  }

  function removeImage(id: string) {
    onChange({ imageAttachments: imageAttachments.filter((image) => image.id !== id) });
  }

  const actionHint = actionStatusText(form, canGenerate, isGenerating, isReadingImages);
  const modelSummary = selectedProvider
    ? `${selectedProvider.name} · ${form.generationModel || "未选择调用模型"}`
    : `未选择 API · ${form.generationModel || "未选择调用模型"}`;

  return (
    <Card className="forge-panel" aria-label="提示词配置栏">
      <ConfigurationHeader />
      <ConfigurationSectionNav activeSection={activeSection} onSelect={scrollToSection} />

      <div className="forge-scroll" data-testid="configuration-scroll-area" ref={scrollAreaRef}>
        <section className="config-section requirement-section" id="config-requirement" ref={requirementRef}>
          <div className="section-heading compact-heading">
            <strong>需求 / 使用场景</strong>
          </div>
          <label className="requirement-input-wrap">
            <span className="sr-only">需求描述</span>
            <textarea
              ref={requirementInputRef}
              value={form.requirement}
              onChange={(event) => onChange({ requirement: event.target.value })}
              aria-label="需求描述"
              placeholder="例如：参考图1的表达方式及颜色，将图2变成一样的，字体清晰无锯齿"
              rows={4}
            />
            <span className="textarea-count">{form.requirement.trim().length} chars</span>
          </label>
          <p className="field-help">写清任务、输出风格和限制。上传图片后可直接用“图1、图2”引用。</p>
        </section>

        <section className="config-section reference-images-section" id="config-images" ref={imagesRef}>
          <div className="section-heading compact-heading">
            <strong>参考图片</strong>
            <span>{imageAttachments.length}/{MAX_IMAGE_ATTACHMENTS}</span>
          </div>
          {imageAttachments.length === 0 ? (
            <UploadZone
              disabled={isReadingImages || isGenerating}
              label="点击或拖拽上传图片"
              description="PNG / JPG / WebP，单张 ≤20MB，总计 ≤24MB。"
              onFiles={addImageFiles}
            />
          ) : (
            <div className="image-attachment-grid" aria-label="已上传图片">
              {imageAttachments.map((image, index) => (
                <article key={image.id} className="image-thumb-card">
                  <img src={image.dataUrl} alt={`图${index + 1}`} />
                  <div>
                    <strong>图{index + 1}</strong>
                    <span title={image.name}>{image.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    aria-label={`移除图${index + 1}`}
                    disabled={isReadingImages || isGenerating}
                  >
                    <X size={14} />
                  </button>
                </article>
              ))}
              {imageAttachments.length < MAX_IMAGE_ATTACHMENTS && (
                <UploadZone
                  compact
                  disabled={isReadingImages || isGenerating}
                  label="添加图片"
                  description="继续上传"
                  onFiles={addImageFiles}
                />
              )}
            </div>
          )}
          {imageError && <p className="image-upload-error">{imageError}</p>}
        </section>

        <section className="config-section model-settings-section" id="config-models" ref={modelsRef}>
          <button
            className="model-settings-toggle"
            type="button"
            aria-expanded={modelSettingsOpen}
            aria-controls="model-settings-content"
            onClick={() => setModelSettingsOpen((current) => !current)}
          >
            <div>
              <strong>模型设置</strong>
              <span>{modelSummary}</span>
            </div>
            <em>{modelSettingsOpen ? "收起模型设置" : "展开模型设置"}</em>
            {modelSettingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {modelSettingsOpen && (
            <div className="model-settings-content" id="model-settings-content">
              <section className={hasModelConfigError ? "model-subsection model-subsection-error" : "model-subsection"}>
                <div className="section-heading compact-heading">
                  <strong>本地 API</strong>
                </div>
                <label className="field-block">
                  <span>API Provider</span>
                  <select
                    ref={providerSelectRef}
                    value={form.providerId}
                    onChange={(event) => onChange({ providerId: event.target.value })}
                    aria-label="API Provider"
                  >
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
                    ref={generationModelRef}
                    value={form.generationModel}
                    onChange={(event) => onChange({ generationModel: event.target.value })}
                    list="generation-models"
                    aria-label="调用模型"
                    placeholder={selectedProvider ? "输入或选择模型 ID" : "先添加 API Provider"}
                  />
                  <datalist id="generation-models">
                    {selectedProvider?.models.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </label>
                {providers.length === 0 && (
                  <Button className="full-width" type="button" variant="secondary" onClick={onOpenSettings}>
                    <Settings size={16} />
                    添加 OpenAI-Compatible API
                  </Button>
                )}
              </section>

              <section className="model-subsection">
                <div className="section-heading compact-heading">
                  <strong>大脑模型能力</strong>
                </div>
                <div className="select-card-list">
                  <SelectCard
                    icon={<Type size={18} />}
                    title="纯文本"
                    description="LLM 不看图片/视频，只处理文字输入。"
                    selected={!form.visionEnabled}
                    onClick={() => setVisionEnabled(false)}
                  />
                  <SelectCard
                    icon={<Eye size={18} />}
                    title="图像识别"
                    description="VLM 接收图片/视频输入，并需要明确读图规则。"
                    selected={form.visionEnabled}
                    onClick={() => setVisionEnabled(true)}
                  />
                </div>
              </section>

              <section className="model-subsection">
                <div className="section-heading compact-heading">
                  <strong>目标大脑模型</strong>
                  <span>{targetModels.length} 可选</span>
                </div>
                <div className="model-filter-row">
                  <label className="search-field">
                    <Search size={16} />
                    <input value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder="搜索模型或厂商" />
                  </label>
                  <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} aria-label="厂商筛选">
                    <option value="all">全部厂商</option>
                    {vendors.map((vendor) => (
                      <option key={vendor} value={vendor}>
                        {vendor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-chips" aria-label="模型类型筛选">
                  <button className={familyFilter === "all" ? "active" : ""} type="button" onClick={() => setFamilyFilter("all")}>
                    全部
                  </button>
                  <button className={familyFilter === "closed" ? "active" : ""} type="button" onClick={() => setFamilyFilter("closed")}>
                    闭源
                  </button>
                  <button className={familyFilter === "open" ? "active" : ""} type="button" onClick={() => setFamilyFilter("open")}>
                    开源
                  </button>
                </div>
                <div className="model-list" role="listbox" aria-label="目标模型列表">
                  {targetModels.map((model) => (
                    <ModelItem
                      key={model.value}
                      title={model.label}
                      vendor={model.vendor}
                      capability={model.vision ? "Vision" : "Text"}
                      meta={model.reasoning ? "Reasoning" : undefined}
                      tag={model.tag}
                      selected={form.targetModel === model.value}
                      onClick={() => onChange({ targetModel: model.value })}
                    />
                  ))}
                </div>
              </section>

              <section className="model-subsection">
                <div className="section-heading compact-heading">
                  <strong>下游生成任务</strong>
                </div>
                <div className="select-card-list">
                  {TASK_CATEGORIES.map((task) => {
                    const Icon = taskIcon[task.key];
                    return (
                      <SelectCard
                        key={task.key}
                        icon={<Icon size={18} />}
                        title={task.name}
                        description={task.desc}
                        selected={form.taskCategory === task.key}
                        onClick={() => onChange({ taskCategory: task.key })}
                      />
                    );
                  })}
                </div>
              </section>

              {form.taskCategory !== "none" && (
                <section className="model-subsection">
                  <div className="section-heading compact-heading">
                    <strong>下游模型</strong>
                    <span>{downstreamOptions.length} 可选</span>
                  </div>
                  <div className="model-list compact" role="listbox" aria-label="下游模型列表">
                    {downstreamOptions.map((model) => (
                      <ModelItem
                        key={model.value}
                        title={model.label}
                        vendor={model.vendor}
                        capability={model.category}
                        tag={model.tag}
                        selected={form.downstreamModel === model.value}
                        onClick={() => onChange({ downstreamModel: model.value })}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="forge-footer" data-testid="configuration-action-bar">
        <Button
          className="generate-button"
          type="button"
          variant="primary"
          status={isGenerating ? "loading" : "idle"}
          disabled={!canGenerate || isGenerating || isReadingImages}
          onClick={onGenerate}
        >
          <Wand2 size={17} />
          {isGenerating ? "生成中..." : isReadingImages ? "读取图片中..." : "生成 System Prompt"}
        </Button>
        <p className={canGenerate && !isReadingImages ? "footer-status ready" : "footer-status"}>
          {actionHint}
          {canGenerate && !isGenerating && !isReadingImages && (
            <span className="shortcut-hint">
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Enter</kbd>
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}

function ConfigurationHeader() {
  return (
    <div className="configuration-header panel-title">
      <div>
        <span>CONFIGURATION</span>
        <h2>参数配置</h2>
      </div>
      <Brain size={20} />
    </div>
  );
}

function ConfigurationSectionNav({
  activeSection,
  onSelect,
}: {
  activeSection: SectionId;
  onSelect(sectionId: SectionId): void;
}) {
  return (
    <nav className="configuration-section-nav" aria-label="配置分区">
      {SECTION_NAV.map((section) => (
        <button
          key={section.id}
          type="button"
          className={activeSection === section.id ? "active" : ""}
          aria-current={activeSection === section.id ? "true" : undefined}
          onClick={() => onSelect(section.id)}
        >
          <span aria-hidden="true" />
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function UploadZone({
  compact = false,
  disabled,
  label,
  description,
  onFiles,
}: {
  compact?: boolean;
  disabled: boolean;
  label: string;
  description: string;
  onFiles(fileList: FileList | null): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const className = compact ? "image-upload-zone image-upload-tile" : "image-upload-zone";

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div
      className={className}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openPicker();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        aria-label={compact ? "添加图片" : "上传图片"}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(",")}
        multiple
        disabled={disabled}
        onChange={(event) => {
          void onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <Upload size={compact ? 16 : 18} />
      <span>{label}</span>
      <small>{description}</small>
    </div>
  );
}

function actionStatusText(form: GenerateRequest, canGenerate: boolean, isGenerating: boolean, isReadingImages: boolean): string {
  if (isReadingImages) return "正在读取图片，完成后即可生成。";
  if (isGenerating) return "正在生成 System Prompt，请稍候。";
  if (canGenerate) return "配置就绪，可以开始生成。";
  if (form.requirement.trim().length < 4) return "至少输入 4 个字。";
  if (!form.providerId) return "请选择 API Provider。";
  if (!form.generationModel.trim()) return "请选择或输入调用模型。";
  if (form.taskCategory !== "none" && !form.downstreamModel) return "请选择下游模型。";
  return "请补全配置后再生成。";
}

function isModelConfigError(error: string): boolean {
  const normalized = error.toLowerCase();
  return Boolean(
    error &&
      (normalized.includes("provider") ||
        normalized.includes("api") ||
        normalized.includes("model") ||
        normalized.includes("base url") ||
        normalized.includes("fetch failed") ||
        normalized.includes("401") ||
        normalized.includes("403") ||
        normalized.includes("模型") ||
        normalized.includes("接口")),
  );
}

function readStoredModelSettingsOpen(): boolean {
  try {
    return localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

async function fileToAttachment(file: File): Promise<ImageAttachment> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as ImageAttachment["mimeType"])) {
    throw new Error(`不支持的图片类型：${file.type || file.name}`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name} 超过 20MB`);
  }

  return {
    id: createClientId(),
    name: file.name,
    mimeType: file.type as ImageAttachment["mimeType"],
    size: file.size,
    dataUrl: await readFileAsDataUrl(file),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("图片读取失败"));
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function createClientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
