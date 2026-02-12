import { settingsAuthFetch } from "./settingsHttp";

export type ContentPreferencesResponse = {
  content: {
    hideAnonymousPosts: boolean;
  };
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

function normalizeContentPreferences(payload: unknown): ContentPreferencesResponse {
  const content =
    isRecord(payload) && isRecord(payload.content)
      ? payload.content
      : isRecord(payload)
        ? payload
        : {};

  return {
    content: {
      hideAnonymousPosts: getBoolean(content.hideAnonymousPosts ?? content.hide_anonymous_posts) ?? false,
    },
  };
}

export async function fetchContentPreferences(): Promise<ContentPreferencesResponse> {
  const response = await settingsAuthFetch<unknown>("/v1/content/preferences");
  return normalizeContentPreferences(response);
}

export async function updateContentPreferences(payload: {
  hideAnonymousPosts: boolean;
}): Promise<ContentPreferencesResponse> {
  const response = await settingsAuthFetch<unknown>("/v1/content/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeContentPreferences(response);
}
