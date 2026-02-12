export type ViewerCapabilityLockReason =
  | "COMMUNITY_NOT_VERIFIED"
  | "SPECIALIZATION_NOT_JOINED"
  | "VERIFICATION_EXPIRED"
  | "COMMUNITY_BANNED"
  | "UNKNOWN_RESTRICTION"
  | string;

export type ViewerCapabilities = {
  canInteract: boolean;
  canComment: boolean;
  canReply: boolean;
  canLike: boolean;
  canVote: boolean;
  canRepost: boolean;
  canSave: boolean;
  lockReason?: ViewerCapabilityLockReason;
  requiresVerification: boolean;
  requiresJoin: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function hasViewerCapabilityKeys(value: Record<string, unknown>): boolean {
  const keys = [
    "canInteract",
    "can_interact",
    "canComment",
    "can_comment",
    "canReply",
    "can_reply",
    "canLike",
    "can_like",
    "canVote",
    "can_vote",
    "canRepost",
    "can_repost",
    "canSave",
    "can_save",
    "lockReason",
    "lock_reason",
    "requiresVerification",
    "requires_verification",
    "requiresJoin",
    "requires_join",
  ];

  return keys.some((key) => key in value);
}

export function normalizeViewerCapabilities(payload: unknown): ViewerCapabilities | null {
  if (!isRecord(payload)) return null;
  if (!hasViewerCapabilityKeys(payload)) return null;

  const lockReasonRaw = normalizeOptional(payload.lockReason ?? payload.lock_reason);
  const lockReason = lockReasonRaw ? lockReasonRaw.toUpperCase() : undefined;

  return {
    canInteract: getBoolean(payload.canInteract ?? payload.can_interact) ?? false,
    canComment: getBoolean(payload.canComment ?? payload.can_comment) ?? false,
    canReply: getBoolean(payload.canReply ?? payload.can_reply) ?? false,
    canLike: getBoolean(payload.canLike ?? payload.can_like) ?? false,
    canVote: getBoolean(payload.canVote ?? payload.can_vote) ?? false,
    canRepost: getBoolean(payload.canRepost ?? payload.can_repost) ?? false,
    canSave: getBoolean(payload.canSave ?? payload.can_save) ?? true,
    lockReason,
    requiresVerification: getBoolean(payload.requiresVerification ?? payload.requires_verification) ?? false,
    requiresJoin: getBoolean(payload.requiresJoin ?? payload.requires_join) ?? false,
  };
}

export function extractViewerCapabilitiesFromPost(payload: unknown): ViewerCapabilities | null {
  if (!isRecord(payload)) return null;
  const nested = payload.viewerCapabilities ?? payload.viewer_capabilities;
  return normalizeViewerCapabilities(nested);
}

export function mapLockReasonToErrorCode(lockReason?: string): string | undefined {
  const normalized = normalizeOptional(lockReason)?.toUpperCase();
  if (!normalized) return undefined;
  if (normalized === "COMMUNITY_NOT_VERIFIED") return "community_not_verified";
  if (normalized === "SPECIALIZATION_NOT_JOINED") return "specialization_not_joined";
  if (normalized === "VERIFICATION_EXPIRED") return "verification_expired";
  if (normalized === "COMMUNITY_BANNED") return "community_banned";
  if (normalized === "UNKNOWN_RESTRICTION") return "unknown_restriction";
  return normalized.toLowerCase();
}
