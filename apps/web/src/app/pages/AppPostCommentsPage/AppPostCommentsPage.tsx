import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { PostMediaGrid } from "@/app/components/PostMediaGrid/PostMediaGrid";
import { useToast } from "@/app/components/AppToast/AppToast";
import {
  CommentsApiError,
  createPostComment,
  fetchCommentReplies,
  fetchPostComments,
  fetchPostDetail,
  setCommentLiked,
} from "@/lib/commentsApi";
import { type ResolvedMediaAsset, resolveMediaAssets } from "@/lib/mediaApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

type AppPostCommentsPageProps = {
  postId: string;
};

type PostSummary = {
  id: string;
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
    (author ? pickString(author, ["anon_profile_id", "anonProfileId", "id"]) : undefined);

  const createdRaw = pickString(payload, ["created_at", "createdAt", "timestamp", "created"]);
  const compact = formatCompactTimeAgo(createdRaw);

  return {
    id,
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

function messageForWriteError(code?: string, fallback = "This action isn't available right now."): string {
  if (!code) return fallback;
  if (code === "community_not_verified" || code === "user_not_verified") {
    return "You must be verified in this community. Verify in the iOS app.";
  }
  if (code === "verification_expired") {
    return "Your verification expired. Re-verify in the iOS app.";
  }
  if (code === "specialization_not_joined") return "Join this major or field first.";
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

export function AppPostCommentsPage({ postId }: AppPostCommentsPageProps) {
  const navigate = useNavigate();
  const composerInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

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
    void loadPostDetail();
    void loadComments({ replace: true });
  }, [loadComments, loadPostDetail]);

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

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
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
            message: parsed.message ?? messageForWriteError(parsed.error),
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
    [showToast, updateCommentById]
  );

  const handleReplyClick = useCallback((comment: CommentView) => {
    setReplyTarget({ id: comment.id, authorName: comment.authorName });
    window.setTimeout(() => {
      composerInputRef.current?.focus();
    }, 0);
  }, []);

  const handleCreateComment = useCallback(async () => {
    const trimmed = composerText.trim();
    if (!trimmed || isSubmitting) return;

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
          message: parsed.message ?? messageForWriteError(parsed.error),
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
  }, [composerText, isSubmitting, postId, replyTarget, showToast]);

  const title = useMemo(() => {
    const count = post?.commentsCount ?? comments.length;
    return `${count} comment${count === 1 ? "" : "s"}`;
  }, [comments.length, post?.commentsCount]);

  return (
    <AppLayout activeNavId="home">
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-bg">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 py-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-strong transition hover:text-strong/80"
              aria-label="Back"
            >
              <ChevronLeftIcon className="h-5 w-5" />
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

          <section className="divide-y divide-border/50">
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
                <article key={comment.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={comment.authorProfileImageUrl}
                      alt={`View ${comment.authorName}'s profile`}
                      href={comment.authorProfileHref}
                      sizeClassName="h-10 w-10"
                    />

                    <div className="min-w-0 flex-1">
                      {comment.content ? <p className="text-[1.5rem] leading-snug text-strong">{comment.content}</p> : null}
                      {comment.mediaAssetIds.length > 0 ? (
                        <PostMediaGrid
                          attachments={orderedResolvedMedia(comment.mediaAssetIds)}
                          className={comment.content ? "mt-2" : "mt-0.5"}
                        />
                      ) : null}
                      <p className="mt-1 text-xl text-text-secondary">{comment.authorName}</p>
                      <div className="mt-1 flex items-center gap-3 text-base text-text-light">
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
                        <div className="mt-3 space-y-3 border-l border-border/60 pl-4">
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
                                {reply.content ? <p className="text-lg leading-snug text-strong">{reply.content}</p> : null}
                                {reply.mediaAssetIds.length > 0 ? (
                                  <PostMediaGrid
                                    attachments={orderedResolvedMedia(reply.mediaAssetIds)}
                                    className={reply.content ? "mt-2" : "mt-0.5"}
                                  />
                                ) : null}
                                <div className="mt-1 flex items-center gap-3 text-sm text-text-light">
                                  <span className="text-text-secondary">{reply.authorName}</span>
                                  {reply.createdAtLabel ? <span>{reply.createdAtLabel}</span> : null}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleCommentLikeToggle(reply)}
                                className={`inline-flex items-center gap-1 text-sm ${reply.userLiked ? "text-brand" : "text-text-light"}`}
                                aria-label={reply.userLiked ? "Unlike reply" : "Like reply"}
                              >
                                <HeartIcon filled={reply.userLiked} className="h-4 w-4" />
                                {reply.likesCount > 0 ? <span>{reply.likesCount}</span> : null}
                              </button>
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

                    <button
                      type="button"
                      onClick={() => void handleCommentLikeToggle(comment)}
                      className={`inline-flex items-center gap-1 self-center text-sm ${
                        comment.userLiked ? "text-brand" : "text-text-light"
                      }`}
                      aria-label={comment.userLiked ? "Unlike comment" : "Like comment"}
                    >
                      <HeartIcon filled={comment.userLiked} className="h-5 w-5" />
                      {comment.likesCount > 0 ? <span>{comment.likesCount}</span> : null}
                    </button>
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
            className="flex items-center gap-2"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center text-3xl leading-none text-brand">+</div>

            <input
              ref={composerInputRef}
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              placeholder={replyTarget ? `Reply to ${replyTarget.authorName}...` : "Add a comment..."}
              className="h-11 min-w-0 flex-1 rounded-full bg-bg-muted px-4 text-lg text-strong placeholder:text-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              disabled={isSubmitting}
              maxLength={2000}
            />

            <button
              type="submit"
              disabled={isSubmitting || composerText.trim().length === 0}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:bg-bg-muted disabled:text-text-light"
            >
              {isSubmitting ? "Posting…" : "Post"}
            </button>
          </form>
        </footer>
      </div>
    </AppLayout>
  );
}
