import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class CommunityDetailApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

type JoinLimitType = "major" | "field";

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
    throw new CommunityDetailApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) return {} as T;
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

export async function fetchCommunityDetail(communityId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/communities/${communityId}`);
}

export async function fetchSpecializationDetail(specializationId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/specializations/${specializationId}`);
}

export async function fetchCommunityPosts({
  communityId,
  limit,
  cursor,
}: {
  communityId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit: clampLimit(limit, 20, 1, 100), cursor });
  params.set("communityId", String(communityId));
  params.set("mode", "for_you");
  return authFetch<CursorEnvelope<unknown>>(`/v1/feed?${params.toString()}`);
}

export async function fetchCommunityHashtags({
  communityId,
  limit,
  cursor,
}: {
  communityId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit: clampLimit(limit, 20, 1, 100), cursor });
  params.set("communityId", String(communityId));
  try {
    return await authFetch<CursorEnvelope<unknown>>(`/v1/feed/hashtags?${params.toString()}`);
  } catch (error) {
    if (error instanceof CommunityDetailApiError && error.status === 400) {
      const details = (error.details ?? "").toLowerCase();
      if (details.includes("community_id_required")) {
        const legacy = buildCursorParams({ limit: clampLimit(limit, 20, 1, 100), cursor });
        legacy.set("community_id", String(communityId));
        return authFetch<CursorEnvelope<unknown>>(`/v1/feed/hashtags?${legacy.toString()}`);
      }
    }
    throw error;
  }
}

export async function fetchCommunityVerifications(): Promise<CursorEnvelope<unknown>> {
  return authFetch<CursorEnvelope<unknown>>("/v1/communities/verifications");
}

export async function fetchSpecializationJoinLimits(type: JoinLimitType): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("type", type);
  return authFetch<unknown>(`/v1/me/specializations/join-limits?${params.toString()}`);
}

async function setFollowingAtPath(path: string, following: boolean): Promise<{ following: boolean }> {
  const response = await authFetch<unknown>(path, {
    method: following ? "POST" : "DELETE",
  });

  if (typeof response === "object" && response !== null && "following" in response) {
    const value = (response as { following?: unknown }).following;
    if (typeof value === "boolean") return { following: value };
  }

  return { following };
}

export async function setCommunityFollowing(
  communityId: string | number,
  following: boolean
): Promise<{ following: boolean }> {
  return setFollowingAtPath(`/v1/communities/${communityId}/follow`, following);
}

export async function setSpecializationFollowing(
  specializationId: string | number,
  following: boolean
): Promise<{ following: boolean }> {
  return setFollowingAtPath(`/v1/specializations/${specializationId}/follow`, following);
}

async function setJoinedAtPath(path: string, joined: boolean): Promise<{ joined: boolean }> {
  const response = await authFetch<unknown>(path, {
    method: joined ? "POST" : "DELETE",
  });

  if (typeof response === "object" && response !== null && "joined" in response) {
    const value = (response as { joined?: unknown }).joined;
    if (typeof value === "boolean") return { joined: value };
  }

  return { joined };
}

export async function setSpecializationJoined(
  specializationId: string | number,
  joined: boolean
): Promise<{ joined: boolean }> {
  try {
    return await setJoinedAtPath(`/v1/communities/${specializationId}/join`, joined);
  } catch (error) {
    if (error instanceof CommunityDetailApiError && error.status === 404) {
      return setJoinedAtPath(`/v1/specializations/${specializationId}/join`, joined);
    }
    throw error;
  }
}
