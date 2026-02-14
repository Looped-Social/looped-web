import { ApiError, getApiBase } from "./apiBase";

export class ProfileShareApiError extends ApiError {}
export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

type PublicFetchInit = RequestInit | undefined;

async function publicFetch(path: string, init?: PublicFetchInit): Promise<Response> {
  const base = getApiBase();
  const headers = new Headers(init?.headers ?? undefined);
  if (init?.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${base}${path}`, {
    ...init,
    headers,
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const details = await response.text();
    throw new ProfileShareApiError(response.status, details || "Request failed.", details);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export async function fetchSharedProfileByUsername(username: string): Promise<unknown> {
  const raw = username.trim().replace(/^\/+/, "");
  const response = await publicFetch(`/v1/public/profiles/${encodeURIComponent(raw)}`, {
    headers: {
      Accept: "application/json",
    },
  });
  return parseJsonResponse<unknown>(response);
}

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export async function fetchSharedProfilePosts({
  username,
  limit,
  cursor,
}: {
  username: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const raw = username.trim().replace(/^\/+/, "");
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);

  const response = await publicFetch(`/v1/public/profiles/${encodeURIComponent(raw)}/posts?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });
  return parseJsonResponse<CursorEnvelope<unknown>>(response);
}

export async function fetchSharedProfileReposts({
  username,
  limit,
  cursor,
}: {
  username: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const raw = username.trim().replace(/^\/+/, "");
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);

  const response = await publicFetch(`/v1/public/profiles/${encodeURIComponent(raw)}/reposts?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });
  return parseJsonResponse<CursorEnvelope<unknown>>(response);
}
