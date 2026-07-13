# Prompt Forge Local Design

## Goal

Build a local AI system prompt forge inspired by the referenced VibeX "系统提示词生成器" page. The tool should let the user describe a use case, choose a target "brain" model, optionally choose a downstream image/video generation task and model, then generate a polished System Prompt through the user's own API provider.

The first version is a local web app with a Node backend. It should feel like a real working tool on the first screen, not a landing page.

## Product Scope

The app is named "提示词工坊 / Prompt Forge".

Core workflow:

1. User enters a short requirement or usage scenario.
2. User selects an upstream target model from a rich catalog.
3. User chooses whether the target model supports visual input.
4. User selects a downstream task:
   - none
   - text-to-image
   - image-to-image
   - image edit
   - text-to-video
   - image-to-video
5. If a downstream task is selected, user selects a downstream image/video model from that task category.
6. User selects an API provider and generation model.
7. App sends a prompt-engineering request to the local backend.
8. Backend calls the configured OpenAI-compatible API.
9. App displays the generated System Prompt with copy, regenerate, and save-to-history actions.

Out of scope for the first version:

- Directly generating images or videos.
- User login or cloud sync.
- RunningHub billing or account integration.
- Provider-specific non-compatible SDKs.

## Architecture

Use a Vite React frontend and an Express backend in one repository.

Frontend responsibilities:

- Render the app UI.
- Maintain the active forge form state.
- Show model catalogs with filtering by family, vendor, capability, and task category.
- Call backend endpoints for providers, generation, and history.
- Never expose API keys after initial save.

Backend responsibilities:

- Store local configuration and history in JSON files under `data/`.
- Manage OpenAI-compatible providers.
- Validate generation requests.
- Build the model-aware prompt-engineering messages.
- Call `POST {baseUrl}/chat/completions` with the selected provider key.
- Return generated text, provider errors, and basic usage metadata when available.

Suggested repo shape:

```text
client/
  src/
    components/
    data/
    lib/
    pages/
server/
  src/
    index.ts
    routes/
    services/
    storage/
shared/
  modelCatalog.ts
  schemas.ts
data/
  providers.json
  history.json
```

## Data Model

Provider:

- `id`: stable local id
- `name`: display name
- `baseUrl`: OpenAI-compatible base URL, such as `https://api.openai.com/v1`
- `apiKey`: stored locally only
- `models`: editable list of model ids
- `defaultModel`: optional generation model
- `createdAt`
- `updatedAt`

Target brain model:

- `value`
- `label`
- `vendor`
- `family`: `open` or `closed`
- `vision`: boolean
- `reasoning`: boolean
- `tag`: optional

Downstream model:

- `value`
- `label`
- `vendor`
- `family`
- `category`: `text2img`, `img2img`, `edit`, `text2video`, or `img2video`
- `tag`: optional

History item:

- `id`
- `requirement`
- `providerId`
- `generationModel`
- `targetModel`
- `visionEnabled`
- `taskCategory`
- `downstreamModel`
- `systemPrompt`
- `createdAt`

## Model Catalog

Seed the first version with the model families found in the reference app:

- Target brain models: OpenAI GPT, Claude, Gemini, Grok, Doubao, DeepSeek, Qwen, GLM, MiniMax, Llama, Mistral, Phi, InternVL.
- Downstream image models: GPT-Image, Gemini image, Seedream, Flux, Midjourney, Ideogram, Recraft, DALL-E, Qwen-Image, Stable Diffusion, Hunyuan-DiT, Kolors, Wanxiang.
- Downstream video models: Seedance, Veo, Sora, Kling, Runway, Pika, HappyHorse, Wanxiang video, HunyuanVideo, CogVideoX, LTX, Mochi.

Catalog entries are local presets. The user can still call any model id supported by their provider through the provider settings.

## Prompt Construction

The backend builds a two-message request:

System message:

- The assistant is a senior AI Prompt Engineer.
- It writes directly usable System Prompts.
- It must match the target model's capabilities.
- It must adapt output style to the user's language.
- It should not ask follow-up questions for vague requirements; it should make reasonable defaults.
- It should only output the final System Prompt, with no preface or explanation.

User message includes:

- Original user requirement.
- Target model label, vendor, family, vision support, and reasoning support.
- Whether visual input is enabled.
- Downstream task category.
- Downstream model details when selected.
- Task-specific writing requirements:
  - text-to-image: subject, scene, style, lighting, composition, camera, negative prompt.
  - image-to-image: reference analysis, preserve, modify, strength, prompt, negative prompt.
  - edit: operation sequence and final model-specific edit instruction.
  - text-to-video: action, camera motion, duration, rhythm, start/end frame, audio hint, negative prompt.
  - image-to-video: first-frame analysis, subject motion, camera motion, end-frame expectation, negative prompt.

Generation defaults:

- `max_tokens`: 4096.
- `temperature`: 0.7 for most models.
- Omit temperature for model ids that reject it.

## UI Design

The app opens directly into the forge workspace.

Layout:

- Top bar: brand, provider status, settings button.
- Left pane: forge controls.
- Right pane: generated prompt viewer.
- Bottom or side panel: recent history.

Controls:

- Requirement textarea with placeholder examples.
- Provider and generation model selectors.
- Target brain model selector with vendor/family filters.
- Vision toggle.
- Downstream task segmented control.
- Downstream model selector shown only when relevant.
- Generate button with loading and stop states.
- Copy, regenerate, and save controls in the result pane.

Visual style:

- Dark, polished, workbench-like UI.
- Compact controls, clear hierarchy, no marketing hero page.
- Accent colors can echo the reference app, but the local version should avoid being a clone.
- Use stable dimensions so controls do not shift while loading.

## Error Handling

Provider validation:

- Missing provider: prompt user to add one.
- Missing API key: block generation and show a settings error.
- Invalid base URL: show a connection error.
- Empty requirement under four characters: disable generation.

Generation errors:

- Network failure: explain that the provider could not be reached.
- Auth failure: explain that the API key was rejected.
- Rate limit: explain that the provider throttled the request.
- Unsupported model/parameter: show provider message and suggest checking model id.
- Timeout: allow retry.

Storage errors:

- If provider/history JSON cannot be read, recreate safe empty defaults.
- If writes fail, show an error but keep the generated prompt visible.

## Security

- API keys are stored only on the local machine.
- API keys are never returned to the frontend after saving; provider list should return masked key metadata only.
- The backend should not log API keys.
- No cloud accounts, telemetry, or external persistence.

## Testing And Verification

Automated checks:

- Unit tests for prompt construction.
- Unit tests for provider masking and validation.
- API route tests for provider CRUD and generation request validation.
- Frontend smoke test for the forge form and settings modal if practical.

Manual verification:

- Start the local dev server.
- Add a compatible provider.
- Generate a system prompt from a Chinese requirement.
- Generate with downstream text-to-image selected.
- Copy result.
- Save and reload history.

## Implementation Milestones

1. Scaffold Vite React + Express + TypeScript.
2. Add shared schemas and seeded model catalog.
3. Implement JSON storage for providers and history.
4. Implement provider CRUD and masked provider reads.
5. Implement prompt construction and OpenAI-compatible chat completion call.
6. Build forge UI.
7. Build settings UI for providers.
8. Build history UI.
9. Add tests and run verification.

