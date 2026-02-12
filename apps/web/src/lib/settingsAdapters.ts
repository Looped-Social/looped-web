export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

export function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function extractItemsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export function extractNextCursor(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return normalizeOptional(payload.next_cursor ?? payload.nextCursor) ?? null;
}

export function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function buildCursorParams({
  limit,
  cursor,
  fallbackLimit = 20,
  min = 1,
  max = 100,
}: {
  limit?: number;
  cursor?: string;
  fallbackLimit?: number;
  min?: number;
  max?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, fallbackLimit, min, max)));
  if (cursor) params.set("cursor", cursor);
  return params;
}
