const ANYSEARCH_URL = "https://api.anysearch.com/v1/search";
const ANYSEARCH_MAX_RESULTS = 5;
const ANYSEARCH_TIMEOUT_MS = 8_000;
const MAX_TITLE_LENGTH = 300;
const MAX_SNIPPET_LENGTH = 1_500;
const MAX_CONTENT_LENGTH = 4_000;

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  content: string;
};

type AnySearchResponse = {
  code?: number;
  message?: string;
  data?: {
    results?: unknown;
  };
};

function text(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function sourceUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function parseResults(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("AnySearch returned an invalid results payload");
  }

  const seenUrls = new Set<string>();
  const results: WebSearchResult[] = [];
  for (const valueItem of value) {
    if (!valueItem || typeof valueItem !== "object") continue;
    const item = valueItem as Record<string, unknown>;
    const url = sourceUrl(item.url);
    if (!url || seenUrls.has(url)) continue;
    const title = text(item.title, MAX_TITLE_LENGTH);
    const snippet = text(item.snippet, MAX_SNIPPET_LENGTH);
    const content = text(item.content, MAX_CONTENT_LENGTH);
    if (!title && !snippet && !content) continue;

    seenUrls.add(url);
    results.push({
      title: title || url,
      url,
      snippet,
      content,
    });
    if (results.length >= ANYSEARCH_MAX_RESULTS) break;
  }
  return results;
}

export async function searchAnySearch(query: string, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error("AnySearch request timed out")),
    ANYSEARCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(ANYSEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: ANYSEARCH_MAX_RESULTS }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`AnySearch returned ${response.status}`);
    }

    const body = await response.json() as AnySearchResponse;
    if (body.code !== undefined && body.code !== 0) {
      throw new Error(body.message || "AnySearch returned an error");
    }
    return parseResults(body.data?.results);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
