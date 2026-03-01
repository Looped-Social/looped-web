import { useCallback, useEffect, useState } from "react";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll } from "@/lib/postPoll";
import { extractViewerCapabilitiesFromPost } from "@/lib/postViewerCapabilities";
import {
  CommunityDetailApiError,
  fetchCommunityDetail,
  fetchCommunityHashtags,
  fetchCommunityPosts,
  fetchSpecializationDetail,
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
  bannerImageUrl?: string;
  imageUrl?: string;
  typeLabel: string;
  membersCount?: number;
  isSpecialization: boolean;
  isFollowing: boolean;
  isJoined: boolean;
  canPost: boolean;
  cannotPostReason?: string;
  verificationInfo: VerificationInfo;
  joinLimitInfo: JoinLimitInfo;
};

type VerificationLabel = "Verified" | "Pending" | "Rejected" | "Expired" | "Unverified";

type VerificationInfo = {
  label: VerificationLabel;
  status: "active" | "pending" | "rejected" | "expired" | "none" | "unknown";
  expiresAt?: Date;
};

type JoinLimitInfo = {
  canJoin?: boolean;
  summary?: string;
  blockedReason?: string;
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

function StatusBadgeIcon({
  icon,
  tone,
}: {
  icon: "check" | "clock" | "x" | "warning";
  tone: "verified" | "brand" | "error" | "muted";
}) {
  const className =
    tone === "verified"
      ? "inline-flex h-9 w-9 shrink-0 items-center justify-center"
      : tone === "brand"
        ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"
        : tone === "error"
          ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg"
          : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary";

  const style =
    tone === "verified"
      ? { color: "var(--color-verified-badge)" }
      : tone === "error"
        ? { color: "var(--color-error)" }
        : undefined;

  return (
    <span className={className} style={style}>
      {icon === "check" && tone === "verified" ? (
        <RiVerifiedBadgeFill className="h-7 w-7" aria-hidden="true" />
      ) : null}
      {icon === "check" ? (
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${tone === "verified" ? "hidden" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="m4.5 10 3.5 3.5L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {icon === "clock" ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" />
          <path d="M10 6.4v4.1l2.6 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {icon === "x" ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true">
          <path d="m6.2 6.2 7.6 7.6M13.8 6.2l-7.6 7.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {icon === "warning" ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10 5.2v5.2" strokeLinecap="round" />
          <circle cx="10" cy="13.8" r="0.75" fill="currentColor" stroke="none" />
          <circle cx="10" cy="10" r="6.5" />
        </svg>
      ) : null}
    </span>
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
    viewerCapabilities: extractViewerCapabilitiesFromPost(node),
    poll: normalizePostPoll(node),
    mediaAssetIds: extractMediaAssetIds(node),
    stats: { likes, comments, reposts, shares, saves },
    isAnonymous,
  };
}

function normalizeCommunityKind(value: unknown): string | undefined {
  const raw = normalizeOptional(value);
  return raw ? raw.toLowerCase() : undefined;
}

function formatCompactCount(value: number | undefined): string {
  const count = typeof value === "number" && Number.isFinite(value) ? Math.max(Math.round(value), 0) : 0;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: count >= 1_000 ? 1 : 0,
  }).format(count);
}

function resolveCommunityTypeLabel(kind?: string, specializationType?: string): string {
  const resolved = specializationType ?? kind;
  switch (resolved) {
    case "company":
      return "Workplace";
    case "school":
      return "School";
    case "major":
      return "Major";
    case "field":
      return "Field";
    default:
      return "Community";
  }
}

function resolveVerificationInfoFromViewer(payload: unknown): VerificationInfo {
  if (!isRecord(payload)) {
    return { label: "Unverified", status: "unknown" };
  }

  const status =
    normalizeCommunityKind(payload.verification_status ?? payload.verificationStatus) as VerificationInfo["status"] | undefined;
  const expiresAt = asDate(payload.verification_expires_at ?? payload.verificationExpiresAt) ?? undefined;

  if (status === "active") return { label: "Verified", status, expiresAt };
  if (status === "pending") return { label: "Pending", status, expiresAt };
  if (status === "rejected") return { label: "Rejected", status, expiresAt };
  if (status === "expired") return { label: "Expired", status, expiresAt };
  if (status === "none") return { label: "Unverified", status, expiresAt };
  return { label: "Unverified", status: "unknown", expiresAt };
}

function normalizeCommunityView(payload: unknown, fallbackId: string): CommunityViewData | null {
  if (!isRecord(payload)) return null;
  const node = isRecord(payload.community) ? payload.community : payload;
  const id = pickString(node, ["id", "community_id", "communityId", "specialization_id", "specializationId"]) ?? fallbackId;
  const name =
    pickString(node, ["name", "display_name", "displayName", "title", "short_name", "shortName"]) ??
    "Community";
  const shortName = pickString(node, ["short_name", "shortName"]) ?? undefined;
  const rawKind =
    normalizeCommunityKind(node.kind ?? node.community_kind ?? node.communityKind ?? node.type) ?? undefined;
  const specializationType = (() => {
    const value = normalizeCommunityKind(node.specialization_type ?? node.specializationType);
    if (value === "major" || value === "field") return value;
    if (rawKind === "major" || rawKind === "field") return rawKind;
    return undefined;
  })();
  const isSpecialization = rawKind === "specialization" || Boolean(specializationType);
  const viewer = isRecord(node.viewer) ? node.viewer : null;

  const isFollowing =
    pickBoolean(node, ["is_following", "isFollowing", "viewer_following", "viewerFollowing", "following", "user_following"]) ??
    false;
  const isJoined =
    pickBoolean(node, ["is_joined", "isJoined", "viewer_joined", "viewerJoined", "joined", "user_joined"]) ??
    false;

  const joinLimitInfo = isSpecialization ? resolveJoinLimitInfo(node.join_limit ?? node.joinLimit) : {};

  return {
    id,
    name,
    shortName,
    description: pickString(node, ["description", "about", "bio"]) ?? undefined,
    kind: specializationType ?? rawKind,
    bannerImageUrl: pickString(node, ["banner_image_url", "bannerImageUrl"]) ?? undefined,
    imageUrl: pickString(node, ["image_url", "imageUrl", "profile_image_url", "profileImageUrl"]) ?? undefined,
    typeLabel: resolveCommunityTypeLabel(rawKind, specializationType),
    membersCount:
      pickNumber(node, ["member_count", "memberCount", "members_count", "membersCount", "follower_count", "followers_count"]) ??
      undefined,
    isSpecialization,
    isFollowing,
    isJoined,
    canPost: pickBoolean(viewer ?? {}, ["can_post", "canPost"]) ?? true,
    cannotPostReason: pickString(viewer ?? {}, ["cannot_post_reason", "cannotPostReason"]) ?? undefined,
    verificationInfo: resolveVerificationInfoFromViewer(viewer),
    joinLimitInfo,
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
    case "specialization_verification_required":
    case "verification_required":
    case "verify_school":
      return "Verification required. Verify your organization email to continue.";
    case "specialization_not_joined":
      return "Join this major or field first.";
    case "specialization_join_limit":
      return "You have reached your current join limit.";
    case "specialization_join_cooldown":
      return "You can't rejoin this yet.";
    case "verification_expired":
      return "Your verification expired. Re-verify your organization email.";
    case "community_banned":
      return "This community is currently unavailable.";
    default:
      return fallback;
  }
}

function resolveJoinLimitInfo(payload: unknown): JoinLimitInfo {
  if (!isRecord(payload)) return {};
  const direct = pickBoolean(payload, ["can_join", "canJoin"]);
  const remaining = pickNumber(payload, ["remaining", "remaining_count", "remainingCount", "remaining_slots", "remainingSlots"]);
  const max =
    pickNumber(payload, ["limit", "max", "max_count", "maxCount", "max_joined", "maxJoined"]) ?? undefined;
  const joined = pickNumber(payload, ["joined", "joined_count", "joinedCount", "current", "current_count", "currentCount"]);
  const cooldownActive = pickBoolean(payload, ["cooldown_active", "cooldownActive"]) ?? false;
  const cooldownDaysRemaining = pickNumber(payload, ["cooldown_days_remaining", "cooldownDaysRemaining"]);
  const cooldownEndsAt = asDate(payload.cooldown_ends_at ?? payload.cooldownEndsAt) ?? undefined;
  const blockedReason =
    pickString(payload, ["join_blocked_reason", "joinBlockedReason", "blocked_reason", "blockedReason"]) ?? undefined;

  let canJoin = direct;
  if (canJoin === undefined && remaining !== undefined) {
    canJoin = remaining > 0;
  }
  if (canJoin === undefined && max !== undefined && joined !== undefined) {
    canJoin = joined < max;
  }

  let summary: string | undefined;
  if (blockedReason === "verification_required" || blockedReason === "verify_school") {
    summary = "Verification required to join";
  } else if (cooldownActive) {
    summary = cooldownDaysRemaining
      ? `${cooldownDaysRemaining} day${cooldownDaysRemaining === 1 ? "" : "s"} remaining`
      : cooldownEndsAt
        ? `Available ${formatDateMDY(cooldownEndsAt)}`
        : "Join cooldown active";
  } else if (remaining !== undefined && max !== undefined) {
    summary = `${remaining}/${max} joins left`;
  } else if (max !== undefined && joined !== undefined) {
    const nextRemaining = Math.max(max - joined, 0);
    summary = `${nextRemaining}/${max} joins left`;
  }

  return { canJoin, summary, blockedReason };
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
  const [followLoading, setFollowLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<CommunityTabId>("posts");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsStatus, setPostsStatus] = useState<LoadStatus>("idle");
  const [postsError, setPostsError] = useState<string | null>(null);

  const [hashtags, setHashtags] = useState<PostData[]>([]);
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
        const specializationType = normalizeCommunityKind(
          communityPayload.specialization_type ?? communityPayload.specializationType
        );
        const looksLikeSpecialization =
          communityKind === "specialization" ||
          communityKind === "major" ||
          communityKind === "field" ||
          specializationType === "major" ||
          specializationType === "field";

        if (looksLikeSpecialization) {
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
          .map(normalizePostItemToPostData)
          .filter((post): post is PostData => Boolean(post));
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

    if (!previous && community.joinLimitInfo.canJoin === false) {
      showToast({
        title: "Join required",
        message: messageForActionCode(community.joinLimitInfo.blockedReason, "You have reached your current join limit."),
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
  }, [community, joinLoading, showToast]);

  const communityHasBanner = isImageUrl(community?.bannerImageUrl);
  const verificationInfo = community?.verificationInfo ?? { label: "Unverified", status: "unknown" as const };
  const joinLimitInfo = community?.joinLimitInfo ?? {};

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
                aria-label="Back"
              >
                <BackIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-3 hidden items-center gap-1 text-sm font-semibold text-text-secondary transition hover:text-strong lg:inline-flex"
              >
                <BackIcon className="h-4 w-4" />
                <span>Back</span>
              </button>

              <div className="mt-5">
                {communityHasBanner ? (
                  <div className="h-[120px] overflow-hidden rounded-[24px] bg-white">
                    <img
                      src={community.bannerImageUrl!}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex h-[120px] items-center justify-center rounded-[24px] bg-bg-muted/70 px-5 text-center">
                    <h1 className="text-[2rem] leading-[1.1] font-semibold text-strong">{community.name}</h1>
                  </div>
                )}

                {communityHasBanner ? (
                  <h1 className="mt-4 text-[1.5rem] leading-[1.2] font-semibold text-strong">{community.name}</h1>
                ) : null}
              </div>

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-contrast)" }}>{community.typeLabel}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatCompactCount(community.membersCount)} member{community.membersCount === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleFollowToggle()}
                  disabled={followLoading}
                  className={`min-h-11 min-w-[120px] rounded-full px-5 text-base font-semibold transition ${
                    community.isFollowing
                      ? "bg-bg-muted text-strong hover:text-strong"
                      : "bg-brand text-white hover:bg-brand-hover"
                  } disabled:opacity-60`}
                >
                  {followLoading ? "Updating..." : community.isFollowing ? "Following" : "Follow"}
                </button>
              </div>

              <div className="mt-4 rounded-[10px] border border-border/40 bg-bg-muted/70 px-2.5 py-2 text-left">
                {community.isSpecialization ? (
                  <div className="flex items-start gap-3">
                    <StatusBadgeIcon icon={community.isJoined ? "check" : "warning"} tone={community.isJoined ? "brand" : "muted"} />
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-strong">{community.isJoined ? "Joined" : "Not joined"}</p>
                      <p className="mt-0.5 text-sm text-text-secondary">
                        {joinLimitInfo.summary ?? "Join limits apply"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <StatusBadgeIcon
                      icon={
                        verificationInfo.label === "Verified"
                          ? "check"
                          : verificationInfo.label === "Pending"
                            ? "clock"
                            : verificationInfo.label === "Rejected"
                              ? "x"
                              : "warning"
                      }
                      tone={
                        verificationInfo.label === "Verified"
                          ? "verified"
                          : verificationInfo.label === "Rejected"
                            ? "error"
                            : "muted"
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-strong">{verificationInfo.label}</p>
                      <p className="mt-0.5 text-sm text-text-secondary">
                        {verificationInfo.label === "Verified" && verificationInfo.expiresAt
                          ? `Expires ${formatDateMDY(verificationInfo.expiresAt)}`
                          : verificationInfo.label === "Unverified"
                            ? "Verification required to post, like, or comment. Verify your organization email."
                            : "Verification state shown from your community access"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

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

              {community.description ? (
                <p className="mt-3 text-left text-sm leading-relaxed text-text-secondary">{community.description}</p>
              ) : null}

            </div>

            <div className="grid grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveTab("posts")}
                className={`relative px-2 py-4 text-center text-sm transition ${
                  activeTab === "posts" ? "font-semibold text-brand" : "font-medium text-text-secondary hover:text-strong"
                }`}
              >
                Posts
                {activeTab === "posts" ? (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("hashtags")}
                className={`relative px-2 py-4 text-center text-sm transition ${
                  activeTab === "hashtags" ? "font-semibold text-brand" : "font-medium text-text-secondary hover:text-strong"
                }`}
              >
                Hashtags
                {activeTab === "hashtags" ? (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand" />
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
                  <p className="text-sm font-semibold text-strong">Unable to load hashtag posts.</p>
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

              {hashtags.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}

              {hashtagsStatus === "loading" && hashtags.length === 0 && !hashtagsError ? (
                <div className="px-4 py-5 text-sm text-text-secondary">Loading hashtag posts...</div>
              ) : null}

              {hashtags.length === 0 && hashtagsStatus === "idle" && !hashtagsError ? (
                <div className="px-4 py-5 text-sm text-text-secondary">No hashtag posts yet.</div>
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
