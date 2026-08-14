import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyCoreRequest } from "./core-api-proxy";

describe("core API proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps auth cookies first-party on the web app domain", async () => {
    const upstreamHeaders = new Headers({ "content-type": "application/json" });
    upstreamHeaders.append(
      "set-cookie",
      "refresh_token=token; Domain=core-hermes.vercel.app; Path=/api/auth; HttpOnly; Secure; SameSite=None",
    );
    const fetchMock = vi.fn(async () => new Response("{}", {
      status: 200,
      headers: upstreamHeaders,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyCoreRequest(
      new Request("https://hermeees.vercel.app/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "guest_id=guest",
        },
        body: "{}",
      }),
      "/api/auth/login",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const upstreamRequest = fetchMock.mock.calls[0];
    expect(String(upstreamRequest?.[0])).toContain("/api/auth/login");
    expect(upstreamRequest?.[1]?.headers).toEqual(expect.any(Headers));
    expect(response.headers.get("set-cookie")).toContain("Path=/api/auth");
    expect(response.headers.get("set-cookie")).not.toContain("Domain=");
  });
});
