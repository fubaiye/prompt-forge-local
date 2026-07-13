import express from "express";
import { fileURLToPath } from "node:url";
import { createGenerateRouter } from "./routes/generate";
import { createHistoryRouter } from "./routes/history";
import { createProvidersRouter } from "./routes/providers";
import { createHistoryStore } from "./storage/historyStore";
import { createProviderStore } from "./storage/providerStore";

const app = express();
const dataDir = fileURLToPath(new URL("../../data", import.meta.url));
const providers = createProviderStore(dataDir);
const history = createHistoryStore(dataDir);

app.use(express.json({ limit: "1mb" }));
app.use("/api/providers", createProvidersRouter(providers));
app.use("/api/history", createHistoryRouter(history));
app.use("/api/generate", createGenerateRouter(providers, history));

app.listen(8787, "127.0.0.1", () => {
  console.log("Prompt Forge API listening on http://127.0.0.1:8787");
});
