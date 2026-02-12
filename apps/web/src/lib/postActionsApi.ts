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

function getString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(obj[key]);
    if (value !== undefined) return value;
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

export async function votePoll(
  pollId: string | number,
  selectedOptionIds: Array<string | number>
): Promise<unknown> {
  return authFetch<unknown>(`/v1/polls/${pollId}/vote`, {
    method: "PUT",
    body: JSON.stringify({
      selectedOptionIds: selectedOptionIds.map((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      }),
    }),
  });
}

export async function updatePostContent(postId: string | number, content: string): Promise<unknown> {
  return authFetch<unknown>(`/v1/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify({
      content,
    }),
  });
}

export async function deletePost(postId: string | number): Promise<{ id?: string; deleted: boolean }> {
  const response = await authFetch<unknown>(`/v1/posts/${postId}`, {
    method: "DELETE",
  });

  if (isRecord(response)) {
    return {
      id: pickString(response, ["id", "post_id", "postId"]),
      deleted: pickBoolean(response, ["deleted"]) ?? true,
    };
  }

  return {
    deleted: true,
  };
}

export async function reportEntity({
  targetType,
  targetId,
  reason,
}: {
  targetType: "post" | "user";
  targetId: string | number;
  reason: string;
}): Promise<{ id?: string }> {
  const response = await authFetch<unknown>("/v1/reports", {
    method: "POST",
    body: JSON.stringify({
      targetType,
      targetId: Number.isFinite(Number(targetId)) ? Number(targetId) : targetId,
      reason,
    }),
  });

  if (isRecord(response)) {
    return {
      id: pickString(response, ["id", "report_id", "reportId"]),
    };
  }

  return {};
}

export async function blockUser(userId: string | number): Promise<{ userId: string; blocked: boolean }> {
  const response = await authFetch<unknown>(`/v1/users/${userId}/block`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (isRecord(response)) {
    return {
      userId: pickString(response, ["userId", "user_id"]) ?? String(userId),
      blocked: pickBoolean(response, ["blocked"]) ?? true,
    };
  }

  return {
    userId: String(userId),
    blocked: true,
  };
}

export async function blockPrincipal(principalId: string | number): Promise<{ principalId: string; blocked: boolean }> {
  const response = await authFetch<unknown>(`/v1/principals/${principalId}/block`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (isRecord(response)) {
    return {
      principalId: pickString(response, ["principalId", "principal_id"]) ?? String(principalId),
      blocked: pickBoolean(response, ["blocked"]) ?? true,
    };
  }

  return {
    principalId: String(principalId),
    blocked: true,
  };
}

export async function appealPostRemoval({
  postId,
  reason,
}: {
  postId: string | number;
  reason: string;
}): Promise<{ id?: string }> {
  const response = await authFetch<unknown>("/v1/appeals", {
    method: "POST",
    body: JSON.stringify({
      targetType: "post_removal",
      targetId: Number.isFinite(Number(postId)) ? Number(postId) : postId,
      reason,
    }),
  });

  if (isRecord(response)) {
    return {
      id: pickString(response, ["id", "appeal_id", "appealId"]),
    };
  }

  return {};
}
