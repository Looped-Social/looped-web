import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class SearchApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

export type SpecializationType = "major" | "field";
export type CommunitySearchKind = "company" | "school" | "major" | "field";

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
    throw new SearchApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return { items: [] } as T;
  }

  return response.json() as Promise<T>;
}

function buildCursorParams({
  limit,
  cursor,
}: {
  limit?: number;
  cursor?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(limit));
  }
  if (cursor) params.set("cursor", cursor);
  return params;
}

export async function fetchTrendingPosts({
  limit,
  communityId,
}: {
  limit?: number;
  communityId?: string | number;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit: clampLimit(limit, 3, 1, 10) });
  if (communityId !== undefined && communityId !== null && String(communityId).length > 0) {
    params.set("communityId", String(communityId));
  }
  return authFetch<CursorEnvelope<unknown>>(`/v1/feed/trending?${params.toString()}`);
}

export async function fetchRecommendedCommunities({
  limit = 8,
  cursor,
  kind,
}: {
  limit?: number;
  cursor?: string;
  kind?: CommunitySearchKind;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  if (kind) params.set("kind", kind);
  return authFetch<CursorEnvelope<unknown>>(`/v1/communities/recommended?${params.toString()}`);
}

export async function fetchSpecializationsBrowse({
  type,
  limit,
  cursor,
}: {
  type: SpecializationType;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  params.set("type", type);
  return authFetch<CursorEnvelope<unknown>>(`/v1/specializations/browse?${params.toString()}`);
}

export async function fetchMajorsIndex(): Promise<unknown> {
  return authFetch<unknown>("/v1/majors");
}

export async function fetchFieldsIndex(): Promise<unknown> {
  return authFetch<unknown>("/v1/fields");
}

export async function searchUsers({
  query,
  limit = 20,
  cursor,
}: {
  query: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  params.set("query", query);
  return authFetch<CursorEnvelope<unknown>>(`/v1/users/search?${params.toString()}`);
}

export async function searchPosts({
  query,
  limit,
  cursor,
}: {
  query: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new SearchApiError(422, "query_required", "query_required");
  }
  const params = buildCursorParams({ limit: clampLimit(limit, 20, 1, 100), cursor });
  params.set("query", normalizedQuery);
  return authFetch<CursorEnvelope<unknown>>(`/v1/posts/search?${params.toString()}`);
}

export async function searchCommunities({
  query,
  kind,
  limit = 20,
  cursor,
}: {
  query: string;
  kind?: CommunitySearchKind;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  params.set("query", query);
  if (kind) params.set("kind", kind);
  return authFetch<CursorEnvelope<unknown>>(`/v1/communities/search?${params.toString()}`);
}

export async function searchHashtags({
  query,
  limit = 5,
}: {
  query: string;
  limit?: number;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit });
  params.set("query", query);
  return authFetch<CursorEnvelope<unknown>>(`/v1/hashtags/search?${params.toString()}`);
}
