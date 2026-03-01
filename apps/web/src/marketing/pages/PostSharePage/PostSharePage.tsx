import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { PostMediaGrid } from "@/app/components/PostMediaGrid/PostMediaGrid";
import { MenuDots } from "@/app/components/AppIcons/AppIcons";
import type { ResolvedMediaAsset } from "@/lib/mediaApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePoll, type PostPoll } from "@/lib/postPoll";
import {
  PostShareApiError,
  fetchSharedCommentReplies,
  fetchSharedPostComments,
  fetchSharedPostDetail,
  resolveSharedMediaAssets,
} from "@/lib/postShareApi";
import { useUserSession } from "@/hooks/useUserSession";
import { Navbar } from "@/marketing/components/Navbar/Navbar";

const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";

type PostSharePageProps = {
  postId: string;
};

type SharedPost = {
  id: string;
  content: string;
  authorName: string;
  authorProfileImageUrl?: string;
  authorProfileHref?: string;
  authorSubtitle?: string;
  authorContext?: string;
  communityName?: string;
  createdAtLabel: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  mediaAssetIds: string[];
  directMediaUrl?: string;
  directMediaMimeType?: string;
  poll?: PostPoll;
};

type SharedComment = {
  id: string;
  content: string;
  authorName: string;
  authorProfileImageUrl?: string;
  createdAtLabel: string;
  likesCount: number;
  replyCount: number;
  parentId?: string;
  mediaAssetIds: string[];
  replies: SharedComment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
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
    if (value) return value;
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
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatTimeAgo(value: unknown): string {
  const date = asDate(value);
  if (!date) return "";
  const diffSeconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${Math.max(1, diffMonths)}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${Math.max(1, diffYears)}y ago`;
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

function handleAvatarError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

function normalizeSharedPost(payload: unknown): SharedPost | null {
  if (!isRecord(payload)) return null;
  const id = pickString(payload, ["id", "post_id", "postId"]);
  if (!id) return null;

  const author = isRecord(payload.author) ? payload.author : null;
  const authorName =
    (author
      ? pickString(author, ["display_name", "displayName", "name", "username", "handle", "author_display_name"])
      : undefined) ??
    pickString(payload, [
      "author_display_name",
      "authorDisplayName",
      "author_name",
      "authorName",
      "author_handle",
      "authorHandle",
    ]) ??
    "User";

  const authorId =
    pickString(payload, ["author_id", "authorId", "user_id", "userId"]) ??
    (author ? pickString(author, ["id", "user_id", "userId"]) : undefined);

  const directMediaUrl = pickString(payload, ["cdn_url", "cdnUrl", "media_url", "mediaUrl", "url"]);
  const directMediaMimeType = pickString(payload, ["mime_type", "mimeType", "media_mime_type", "mediaMimeType"]);
  const authorDisplayCommunity = pickString(payload, [
    "author_display_community",
    "authorDisplayCommunity",
    "author_display_company",
    "authorDisplayCompany",
  ]);
  const authorDisplaySpecialization = pickString(payload, [
    "author_display_specialization",
    "authorDisplaySpecialization",
  ]);
  const communityName = pickString(payload, ["community_short_name", "communityShortName", "community_name", "communityName"]);

  const authorSubtitle = authorDisplaySpecialization
    ? `${authorDisplaySpecialization}${authorDisplayCommunity ? ` @ ${authorDisplayCommunity}` : ""}`
    : authorDisplayCommunity
      ? `@ ${authorDisplayCommunity}`
      : undefined;
  const authorContext = communityName ? `Posted in ${communityName}` : undefined;

  return {
    id,
    content: pickString(payload, ["content", "text", "body", "message"]) ?? "",
    authorName,
    authorProfileImageUrl:
      (author ? pickString(author, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) : undefined) ??
      pickString(payload, ["author_profile_image_url", "authorProfileImageUrl"]),
    authorProfileHref: authorId ? `/app/profile/${authorId}` : undefined,
    authorSubtitle,
    authorContext,
    communityName,
    createdAtLabel: formatTimeAgo(pickString(payload, ["created_at", "createdAt", "timestamp", "created"])),
    likesCount: pickNumber(payload, ["likes_count", "likesCount"]) ?? 0,
    commentsCount: pickNumber(payload, ["comments_count", "commentsCount", "comment_count", "commentCount"]) ?? 0,
    sharesCount: pickNumber(payload, ["share_count", "shareCount", "shares_count", "sharesCount"]) ?? 0,
    mediaAssetIds: extractMediaAssetIds(payload),
    directMediaUrl,
    directMediaMimeType,
    poll: normalizePoll(payload.poll),
  };
}

function isAnonymousAuthor(source: Record<string, unknown>, author: Record<string, unknown> | null): boolean {
  return (
    pickBoolean(source, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ??
    (author ? pickBoolean(author, ["is_anonymous", "isAnonymous"]) : undefined) ??
    false
  );
}

function normalizeSharedComment(payload: unknown): SharedComment | null {
  if (!isRecord(payload)) return null;
  const id = pickString(payload, ["id", "comment_id", "commentId"]);
  if (!id) return null;

  const author = isRecord(payload.author) ? payload.author : null;
  const isAnonymous = isAnonymousAuthor(payload, author);
  const isDeleted = pickBoolean(payload, ["is_deleted", "isDeleted"]) ?? false;
  const isUnderReview = pickBoolean(payload, ["is_under_review", "isUnderReview"]) ?? false;
  const rawContent = pickString(payload, ["content", "text", "body", "message"]) ?? "";
  const content = isDeleted ? "Comment deleted" : isUnderReview ? "Comment under review" : rawContent;

  const authorName = isAnonymous
    ? "Anonymous"
    : (author
        ? pickString(author, ["display_name", "displayName", "name", "username", "handle", "author_display_name"])
        : undefined) ??
      pickString(payload, [
        "author_display_name",
        "authorDisplayName",
        "author_name",
        "authorName",
        "author_handle",
        "authorHandle",
      ]) ??
      "User";

  return {
    id,
    content,
    authorName,
    authorProfileImageUrl:
      (author ? pickString(author, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) : undefined) ??
      pickString(payload, ["author_profile_image_url", "authorProfileImageUrl"]),
    createdAtLabel: formatCompactTimeAgo(pickString(payload, ["created_at", "createdAt", "timestamp", "created"])),
    likesCount: pickNumber(payload, ["likes_count", "likesCount"]) ?? 0,
    replyCount: pickNumber(payload, ["reply_count", "replyCount"]) ?? 0,
    parentId: pickString(payload, ["parent_id", "parentId"]),
    mediaAssetIds: isDeleted || isUnderReview ? [] : extractMediaAssetIds(payload),
    replies: [],
  };
}

function nextCursorFromEnvelope(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return pickString(payload, ["next_cursor", "nextCursor"]) ?? null;
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

function pollStatusLabel(poll: PostPoll): string {
  if (!isPollOpen(poll)) return "Final results";
  if (!poll.closesAt) return "No end";
  const closesAtMs = new Date(poll.closesAt).getTime();
  if (Number.isNaN(closesAtMs)) return "Open";
  const diffMs = closesAtMs - Date.now();
  if (diffMs <= 0) return "Final results";
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMinutes < 60) return `Ends in ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Ends in ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Ends in ${Math.max(1, diffDays)}d`;
}

async function loadAllSharedCommentPages(postId: string): Promise<SharedComment[]> {
  let cursor: string | undefined;
  const visited = new Set<string>();
  const output: SharedComment[] = [];

  while (true) {
    const page = await fetchSharedPostComments({ postId, limit: 100, cursor });
    const items = Array.isArray(page.items) ? page.items : [];
    for (const item of items) {
      const normalized = normalizeSharedComment(item);
      if (!normalized || normalized.parentId) continue;
      output.push(normalized);
    }

    const nextCursor = nextCursorFromEnvelope(page);
    if (!nextCursor || visited.has(nextCursor)) break;
    visited.add(nextCursor);
    cursor = nextCursor;
  }

  return output;
}

async function loadAllSharedReplyPages(commentId: string): Promise<SharedComment[]> {
  let cursor: string | undefined;
  const visited = new Set<string>();
  const output: SharedComment[] = [];

  while (true) {
    const page = await fetchSharedCommentReplies({ commentId, limit: 100, cursor });
    const items = Array.isArray(page.items) ? page.items : [];
    for (const item of items) {
      const normalized = normalizeSharedComment(item);
      if (!normalized) continue;
      output.push(normalized);
    }

    const nextCursor = nextCursorFromEnvelope(page);
    if (!nextCursor || visited.has(nextCursor)) break;
    visited.add(nextCursor);
    cursor = nextCursor;
  }

  return output;
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className ?? ""}`}
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

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 14a4 4 0 0 1-4 4H8l-5 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" />
    </svg>
  );
}

function RepostIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 640"
      className={`shrink-0 ${className ?? ""}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M150.6 105.4C138.1 92.9 117.8 92.9 105.3 105.4L41.3 169.4C32.1 178.6 29.4 192.3 34.4 204.3C39.4 216.3 51.1 224 64 224L96 224L96 448C96 501 139 544 192 544L320 544C337.7 544 352 529.7 352 512C352 494.3 337.7 480 320 480L192 480C174.3 480 160 465.7 160 448L160 224L192 224C204.9 224 216.6 216.2 221.6 204.2C226.6 192.2 223.8 178.5 214.7 169.3L150.7 105.3zM489.4 534.6C501.9 547.1 522.2 547.1 534.7 534.6L598.7 470.6C607.9 461.4 610.6 447.7 605.6 435.7C600.6 423.7 588.9 416 576 416L544 416L544 192C544 139 501 96 448 96L320 96C302.3 96 288 110.3 288 128C288 145.7 302.3 160 320 160L448 160C465.7 160 480 174.3 480 192L480 416L448 416C435.1 416 423.4 423.8 418.4 435.8C413.4 447.8 416.2 461.5 425.3 470.7L489.3 534.7z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block bg-current [mask-image:url('/icons/actions/send.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/icons/actions/send.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain] ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2h12a2 2 0 0 1 2 2v20l-8-5-8 5V4a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function PostSharePage({ postId }: PostSharePageProps) {
  const navigate = useNavigate();
  const { status: sessionStatus } = useUserSession();

  const [viewStatus, setViewStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [post, setPost] = useState<SharedPost | null>(null);
  const [media, setMedia] = useState<ResolvedMediaAsset[]>([]);
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentMediaById, setCommentMediaById] = useState<Record<string, ResolvedMediaAsset>>({});

  const sharePath = useMemo(() => `/p/${encodeURIComponent(postId)}`, [postId]);
  const authenticatedCommentsDestination = useMemo(
    () => `/app?comments=${encodeURIComponent(postId)}&fromSharePreviewRedirect=1`,
    [postId]
  );

  const navigateToLogin = useCallback(
    (intent: "comment" | "like") => {
      const next = `${sharePath}?intent=${intent}`;
      navigate(`/login?next=${encodeURIComponent(next)}`);
    },
    [navigate, sharePath]
  );

  const handleActionIntent = useCallback(
    (intent: "comment" | "like") => {
      if (sessionStatus !== "authenticated") {
        navigateToLogin(intent);
        return;
      }
      navigate(authenticatedCommentsDestination);
    },
    [authenticatedCommentsDestination, navigate, navigateToLogin, sessionStatus]
  );

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !postId) return;
    navigate(authenticatedCommentsDestination, {
      replace: true,
    });
  }, [authenticatedCommentsDestination, navigate, postId, sessionStatus]);

  useEffect(() => {
    if (!postId) {
      setViewStatus("error");
      setErrorMessage("Invalid post link.");
      return;
    }

    let active = true;
    setViewStatus("loading");
    setErrorMessage(null);

    void fetchSharedPostDetail(postId)
      .then((payload) => {
        if (!active) return;
        const normalized = normalizeSharedPost(payload);
        if (!normalized) {
          setViewStatus("error");
          setErrorMessage("Unable to load this post.");
          return;
        }
        setPost(normalized);
        setViewStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof PostShareApiError) {
          if (error.status === 404) {
            setViewStatus("error");
            setErrorMessage("This post was not found.");
            return;
          }
          if (error.status === 410) {
            setViewStatus("error");
            setErrorMessage("This post is unavailable.");
            return;
          }
        }
        setViewStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to load this post.");
      });

    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    if (!post) {
      setMedia([]);
      return;
    }

    if (post.mediaAssetIds.length > 0) {
      let active = true;
      void resolveSharedMediaAssets(post.mediaAssetIds)
        .then((resolved) => {
          if (!active) return;
          if (resolved.length > 0) {
            setMedia(resolved);
            return;
          }
          if (post.directMediaUrl) {
            setMedia([
              {
                id: `inline-${post.id}`,
                cdnUrl: post.directMediaUrl,
                mimeType: post.directMediaMimeType,
              },
            ]);
            return;
          }
          setMedia([]);
        })
        .catch(() => {
          if (!active) return;
          if (post.directMediaUrl) {
            setMedia([
              {
                id: `inline-${post.id}`,
                cdnUrl: post.directMediaUrl,
                mimeType: post.directMediaMimeType,
              },
            ]);
            return;
          }
          setMedia([]);
        });

      return () => {
        active = false;
      };
    }

    if (post.directMediaUrl) {
      setMedia([
        {
          id: `inline-${post.id}`,
          cdnUrl: post.directMediaUrl,
          mimeType: post.directMediaMimeType,
        },
      ]);
      return;
    }

    setMedia([]);
  }, [post]);

  useEffect(() => {
    if (!postId) {
      setComments([]);
      setCommentsStatus("idle");
      setCommentsError(null);
      return;
    }

    let active = true;
    setCommentsStatus("loading");
    setCommentsError(null);

    void loadAllSharedCommentPages(postId)
      .then(async (topLevel) => {
        if (!active) return;
        const withReplies = await Promise.all(
          topLevel.map(async (comment) => {
            if (comment.replyCount <= 0) return comment;
            try {
              const replies = await loadAllSharedReplyPages(comment.id);
              return {
                ...comment,
                replies,
              };
            } catch {
              return comment;
            }
          })
        );

        if (!active) return;
        setComments(withReplies);
        setCommentsStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof PostShareApiError) {
          if (error.status === 404) {
            setCommentsError("Comments unavailable because this post was not found.");
            setCommentsStatus("error");
            return;
          }
          if (error.status === 410) {
            setCommentsError("Comments unavailable because this post is unavailable.");
            setCommentsStatus("error");
            return;
          }
        }
        setCommentsError(error instanceof Error ? error.message : "Unable to load comments.");
        setCommentsStatus("error");
      });

    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    const ids: string[] = [];
    const seen = new Set<string>();

    const collect = (comment: SharedComment) => {
      for (const id of comment.mediaAssetIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      for (const reply of comment.replies) {
        collect(reply);
      }
    };

    for (const comment of comments) {
      collect(comment);
    }

    if (ids.length === 0) {
      setCommentMediaById({});
      return;
    }

    let active = true;
    void resolveSharedMediaAssets(ids)
      .then((resolved) => {
        if (!active) return;
        const next: Record<string, ResolvedMediaAsset> = {};
        for (const asset of resolved) {
          next[asset.id] = asset;
        }
        setCommentMediaById(next);
      })
      .catch(() => {
        if (!active) return;
        setCommentMediaById({});
      });

    return () => {
      active = false;
    };
  }, [comments]);

  const mediaForComment = useCallback(
    (mediaIds: string[]): ResolvedMediaAsset[] => mediaIds.map((id) => commentMediaById[id]).filter(Boolean),
    [commentMediaById]
  );

  return (
    <div className="min-h-screen bg-shell-bg">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl pb-16 pt-4 sm:pt-6">
        <div className="flex flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
          <p className="whitespace-nowrap text-[1.38rem] font-semibold leading-tight text-strong">Shared Post</p>
          <Link
            to={
              sessionStatus === "authenticated"
                ? authenticatedCommentsDestination
                : `/login?next=${encodeURIComponent(`${sharePath}?intent=comment`)}`
            }
            className="text-[0.95rem] text-text-secondary underline-offset-2 transition hover:text-strong hover:underline"
          >
            <span className="underline decoration-current underline-offset-2">Sign in</span> to comment, like, repost, and join the discussion.
          </Link>
        </div>
        <section className="overflow-hidden border border-border/70 bg-bg sm:rounded-2xl">

          {viewStatus === "loading" ? (
            <div className="px-5 py-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/2 rounded-full bg-bg-muted" />
                <div className="h-4 w-full rounded-full bg-bg-muted" />
                <div className="h-4 w-5/6 rounded-full bg-bg-muted" />
              </div>
            </div>
          ) : null}

          {viewStatus === "error" ? (
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-strong">Unable to load this post</p>
              <p className="mt-1 text-sm text-text-secondary">{errorMessage ?? "Try again later."}</p>
            </div>
          ) : null}

          {viewStatus === "ready" && post ? (
            <>
              <article className="bg-bg px-4 py-5 sm:px-5">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex flex-1 items-start gap-3">
                      <img
                        src={post.authorProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        loading="lazy"
                        onError={handleAvatarError}
                      />

                      <div className="min-w-0">
                        <div className="flex min-w-0 items-baseline gap-1 leading-tight">
                          <p className="shrink-0 truncate text-[1.12rem] font-semibold text-strong">{post.authorName}</p>
                          {post.authorSubtitle ? (
                            <>
                              <span className="shrink-0 text-[1.08rem] leading-none text-text-light">·</span>
                              <p className="min-w-0 flex-1 truncate text-[1.03rem] text-text-secondary">{post.authorSubtitle}</p>
                            </>
                          ) : null}
                        </div>
                        {post.authorContext ? <p className="mt-0.5 text-[0.95rem] leading-tight text-text-secondary">{post.authorContext}</p> : null}
                      </div>
                    </div>

                    <button
                      className="text-text-light transition hover:text-strong"
                      type="button"
                      aria-label="Post options"
                      onClick={() => void handleActionIntent("comment")}
                    >
                      <MenuDots className="h-5 w-5" />
                    </button>
                  </div>

                  {post.content ? (
                    <p className="mt-3 whitespace-pre-wrap text-[1.08rem] leading-[1.45] text-text-primary">{post.content}</p>
                  ) : null}

                  {post.poll ? (
                    <section className="mt-3 space-y-2.5">
                      <p className="text-[1.02rem] font-medium leading-snug text-text-primary">{post.poll.question}</p>
                      <div className="space-y-2">
                        {post.poll.options.map((option) => (
                          <div
                            key={option.id}
                            className="relative w-full overflow-hidden rounded-xl border border-border/70 bg-bg-muted/45 px-3 py-2.5"
                          >
                            <span
                              className="absolute inset-y-0 left-0 bg-bg-muted/70"
                              style={{ width: `${clampPercent(option.votePercent)}%` }}
                              aria-hidden="true"
                            />
                            <span className="relative z-10 flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-text-primary">{option.text}</span>
                              <span className="text-xs font-semibold text-text-secondary tabular-nums">
                                {Math.round(option.votePercent)}%
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[0.85rem] text-text-light">
                        <span>{pollStatusLabel(post.poll)}</span>
                        <span>
                          {post.poll.totalVotes} {post.poll.totalVotes === 1 ? "vote" : "votes"}
                        </span>
                      </div>
                    </section>
                  ) : null}

                  {media.length > 0 ? <PostMediaGrid attachments={media} className="mt-3" /> : null}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <button
                        type="button"
                        onClick={() => handleActionIntent("like")}
                        className="inline-flex items-center gap-1 text-[1rem] font-medium text-text-secondary transition hover:text-strong"
                        aria-label="Like"
                      >
                        <HeartIcon className="h-[22px] w-[22px] flex-none" />
                        <span className="text-[1.02rem] font-medium tabular-nums">{post.likesCount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleActionIntent("comment")}
                        className="inline-flex items-center gap-1 text-[1rem] font-medium text-text-secondary transition hover:text-strong"
                        aria-label="Comment"
                      >
                        <CommentIcon className="h-[22px] w-[22px] flex-none" />
                        <span className="text-[1.02rem] font-medium tabular-nums">{post.commentsCount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleActionIntent("comment")}
                        className="inline-flex items-center text-[1rem] font-medium text-text-secondary transition hover:text-strong"
                        aria-label="Repost"
                      >
                        <RepostIcon className="h-[24px] w-[24px] flex-none" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleActionIntent("comment")}
                        className="inline-flex items-center gap-1 text-[1rem] font-medium text-text-secondary transition hover:text-strong"
                        aria-label="Share"
                      >
                        <ShareIcon className="h-[22px] w-[22px] flex-none" />
                        <span className="text-[1.02rem] font-medium tabular-nums">{post.sharesCount}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleActionIntent("comment")}
                      className="inline-flex items-center justify-center text-text-secondary transition hover:text-strong"
                      aria-label="Save"
                    >
                      <BookmarkIcon className="h-[22px] w-[22px] flex-none" />
                    </button>
                  </div>

                  {post.createdAtLabel ? <p className="mt-2 text-[0.95rem] text-text-light">{post.createdAtLabel}</p> : null}
                </div>
              </article>

              <section className="border-t border-border/70">
                <div className="px-4 py-3 sm:px-5">
                  <h2 className="text-[1.03rem] font-semibold text-strong">Comments</h2>
                </div>

                {commentsStatus === "loading" ? (
                  <div className="space-y-2 border-t border-border/60 px-4 py-4 sm:px-5">
                    <div className="h-4 w-3/4 rounded-full bg-bg-muted" />
                    <div className="h-4 w-1/2 rounded-full bg-bg-muted" />
                    <div className="h-4 w-2/3 rounded-full bg-bg-muted" />
                  </div>
                ) : null}

                {commentsStatus === "error" ? (
                  <div className="border-t border-border/60 px-4 py-4 sm:px-5">
                    <p className="text-sm text-text-secondary">{commentsError ?? "Unable to load comments."}</p>
                  </div>
                ) : null}

                {commentsStatus === "ready" && comments.length === 0 ? (
                  <div className="border-t border-border/60 px-4 py-5 text-sm text-text-secondary sm:px-5">No comments yet.</div>
                ) : null}

                {commentsStatus === "ready" && comments.length > 0 ? (
                  <div className="border-t border-border/60">
                    {comments.map((comment) => (
                      <article key={comment.id} className="px-4 py-3.5 sm:px-5">
                        <div className="flex items-start gap-3">
                          <img
                            src={comment.authorProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                            loading="lazy"
                            onError={handleAvatarError}
                          />
                          <div className="min-w-0 flex-1">
                            {comment.content ? <p className="text-[1.1rem] leading-[1.32] text-strong">{comment.content}</p> : null}
                            {comment.mediaAssetIds.length > 0 ? (
                              <PostMediaGrid
                                attachments={mediaForComment(comment.mediaAssetIds)}
                                className={comment.content ? "mt-2.5" : "mt-0.5"}
                              />
                            ) : null}
                            <div className="mt-0.5 flex items-center gap-2.5 text-[0.92rem] text-text-light">
                              <span className="font-medium text-text-secondary">{comment.authorName}</span>
                              {comment.createdAtLabel ? <span>{comment.createdAtLabel}</span> : null}
                              {comment.likesCount > 0 ? <span>{comment.likesCount} likes</span> : null}
                            </div>

                            {comment.replies.length > 0 ? (
                              <div className="mt-2.5 space-y-2.5 border-l border-border/60 pl-4">
                                {comment.replies.map((reply) => (
                                  <div key={reply.id} className="flex items-start gap-2.5">
                                    <img
                                      src={reply.authorProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                                      alt=""
                                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                                      loading="lazy"
                                      onError={handleAvatarError}
                                    />
                                    <div className="min-w-0 flex-1">
                                      {reply.content ? <p className="text-[0.98rem] leading-[1.3] text-strong">{reply.content}</p> : null}
                                      {reply.mediaAssetIds.length > 0 ? (
                                        <PostMediaGrid
                                          attachments={mediaForComment(reply.mediaAssetIds)}
                                          className={reply.content ? "mt-2" : "mt-0.5"}
                                        />
                                      ) : null}
                                      <div className="mt-0.5 flex items-center gap-2.5 text-[0.82rem] text-text-light">
                                        <span className="font-medium text-text-secondary">{reply.authorName}</span>
                                        {reply.createdAtLabel ? <span>{reply.createdAtLabel}</span> : null}
                                        {reply.likesCount > 0 ? <span>{reply.likesCount} likes</span> : null}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>

            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
