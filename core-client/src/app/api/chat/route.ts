import { proxyCoreRequest } from "@/lib/core-api-proxy";

export const maxDuration = 300;

export async function POST(request: Request) {
  return proxyCoreRequest(request, "/api/chat/stream");
}
