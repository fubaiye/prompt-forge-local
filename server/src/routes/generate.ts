import { Router } from "express";
import { getDownstreamModel, getTargetModel } from "../../../shared/modelCatalog";
import type { GenerateRequest, TaskCategory } from "../../../shared/types";
import { isNonEmptyString } from "../../../shared/validation";
import { buildPromptMessages } from "../services/promptBuilder";
import { callChatCompletion } from "../services/openAiCompatible";
import type { HistoryStore } from "../storage/historyStore";
import type { ProviderStore } from "../storage/providerStore";

const TASKS: TaskCategory[] = ["none", "text2img", "img2img", "edit", "text2video", "img2video"];

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
      const historyItem = await historyStore.create({ ...request, systemPrompt: result.text });
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
  };
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
