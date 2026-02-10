import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { MenuDots } from "@/app/components/AppIcons/AppIcons";
import { useToast } from "@/app/components/AppToast/AppToast";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import {
  AnonProfileApiError,
  fetchAnonContent,
  fetchAnonProfile,
  fetchAnonReposts,
  setAnonFollowing,
} from "@/lib/anonProfileApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll } from "@/lib/postPoll";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

type AppAnonProfilePageProps = {
  anonProfileId: string;
};

type AnonProfileViewData = {
  id: string;
  name: string;
  bio: string;
  yearsInLoop?: string;
  memberLine?: string;
  showFollowerCount: boolean;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
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

function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
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

function formatTimeAgo(date: Date): string {
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(deltaSeconds, "second");
  const minutes = Math.round(deltaSeconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 4) return rtf.format(weeks, "week");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  const years = Math.round(days / 365);
  return rtf.format(years, "year");
}

function preferredDisplayName(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const shortName = normalizeOptional(value.short_name ?? value.shortName);
  const name = normalizeOptional(value.name);
  return shortName ?? name;
}

function extractAnonProfileId(item: Record<string, unknown>): string | undefined {
  const inline = pickString(item, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]);
  if (inline) return inline;

  const anonProfile = (isRecord(item.anon_profile) ? item.anon_profile : null) ??
    (isRecord(item.anonProfile) ? item.anonProfile : null) ??
    (isRecord(item.author_anon_profile) ? item.author_anon_profile : null) ??
    (isRecord(item.authorAnonProfile) ? item.authorAnonProfile : null);
  if (!anonProfile) return undefined;
  return pickString(anonProfile, ["id", "anon_profile_id", "anonProfileId"]);
}

function normalizePostItemToPostData(item: unknown): PostData | null {
  if (!isRecord(item)) return null;
  const node =
    (isRecord(item.post) ? item.post : null) ??
    (isRecord(item.original_post) ? item.original_post : null) ??
    (isRecord(item.post_item) ? item.post_item : null) ??
    (isRecord(item.reply) ? item.reply : null) ??
    item;

  const id = pickString(node, ["id", "post_id", "postId", "reply_id", "replyId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(node, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ??
    pickBoolean(item, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ??
    false;

  const authorName = isAnonymous
    ? "Anonymous"
    : (() => {
        const firstName = pickString(node, ["author_first_name", "authorFirstName"]);
        const lastName = pickString(node, ["author_last_name", "authorLastName"]);
        const fullName = [normalizeOptional(firstName), normalizeOptional(lastName)]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .trim();
        if (fullName) return fullName;
        return (
          normalizeOptional(node.author_display_name ?? node.authorDisplayName) ??
          normalizeOptional(node.author_handle ?? node.authorHandle) ??
          "User"
        );
      })();

  const specialization = preferredDisplayName(node.author_display_specialization ?? node.authorDisplaySpecialization);
  const community = preferredDisplayName(node.author_display_community ?? node.authorDisplayCommunity);
  const subtitle = isAnonymous ? "" : community ? `${specialization ?? "Member"} @ ${community}` : specialization ?? "";

  const postedIn =
    normalizeOptional(node.community_short_name ?? node.communityShortName) ??
    normalizeOptional(node.community_name ?? node.communityName);
  const context = postedIn ? `Posted in ${postedIn}` : "";

  const created = asDate(node.created_at ?? node.createdAt ?? node.timestamp);
  const time =
    normalizeOptional(node.time_ago ?? node.timeAgo ?? node.created_at_human ?? node.createdAtHuman) ??
    (created ? formatTimeAgo(created) : "");

  const stats = (isRecord(node.stats) ? node.stats : null) ?? (isRecord(node.counts) ? node.counts : null);

  const likes =
    pickNumber(node, ["likes_count", "like_count", "likes", "likesCount"]) ??
    (stats ? pickNumber(stats, ["likes_count", "like_count", "likes", "likesCount"]) : undefined) ??
    0;
  const comments =
    pickNumber(node, ["comments_count", "comment_count", "comments", "commentsCount"]) ??
    (stats ? pickNumber(stats, ["comments_count", "comment_count", "comments", "commentsCount"]) : undefined) ??
    0;
  const reposts =
    pickNumber(node, ["reposts_count", "repost_count", "reposts", "repostCount"]) ??
    (stats ? pickNumber(stats, ["reposts_count", "repost_count", "reposts", "repostCount"]) : undefined) ??
    0;
  const shares =
    pickNumber(node, ["share_count", "shareCount", "shares_count", "sharesCount"]) ??
    (stats ? pickNumber(stats, ["share_count", "shareCount", "shares_count", "sharesCount"]) : undefined) ??
    0;
  const saves =
    pickNumber(node, ["save_count", "saveCount", "saves_count", "savesCount"]) ??
    (stats ? pickNumber(stats, ["save_count", "saveCount", "saves_count", "savesCount"]) : undefined) ??
    0;

  const authorId = pickString(node, ["author_id", "authorId"]);
  const anonProfileId = extractAnonProfileId(node) ?? extractAnonProfileId(item);

  return {
    id,
    communityId: pickString(node, ["community_id", "communityId"]),
    author: authorName,
    subtitle,
    context,
    content: normalizeOptional(node.content ?? node.body ?? node.text ?? node.reply_text ?? node.replyText) ?? "",
    time,
    authorProfileImageUrl: undefined,
    authorProfileHref: isAnonymous
      ? anonProfileId
        ? `/app/profile/anon/${anonProfileId}`
        : "/app/profile/anonymous"
      : authorId
        ? `/app/profile/${authorId}`
        : undefined,
    viewerLiked: pickBoolean(node, ["user_liked", "userLiked"]) ?? false,
    viewerSaved: pickBoolean(node, ["is_saved", "isSaved"]) ?? false,
    viewerHasReposted: pickBoolean(node, ["viewer_has_reposted", "viewerHasReposted"]) ?? false,
    poll: normalizePostPoll(node),
    mediaAssetIds: extractMediaAssetIds(node),
    stats: { likes, comments, reposts, shares, saves },
    isAnonymous,
  };
}

function parseApiError(error: unknown): { status?: number; code?: string; message: string } {
  if (error instanceof AnonProfileApiError) {
    const raw = error.details?.trim();
    if (!raw) {
      return { status: error.status, message: error.message };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const code = normalizeOptional(parsed.error);
        const message = normalizeOptional(parsed.message) ?? raw;
        return { status: error.status, code, message };
      }
    } catch {
      return { status: error.status, message: raw };
    }
    return { status: error.status, message: raw };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: "Something went wrong." };
}

function normalizeProfile(payload: unknown): AnonProfileViewData | null {
  if (!isRecord(payload)) return null;
  const id = pickString(payload, ["id", "anon_profile_id", "anonProfileId"]);
  if (!id) return null;

  const createdAt = asDate(payload.created_at ?? payload.createdAt);
  const yearsInLoop =
    createdAt === null ? undefined : `${Math.max(0, new Date().getFullYear() - createdAt.getFullYear())} year${Math.max(0, new Date().getFullYear() - createdAt.getFullYear()) === 1 ? "" : "s"} in the Loop`;
  const bio = normalizeOptional(payload.bio) ?? "Anonymous profile";

  const displaySpecialization = preferredDisplayName(payload.display_specialization ?? payload.displaySpecialization);
  const displayCommunity = preferredDisplayName(payload.display_community ?? payload.displayCommunity);
  const memberLine = displayCommunity
    ? `${displaySpecialization ?? "Member"} @ ${displayCommunity}`
    : displaySpecialization ?? undefined;

  const stats = isRecord(payload.stats) ? payload.stats : null;
  const followersCount =
    (stats ? pickNumber(stats, ["follower_count", "followers_count", "followerCount", "followersCount"]) : undefined) ??
    pickNumber(payload, ["follower_count", "followers_count", "followerCount", "followersCount"]) ??
    0;
  const followingCount =
    (stats ? pickNumber(stats, ["following_count", "followingCount"]) : undefined) ??
    pickNumber(payload, ["following_count", "followingCount"]) ??
    0;

  const showFollowerCount =
    pickBoolean(payload, ["show_follower_count", "showFollowerCount"]) ??
    pickBoolean(stats ?? {}, ["show_follower_count", "showFollowerCount"]) ??
    true;

  const isFollowing =
    pickBoolean(payload, ["is_following", "isFollowing", "viewer_following", "viewerFollowing", "following"]) ??
    false;

  const isSelf =
    pickBoolean(payload, ["is_self", "isSelf", "viewer_is_owner", "viewerIsOwner"]) ??
    false;

  return {
    id,
    name: "Anonymous",
    bio,
    yearsInLoop,
    memberLine,
    showFollowerCount,
    followersCount,
    followingCount,
    isFollowing,
    isSelf,
  };
}

export function AppAnonProfilePage({ anonProfileId }: AppAnonProfilePageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<AnonProfileViewData | null>(null);
  const [profileStatus, setProfileStatus] = useState<"loading" | "idle" | "error">("loading");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [activeTabId, setActiveTabId] = useState<"content" | "reposts">("content");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [postsStatus, setPostsStatus] = useState<"idle" | "loading" | "loading-more" | "error">("loading");
  const [postsError, setPostsError] = useState<string | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileStatus("loading");
    setProfileError(null);
    try {
      const response = await fetchAnonProfile(anonProfileId);
      const normalized = normalizeProfile(response);
      if (!normalized) {
        throw new Error("Unable to load this anonymous profile.");
      }
      setProfile(normalized);
      setIsFollowing(normalized.isFollowing);
      setProfileStatus("idle");
    } catch (error) {
      const parsed = parseApiError(error);
      const message = parsed.status === 404 ? "This anonymous profile is unavailable." : parsed.message;
      setProfileStatus("error");
      setProfileError(message);
    }
  }, [anonProfileId]);

  const loadPosts = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      setPostsError(null);
      setPostsStatus(cursor ? "loading-more" : "loading");

      try {
        const response =
          activeTabId === "content"
            ? await fetchAnonContent({ anonProfileId, limit: 20, cursor, includePostPreview: true })
            : await fetchAnonReposts({ anonProfileId, limit: 20, cursor });

        const normalized = (response.items ?? [])
          .map(normalizePostItemToPostData)
          .filter((post): post is PostData => Boolean(post));

        setPosts((previous) => (replace ? normalized : [...previous, ...normalized]));
        setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
        setPostsStatus("idle");
      } catch (error) {
        const parsed = parseApiError(error);
        const message = parsed.status === 404
          ? activeTabId === "content"
            ? "Anonymous content is unavailable."
            : "Anonymous reposts are unavailable."
          : parsed.message;
        setPostsStatus("error");
        setPostsError(message);
      }
    },
    [activeTabId, anonProfileId]
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setPosts([]);
    setNextCursor(null);
    void loadPosts({ replace: true });
  }, [activeTabId, loadPosts]);

  const handleFollowToggle = useCallback(async () => {
    if (!profile || profile.isSelf || isFollowLoading) return;

    const previous = isFollowing;
    const next = !previous;
    const previousFollowerCount = profile.followersCount;
    setIsFollowing(next);
    setIsFollowLoading(true);
    setProfile((prev) =>
      prev
        ? { ...prev, followersCount: Math.max(0, prev.followersCount + (next ? 1 : -1)) }
        : prev
    );

    try {
      const response = await setAnonFollowing(anonProfileId, next);
      setIsFollowing(response.following);
    } catch (error) {
      setIsFollowing(previous);
      setProfile((prev) => (prev ? { ...prev, followersCount: previousFollowerCount } : prev));
      const parsed = parseApiError(error);
      const code = parsed.code;
      const title =
        code === "invalid_actor" ? "Invalid actor" :
        code === "anon_jwt_not_allowed" ? "Auth mode mismatch" :
        code === "invalid_anon_proof" ? "Invalid anonymous proof" :
        "Could not update follow";
      const message =
        code === "invalid_actor" ? "This follow action is not allowed for the current actor." :
        code === "anon_jwt_not_allowed" ? "Anonymous actor mode is not supported in web follow yet." :
        code === "invalid_anon_proof" ? "Anonymous follow proof is invalid." :
        parsed.message;

      showToast({
        title,
        message,
        tone: "error",
      });
    } finally {
      setIsFollowLoading(false);
    }
  }, [anonProfileId, isFollowLoading, isFollowing, profile, showToast]);

  const emptyLabel = useMemo(() => (activeTabId === "content" ? "No content yet." : "No reposts yet."), [activeTabId]);
  const loadingLabel = useMemo(() => (activeTabId === "content" ? "Loading content..." : "Loading reposts..."), [activeTabId]);
  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app", { replace: true });
  }, [navigate]);

  return (
    <AppLayout activeNavId="">
      <AppMobileHeader title="Anonymous" showAction={false} showBack backHref="/app" />

      {profileStatus === "loading" ? (
        <div className="space-y-3 bg-bg px-4 py-6">
          <div className="h-5 w-1/3 animate-pulse rounded-full bg-bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-bg-muted" />
          <div className="h-20 animate-pulse rounded-2xl bg-bg-muted" />
        </div>
      ) : null}

      {profileStatus === "error" ? (
        <div className="space-y-3 bg-bg px-4 py-6">
          <p className="text-sm font-semibold text-strong">Unable to load profile.</p>
          <p className="text-sm text-text-secondary">{profileError}</p>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {profile ? (
        <section className="border-b border-border/70 bg-bg">
          <div className="px-4 py-4">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="mb-3 hidden items-center gap-1 text-sm font-semibold text-text-secondary transition hover:text-strong lg:inline-flex"
            >
              <span className="text-base leading-none" aria-hidden="true">
                {"<"}
              </span>
              <span>Back</span>
            </button>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary">
                  <img src={DEFAULT_PROFILE_IMAGE_SRC} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-strong">{profile.name}</p>
                  <p className="text-sm text-text-secondary">Anonymous profile</p>
                </div>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-bg text-text-secondary transition hover:text-strong"
                aria-label="Profile options"
              >
                <MenuDots className="h-5 w-5" />
              </button>
            </div>

            {profile.bio ? <p className="mt-3 text-sm text-text-secondary">{profile.bio}</p> : null}

            <div className="mt-4 space-y-2 text-sm text-text-secondary">
              {profile.yearsInLoop ? <div>{profile.yearsInLoop}</div> : null}
              {profile.memberLine ? <div>{profile.memberLine}</div> : null}
            </div>

            {profile.showFollowerCount ? (
              <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-strong">{profile.followingCount}</span>
                  <span>Following</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-strong">{profile.followersCount}</span>
                  <span>Followers</span>
                </div>
              </div>
            ) : null}

            {!profile.isSelf ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isFollowing
                      ? "border border-border/70 bg-bg text-text-secondary hover:text-strong"
                      : "bg-brand text-white hover:bg-brand-hover"
                  }`}
                  onClick={() => void handleFollowToggle()}
                  disabled={isFollowLoading}
                >
                  {isFollowLoading ? "Updating..." : isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            ) : null}
          </div>

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
              {activeTabId === "content" ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" />
              ) : null}
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
              {activeTabId === "reposts" ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" />
              ) : null}
            </button>
          </div>
        </section>
      ) : null}

      <div className="divide-y divide-border/70 bg-bg">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {postsStatus === "loading" && profileStatus !== "loading" ? (
          <div className="px-4 py-6 text-sm text-text-secondary">{loadingLabel}</div>
        ) : null}

        {posts.length === 0 && postsStatus === "idle" ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">{emptyLabel}</div>
        ) : null}

        {postsError ? (
          <div className="space-y-2 px-4 py-4">
            <p className="text-sm font-semibold text-strong">Unable to load items.</p>
            <p className="text-sm text-text-secondary">{postsError}</p>
          </div>
        ) : null}

        {nextCursor && postsStatus !== "loading-more" ? (
          <div className="flex justify-center px-4 py-5">
            <button
              type="button"
              onClick={() => void loadPosts({ cursor: nextCursor, replace: false })}
              className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            >
              Load more
            </button>
          </div>
        ) : null}

        {postsStatus === "loading-more" ? (
          <div className="px-4 py-5 text-center text-sm text-text-secondary">Loading more...</div>
        ) : null}
      </div>
    </AppLayout>
  );
}
