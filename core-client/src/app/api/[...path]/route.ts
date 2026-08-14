import { proxyCoreRequest } from "@/lib/core-api-proxy";

type ProxyContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: Request, { params }: ProxyContext) {
  const { path } = await params;
  const upstreamPath = `/api/${path.map(encodeURIComponent).join("/")}`;
  return proxyCoreRequest(request, upstreamPath);
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
