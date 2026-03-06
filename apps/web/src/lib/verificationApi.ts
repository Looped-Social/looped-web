import { buildCursorParams, extractItemsArray, extractNextCursor, getBoolean, isRecord, normalizeOptional } from "./settingsAdapters";
import { settingsAuthFetch } from "./settingsHttp";

export type CommunityVerificationItem = {
  communityId: string;
  communityName: string;
  communityKind?: string;
  method?: string;
  verified: boolean;
  verifiedAt?: string;
  expiresAt?: string;
  active?: boolean;
  status?: string;
  rejectReason?: string;
  email?: string;
  verifiedEmail?: string;
};

export type JoinedSpecializationItem = {
  id: string;
  name: string;
  kind: "major" | "field" | "unknown";
};

function normalizeCommunityVerificationItem(item: unknown): CommunityVerificationItem | null {
  if (!isRecord(item)) return null;
  const communityId = normalizeOptional(item.communityId ?? item.community_id);
  const communityName = normalizeOptional(item.communityName ?? item.community_name ?? item.name);
  if (!communityId || !communityName) return null;

  return {
    communityId,
    communityName,
    communityKind: normalizeOptional(item.communityKind ?? item.community_kind) ?? undefined,
    method: normalizeOptional(item.method) ?? undefined,
    verified: getBoolean(item.verified) ?? false,
    verifiedAt: normalizeOptional(item.verifiedAt ?? item.verified_at) ?? undefined,
    expiresAt: normalizeOptional(item.expiresAt ?? item.expires_at) ?? undefined,
    active: getBoolean(item.active),
    status: normalizeOptional(item.status) ?? undefined,
    rejectReason: normalizeOptional(item.rejectReason ?? item.reject_reason) ?? undefined,
    email: normalizeOptional(item.email) ?? undefined,
    verifiedEmail: normalizeOptional(item.verifiedEmail ?? item.verified_email) ?? undefined,
  };
}

export async function fetchCommunityVerifications(): Promise<CommunityVerificationItem[]> {
  const response = await settingsAuthFetch<unknown>("/v1/communities/verifications");
  return extractItemsArray(response)
    .map(normalizeCommunityVerificationItem)
    .filter((item): item is CommunityVerificationItem => Boolean(item));
}

function normalizeSpecializationKind(value: unknown): "major" | "field" | "unknown" {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (normalized === "major") return "major";
  if (normalized === "field") return "field";
  return "unknown";
}

function normalizeJoinedSpecializationItem(item: unknown): JoinedSpecializationItem | null {
  if (!isRecord(item)) return null;
  const source =
    (isRecord(item.specialization) ? item.specialization : null) ??
    (isRecord(item.community) ? item.community : null) ??
    item;

  const id = normalizeOptional(source.id ?? source.specialization_id ?? source.specializationId);
  if (!id) return null;

  const name =
    normalizeOptional(source.short_name ?? source.shortName) ??
    normalizeOptional(source.name ?? source.specialization_name ?? source.specializationName);
  if (!name) return null;

  const kind = normalizeSpecializationKind(
    source.specializationType ??
      source.specialization_type ??
      source.type ??
      source.kind ??
      source.communityKind ??
      source.community_kind
  );

  return {
    id,
    name,
    kind,
  };
}

export async function fetchJoinedSpecializations(): Promise<JoinedSpecializationItem[]> {
  const joined: JoinedSpecializationItem[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  do {
    const params = buildCursorParams({
      limit: 200,
      cursor,
      fallbackLimit: 200,
      max: 200,
    });
    params.set("type", "field");
    const response = await settingsAuthFetch<unknown>(`/v1/me/joined/specializations?${params.toString()}`);

    for (const item of extractItemsArray(response)) {
      const normalized = normalizeJoinedSpecializationItem(item);
      if (!normalized || seen.has(normalized.id)) continue;
      if (normalized.kind === "major") continue;
      seen.add(normalized.id);
      joined.push(normalized);
    }

    cursor = extractNextCursor(response) ?? undefined;
  } while (cursor);

  return joined;
}

export async function startCommunityVerification({
  communityId,
  method,
  email,
}: {
  communityId: string | number;
  method: "email";
  email: string;
}): Promise<void> {
  await settingsAuthFetch(`/v1/communities/${communityId}/verification/start`, {
    method: "POST",
    body: JSON.stringify({ method, email }),
  });
}

export async function fetchCommunityVerificationDomains(
  communityId: string | number,
  options?: { signal?: AbortSignal }
): Promise<string[]> {
  const response = await settingsAuthFetch<unknown>(`/v1/communities/${communityId}/domains`, {
    signal: options?.signal,
  });
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of extractItemsArray(response)) {
    const next = normalizeOptional(entry)?.trim().toLowerCase();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}

export async function finishCommunityVerification({
  communityId,
  method,
  code,
  email,
}: {
  communityId: string | number;
  method: "email";
  code: string;
  email: string;
}): Promise<void> {
  await settingsAuthFetch(`/v1/communities/${communityId}/verification/finish`, {
    method: "POST",
    body: JSON.stringify({
      method,
      code,
      email,
    }),
  });
}

export async function unverifyCommunity(communityId: string | number): Promise<void> {
  await settingsAuthFetch(`/v1/communities/${communityId}/verification`, {
    method: "DELETE",
  });
}
