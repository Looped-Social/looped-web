import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class AnonProfileApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

async function anonFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new AnonProfileApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return { items: [] } as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchAnonProfile(anonProfileId: string | number): Promise<unknown> {
  return anonFetch<unknown>(`/v1/anon/${anonProfileId}`);
}

export async function fetchAnonContent({
  anonProfileId,
  limit = 20,
  cursor,
  includePostPreview = true,
}: {
  anonProfileId: string | number;
  limit?: number;
  cursor?: string;
  includePostPreview?: boolean;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  params.set("include_post_preview", includePostPreview ? "true" : "false");
  return anonFetch<CursorEnvelope<unknown>>(`/v1/anon/${anonProfileId}/content?${params.toString()}`);
}

export async function fetchAnonReposts({
  anonProfileId,
  limit = 20,
  cursor,
}: {
  anonProfileId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  return anonFetch<CursorEnvelope<unknown>>(`/v1/anon/${anonProfileId}/reposts?${params.toString()}`);
}

export async function setAnonFollowing(
  anonProfileId: string | number,
  following: boolean
): Promise<{ following: boolean }> {
  const response = await anonFetch<unknown>(`/v1/anon/${anonProfileId}/follow`, {
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
