import { completeMediaUpload, presignMediaUpload, uploadFileWithPresign } from "./mediaApi";
import { fetchPostById } from "./postReadApi";
import { SettingsApiError, settingsAuthFetch } from "./settingsHttp";

export { SettingsApiError as PostCreateApiError };

export type PostableCommunity = {
  id: string;
  name: string;
  shortName?: string;
  kind?: "company" | "school" | "major" | "field" | "community";
  source: "verification" | "specialization";
};

export type PostMediaKind = "image" | "video";

export type UploadPostMediaInput = {
  file: File;
  kind: PostMediaKind;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  thumbnailMediaAssetId?: string | number | null;
};

export type UploadedPostMedia = {
  file: File;
  kind: PostMediaKind;
  mediaAssetId: string | number;
};

export type CreatePostPollInput = {
  question: string;
  options: string[];
  maxSelections?: 1;
  closesAt?: string;
};

export type CreatePostInput = {
  content: string;
  communityId: string | number;
  mediaAssetIds?: Array<string | number>;
  poll?: CreatePostPollInput;
};

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeKind(value: unknown): PostableCommunity["kind"] {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (normalized === "company" || normalized === "school" || normalized === "major" || normalized === "field") {
    return normalized;
  }
  return "community";
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

function maybeNumber(value: string | number): string | number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
  return value;
}

export async function fetchPostableCommunities(): Promise<PostableCommunity[]> {
  const response = await settingsAuthFetch<unknown>("/v1/me/postable-communities");
  const items = Array.isArray(response)
    ? response
    : response && typeof response === "object" && Array.isArray((response as { items?: unknown[] }).items)
      ? (response as { items: unknown[] }).items
      : [];

  const communities: PostableCommunity[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = normalizeOptional(entry.id);
    const name = normalizeOptional(entry.name);
    if (!id || !name) continue;
    if (seenIds.has(id)) continue;

    const kind = normalizeKind(entry.kind);
    const canPost = getBoolean(entry.canPost ?? entry.can_post);
    if (canPost === false) continue;

    const specializationType = normalizeKind(entry.specializationType ?? entry.specialization_type);
    const source =
      specializationType === "major" || specializationType === "field" ? "specialization" : "verification";

    communities.push({
      id,
      name,
      shortName: normalizeOptional(entry.shortName ?? entry.short_name),
      kind,
      source,
    });
    seenIds.add(id);
  }

  return communities;
}

async function uploadSingleMedia(media: UploadPostMediaInput): Promise<UploadedPostMedia> {
  const contentType = normalizeOptional(media.file.type) ?? "application/octet-stream";
  const presign = await presignMediaUpload({
    contentType,
    sizeBytes: media.file.size,
  });

  const key = normalizeOptional(presign.key ?? presign.fields?.key);
  if (!key) {
    throw new Error("Upload failed. Missing media key.");
  }

  await uploadFileWithPresign(presign, media.file);

  const mediaAssetId = await completeMediaUpload({
    key,
    mimeType: contentType,
    width: media.width ?? null,
    height: media.height ?? null,
    durationSeconds: media.durationSeconds ?? null,
    thumbnailMediaAssetId: media.thumbnailMediaAssetId ?? null,
    callbackSignature: presign.callbackSignature ?? presign.callback_signature,
  });

  return {
    file: media.file,
    kind: media.kind,
    mediaAssetId,
  };
}

async function runWithConcurrencyLimit<TInput, TResult>(
  items: TInput[],
  limit: number,
  worker: (item: TInput, index: number) => Promise<TResult>
): Promise<TResult[]> {
  if (items.length === 0) return [];

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, runWorker));

  return results;
}

export async function uploadPostMediaFiles(
  media: UploadPostMediaInput[],
  { concurrency = 3 }: { concurrency?: number } = {}
): Promise<UploadedPostMedia[]> {
  const normalizedConcurrency =
    typeof concurrency === "number" && Number.isFinite(concurrency)
      ? Math.max(1, Math.min(5, Math.floor(concurrency)))
      : 3;

  return runWithConcurrencyLimit(media, normalizedConcurrency, uploadSingleMedia);
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `web-post-${Date.now()}-${random}`;
}

function extractPostId(payload: unknown): string | number | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = (payload as Record<string, unknown>).id;
  if (typeof candidate === "string" || typeof candidate === "number") return candidate;
  const postId = (payload as Record<string, unknown>).postId ?? (payload as Record<string, unknown>).post_id;
  if (typeof postId === "string" || typeof postId === "number") return postId;
  return null;
}

function isIdOnlyPayload(payload: unknown): payload is { id: string | number } {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  const id = extractPostId(record);
  if (!id) return false;
  const keys = Object.keys(record);
  return keys.length > 0 && keys.every((key) => key === "id" || key === "postId" || key === "post_id");
}

export async function createPost(input: CreatePostInput): Promise<unknown> {
  const content = input.content.trim();
  const payload: Record<string, unknown> = {
    content,
    communityId: maybeNumber(input.communityId),
  };

  if (input.mediaAssetIds && input.mediaAssetIds.length > 0) {
    payload.mediaAssetIds = input.mediaAssetIds.map((id) => maybeNumber(id));
  }

  if (input.poll) {
    payload.poll = {
      question: input.poll.question.trim(),
      options: input.poll.options.map((option) => option.trim()),
      maxSelections: 1,
      closesAt: input.poll.closesAt ?? undefined,
    };
  }

  return settingsAuthFetch<unknown>("/v1/posts", {
    method: "POST",
    headers: {
      "Idempotency-Key": generateIdempotencyKey(),
    },
    body: JSON.stringify(payload),
  });
}

export async function createPostAndHydrate(input: CreatePostInput): Promise<unknown> {
  const response = await createPost(input);
  if (!isIdOnlyPayload(response)) return response;

  const id = extractPostId(response);
  if (!id) return response;
  return fetchPostById(id);
}
