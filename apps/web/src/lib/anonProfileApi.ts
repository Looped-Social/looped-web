import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class AnonProfileApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

type FollowAsAnonProof = {
  anonProfileId: string | number;
  anonCert: string;
  anonCertKid: string;
  anonSig: string;
};

async function anonFetch<T>(path: string, init?: RequestInit, options?: { omitAuth?: boolean }): Promise<T> {
  const token = options?.omitAuth ? null : await getFirebaseIdToken();
  const base = getApiBase();
  const headers = new Headers(init?.headers ?? {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init?.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const details = await response.text();
    if (!options?.omitAuth) {
      notifyAuthGateFromHttpError({ status: response.status, details, source: "anonProfileApi" });
    }
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

export async function fetchAnonPosts({
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
  return anonFetch<CursorEnvelope<unknown>>(`/v1/anon/${anonProfileId}/posts?${params.toString()}`);
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
  following: boolean,
  options?: { asAnon?: FollowAsAnonProof }
): Promise<{ following: boolean }> {
  const asAnon = options?.asAnon;
  const anonActorProfileId =
    asAnon && typeof asAnon.anonProfileId === "string" && asAnon.anonProfileId.trim().length > 0
      ? asAnon.anonProfileId.trim()
      : asAnon?.anonProfileId;
  const response = await anonFetch<unknown>(
    `/v1/anon/${anonProfileId}/follow`,
    {
      method: following ? "POST" : "DELETE",
      headers: asAnon ? { "X-Actor": "anon" } : undefined,
      body: JSON.stringify(
        asAnon
          ? {
              as_anon: true,
              anon_profile_id: anonActorProfileId,
              anon_cert: asAnon.anonCert,
              anon_cert_kid: asAnon.anonCertKid,
              anon_sig: asAnon.anonSig,
            }
          : {}
      ),
    },
    { omitAuth: Boolean(asAnon) }
  );

  if (typeof response === "object" && response !== null) {
    const value = (response as { following?: unknown; is_following?: unknown; isFollowing?: unknown }).following
      ?? (response as { is_following?: unknown }).is_following
      ?? (response as { isFollowing?: unknown }).isFollowing;
    if (typeof value === "boolean") return { following: value };
  }
  return { following };
}
