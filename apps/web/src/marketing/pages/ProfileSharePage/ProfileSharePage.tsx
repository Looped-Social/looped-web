import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { MenuDots } from "@/app/components/AppIcons/AppIcons";
import { PostMediaGrid } from "@/app/components/PostMediaGrid/PostMediaGrid";
import { useUserSession } from "@/hooks/useUserSession";
import type { ResolvedMediaAsset } from "@/lib/mediaApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePoll, type PostPoll } from "@/lib/postPoll";
import {
  ProfileShareApiError,
  fetchSharedProfileByUsername,
  fetchSharedProfilePosts,
  fetchSharedProfileReposts,
} from "@/lib/profileShareApi";
import { resolveSharedMediaAssets } from "@/lib/postShareApi";
import { Navbar } from "@/marketing/components/Navbar/Navbar";

const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";

type ProfileSharePageProps = {
  username: string;
};

type SharedProfile = {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  memberLine?: string;
  showFollowerCount: boolean;
  followingCount: number;
  followersCount: number;
};

type SharedProfileFeedTab = "content" | "reposts";

type SharedProfileFeedPost = {
  id: string;
  authorName: string;
  authorProfileImageUrl?: string;
  subtitle?: string;
  context?: string;
  content: string;
  createdAtLabel: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  mediaAssetIds: string[];
  poll?: PostPoll;
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

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value !== undefined) return value;
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

function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = getBoolean(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return String(Math.max(0, value));
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

function handleAvatarError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

function preferredDisplayName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (!isRecord(value)) return undefined;
  return pickString(value, ["short_name", "shortName", "name", "label"]);
}

function normalizeSharedProfile(payload: unknown): SharedProfile | null {
  if (!isRecord(payload)) return null;

  const id = pickString(payload, ["id", "user_id", "userId"]);
  if (!id) return null;

  const usernameRaw = pickString(payload, ["username", "handle"]);
  if (!usernameRaw) return null;
  const username = usernameRaw.replace(/^@/, "").toLowerCase();

  const displayName =
    pickString(payload, ["display_name", "displayName", "name"]) ??
    pickString(payload, ["username", "handle"]) ??
    username;

  const displayCommunity = pickString(payload, [
    "display_community_name",
    "displayCommunityName",
    "display_community",
    "displayCommunity",
  ]);
  const displaySpecialization = pickString(payload, [
    "display_specialization_name",
    "displaySpecializationName",
    "display_specialization",
    "displaySpecialization",
  ]);

  const memberLine =
    displayCommunity && displaySpecialization
      ? `${displaySpecialization} @ ${displayCommunity}`
      : displayCommunity ?? displaySpecialization;

  return {
    id,
    username,
    displayName,
    bio: pickString(payload, ["bio", "about", "description"]),
    profileImageUrl: pickString(payload, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]),
    memberLine,
    showFollowerCount: pickBoolean(payload, ["show_follower_count", "showFollowerCount"]) ?? true,
    followingCount: pickNumber(payload, ["following_count", "followingCount"]) ?? 0,
    followersCount: pickNumber(payload, ["followers_count", "followersCount", "follower_count", "followerCount"]) ?? 0,
  };
}

function normalizeSharedProfileFeedPost(payload: unknown): SharedProfileFeedPost | null {
  if (!isRecord(payload)) return null;
  const id = pickString(payload, ["id", "post_id", "postId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(payload, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ?? false;

  const authorName = isAnonymous
    ? "Anonymous"
    : pickString(payload, ["author_display_name", "authorDisplayName", "author_handle", "authorHandle"]) ?? "User";

  const authorDisplayCommunity = preferredDisplayName(payload.author_display_community ?? payload.authorDisplayCommunity);
  const authorDisplaySpecialization = preferredDisplayName(
    payload.author_display_specialization ?? payload.authorDisplaySpecialization
  );
  const subtitle = isAnonymous
    ? undefined
    : authorDisplayCommunity
      ? `${authorDisplaySpecialization ?? "Member"} @ ${authorDisplayCommunity}`
      : authorDisplaySpecialization;

  const postedIn = pickString(payload, ["community_short_name", "communityShortName", "community_name", "communityName"]);
  const context = postedIn ? `Posted in ${postedIn}` : undefined;

  return {
    id,
    authorName,
    authorProfileImageUrl: pickString(payload, ["author_profile_image_url", "authorProfileImageUrl"]),
    subtitle,
    context,
    content: pickString(payload, ["content", "text", "body", "message"]) ?? "",
    createdAtLabel: formatTimeAgo(payload.created_at ?? payload.createdAt ?? payload.timestamp),
    likesCount: pickNumber(payload, ["likes_count", "likesCount"]) ?? 0,
    commentsCount: pickNumber(payload, ["comments_count", "commentsCount", "comment_count", "commentCount"]) ?? 0,
    sharesCount: pickNumber(payload, ["share_count", "shareCount", "shares_count", "sharesCount"]) ?? 0,
    mediaAssetIds: extractMediaAssetIds(payload),
    poll: normalizePoll(payload.poll),
  };
}

function parseApiMessage(error: unknown): string {
  if (error instanceof ProfileShareApiError) {
    const body = (error.details ?? "").trim();
    if (body.length > 0) {
      try {
        const parsed = JSON.parse(body) as unknown;
        if (isRecord(parsed)) {
          const message = pickString(parsed, ["message"]);
          if (message) return message;
        }
      } catch {
        return body;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Unable to load this profile.";
}

function HeartIcon({ className }: { className?: string }) {
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

function CommentIcon({ className }: { className?: string }) {
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
      <path d="M21 14a4 4 0 0 1-4 4H8l-5 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" />
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
      className={className}
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
  const open = isPollOpen(poll);
  if (!open) return "Final results";
  if (!poll.closesAt) return "No end";
  return formatEndsInLabel(poll.closesAt);
}

function ReadOnlyProfilePostCard({
  post,
  media,
}: {
  post: SharedProfileFeedPost;
  media: ResolvedMediaAsset[];
}) {
  return (
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
                {post.subtitle ? (
                  <>
                    <span className="shrink-0 text-[1.08rem] leading-none text-text-light">·</span>
                    <p className="min-w-0 flex-1 truncate text-[1.03rem] text-text-secondary">{post.subtitle}</p>
                  </>
                ) : null}
              </div>
              {post.context ? <p className="mt-0.5 text-[0.95rem] leading-tight text-text-secondary">{post.context}</p> : null}
            </div>
          </div>

          <span className="text-text-light" aria-hidden="true">
            <MenuDots className="h-5 w-5" />
          </span>
        </div>

        {post.content ? <p className="mt-3 whitespace-pre-wrap text-[1.08rem] leading-[1.45] text-text-primary">{post.content}</p> : null}

        {post.poll ? (
          <section className="mt-3 space-y-2.5">
            <p className="text-[1.02rem] font-medium leading-snug text-text-primary">{post.poll.question}</p>
            <div className="space-y-2">
              {post.poll.options.map((option) => (
                <div key={option.id} className="relative w-full overflow-hidden rounded-xl border border-border/70 bg-bg-muted/45 px-3 py-2.5">
                  <span
                    className="absolute inset-y-0 left-0 bg-bg-muted/70"
                    style={{ width: `${clampPercent(option.votePercent)}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative z-10 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary">{option.text}</span>
                    <span className="text-xs font-semibold text-text-secondary tabular-nums">{Math.round(option.votePercent)}%</span>
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
          <div className="flex items-center gap-3.5 text-text-secondary">
            <span className="inline-flex items-center gap-1 text-[1rem] font-medium">
              <HeartIcon className="h-[22px] w-[22px] flex-none" />
              <span className="text-[1.02rem] font-medium tabular-nums">{post.likesCount}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[1rem] font-medium">
              <CommentIcon className="h-[22px] w-[22px] flex-none" />
              <span className="text-[1.02rem] font-medium tabular-nums">{post.commentsCount}</span>
            </span>
            <span className="inline-flex items-center text-[1rem] font-medium">
              <RepostIcon className="h-[24px] w-[24px] flex-none" />
            </span>
            <span className="inline-flex items-center gap-1 text-[1rem] font-medium">
              <ShareIcon className="h-[22px] w-[22px] flex-none" />
              <span className="text-[1.02rem] font-medium tabular-nums">{post.sharesCount}</span>
            </span>
          </div>
          <span className="inline-flex items-center justify-center text-text-secondary">
            <BookmarkIcon className="h-[22px] w-[22px] flex-none" />
          </span>
        </div>

        {post.createdAtLabel ? <p className="mt-2 text-[0.95rem] text-text-light">{post.createdAtLabel}</p> : null}
      </div>
    </article>
  );
}

export function ProfileSharePage({ username }: ProfileSharePageProps) {
  const navigate = useNavigate();
  const { status: sessionStatus } = useUserSession();

  const rawSlug = useMemo(() => username.trim().replace(/^\/+/, ""), [username]);
  const sharePath = rawSlug ? `/u/${rawSlug}` : "/";

  const [profile, setProfile] = useState<SharedProfile | null>(null);
  const [viewStatus, setViewStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKind, setErrorKind] = useState<"not-found" | "unavailable" | "generic" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTabId, setActiveTabId] = useState<SharedProfileFeedTab>("content");

  const [contentItems, setContentItems] = useState<SharedProfileFeedPost[]>([]);
  const [contentStatus, setContentStatus] = useState<"idle" | "loading" | "loading-more" | "error">("idle");
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentNextCursor, setContentNextCursor] = useState<string | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);

  const [repostItems, setRepostItems] = useState<SharedProfileFeedPost[]>([]);
  const [repostStatus, setRepostStatus] = useState<"idle" | "loading" | "loading-more" | "error">("idle");
  const [repostError, setRepostError] = useState<string | null>(null);
  const [repostNextCursor, setRepostNextCursor] = useState<string | null>(null);
  const [repostLoaded, setRepostLoaded] = useState(false);

  const [mediaById, setMediaById] = useState<Record<string, ResolvedMediaAsset>>({});

  useEffect(() => {
    let active = true;
    setViewStatus("loading");
    setErrorKind(null);
    setErrorMessage(null);
    setProfile(null);

    setActiveTabId("content");
    setContentItems([]);
    setContentStatus("idle");
    setContentError(null);
    setContentNextCursor(null);
    setContentLoaded(false);
    setRepostItems([]);
    setRepostStatus("idle");
    setRepostError(null);
    setRepostNextCursor(null);
    setRepostLoaded(false);
    setMediaById({});

    void fetchSharedProfileByUsername(rawSlug)
      .then((response) => {
        if (!active) return;
        const normalized = normalizeSharedProfile(response);
        if (!normalized) {
          setErrorKind("generic");
          setViewStatus("error");
          setErrorMessage("Profile preview is unavailable.");
          return;
        }
        setProfile(normalized);
        setViewStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ProfileShareApiError && error.status === 404) {
          setErrorKind("not-found");
          setErrorMessage("Profile not found.");
        } else if (error instanceof ProfileShareApiError && error.status === 410) {
          setErrorKind("unavailable");
          setErrorMessage("Profile unavailable.");
        } else {
          setErrorKind("generic");
          setErrorMessage(parseApiMessage(error));
        }
        setViewStatus("error");
      });

    return () => {
      active = false;
    };
  }, [rawSlug]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || viewStatus !== "ready" || !profile) return;
    navigate(`/app/profile/${profile.id}`, {
      replace: true,
      state: { fromProfileShareRedirect: true },
    });
  }, [navigate, profile, sessionStatus, viewStatus]);

  const loadFeedTab = useCallback(
    async ({ tab, cursor, replace }: { tab: SharedProfileFeedTab; cursor?: string; replace: boolean }) => {
      if (!rawSlug) return;

      if (tab === "content") {
        setContentError(null);
        setContentStatus(cursor ? "loading-more" : "loading");
      } else {
        setRepostError(null);
        setRepostStatus(cursor ? "loading-more" : "loading");
      }

      try {
        if (tab === "content") {
          const response = await fetchSharedProfilePosts({ username: rawSlug, limit: 20, cursor });
          const items = Array.isArray(response.items) ? response.items : [];
          const normalized = items.map(normalizeSharedProfileFeedPost).filter((item): item is SharedProfileFeedPost => Boolean(item));

          setContentItems((previous) => (replace ? normalized : [...previous, ...normalized]));
          setContentNextCursor(response.next_cursor ?? response.nextCursor ?? null);
          setContentStatus("idle");
          setContentLoaded(true);
          return;
        }

        const response = await fetchSharedProfileReposts({ username: rawSlug, limit: 20, cursor });
        const items = Array.isArray(response.items) ? response.items : [];
        const normalized = items
          .map((item) => {
            if (!isRecord(item)) return null;
            const postNode = isRecord(item.post) ? item.post : item;
            return normalizeSharedProfileFeedPost(postNode);
          })
          .filter((item): item is SharedProfileFeedPost => Boolean(item));

        setRepostItems((previous) => (replace ? normalized : [...previous, ...normalized]));
        setRepostNextCursor(response.next_cursor ?? response.nextCursor ?? null);
        setRepostStatus("idle");
        setRepostLoaded(true);
      } catch (error) {
        const message = parseApiMessage(error);
        if (tab === "content") {
          setContentStatus("error");
          setContentError(message);
          setContentLoaded(true);
        } else {
          setRepostStatus("error");
          setRepostError(message);
          setRepostLoaded(true);
        }
      }
    },
    [rawSlug]
  );

  useEffect(() => {
    if (viewStatus !== "ready" || !profile) return;
    if (activeTabId === "content" && !contentLoaded && contentStatus !== "loading") {
      void loadFeedTab({ tab: "content", replace: true });
    }
    if (activeTabId === "reposts" && !repostLoaded && repostStatus !== "loading") {
      void loadFeedTab({ tab: "reposts", replace: true });
    }
  }, [
    activeTabId,
    contentLoaded,
    contentStatus,
    loadFeedTab,
    profile,
    repostLoaded,
    repostStatus,
    viewStatus,
  ]);

  const activeItems = activeTabId === "content" ? contentItems : repostItems;
  const activeStatus = activeTabId === "content" ? contentStatus : repostStatus;
  const activeError = activeTabId === "content" ? contentError : repostError;
  const activeNextCursor = activeTabId === "content" ? contentNextCursor : repostNextCursor;
  const activeEmptyLabel = activeTabId === "content" ? "No posts yet." : "No reposts yet.";
  const activeLoadingLabel = activeTabId === "content" ? "Loading posts..." : "Loading reposts...";

  const handleLoadMore = useCallback(() => {
    if (!activeNextCursor || activeStatus === "loading-more") return;
    void loadFeedTab({ tab: activeTabId, cursor: activeNextCursor, replace: false });
  }, [activeNextCursor, activeStatus, activeTabId, loadFeedTab]);

  const handleRetryActiveTab = useCallback(() => {
    if (activeTabId === "content") {
      setContentLoaded(false);
      setContentItems([]);
      setContentNextCursor(null);
      void loadFeedTab({ tab: "content", replace: true });
      return;
    }
    setRepostLoaded(false);
    setRepostItems([]);
    setRepostNextCursor(null);
    void loadFeedTab({ tab: "reposts", replace: true });
  }, [activeTabId, loadFeedTab]);

  useEffect(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const item of activeItems) {
      for (const id of item.mediaAssetIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }

    if (ids.length === 0) {
      setMediaById({});
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
        setMediaById(next);
      })
      .catch(() => {
        if (!active) return;
        setMediaById({});
      });

    return () => {
      active = false;
    };
  }, [activeItems]);

  const mediaForIds = useCallback(
    (ids: string[]) => ids.map((id) => mediaById[id]).filter((asset): asset is ResolvedMediaAsset => Boolean(asset)),
    [mediaById]
  );

  return (
    <div className="min-h-screen bg-shell-bg">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl pb-16 pt-4 sm:pt-6">
        <div className="flex flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
          <p className="whitespace-nowrap text-[1.38rem] font-semibold leading-tight text-strong">Shared Profile</p>
          {sessionStatus !== "authenticated" ? (
            <Link
              to={`/login?next=${encodeURIComponent(sharePath)}`}
              className="text-[0.95rem] text-text-secondary underline-offset-2 transition hover:text-strong hover:underline"
            >
              <span className="underline decoration-current underline-offset-2">Sign in</span> to follow, message, and view full profile.
            </Link>
          ) : (
            <p className="text-[0.95rem] text-text-secondary">Opening full profile…</p>
          )}
        </div>

        <section className="overflow-hidden border border-border/70 bg-bg sm:rounded-2xl">
          {viewStatus === "loading" ? (
            <div className="px-5 py-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/2 rounded-full bg-bg-muted" />
                <div className="h-4 w-full rounded-full bg-bg-muted" />
                <div className="h-4 w-2/3 rounded-full bg-bg-muted" />
              </div>
            </div>
          ) : null}

          {viewStatus === "error" ? (
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-strong">
                {errorKind === "not-found"
                  ? "Profile not found"
                  : errorKind === "unavailable"
                    ? "Profile unavailable"
                    : "Unable to load this profile"}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{errorMessage ?? "Try again later."}</p>
            </div>
          ) : null}

          {viewStatus === "ready" && profile ? (
            <>
              <article className="bg-bg px-4 py-5 sm:px-5">
                <div className="flex items-start gap-3">
                  <img
                    src={profile.profileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                    loading="lazy"
                    onError={handleAvatarError}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.32rem] font-semibold leading-tight text-strong">{profile.displayName}</p>
                    <p className="mt-0.5 text-[1.02rem] text-text-secondary">@{profile.username}</p>
                    {profile.memberLine ? <p className="mt-1 text-[0.95rem] text-text-secondary">{profile.memberLine}</p> : null}
                    {profile.bio ? <p className="mt-2 whitespace-pre-wrap text-[1.02rem] leading-[1.4] text-text-primary">{profile.bio}</p> : null}

                    {profile.showFollowerCount ? (
                      <div className="mt-3 flex items-center gap-5 text-[0.95rem] text-text-secondary">
                        <p>
                          <span className="font-semibold text-strong">{formatCount(profile.followingCount)}</span> Following
                        </p>
                        <p>
                          <span className="font-semibold text-strong">{formatCount(profile.followersCount)}</span> Followers
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>

              <div className="grid grid-cols-2 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setActiveTabId("content")}
                  className={`relative px-2 py-4 text-center text-sm transition ${
                    activeTabId === "content" ? "font-bold text-brand" : "font-medium text-text-secondary hover:text-strong"
                  }`}
                  aria-current={activeTabId === "content" ? "page" : undefined}
                >
                  Content
                  {activeTabId === "content" ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabId("reposts")}
                  className={`relative px-2 py-4 text-center text-sm transition ${
                    activeTabId === "reposts" ? "font-bold text-brand" : "font-medium text-text-secondary hover:text-strong"
                  }`}
                  aria-current={activeTabId === "reposts" ? "page" : undefined}
                >
                  Reposts
                  {activeTabId === "reposts" ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" /> : null}
                </button>
              </div>

              <div className="divide-y divide-border/70 bg-bg">
                {activeItems.map((item, index) => (
                  <ReadOnlyProfilePostCard key={`${activeTabId}-${item.id}-${index}`} post={item} media={mediaForIds(item.mediaAssetIds)} />
                ))}

                {activeStatus === "loading" && activeItems.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-text-secondary sm:px-5">{activeLoadingLabel}</div>
                ) : null}

                {activeItems.length === 0 && activeStatus === "idle" ? (
                  <div className="px-4 py-8 text-center text-sm text-text-secondary sm:px-5">{activeEmptyLabel}</div>
                ) : null}

                {activeError ? (
                  <div className="space-y-2 px-4 py-4 sm:px-5">
                    <p className="text-sm font-semibold text-strong">Unable to load items.</p>
                    <p className="text-sm text-text-secondary">{activeError}</p>
                    <button
                      type="button"
                      onClick={handleRetryActiveTab}
                      className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {activeNextCursor && activeStatus !== "loading-more" ? (
                  <div className="flex justify-center px-4 py-5">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                    >
                      Load more
                    </button>
                  </div>
                ) : null}

                {activeStatus === "loading-more" ? (
                  <div className="px-4 py-5 text-center text-sm text-text-secondary">Loading more...</div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
