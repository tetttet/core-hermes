export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function cleanString(value: unknown, maximum: number, minimum = 1) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (cleaned.length < minimum || cleaned.length > maximum) return undefined;
  return cleaned;
}

export function canonicalEmail(value: unknown) {
  const email = cleanString(value, 320)?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  return email;
}

export function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

export function pageLimit(value: unknown, fallback = 30, maximum = 100) {
  if (value === undefined) return fallback;
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : undefined;
}
