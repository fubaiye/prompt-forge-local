import { getDownstreamModel, getTargetModel, TASK_CATEGORIES } from "../../../shared/modelCatalog";
import type { ChatContentPart, ChatMessage, DownstreamModel, GenerateRequest, TaskCategory } from "../../../shared/types";

export function buildPromptMessages(request: GenerateRequest): ChatMessage[] {
  const target = getTargetModel(request.targetModel);
  if (!target) throw new Error("Unknown target model");

  const downstream = request.downstreamModel ? getDownstreamModel(request.downstreamModel) : undefined;
  if (request.taskCategory !== "none" && !downstream) throw new Error("Downstream model is required");

  const task = TASK_CATEGORIES.find((item) => item.key === request.taskCategory);
  const userText = [
    "请为我写一份 System Prompt。",
    `用户需求: ${request.requirement.trim()}`,
    buildFinalIntentGuidance(request.taskCategory),
    buildImageAttachmentGuidance(request),
    `目标模型: ${target.label} (${target.vendor}, ${target.family === "open" ? "开源模型" : "闭源模型"})`,
    `能力边界: ${target.vision ? "目录标记为支持视觉输入" : "目录标记为纯文本模型"}；${
      target.reasoning ? "适合复杂推理任务" : "不强制长 chain-of-thought"
    }${target.tag ? `；标签: ${target.tag}` : ""}`,
    buildVisionGuidance(request.visionEnabled, target.vision),
    `下游任务类型: ${task?.name ?? request.taskCategory}`,
    buildDownstreamGuidance(request.taskCategory, downstream),
    [
      "写作要求:",
      "1. 只输出 System Prompt 正文，使用 Markdown 组织规则、流程和输出格式。",
      "2. 提示词必须贴合目标模型能力边界；对生图任务，只描述可用输入、流程和输出字段，不要写成限制性免责声明。",
      "3. 用户用中文写需求就用中文写提示词，英文需求用英文；默认中文。",
      "4. 用户需求模糊时不要反问，直接采用合理默认假设，产出专业可用版本。",
      "5. 建议长度 300-1000 字，紧凑可执行，避免空泛口号。",
      "6. 需要包含角色定位、任务目标、输入处理、工作流程、输出格式、质量标准和失败处理。",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "你是一位顶尖的 AI Prompt Engineer，擅长为 LLM、VLM、图像与视频工作流撰写可直接复制使用的高质量 System Prompt。只输出 System Prompt 正文，不要前言、寒暄、解释或总结。",
    },
    {
      role: "user",
      content: buildUserContent(userText, request),
    },
  ];
}

function buildUserContent(text: string, request: GenerateRequest): string | ChatContentPart[] {
  if (!request.imageAttachments?.length) return text;
  return [
    { type: "text", text },
    ...request.imageAttachments.map<ChatContentPart>((image) => ({
      type: "image_url",
      image_url: {
        url: image.dataUrl,
        detail: "auto",
      },
    })),
  ];
}

function buildImageAttachmentGuidance(request: GenerateRequest): string {
  if (!request.imageAttachments?.length) return "";
  const imageList = request.imageAttachments
    .map((image, index) => `图${index + 1}: ${image.name} (${image.mimeType}, ${Math.round(image.size / 1024)}KB)`)
    .join("\n");

  return [
    "已上传图像:",
    imageList,
    "请先观察这些图片。用户会用图1、图2等编号引用它们；需要区分风格参考图、主体图、目标编辑图和普通上下文图。",
    "生成 System Prompt 时，要让目标模型明确先读图，再结合用户文字，把自然语言需求优化成适合下游生图或改图模型理解的提示词。",
  ].join("\n");
}

function buildFinalIntentGuidance(category: TaskCategory): string {
  if (!["text2img", "img2img", "edit"].includes(category)) return "";

  return [
    "最终目标是生成图像。",
    "本次输出要服务于文生图、图生图或图像编辑模型，帮助用户得到更贴合想法的图片结果。",
    "生成的 System Prompt 必须驱动目标大脑模型产出可直接复制到下游生图模型的 prompt 或编辑指令。",
    "最终输出不得包含否定生图能力、拒绝生成图片、强调无法出图、声明不负责生成、或把自己降格为纯文本指令搬运的措辞。",
    "如果需要表达边界，请改写为：输出可直接交给下游模型执行的图像生成 prompt。",
  ].join("\n");
}

function buildVisionGuidance(visionEnabled: boolean, targetSupportsVision: boolean): string {
  if (!visionEnabled) {
    return "视觉输入: 未启用。System Prompt 不要要求模型看图、读视频或解析视觉输入。";
  }

  if (!targetSupportsVision) {
    return "视觉输入: 用户希望启用，但目标模型目录标记为纯文本。System Prompt 应要求用户用文字描述图像，而不是让模型直接看图。";
  }

  return "视觉输入: 已启用。System Prompt 必须明确模型如何解析图片或视频输入，包括主体、场景、文字、构图、光线、动作和不确定性处理。";
}

function buildDownstreamGuidance(category: TaskCategory, downstream?: DownstreamModel): string {
  if (category === "none") {
    return "下游模型: 无。System Prompt 只服务于目标大脑模型本身，不输出给生图或视频模型的 prompt 模板。";
  }

  if (!downstream) throw new Error("Downstream model is required");

  const header = `下游模型: ${downstream.label} (${downstream.vendor}, ${
    downstream.family === "open" ? "开源" : "闭源"
  })${downstream.tag ? `；标签: ${downstream.tag}` : ""}`;

  const guidance: Record<Exclude<TaskCategory, "none">, string> = {
    text2img: [
      header,
      "写作要点: 目标大脑模型需要按固定字段输出文生图 prompt，可直接复制给下游模型。",
      "字段必须包含: subject, scene, style, lighting, composition, camera, quality_boosters, negative_prompt。",
      "根据下游生态调整语法: SD/Flux 可使用 (word:1.2)，Midjourney 可使用 ::weight，DALL-E/GPT-Image 偏好自然语言完整句。",
    ].join("\n"),
    img2img: [
      header,
      "写作要点: 目标大脑模型需要先分析参考图，再输出可执行的图生图 prompt。",
      "字段必须包含: reference_analysis, preserve, modify, style, strength_hint, prompt, negative_prompt。",
      "必须明确哪些元素保持不变，哪些元素允许重绘或风格化。",
      "当用户上传多张图时，必须按图1、图2等编号说明每张图的角色，例如风格参考图、主体图、目标编辑图。",
    ].join("\n"),
    edit: [
      header,
      "写作要点: 目标大脑模型需要把自然语言编辑指令拆成可执行操作序列。",
      "输出必须包含 JSON 数组 operations，以及最终给下游模型的自然语言编辑指令。",
      "每个操作包含 target, action, constraints, mask_hint, priority, failure_risk。",
      "当涉及文字、Logo、UI 或海报时，必须强调可读性、边缘清晰、无乱码、无错别字和不破坏原始信息。",
    ].join("\n"),
    text2video: [
      header,
      "写作要点: 目标大脑模型需要输出文生视频 prompt 与参数建议。",
      "字段必须包含: subject, action, scene, camera_motion, duration, rhythm, first_frame, last_frame, sound, style, negative_prompt。",
      "必须按下游模型习惯组织主语、动作、场景、镜头和质量词。",
    ].join("\n"),
    img2video: [
      header,
      "写作要点: 目标大脑模型需要先严格描述首帧，再规划视频运动。",
      "字段必须包含: first_frame_analysis, subject_motion, camera_motion, duration, rhythm, end_frame_expectation, sound, negative_prompt。",
      "必须提醒模型避免主体漂移、五官熔化、闪烁、变形和多余肢体。",
    ].join("\n"),
  };

  return guidance[category];
}
