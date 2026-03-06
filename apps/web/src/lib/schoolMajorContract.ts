export const COMMUNITY_SEARCH_KINDS = ["company", "specialization", "field", "unknown"] as const;
export type CommunitySearchKind = (typeof COMMUNITY_SEARCH_KINDS)[number];
export type DeprecatedCommunitySearchKind = "school" | "major";
export type CommunitySearchKindParam = CommunitySearchKind | DeprecatedCommunitySearchKind;

export const COMMUNITY_REQUEST_KINDS = ["company", "field", "workplace"] as const;
export type CommunityRequestKind = (typeof COMMUNITY_REQUEST_KINDS)[number] | "school" | "major";

export type CommunityContractOption = {
  id: string;
  kind: string;
  name: string;
  shortName?: string;
  memberCount?: number;
  membersLabel?: string;
  imageUrl?: string;
};

export type ContractSpecializationOption = {
  id: string;
  name: string;
  type: "major" | "field" | "unknown";
  memberCount?: number;
};

const DEPRECATED_COMMUNITY_SEARCH_KINDS: DeprecatedCommunitySearchKind[] = ["school", "major"];

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

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeSpecializationOption(
  payload: unknown,
  fallbackType: ContractSpecializationOption["type"]
): ContractSpecializationOption | null {
  if (!isRecord(payload)) return null;
  const id = getString(payload.id ?? payload.specialization_id ?? payload.specializationId);
  const name = getString(payload.name ?? payload.short_name ?? payload.shortName);
  if (!id || !name) return null;

  const typeValue = getString(payload.type ?? payload.specialization_type ?? payload.specializationType);
  const normalizedType =
    typeValue === "major" || typeValue === "field"
      ? typeValue
      : fallbackType;
  const memberCount = getNumber(payload.member_count ?? payload.memberCount);

  return {
    id,
    name,
    type: normalizedType,
    memberCount,
  };
}

function dedupeAndSortSpecializations(items: ContractSpecializationOption[]): ContractSpecializationOption[] {
  const byId = new Map<string, ContractSpecializationOption>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    const existingCount = existing.memberCount ?? -1;
    const nextCount = item.memberCount ?? -1;
    if (nextCount > existingCount) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    const memberDelta = (right.memberCount ?? 0) - (left.memberCount ?? 0);
    if (memberDelta !== 0) return memberDelta;
    const nameDelta = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameDelta !== 0) return nameDelta;
    return left.id.localeCompare(right.id);
  });
}

export function normalizeCommunitySearchKindParam(value: unknown): CommunitySearchKindParam | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if ((COMMUNITY_SEARCH_KINDS as readonly string[]).includes(normalized)) {
    return normalized as CommunitySearchKind;
  }
  if ((DEPRECATED_COMMUNITY_SEARCH_KINDS as readonly string[]).includes(normalized)) {
    return normalized as DeprecatedCommunitySearchKind;
  }
  return undefined;
}

export function normalizeCommunityRequestType(type: CommunityRequestKind): Exclude<CommunityRequestKind, "workplace"> {
  return type === "workplace" ? "company" : type;
}

export function extractCompanyCommunityItems(payload: unknown): CommunityContractOption[] {
  if (!isRecord(payload)) return [];
  const items = Array.isArray(payload.items) ? payload.items : [];

  const normalized: CommunityContractOption[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const id = getString(item.id ?? item.community_id ?? item.communityId);
    const kind = (getString(item.kind ?? item.community_kind ?? item.communityKind) ?? "unknown").toLowerCase();
    const name = getString(item.name);
    if (!id || !name || kind !== "company") continue;

    const shortName = getString(item.short_name ?? item.shortName);
    const memberCount = getNumber(item.member_count ?? item.memberCount);
    normalized.push({
      id,
      kind,
      name,
      shortName,
      memberCount,
      membersLabel: memberCount !== undefined ? `${memberCount.toLocaleString()} members` : undefined,
      imageUrl: getString(item.image_url ?? item.imageUrl ?? item.profile_image_url ?? item.profileImageUrl),
    });
  }
  return normalized;
}

export function normalizeRecommendedOnboardingSpecializationsPayload(
  data: unknown,
  type: "all" | "major" | "field"
): ContractSpecializationOption[] {
  const payload = isRecord(data) ? data : {};
  const merged: ContractSpecializationOption[] = [];

  if (Array.isArray(payload.items)) {
    merged.push(
      ...payload.items
        .map((entry) => normalizeSpecializationOption(entry, type === "all" ? "unknown" : type))
        .filter((entry): entry is ContractSpecializationOption => Boolean(entry))
    );
  }
  if (Array.isArray(payload.fields)) {
    merged.push(
      ...payload.fields
        .map((entry) => normalizeSpecializationOption(entry, "field"))
        .filter((entry): entry is ContractSpecializationOption => Boolean(entry))
    );
  }

  const dedupedFields = dedupeAndSortSpecializations(merged).filter((entry) => entry.type === "field");
  if (type === "major") return [];
  return dedupedFields;
}
