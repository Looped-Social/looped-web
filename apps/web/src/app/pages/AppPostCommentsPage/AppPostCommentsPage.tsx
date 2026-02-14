import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { PostMediaGrid } from "@/app/components/PostMediaGrid/PostMediaGrid";
import { useToast } from "@/app/components/AppToast/AppToast";
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
  content: string;
  authorName: string;
  authorProfileHref?: string;
  authorProfileImageUrl?: string;
  createdAtLabel: string;
  commentsCount: number;
  isAnonymous: boolean;
  mediaAssetIds: string[];
};

type CommentView = {
  id: string;
  content: string;
  authorName: string;
  authorProfileHref?: string;
  authorProfileImageUrl?: string;
  createdAtLabel: string;
  likesCount: number;
  replyCount: number;
  userLiked: boolean;
  parentId?: string;
  mediaAssetIds: string[];
};

type ReplyThreadState = {
  open: boolean;
  loading: boolean;
  loadingMore: boolean;
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

function normalizePostDetail(payload: unknown): PostSummary | null {
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

  return {
    id,
    communityId: pickString(payload, ["community_id", "communityId"]),
    communityName: pickString(payload, ["community_short_name", "communityShortName", "community_name", "communityName"]),
    content: pickString(payload, ["content", "text", "body", "message"]) ?? "",
    authorName: resolveAuthorName(payload, author, isAnonymous),
    authorProfileHref: resolveProfileHref({ isAnonymous, authorId, anonProfileId }),
    authorProfileImageUrl:
      (author ? pickString(author, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) : undefined) ??
      pickString(payload, ["author_profile_image_url", "authorProfileImageUrl"]),
    createdAtLabel: compact ? `${compact} ago` : "",
    commentsCount: pickNumber(payload, ["comments_count", "commentsCount", "comment_count", "commentCount"]) ?? 0,
    isAnonymous,
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
  const normalizedContent = pickString(payload, ["content", "text", "body", "message"]) ?? "";
  const content = isDeleted ? "Comment deleted" : isUnderReview ? "Comment under review" : normalizedContent;

  return {
    id,
    content,
    authorName: resolveAuthorName(payload, author, isAnonymous),
    authorProfileHref: resolveProfileHref({ isAnonymous, authorId, anonProfileId }),
    authorProfileImageUrl:
      (author ? pickString(author, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) : undefined) ??
      pickString(payload, ["author_profile_image_url", "authorProfileImageUrl"]),
    createdAtLabel: formatCompactTimeAgo(pickString(payload, ["created_at", "createdAt", "timestamp", "created"])),
    likesCount: pickNumber(payload, ["likes_count", "likesCount"]) ?? 0,
    replyCount: pickNumber(payload, ["reply_count", "replyCount"]) ?? 0,
    userLiked: pickBoolean(payload, ["user_liked", "userLiked"]) ?? false,
    parentId: pickString(payload, ["parent_id", "parentId"]),
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
  const { showToast } = useToast();
  const { user, status: currentUserStatus } = useCurrentUserStore({ autoLoad: true });

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
  const [replyTarget, setReplyTarget] = useState<{ id: string; authorName: string } | null>(null);
  const [permissions, setPermissions] = useState<CommunityPermissions | null>(null);
  const [permissionsStatus, setPermissionsStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [permissionsError, setPermissionsError] = useState(false);
  const [platformVerified, setPlatformVerified] = useState<boolean | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentView | null>(null);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASON_OPTIONS)[number]>("Spam");
  const [reportCustomReason, setReportCustomReason] = useState("");
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);

  const loadPostDetail = useCallback(async () => {
    setPostStatus("loading");
    setPostError(null);

    try {
      const response = await fetchPostDetail(postId);
      const normalized = normalizePostDetail(response);
      if (!normalized) throw new Error("Unable to load this post.");
      setPost(normalized);
      setPostStatus("idle");
    } catch (error) {
      const parsed = error instanceof CommentsApiError ? parseApiError(error.details) : {};
      setPostError(parsed.message ?? "Unable to load this post.");
      setPostStatus("error");
    }
  }, [postId]);

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
          .filter((item) => !item.parentId);

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
        .filter((item): item is CommentView => Boolean(item));

      setReplyThreads((previous) => {
        const current = previous[commentId] ?? initialReplyThread();
        return {
          ...previous,
          [commentId]: {
            ...current,
            open: true,
            loading: false,
            loadingMore: false,
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
    void loadPostDetail();
    void loadComments({ replace: true });
  }, [loadComments, loadPostDetail]);

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

  const handleReplyClick = useCallback((comment: CommentView) => {
    const blocker = getInteractionBlocker("comment");
    if (blocker) {
      showToast({
        title: blocker.title,
        message: blocker.message,
        tone: "error",
      });
      return;
    }

    setReplyTarget({ id: comment.id, authorName: comment.authorName });
    window.setTimeout(() => {
      composerInputRef.current?.focus();
    }, 0);
  }, [getInteractionBlocker, showToast]);

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
    const parentId = replyTarget?.id ?? null;

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
        setComments((previous) =>
          previous.map((item) =>
            item.id === created.parentId ? { ...item, replyCount: item.replyCount + 1 } : item
          )
        );

        setReplyThreads((previous) => {
          const thread = previous[created.parentId!];
          if (!thread) return previous;

          const nextItems = appendIfMissing([created], thread.items);
          return {
            ...previous,
            [created.parentId!]: {
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
  }, [composerText, getInteractionBlocker, isSubmitting, postId, replyTarget, showToast]);

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
            <div aria-hidden="true" />
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
            <section className="border-b border-border/70 px-5 py-5">
              <div className="flex items-start gap-3">
                <Avatar
                  src={post.authorProfileImageUrl}
                  alt={`View ${post.authorName}'s profile`}
                  href={post.authorProfileHref}
                  sizeClassName="h-11 w-11"
                />
                <div className="min-w-0 flex-1">
                  {post.content ? <p className="text-[2rem] leading-tight font-semibold text-strong">{post.content}</p> : null}
                  <p className="mt-2 text-xl text-text-secondary">{post.authorName}</p>
                  {post.createdAtLabel ? <p className="mt-1 text-base text-text-light">{post.createdAtLabel}</p> : null}
                  {post.mediaAssetIds.length > 0 ? (
                    <PostMediaGrid
                      attachments={orderedResolvedMedia(post.mediaAssetIds)}
                      className={post.content ? "mt-3" : "mt-2"}
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
              <div className="px-5 py-8 text-sm text-text-secondary">No comments yet. Start the conversation.</div>
            ) : null}

            {comments.map((comment) => {
              const thread = replyThreads[comment.id];
              const showReplies = thread?.open ?? false;

              return (
                <article key={comment.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={comment.authorProfileImageUrl}
                      alt={`View ${comment.authorName}'s profile`}
                      href={comment.authorProfileHref}
                      sizeClassName="h-10 w-10"
                    />

                    <div className="min-w-0 flex-1">
                      {comment.content ? <p className="text-[1.35rem] leading-[1.3] text-strong">{comment.content}</p> : null}
                      {comment.mediaAssetIds.length > 0 ? (
                        <PostMediaGrid
                          attachments={orderedResolvedMedia(comment.mediaAssetIds)}
                          className={comment.content ? "mt-2" : "mt-0.5"}
                        />
                      ) : null}
                      <p className="mt-0.5 text-[1.05rem] font-medium text-text-secondary">{comment.authorName}</p>
                      <div className="mt-0.5 flex items-center gap-2.5 text-[0.95rem] text-text-light">
                        {comment.createdAtLabel ? <span>{comment.createdAtLabel}</span> : null}
                        <button
                          type="button"
                          onClick={() => handleReplyClick(comment)}
                          className="font-medium text-text-secondary transition hover:text-strong"
                        >
                          Reply
                        </button>
                        {comment.replyCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (thread?.open) {
                                setReplyThreads((previous) => {
                                  const current = previous[comment.id] ?? initialReplyThread();
                                  return {
                                    ...previous,
                                    [comment.id]: {
                                      ...current,
                                      open: false,
                                    },
                                  };
                                });
                                return;
                              }
                              void loadReplies(comment.id);
                            }}
                            className="font-medium text-text-secondary transition hover:text-strong"
                          >
                            {showReplies ? "Hide replies" : `View replies (${comment.replyCount})`}
                          </button>
                        ) : null}
                      </div>

                      {showReplies ? (
                        <div className="mt-2.5 space-y-2.5 border-l border-border/60 pl-4">
                          {thread?.loading ? (
                            <p className="text-sm text-text-light">Loading replies…</p>
                          ) : null}

                          {thread?.error ? (
                            <div>
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

                          {thread?.items.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Avatar
                                src={reply.authorProfileImageUrl}
                                alt={`View ${reply.authorName}'s profile`}
                                href={reply.authorProfileHref}
                                sizeClassName="h-8 w-8"
                              />
                              <div className="min-w-0 flex-1">
                                {reply.content ? <p className="text-[1.02rem] leading-[1.3] text-strong">{reply.content}</p> : null}
                                {reply.mediaAssetIds.length > 0 ? (
                                  <PostMediaGrid
                                    attachments={orderedResolvedMedia(reply.mediaAssetIds)}
                                    className={reply.content ? "mt-2" : "mt-0.5"}
                                  />
                                ) : null}
                                <div className="mt-0.5 flex items-center gap-2.5 text-[0.85rem] text-text-light">
                                  <span className="font-medium text-text-secondary">{reply.authorName}</span>
                                  {reply.createdAtLabel ? <span>{reply.createdAtLabel}</span> : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleCommentLikeToggle(reply)}
                                  className={`inline-flex items-center gap-1 text-sm ${reply.userLiked ? "text-brand" : "text-text-light"}`}
                                  aria-label={reply.userLiked ? "Unlike reply" : "Like reply"}
                                >
                                  <HeartIcon filled={reply.userLiked} className="h-4 w-4" />
                                  {reply.likesCount > 0 ? <span>{reply.likesCount}</span> : null}
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
                          ))}

                          {thread?.nextCursor ? (
                            <button
                              type="button"
                              onClick={() => void loadReplies(comment.id, thread.nextCursor ?? undefined)}
                              disabled={thread.loadingMore}
                              className="text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                            >
                              {thread.loadingMore ? "Loading more…" : "Load more replies"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 self-center">
                      <button
                        type="button"
                        onClick={() => void handleCommentLikeToggle(comment)}
                        className={`inline-flex items-center gap-1 text-sm ${
                          comment.userLiked ? "text-brand" : "text-text-light"
                        }`}
                        aria-label={comment.userLiked ? "Unlike comment" : "Like comment"}
                      >
                        <HeartIcon filled={comment.userLiked} className="h-5 w-5" />
                        {comment.likesCount > 0 ? <span>{comment.likesCount}</span> : null}
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
                <div className="flex items-center gap-2 rounded-[24px] bg-bg-muted px-4 py-2.5">
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-brand">
                    <span className="text-[2.2rem] leading-none">+</span>
                  </div>

                  <input
                    ref={composerInputRef}
                    value={composerText}
                    onChange={(event) => setComposerText(event.target.value)}
                    placeholder={replyTarget ? `Reply to ${replyTarget.authorName}...` : "Add a comment..."}
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
