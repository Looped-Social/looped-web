import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class NotificationsApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

export type NotificationChannelKey = "in_app" | "push" | "email";

export type NotificationChannelPreferences = {
  enabled: boolean;
  types: Record<string, boolean>;
};

export type NotificationPreferences = {
  channels: Record<NotificationChannelKey, NotificationChannelPreferences>;
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

function toChannelPreferences(value: unknown): NotificationChannelPreferences {
  const fallback: NotificationChannelPreferences = {
    enabled: false,
    types: {},
  };
  if (!isRecord(value)) return fallback;

  const enabled = getBoolean(value.enabled) ?? false;
  const rawTypes = isRecord(value.types) ? value.types : {};
  const types = Object.entries(rawTypes).reduce<Record<string, boolean>>((accumulator, [key, typeValue]) => {
    const normalized = getBoolean(typeValue);
    if (normalized !== undefined) {
      accumulator[key] = normalized;
    }
    return accumulator;
  }, {});

  return { enabled, types };
}

function normalizePreferencesResponse(payload: unknown): NotificationPreferences {
  const source =
    isRecord(payload) && isRecord(payload.notifications) ? payload.notifications : payload;
  const channels = isRecord(source) && isRecord(source.channels) ? source.channels : {};

  return {
    channels: {
      in_app: toChannelPreferences(channels.in_app),
      push: toChannelPreferences(channels.push),
      email: toChannelPreferences(channels.email),
    },
  };
}

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
    notifyAuthGateFromHttpError({ status: response.status, details, source: "notificationsApi" });
    throw new NotificationsApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchNotifications({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  return authFetch<CursorEnvelope<unknown>>(`/v1/notifications?${params.toString()}`);
}

export async function markNotificationRead(notificationId: string | number): Promise<{ read: boolean }> {
  const response = await authFetch<unknown>(`/v1/notifications/${notificationId}/read`, {
    method: "POST",
  });

  if (isRecord(response)) {
    const read = getBoolean(response.read);
    if (read !== undefined) return { read };
  }
  return { read: true };
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await authFetch<unknown>("/v1/notifications/preferences");
  return normalizePreferencesResponse(response);
}

export async function updateNotificationPreferences({
  channels,
}: {
  channels: Partial<Record<NotificationChannelKey, { enabled?: boolean; types?: Record<string, boolean> }>>;
}): Promise<NotificationPreferences> {
  const response = await authFetch<unknown>("/v1/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify({ channels }),
  });
  return normalizePreferencesResponse(response);
}
