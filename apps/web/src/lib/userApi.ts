import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
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
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new UserApiError(0, message, message);
  }

  if (!response.ok) {
    const details = await response.text();
    notifyAuthGateFromHttpError({ status: response.status, details, source: "userApi" });
    throw new UserApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UserApiError(response.status, "Unexpected server response.", text);
  }
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

export type DeletionStatus = "none" | "in_progress" | "pending" | "completed" | "failed";

export type DeleteUserResponse = {
  status?: string;
  deletion_status?: DeletionStatus;
  operation_id?: string;
  status_endpoint?: string;
  error?: string;
  firebase_status?: "ok" | "skipped" | "failed" | "not_requested";
  firebase_deleted?: boolean;
  delete_pending?: boolean;
};

export type DeleteUserStatusResponse = {
  deletion_status?: DeletionStatus;
  delete_pending?: boolean;
  operation_id?: string;
  status_endpoint?: string;
  requested_at?: string;
  updated_at?: string;
  completed_at?: string;
  error?: string;
};

export type SlugAvailabilityResponse = {
  slug?: string;
  available?: boolean;
  ownedByMe?: boolean;
  owned_by_me?: boolean;
  reserved?: boolean;
};

export type MyShareLinkResponse = {
  usernameSlug?: string;
  username_slug?: string;
  customSlug?: string | null;
  custom_slug?: string | null;
  activeSlug?: string;
  active_slug?: string;
  canonicalUrl?: string;
  canonical_url?: string;
};

export type UnlinkProviderResponse = {
  unlinked?: boolean | null;
  disconnected?: boolean | null;
  linked?: boolean | null;
  providerLinked?: boolean | null;
  status?: string | null;
  message?: string | null;
  [key: string]: unknown;
};

export async function deleteUser(): Promise<DeleteUserResponse> {
  return userFetch<DeleteUserResponse>("/v1/users/me/delete", { method: "POST" });
}

function normalizeDeletionStatus(value: unknown): DeletionStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "in_progress" ||
    normalized === "pending" ||
    normalized === "completed" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  return null;
}

export function resolveDeletionStatus(response: {
  deletion_status?: unknown;
  delete_pending?: unknown;
}): DeletionStatus | null {
  const explicitStatus = normalizeDeletionStatus(response.deletion_status);
  if (explicitStatus) return explicitStatus;
  if (response.delete_pending === true) return "pending";
  if (response.delete_pending === false) return "completed";
  return null;
}

export function isDeleteInProgress(status: DeletionStatus | null | undefined): boolean {
  return status === "pending" || status === "in_progress";
}

export function isDeleteCompleted(status: DeletionStatus | null | undefined): boolean {
  return status === "completed";
}

const DEFAULT_DELETE_STATUS_PATH = "/v1/users/me/delete-status";

function resolveDeleteStatusPath(statusEndpoint?: string): string {
  const normalized = normalizeString(statusEndpoint);
  if (!normalized) return DEFAULT_DELETE_STATUS_PATH;

  if (normalized.startsWith("/")) return normalized;

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const endpointUrl = new URL(normalized);
      const apiBaseUrl = new URL(getApiBase());
      if (endpointUrl.origin !== apiBaseUrl.origin) return DEFAULT_DELETE_STATUS_PATH;
      return `${endpointUrl.pathname}${endpointUrl.search}` || DEFAULT_DELETE_STATUS_PATH;
    } catch {
      return DEFAULT_DELETE_STATUS_PATH;
    }
  }

  return `/${normalized.replace(/^\/+/, "")}`;
}

export async function fetchDeleteUserStatus(statusEndpoint?: string): Promise<DeleteUserStatusResponse> {
  return userFetch<DeleteUserStatusResponse>(resolveDeleteStatusPath(statusEndpoint));
}

export async function fetchSlugAvailability(slug: string): Promise<SlugAvailabilityResponse> {
  const normalized = slug.trim().toLowerCase();
  const params = new URLSearchParams();
  params.set("slug", normalized);
  return userFetch<SlugAvailabilityResponse>(`/v1/users/slug/availability?${params.toString()}`);
}

export async function fetchMyShareLink(): Promise<MyShareLinkResponse> {
  return userFetch<MyShareLinkResponse>("/v1/users/me/share-link");
}

export async function updateMyShareLink(customSlug: string | null): Promise<MyShareLinkResponse> {
  return userFetch<MyShareLinkResponse>("/v1/users/me/share-link", {
    method: "PUT",
    body: JSON.stringify({ customSlug }),
  });
}

export async function unlinkGoogleProvider(): Promise<UnlinkProviderResponse> {
  return userFetch<UnlinkProviderResponse>("/v1/me/providers/google", { method: "DELETE" });
}

export async function unlinkAppleProvider(): Promise<UnlinkProviderResponse> {
  return userFetch<UnlinkProviderResponse>("/v1/me/providers/apple", { method: "DELETE" });
}

type ParsedUserApiError = {
  status: number | null;
  code: string | null;
  reason: string | null;
  message: string;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseUserApiError(error: unknown): ParsedUserApiError {
  if (error instanceof UserApiError) {
    const fallbackMessage = error.message || "Request failed.";
    const details = (error.details ?? "").trim();
    if (!details) {
      return {
        status: error.status,
        code: null,
        reason: null,
        message: fallbackMessage,
      };
    }

    try {
      const parsed = JSON.parse(details) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        const payload = parsed as Record<string, unknown>;
        const code = normalizeString(payload.error ?? payload.code);
        const reason = normalizeString(payload.reason ?? payload.cause ?? payload.detailCode ?? payload.detail_code);
        const message = normalizeString(payload.message) ?? fallbackMessage;
        return {
          status: error.status,
          code,
          reason,
          message,
        };
      }
    } catch {
      // ignore JSON parsing errors and fall back to raw details
    }

    return {
      status: error.status,
      code: null,
      reason: null,
      message: details || fallbackMessage,
    };
  }

  if (error instanceof Error) {
    return {
      status: null,
      code: null,
      reason: null,
      message: error.message,
    };
  }

  return {
    status: null,
    code: null,
    reason: null,
    message: "Request failed.",
  };
}
