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

async function userFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
  limit = 20,
  cursor,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/posts?${params.toString()}`);
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

export async function fetchUserFollowing({
  userId,
  limit = 50,
  cursor,
  query,
}: {
  userId: string | number;
  limit?: number;
  cursor?: string;
  query?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  if (query && query.trim().length > 0) params.set("query", query.trim());
  return userFetch<CursorEnvelope<unknown>>(`/v1/users/${userId}/following?${params.toString()}`);
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
