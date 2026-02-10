import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class MessagingApiError extends ApiError {}

export type CursorEnvelope<T> = {
  items: T[];
  next_cursor?: string | null;
  nextCursor?: string | null;
};

type MessageSendPayload = {
  content: string;
  attachments?: unknown[];
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
};

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
}: {
  limit?: number;
  cursor?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(limit));
  }
  if (cursor) params.set("cursor", cursor);
  return params;
}

export async function fetchViewerState(): Promise<unknown> {
  return authFetch<unknown>("/v1/me");
}

export async function fetchConversations({
  limit = 50,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/conversations?${params.toString()}`);
}

export async function fetchMessageRequests({
  limit = 50,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/message-requests?${params.toString()}`);
}

export async function fetchChannels({
  limit = 50,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
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
  const params = buildCursorParams({ limit, cursor });
  params.set("query", query);
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
  const params = buildCursorParams({ limit, cursor });
  params.set("query", query);
  return authFetch<CursorEnvelope<unknown>>(`/v1/users/search?${params.toString()}`);
}

export async function approveMessageRequest(messageRequestId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/message-requests/${messageRequestId}/approve`, {
    method: "POST",
  });
}

export async function rejectMessageRequest(messageRequestId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/message-requests/${messageRequestId}/reject`, {
    method: "POST",
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
}: {
  conversationId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/conversations/${conversationId}/messages?${params.toString()}`);
}

export async function fetchChannelMessages({
  channelId,
  limit = 50,
  cursor,
}: {
  channelId: string | number;
  limit?: number;
  cursor?: string;
}): Promise<CursorEnvelope<unknown>> {
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/channels/${channelId}/messages?${params.toString()}`);
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
  const params = buildCursorParams({ limit, cursor });
  return authFetch<CursorEnvelope<unknown>>(`/v1/channels/${channelId}/members?${params.toString()}`);
}

export async function sendConversationMessage({
  conversationId,
  content,
  attachments,
}: {
  conversationId: string | number;
  content: string;
  attachments?: unknown[];
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
  attachments?: unknown[];
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
  payload: { name?: string; photoMediaAssetId?: number | string }
): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}`, {
    method: "PATCH",
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

export async function deleteChannel(channelId: string | number): Promise<unknown> {
  return authFetch<unknown>(`/v1/channels/${channelId}`, {
    method: "DELETE",
  });
}
