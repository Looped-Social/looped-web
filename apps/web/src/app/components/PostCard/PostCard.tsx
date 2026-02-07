import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { MenuDots, ProfileIcon } from "@/app/components/AppIcons/AppIcons";
import { useToast } from "@/app/components/AppToast/AppToast";
import type { CommunityPermissions } from "@/lib/communityPermissionsApi";
import { getCommunityPermissions } from "@/lib/communityPermissionsApi";
import { PostActionsApiError, setPostLike, setPostReposted, setPostSaved } from "@/lib/postActionsApi";

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
      viewBox="0 0 24 24"
      className={`shrink-0 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H9a4 4 0 0 0-4 4v1" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h11a4 4 0 0 0 4-4v-1" />
    </svg>
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
  const [repostCount, setRepostCount] = useState(post.stats.reposts ?? post.stats.shares ?? 0);
  const [isRepostLoading, setIsRepostLoading] = useState(false);

  const [isSaved, setIsSaved] = useState(post.viewerSaved ?? false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const canOpenProfile = Boolean(post.authorProfileHref);

  useEffect(() => {
    setIsLiked(post.viewerLiked ?? false);
    setLikesCount(post.stats.likes);
    setIsReposted(post.viewerHasReposted ?? false);
    setRepostCount(post.stats.reposts ?? post.stats.shares ?? 0);
    setIsSaved(post.viewerSaved ?? false);
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
        const title = parsed.error === "community_not_verified" ? "Verification required" : "Couldn't like post";
        const message = parsed.message ?? "This action isn't available right now.";
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
    const previousCount = repostCount;
    const next = !previous;

    setIsReposted(next);
    setRepostCount((count) => (next ? count + 1 : Math.max(count - 1, 0)));
    setIsRepostLoading(true);

    try {
      const response = await setPostReposted(post.id, next);
      setIsReposted(response.viewerHasReposted);
    } catch (error) {
      setIsReposted(previous);
      setRepostCount(previousCount);

      if (error instanceof PostActionsApiError) {
        const parsed = parseApiError(error.details);
        showToast({
          title: "Couldn't repost",
          message: parsed.message ?? "This action isn't available right now.",
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
          title: "Couldn't save",
          message: parsed.message ?? "This action isn't available right now.",
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

  return (
    <article className="bg-bg px-4 py-4">
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
                />
              ) : (
                <ProfileIcon className="h-5 w-5" />
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
                />
              ) : (
                <ProfileIcon className="h-5 w-5" />
              )}
            </div>
          )
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            {canOpenProfile ? (
              <Link to={post.authorProfileHref!} className="min-w-0 rounded-md transition hover:opacity-90">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-semibold ${post.isAnonymous ? "text-secondary" : "text-strong"}`}>
                    {post.author}
                  </p>
                  {post.subtitle ? (
                    <>
                      <span className="text-xs text-text-light">·</span>
                      <p className="text-xs text-text-secondary">{post.subtitle}</p>
                    </>
                  ) : null}
                </div>
                {post.context ? <p className="text-xs text-text-secondary">{post.context}</p> : null}
              </Link>
            ) : (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-semibold ${post.isAnonymous ? "text-secondary" : "text-strong"}`}>
                    {post.author}
                  </p>
                  {post.subtitle ? (
                    <>
                      <span className="text-xs text-text-light">·</span>
                      <p className="text-xs text-text-secondary">{post.subtitle}</p>
                    </>
                  ) : null}
                </div>
                {post.context ? <p className="text-xs text-text-secondary">{post.context}</p> : null}
              </div>
            )}
            <button
              className="text-text-light transition hover:text-strong"
              type="button"
              aria-label="Post options"
            >
              <MenuDots className="h-5 w-5" />
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-text-primary">{post.content}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-[15px] font-medium text-text-secondary transition hover:text-strong disabled:opacity-60"
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
                <span className="text-sm font-medium tabular-nums">{likesCount}</span>
              </button>

              <button
                className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-[15px] font-medium text-text-secondary transition hover:text-strong"
                aria-label="Comment"
                type="button"
              >
                <CommentIcon className="h-[22px] w-[22px] flex-none" />
                <span className="text-sm font-medium tabular-nums">{post.stats.comments}</span>
              </button>

              <button
                className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-[15px] font-medium text-text-secondary transition hover:text-strong disabled:opacity-60"
                aria-label="Repost"
                type="button"
                onClick={() => void handleRepostToggle()}
                disabled={isRepostLoading}
              >
                <RepostIcon
                  className={`h-[24px] w-[24px] flex-none ${isReposted ? "text-brand" : "text-text-secondary"}`}
                />
                <span className="text-sm font-medium tabular-nums">{repostCount}</span>
              </button>
            </div>
            <button
              className="inline-flex items-center justify-center rounded-full px-1 py-1 text-text-secondary transition hover:text-strong"
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

          <p className="mt-2 text-xs text-text-light">{post.time}</p>
        </div>
      </div>
    </article>
  );
}
