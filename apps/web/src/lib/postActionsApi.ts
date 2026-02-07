import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class PostActionsApiError extends ApiError {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "1") return true;
    if (normalized === "0") return false;
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = getNumber(obj[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function pickBoolean(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = getBoolean(obj[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

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
    throw new PostActionsApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function setPostLike(postId: string | number, liked: boolean): Promise<{ likesCount?: number }> {
  const response = await authFetch<unknown>(`/v1/posts/${postId}/like`, { method: liked ? "POST" : "DELETE" });
  if (isRecord(response)) {
    const likesCount = pickNumber(response, ["likes_count", "likesCount"]);
    if (likesCount !== undefined) return { likesCount };
  }
  return {};
}

export async function setPostSaved(postId: string | number, saved: boolean): Promise<{ saved: boolean }> {
  const response = await authFetch<unknown>(`/v1/posts/${postId}/save`, { method: saved ? "POST" : "DELETE" });
  if (isRecord(response)) {
    const savedValue = pickBoolean(response, ["saved", "is_saved", "isSaved"]);
    if (savedValue !== undefined) return { saved: savedValue };
  }
  return { saved };
}

export async function setPostReposted(
  postId: string | number,
  reposted: boolean
): Promise<{ viewerHasReposted: boolean }> {
  const response = await authFetch<unknown>(`/v1/posts/${postId}/repost`, { method: reposted ? "PUT" : "DELETE" });
  if (isRecord(response)) {
    const viewerHasReposted = pickBoolean(response, ["viewer_has_reposted", "viewerHasReposted"]);
    if (viewerHasReposted !== undefined) return { viewerHasReposted };
  }
  return { viewerHasReposted: reposted };
}

export async function sharePost(postId: string | number): Promise<{ shareCount?: number }> {
  const response = await authFetch<unknown>(`/v1/posts/${postId}/share`, { method: "POST" });
  if (isRecord(response)) {
    const shareCount = pickNumber(response, ["share_count", "shareCount"]);
    if (shareCount !== undefined) return { shareCount };
  }
  return {};
}
