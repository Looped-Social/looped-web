import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { getCommunityPermissions, type CommunityPermissions } from "@/lib/communityPermissionsApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import {
  CommunityDetailApiError,
  fetchCommunityDetail,
  fetchCommunityHashtags,
  fetchCommunityPosts,
  fetchCommunityVerifications,
  fetchSpecializationDetail,
  fetchSpecializationJoinLimits,
  setCommunityFollowing,
  setSpecializationFollowing,
  setSpecializationJoined,
} from "@/lib/communityDetailApi";

type AppCommunityPageProps = {
  communityId: string;
};

type CommunityTabId = "posts" | "hashtags";
type LoadStatus = "idle" | "loading" | "loading-more" | "error";
type DetailStatus = "loading" | "ready" | "error";

type CommunityViewData = {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  kind?: string;
  icon?: string;
  membersCount?: number;
  isSpecialization: boolean;
  isFollowing: boolean;
  isJoined: boolean;
};

type HashtagListItem = {
  id: string;
  name: string;
  postCount?: number;
};

type VerificationLabel = "Verified" | "Pending" | "Rejected" | "Expired" | "Unverified";

type VerificationInfo = {
  label: VerificationLabel;
  expiresAt?: Date;
};

type JoinLimitInfo = {
  canJoin?: boolean;
  summary?: string;
};

function BackIcon({ className }: { className?: string }) {
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

function extractItemsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  const items = payload.items;
  if (Array.isArray(items)) return items;
  const data = payload.data;
  if (Array.isArray(data)) return data;
  const hashtags = payload.hashtags;
  if (Array.isArray(hashtags)) return hashtags;
  return [];
}

function normalizePostItemToPostData(item: unknown): PostData | null {
  if (!isRecord(item)) return null;
  const node =
    (isRecord(item.post) ? item.post : null) ??
    (isRecord(item.original_post) ? item.original_post : null) ??
    (isRecord(item.post_item) ? item.post_item : null) ??
    item;

  const id = pickString(node, ["id", "post_id", "postId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(node, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ??
    false;

  const authorId = pickString(node, ["author_id", "authorId"]);
  const anonProfileId =
    pickString(node, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]) ??
    (() => {
      const anonProfile =
        (isRecord(node.anon_profile) ? node.anon_profile : null) ??
        (isRecord(node.anonProfile) ? node.anonProfile : null) ??
        (isRecord(node.author_anon_profile) ? node.author_anon_profile : null) ??
        (isRecord(node.authorAnonProfile) ? node.authorAnonProfile : null);
      if (!anonProfile) return undefined;
      return pickString(anonProfile, ["id", "anon_profile_id", "anonProfileId"]);
    })();

  const firstName = pickString(node, ["author_first_name", "authorFirstName"]);
  const lastName = pickString(node, ["author_last_name", "authorLastName"]);
  const fullName = [normalizeOptional(firstName), normalizeOptional(lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  const authorName = isAnonymous
    ? "Anonymous"
    : fullName ||
      pickString(node, ["author_display_name", "authorDisplayName", "author_name", "authorName", "author_handle", "authorHandle"]) ||
      "User";

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

  return {
    id,
    communityId: pickString(node, ["community_id", "communityId"]),
    author: authorName,
    subtitle,
    context,
    content: normalizeOptional(node.content ?? node.body ?? node.text ?? node.message) ?? "",
    time,
    authorProfileImageUrl: pickString(node, ["author_profile_image_url", "authorProfileImageUrl"]),
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
    mediaAssetIds: extractMediaAssetIds(node),
    stats: { likes, comments, reposts, shares, saves },
    isAnonymous,
  };
}

function normalizeHashtagItem(item: unknown): HashtagListItem | null {
  if (typeof item === "string") {
    const cleaned = item.replace(/^#/, "").trim();
    if (!cleaned) return null;
    return { id: cleaned.toLowerCase(), name: cleaned };
  }
  if (!isRecord(item)) return null;
  const name = pickString(item, ["name", "hashtag", "tag", "label"]);
  if (!name) return null;
  const clean = name.replace(/^#/, "").trim();
  if (!clean) return null;

  return {
    id: pickString(item, ["id"]) ?? clean.toLowerCase(),
    name: clean,
    postCount: pickNumber(item, ["post_count", "postCount", "count", "usage_count", "usageCount"]),
  };
}

function normalizeCommunityKind(value: unknown): string | undefined {
  const raw = normalizeOptional(value);
  return raw ? raw.toLowerCase() : undefined;
}

function normalizeCommunityView(payload: unknown, fallbackId: string): CommunityViewData | null {
  if (!isRecord(payload)) return null;
  const node = isRecord(payload.community) ? payload.community : payload;
  const id = pickString(node, ["id", "community_id", "communityId", "specialization_id", "specializationId"]) ?? fallbackId;
  const name =
    pickString(node, ["short_name", "shortName", "name", "display_name", "displayName", "title"]) ??
    "Community";
  const shortName = pickString(node, ["short_name", "shortName"]) ?? undefined;
  const kind =
    normalizeCommunityKind(node.kind ?? node.community_kind ?? node.communityKind ?? node.type ?? node.specialization_type) ??
    undefined;
  const isSpecialization = kind === "major" || kind === "field";

  const isFollowing =
    pickBoolean(node, ["is_following", "isFollowing", "viewer_following", "viewerFollowing", "following", "user_following"]) ??
    false;
  const isJoined =
    pickBoolean(node, ["is_joined", "isJoined", "viewer_joined", "viewerJoined", "joined", "user_joined"]) ??
    false;

  return {
    id,
    name,
    shortName,
    description: pickString(node, ["description", "about", "bio"]) ?? undefined,
    kind,
    icon:
      pickString(node, ["emoji", "icon_emoji", "iconEmoji", "icon", "icon_url", "iconUrl", "image_url", "imageUrl"]) ??
      undefined,
    membersCount:
      pickNumber(node, ["member_count", "memberCount", "members_count", "membersCount", "follower_count", "followers_count"]) ??
      undefined,
    isSpecialization,
    isFollowing,
    isJoined,
  };
}

function parseApiError(error: unknown): { code?: string; message: string; status?: number } {
  if (error instanceof CommunityDetailApiError) {
    const raw = (error.details ?? "").trim();
    if (!raw) return { message: error.message, status: error.status };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isRecord(parsed)) {
        const message = normalizeOptional(parsed.message) ?? raw;
        const code = normalizeOptional(parsed.error);
        return { message, code, status: error.status };
      }
    } catch {
      return { message: raw, status: error.status };
    }
    return { message: raw, status: error.status };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: "Something went wrong." };
}

function messageForActionCode(code?: string, fallback = "Action unavailable right now."): string {
  switch (code) {
    case "community_not_verified":
    case "user_not_verified":
      return "Verification required. Verify in the iOS app.";
    case "specialization_not_joined":
      return "Join this major or field first.";
    case "verification_expired":
      return "Your verification expired. Re-verify in the iOS app.";
    case "community_banned":
      return "This community is currently unavailable.";
    default:
      return fallback;
  }
}

function resolveVerificationInfo(payload: unknown, communityId: string): VerificationInfo {
  const allItems = extractItemsArray(payload);
  const found = allItems.find((entry) => {
    if (!isRecord(entry)) return false;
    const id = pickString(entry, ["community_id", "communityId", "id"]);
    return id === communityId;
  });
  if (!isRecord(found)) return { label: "Unverified" };

  const status = normalizeCommunityKind(found.status);
  const expiresAt = asDate(found.expires_at ?? found.expiresAt ?? found.expiration_date ?? found.expirationDate) ?? undefined;
  if (status === "active") return { label: "Verified", expiresAt };
  if (status === "pending") return { label: "Pending", expiresAt };
  if (status === "rejected") return { label: "Rejected", expiresAt };
  if (status === "expired") return { label: "Expired", expiresAt };
  return { label: "Unverified", expiresAt };
}

function resolveJoinLimitInfo(payload: unknown, kind: "major" | "field"): JoinLimitInfo {
  if (!isRecord(payload)) return {};

  const nested = isRecord(payload[kind]) ? payload[kind] : payload;
  if (!isRecord(nested)) return {};

  const direct = pickBoolean(nested, ["can_join", "canJoin"]);
  const remaining = pickNumber(nested, ["remaining", "remaining_count", "remainingCount", "remaining_slots", "remainingSlots"]);
  const max = pickNumber(nested, ["max", "max_count", "maxCount", "max_joined", "maxJoined"]);
  const joined = pickNumber(nested, ["joined", "joined_count", "joinedCount", "current", "current_count", "currentCount"]);

  let canJoin = direct;
  if (canJoin === undefined && remaining !== undefined) {
    canJoin = remaining > 0;
  }
  if (canJoin === undefined && max !== undefined && joined !== undefined) {
    canJoin = joined < max;
  }

  let summary: string | undefined;
  if (remaining !== undefined && max !== undefined) {
    summary = `${remaining}/${max} joins left`;
  } else if (max !== undefined && joined !== undefined) {
    const nextRemaining = Math.max(max - joined, 0);
    summary = `${nextRemaining}/${max} joins left`;
  }

  return { canJoin, summary };
}

function formatDateMDY(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function isImageUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:image");
}

export function AppCommunityPage({ communityId }: AppCommunityPageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [detailStatus, setDetailStatus] = useState<DetailStatus>("loading");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [community, setCommunity] = useState<CommunityViewData | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<VerificationInfo>({ label: "Unverified" });
  const [permissions, setPermissions] = useState<CommunityPermissions | null>(null);
  const [joinLimitInfo, setJoinLimitInfo] = useState<JoinLimitInfo>({});
  const [followLoading, setFollowLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<CommunityTabId>("posts");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsStatus, setPostsStatus] = useState<LoadStatus>("idle");
  const [postsError, setPostsError] = useState<string | null>(null);

  const [hashtags, setHashtags] = useState<HashtagListItem[]>([]);
  const [hashtagsCursor, setHashtagsCursor] = useState<string | null>(null);
  const [hashtagsStatus, setHashtagsStatus] = useState<LoadStatus>("idle");
  const [hashtagsError, setHashtagsError] = useState<string | null>(null);

  const loadCommunity = useCallback(async () => {
    setDetailStatus("loading");
    setDetailError(null);

    try {
      let communityPayload: unknown | null = null;
      let specializationPayload: unknown | null = null;

      try {
        communityPayload = await fetchCommunityDetail(communityId);
      } catch (error) {
        if (!(error instanceof CommunityDetailApiError) || error.status !== 404) {
          throw error;
        }
      }

      if (communityPayload && isRecord(communityPayload)) {
        const communityKind = normalizeCommunityKind(
          communityPayload.kind ??
            communityPayload.community_kind ??
            communityPayload.communityKind ??
            communityPayload.type
        );
        if (communityKind === "major" || communityKind === "field") {
          try {
            specializationPayload = await fetchSpecializationDetail(communityId);
          } catch (error) {
            if (!(error instanceof CommunityDetailApiError) || error.status !== 404) {
              throw error;
            }
          }
        }
      } else {
        specializationPayload = await fetchSpecializationDetail(communityId);
      }

      const selectedPayload = specializationPayload ?? communityPayload;
      const normalized = normalizeCommunityView(selectedPayload, communityId);
      if (!normalized) throw new Error("Unable to parse community.");
      setCommunity(normalized);
      setDetailStatus("ready");
    } catch (error) {
      const parsed = parseApiError(error);
      setDetailStatus("error");
      setDetailError(parsed.message);
    }
  }, [communityId]);

  useEffect(() => {
    void loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    if (detailStatus !== "ready" || !community) return;
    let active = true;

    (async () => {
      try {
        const permissionResponse = await getCommunityPermissions(community.id);
        if (!active) return;
        setPermissions(permissionResponse);
      } catch {
        if (!active) return;
        setPermissions(null);
      }

      if (community.isSpecialization) {
        try {
          const kind = community.kind === "major" ? "major" : "field";
          const limitResponse = await fetchSpecializationJoinLimits(kind);
          if (!active) return;
          setJoinLimitInfo(resolveJoinLimitInfo(limitResponse, kind));
        } catch {
          if (!active) return;
          setJoinLimitInfo({});
        }
      } else {
        try {
          const verifications = await fetchCommunityVerifications();
          if (!active) return;
          setVerificationInfo(resolveVerificationInfo(verifications, community.id));
        } catch {
          if (!active) return;
          setVerificationInfo({ label: "Unverified" });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [community, detailStatus]);

  const loadPosts = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      if (!community) return;
      setPostsError(null);
      setPostsStatus(cursor ? "loading-more" : "loading");

      try {
        const response = await fetchCommunityPosts({
          communityId: community.id,
          limit: 20,
          cursor,
        });
        const normalized = (response.items ?? [])
          .map(normalizePostItemToPostData)
          .filter((post): post is PostData => Boolean(post));
        setPosts((previous) => (replace ? normalized : [...previous, ...normalized]));
        setPostsCursor(response.next_cursor ?? response.nextCursor ?? null);
        setPostsStatus("idle");
      } catch (error) {
        setPostsStatus("error");
        setPostsError(parseApiError(error).message);
      }
    },
    [community]
  );

  const loadHashtags = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      if (!community) return;
      setHashtagsError(null);
      setHashtagsStatus(cursor ? "loading-more" : "loading");

      try {
        const response = await fetchCommunityHashtags({
          communityId: community.id,
          limit: 20,
          cursor,
        });
        const normalized = (response.items ?? [])
          .map(normalizeHashtagItem)
          .filter((item): item is HashtagListItem => Boolean(item));
        setHashtags((previous) => (replace ? normalized : [...previous, ...normalized]));
        setHashtagsCursor(response.next_cursor ?? response.nextCursor ?? null);
        setHashtagsStatus("idle");
      } catch (error) {
        setHashtagsStatus("error");
        setHashtagsError(parseApiError(error).message);
      }
    },
    [community]
  );

  useEffect(() => {
    if (!community || detailStatus !== "ready") return;
    if (activeTab === "posts") {
      setPosts([]);
      setPostsCursor(null);
      void loadPosts({ replace: true });
      return;
    }

    setHashtags([]);
    setHashtagsCursor(null);
    void loadHashtags({ replace: true });
  }, [activeTab, community, detailStatus, loadHashtags, loadPosts]);

  const canWrite = useMemo(() => {
    if (!permissions) return true;
    return permissions.can_post || Boolean(permissions.canPost);
  }, [permissions]);

  const writeGateReason = useMemo(() => {
    if (!permissions || canWrite) return null;
    if (permissions.requires_verification) return "Verification required. Verify in iOS app.";
    if (permissions.requires_join || permissions.requiresJoin) return "Join this major or field first.";
    return "Writing actions are unavailable.";
  }, [canWrite, permissions]);

  const handleFollowToggle = useCallback(async () => {
    if (!community || followLoading) return;
    const previous = community.isFollowing;
    const next = !previous;
    setFollowLoading(true);
    setCommunity((current) => (current ? { ...current, isFollowing: next } : current));

    try {
      const response = community.isSpecialization
        ? await setSpecializationFollowing(community.id, next)
        : await setCommunityFollowing(community.id, next);
      setCommunity((current) => (current ? { ...current, isFollowing: response.following } : current));
    } catch (error) {
      setCommunity((current) => (current ? { ...current, isFollowing: previous } : current));
      const parsed = parseApiError(error);
      showToast({
        title: "Couldn't update follow",
        message: messageForActionCode(parsed.code, parsed.message),
        tone: "error",
      });
    } finally {
      setFollowLoading(false);
    }
  }, [community, followLoading, showToast]);

  const handleJoinToggle = useCallback(async () => {
    if (!community || !community.isSpecialization || joinLoading) return;
    const previous = community.isJoined;
    const next = !previous;

    if (!previous && joinLimitInfo.canJoin === false) {
      showToast({
        title: "Join required",
        message: "You have reached your current join limit.",
        tone: "error",
      });
      return;
    }

    setJoinLoading(true);
    setCommunity((current) => (current ? { ...current, isJoined: next } : current));

    try {
      const response = await setSpecializationJoined(community.id, next);
      setCommunity((current) => (current ? { ...current, isJoined: response.joined } : current));
    } catch (error) {
      setCommunity((current) => (current ? { ...current, isJoined: previous } : current));
      const parsed = parseApiError(error);
      showToast({
        title: "Couldn't update join",
        message: messageForActionCode(parsed.code, parsed.message),
        tone: "error",
      });
    } finally {
      setJoinLoading(false);
    }
  }, [joinLimitInfo.canJoin, community, joinLoading, showToast]);

  const communityHasImage = isImageUrl(community?.icon);
  const specializationLabel = community?.kind === "major" ? "Major" : community?.kind === "field" ? "Field" : undefined;

  return (
    <AppLayout activeNavId="home">
      {detailStatus === "loading" ? (
        <div className="space-y-3 bg-bg px-4 py-6">
          <div className="h-5 w-1/3 animate-pulse rounded-full bg-bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-bg-muted" />
          <div className="h-20 animate-pulse rounded-2xl bg-bg-muted" />
        </div>
      ) : null}

      {detailStatus === "error" ? (
        <div className="space-y-3 bg-bg px-4 py-6">
          <p className="text-sm font-semibold text-strong">Unable to load community.</p>
          <p className="text-sm text-text-secondary">{detailError}</p>
          <button
            type="button"
            onClick={() => void loadCommunity()}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {community ? (
        <>
          <section className="border-b border-border/70 bg-bg">
            <div className="px-4 pb-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    navigate(-1);
                    return;
                  }
                  navigate("/app/search", { replace: true });
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong lg:hidden"
                aria-label="Go back"
              >
                <BackIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-3 hidden text-sm font-semibold text-text-secondary transition hover:text-strong lg:inline-flex"
              >
                Back
              </button>

              <div className="mt-5 flex flex-col items-center text-center">
                {communityHasImage ? (
                  <div className="flex h-14 min-w-20 max-w-[180px] items-center justify-center overflow-hidden">
                    <img src={community.icon!} alt="" className="max-h-14 w-auto object-contain" loading="lazy" />
                  </div>
                ) : null}

                <h1
                  className={`mt-4 text-[2rem] leading-[1.15] font-semibold ${
                    communityHasImage ? "text-strong" : "text-brand"
                  }`}
                >
                  {community.name}
                </h1>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[1rem] font-semibold text-text-secondary">
                  {community.membersCount ?? 0} {(community.membersCount ?? 0) === 1 ? "Member" : "Members"}
                </p>
                <button
                  type="button"
                  onClick={() => void handleFollowToggle()}
                  disabled={followLoading}
                  className={`min-w-[136px] rounded-full px-6 py-2 text-base font-semibold transition ${
                    community.isFollowing
                      ? "bg-bg-muted text-strong hover:text-strong"
                      : "bg-brand text-white hover:bg-brand-hover"
                  } disabled:opacity-60`}
                >
                  {followLoading ? "Updating..." : community.isFollowing ? "Following" : "Follow"}
                </button>
              </div>

              {community.isSpecialization ? (
                <div className="mt-4 space-y-2 text-left">
                  {specializationLabel ? (
                    <span className="inline-flex rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                      {specializationLabel}
                    </span>
                  ) : null}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                          <path d="M10 2a5 5 0 0 0-5 5v1H4a2 2 0 0 0-2 2v2a6 6 0 1 0 12 0v-2a2 2 0 0 0-2-2h-1V7a3 3 0 1 1 6 0v1h-1a2 2 0 0 0-2 2v2a8 8 0 1 1-16 0v-2h1V7a7 7 0 0 1 7-7Z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-lg font-semibold text-strong">{community.isJoined ? "Joined" : "Not joined"}</p>
                        <p className="text-sm text-text-secondary">{joinLimitInfo.summary ?? "Join limits apply"}</p>
                      </div>
                    </div>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-xs text-text-light">
                      ?
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2 text-left">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full ${
                        verificationInfo.label === "Verified" ? "bg-brand text-white" : "bg-bg-muted text-text-secondary"
                      }`}
                    >
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                        <path d="M7.7 13.1 4.9 10.3l-1.2 1.2 4 4 8-8-1.2-1.2-6.8 6.8Z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-2xl font-semibold text-strong">{verificationInfo.label}</p>
                      {verificationInfo.expiresAt ? (
                        <p className="text-sm text-text-secondary">Expires {formatDateMDY(verificationInfo.expiresAt)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {community.isSpecialization ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void handleJoinToggle()}
                    disabled={joinLoading}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      community.isJoined
                        ? "border border-border/70 bg-bg text-text-secondary hover:text-strong"
                        : "bg-brand/90 text-white hover:bg-brand"
                    } disabled:opacity-60`}
                  >
                    {joinLoading ? "Updating..." : community.isJoined ? "Joined" : "Join"}
                  </button>
                </div>
              ) : null}

              {!community.isSpecialization && verificationInfo.label !== "Verified" ? (
                <p className="mt-2 text-xs text-text-light text-left">Verification actions are available in the iOS app.</p>
              ) : null}

              {community.description ? (
                <p className="mt-3 text-left text-sm leading-relaxed text-text-secondary">{community.description}</p>
              ) : null}

              {!canWrite && writeGateReason ? (
                <div className="mt-3 rounded-2xl border border-border/70 bg-bg-muted/40 px-3 py-2 text-left">
                  <p className="text-xs font-semibold text-strong">Write actions are gated</p>
                  <p className="mt-1 text-xs text-text-secondary">{writeGateReason}</p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 border-t border-border/70">
              <button
                type="button"
                onClick={() => setActiveTab("posts")}
                className={`relative px-2 py-4 text-center text-sm transition ${
                  activeTab === "posts" ? "font-bold text-brand" : "font-medium text-text-secondary hover:text-strong"
                }`}
              >
                Posts
                {activeTab === "posts" ? (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("hashtags")}
                className={`relative px-2 py-4 text-center text-sm transition ${
                  activeTab === "hashtags" ? "font-bold text-brand" : "font-medium text-text-secondary hover:text-strong"
                }`}
              >
                Hashtags
                {activeTab === "hashtags" ? (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" />
                ) : null}
              </button>
            </div>
          </section>

          {activeTab === "posts" ? (
            <div className="divide-y divide-border/70 bg-bg">
              {postsError ? (
                <div className="space-y-3 px-4 py-4">
                  <p className="text-sm font-semibold text-strong">Unable to load posts.</p>
                  <p className="text-sm text-text-secondary">{postsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadPosts({ replace: true })}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}

              {postsStatus === "loading" && posts.length === 0 && !postsError ? (
                <div className="px-4 py-5 text-sm text-text-secondary">Loading posts...</div>
              ) : null}

              {posts.length === 0 && postsStatus === "idle" && !postsError ? (
                <div className="px-4 py-5 text-sm text-text-secondary">No posts yet.</div>
              ) : null}

              {postsCursor && postsStatus !== "loading-more" ? (
                <div className="flex justify-center px-4 py-5">
                  <button
                    type="button"
                    onClick={() =>
                      void loadPosts({
                        cursor: postsCursor,
                        replace: false,
                      })
                    }
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
            <div className="divide-y divide-border/70 bg-bg">
              {hashtagsError ? (
                <div className="space-y-3 px-4 py-4">
                  <p className="text-sm font-semibold text-strong">Unable to load hashtags.</p>
                  <p className="text-sm text-text-secondary">{hashtagsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadHashtags({ replace: true })}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {hashtags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    showToast({
                      title: "Hashtag",
                      message: `Open #${tag.name} from Search.`,
                    });
                    navigate("/app/search");
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-bg-muted/35"
                >
                  <span className="text-sm font-semibold text-strong">#{tag.name}</span>
                  <span className="text-xs text-text-light">
                    {tag.postCount !== undefined ? `${tag.postCount} posts` : ""}
                  </span>
                </button>
              ))}

              {hashtagsStatus === "loading" && hashtags.length === 0 && !hashtagsError ? (
                <div className="px-4 py-5 text-sm text-text-secondary">Loading hashtags...</div>
              ) : null}

              {hashtags.length === 0 && hashtagsStatus === "idle" && !hashtagsError ? (
                <div className="px-4 py-5 text-sm text-text-secondary">No hashtags yet.</div>
              ) : null}

              {hashtagsCursor && hashtagsStatus !== "loading-more" ? (
                <div className="flex justify-center px-4 py-5">
                  <button
                    type="button"
                    onClick={() =>
                      void loadHashtags({
                        cursor: hashtagsCursor,
                        replace: false,
                      })
                    }
                    className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                  >
                    Load more
                  </button>
                </div>
              ) : null}

              {hashtagsStatus === "loading-more" ? (
                <div className="px-4 py-5 text-center text-sm text-text-secondary">Loading more...</div>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </AppLayout>
  );
}
