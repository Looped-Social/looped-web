import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class CommentsApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
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
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
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
    notifyAuthGateFromHttpError({ status: response.status, details, source: "commentsApi" });
    throw new CommentsApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchPostDetail(postId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/posts/${postId}`);
}

export async function fetchPostComments({
  postId,
  limit,
  cursor,
}: {
  postId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  return authFetch<CursorEnvelope<unknown>>(`/v1/posts/${postId}/comments?${params.toString()}`);
}

export async function fetchCommentReplies({
  commentId,
  limit,
  cursor,
}: {
  commentId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);
  return authFetch<CursorEnvelope<unknown>>(`/v1/comments/${commentId}/replies?${params.toString()}`);
}

export async function createPostComment({
  postId,
  content,
  parentId = null,
  mediaAssetId = null,
}: {
  postId: string | number;
  content: string;
  parentId?: string | number | null;
  mediaAssetId?: string | number | null;
}): Promise<unknown> {
  return authFetch<unknown>(`/v1/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({
      content,
      parentId,
      mediaAssetId,
    }),
  });
}

export type ViewerInteractionState = {
  isAnonymous: boolean;
  isVerified: boolean | null;
};

export async function fetchViewerInteractionState(): Promise<ViewerInteractionState> {
  const response = await authFetch<unknown>("/v1/me");
  if (!isRecord(response)) {
    return {
      isAnonymous: false,
      isVerified: null,
    };
  }

  const user = isRecord(response.user) ? response.user : null;
  const scope = user ?? response;

  const isAnonymous =
    pickBoolean(scope, ["is_anonymous", "isAnonymous"]) ??
    pickBoolean(response, ["is_anonymous", "isAnonymous"]) ??
    false;

  const isVerified =
    pickBoolean(scope, [
      "verified",
      "is_verified",
      "isVerified",
      "user_verified",
      "userVerified",
      "verification_complete",
      "verificationComplete",
    ]) ??
    pickBoolean(response, [
      "verified",
      "is_verified",
      "isVerified",
      "user_verified",
      "userVerified",
      "verification_complete",
      "verificationComplete",
    ]) ??
    null;

  return {
    isAnonymous,
    isVerified,
  };
}

export async function setCommentLiked(
  commentId: string | number,
  liked: boolean
): Promise<{ likesCount?: number; userLiked: boolean; likedByCreator?: boolean }> {
  const response = await authFetch<unknown>(`/v1/comments/${commentId}/like`, {
    method: liked ? "POST" : "DELETE",
  });

  if (isRecord(response)) {
    return {
      likesCount: pickNumber(response, ["likes_count", "likesCount"]),
      userLiked: pickBoolean(response, ["user_liked", "userLiked"]) ?? liked,
      likedByCreator: pickBoolean(response, ["liked_by_creator", "likedByCreator"]),
    };
  }

  return { userLiked: liked };
}
