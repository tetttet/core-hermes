import { isUuid } from "./validation.js";

type Cursor = { at: string; id: string };

export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: unknown): Cursor | undefined {
  if (typeof value !== "string" || value.length > 300) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;
    if (
      typeof parsed.at !== "string" ||
      Number.isNaN(Date.parse(parsed.at)) ||
      !isUuid(parsed.id)
    ) {
      return undefined;
    }
    return { at: parsed.at, id: parsed.id };
  } catch {
    return undefined;
  }
}
