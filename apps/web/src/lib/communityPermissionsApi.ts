import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class CommunityPermissionsApiError extends ApiError {}

export type CommunityPermissions = {
  can_post: boolean;
  canPost?: boolean;
  requires_verification: boolean;
  requires_join: boolean;
  requiresJoin?: boolean;
};

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
    throw new CommunityPermissionsApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

const permissionsCache = new Map<string, Promise<CommunityPermissions>>();

export function getCommunityPermissions(communityId: string | number): Promise<CommunityPermissions> {
  const key = String(communityId);
  const existing = permissionsCache.get(key);
  if (existing) return existing;

  const promise = authFetch<CommunityPermissions>(`/v1/communities/${key}/permissions`).catch((error) => {
    permissionsCache.delete(key);
    throw error;
  });
  permissionsCache.set(key, promise);
  return promise;
}
