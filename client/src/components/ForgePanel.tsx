import {
  Brain,
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
import { useMemo, useState } from "react";
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
  onChange(patch: Partial<GenerateRequest>): void;
  onGenerate(): void;
  onOpenSettings(): void;
}

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
  const [modelQuery, setModelQuery] = useState("");
  const [imageError, setImageError] = useState("");
  const [isReadingImages, setIsReadingImages] = useState(false);

  const vendors = useMemo(() => Array.from(new Set(TARGET_MODELS.map((model) => model.vendor))).sort(), []);
  const selectedTarget = TARGET_MODELS.find((model) => model.value === form.targetModel);
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

  function setVisionEnabled(visionEnabled: boolean) {
    const patch: Partial<GenerateRequest> = { visionEnabled };
    if (!visionEnabled) patch.imageAttachments = undefined;
    if (visionEnabled && !selectedTarget?.vision) {
      patch.targetModel = TARGET_MODELS.find((model) => model.vision)?.value ?? form.targetModel;
    }
    onChange(patch);
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
    onChange({ imageAttachments: form.imageAttachments?.filter((image) => image.id !== id) });
  }

  return (
    <Card className="forge-panel" aria-label="提示词配置栏">
      <div className="forge-scroll">
        <div className="panel-title">
          <div>
            <span>CONFIGURATION</span>
            <h2>参数配置</h2>
          </div>
          <Brain size={20} />
        </div>

        <section className="config-section">
          <div className="section-heading">
            <strong>需求 / 使用场景</strong>
            <span>{form.requirement.trim().length} chars</span>
          </div>
          <textarea
            value={form.requirement}
            onChange={(event) => onChange({ requirement: event.target.value })}
            placeholder="例如：参考图1的表达方式及颜色，将图2变成一样的，字体清晰无锯齿"
            rows={5}
          />
          <p className="field-help">写清角色、任务、输出风格和限制。上传图片后可直接用“图1、图2”引用。</p>
        </section>

        <section className="config-section">
          <div className="section-heading">
            <strong>参考图片</strong>
            <span>{form.imageAttachments?.length ?? 0}/{MAX_IMAGE_ATTACHMENTS}</span>
          </div>
          <label
            className="image-upload-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void addImageFiles(event.dataTransfer.files);
            }}
          >
            <input
              aria-label="上传图片"
              type="file"
              accept={SUPPORTED_IMAGE_TYPES.join(",")}
              multiple
              disabled={isReadingImages || isGenerating}
              onChange={(event) => {
                void addImageFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <Upload size={18} />
            <span>点击或拖拽上传图片</span>
            <small>支持 PNG / JPG / WebP，单张不超过 20MB，总计不超过 24MB。需求里可写“参考图1，把图2改成...”</small>
          </label>
          {imageError && <p className="image-upload-error">{imageError}</p>}
          {form.imageAttachments?.length ? (
            <div className="image-attachment-list" aria-label="已上传图片">
              {form.imageAttachments.map((image, index) => (
                <article key={image.id} className="image-attachment">
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
            </div>
          ) : null}
        </section>

        <section className="config-section">
          <div className="section-heading">
            <strong>本地 API</strong>
          </div>
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
          {providers.length === 0 && (
            <Button className="full-width" type="button" variant="secondary" onClick={onOpenSettings}>
              <Settings size={16} />
              添加 OpenAI-Compatible API
            </Button>
          )}
        </section>

        <section className="config-section">
          <div className="section-heading">
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

        <section className="config-section">
          <div className="section-heading">
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

        <section className="config-section">
          <div className="section-heading">
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
          <section className="config-section">
            <div className="section-heading">
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

      <div className="forge-footer">
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
          {isReadingImages
            ? "正在读取图片，完成后即可生成。"
            : canGenerate
              ? "配置已就绪，可以开始生成。"
              : "至少输入 4 个字，并选择 API Provider 与调用模型。"}
        </p>
      </div>
    </Card>
  );
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
