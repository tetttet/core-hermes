const CORE_API_URL =
  process.env.CORE_API_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  "http://127.0.0.1:4000";

export const maxDuration = 300;

const REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "cookie",
  "user-agent",
  "accept-language",
  "sec-ch-ua",
  "sec-ch-ua-platform",
  "x-device-id",
  "x-forwarded-for",
] as const;

const RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
  "x-accel-buffering",
  "x-content-type-options",
] as const;

export async function POST(request: Request) {
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(new URL("/api/chat/stream", CORE_API_URL), {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return Response.json(
      { error: "core-server недоступен. Запустите его на порту 4000." },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const upstreamHeaders = upstream.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = upstreamHeaders.getSetCookie?.() ?? [];
  if (setCookies.length) {
    for (const cookie of setCookies) responseHeaders.append("set-cookie", cookie);
  } else {
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) responseHeaders.set("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
