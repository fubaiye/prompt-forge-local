import { Router } from "express";
import type { ProviderStore } from "../storage/providerStore";

export function createProvidersRouter(providerStore: ProviderStore) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await providerStore.listMasked());
  });

  router.post("/", async (req, res) => {
    try {
      const provider = await providerStore.create(req.body);
      const [masked] = (await providerStore.listMasked()).filter((item) => item.id === provider.id);
      res.status(201).json(masked);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const provider = await providerStore.update(req.params.id, req.body);
      const [masked] = (await providerStore.listMasked()).filter((item) => item.id === provider.id);
      res.json(masked);
    } catch (error) {
      res.status(errorMessage(error) === "Provider not found" ? 404 : 400).json({ error: errorMessage(error) });
    }
  });

  router.delete("/:id", async (req, res) => {
    await providerStore.delete(req.params.id);
    res.status(204).end();
  });

  return router;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown provider error";
}
