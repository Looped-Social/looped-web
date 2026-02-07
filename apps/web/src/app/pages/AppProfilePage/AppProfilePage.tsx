import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { MenuDots, ProfileIcon } from "@/app/components/AppIcons/AppIcons";
import { useToast } from "@/app/components/AppToast/AppToast";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import {
  UserApiError,
  fetchUserMe,
  fetchUserFollowing,
  fetchUserPosts,
  fetchUserProfile,
  setUserFollowing,
} from "@/lib/userApi";

type AppProfilePageProps = {
  profileUserId?: string;
};

type ProfileViewData = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  yearsInLoop?: string;
  memberLine?: string;
  createdYear?: string;
  showFollowerCount: boolean;
  followingCount: number;
  followersCount: number;
};

const FOLLOW_STORE_KEY = "looped-following-user-ids";

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

function normalizePostItemToPostData(item: unknown): PostData | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "post_id", "postId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(item, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ?? false;
  const authorId = pickString(item, ["author_id", "authorId"]);

  const authorName = isAnonymous
    ? "Anonymous"
    : (() => {
        const firstName = pickString(item, ["author_first_name", "authorFirstName"]);
        const lastName = pickString(item, ["author_last_name", "authorLastName"]);
        const fullName = [normalizeOptional(firstName), normalizeOptional(lastName)]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .trim();
        if (fullName) return fullName;
        return (
          normalizeOptional(item.author_display_name ?? item.authorDisplayName) ??
          normalizeOptional(item.author_handle ?? item.authorHandle) ??
          "User"
        );
      })();

  const specialization = preferredDisplayName(item.author_display_specialization ?? item.authorDisplaySpecialization);
  const community = preferredDisplayName(item.author_display_community ?? item.authorDisplayCommunity);
  const subtitle = isAnonymous ? "" : community ? `${specialization ?? "Member"} @ ${community}` : specialization ?? "";

  const postedIn =
    normalizeOptional(item.community_short_name ?? item.communityShortName) ??
    normalizeOptional(item.community_name ?? item.communityName);
  const context = postedIn ? `Posted in ${postedIn}` : "";

  const created = asDate(item.created_at ?? item.createdAt ?? item.timestamp);
  const time =
    normalizeOptional(item.time_ago ?? item.timeAgo ?? item.created_at_human ?? item.createdAtHuman) ??
    (created ? formatTimeAgo(created) : "");

  const likes = pickNumber(item, ["likes_count", "like_count", "likes", "likesCount"]) ?? 0;
  const comments = pickNumber(item, ["comments_count", "comment_count", "comments", "commentsCount"]) ?? 0;
  const reposts = pickNumber(item, ["reposts_count", "repost_count", "reposts", "repostCount"]) ?? 0;
  const shares = pickNumber(item, ["share_count", "shareCount", "shares_count", "sharesCount"]) ?? 0;
  const saves = pickNumber(item, ["save_count", "saveCount", "saves_count", "savesCount"]) ?? 0;
  const anonProfileId =
    pickString(item, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]) ??
    (() => {
      const anonProfile =
        (isRecord(item.anon_profile) ? item.anon_profile : null) ??
        (isRecord(item.anonProfile) ? item.anonProfile : null) ??
        (isRecord(item.author_anon_profile) ? item.author_anon_profile : null) ??
        (isRecord(item.authorAnonProfile) ? item.authorAnonProfile : null);
      if (!anonProfile) return undefined;
      return pickString(anonProfile, ["id", "anon_profile_id", "anonProfileId"]);
    })();

  return {
    id,
    communityId: pickString(item, ["community_id", "communityId"]),
    author: authorName,
    subtitle,
    context,
    content: normalizeOptional(item.content) ?? "",
    time,
    authorProfileImageUrl: pickString(item, ["author_profile_image_url", "authorProfileImageUrl"]),
    authorProfileHref: isAnonymous
      ? anonProfileId
        ? `/app/profile/anon/${anonProfileId}`
        : "/app/profile/anonymous"
      : authorId
        ? `/app/profile/${authorId}`
        : undefined,
    viewerLiked: pickBoolean(item, ["user_liked", "userLiked"]) ?? false,
    viewerSaved: pickBoolean(item, ["is_saved", "isSaved"]) ?? false,
    viewerHasReposted: pickBoolean(item, ["viewer_has_reposted", "viewerHasReposted"]) ?? false,
    stats: { likes, comments, reposts, shares, saves },
    isAnonymous,
  };
}

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof UserApiError) {
    const raw = error.details?.trim();
    if (!raw) return error.message;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const message = normalizeOptional(parsed.message);
        if (message) return message;
      }
    } catch {
      return raw;
    }
    return raw;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function resolveCurrentUserId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.user)) {
    return pickString(payload.user, ["id", "user_id", "userId"]);
  }
  return pickString(payload, ["id", "user_id", "userId"]);
}

function normalizeProfile(payload: unknown): ProfileViewData | null {
  if (!isRecord(payload)) return null;
  const id = pickString(payload, ["id", "user_id", "userId"]);
  if (!id) return null;

  const firstName = pickString(payload, ["first_name", "firstName"]);
  const lastName = pickString(payload, ["last_name", "lastName"]);
  const fullName = [normalizeOptional(firstName), normalizeOptional(lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();
  const name = fullName || pickString(payload, ["display_name", "displayName", "name"]) || "Looped User";
  const handle = pickString(payload, ["handle", "username"]) ?? "looped";
  const isAnonymous = pickBoolean(payload, ["is_anonymous", "isAnonymous"]) ?? false;
  const bio = normalizeOptional(payload.bio) ?? (isAnonymous ? "" : "No bio yet");
  const avatarUrl = pickString(payload, ["profile_image_url", "profileImageUrl"]);

  const createdAt = asDate(payload.created_at ?? payload.createdAt);
  const createdYear = createdAt ? String(createdAt.getFullYear()) : undefined;
  const yearsInLoop = createdAt ? Math.max(0, new Date().getFullYear() - createdAt.getFullYear()) : undefined;
  const yearsLabel =
    yearsInLoop === undefined ? undefined : `${yearsInLoop} year${yearsInLoop === 1 ? "" : "s"} in the Loop`;

  const displaySpecialization = preferredDisplayName(payload.display_specialization ?? payload.displaySpecialization);
  const displayCommunity = preferredDisplayName(payload.display_community ?? payload.displayCommunity);
  const memberLine = displayCommunity
    ? `${displaySpecialization ?? "Member"} @ ${displayCommunity}`
    : displaySpecialization ?? undefined;

  const stats = isRecord(payload.stats) ? payload.stats : null;
  const followingCount = stats ? pickNumber(stats, ["following_count", "followingCount"]) ?? 0 : 0;
  const followersCount = stats ? pickNumber(stats, ["follower_count", "followerCount"]) ?? 0 : 0;
  const showFollowerCount = pickBoolean(payload, ["show_follower_count", "showFollowerCount"]) ?? true;

  return {
    id,
    name,
    handle: `@${handle}`,
    bio,
    avatarUrl,
    isAnonymous,
    yearsInLoop: yearsLabel,
    memberLine,
    createdYear,
    showFollowerCount,
    followingCount,
    followersCount,
  };
}

function readFollowingSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(FOLLOW_STORE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((value) => String(value)));
  } catch {
    return new Set();
  }
}

function writeFollowingSet(ids: Set<string>) {
  window.localStorage.setItem(FOLLOW_STORE_KEY, JSON.stringify(Array.from(ids)));
}

async function resolveIsFollowingOnServer({
  viewerUserId,
  targetUserId,
  targetHandle,
}: {
  viewerUserId: string;
  targetUserId: string;
  targetHandle?: string;
}): Promise<boolean> {
  let cursor: string | undefined;
  let pages = 0;
  const normalizedTargetId = String(targetUserId);
  const query = targetHandle?.replace(/^@/, "");

  do {
    const response = await fetchUserFollowing({
      userId: viewerUserId,
      limit: 100,
      cursor,
      query,
    });
    const items = Array.isArray(response.items) ? response.items : [];
    const found = items.some((entry) => {
      if (!isRecord(entry)) return false;
      const id = pickString(entry, ["id", "user_id", "userId"]);
      return Boolean(id) && String(id) === normalizedTargetId;
    });
    if (found) return true;
    cursor = response.next_cursor ?? response.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < 4);

  return false;
}

function CalendarIcon({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
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
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M2 13h20" />
    </svg>
  );
}

export function AppProfilePage({ profileUserId }: AppProfilePageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileViewData | null>(null);
  const [profileStatus, setProfileStatus] = useState<"loading" | "idle" | "error">("loading");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [postsStatus, setPostsStatus] = useState<"idle" | "loading" | "loading-more" | "error">("loading");
  const [postsError, setPostsError] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<"content" | "reposts">("content");

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const isCurrentUser = useMemo(
    () => Boolean(currentUserId && targetUserId && currentUserId === targetUserId),
    [currentUserId, targetUserId]
  );

  const loadInitial = useCallback(async () => {
    setProfileStatus("loading");
    setProfileError(null);
    setPostsStatus("loading");
    setPostsError(null);
    setPosts([]);
    setNextCursor(null);

    try {
      const meResponse = await fetchUserMe();
      const resolvedCurrentUserId = resolveCurrentUserId(meResponse);
      if (!resolvedCurrentUserId) {
        throw new Error("Unable to resolve your profile.");
      }
      const resolvedTargetUserId = profileUserId?.trim() ? profileUserId.trim() : resolvedCurrentUserId;

      const [profileResponse, postsResponse] = await Promise.all([
        fetchUserProfile(resolvedTargetUserId),
        fetchUserPosts({ userId: resolvedTargetUserId, limit: 20 }),
      ]);

      const normalizedProfile = normalizeProfile(profileResponse);
      if (!normalizedProfile) {
        throw new Error("Unable to load this profile.");
      }

      const normalizedPosts = (postsResponse.items ?? [])
        .map(normalizePostItemToPostData)
        .filter((post): post is PostData => Boolean(post));

      setCurrentUserId(resolvedCurrentUserId);
      setTargetUserId(resolvedTargetUserId);
      setProfile(normalizedProfile);
      setProfileStatus("idle");
      setPosts(normalizedPosts);
      setPostsStatus("idle");
      setNextCursor(postsResponse.next_cursor ?? postsResponse.nextCursor ?? null);

      if (resolvedCurrentUserId === resolvedTargetUserId) {
        setIsFollowing(false);
      } else {
        try {
          const following = await resolveIsFollowingOnServer({
            viewerUserId: resolvedCurrentUserId,
            targetUserId: resolvedTargetUserId,
            targetHandle: normalizedProfile.handle,
          });
          setIsFollowing(following);
        } catch {
          const followingSet = readFollowingSet();
          setIsFollowing(followingSet.has(String(resolvedTargetUserId)));
        }
      }
    } catch (error) {
      const message = parseApiErrorMessage(error);
      setProfileStatus("error");
      setPostsStatus("error");
      setProfileError(message);
      setPostsError(message);
    }
  }, [profileUserId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMorePosts = useCallback(async () => {
    if (!targetUserId || !nextCursor || postsStatus === "loading-more") return;
    setPostsStatus("loading-more");
    setPostsError(null);
    try {
      const response = await fetchUserPosts({ userId: targetUserId, limit: 20, cursor: nextCursor });
      const normalized = (response.items ?? [])
        .map(normalizePostItemToPostData)
        .filter((post): post is PostData => Boolean(post));
      setPosts((prev) => [...prev, ...normalized]);
      setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
      setPostsStatus("idle");
    } catch (error) {
      setPostsStatus("error");
      setPostsError(parseApiErrorMessage(error));
    }
  }, [nextCursor, postsStatus, targetUserId]);

  const handleFollowToggle = useCallback(async () => {
    if (!targetUserId || isCurrentUser || isFollowLoading) return;
    const previous = isFollowing;
    const next = !previous;

    setIsFollowing(next);
    setIsFollowLoading(true);
    setProfile((previousProfile) =>
      previousProfile
        ? {
            ...previousProfile,
            followersCount: Math.max(0, previousProfile.followersCount + (next ? 1 : -1)),
          }
        : previousProfile
    );

    try {
      const response = await setUserFollowing(targetUserId, next);
      setIsFollowing(response.following);
      const ids = readFollowingSet();
      if (response.following) {
        ids.add(String(targetUserId));
      } else {
        ids.delete(String(targetUserId));
      }
      writeFollowingSet(ids);
    } catch (error) {
      setIsFollowing(previous);
      const rollbackDelta = previous ? 1 : -1;
      setProfile((previousProfile) =>
        previousProfile
          ? {
              ...previousProfile,
              followersCount: Math.max(0, previousProfile.followersCount + rollbackDelta),
            }
          : previousProfile
      );
      showToast({
        title: "Could not update follow",
        message: parseApiErrorMessage(error),
        tone: "error",
      });
    } finally {
      setIsFollowLoading(false);
    }
  }, [isCurrentUser, isFollowLoading, isFollowing, showToast, targetUserId]);

  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app", { replace: true });
  }, [navigate]);

  const rightRail = profile ? (
    <>
      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-strong">Profile snapshot</h3>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border/60 bg-bg px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Top communities</p>
            <p className="mt-1 text-sm font-semibold text-strong">{profile.memberLine ?? "Not set yet"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-bg px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Visibility</p>
            <p className="mt-1 text-sm font-semibold text-strong">
              {profile.isAnonymous ? "Anonymous by default" : "Named profile"}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-bg px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Member since</p>
            <p className="mt-1 text-sm font-semibold text-strong">{profile.createdYear ?? "Unknown"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-strong">Quick actions</h3>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            onClick={() =>
              showToast({
                title: "Share profile",
                message: "Profile sharing is coming soon on web.",
              })
            }
          >
            Share profile
          </button>
          {isCurrentUser ? (
            <button
              type="button"
              className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
              onClick={() =>
                showToast({
                  title: "Edit profile",
                  message: "Profile editing is coming soon on web.",
                })
              }
            >
              Edit profile
            </button>
          ) : null}
        </div>
      </div>
    </>
  ) : null;

  return (
    <AppLayout activeNavId={isCurrentUser ? "profile" : ""} rightRail={rightRail}>
      <AppMobileHeader
        title="Profile"
        showAction={false}
        showBack={!isCurrentUser}
        backHref="/app"
      />

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
            onClick={() => void loadInitial()}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {profile ? (
        <section className="border-b border-border/70 bg-bg">
          <div className="px-4 py-4">
            {!isCurrentUser ? (
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
            ) : null}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ProfileIcon className="h-8 w-8" />
                  )}
                </div>
                <div>
                  <p className={`text-2xl font-semibold ${profile.isAnonymous ? "text-secondary" : "text-strong"}`}>
                    {profile.name}
                  </p>
                  <p className="text-sm text-text-secondary">{profile.handle}</p>
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
              {profile.yearsInLoop ? (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{profile.yearsInLoop}</span>
                </div>
              ) : null}
              {profile.memberLine ? (
                <div className="flex items-center gap-2">
                  <BriefcaseIcon className="h-4 w-4" />
                  <span>{profile.memberLine}</span>
                </div>
              ) : null}
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

            <div className="mt-4 flex flex-wrap gap-3">
              {isCurrentUser ? (
                <>
                  <button
                    type="button"
                    className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                    onClick={() =>
                      showToast({
                        title: "Edit profile",
                        message: "Profile editing is coming soon on web.",
                      })
                    }
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                    onClick={() =>
                      showToast({
                        title: "Anonymous mode",
                        message: "Anonymous mode controls are available in iOS today.",
                      })
                    }
                  >
                    Anonymous
                  </button>
                </>
              ) : (
                <>
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
                  <button
                    type="button"
                    className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                    onClick={() =>
                      showToast({
                        title: "Messaging",
                        message: "Direct messaging from profile is coming soon on web.",
                      })
                    }
                  >
                    Message
                  </button>
                </>
              )}
            </div>
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

      {activeTabId === "content" ? (
        <div className="divide-y divide-border/70 bg-bg">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {postsStatus === "loading" && profileStatus !== "loading" ? (
            <div className="px-4 py-6 text-sm text-text-secondary">Loading content...</div>
          ) : null}

          {posts.length === 0 && postsStatus === "idle" ? (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">No content yet.</div>
          ) : null}

          {postsError ? (
            <div className="space-y-2 px-4 py-4">
              <p className="text-sm font-semibold text-strong">Unable to load content.</p>
              <p className="text-sm text-text-secondary">{postsError}</p>
            </div>
          ) : null}

          {nextCursor && postsStatus !== "loading-more" ? (
            <div className="flex justify-center px-4 py-5">
              <button
                type="button"
                onClick={() => void loadMorePosts()}
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
      ) : (
        <div className="bg-bg px-4 py-8 text-center text-sm text-text-secondary">No reposts yet.</div>
      )}
    </AppLayout>
  );
}
