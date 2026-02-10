import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppSearchPanel, type FilterOption } from "@/app/components/AppSearchPanel/AppSearchPanel";
import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { FeedApiError, fetchFeed, fetchFollowedCommunities, type FeedMode } from "@/lib/feedApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll } from "@/lib/postPoll";

const feedTabs = [
  { id: "for-you", label: "For You", mode: "for_you" },
  { id: "latest", label: "Latest", mode: "new" },
  { id: "following", label: "Following", mode: "following" },
] as const;

function FeedPostSkeleton() {
  return (
    <article className="bg-bg px-4 py-4">
      <div className="animate-pulse">
        <div className="flex gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-bg-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-2/5 rounded-full bg-bg-muted" aria-hidden="true" />
                <div className="h-3 w-1/3 rounded-full bg-bg-muted" aria-hidden="true" />
              </div>
              <div className="h-3 w-4 rounded-full bg-bg-muted" aria-hidden="true" />
            </div>

            <div className="mt-4 space-y-2">
              <div className="h-3.5 w-full rounded-full bg-bg-muted" aria-hidden="true" />
              <div className="h-3.5 w-5/6 rounded-full bg-bg-muted" aria-hidden="true" />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-10 rounded-full bg-bg-muted" aria-hidden="true" />
                <div className="h-5 w-10 rounded-full bg-bg-muted" aria-hidden="true" />
                <div className="h-5 w-10 rounded-full bg-bg-muted" aria-hidden="true" />
              </div>
              <div className="h-5 w-5 rounded-sm bg-bg-muted" aria-hidden="true" />
            </div>

            <div className="mt-3 h-3 w-20 rounded-full bg-bg-muted" aria-hidden="true" />
          </div>
        </div>
      </div>
    </article>
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
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "1") return true;
    if (normalized === "0") return false;
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

function normalizedOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

function capitalize(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function preferredName({
  name,
  shortName,
  preferShortNames = true,
}: {
  name?: string;
  shortName?: string;
  preferShortNames?: boolean;
}): string | undefined {
  const normalizedName = normalizedOptional(name);
  const normalizedShort = normalizedOptional(shortName);
  if (preferShortNames && normalizedShort) return normalizedShort;
  return normalizedName ?? normalizedShort;
}

function displayCommunityPreferredName(value: unknown, preferShortNames: boolean): string | undefined {
  if (!isRecord(value)) return undefined;
  const name = pickString(value, ["name"]);
  const shortName = pickString(value, ["short_name", "shortName"]);
  return preferredName({ name, shortName, preferShortNames });
}

function buildRepostBannerText({
  usernames,
  count,
}: {
  usernames: string[];
  count: number;
}): string | undefined {
  if (count <= 0) return undefined;
  if (count === 1 && usernames[0]) return `${usernames[0]} reposted this`;
  if (count === 2 && usernames.length >= 2) return `${usernames[0]} and ${usernames[1]} reposted this`;
  if (count > 2 && usernames.length >= 2) {
    const remaining = Math.max(count - 2, 0);
    return `${usernames[0]}, ${usernames[1]}, and ${remaining} more reposted this`;
  }
  if (count > 1 && usernames[0]) {
    const remaining = Math.max(count - 1, 0);
    return `${usernames[0]} and ${remaining} others reposted this`;
  }
  return `Reposted by ${count} people`;
}

function extractApiErrorMessage(details?: string): string | undefined {
  const trimmed = (details ?? "").trim();
  if (!trimmed) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) {
      const message = normalizedOptional(parsed.message);
      if (message) return message;
      const error = normalizedOptional(parsed.error);
      if (error) return error;
    }
  } catch {
    // ignore non-JSON bodies
  }
  return trimmed;
}

function normalizeCommunityToFilterOption(item: unknown): FilterOption | null {
  if (!isRecord(item)) return null;
  const id =
    pickString(item, ["id", "community_id", "communityId", "loop_id", "loopId"]) ??
    pickString(item, ["communityId", "community_id"]);
  const label = preferredName({
    name: pickString(item, ["name", "display_name", "displayName", "title"]),
    shortName: pickString(item, ["short_name", "shortName"]),
    preferShortNames: true,
  }) ?? pickString(item, ["handle", "username"]);
  if (!id || !label) return null;
  return { id, label };
}

function normalizeFeedItemToPostData(item: unknown): PostData | null {
  if (!isRecord(item)) return null;

  const post =
    (isRecord(item.post) ? item.post : null) ??
    (isRecord(item.original_post) ? item.original_post : null) ??
    (isRecord(item.post_item) ? item.post_item : null) ??
    item;

  const id = pickString(post, ["id", "post_id", "postId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(post, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous", "is_anon", "isAnon"]) ??
    pickBoolean(post, ["anon", "anonymous"]) ??
    false;

  const communityId = pickString(post, ["community_id", "communityId"]);

  const postedCommunityName = preferredName({
    name: pickString(post, ["community_name", "communityName"]),
    shortName: pickString(post, ["community_short_name", "communityShortName"]),
    preferShortNames: true,
  });

  const communityKind = pickString(post, ["community_kind", "communityKind"]);

  const displaySpecializationName = displayCommunityPreferredName(
    post.author_display_specialization ?? post.authorDisplaySpecialization,
    true
  );
  const displayCommunityName = displayCommunityPreferredName(
    post.author_display_community ?? post.authorDisplayCommunity,
    true
  );

  const subtitle = isAnonymous
    ? ""
    : displayCommunityName
      ? `${displaySpecializationName ?? "Member"} @ ${displayCommunityName}`
      : displaySpecializationName ?? "";

  const repostedUsersRaw = (post.reposted_by_followed_users ??
    post.repostedByFollowedUsers) as unknown;
  const repostedUsers = Array.isArray(repostedUsersRaw) ? repostedUsersRaw : [];
  const repostedByUsernames = repostedUsers
    .map((entry) => (isRecord(entry) ? pickString(entry, ["username", "handle", "name"]) : undefined))
    .filter((value): value is string => Boolean(value));
  const repostedCount =
    getNumber(post.reposted_by_followed_users_count ?? post.repostedByFollowedUsersCount) ??
    repostedByUsernames.length;
  const repostedBy = buildRepostBannerText({ usernames: repostedByUsernames, count: repostedCount });

  const authorName = isAnonymous
    ? "Anonymous"
    : (() => {
        const firstName = pickString(post, ["author_first_name", "authorFirstName"]);
        const lastName = pickString(post, ["author_last_name", "authorLastName"]);
        const fullName = [normalizedOptional(firstName), normalizedOptional(lastName)]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .trim();
        if (fullName) return fullName;

        const displayName = pickString(post, ["author_display_name", "authorDisplayName"]);
        if (normalizedOptional(displayName)) return displayName!;

        const handle = pickString(post, ["author_handle", "authorHandle"]);
        if (normalizedOptional(handle)) return handle!;

        return "User";
      })();
  const authorId = pickString(post, ["author_id", "authorId"]);
  const anonProfileId =
    pickString(post, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]) ??
    (() => {
      const anonProfile =
        (isRecord(post.anon_profile) ? post.anon_profile : null) ??
        (isRecord(post.anonProfile) ? post.anonProfile : null) ??
        (isRecord(post.author_anon_profile) ? post.author_anon_profile : null) ??
        (isRecord(post.authorAnonProfile) ? post.authorAnonProfile : null);
      if (!anonProfile) return undefined;
      return pickString(anonProfile, ["id", "anon_profile_id", "anonProfileId"]);
    })();

  const context = postedCommunityName
    ? `Posted in ${postedCommunityName}`
    : communityKind
      ? `Posted in ${capitalize(communityKind)}`
      : "";

  const content = pickString(post, ["content", "text", "body", "message"]) ?? "";

  const timeLabel =
    pickString(post, ["time_ago", "timeAgo", "created_at_human", "createdAtHuman"]) ??
    (() => {
      const created = asDate(post.created_at ?? post.createdAt ?? post.timestamp ?? post.created);
      return created ? formatTimeAgo(created) : "";
    })();

  const statsRecord =
    (isRecord(post.stats) ? post.stats : null) ??
    (isRecord(post.counts) ? post.counts : null) ??
    (isRecord(post.engagement) ? post.engagement : null) ??
    null;

  const likes =
    pickNumber(post, ["like_count", "likes_count", "likes", "likeCount", "likesCount"]) ??
    (statsRecord
      ? pickNumber(statsRecord, ["like_count", "likes_count", "likes", "likeCount", "likesCount"])
      : undefined) ??
    0;
  const comments =
    pickNumber(post, ["comment_count", "comments_count", "comments", "commentCount", "commentsCount"]) ??
    (statsRecord
      ? pickNumber(statsRecord, ["comment_count", "comments_count", "comments", "commentCount", "commentsCount"])
      : undefined) ??
    0;
  const reposts =
    pickNumber(post, ["repost_count", "reposts_count", "reposts", "repostCount", "repostsCount"]) ??
    (statsRecord
      ? pickNumber(statsRecord, ["repost_count", "reposts_count", "reposts", "repostCount", "repostsCount"])
      : undefined) ??
    0;
  const shares =
    pickNumber(post, ["share_count", "shareCount", "shares_count", "sharesCount"]) ??
    (statsRecord ? pickNumber(statsRecord, ["share_count", "shareCount", "shares_count", "sharesCount"]) : undefined) ??
    0;
  const saves =
    pickNumber(post, ["save_count", "saves_count", "saves", "saveCount", "savesCount"]) ??
    (statsRecord
      ? pickNumber(statsRecord, ["save_count", "saves_count", "saves", "saveCount", "savesCount"])
      : undefined) ??
    0;

  const viewerLiked = pickBoolean(post, ["user_liked", "userLiked"]) ?? false;
  const viewerSaved = pickBoolean(post, ["is_saved", "isSaved"]) ?? false;
  const viewerHasReposted = pickBoolean(post, ["viewer_has_reposted", "viewerHasReposted"]) ?? false;
  const authorProfileImageUrl = pickString(post, ["author_profile_image_url", "authorProfileImageUrl"]);

  return {
    id,
    communityId,
    repostedBy,
    author: authorName,
    subtitle,
    context,
    content,
    time: timeLabel,
    authorProfileImageUrl,
    authorProfileHref: isAnonymous
      ? anonProfileId
        ? `/app/profile/anon/${anonProfileId}`
        : "/app/profile/anonymous"
      : authorId
        ? `/app/profile/${authorId}`
        : undefined,
    viewerLiked,
    viewerSaved,
    viewerHasReposted,
    poll: normalizePostPoll(post),
    mediaAssetIds: extractMediaAssetIds(post),
    stats: { likes, comments, reposts, shares, saves },
    isAnonymous,
  };
}

export function AppFeedPage() {
  const [activeTabId, setActiveTabId] = useState<(typeof feedTabs)[number]["id"]>("for-you");
  const activeMode = useMemo(() => {
    const found = feedTabs.find((tab) => tab.id === activeTabId);
    return (found?.mode ?? "for_you") as FeedMode;
  }, [activeTabId]);

  const [activeCommunityId, setActiveCommunityId] = useState<string>("all");
  const [communityFilters, setCommunityFilters] = useState<FilterOption[]>([{ id: "all", label: "All Loops" }]);

  const [posts, setPosts] = useState<PostData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [feedStatus, setFeedStatus] = useState<"idle" | "loading" | "loading-more" | "error">("idle");
  const [feedError, setFeedError] = useState<string | null>(null);
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const lastAutoLoadCursorRef = useRef<string | null>(null);
  const feedStatusRef = useRef(feedStatus);

  const rightRail = (
    <AppSearchPanel
      defaultActiveFilterId="all"
      activeFilterId={activeCommunityId}
      onActiveFilterIdChange={(id) => setActiveCommunityId(id)}
      filters={communityFilters}
    />
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetchFollowedCommunities({ limit: 60, order: "relevant" });
        if (!active) return;
        const options = (response.items ?? [])
          .map(normalizeCommunityToFilterOption)
          .filter((option): option is FilterOption => Boolean(option));

        setCommunityFilters([{ id: "all", label: "All Loops" }, ...options]);
      } catch (_error) {
        if (!active) return;
        setCommunityFilters([{ id: "all", label: "All Loops" }]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const loadFeed = useCallback(async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
    setFeedError(null);
    setFeedStatus(cursor ? "loading-more" : "loading");
    try {
      const response = await fetchFeed({
        limit: 20,
        cursor,
        mode: activeMode,
        communityId: activeCommunityId === "all" ? undefined : activeCommunityId,
      });

      const normalized = (response.items ?? [])
        .map(normalizeFeedItemToPostData)
        .filter((post): post is PostData => Boolean(post));

      setPosts((prev) => (replace ? normalized : [...prev, ...normalized]));
      setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
      setFeedStatus("idle");
    } catch (error) {
      const message = error instanceof FeedApiError ? extractApiErrorMessage(error.details) : undefined;
      setFeedError(message ?? "Unable to load feed.");
      setFeedStatus("error");
    }
  }, [activeCommunityId, activeMode]);

  useEffect(() => {
    feedStatusRef.current = feedStatus;
  }, [feedStatus]);

  useEffect(() => {
    setPosts([]);
    setNextCursor(null);
    lastAutoLoadCursorRef.current = null;
    void loadFeed({ replace: true });
  }, [activeMode, activeCommunityId, loadFeed]);

  useEffect(() => {
    const node = infiniteSentinelRef.current;
    if (!node) return;
    if (!nextCursor) return;
    if (feedStatus === "loading" || feedStatus === "loading-more") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!nextCursor) return;
        if (feedStatusRef.current === "loading" || feedStatusRef.current === "loading-more") return;
        if (lastAutoLoadCursorRef.current === nextCursor) return;

        lastAutoLoadCursorRef.current = nextCursor;
        void loadFeed({ cursor: nextCursor, replace: false });
      },
      {
        root: null,
        rootMargin: "300px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [feedStatus, loadFeed, nextCursor]);

  return (
    <AppLayout activeNavId="home" rightRail={rightRail}>
      <AppMobileHeader />

      <header className="border-b border-border/70 bg-bg">
        <div className="grid grid-cols-3">
          {feedTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`relative px-2 py-4 text-center text-sm transition ${
                  isActive ? "font-bold text-brand" : "font-medium text-text-secondary hover:text-strong"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
                {isActive ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" /> : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="divide-y divide-border/70 bg-bg">
        {feedError ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm font-semibold text-strong">Unable to load your feed.</p>
            <p className="text-sm text-text-secondary">{feedError}</p>
            <button
              type="button"
              onClick={() => void loadFeed({ replace: true })}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {feedStatus === "loading" && posts.length === 0 && !feedError ? (
          <>
            {Array.from({ length: 5 }, (_, index) => (
              <FeedPostSkeleton key={`feed-skeleton-${index}`} />
            ))}
          </>
        ) : null}

        {nextCursor ? <div ref={infiniteSentinelRef} className="h-6 w-full" aria-hidden="true" /> : null}

        {feedStatus === "loading-more" ? (
          <div className="px-4 py-5 text-center text-sm text-text-secondary">Loading more…</div>
        ) : null}
      </div>
    </AppLayout>
  );
}
