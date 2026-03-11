type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike | null {
  return typeof value === "object" && value !== null ? (value as RecordLike) : null;
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "");
}

function readCloudflareEnv(context: unknown): RecordLike | null {
  const root = asRecord(context);
  const cloudflare = asRecord(root?.cloudflare);
  return asRecord(cloudflare?.env);
}

export function resolveShareApiBase(context: unknown): string | null {
  const cloudflareEnv = readCloudflareEnv(context);
  const processEnv =
    typeof process !== "undefined" && process?.env && typeof process.env === "object"
      ? (process.env as Record<string, string | undefined>)
      : null;

  const candidates = [
    import.meta.env.VITE_API_BASE_URL,
    cloudflareEnv?.VITE_API_BASE_URL,
    cloudflareEnv?.API_BASE_URL,
    processEnv?.VITE_API_BASE_URL,
    processEnv?.API_BASE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function logShareMetaFailure(routeId: string, error: unknown, extra?: Record<string, unknown>): void {
  const payload = extra ? { ...extra, error } : error;
  console.error(`[share-meta:${routeId}]`, payload);
}
