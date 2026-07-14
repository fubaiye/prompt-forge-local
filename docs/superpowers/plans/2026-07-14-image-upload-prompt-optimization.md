# Image Upload Prompt Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transient image upload support so uploaded images and user requirements are sent to a configured vision model for better prompt optimization.

**Architecture:** Extend the existing `GenerateRequest` path instead of adding a separate upload API. The client converts files to data URLs, the server validates them, and `promptBuilder` emits OpenAI-compatible multimodal chat content.

**Tech Stack:** React 18, Vite, Express, TypeScript, Vitest, OpenAI-compatible chat completions.

## Global Constraints

- Do not change Provider storage, update routes, model catalog semantics, or NAS deployment logic.
- Uploaded images are transient generation inputs; history stores summaries only.
- Support PNG, JPEG, and WebP images, up to 6 images, 8 MB per decoded image, and 24 MB decoded total.
- Automatically enable image recognition when images are uploaded.
- Preserve the current two-column workbench layout and existing visual design tokens.

---

### Task 1: Shared Types And Server Validation

**Files:**
- Modify: `shared/types.ts`
- Modify: `server/src/routes/generate.ts`
- Test: `tests/server/generateRoute.test.ts`

**Interfaces:**
- Produces: `ImageAttachment`, `ImageAttachmentSummary`, `ChatContentPart`
- Produces: validated `GenerateRequest.imageAttachments?: ImageAttachment[]`

- [ ] **Step 1: Write failing route validation tests**

Add tests that post a valid image attachment and an invalid non-image attachment to `/api/generate`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm.cmd test -- tests/server/generateRoute.test.ts`

Expected: fails because `imageAttachments` validation and multimodal body support do not exist yet.

- [ ] **Step 3: Add shared image attachment types and request validation**

Define image attachment and summary interfaces. Validate array length, MIME type, data URL shape, decoded byte size, image magic bytes, and total decoded size. Reject image attachments when `visionEnabled` is false.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `npm.cmd test -- tests/server/generateRoute.test.ts`

Expected: route tests pass.

### Task 2: Multimodal Prompt Messages

**Files:**
- Modify: `shared/types.ts`
- Modify: `server/src/services/promptBuilder.ts`
- Modify: `server/src/services/openAiCompatible.ts`
- Test: `tests/server/promptBuilder.test.ts`
- Test: `tests/server/openAiCompatible.test.ts`

**Interfaces:**
- Consumes: `GenerateRequest.imageAttachments`
- Produces: `ChatMessage.content` as either `string` or multimodal content parts

- [ ] **Step 1: Write failing prompt-builder and provider-call tests**

Assert that uploaded images become `image_url` parts and that text still contains image numbering guidance.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm.cmd test -- tests/server/promptBuilder.test.ts tests/server/openAiCompatible.test.ts`

Expected: fails because `ChatMessage.content` currently only supports strings.

- [ ] **Step 3: Implement multimodal message content**

Build a text part plus ordered image parts when attachments exist. Keep existing pure-text behavior for requests without images.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `npm.cmd test -- tests/server/promptBuilder.test.ts tests/server/openAiCompatible.test.ts`

Expected: tests pass.

### Task 3: Client Upload UI

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/ForgePanel.tsx`
- Modify: `client/src/styles.css`
- Test: `tests/client/app.test.tsx`

**Interfaces:**
- Consumes: `GenerateRequest.imageAttachments`
- Produces: numbered thumbnail controls and remove action

- [ ] **Step 1: Write failing client render test**

Assert the app shell renders image upload controls and keeps the generate workflow available.

- [ ] **Step 2: Run focused test and verify failure**

Run: `npm.cmd test -- tests/client/app.test.tsx`

Expected: fails because upload controls are not present.

- [ ] **Step 3: Implement upload controls**

Add a file input/drop area under the requirement textarea. Convert images to data URLs, number them as `图1`, `图2`, and allow removal. When images are added, set `visionEnabled: true`.

- [ ] **Step 4: Add styles**

Use existing dark workbench tokens, compact thumbnails, 12px radius, subtle borders, and accent only for focus/selected states.

- [ ] **Step 5: Run focused client test and verify pass**

Run: `npm.cmd test -- tests/client/app.test.tsx`

Expected: test passes.

### Task 4: Full Verification

**Files:**
- No new files

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified build and test state

- [ ] **Step 1: Run all tests**

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

Expected: TypeScript, client build, and server bundle complete successfully.

- [ ] **Step 3: Review diff**

Run: `git diff --stat`

Expected: changes are limited to image upload feature, tests, and docs.
