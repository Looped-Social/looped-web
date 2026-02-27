import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { EntityText } from "@/app/components/EntityText/EntityText";
import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { CommentThreadRails } from "@/app/components/CommentThreadLines/CommentThreadLines";
import { PostMediaGrid } from "@/app/components/PostMediaGrid/PostMediaGrid";
import { useToast } from "@/app/components/AppToast/AppToast";
import { useEntityNavigation } from "@/app/hooks/useEntityNavigation";
import { resolveCommunityLabel, usePreferCommunityShortNames } from "@/lib/communityDisplayPreference";
import {
  CommentsApiError,
  createPostComment,
  fetchViewerInteractionState,
  fetchCommentReplies,
  fetchPostComments,
  fetchPostDetail,
  setCommentLiked,
} from "@/lib/commentsApi";
import { getCommunityPermissions, type CommunityPermissions } from "@/lib/communityPermissionsApi";
import { type ResolvedMediaAsset, resolveMediaAssets } from "@/lib/mediaApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll, type PostPoll } from "@/lib/postPoll";
import { PostActionsApiError, reportEntity } from "@/lib/postActionsApi";
import { useCurrentUserStore } from "@/stores/currentUserStore";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";
const REPORT_REASON_OPTIONS = [
  "Spam",
  "Bullying or Harassment",
  "Nudity or Pornography",
  "Hate Speech",
  "Self-harm or Suicide",
  "Violence or Gore",
  "Something Else",
] as const;

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

type AppPostCommentsPageProps = {
  postId: string;
  overlayMode?: boolean;
  onRequestClose?: () => void;
};

type PostSummary = {
  id: string;
  communityId?: string;
  communityName?: string;
  communityKind?: string;
  communityHref?: string;
  postedInLabel?: string;
  authorDisplayLine?: string;
  content: string;
  authorName: string;
  authorProfileHref?: string;
  authorProfileImageUrl?: string;
  createdAtLabel: string;
  likesCount: number;
  repostsCount: number;
  sharesCount: number;
  commentsCount: number;
  isAnonymous: boolean;
  poll?: PostPoll;
  mediaAssetIds: string[];
};

type CommentView = {
  id: string;
  postId?: string;
  parentId?: string;
  content: string;
  authorName: string;
  authorProfileHref?: string;
  authorProfileImageUrl?: string;
  createdAtLabel: string;
  likesCount: number;
  replyCount: number;
  userLiked: boolean;
  likedByCreator?: boolean;
  isDeleted: boolean;
  isUnderReview: boolean;
  mediaAssetIds: string[];
};

type ReplyThreadState = {
  open: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasFetched: boolean;
  items: CommentView[];
  nextCursor: string | null;
  error?: string;
};

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

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(obj[key]);
    if (value !== undefined) {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = getNumber(obj[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function pickBoolean(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = getBoolean(obj[key]);
    if (value !== undefined) return value;
  }
  return undefined;
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

function formatCompactTimeAgo(value: unknown): string {
  const date = asDate(value);
  if (!date) return "";

  const diffSeconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${Math.max(1, diffMonths)}mo`;

  const diffYears = Math.floor(diffDays / 365);
  return `${Math.max(1, diffYears)}y`;
}

function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function capitalize(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayCommunityPreferredName(value: unknown, preferShortNames: boolean): string | undefined {
  if (!isRecord(value)) return undefined;
  return resolveCommunityLabel({
    name: pickString(value, ["name"]),
    shortName: pickString(value, ["short_name", "shortName"]),
    preferShortNames,
    fallback: undefined,
  });
}

function formatLikesLabel(likesCount: number): string {
  return `${likesCount} like${likesCount === 1 ? "" : "s"}`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function isPollOpen(poll: PostPoll): boolean {
  if (poll.status.toUpperCase() !== "OPEN") return false;
  if (!poll.closesAt) return true;
  const closesAtMs = new Date(poll.closesAt).getTime();
  if (Number.isNaN(closesAtMs)) return true;
  return Date.now() < closesAtMs;
}

function formatEndsInLabel(closesAt: string): string {
  const closesAtMs = new Date(closesAt).getTime();
  if (Number.isNaN(closesAtMs)) return "No end";
  const diffMs = closesAtMs - Date.now();
  if (diffMs <= 0) return "Final results";

  const diffMinutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMinutes < 60) return `Ends in ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Ends in ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Ends in ${Math.max(1, diffDays)}d`;
}

function pollStatusLabel(poll: PostPoll): string {
  if (!isPollOpen(poll)) return "Final results";
  if (!poll.closesAt) return "No end";
  return formatEndsInLabel(poll.closesAt);
}

function appendIfMissing(existing: CommentView[], incoming: CommentView[]): CommentView[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    merged.push(item);
    seen.add(item.id);
  }
  return merged;
}

function updateCommentArray(
  items: CommentView[],
  commentId: string,
  updater: (item: CommentView) => CommentView
): { items: CommentView[]; updated?: CommentView } {
  const index = items.findIndex((item) => item.id === commentId);
  if (index < 0) return { items };
  const updated = updater(items[index]);
  const next = [...items];
  next[index] = updated;
  return { items: next, updated };
}

function isAnonymousAuthor(source: Record<string, unknown>, author: Record<string, unknown> | null): boolean {
  return (
    pickBoolean(source, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ??
    (author ? pickBoolean(author, ["is_anonymous", "isAnonymous", "author_is_anonymous", "authorIsAnonymous"]) : undefined) ??
    false
  );
}

function resolveAuthorName(
  source: Record<string, unknown>,
  author: Record<string, unknown> | null,
  isAnonymous: boolean
): string {
  if (isAnonymous) return "Anonymous";

  return (
    (author
      ? pickString(author, ["display_name", "displayName", "name", "username", "handle", "author_display_name"])
      : undefined) ??
    pickString(source, [
      "author_display_name",
      "authorDisplayName",
      "author_name",
      "authorName",
      "author_handle",
      "authorHandle",
    ]) ??
    "User"
  );
}

function resolveProfileHref({
  isAnonymous,
  authorId,
  anonProfileId,
}: {
  isAnonymous: boolean;
  authorId?: string;
  anonProfileId?: string;
}): string | undefined {
  if (isAnonymous) {
    if (anonProfileId) return `/app/profile/anon/${anonProfileId}`;
    return "/app/profile/anonymous";
  }
  if (authorId) return `/app/profile/${authorId}`;
  return undefined;
}

function normalizePostDetail(payload: unknown, preferCommunityShortNames: boolean): PostSummary | null {
  if (!isRecord(payload)) return null;

  const id = pickString(payload, ["id", "post_id", "postId"]);
  if (!id) return null;

  const author = isRecord(payload.author) ? payload.author : null;
  const isAnonymous = isAnonymousAuthor(payload, author);
  const authorId =
    pickString(payload, ["author_id", "authorId", "user_id", "userId"]) ??
    (author ? pickString(author, ["id", "user_id", "userId"]) : undefined);
  const anonProfileId =
    pickString(payload, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]) ??
    (author ? pickString(author, ["anon_profile_id", "anonProfileId"]) : undefined);

  const createdRaw = pickString(payload, ["created_at", "createdAt", "timestamp", "created"]);
  const compact = formatCompactTimeAgo(createdRaw);
  const statsRecord =
    (isRecord(payload.stats) ? payload.stats : null) ??
    (isRecord(payload.counts) ? payload.counts : null) ??
    (isRecord(payload.engagement) ? payload.engagement : null) ??
    null;
  const communityId = pickString(payload, ["community_id", "communityId"]);
  const communityName = resolveCommunityLabel({
    name: pickString(payload, ["community_name", "communityName"]),
    shortName: pickString(payload, ["community_short_name", "communityShortName"]),
    preferShortNames: preferCommunityShortNames,
    fallback: undefined,
  });
  const communityKind = pickString(payload, ["community_kind", "communityKind"]);
  const displaySpecializationName = displayCommunityPreferredName(
    payload.author_display_specialization ?? payload.authorDisplaySpecialization,
    preferCommunityShortNames
  );
  const displayCommunityName = displayCommunityPreferredName(
    payload.author_display_community ?? payload.authorDisplayCommunity,
    preferCommunityShortNames
  );
  const authorDisplayLine = isAnonymous
    ? undefined
    : displayCommunityName
      ? `${displaySpecializationName ?? "Member"} @ ${displayCommunityName}`
      : displaySpecializationName;
  const postedInLabel = communityName
    ? `Posted in ${communityName}`
    : communityKind
      ? `Posted in ${capitalize(communityKind)}`
      : undefined;

  return {
    id,
    communityId,
    communityName,
    communityKind,
    communityHref: communityId ? `/app/community/${communityId}` : undefined,
    postedInLabel,
    authorDisplayLine,
    content: pickString(payload, ["content", "text", "body", "message"]) ?? "",
    authorName: resolveAuthorName(payload, author, isAnonymous),
    authorProfileHref: resolveProfileHref({ isAnonymous, authorId, anonProfileId }),
    authorProfileImageUrl:
      (author ? pickString(author, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) : undefined) ??
      pickString(payload, ["author_profile_image_url", "authorProfileImageUrl"]),
    createdAtLabel: compact ? `${compact} ago` : "",
    likesCount:
      pickNumber(payload, ["likes_count", "likesCount", "like_count", "likeCount"]) ??
      (statsRecord ? pickNumber(statsRecord, ["likes_count", "likesCount", "like_count", "likeCount"]) : undefined) ??
      0,
    repostsCount:
      pickNumber(payload, ["reposts_count", "repostsCount", "repost_count", "repostCount"]) ??
      (statsRecord
        ? pickNumber(statsRecord, ["reposts_count", "repostsCount", "repost_count", "repostCount"])
        : undefined) ??
      0,
    sharesCount:
      pickNumber(payload, ["shares_count", "sharesCount", "share_count", "shareCount"]) ??
      (statsRecord ? pickNumber(statsRecord, ["shares_count", "sharesCount", "share_count", "shareCount"]) : undefined) ??
      0,
    commentsCount:
      pickNumber(payload, ["comments_count", "commentsCount", "comment_count", "commentCount"]) ??
      (statsRecord ? pickNumber(statsRecord, ["comments_count", "commentsCount", "comment_count", "commentCount"]) : undefined) ??
      0,
    isAnonymous,
    poll: normalizePostPoll(payload),
    mediaAssetIds: extractMediaAssetIds(payload),
  };
}

function normalizeComment(payload: unknown): CommentView | null {
  if (!isRecord(payload)) return null;

  const id = pickString(payload, ["id", "comment_id", "commentId"]);
  if (!id) return null;

  const author = isRecord(payload.author) ? payload.author : null;
  const isAnonymous = isAnonymousAuthor(payload, author);

  const authorId =
    pickString(payload, ["author_id", "authorId", "user_id", "userId"]) ??
    (author ? pickString(author, ["id", "user_id", "userId"]) : undefined);
  const anonProfileId =
    pickString(payload, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]) ??
    (author ? pickString(author, ["anon_profile_id", "anonProfileId", "id"]) : undefined);

  const isDeleted = pickBoolean(payload, ["is_deleted", "isDeleted"]) ?? false;
  const isUnderReview = pickBoolean(payload, ["is_under_review", "isUnderReview"]) ?? false;
  const replyCount =
    pickNumber(payload, [
      "total_reply_count",
      "totalReplyCount",
      "descendant_reply_count",
      "descendantReplyCount",
      "thread_reply_count",
      "threadReplyCount",
      "reply_count",
      "replyCount",
    ]) ?? 0;
  const normalizedContent = pickString(payload, ["content", "text", "body", "message"]) ?? "";
  const content = isDeleted ? "Comment deleted" : isUnderReview ? "Comment under review" : normalizedContent;

  return {
    id,
    postId: pickString(payload, ["post_id", "postId"]),
    parentId: pickString(payload, ["parent_id", "parentId"]),
    content,
    authorName: resolveAuthorName(payload, author, isAnonymous),
    authorProfileHref: resolveProfileHref({ isAnonymous, authorId, anonProfileId }),
    authorProfileImageUrl:
      (author ? pickString(author, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) : undefined) ??
      pickString(payload, ["author_profile_image_url", "authorProfileImageUrl"]),
    createdAtLabel: formatCompactTimeAgo(pickString(payload, ["created_at", "createdAt", "timestamp", "created"])),
    likesCount: pickNumber(payload, ["likes_count", "likesCount"]) ?? 0,
    replyCount,
    userLiked: pickBoolean(payload, ["user_liked", "userLiked"]) ?? false,
    likedByCreator: pickBoolean(payload, ["liked_by_creator", "likedByCreator"]),
    isDeleted,
    isUnderReview,
    mediaAssetIds: isDeleted || isUnderReview ? [] : extractMediaAssetIds(payload),
  };
}

function parseApiError(details?: string): { error?: string; message?: string } {
  const trimmed = (details ?? "").trim();
  if (!trimmed) return {};

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) {
      const error = pickString(parsed, ["error"]);
      const message = pickString(parsed, ["message"]);
      return { error, message };
    }
  } catch {
    // ignore non-JSON bodies
  }

  return { message: trimmed };
}

function titleForWriteError(code?: string, fallback = "Action unavailable"): string {
  if (!code) return fallback;
  if (code === "community_not_verified" || code === "user_not_verified" || code === "verification_expired") {
    return "Verification required";
  }
  if (code === "specialization_not_joined") return "Join required";
  if (code === "community_banned") return "Community unavailable";
  if (code === "content_under_review") return "Content unavailable";
  return fallback;
}

function messageForWriteError(
  code: string | undefined,
  {
    actionVerb = "comment",
    fallback = "This action isn't available right now.",
  }: {
    actionVerb?: "comment" | "interact";
    fallback?: string;
  } = {}
): string {
  if (!code) return fallback;
  if (code === "community_not_verified") {
    return actionVerb === "comment"
      ? "You must be verified in this community to comment."
      : "You must be verified in this community to interact.";
  }
  if (code === "user_not_verified") {
    return "Verification required to comment.";
  }
  if (code === "verification_expired") {
    return "Your verification expired. Verify again to comment.";
  }
  if (code === "specialization_not_joined") {
    return actionVerb === "comment"
      ? "Join this major or field to comment."
      : "Join this major or field to interact.";
  }
  if (code === "community_banned") return "This community is currently unavailable.";
  if (code === "content_under_review") return "Your content is still under review.";
  return fallback;
}

function initialReplyThread(): ReplyThreadState {
  return {
    open: false,
    loading: false,
    loadingMore: false,
    hasFetched: false,
    items: [],
    nextCursor: null,
  };
}

function ChevronLeftIcon({ className }: { className?: string }) {
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

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function RepostIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 640" className={className} fill="currentColor" aria-hidden="true">
      <path d="M150.6 105.4C138.1 92.9 117.8 92.9 105.3 105.4L41.3 169.4C32.1 178.6 29.4 192.3 34.4 204.3C39.4 216.3 51.1 224 64 224L96 224L96 448C96 501 139 544 192 544L320 544C337.7 544 352 529.7 352 512C352 494.3 337.7 480 320 480L192 480C174.3 480 160 465.7 160 448L160 224L192 224C204.9 224 216.6 216.2 221.6 204.2C226.6 192.2 223.8 178.5 214.7 169.3L150.7 105.3zM489.4 534.6C501.9 547.1 522.2 547.1 534.7 534.6L598.7 470.6C607.9 461.4 610.6 447.7 605.6 435.7C600.6 423.7 588.9 416 576 416L544 416L544 192C544 139 501 96 448 96L320 96C302.3 96 288 110.3 288 128C288 145.7 302.3 160 320 160L448 160C465.7 160 480 174.3 480 192L480 416L448 416C435.1 416 423.4 423.8 418.4 435.8C413.4 447.8 416.2 461.5 425.3 470.7L489.3 534.7z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block bg-current [mask-image:url('/ios-icons/action-send.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/ios-icons/action-send.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain] ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

function MoreHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function Avatar({
  src,
  alt,
  href,
  sizeClassName = "h-10 w-10",
}: {
  src?: string;
  alt: string;
  href?: string;
  sizeClassName?: string;
}) {
  const body = (
    <img
      src={src ?? DEFAULT_PROFILE_IMAGE_SRC}
      alt=""
      className={`h-full w-full object-cover ${sizeClassName}`}
      loading="lazy"
      onError={handleProfileImageError}
    />
  );

  if (href) {
    return (
      <Link
        to={href}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary ${sizeClassName}`}
        aria-label={alt}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary ${sizeClassName}`}
      aria-hidden="true"
    >
      {body}
    </div>
  );
}

export function AppPostCommentsPage({ postId, overlayMode = false, onRequestClose }: AppPostCommentsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const composerInputRef = useRef<HTMLInputElement>(null);
  const focusedCommentIdRef = useRef<string | null>(null);
  const { showToast } = useToast();
  const { openHashtag, openMention } = useEntityNavigation();
  const { user, status: currentUserStatus } = useCurrentUserStore({ autoLoad: true });
  const preferCommunityShortNames = usePreferCommunityShortNames();

  const [post, setPost] = useState<PostSummary | null>(null);
  const [postStatus, setPostStatus] = useState<"loading" | "idle" | "error">("loading");
  const [postError, setPostError] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentsStatus, setCommentsStatus] = useState<"loading" | "loading-more" | "idle" | "error">("loading");
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [replyThreads, setReplyThreads] = useState<Record<string, ReplyThreadState>>({});
  const [resolvedMediaById, setResolvedMediaById] = useState<Record<string, ResolvedMediaAsset>>({});
  const [composerText, setComposerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    threadRootId: string;
    authorName: string;
  } | null>(null);
  const [permissions, setPermissions] = useState<CommunityPermissions | null>(null);
  const [permissionsStatus, setPermissionsStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [permissionsError, setPermissionsError] = useState(false);
  const [platformVerified, setPlatformVerified] = useState<boolean | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentView | null>(null);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASON_OPTIONS)[number]>("Spam");
  const [reportCustomReason, setReportCustomReason] = useState("");
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  const targetCommentId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("commentId") ?? params.get("comment_id");
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [location.search]);

  const loadPostDetail = useCallback(async () => {
    setPostStatus("loading");
    setPostError(null);

    try {
      const response = await fetchPostDetail(postId);
      const normalized = normalizePostDetail(response, preferCommunityShortNames);
      if (!normalized) throw new Error("Unable to load this post.");
      setPost(normalized);
      setPostStatus("idle");
    } catch (error) {
      const parsed = error instanceof CommentsApiError ? parseApiError(error.details) : {};
      setPostError(parsed.message ?? "Unable to load this post.");
      setPostStatus("error");
    }
  }, [postId, preferCommunityShortNames]);

  const loadComments = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      setCommentsStatus(cursor ? "loading-more" : "loading");
      setCommentsError(null);

      try {
        const response = await fetchPostComments({
          postId,
          limit: 20,
          cursor,
        });

        const normalized = (response.items ?? [])
          .map(normalizeComment)
          .filter((item): item is CommentView => Boolean(item))
          .filter((item) => !item.parentId)
          .filter((item) => !item.isDeleted || item.replyCount > 0);

        setComments((previous) => (replace ? normalized : appendIfMissing(previous, normalized)));
        setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
        setCommentsStatus("idle");
      } catch (error) {
        const parsed = error instanceof CommentsApiError ? parseApiError(error.details) : {};
        setCommentsError(parsed.message ?? "Unable to load comments.");
        setCommentsStatus("error");
      }
    },
    [postId]
  );

  const loadReplies = useCallback(async (commentId: string, cursor?: string) => {
    setReplyThreads((previous) => {
      const current = previous[commentId] ?? initialReplyThread();
      return {
        ...previous,
        [commentId]: {
          ...current,
          open: true,
          loading: !cursor,
          loadingMore: Boolean(cursor),
          error: undefined,
        },
      };
    });

    try {
      const response = await fetchCommentReplies({
        commentId,
        limit: 20,
        cursor,
      });

      const normalized = (response.items ?? [])
        .map(normalizeComment)
        .filter((item): item is CommentView => Boolean(item))
        .filter((item) => !item.isDeleted || item.replyCount > 0);

      setReplyThreads((previous) => {
        const current = previous[commentId] ?? initialReplyThread();
        return {
          ...previous,
          [commentId]: {
            ...current,
            open: true,
            loading: false,
            loadingMore: false,
            hasFetched: true,
            items: cursor ? appendIfMissing(current.items, normalized) : normalized,
            nextCursor: response.next_cursor ?? response.nextCursor ?? null,
            error: undefined,
          },
        };
      });
    } catch (error) {
      const parsed = error instanceof CommentsApiError ? parseApiError(error.details) : {};
      setReplyThreads((previous) => {
        const current = previous[commentId] ?? initialReplyThread();
        return {
          ...previous,
          [commentId]: {
            ...current,
            loading: false,
            loadingMore: false,
            error: parsed.message ?? "Unable to load replies.",
          },
        };
      });
    }
  }, []);

  useEffect(() => {
    setComments([]);
    setReplyThreads({});
    setResolvedMediaById({});
    setNextCursor(null);
    setReplyTarget(null);
    setComposerText("");
    setReportTarget(null);
    setReportReason("Spam");
    setReportCustomReason("");
    setIsReportSubmitting(false);
    setHighlightedCommentId(null);
    focusedCommentIdRef.current = null;
    void loadPostDetail();
    void loadComments({ replace: true });
  }, [loadComments, loadPostDetail]);

  useEffect(() => {
    if (!targetCommentId) {
      setHighlightedCommentId(null);
      focusedCommentIdRef.current = null;
      return;
    }
    if (focusedCommentIdRef.current === targetCommentId) return;

    const element = document.getElementById(`comment-${targetCommentId}`);
    if (!element) return;

    focusedCommentIdRef.current = targetCommentId;
    setHighlightedCommentId(targetCommentId);

    const scrollRaf = window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedCommentId((current) => (current === targetCommentId ? null : current));
    }, 2200);

    return () => {
      window.cancelAnimationFrame(scrollRaf);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [comments, replyThreads, targetCommentId]);

  useEffect(() => {
    if (!post) {
      setPermissions(null);
      setPermissionsStatus("idle");
      setPlatformVerified(null);
      return;
    }

    let active = true;
    setPermissionsStatus("loading");
    setPermissionsError(false);

    if (post.communityId) {
      getCommunityPermissions(post.communityId)
        .then((response) => {
          if (!active) return;
          setPermissions(response);
          setPermissionsStatus("ready");
        })
        .catch(() => {
          if (!active) return;
          // Fail-closed until permissions are known.
          setPermissions(null);
          setPermissionsError(true);
          setPermissionsStatus("ready");
        });
    } else {
      fetchViewerInteractionState()
        .then((response) => {
          if (!active) return;
          setPlatformVerified(response.isVerified);
          if (response.isAnonymous) {
            setPermissions({
              can_post: false,
              requires_verification: true,
              requires_join: false,
            });
          } else {
            setPermissions(null);
          }
          setPermissionsStatus("ready");
        })
        .catch(() => {
          if (!active) return;
          setPlatformVerified(null);
          setPermissions(null);
          setPermissionsError(true);
          setPermissionsStatus("ready");
        });
    }

    return () => {
      active = false;
    };
  }, [post]);

  const allVisibleMediaIds = useMemo(() => {
    const unique: string[] = [];
    const seen = new Set<string>();

    const collect = (ids: string[]) => {
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        unique.push(id);
      }
    };

    if (post?.mediaAssetIds) collect(post.mediaAssetIds);
    for (const comment of comments) collect(comment.mediaAssetIds);
    for (const thread of Object.values(replyThreads)) {
      for (const reply of thread.items) collect(reply.mediaAssetIds);
    }
    return unique;
  }, [comments, post, replyThreads]);

  useEffect(() => {
    const unresolved = allVisibleMediaIds.filter((id) => !resolvedMediaById[id]);
    if (unresolved.length === 0) return;

    let active = true;
    resolveMediaAssets(unresolved)
      .then((resolved) => {
        if (!active) return;
        setResolvedMediaById((previous) => {
          const next = { ...previous };
          for (const item of resolved) {
            next[item.id] = item;
          }
          return next;
        });
      })
      .catch(() => {
        // keep content readable even if media resolution fails
      });

    return () => {
      active = false;
    };
  }, [allVisibleMediaIds, resolvedMediaById]);

  const orderedResolvedMedia = useCallback(
    (ids: string[]): ResolvedMediaAsset[] => {
      if (ids.length === 0) return [];
      const ordered = ids.map((id) => resolvedMediaById[id]).filter((item): item is ResolvedMediaAsset => Boolean(item));
      // iOS behavior: if any ID fails resolution, keep original item unchanged.
      return ordered.length === ids.length ? ordered : [];
    },
    [resolvedMediaById]
  );

  const isCurrentUserAnonymous = useMemo(() => {
    if (!user || typeof user !== "object") return false;
    const profile = user as Record<string, unknown>;
    return (
      pickBoolean(profile, ["is_anonymous", "isAnonymous"]) ??
      pickBoolean(profile, ["active_profile_is_anonymous", "activeProfileIsAnonymous"]) ??
      false
    );
  }, [user]);

  const canInteractFromPermissions = useMemo(() => {
    if (!permissions) return true;
    return permissions.can_post || Boolean(permissions.canPost);
  }, [permissions]);

  const getInteractionBlocker = useCallback(
    (actionVerb: "comment" | "interact"): { title: string; message: string } | null => {
      if (currentUserStatus === "loading" || currentUserStatus === "idle") {
        return { title: "Checking account", message: "Please wait a moment and try again." };
      }

      if (!user) {
        return { title: "Sign in required", message: "Sign in to comment and reply." };
      }

      if (isCurrentUserAnonymous) {
        return { title: "Action unavailable", message: "Anonymous profiles can't comment on web." };
      }

      if (permissionsStatus === "loading") {
        return { title: "Checking permissions", message: "Please wait a moment and try again." };
      }

      if (permissionsError) {
        return { title: "Action unavailable", message: "Couldn't check permissions. Try again." };
      }

      if (!post?.communityId && platformVerified === false) {
        return { title: "Verification required", message: "Verification required to comment." };
      }

      if (!canInteractFromPermissions && permissions) {
        if (permissions.requires_verification) {
          return {
            title: "Verification required",
            message:
              actionVerb === "comment"
                ? "You must be verified in this community to comment."
                : "You must be verified in this community to interact.",
          };
        }
        if (permissions.requires_join || permissions.requiresJoin) {
          return {
            title: "Join required",
            message:
              actionVerb === "comment"
                ? "Join this major or field to comment."
                : "Join this major or field to interact.",
          };
        }
      }

      return null;
    },
    [
      canInteractFromPermissions,
      currentUserStatus,
      isCurrentUserAnonymous,
      permissions,
      permissionsError,
      permissionsStatus,
      platformVerified,
      post?.communityId,
      user,
    ]
  );

  const handleBack = () => {
    if (overlayMode) {
      onRequestClose?.();
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    const fromSharePreviewRedirect =
      typeof location.state === "object" &&
      location.state !== null &&
      "fromSharePreviewRedirect" in location.state &&
      (location.state as { fromSharePreviewRedirect?: boolean }).fromSharePreviewRedirect === true;
    if (fromSharePreviewRedirect) {
      navigate("/app", { replace: true });
      return;
    }

    navigate("/app", { replace: true });
  };

  const updateCommentById = useCallback((commentId: string, updater: (comment: CommentView) => CommentView) => {
    setComments((previous) => {
      const updated = updateCommentArray(previous, commentId, updater);
      return updated.items;
    });

    setReplyThreads((previous) => {
      let changed = false;
      const next: Record<string, ReplyThreadState> = {};

      for (const [parentId, thread] of Object.entries(previous)) {
        const updated = updateCommentArray(thread.items, commentId, updater);
        if (updated.updated) {
          changed = true;
          next[parentId] = { ...thread, items: updated.items };
        } else {
          next[parentId] = thread;
        }
      }

      return changed ? next : previous;
    });
  }, []);

  const handleCommentLikeToggle = useCallback(
    async (comment: CommentView) => {
      const blocker = getInteractionBlocker("interact");
      if (blocker) {
        showToast({
          title: blocker.title,
          message: blocker.message,
          tone: "error",
        });
        return;
      }

      const previousLiked = comment.userLiked;
      const previousCount = comment.likesCount;
      const nextLiked = !previousLiked;

      updateCommentById(comment.id, (item) => ({
        ...item,
        userLiked: nextLiked,
        likesCount: nextLiked ? item.likesCount + 1 : Math.max(item.likesCount - 1, 0),
      }));

      try {
        const response = await setCommentLiked(comment.id, nextLiked);
        updateCommentById(comment.id, (item) => ({
          ...item,
          userLiked: response.userLiked,
          likesCount: response.likesCount ?? item.likesCount,
        }));
      } catch (error) {
        updateCommentById(comment.id, (item) => ({
          ...item,
          userLiked: previousLiked,
          likesCount: previousCount,
        }));

        if (error instanceof CommentsApiError) {
          const parsed = parseApiError(error.details);
          showToast({
            title: titleForWriteError(parsed.error, "Couldn't like comment"),
            message: messageForWriteError(parsed.error, {
              actionVerb: "interact",
              fallback: parsed.message ?? "This action isn't available right now.",
            }),
            tone: "error",
          });
          return;
        }

        showToast({
          title: "Couldn't like comment",
          message: error instanceof Error ? error.message : "Try again.",
          tone: "error",
        });
      }
    },
    [getInteractionBlocker, showToast, updateCommentById]
  );

  const handleReplyClick = useCallback((comment: CommentView, threadRootId: string) => {
    const blocker = getInteractionBlocker("comment");
    if (blocker) {
      showToast({
        title: blocker.title,
        message: blocker.message,
        tone: "error",
      });
      return;
    }

    setReplyTarget({ parentId: comment.id, threadRootId, authorName: comment.authorName });
    window.setTimeout(() => {
      composerInputRef.current?.focus();
    }, 0);
  }, [getInteractionBlocker, showToast]);

  const handleCommentDoubleTap = useCallback(
    (comment: CommentView) => {
      if (comment.userLiked) return;
      void handleCommentLikeToggle(comment);
    },
    [handleCommentLikeToggle]
  );

  const toggleReplyThread = useCallback(
    (commentId: string) => {
      const thread = replyThreads[commentId];
      if (thread?.open) {
        setReplyThreads((previous) => {
          const current = previous[commentId] ?? initialReplyThread();
          return {
            ...previous,
            [commentId]: {
              ...current,
              open: false,
            },
          };
        });
        return;
      }

      if (thread?.hasFetched) {
        setReplyThreads((previous) => {
          const current = previous[commentId] ?? initialReplyThread();
          return {
            ...previous,
            [commentId]: {
              ...current,
              open: true,
            },
          };
        });
        return;
      }

      void loadReplies(commentId);
    },
    [loadReplies, replyThreads]
  );

  const closeReportDialog = useCallback(() => {
    if (isReportSubmitting) return;
    setReportTarget(null);
    setReportReason("Spam");
    setReportCustomReason("");
  }, [isReportSubmitting]);

  const handleReportClick = useCallback(
    (comment: CommentView) => {
      if (currentUserStatus === "loading" || currentUserStatus === "idle") {
        showToast({
          title: "Checking account",
          message: "Please wait a moment and try again.",
          tone: "error",
        });
        return;
      }

      if (!user) {
        showToast({
          title: "Sign in required",
          message: "Sign in to report comments.",
          tone: "error",
        });
        return;
      }

      setReportTarget(comment);
      setReportReason("Spam");
      setReportCustomReason("");
    },
    [currentUserStatus, showToast, user]
  );

  const resolveReportReason = useCallback((): string | null => {
    if (reportReason === "Something Else") {
      const custom = reportCustomReason.trim();
      return custom.length > 0 ? custom : null;
    }
    return reportReason;
  }, [reportCustomReason, reportReason]);

  const handleReportSubmit = useCallback(async () => {
    if (!reportTarget || isReportSubmitting) return;
    const reason = resolveReportReason();
    if (!reason) {
      showToast({
        title: "Reason required",
        message: "Enter a reason before submitting.",
        tone: "error",
      });
      return;
    }

    setIsReportSubmitting(true);
    try {
      await reportEntity({
        targetType: "comment",
        targetId: reportTarget.id,
        reason,
      });
      showToast({
        title: "Comment reported",
        message: "Thanks for your report.",
      });
      setReportTarget(null);
      setReportReason("Spam");
      setReportCustomReason("");
    } catch (error) {
      if (error instanceof PostActionsApiError) {
        const parsed = parseApiError(error.details);
        showToast({
          title: titleForWriteError(parsed.error, "Couldn't report comment"),
          message: parsed.message ?? "This action isn't available right now.",
          tone: "error",
        });
      } else {
        showToast({
          title: "Couldn't report comment",
          message: error instanceof Error ? error.message : "Try again.",
          tone: "error",
        });
      }
    } finally {
      setIsReportSubmitting(false);
    }
  }, [isReportSubmitting, reportTarget, resolveReportReason, showToast]);

  const handleCreateComment = useCallback(async () => {
    const trimmed = composerText.trim();
    if (!trimmed || isSubmitting) return;

    const blocker = getInteractionBlocker("comment");
    if (blocker) {
      showToast({
        title: blocker.title,
        message: blocker.message,
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const parentId = replyTarget?.parentId ?? null;
    const threadRootId = replyTarget?.threadRootId ?? null;

    try {
      const response = await createPostComment({
        postId,
        content: trimmed,
        parentId,
      });

      const created = normalizeComment(response);
      if (!created) throw new Error("Unable to post this comment.");

      setComposerText("");
      setReplyTarget(null);

      if (created.parentId) {
        updateCommentById(created.parentId, (item) => ({ ...item, replyCount: item.replyCount + 1 }));
        if (threadRootId && threadRootId !== created.parentId) {
          setComments((previous) => previous.map((item) => (item.id === threadRootId ? { ...item, replyCount: item.replyCount + 1 } : item)));
        }

        setReplyThreads((previous) => {
          const parentThreadId = created.parentId!;
          const thread = previous[parentThreadId] ?? initialReplyThread();

          const nextItems = appendIfMissing([created], thread.items);
          return {
            ...previous,
            [parentThreadId]: {
              ...thread,
              open: true,
              items: nextItems,
            },
          };
        });
      } else {
        setComments((previous) => [created, ...previous]);
      }

      setPost((previous) => {
        if (!previous) return previous;
        return { ...previous, commentsCount: previous.commentsCount + 1 };
      });
    } catch (error) {
      if (error instanceof CommentsApiError) {
        const parsed = parseApiError(error.details);
        showToast({
          title: titleForWriteError(parsed.error, "Couldn't post comment"),
          message: messageForWriteError(parsed.error, {
            actionVerb: "comment",
            fallback: parsed.message ?? "This action isn't available right now.",
          }),
          tone: "error",
        });
      } else {
        showToast({
          title: "Couldn't post comment",
          message: error instanceof Error ? error.message : "Try again.",
          tone: "error",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [composerText, getInteractionBlocker, isSubmitting, postId, replyTarget, showToast, updateCommentById]);

  const title = useMemo(() => {
    const count = post?.commentsCount ?? comments.length;
    return `${count} comment${count === 1 ? "" : "s"}`;
  }, [comments.length, post?.commentsCount]);
  const commentBlocker = getInteractionBlocker("comment");
  const lockedCommunityLabel = post?.communityName ?? "this community";
  const lockedMessage =
    commentBlocker?.title === "Verification required"
      ? `You can't comment because you aren't verified for ${lockedCommunityLabel}.`
      : commentBlocker?.title === "Join required"
        ? `Join ${lockedCommunityLabel} to comment.`
        : commentBlocker?.message ?? null;
  const canShowComposer = !commentBlocker;
  const hasComposerDraft = composerText.trim().length > 0;
  const reportRequiresCustomReason = reportReason === "Something Else";
  const isReportInvalid = reportRequiresCustomReason && reportCustomReason.trim().length === 0;
  const trimmedPostContent = post?.content.trim() ?? "";
  const shouldHidePostTextForPoll = Boolean(
    post?.poll &&
      trimmedPostContent.length > 0 &&
      normalizeForComparison(trimmedPostContent) === normalizeForComparison(post.poll.question)
  );
  const shouldRenderPostText = trimmedPostContent.length > 0 && !shouldHidePostTextForPoll;
  const postMediaTopSpacingClass = post?.poll || shouldRenderPostText ? "mt-3" : "mt-2";
  const composerAvatarUrl = useMemo(() => {
    const userRecord = user as unknown;
    if (!isRecord(userRecord)) return undefined;
    const profileValue = userRecord.profile;
    const profile = isRecord(profileValue) ? profileValue : null;
    return (
      (profile ? pickString(profile, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) : undefined) ??
      pickString(userRecord, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"])
    );
  }, [user]);

  const renderReplyNode = (
    reply: CommentView,
    threadRootId: string,
    {
      depth,
      ancestorHasNext,
      isLast,
    }: {
      depth: number;
      ancestorHasNext: boolean[];
      isLast: boolean;
    }
  ) => {
    const childThread = replyThreads[reply.id];
    const showChildReplies = childThread?.open ?? false;
    const visibleChildReplyCount = reply.replyCount > 0 ? reply.replyCount : (childThread?.items.length ?? 0);
    const shouldShowLines = depth > 0;
    const leftGutterPx = 40;
    const avatarSizePx = 32;
    const leftWidthPx = leftGutterPx + avatarSizePx;

    return (
      <div
        key={reply.id}
        id={`comment-${reply.id}`}
        className={`relative rounded-lg transition-colors ${highlightedCommentId === reply.id ? "bg-brand/10" : ""}`}
      >
        {shouldShowLines ? (
          <CommentThreadRails
            depth={depth}
            ancestorHasNext={ancestorHasNext}
            isLast={isLast}
            avatarSizePx={avatarSizePx}
            gapPx={10}
            showChildTrunk={showChildReplies}
            gutterPx={leftGutterPx}
            rowTopInsetPx={10}
            maxColumns={1}
          />
        ) : null}

        <div
          onDoubleClick={() => handleCommentDoubleTap(reply)}
          className={`relative flex items-start py-2.5 ${highlightedCommentId === reply.id ? "px-2" : ""}`}
        >
          <div className="relative shrink-0" style={{ width: leftWidthPx }}>
            <div aria-hidden="true" className="h-8" style={{ width: leftGutterPx }} />
            <div style={{ marginLeft: leftGutterPx }}>
              <Avatar
                src={reply.authorProfileImageUrl}
                alt={`View ${reply.authorName}'s profile`}
                href={reply.authorProfileHref}
                sizeClassName="h-8 w-8"
              />
            </div>
          </div>

          <div className="ml-2 min-w-0 flex-1">
            {reply.authorProfileHref ? (
              <Link
                to={reply.authorProfileHref}
                className="text-[15px] font-semibold leading-tight text-strong transition hover:opacity-90"
              >
                {reply.authorName}
              </Link>
            ) : (
              <p className="text-[15px] font-semibold leading-tight text-strong">{reply.authorName}</p>
            )}
            {reply.content ? (
              <EntityText
                text={reply.content}
                className="mt-0.5 text-[15px] leading-[1.35] text-strong"
                onHashtagPress={openHashtag}
                onMentionPress={openMention}
              />
            ) : null}
            {reply.mediaAssetIds.length > 0 ? (
              <PostMediaGrid
                attachments={orderedResolvedMedia(reply.mediaAssetIds)}
                className={reply.content ? "mt-2" : "mt-0.5"}
              />
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-text-light">
              {reply.createdAtLabel ? <span>{reply.createdAtLabel}</span> : null}
              <span>{formatLikesLabel(reply.likesCount)}</span>
              {reply.isUnderReview ? (
                <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[0.75rem] font-medium text-text-secondary">
                  Under review
                </span>
              ) : null}
              {!reply.isDeleted ? (
                <button
                  type="button"
                  onClick={() => handleReplyClick(reply, threadRootId)}
                  className="font-medium text-text-secondary transition hover:text-strong"
                >
                  Reply
                </button>
              ) : null}
            </div>
            {visibleChildReplyCount > 0 ? (
              <button
                type="button"
                onClick={() => toggleReplyThread(reply.id)}
                className="mt-1 text-[12px] font-medium text-text-secondary transition hover:text-strong"
              >
                {showChildReplies ? "Hide replies" : `View replies (${visibleChildReplyCount})`}
              </button>
            ) : null}
          </div>

          <div className="ml-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleCommentLikeToggle(reply)}
              className={`inline-flex items-center ${reply.userLiked ? "text-brand" : "text-text-light"}`}
              aria-label={reply.userLiked ? "Unlike reply" : "Like reply"}
            >
              <HeartIcon filled={reply.userLiked} className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleReportClick(reply)}
              className="inline-flex h-8 w-8 items-center justify-center text-text-light transition hover:text-strong"
              aria-label="Report reply"
            >
              <MoreHorizontalIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showChildReplies ? (
          <div className={`space-y-[10px] ${highlightedCommentId === reply.id ? "px-2 pb-2" : ""}`}>
            {childThread?.loading ? <p className="pl-[80px] text-sm text-text-light">Loading replies…</p> : null}

            {childThread?.error ? (
              <div className="pl-[80px]">
                <p className="text-sm text-text-secondary">{childThread.error}</p>
                <button
                  type="button"
                  onClick={() => void loadReplies(reply.id)}
                  className="mt-1 text-sm font-semibold text-brand"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {childThread?.items.map((childReply, index) => {
              const hasMore = Boolean(childThread?.nextCursor);
              const isLastChild = index === (childThread?.items.length ?? 0) - 1 && !hasMore;
              return renderReplyNode(childReply, threadRootId, {
                depth: depth + 1,
                ancestorHasNext: [...ancestorHasNext, !isLast],
                isLast: isLastChild,
              });
            })}

            {childThread?.nextCursor ? (
              <button
                type="button"
                onClick={() => void loadReplies(reply.id, childThread.nextCursor ?? undefined)}
                disabled={childThread.loadingMore}
                className="pl-[80px] text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
              >
                {childThread.loadingMore ? "Loading more…" : "View more replies"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const content = (
    <div className="flex min-h-screen flex-col bg-bg">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-bg">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 py-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 w-10 items-center justify-center text-strong transition hover:text-strong/80"
              aria-label="Back"
            >
              <ChevronLeftIcon className="h-7 w-7" />
            </button>

            <h1 className="text-center text-2xl font-semibold text-strong">{title}</h1>
            <button
              type="button"
              aria-label="Comment options"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted/70 text-text-secondary"
            >
              <MoreHorizontalIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 bg-bg">
          {postStatus === "loading" ? (
            <section className="border-b border-border/70 px-5 py-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/2 rounded-full bg-bg-muted" />
                <div className="h-4 w-full rounded-full bg-bg-muted" />
                <div className="h-4 w-5/6 rounded-full bg-bg-muted" />
              </div>
            </section>
          ) : null}

          {postStatus === "error" ? (
            <section className="border-b border-border/70 px-5 py-5">
              <p className="text-sm font-semibold text-strong">Unable to load this post.</p>
              <p className="mt-1 text-sm text-text-secondary">{postError ?? "Try again."}</p>
              <button
                type="button"
                onClick={() => void loadPostDetail()}
                className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </section>
          ) : null}

          {post ? (
            <section className="border-b border-border/70 px-5 py-4">
              <div className="flex items-start gap-3">
                <Avatar
                  src={post.authorProfileImageUrl}
                  alt={`View ${post.authorName}'s profile`}
                  href={post.authorProfileHref}
                  sizeClassName="h-10 w-10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline gap-1 leading-tight">
                    {post.authorProfileHref ? (
                      <Link
                        to={post.authorProfileHref}
                        className={`shrink-0 text-[1.12rem] font-semibold transition hover:opacity-90 ${
                          post.isAnonymous ? "text-secondary" : "text-strong"
                        }`}
                      >
                        {post.authorName}
                      </Link>
                    ) : (
                      <p className={`shrink-0 text-[1.12rem] font-semibold ${post.isAnonymous ? "text-secondary" : "text-strong"}`}>
                        {post.authorName}
                      </p>
                    )}
                    {post.authorDisplayLine ? (
                      <>
                        <span className="shrink-0 text-[1rem] leading-none text-text-light">·</span>
                        {post.communityHref ? (
                          <Link
                            to={post.communityHref}
                            className="min-w-0 flex-1 truncate text-[1.03rem] text-text-secondary transition hover:text-strong"
                          >
                            {post.authorDisplayLine}
                          </Link>
                        ) : (
                          <p className="min-w-0 flex-1 truncate text-[1.03rem] text-text-secondary">{post.authorDisplayLine}</p>
                        )}
                      </>
                    ) : null}
                  </div>
                  {post.postedInLabel ? (
                    post.communityHref ? (
                      <Link
                        to={post.communityHref}
                        className="mt-0.5 block text-[1.03rem] leading-tight text-text-secondary transition hover:text-strong"
                      >
                        {post.postedInLabel}
                      </Link>
                    ) : (
                      <p className="mt-0.5 text-[1.03rem] leading-tight text-text-secondary">{post.postedInLabel}</p>
                    )
                  ) : null}
                  {shouldRenderPostText ? (
                    <EntityText
                      text={post.content}
                      className="mt-2 text-[1.08rem] leading-[1.4] text-strong"
                      onHashtagPress={openHashtag}
                      onMentionPress={openMention}
                    />
                  ) : null}
                  {post.poll ? (
                    <section className={`${shouldRenderPostText ? "mt-3" : "mt-1"} pt-1`}>
                      <div className="space-y-2.5">
                        <p className="text-[1.02rem] font-medium leading-snug text-text-primary">{post.poll.question}</p>
                        <div className="space-y-2">
                          {post.poll.options.map((option) => {
                            const percent = clampPercent(option.votePercent);
                            return (
                              <div
                                key={option.id}
                                className="relative w-full overflow-hidden rounded-xl border border-border/70 px-3 py-2.5"
                              >
                                <span
                                  className="absolute inset-y-0 left-0 bg-bg-muted/70"
                                  style={{ width: `${percent}%` }}
                                  aria-hidden="true"
                                />
                                <span className="relative z-10 flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-text-primary">{option.text}</span>
                                  <span className="text-xs font-semibold text-text-secondary tabular-nums">
                                    {Math.round(percent)}%
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-[0.85rem] text-text-light">
                          <span>{pollStatusLabel(post.poll)}</span>
                          <span>
                            {post.poll.totalVotes} {post.poll.totalVotes === 1 ? "vote" : "votes"}
                          </span>
                        </div>
                      </div>
                    </section>
                  ) : null}
                  {post.createdAtLabel ? <p className="mt-1 text-[1rem] text-text-light">{post.createdAtLabel}</p> : null}
                  <div className="mt-1.5 flex items-center gap-3 text-text-secondary">
                    <div className="inline-flex items-center gap-1.5">
                      <HeartIcon filled={false} className="h-5 w-5" />
                      <span className="text-[1rem] tabular-nums">{post.likesCount}</span>
                    </div>
                    <div className="inline-flex items-center">
                      <RepostIcon className="h-5 w-5" />
                    </div>
                    <div className="inline-flex items-center">
                      <SendIcon className="h-5 w-5" />
                    </div>
                  </div>
                  {post.mediaAssetIds.length > 0 ? (
                    <PostMediaGrid
                      attachments={orderedResolvedMedia(post.mediaAssetIds)}
                      className={postMediaTopSpacingClass}
                    />
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section>
            {commentsStatus === "loading" && comments.length === 0 ? (
              <>
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={`comment-skeleton-${index}`} className="px-5 py-4">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 w-3/4 rounded-full bg-bg-muted" />
                      <div className="h-4 w-1/3 rounded-full bg-bg-muted" />
                    </div>
                  </div>
                ))}
              </>
            ) : null}

            {commentsError ? (
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-strong">Unable to load comments.</p>
                <p className="mt-1 text-sm text-text-secondary">{commentsError}</p>
                <button
                  type="button"
                  onClick={() => void loadComments({ replace: true })}
                  className="mt-3 rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!commentsError && commentsStatus !== "loading" && comments.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="text-[2rem] font-semibold text-strong">No comments yet</p>
                <p className="mt-2 text-[1.4rem] text-text-secondary">Be the first to share your thoughts.</p>
              </div>
            ) : null}

            {comments.map((comment) => {
              const thread = replyThreads[comment.id];
              const showReplies = thread?.open ?? false;
              const visibleReplyCount = comment.replyCount > 0 ? comment.replyCount : (thread?.items.length ?? 0);

              return (
                <article
                  key={comment.id}
                  id={`comment-${comment.id}`}
                  onDoubleClick={() => handleCommentDoubleTap(comment)}
                  className={`px-5 py-3.5 transition-colors ${
                    highlightedCommentId === comment.id ? "rounded-xl bg-brand/10" : ""
                  }`}
                >
                  <div className="relative">
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={comment.authorProfileImageUrl}
                        alt={`View ${comment.authorName}'s profile`}
                        href={comment.authorProfileHref}
                        sizeClassName="h-10 w-10"
                      />

                      <div className="min-w-0 flex-1">
                        {comment.authorProfileHref ? (
                          <Link
                            to={comment.authorProfileHref}
                            className="text-[16px] font-semibold leading-tight text-strong transition hover:opacity-90"
                          >
                            {comment.authorName}
                          </Link>
                        ) : (
                          <p className="text-[16px] font-semibold leading-tight text-strong">{comment.authorName}</p>
                        )}
                        {comment.content ? (
                          <EntityText
                            text={comment.content}
                            className="mt-0.5 text-[16px] leading-[1.38] text-strong"
                            onHashtagPress={openHashtag}
                            onMentionPress={openMention}
                          />
                        ) : null}
                        {comment.mediaAssetIds.length > 0 ? (
                          <PostMediaGrid
                            attachments={orderedResolvedMedia(comment.mediaAssetIds)}
                            className={comment.content ? "mt-2" : "mt-0.5"}
                          />
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-text-light">
                          {comment.createdAtLabel ? <span>{comment.createdAtLabel}</span> : null}
                          <span>{formatLikesLabel(comment.likesCount)}</span>
                          {comment.isUnderReview ? (
                            <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[0.8rem] font-medium text-text-secondary">
                              Under review
                            </span>
                          ) : null}
                          {!comment.isDeleted ? (
                            <button
                              type="button"
                              onClick={() => handleReplyClick(comment, comment.id)}
                              className="font-medium text-text-secondary transition hover:text-strong"
                            >
                              Reply
                            </button>
                          ) : null}
                        </div>
                        {visibleReplyCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleReplyThread(comment.id)}
                            className="mt-1 text-[13px] font-medium text-text-secondary transition hover:text-strong"
                          >
                            {showReplies ? "Hide replies" : `View replies (${visibleReplyCount})`}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 self-start">
                        <button
                          type="button"
                          onClick={() => void handleCommentLikeToggle(comment)}
                          className={`inline-flex items-center ${
                            comment.userLiked ? "text-brand" : "text-text-light"
                          }`}
                          aria-label={comment.userLiked ? "Unlike comment" : "Like comment"}
                        >
                          <HeartIcon filled={comment.userLiked} className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportClick(comment)}
                          className="inline-flex h-8 w-8 items-center justify-center text-text-light transition hover:text-strong"
                          aria-label="Report comment"
                        >
                          <MoreHorizontalIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {showReplies ? (
                      <div className="mt-2.5 space-y-[10px] pl-2">
                        {thread?.loading ? <p className="pl-[72px] text-sm text-text-light">Loading replies…</p> : null}

                        {thread?.error ? (
                          <div className="pl-[72px]">
                            <p className="text-sm text-text-secondary">{thread.error}</p>
                            <button
                              type="button"
                              onClick={() => void loadReplies(comment.id)}
                              className="mt-1 text-sm font-semibold text-brand"
                            >
                              Retry
                            </button>
                          </div>
                        ) : null}

                        {thread?.items.map((reply, index) => {
                          const hasMore = Boolean(thread?.nextCursor);
                          const isLastReply = index === (thread?.items.length ?? 0) - 1 && !hasMore;
                          return renderReplyNode(reply, comment.id, {
                            depth: 1,
                            ancestorHasNext: [],
                            isLast: isLastReply,
                          });
                        })}

                        {thread?.nextCursor ? (
                          <button
                            type="button"
                            onClick={() => void loadReplies(comment.id, thread.nextCursor ?? undefined)}
                            disabled={thread.loadingMore}
                            className="pl-[72px] text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                          >
                            {thread.loadingMore ? "Loading more…" : "View more replies"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {nextCursor ? (
              <div className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => void loadComments({ cursor: nextCursor, replace: false })}
                  disabled={commentsStatus === "loading-more"}
                  className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                >
                  {commentsStatus === "loading-more" ? "Loading…" : "Load more comments"}
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="sticky bottom-0 border-t border-border/70 bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {canShowComposer ? (
            <>
              {replyTarget ? (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-bg-muted px-3 py-2">
                  <p className="truncate text-sm text-text-secondary">
                    Replying to <span className="font-semibold text-strong">{replyTarget.authorName}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="text-sm font-semibold text-text-secondary transition hover:text-strong"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateComment();
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary">
                    <img
                      src={composerAvatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={handleProfileImageError}
                    />
                  </div>
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-brand">
                    <span className="text-[2.2rem] leading-none">+</span>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[24px] bg-bg-muted px-4 py-2.5">
                    <input
                      ref={composerInputRef}
                      value={composerText}
                      onChange={(event) => setComposerText(event.target.value)}
                      placeholder="Add a comment..."
                      className="h-8 min-w-0 flex-1 bg-transparent text-[1.2rem] text-strong placeholder:text-text-light focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isSubmitting}
                      maxLength={2000}
                    />

                    {isSubmitting || hasComposerDraft ? (
                      <button
                        type="submit"
                        disabled={isSubmitting || !hasComposerDraft}
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={isSubmitting ? "Posting comment" : "Post comment"}
                      >
                        <ArrowUpIcon className="h-5 w-5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="py-2 text-center text-[1.05rem] text-text-secondary">{lockedMessage}</div>
          )}
        </footer>

        {reportTarget ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={closeReportDialog}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border/70 bg-bg p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-strong">Report comment</h2>
                <button
                  type="button"
                  onClick={closeReportDialog}
                  disabled={isReportSubmitting}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong disabled:opacity-60"
                  aria-label="Close report dialog"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <p className="mb-3 text-sm text-text-secondary">
                Reporting {reportTarget.authorName}&rsquo;s comment helps keep the community safe.
              </p>

              <div className="space-y-1">
                {REPORT_REASON_OPTIONS.map((reason) => (
                  <label key={reason} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-muted">
                    <input
                      type="radio"
                      name={`report-comment-reason-${reportTarget.id}`}
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason)}
                      disabled={isReportSubmitting}
                    />
                    <span className="text-sm text-strong">{reason}</span>
                  </label>
                ))}
              </div>

              {reportRequiresCustomReason ? (
                <textarea
                  value={reportCustomReason}
                  onChange={(event) => setReportCustomReason(event.target.value)}
                  className="mt-3 h-24 w-full resize-none rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm text-strong outline-none focus:border-brand"
                  placeholder="Enter report reason"
                  disabled={isReportSubmitting}
                />
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReportDialog}
                  disabled={isReportSubmitting}
                  className="rounded-full border border-border/70 px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleReportSubmit()}
                  disabled={isReportSubmitting || isReportInvalid}
                  className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
                >
                  {isReportSubmitting ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  );

  return <AppLayout activeNavId="home">{content}</AppLayout>;
}
