import { type ChangeEvent, type CSSProperties, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import {
  fetchChannelMembers,
  fetchChannelMessages,
  fetchChannels,
  fetchConversationMessages,
  fetchConversations,
  fetchViewerState,
  MessagingApiError,
  type MessageAttachmentPayload,
  presignMessageMedia,
  resolveMessageMedia,
  setChannelMuted,
  setConversationMuted,
  sendChannelMessage,
  sendConversationMessage,
  type CursorEnvelope,
} from "@/lib/messagingApi";

type ThreadType = "conversation" | "channel";
type BlockState = "pending" | "rejected" | null;

type MemberPreview = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type MessageAttachment = {
  id: string;
  key?: string;
  url?: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  type?: "image" | "video";
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes?: number;
  mimeType?: string;
};

type ThreadMessage = {
  id: string;
  senderId?: string;
  senderName?: string;
  senderAvatarUrl?: string;
  content: string;
  attachments: MessageAttachment[];
  createdAtMs: number;
  isMine: boolean;
};

type AppMessageThreadPageProps = {
  threadType: ThreadType;
  threadId: string;
};

type MediaPreviewState = {
  kind: "image" | "video";
  src: string;
  poster?: string;
};

const POLL_INTERVAL_MS = 10_000;
const MAX_IMAGE_ATTACHMENTS = 4;
const ZERO_WIDTH_SPACE = "\u200B";
const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";
const RESOLVE_CACHE_LEEWAY_MS = 20_000;

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

function BackIcon({ className }: { className?: string }) {
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 5.2a1 1 0 0 1 1.5-.86l9 5.3a1 1 0 0 1 0 1.72l-9 5.3A1 1 0 0 1 8 15.8V5.2z" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 19V6" />
      <path d="m6.5 11.5 5.5-5.5 5.5 5.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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

function formatMessageTime(timestampMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestampMs);
}

function formatDayLabel(timestampMs: number): string {
  const today = new Date();
  const target = new Date(timestampMs);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  if (startOfTarget === startOfToday) return "Today";
  if (startOfTarget === startOfToday - 86_400_000) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(target);
}

function dayKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function parseApiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof MessagingApiError)) return undefined;
  const details = (error.details ?? "").trim();
  if (!details) return undefined;
  try {
    const parsed: unknown = JSON.parse(details);
    if (isRecord(parsed)) return normalizeOptional(parsed.error);
  } catch {
    return undefined;
  }
  return undefined;
}

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof MessagingApiError) {
    const details = (error.details ?? "").trim();
    if (details.length > 0) {
      try {
        const parsed: unknown = JSON.parse(details);
        if (isRecord(parsed)) {
          const message = normalizeOptional(parsed.message);
          if (message) return message;
          const code = normalizeOptional(parsed.error);
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

function extractItemsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.members)) return payload.members;
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

function normalizeViewerId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.user)) {
    return pickString(payload.user, ["id", "user_id", "userId"]);
  }
  return pickString(payload, ["id", "user_id", "userId"]);
}

function normalizeProfileName(profile: Record<string, unknown>, fallback = "Unknown"): string {
  const firstName = normalizeOptional(profile.first_name ?? profile.firstName);
  const lastName = normalizeOptional(profile.last_name ?? profile.lastName);
  const fullName = [firstName, lastName].filter((entry): entry is string => Boolean(entry)).join(" ").trim();
  if (fullName) return fullName;
  return (
    normalizeOptional(profile.display_name ?? profile.displayName ?? profile.name ?? profile.username ?? profile.handle) ??
    fallback
  );
}

function normalizeMemberPreview(item: unknown): MemberPreview | null {
  if (!isRecord(item)) return null;
  const user =
    (isRecord(item.user_profile) ? item.user_profile : null) ??
    (isRecord(item.userProfile) ? item.userProfile : null) ??
    (isRecord(item.user) ? item.user : null) ??
    item;
  const id = pickString(user, ["id", "user_id", "userId"]);
  if (!id) return null;

  const avatarUrl = normalizeOptional(
    pickString(user, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url", "imageUrl"])
  );

  return {
    id,
    name: normalizeProfileName(user, "Unknown"),
    avatarUrl,
  };
}

function normalizeThreadMessage({
  item,
  viewerId,
  membersById,
  isGroup,
}: {
  item: unknown;
  viewerId?: string;
  membersById: Record<string, MemberPreview>;
  isGroup: boolean;
}): ThreadMessage | null {
  if (!isRecord(item)) return null;
  const node =
    (isRecord(item.message) ? item.message : null) ??
    (isRecord(item.item) ? item.item : null) ??
    item;

  const senderProfile =
    (isRecord(node.sender) ? node.sender : null) ??
    (isRecord(node.sender_user_profile) ? node.sender_user_profile : null) ??
    (isRecord(node.senderUserProfile) ? node.senderUserProfile : null) ??
    (isRecord(node.author) ? node.author : null) ??
    null;

  const senderId =
    pickString(node, ["sender_id", "senderId", "author_id", "authorId", "user_id", "userId"]) ??
    (senderProfile ? pickString(senderProfile, ["id", "user_id", "userId"]) : undefined);

  const createdAtValue = node.created_at ?? node.createdAt ?? node.sent_at ?? node.sentAt ?? node.timestamp;
  const createdAtMs = asDate(createdAtValue)?.getTime() ?? Date.now();

  const content = normalizeOptional(pickString(node, ["content", "text", "body", "message"])) ?? "";

  const rawId = pickString(node, ["id", "message_id", "messageId", "backend_id", "backendId"]);
  const stableId =
    rawId ??
    `${senderId ?? "unknown"}:${createdAtMs}:${content.slice(0, 18)}:${pickNumber(node, ["sequence", "index"]) ?? 0}`;

  const attachmentsRaw = Array.isArray(node.attachments) ? node.attachments : [];
  const attachments: MessageAttachment[] = [];
  for (let index = 0; index < attachmentsRaw.length; index += 1) {
    const entry = attachmentsRaw[index];
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const isUrl = /^https?:\/\//i.test(trimmed);
      attachments.push({
        id: `${stableId}:attachment:${index}`,
        key: isUrl ? undefined : trimmed,
        url: isUrl ? trimmed : undefined,
      });
      continue;
    }

    if (!isRecord(entry)) continue;
    const rawUrl = normalizeOptional(pickString(entry, ["url", "downloadUrl", "download_url", "cdn_url", "cdnUrl"]));
    const rawThumbnailUrl = normalizeOptional(
      pickString(entry, ["thumbnail_url", "thumbnailUrl", "thumb_url", "thumbUrl"])
    );
    const keyFromUrl = rawUrl && rawUrl.startsWith("dm/") ? rawUrl : undefined;
    const thumbnailKeyFromUrl = rawThumbnailUrl && rawThumbnailUrl.startsWith("dm/") ? rawThumbnailUrl : undefined;
    const key = normalizeOptional(pickString(entry, ["key", "media_key", "mediaKey"])) ?? keyFromUrl;
    const url = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;
    const thumbnailKey = normalizeOptional(pickString(entry, ["thumbnail_key", "thumbnailKey"])) ?? thumbnailKeyFromUrl;
    const thumbnailUrl = rawThumbnailUrl && /^https?:\/\//i.test(rawThumbnailUrl) ? rawThumbnailUrl : undefined;
    const mimeType = normalizeOptional(pickString(entry, ["mime_type", "mimeType", "content_type", "contentType"]));
    const attachmentTypeRaw = normalizeOptional(pickString(entry, ["type"]))?.toLowerCase();
    const type =
      attachmentTypeRaw === "video"
        ? "video"
        : attachmentTypeRaw === "image"
          ? "image"
          : mimeType?.startsWith("video/")
            ? "video"
            : mimeType?.startsWith("image/")
              ? "image"
              : undefined;
    const width = pickNumber(entry, ["width"]);
    const height = pickNumber(entry, ["height"]);
    const durationSeconds = pickNumber(entry, ["duration_seconds", "durationSeconds"]);
    const sizeBytes = pickNumber(entry, ["size_bytes", "sizeBytes"]);
    if (!key && !url && !thumbnailKey && !thumbnailUrl) continue;
    attachments.push({
      id: `${stableId}:attachment:${index}`,
      key: key ?? undefined,
      url: url ?? undefined,
      thumbnailKey: thumbnailKey ?? undefined,
      thumbnailUrl: thumbnailUrl ?? undefined,
      type,
      width: width && width > 0 ? width : undefined,
      height: height && height > 0 ? height : undefined,
      durationSeconds: durationSeconds && durationSeconds >= 0 ? durationSeconds : undefined,
      sizeBytes: sizeBytes && sizeBytes >= 0 ? sizeBytes : undefined,
      mimeType: mimeType ?? undefined,
    });
  }

  const memberPreview = senderId ? membersById[senderId] : undefined;
  const senderName =
    memberPreview?.name ??
    (senderProfile ? normalizeProfileName(senderProfile, "Unknown") : undefined) ??
    "Unknown";
  const senderAvatarUrl =
    memberPreview?.avatarUrl ??
    (senderProfile
      ? normalizeOptional(
          pickString(senderProfile, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url"])
        )
      : undefined);

  const isMine = viewerId ? senderId === viewerId : false;

  return {
    id: stableId,
    senderId,
    senderName: isGroup ? senderName : undefined,
    senderAvatarUrl: isGroup ? senderAvatarUrl : undefined,
    content,
    attachments,
    createdAtMs,
    isMine,
  };
}

function isAttachmentImage(attachment: MessageAttachment): boolean {
  if (attachment.type === "image") return true;
  if (attachment.mimeType?.startsWith("image/")) return true;
  if (attachment.url) return /\.(png|jpe?g|webp|heic|heif|bmp|svg)$/i.test(attachment.url);
  return false;
}

function isAttachmentVideo(attachment: MessageAttachment): boolean {
  if (attachment.type === "video") return true;
  if (attachment.mimeType?.startsWith("video/")) return true;
  if (attachment.url) return /\.(mp4|mov|m4v|webm)$/i.test(attachment.url);
  return false;
}

function mapAttachmentError(code?: string): string | undefined {
  if (!code) return undefined;
  if (code === "unsupported_content_type") return "Unsupported file type.";
  if (code === "size_exceeds_limit") return "File too large.";
  if (code === "message_media_bucket_not_configured") return "Media uploads are not available right now.";
  if (code === "invalid_attachments") return "Attachment payload is invalid.";
  return undefined;
}

type RenderedMessage = {
  message: ThreadMessage;
  showDaySeparator: boolean;
  startOfGroup: boolean;
  endOfGroup: boolean;
  showSenderLabel: boolean;
  showAvatar: boolean;
  gapAfterPx: number;
  isMediaOnly: boolean;
};

function areMessagesInSameGroup(current: ThreadMessage | undefined, next: ThreadMessage | undefined): boolean {
  if (!current || !next) return false;
  const sameSender = current.senderId && next.senderId && current.senderId === next.senderId;
  if (!sameSender) return false;
  if (dayKey(current.createdAtMs) !== dayKey(next.createdAtMs)) return false;
  return Math.abs(next.createdAtMs - current.createdAtMs) <= 30 * 60 * 1000;
}

function bubbleRadiusStyle(isMine: boolean, startOfGroup: boolean, endOfGroup: boolean): CSSProperties {
  if (isMine) {
    return {
      borderTopLeftRadius: 18,
      borderTopRightRadius: startOfGroup ? 18 : 8,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: endOfGroup ? 0 : 8,
    };
  }
  return {
    borderTopLeftRadius: startOfGroup ? 18 : 8,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: endOfGroup ? 0 : 8,
    borderBottomRightRadius: 18,
  };
}

export function AppMessageThreadPage({ threadType, threadId }: AppMessageThreadPageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [viewerId, setViewerId] = useState<string>();
  const [threadTitle, setThreadTitle] = useState(threadType === "channel" ? "Channel" : "Direct Message");
  const [threadAvatarUrl, setThreadAvatarUrl] = useState<string>();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blockState, setBlockState] = useState<BlockState>(null);

  const [composerText, setComposerText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMuteSaving, setIsMuteSaving] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewState | null>(null);

  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const resolvedMediaCacheRef = useRef<Record<string, { downloadUrl: string; mimeType?: string; expiresAtMs: number }>>({});
  const membersByIdRef = useRef<Record<string, MemberPreview>>({});
  const didScrollToBottomRef = useRef(false);
  const pollInFlightRef = useRef(false);

  const isGroup = threadType === "channel";

  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app/messages", { replace: true });
  }, [navigate]);

  const scrollToBottom = useCallback(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      window.scrollTo({ top: pageHeight, behavior: "auto" });
    });
  }, []);

  useEffect(() => {
    didScrollToBottomRef.current = false;
    setThreadAvatarUrl(undefined);
    membersByIdRef.current = {};
  }, [threadId, threadType]);

  const fetchThreadMessagesPage = useCallback(
    async (cursor?: string): Promise<CursorEnvelope<unknown>> => {
      if (threadType === "channel") {
        return fetchChannelMessages({ channelId: threadId, limit: 50, cursor });
      }
      return fetchConversationMessages({ conversationId: threadId, limit: 50, cursor });
    },
    [threadId, threadType]
  );

  const fetchLatestThreadWindow = useCallback(async (): Promise<{ items: unknown[]; nextCursor?: string }> => {
    const MAX_PAGES = 8;
    const MAX_ITEMS = 400;

    const firstPage = await fetchThreadMessagesPage();
    const firstItems = extractItemsArray(firstPage);
    const combinedItems = [...firstItems];

    let nextCursor = readNextCursor(firstPage);
    let pageCount = 1;
    while (nextCursor && pageCount < MAX_PAGES && combinedItems.length < MAX_ITEMS) {
      const page = await fetchThreadMessagesPage(nextCursor);
      const items = extractItemsArray(page);
      if (items.length === 0) break;
      combinedItems.push(...items);
      nextCursor = readNextCursor(page);
      pageCount += 1;
    }

    return { items: combinedItems, nextCursor };
  }, [fetchThreadMessagesPage]);

  const hydrateAttachmentUrls = useCallback(async (items: ThreadMessage[]): Promise<ThreadMessage[]> => {
    const now = Date.now();
    const cached = resolvedMediaCacheRef.current;
    const allKeys = Array.from(
      new Set(
        items.flatMap((message) =>
          message.attachments
            .flatMap((attachment) => [
              attachment.key && attachment.key.startsWith("dm/") ? attachment.key : undefined,
              attachment.thumbnailKey && attachment.thumbnailKey.startsWith("dm/") ? attachment.thumbnailKey : undefined,
            ])
            .filter((entry): entry is string => Boolean(entry))
        )
      )
    );

    if (allKeys.length === 0) return items;

    const unresolvedKeys = allKeys.filter((key) => {
      const hit = cached[key];
      return !hit || hit.expiresAtMs <= now + RESOLVE_CACHE_LEEWAY_MS;
    });

    try {
      if (unresolvedKeys.length > 0) {
        for (let index = 0; index < unresolvedKeys.length; index += 50) {
          const chunk = unresolvedKeys.slice(index, index + 50);
          const response = await resolveMessageMedia(chunk);
          const resolvedItems = extractItemsArray(response);
          for (const entry of resolvedItems) {
            if (!isRecord(entry)) continue;
            const key = normalizeOptional(pickString(entry, ["key", "media_key", "mediaKey"]));
            const url = normalizeOptional(pickString(entry, ["download_url", "downloadUrl", "url", "cdn_url", "cdnUrl"]));
            if (!key || !url) continue;
            const expiresInSeconds =
              pickNumber(entry, ["expires_in_seconds", "expiresInSeconds"]) ??
              300;
            const mimeType = normalizeOptional(pickString(entry, ["mime_type", "mimeType", "content_type", "contentType"]));
            cached[key] = {
              downloadUrl: url,
              mimeType: mimeType ?? undefined,
              expiresAtMs: Date.now() + Math.max(1, expiresInSeconds) * 1000,
            };
          }
        }
      }

      return items.map((message) => ({
        ...message,
        attachments: message.attachments.map((attachment) =>
          (() => {
            const keyHit = attachment.key ? cached[attachment.key] : undefined;
            const thumbnailHit = attachment.thumbnailKey ? cached[attachment.thumbnailKey] : undefined;
            return {
              ...attachment,
              url: attachment.url ?? keyHit?.downloadUrl,
              thumbnailUrl: attachment.thumbnailUrl ?? thumbnailHit?.downloadUrl,
              mimeType: attachment.mimeType ?? keyHit?.mimeType,
            };
          })()
        ),
      }));
    } catch {
      return items;
    }
  }, []);

  const normalizeMessages = useCallback(
    async (rawItems: unknown[], currentViewerId?: string, currentMembers?: Record<string, MemberPreview>) => {
      const normalized = rawItems
        .map((item) =>
          normalizeThreadMessage({
            item,
            viewerId: currentViewerId,
            membersById: currentMembers ?? membersByIdRef.current,
            isGroup,
          })
        )
        .filter((entry): entry is ThreadMessage => Boolean(entry));

      const hydrated = await hydrateAttachmentUrls(normalized);
      return hydrated.sort((left, right) => left.createdAtMs - right.createdAtMs);
    },
    [hydrateAttachmentUrls, isGroup]
  );

  const loadThreadMeta = useCallback(async () => {
    if (threadType === "channel") {
      const channelResponse = await fetchChannels({ limit: 50 });
      const channel = extractItemsArray(channelResponse).find((entry) => {
        if (!isRecord(entry)) return false;
        return pickString(entry, ["id", "channel_id", "channelId"]) === threadId;
      });
      if (isRecord(channel)) {
        const title = normalizeOptional(pickString(channel, ["name", "title", "display_name", "displayName"]));
        if (title) setThreadTitle(title);
        const avatar = normalizeOptional(
          pickString(channel, ["photo_url", "photoUrl", "image_url", "imageUrl", "profile_image_url", "profileImageUrl"])
        );
        setThreadAvatarUrl(avatar ?? undefined);
        setIsMuted(getBoolean(channel.muted) ?? false);
      }
      return;
    }

    const conversationResponse = await fetchConversations({ limit: 50 });
    const conversation = extractItemsArray(conversationResponse).find((entry) => {
      if (!isRecord(entry)) return false;
      return pickString(entry, ["id", "conversation_id", "conversationId"]) === threadId;
    });
    if (isRecord(conversation)) {
      const otherProfile =
        (isRecord(conversation.other_user_profile) ? conversation.other_user_profile : null) ??
        (isRecord(conversation.otherUserProfile) ? conversation.otherUserProfile : null) ??
        (isRecord(conversation.participant) ? conversation.participant : null) ??
        (isRecord(conversation.user) ? conversation.user : null);
      const title = otherProfile
        ? normalizeProfileName(otherProfile, "Direct Message")
        : normalizeOptional(pickString(conversation, ["name", "title", "other_user_display_name", "otherUserDisplayName"]));
      if (title) setThreadTitle(title);
      const avatar =
        otherProfile
          ? normalizeOptional(
              pickString(otherProfile, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url", "imageUrl"])
            )
          : normalizeOptional(pickString(conversation, ["other_user_profile_image_url", "otherUserProfileImageUrl"]));
      setThreadAvatarUrl(avatar ?? undefined);
      setIsMuted(getBoolean(conversation.muted) ?? false);
    }
  }, [threadId, threadType]);

  const loadChannelMembers = useCallback(async () => {
    if (threadType !== "channel") return {};
    const response = await fetchChannelMembers({ channelId: threadId, limit: 50 });
    const normalized = extractItemsArray(response)
      .map(normalizeMemberPreview)
      .filter((entry): entry is MemberPreview => Boolean(entry));
    const map: Record<string, MemberPreview> = {};
    for (const member of normalized) map[member.id] = member;
    membersByIdRef.current = map;
    return map;
  }, [threadId, threadType]);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setBlockState(null);

    try {
      const viewer = await fetchViewerState();
      const normalizedViewerId = normalizeViewerId(viewer);
      setViewerId(normalizedViewerId);

      const [membersResult] = await Promise.allSettled([loadChannelMembers(), loadThreadMeta()]);
      const memberMap =
        membersResult.status === "fulfilled" && membersResult.value && Object.keys(membersResult.value).length > 0
          ? membersResult.value
          : {};

      const page = await fetchLatestThreadWindow();
      const normalizedMessages = await normalizeMessages(
        page.items,
        normalizedViewerId,
        Object.keys(memberMap).length > 0 ? memberMap : undefined
      );

      const ids = new Set(normalizedMessages.map((message) => message.id));
      seenMessageIdsRef.current = ids;
      setMessages(normalizedMessages);
      setIsLoading(false);
    } catch (error) {
      const code = parseApiErrorCode(error);
      if (code === "message_request_pending") {
        setBlockState("pending");
      } else if (code === "message_request_rejected") {
        setBlockState("rejected");
      }
      setLoadError(parseApiErrorMessage(error));
      setIsLoading(false);
    }
  }, [fetchLatestThreadWindow, loadChannelMembers, loadThreadMeta, normalizeMessages]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const pollForMessages = useCallback(async () => {
    if (blockState) return;
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;

    try {
      const page = await fetchThreadMessagesPage();
      const normalizedMessages = await normalizeMessages(extractItemsArray(page), viewerId);
      if (normalizedMessages.length > 0) {
        setMessages((previous) => {
          const next = [...previous];
          for (const message of normalizedMessages) {
            if (seenMessageIdsRef.current.has(message.id)) continue;
            seenMessageIdsRef.current.add(message.id);
            next.push(message);
          }
          return next.sort((left, right) => left.createdAtMs - right.createdAtMs);
        });
      }
    } catch (error) {
      const code = parseApiErrorCode(error);
      if (code === "message_request_pending") {
        setBlockState("pending");
      } else if (code === "message_request_rejected") {
        setBlockState("rejected");
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [blockState, fetchThreadMessagesPage, normalizeMessages, viewerId]);

  useEffect(() => {
    if (isLoading || loadError || blockState) return;
    const timer = window.setInterval(() => {
      void pollForMessages();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [blockState, isLoading, loadError, pollForMessages]);

  const renderedMessages = useMemo(() => {
    const sorted = [...messages].sort((left, right) => left.createdAtMs - right.createdAtMs);
    return sorted.map<RenderedMessage>((message, index) => {
      const previous = sorted[index - 1];
      const next = sorted[index + 1];
      const previousSameGroup = areMessagesInSameGroup(previous as ThreadMessage, message);
      const nextSameGroup = areMessagesInSameGroup(message, next);
      const showDaySeparator = !previous || dayKey(previous.createdAtMs) !== dayKey(message.createdAtMs);

      let gapAfterPx = 0;
      if (next) {
        if (dayKey(message.createdAtMs) !== dayKey(next.createdAtMs)) {
          gapAfterPx = 0;
        } else if (message.senderId && next.senderId && message.senderId === next.senderId) {
          gapAfterPx = areMessagesInSameGroup(message, next) ? 1 : 14;
        } else {
          gapAfterPx = 8;
        }
      }

      const hasVisibleText = Boolean(message.content && message.content !== ZERO_WIDTH_SPACE);
      const isMediaOnly = message.attachments.length > 0 && !hasVisibleText;

      return {
        message,
        showDaySeparator,
        startOfGroup: !previousSameGroup,
        endOfGroup: !nextSameGroup,
        showSenderLabel: isGroup && !message.isMine && !previousSameGroup,
        showAvatar: isGroup && !message.isMine && !nextSameGroup,
        gapAfterPx,
        isMediaOnly,
      };
    });
  }, [isGroup, messages]);

  useEffect(() => {
    if (isLoading || loadError || renderedMessages.length === 0) return;
    if (didScrollToBottomRef.current) return;
    didScrollToBottomRef.current = true;
    scrollToBottom();
  }, [isLoading, loadError, renderedMessages.length, scrollToBottom]);

  const uploadSelectedFiles = useCallback(async () => {
    if (selectedFiles.length === 0) return [] as MessageAttachmentPayload[];

    const uploadedAttachments: MessageAttachmentPayload[] = [];
    for (const file of selectedFiles) {
      const presign = await presignMessageMedia({
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      const presignRecord = isRecord(presign) ? presign : {};
      const uploadUrl = normalizeOptional(
        pickString(presignRecord, ["uploadUrl", "upload_url", "url", "presignedUrl"])
      );
      const key = normalizeOptional(pickString(presignRecord, ["key", "media_key", "mediaKey"]));
      if (!uploadUrl || !key) throw new Error("Unable to upload attachment.");
      if (!key.startsWith("dm/")) throw new Error("Attachment key was invalid.");

      const method = normalizeOptional(getString(presignRecord.method)) ?? "PUT";
      const headersRaw = isRecord(presignRecord.headers) ? presignRecord.headers : {};
      const uploadHeaders: Record<string, string> = {};
      for (const [headerName, headerValue] of Object.entries(headersRaw)) {
        const normalizedHeader = normalizeOptional(headerValue);
        if (normalizedHeader) uploadHeaders[headerName] = normalizedHeader;
      }
      if (!uploadHeaders["Content-Type"] && !uploadHeaders["content-type"] && file.type) {
        uploadHeaders["Content-Type"] = file.type;
      }

      const uploadResponse = await fetch(uploadUrl, {
        method,
        headers: uploadHeaders,
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("Attachment upload failed.");

      const isVideo = file.type.startsWith("video/");
      let width: number | undefined;
      let height: number | undefined;
      let durationSeconds: number | undefined;

      try {
        const objectUrl = URL.createObjectURL(file);
        if (isVideo) {
          const video = document.createElement("video");
          video.preload = "metadata";
          const metadata = await new Promise<{ width?: number; height?: number; durationSeconds?: number }>((resolve) => {
            const cleanup = () => {
              URL.revokeObjectURL(objectUrl);
              video.removeAttribute("src");
              video.load();
            };
            video.onloadedmetadata = () => {
              resolve({
                width: Number.isFinite(video.videoWidth) ? video.videoWidth : undefined,
                height: Number.isFinite(video.videoHeight) ? video.videoHeight : undefined,
                durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
              });
              cleanup();
            };
            video.onerror = () => {
              resolve({});
              cleanup();
            };
            video.src = objectUrl;
          });
          width = metadata.width;
          height = metadata.height;
          durationSeconds = metadata.durationSeconds;
        } else {
          const image = new Image();
          const metadata = await new Promise<{ width?: number; height?: number }>((resolve) => {
            image.onload = () => {
              resolve({
                width: Number.isFinite(image.naturalWidth) ? image.naturalWidth : undefined,
                height: Number.isFinite(image.naturalHeight) ? image.naturalHeight : undefined,
              });
              URL.revokeObjectURL(objectUrl);
            };
            image.onerror = () => {
              resolve({});
              URL.revokeObjectURL(objectUrl);
            };
            image.src = objectUrl;
          });
          width = metadata.width;
          height = metadata.height;
        }
      } catch {
        // Metadata is optional for backend payload.
      }

      uploadedAttachments.push({
        url: key,
        type: isVideo ? "video" : "image",
        width,
        height,
        size_bytes: Number.isFinite(file.size) ? file.size : null,
        duration_seconds: isVideo ? durationSeconds ?? null : null,
        thumbnail_url: null,
      });
    }
    return uploadedAttachments;
  }, [selectedFiles]);

  const handleSend = useCallback(async () => {
    if (isSending || blockState) return;

    const trimmed = composerText.trim();
    if (!trimmed && selectedFiles.length === 0) return;

    setIsSending(true);
    try {
      const attachments = await uploadSelectedFiles();
      const content = trimmed || (attachments.length > 0 ? ZERO_WIDTH_SPACE : "");
      if (!content) {
        setIsSending(false);
        return;
      }

      const payload =
        threadType === "channel"
          ? await sendChannelMessage({ channelId: threadId, content, attachments })
          : await sendConversationMessage({ conversationId: threadId, content, attachments });

      const normalized = await normalizeMessages([payload], viewerId);
      if (normalized.length > 0) {
        setMessages((previous) => {
          const next = [...previous];
          for (const message of normalized) {
            if (seenMessageIdsRef.current.has(message.id)) continue;
            seenMessageIdsRef.current.add(message.id);
            next.push(message);
          }
          return next.sort((left, right) => left.createdAtMs - right.createdAtMs);
        });
      } else {
        void pollForMessages();
      }

      setComposerText("");
      setSelectedFiles([]);
      scrollToBottom();
    } catch (error) {
      const code = parseApiErrorCode(error);
      if (code === "message_request_pending") setBlockState("pending");
      if (code === "message_request_rejected") setBlockState("rejected");

      showToast({
        kind: "error",
        title: "Couldn’t send message",
        text:
          mapAttachmentError(code) ??
          (code === "anonymous_not_allowed"
            ? "Messaging is unavailable in anonymous mode."
            : code === "user_not_provisioned"
              ? "Messaging is not ready for this account."
              : parseApiErrorMessage(error)),
      });
    } finally {
      setIsSending(false);
    }
  }, [
    blockState,
    composerText,
    isSending,
    normalizeMessages,
    pollForMessages,
    selectedFiles,
    showToast,
    threadId,
    threadType,
    uploadSelectedFiles,
    viewerId,
    scrollToBottom,
  ]);

  const handleToggleMuted = useCallback(async () => {
    if (isMuteSaving) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setIsMuteSaving(true);
    try {
      if (threadType === "channel") {
        await setChannelMuted(threadId, nextMuted);
      } else {
        await setConversationMuted(threadId, nextMuted);
      }
    } catch (error) {
      setIsMuted(!nextMuted);
      showToast({
        kind: "error",
        title: "Couldn’t update notifications",
        text: parseApiErrorMessage(error),
      });
    } finally {
      setIsMuteSaving(false);
    }
  }, [isMuted, isMuteSaving, showToast, threadId, threadType]);

  const handleSelectFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (picked.length === 0) return;

      const hasGif = picked.some((file) => file.type === "image/gif" || /\.gif$/i.test(file.name));
      if (hasGif) {
        showToast({ kind: "error", title: "Unsupported attachment", text: "GIF files are not supported." });
        return;
      }

      const imageFiles = picked.filter((file) => file.type.startsWith("image/"));
      const videoFiles = picked.filter((file) => file.type.startsWith("video/"));
      const unsupported = picked.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"));
      if (unsupported) {
        showToast({ kind: "error", title: "Unsupported attachment", text: "Only images or one video are supported." });
        return;
      }

      if (videoFiles.length > 1 || (videoFiles.length === 1 && picked.length > 1)) {
        showToast({
          kind: "error",
          title: "Attachment limit",
          text: "You can attach up to 4 images or 1 video.",
        });
        return;
      }

      if (imageFiles.length > MAX_IMAGE_ATTACHMENTS) {
        showToast({
          kind: "error",
          title: "Attachment limit",
          text: "You can attach up to 4 images.",
        });
        return;
      }

      setSelectedFiles(picked);
    },
    [showToast]
  );

  const blockBannerText =
    blockState === "pending"
      ? "Request pending. You can’t send messages yet."
      : blockState === "rejected"
        ? "Request rejected. Messaging is unavailable for this thread."
        : null;
  const hasDraft = composerText.trim().length > 0 || selectedFiles.length > 0;
  const closeMediaPreview = useCallback(() => setMediaPreview(null), []);

  return (
    <AppLayout activeNavId="messages">
      <AppMobileHeader title="Messages" showBack showAction={false} backHref="/app/messages" />

      <div className="flex min-h-[calc(100dvh-56px)] flex-col lg:min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={handleBackNavigation}
          className="mb-3 hidden items-center gap-1 text-sm font-semibold text-text-secondary transition hover:text-strong lg:inline-flex"
        >
          <BackIcon className="h-4 w-4" />
          <span>Back to messages</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-muted">
            <img
              src={threadAvatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={handleProfileImageError}
            />
          </div>
          <h1 className="truncate text-xl font-semibold text-strong">{threadTitle}</h1>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">{isGroup ? "Group thread" : "Direct message"}</p>
          <button
            type="button"
            onClick={() => void handleToggleMuted()}
            disabled={isMuteSaving}
            className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMuteSaving ? "Saving..." : isMuted ? "Unmute notifications" : "Mute notifications"}
          </button>
        </div>
      </header>

      <section className="flex-1 bg-bg px-3 pb-5 pt-3 sm:px-5">
        {blockBannerText ? (
          <div className="mb-3 rounded-xl border border-border/70 bg-bg-muted px-3 py-2 text-sm font-medium text-text-secondary">
            {blockBannerText}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-bg-muted" />
            <div className="h-12 w-1/2 animate-pulse rounded-2xl bg-bg-muted" />
            <div className="ml-auto h-12 w-1/3 animate-pulse rounded-2xl bg-bg-muted" />
          </div>
        ) : null}

        {loadError ? (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-bg p-4">
            <p className="text-sm font-semibold text-strong">Unable to load this thread.</p>
            <p className="text-sm text-text-secondary">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadInitial()}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && renderedMessages.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-secondary">No messages yet.</div>
        ) : null}

        {!isLoading && !loadError ? (
          <div className="space-y-1">
            {renderedMessages.map(
              ({
                message,
                showDaySeparator,
                startOfGroup,
                endOfGroup,
                showSenderLabel,
                showAvatar,
                gapAfterPx,
                isMediaOnly,
              }) => (
              <div key={message.id} style={{ marginBottom: `${gapAfterPx}px` }}>
                {showDaySeparator ? (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full border border-border/70 bg-bg px-3 py-1 text-xs font-medium text-text-light">
                      {formatDayLabel(message.createdAtMs)}
                    </span>
                  </div>
                ) : null}

                <div className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}>
                  {!message.isMine && isGroup ? (
                    <div className="mr-2 flex w-8 shrink-0 items-end">
                      {showAvatar ? (
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-[11px] font-semibold text-text-secondary">
                          <img
                            src={message.senderAvatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={handleProfileImageError}
                          />
                        </div>
                      ) : (
                        <div className="h-8 w-8" aria-hidden="true" />
                      )}
                    </div>
                  ) : null}

                  <div className={`max-w-[min(420px,72vw)] ${message.isMine ? "items-end" : "items-start"} flex flex-col`}>
                    {showSenderLabel ? (
                      <span className="mb-1 px-1 text-[12px] font-medium text-text-secondary">{message.senderName ?? "Unknown"}</span>
                    ) : null}

                    <div
                      className="px-3 py-2.5"
                      style={{
                        ...bubbleRadiusStyle(message.isMine, startOfGroup, endOfGroup),
                        backgroundColor: message.isMine ? "var(--color-message)" : "var(--color-thread-bubble-them)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {message.content && message.content !== ZERO_WIDTH_SPACE ? (
                        <p className="whitespace-pre-wrap text-[16px] leading-[1.35] font-normal">{message.content}</p>
                      ) : null}

                      {message.attachments.length > 0 ? (
                        <div className={`space-y-2 ${message.content && message.content !== ZERO_WIDTH_SPACE ? "mt-2" : ""}`}>
                          {message.attachments.map((attachment, attachmentIndex) => {
                            const showMediaTimestamp =
                              isMediaOnly && attachmentIndex === message.attachments.length - 1;
                            if (!attachment.url) {
                              return (
                                <div key={attachment.id} className="text-[12px] opacity-80">
                                  Attachment unavailable
                                </div>
                              );
                            }

                            if (isAttachmentImage(attachment)) {
                              return (
                                <button
                                  key={attachment.id}
                                  type="button"
                                  className="relative h-[220px] w-[220px] overflow-hidden rounded-xl"
                                  onClick={() =>
                                    setMediaPreview({
                                      kind: "image",
                                      src: attachment.url as string,
                                    })
                                  }
                                  aria-label="Open image preview"
                                >
                                  <img
                                    src={attachment.url}
                                    alt="Message attachment"
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                  {showMediaTimestamp ? (
                                    <span
                                      className="absolute bottom-2 right-2 rounded-[8px] px-2 py-0.5 text-[12px] font-medium text-white"
                                      style={{ backgroundColor: "var(--color-thread-media-time)" }}
                                    >
                                      {formatMessageTime(message.createdAtMs)}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            }

                            if (isAttachmentVideo(attachment)) {
                              return (
                                <button
                                  key={attachment.id}
                                  type="button"
                                  className="relative h-[220px] w-[220px] overflow-hidden rounded-xl"
                                  onClick={() =>
                                    setMediaPreview({
                                      kind: "video",
                                      src: attachment.url as string,
                                      poster: attachment.thumbnailUrl ?? attachment.url,
                                    })
                                  }
                                  aria-label="Open video preview"
                                >
                                  <img
                                    src={attachment.thumbnailUrl ?? attachment.url}
                                    alt="Video attachment preview"
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                  <div
                                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                                    style={{ backgroundColor: "var(--color-thread-video-overlay)" }}
                                  >
                                    <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-black/65 text-white">
                                      <PlayIcon className="h-6 w-6" />
                                    </div>
                                  </div>
                                  {showMediaTimestamp ? (
                                    <span
                                      className="absolute bottom-2 right-2 rounded-[8px] px-2 py-0.5 text-[12px] font-medium text-white"
                                      style={{ backgroundColor: "var(--color-thread-media-time)" }}
                                    >
                                      {formatMessageTime(message.createdAtMs)}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            }

                            return (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-[12px] font-medium underline text-brand"
                              >
                                Open attachment
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    {!isMediaOnly ? (
                      <span className="mt-1 px-1 text-[12px] font-medium text-text-secondary">
                        {formatMessageTime(message.createdAtMs)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {mediaPreview ? (
        <div className="fixed inset-0 z-50 bg-black/80 p-3" onClick={closeMediaPreview}>
          <div className="mx-auto flex h-full w-full max-w-[900px] flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeMediaPreview}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
                aria-label="Close media preview"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
              {mediaPreview.kind === "video" ? (
                <video
                  className="max-h-full max-w-full rounded-xl object-contain"
                  src={mediaPreview.src}
                  poster={mediaPreview.poster ?? mediaPreview.src}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={mediaPreview.src}
                  alt="Message media preview"
                  className="max-h-full max-w-full rounded-xl object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <footer className="sticky bottom-0 mt-auto border-t border-border/70 bg-bg px-4 pb-4 pt-3 sm:px-4">
        {selectedFiles.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((file) => (
              <div key={`${file.name}-${file.size}`} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-bg-muted px-3 py-1 text-xs text-text-secondary">
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles((previous) => previous.filter((item) => item !== file))}
                  className="text-text-light transition hover:text-strong"
                  aria-label={`Remove ${file.name}`}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-[24px] bg-bg-muted px-4 py-2.5">
          <label className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand transition hover:text-brand-hover">
            <ImageIcon className="h-5 w-5" />
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleSelectFiles}
              disabled={Boolean(blockState) || isSending}
            />
          </label>
          <textarea
            value={composerText}
            onChange={(event) => setComposerText(event.target.value)}
            className="min-h-8 max-h-32 w-full resize-none bg-transparent px-0 py-0 text-[16px] font-normal text-strong placeholder:text-text-light focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
            placeholder={blockState ? "Messaging unavailable for this thread." : "Type a message"}
            disabled={Boolean(blockState) || isSending}
            rows={1}
          />
          {hasDraft ? (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={Boolean(blockState) || isSending}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Send message"
            >
              <ArrowUpIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </footer>
      </div>
    </AppLayout>
  );
}
