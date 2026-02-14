import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { AppSearchPanel, type FilterOption } from "@/app/components/AppSearchPanel/AppSearchPanel";
import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { AppPostCommentsPage } from "@/app/pages/AppPostCommentsPage/AppPostCommentsPage";
import { resolveCommunityLabel, usePreferCommunityShortNames } from "@/lib/communityDisplayPreference";
import { useContentPreferences } from "@/lib/contentPreferences";
import { FeedApiError, fetchFeed, fetchFollowedCommunities, type FeedMode } from "@/lib/feedApi";
import { captureFeedScrollRestore, consumeFeedScrollRestore } from "@/lib/feedScrollRestore";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll } from "@/lib/postPoll";
import { extractViewerCapabilitiesFromPost } from "@/lib/postViewerCapabilities";
import { SearchApiError, searchCommunities } from "@/lib/searchApi";

const feedTabs = [
  { id: "for-you", label: "For You", mode: "for_you" },
  { id: "latest", label: "Latest", mode: "new" },
  { id: "following", label: "Following", mode: "following" },
] as const;

type FeedTabId = (typeof feedTabs)[number]["id"];

type FeedRouteSnapshot = {
  activeTabId: FeedTabId;
  activeCommunityId: string;
  communityFilters: FilterOption[];
  posts: PostData[];
  nextCursor: string | null;
  lastAutoLoadCursor: string | null;
  hideAnonymousPosts: boolean;
  preferCommunityShortNames: boolean;
  scrollY: number;
};

const defaultCommunityFilters: FilterOption[] = [{ id: "all", label: "All Loops" }];
const COMMUNITY_SEARCH_DEBOUNCE_MS = 280;
const RECENT_FEED_COMMUNITIES_KEY = "feedRecentCommunities";
const MAX_RECENT_FEED_COMMUNITIES = 12;
const feedRouteSnapshots = new Map<string, FeedRouteSnapshot>();
let latestFeedRouteSnapshot: FeedRouteSnapshot | null = null;

type CommunitySearchStatus = "idle" | "loading" | "ready" | "error";

function saveFeedRouteSnapshot(locationKey: string, snapshot: FeedRouteSnapshot) {
  feedRouteSnapshots.set(locationKey, snapshot);
  latestFeedRouteSnapshot = snapshot;

  // Keep this bounded so repeated navigation does not grow memory unbounded.
  if (feedRouteSnapshots.size <= 12) return;
  const oldestKey = feedRouteSnapshots.keys().next().value;
  if (typeof oldestKey === "string") feedRouteSnapshots.delete(oldestKey);
}

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

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
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

function formatMembersLabel(value: unknown): string | undefined {
  const count = getNumber(value);
  if (count === undefined) return undefined;
  const safeCount = Math.max(Math.round(count), 0);
  return `${safeCount} ${safeCount === 1 ? "member" : "members"}`;
}

function uniqueCommunityFilters(filters: FilterOption[]): FilterOption[] {
  const seen = new Set<string>();
  const next: FilterOption[] = [];
  for (const filter of filters) {
    const id = filter.id?.trim();
    const label = filter.label?.trim();
    if (!id || !label) continue;
    if (id === "all") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    next.push({ ...filter, id, label });
  }
  return [defaultCommunityFilters[0], ...next];
}

function moveCommunityFilterToFront(filters: FilterOption[], selected: FilterOption): FilterOption[] {
  return uniqueCommunityFilters([
    selected,
    ...filters.filter((filter) => filter.id !== "all" && filter.id !== selected.id),
  ]);
}

function readRecentFeedCommunities(): FilterOption[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FEED_COMMUNITIES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const id = normalizedOptional(entry.id);
        const label = normalizedOptional(entry.label);
        if (!id || !label || id === "all") return null;
        return { id, label } satisfies FilterOption;
      })
      .filter((entry): entry is FilterOption => Boolean(entry));
    return normalized.slice(0, MAX_RECENT_FEED_COMMUNITIES);
  } catch {
    return [];
  }
}

function writeRecentFeedCommunities(filters: FilterOption[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_FEED_COMMUNITIES_KEY,
      JSON.stringify(filters.filter((filter) => filter.id !== "all").slice(0, MAX_RECENT_FEED_COMMUNITIES))
    );
  } catch {
    // ignore storage write failures
  }
}

function saveRecentFeedCommunity(filter: FilterOption) {
  if (filter.id === "all") return;
  const current = readRecentFeedCommunities();
  const next = [
    filter,
    ...current.filter((entry) => entry.id !== filter.id),
  ].slice(0, MAX_RECENT_FEED_COMMUNITIES);
  writeRecentFeedCommunities(next);
}

function mergeCommunityFilters({
  previous,
  followed,
  activeCommunityId,
}: {
  previous: FilterOption[];
  followed: FilterOption[];
  activeCommunityId: string;
}): FilterOption[] {
  const previousById = new Map(
    previous.filter((filter) => filter.id !== "all").map((filter) => [filter.id, filter] as const)
  );
  const followedById = new Map(
    followed.filter((filter) => filter.id !== "all").map((filter) => [filter.id, filter] as const)
  );
  const recent = readRecentFeedCommunities().map((filter) => followedById.get(filter.id) ?? filter);

  const activeFilter =
    activeCommunityId === "all"
      ? null
      : followedById.get(activeCommunityId) ??
        previousById.get(activeCommunityId) ??
        recent.find((filter) => filter.id === activeCommunityId) ??
        null;

  return uniqueCommunityFilters([
    ...(activeFilter ? [activeFilter] : []),
    ...recent,
    ...followed,
    ...previous.filter((filter) => filter.id !== "all"),
  ]);
}

function normalizeCommunityToFilterOption(item: unknown, preferCommunityShortNames: boolean): FilterOption | null {
  if (!isRecord(item)) return null;
  const id =
    pickString(item, ["id", "community_id", "communityId", "loop_id", "loopId"]) ??
    pickString(item, ["communityId", "community_id"]);
  const name = pickString(item, ["name", "display_name", "displayName", "title"]);
  const shortName = pickString(item, ["short_name", "shortName"]);
  const label =
    resolveCommunityLabel({
      name,
      shortName,
      fallback: pickString(item, ["handle", "username"]) ?? "Community",
      preferShortNames: preferCommunityShortNames,
    }) ?? pickString(item, ["handle", "username"]);
  if (!id || !label) return null;

  const normalizedName = normalizedOptional(name);
  const normalizedShortName = normalizedOptional(shortName);
  const longLabel =
    preferCommunityShortNames && normalizedName && normalizedName !== label
      ? normalizedName
      : !preferCommunityShortNames && normalizedShortName && normalizedShortName !== label
        ? normalizedShortName
        : undefined;

  const membersLabel = formatMembersLabel(
    item.member_count ??
      item.memberCount ??
      item.members_count ??
      item.membersCount ??
      item.follower_count ??
      item.followers_count
  );

  const kind = normalizedOptional(pickString(item, ["kind", "community_kind", "communityKind", "type"]));
  const description = normalizedOptional(pickString(item, ["description", "bio", "summary"]));
  const icon = normalizedOptional(
    pickString(item, ["emoji", "icon_emoji", "iconEmoji", "icon_value", "iconValue", "icon_url", "iconUrl"])
  );
  const imageUrl = normalizedOptional(pickString(item, ["image_url", "imageUrl"]));

  return {
    id,
    label,
    longLabel,
    description,
    membersLabel,
    kind,
    icon,
    imageUrl,
  };
}

function normalizeFeedItemToPostData(
  item: unknown,
  options: {
    preferCommunityShortNames: boolean;
    hideAnonymousPosts: boolean;
  }
): PostData | null {
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
  if (options.hideAnonymousPosts && isAnonymous) return null;

  const communityId = pickString(post, ["community_id", "communityId"]);

  const postedCommunityName = preferredName({
    name: pickString(post, ["community_name", "communityName"]),
    shortName: pickString(post, ["community_short_name", "communityShortName"]),
    preferShortNames: options.preferCommunityShortNames,
  });

  const communityKind = pickString(post, ["community_kind", "communityKind"]);

  const displaySpecializationName = displayCommunityPreferredName(
    post.author_display_specialization ?? post.authorDisplaySpecialization,
    options.preferCommunityShortNames
  );
  const displayCommunityName = displayCommunityPreferredName(
    post.author_display_community ?? post.authorDisplayCommunity,
    options.preferCommunityShortNames
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
  const authorPrincipalId = pickString(post, ["author_principal_id", "authorPrincipalId", "principal_id", "principalId"]);
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
    authorId,
    authorPrincipalId,
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
    viewerCapabilities: extractViewerCapabilitiesFromPost(post),
    poll: normalizePostPoll(post),
    mediaAssetIds: extractMediaAssetIds(post),
    stats: { likes, comments, reposts, shares, saves },
    isAnonymous,
  };
}

export function AppFeedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const commentsOverlayPostId = useMemo(() => {
    const value = new URLSearchParams(location.search).get("comments");
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [location.search]);
  const openedFromSharePreviewRedirect = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("fromSharePreviewRedirect");
    if (!raw) return false;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }, [location.search]);
  const { hideAnonymousPosts } = useContentPreferences();
  const preferCommunityShortNames = usePreferCommunityShortNames();
  const initialSnapshot = feedRouteSnapshots.get(location.key) ?? latestFeedRouteSnapshot;
  const canRestoreSnapshot =
    initialSnapshot?.hideAnonymousPosts === hideAnonymousPosts &&
    initialSnapshot?.preferCommunityShortNames === preferCommunityShortNames;

  const [activeTabId, setActiveTabId] = useState<FeedTabId>(() =>
    canRestoreSnapshot ? initialSnapshot.activeTabId : "for-you"
  );
  const activeMode = useMemo(() => {
    const found = feedTabs.find((tab) => tab.id === activeTabId);
    return (found?.mode ?? "for_you") as FeedMode;
  }, [activeTabId]);

  const [activeCommunityId, setActiveCommunityId] = useState<string>(() =>
    canRestoreSnapshot ? initialSnapshot.activeCommunityId : "all"
  );
  const [communityFilters, setCommunityFilters] = useState<FilterOption[]>(() =>
    canRestoreSnapshot ? initialSnapshot.communityFilters : defaultCommunityFilters
  );
  const [isCommunitySearchActive, setIsCommunitySearchActive] = useState(false);
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [communitySearchStatus, setCommunitySearchStatus] = useState<CommunitySearchStatus>("idle");
  const [communitySearchError, setCommunitySearchError] = useState<string | null>(null);
  const [communitySearchResults, setCommunitySearchResults] = useState<FilterOption[]>([]);
  const communitySearchInputRef = useRef<HTMLInputElement | null>(null);
  const activeCommunitySearchRequestIdRef = useRef(0);
  const activeFeedRequestIdRef = useRef(0);
  const activeCommunityIdRef = useRef(activeCommunityId);

  const [posts, setPosts] = useState<PostData[]>(() => (canRestoreSnapshot ? initialSnapshot.posts : []));
  const [nextCursor, setNextCursor] = useState<string | null>(() => (canRestoreSnapshot ? initialSnapshot.nextCursor : null));
  const [feedStatus, setFeedStatus] = useState<"idle" | "loading" | "loading-more" | "error">("idle");
  const [feedError, setFeedError] = useState<string | null>(null);
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const lastAutoLoadCursorRef = useRef<string | null>(canRestoreSnapshot ? initialSnapshot.lastAutoLoadCursor : null);
  const feedStatusRef = useRef(feedStatus);
  const skipInitialFeedLoadRef = useRef(canRestoreSnapshot);
  const hasRestoredScrollRef = useRef(false);
  const lastKnownScrollYRef = useRef(0);
  const [storedScrollRestoreY, setStoredScrollRestoreY] = useState<number | null>(null);
  const [storedScrollRestorePostId, setStoredScrollRestorePostId] = useState<string | null>(null);
  const [hasConsumedStoredScrollRestore, setHasConsumedStoredScrollRestore] = useState(false);
  const feedContextRef = useRef({
    activeMode,
    activeCommunityId,
    hideAnonymousPosts,
    preferCommunityShortNames,
  });
  const snapshotStateRef = useRef<Omit<FeedRouteSnapshot, "scrollY">>({
    activeTabId,
    activeCommunityId,
    communityFilters,
    posts,
    nextCursor,
    lastAutoLoadCursor: lastAutoLoadCursorRef.current,
    hideAnonymousPosts,
    preferCommunityShortNames,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const captureScroll = () => {
      const scrollY = window.scrollY;
      lastKnownScrollYRef.current = scrollY;
      captureFeedScrollRestore(location.pathname, scrollY);
      saveFeedRouteSnapshot(location.key, {
        ...snapshotStateRef.current,
        lastAutoLoadCursor: lastAutoLoadCursorRef.current,
        scrollY,
      });
    };
    if (!hasConsumedStoredScrollRestore) return;
    window.addEventListener("scroll", captureScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", captureScroll);
    };
  }, [hasConsumedStoredScrollRestore, location.key, location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setHasConsumedStoredScrollRestore(true);
      setStoredScrollRestoreY(null);
      setStoredScrollRestorePostId(null);
      return;
    }

    const restore = consumeFeedScrollRestore(location.pathname);
    setStoredScrollRestoreY(restore?.scrollY ?? null);
    setStoredScrollRestorePostId(restore?.postId ?? null);
    setHasConsumedStoredScrollRestore(true);
  }, [location.pathname]);

  useEffect(() => {
    snapshotStateRef.current = {
      activeTabId,
      activeCommunityId,
      communityFilters,
      posts,
      nextCursor,
      lastAutoLoadCursor: lastAutoLoadCursorRef.current,
      hideAnonymousPosts,
      preferCommunityShortNames,
    };
  }, [activeCommunityId, activeTabId, communityFilters, hideAnonymousPosts, nextCursor, posts, preferCommunityShortNames]);

  useEffect(() => {
    feedContextRef.current = {
      activeMode,
      activeCommunityId,
      hideAnonymousPosts,
      preferCommunityShortNames,
    };
    activeCommunityIdRef.current = activeCommunityId;
  }, [activeCommunityId, activeMode, hideAnonymousPosts, preferCommunityShortNames]);

  useEffect(() => {
    if (!isCommunitySearchActive || typeof window === "undefined") return;
    const rafId = window.requestAnimationFrame(() => {
      communitySearchInputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isCommunitySearchActive]);

  useEffect(() => {
    if (hasRestoredScrollRef.current || typeof window === "undefined") return;

    const snapshotScrollY = canRestoreSnapshot ? (initialSnapshot?.scrollY ?? 0) : 0;
    if (snapshotScrollY <= 0 && !hasConsumedStoredScrollRestore) return;

    const storedScrollY = storedScrollRestoreY ?? 0;
    const targetScrollY = snapshotScrollY > 0 ? snapshotScrollY : storedScrollY;

    if (targetScrollY <= 0 && storedScrollRestorePostId) {
      if (posts.length === 0 && feedStatus !== "error") return;

      const targetNode = document.querySelector<HTMLElement>(`[data-feed-post-id="${storedScrollRestorePostId}"]`);
      if (!targetNode) return;

      hasRestoredScrollRef.current = true;
      window.requestAnimationFrame(() => {
        targetNode.scrollIntoView({ block: "start", behavior: "auto" });
        lastKnownScrollYRef.current = window.scrollY;
      });
      return;
    }

    if (targetScrollY <= 0) {
      hasRestoredScrollRef.current = true;
      return;
    }

    const contentReadyForRestore = canRestoreSnapshot || posts.length > 0 || feedStatus === "error";
    if (!contentReadyForRestore) return;

    hasRestoredScrollRef.current = true;
    lastKnownScrollYRef.current = targetScrollY;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetScrollY, behavior: "auto" });
      lastKnownScrollYRef.current = window.scrollY;
    });
  }, [canRestoreSnapshot, feedStatus, hasConsumedStoredScrollRestore, initialSnapshot, posts.length, storedScrollRestorePostId, storedScrollRestoreY]);

  useEffect(() => {
    saveFeedRouteSnapshot(location.key, {
      ...snapshotStateRef.current,
      lastAutoLoadCursor: lastAutoLoadCursorRef.current,
      scrollY: lastKnownScrollYRef.current,
    });
  }, [activeCommunityId, activeTabId, communityFilters, hideAnonymousPosts, location.key, nextCursor, posts, preferCommunityShortNames]);

  const closeCommentsOverlay = useCallback(() => {
    if (openedFromSharePreviewRedirect) {
      navigate("/app", { replace: true });
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app", { replace: true });
  }, [navigate, openedFromSharePreviewRedirect]);

  useEffect(() => {
    if (!commentsOverlayPostId || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [commentsOverlayPostId]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetchFollowedCommunities({ limit: 60, order: "relevant" });
        if (!active) return;
        const options = (response.items ?? [])
          .map((item) => normalizeCommunityToFilterOption(item, preferCommunityShortNames))
          .filter((option): option is FilterOption => Boolean(option));

        setCommunityFilters((previous) =>
          mergeCommunityFilters({
            previous,
            followed: options,
            activeCommunityId: activeCommunityIdRef.current,
          })
        );
      } catch (_error) {
        if (!active) return;
        setCommunityFilters((previous) =>
          uniqueCommunityFilters(previous.length > 0 ? previous : defaultCommunityFilters)
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [preferCommunityShortNames]);

  const loadFeed = useCallback(async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
    const requestId = activeFeedRequestIdRef.current + 1;
    activeFeedRequestIdRef.current = requestId;
    const requestContext = {
      activeMode,
      activeCommunityId,
      hideAnonymousPosts,
      preferCommunityShortNames,
    };

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
        .map((item) =>
          normalizeFeedItemToPostData(item, {
            preferCommunityShortNames,
            hideAnonymousPosts,
          })
        )
        .filter((post): post is PostData => Boolean(post));

      if (requestId !== activeFeedRequestIdRef.current) return;
      const latest = feedContextRef.current;
      if (
        latest.activeMode !== requestContext.activeMode ||
        latest.activeCommunityId !== requestContext.activeCommunityId ||
        latest.hideAnonymousPosts !== requestContext.hideAnonymousPosts ||
        latest.preferCommunityShortNames !== requestContext.preferCommunityShortNames
      ) {
        return;
      }

      setPosts((prev) => (replace ? normalized : [...prev, ...normalized]));
      setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
      setFeedStatus("idle");
    } catch (error) {
      if (requestId !== activeFeedRequestIdRef.current) return;
      const latest = feedContextRef.current;
      if (
        latest.activeMode !== requestContext.activeMode ||
        latest.activeCommunityId !== requestContext.activeCommunityId ||
        latest.hideAnonymousPosts !== requestContext.hideAnonymousPosts ||
        latest.preferCommunityShortNames !== requestContext.preferCommunityShortNames
      ) {
        return;
      }

      const message = error instanceof FeedApiError ? extractApiErrorMessage(error.details) : undefined;
      setFeedError(message ?? "Unable to load feed.");
      setFeedStatus("error");
    }
  }, [activeCommunityId, activeMode, hideAnonymousPosts, preferCommunityShortNames]);

  useEffect(() => {
    feedStatusRef.current = feedStatus;
  }, [feedStatus]);

  useEffect(() => {
    if (skipInitialFeedLoadRef.current) {
      skipInitialFeedLoadRef.current = false;
      return;
    }

    setPosts([]);
    setNextCursor(null);
    lastAutoLoadCursorRef.current = null;
    void loadFeed({ replace: true });
  }, [activeMode, activeCommunityId, hideAnonymousPosts, loadFeed, preferCommunityShortNames]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      if (isCommunitySearchActive) return;
      setPosts([]);
      setNextCursor(null);
      lastAutoLoadCursorRef.current = null;
      void loadFeed({ replace: true });
    };
    window.addEventListener("looped:content-refresh", refresh);
    return () => {
      window.removeEventListener("looped:content-refresh", refresh);
    };
  }, [isCommunitySearchActive, loadFeed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const trimmedQuery = communitySearchQuery.trim();
    setCommunitySearchError(null);

    if (trimmedQuery.length < 2) {
      activeCommunitySearchRequestIdRef.current += 1;
      setCommunitySearchStatus("idle");
      setCommunitySearchResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = activeCommunitySearchRequestIdRef.current + 1;
      activeCommunitySearchRequestIdRef.current = requestId;
      setCommunitySearchStatus("loading");
      try {
        const response = await searchCommunities({
          query: trimmedQuery,
          limit: 25,
        });
        if (requestId !== activeCommunitySearchRequestIdRef.current) return;

        const options = (response.items ?? [])
          .map((item) => normalizeCommunityToFilterOption(item, preferCommunityShortNames))
          .filter((option): option is FilterOption => Boolean(option));

        setCommunitySearchResults(uniqueCommunityFilters(options).filter((option) => option.id !== "all"));
        setCommunitySearchStatus("ready");
      } catch (error) {
        if (requestId !== activeCommunitySearchRequestIdRef.current) return;
        const message = error instanceof SearchApiError ? extractApiErrorMessage(error.details) : undefined;
        setCommunitySearchError(message ?? "Unable to search communities.");
        setCommunitySearchResults([]);
        setCommunitySearchStatus("error");
      }
    }, COMMUNITY_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [communitySearchQuery, preferCommunityShortNames]);

  const dismissCommunitySearch = useCallback(() => {
    activeCommunitySearchRequestIdRef.current += 1;
    setIsCommunitySearchActive(false);
    setCommunitySearchQuery("");
    setCommunitySearchStatus("idle");
    setCommunitySearchError(null);
    setCommunitySearchResults([]);
  }, []);

  const handleCommunitySelection = useCallback((filter: FilterOption) => {
    if (filter.id === "all") {
      setActiveCommunityId("all");
      return;
    }

    saveRecentFeedCommunity(filter);
    setActiveCommunityId(filter.id);
    setCommunityFilters((previous) => moveCommunityFilterToFront(previous, filter));
  }, []);

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

  const rightRail = (
    <AppSearchPanel
      defaultActiveFilterId="all"
      activeFilterId={activeCommunityId}
      query={communitySearchQuery}
      onQueryChange={(value) => setCommunitySearchQuery(value)}
      onFilterSelect={(filter) => {
        handleCommunitySelection(filter);
        activeCommunitySearchRequestIdRef.current += 1;
        setCommunitySearchQuery("");
        setCommunitySearchStatus("idle");
        setCommunitySearchError(null);
        setCommunitySearchResults([]);
      }}
      filters={communityFilters}
      searchStatus={communitySearchStatus}
      searchError={communitySearchError}
      searchResults={communitySearchResults}
      minSearchLength={2}
    />
  );

  return (
    <AppLayout activeNavId="home" rightRail={rightRail}>
      <AppMobileHeader showBorder={false} showAction={false} />

      <header className="bg-bg">
        <div className="grid grid-cols-3 border-b border-border/70">
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

        {isCommunitySearchActive ? (
          <div className="space-y-2 px-3 pb-3 pt-2.5 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-11 flex-1 items-center gap-2 rounded-full bg-bg-muted px-3 text-text-secondary">
                <SearchIcon className="h-5 w-5" />
                <input
                  ref={communitySearchInputRef}
                  value={communitySearchQuery}
                  onChange={(event) => setCommunitySearchQuery(event.target.value)}
                  type="search"
                  placeholder="Search communities"
                  className="w-full bg-transparent text-[1.02rem] text-strong outline-none placeholder:text-text-light"
                  aria-label="Search communities"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="button"
                onClick={dismissCommunitySearch}
                className="px-1 text-[1.02rem] font-semibold text-secondary transition hover:opacity-85"
              >
                Cancel
              </button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-bg px-4 py-3">
              {communitySearchStatus === "error" ? (
                <p className="text-sm text-text-secondary">{communitySearchError ?? "Unable to search communities."}</p>
              ) : null}

              {communitySearchStatus === "loading" ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-text-secondary" />
                  <span>Searching communities...</span>
                </div>
              ) : null}

              {communitySearchStatus !== "loading" && communitySearchQuery.trim().length === 0 ? (
                <div className="space-y-1 text-center">
                  <p className="text-[1.02rem] font-medium text-text-secondary">Start typing to search.</p>
                  <p className="text-sm text-text-light">Selecting a community filters your feed to posts from that community.</p>
                </div>
              ) : null}

              {communitySearchStatus !== "loading" &&
              communitySearchStatus !== "error" &&
              communitySearchQuery.trim().length === 1 ? (
                <p className="text-sm text-text-secondary">Type at least 2 characters.</p>
              ) : null}

              {communitySearchStatus === "ready" && communitySearchResults.length === 0 ? (
                <p className="text-sm text-text-secondary">No matches found.</p>
              ) : null}

              {communitySearchStatus === "ready" && communitySearchResults.length > 0 ? (
                <div className="-mx-2 divide-y divide-border/60">
                  {communitySearchResults.map((result) => (
                    <button
                      key={`community-search-result-${result.id}`}
                      type="button"
                      onClick={() => {
                        handleCommunitySelection(result);
                        dismissCommunitySearch();
                      }}
                      className="flex w-full items-center justify-between px-2 py-2.5 text-left transition hover:bg-bg-muted/40"
                    >
                      <span className="line-clamp-1 text-sm font-semibold text-strong">{result.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => {
                setIsCommunitySearchActive(true);
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-secondary transition hover:opacity-90"
              aria-label="Search communities"
            >
              <SearchIcon className="h-6 w-6" />
            </button>

            {communityFilters.map((filter) => {
              const isActive = filter.id === activeCommunityId;
              return (
                <button
                  key={`mobile-filter-${filter.id}`}
                  type="button"
                  onClick={() => handleCommunitySelection(filter)}
                  className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
                    isActive ? "bg-brand text-white" : "bg-bg-muted text-text-secondary hover:text-strong"
                  }`}
                  aria-pressed={isActive}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        )}
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

      {commentsOverlayPostId ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-shell-bg">
          <AppPostCommentsPage postId={commentsOverlayPostId} overlayMode onRequestClose={closeCommentsOverlay} />
        </div>
      ) : null}
    </AppLayout>
  );
}
