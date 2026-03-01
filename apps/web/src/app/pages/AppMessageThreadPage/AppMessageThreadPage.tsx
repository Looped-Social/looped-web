import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { CameraIcon } from "@/app/components/AppIcons/AppIcons";
import { AvatarCropModal } from "@/app/components/AvatarCropModal/AvatarCropModal";
import { useToast } from "@/app/components/AppToast/AppToast";
import {
  addChannelMembers,
  deleteChannel,
  fetchChannelMembers,
  fetchChannelMessages,
  fetchChannels,
  fetchConversationMessages,
  fetchConversations,
  fetchViewerState,
  MessagingApiError,
  patchChannel,
  type MessageAttachmentPayload,
  presignMessageMedia,
  removeChannelMember,
  resolveMessageMedia,
  searchUsersForMessages,
  setChannelMuted,
  setConversationMuted,
  sendChannelMessage,
  sendConversationMessage,
  type CursorEnvelope,
} from "@/lib/messagingApi";
import { uploadProfilePhoto } from "@/lib/profileEditApi";
import { blockUser } from "@/lib/userApi";

type ThreadType = "conversation" | "channel";
type BlockState = "pending" | "rejected" | null;

type MemberPreview = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type ChannelMember = {
  userId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  canManageMembers: boolean;
  isOwner: boolean;
};

type UserSearchRow = {
  userId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
};

type ConversationMeta = {
  otherUserId?: string;
  otherUserHandle?: string;
};

type ChannelMeta = {
  ownerUserId?: string;
  viewerCanManageMembers: boolean;
  memberCount: number;
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

const POLL_INTERVAL_MS = 2_500;
const MAX_IMAGE_ATTACHMENTS = 4;
const ZERO_WIDTH_SPACE = "\u200B";
const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";
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

function normalizeChannelMember(item: unknown): ChannelMember | null {
  if (!isRecord(item)) return null;
  const profile =
    (isRecord(item.user_profile) ? item.user_profile : null) ??
    (isRecord(item.userProfile) ? item.userProfile : null) ??
    (isRecord(item.user) ? item.user : null) ??
    item;
  const userId = pickString(item, ["user_id", "userId"]) ?? pickString(profile, ["id", "user_id", "userId"]);
  if (!userId) return null;

  const handle = normalizeOptional(pickString(profile, ["handle", "username"]));
  const displayName = normalizeProfileName(profile, handle ? `@${handle.replace(/^@/, "")}` : "Looped User");
  const avatarUrl = normalizeOptional(
    pickString(profile, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url", "imageUrl"])
  );

  return {
    userId,
    displayName,
    handle: handle ? handle.replace(/^@/, "") : undefined,
    avatarUrl: avatarUrl ?? undefined,
    canManageMembers: getBoolean(item.can_manage_members ?? item.canManageMembers) ?? false,
    isOwner: getBoolean(item.is_owner ?? item.isOwner) ?? false,
  };
}

function normalizeUserSearchRow(item: unknown): UserSearchRow | null {
  if (!isRecord(item)) return null;
  const userId = pickString(item, ["id", "user_id", "userId"]);
  if (!userId) return null;

  const handle = normalizeOptional(pickString(item, ["handle", "username"]));
  const firstName = normalizeOptional(pickString(item, ["first_name", "firstName"]));
  const lastName = normalizeOptional(pickString(item, ["last_name", "lastName"]));
  const fullName = [firstName, lastName].filter((entry): entry is string => Boolean(entry)).join(" ").trim();
  const displayName =
    fullName ||
    normalizeOptional(pickString(item, ["display_name", "displayName", "name"])) ||
    (handle ? `@${handle.replace(/^@/, "")}` : "Looped User");
  const avatarUrl = normalizeOptional(
    pickString(item, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url", "imageUrl"])
  );

  return {
    userId,
    displayName,
    handle: handle ? handle.replace(/^@/, "") : undefined,
    avatarUrl: avatarUrl ?? undefined,
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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isBlockPromptOpen, setIsBlockPromptOpen] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);

  const [conversationMeta, setConversationMeta] = useState<ConversationMeta>({});
  const [channelMeta, setChannelMeta] = useState<ChannelMeta>({
    viewerCanManageMembers: false,
    memberCount: 0,
  });
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [channelMembersNextCursor, setChannelMembersNextCursor] = useState<string>();
  const [isMembersLoadingMore, setIsMembersLoadingMore] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string>();
  const [isGroupNameSaving, setIsGroupNameSaving] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [isGroupPhotoSaving, setIsGroupPhotoSaving] = useState(false);
  const [groupPhotoCropSourceUrl, setGroupPhotoCropSourceUrl] = useState<string | null>(null);
  const [isApplyingGroupPhotoCrop, setIsApplyingGroupPhotoCrop] = useState(false);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [addMembersQuery, setAddMembersQuery] = useState("");
  const [addMembersResults, setAddMembersResults] = useState<UserSearchRow[]>([]);
  const [addMembersNextCursor, setAddMembersNextCursor] = useState<string>();
  const [isAddMembersSearching, setIsAddMembersSearching] = useState(false);
  const [isAddMembersLoadingMore, setIsAddMembersLoadingMore] = useState(false);
  const [selectedAddMemberIds, setSelectedAddMemberIds] = useState<string[]>([]);
  const [isAddMembersSubmitting, setIsAddMembersSubmitting] = useState(false);
  const [isDangerActionLoading, setIsDangerActionLoading] = useState(false);

  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const resolvedMediaCacheRef = useRef<Record<string, { downloadUrl: string; mimeType?: string; expiresAtMs: number }>>({});
  const membersByIdRef = useRef<Record<string, MemberPreview>>({});
  const didScrollToBottomRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const pollAbortControllerRef = useRef<AbortController | null>(null);
  const nextCursorRef = useRef<string | undefined>(undefined);
  const addMembersSearchTimeoutRef = useRef<number | undefined>(undefined);

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
    pollInFlightRef.current = false;
    pollAbortControllerRef.current?.abort();
    pollAbortControllerRef.current = null;
    nextCursorRef.current = undefined;
    setThreadAvatarUrl(undefined);
    membersByIdRef.current = {};
    setIsDetailsOpen(false);
    setIsBlockPromptOpen(false);
    setIsBlockingUser(false);
    setConversationMeta({});
    setChannelMeta({ viewerCanManageMembers: false, memberCount: 0 });
    setChannelMembers([]);
    setChannelMembersNextCursor(undefined);
    setIsMembersLoadingMore(false);
    setBusyMemberId(undefined);
    setGroupNameDraft("");
    setIsGroupNameSaving(false);
    setIsGroupPhotoSaving(false);
    setGroupPhotoCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setIsApplyingGroupPhotoCrop(false);
    setIsAddMembersOpen(false);
    setAddMembersQuery("");
    setAddMembersResults([]);
    setAddMembersNextCursor(undefined);
    setIsAddMembersSearching(false);
    setIsAddMembersLoadingMore(false);
    setSelectedAddMemberIds([]);
    setIsAddMembersSubmitting(false);
    setIsDangerActionLoading(false);
  }, [threadId, threadType]);

  useEffect(() => {
    return () => {
      pollAbortControllerRef.current?.abort();
      pollAbortControllerRef.current = null;
      if (addMembersSearchTimeoutRef.current) {
        window.clearTimeout(addMembersSearchTimeoutRef.current);
      }
      if (groupPhotoCropSourceUrl) {
        URL.revokeObjectURL(groupPhotoCropSourceUrl);
      }
    };
  }, [groupPhotoCropSourceUrl]);

  const fetchThreadMessagesPage = useCallback(
    async (cursor?: string, signal?: AbortSignal): Promise<CursorEnvelope<unknown>> => {
      if (threadType === "channel") {
        return fetchChannelMessages({ channelId: threadId, limit: 50, cursor, signal });
      }
      return fetchConversationMessages({ conversationId: threadId, limit: 50, cursor, signal });
    },
    [threadId, threadType]
  );

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
      const channelResponse = await fetchChannels({ limit: 100 });
      const channel = extractItemsArray(channelResponse).find((entry) => {
        if (!isRecord(entry)) return false;
        return pickString(entry, ["id", "channel_id", "channelId"]) === threadId;
      });
      if (isRecord(channel)) {
        const title = normalizeOptional(pickString(channel, ["name", "title", "display_name", "displayName"]));
        if (title) setThreadTitle(title);
        setGroupNameDraft(title ?? "");
        const avatar = normalizeOptional(
          pickString(channel, ["photo_url", "photoUrl", "image_url", "imageUrl", "profile_image_url", "profileImageUrl"])
        );
        setThreadAvatarUrl(avatar ?? undefined);
        const muted = getBoolean(channel.muted) ?? false;
        setIsMuted(muted);
        setChannelMeta({
          ownerUserId: pickString(channel, ["owner_user_id", "ownerUserId"]),
          viewerCanManageMembers: getBoolean(channel.viewer_can_manage_members ?? channel.viewerCanManageMembers) ?? false,
          memberCount: pickNumber(channel, ["member_count", "memberCount"]) ?? 0,
        });
      }
      return;
    }

    const conversationResponse = await fetchConversations({ limit: 100 });
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
      setConversationMeta({
        otherUserId:
          pickString(conversation, ["other_user_id", "otherUserId", "participant_user_id", "participantUserId"]) ??
          (otherProfile ? pickString(otherProfile, ["id", "user_id", "userId"]) : undefined),
        otherUserHandle:
          (otherProfile ? normalizeOptional(pickString(otherProfile, ["handle", "username"])) : undefined) ??
          normalizeOptional(pickString(conversation, ["other_user_handle", "otherUserHandle"])),
      });
    }
  }, [threadId, threadType]);

  const loadChannelMembers = useCallback(async () => {
    if (threadType !== "channel") return {};
    const response = await fetchChannelMembers({ channelId: threadId, limit: 50 });
    const items = extractItemsArray(response);
    const previewMembers = items.map(normalizeMemberPreview).filter((entry): entry is MemberPreview => Boolean(entry));
    const normalizedMembers = items.map(normalizeChannelMember).filter((entry): entry is ChannelMember => Boolean(entry));
    const map: Record<string, MemberPreview> = {};
    for (const member of previewMembers) map[member.id] = member;
    membersByIdRef.current = map;
    setChannelMembers(normalizedMembers);
    setChannelMembersNextCursor(readNextCursor(response));
    setChannelMeta((previous) => ({
      ...previous,
      memberCount: previous.memberCount || normalizedMembers.length,
    }));
    return map;
  }, [threadId, threadType]);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setBlockState(null);
    nextCursorRef.current = undefined;
    seenMessageIdsRef.current = new Set();

    try {
      const viewer = await fetchViewerState();
      const normalizedViewerId = normalizeViewerId(viewer);
      setViewerId(normalizedViewerId);

      const [membersResult] = await Promise.allSettled([loadChannelMembers(), loadThreadMeta()]);
      const memberMap =
        membersResult.status === "fulfilled" && membersResult.value && Object.keys(membersResult.value).length > 0
          ? membersResult.value
          : {};

      const page = await fetchThreadMessagesPage();
      const normalizedMessages = await normalizeMessages(
        extractItemsArray(page),
        normalizedViewerId,
        Object.keys(memberMap).length > 0 ? memberMap : undefined
      );

      const ids = new Set(normalizedMessages.map((message) => message.id));
      seenMessageIdsRef.current = ids;
      setMessages(normalizedMessages);
      nextCursorRef.current = readNextCursor(page);
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
    if (isLoading) return;
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    const controller = new AbortController();
    pollAbortControllerRef.current = controller;

    try {
      const page = await fetchThreadMessagesPage(nextCursorRef.current, controller.signal);
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
      const nextCursor = readNextCursor(page);
      if (nextCursor) {
        nextCursorRef.current = nextCursor;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const code = parseApiErrorCode(error);
      if (code === "message_request_pending") {
        setBlockState("pending");
      } else if (code === "message_request_rejected") {
        setBlockState("rejected");
      }
    } finally {
      if (pollAbortControllerRef.current === controller) {
        pollAbortControllerRef.current = null;
      }
      pollInFlightRef.current = false;
    }
  }, [blockState, fetchThreadMessagesPage, isLoading, normalizeMessages, viewerId]);

  useEffect(() => {
    if (isLoading || loadError || blockState) return;
    const timer = window.setInterval(() => {
      void pollForMessages();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      pollAbortControllerRef.current?.abort();
      pollAbortControllerRef.current = null;
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

      const nextCursor = readNextCursor(payload);
      if (nextCursor) {
        nextCursorRef.current = nextCursor;
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

  const handleComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey) return;
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      void handleSend();
    },
    [handleSend]
  );

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

  const upsertChannelMembers = useCallback((incoming: ChannelMember[], append: boolean) => {
    setChannelMembers((previous) => {
      const next = append ? [...previous] : [];
      const seen = new Set(next.map((member) => member.userId));
      for (const member of incoming) {
        if (seen.has(member.userId)) {
          const index = next.findIndex((entry) => entry.userId === member.userId);
          if (index >= 0) next[index] = member;
          continue;
        }
        seen.add(member.userId);
        next.push(member);
      }
      return next;
    });

    membersByIdRef.current = {
      ...membersByIdRef.current,
      ...Object.fromEntries(
        incoming.map((member) => [
          member.userId,
          {
            id: member.userId,
            name: member.displayName,
            avatarUrl: member.avatarUrl,
          } satisfies MemberPreview,
        ])
      ),
    };
  }, []);

  const loadMoreChannelMembers = useCallback(async () => {
    if (threadType !== "channel") return;
    if (!channelMembersNextCursor || isMembersLoadingMore) return;
    setIsMembersLoadingMore(true);
    try {
      const response = await fetchChannelMembers({
        channelId: threadId,
        limit: 50,
        cursor: channelMembersNextCursor,
      });
      const members = extractItemsArray(response)
        .map(normalizeChannelMember)
        .filter((entry): entry is ChannelMember => Boolean(entry));
      upsertChannelMembers(members, true);
      setChannelMembersNextCursor(readNextCursor(response));
      setChannelMeta((previous) => ({
        ...previous,
        memberCount: Math.max(previous.memberCount, channelMembers.length + members.length),
      }));
    } catch (error) {
      showToast({
        kind: "error",
        title: "Couldn’t load members",
        text: parseApiErrorMessage(error),
      });
    } finally {
      setIsMembersLoadingMore(false);
    }
  }, [channelMembers.length, channelMembersNextCursor, isMembersLoadingMore, showToast, threadId, threadType, upsertChannelMembers]);

  const closeDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setIsBlockPromptOpen(false);
    setIsAddMembersOpen(false);
    setSelectedAddMemberIds([]);
  }, []);

  const handleOpenDetails = useCallback(() => {
    if (threadType === "channel" && !groupNameDraft.trim()) {
      setGroupNameDraft(threadTitle);
    }
    setIsDetailsOpen(true);
  }, [groupNameDraft, threadTitle, threadType]);

  const handleSaveGroupName = useCallback(async () => {
    if (threadType !== "channel") return;
    if (!channelMeta.viewerCanManageMembers || isGroupNameSaving) return;
    const normalizedName = groupNameDraft.trim();
    if (!normalizedName) {
      showToast({
        kind: "error",
        title: "Invalid name",
        text: "Group name cannot be empty.",
      });
      return;
    }
    if (normalizedName === threadTitle) return;

    setIsGroupNameSaving(true);
    try {
      await patchChannel(threadId, { name: normalizedName });
      setThreadTitle(normalizedName);
      showToast({
        kind: "success",
        title: "Group updated",
        text: "Group name was saved.",
      });
    } catch (error) {
      showToast({
        kind: "error",
        title: "Couldn’t update group",
        text: parseApiErrorMessage(error),
      });
    } finally {
      setIsGroupNameSaving(false);
    }
  }, [channelMeta.viewerCanManageMembers, groupNameDraft, isGroupNameSaving, showToast, threadId, threadTitle, threadType]);

  const handleSelectGroupPhoto = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (threadType !== "channel" || !channelMeta.viewerCanManageMembers) return;
      if (!file.type.startsWith("image/")) {
        showToast({
          kind: "error",
          title: "Unsupported file",
          text: "Please choose an image for group photo.",
        });
        return;
      }
      if (isGroupPhotoSaving || isApplyingGroupPhotoCrop) return;
      setGroupPhotoCropSourceUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
    },
    [channelMeta.viewerCanManageMembers, isApplyingGroupPhotoCrop, isGroupPhotoSaving, showToast, threadType]
  );

  const handleCancelGroupPhotoCrop = useCallback(() => {
    if (isGroupPhotoSaving || isApplyingGroupPhotoCrop) return;
    setGroupPhotoCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }, [isApplyingGroupPhotoCrop, isGroupPhotoSaving]);

  const handleApplyGroupPhotoCrop = useCallback(
    async (file: File, previewUrl: string) => {
      setIsApplyingGroupPhotoCrop(true);
      setIsGroupPhotoSaving(true);
      try {
        const mediaAssetId = await uploadProfilePhoto(file);
        await patchChannel(threadId, { photoMediaAssetId: mediaAssetId });
        setThreadAvatarUrl(previewUrl);
        setGroupPhotoCropSourceUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
        showToast({
          kind: "success",
          title: "Group photo updated",
        });
      } catch (error) {
        URL.revokeObjectURL(previewUrl);
        showToast({
          kind: "error",
          title: "Couldn’t update photo",
          text: parseApiErrorMessage(error),
        });
      } finally {
        setIsApplyingGroupPhotoCrop(false);
        setIsGroupPhotoSaving(false);
      }
    },
    [showToast, threadId]
  );

  const handleRemoveGroupMember = useCallback(
    async (userId: string) => {
      if (threadType !== "channel") return;
      if (!channelMeta.viewerCanManageMembers || busyMemberId) return;
      setBusyMemberId(userId);
      try {
        await removeChannelMember(threadId, userId);
        setChannelMembers((previous) => previous.filter((member) => member.userId !== userId));
        setChannelMeta((previous) => ({
          ...previous,
          memberCount: Math.max(0, previous.memberCount - 1),
        }));
        showToast({
          kind: "success",
          title: "Member removed",
        });
      } catch (error) {
        showToast({
          kind: "error",
          title: "Couldn’t remove member",
          text: parseApiErrorMessage(error),
        });
      } finally {
        setBusyMemberId(undefined);
      }
    },
    [busyMemberId, channelMeta.viewerCanManageMembers, showToast, threadId, threadType]
  );

  const runAddMembersSearch = useCallback(
    async (query: string, cursor?: string) => {
      if (query.trim().length < 2) {
        setAddMembersResults([]);
        setAddMembersNextCursor(undefined);
        return;
      }

      if (cursor) {
        setIsAddMembersLoadingMore(true);
      } else {
        setIsAddMembersSearching(true);
      }

      try {
        const response = await searchUsersForMessages({ query, limit: 20, cursor });
        const items = extractItemsArray(response)
          .map(normalizeUserSearchRow)
          .filter((entry): entry is UserSearchRow => Boolean(entry));
        const memberIds = new Set(channelMembers.map((member) => member.userId));
        const filtered = items.filter((item) => !memberIds.has(item.userId));

        if (cursor) {
          setAddMembersResults((previous) => {
            const next = [...previous];
            const seen = new Set(next.map((entry) => entry.userId));
            for (const item of filtered) {
              if (seen.has(item.userId)) continue;
              seen.add(item.userId);
              next.push(item);
            }
            return next;
          });
        } else {
          setAddMembersResults(filtered);
        }

        setAddMembersNextCursor(readNextCursor(response));
      } catch (error) {
        showToast({
          kind: "error",
          title: "Couldn’t search people",
          text: parseApiErrorMessage(error),
        });
      } finally {
        setIsAddMembersSearching(false);
        setIsAddMembersLoadingMore(false);
      }
    },
    [channelMembers, showToast]
  );

  useEffect(() => {
    if (!isAddMembersOpen) return;
    if (addMembersSearchTimeoutRef.current) window.clearTimeout(addMembersSearchTimeoutRef.current);
    const query = addMembersQuery.trim();
    addMembersSearchTimeoutRef.current = window.setTimeout(() => {
      void runAddMembersSearch(query);
    }, 300);
    return () => {
      if (addMembersSearchTimeoutRef.current) {
        window.clearTimeout(addMembersSearchTimeoutRef.current);
      }
    };
  }, [addMembersQuery, isAddMembersOpen, runAddMembersSearch]);

  const handleToggleAddMemberSelection = useCallback((userId: string) => {
    setSelectedAddMemberIds((previous) =>
      previous.includes(userId) ? previous.filter((value) => value !== userId) : [...previous, userId]
    );
  }, []);

  const handleSubmitAddMembers = useCallback(async () => {
    if (threadType !== "channel") return;
    if (selectedAddMemberIds.length === 0 || isAddMembersSubmitting) return;
    setIsAddMembersSubmitting(true);
    try {
      await addChannelMembers(threadId, selectedAddMemberIds);
      const selected = addMembersResults
        .filter((row) => selectedAddMemberIds.includes(row.userId))
        .map<ChannelMember>((row) => ({
          userId: row.userId,
          displayName: row.displayName,
          handle: row.handle,
          avatarUrl: row.avatarUrl,
          canManageMembers: false,
          isOwner: false,
        }));
      upsertChannelMembers(selected, true);
      setChannelMeta((previous) => ({
        ...previous,
        memberCount: previous.memberCount + selected.length,
      }));
      setSelectedAddMemberIds([]);
      setIsAddMembersOpen(false);
      showToast({
        kind: "success",
        title: selected.length === 1 ? "Member added" : "Members added",
      });
    } catch (error) {
      showToast({
        kind: "error",
        title: "Couldn’t add members",
        text: parseApiErrorMessage(error),
      });
    } finally {
      setIsAddMembersSubmitting(false);
    }
  }, [addMembersResults, isAddMembersSubmitting, selectedAddMemberIds, showToast, threadId, threadType, upsertChannelMembers]);

  const closeThreadAfterDestructiveAction = useCallback(() => {
    closeDetails();
    navigate("/app/messages", { replace: true });
  }, [closeDetails, navigate]);

  const handleBlockDirectUser = useCallback(async () => {
    if (threadType !== "conversation") return;
    if (!conversationMeta.otherUserId || isBlockingUser) return;
    setIsBlockingUser(true);
    try {
      await blockUser(conversationMeta.otherUserId);
      showToast({
        kind: "success",
        title: "User blocked",
      });
      closeThreadAfterDestructiveAction();
    } catch (error) {
      showToast({
        kind: "error",
        title: "Couldn’t block user",
        text: parseApiErrorMessage(error),
      });
    } finally {
      setIsBlockingUser(false);
      setIsBlockPromptOpen(false);
    }
  }, [closeThreadAfterDestructiveAction, conversationMeta.otherUserId, isBlockingUser, showToast, threadType]);

  const handleDangerAction = useCallback(async () => {
    if (threadType !== "channel") return;
    if (isDangerActionLoading || !viewerId) return;
    setIsDangerActionLoading(true);
    const isOwner = channelMeta.ownerUserId
      ? viewerId === channelMeta.ownerUserId
      : channelMembers.some((member) => member.userId === viewerId && member.isOwner);
    try {
      if (isOwner) {
        await deleteChannel(threadId);
        showToast({
          kind: "success",
          title: "Group deleted",
        });
      } else {
        await removeChannelMember(threadId, viewerId);
        showToast({
          kind: "success",
          title: "Left group",
        });
      }
      closeThreadAfterDestructiveAction();
    } catch (error) {
      showToast({
        kind: "error",
        title: isOwner ? "Couldn’t delete group" : "Couldn’t leave group",
        text: parseApiErrorMessage(error),
      });
    } finally {
      setIsDangerActionLoading(false);
    }
  }, [channelMembers, channelMeta.ownerUserId, closeThreadAfterDestructiveAction, isDangerActionLoading, showToast, threadId, threadType, viewerId]);

  const handleOpenContactProfile = useCallback(() => {
    if (!conversationMeta.otherUserId) return;
    closeDetails();
    navigate(`/app/profile/${conversationMeta.otherUserId}`);
  }, [closeDetails, conversationMeta.otherUserId, navigate]);

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
  const directProfileHandleLabel = conversationMeta.otherUserHandle
    ? `@${conversationMeta.otherUserHandle.replace(/^@/, "")}`
    : "this user";
  const isGroupOwner = Boolean(
    viewerId &&
      (channelMeta.ownerUserId
        ? viewerId === channelMeta.ownerUserId
        : channelMembers.some((member) => member.userId === viewerId && member.isOwner))
  );
  const canManageMembers = threadType === "channel" && channelMeta.viewerCanManageMembers;
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
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={handleOpenDetails}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg text-left"
          aria-label="Open chat details"
        >
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
        </button>
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

      {isDetailsOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            onClick={closeDetails}
            className="absolute inset-0 bg-black/35"
            aria-label="Close chat details"
          />

          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border/70 bg-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <h2 className="text-lg font-semibold text-strong">{isGroup ? "Group Info" : "Contact Info"}</h2>
              <button
                type="button"
                onClick={closeDetails}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition hover:bg-bg-muted hover:text-strong"
                aria-label="Close details"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-visible rounded-full">
                  <span className="block h-14 w-14 overflow-hidden rounded-full bg-bg-muted">
                    <img
                      src={threadAvatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={handleProfileImageError}
                    />
                  </span>
                  {canManageMembers ? (
                    <label className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand text-white shadow-sm">
                      <CameraIcon className="h-[18px] w-[18px]" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleSelectGroupPhoto(event)}
                        disabled={isGroupPhotoSaving || isApplyingGroupPhotoCrop}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[1.15rem] font-semibold text-strong">{threadTitle}</p>
                  <p className="text-sm text-text-secondary">
                    {isGroup
                      ? `${channelMeta.memberCount || channelMembers.length} ${channelMeta.memberCount === 1 ? "member" : "members"}`
                      : "Direct message"}
                  </p>
                </div>
              </div>

              {!isGroup ? (
                <div className="mt-5 space-y-2">
                  {conversationMeta.otherUserId ? (
                    <button
                      type="button"
                      onClick={handleOpenContactProfile}
                      className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-3 text-left transition hover:bg-bg-muted"
                    >
                      <span className="text-sm font-semibold text-strong">View profile</span>
                      <span className="text-sm text-text-light">{">"}</span>
                    </button>
                  ) : null}

                  <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3">
                    <span className="text-sm font-semibold text-strong">Mute notifications</span>
                    <button
                      type="button"
                      onClick={() => void handleToggleMuted()}
                      disabled={isMuteSaving}
                      className="inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={isMuted ? "Unmute notifications" : "Mute notifications"}
                    >
                      <span
                        className={`relative inline-flex h-6 w-11 rounded-full transition ${
                          isMuted ? "bg-brand/80" : "bg-border"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                            isMuted ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsBlockPromptOpen(true)}
                    disabled={!conversationMeta.otherUserId || isBlockingUser}
                    className="w-full rounded-xl border border-red-200 px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Block User
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {canManageMembers ? (
                    <div className="rounded-xl border border-border/70 p-3">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-light">Group name</label>
                      <div className="flex gap-2">
                        <input
                          value={groupNameDraft}
                          onChange={(event) => setGroupNameDraft(event.target.value)}
                          className="h-10 flex-1 rounded-lg border border-border/70 bg-bg px-3 text-[15px] text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                          placeholder="Group name"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveGroupName()}
                          disabled={isGroupNameSaving}
                          className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isGroupNameSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-border/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-strong">Members</p>
                      {canManageMembers ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAddMembersQuery("");
                            setAddMembersResults([]);
                            setAddMembersNextCursor(undefined);
                            setSelectedAddMemberIds([]);
                            setIsAddMembersOpen(true);
                          }}
                          className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:text-strong"
                        >
                          Add members
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      {channelMembers.map((member) => {
                        const tags = [
                          member.isOwner ? "Owner" : undefined,
                          !member.isOwner && member.canManageMembers ? "Admin" : undefined,
                          viewerId && member.userId === viewerId ? "You" : undefined,
                        ].filter((entry): entry is string => Boolean(entry));
                        const canRemove =
                          canManageMembers &&
                          Boolean(viewerId) &&
                          member.userId !== viewerId &&
                          !member.isOwner;
                        return (
                          <div key={member.userId} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
                            <button
                              type="button"
                              onClick={() => {
                                closeDetails();
                                navigate(`/app/profile/${member.userId}`);
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                                <img
                                  src={member.avatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  onError={handleProfileImageError}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-strong">{member.displayName}</p>
                                <p className="truncate text-xs text-text-secondary">
                                  {member.handle ? `@${member.handle}` : ""}
                                  {tags.length > 0 ? `${member.handle ? " · " : ""}${tags.join(" · ")}` : ""}
                                </p>
                              </div>
                            </button>
                            {canRemove ? (
                              <button
                                type="button"
                                onClick={() => void handleRemoveGroupMember(member.userId)}
                                disabled={busyMemberId === member.userId}
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busyMemberId === member.userId ? "Removing..." : "Remove"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {channelMembersNextCursor ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => void loadMoreChannelMembers()}
                          disabled={isMembersLoadingMore}
                          className="w-full rounded-lg border border-border/70 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isMembersLoadingMore ? "Loading..." : "Load more members"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3">
                    <span className="text-sm font-semibold text-strong">Mute notifications</span>
                    <button
                      type="button"
                      onClick={() => void handleToggleMuted()}
                      disabled={isMuteSaving}
                      className="inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={isMuted ? "Unmute notifications" : "Mute notifications"}
                    >
                      <span
                        className={`relative inline-flex h-6 w-11 rounded-full transition ${
                          isMuted ? "bg-brand/80" : "bg-border"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                            isMuted ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDangerAction()}
                    disabled={isDangerActionLoading}
                    className="w-full rounded-xl border border-red-200 px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDangerActionLoading
                      ? isGroupOwner
                        ? "Deleting..."
                        : "Leaving..."
                      : isGroupOwner
                        ? "Delete Group"
                        : "Leave Group"}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {isDetailsOpen && isBlockPromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-border/70 bg-bg p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-strong">Block user?</h3>
            <p className="mt-2 text-sm text-text-secondary">
              You won&apos;t see posts from {directProfileHandleLabel} anymore.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleBlockDirectUser()}
                disabled={isBlockingUser}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBlockingUser ? "Blocking..." : "Block User"}
              </button>
              <button
                type="button"
                onClick={() => setIsBlockPromptOpen(false)}
                disabled={isBlockingUser}
                className="w-full rounded-xl border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDetailsOpen && isAddMembersOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-border/70 bg-bg p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-strong">Add Members</h3>
              <button
                type="button"
                onClick={() => setIsAddMembersOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition hover:bg-bg-muted hover:text-strong"
                aria-label="Close add members"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <input
              value={addMembersQuery}
              onChange={(event) => setAddMembersQuery(event.target.value)}
              placeholder="Search people"
              className="h-10 rounded-lg border border-border/70 bg-bg px-3 text-[15px] text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
            />

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {isAddMembersSearching ? <p className="text-sm text-text-secondary">Searching...</p> : null}
              {!isAddMembersSearching && addMembersQuery.trim().length >= 2 && addMembersResults.length === 0 ? (
                <p className="text-sm text-text-secondary">No people found.</p>
              ) : null}
              <div className="space-y-1">
                {addMembersResults.map((result) => {
                  const selected = selectedAddMemberIds.includes(result.userId);
                  return (
                    <button
                      key={result.userId}
                      type="button"
                      onClick={() => handleToggleAddMemberSelection(result.userId)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                        selected ? "border-brand/50 bg-brand/5" : "border-transparent hover:bg-bg-muted"
                      }`}
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                        <img
                          src={result.avatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={handleProfileImageError}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-strong">{result.displayName}</p>
                        {result.handle ? <p className="truncate text-xs text-text-secondary">@{result.handle}</p> : null}
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border ${
                          selected ? "border-brand bg-brand" : "border-border"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>

              {addMembersNextCursor && addMembersQuery.trim().length >= 2 ? (
                <button
                  type="button"
                  onClick={() => void runAddMembersSearch(addMembersQuery.trim(), addMembersNextCursor)}
                  disabled={isAddMembersLoadingMore}
                  className="mt-2 w-full rounded-lg border border-border/70 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAddMembersLoadingMore ? "Loading..." : "Load more"}
                </button>
              ) : null}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleSubmitAddMembers()}
                disabled={selectedAddMemberIds.length === 0 || isAddMembersSubmitting}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAddMembersSubmitting
                  ? "Adding..."
                  : selectedAddMemberIds.length > 0
                    ? `Add ${selectedAddMemberIds.length}`
                    : "Add members"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AvatarCropModal
        open={Boolean(groupPhotoCropSourceUrl)}
        imageSrc={groupPhotoCropSourceUrl}
        title="Adjust group photo"
        isApplying={isApplyingGroupPhotoCrop || isGroupPhotoSaving}
        onCancel={handleCancelGroupPhotoCrop}
        onApply={handleApplyGroupPhotoCrop}
      />

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
            onKeyDown={handleComposerKeyDown}
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
