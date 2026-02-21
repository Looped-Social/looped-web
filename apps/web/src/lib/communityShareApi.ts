import { ApiError, getApiBase } from "./apiBase";

export class CommunityShareApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

async function publicFetch(path: string, init?: RequestInit): Promise<Response> {
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
    throw new CommunityShareApiError(response.status, details || "Request failed.", details);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export async function fetchSharedCommunityById(communityId: string | number): Promise<unknown> {
  const raw = String(communityId).trim();
  const response = await publicFetch(`/v1/public/communities/${encodeURIComponent(raw)}`, {
    headers: {
      Accept: "application/json",
    },
  });
  return parseJsonResponse<unknown>(response);
}

export async function fetchSharedCommunityPosts({
  communityId,
  limit,
  cursor,
}: {
  communityId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const raw = String(communityId).trim();
  const params = new URLSearchParams();
  params.set("limit", String(clampLimit(limit, 20, 1, 100)));
  if (cursor) params.set("cursor", cursor);

  const response = await publicFetch(`/v1/public/communities/${encodeURIComponent(raw)}/posts?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });
  return parseJsonResponse<CursorEnvelope<unknown>>(response);
}
