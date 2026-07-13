import { Router } from "express";
import type { HistoryStore } from "../storage/historyStore";

export function createHistoryRouter(historyStore: HistoryStore) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await historyStore.list());
  });

  router.post("/", async (req, res) => {
    try {
      res.status(201).json(await historyStore.create(req.body));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unknown history error" });
    }
  });

  router.delete("/:id", async (req, res) => {
    await historyStore.delete(req.params.id);
    res.status(204).end();
  });

  return router;
}
