import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const requestBody = {
  prompt: "Minimal product photo",
  model: "stable_diffusion",
  style: "minimal",
  aspectRatio: "1:1",
  quality: "standard",
  seed: "7",
};

describe("AI Horde image route", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("submits a no-store anonymous generation without persisting it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ id: "11111111-1111-4111-8111-111111111111" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/image-generation/horde", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.state).toBe("queued");
    expect(body.requestId).toBe("11111111-1111-4111-8111-111111111111");
    const upstreamRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const upstreamBody = JSON.parse(String(upstreamRequest.body));
    expect(upstreamBody.shared).toBe(false);
    expect(upstreamBody.models).toEqual(["stable_diffusion"]);
  });

  it("generates Pollinations Flux through the free image endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/image-generation/horde", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, model: "pollinations_flux" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      state: "done",
      imageDataUrl: "data:image/jpeg;base64,AQID",
      mimeType: "image/jpeg",
      resolution: "512×512",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "image.pollinations.ai/prompt/",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("model=flux");
  });

  it("returns queue progress and a ready base64 image", async () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          done: false,
          processing: 0,
          queue_position: 3,
          wait_time: 40,
        }),
      )
      .mockResolvedValueOnce(Response.json({ done: true, finished: 1 }))
      .mockResolvedValueOnce(
        Response.json({ generations: [{ img: "AA==", seed: "7" }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const waitingResponse = await GET(
      new Request(`http://localhost/api/image-generation/horde?requestId=${requestId}`),
    );
    expect(await waitingResponse.json()).toMatchObject({
      state: "waiting",
      queuePosition: 3,
    });

    const doneResponse = await GET(
      new Request(`http://localhost/api/image-generation/horde?requestId=${requestId}`),
    );
    expect(await doneResponse.json()).toMatchObject({
      state: "done",
      imageDataUrl: "data:image/webp;base64,AA==",
      seed: "7",
    });
  });
});
