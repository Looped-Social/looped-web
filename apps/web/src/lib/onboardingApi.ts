import { getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";
import { presignMediaUpload, uploadFileWithPresign, completeMediaUpload } from "./mediaApi";

export class OnboardingApiError extends Error {
  status: number;
  code: string;
  details?: string;
  retryAfterSeconds?: number;
  requestId?: string | null;

  constructor({
    status,
    code,
    message,
    details,
    retryAfterSeconds,
    requestId,
  }: {
    status: number;
    code: string;
    message: string;
    details?: string;
    retryAfterSeconds?: number;
    requestId?: string | null;
  }) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    this.requestId = requestId;
  }
}

export type OnboardingSnapshot = {
  onboarding_complete?: boolean;
  onboarding_step?: string;
  onboarding_stage_v2?: string;
  onboarding_context?: Record<string, unknown>;
};

export type CommunityKind = "company" | "school";

export type CommunityOption = {
  id: string;
  kind: string;
  name: string;
  shortName?: string;
  memberCount?: number;
  membersLabel?: string;
  imageUrl?: string;
};

export type SpecializationOption = {
  id: string;
  name: string;
  type: "major" | "field" | "unknown";
};

export type ProfileCompletionInput = {
  bio?: string;
  displayName?: string;
  profilePhotoFile?: File | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
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

function parseErrorPayload(raw: string): { code: string; message: string; retryAfterSeconds?: number } {
  const text = raw.trim();
  if (!text) {
    return { code: "request_failed", message: "Request failed." };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return { code: "request_failed", message: text };
    }
    const code = getString(parsed.error ?? parsed.code)?.toLowerCase() ?? "request_failed";
    const message = getString(parsed.message) ?? code;
    const retryAfterSeconds = getNumber(parsed.retry_after_seconds ?? parsed.retryAfterSeconds);
    return { code, message, retryAfterSeconds };
  } catch {
    return { code: "request_failed", message: text };
  }
}

async function onboardingAuthFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; requestId: string | null }> {
  const token = await getFirebaseIdToken();
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new OnboardingApiError({
      status: 0,
      code: "network_error",
      message,
      details: message,
    });
  }

  const requestId = response.headers.get("X-Request-Id");

  if (!response.ok) {
    const raw = await response.text();
    const parsed = parseErrorPayload(raw);
    const retryAfterHeader = getNumber(response.headers.get("Retry-After"));
    throw new OnboardingApiError({
      status: response.status,
      code: parsed.code,
      message: parsed.message,
      details: raw,
      retryAfterSeconds: parsed.retryAfterSeconds ?? retryAfterHeader,
      requestId,
    });
  }

  if (response.status === 204) {
    return { data: {} as T, requestId };
  }

  const raw = await response.text();
  if (!raw.trim()) {
    return { data: {} as T, requestId };
  }

  try {
    return { data: JSON.parse(raw) as T, requestId };
  } catch {
    throw new OnboardingApiError({
      status: response.status,
      code: "invalid_response",
      message: "Unexpected server response.",
      details: raw,
      requestId,
    });
  }
}

function normalizeOnboardingSnapshot(payload: unknown): OnboardingSnapshot {
  if (!isRecord(payload)) return {};
  return {
    onboarding_complete: getBoolean(payload.onboarding_complete ?? payload.onboardingComplete),
    onboarding_step: getString(payload.onboarding_step ?? payload.onboardingStep),
    onboarding_stage_v2: getString(payload.onboarding_stage_v2 ?? payload.onboardingStageV2),
    onboarding_context: isRecord(payload.onboarding_context ?? payload.onboardingContext)
      ? ((payload.onboarding_context ?? payload.onboardingContext) as Record<string, unknown>)
      : undefined,
  };
}

function normalizeCommunityOption(payload: unknown): CommunityOption | null {
  if (!isRecord(payload)) return null;
  const id = getString(payload.id ?? payload.community_id ?? payload.communityId);
  const kind = getString(payload.kind ?? payload.community_kind ?? payload.communityKind) ?? "unknown";
  const name = getString(payload.name);
  if (!id || !name) return null;

  const shortName = getString(payload.short_name ?? payload.shortName) ?? undefined;
  const memberCount = getNumber(payload.member_count ?? payload.memberCount);
  return {
    id,
    kind,
    name,
    shortName,
    memberCount,
    membersLabel: memberCount !== undefined ? `${memberCount.toLocaleString()} members` : undefined,
    imageUrl:
      getString(payload.image_url ?? payload.imageUrl ?? payload.profile_image_url ?? payload.profileImageUrl) ??
      undefined,
  };
}

function extractCommunityItems(payload: unknown): CommunityOption[] {
  if (!isRecord(payload)) return [];
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map(normalizeCommunityOption).filter((item): item is CommunityOption => Boolean(item));
}

function normalizeSpecializationOption(payload: unknown, fallbackType: "major" | "field"): SpecializationOption | null {
  if (!isRecord(payload)) return null;
  const id = getString(payload.id ?? payload.specialization_id ?? payload.specializationId);
  const name = getString(payload.name ?? payload.short_name ?? payload.shortName);
  if (!id || !name) return null;

  const typeValue = getString(payload.type ?? payload.specialization_type ?? payload.specializationType);
  const normalizedType =
    typeValue === "major" || typeValue === "field"
      ? typeValue
      : fallbackType;

  return {
    id,
    name,
    type: normalizedType,
  };
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("Unable to inspect image dimensions."));
      next.src = objectUrl;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadProfilePhoto(file: File): Promise<string | number> {
  const presign = await presignMediaUpload({
    contentType: file.type,
    sizeBytes: file.size,
  });

  const key = presign.key ?? presign.fields?.key;
  if (!key) {
    throw new OnboardingApiError({
      status: 0,
      code: "missing_media_key",
      message: "Upload failed. Missing media key.",
    });
  }

  await uploadFileWithPresign(presign, file);
  const dimensions = await getImageDimensions(file);
  return completeMediaUpload({
    key,
    mimeType: file.type,
    width: dimensions.width,
    height: dimensions.height,
    durationSeconds: null,
    callbackSignature: presign.callbackSignature ?? presign.callback_signature,
  });
}

export async function checkUsernameAvailability(username: string): Promise<{
  username: string;
  available: boolean;
  ownedByMe: boolean;
}> {
  const normalized = username.trim().toLowerCase();
  const params = new URLSearchParams();
  params.set("username", normalized);
  const { data } = await onboardingAuthFetch<unknown>(`/v1/users/username/availability?${params.toString()}`);
  const payload = isRecord(data) ? data : {};
  return {
    username: getString(payload.username) ?? normalized,
    available: getBoolean(payload.available) ?? false,
    ownedByMe: getBoolean(payload.owned_by_me ?? payload.ownedByMe) ?? false,
  };
}

export async function submitOnboardingProfile(payload: {
  username: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/onboard", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeOnboardingSnapshot(data);
}

export async function markOnboardingInfoScreenViewed(): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/info-screen/viewed", {
    method: "POST",
  });
  return normalizeOnboardingSnapshot(data);
}

export async function setOnboardingOrg(orgId: string | number): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/org", {
    method: "PUT",
    body: JSON.stringify({ org_id: Number(orgId) || orgId }),
  });
  return normalizeOnboardingSnapshot(data);
}

export async function setOnboardingVerificationChoice(
  verificationPath: "email" | "skip"
): Promise<OnboardingSnapshot> {
  try {
    const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/verification-choice", {
      method: "PUT",
      body: JSON.stringify({ verification_path: verificationPath }),
    });
    return normalizeOnboardingSnapshot(data);
  } catch (error) {
    if (
      !(error instanceof OnboardingApiError) ||
      error.status < 400 ||
      error.status >= 500 ||
      error.code === "invalid_verification_path" ||
      error.code === "invalid_stage" ||
      error.code === "invalid_onboarding_stage" ||
      error.code === "invalid_onboarding_step" ||
      error.code === "org_not_selected" ||
      error.code === "onboarding_incomplete" ||
      error.code === "user_not_provisioned"
    ) {
      throw error;
    }

    const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/verification-choice", {
      method: "PUT",
      body: JSON.stringify({ verificationPath: verificationPath }),
    });
    return normalizeOnboardingSnapshot(data);
  }
}

export async function markOnboardingEmailVerificationSuccess(): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/email-verification/success", {
    method: "POST",
  });
  return normalizeOnboardingSnapshot(data);
}

export async function submitOnboardingSpecialization(specializationId: string | number): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/specialization", {
    method: "POST",
    body: JSON.stringify({ specialization_id: Number(specializationId) || specializationId }),
  });
  return normalizeOnboardingSnapshot(data);
}

export async function acknowledgeSkipExplainer(): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/skip-explainer/ack", {
    method: "POST",
  });
  return normalizeOnboardingSnapshot(data);
}

export async function finalizeOnboarding(): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/finalize", {
    method: "POST",
  });
  return normalizeOnboardingSnapshot(data);
}

export async function completeAfterCommunityRequest(): Promise<OnboardingSnapshot> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/users/me/onboarding-v2/complete-after-community-request", {
    method: "POST",
  });
  return normalizeOnboardingSnapshot(data);
}

export async function searchOnboardingCommunities({
  query,
  kind,
  limit = 25,
  signal,
}: {
  query: string;
  kind?: CommunityKind;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CommunityOption[]> {
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("limit", String(limit));
  if (kind) params.set("kind", kind);

  const { data } = await onboardingAuthFetch<unknown>(`/v1/communities/search?${params.toString()}`, { signal });
  return extractCommunityItems(data);
}

export async function fetchRecommendedOnboardingCommunities({
  kind,
  limit = 40,
  signal,
}: {
  kind: CommunityKind;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CommunityOption[]> {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("limit", String(limit));
  const { data } = await onboardingAuthFetch<unknown>(`/v1/communities/recommended?${params.toString()}`, { signal });
  return extractCommunityItems(data);
}

export async function fetchCommunityVerificationDomains(
  communityId: string | number,
  options?: { signal?: AbortSignal }
): Promise<string[]> {
  const { data } = await onboardingAuthFetch<unknown>(`/v1/communities/${communityId}/domains`, {
    signal: options?.signal,
  });
  if (!isRecord(data)) return [];
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .map((entry) => getString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

export async function startCommunityEmailVerification({
  communityId,
  email,
}: {
  communityId: string | number;
  email: string;
}): Promise<void> {
  await onboardingAuthFetch(`/v1/communities/${communityId}/verification/start`, {
    method: "POST",
    body: JSON.stringify({ method: "email", email }),
  });
}

export async function finishCommunityEmailVerification({
  communityId,
  email,
  code,
}: {
  communityId: string | number;
  email: string;
  code: string;
}): Promise<void> {
  await onboardingAuthFetch(`/v1/communities/${communityId}/verification/finish`, {
    method: "POST",
    body: JSON.stringify({ method: "email", code, email }),
  });
}

export async function followOnboardingCommunity(communityId: string | number): Promise<void> {
  await onboardingAuthFetch(`/v1/communities/${communityId}/follow`, {
    method: "POST",
  });
}

export async function joinSpecialization(communityOrSpecializationId: string | number): Promise<void> {
  try {
    await onboardingAuthFetch(`/v1/communities/${communityOrSpecializationId}/join`, {
      method: "POST",
    });
  } catch (error) {
    if (error instanceof OnboardingApiError && error.status === 404) {
      await onboardingAuthFetch(`/v1/specializations/${communityOrSpecializationId}/join`, {
        method: "POST",
      });
      return;
    }
    throw error;
  }
}

export async function fetchMajorsForOnboarding(): Promise<SpecializationOption[]> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/majors");
  const payload = isRecord(data) ? data : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .map((item) => normalizeSpecializationOption(item, "major"))
    .filter((item): item is SpecializationOption => Boolean(item));
}

export async function fetchFieldsForOnboarding(): Promise<SpecializationOption[]> {
  const { data } = await onboardingAuthFetch<unknown>("/v1/fields");
  const payload = isRecord(data) ? data : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .map((item) => normalizeSpecializationOption(item, "field"))
    .filter((item): item is SpecializationOption => Boolean(item));
}

export async function dismissProfileCompletionPrompt(): Promise<void> {
  await onboardingAuthFetch("/v1/me/profile-completion/dismiss", {
    method: "POST",
  });
}

export async function saveProfileCompletionDraft({
  bio,
  displayName,
  profilePhotoFile,
}: ProfileCompletionInput): Promise<void> {
  let profileMediaAssetId: string | number | undefined;
  if (profilePhotoFile) {
    profileMediaAssetId = await uploadProfilePhoto(profilePhotoFile);
  }

  const body: Record<string, unknown> = {};
  if (typeof bio === "string") body.bio = bio;
  if (typeof displayName === "string") body.displayName = displayName;
  if (profileMediaAssetId !== undefined) body.profileMediaAssetId = profileMediaAssetId;

  await onboardingAuthFetch("/v1/users/me", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
