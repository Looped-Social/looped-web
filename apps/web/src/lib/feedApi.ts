import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class FeedApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getFirebaseIdToken();
  const base = getApiBase();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new FeedApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return { items: [] } as T;
  }

  return response.json() as Promise<T>;
}

export type FeedMode = "for_you" | "new" | "following";

export async function fetchFeed({
  limit = 20,
  cursor,
  mode,
  communityId,
}: {
  limit?: number;
  cursor?: string;
  mode: FeedMode;
  communityId?: string | number;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("mode", mode);
  if (cursor) params.set("cursor", cursor);
  if (communityId !== undefined && communityId !== null && String(communityId).length > 0) {
    params.set("communityId", String(communityId));
  }

  return authFetch<CursorEnvelope<unknown>>(`/v1/feed?${params.toString()}`);
}

export async function fetchFollowedCommunities({
  limit = 50,
  cursor,
  order = "relevant",
}: {
  limit?: number;
  cursor?: string;
  order?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  if (order) params.set("order", order);

  try {
    return await authFetch<CursorEnvelope<unknown>>(
      `/v1/me/followed/communities?${params.toString()}`
    );
  } catch (error) {
    if (error instanceof FeedApiError && error.status === 404) {
      return authFetch<CursorEnvelope<unknown>>(`/v1/me/followed/loops?${params.toString()}`);
    }
    throw error;
  }
}
