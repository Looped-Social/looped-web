import { ApiError, getApiBase } from "./apiBase";
import type { ResolvedMediaAsset } from "./mediaApi";

export class PostShareApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMedia(payload: unknown): ResolvedMediaAsset | null {
  if (!isRecord(payload)) return null;
  const id = normalizeOptional(payload.id ?? payload.media_asset_id ?? payload.mediaAssetId);
  const cdnUrl =
    normalizeOptional(payload.cdn_url ?? payload.cdnUrl ?? payload.url ?? payload.download_url ?? payload.downloadUrl) ??
    undefined;
  if (!id || !cdnUrl) return null;

  return {
    id,
    key: normalizeOptional(payload.key),
    mimeType: normalizeOptional(payload.mime_type ?? payload.mimeType),
    cdnUrl,
    width: getNumber(payload.width),
    height: getNumber(payload.height),
    durationSeconds: getNumber(payload.duration_seconds ?? payload.durationSeconds),
    thumbnailUrl: normalizeOptional(payload.thumbnail_url ?? payload.thumbnailUrl),
    thumbnailMediaAssetId: normalizeOptional(payload.thumbnail_media_asset_id ?? payload.thumbnailMediaAssetId),
    expiresAt: normalizeOptional(payload.expires_at ?? payload.expiresAt),
    ttlSeconds: getNumber(payload.ttl_seconds ?? payload.ttlSeconds),
  };
}

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

async function publicFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBase();
  const headers = new Headers(init?.headers ?? undefined);

  if (init?.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${base}${path}`, {
    ...init,
    headers,
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const details = await response.text();
    throw new PostShareApiError(response.status, details || "Request failed.", details);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export async function fetchSharedPostDetail(postId: string | number): Promise<unknown> {
  const response = await publicFetch(`/v1/public/posts/${postId}`);
  return parseJsonResponse<unknown>(response);
}

export async function fetchSharedPostComments({
  postId,
  limit,
  cursor,
}: {
  postId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  const response = await publicFetch(`/v1/public/posts/${postId}/comments?${params.toString()}`);
  return parseJsonResponse<CursorEnvelope<unknown>>(response);
}

export async function fetchSharedCommentReplies({
  commentId,
  limit,
  cursor,
}: {
  commentId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  const response = await publicFetch(`/v1/public/comments/${commentId}/replies?${params.toString()}`);
  return parseJsonResponse<CursorEnvelope<unknown>>(response);
}

export async function resolveSharedMediaAssets(ids: Array<string | number>): Promise<ResolvedMediaAsset[]> {
  const normalizedIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = normalizeOptional(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalizedIds.push(id);
  }
  if (normalizedIds.length === 0) return [];

  const response = await publicFetch("/v1/media/resolve", {
    method: "POST",
    body: JSON.stringify({
      ids: normalizedIds.map((id) => {
        const parsed = Number(id);
        return Number.isFinite(parsed) ? parsed : id;
      }),
    }),
  });
  const payload = await parseJsonResponse<unknown>(response);

  const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
  const resolvedById = new Map<string, ResolvedMediaAsset>();
  for (const item of items) {
    const normalized = normalizeMedia(item);
    if (!normalized) continue;
    resolvedById.set(normalized.id, normalized);
  }

  return normalizedIds.map((id) => resolvedById.get(id)).filter((item): item is ResolvedMediaAsset => Boolean(item));
}
