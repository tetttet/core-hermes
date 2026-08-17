import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { searchAnySearch } from "./anysearch.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("searchAnySearch", () => {
  it("uses anonymous POST search and returns safe, deduplicated sources", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json({
        code: 0,
        data: {
          results: [
            {
              title: "Первый источник",
              url: "https://example.com/article",
              snippet: "Краткое описание",
              content: "Полезное содержимое",
            },
            {
              title: "Дубликат",
              url: "https://example.com/article",
              snippet: "Не должен попасть в результат",
            },
            {
              title: "Небезопасная ссылка",
              url: "javascript:alert(1)",
              snippet: "Не должна попасть в результат",
            },
          ],
        },
      });
    }) as typeof fetch;

    const results = await searchAnySearch(
      "актуальный запрос",
      new AbortController().signal,
    );

    assert.equal(capturedUrl, "https://api.anysearch.com/v1/search");
    assert.equal(capturedInit?.method, "POST");
    assert.deepEqual(capturedInit?.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      query: "актуальный запрос",
      max_results: 5,
    });
    assert.deepEqual(results, [
      {
        title: "Первый источник",
        url: "https://example.com/article",
        snippet: "Краткое описание",
        content: "Полезное содержимое",
      },
    ]);
  });

  it("rejects an AnySearch error so the caller can fall back to the LLM", async () => {
    globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;

    await assert.rejects(
      searchAnySearch("запрос", new AbortController().signal),
      /AnySearch returned 503/,
    );
  });
});
