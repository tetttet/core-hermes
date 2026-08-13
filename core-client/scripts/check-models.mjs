import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  AUTO_MODEL_ID,
  MODELS,
  getModelReasoning,
} from "../src/config/models.ts";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const apiKey = process.env.OPENROUTER_API_KEY;
const apiModels = MODELS.filter((model) => model.id !== AUTO_MODEL_ID);
const imageModel = apiModels.find(
  (model) => model.id !== "openrouter/free" && model.supportsVision,
);
const videoModel = apiModels.find(
  (model) => model.id !== "openrouter/free" && model.supportsVideo,
);
const routerOnly = process.argv.includes("--router-only");

if (!apiKey) {
  console.error("OPENROUTER_API_KEY не найден в .env/.env.local");
  process.exit(1);
}

const mimeTypes = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

async function fileDataUrl(path) {
  const mimeType = mimeTypes[extname(path).toLowerCase()];
  if (!mimeType) throw new Error(`Неизвестный формат файла: ${path}`);
  const contents = await readFile(path);
  return `data:${mimeType};base64,${contents.toString("base64")}`;
}

async function check(label, model, messages) {
  const startedAt = performance.now();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Hermes model check",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
        stream: false,
        reasoning: getModelReasoning(model),
        provider: { allow_fallbacks: true },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const duration = ((performance.now() - startedAt) / 1000).toFixed(1);

    if (!response.ok || typeof content !== "string" || !content.trim()) {
      throw new Error(data.error?.message || `HTTP ${response.status}: пустой ответ`);
    }

    console.log(`PASS  ${label} — ${duration} с — ${content.trim().replace(/\s+/g, " ").slice(0, 80)}`);
    return true;
  } catch (error) {
    const duration = ((performance.now() - startedAt) / 1000).toFixed(1);
    console.error(
      `FAIL  ${label} — ${duration} с — ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

const results = [];
if (!routerOnly) {
  for (const model of apiModels) {
    results.push(
      await check(model.title, model.id, [
        { role: "user", content: "Ответь только словом OK." },
      ]),
    );
  }
}

if (imageModel && process.env.MODEL_CHECK_IMAGE_PATH && !routerOnly) {
  const imageUrl = await fileDataUrl(process.env.MODEL_CHECK_IMAGE_PATH);
  results.push(
    await check(`${imageModel.title} / фото`, imageModel.id, [
      {
        role: "user",
        content: [
          { type: "text", text: "Ответь только словом IMAGE." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ]),
  );
}

if (imageModel && process.env.MODEL_CHECK_IMAGE_PATH && routerOnly) {
  const imageUrl = await fileDataUrl(process.env.MODEL_CHECK_IMAGE_PATH);
  results.push(
    await check("Free Router / фото", "openrouter/free", [
      {
        role: "user",
        content: [
          { type: "text", text: "Ответь только словом IMAGE." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ]),
  );
}

if (videoModel && process.env.MODEL_CHECK_VIDEO_PATH && !routerOnly) {
  const videoUrl = await fileDataUrl(process.env.MODEL_CHECK_VIDEO_PATH);
  results.push(
    await check(`${videoModel.title} / видео`, videoModel.id, [
      {
        role: "user",
        content: [
          { type: "text", text: "Ответь только словом VIDEO." },
          { type: "video_url", video_url: { url: videoUrl } },
        ],
      },
    ]),
  );
}

if (videoModel && process.env.MODEL_CHECK_VIDEO_PATH && routerOnly) {
  const videoUrl = await fileDataUrl(process.env.MODEL_CHECK_VIDEO_PATH);
  results.push(
    await check("Free Router / видео", "openrouter/free", [
      {
        role: "user",
        content: [
          { type: "text", text: "Ответь только словом VIDEO." },
          { type: "video_url", video_url: { url: videoUrl } },
        ],
      },
    ]),
  );
}

const passed = results.filter(Boolean).length;
console.log(`\nИтог: ${passed}/${results.length} проверок прошли.`);
if (passed !== results.length) process.exitCode = 1;
