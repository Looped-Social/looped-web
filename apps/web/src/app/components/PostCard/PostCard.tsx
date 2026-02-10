import { type SyntheticEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { MenuDots } from "@/app/components/AppIcons/AppIcons";
import { PostMediaGrid } from "@/app/components/PostMediaGrid/PostMediaGrid";
import { useToast } from "@/app/components/AppToast/AppToast";
import type { CommunityPermissions } from "@/lib/communityPermissionsApi";
import { getCommunityPermissions } from "@/lib/communityPermissionsApi";
import { type ResolvedMediaAsset, resolveMediaAssets } from "@/lib/mediaApi";
import { PostActionsApiError, setPostLike, setPostReposted, setPostSaved, sharePost } from "@/lib/postActionsApi";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

export type PostData = {
  id: string;
  communityId?: string | number;
  repostedBy?: string;
  author: string;
  subtitle: string;
  context: string;
  content: string;
  time: string;
  authorProfileImageUrl?: string;
  authorProfileHref?: string;
  viewerLiked?: boolean;
  viewerSaved?: boolean;
  viewerHasReposted?: boolean;
  mediaAssetIds?: string[];
  stats: {
    likes: number;
    comments: number;
    reposts?: number;
    shares?: number;
    saves?: number;
  };
  isAnonymous: boolean;
};

type PostCardProps = {
  post: PostData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseApiError(details?: string): { error?: string; message?: string } {
  const trimmed = (details ?? "").trim();
  if (!trimmed) return {};
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) {
      const error = typeof parsed.error === "string" ? parsed.error : undefined;
      const message = typeof parsed.message === "string" ? parsed.message : undefined;
      return { error, message };
    }
  } catch {
    // ignore
  }
  return { message: trimmed };
}

function titleForWriteError(code?: string, fallbackTitle = "Action unavailable"): string {
  if (!code) return fallbackTitle;
  if (code === "community_not_verified" || code === "user_not_verified" || code === "verification_expired") {
    return "Verification required";
  }
  if (code === "specialization_not_joined") return "Join required";
  if (code === "community_banned") return "Community unavailable";
  return fallbackTitle;
}

function messageForWriteError(code?: string, fallbackMessage = "This action isn't available right now."): string {
  if (!code) return fallbackMessage;
  if (code === "community_not_verified" || code === "user_not_verified") {
    return "You must be verified in this community. Verify in the iOS app.";
  }
  if (code === "verification_expired") {
    return "Your verification expired. Re-verify in the iOS app.";
  }
  if (code === "specialization_not_joined") {
    return "Join this major or field first.";
  }
  if (code === "community_banned") {
    return "This community is currently unavailable.";
  }
  return fallbackMessage;
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={`shrink-0 ${className ?? ""}`} fill="currentColor" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    );
  }

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
    <img
      src="/ios-icons/action-send.svg"
      alt=""
      className={`shrink-0 object-contain ${className ?? ""}`}
      loading="lazy"
    />
  );
}

function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={`shrink-0 ${className ?? ""}`} fill="currentColor" aria-hidden="true">
        <path d="M6 2h12a2 2 0 0 1 2 2v20l-8-5-8 5V4a2 2 0 0 1 2-2z" />
      </svg>
    );
  }
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

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className ?? ""}`} fill="currentColor" aria-hidden="true">
      <path d="M17 10V8a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1zm-8 0V8a3 3 0 0 1 6 0v2H9z" />
    </svg>
  );
}

function actionLockTitle(permissions: CommunityPermissions | null): string {
  if (!permissions) return "Action unavailable";
  if (permissions.requires_join && !permissions.can_post) return "Join required";
  if (permissions.requires_verification && !permissions.can_post) return "Verification required";
  return "Action unavailable";
}

function actionLockMessage(permissions: CommunityPermissions | null, verb: string): string {
  if (!permissions) return `You can’t ${verb} right now.`;
  if (permissions.requires_join && !permissions.can_post) {
    return `Join this major or field to ${verb}.`;
  }
  if (permissions.requires_verification && !permissions.can_post) {
    return `You must be verified in this community to ${verb}. Verify in the iOS app (Settings → Community Verifications).`;
  }
  return `You can’t ${verb} right now.`;
}

export function PostCard({ post }: PostCardProps) {
  const { showToast } = useToast();
  const [permissions, setPermissions] = useState<CommunityPermissions | null>(null);

  const [isLiked, setIsLiked] = useState(post.viewerLiked ?? false);
  const [likesCount, setLikesCount] = useState(post.stats.likes);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  const [isReposted, setIsReposted] = useState(post.viewerHasReposted ?? false);
  const [isRepostLoading, setIsRepostLoading] = useState(false);

  const [isSaved, setIsSaved] = useState(post.viewerSaved ?? false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [shareCount, setShareCount] = useState(post.stats.shares ?? 0);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMediaAsset[]>([]);

  const canOpenProfile = Boolean(post.authorProfileHref);
  const communityHref =
    post.communityId !== undefined && post.communityId !== null && String(post.communityId).length > 0
      ? `/app/community/${post.communityId}`
      : undefined;
  const mediaAssetIdsKey = (post.mediaAssetIds ?? []).join(",");

  useEffect(() => {
    setIsLiked(post.viewerLiked ?? false);
    setLikesCount(post.stats.likes);
    setIsReposted(post.viewerHasReposted ?? false);
    setIsSaved(post.viewerSaved ?? false);
    setShareCount(post.stats.shares ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  useEffect(() => {
    if (!post.communityId) return;
    let active = true;
    getCommunityPermissions(post.communityId)
      .then((response) => {
        if (!active) return;
        setPermissions(response);
      })
      .catch(() => {
        if (!active) return;
        setPermissions(null);
      });
    return () => {
      active = false;
    };
  }, [post.communityId]);

  useEffect(() => {
    let active = true;
    const ids = (post.mediaAssetIds ?? []).filter((id) => id.trim().length > 0);
    if (ids.length === 0) {
      setResolvedMedia([]);
      return () => {
        active = false;
      };
    }

    resolveMediaAssets(ids)
      .then((resolved) => {
        if (!active) return;
        const map: Record<string, ResolvedMediaAsset> = {};
        for (const asset of resolved) {
          map[asset.id] = asset;
        }
        const ordered = ids.map((id) => map[id]).filter((asset): asset is ResolvedMediaAsset => Boolean(asset));
        // iOS behavior: if any ID fails resolution, keep the original post unchanged.
        setResolvedMedia(ordered.length === ids.length ? ordered : []);
      })
      .catch(() => {
        if (!active) return;
        setResolvedMedia([]);
      });

    return () => {
      active = false;
    };
  }, [mediaAssetIdsKey, post.id, post.mediaAssetIds]);

  const isReactionLocked = useMemo(() => {
    if (!permissions) return false;
    const requiresGate = permissions.requires_verification || permissions.requires_join || Boolean(permissions.requiresJoin);
    return requiresGate && !permissions.can_post;
  }, [permissions]);

  const handleLikeToggle = async () => {
    if (isLikeLoading) return;

    if (isReactionLocked) {
      showToast({
        title: actionLockTitle(permissions),
        message: actionLockMessage(permissions, "like"),
        tone: "error",
      });
      return;
    }

    const previousLiked = isLiked;
    const previousCount = likesCount;
    const nextLiked = !previousLiked;

    setIsLiked(nextLiked);
    setLikesCount((count) => (nextLiked ? count + 1 : Math.max(count - 1, 0)));
    setIsLikeLoading(true);

    try {
      const response = await setPostLike(post.id, nextLiked);
      if (response.likesCount !== undefined) {
        setLikesCount(response.likesCount);
      }
    } catch (error) {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);

      if (error instanceof PostActionsApiError) {
        const parsed = parseApiError(error.details);
        const title = titleForWriteError(parsed.error, "Couldn't like post");
        const message = parsed.message ?? messageForWriteError(parsed.error);
        showToast({ title, message, tone: "error" });
        return;
      }

      showToast({
        title: "Couldn't like post",
        message: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleRepostToggle = async () => {
    if (isRepostLoading) return;

    if (isReactionLocked) {
      showToast({
        title: actionLockTitle(permissions),
        message: actionLockMessage(permissions, "repost"),
        tone: "error",
      });
      return;
    }

    const previous = isReposted;
    const next = !previous;

    setIsReposted(next);
    setIsRepostLoading(true);

    try {
      const response = await setPostReposted(post.id, next);
      setIsReposted(response.viewerHasReposted);
    } catch (error) {
      setIsReposted(previous);

      if (error instanceof PostActionsApiError) {
        const parsed = parseApiError(error.details);
        showToast({
          title: titleForWriteError(parsed.error, "Couldn't repost"),
          message: parsed.message ?? messageForWriteError(parsed.error),
          tone: "error",
        });
        return;
      }

      showToast({
        title: "Couldn't repost",
        message: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setIsRepostLoading(false);
    }
  };

  const handleSaveToggle = async () => {
    if (isSaveLoading) return;

    if (isReactionLocked) {
      showToast({
        title: actionLockTitle(permissions),
        message: actionLockMessage(permissions, "save"),
        tone: "error",
      });
      return;
    }

    const previous = isSaved;
    const next = !previous;

    setIsSaved(next);
    setIsSaveLoading(true);

    try {
      const response = await setPostSaved(post.id, next);
      setIsSaved(response.saved);
    } catch (error) {
      setIsSaved(previous);

      if (error instanceof PostActionsApiError) {
        const parsed = parseApiError(error.details);
        showToast({
          title: titleForWriteError(parsed.error, "Couldn't save"),
          message: parsed.message ?? messageForWriteError(parsed.error),
          tone: "error",
        });
        return;
      }

      showToast({
        title: "Couldn't save",
        message: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setIsSaveLoading(false);
    }
  };

  const handleShare = async () => {
    if (isShareLoading) return;

    if (isReactionLocked) {
      showToast({
        title: actionLockTitle(permissions),
        message: actionLockMessage(permissions, "share"),
        tone: "error",
      });
      return;
    }

    const previousCount = shareCount;
    setShareCount((count) => count + 1);
    setIsShareLoading(true);

    try {
      const response = await sharePost(post.id);
      if (response.shareCount !== undefined) {
        setShareCount(response.shareCount);
      }
    } catch (error) {
      setShareCount(previousCount);

      if (error instanceof PostActionsApiError) {
        const parsed = parseApiError(error.details);
        showToast({
          title: titleForWriteError(parsed.error, "Couldn't share"),
          message: parsed.message ?? messageForWriteError(parsed.error),
          tone: "error",
        });
        return;
      }

      showToast({
        title: "Couldn't share",
        message: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  };

  const mediaViewerHeader = (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-white">
        <img
          src={post.authorProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={handleProfileImageError}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[30px] font-semibold leading-[1.05] text-white">{post.author}</p>
        {post.context ? <p className="truncate text-[25px] leading-[1.1] text-white/80">{post.context}</p> : null}
      </div>
    </div>
  );

  const mediaViewerFooter = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <button
          className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-[15px] font-medium text-white/85 transition hover:text-white disabled:opacity-60"
          aria-label="Like"
          type="button"
          onClick={() => void handleLikeToggle()}
          disabled={isLikeLoading}
        >
          <HeartIcon filled={isLiked} className={`h-[22px] w-[22px] flex-none ${isLiked ? "text-brand" : "text-white/85"}`} />
          <span className="text-sm font-medium tabular-nums">{likesCount}</span>
        </button>

        <Link
          to={`/app/post/${post.id}/comments`}
          className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-[15px] font-medium text-white/85 transition hover:text-white"
          aria-label="Comment"
        >
          <CommentIcon className="h-[22px] w-[22px] flex-none" />
          <span className="text-sm font-medium tabular-nums">{post.stats.comments}</span>
        </Link>

        <button
          className="inline-flex items-center rounded-full px-1 py-1 text-[15px] font-medium text-white/85 transition hover:text-white disabled:opacity-60"
          aria-label="Repost"
          type="button"
          onClick={() => void handleRepostToggle()}
          disabled={isRepostLoading}
        >
          <RepostIcon className={`h-[24px] w-[24px] flex-none ${isReposted ? "text-brand" : "text-white/85"}`} />
        </button>

        <button
          className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-[15px] font-medium text-white/85 transition hover:text-white disabled:opacity-60"
          aria-label="Share"
          type="button"
          onClick={() => void handleShare()}
          disabled={isShareLoading}
        >
          <ShareIcon className="h-[22px] w-[22px] flex-none" />
          <span className="text-sm font-medium tabular-nums">{shareCount}</span>
        </button>
      </div>
      <button
        className="inline-flex items-center justify-center rounded-full px-1 py-1 text-white/85 transition hover:text-white disabled:opacity-60"
        type="button"
        aria-label="Save"
        onClick={() => void handleSaveToggle()}
        disabled={isSaveLoading}
      >
        <BookmarkIcon filled={isSaved} className={`h-[22px] w-[22px] flex-none ${isSaved ? "text-brand" : "text-white/85"}`} />
      </button>
    </div>
  );
  const contentOffsetClass = post.isAnonymous ? "" : "pl-[3.25rem]";

  return (
    <article className="bg-bg px-4 py-5">
      {post.repostedBy ? (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-secondary">
          <RepostIcon className="h-4 w-4 opacity-70" />
          <span>{post.repostedBy}</span>
        </div>
      ) : null}
      <div className="flex gap-3">
        {!post.isAnonymous ? (
          canOpenProfile ? (
            <Link
              to={post.authorProfileHref!}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary transition hover:opacity-90"
              aria-label={`View ${post.author}'s profile`}
            >
              {post.authorProfileImageUrl ? (
                <img
                  src={post.authorProfileImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={handleProfileImageError}
                />
              ) : (
                <img src={DEFAULT_PROFILE_IMAGE_SRC} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </Link>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary">
              {post.authorProfileImageUrl ? (
                <img
                  src={post.authorProfileImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={handleProfileImageError}
                />
              ) : (
                <img src={DEFAULT_PROFILE_IMAGE_SRC} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </div>
          )
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 leading-tight">
                {canOpenProfile ? (
                  <Link
                    to={post.authorProfileHref!}
                    className={`text-[1.12rem] font-semibold transition hover:opacity-90 ${post.isAnonymous ? "text-secondary" : "text-strong"}`}
                  >
                    {post.author}
                  </Link>
                ) : (
                  <p className={`text-[1.12rem] font-semibold ${post.isAnonymous ? "text-secondary" : "text-strong"}`}>
                    {post.author}
                  </p>
                )}
                {post.subtitle ? (
                  <>
                    <span className="text-[1.08rem] leading-none text-text-light">·</span>
                    <p className="text-[1.03rem] text-text-secondary">{post.subtitle}</p>
                  </>
                ) : null}
              </div>
              {post.context ? (
                communityHref ? (
                  <Link
                    to={communityHref}
                    className="mt-0.5 block text-[0.95rem] leading-tight text-text-secondary transition hover:text-strong"
                  >
                    {post.context}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-[0.95rem] leading-tight text-text-secondary">{post.context}</p>
                )
              ) : null}
            </div>
            <button
              className="text-text-light transition hover:text-strong"
              type="button"
              aria-label="Post options"
            >
              <MenuDots className="h-5 w-5" />
            </button>
          </div>

          {post.content ? <p className="mt-3 text-[1.08rem] leading-[1.45] text-text-primary">{post.content}</p> : null}
          {resolvedMedia.length > 0 ? (
            <PostMediaGrid
              attachments={resolvedMedia}
              className={post.content ? "mt-3" : "mt-1"}
              viewerHeader={mediaViewerHeader}
              viewerFooter={mediaViewerFooter}
            />
          ) : null}
        </div>
      </div>

      <div className={`mt-4 ${contentOffsetClass}`}>
        <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <button
            className="inline-flex items-center gap-1 text-[1rem] font-medium text-text-secondary transition hover:text-strong disabled:opacity-60"
            aria-label="Like"
            type="button"
            onClick={() => void handleLikeToggle()}
            disabled={isLikeLoading}
          >
            <span className="relative">
              <HeartIcon
                filled={isLiked}
                className={`h-[22px] w-[22px] flex-none ${isLiked ? "text-brand" : "text-text-secondary"}`}
              />
              {isReactionLocked ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg">
                  <LockIcon className="h-2.5 w-2.5 flex-none text-text-secondary" />
                </span>
              ) : null}
            </span>
            <span className="text-[1.02rem] font-medium tabular-nums">{likesCount}</span>
          </button>

          <Link
            to={`/app/post/${post.id}/comments`}
            className="inline-flex items-center gap-1 text-[1rem] font-medium text-text-secondary transition hover:text-strong"
            aria-label="Comment"
          >
            <CommentIcon className="h-[22px] w-[22px] flex-none" />
            <span className="text-[1.02rem] font-medium tabular-nums">{post.stats.comments}</span>
          </Link>

          <button
            className="inline-flex items-center text-[1rem] font-medium text-text-secondary transition hover:text-strong disabled:opacity-60"
            aria-label="Repost"
            type="button"
            onClick={() => void handleRepostToggle()}
            disabled={isRepostLoading}
          >
            <RepostIcon
              className={`h-[24px] w-[24px] flex-none ${isReposted ? "text-brand" : "text-text-secondary"}`}
            />
          </button>

          <button
            className="inline-flex items-center gap-1 text-[1rem] font-medium text-text-secondary transition hover:text-strong disabled:opacity-60"
            aria-label="Share"
            type="button"
            onClick={() => void handleShare()}
            disabled={isShareLoading}
          >
            <ShareIcon className="h-[22px] w-[22px] flex-none" />
            <span className="text-[1.02rem] font-medium tabular-nums">{shareCount}</span>
          </button>
        </div>
        <button
          className="inline-flex items-center justify-center text-text-secondary transition hover:text-strong disabled:opacity-60"
          type="button"
          aria-label="Save"
          onClick={() => void handleSaveToggle()}
          disabled={isSaveLoading}
        >
          <BookmarkIcon
            filled={isSaved}
            className={`h-[22px] w-[22px] flex-none ${isSaved ? "text-brand" : "text-text-secondary"}`}
          />
        </button>
        </div>
        <p className="mt-2 text-[0.95rem] text-text-light">{post.time}</p>
      </div>
    </article>
  );
}
