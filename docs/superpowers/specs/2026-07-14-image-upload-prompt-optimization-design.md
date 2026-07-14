# Image Upload Prompt Optimization Design

## Goal

Allow the user to upload reference images together with a natural-language requirement so the configured vision model can inspect the images and generate a better System Prompt for downstream image generation or image editing models such as Nano Banana.

## Recommended Approach

Use lightweight inline image attachments. The client converts selected image files to data URLs and sends them with the existing `/api/generate` JSON request. The server validates the attachments, includes them as OpenAI-compatible `image_url` message parts, and stores only attachment summaries in history.

This avoids a separate asset store, works in the desktop app and NAS Docker deployment, and keeps the current Provider, model selection, history, and update workflows intact.

## Alternatives Considered

1. Store images on disk before generation.
   This would make images reusable, but adds file cleanup, disk permissions, privacy, and NAS path handling. It is heavier than the current need.

2. Add a separate upload endpoint.
   This gives a cleaner upload API, but adds more state and error handling. It is useful later if the app becomes an asset manager.

3. Send images inline with the generation request.
   This is the simplest fit for one-shot prompt optimization. It keeps uploaded images transient and requires the smallest change to the current architecture.

## User Experience

The left configuration panel gains an image upload section under the requirement textarea. Users can click or drag images into the section. Uploaded images appear as small numbered thumbnails: `图1`, `图2`, and so on. The user can remove any image before generation.

When at least one image is added, the app automatically enables image recognition mode and switches to a vision-capable target model if the current target model cannot see images. The requirement textarea can refer to uploaded images by number, for example: `参考图1的表达方式及颜色，将图2变成一样的，字体清晰无锯齿`.

The generate button remains the primary action. Existing result editing, copy, download, regenerate, fullscreen, and history version tabs keep working.

## Request And Data Model

`GenerateRequest` gains an optional `imageAttachments` array:

- `id`: client-generated stable id
- `name`: original file name
- `mimeType`: `image/png`, `image/jpeg`, or `image/webp`
- `size`: byte size
- `dataUrl`: image data URL

History stores `imageAttachments` as summaries without `dataUrl`, so local JSON files stay small.

`ChatMessage.content` supports either a string or OpenAI-compatible content parts:

- `{ type: "text", text: string }`
- `{ type: "image_url", image_url: { url: string, detail: "auto" } }`

## Validation

The server accepts up to 6 images per generation request. Each image must be PNG, JPEG, or WebP, each decoded image must be under 8 MB, and all decoded images together must be under 24 MB. The server decodes the base64 payload, checks that the declared size matches decoded bytes, and verifies PNG/JPEG/WebP magic bytes before calling the provider. If images are present while `visionEnabled` is false, the server rejects the request with a clear validation error. The client avoids that state by enabling vision automatically when images are added.

The Express JSON limit remains 1 MB for normal routes and is scoped to 36 MB only for `/api/generate` to allow inline image payloads without widening every API route.

## Prompt Behavior

The text prompt sent to the provider explicitly tells the model that uploaded images are numbered in order and may be referenced as `图1`, `图2`, etc. It asks the model to analyze relevant uploaded images before writing the final System Prompt, and to distinguish reference images from target/edit images based on the user's wording.

For image editing workflows, the generated System Prompt should instruct the downstream prompt-writing model to preserve the target image content while transferring style, color, expression, layout qualities, or text-rendering constraints from reference images.

## Testing

Add tests for:

- Validating image attachments in `/api/generate`
- Building multimodal chat messages containing text and `image_url` parts
- Ensuring provider calls send multimodal content without changing endpoint handling
- Rendering the app shell with image upload controls

Existing provider, history, update, and model catalog tests must keep passing.
