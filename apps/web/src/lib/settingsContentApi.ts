import { buildCursorParams, extractItemsArray, extractNextCursor } from "./settingsAdapters";
import { settingsAuthFetch } from "./settingsHttp";

export type CursorEnvelope<T> = {
  items: T[];
  nextCursor: string | null;
};

async function fetchCursorCollection(path: string): Promise<CursorEnvelope<unknown>> {
  const response = await settingsAuthFetch<unknown>(path);
  return {
    items: extractItemsArray(response),
    nextCursor: extractNextCursor(response),
  };
}

export async function fetchSettingsUserPosts({
  userId,
  limit = 20,
  cursor,
}: {
  userId: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallbackLimit: 20, max: 100 });
  return fetchCursorCollection(`/v1/users/${encodeURIComponent(userId)}/posts?${params.toString()}`);
}

export async function fetchSettingsUserReplies({
  userId,
  limit = 20,
  cursor,
}: {
  userId: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallbackLimit: 20, max: 100 });
  return fetchCursorCollection(`/v1/users/${encodeURIComponent(userId)}/replies?${params.toString()}`);
}

export async function fetchSettingsLikedPosts({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallbackLimit: 20, max: 100 });
  return fetchCursorCollection(`/v1/posts/liked?${params.toString()}`);
}

export async function fetchSettingsSavedPosts({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallbackLimit: 20, max: 100 });
  return fetchCursorCollection(`/v1/posts/saved?${params.toString()}`);
}
