import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { PeopleRecommendationRail } from "@/app/components/PeopleRecommendationRail/PeopleRecommendationRail";
import { useToast } from "@/app/components/AppToast/AppToast";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { usePeopleRecommendations } from "@/app/hooks/usePeopleRecommendations";
import { resolveCommunityLabel, usePreferCommunityShortNames } from "@/lib/communityDisplayPreference";
import { useContentPreferences } from "@/lib/contentPreferences";
import { fetchPostDetail } from "@/lib/commentsApi";
import { fetchFollowedCommunities } from "@/lib/feedApi";
import { resolveMediaAssets } from "@/lib/mediaApi";
import type { PeopleRecommendationItem } from "@/lib/peopleRecommendationsApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll } from "@/lib/postPoll";
import { extractViewerCapabilitiesFromPost } from "@/lib/postViewerCapabilities";
import { fetchHashtagPosts } from "@/lib/postReadApi";
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
type LandingSectionId = "majors" | "fields";
type SearchResultsMode = "results" | "post-search-feed" | "hashtag-feed";
type SearchFeedStatus = "idle" | "loading" | "loading-more" | "ready" | "error";

type TrendingPost = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  postedInLabel?: string;
  authorProfileImageUrl?: string;
  imageUrl?: string;
  mediaAssetIds: string[];
};

type CommunityCard = {
  id: string;
  label: string;
  subtitle?: string;
  description?: string;
  membersLabel?: string;
  icon?: string;
  imageUrl?: string;
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
  description?: string;
  membersLabel?: string;
  icon?: string;
  imageUrl?: string;
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
const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";
const TRENDING_LIMIT = 3;
const RECOMMENDED_COMMUNITIES_LIMIT = 8;
const SPECIALIZATIONS_INITIAL_LIMIT = 24;
const SPECIALIZATIONS_LOAD_MORE_LIMIT = 40;
const SPECIALIZATION_GRID_PAGE_SIZE = 8;

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

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="M9 18l6-6-6-6" />
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

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = getNumber(source[key]);
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

function extractNextCursor(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const next = normalizedOptional(payload.next_cursor ?? payload.nextCursor);
  return next ?? null;
}

function extractIconValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (!isRecord(value)) return undefined;

  const kind = normalizedOptional(value.kind)?.toLowerCase();
  const resolved = normalizedOptional(value.value);
  if (!resolved) return undefined;
  if (kind === "sf_symbol") return undefined;
  return resolved;
}

function chunkByPage<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) return [items];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

function mergeUniqueById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((item) => item.id));
  const next = [...existing];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

type PagerDot = {
  key: string;
  page: number;
  emphasis: "active" | "near" | "far" | "edge" | "placeholder";
};

function buildPagerDots(totalPages: number, currentPage: number, maxVisible = 5): PagerDot[] {
  if (totalPages <= 0) return [];
  if (maxVisible <= 0) return [];

  const visibleCount = Math.min(totalPages, maxVisible);
  const half = Math.floor(visibleCount / 2);
  const maxStart = Math.max(totalPages - visibleCount, 0);
  const start = Math.max(0, Math.min(currentPage - half, maxStart));
  const end = start + visibleCount - 1;

  const dots: PagerDot[] = [];
  for (let page = start; page <= end; page += 1) {
    const distance = Math.abs(page - currentPage);
    const isWindowEdge = (page === start && start > 0) || (page === end && end < totalPages - 1);

    let emphasis: PagerDot["emphasis"] = "far";
    if (page === currentPage) emphasis = "active";
    else if (isWindowEdge) emphasis = "edge";
    else if (distance === 1) emphasis = "near";

    dots.push({ key: `page-${page}`, page, emphasis });
  }

  if (dots.length < maxVisible) {
    const placeholdersNeeded = maxVisible - dots.length;
    for (let index = 0; index < placeholdersNeeded; index += 1) {
      dots.push({
        key: `placeholder-${index}`,
        page: Math.max(totalPages - 1, 0),
        emphasis: "placeholder",
      });
    }
  }

  return dots;
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
      extractIconValue(entry.icon) ??
      pickString(entry, ["emoji", "icon_emoji", "iconEmoji", "icon_value", "iconValue", "icon_url", "iconUrl"]) ??
      undefined;
    if (!icon) continue;

    if (id) map[`id:${id}`] = icon;
    if (name) map[`name:${name.trim().toLowerCase()}`] = icon;
    if (shortName) map[`name:${shortName.trim().toLowerCase()}`] = icon;
  }

  return map;
}

function resolveSpecializationIcon(item: Record<string, unknown>, icons: Record<string, string>): string | undefined {
  const directIcon =
    extractIconValue(item.icon) ??
    pickString(item, [
      "emoji",
      "icon_emoji",
      "iconEmoji",
      "icon_value",
      "iconValue",
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
  const fallbackTitle = normalizedOptional(content.slice(0, 90));
  const title = normalizedOptional(pickString(post, ["title", "headline", "name"])) ?? fallbackTitle ?? "Trending post";
  const communityLabel = resolveCommunityLabel({
    name: pickString(post, ["community_name", "communityName"]),
    shortName: pickString(post, ["community_short_name", "communityShortName"]),
    fallback: undefined,
    preferShortNames: true,
  });
  const imageUrl = normalizedOptional(
    pickString(post, ["thumbnail_url", "thumbnailUrl", "cdn_url", "cdnUrl", "media_url", "mediaUrl", "image_url", "imageUrl"])
  );
  const mediaAssetIds = extractMediaAssetIds(post);

  return {
    id,
    title,
    content,
    authorName,
    postedInLabel: communityLabel ? `Posted in ${communityLabel}` : undefined,
    authorProfileImageUrl: pickString(post, ["author_profile_image_url", "authorProfileImageUrl"]) ?? undefined,
    imageUrl,
    mediaAssetIds,
  };
}

function normalizeCommunityKind(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined;
  return normalizedOptional(pickString(item, ["kind", "community_kind", "communityKind", "type"]));
}

function normalizeCommunityCard(item: unknown, preferCommunityShortNames: boolean): CommunityCard | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "community_id", "communityId", "loop_id", "loopId"]);
  const label = resolveCommunityLabel({
    name: pickString(item, ["name", "display_name", "displayName", "title"]),
    shortName: pickString(item, ["short_name", "shortName"]),
    fallback: pickString(item, ["handle", "username"]) ?? "Community",
    preferShortNames: preferCommunityShortNames,
  });
  if (!id || !label) return null;

  const membersLabel = formatMembersLabel(
    item.member_count ??
      item.memberCount ??
      item.members_count ??
      item.membersCount ??
      item.follower_count ??
      item.followers_count
  );

  const icon =
    extractIconValue(item.icon) ??
    pickString(item, ["emoji", "icon_emoji", "iconEmoji", "icon_value", "iconValue", "icon_url", "iconUrl"]);
  const imageUrl = pickString(item, ["image_url", "imageUrl"]);
  const description = normalizedOptional(pickString(item, ["description", "bio", "summary"]));
  const shortName = normalizedOptional(pickString(item, ["short_name", "shortName"]));
  const fullName = normalizedOptional(pickString(item, ["name", "display_name", "displayName", "title"]));
  const subtitle =
    preferCommunityShortNames && fullName && fullName !== label
      ? fullName
      : !preferCommunityShortNames && shortName && shortName !== label
        ? shortName
        : undefined;

  return {
    id,
    label,
    subtitle,
    description,
    membersLabel,
    icon: icon ?? undefined,
    imageUrl: imageUrl ?? undefined,
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

function normalizePostResult(
  item: unknown,
  options: {
    preferCommunityShortNames: boolean;
    hideAnonymousPosts: boolean;
  }
): PostResult | null {
  if (!isRecord(item)) return null;
  const post = isRecord(item.post) ? item.post : item;

  const id = pickString(post, ["id", "post_id", "postId"]);
  if (!id) return null;

  const content = pickString(post, ["content", "text", "body", "message"]) ?? "";
  const isAnonymous =
    pickBoolean(post, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ?? false;
  if (options.hideAnonymousPosts && isAnonymous) return null;
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

  const communityLabel = resolveCommunityLabel({
    name: pickString(post, ["community_name", "communityName"]),
    shortName: pickString(post, ["community_short_name", "communityShortName"]),
    fallback: undefined,
    preferShortNames: options.preferCommunityShortNames,
  });

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

function normalizePostResults(
  payload: unknown,
  options: {
    preferCommunityShortNames: boolean;
    hideAnonymousPosts: boolean;
  }
): PostResult[] {
  return extractItemsArray(payload)
    .map((item) => normalizePostResult(item, options))
    .filter((item): item is PostResult => Boolean(item));
}

function capitalize(value: string): string {
  if (!value) return "";
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
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

function displayCommunityPreferredName(value: unknown, preferCommunityShortNames: boolean): string | undefined {
  if (!isRecord(value)) return undefined;
  return preferredName({
    name: pickString(value, ["name"]),
    shortName: pickString(value, ["short_name", "shortName"]),
    preferShortNames: preferCommunityShortNames,
  });
}

function normalizeFeedPost(
  item: unknown,
  options: {
    preferCommunityShortNames: boolean;
    hideAnonymousPosts: boolean;
  }
): PostData | null {
  if (!isRecord(item)) return null;
  const post = isRecord(item.post) ? item.post : item;

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
  const time =
    pickString(post, ["time_ago", "timeAgo", "created_at_human", "createdAtHuman"]) ??
    formatTimeAgo(post.created_at ?? post.createdAt ?? post.timestamp ?? post.time);

  const statsRecord =
    (isRecord(post.stats) ? post.stats : null) ??
    (isRecord(post.counts) ? post.counts : null) ??
    (isRecord(post.engagement) ? post.engagement : null) ??
    null;

  const likes =
    pickNumber(post, ["like_count", "likes_count", "likes", "likeCount", "likesCount"]) ??
    (statsRecord ? pickNumber(statsRecord, ["like_count", "likes_count", "likes", "likeCount", "likesCount"]) : undefined) ??
    0;
  const comments =
    pickNumber(post, ["comment_count", "comments_count", "comments", "commentCount", "commentsCount"]) ??
    (statsRecord ? pickNumber(statsRecord, ["comment_count", "comments_count", "comments", "commentCount", "commentsCount"]) : undefined) ??
    0;
  const reposts =
    pickNumber(post, ["repost_count", "reposts_count", "reposts", "repostCount", "repostsCount"]) ??
    (statsRecord ? pickNumber(statsRecord, ["repost_count", "reposts_count", "reposts", "repostCount", "repostsCount"]) : undefined) ??
    0;
  const shares =
    pickNumber(post, ["share_count", "shareCount", "shares_count", "sharesCount"]) ??
    (statsRecord ? pickNumber(statsRecord, ["share_count", "shareCount", "shares_count", "sharesCount"]) : undefined) ??
    0;
  const saves =
    pickNumber(post, ["save_count", "saves_count", "saves", "saveCount", "savesCount"]) ??
    (statsRecord ? pickNumber(statsRecord, ["save_count", "saves_count", "saves", "saveCount", "savesCount"]) : undefined) ??
    0;

  const viewerLiked = pickBoolean(post, ["user_liked", "userLiked"]) ?? false;
  const viewerSaved = pickBoolean(post, ["is_saved", "isSaved"]) ?? false;
  const viewerHasReposted = pickBoolean(post, ["viewer_has_reposted", "viewerHasReposted"]) ?? false;
  const authorProfileImageUrl = pickString(post, ["author_profile_image_url", "authorProfileImageUrl"]);

  return {
    id,
    communityId,
    author: authorName,
    subtitle,
    context,
    content,
    time,
    authorProfileImageUrl: authorProfileImageUrl ?? undefined,
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
    stats: {
      likes,
      comments,
      reposts,
      shares,
      saves,
    },
    isAnonymous,
  };
}

function normalizeFeedPosts(
  payload: unknown,
  options: {
    preferCommunityShortNames: boolean;
    hideAnonymousPosts: boolean;
  }
): PostData[] {
  return extractItemsArray(payload)
    .map((item) => normalizeFeedPost(item, options))
    .filter((item): item is PostData => Boolean(item));
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

function resolveLandingSectionOrder({
  followsCompany,
  followsSchool,
}: {
  followsCompany: boolean;
  followsSchool: boolean;
}): LandingSectionId[] {
  if (followsCompany && !followsSchool) return ["fields", "majors"];
  if (followsSchool && !followsCompany) return ["majors", "fields"];
  return ["majors", "fields"];
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
      className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
        active ? "bg-brand text-white" : "bg-bg-muted text-text-secondary hover:text-strong"
      }`}
    >
      {label}
    </button>
  );
}

function IconBadge({ icon, imageUrl, label }: { icon?: string; imageUrl?: string; label: string }) {
  const image = normalizedOptional(imageUrl);
  const display = icon && icon.trim().length ? icon.trim() : initialsFromName(label).slice(0, 1);
  const isImageUrl = /^https?:\/\//i.test(display);
  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-bg-muted text-xl">
      {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
      {!image && isImageUrl ? <img src={display} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
      {!image && !isImageUrl ? <span>{display}</span> : null}
    </div>
  );
}

export function AppSearchPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hideAnonymousPosts } = useContentPreferences();
  const preferCommunityShortNames = usePreferCommunityShortNames();
  const {
    status: peopleRecommendationsStatus,
    rail: peopleRecommendationsRail,
    error: peopleRecommendationsError,
    isLoadingMore: isLoadingMorePeopleRecommendations,
    loadMoreRecommendations,
    retryRecommendations,
    canFollowRecommendation,
    isConnectingRecommendationUser,
    followRecommendation,
    trackRecommendationProfileOpen,
    hideRecommendation,
    lessLikeThisRecommendation,
    trackRecommendationVisibility,
  } = usePeopleRecommendations();

  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SearchFilterId>("all");

  const [landingStatus, setLandingStatus] = useState<LandingStatus>("loading");
  const [landingError, setLandingError] = useState<string | null>(null);
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [resolvedTrendingMedia, setResolvedTrendingMedia] = useState<Record<string, { url: string; isVideo: boolean }>>({});
  const [canScrollTrendingPrev, setCanScrollTrendingPrev] = useState(false);
  const [canScrollTrendingNext, setCanScrollTrendingNext] = useState(false);
  const [recommendedCommunities, setRecommendedCommunities] = useState<CommunityCard[]>([]);
  const [majorCards, setMajorCards] = useState<SpecializationCard[]>([]);
  const [fieldCards, setFieldCards] = useState<SpecializationCard[]>([]);
  const [specializationIcons, setSpecializationIcons] = useState<Record<string, string>>({});
  const [communitiesNextCursor, setCommunitiesNextCursor] = useState<string | null>(null);
  const [majorsNextCursor, setMajorsNextCursor] = useState<string | null>(null);
  const [fieldsNextCursor, setFieldsNextCursor] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<LandingSectionId[]>(["majors", "fields"]);
  const [isLoadingMoreCommunities, setIsLoadingMoreCommunities] = useState(false);
  const [isLoadingMoreMajors, setIsLoadingMoreMajors] = useState(false);
  const [isLoadingMoreFields, setIsLoadingMoreFields] = useState(false);
  const [trendingPage, setTrendingPage] = useState(0);
  const [majorPage, setMajorPage] = useState(0);
  const [fieldPage, setFieldPage] = useState(0);
  const [canScrollCommunitiesPrev, setCanScrollCommunitiesPrev] = useState(false);
  const [canScrollCommunitiesNext, setCanScrollCommunitiesNext] = useState(false);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultsState>({
    users: [],
    posts: [],
    communities: [],
    hashtags: [],
  });
  const [resultsMode, setResultsMode] = useState<SearchResultsMode>("results");
  const [feedStatus, setFeedStatus] = useState<SearchFeedStatus>("idle");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedPosts, setFeedPosts] = useState<PostData[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [feedQuery, setFeedQuery] = useState("");
  const [feedHashtag, setFeedHashtag] = useState("");

  const requestRef = useRef(0);
  const feedRequestRef = useRef(0);
  const previousQueryRef = useRef(query);
  const communitiesScrollerRef = useRef<HTMLDivElement | null>(null);
  const trendingScrollerRef = useRef<HTMLDivElement | null>(null);
  const lastCommunityCardRef = useRef<HTMLButtonElement | null>(null);
  const majorPagerRef = useRef<HTMLDivElement | null>(null);
  const fieldPagerRef = useRef<HTMLDivElement | null>(null);

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

  const majorPages = useMemo(
    () => chunkByPage(majorCards, SPECIALIZATION_GRID_PAGE_SIZE),
    [majorCards]
  );
  const fieldPages = useMemo(
    () => chunkByPage(fieldCards, SPECIALIZATION_GRID_PAGE_SIZE),
    [fieldCards]
  );

  const loadLanding = useCallback(async () => {
    setLandingStatus("loading");
    setLandingError(null);

    try {
      const [trendingResponse, communitiesResponse, majorsBrowseResponse, fieldsBrowseResponse, majorsIndexResponse, fieldsIndexResponse] =
        await Promise.all([
          fetchTrendingPosts({ limit: TRENDING_LIMIT }),
          fetchRecommendedCommunities({ limit: RECOMMENDED_COMMUNITIES_LIMIT }),
          fetchSpecializationsBrowse({ type: "major", limit: SPECIALIZATIONS_INITIAL_LIMIT }),
          fetchSpecializationsBrowse({ type: "field", limit: SPECIALIZATIONS_INITIAL_LIMIT }),
          fetchMajorsIndex(),
          fetchFieldsIndex(),
        ]);

      const majorIcons = normalizeSpecializationIndexMap(majorsIndexResponse);
      const fieldIcons = normalizeSpecializationIndexMap(fieldsIndexResponse);
      const combinedIcons = { ...majorIcons, ...fieldIcons };

      const nextTrending = extractItemsArray(trendingResponse).map(normalizeTrendingPost).filter((item): item is TrendingPost => Boolean(item));
      const nextCommunities = extractItemsArray(communitiesResponse)
        .map((item) => normalizeCommunityCard(item, preferCommunityShortNames))
        .filter((item): item is CommunityCard => Boolean(item));
      const nextMajors = extractItemsArray(majorsBrowseResponse)
        .map((item) => normalizeSpecializationCard(item, combinedIcons))
        .filter((item): item is SpecializationCard => Boolean(item));
      const nextFields = extractItemsArray(fieldsBrowseResponse)
        .map((item) => normalizeSpecializationCard(item, combinedIcons))
        .filter((item): item is SpecializationCard => Boolean(item));

      let followsCompany = false;
      let followsSchool = false;

      const scanFollowedKinds = (payload: unknown) => {
        for (const entry of extractItemsArray(payload)) {
          const normalizedKind = normalizeCommunityKind(entry)?.toLowerCase();
          if (normalizedKind === "company") followsCompany = true;
          if (normalizedKind === "school") followsSchool = true;
          if (followsCompany && followsSchool) return;
        }
      };

      try {
        let followedResponse = await fetchFollowedCommunities({ limit: 100 });
        scanFollowedKinds(followedResponse);
        let followedCursor = extractNextCursor(followedResponse);
        let pagesLoaded = 0;

        while ((!followsCompany || !followsSchool) && followedCursor && pagesLoaded < 2) {
          followedResponse = await fetchFollowedCommunities({ limit: 100, cursor: followedCursor });
          scanFollowedKinds(followedResponse);
          followedCursor = extractNextCursor(followedResponse);
          pagesLoaded += 1;
        }
      } catch {
        // Keep default ordering when this auxiliary signal is unavailable.
      }

      setSpecializationIcons(combinedIcons);
      setTrendingPosts(nextTrending.slice(0, TRENDING_LIMIT));
      setRecommendedCommunities(nextCommunities);
      setMajorCards(nextMajors);
      setFieldCards(nextFields);
      setCommunitiesNextCursor(extractNextCursor(communitiesResponse));
      setMajorsNextCursor(extractNextCursor(majorsBrowseResponse));
      setFieldsNextCursor(extractNextCursor(fieldsBrowseResponse));
      setSectionOrder(resolveLandingSectionOrder({ followsCompany, followsSchool }));
      setIsLoadingMoreCommunities(false);
      setIsLoadingMoreMajors(false);
      setIsLoadingMoreFields(false);
      setTrendingPage(0);
      setMajorPage(0);
      setFieldPage(0);
      setLandingStatus("ready");
    } catch (error) {
      setLandingError(parseApiErrorMessage(error));
      setLandingStatus("error");
    }
  }, [preferCommunityShortNames]);

  useEffect(() => {
    void loadLanding();
  }, [loadLanding]);

  const loadMoreCommunities = useCallback(async () => {
    if (landingStatus !== "ready" || !communitiesNextCursor || isLoadingMoreCommunities) return;

    setIsLoadingMoreCommunities(true);
    try {
      const response = await fetchRecommendedCommunities({
        limit: RECOMMENDED_COMMUNITIES_LIMIT,
        cursor: communitiesNextCursor,
      });
      const nextItems = extractItemsArray(response)
        .map((item) => normalizeCommunityCard(item, preferCommunityShortNames))
        .filter((item): item is CommunityCard => Boolean(item));
      setRecommendedCommunities((current) => mergeUniqueById(current, nextItems));
      setCommunitiesNextCursor(extractNextCursor(response));
    } catch {
      // Keep current data and allow retry when the card re-enters view.
    } finally {
      setIsLoadingMoreCommunities(false);
    }
  }, [communitiesNextCursor, isLoadingMoreCommunities, landingStatus, preferCommunityShortNames]);

  const loadMoreMajors = useCallback(async () => {
    if (landingStatus !== "ready" || !majorsNextCursor || isLoadingMoreMajors) return;

    setIsLoadingMoreMajors(true);
    try {
      const response = await fetchSpecializationsBrowse({
        type: "major",
        limit: SPECIALIZATIONS_LOAD_MORE_LIMIT,
        cursor: majorsNextCursor,
      });
      const nextItems = extractItemsArray(response)
        .map((item) => normalizeSpecializationCard(item, specializationIcons))
        .filter((item): item is SpecializationCard => Boolean(item));
      setMajorCards((current) => mergeUniqueById(current, nextItems));
      setMajorsNextCursor(extractNextCursor(response));
    } catch {
      // Keep current data and retry later.
    } finally {
      setIsLoadingMoreMajors(false);
    }
  }, [isLoadingMoreMajors, landingStatus, majorsNextCursor, specializationIcons]);

  const loadMoreFields = useCallback(async () => {
    if (landingStatus !== "ready" || !fieldsNextCursor || isLoadingMoreFields) return;

    setIsLoadingMoreFields(true);
    try {
      const response = await fetchSpecializationsBrowse({
        type: "field",
        limit: SPECIALIZATIONS_LOAD_MORE_LIMIT,
        cursor: fieldsNextCursor,
      });
      const nextItems = extractItemsArray(response)
        .map((item) => normalizeSpecializationCard(item, specializationIcons))
        .filter((item): item is SpecializationCard => Boolean(item));
      setFieldCards((current) => mergeUniqueById(current, nextItems));
      setFieldsNextCursor(extractNextCursor(response));
    } catch {
      // Keep current data and retry later.
    } finally {
      setIsLoadingMoreFields(false);
    }
  }, [fieldsNextCursor, isLoadingMoreFields, landingStatus, specializationIcons]);

  useEffect(() => {
    const root = communitiesScrollerRef.current;
    const target = lastCommunityCardRef.current;
    if (!root || !target || !communitiesNextCursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        void loadMoreCommunities();
      },
      {
        root,
        threshold: 0.85,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [communitiesNextCursor, loadMoreCommunities, recommendedCommunities.length]);

  useEffect(() => {
    setTrendingPage((current) => Math.min(current, Math.max(trendingPosts.length - 1, 0)));
  }, [trendingPosts.length]);

  useEffect(() => {
    const activePostIds = new Set(trendingPosts.map((post) => post.id));
    setResolvedTrendingMedia((current) => {
      const next: Record<string, { url: string; isVideo: boolean }> = {};
      let changed = false;
      for (const [postId, value] of Object.entries(current)) {
        if (!activePostIds.has(postId)) {
          changed = true;
          continue;
        }
        next[postId] = value;
      }
      return changed ? next : current;
    });

    const postsNeedingResolution = trendingPosts.filter(
      (post) => post.mediaAssetIds.length > 0 && !resolvedTrendingMedia[post.id]
    );
    if (postsNeedingResolution.length === 0) return;

    let isCancelled = false;

    const resolveMissingMedia = async () => {
      const entries = await Promise.all(
        postsNeedingResolution.map(async (post) => {
          try {
            const resolved = await resolveMediaAssets(post.mediaAssetIds);
            const first = resolved[0];
            if (!first) return null;
            return [
              post.id,
              {
                url: first.thumbnailUrl ?? first.cdnUrl,
                isVideo: Boolean(first.mimeType?.toLowerCase().startsWith("video/") && !first.thumbnailUrl),
              },
            ] as const;
          } catch {
            return null;
          }
        })
      );

      if (isCancelled) return;
      const nextEntries = entries.filter(
        (entry): entry is readonly [string, { url: string; isVideo: boolean }] => Boolean(entry)
      );
      if (nextEntries.length === 0) return;
      setResolvedTrendingMedia((current) => {
        const next = { ...current };
        for (const [postId, value] of nextEntries) {
          next[postId] = value;
        }
        return next;
      });
    };

    void resolveMissingMedia();

    return () => {
      isCancelled = true;
    };
  }, [resolvedTrendingMedia, trendingPosts]);

  useEffect(() => {
    setMajorPage((current) => Math.min(current, Math.max(majorPages.length - 1, 0)));
  }, [majorPages.length]);

  useEffect(() => {
    setFieldPage((current) => Math.min(current, Math.max(fieldPages.length - 1, 0)));
  }, [fieldPages.length]);

  const handleTrendingScroll = useCallback(
    (event: SyntheticEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const pageWidth = container.clientWidth || 1;
      const nextPage = Math.max(0, Math.min(Math.round(container.scrollLeft / pageWidth), trendingPosts.length - 1));
      setTrendingPage(nextPage);
      const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
      setCanScrollTrendingPrev(container.scrollLeft > 4);
      setCanScrollTrendingNext(container.scrollLeft < maxScrollLeft - 4);
    },
    [trendingPosts.length]
  );

  const updateTrendingScrollControls = useCallback((container?: HTMLDivElement | null) => {
    const scroller = container ?? trendingScrollerRef.current;
    if (!scroller) {
      setCanScrollTrendingPrev(false);
      setCanScrollTrendingNext(false);
      return;
    }
    const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
    setCanScrollTrendingPrev(scroller.scrollLeft > 4);
    setCanScrollTrendingNext(scroller.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    updateTrendingScrollControls();
    const handleResize = () => updateTrendingScrollControls();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [trendingPosts.length, updateTrendingScrollControls]);

  const handleTrendingPrev = useCallback(() => {
    const scroller = trendingScrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: -(scroller.clientWidth || 320),
      behavior: "smooth",
    });
  }, []);

  const handleTrendingNext = useCallback(() => {
    const scroller = trendingScrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: scroller.clientWidth || 320,
      behavior: "smooth",
    });
  }, []);

  const handleMajorsPagerScroll = useCallback(
    (event: SyntheticEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const pageWidth = container.clientWidth || 1;
      const nextPage = Math.max(0, Math.min(Math.round(container.scrollLeft / pageWidth), majorPages.length - 1));
      setMajorPage(nextPage);
      if (nextPage >= majorPages.length - 1) {
        void loadMoreMajors();
      }
    },
    [loadMoreMajors, majorPages.length]
  );

  const handleFieldsPagerScroll = useCallback(
    (event: SyntheticEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const pageWidth = container.clientWidth || 1;
      const nextPage = Math.max(0, Math.min(Math.round(container.scrollLeft / pageWidth), fieldPages.length - 1));
      setFieldPage(nextPage);
      if (nextPage >= fieldPages.length - 1) {
        void loadMoreFields();
      }
    },
    [fieldPages.length, loadMoreFields]
  );

  const updateCommunityScrollControls = useCallback(
    (container?: HTMLDivElement | null) => {
      const scroller = container ?? communitiesScrollerRef.current;
      if (!scroller) {
        setCanScrollCommunitiesPrev(false);
        setCanScrollCommunitiesNext(false);
        return;
      }

      const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
      const remaining = maxScrollLeft - scroller.scrollLeft;
      const canPrev = scroller.scrollLeft > 4;
      const canNextFromScroll = remaining > 4;
      const canNextFromCursor = Boolean(communitiesNextCursor) && !isLoadingMoreCommunities;

      setCanScrollCommunitiesPrev(canPrev);
      setCanScrollCommunitiesNext(canNextFromScroll || canNextFromCursor);
    },
    [communitiesNextCursor, isLoadingMoreCommunities]
  );

  const handleCommunitiesScroll = useCallback(
    (event: SyntheticEvent<HTMLDivElement>) => {
      updateCommunityScrollControls(event.currentTarget);
    },
    [updateCommunityScrollControls]
  );

  const scrollPagerToPage = useCallback((container: HTMLDivElement | null, page: number) => {
    if (!container) return;
    const clamped = Math.max(page, 0);
    container.scrollTo({
      left: clamped * container.clientWidth,
      behavior: "smooth",
    });
  }, []);

  const handleMajorsPrev = useCallback(() => {
    if (majorPage <= 0) return;
    scrollPagerToPage(majorPagerRef.current, majorPage - 1);
  }, [majorPage, scrollPagerToPage]);

  const handleMajorsNext = useCallback(() => {
    const lastPage = Math.max(majorPages.length - 1, 0);
    if (majorPage < lastPage) {
      scrollPagerToPage(majorPagerRef.current, majorPage + 1);
      return;
    }
    if (majorsNextCursor) {
      void loadMoreMajors();
    }
  }, [loadMoreMajors, majorPage, majorPages.length, majorsNextCursor, scrollPagerToPage]);

  const handleFieldsPrev = useCallback(() => {
    if (fieldPage <= 0) return;
    scrollPagerToPage(fieldPagerRef.current, fieldPage - 1);
  }, [fieldPage, scrollPagerToPage]);

  const handleFieldsNext = useCallback(() => {
    const lastPage = Math.max(fieldPages.length - 1, 0);
    if (fieldPage < lastPage) {
      scrollPagerToPage(fieldPagerRef.current, fieldPage + 1);
      return;
    }
    if (fieldsNextCursor) {
      void loadMoreFields();
    }
  }, [fieldPage, fieldPages.length, fieldsNextCursor, loadMoreFields, scrollPagerToPage]);

  const handleCommunitiesPrev = useCallback(() => {
    const scroller = communitiesScrollerRef.current;
    if (!scroller || !canScrollCommunitiesPrev) return;
    const distance = Math.max(scroller.clientWidth * 0.8, 200);
    scroller.scrollBy({ left: -distance, behavior: "smooth" });
  }, [canScrollCommunitiesPrev]);

  const handleCommunitiesNext = useCallback(() => {
    const scroller = communitiesScrollerRef.current;
    if (!scroller) return;

    const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
    const remaining = maxScrollLeft - scroller.scrollLeft;

    if (remaining > 4) {
      const distance = Math.max(scroller.clientWidth * 0.8, 200);
      scroller.scrollBy({ left: distance, behavior: "smooth" });
      return;
    }

    if (communitiesNextCursor && !isLoadingMoreCommunities) {
      void loadMoreCommunities();
    }
  }, [communitiesNextCursor, isLoadingMoreCommunities, loadMoreCommunities]);

  useEffect(() => {
    if (landingStatus !== "ready") {
      setCanScrollCommunitiesPrev(false);
      setCanScrollCommunitiesNext(false);
      return;
    }

    updateCommunityScrollControls();

    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      updateCommunityScrollControls();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    communitiesNextCursor,
    isLoadingMoreCommunities,
    landingStatus,
    recommendedCommunities.length,
    updateCommunityScrollControls,
  ]);

  useEffect(() => {
    if (!isResultsOpen || resultsMode !== "results") return;
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
      previousQueryRef.current = query;
      return;
    }

    const queryChanged = previousQueryRef.current !== query;
    previousQueryRef.current = query;

    requestRef.current += 1;
    const requestId = requestRef.current;
    setSearchStatus("loading");
    setSearchError(null);

    const timer = window.setTimeout(
      async () => {
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
                    .map((item) => normalizeCommunityCard(item, preferCommunityShortNames))
                    .filter((item): item is CommunityCard => Boolean(item))
                    .map((item) => ({
                      id: item.id,
                      label: item.label,
                      subtitle: item.subtitle,
                      description: item.description,
                      membersLabel: item.membersLabel,
                      icon: item.icon,
                      imageUrl: item.imageUrl,
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
                ? normalizePostResults(postsResult.value, {
                    preferCommunityShortNames,
                    hideAnonymousPosts,
                  })
                : [];

            const everythingEmpty = users.length === 0 && communities.length === 0 && hashtags.length === 0 && posts.length === 0;
            const coreFailed =
              usersResult.status === "rejected" &&
              communitiesResult.status === "rejected" &&
              hashtagsResult.status === "rejected";

            if (everythingEmpty && coreFailed) {
              const firstCoreFailure = [usersResult, communitiesResult, hashtagsResult].find(
                (result): result is PromiseRejectedResult => result.status === "rejected"
              );
              updateIfCurrent({ users, communities, hashtags, posts }, "error", parseApiErrorMessage(firstCoreFailure?.reason));
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
            nextPosts = normalizePostResults(response, {
              preferCommunityShortNames,
              hideAnonymousPosts,
            });
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
              .map((item) => normalizeCommunityCard(item, preferCommunityShortNames))
              .filter((item): item is CommunityCard => Boolean(item))
              .map((item) => ({
                id: item.id,
                label: item.label,
                subtitle: item.subtitle,
                description: item.description,
                membersLabel: item.membersLabel,
                icon: item.icon,
                imageUrl: item.imageUrl,
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
      },
      queryChanged ? SEARCH_DEBOUNCE_MS : 0
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeFilter, hideAnonymousPosts, isResultsOpen, preferCommunityShortNames, query, resultsMode]);

  const hasAnyResults = useMemo(() => {
    return (
      searchResults.users.length > 0 ||
      searchResults.communities.length > 0 ||
      searchResults.hashtags.length > 0 ||
      searchResults.posts.length > 0
    );
  }, [searchResults]);

  const landingSpecializationSections = useMemo(
    () =>
      sectionOrder.map((sectionId) => {
        if (sectionId === "majors") {
          return {
            id: sectionId,
            title: "Majors",
            pages: majorPages,
            currentPage: majorPage,
            isLoadingMore: isLoadingMoreMajors,
            hasMore: Boolean(majorsNextCursor),
            onScroll: handleMajorsPagerScroll,
            pagerRef: majorPagerRef,
            onPrev: handleMajorsPrev,
            onNext: handleMajorsNext,
            canPrev: majorPage > 0,
            canNext: majorPage < majorPages.length - 1 || (Boolean(majorsNextCursor) && !isLoadingMoreMajors),
            dots: buildPagerDots(majorPages.length, majorPage, 5),
          };
        }
        return {
          id: sectionId,
          title: "Fields",
          pages: fieldPages,
          currentPage: fieldPage,
          isLoadingMore: isLoadingMoreFields,
          hasMore: Boolean(fieldsNextCursor),
          onScroll: handleFieldsPagerScroll,
          pagerRef: fieldPagerRef,
          onPrev: handleFieldsPrev,
          onNext: handleFieldsNext,
          canPrev: fieldPage > 0,
          canNext: fieldPage < fieldPages.length - 1 || (Boolean(fieldsNextCursor) && !isLoadingMoreFields),
          dots: buildPagerDots(fieldPages.length, fieldPage, 5),
        };
      }),
    [
      fieldPage,
      fieldPages,
      fieldsNextCursor,
      handleFieldsNext,
      handleFieldsPagerScroll,
      handleFieldsPrev,
      handleMajorsNext,
      handleMajorsPagerScroll,
      handleMajorsPrev,
      isLoadingMoreFields,
      isLoadingMoreMajors,
      majorPage,
      majorPages,
      majorsNextCursor,
      sectionOrder,
    ]
  );

  const clearFeedState = useCallback(() => {
    feedRequestRef.current += 1;
    setResultsMode("results");
    setFeedStatus("idle");
    setFeedError(null);
    setFeedPosts([]);
    setFeedNextCursor(null);
    setFeedQuery("");
    setFeedHashtag("");
  }, []);

  const openPostSearchFeed = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const requestId = feedRequestRef.current + 1;
    feedRequestRef.current = requestId;

    setResultsMode("post-search-feed");
    setFeedQuery(trimmed);
    setFeedHashtag("");
    setFeedStatus("loading");
    setFeedError(null);
    setFeedPosts([]);
    setFeedNextCursor(null);

    try {
      const response = await searchPosts({ query: trimmed, limit: 20 });
      if (feedRequestRef.current !== requestId) return;
      setFeedPosts(
        normalizeFeedPosts(response, {
          preferCommunityShortNames,
          hideAnonymousPosts,
        })
      );
      setFeedNextCursor(extractNextCursor(response));
      setFeedStatus("ready");
    } catch (error) {
      if (feedRequestRef.current !== requestId) return;
      setFeedPosts([]);
      setFeedNextCursor(null);
      setFeedStatus("error");
      setFeedError(parseApiErrorMessage(error));
    }
  }, [hideAnonymousPosts, preferCommunityShortNames]);

  const openHashtagFeed = useCallback(async (value: string) => {
    const normalized = value.trim().replace(/^#/, "").trim();
    if (!normalized) return;

    const requestId = feedRequestRef.current + 1;
    feedRequestRef.current = requestId;

    setResultsMode("hashtag-feed");
    setFeedQuery("");
    setFeedHashtag(normalized);
    setFeedStatus("loading");
    setFeedError(null);
    setFeedPosts([]);
    setFeedNextCursor(null);

    try {
      const response = await fetchHashtagPosts({ name: normalized, limit: 20 });
      if (feedRequestRef.current !== requestId) return;
      setFeedPosts(
        normalizeFeedPosts(response, {
          preferCommunityShortNames,
          hideAnonymousPosts,
        })
      );
      setFeedNextCursor(extractNextCursor(response));
      setFeedStatus("ready");
    } catch (error) {
      if (feedRequestRef.current !== requestId) return;
      setFeedPosts([]);
      setFeedNextCursor(null);
      setFeedStatus("error");
      setFeedError(parseApiErrorMessage(error));
    }
  }, [hideAnonymousPosts, preferCommunityShortNames]);

  useEffect(() => {
    if (!isResultsOpen) return;
    if (resultsMode === "post-search-feed" && feedQuery.trim()) {
      void openPostSearchFeed(feedQuery.trim());
      return;
    }
    if (resultsMode === "hashtag-feed" && feedHashtag.trim()) {
      void openHashtagFeed(feedHashtag.trim());
    }
  }, [
    feedHashtag,
    feedQuery,
    hideAnonymousPosts,
    isResultsOpen,
    openHashtagFeed,
    openPostSearchFeed,
    preferCommunityShortNames,
    resultsMode,
  ]);

  const handleLoadMoreFeedPosts = useCallback(async () => {
    if (!feedNextCursor || (resultsMode !== "post-search-feed" && resultsMode !== "hashtag-feed")) return;
    if (feedStatus === "loading" || feedStatus === "loading-more") return;
    if (resultsMode === "post-search-feed" && !feedQuery.trim()) return;
    if (resultsMode === "hashtag-feed" && !feedHashtag.trim()) return;

    const requestId = feedRequestRef.current + 1;
    feedRequestRef.current = requestId;

    setFeedStatus("loading-more");
    setFeedError(null);

    try {
      const response =
        resultsMode === "post-search-feed"
          ? await searchPosts({ query: feedQuery.trim(), limit: 20, cursor: feedNextCursor })
          : await fetchHashtagPosts({ name: feedHashtag.trim(), limit: 20, cursor: feedNextCursor });

      if (feedRequestRef.current !== requestId) return;

      setFeedPosts((current) =>
        mergeUniqueById(
          current,
          normalizeFeedPosts(response, {
            preferCommunityShortNames,
            hideAnonymousPosts,
          })
        )
      );
      setFeedNextCursor(extractNextCursor(response));
      setFeedStatus("ready");
    } catch (error) {
      if (feedRequestRef.current !== requestId) return;
      setFeedStatus("ready");
      setFeedError(parseApiErrorMessage(error));
    }
  }, [feedHashtag, feedNextCursor, feedQuery, feedStatus, hideAnonymousPosts, preferCommunityShortNames, resultsMode]);

  const feedTitle = useMemo(() => {
    if (resultsMode === "post-search-feed") return `Posts for "${feedQuery}"`;
    if (resultsMode === "hashtag-feed") return `#${feedHashtag}`;
    return "Search";
  }, [feedHashtag, feedQuery, resultsMode]);

  const handleOpenResults = useCallback(() => {
    setIsResultsOpen(true);
    setResultsMode("results");
  }, []);

  const handleCloseResults = useCallback(() => {
    requestRef.current += 1;
    setIsResultsOpen(false);
    setSearchStatus("idle");
    setSearchError(null);
    clearFeedState();
  }, [clearFeedState]);

  const handleSubmitQuery = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    if (trimmed.startsWith("#")) {
      void openHashtagFeed(trimmed);
      return;
    }
    if (activeFilter === "all" || activeFilter === "posts") {
      void openPostSearchFeed(trimmed);
    }
  }, [activeFilter, openHashtagFeed, openPostSearchFeed, query, saveRecentSearch]);

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

  const handlePeopleRecommendationProfileTap = useCallback(
    (item: PeopleRecommendationItem) => {
      trackRecommendationProfileOpen(item);
      navigate(`/app/profile/${item.user.id}`);
    },
    [navigate, trackRecommendationProfileOpen]
  );

  const handlePeopleRecommendationFollowTap = useCallback(
    (item: PeopleRecommendationItem) => {
      void followRecommendation(item);
    },
    [followRecommendation]
  );

  const setCommunityLastCardRef = useCallback((node: HTMLButtonElement | null) => {
    lastCommunityCardRef.current = node;
  }, []);

  const handlePostTap = useCallback(
    async (post: TrendingPost | PostResult) => {
      try {
        await fetchPostDetail(post.id);
        navigate(`/app/post/${post.id}/comments`);
      } catch {
        showToast({
          kind: "error",
          title: "Couldn’t open post",
          message: "Couldn’t open post",
        });
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

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionHeader title="Trending Posts" />
                {landingStatus === "ready" && trendingPosts.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTrendingPrev}
                      disabled={!canScrollTrendingPrev}
                      className={`inline-flex h-11 w-11 items-center justify-center transition ${
                        canScrollTrendingPrev ? "text-strong hover:text-brand" : "text-text-light/70"
                      }`}
                      aria-label="Previous trending post"
                    >
                      <ChevronLeftIcon className="h-7 w-7" />
                    </button>
                    <button
                      type="button"
                      onClick={handleTrendingNext}
                      disabled={!canScrollTrendingNext}
                      className={`inline-flex h-11 w-11 items-center justify-center transition ${
                        canScrollTrendingNext ? "text-strong hover:text-brand" : "text-text-light/70"
                      }`}
                      aria-label="Next trending post"
                    >
                      <ChevronRightIcon className="h-7 w-7" />
                    </button>
                  </div>
                ) : null}
              </div>

              {landingStatus === "loading" ? (
                <div className="looped-fade-swap space-y-3">
                  {Array.from({ length: 2 }, (_, index) => (
                    <div key={`trending-skeleton-${index}`} className="overflow-hidden rounded-3xl border border-border/60 bg-bg">
                      <div className="looped-skeleton looped-skeleton-shimmer h-40 w-full" />
                      <div className="space-y-2 px-4 py-4">
                        <div className="looped-skeleton looped-skeleton-shimmer h-4 w-2/3 rounded-full" />
                        <div className="looped-skeleton looped-skeleton-shimmer h-3 w-1/2 rounded-full" />
                        <div className="looped-skeleton looped-skeleton-shimmer h-3 w-full rounded-full" />
                      </div>
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
                  <div className="space-y-3">
                    <div
                      ref={trendingScrollerRef}
                      onScroll={handleTrendingScroll}
                      className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {trendingPosts.map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => void handlePostTap(post)}
                          className="w-full shrink-0 snap-start overflow-hidden rounded-3xl border border-border/60 bg-bg text-left transition hover:bg-bg-muted/20"
                        >
                          {resolvedTrendingMedia[post.id]?.url || post.imageUrl ? (
                            resolvedTrendingMedia[post.id]?.isVideo ? (
                              <video
                                src={resolvedTrendingMedia[post.id]?.url}
                                className="h-44 w-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={resolvedTrendingMedia[post.id]?.url ?? post.imageUrl}
                                alt=""
                                className="h-44 w-full object-cover"
                                loading="lazy"
                              />
                            )
                          ) : (
                            <div className="flex h-44 w-full items-end bg-gradient-to-br from-brand/20 via-bg-muted to-bg px-4 pb-4">
                              <p className="line-clamp-2 text-lg font-semibold text-strong">{post.title}</p>
                            </div>
                          )}
                          <div className="space-y-2 px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={post.authorProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-full border border-border/50 object-cover"
                                loading="lazy"
                                onError={handleProfileImageError}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-strong">{post.authorName}</p>
                                {post.postedInLabel ? <p className="truncate text-sm text-text-secondary">{post.postedInLabel}</p> : null}
                              </div>
                            </div>
                            <p className="line-clamp-2 text-lg leading-snug font-medium text-text-primary">
                              {post.content || post.title}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {trendingPosts.length > 1 ? (
                      <div className="flex items-center justify-center gap-1.5">
                        {trendingPosts.map((post, index) => (
                          <span
                            key={`trending-dot-${post.id}`}
                            className={`h-1.5 rounded-full transition-all ${
                              index === trendingPage ? "w-5 bg-brand" : "w-1.5 bg-border"
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No trending posts yet.</p>
                )
              ) : null}
            </section>

            {peopleRecommendationsStatus === "loading" && !peopleRecommendationsRail ? (
              <section className="space-y-3">
                <SectionHeader title="Recommended for you" />
                <div className="looped-fade-swap flex gap-3 overflow-hidden">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={`people-skeleton-${index}`}
                      className="w-[160px] shrink-0 rounded-[18px] border border-border/70 bg-bg px-3 py-3"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="looped-skeleton looped-skeleton-shimmer h-14 w-14 rounded-full" aria-hidden="true" />
                        <div className="w-full space-y-2">
                          <div className="looped-skeleton looped-skeleton-shimmer mx-auto h-3.5 w-4/5 rounded-full" aria-hidden="true" />
                          <div className="looped-skeleton looped-skeleton-shimmer mx-auto h-3 w-3/5 rounded-full" aria-hidden="true" />
                        </div>
                        <div className="looped-skeleton looped-skeleton-shimmer h-8 w-full rounded-full" aria-hidden="true" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {peopleRecommendationsRail && peopleRecommendationsRail.items.length > 0 ? (
              <PeopleRecommendationRail
                rail={peopleRecommendationsRail}
                isLoadingMore={isLoadingMorePeopleRecommendations}
                canFollow={canFollowRecommendation}
                isConnecting={isConnectingRecommendationUser}
                onProfileTap={handlePeopleRecommendationProfileTap}
                onFollowTap={handlePeopleRecommendationFollowTap}
                onHideTap={hideRecommendation}
                onLessLikeThisTap={lessLikeThisRecommendation}
                onCardVisibilityChange={trackRecommendationVisibility}
                onReachEnd={() => void loadMoreRecommendations()}
              />
            ) : null}

            {peopleRecommendationsStatus === "empty" ? (
              <section className="space-y-3">
                <SectionHeader title="Recommended for you" />
                <div className="rounded-2xl border border-border/70 bg-bg px-4 py-3">
                  <p className="text-sm text-text-secondary">No recommendations available right now.</p>
                </div>
              </section>
            ) : null}

            {peopleRecommendationsStatus === "error" &&
            (!peopleRecommendationsRail || peopleRecommendationsRail.items.length === 0) ? (
              <section className="space-y-3">
                <SectionHeader title="Recommended for you" />
                <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
                  <p className="text-sm font-semibold text-strong">Recommendations are unavailable right now.</p>
                  {peopleRecommendationsError ? (
                    <p className="text-sm text-text-secondary">{peopleRecommendationsError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void retryRecommendations()}
                    className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              </section>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionHeader title="Communities" subtitle="Recommended communities for you" />
                {landingStatus === "ready" && recommendedCommunities.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCommunitiesPrev}
                      disabled={!canScrollCommunitiesPrev}
                      className={`inline-flex h-11 w-11 items-center justify-center transition ${
                        canScrollCommunitiesPrev
                          ? "text-strong hover:text-brand"
                          : "text-text-light/70"
                      }`}
                      aria-label="Previous communities"
                    >
                      <ChevronLeftIcon className="h-7 w-7" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCommunitiesNext}
                      disabled={!canScrollCommunitiesNext}
                      className={`inline-flex h-11 w-11 items-center justify-center transition ${
                        canScrollCommunitiesNext
                          ? "text-strong hover:text-brand"
                          : "text-text-light/70"
                      }`}
                      aria-label="Next communities"
                    >
                      <ChevronRightIcon className="h-7 w-7" />
                    </button>
                  </div>
                ) : null}
              </div>
              {landingStatus === "ready" && recommendedCommunities.length > 0 ? (
                <div
                  ref={communitiesScrollerRef}
                  onScroll={handleCommunitiesScroll}
                  className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {recommendedCommunities.map((community, index) => (
                    <button
                      key={community.id}
                      type="button"
                      ref={index === recommendedCommunities.length - 1 ? setCommunityLastCardRef : undefined}
                      onClick={() => handleCommunityTap(community)}
                      className="w-[216px] shrink-0 snap-start rounded-2xl border border-border/60 bg-bg px-3 py-3 text-left transition hover:bg-bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <IconBadge icon={community.icon} imageUrl={community.imageUrl} label={community.label} />
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold text-strong">{community.label}</p>
                          <p className="line-clamp-1 text-xs text-text-secondary">{community.subtitle ?? community.kind ?? ""}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-medium text-text-light">{community.membersLabel ?? "0 members"}</p>
                    </button>
                  ))}
                  {isLoadingMoreCommunities ? (
                    <div className="w-[216px] shrink-0 rounded-2xl border border-border/60 bg-bg px-3 py-3">
                      <div className="looped-skeleton looped-skeleton-shimmer h-4 w-1/2 rounded-full" />
                      <div className="looped-skeleton looped-skeleton-shimmer mt-3 h-3 w-full rounded-full" />
                      <div className="looped-skeleton looped-skeleton-shimmer mt-2 h-3 w-2/3 rounded-full" />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {landingStatus === "ready" && recommendedCommunities.length === 0 ? (
                <p className="text-sm text-text-secondary">No recommended communities yet.</p>
              ) : null}
            </section>

            {landingSpecializationSections.map((section) => (
              <section key={section.id} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <SectionHeader title={section.title} />
                  {section.pages.length > 1 || section.hasMore ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={section.onPrev}
                        disabled={!section.canPrev}
                        className={`inline-flex h-11 w-11 items-center justify-center transition ${
                          section.canPrev
                            ? "text-strong hover:text-brand"
                            : "text-text-light/70"
                        }`}
                        aria-label={`Previous ${section.title.toLowerCase()} page`}
                      >
                        <ChevronLeftIcon className="h-7 w-7" />
                      </button>
                      <button
                        type="button"
                        onClick={section.onNext}
                        disabled={!section.canNext}
                        className={`inline-flex h-11 w-11 items-center justify-center transition ${
                          section.canNext
                            ? "text-strong hover:text-brand"
                            : "text-text-light/70"
                        }`}
                        aria-label={`Next ${section.title.toLowerCase()} page`}
                      >
                        <ChevronRightIcon className="h-7 w-7" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {section.pages.length ? (
                  <>
                    <div
                      ref={section.pagerRef}
                      onScroll={section.onScroll}
                      className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {section.pages.map((page, pageIndex) => (
                        <div key={`${section.id}-page-${pageIndex}`} className="w-full shrink-0 snap-start">
                          <div className="grid grid-cols-4 gap-x-3 gap-y-4">
                            {page.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => handleCommunityTap({ id: card.id, label: card.label })}
                                className="text-center"
                              >
                                <div className="mx-auto flex w-fit justify-center">
                                  <IconBadge icon={card.icon} label={card.label} />
                                </div>
                                <p className="mt-2 line-clamp-1 text-sm font-semibold text-strong">{card.label}</p>
                                <p className="text-xs text-text-light">{card.membersLabel ?? "0 members"}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {section.pages.length > 1 ? (
                      <div className="flex items-center justify-center gap-1.5">
                        {section.dots.map((dot) => (
                          <span
                            key={`${section.id}-dot-${dot.key}`}
                            className={`h-1.5 rounded-full transition-all ${
                              dot.emphasis === "active"
                                ? "w-5 bg-brand"
                                : dot.emphasis === "near"
                                  ? "h-2 w-2 bg-border"
                                  : dot.emphasis === "edge"
                                    ? "h-1 w-1 bg-border/70"
                                    : dot.emphasis === "placeholder"
                                      ? "w-1.5 bg-border/45"
                                      : "w-1.5 bg-border/80"
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    ) : null}
                    {section.isLoadingMore ? <p className="text-center text-xs text-text-light">Loading more...</p> : null}
                  </>
                ) : (
                  <p className="text-sm text-text-secondary">No {section.title.toLowerCase()} yet.</p>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[560px]">
            <div className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-bg px-4 pb-3 pt-1 sm:-mx-5 sm:px-5">
              {resultsMode === "results" ? (
                <>
                  <div className="flex items-center gap-2">
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
                    <button
                      type="button"
                      onClick={handleCloseResults}
                      className="px-1 text-sm font-semibold text-text-secondary transition hover:text-strong"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {FILTERS.map((filter) => (
                      <SearchFilterPill
                        key={filter.id}
                        label={filter.label}
                        active={activeFilter === filter.id}
                        onClick={() => handleTapFilter(filter.id)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearFeedState}
                    className="inline-flex h-11 w-11 items-center justify-center text-text-secondary transition hover:text-strong"
                    aria-label="Back"
                  >
                    <ChevronLeftIcon className="h-7 w-7" />
                  </button>
                  <h2
                    className={`min-w-0 flex-1 truncate font-semibold ${
                      resultsMode === "hashtag-feed"
                        ? "text-[1.75rem] leading-tight text-brand"
                        : "text-base text-strong"
                    }`}
                  >
                    {feedTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseResults}
                    className="px-1 text-sm font-semibold text-text-secondary transition hover:text-strong"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4">
              {resultsMode !== "results" ? (
                <section className="space-y-3">
                  {feedStatus === "loading" ? (
                    <div className="looped-fade-swap space-y-2">
                      {Array.from({ length: 4 }, (_, index) => (
                        <div key={`feed-skeleton-${index}`} className="rounded-2xl border border-border/60 bg-bg px-4 py-3">
                          <div className="looped-skeleton looped-skeleton-shimmer h-3 w-1/3 rounded-full" />
                          <div className="looped-skeleton looped-skeleton-shimmer mt-2 h-3 w-2/3 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {feedStatus === "error" && feedPosts.length === 0 ? (
                    <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
                      <p className="text-sm font-semibold text-strong">Unable to load posts right now.</p>
                      <p className="text-sm text-text-secondary">{feedError}</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (resultsMode === "post-search-feed") {
                            void openPostSearchFeed(feedQuery);
                            return;
                          }
                          void openHashtagFeed(feedHashtag);
                        }}
                        className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  {feedStatus === "ready" && feedPosts.length === 0 ? <p className="text-sm text-text-secondary">No posts found.</p> : null}

                  {feedPosts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="divide-y divide-border/70 bg-bg">
                        {feedPosts.map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                      {feedError ? <p className="text-sm text-text-secondary">{feedError}</p> : null}
                      {feedNextCursor ? (
                        <button
                          type="button"
                          onClick={() => void handleLoadMoreFeedPosts()}
                          disabled={feedStatus === "loading-more"}
                          className="w-full rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                        >
                          {feedStatus === "loading-more" ? "Loading…" : "Load more"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : (
                <>
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
                        <ul className="divide-y divide-border/70 bg-bg">
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
                    <div className="looped-fade-swap space-y-2">
                      {Array.from({ length: 4 }, (_, index) => (
                        <div key={`search-skeleton-${index}`} className="rounded-2xl border border-border/60 bg-bg px-4 py-3">
                          <div className="looped-skeleton looped-skeleton-shimmer h-3 w-1/3 rounded-full" />
                          <div className="looped-skeleton looped-skeleton-shimmer mt-2 h-3 w-2/3 rounded-full" />
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
                      {searchResults.hashtags.length > 0 ? (
                        <section className="space-y-2">
                          <h3 className="text-sm font-semibold text-strong">Hashtags</h3>
                          <div className="flex flex-wrap gap-2">
                            {searchResults.hashtags.map((hashtag) => (
                              <button
                                key={hashtag.tag}
                                type="button"
                                onClick={() => {
                                  const hashtagQuery = `#${hashtag.tag}`;
                                  saveRecentSearch(hashtagQuery);
                                  setQuery(hashtagQuery);
                                  void openHashtagFeed(hashtag.tag);
                                }}
                                className="rounded-full border border-border/70 bg-bg px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                              >
                                #{hashtag.tag}
                              </button>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {searchResults.users.length > 0 ? (
                        <section className="space-y-2">
                          <h3 className="text-sm font-semibold text-strong">Users</h3>
                          <div className="divide-y divide-border/70 bg-bg">
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
                          <div className="divide-y divide-border/70 bg-bg">
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
                                <IconBadge icon={community.icon} imageUrl={community.imageUrl} label={community.label} />
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

                      {searchResults.posts.length > 0 ? (
                        <section className="space-y-2">
                          <h3 className="text-sm font-semibold text-strong">Posts</h3>
                          <div className="divide-y divide-border/70 bg-bg">
                            {searchResults.posts.map((post) => (
                              <button
                                key={post.id}
                                type="button"
                                onClick={() => {
                                  saveRecentSearch(query.trim());
                                  void handlePostTap(post);
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
