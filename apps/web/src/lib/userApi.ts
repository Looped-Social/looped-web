import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class UserApiError extends ApiError {}

export type UserMe = {
  id?: number | string;
  email?: string | null;
  username?: string | null;
  name?: string | null;
  display_name?: string | null;
};

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

async function userFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new UserApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchUserMe(): Promise<UserMe> {
  return userFetch<UserMe>("/v1/me");
}

export async function fetchUserProfile(userId: string | number): Promise<unknown> {
  return userFetch<unknown>(`/v1/users/${userId}`);
}

export async function fetchUserPosts({
  userId,
  limit,
  cursor,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/posts?${params.toString()}`);
}

export async function fetchUserReposts({
  userId,
  limit,
  cursor,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/reposts?${params.toString()}`);
}

export async function fetchUserSavedPosts({
  userId,
  limit,
  cursor,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/posts/saved?${params.toString()}`);
}

export async function fetchMyContent({
  limit,
  cursor,
  includePostPreview = false,
}: {
  limit?: number;
  cursor?: string;
  includePostPreview?: boolean;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  params.set("include_post_preview", includePostPreview ? "true" : "false");
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/me/content?${params.toString()}`);
}

export async function fetchUserContent({
  userId,
  limit,
  cursor,
  includePostPreview = false,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
  includePostPreview?: boolean;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  params.set("include_post_preview", includePostPreview ? "true" : "false");
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/content?${params.toString()}`);
}

export async function setUserFollowing(
  userId: string | number,
  following: boolean
): Promise<{ following: boolean }> {
  const response = await userFetch<unknown>(`/v1/users/${userId}/follow`, {
    method: following ? "POST" : "DELETE",
  });

  if (typeof response === "object" && response !== null && "following" in response) {
    const value = (response as { following?: unknown }).following;
    if (typeof value === "boolean") {
      return { following: value };
    }
  }
  return { following };
}

export async function blockUser(userId: string | number): Promise<{ userId: string; blocked: boolean }> {
  const response = await userFetch<unknown>(`/v1/users/${userId}/block`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (typeof response === "object" && response !== null) {
    const payload = response as { userId?: unknown; user_id?: unknown; blocked?: unknown };
    const resolvedUserId =
      typeof payload.userId === "string" || typeof payload.userId === "number"
        ? String(payload.userId)
        : typeof payload.user_id === "string" || typeof payload.user_id === "number"
          ? String(payload.user_id)
          : String(userId);
    const blocked = typeof payload.blocked === "boolean" ? payload.blocked : true;
    return { userId: resolvedUserId, blocked };
  }

  return { userId: String(userId), blocked: true };
}

export async function fetchUserFollowing({
  userId,
  limit,
  cursor,
  query,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
  query?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 50, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  if (query && query.trim().length > 0) params.set("query", query.trim());
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/following?${params.toString()}`);
}

export async function fetchUserFollowers({
  userId,
  limit,
  cursor,
  query,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
  query?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 50, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  if (query && query.trim().length > 0) params.set("query", query.trim());
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/followers?${params.toString()}`);
}

export async function deactivateUser(): Promise<void> {
  await userFetch("/v1/users/me/deactivate", { method: "POST" });
}

export type DeleteUserResponse = {
  status?: string;
  firebase_status?: "ok" | "skipped" | "failed" | "not_requested";
  firebase_deleted?: boolean;
};

export async function deleteUser(): Promise<DeleteUserResponse> {
  return userFetch<DeleteUserResponse>("/v1/users/me/delete", { method: "POST" });
}
