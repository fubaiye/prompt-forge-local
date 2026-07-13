import { getDownstreamModel, getTargetModel, TASK_CATEGORIES } from "../../../shared/modelCatalog";
import type { ChatMessage, DownstreamModel, GenerateRequest, TaskCategory } from "../../../shared/types";

export function buildPromptMessages(request: GenerateRequest): ChatMessage[] {
  const target = getTargetModel(request.targetModel);
  if (!target) throw new Error("Unknown target model");

  const downstream = request.downstreamModel ? getDownstreamModel(request.downstreamModel) : undefined;
  if (request.taskCategory !== "none" && !downstream) throw new Error("Downstream model is required");

  const task = TASK_CATEGORIES.find((item) => item.key === request.taskCategory);
  const visionGuidance = buildVisionGuidance(request.visionEnabled, target.vision);

  return [
    {
      role: "system",
      content:
        "你是一位顶尖的 AI Prompt Engineer，擅长为任意 LLM、VLM、图像与视频工作流撰写可直接复制使用的高质量 System Prompt。只输出 System Prompt 正文，不要前言、寒暄、解释或总结。",
    },
    {
      role: "user",
      content: [
        "请为我写一份 System Prompt。",
        `用户需求: ${request.requirement.trim()}`,
        `目标模型: ${target.label} (${target.vendor}, ${target.family === "open" ? "开源模型" : "闭源模型"})`,
        `能力边界: ${target.vision ? "目录标记为支持视觉输入" : "目录标记为纯文本模型"}；${
          target.reasoning ? "适合复杂推理任务" : "不强制长 chain-of-thought"
        }${target.tag ? `；标签: ${target.tag}` : ""}`,
        visionGuidance,
        `下游任务类型: ${task?.name ?? request.taskCategory}`,
        buildDownstreamGuidance(request.taskCategory, downstream),
        [
          "写作要求:",
          "1. 只输出 System Prompt 正文，使用 Markdown 组织规则、流程和输出格式。",
          "2. 提示词必须贴合目标模型能力边界，不要要求模型执行它不支持的输入或工具能力。",
          "3. 用户用中文写需求就用中文写提示词，英文需求用英文；默认中文。",
          "4. 用户需求模糊时不要反问，直接采用合理默认假设，产出专业可用版本。",
          "5. 建议长度 300-1000 字，紧凑可执行，避免空泛口号。",
          "6. 需要包含角色定位、任务目标、输入处理、工作流程、输出格式、质量标准和失败处理。",
        ].join("\n"),
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
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
    ].join("\n"),
    edit: [
      header,
      "写作要点: 目标大脑模型需要把自然语言编辑指令拆成可执行操作序列。",
      "输出必须包含 JSON 数组 operations，以及最终给下游模型的自然语言编辑指令。",
      "每个操作包含 target, action, constraints, mask_hint, priority, failure_risk。",
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
