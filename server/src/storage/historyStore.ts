import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { GenerateRequest, HistoryItem } from "../../../shared/types";
import { createJsonFileStore } from "./jsonFileStore";

export interface HistoryInput extends GenerateRequest {
  systemPrompt: string;
}

export interface HistoryStore {
  list(): Promise<HistoryItem[]>;
  create(input: HistoryInput): Promise<HistoryItem>;
  delete(id: string): Promise<void>;
}

export function createHistoryStore(dataDir: string): HistoryStore {
  const store = createJsonFileStore<HistoryItem[]>(join(dataDir, "history.json"), []);

  return {
    async list() {
      return store.read();
    },

    async create(input) {
      const item: HistoryItem = {
        id: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      };
      const history = await store.read();
      history.unshift(item);
      await store.write(history.slice(0, 100));
      return item;
    },

    async delete(id) {
      const history = await store.read();
      await store.write(history.filter((item) => item.id !== id));
    },
  };
}
