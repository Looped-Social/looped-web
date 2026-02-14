import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class FeedApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
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
    notifyAuthGateFromHttpError({ status: response.status, details, source: "feedApi" });
    throw new FeedApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return { items: [] } as T;
  }

  return response.json() as Promise<T>;
}

export type FeedMode = "for_you" | "new" | "recent" | "following";

export async function fetchFeed({
  limit,
  cursor,
  mode = "for_you",
  communityId,
}: {
  limit?: number;
  cursor?: string;
  mode?: FeedMode;
  communityId?: string | number;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  params.set("mode", mode);
  if (cursor) params.set("cursor", cursor);
  if (communityId !== undefined && communityId !== null && String(communityId).length > 0) {
    params.set("communityId", String(communityId));
  }

  return authFetch<CursorEnvelope<unknown>>(`/v1/feed?${params.toString()}`);
}

export async function fetchFollowedCommunities({
  limit,
  cursor,
  order = "relevant",
}: {
  limit?: number;
  cursor?: string;
  order?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 50, 1, 100)));
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
