const CORE_API_URL =
  process.env.CORE_API_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  "http://127.0.0.1:4000";

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
  "retry-after",
  "x-accel-buffering",
  "x-content-type-options",
] as const;

function appendSetCookies(source: Headers, target: Headers) {
  const upstreamHeaders = source as Headers & { getSetCookie?: () => string[] };
  const cookies = upstreamHeaders.getSetCookie?.() ?? [];
  const values = cookies.length ? cookies : [source.get("set-cookie")].filter(Boolean) as string[];

  for (const cookie of values) {
    // The API and web app can have different hosts. Through this same-origin
    // proxy the browser must bind the cookie to the web app, not the API host.
    target.append("set-cookie", cookie.replace(/;\s*Domain=[^;]+/gi, ""));
  }
}

export async function proxyCoreRequest(request: Request, upstreamPath: string) {
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const upstreamUrl = new URL(upstreamPath, CORE_API_URL);
  upstreamUrl.search = new URL(request.url).search;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return Response.json(
      { error: "core-server недоступен. Попробуйте ещё раз чуть позже." },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  appendSetCookies(upstream.headers, responseHeaders);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
