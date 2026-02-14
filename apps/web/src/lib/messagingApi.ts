import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class MessagingApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

export type MessageAttachmentPayload = {
  url: string;
  type?: "image" | "video";
  width?: number;
  height?: number;
  size_bytes?: number | null;
  duration_seconds?: number | null;
  thumbnail_url?: string | null;
};

type MessageSendPayload = {
  content: string;
  attachments?: Array<string | MessageAttachmentPayload>;
};

type MessageMediaPresignRequest = {
  contentType: string;
  sizeBytes: number;
};

export type MessageMediaPresignResponse = {
  key?: string;
  uploadUrl?: string;
  headers?: Record<string, string>;
  method?: string;
};

export type MessageMediaResolvedItem = {
  key?: string;
  downloadUrl?: string;
  expires_in_seconds?: number;
  expiresInSeconds?: number;
  mime_type?: string;
  mimeType?: string;
};

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
    notifyAuthGateFromHttpError({ status: response.status, details, source: "messagingApi" });
    throw new MessagingApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

function buildCursorParams({
  limit,
  cursor,
  fallback,
  min,
  max,
}: {
  limit?: number;
  cursor?: string;
  fallback: number;
  min: number;
  max: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  const resolvedLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(min, Math.min(max, Math.floor(limit)))
      : fallback;
  params.set("limit", String(resolvedLimit));
  if (cursor) params.set("cursor", cursor);
  return params;
}

export async function fetchViewerState(): Promise<unknown> {
  return authFetch<unknown>("/v1/me");
}

export async function fetchConversations({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallback: 20, min: 1, max: 100 });
  return authFetch<CursorEnvelope<unknown>>(`/v1/conversations?${params.toString()}`);
}

export async function fetchMessageRequests({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallback: 20, min: 1, max: 100 });
  return authFetch<CursorEnvelope<unknown>>(`/v1/message-requests?${params.toString()}`);
}

export async function fetchChannels({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallback: 20, min: 1, max: 100 });
  return authFetch<CursorEnvelope<unknown>>(`/v1/channels?${params.toString()}`);
}

export async function searchMessages({
  query,
  limit = 20,
  cursor,
}: {
  query: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const normalizedQuery = query.trim();
  const params = buildCursorParams({ limit, cursor, fallback: 20, min: 1, max: 50 });
  params.set("query", normalizedQuery);
  return authFetch<CursorEnvelope<unknown>>(`/v1/messages/search?${params.toString()}`);
}

export async function searchUsersForMessages({
  query,
  limit = 20,
  cursor,
}: {
  query: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallback: 20, min: 1, max: 100 });
  params.set("query", query.trim());
  return authFetch<CursorEnvelope<unknown>>(`/v1/users/search?${params.toString()}`);
}

export async function approveMessageRequest(messageRequestId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/message-requests/${messageRequestId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectMessageRequest(messageRequestId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/message-requests/${messageRequestId}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function createConversation(participantUserId: string | number): Promise<unknown> {
  return authFetch<unknown>("/v1/conversations", {
    method: "POST",
    body: JSON.stringify({ participantUserId: Number(participantUserId) }),
  });
}

export async function fetchConversationMessages({
  conversationId,
  limit = 50,
  cursor,
  signal,
}: {
  conversationId: string | number;
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallback: 50, min: 1, max: 200 });
  return authFetch<CursorEnvelope<unknown>>(`/v1/conversations/${conversationId}/messages?${params.toString()}`, {
    signal,
  });
}

export async function fetchChannelMessages({
  channelId,
  limit = 50,
  cursor,
  signal,
}: {
  channelId: string | number;
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallback: 50, min: 1, max: 200 });
  return authFetch<CursorEnvelope<unknown>>(`/v1/channels/${channelId}/messages?${params.toString()}`, {
    signal,
  });
}

export async function fetchChannelMembers({
  channelId,
  limit = 50,
  cursor,
}: {
  channelId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor, fallback: 50, min: 1, max: 200 });
  return authFetch<CursorEnvelope<unknown>>(`/v1/channels/${channelId}/members?${params.toString()}`);
}

export async function sendConversationMessage({
  conversationId,
  content,
  attachments,
}: {
  conversationId: string | number;
  content: string;
  attachments?: Array<string | MessageAttachmentPayload>;
}): Promise<unknown> {
  const payload: MessageSendPayload = { content };
  if (attachments && attachments.length > 0) payload.attachments = attachments;
  return authFetch<unknown>(`/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendChannelMessage({
  channelId,
  content,
  attachments,
}: {
  channelId: string | number;
  content: string;
  attachments?: Array<string | MessageAttachmentPayload>;
}): Promise<unknown> {
  const payload: MessageSendPayload = { content };
  if (attachments && attachments.length > 0) payload.attachments = attachments;
  return authFetch<unknown>(`/v1/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function presignMessageMedia(
  payload: MessageMediaPresignRequest
): Promise<MessageMediaPresignResponse> {
  return authFetch<MessageMediaPresignResponse>("/v1/message-media/presign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resolveMessageMedia(
  keys: string[]
): Promise<{ items: MessageMediaResolvedItem[] }> {
  return authFetch<{ items: MessageMediaResolvedItem[] }>("/v1/message-media/resolve", {
    method: "POST",
    body: JSON.stringify({ keys }),
  });
}

export async function setConversationMuted(
  conversationId: string | number,
  muted: boolean
): Promise<unknown> {
  return authFetch<unknown>(`/v1/conversations/${conversationId}/preferences`, {
    method: "PUT",
    body: JSON.stringify({ muted }),
  });
}

export async function setChannelMuted(
  channelId: string | number,
  muted: boolean
): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}/preferences`, {
    method: "PUT",
    body: JSON.stringify({ muted }),
  });
}

export async function patchChannel(
  channelId: string | number,
  payload: { name?: string; photoMediaAssetId?: number | string | null; photo_media_asset_id?: number | string | null }
): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createChannel({
  name,
  memberUserIds,
}: {
  name: string;
  memberUserIds?: Array<string | number>;
}): Promise<unknown> {
  const payload: { name: string; memberUserIds?: number[] } = { name };
  if (memberUserIds && memberUserIds.length > 0) {
    payload.memberUserIds = memberUserIds.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }
  return authFetch<unknown>("/v1/channels", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addChannelMembers(
  channelId: string | number,
  userIds: Array<string | number>
): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}/members`, {
    method: "POST",
    body: JSON.stringify({ userIds: userIds.map((value) => Number(value)) }),
  });
}

export async function removeChannelMember(
  channelId: string | number,
  userId: string | number
): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function setChannelMemberCanManageMembers({
  channelId,
  userId,
  canManageMembers,
}: {
  channelId: string | number;
  userId: string | number;
  canManageMembers: boolean;
}): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}/members/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ canManageMembers }),
  });
}

export async function joinChannel(channelId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}/join`, {
    method: "POST",
  });
}

export async function deleteChannel(channelId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}`, {
    method: "DELETE",
  });
}
