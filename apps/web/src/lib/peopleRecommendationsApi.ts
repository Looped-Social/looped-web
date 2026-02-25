import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class PeopleRecommendationApiError extends ApiError {}

export type PeopleRecommendationSurface = "search" | "onboarding" | "feed_card" | "profile_similar" | "inbox_empty";
export type PeopleRecommendationRailKind = "pymk" | "community" | "active_community";

export type PeopleRecommendationCommunity = {
  id: string;
  name: string;
};

export type PeopleRecommendationExperiment = {
  key: string;
  bucket: string;
};

export type PeopleRecommendationReason = {
  code: string;
  text: string;
};

export type PeopleRecommendationActions = {
  canConnect: boolean;
  canHide: boolean;
  canLessLikeThis: boolean;
};

export type PeopleRecommendationTracking = {
  token: string;
  position: number;
};

export type PeopleRecommendationUser = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  headline?: string;
  community?: PeopleRecommendationCommunity;
};

export type PeopleRecommendationItem = {
  recommendationId: string;
  user: PeopleRecommendationUser;
  reasons: PeopleRecommendationReason[];
  actions: PeopleRecommendationActions;
  tracking: PeopleRecommendationTracking;
};

export type PeopleRecommendationRailPage = {
  requestId: string;
  rail: PeopleRecommendationRailKind;
  title: string;
  items: PeopleRecommendationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  degraded: boolean;
  community?: PeopleRecommendationCommunity;
  experiment?: PeopleRecommendationExperiment;
};

export type PeopleRecommendationRailsBundle = {
  requestId: string;
  surface: PeopleRecommendationSurface;
  community?: PeopleRecommendationCommunity;
  rails: PeopleRecommendationRailPage[];
  experiment?: PeopleRecommendationExperiment;
  degraded: boolean;
  generatedAt?: string;
};

export type PeopleRecommendationFeedbackType =
  | "impression"
  | "profile_open"
  | "connect_request_sent"
  | "hide"
  | "less_like_this";

export type PeopleRecommendationFeedbackEventInput = {
  eventId: string;
  type: PeopleRecommendationFeedbackType;
  recommendationId: string;
  trackingToken: string;
  position: number;
  clientTs: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PeopleRecommendationFeedbackResponse = {
  requestId: string;
  accepted: number;
  deduped: number;
  dropped: number;
  suppressedCandidateIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
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

function normalizeRailKind(value: unknown): PeopleRecommendationRailKind | null {
  const normalized = getString(value)?.toLowerCase();
  if (normalized === "pymk" || normalized === "community" || normalized === "active_community") {
    return normalized;
  }
  return null;
}

function normalizeSurface(value: unknown): PeopleRecommendationSurface {
  const normalized = getString(value)?.toLowerCase();
  if (
    normalized === "search" ||
    normalized === "onboarding" ||
    normalized === "feed_card" ||
    normalized === "profile_similar" ||
    normalized === "inbox_empty"
  ) {
    return normalized;
  }
  return "search";
}

function normalizeCommunity(value: unknown): PeopleRecommendationCommunity | undefined {
  if (!isRecord(value)) return undefined;
  const id = getString(value.id);
  const name = getString(value.name);
  if (!id || !name) return undefined;
  return { id, name };
}

function normalizeExperiment(value: unknown): PeopleRecommendationExperiment | undefined {
  if (!isRecord(value)) return undefined;
  const key = getString(value.key);
  const bucket = getString(value.bucket);
  if (!key || !bucket) return undefined;
  return { key, bucket };
}

function normalizeReason(value: unknown): PeopleRecommendationReason | null {
  if (!isRecord(value)) return null;
  const code = getString(value.code);
  const text = getString(value.text);
  if (!code || !text) return null;
  return { code, text };
}

function normalizeItem(value: unknown, fallbackPosition: number): PeopleRecommendationItem | null {
  if (!isRecord(value)) return null;

  const userPayload = isRecord(value.user) ? value.user : null;
  if (!userPayload) return null;

  const userId = getString(userPayload.id);
  if (!userId) return null;

  const handle = getString(userPayload.handle) ?? `user-${userId}`;
  const displayName = getString(userPayload.display_name ?? userPayload.displayName) ?? handle;

  const reasons = Array.isArray(value.reasons)
    ? value.reasons.map(normalizeReason).filter((reason): reason is PeopleRecommendationReason => Boolean(reason))
    : [];

  const actionsPayload = isRecord(value.actions) ? value.actions : {};
  const trackingPayload = isRecord(value.tracking) ? value.tracking : {};

  const recommendationId =
    getString(value.recommendation_id ?? value.recommendationId) ?? `${userId}:${getNumber(trackingPayload.position) ?? fallbackPosition}`;
  const trackingToken = getString(trackingPayload.token) ?? recommendationId;
  const position = getNumber(trackingPayload.position) ?? fallbackPosition;

  return {
    recommendationId,
    user: {
      id: userId,
      handle,
      displayName,
      avatarUrl: getString(userPayload.avatar_url ?? userPayload.avatarUrl),
      headline: getString(userPayload.headline),
      community: normalizeCommunity(userPayload.community),
    },
    reasons,
    actions: {
      canConnect: getBoolean(actionsPayload.can_connect ?? actionsPayload.canConnect) ?? true,
      canHide: getBoolean(actionsPayload.can_hide ?? actionsPayload.canHide) ?? true,
      canLessLikeThis: getBoolean(actionsPayload.can_less_like_this ?? actionsPayload.canLessLikeThis) ?? true,
    },
    tracking: {
      token: trackingToken,
      position,
    },
  };
}

function normalizeRailPage(value: unknown, requestIdOverride?: string): PeopleRecommendationRailPage | null {
  if (!isRecord(value)) return null;

  const rail = normalizeRailKind(value.rail);
  if (!rail) return null;

  const items = Array.isArray(value.items)
    ? value.items.map((item, index) => normalizeItem(item, index)).filter((item): item is PeopleRecommendationItem => Boolean(item))
    : [];

  const nextCursor = getString(value.next_cursor ?? value.nextCursor) ?? null;
  const hasMore = getBoolean(value.has_more ?? value.hasMore) ?? Boolean(nextCursor);

  return {
    requestId: requestIdOverride ?? getString(value.request_id ?? value.requestId) ?? "",
    rail,
    title: getString(value.title) ?? "Recommended for you",
    items,
    nextCursor,
    hasMore,
    degraded: getBoolean(value.degraded) ?? false,
    community: normalizeCommunity(value.community),
    experiment: normalizeExperiment(value.experiment),
  };
}

function normalizeRailsBundle(payload: unknown): PeopleRecommendationRailsBundle {
  if (!isRecord(payload)) {
    return {
      requestId: "",
      surface: "search",
      rails: [],
      degraded: false,
    };
  }

  const requestId = getString(payload.request_id ?? payload.requestId) ?? "";
  const rails = Array.isArray(payload.rails)
    ? payload.rails
        .map((entry) => normalizeRailPage(entry, requestId))
        .filter((entry): entry is PeopleRecommendationRailPage => Boolean(entry))
    : [];

  return {
    requestId,
    surface: normalizeSurface(payload.surface),
    community: normalizeCommunity(payload.community),
    rails,
    experiment: normalizeExperiment(payload.experiment),
    degraded: getBoolean(payload.degraded) ?? false,
    generatedAt: getString(payload.generated_at ?? payload.generatedAt),
  };
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function randomRequestId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

async function authFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new PeopleRecommendationApiError(0, message, message);
  }

  if (!response.ok) {
    const details = (await response.text()).trim();
    notifyAuthGateFromHttpError({ status: response.status, details, source: "peopleRecommendationsApi" });
    throw new PeopleRecommendationApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = (await response.text()).trim();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PeopleRecommendationApiError(response.status, "Unexpected server response.", text);
  }
}

export async function fetchPeopleRecommendationRails({
  surface = "search",
  communityId,
  rails,
  limitPerRail = 10,
}: {
  surface?: PeopleRecommendationSurface;
  communityId?: string | number;
  rails?: PeopleRecommendationRailKind[];
  limitPerRail?: number;
} = {}): Promise<PeopleRecommendationRailsBundle> {
  const params = new URLSearchParams();
  params.set("surface", surface);
  if (communityId !== undefined && communityId !== null && String(communityId).trim().length > 0) {
    params.set("community_id", String(communityId));
  }
  if (rails && rails.length > 0) {
    params.set("rails", rails.join(","));
  }
  params.set("limit_per_rail", String(clamp(limitPerRail, 10, 1, 25)));

  const payload = await authFetchJson<unknown>(`/v1/recommendations/people/rails?${params.toString()}`);
  return normalizeRailsBundle(payload);
}

export async function fetchPeopleRecommendationRailPage({
  rail,
  surface = "search",
  communityId,
  limit = 20,
  cursor,
}: {
  rail: PeopleRecommendationRailKind;
  surface?: PeopleRecommendationSurface;
  communityId?: string | number;
  limit?: number;
  cursor?: string;
}): Promise<PeopleRecommendationRailPage> {
  const params = new URLSearchParams();
  params.set("surface", surface);
  params.set("limit", String(clamp(limit, 20, 1, 50)));
  if (communityId !== undefined && communityId !== null && String(communityId).trim().length > 0) {
    params.set("community_id", String(communityId));
  }
  if (cursor && cursor.trim().length > 0) {
    params.set("cursor", cursor.trim());
  }

  const payload = await authFetchJson<unknown>(`/v1/recommendations/people/${rail}?${params.toString()}`);
  const normalized = normalizeRailPage(payload);
  if (!normalized) {
    throw new PeopleRecommendationApiError(500, "Unexpected recommendation payload.");
  }
  return normalized;
}

function normalizeFeedbackResponse(payload: unknown): PeopleRecommendationFeedbackResponse {
  if (!isRecord(payload)) {
    return {
      requestId: randomRequestId(),
      accepted: 0,
      deduped: 0,
      dropped: 0,
      suppressedCandidateIds: [],
    };
  }

  const suppressedRaw = payload.suppressed_candidate_ids ?? payload.suppressedCandidateIds;
  const suppressedCandidateIds = Array.isArray(suppressedRaw)
    ? suppressedRaw.map((value) => getString(value)).filter((value): value is string => Boolean(value))
    : [];

  return {
    requestId: getString(payload.request_id ?? payload.requestId) ?? randomRequestId(),
    accepted: getNumber(payload.accepted) ?? 0,
    deduped: getNumber(payload.deduped) ?? 0,
    dropped: getNumber(payload.dropped) ?? 0,
    suppressedCandidateIds,
  };
}

export async function sendPeopleRecommendationFeedback(
  events: PeopleRecommendationFeedbackEventInput[]
): Promise<PeopleRecommendationFeedbackResponse> {
  if (events.length === 0) {
    return {
      requestId: randomRequestId(),
      accepted: 0,
      deduped: 0,
      dropped: 0,
      suppressedCandidateIds: [],
    };
  }

  const payload = await authFetchJson<unknown>("/v1/recommendations/people/feedback", {
    method: "POST",
    body: JSON.stringify({
      events: events.slice(0, 200).map((event) => ({
        event_id: event.eventId,
        type: event.type,
        recommendation_id: event.recommendationId,
        tracking_token: event.trackingToken,
        position: event.position,
        client_ts: event.clientTs,
        metadata: event.metadata,
      })),
    }),
  });

  return normalizeFeedbackResponse(payload);
}
