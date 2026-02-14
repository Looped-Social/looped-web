import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class PostReadApiError extends ApiError {}

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
    notifyAuthGateFromHttpError({ status: response.status, details, source: "postReadApi" });
    throw new PostReadApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return { items: [] } as T;
  }

  return response.json() as Promise<T>;
}

function buildCursorParams({
  limit,
  cursor,
  defaultLimit = 20,
  min = 1,
  max = 100,
}: {
  limit?: number;
  cursor?: string;
  defaultLimit?: number;
  min?: number;
  max?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, defaultLimit, min, max)));
  if (cursor) params.set("cursor", cursor);
  return params;
}

export async function fetchPostById(postId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/posts/${postId}`);
}

export async function fetchPostsLiked({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/posts/liked?${params.toString()}`);
}

export async function fetchPostsSaved({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/posts/saved?${params.toString()}`);
}

export async function fetchPostsReposted({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/posts/reposted?${params.toString()}`);
}

export async function fetchMyReposts({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/users/me/reposts?${params.toString()}`);
}

export async function fetchHashtagPosts({
  name,
  limit,
  cursor,
}: {
  name: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const normalized = name.trim().replace(/^#/, "");
  if (!normalized) {
    throw new PostReadApiError(422, "invalid_hashtag", "invalid_hashtag");
  }
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/hashtags/${encodeURIComponent(normalized)}/posts?${params.toString()}`);
}
