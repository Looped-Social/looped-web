import { normalizeOptional } from "./settingsAdapters";
import { SettingsApiError, settingsAuthFetch } from "./settingsHttp";

export { SettingsApiError as MediaApiError };

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

export type MediaPresignResponse = {
  key?: string;
  uploadUrl?: string;
  upload_url?: string;
  headers?: Record<string, string>;
  fields?: Record<string, string>;
  callbackSignature?: string;
  callback_signature?: string;
};

const mediaCache = new Map<string, ResolvedMediaAsset>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeMediaId(value: unknown): string | null {
  const normalized = normalizeOptional(value);
  return normalized ?? null;
}

function normalizeResolvedMediaAsset(payload: unknown): ResolvedMediaAsset | null {
  if (!isRecord(payload)) return null;
  const id = normalizeMediaId(payload.id ?? payload.media_asset_id ?? payload.mediaAssetId);
  const cdnUrl =
    normalizeOptional(payload.cdn_url ?? payload.cdnUrl ?? payload.url ?? payload.download_url ?? payload.downloadUrl) ??
    undefined;
  if (!id || !cdnUrl) return null;

  return {
    id,
    key: normalizeOptional(payload.key),
    mimeType: normalizeOptional(payload.mime_type ?? payload.mimeType ?? payload.content_type ?? payload.contentType),
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

async function resolveMissingIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const response = await settingsAuthFetch<unknown>("/v1/media/resolve", {
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

export async function presignMediaUpload(payload: {
  contentType: string;
  sizeBytes: number;
}): Promise<MediaPresignResponse> {
  return settingsAuthFetch<MediaPresignResponse>("/v1/media/presign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function getPresignUploadUrl(presign: MediaPresignResponse): string {
  const uploadUrl = normalizeOptional(presign.uploadUrl ?? presign.upload_url);
  if (!uploadUrl) throw new Error("Upload failed. Missing upload URL.");
  return uploadUrl;
}

export async function uploadFileWithPresign(presign: MediaPresignResponse, file: File): Promise<void> {
  const uploadUrl = getPresignUploadUrl(presign);
  const fields = presign.fields;

  if (fields && Object.keys(fields).length > 0) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    formData.append("file", file);
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Upload failed.");
    return;
  }

  const headers = new Headers(presign.headers ?? {});
  if (file.type && !headers.has("Content-Type")) {
    headers.set("Content-Type", file.type);
  }
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!response.ok) throw new Error("Upload failed.");
}

export async function completeMediaUpload(payload: {
  key: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds?: number | null;
  thumbnailMediaAssetId?: string | number | null;
  callbackSignature?: string;
}): Promise<string | number> {
  const response = await settingsAuthFetch<unknown>("/v1/media/callback", {
    method: "POST",
    headers: payload.callbackSignature ? { "X-Media-Signature": payload.callbackSignature } : undefined,
    body: JSON.stringify({
      key: payload.key,
      mimeType: payload.mimeType,
      width: payload.width,
      height: payload.height,
      durationSeconds: payload.durationSeconds ?? null,
      thumbnailMediaAssetId: payload.thumbnailMediaAssetId ?? null,
    }),
  });

  if (typeof response === "number" || typeof response === "string") return response;

  if (isRecord(response)) {
    const media = isRecord(response.media) ? response.media : null;
    const asset = isRecord(response.asset) ? response.asset : null;
    const candidates = [
      response.mediaAssetId,
      response.media_asset_id,
      response.id,
      media?.id,
      asset?.id,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" || typeof candidate === "number") {
        return candidate;
      }
    }
  }

  throw new Error("Upload finished but no media asset id was returned.");
}
