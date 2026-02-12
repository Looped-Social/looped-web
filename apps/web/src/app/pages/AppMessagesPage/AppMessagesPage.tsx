import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import {
  MessageRecipientComposer,
  type MessageRecipientComposerSuccess,
} from "@/app/components/MessageRecipientComposer/MessageRecipientComposer";
import {
  approveMessageRequest,
  createConversation,
  fetchChannels,
  fetchConversations,
  fetchMessageRequests,
  fetchViewerState,
  MessagingApiError,
  rejectMessageRequest,
  searchMessages,
} from "@/lib/messagingApi";

type InboxTabId = "messages" | "requests";
type LoadStatus = "idle" | "loading" | "ready" | "error";
type SearchStatus = "idle" | "loading" | "ready" | "error";
type RequestAction = "approve" | "reject";

type ThreadRow = {
  id: string;
  kind: "conversation" | "channel" | "search";
  routeHref?: string;
  title: string;
  subtitle?: string;
  preview?: string;
  avatarUrl?: string;
  initials: string;
  unreadCount: number;
  timestampLabel?: string;
  sortEpochMs: number;
};

type MessageRequestRow = {
  id: string;
  senderName: string;
  preview?: string;
  avatarUrl?: string;
  initials: string;
  timestampLabel?: string;
  senderUserId?: string;
  conversationId?: string;
  channelId?: string;
  isGroup: boolean;
  status: string;
};

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
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

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) return value;
  }
  return undefined;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = getNumber(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asDate(value: unknown): Date | null {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function formatTimeAgo(value: unknown): string {
  const date = asDate(value);
  if (!date) return "";

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(deltaSeconds, "second");
  const minutes = Math.round(deltaSeconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 4) return rtf.format(weeks, "week");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  const years = Math.round(days / 365);
  return rtf.format(years, "year");
}

function toSortEpochMs(value: unknown): number {
  const date = asDate(value);
  return date ? date.getTime() : 0;
}

function initialsFromName(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "?";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function extractItemsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function readNextCursor(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  return (
    normalizeOptional(payload.next_cursor) ??
    normalizeOptional(payload.nextCursor) ??
    normalizeOptional(payload.cursor)
  );
}

async function collectPagedItems(
  loadPage: (cursor?: string) => Promise<unknown>,
  maxPages = 8
): Promise<unknown[]> {
  const items: unknown[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await loadPage(cursor);
    items.push(...extractItemsArray(response));
    const nextCursor = readNextCursor(response);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  return items;
}

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof MessagingApiError) {
    const details = (error.details ?? "").trim();
    if (details.length) {
      try {
        const parsed: unknown = JSON.parse(details);
        if (isRecord(parsed)) {
          const code = normalizeOptional(parsed.error);
          if (code) {
            if (code === "message_request_pending") return "Message request is still pending.";
            if (code === "message_request_rejected") return "Message request was rejected.";
            if (code === "anonymous_not_allowed") return "Messaging is unavailable in anonymous mode.";
            if (code === "user_not_provisioned") return "Messaging is not ready for this account yet.";
          }
          const message = normalizeOptional(parsed.message);
          if (message) return message;
          if (code) return code.replaceAll("_", " ");
        }
      } catch {
        return details;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function extractConversationId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  return pickString(payload, ["conversation_id", "conversationId", "id"]);
}

function extractUserId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.user)) {
    return pickString(payload.user, ["id", "user_id", "userId"]);
  }
  return pickString(payload, ["id", "user_id", "userId"]);
}

function isViewerAnonymous(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return (
    getBoolean(
      payload.is_anonymous ??
        payload.isAnonymous ??
        payload.viewer_is_anonymous ??
        payload.viewerIsAnonymous ??
        payload.active_profile_is_anonymous ??
        payload.activeProfileIsAnonymous
    ) ?? false
  );
}

function normalizeNameFromProfile(profile: Record<string, unknown>, fallback = "Unknown"): string {
  const firstName = normalizeOptional(profile.first_name ?? profile.firstName);
  const lastName = normalizeOptional(profile.last_name ?? profile.lastName);
  const fullName = [firstName, lastName].filter((entry): entry is string => Boolean(entry)).join(" ").trim();
  if (fullName) return fullName;
  return (
    normalizeOptional(
      profile.display_name ??
        profile.displayName ??
        profile.name ??
        profile.username ??
        profile.handle ??
        profile.title
    ) ?? fallback
  );
}

function normalizeConversationRow(item: unknown): ThreadRow | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "conversation_id", "conversationId"]);
  if (!id) return null;

  const otherProfile =
    (isRecord(item.other_user_profile) ? item.other_user_profile : null) ??
    (isRecord(item.otherUserProfile) ? item.otherUserProfile : null) ??
    (isRecord(item.participant) ? item.participant : null) ??
    (isRecord(item.user) ? item.user : null);

  const title =
    (otherProfile ? normalizeNameFromProfile(otherProfile, "Unknown") : undefined) ??
    normalizeOptional(
      pickString(item, ["other_user_display_name", "otherUserDisplayName", "name", "title", "participant_name"])
    ) ??
    "Unknown";

  const specializationName = otherProfile
    ? normalizeOptional(
        pickString(otherProfile, ["display_specialization_name", "displaySpecializationName", "specialization_name"])
      )
    : undefined;
  const communityName = otherProfile
    ? normalizeOptional(
        pickString(otherProfile, ["display_community_name", "displayCommunityName", "community_name", "company_name"])
      )
    : undefined;
  const subtitle =
    [specializationName, communityName].filter((entry): entry is string => Boolean(entry)).join(" @ ") ||
    undefined;

  const lastMessageRecord =
    (isRecord(item.last_message) ? item.last_message : null) ??
    (isRecord(item.lastMessage) ? item.lastMessage : null);
  const preview =
    normalizeOptional(
      pickString(item, ["last_message_preview", "lastMessagePreview", "last_message", "lastMessage", "preview", "snippet"])
    ) ??
    (lastMessageRecord
      ? normalizeOptional(
          pickString(lastMessageRecord, ["content", "text", "body", "message", "preview", "snippet"])
        )
      : undefined);

  const timestampValue =
    item.last_message_timestamp ??
    item.lastMessageTimestamp ??
    item.updated_at ??
    item.updatedAt ??
    item.created_at ??
    item.createdAt ??
    (lastMessageRecord ? lastMessageRecord.created_at ?? lastMessageRecord.createdAt : undefined);

  const timestampLabel = formatTimeAgo(timestampValue);
  const sortEpochMs = toSortEpochMs(timestampValue);
  const unreadCount = Math.max(
    0,
    Math.round(pickNumber(item, ["unread_count", "unreadCount", "unread_messages", "unreadMessages"]) ?? 0)
  );

  const avatarUrl =
    otherProfile
      ? normalizeOptional(pickString(otherProfile, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]))
      : undefined;

  return {
    id: `conversation:${id}`,
    kind: "conversation",
    routeHref: `/app/messages/conversation/${id}`,
    title,
    subtitle,
    preview,
    avatarUrl,
    initials: initialsFromName(title),
    unreadCount,
    timestampLabel: timestampLabel || undefined,
    sortEpochMs,
  };
}

function normalizeChannelRow(item: unknown): ThreadRow | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "channel_id", "channelId"]);
  if (!id) return null;

  const title =
    normalizeOptional(pickString(item, ["name", "title", "display_name", "displayName"])) ?? "Untitled channel";
  const membersCount = Math.max(
    0,
    Math.round(
      pickNumber(item, ["member_count", "memberCount", "members_count", "membersCount", "participant_count"]) ?? 0
    )
  );
  const subtitle = `${membersCount} ${membersCount === 1 ? "member" : "members"}`;

  const lastMessageRecord =
    (isRecord(item.last_message) ? item.last_message : null) ??
    (isRecord(item.lastMessage) ? item.lastMessage : null);
  const preview =
    normalizeOptional(
      pickString(item, ["last_message_preview", "lastMessagePreview", "last_message", "lastMessage", "preview"])
    ) ??
    (lastMessageRecord
      ? normalizeOptional(
          pickString(lastMessageRecord, ["content", "text", "body", "message", "preview", "snippet"])
        )
      : undefined);

  const timestampValue =
    item.last_message_timestamp ??
    item.lastMessageTimestamp ??
    item.updated_at ??
    item.updatedAt ??
    item.created_at ??
    item.createdAt ??
    (lastMessageRecord ? lastMessageRecord.created_at ?? lastMessageRecord.createdAt : undefined);

  const timestampLabel = formatTimeAgo(timestampValue);
  const sortEpochMs = toSortEpochMs(timestampValue);
  const unreadCount = Math.max(
    0,
    Math.round(pickNumber(item, ["unread_count", "unreadCount", "unread_messages", "unreadMessages"]) ?? 0)
  );

  const avatarUrl = normalizeOptional(
    pickString(item, ["photo_url", "photoUrl", "image_url", "imageUrl", "profile_image_url", "profileImageUrl"])
  );

  return {
    id: `channel:${id}`,
    kind: "channel",
    routeHref: `/app/messages/channel/${id}`,
    title,
    subtitle,
    preview,
    avatarUrl,
    initials: initialsFromName(title),
    unreadCount,
    timestampLabel: timestampLabel || undefined,
    sortEpochMs,
  };
}

function normalizeSearchRow(item: unknown): ThreadRow | null {
  if (!isRecord(item)) return null;

  const resultType = normalizeOptional(pickString(item, ["type"]))?.toLowerCase();
  const conversationId = pickString(item, ["conversation_id", "conversationId"]);
  const channelId = pickString(item, ["channel_id", "channelId"]);
  const messageId = pickString(item, ["id", "message_id", "messageId"]);
  const id =
    (resultType === "channel" ? channelId : resultType === "conversation" ? conversationId : undefined) ??
    conversationId ??
    channelId ??
    messageId;
  if (!id) return null;

  const actor =
    (isRecord(item.other_user_profile) ? item.other_user_profile : null) ??
    (isRecord(item.otherUserProfile) ? item.otherUserProfile : null) ??
    (isRecord(item.actor) ? item.actor : null) ??
    (isRecord(item.sender) ? item.sender : null) ??
    (isRecord(item.user) ? item.user : null);

  const matchedMessage =
    (isRecord(item.matched_message) ? item.matched_message : null) ??
    (isRecord(item.matchedMessage) ? item.matchedMessage : null);

  const title =
    normalizeOptional(
      pickString(item, ["conversation_name", "conversationName", "channel_name", "channelName", "title", "name"])
    ) ??
    (actor ? normalizeNameFromProfile(actor, "") : undefined) ??
    "Conversation";

  const preview =
    (matchedMessage
      ? normalizeOptional(pickString(matchedMessage, ["content", "text", "body", "message", "snippet", "preview"]))
      : undefined) ??
    normalizeOptional(
      pickString(item, ["content", "text", "body", "message", "snippet", "preview", "last_message", "lastMessage"])
    ) ?? undefined;
  const timestampValue =
    (matchedMessage ? matchedMessage.created_at ?? matchedMessage.createdAt : undefined) ??
    item.created_at ??
    item.createdAt ??
    item.last_message_timestamp ??
    item.lastMessageTimestamp ??
    item.updated_at ??
    item.updatedAt;

  const kind: ThreadRow["kind"] = channelId ? "channel" : conversationId ? "conversation" : "search";
  const avatarUrl = actor
    ? normalizeOptional(pickString(actor, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]))
    : undefined;

  return {
    id: `search:${id}`,
    kind,
    routeHref: conversationId
      ? `/app/messages/conversation/${conversationId}`
      : channelId
        ? `/app/messages/channel/${channelId}`
        : undefined,
    title,
    preview,
    avatarUrl,
    initials: initialsFromName(title),
    unreadCount: 0,
    timestampLabel: formatTimeAgo(timestampValue) || undefined,
    sortEpochMs: toSortEpochMs(timestampValue),
  };
}

function normalizeMessageRequestRow(item: unknown): MessageRequestRow | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "request_id", "requestId", "message_request_id", "messageRequestId"]);
  if (!id) return null;

  const statusRaw =
    normalizeOptional(pickString(item, ["status", "state"]))?.toLowerCase() ??
    normalizeOptional(pickString(item, ["request_status", "requestStatus"]))?.toLowerCase() ??
    "pending";

  const previewMessage =
    (isRecord(item.message) ? item.message : null) ??
    (isRecord(item.preview) ? item.preview : null) ??
    (isRecord(item.matched_message) ? item.matched_message : null);

  const senderProfile =
    (isRecord(item.requester_profile) ? item.requester_profile : null) ??
    (isRecord(item.requesterProfile) ? item.requesterProfile : null) ??
    (isRecord(item.sender_profile) ? item.sender_profile : null) ??
    (isRecord(item.senderProfile) ? item.senderProfile : null) ??
    (isRecord(item.sender_user_profile) ? item.sender_user_profile : null) ??
    (isRecord(item.senderUserProfile) ? item.senderUserProfile : null) ??
    (isRecord(item.sender) ? item.sender : null) ??
    (isRecord(item.actor) ? item.actor : null);

  const senderName =
    (senderProfile ? normalizeNameFromProfile(senderProfile, "Unknown") : undefined) ??
    normalizeOptional(pickString(item, ["sender_name", "senderName", "display_name", "displayName"])) ??
    "Unknown";

  const preview =
    (previewMessage
      ? normalizeOptional(
          pickString(previewMessage, ["content", "text", "body", "message", "snippet", "preview"])
        )
      : undefined) ??
    normalizeOptional(
      pickString(item, ["message_preview", "messagePreview", "content", "text", "body", "message", "last_message"])
    ) ?? undefined;
  const timestampValue =
    item.created_at ??
    item.createdAt ??
    item.updated_at ??
    item.updatedAt ??
    (previewMessage ? previewMessage.created_at ?? previewMessage.createdAt : undefined);
  const timestampLabel = formatTimeAgo(timestampValue);

  const senderUserId = senderProfile
    ? pickString(senderProfile, ["id", "user_id", "userId"])
    : pickString(item, ["requester_id", "requesterId", "sender_user_id", "senderUserId", "sender_id", "senderId"]);
  const conversationId = pickString(item, ["conversation_id", "conversationId"]);
  const channelId = pickString(item, ["channel_id", "channelId"]);
  const isGroup = getBoolean(item.is_group ?? item.isGroup) ?? Boolean(channelId);
  const avatarUrl = senderProfile
    ? normalizeOptional(pickString(senderProfile, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]))
    : undefined;

  return {
    id,
    senderName,
    preview,
    avatarUrl,
    initials: initialsFromName(senderName),
    timestampLabel: timestampLabel || undefined,
    senderUserId: senderUserId ?? undefined,
    conversationId: conversationId ?? undefined,
    channelId: channelId ?? undefined,
    isGroup,
    status: statusRaw,
  };
}

function Avatar({ avatarUrl }: { avatarUrl?: string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-base font-semibold text-text-secondary">
      <img
        src={avatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        onError={handleProfileImageError}
      />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-bg-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="h-3.5 w-1/3 rounded-full bg-bg-muted" aria-hidden="true" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-bg-muted" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function ThreadRowCard({
  row,
  onOpen,
}: {
  row: ThreadRow;
  onOpen: (row: ThreadRow) => void;
}) {
  return (
    <button
      type="button"
      className="w-full px-4 py-3 text-left transition hover:bg-bg-muted/35"
      onClick={() => onOpen(row)}
    >
      <div className="flex items-start gap-3">
        <Avatar avatarUrl={row.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-strong">
                {row.title}
              </p>
              {row.subtitle ? <p className="truncate text-sm text-text-secondary">{row.subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 pl-2">
              {row.timestampLabel ? <span className="text-xs text-text-light">{row.timestampLabel}</span> : null}
              {row.unreadCount > 0 ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">
                  {row.unreadCount}
                </span>
              ) : null}
            </div>
          </div>
          {row.preview ? <p className="mt-1 truncate text-sm text-text-secondary">{row.preview}</p> : null}
        </div>
      </div>
    </button>
  );
}

function RequestRowCard({
  row,
  actionInFlight,
  onAction,
}: {
  row: MessageRequestRow;
  actionInFlight?: RequestAction;
  onAction: (row: MessageRequestRow, action: RequestAction) => void;
}) {
  const isBusy = Boolean(actionInFlight);
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Avatar avatarUrl={row.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-strong">{row.senderName}</p>
              {row.preview ? <p className="truncate text-sm text-text-secondary">{row.preview}</p> : null}
            </div>
            {row.timestampLabel ? <span className="shrink-0 text-xs text-text-light">{row.timestampLabel}</span> : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAction(row, "approve")}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {actionInFlight === "approve" ? (
                "Approving..."
              ) : (
                <>
                  <CheckIcon className="h-3.5 w-3.5" />
                  <span>Approve</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onAction(row, "reject")}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-bg px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-70"
            >
              {actionInFlight === "reject" ? (
                "Rejecting..."
              ) : (
                <>
                  <XIcon className="h-3.5 w-3.5" />
                  <span>Reject</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function rowMatchesQuery(row: { title?: string; subtitle?: string; preview?: string }, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return `${row.title ?? ""} ${row.subtitle ?? ""} ${row.preview ?? ""}`.toLowerCase().includes(normalizedQuery);
}

export function AppMessagesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTabId, setActiveTabId] = useState<InboxTabId>("messages");
  const [query, setQuery] = useState("");
  const [isAnonymousViewer, setIsAnonymousViewer] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [conversationRows, setConversationRows] = useState<ThreadRow[]>([]);
  const [channelRows, setChannelRows] = useState<ThreadRow[]>([]);
  const [requestRows, setRequestRows] = useState<MessageRequestRow[]>([]);

  const [conversationStatus, setConversationStatus] = useState<LoadStatus>("idle");
  const [channelStatus, setChannelStatus] = useState<LoadStatus>("idle");
  const [requestStatus, setRequestStatus] = useState<LoadStatus>("idle");
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchResults, setSearchResults] = useState<ThreadRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [requestActionById, setRequestActionById] = useState<Record<string, RequestAction | undefined>>({});

  const loadViewerState = useCallback(async () => {
    try {
      const response = await fetchViewerState();
      setIsAnonymousViewer(isViewerAnonymous(response));
      setViewerUserId(extractUserId(response) ?? null);
    } catch {
      setIsAnonymousViewer(false);
      setViewerUserId(null);
    }
  }, []);

  const loadConversations = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setConversationStatus("loading");
      setConversationError(null);
    }
    try {
      const items = await collectPagedItems((cursor) => fetchConversations({ limit: 100, cursor }), 8);
      const normalized = items
        .map(normalizeConversationRow)
        .filter((entry): entry is ThreadRow => Boolean(entry))
        .sort((a, b) => b.sortEpochMs - a.sortEpochMs);
      setConversationRows(normalized);
      setConversationStatus("ready");
      setConversationError(null);
    } catch (error) {
      if (silent) return;
      setConversationStatus("error");
      setConversationError(parseApiErrorMessage(error));
    }
  }, []);

  const loadRequests = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setRequestStatus("loading");
      setRequestError(null);
    }
    try {
      const items = await collectPagedItems((cursor) => fetchMessageRequests({ limit: 100, cursor }), 8);
      const normalized = items
        .map(normalizeMessageRequestRow)
        .filter((entry): entry is MessageRequestRow => Boolean(entry))
        .filter((entry) => entry.status === "pending");
      setRequestRows(normalized);
      setRequestStatus("ready");
      setRequestError(null);
    } catch (error) {
      if (silent) return;
      setRequestStatus("error");
      setRequestError(parseApiErrorMessage(error));
    }
  }, []);

  const loadChannels = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setChannelStatus("loading");
      setChannelError(null);
    }
    try {
      const items = await collectPagedItems((cursor) => fetchChannels({ limit: 100, cursor }), 8);
      const normalized = items
        .map(normalizeChannelRow)
        .filter((entry): entry is ThreadRow => Boolean(entry))
        .sort((a, b) => b.sortEpochMs - a.sortEpochMs);
      setChannelRows(normalized);
      setChannelStatus("ready");
      setChannelError(null);
    } catch (error) {
      if (silent) return;
      setChannelStatus("error");
      setChannelError(parseApiErrorMessage(error));
    }
  }, []);

  const loadInbox = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      await Promise.all([loadConversations({ silent }), loadRequests({ silent }), loadChannels({ silent })]);
    },
    [loadChannels, loadConversations, loadRequests]
  );

  useEffect(() => {
    void loadViewerState();
    void loadInbox();
  }, [loadInbox, loadViewerState]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const shouldSearchApi = activeTabId === "messages" && !isAnonymousViewer && trimmedQuery.length >= 2;
    if (!shouldSearchApi) {
      setSearchStatus("idle");
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    let active = true;
    setSearchStatus("loading");
    setSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const response = await searchMessages({ query: trimmedQuery, limit: 20 });
        if (!active) return;
        const normalized = extractItemsArray(response)
          .map(normalizeSearchRow)
          .filter((entry): entry is ThreadRow => Boolean(entry))
          .sort((a, b) => b.sortEpochMs - a.sortEpochMs);
        setSearchResults(normalized);
        setSearchStatus("ready");
      } catch (error) {
        if (!active) return;
        setSearchStatus("error");
        setSearchError(parseApiErrorMessage(error));
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeTabId, isAnonymousViewer, query]);

  const normalizedQuery = query.trim().toLowerCase();
  const shouldSearchApi = activeTabId === "messages" && !isAnonymousViewer && normalizedQuery.length >= 2;
  const shouldFilterLocally = normalizedQuery.length > 0 && !shouldSearchApi;

  const visibleChannels = useMemo(
    () => (shouldFilterLocally ? channelRows.filter((row) => rowMatchesQuery(row, normalizedQuery)) : channelRows),
    [channelRows, normalizedQuery, shouldFilterLocally]
  );
  const visibleConversations = useMemo(
    () =>
      shouldFilterLocally
        ? conversationRows.filter((row) => rowMatchesQuery(row, normalizedQuery))
        : conversationRows,
    [conversationRows, normalizedQuery, shouldFilterLocally]
  );
  const visibleRequests = useMemo(
    () =>
      shouldFilterLocally
        ? requestRows.filter((row) =>
            `${row.senderName} ${row.preview ?? ""}`.toLowerCase().includes(normalizedQuery)
          )
        : requestRows,
    [normalizedQuery, requestRows, shouldFilterLocally]
  );

  const handleOpenThread = useCallback(
    (row: ThreadRow) => {
      if (row.routeHref) {
        navigate(row.routeHref);
        return;
      }
      showToast({
        kind: "info",
        title: "Messages",
        text: "Chat threads are the next messaging step for web.",
      });
    },
    [navigate, showToast]
  );

  const handleMessageRequestAction = useCallback(
    async (row: MessageRequestRow, action: RequestAction) => {
      if (requestActionById[row.id]) return;

      setRequestActionById((prev) => ({ ...prev, [row.id]: action }));
      try {
        if (action === "approve") {
          await approveMessageRequest(row.id);
          if (row.isGroup) {
            void loadChannels({ silent: true });
          } else {
            let conversationId = row.conversationId;
            if (!conversationId && row.senderUserId) {
              const response = await createConversation(row.senderUserId);
              conversationId = extractConversationId(response);
            }
            if (conversationId) {
              navigate(`/app/messages/conversation/${conversationId}`);
            }
          }
          showToast({ kind: "success", text: "Message request approved." });
        } else {
          await rejectMessageRequest(row.id);
          showToast({ kind: "success", text: "Message request rejected." });
        }

        setRequestRows((prev) => prev.filter((entry) => entry.id !== row.id));
        void loadConversations({ silent: true });
        void loadChannels({ silent: true });
      } catch (error) {
        showToast({
          kind: "error",
          title: action === "approve" ? "Couldn’t approve request" : "Couldn’t reject request",
          text: parseApiErrorMessage(error),
        });
      } finally {
        setRequestActionById((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
      }
    },
    [loadChannels, loadConversations, navigate, requestActionById, showToast]
  );

  const openComposer = useCallback(() => {
    if (isAnonymousViewer) {
      showToast({
        kind: "info",
        title: "Messaging unavailable",
        text: "Switch to your named profile to start a new chat.",
      });
      return;
    }
    setIsComposerOpen(true);
  }, [isAnonymousViewer, showToast]);

  const handleComposerSuccess = useCallback(
    (result: MessageRecipientComposerSuccess) => {
      setIsComposerOpen(false);
      if (result.kind === "conversation") {
        navigate(`/app/messages/conversation/${result.conversationId}`);
        return;
      }
      if (result.kind === "channel") {
        navigate(`/app/messages/channel/${result.channelId}`);
        return;
      }
    },
    [navigate]
  );

  const isLoadingMessages = (conversationStatus === "loading" || channelStatus === "loading") && !conversationRows.length && !channelRows.length;
  const isLoadingRequests = requestStatus === "loading" && !requestRows.length;
  const hasMessageLoadError = conversationStatus === "error" && channelStatus === "error" && !conversationRows.length && !channelRows.length;
  const hasRequestLoadError = requestStatus === "error" && !requestRows.length;
  const showLocalSearchHint =
    activeTabId === "messages" && isAnonymousViewer && normalizedQuery.length > 0 && !shouldSearchApi;

  return (
    <AppLayout activeNavId="messages">
      <AppMobileHeader title="Messages" showAction={false} />

      <header className="border-b border-border/70 bg-bg px-4 pb-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl leading-none font-semibold text-strong sm:text-5xl lg:text-[2.25rem]">Messages</h1>
          <button
            type="button"
            onClick={openComposer}
            disabled={activeTabId !== "messages"}
            className="hidden h-10 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
          >
            New Message
          </button>
        </div>
        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={isAnonymousViewer}
            className="h-11 w-full rounded-xl bg-bg-muted pl-10 pr-3 text-sm text-strong placeholder:text-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-70"
            placeholder={isAnonymousViewer ? "Search unavailable in anonymous mode" : "Search"}
            aria-label="Search messages"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-bg">
          <button
            type="button"
            onClick={() => setActiveTabId("messages")}
            className={`h-10 cursor-pointer rounded-full text-[1.03rem] transition ${
              activeTabId === "messages"
                ? "bg-brand font-semibold text-white shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
                : "border border-border/80 bg-bg font-medium text-text-secondary hover:text-strong"
            }`}
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => setActiveTabId("requests")}
            className={`h-10 cursor-pointer rounded-full text-[1.03rem] transition ${
              activeTabId === "requests"
                ? "bg-brand font-semibold text-white shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
                : "border border-border/80 bg-bg font-medium text-text-secondary hover:text-strong"
            }`}
          >
            Requests
          </button>
        </div>
      </header>

      <section className="divide-y divide-border/70 bg-bg pb-24">
        {activeTabId === "messages" ? (
          <>
            {showLocalSearchHint ? (
              <div className="px-4 py-3 text-sm text-text-secondary sm:px-6">
                Switch to your named profile to search messages.
              </div>
            ) : null}

            {isLoadingMessages ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : null}

            {hasMessageLoadError ? (
              <div className="space-y-3 px-4 py-4 sm:px-6">
                <p className="text-sm font-semibold text-strong">Unable to load messages.</p>
                <p className="text-sm text-text-secondary">{conversationError ?? channelError ?? "Please try again."}</p>
                <button
                  type="button"
                  onClick={() => void loadInbox()}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {shouldSearchApi ? (
              <>
                {searchStatus === "loading" && !searchResults.length ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : null}

                {searchStatus === "error" ? (
                  <div className="space-y-2 px-4 py-4 sm:px-6">
                    <p className="text-sm font-semibold text-strong">Unable to search messages.</p>
                    <p className="text-sm text-text-secondary">{searchError ?? "Try again with another query."}</p>
                  </div>
                ) : null}

                {searchStatus !== "error" && searchStatus !== "loading" && searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-text-secondary sm:px-6">No message matches found.</div>
                ) : null}

                {searchResults.map((row) => (
                  <ThreadRowCard key={row.id} row={row} onOpen={handleOpenThread} />
                ))}
              </>
            ) : (
              <>
                {visibleChannels.map((row) => (
                  <ThreadRowCard key={row.id} row={row} onOpen={handleOpenThread} />
                ))}
                {visibleConversations.map((row) => (
                  <ThreadRowCard key={row.id} row={row} onOpen={handleOpenThread} />
                ))}
                {!isLoadingMessages && !hasMessageLoadError && visibleChannels.length === 0 && visibleConversations.length === 0 ? (
                  <div className="space-y-3 px-4 py-6 text-sm text-text-secondary sm:px-6">
                    <p>{normalizedQuery.length > 0 ? "No matching conversations." : "No messages yet."}</p>
                    {normalizedQuery.length === 0 ? (
                      <button
                        type="button"
                        onClick={openComposer}
                        className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
                      >
                        Start a new chat
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            {isLoadingRequests ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : null}

            {hasRequestLoadError ? (
              <div className="space-y-3 px-4 py-4 sm:px-6">
                <p className="text-sm font-semibold text-strong">Unable to load requests.</p>
                <p className="text-sm text-text-secondary">{requestError ?? "Please try again."}</p>
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {visibleRequests.map((row) => (
              <RequestRowCard
                key={row.id}
                row={row}
                actionInFlight={requestActionById[row.id]}
                onAction={handleMessageRequestAction}
              />
            ))}
            {!isLoadingRequests && !hasRequestLoadError && visibleRequests.length === 0 ? (
              <div className="px-4 py-6 text-sm text-text-secondary sm:px-6">
                {normalizedQuery.length > 0 ? "No matching requests." : "No pending requests."}
              </div>
            ) : null}
          </>
        )}
      </section>

      <button
        type="button"
        onClick={openComposer}
        className={`fixed bottom-6 right-5 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_12px_24px_rgba(234,64,74,0.32)] transition hover:bg-brand-hover sm:hidden ${
          activeTabId !== "messages" ? "pointer-events-none opacity-0" : ""
        }`}
        aria-label="New message"
      >
        <img src="/ios-icons/action-send.svg" alt="" className="h-6 w-6 object-contain" loading="lazy" />
      </button>

      <MessageRecipientComposer
        open={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onSuccess={handleComposerSuccess}
        currentUserId={viewerUserId}
      />
    </AppLayout>
  );
}
