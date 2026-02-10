import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class MediaApiError extends ApiError {}

export type ResolvedMediaAsset = {
  id: string;
  key?: string;
  mimeType?: string;
  cdnUrl: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  thumbnailUrl?: string;
  thumbnailMediaAssetId?: string;
  expiresAt?: string;
  ttlSeconds?: number;
};

const mediaCache = new Map<string, ResolvedMediaAsset>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeMediaId(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ?? null;
}

function normalizeResolvedMediaAsset(payload: unknown): ResolvedMediaAsset | null {
  if (!isRecord(payload)) return null;
  const id = normalizeMediaId(payload.id ?? payload.media_asset_id ?? payload.mediaAssetId);
  const cdnUrl =
    normalizeOptionalString(payload.cdn_url ?? payload.cdnUrl ?? payload.url ?? payload.download_url ?? payload.downloadUrl) ??
    undefined;
  if (!id || !cdnUrl) return null;

  return {
    id,
    key: normalizeOptionalString(payload.key),
    mimeType: normalizeOptionalString(payload.mime_type ?? payload.mimeType ?? payload.content_type ?? payload.contentType),
    cdnUrl,
    width: getNumber(payload.width),
    height: getNumber(payload.height),
    durationSeconds: getNumber(payload.duration_seconds ?? payload.durationSeconds),
    thumbnailUrl: normalizeOptionalString(payload.thumbnail_url ?? payload.thumbnailUrl),
    thumbnailMediaAssetId: normalizeOptionalString(payload.thumbnail_media_asset_id ?? payload.thumbnailMediaAssetId),
    expiresAt: normalizeOptionalString(payload.expires_at ?? payload.expiresAt),
    ttlSeconds: getNumber(payload.ttl_seconds ?? payload.ttlSeconds),
  };
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getFirebaseIdToken();
  const base = getApiBase();
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new MediaApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

async function resolveMissingIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const response = await authFetch<unknown>("/v1/media/resolve", {
    method: "POST",
    body: JSON.stringify({
      ids: ids.map((id) => {
        const parsed = Number(id);
        return Number.isFinite(parsed) ? parsed : id;
      }),
    }),
  });

  const items = isRecord(response) && Array.isArray(response.items) ? response.items : [];
  for (const item of items) {
    const normalized = normalizeResolvedMediaAsset(item);
    if (!normalized) continue;
    mediaCache.set(normalized.id, normalized);
  }
}

export async function resolveMediaAssets(ids: Array<string | number>): Promise<ResolvedMediaAsset[]> {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const rawId of ids) {
    const id = normalizeMediaId(rawId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  if (ordered.length === 0) return [];

  const missingIds = ordered.filter((id) => !mediaCache.has(id));
  if (missingIds.length > 0) await resolveMissingIds(missingIds);

  const linkedThumbnailIds = Array.from(
    new Set(
      ordered
        .map((id) => mediaCache.get(id))
        .filter((asset): asset is ResolvedMediaAsset => Boolean(asset))
        .filter((asset) => !asset.thumbnailUrl && Boolean(asset.thumbnailMediaAssetId))
        .map((asset) => asset.thumbnailMediaAssetId!)
        .filter((thumbnailId) => !mediaCache.has(thumbnailId))
    )
  );
  if (linkedThumbnailIds.length > 0) await resolveMissingIds(linkedThumbnailIds);

  const resolvedOrdered: ResolvedMediaAsset[] = [];
  for (const id of ordered) {
    const cached = mediaCache.get(id);
    if (!cached) continue;

    if (!cached.thumbnailUrl && cached.thumbnailMediaAssetId) {
      const thumbnail = mediaCache.get(cached.thumbnailMediaAssetId);
      if (thumbnail?.cdnUrl) {
        const merged = { ...cached, thumbnailUrl: thumbnail.cdnUrl };
        mediaCache.set(merged.id, merged);
        resolvedOrdered.push(merged);
        continue;
      }
    }

    resolvedOrdered.push(cached);
  }
  return resolvedOrdered;
}
