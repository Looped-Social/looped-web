import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";
import { completeMediaUpload, presignMediaUpload, uploadFileWithPresign } from "./mediaApi";

export class ProfileEditApiError extends ApiError {}

type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

type UsernameAvailabilityResponse = {
  username?: string;
  available?: boolean;
  ownedByMe?: boolean;
  owned_by_me?: boolean;
};

const APP_CONFIG_CACHE_KEY = "looped-app-config-default-avatar";
const APP_CONFIG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let appConfigDefaultAvatarCache: { value: string | null; expiresAt: number } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
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

function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
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
    notifyAuthGateFromHttpError({ status: response.status, details, source: "profileEditApi" });
    throw new ProfileEditApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);

  try {
    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      return { width, height };
    }

    const image = await loadImage(objectUrl);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to read image dimensions."));
    img.src = src;
  });
}

function readCachedDefaultProfileImageUrl(): string | null | undefined {
  if (appConfigDefaultAvatarCache && appConfigDefaultAvatarCache.expiresAt > Date.now()) {
    return appConfigDefaultAvatarCache.value;
  }

  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(APP_CONFIG_CACHE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return undefined;
    const expiresAt = getNumber(parsed.expiresAt);
    if (!expiresAt || expiresAt <= Date.now()) return undefined;
    const value = normalizeOptional(parsed.value) ?? null;
    appConfigDefaultAvatarCache = { value, expiresAt };
    return value;
  } catch {
    return undefined;
  }
}

function writeCachedDefaultProfileImageUrl(value?: string) {
  const expiresAt = Date.now() + APP_CONFIG_CACHE_TTL_MS;
  const normalized = value ?? null;
  appConfigDefaultAvatarCache = { value: normalized, expiresAt };
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_CONFIG_CACHE_KEY, JSON.stringify({ value: normalized, expiresAt }));
  } catch {
    // ignore cache write failures
  }
}

export async function fetchDefaultProfileImageUrl(): Promise<string | undefined> {
  const cached = readCachedDefaultProfileImageUrl();
  if (cached !== undefined) return cached ?? undefined;

  const response = await authFetch<unknown>("/v1/app-config");
  let value: string | undefined;
  if (isRecord(response)) {
    value = normalizeOptional(response.default_profile_image_url ?? response.defaultProfileImageUrl);
  }
  writeCachedDefaultProfileImageUrl(value);
  return value;
}

export async function fetchUsernameAvailability(username: string): Promise<UsernameAvailabilityResponse> {
  const normalized = username.trim().toLowerCase();
  const params = new URLSearchParams();
  params.set("username", normalized);
  return authFetch<UsernameAvailabilityResponse>(`/v1/users/username/availability?${params.toString()}`);
}

export async function updateMyIdentity(payload: {
  username: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
}): Promise<unknown> {
  return authFetch<unknown>("/v1/users/me/identity", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateMyProfile(payload: {
  displayName: string;
  bio: string;
  isAnonymous: boolean;
  showFollowerCount?: boolean | null;
  messagePermission?: string;
  profileMediaAssetId?: string | number;
}): Promise<unknown> {
  return authFetch<unknown>("/v1/users/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateMyDisplayCommunity(communityId: string | number | null): Promise<unknown> {
  return authFetch<unknown>("/v1/users/me/display-community", {
    method: "PUT",
    body: JSON.stringify({ communityId }),
  });
}

export async function updateMyDisplaySpecialization(specializationId: string | number | null): Promise<unknown> {
  return authFetch<unknown>("/v1/users/me/display-specialization", {
    method: "PUT",
    body: JSON.stringify({ specializationId }),
  });
}

export async function fetchProfileCommunities(): Promise<unknown[]> {
  const response = await authFetch<unknown>("/v1/communities/verifications");
  if (Array.isArray(response)) return response;
  if (isRecord(response) && Array.isArray(response.items)) return response.items;
  return [];
}

export async function fetchJoinedSpecializations({
  type = "all",
  limit = 200,
  cursor,
}: {
  type?: "all" | "major" | "field";
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("type", type);
  params.set("limit", String(clampLimit(limit, 200, 1, 200)));
  if (cursor) params.set("cursor", cursor);
  return authFetch<CursorEnvelope<unknown>>(`/v1/me/joined/specializations?${params.toString()}`);
}

export async function uploadProfilePhoto(file: File): Promise<string | number> {
  const presign = await presignMediaUpload({
    contentType: file.type,
    sizeBytes: file.size,
  });

  const key = presign.key ?? presign.fields?.key;
  if (!key) {
    throw new Error("Upload failed. Missing media key.");
  }

  await uploadFileWithPresign(presign, file);

  const dimensions = await getImageDimensions(file);
  const mediaAssetId = await completeMediaUpload({
    key,
    mimeType: file.type,
    width: dimensions.width,
    height: dimensions.height,
    durationSeconds: null,
    callbackSignature: presign.callbackSignature ?? presign.callback_signature,
  });

  return mediaAssetId;
}

export function isUsernameAvailable(response: UsernameAvailabilityResponse): boolean {
  const available = getBoolean(response.available);
  if (available === true) return true;
  return getBoolean(response.ownedByMe ?? response.owned_by_me) === true;
}
