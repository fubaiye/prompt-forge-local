import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { createGenerateRouter } from "./routes/generate";
import { createHistoryRouter } from "./routes/history";
import { createProvidersRouter } from "./routes/providers";
import { createUpdateRouter, type UpdateRouterOptions } from "./routes/update";
import { createHistoryStore } from "./storage/historyStore";
import { createProviderStore } from "./storage/providerStore";

export interface CreateAppOptions {
  dataDir?: string;
  clientDist?: string;
  update?: UpdateRouterOptions;
}

export interface StartServerOptions extends CreateAppOptions {
  host?: string;
  port?: number;
}

export interface StartedServer {
  app: Express;
  server: Server;
  url: string;
  close(): Promise<void>;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const dataDir = options.dataDir ?? process.env.PROMPT_FORGE_DATA_DIR ?? path.resolve(process.cwd(), "data");
  const providers = createProviderStore(dataDir);
  const history = createHistoryStore(dataDir);

  app.use("/api/generate", express.json({ limit: "36mb" }), createGenerateRouter(providers, history));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/providers", createProvidersRouter(providers));
  app.use("/api/history", createHistoryRouter(history));
  app.use("/api/update", createUpdateRouter(options.update));

  const clientDist = options.clientDist ?? process.env.PROMPT_FORGE_CLIENT_DIST ?? path.resolve(process.cwd(), "dist");
  const indexHtml = path.join(clientDist, "index.html");
  if (existsSync(indexHtml)) {
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  return app;
}

export async function startServer(options: StartServerOptions = {}): Promise<StartedServer> {
  const host = options.host ?? process.env.PROMPT_FORGE_HOST ?? "127.0.0.1";
  const envPort = Number.parseInt(process.env.PROMPT_FORGE_PORT ?? "", 10);
  const port = options.port ?? (Number.isFinite(envPort) ? envPort : 8787);
  const app = createApp(options);
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    app,
    server,
    url: `http://${host}:${actualPort}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
