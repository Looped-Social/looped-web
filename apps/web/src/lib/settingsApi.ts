import {
  buildCursorParams,
  extractItemsArray,
  extractNextCursor,
  getBoolean,
  isRecord,
  normalizeOptional,
} from "./settingsAdapters";
import { settingsAuthFetch } from "./settingsHttp";

export type MessagePermission = "all" | "company" | "following" | "no_one";

export type CursorEnvelope<T> = {
  items: T[];
  nextCursor: string | null;
};

export type UserSettingsProfile = {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  showFollowerCount: boolean;
  messagePermission: MessagePermission;
};

export type BlockedUserItem = {
  principalId: string;
  id?: string;
  handle?: string;
  displayName: string;
  profileImageUrl?: string;
  kind?: string;
  isAnonymous: boolean;
};

function normalizeMessagePermission(value: unknown): MessagePermission {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (normalized === "all" || normalized === "company" || normalized === "following" || normalized === "no_one") {
    return normalized;
  }
  return "all";
}

export async function fetchMySettingsProfile(): Promise<UserSettingsProfile> {
  let profilePayload: unknown = {};
  let mePayload: unknown = {};
  let profileError: unknown = null;
  let meError: unknown = null;

  try {
    profilePayload = await settingsAuthFetch<unknown>("/v1/users/me");
  } catch (error) {
    profileError = error;
  }

  try {
    mePayload = await settingsAuthFetch<unknown>("/v1/me");
  } catch (error) {
    meError = error;
  }

  if (profileError && meError) throw profileError;

  const rawProfile = isRecord(profilePayload) ? profilePayload : {};
  const rawMe = isRecord(mePayload) ? mePayload : {};
  const profile = isRecord(rawProfile.user) ? rawProfile.user : rawProfile;
  const me = isRecord(rawMe.user) ? rawMe.user : rawMe;

  const id = normalizeOptional(profile.id ?? profile.user_id ?? profile.userId ?? me.id ?? me.user_id ?? me.userId) ?? "me";
  const displayName =
    normalizeOptional(profile.display_name ?? profile.displayName) ??
    normalizeOptional(profile.name) ??
    normalizeOptional(me.display_name ?? me.displayName) ??
    normalizeOptional(me.name);

  const username = normalizeOptional(profile.username ?? me.username)?.replace(/^@/, "").toLowerCase();
  const email = normalizeOptional(profile.email ?? me.email);
  const bio = normalizeOptional(profile.bio ?? me.bio);
  const profileImageUrl =
    normalizeOptional(profile.profile_image_url ?? profile.profileImageUrl ?? profile.avatar_url ?? profile.avatarUrl) ??
    normalizeOptional(me.profile_image_url ?? me.profileImageUrl ?? me.avatar_url ?? me.avatarUrl);

  const showFollowerCount = getBoolean(profile.show_follower_count ?? profile.showFollowerCount) ?? true;
  const messagePermission = normalizeMessagePermission(profile.message_permission ?? profile.messagePermission);

  return {
    id,
    email,
    username,
    displayName,
    bio,
    profileImageUrl,
    showFollowerCount,
    messagePermission,
  };
}

export async function updateMySafetySettings(payload: {
  isAnonymous?: boolean;
  showFollowerCount?: boolean;
  messagePermission?: MessagePermission;
}): Promise<Partial<UserSettingsProfile> | null> {
  const response = await settingsAuthFetch<unknown>("/v1/users/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (!isRecord(response)) return null;

  const patch: Partial<UserSettingsProfile> = {};
  const showFollowerCount = getBoolean(response.show_follower_count ?? response.showFollowerCount);
  if (showFollowerCount !== undefined) patch.showFollowerCount = showFollowerCount;

  const messagePermission = normalizeOptional(response.message_permission ?? response.messagePermission);
  if (messagePermission) patch.messagePermission = normalizeMessagePermission(messagePermission);

  return Object.keys(patch).length > 0 ? patch : null;
}

function normalizeBlockedUserItem(item: unknown): BlockedUserItem | null {
  if (!isRecord(item)) return null;
  const principalId = normalizeOptional(item.principalId ?? item.principal_id);
  if (!principalId) return null;
  const id = normalizeOptional(item.id ?? item.user_id ?? item.userId);
  const handle = normalizeOptional(item.handle ?? item.username);
  const displayName =
    normalizeOptional(item.displayName ?? item.display_name ?? item.name) ??
    (handle ? `@${handle.replace(/^@/, "")}` : "User");

  return {
    principalId,
    id: id ?? undefined,
    handle: handle ?? undefined,
    displayName,
    profileImageUrl: normalizeOptional(item.profileImageUrl ?? item.profile_image_url) ?? undefined,
    kind: normalizeOptional(item.kind) ?? undefined,
    isAnonymous: getBoolean(item.isAnonymous ?? item.is_anonymous) ?? false,
  };
}

export async function fetchBlockedUsers({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<BlockedUserItem>> {
  const params = buildCursorParams({ limit, cursor, fallbackLimit: 20, max: 100 });
  const response = await settingsAuthFetch<unknown>(`/v1/users/blocked?${params.toString()}`);
  return {
    items: extractItemsArray(response).map(normalizeBlockedUserItem).filter((item): item is BlockedUserItem => Boolean(item)),
    nextCursor: extractNextCursor(response),
  };
}

export async function unblockPrincipal(principalId: string | number): Promise<void> {
  await settingsAuthFetch(`/v1/principals/${principalId}/block`, {
    method: "DELETE",
  });
}
