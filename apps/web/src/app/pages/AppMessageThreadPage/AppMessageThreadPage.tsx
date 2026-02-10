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
  presignMessageMedia,
  resolveMessageMedia,
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

const POLL_INTERVAL_MS = 2_500;
const MAX_IMAGE_ATTACHMENTS = 4;
const ZERO_WIDTH_SPACE = "\u200B";
const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
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
    const key = normalizeOptional(pickString(entry, ["key", "media_key", "mediaKey"]));
    const url = normalizeOptional(pickString(entry, ["url", "downloadUrl", "download_url", "cdn_url", "cdnUrl"]));
    const mimeType = normalizeOptional(pickString(entry, ["mime_type", "mimeType", "content_type", "contentType"]));
    if (!key && !url) continue;
    attachments.push({
      id: `${stableId}:attachment:${index}`,
      key: key ?? undefined,
      url: url ?? undefined,
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
  if (attachment.mimeType?.startsWith("image/")) return true;
  if (attachment.url) return /\.(png|jpe?g|webp|heic|heif|bmp|svg)$/i.test(attachment.url);
  return false;
}

function isAttachmentVideo(attachment: MessageAttachment): boolean {
  if (attachment.mimeType?.startsWith("video/")) return true;
  if (attachment.url) return /\.(mp4|mov|m4v|webm)$/i.test(attachment.url);
  return false;
}

function mapAttachmentError(code?: string): string | undefined {
  if (!code) return undefined;
  if (code === "unsupported_content_type") return "Unsupported file type.";
  if (code === "size_exceeds_limit") return "File too large.";
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
  const [membersById, setMembersById] = useState<Record<string, MemberPreview>>({});
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blockState, setBlockState] = useState<BlockState>(null);

  const [composerText, setComposerText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const nextCursorRef = useRef<string | undefined>(undefined);

  const isGroup = threadType === "channel";

  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app/messages", { replace: true });
  }, [navigate]);

  const fetchThreadMessagesPage = useCallback(
    async (cursor?: string): Promise<CursorEnvelope<unknown>> => {
      if (threadType === "channel") {
        return fetchChannelMessages({ channelId: threadId, limit: 50, cursor });
      }
      return fetchConversationMessages({ conversationId: threadId, limit: 50, cursor });
    },
    [threadId, threadType]
  );

  const hydrateAttachmentUrls = useCallback(async (items: ThreadMessage[]): Promise<ThreadMessage[]> => {
    const unresolvedKeys = Array.from(
      new Set(
        items.flatMap((message) =>
          message.attachments
            .filter((attachment) => !attachment.url && attachment.key && attachment.key.startsWith("dm/"))
            .map((attachment) => attachment.key as string)
        )
      )
    );

    if (unresolvedKeys.length === 0) return items;

    try {
      const response = await resolveMessageMedia(unresolvedKeys);
      const resolvedItems = extractItemsArray(response);
      const downloadUrlByKey: Record<string, string> = {};
      for (const entry of resolvedItems) {
        if (!isRecord(entry)) continue;
        const key = normalizeOptional(pickString(entry, ["key", "media_key", "mediaKey"]));
        const url = normalizeOptional(pickString(entry, ["download_url", "downloadUrl", "url", "cdn_url", "cdnUrl"]));
        if (key && url) downloadUrlByKey[key] = url;
      }

      return items.map((message) => ({
        ...message,
        attachments: message.attachments.map((attachment) =>
          attachment.url || !attachment.key
            ? attachment
            : {
                ...attachment,
                url: downloadUrlByKey[attachment.key] ?? attachment.url,
              }
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
            membersById: currentMembers ?? membersById,
            isGroup,
          })
        )
        .filter((entry): entry is ThreadMessage => Boolean(entry));

      const hydrated = await hydrateAttachmentUrls(normalized);
      return hydrated.sort((left, right) => left.createdAtMs - right.createdAtMs);
    },
    [hydrateAttachmentUrls, isGroup, membersById]
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
    setMembersById(map);
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

      const [memberMap] = await Promise.all([loadChannelMembers(), loadThreadMeta()]);
      const page = await fetchThreadMessagesPage();
      const normalizedMessages = await normalizeMessages(
        extractItemsArray(page),
        normalizedViewerId,
        Object.keys(memberMap).length > 0 ? memberMap : undefined
      );

      const ids = new Set(normalizedMessages.map((message) => message.id));
      seenMessageIdsRef.current = ids;
      const cursor = readNextCursor(page);
      nextCursorRef.current = cursor;
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
  }, [fetchThreadMessagesPage, loadChannelMembers, loadThreadMeta, normalizeMessages]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const pollForMessages = useCallback(async () => {
    if (blockState) return;

    try {
      const page = await fetchThreadMessagesPage(nextCursorRef.current);
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
      const incomingCursor = readNextCursor(page);
      if (incomingCursor) {
        nextCursorRef.current = incomingCursor;
      }
    } catch (error) {
      const code = parseApiErrorCode(error);
      if (code === "message_request_pending") {
        setBlockState("pending");
      } else if (code === "message_request_rejected") {
        setBlockState("rejected");
      }
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

  const uploadSelectedFiles = useCallback(async () => {
    if (selectedFiles.length === 0) return [] as unknown[];

    const uploadedAttachments: unknown[] = [];
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

      uploadedAttachments.push({
        key,
        contentType: file.type || undefined,
        fileName: file.name,
        sizeBytes: file.size,
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
  ]);

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

  return (
    <AppLayout activeNavId="messages">
      <AppMobileHeader title="Messages" showBack showAction={false} backHref="/app/messages" />

      <header className="border-b border-border/70 bg-bg px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={handleBackNavigation}
          className="mb-3 hidden items-center gap-1 text-sm font-semibold text-text-secondary transition hover:text-strong lg:inline-flex"
        >
          <BackIcon className="h-4 w-4" />
          <span>Back to messages</span>
        </button>
        <h1 className="truncate text-xl font-semibold text-strong">{threadTitle}</h1>
        <p className="mt-1 text-sm text-text-secondary">{isGroup ? "Group thread" : "Direct message"}</p>
      </header>

      <section className="min-h-[56vh] bg-bg px-3 pb-5 pt-3 sm:px-5">
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
                                <div key={attachment.id} className="relative h-[220px] w-[220px] overflow-hidden rounded-xl">
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
                                </div>
                              );
                            }

                            if (isAttachmentVideo(attachment)) {
                              return (
                                <div key={attachment.id} className="relative h-[220px] w-[220px] overflow-hidden rounded-xl">
                                  <video className="h-full w-full object-cover" src={attachment.url} controls />
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
                                </div>
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

      <footer className="sticky bottom-0 border-t border-border/70 bg-bg px-4 pb-4 pt-3 sm:px-4">
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
          <label className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-secondary transition hover:text-strong">
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
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-light transition hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Send message"
            >
              <img src="/ios-icons/action-send.svg" alt="" className="h-5 w-5 object-contain" loading="lazy" />
            </button>
          ) : null}
        </div>
      </footer>
    </AppLayout>
  );
}
