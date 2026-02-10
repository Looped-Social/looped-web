import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import {
  SearchApiError,
  fetchFieldsIndex,
  fetchMajorsIndex,
  fetchRecommendedCommunities,
  fetchSpecializationsBrowse,
  fetchTrendingPosts,
  searchCommunities,
  searchHashtags,
  searchPosts,
  searchUsers,
  type CommunitySearchKind,
} from "@/lib/searchApi";

type SearchFilterId =
  | "all"
  | "posts"
  | "users"
  | "communities"
  | "companies"
  | "schools"
  | "majors"
  | "fields";

type SearchStatus = "idle" | "loading" | "ready" | "error";
type LandingStatus = "loading" | "ready" | "error";

type TrendingPost = {
  id: string;
  authorName: string;
  content: string;
  timeLabel: string;
  communityLabel?: string;
};

type CommunityCard = {
  id: string;
  label: string;
  subtitle?: string;
  membersLabel?: string;
  icon?: string;
  kind?: string;
};

type SpecializationCard = {
  id: string;
  label: string;
  membersLabel?: string;
  icon?: string;
};

type UserResult = {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  isAnonymous: boolean;
};

type PostResult = {
  id: string;
  authorName: string;
  content: string;
  subtitle?: string;
  timeLabel: string;
  isAnonymous: boolean;
  authorId?: string;
  anonProfileId?: string;
};

type CommunityResult = {
  id: string;
  label: string;
  subtitle?: string;
  membersLabel?: string;
  icon?: string;
  kind?: string;
};

type HashtagResult = {
  tag: string;
  postsLabel?: string;
};

type SearchResultsState = {
  users: UserResult[];
  posts: PostResult[];
  communities: CommunityResult[];
  hashtags: HashtagResult[];
};

const RECENT_SEARCHES_KEY = "recentSearches";
const RECENT_SEARCH_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

const FILTERS: Array<{ id: SearchFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "users", label: "Users" },
  { id: "communities", label: "Communities" },
  { id: "companies", label: "Companies" },
  { id: "schools", label: "Schools" },
  { id: "majors", label: "Majors" },
  { id: "fields", label: "Fields" },
];

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

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) return value;
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

function normalizedOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function formatTimeAgo(value: unknown): string {
  const date = asDate(value);
  if (!date) return "recently";

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

function extractItemsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const items = payload.items;
  if (Array.isArray(items)) return items;

  const data = payload.data;
  if (Array.isArray(data)) return data;

  if (Array.isArray(payload.majors)) return payload.majors;
  if (Array.isArray(payload.fields)) return payload.fields;
  return [];
}

function formatMembersLabel(value: unknown): string | undefined {
  const count = getNumber(value);
  if (count === undefined) return undefined;
  const safe = Math.max(Math.round(count), 0);
  return `${safe} ${safe === 1 ? "member" : "members"}`;
}

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof SearchApiError) {
    const body = (error.details ?? "").trim();
    if (body) {
      try {
        const parsed = JSON.parse(body) as unknown;
        if (isRecord(parsed)) {
          const message = normalizedOptional(parsed.message);
          if (message) return message;
          const code = normalizedOptional(parsed.error);
          if (code) return code.replaceAll("_", " ");
        }
      } catch {
        return body;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function normalizeSpecializationIndexMap(payload: unknown): Record<string, string> {
  const map: Record<string, string> = {};

  for (const entry of extractItemsArray(payload)) {
    if (!isRecord(entry)) continue;
    const id = pickString(entry, ["id", "specialization_id", "specializationId"]);
    const name = pickString(entry, ["name", "title", "label"]);
    const shortName = pickString(entry, ["short_name", "shortName"]);
    const icon =
      pickString(entry, ["emoji", "icon_emoji", "iconEmoji", "icon", "icon_url", "iconUrl"]) ??
      undefined;
    if (!icon) continue;

    if (id) map[`id:${id}`] = icon;
    if (name) map[`name:${name.trim().toLowerCase()}`] = icon;
    if (shortName) map[`name:${shortName.trim().toLowerCase()}`] = icon;
  }

  return map;
}

function resolveSpecializationIcon(item: Record<string, unknown>, icons: Record<string, string>): string | undefined {
  const directIcon = pickString(item, [
    "emoji",
    "icon_emoji",
    "iconEmoji",
    "icon",
    "icon_url",
    "iconUrl",
    "image_url",
    "imageUrl",
  ]);
  if (directIcon) return directIcon;

  const id = pickString(item, ["id", "specialization_id", "specializationId"]);
  if (id && icons[`id:${id}`]) return icons[`id:${id}`];

  const name = pickString(item, ["name", "title", "label", "short_name", "shortName"]);
  if (name && icons[`name:${name.trim().toLowerCase()}`]) return icons[`name:${name.trim().toLowerCase()}`];

  return undefined;
}

function normalizeTrendingPost(item: unknown): TrendingPost | null {
  if (!isRecord(item)) return null;
  const post = isRecord(item.post) ? item.post : item;

  const id = pickString(post, ["id", "post_id", "postId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(post, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ?? false;

  const firstName = pickString(post, ["author_first_name", "authorFirstName"]);
  const lastName = pickString(post, ["author_last_name", "authorLastName"]);
  const fullName = [normalizedOptional(firstName), normalizedOptional(lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  const authorName = isAnonymous
    ? "Anonymous"
    : fullName ||
      pickString(post, ["author_display_name", "authorDisplayName", "author_name", "authorName", "author_handle", "authorHandle"]) ||
      "User";

  const content = pickString(post, ["content", "text", "body", "message"]) ?? "";
  const communityLabel =
    pickString(post, ["community_short_name", "communityShortName", "community_name", "communityName"]) ?? undefined;
  const timeLabel = formatTimeAgo(post.created_at ?? post.createdAt ?? post.timestamp ?? post.time);

  return { id, authorName, content, communityLabel, timeLabel };
}

function normalizeCommunityCard(item: unknown): CommunityCard | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "community_id", "communityId", "loop_id", "loopId"]);
  const label =
    pickString(item, ["short_name", "shortName", "name", "display_name", "displayName", "title"]) ??
    pickString(item, ["handle", "username"]);
  if (!id || !label) return null;

  const subtitle =
    pickString(item, ["name", "display_name", "displayName"]) &&
    pickString(item, ["short_name", "shortName"])
      ? pickString(item, ["name", "display_name", "displayName"])
      : undefined;

  const membersLabel = formatMembersLabel(
    item.member_count ??
      item.memberCount ??
      item.members_count ??
      item.membersCount ??
      item.follower_count ??
      item.followers_count
  );

  const icon = pickString(item, [
    "emoji",
    "icon_emoji",
    "iconEmoji",
    "icon",
    "icon_url",
    "iconUrl",
    "image_url",
    "imageUrl",
  ]);

  return {
    id,
    label,
    subtitle: subtitle ?? undefined,
    membersLabel,
    icon: icon ?? undefined,
    kind: pickString(item, ["kind", "community_kind", "communityKind"]),
  };
}

function normalizeSpecializationCard(item: unknown, icons: Record<string, string>): SpecializationCard | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "specialization_id", "specializationId"]);
  const label = pickString(item, ["short_name", "shortName", "name", "title", "label"]);
  if (!id || !label) return null;

  const membersLabel = formatMembersLabel(
    item.member_count ??
      item.memberCount ??
      item.members_count ??
      item.membersCount ??
      item.joined_count ??
      item.joinedCount ??
      item.follower_count ??
      item.followers_count
  );

  return {
    id,
    label,
    membersLabel,
    icon: resolveSpecializationIcon(item, icons),
  };
}

function normalizeUserResult(item: unknown): UserResult | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "user_id", "userId"]);
  if (!id) return null;

  const firstName = pickString(item, ["first_name", "firstName"]);
  const lastName = pickString(item, ["last_name", "lastName"]);
  const fullName = [normalizedOptional(firstName), normalizedOptional(lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  const isAnonymous =
    pickBoolean(item, ["is_anonymous", "isAnonymous", "anon", "anonymous", "actor_is_anonymous", "actorIsAnonymous"]) ??
    false;

  const name = isAnonymous
    ? "Anonymous"
    : fullName ||
      pickString(item, ["display_name", "displayName", "name", "username", "handle"]) ||
      "User";

  const handle = normalizedOptional(pickString(item, ["username", "handle"]));
  const subtitleCommunity =
    pickString(item, [
      "display_community_name",
      "displayCommunityName",
      "community_name",
      "communityName",
      "company_name",
      "companyName",
      "school_name",
      "schoolName",
    ]) ?? undefined;
  const subtitle = [handle ? `@${handle.replace(/^@/, "")}` : undefined, subtitleCommunity]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  return {
    id,
    name,
    subtitle: subtitle || undefined,
    avatarUrl: pickString(item, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl"]) ?? undefined,
    isAnonymous,
  };
}

function normalizePostResult(item: unknown): PostResult | null {
  if (!isRecord(item)) return null;
  const post = isRecord(item.post) ? item.post : item;

  const id = pickString(post, ["id", "post_id", "postId"]);
  if (!id) return null;

  const content = pickString(post, ["content", "text", "body", "message"]) ?? "";
  const isAnonymous =
    pickBoolean(post, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ?? false;
  const firstName = pickString(post, ["author_first_name", "authorFirstName"]);
  const lastName = pickString(post, ["author_last_name", "authorLastName"]);
  const fullName = [normalizedOptional(firstName), normalizedOptional(lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  const authorName = isAnonymous
    ? "Anonymous"
    : fullName ||
      pickString(post, ["author_display_name", "authorDisplayName", "author_name", "authorName", "author_handle", "authorHandle"]) ||
      "User";

  const communityLabel =
    pickString(post, ["community_short_name", "communityShortName", "community_name", "communityName"]) ?? undefined;

  const authorId = pickString(post, ["author_id", "authorId"]);
  const anonProfileId = pickString(post, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]);

  return {
    id,
    authorName,
    content,
    subtitle: communityLabel ? `Posted in ${communityLabel}` : undefined,
    timeLabel: formatTimeAgo(post.created_at ?? post.createdAt ?? post.timestamp ?? post.time),
    isAnonymous,
    authorId: authorId ?? undefined,
    anonProfileId: anonProfileId ?? undefined,
  };
}

function normalizeHashtagResult(item: unknown): HashtagResult | null {
  if (!isRecord(item)) return null;
  const name = pickString(item, ["name", "tag", "hashtag"]);
  if (!name) return null;

  const clean = name.replace(/^#/, "").trim();
  if (!clean) return null;

  const postsLabel = formatMembersLabel(item.post_count ?? item.postCount ?? item.count ?? item.usage_count ?? item.usageCount);
  return {
    tag: clean,
    postsLabel: postsLabel ? postsLabel.replace("members", "posts").replace("member", "post") : undefined,
  };
}

function normalizeRecentSearches(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique: string[] = [];
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim();
    if (!normalized) continue;
    if (unique.includes(normalized)) continue;
    unique.push(normalized);
    if (unique.length >= RECENT_SEARCH_LIMIT) break;
  }
  return unique;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-[2rem] leading-[1.2] font-semibold text-strong sm:text-2xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
    </div>
  );
}

function LandingSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center gap-2 rounded-xl bg-bg-muted px-4 text-text-secondary transition hover:text-strong"
      aria-label="Search Looped"
    >
      <SearchIcon className="h-5 w-5" />
      <span className="text-base font-medium">Search Looped</span>
    </button>
  );
}

function SearchFilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-brand text-white" : "border border-border/70 bg-bg text-text-secondary hover:text-strong"
      }`}
    >
      {label}
    </button>
  );
}

function IconBadge({ icon, label }: { icon?: string; label: string }) {
  const display = icon && icon.trim().length ? icon.trim() : initialsFromName(label).slice(0, 1);
  const isImageUrl = /^https?:\/\//i.test(display);
  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-bg-muted text-xl">
      {isImageUrl ? <img src={display} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span>{display}</span>}
    </div>
  );
}

export function AppSearchPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SearchFilterId>("all");

  const [landingStatus, setLandingStatus] = useState<LandingStatus>("loading");
  const [landingError, setLandingError] = useState<string | null>(null);
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [recommendedCommunities, setRecommendedCommunities] = useState<CommunityCard[]>([]);
  const [majorCards, setMajorCards] = useState<SpecializationCard[]>([]);
  const [fieldCards, setFieldCards] = useState<SpecializationCard[]>([]);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultsState>({
    users: [],
    posts: [],
    communities: [],
    hashtags: [],
  });

  const requestRef = useRef(0);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]") as unknown;
      setRecentSearches(normalizeRecentSearches(parsed));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const persistRecentSearches = useCallback((next: string[]) => {
    setRecentSearches(next);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  }, []);

  const saveRecentSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const next = [trimmed, ...recentSearches.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(
        0,
        RECENT_SEARCH_LIMIT
      );
      persistRecentSearches(next);
    },
    [persistRecentSearches, recentSearches]
  );

  const removeRecentSearch = useCallback(
    (value: string) => {
      const next = recentSearches.filter((entry) => entry !== value);
      persistRecentSearches(next);
    },
    [persistRecentSearches, recentSearches]
  );

  const clearRecentSearches = useCallback(() => {
    persistRecentSearches([]);
  }, [persistRecentSearches]);

  const loadLanding = useCallback(async () => {
    setLandingStatus("loading");
    setLandingError(null);

    try {
      const [trendingResponse, communitiesResponse, majorsBrowseResponse, fieldsBrowseResponse, majorsIndexResponse, fieldsIndexResponse] =
        await Promise.all([
          fetchTrendingPosts({ limit: 3 }),
          fetchRecommendedCommunities({ limit: 8 }),
          fetchSpecializationsBrowse({ type: "major", limit: 24 }),
          fetchSpecializationsBrowse({ type: "field", limit: 40 }),
          fetchMajorsIndex(),
          fetchFieldsIndex(),
        ]);

      const majorIcons = normalizeSpecializationIndexMap(majorsIndexResponse);
      const fieldIcons = normalizeSpecializationIndexMap(fieldsIndexResponse);
      const combinedIcons = { ...majorIcons, ...fieldIcons };

      const nextTrending = extractItemsArray(trendingResponse).map(normalizeTrendingPost).filter((item): item is TrendingPost => Boolean(item));
      const nextCommunities = extractItemsArray(communitiesResponse)
        .map(normalizeCommunityCard)
        .filter((item): item is CommunityCard => Boolean(item));
      const nextMajors = extractItemsArray(majorsBrowseResponse)
        .map((item) => normalizeSpecializationCard(item, combinedIcons))
        .filter((item): item is SpecializationCard => Boolean(item));
      const nextFields = extractItemsArray(fieldsBrowseResponse)
        .map((item) => normalizeSpecializationCard(item, combinedIcons))
        .filter((item): item is SpecializationCard => Boolean(item));

      setTrendingPosts(nextTrending.slice(0, 3));
      setRecommendedCommunities(nextCommunities.slice(0, 8));
      setMajorCards(nextMajors.slice(0, 24));
      setFieldCards(nextFields.slice(0, 40));
      setLandingStatus("ready");
    } catch (error) {
      setLandingError(parseApiErrorMessage(error));
      setLandingStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadLanding();
  }, [loadLanding]);

  useEffect(() => {
    if (!isResultsOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchStatus("idle");
      setSearchError(null);
      setSearchResults({
        users: [],
        posts: [],
        communities: [],
        hashtags: [],
      });
      return;
    }

    requestRef.current += 1;
    const requestId = requestRef.current;
    setSearchStatus("loading");
    setSearchError(null);

    const timer = window.setTimeout(async () => {
      const normalizedQuery = trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed;
      const hashtagOnly = trimmed.startsWith("#") && activeFilter === "all";

      const updateIfCurrent = (next: Partial<SearchResultsState>, status: SearchStatus, errorMessage: string | null) => {
        if (requestRef.current !== requestId) return;
        setSearchResults((previous) => ({ ...previous, ...next }));
        setSearchStatus(status);
        setSearchError(errorMessage);
      };

      try {
        if (hashtagOnly) {
          const hashtagResponse = await searchHashtags({ query: normalizedQuery, limit: 5 });
          const hashtags = extractItemsArray(hashtagResponse)
            .map(normalizeHashtagResult)
            .filter((item): item is HashtagResult => Boolean(item));
          updateIfCurrent({ users: [], posts: [], communities: [], hashtags }, "ready", null);
          return;
        }

        if (activeFilter === "all") {
          const [usersResult, communitiesResult, hashtagsResult, postsResult] = await Promise.allSettled([
            searchUsers({ query: trimmed, limit: 20 }),
            searchCommunities({ query: trimmed, limit: 20 }),
            searchHashtags({ query: trimmed, limit: 5 }),
            searchPosts({ query: trimmed, limit: 10 }),
          ]);

          const users =
            usersResult.status === "fulfilled"
              ? extractItemsArray(usersResult.value).map(normalizeUserResult).filter((item): item is UserResult => Boolean(item))
              : [];
          const communities =
            communitiesResult.status === "fulfilled"
              ? extractItemsArray(communitiesResult.value)
                  .map(normalizeCommunityCard)
                  .filter((item): item is CommunityCard => Boolean(item))
                  .map((item) => ({
                    id: item.id,
                    label: item.label,
                    subtitle: item.subtitle,
                    membersLabel: item.membersLabel,
                    icon: item.icon,
                    kind: item.kind,
                  }))
              : [];
          const hashtags =
            hashtagsResult.status === "fulfilled"
              ? extractItemsArray(hashtagsResult.value)
                  .map(normalizeHashtagResult)
                  .filter((item): item is HashtagResult => Boolean(item))
              : [];
          const posts =
            postsResult.status === "fulfilled"
              ? extractItemsArray(postsResult.value).map(normalizePostResult).filter((item): item is PostResult => Boolean(item))
              : [];

          const everythingEmpty = users.length === 0 && communities.length === 0 && hashtags.length === 0 && posts.length === 0;
          const primaryFailed =
            usersResult.status === "rejected" && communitiesResult.status === "rejected" && postsResult.status === "rejected";

          if (everythingEmpty && primaryFailed) {
            const message = parseApiErrorMessage(usersResult.status === "rejected" ? usersResult.reason : communitiesResult);
            updateIfCurrent({ users, communities, hashtags, posts }, "error", message);
            return;
          }

          updateIfCurrent({ users, communities, hashtags, posts }, "ready", null);
          return;
        }

        let nextUsers: UserResult[] = [];
        let nextPosts: PostResult[] = [];
        let nextCommunities: CommunityResult[] = [];
        const nextHashtags: HashtagResult[] = [];

        if (activeFilter === "users") {
          const response = await searchUsers({ query: trimmed, limit: 20 });
          nextUsers = extractItemsArray(response).map(normalizeUserResult).filter((item): item is UserResult => Boolean(item));
        } else if (activeFilter === "posts") {
          const response = await searchPosts({ query: trimmed, limit: 20 });
          nextPosts = extractItemsArray(response).map(normalizePostResult).filter((item): item is PostResult => Boolean(item));
        } else {
          const kindByFilter: Partial<Record<SearchFilterId, CommunitySearchKind>> = {
            companies: "company",
            schools: "school",
            majors: "major",
            fields: "field",
          };
          const response = await searchCommunities({
            query: trimmed,
            kind: kindByFilter[activeFilter],
            limit: 20,
          });
          nextCommunities = extractItemsArray(response)
            .map(normalizeCommunityCard)
            .filter((item): item is CommunityCard => Boolean(item))
            .map((item) => ({
              id: item.id,
              label: item.label,
              subtitle: item.subtitle,
              membersLabel: item.membersLabel,
              icon: item.icon,
              kind: item.kind,
            }));
        }

        updateIfCurrent(
          {
            users: nextUsers,
            posts: nextPosts,
            communities: nextCommunities,
            hashtags: nextHashtags,
          },
          "ready",
          null
        );
      } catch (error) {
        updateIfCurrent({ users: [], posts: [], communities: [], hashtags: [] }, "error", parseApiErrorMessage(error));
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeFilter, isResultsOpen, query]);

  const hasAnyResults = useMemo(() => {
    return (
      searchResults.users.length > 0 ||
      searchResults.communities.length > 0 ||
      searchResults.hashtags.length > 0 ||
      searchResults.posts.length > 0
    );
  }, [searchResults]);

  const handleOpenResults = useCallback(() => {
    setIsResultsOpen(true);
  }, []);

  const handleCloseResults = useCallback(() => {
    setIsResultsOpen(false);
    setSearchStatus("idle");
    setSearchError(null);
  }, []);

  const handleSubmitQuery = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
  }, [query, saveRecentSearch]);

  const handleTapFilter = useCallback(
    (filterId: SearchFilterId) => {
      setActiveFilter((current) => (current === filterId ? "all" : filterId));
    },
    []
  );

  const handleCommunityTap = useCallback(
    (community: CommunityCard | CommunityResult) => {
      navigate(`/app/community/${community.id}`);
    },
    [navigate]
  );

  const handlePostTap = useCallback(
    (post: TrendingPost | PostResult) => {
      showToast({
        title: "Post",
        message: "Post detail from search is coming next.",
      });
      if ("authorId" in post && post.authorId) {
        navigate(`/app/profile/${post.authorId}`);
      }
    },
    [navigate, showToast]
  );

  return (
    <AppLayout activeNavId="search">
      <div className="bg-bg px-4 pb-8 pt-4 sm:px-5">
        {!isResultsOpen ? (
          <div className="mx-auto w-full max-w-[560px] space-y-8">
            <LandingSearchButton onClick={handleOpenResults} />

            <section className="space-y-3">
              <SectionHeader title="Trending Posts" />

              {landingStatus === "loading" ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }, (_, index) => (
                    <div key={`trending-skeleton-${index}`} className="animate-pulse rounded-2xl border border-border/60 bg-bg px-4 py-3">
                      <div className="h-3 w-1/3 rounded-full bg-bg-muted" />
                      <div className="mt-2 h-3 w-full rounded-full bg-bg-muted" />
                      <div className="mt-2 h-3 w-2/3 rounded-full bg-bg-muted" />
                    </div>
                  ))}
                </div>
              ) : null}

              {landingStatus === "error" ? (
                <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
                  <p className="text-sm font-semibold text-strong">Unable to load trending posts.</p>
                  <p className="text-sm text-text-secondary">{landingError}</p>
                  <button
                    type="button"
                    onClick={() => void loadLanding()}
                    className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {landingStatus === "ready" ? (
                trendingPosts.length ? (
                  <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-bg">
                    {trendingPosts.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => handlePostTap(post)}
                        className="w-full px-4 py-3 text-left transition hover:bg-bg-muted/45"
                      >
                        <p className="text-sm font-semibold text-strong">{post.authorName}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-text-primary">{post.content}</p>
                        <p className="mt-2 text-xs text-text-light">
                          {post.communityLabel ? `Posted in ${post.communityLabel}` : "Trending now"} · {post.timeLabel}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No trending posts yet.</p>
                )
              ) : null}
            </section>

            <section className="space-y-3">
              <SectionHeader title="Communities" subtitle="Recommended communities for you" />
              {landingStatus === "ready" && recommendedCommunities.length > 0 ? (
                <div className="flex snap-x gap-3 overflow-x-auto pb-1">
                  {recommendedCommunities.map((community) => (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => handleCommunityTap(community)}
                      className="w-[128px] shrink-0 snap-start rounded-2xl border border-border/60 bg-bg px-3 py-3 text-center transition hover:bg-bg-muted/35"
                    >
                      <div className="mx-auto flex w-fit justify-center">
                        <IconBadge icon={community.icon} label={community.label} />
                      </div>
                      <p className="mt-2 line-clamp-1 text-[2rem] leading-[1.2] font-semibold text-strong sm:text-2xl">{community.label}</p>
                      <p className="line-clamp-1 text-sm text-text-secondary">{community.subtitle ?? community.kind ?? ""}</p>
                      <p className="mt-1 text-sm text-text-light">{community.membersLabel ?? "0 members"}</p>
                    </button>
                  ))}
                </div>
              ) : null}
              {landingStatus === "ready" && recommendedCommunities.length === 0 ? (
                <p className="text-sm text-text-secondary">No recommended communities yet.</p>
              ) : null}
            </section>

            {majorCards.length > 0 ? (
              <section className="space-y-3">
                <SectionHeader title="Majors" />
                <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5">
                  {majorCards.map((major) => (
                    <button
                      key={major.id}
                      type="button"
                      onClick={() => handleCommunityTap({ id: major.id, label: major.label })}
                      className="text-center"
                    >
                      <div className="mx-auto flex w-fit justify-center">
                        <IconBadge icon={major.icon} label={major.label} />
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm font-semibold text-strong">{major.label}</p>
                      <p className="text-sm text-text-light">{major.membersLabel ?? "0 members"}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <SectionHeader title="Fields" />
              {fieldCards.length ? (
                <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5">
                  {fieldCards.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => handleCommunityTap({ id: field.id, label: field.label })}
                      className="text-center"
                    >
                      <div className="mx-auto flex w-fit justify-center">
                        <IconBadge icon={field.icon} label={field.label} />
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm font-semibold text-strong">{field.label}</p>
                      <p className="text-sm text-text-light">{field.membersLabel ?? "0 members"}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No fields yet.</p>
              )}
            </section>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[560px]">
            <div className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-bg px-4 pb-3 pt-1 sm:-mx-5 sm:px-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseResults}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-text-secondary transition hover:text-strong"
                  aria-label="Back"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-bg-muted px-3 text-text-secondary">
                  <SearchIcon className="h-5 w-5" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSubmitQuery();
                      }
                    }}
                    autoFocus
                    type="search"
                    placeholder="Search Looped"
                    className="w-full bg-transparent text-base text-strong outline-none placeholder:text-text-light"
                    aria-label="Search Looped"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
                {FILTERS.map((filter) => (
                  <SearchFilterPill
                    key={filter.id}
                    label={filter.label}
                    active={activeFilter === filter.id}
                    onClick={() => handleTapFilter(filter.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4">
              {!query.trim() ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-strong">Recent searches</h2>
                    {recentSearches.length ? (
                      <button
                        type="button"
                        onClick={clearRecentSearches}
                        className="text-sm font-semibold text-brand transition hover:text-brand-hover"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>

                  {recentSearches.length ? (
                    <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-bg">
                      {recentSearches.map((entry) => (
                        <li key={entry} className="flex items-center justify-between gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setQuery(entry);
                            }}
                            className="flex-1 text-left text-sm text-text-primary transition hover:text-strong"
                          >
                            {entry}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRecentSearch(entry)}
                            className="text-xs font-semibold text-text-light transition hover:text-strong"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-secondary">No recent searches.</p>
                  )}
                </section>
              ) : null}

              {query.trim() && searchStatus === "loading" ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={`search-skeleton-${index}`} className="animate-pulse rounded-2xl border border-border/60 bg-bg px-4 py-3">
                      <div className="h-3 w-1/3 rounded-full bg-bg-muted" />
                      <div className="mt-2 h-3 w-2/3 rounded-full bg-bg-muted" />
                    </div>
                  ))}
                </div>
              ) : null}

              {query.trim() && searchStatus === "error" ? (
                <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
                  <p className="text-sm font-semibold text-strong">Unable to search right now.</p>
                  <p className="text-sm text-text-secondary">{searchError}</p>
                </div>
              ) : null}

              {query.trim() && searchStatus === "ready" && !hasAnyResults ? (
                <p className="text-sm text-text-secondary">No results found.</p>
              ) : null}

              {query.trim() && searchStatus === "ready" && hasAnyResults ? (
                <div className="space-y-5">
                  {searchResults.users.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-strong">Users</h3>
                      <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-bg">
                        {searchResults.users.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              saveRecentSearch(query.trim());
                              navigate(`/app/profile/${user.id}`);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg-muted/35"
                          >
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-sm font-semibold text-text-secondary">
                              <img
                                src={user.avatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={handleProfileImageError}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-strong">{user.name}</p>
                              {user.subtitle ? <p className="truncate text-xs text-text-secondary">{user.subtitle}</p> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {searchResults.communities.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-strong">Communities</h3>
                      <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-bg">
                        {searchResults.communities.map((community) => (
                          <button
                            key={community.id}
                            type="button"
                            onClick={() => {
                              saveRecentSearch(query.trim());
                              handleCommunityTap(community);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg-muted/35"
                          >
                            <IconBadge icon={community.icon} label={community.label} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-strong">{community.label}</p>
                              <p className="truncate text-xs text-text-secondary">
                                {community.subtitle ?? community.kind ?? community.membersLabel ?? ""}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {searchResults.hashtags.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-strong">Hashtags</h3>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.hashtags.map((hashtag) => (
                          <button
                            key={hashtag.tag}
                            type="button"
                            onClick={() => {
                              saveRecentSearch(`#${hashtag.tag}`);
                              setQuery(`#${hashtag.tag}`);
                              showToast({
                                title: "Hashtag feed",
                                message: "Full hashtag feed page is coming next.",
                              });
                            }}
                            className="rounded-full border border-border/70 bg-bg px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                          >
                            #{hashtag.tag}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {searchResults.posts.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-strong">Posts</h3>
                      <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-bg">
                        {searchResults.posts.map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => {
                              saveRecentSearch(query.trim());
                              handlePostTap(post);
                            }}
                            className="w-full px-4 py-3 text-left transition hover:bg-bg-muted/35"
                          >
                            <p className="text-sm font-semibold text-strong">{post.authorName}</p>
                            {post.subtitle ? <p className="mt-0.5 text-xs text-text-secondary">{post.subtitle}</p> : null}
                            <p className="mt-2 line-clamp-2 text-sm text-text-primary">{post.content}</p>
                            <p className="mt-2 text-xs text-text-light">{post.timeLabel}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
