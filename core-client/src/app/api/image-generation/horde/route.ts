import {
  buildHordeGenerationPayload,
  getImageModel,
  isImageAspectRatio,
  isImageModelId,
  isImageSeed,
  isImageStyleId,
  type GenerateImageRequest,
  type ImageGenerationErrorResponse,
  type ImageGenerationPollResponse,
  type ImageGenerationStartResponse,
} from "@/lib/image-generation";

export const runtime = "nodejs";

const AI_HORDE_API_BASE_URL = "https://aihorde.net/api/v2";
const POLLINATIONS_IMAGE_API_BASE_URL = "https://gen.pollinations.ai/image";
const POLLINATIONS_ANONYMOUS_IMAGE_API_BASE_URL =
  "https://image.pollinations.ai/prompt";
const AI_HORDE_ANONYMOUS_API_KEY = "0000000000";
const AI_HORDE_DEFAULT_CLIENT_AGENT = "HermesAI:1.0:support@example.com";
const MAX_PROMPT_LENGTH = 1_600;
const REQUEST_ID_PATTERN = /^[0-9a-f-]{20,64}$/i;

type HordeCheckResponse = {
  done?: boolean;
  faulted?: boolean;
  finished?: number;
  processing?: number;
  wait_time?: number;
  queue_position?: number;
  is_possible?: boolean;
};

type HordeStatusResponse = HordeCheckResponse & {
  generations?: Array<{ img?: string; seed?: string }>;
};

type PollinationsErrorResponse = {
  error?: string | { message?: string };
};

function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

function jsonError(error: string, status: number) {
  return Response.json(
    { error } satisfies ImageGenerationErrorResponse,
    { status, headers: noStoreHeaders() },
  );
}

function getHordeHeaders() {
  return {
    apikey:
      process.env.AI_HORDE_API_KEY?.trim() || AI_HORDE_ANONYMOUS_API_KEY,
    "Client-Agent":
      process.env.AI_HORDE_CLIENT_AGENT?.trim() ||
      AI_HORDE_DEFAULT_CLIENT_AGENT,
  };
}

async function fetchHorde<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${AI_HORDE_API_BASE_URL}${path}`, {
    ...init,
    headers: { ...getHordeHeaders(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as T | null;
  return { response, data };
}

function validateRequest(value: unknown): GenerateImageRequest | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Partial<GenerateImageRequest>;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (
    !prompt ||
    prompt.length > MAX_PROMPT_LENGTH ||
    !isImageModelId(body.model) ||
    !isImageStyleId(body.style) ||
    !isImageAspectRatio(body.aspectRatio) ||
    (body.quality !== "standard" && body.quality !== "high") ||
    (body.seed !== undefined &&
      !isImageSeed(body.seed))
  ) {
    return null;
  }

  return { ...body, prompt } as GenerateImageRequest;
}

function formatWaitingMessage(check: HordeCheckResponse) {
  const queue = Number.isFinite(check.queue_position)
    ? `Позиция в очереди: ${check.queue_position}`
    : "Ожидаем свободный GPU";
  const wait = Number.isFinite(check.wait_time) && (check.wait_time ?? 0) > 0
    ? `примерно ${Math.max(1, Math.ceil((check.wait_time ?? 0) / 60))} мин.`
    : null;
  return [queue, wait].filter(Boolean).join(" · ");
}

async function generateWithPollinations(input: GenerateImageRequest) {
  const { payload, seed, resolution } = buildHordeGenerationPayload(input);
  const model = getImageModel(input.model);
  const apiKey = process.env.POLLINATIONS_API_KEY?.trim();
  const isAuthenticated = Boolean(apiKey);
  const params = new URLSearchParams({
    model: isAuthenticated
      ? model.apiModelId
      : "anonymousApiModelId" in model
        ? model.anonymousApiModelId
        : model.apiModelId,
    width: String(payload.params.width),
    height: String(payload.params.height),
    seed,
    safe: "true",
  });
  if (!isAuthenticated) params.set("nologo", "true");

  const baseUrl = isAuthenticated
    ? POLLINATIONS_IMAGE_API_BASE_URL
    : POLLINATIONS_ANONYMOUS_IMAGE_API_BASE_URL;
  const url = `${baseUrl}/${encodeURIComponent(payload.prompt)}?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/jpeg,image/png",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > 8_000_000) {
      return jsonError("Изображение Pollinations превышает лимит 8 МБ.", 502);
    }
    if (!response.ok || !mimeType.startsWith("image/")) {
      const errorBody = await response.json().catch(() => null) as
        | PollinationsErrorResponse
        | null;
      const upstreamMessage = typeof errorBody?.error === "string"
        ? errorBody.error
        : errorBody?.error?.message;
      const statusMessage = response.status === 401
        ? "Ключ Pollinations отсутствует или недействителен."
        : response.status === 402
          ? "На ключе Pollinations недостаточно Pollen."
          : response.status === 403
            ? "Ключ Pollinations не имеет доступа к этой модели."
            : response.status === 429 || response.status === 503
              ? "Pollinations перегружен. Попробуйте немного позже."
              : response.status === 400 && upstreamMessage
                ? `Pollinations отклонил параметры: ${upstreamMessage}`
                : "Pollinations не смог создать изображение.";
      return jsonError(
        statusMessage,
        response.ok ? 502 : response.status,
      );
    }

    const imageBytes = await response.arrayBuffer();
    if (imageBytes.byteLength === 0 || imageBytes.byteLength > 8_000_000) {
      return jsonError("Pollinations вернул некорректное изображение.", 502);
    }

    return Response.json(
      {
        state: "done",
        seed,
        resolution,
        statusMessage: "Изображение готово.",
        imageDataUrl: `data:${mimeType};base64,${Buffer.from(imageBytes).toString("base64")}`,
        mimeType,
      } satisfies ImageGenerationStartResponse,
      { headers: noStoreHeaders() },
    );
  } catch {
    return jsonError("Pollinations сейчас недоступен. Попробуйте позже.", 502);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = validateRequest(body);
  if (!input) return jsonError("Проверьте запрос и настройки генерации.", 400);

  if (getImageModel(input.model).provider === "pollinations") {
    return generateWithPollinations(input);
  }

  const { payload, seed, resolution } = buildHordeGenerationPayload(input);

  try {
    const result = await fetchHorde<{ id?: string }>("/generate/async", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.response.ok || !result.data?.id) {
      return jsonError(
        result.response.status === 429 || result.response.status === 503
          ? "Сервис перегружен. Попробуйте немного позже."
          : "Не удалось поставить изображение в очередь.",
        result.response.ok ? 502 : result.response.status,
      );
    }

    return Response.json(
      {
        state: "queued",
        requestId: result.data.id,
        seed,
        resolution,
        statusMessage: "Запрос добавлен в очередь AI Horde.",
      } satisfies ImageGenerationStartResponse,
      { headers: noStoreHeaders() },
    );
  } catch {
    return jsonError("AI Horde сейчас недоступен. Попробуйте позже.", 502);
  }
}

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId")?.trim();
  if (!requestId || !REQUEST_ID_PATTERN.test(requestId)) {
    return jsonError("Некорректный идентификатор генерации.", 400);
  }

  try {
    const checkResult = await fetchHorde<HordeCheckResponse>(
      `/generate/check/${encodeURIComponent(requestId)}`,
    );
    if (!checkResult.response.ok || !checkResult.data) {
      return jsonError("Не удалось проверить состояние генерации.", 502);
    }

    const check = checkResult.data;
    if (check.faulted || check.is_possible === false) {
      return Response.json(
        {
          state: "failed",
          statusMessage: "Community worker не смог выполнить запрос.",
          error: "Генерация не удалась. Попробуйте другую модель.",
        } satisfies ImageGenerationPollResponse,
        { headers: noStoreHeaders() },
      );
    }

    if (!check.done) {
      const isGenerating =
        (check.processing ?? 0) > 0 || (check.finished ?? 0) > 0;
      return Response.json(
        isGenerating
          ? ({
              state: "generating",
              statusMessage: "Модель создаёт изображение…",
            } satisfies ImageGenerationPollResponse)
          : ({
              state: "waiting",
              statusMessage: formatWaitingMessage(check),
              queuePosition: check.queue_position,
              waitTimeSeconds: check.wait_time,
            } satisfies ImageGenerationPollResponse),
        { headers: noStoreHeaders() },
      );
    }

    const statusResult = await fetchHorde<HordeStatusResponse>(
      `/generate/status/${encodeURIComponent(requestId)}`,
    );
    const generation = statusResult.data?.generations?.find(
      (item) =>
        typeof item.img === "string" &&
        item.img.length > 0 &&
        item.img.length <= 8_000_000,
    );
    if (!statusResult.response.ok || !generation?.img) {
      return jsonError("AI Horde не вернул готовое изображение.", 502);
    }

    const imageDataUrl = generation.img.startsWith("data:image/")
      ? generation.img
      : `data:image/webp;base64,${generation.img}`;

    return Response.json(
      {
        state: "done",
        statusMessage: "Изображение готово.",
        imageDataUrl,
        mimeType: "image/webp",
        seed: generation.seed,
      } satisfies ImageGenerationPollResponse,
      { headers: noStoreHeaders() },
    );
  } catch {
    return jsonError("Не удалось связаться с AI Horde.", 502);
  }
}
