import { buildCursorParams, extractItemsArray, extractNextCursor, isRecord, normalizeOptional } from "./settingsAdapters";
import { SettingsApiError, settingsAuthFetch } from "./settingsHttp";

export type CursorEnvelope<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ViolationItem = {
  id: string;
  type?: string;
  status?: string;
  reason?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
};

export type AppealItem = {
  id: string;
  status?: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  createdAt?: string;
};

export type UnderReviewContentItem = {
  id: string;
  kind?: string;
  status?: string;
  createdAt?: string;
  preview?: string;
};

function normalizeViolationItem(item: unknown): ViolationItem | null {
  if (!isRecord(item)) return null;
  const id = normalizeOptional(item.id ?? item.violation_id ?? item.violationId);
  if (!id) return null;
  return {
    id,
    type: normalizeOptional(item.type ?? item.violationType ?? item.violation_type) ?? undefined,
    status: normalizeOptional(item.status) ?? undefined,
    reason: normalizeOptional(item.reason ?? item.message) ?? undefined,
    targetType: normalizeOptional(item.targetType ?? item.target_type) ?? undefined,
    targetId: normalizeOptional(item.targetId ?? item.target_id) ?? undefined,
    createdAt: normalizeOptional(item.createdAt ?? item.created_at) ?? undefined,
  };
}

function normalizeAppealItem(item: unknown): AppealItem | null {
  if (!isRecord(item)) return null;
  const id = normalizeOptional(item.id ?? item.appeal_id ?? item.appealId);
  if (!id) return null;
  return {
    id,
    status: normalizeOptional(item.status) ?? undefined,
    targetType: normalizeOptional(item.targetType ?? item.target_type) ?? undefined,
    targetId: normalizeOptional(item.targetId ?? item.target_id) ?? undefined,
    reason: normalizeOptional(item.reason ?? item.message) ?? undefined,
    createdAt: normalizeOptional(item.createdAt ?? item.created_at) ?? undefined,
  };
}

function normalizeUnderReviewItem(item: unknown): UnderReviewContentItem | null {
  if (!isRecord(item)) return null;
  const id = normalizeOptional(item.id ?? item.content_id ?? item.contentId ?? item.post_id ?? item.postId);
  if (!id) return null;
  const preview =
    normalizeOptional(item.post_preview ?? item.postPreview) ??
    normalizeOptional(item.content ?? item.text ?? item.body) ??
    undefined;

  return {
    id,
    kind: normalizeOptional(item.kind ?? item.type ?? item.content_type ?? item.contentType) ?? undefined,
    status: normalizeOptional(item.status ?? item.review_status ?? item.reviewStatus) ?? undefined,
    createdAt: normalizeOptional(item.createdAt ?? item.created_at) ?? undefined,
    preview,
  };
}

export async function fetchViolations({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<ViolationItem>> {
  const params = buildCursorParams({ limit, cursor, fallbackLimit: 20 });
  const response = await settingsAuthFetch<unknown>(`/v1/violations?${params.toString()}`);
  return {
    items: extractItemsArray(response).map(normalizeViolationItem).filter((item): item is ViolationItem => Boolean(item)),
    nextCursor: extractNextCursor(response),
  };
}

export async function fetchAppeals({
  status,
}: {
  status?: string;
} = {}): Promise<AppealItem[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const path = params.size > 0 ? `/v1/appeals?${params.toString()}` : "/v1/appeals";
  const response = await settingsAuthFetch<unknown>(path);
  return extractItemsArray(response).map(normalizeAppealItem).filter((item): item is AppealItem => Boolean(item));
}

export async function createAppeal(payload: {
  targetType: string;
  targetId?: string | number;
  reason: string;
}): Promise<void> {
  await settingsAuthFetch("/v1/appeals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function fetchUnderReviewByPath(path: string): Promise<CursorEnvelope<UnderReviewContentItem>> {
  const response = await settingsAuthFetch<unknown>(path);
  return {
    items: extractItemsArray(response)
      .map(normalizeUnderReviewItem)
      .filter((item): item is UnderReviewContentItem => Boolean(item)),
    nextCursor: extractNextCursor(response),
  };
}

export async function fetchUnderReviewContent({
  limit = 20,
  cursor,
  userId,
}: {
  limit?: number;
  cursor?: string;
  userId?: string;
} = {}): Promise<CursorEnvelope<UnderReviewContentItem>> {
  const params = buildCursorParams({ limit, cursor, fallbackLimit: 20 });
  params.set("include_post_preview", "true");

  try {
    return await fetchUnderReviewByPath(`/v1/users/me/content?${params.toString()}`);
  } catch (error) {
    if (!(error instanceof SettingsApiError) || error.status !== 404 || !userId) {
      throw error;
    }
    return fetchUnderReviewByPath(`/v1/users/${encodeURIComponent(userId)}/content?${params.toString()}`);
  }
}
