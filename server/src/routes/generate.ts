import { Router } from "express";
import { getDownstreamModel, getTargetModel } from "../../../shared/modelCatalog";
import type { GenerateRequest, ImageAttachment, ImageAttachmentSummary, TaskCategory } from "../../../shared/types";
import { isNonEmptyString } from "../../../shared/validation";
import { buildPromptMessages } from "../services/promptBuilder";
import { callChatCompletion } from "../services/openAiCompatible";
import type { HistoryStore } from "../storage/historyStore";
import type { ProviderStore } from "../storage/providerStore";

const TASKS: TaskCategory[] = ["none", "text2img", "img2img", "edit", "text2video", "img2video"];
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_IMAGE_ATTACHMENTS = 6;
const MAX_IMAGE_DATA_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_IMAGE_DATA_BYTES = 24 * 1024 * 1024;

export function createGenerateRouter(providerStore: ProviderStore, historyStore: HistoryStore) {
  const router = Router();

  router.post("/", async (req, res) => {
    let request: GenerateRequest;
    try {
      request = validateGenerateRequest(req.body);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
      return;
    }

    const provider = await providerStore.get(request.providerId);
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }

    try {
      const messages = buildPromptMessages(request);
      const result = await callChatCompletion(provider, request, messages);
      const historyItem = await historyStore.create({
        ...request,
        imageAttachments: summarizeImageAttachments(request.imageAttachments),
        systemPrompt: result.text,
      });
      res.json({ systemPrompt: result.text, usage: result.usage, historyItem });
    } catch (error) {
      res.status(502).json({ error: errorMessage(error) });
    }
  });

  return router;
}

function validateGenerateRequest(body: any): GenerateRequest {
  const requirement = requiredString(body?.requirement, "requirement");
  if (requirement.length < 4) throw new Error("requirement must be at least 4 characters");

  const providerId = requiredString(body?.providerId, "providerId");
  const generationModel = requiredString(body?.generationModel, "generationModel");
  const targetModel = requiredString(body?.targetModel, "targetModel");
  if (!getTargetModel(targetModel)) throw new Error("Unknown target model");

  const taskCategory = requiredTask(body?.taskCategory);
  const downstreamModel = optionalString(body?.downstreamModel);
  if (taskCategory !== "none") {
    if (!downstreamModel) throw new Error("Downstream model is required");
    const downstream = getDownstreamModel(downstreamModel);
    if (!downstream) throw new Error("Unknown downstream model");
    if (downstream.category !== taskCategory) throw new Error("Downstream model does not match task category");
  }

  return {
    requirement,
    providerId,
    generationModel,
    targetModel,
    visionEnabled: Boolean(body?.visionEnabled),
    taskCategory,
    downstreamModel,
    imageAttachments: validateImageAttachments(body?.imageAttachments, Boolean(body?.visionEnabled)),
  };
}

function validateImageAttachments(value: unknown, visionEnabled: boolean): ImageAttachment[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error("imageAttachments must be an array");
  if (value.length === 0) return undefined;
  if (!visionEnabled) throw new Error("visionEnabled is required when image attachments are provided");
  if (value.length > MAX_IMAGE_ATTACHMENTS) {
    throw new Error(`imageAttachments cannot exceed ${MAX_IMAGE_ATTACHMENTS} images`);
  }

  const attachments = value.map((item, index) => validateImageAttachment(item, index));
  const totalBytes = attachments.reduce((sum, image) => sum + image.size, 0);
  if (totalBytes > MAX_TOTAL_IMAGE_DATA_BYTES) {
    throw new Error("imageAttachments exceed the 24MB total limit");
  }
  return attachments;
}

function validateImageAttachment(value: unknown, index: number): ImageAttachment {
  if (typeof value !== "object" || value === null) {
    throw new Error(`imageAttachments[${index}] must be an object`);
  }

  const record = value as Record<string, unknown>;
  const id = requiredString(record.id, `imageAttachments[${index}].id`);
  const name = requiredString(record.name, `imageAttachments[${index}].name`);
  const mimeType = requiredString(record.mimeType, `imageAttachments[${index}].mimeType`);
  if (!isSupportedImageType(mimeType)) throw new Error(`Unsupported image type: ${mimeType}`);

  const size = Number(record.size);
  if (!Number.isInteger(size) || size <= 0) throw new Error(`imageAttachments[${index}].size is invalid`);

  const dataUrl = requiredString(record.dataUrl, `imageAttachments[${index}].dataUrl`);
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) throw new Error(`imageAttachments[${index}].dataUrl is invalid`);

  const base64 = dataUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error(`imageAttachments[${index}].dataUrl is invalid`);
  const imageBytes = decodeImageBytes(base64, index);
  if (imageBytes.length !== size) {
    throw new Error(`imageAttachments[${index}].size does not match decoded image`);
  }
  if (imageBytes.length > MAX_IMAGE_DATA_BYTES) {
    throw new Error(`imageAttachments[${index}] exceeds 20MB`);
  }
  if (!matchesImageSignature(imageBytes, mimeType)) {
    throw new Error(`imageAttachments[${index}] does not match image type`);
  }

  return { id, name, mimeType, size, dataUrl };
}

function decodeImageBytes(base64: string, index: number): Buffer {
  const imageBytes = Buffer.from(base64, "base64");
  if (imageBytes.length === 0 || imageBytes.toString("base64") !== base64) {
    throw new Error(`imageAttachments[${index}].dataUrl is invalid`);
  }
  return imageBytes;
}

function matchesImageSignature(imageBytes: Buffer, mimeType: ImageAttachment["mimeType"]): boolean {
  if (mimeType === "image/png") {
    return (
      imageBytes.length >= 8 &&
      imageBytes[0] === 0x89 &&
      imageBytes[1] === 0x50 &&
      imageBytes[2] === 0x4e &&
      imageBytes[3] === 0x47 &&
      imageBytes[4] === 0x0d &&
      imageBytes[5] === 0x0a &&
      imageBytes[6] === 0x1a &&
      imageBytes[7] === 0x0a
    );
  }

  if (mimeType === "image/jpeg") {
    return imageBytes.length >= 3 && imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
  }

  return (
    imageBytes.length >= 12 &&
    imageBytes.toString("ascii", 0, 4) === "RIFF" &&
    imageBytes.toString("ascii", 8, 12) === "WEBP"
  );
}

function summarizeImageAttachments(value: ImageAttachment[] | undefined): ImageAttachmentSummary[] | undefined {
  if (!value?.length) return undefined;
  return value.map(({ id, name, mimeType, size }) => ({ id, name, mimeType, size }));
}

function isSupportedImageType(value: string): value is ImageAttachment["mimeType"] {
  return SUPPORTED_IMAGE_TYPES.includes(value as ImageAttachment["mimeType"]);
}

function requiredString(value: unknown, field: string): string {
  if (!isNonEmptyString(value)) throw new Error(`${field} is required`);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function requiredTask(value: unknown): TaskCategory {
  if (!isNonEmptyString(value) || !TASKS.includes(value as TaskCategory)) {
    throw new Error("taskCategory is invalid");
  }
  return value as TaskCategory;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown generation error";
}
