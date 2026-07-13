# Prompt Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Prompt Forge web app that generates model-aware System Prompts through user-configured OpenAI-compatible API providers.

**Architecture:** A Vite React client talks to an Express TypeScript server. Shared TypeScript modules define model catalogs and request shapes. The server stores providers and history in local JSON files and calls OpenAI-compatible `/chat/completions` endpoints without exposing API keys to the browser.

**Tech Stack:** Node.js, TypeScript, Vite, React, Express, Vitest, native `fetch`, JSON file storage.

## Global Constraints

- Local-only app; no cloud sync, user login, telemetry, RunningHub billing, or hosting.
- API keys are stored only under local `data/` JSON and never returned unmasked to the frontend.
- First version calls only OpenAI-compatible chat completions.
- Direct image/video generation is out of scope.
- The app opens directly into the forge workspace, not a marketing landing page.
- The UI must include rich target and downstream model catalogs seeded from the reference app families.

---

## File Structure

- `package.json`: root scripts and dependencies for client, server, tests, and build.
- `tsconfig.json`: shared TypeScript settings for all source and tests.
- `vite.config.ts`: Vite React config with `/api` proxy to the local server.
- `vitest.config.ts`: Vitest config for shared and server tests.
- `index.html`: Vite app shell.
- `.gitignore`: ignore dependencies, build output, logs, and local data JSON with API keys.
- `shared/types.ts`: shared TypeScript interfaces and enums.
- `shared/modelCatalog.ts`: seeded target and downstream model catalogs plus lookup helpers.
- `shared/validation.ts`: small runtime validation helpers used by server routes.
- `server/src/index.ts`: Express bootstrap and route wiring.
- `server/src/storage/jsonFileStore.ts`: atomic-ish local JSON read/write helper.
- `server/src/storage/providerStore.ts`: provider persistence with masking.
- `server/src/storage/historyStore.ts`: history persistence.
- `server/src/services/promptBuilder.ts`: prompt-engineering message construction.
- `server/src/services/openAiCompatible.ts`: provider call wrapper.
- `server/src/routes/providers.ts`: provider CRUD endpoints.
- `server/src/routes/history.ts`: history endpoints.
- `server/src/routes/generate.ts`: generation endpoint.
- `client/src/main.tsx`: React entry point.
- `client/src/App.tsx`: top-level app state and layout.
- `client/src/api.ts`: frontend API wrapper.
- `client/src/components/ForgePanel.tsx`: left-side forge controls.
- `client/src/components/ResultPanel.tsx`: output viewer and actions.
- `client/src/components/ProviderSettings.tsx`: local provider settings modal.
- `client/src/components/HistoryPanel.tsx`: recent generated prompts.
- `client/src/styles.css`: responsive dark workbench UI.
- `tests/shared/modelCatalog.test.ts`: catalog helper tests.
- `tests/server/providerStore.test.ts`: provider masking and storage tests.
- `tests/server/promptBuilder.test.ts`: prompt construction tests.
- `tests/server/generateRoute.test.ts`: mocked generation route tests.

---

### Task 1: Project Skeleton And Shared Catalog

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `shared/types.ts`
- Create: `shared/modelCatalog.ts`
- Create: `shared/validation.ts`
- Create: `tests/shared/modelCatalog.test.ts`

**Interfaces:**
- Produces: `TaskCategory`, `TargetModel`, `DownstreamModel`, `ProviderRecord`, `HistoryItem` from `shared/types.ts`.
- Produces: `TARGET_MODELS`, `DOWNSTREAM_MODELS`, `TASK_CATEGORIES`, `getTargetModel(value)`, `getDownstreamModel(value)`, `getDownstreamModels(category)` from `shared/modelCatalog.ts`.
- Produces: `isNonEmptyString(value)`, `normalizeBaseUrl(value)`, `maskApiKey(value)` from `shared/validation.ts`.

- [ ] **Step 1: Write failing catalog tests**

Create `tests/shared/modelCatalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DOWNSTREAM_MODELS,
  TARGET_MODELS,
  getDownstreamModels,
  getTargetModel,
} from "../../shared/modelCatalog";

describe("model catalog", () => {
  it("seeds a rich target model catalog", () => {
    expect(TARGET_MODELS.length).toBeGreaterThanOrEqual(30);
    expect(getTargetModel("gpt-4o")?.vendor).toBe("OpenAI");
    expect(getTargetModel("qwen3-vl-72b")?.vision).toBe(true);
  });

  it("filters downstream models by task category", () => {
    expect(DOWNSTREAM_MODELS.length).toBeGreaterThanOrEqual(60);
    expect(getDownstreamModels("text2img").every((model) => model.category === "text2img")).toBe(true);
    expect(getDownstreamModels("img2video").some((model) => model.label.includes("Veo"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/shared/modelCatalog.test.ts`

Expected: fails before dependencies and source files exist.

- [ ] **Step 3: Add root project files**

Create `package.json`:

```json
{
  "name": "prompt-forge-local",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite --host 127.0.0.1\" \"tsx watch server/src/index.ts\"",
    "dev:server": "tsx watch server/src/index.ts",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.2",
    "express": "^4.21.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.5",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["client/src", "server/src", "shared", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>提示词工坊 / Prompt Forge</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client/src/main.tsx"></script>
  </body>
</html>
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.vite/
*.log
data/*.json
!data/.gitkeep
```

- [ ] **Step 4: Add shared types, validation, and model catalog**

Create `shared/types.ts` with `TaskCategory`, `ModelFamily`, `TargetModel`, `DownstreamModel`, `ProviderRecord`, `MaskedProvider`, `HistoryItem`, and `GenerateRequest` interfaces.

Create `shared/validation.ts` with:

```ts
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function maskApiKey(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
```

Create `shared/modelCatalog.ts` with the reference app's seeded target and downstream model entries and helper functions:

```ts
export function getTargetModel(value: string): TargetModel | undefined {
  return TARGET_MODELS.find((model) => model.value === value);
}

export function getDownstreamModel(value: string): DownstreamModel | undefined {
  return DOWNSTREAM_MODELS.find((model) => model.value === value);
}

export function getDownstreamModels(category: Exclude<TaskCategory, "none">): DownstreamModel[] {
  return DOWNSTREAM_MODELS.filter((model) => model.category === category);
}
```

- [ ] **Step 5: Install dependencies and verify tests**

Run: `npm.cmd install`

Expected: exits 0 and creates `package-lock.json`.

Run: `npm.cmd test -- tests/shared/modelCatalog.test.ts`

Expected: passes 2 tests.

- [ ] **Step 6: Commit**

```bash
git add .gitignore index.html package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts shared tests/shared
git commit -m "chore: scaffold prompt forge app"
```

---

### Task 2: Local Storage, Providers, And History

**Files:**
- Create: `server/src/storage/jsonFileStore.ts`
- Create: `server/src/storage/providerStore.ts`
- Create: `server/src/storage/historyStore.ts`
- Create: `server/src/routes/providers.ts`
- Create: `server/src/routes/history.ts`
- Create: `tests/server/providerStore.test.ts`
- Create: `data/.gitkeep`

**Interfaces:**
- Consumes: provider/history types and `maskApiKey`.
- Produces: `createProviderStore(dataDir)`, `createHistoryStore(dataDir)`.
- Produces Express routers `createProvidersRouter(providerStore)` and `createHistoryRouter(historyStore)`.

- [ ] **Step 1: Write failing provider storage tests**

Create `tests/server/providerStore.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProviderStore } from "../../server/src/storage/providerStore";

let tempDir = "";

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe("provider store", () => {
  it("masks API keys when listing providers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const store = createProviderStore(tempDir);
    const provider = await store.create({
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1/",
      apiKey: "sk-test-1234567890",
      models: ["openai/gpt-4o"],
      defaultModel: "openai/gpt-4o",
    });

    const list = await store.listMasked();

    expect(provider.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(list[0].apiKey).toBeUndefined();
    expect(list[0].apiKeyMasked).toBe("sk-t••••7890");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/server/providerStore.test.ts`

Expected: fails because storage files do not exist.

- [ ] **Step 3: Implement JSON storage and provider store**

Create `server/src/storage/jsonFileStore.ts` exporting `createJsonFileStore<T>(filePath, fallback)`.

Create `server/src/storage/providerStore.ts` with `create`, `update`, `delete`, `get`, `listMasked`, and `listRaw` methods. Generate ids with `crypto.randomUUID()`, normalize `baseUrl`, and return `apiKeyMasked` only from `listMasked`.

- [ ] **Step 4: Implement history store and routes**

Create `server/src/storage/historyStore.ts` with `list`, `create`, and `delete`.

Create `server/src/routes/providers.ts`:

```ts
import { Router } from "express";

export function createProvidersRouter(providerStore: ProviderStore) {
  const router = Router();
  router.get("/", async (_req, res) => res.json(await providerStore.listMasked()));
  router.post("/", async (req, res) => res.status(201).json(await providerStore.create(req.body)));
  router.put("/:id", async (req, res) => res.json(await providerStore.update(req.params.id, req.body)));
  router.delete("/:id", async (req, res) => {
    await providerStore.delete(req.params.id);
    res.status(204).end();
  });
  return router;
}
```

Create `server/src/routes/history.ts` with `GET /`, `POST /`, and `DELETE /:id`.

- [ ] **Step 5: Verify tests**

Run: `npm.cmd test -- tests/server/providerStore.test.ts`

Expected: passes provider masking test.

- [ ] **Step 6: Commit**

```bash
git add server/src/storage server/src/routes tests/server/providerStore.test.ts data/.gitkeep
git commit -m "feat: add local provider storage"
```

---

### Task 3: Prompt Builder

**Files:**
- Create: `server/src/services/promptBuilder.ts`
- Create: `tests/server/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `GenerateRequest`, target catalog, downstream catalog.
- Produces: `buildPromptMessages(request): { role: "system" | "user"; content: string }[]`.

- [ ] **Step 1: Write failing prompt builder tests**

Create `tests/server/promptBuilder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPromptMessages } from "../../server/src/services/promptBuilder";

describe("prompt builder", () => {
  it("includes target model capabilities and user requirement", () => {
    const messages = buildPromptMessages({
      requirement: "我要一个小红书美妆种草助手",
      providerId: "provider-1",
      generationModel: "gpt-4o",
      targetModel: "claude-sonnet-5",
      visionEnabled: true,
      taskCategory: "none",
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain("Prompt Engineer");
    expect(messages[1].content).toContain("Claude Sonnet 5");
    expect(messages[1].content).toContain("视觉输入");
    expect(messages[1].content).toContain("小红书美妆种草助手");
  });

  it("adds downstream text-to-image schema guidance", () => {
    const messages = buildPromptMessages({
      requirement: "生成儿童绘本插画提示词助手",
      providerId: "provider-1",
      generationModel: "gpt-4o",
      targetModel: "gpt-4o",
      visionEnabled: false,
      taskCategory: "text2img",
      downstreamModel: "midjourney-v7",
    });

    expect(messages[1].content).toContain("Midjourney V7");
    expect(messages[1].content).toContain("subject");
    expect(messages[1].content).toContain("negative_prompt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/server/promptBuilder.test.ts`

Expected: fails because `promptBuilder.ts` does not exist.

- [ ] **Step 3: Implement prompt builder**

Create `server/src/services/promptBuilder.ts` with:

```ts
export function buildPromptMessages(request: GenerateRequest): ChatMessage[] {
  const target = getTargetModel(request.targetModel);
  if (!target) throw new Error("Unknown target model");
  const downstream = request.downstreamModel ? getDownstreamModel(request.downstreamModel) : undefined;
  if (request.taskCategory !== "none" && !downstream) throw new Error("Downstream model is required");

  return [
    {
      role: "system",
      content:
        "你是一位顶尖的 AI Prompt Engineer，擅长为任意 LLM/VLM/图像/视频工作流撰写可直接复制使用的高质量 System Prompt。只输出 System Prompt 正文，不要前言、寒暄、解释或总结。",
    },
    {
      role: "user",
      content: [
        `用户需求: ${request.requirement.trim()}`,
        `目标模型: ${target.label} (${target.vendor}, ${target.family === "open" ? "开源" : "闭源"})`,
        `能力边界: ${target.vision ? "模型支持视觉输入" : "纯文本模型"}; ${target.reasoning ? "适合复杂推理" : "不强制长链路推理"}`,
        `视觉输入: ${request.visionEnabled ? "启用，System Prompt 需要说明如何解析视觉输入" : "未启用，不要要求模型看图"}`,
        buildDownstreamGuidance(request.taskCategory, downstream),
        "写作要求: 输出结构化、专业、可落地、即拷即用的 System Prompt；用户需求模糊时直接采用合理默认假设；默认使用用户输入语言。",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}
```

Also implement `buildDownstreamGuidance` with the five task-specific schemas from the design document.

- [ ] **Step 4: Verify tests**

Run: `npm.cmd test -- tests/server/promptBuilder.test.ts`

Expected: passes 2 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/promptBuilder.ts tests/server/promptBuilder.test.ts
git commit -m "feat: build model-aware prompt messages"
```

---

### Task 4: Generation API

**Files:**
- Create: `server/src/services/openAiCompatible.ts`
- Create: `server/src/routes/generate.ts`
- Create: `server/src/index.ts`
- Create: `tests/server/generateRoute.test.ts`

**Interfaces:**
- Consumes: provider store, history store, prompt builder.
- Produces: `callChatCompletion(provider, request, messages, signal?)`.
- Produces: `POST /api/generate`.

- [ ] **Step 1: Write failing generation route test**

Create `tests/server/generateRoute.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGenerateRouter } from "../../server/src/routes/generate";
import { createHistoryStore } from "../../server/src/storage/historyStore";
import { createProviderStore } from "../../server/src/storage/providerStore";

let tempDir = "";

afterEach(async () => {
  vi.restoreAllMocks();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe("generate route", () => {
  it("calls the configured provider and saves history", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const providers = createProviderStore(tempDir);
    const history = createHistoryStore(tempDir);
    const provider = await providers.create({
      name: "Test",
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test-1234567890",
      models: ["gpt-4o"],
      defaultModel: "gpt-4o",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "SYSTEM PROMPT RESULT" } }], usage: { total_tokens: 42 } }),
      })) as unknown as typeof fetch,
    );

    const app = express();
    app.use(express.json());
    app.use("/api/generate", createGenerateRouter(providers, history));

    const response = await requestJson(app, "/api/generate", {
      requirement: "写一个客服机器人",
      providerId: provider.id,
      generationModel: "gpt-4o",
      targetModel: "gpt-4o",
      visionEnabled: false,
      taskCategory: "none",
    });

    expect(response.status).toBe(200);
    expect(response.body.systemPrompt).toBe("SYSTEM PROMPT RESULT");
    expect((await history.list()).length).toBe(1);
  });
});
```

Add a local `requestJson` helper in the test using Node `http.createServer` and `fetch` against a random port.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/server/generateRoute.test.ts`

Expected: fails because route and OpenAI-compatible service do not exist.

- [ ] **Step 3: Implement OpenAI-compatible service**

Create `server/src/services/openAiCompatible.ts`:

```ts
export async function callChatCompletion(provider: ProviderRecord, request: GenerateRequest, messages: ChatMessage[]) {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: request.generationModel,
      messages,
      max_tokens: 4096,
      ...(request.generationModel.toLowerCase().includes("gpt-5") ? {} : { temperature: 0.7 }),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Provider request failed with ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Provider returned an empty response");
  }

  return { text: text.trim(), usage: data.usage ?? null };
}
```

- [ ] **Step 4: Implement generate route and server bootstrap**

Create `server/src/routes/generate.ts` with request validation:

- Requirement must be at least 4 trimmed characters.
- Provider id must exist.
- Generation model must be non-empty.
- Target model must exist.
- Downstream model must exist when task category is not `none`.

Create `server/src/index.ts`:

```ts
import express from "express";
import { createGenerateRouter } from "./routes/generate";
import { createHistoryRouter } from "./routes/history";
import { createProvidersRouter } from "./routes/providers";
import { createHistoryStore } from "./storage/historyStore";
import { createProviderStore } from "./storage/providerStore";

const app = express();
const dataDir = new URL("../../data", import.meta.url).pathname;
const providers = createProviderStore(dataDir);
const history = createHistoryStore(dataDir);

app.use(express.json({ limit: "1mb" }));
app.use("/api/providers", createProvidersRouter(providers));
app.use("/api/history", createHistoryRouter(history));
app.use("/api/generate", createGenerateRouter(providers, history));

app.listen(8787, "127.0.0.1", () => {
  console.log("Prompt Forge API listening on http://127.0.0.1:8787");
});
```

- [ ] **Step 5: Verify generation route**

Run: `npm.cmd test -- tests/server/generateRoute.test.ts`

Expected: passes mocked generation test.

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/openAiCompatible.ts server/src/routes/generate.ts server/src/index.ts tests/server/generateRoute.test.ts
git commit -m "feat: add generation api"
```

---

### Task 5: Frontend Workbench

**Files:**
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/api.ts`
- Create: `client/src/components/ForgePanel.tsx`
- Create: `client/src/components/ResultPanel.tsx`
- Create: `client/src/components/ProviderSettings.tsx`
- Create: `client/src/components/HistoryPanel.tsx`
- Create: `client/src/styles.css`

**Interfaces:**
- Consumes: provider, history, generate endpoints.
- Produces: a local first-screen forge workspace with provider settings, model choices, generation, copy, regenerate, and history restore.

- [ ] **Step 1: Create frontend API client**

Create `client/src/api.ts`:

```ts
export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }
  return data as T;
}
```

- [ ] **Step 2: Build app state and layout**

Create `client/src/main.tsx` to render `<App />`.

Create `client/src/App.tsx` with state for:

- providers
- selected provider id
- requirement
- generation model
- target model
- vision toggle
- task category
- downstream model
- generated prompt
- loading and error state
- history
- settings modal open state

Use `TARGET_MODELS`, `DOWNSTREAM_MODELS`, and `getDownstreamModels` from `shared/modelCatalog.ts`.

- [ ] **Step 3: Build forge controls**

Create `ForgePanel.tsx` with:

- Requirement textarea.
- Provider selector.
- Generation model selector/input.
- Target model selector.
- Vision checkbox.
- Downstream task buttons.
- Downstream model selector when task category is not `none`.
- Generate button disabled when requirement has fewer than 4 characters or no provider is selected.

- [ ] **Step 4: Build result and history panels**

Create `ResultPanel.tsx` with empty, loading, error, and generated states. Include copy and regenerate buttons.

Create `HistoryPanel.tsx` with recent items that restore form state and output when clicked.

- [ ] **Step 5: Build provider settings modal**

Create `ProviderSettings.tsx` with:

- Existing masked providers list.
- Add/edit form for name, base URL, API key, comma/newline-separated model ids, and default model.
- Delete button.
- Save button calling `/api/providers`.

The UI must never display saved raw API keys; it only shows `apiKeyMasked`.

- [ ] **Step 6: Add polished responsive CSS**

Create `client/src/styles.css` with:

- Dark workbench background.
- Two-column desktop layout and single-column mobile layout.
- Compact controls with stable heights.
- Segmented task buttons.
- Scrollable prompt output pane.
- History cards with 8px or smaller radius.

- [ ] **Step 7: Verify build**

Run: `npm.cmd run build`

Expected: TypeScript passes and Vite produces `dist/`.

- [ ] **Step 8: Start local app**

Run: `npm.cmd run dev`

Expected:

- API server prints `Prompt Forge API listening on http://127.0.0.1:8787`.
- Vite prints local URL `http://127.0.0.1:5173/`.

- [ ] **Step 9: Commit**

```bash
git add client package.json package-lock.json
git commit -m "feat: build prompt forge workbench"
```

---

## Final Verification

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Start `npm.cmd run dev`.
- [ ] Open `http://127.0.0.1:5173/`.
- [ ] Add a test OpenAI-compatible provider through settings.
- [ ] Generate a prompt for `我要一个能帮我写小红书美妆种草文案的助手`.
- [ ] Generate a prompt with task `text2img` and downstream model `Midjourney V7`.
- [ ] Copy the generated prompt.
- [ ] Reload and verify the history item remains available.

## Self-Review Notes

- Spec coverage: local-only architecture, provider management, model catalogs, prompt construction, generation, history, security, and verification all map to tasks above.
- Red-flag scan: no unfinished marker phrases or vague task entries are present.
- Type consistency: shared types and helper names are introduced in Task 1 and reused consistently in later tasks.
