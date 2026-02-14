import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { MenuDots } from "@/app/components/AppIcons/AppIcons";
import { useToast } from "@/app/components/AppToast/AppToast";
import { createConversation, fetchConversations, MessagingApiError } from "@/lib/messagingApi";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { fetchMyReposts, fetchPostsReposted, fetchPostsSaved } from "@/lib/postReadApi";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll } from "@/lib/postPoll";
import { extractViewerCapabilitiesFromPost } from "@/lib/postViewerCapabilities";
import { fetchDefaultProfileImageUrl } from "@/lib/profileEditApi";
import {
  UserApiError,
  blockUser,
  fetchMyShareLink,
  fetchMyContent,
  fetchSlugAvailability,
  fetchUserContent,
  fetchUserFollowing,
  fetchUserProfile,
  fetchUserReposts,
  fetchUserMe,
  fetchUserSavedPosts,
  parseUserApiError,
  setUserFollowing,
  updateMyShareLink,
} from "@/lib/userApi";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";
const FOLLOW_STORE_KEY = "looped-following-user-ids";
const SHARE_HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

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
  highlightedCommunity?: string;
  createdYear?: string;
  showFollowerCount: boolean;
  followingCount: number;
  followersCount: number;
};

type ShareLinkData = {
  usernameSlug: string;
  customSlug: string | null;
  activeSlug: string;
  canonicalUrl: string;
};

type ProfileTabId = "content" | "saved" | "reposts";

type ReplyFeedData = {
  id: string;
  postId?: string;
  content: string;
  parentSnippet?: string;
  time: string;
};

type ProfileFeedItem =
  | {
      kind: "post";
      key: string;
      post: PostData;
    }
  | {
      kind: "reply";
      key: string;
      reply: ReplyFeedData;
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

function normalizeShareLink(payload: unknown): ShareLinkData | null {
  if (!isRecord(payload)) return null;

  const usernameSlug = normalizeOptional(payload.usernameSlug ?? payload.username_slug) ?? "";
  const activeSlug = normalizeOptional(payload.activeSlug ?? payload.active_slug) ?? "";
  const canonicalUrl = normalizeOptional(payload.canonicalUrl ?? payload.canonical_url) ?? "";

  if (!usernameSlug || !activeSlug || !canonicalUrl) return null;

  return {
    usernameSlug,
    customSlug: normalizeOptional(payload.customSlug ?? payload.custom_slug) ?? null,
    activeSlug,
    canonicalUrl,
  };
}

function messageForShareSlugError(code: string | null | undefined, fallback: string): string {
  const normalizedCode = (code ?? "").toLowerCase();
  if (normalizedCode === "slug_invalid") return "Use 3-30 lowercase letters, numbers, or underscores.";
  if (normalizedCode === "slug_reserved") return "That slug is reserved.";
  if (normalizedCode === "slug_taken") return "That slug is already taken.";
  if (normalizedCode === "slug_not_actionable") return "That slug cannot be used right now.";
  return fallback;
}

function displayUrlWithoutProtocol(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url.replace(/^https?:\/\//i, "");
  }
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

function formatCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
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
    viewerCapabilities: extractViewerCapabilitiesFromPost(item),
    poll: normalizePostPoll(item),
    mediaAssetIds: extractMediaAssetIds(item),
    stats: { likes, comments, reposts, shares, saves },
    isAnonymous,
  };
}

function normalizeReplyFeedItem(item: Record<string, unknown>, keySuffix: string): ProfileFeedItem | null {
  const replyNode = (isRecord(item.reply) ? item.reply : null) ?? item;
  const replyId = pickString(replyNode, ["id", "reply_id", "replyId"]) ?? keySuffix;
  const isDeleted = pickBoolean(replyNode, ["is_deleted", "isDeleted"]) ?? false;
  const content =
    normalizeOptional(replyNode.content ?? replyNode.reply_text ?? replyNode.replyText) ??
    (isDeleted ? "[Deleted reply]" : "Reply");

  const postNode =
    (isRecord(item.post) ? item.post : null) ??
    (isRecord(item.post_preview) ? item.post_preview : null) ??
    (isRecord(item.original_post) ? item.original_post : null);

  const postId =
    pickString(replyNode, ["post_id", "postId"]) ??
    (postNode ? pickString(postNode, ["id", "post_id", "postId"]) : undefined);

  const parentSnippet =
    (postNode
      ? normalizeOptional(postNode.content ?? postNode.body ?? postNode.text ?? postNode.message)
      : undefined) ?? undefined;

  const created = asDate(replyNode.created_at ?? replyNode.createdAt ?? item.created_at ?? item.createdAt ?? item.createdAt);
  const time =
    (created ? formatCalendarDate(created) : undefined) ??
    normalizeOptional(replyNode.time_ago ?? replyNode.timeAgo ?? item.time_ago ?? item.timeAgo) ??
    "";

  return {
    kind: "reply",
    key: `reply-${replyId}-${keySuffix}`,
    reply: {
      id: replyId,
      postId,
      content,
      parentSnippet,
      time,
    },
  };
}

function normalizeContentFeedItem(item: unknown, keySuffix: string): ProfileFeedItem | null {
  if (!isRecord(item)) return null;

  const type = normalizeOptional(item.type)?.toLowerCase();
  if (type === "reply" || (isRecord(item.reply) && type !== "post")) {
    return normalizeReplyFeedItem(item, keySuffix);
  }

  const postNode =
    (isRecord(item.post) ? item.post : null) ??
    (isRecord(item.original_post) ? item.original_post : null) ??
    (isRecord(item.post_item) ? item.post_item : null) ??
    item;

  const postData = normalizePostItemToPostData(postNode);
  if (postData) {
    return {
      kind: "post",
      key: `post-${postData.id}-${keySuffix}`,
      post: postData,
    };
  }

  if (isRecord(item.reply)) {
    return normalizeReplyFeedItem(item, keySuffix);
  }

  return null;
}

function normalizePostFeedItem(item: unknown, keySuffix: string): ProfileFeedItem | null {
  if (!isRecord(item)) return null;
  const postNode =
    (isRecord(item.post) ? item.post : null) ??
    (isRecord(item.original_post) ? item.original_post : null) ??
    (isRecord(item.post_item) ? item.post_item : null) ??
    item;

  const postData = normalizePostItemToPostData(postNode);
  if (!postData) return null;
  return {
    kind: "post",
    key: `post-${postData.id}-${keySuffix}`,
    post: postData,
  };
}

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof UserApiError || error instanceof MessagingApiError) {
    const raw = error.details?.trim();
    if (!raw) return error.message;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const code = normalizeOptional(parsed.error)?.toLowerCase();
        if (code === "anonymous_not_allowed") return "Messaging is unavailable in anonymous mode.";
        if (code === "message_request_pending") return "Message request is still pending.";
        if (code === "message_request_rejected") return "Message request was rejected.";
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

function extractConversationId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  const directId = pickString(payload, ["conversation_id", "conversationId", "id"]);
  if (directId) return directId;

  const nestedRecord =
    (isRecord(payload.conversation) ? payload.conversation : null) ??
    (isRecord(payload.data) ? payload.data : null) ??
    (isRecord(payload.item) ? payload.item : null);
  if (!nestedRecord) return undefined;
  return pickString(nestedRecord, ["conversation_id", "conversationId", "id"]);
}

function extractConversationParticipantId(item: Record<string, unknown>): string | undefined {
  const directId = pickString(item, ["other_user_id", "otherUserId", "participant_user_id", "participantUserId"]);
  if (directId) return directId;

  const otherProfile =
    (isRecord(item.other_user_profile) ? item.other_user_profile : null) ??
    (isRecord(item.otherUserProfile) ? item.otherUserProfile : null) ??
    (isRecord(item.participant) ? item.participant : null) ??
    (isRecord(item.user) ? item.user : null);
  if (!otherProfile) return undefined;
  return pickString(otherProfile, ["id", "user_id", "userId"]);
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
  const followingCount =
    (stats ? pickNumber(stats, ["following_count", "followingCount"]) : undefined) ??
    pickNumber(payload, ["following_count", "followingCount"]) ??
    0;
  const followersCount =
    (stats ? pickNumber(stats, ["follower_count", "followers_count", "followerCount", "followersCount"]) : undefined) ??
    pickNumber(payload, ["follower_count", "followers_count", "followerCount", "followersCount"]) ??
    0;
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
    highlightedCommunity: displayCommunity,
    createdYear,
    showFollowerCount,
    followingCount,
    followersCount,
  };
}

function mergeProfileData(primary: ProfileViewData, fallback: ProfileViewData): ProfileViewData {
  return {
    ...primary,
    bio: primary.bio || fallback.bio,
    avatarUrl: primary.avatarUrl ?? fallback.avatarUrl,
    yearsInLoop: primary.yearsInLoop ?? fallback.yearsInLoop,
    memberLine: primary.memberLine ?? fallback.memberLine,
    highlightedCommunity: primary.highlightedCommunity ?? fallback.highlightedCommunity,
    createdYear: primary.createdYear ?? fallback.createdYear,
    followingCount: Math.max(primary.followingCount, fallback.followingCount),
    followersCount: Math.max(primary.followersCount, fallback.followersCount),
    showFollowerCount: primary.showFollowerCount ?? fallback.showFollowerCount,
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

function SettingsIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 ${className ?? ""}`}
      style={{
        maskImage: "url('/ios-icons/nav-settings.svg')",
        WebkitMaskImage: "url('/ios-icons/nav-settings.svg')",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
      aria-hidden="true"
    />
  );
}

function ReplyContentCard({ item }: { item: ReplyFeedData }) {
  return (
    <article className="bg-bg px-4 py-4">
      <div className="rounded-xl bg-bg-muted/70 px-3 py-2.5">
        <p className="text-[0.95rem] font-medium text-text-light">In reply to</p>
        <p className="mt-1 text-[1.05rem] leading-snug text-text-secondary">
          {item.parentSnippet ?? "Original post unavailable."}
        </p>
      </div>

      <p className="mt-3 text-[1.35rem] leading-[1.28] font-semibold text-strong">{item.content}</p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[0.95rem] text-text-light">{item.time}</p>
        {item.postId ? (
          <Link
            to={`/app/post/${item.postId}/comments`}
            className="text-[0.9rem] font-semibold text-text-secondary transition hover:text-strong"
          >
            View thread
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function AppProfilePage({ profileUserId }: AppProfilePageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [defaultProfileImageUrl, setDefaultProfileImageUrl] = useState<string | undefined>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileViewData | null>(null);
  const [profileStatus, setProfileStatus] = useState<"loading" | "idle" | "error">("loading");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [activeTabId, setActiveTabId] = useState<ProfileTabId>("content");
  const [feedItems, setFeedItems] = useState<ProfileFeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [feedStatus, setFeedStatus] = useState<"idle" | "loading" | "loading-more" | "error">("idle");
  const [feedError, setFeedError] = useState<string | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null);
  const [isShareLinkSaving, setIsShareLinkSaving] = useState(false);
  const [isShareLinkDialogOpen, setIsShareLinkDialogOpen] = useState(false);
  const [shareLinkDraft, setShareLinkDraft] = useState("");
  const [shareLinkDialogError, setShareLinkDialogError] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showBlockPrompt, setShowBlockPrompt] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);

  const isCurrentUser = useMemo(
    () => Boolean(currentUserId && targetUserId && currentUserId === targetUserId),
    [currentUserId, targetUserId]
  );
  const canShowProfileMenu = Boolean(profile && targetUserId && !isCurrentUser && !profile.isAnonymous);
  const showOwnProfileSettingsShortcut = !profileUserId || isCurrentUser;
  const profileHandleLabel = useMemo(() => {
    if (!profile?.handle) return "@this account";
    return profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`;
  }, [profile?.handle]);
  const normalizedShareHandle = useMemo(() => {
    if (!profile?.handle) return null;
    const normalized = profile.handle.replace(/^@/, "").trim().toLowerCase();
    return SHARE_HANDLE_PATTERN.test(normalized) ? normalized : null;
  }, [profile?.handle]);
  const profileSharePath = useMemo(
    () => (normalizedShareHandle ? `/u/${encodeURIComponent(normalizedShareHandle)}` : null),
    [normalizedShareHandle]
  );
  const profileShareUrl = useMemo(() => {
    if (isCurrentUser && shareLink?.canonicalUrl) {
      return shareLink.canonicalUrl;
    }
    if (!profileSharePath) return null;
    if (typeof window === "undefined") return `https://mylooped.app${profileSharePath}`;
    return `${window.location.origin}${profileSharePath}`;
  }, [isCurrentUser, profileSharePath, shareLink?.canonicalUrl]);
  const profileShareDisplay = useMemo(
    () =>
      profileShareUrl
        ? displayUrlWithoutProtocol(profileShareUrl)
        : normalizedShareHandle
          ? `mylooped.app/u/${normalizedShareHandle}`
          : null,
    [normalizedShareHandle, profileShareUrl]
  );

  useEffect(() => {
    let active = true;
    fetchDefaultProfileImageUrl()
      .then((url) => {
        if (!active) return;
        setDefaultProfileImageUrl(url);
      })
      .catch(() => {
        if (!active) return;
        setDefaultProfileImageUrl(undefined);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canShowProfileMenu) {
      setIsProfileMenuOpen(false);
      setShowBlockPrompt(false);
      setIsBlockingUser(false);
    }
  }, [canShowProfileMenu]);

  const handleAvatarImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      if (defaultProfileImageUrl && image.dataset.defaultFallbackApplied !== "true") {
        image.dataset.defaultFallbackApplied = "true";
        image.src = defaultProfileImageUrl;
        return;
      }
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      image.src = DEFAULT_PROFILE_IMAGE_SRC;
    },
    [defaultProfileImageUrl]
  );

  const loadProfile = useCallback(async () => {
    setProfileStatus("loading");
    setProfileError(null);
    setFeedStatus("loading");
    setFeedError(null);
    setFeedItems([]);
    setNextCursor(null);

    try {
      const meResponse = await fetchUserMe();
      const meRoot = meResponse as unknown;
      const mePayload = isRecord(meRoot) && isRecord(meRoot.user) ? meRoot.user : meRoot;
      const resolvedCurrentUserId = resolveCurrentUserId(meResponse);
      if (!resolvedCurrentUserId) {
        throw new Error("Unable to resolve your profile.");
      }
      const resolvedTargetUserId = profileUserId?.trim() ? profileUserId.trim() : resolvedCurrentUserId;

      let profilePayload: unknown;
      try {
        profilePayload = await fetchUserProfile(resolvedTargetUserId);
      } catch (error) {
        if (resolvedTargetUserId === resolvedCurrentUserId && isRecord(mePayload)) {
          profilePayload = mePayload;
        } else {
          throw error;
        }
      }

      const normalizedPrimary = normalizeProfile(profilePayload);
      const normalizedFallback = normalizeProfile(mePayload);
      const normalizedProfile = normalizedPrimary
        ? normalizedFallback
          ? mergeProfileData(normalizedPrimary, normalizedFallback)
          : normalizedPrimary
        : normalizedFallback;

      if (!normalizedProfile) {
        throw new Error("Unable to load this profile.");
      }

      setCurrentUserId(resolvedCurrentUserId);
      setTargetUserId(resolvedTargetUserId);
      setProfile(normalizedProfile);
      setProfileStatus("idle");
      setFeedStatus("idle");

      if (resolvedCurrentUserId === resolvedTargetUserId) {
        setIsFollowing(false);
        try {
          const shareLinkResponse = await fetchMyShareLink();
          setShareLink(normalizeShareLink(shareLinkResponse));
        } catch {
          setShareLink(null);
        }
      } else {
        setShareLink(null);
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
      setFeedStatus("error");
      setProfileError(message);
      setFeedError(message);
    }
  }, [profileUserId]);

  const loadFeedPage = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      if (!targetUserId) return;

      setFeedError(null);
      setFeedStatus(cursor ? "loading-more" : "loading");

      try {
        let response: { items: unknown[]; next_cursor?: string | null; nextCursor?: string | null };

        if (activeTabId === "content") {
          if (isCurrentUser) {
            try {
              response = await fetchMyContent({ limit: 20, cursor, includePostPreview: true });
            } catch {
              response = await fetchUserContent({
                userId: targetUserId,
                limit: 20,
                cursor,
                includePostPreview: true,
              });
            }
          } else {
            response = await fetchUserContent({
              userId: targetUserId,
              limit: 20,
              cursor,
              includePostPreview: true,
            });
          }
        } else if (activeTabId === "saved") {
          response = isCurrentUser
            ? await fetchPostsSaved({ limit: 20, cursor })
            : await fetchUserSavedPosts({ userId: targetUserId, limit: 20, cursor });
        } else if (isCurrentUser) {
          try {
            response = await fetchMyReposts({ limit: 20, cursor });
          } catch {
            response = await fetchPostsReposted({ limit: 20, cursor });
          }
        } else {
          response = await fetchUserReposts({ userId: targetUserId, limit: 20, cursor });
        }

        const normalized = (response.items ?? [])
          .map((entry, index) => {
            const keySuffix = `${cursor ?? "initial"}-${index}`;
            if (activeTabId === "content") return normalizeContentFeedItem(entry, keySuffix);
            return normalizePostFeedItem(entry, keySuffix);
          })
          .filter((entry): entry is ProfileFeedItem => Boolean(entry));

        setFeedItems((previous) => (replace ? normalized : [...previous, ...normalized]));
        setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
        setFeedStatus("idle");
      } catch (error) {
        setFeedStatus("error");
        setFeedError(parseApiErrorMessage(error));
      }
    },
    [activeTabId, isCurrentUser, targetUserId]
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isCurrentUser && activeTabId === "saved") {
      setActiveTabId("content");
    }
  }, [activeTabId, isCurrentUser]);

  useEffect(() => {
    if (!targetUserId || profileStatus !== "idle") return;
    setFeedItems([]);
    setNextCursor(null);
    void loadFeedPage({ replace: true });
  }, [activeTabId, loadFeedPage, profileStatus, targetUserId]);

  const loadMoreFeed = useCallback(async () => {
    if (!nextCursor || feedStatus === "loading-more") return;
    await loadFeedPage({ cursor: nextCursor, replace: false });
  }, [feedStatus, loadFeedPage, nextCursor]);

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

  const resolveConversationIdForTargetUser = useCallback(async (resolvedTargetUserId: string): Promise<string | undefined> => {
    const normalizedTargetUserId = String(resolvedTargetUserId);
    let cursor: string | undefined;

    for (let page = 0; page < 8; page += 1) {
      const response = await fetchConversations({ limit: 50, cursor });
      const items = Array.isArray(response.items) ? response.items : [];

      for (const item of items) {
        if (!isRecord(item)) continue;
        const participantId = extractConversationParticipantId(item);
        if (!participantId || String(participantId) !== normalizedTargetUserId) continue;
        const conversationId = pickString(item, ["id", "conversation_id", "conversationId"]);
        if (conversationId) return conversationId;
      }

      const nextCursor = response.next_cursor ?? response.nextCursor ?? undefined;
      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }

    return undefined;
  }, []);

  const handleMessageNavigation = useCallback(async () => {
    if (!targetUserId || isCurrentUser || isMessageLoading) return;

    setIsMessageLoading(true);
    try {
      const response = await createConversation(targetUserId);
      let conversationId = extractConversationId(response);

      if (!conversationId) {
        conversationId = await resolveConversationIdForTargetUser(targetUserId);
      }

      if (conversationId) {
        navigate(`/app/messages/conversation/${conversationId}`);
        return;
      }

      navigate("/app/messages");
      showToast({
        title: "Messages",
        message: "Opened your inbox. Start a message from the thread list.",
      });
    } catch (error) {
      try {
        const existingConversationId = await resolveConversationIdForTargetUser(targetUserId);
        if (existingConversationId) {
          navigate(`/app/messages/conversation/${existingConversationId}`);
          return;
        }
      } catch {
        // Ignore fallback lookup errors and show original create-conversation failure.
      }

      showToast({
        title: "Couldn't open messages",
        message: parseApiErrorMessage(error),
        tone: "error",
      });
    } finally {
      setIsMessageLoading(false);
    }
  }, [isCurrentUser, isMessageLoading, navigate, resolveConversationIdForTargetUser, showToast, targetUserId]);

  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app", { replace: true });
  }, [navigate]);

  const handleEditProfileNavigation = useCallback(() => {
    navigate("/app/profile/edit");
  }, [navigate]);

  const handleCopyProfileLink = useCallback(async () => {
    if (!profileShareUrl) {
      showToast({
        title: "Share unavailable",
        message: "Set a valid username to share your profile link.",
        tone: "error",
      });
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(profileShareUrl);
        showToast({
          title: "Profile link copied",
          message: profileShareUrl,
        });
      } catch (error) {
        showToast({
          title: "Couldn't copy link",
          message: error instanceof Error ? error.message : "Try again.",
          tone: "error",
        });
      }
      return;
    }

    showToast({
      title: "Copy unavailable",
      message: profileShareUrl,
      tone: "error",
    });
  }, [profileShareUrl, showToast]);

  const handleShareProfile = useCallback(async () => {
    if (!profile || !profileShareUrl) {
      showToast({
        title: "Share unavailable",
        message: "Set a valid username to share your profile link.",
        tone: "error",
      });
      return;
    }

    try {
      const shareIdentity = shareLink?.activeSlug ?? normalizedShareHandle ?? profile.handle.replace(/^@/, "");

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: `Check out @${shareIdentity} on Looped`,
          text: `Check out my profile on Looped: @${shareIdentity}`,
          url: profileShareUrl,
        });
        showToast({
          title: "Profile shared",
          message: "Your profile link was shared.",
        });
        return;
      }

      await handleCopyProfileLink();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast({
        title: "Couldn't share profile",
        message: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    }
  }, [handleCopyProfileLink, normalizedShareHandle, profile, profileShareUrl, shareLink?.activeSlug, showToast]);

  const handleCustomizeShareLink = useCallback(() => {
    if (!isCurrentUser || isShareLinkSaving) return;
    setShareLinkDraft(shareLink?.customSlug ?? "");
    setShareLinkDialogError(null);
    setIsShareLinkDialogOpen(true);
  }, [isCurrentUser, isShareLinkSaving, shareLink?.customSlug]);

  const closeShareLinkDialog = useCallback(() => {
    if (isShareLinkSaving) return;
    setIsShareLinkDialogOpen(false);
    setShareLinkDialogError(null);
  }, [isShareLinkSaving]);

  const saveShareLink = useCallback(async () => {
    if (!isCurrentUser || isShareLinkSaving) return;

    const normalizedInput = shareLinkDraft.trim().replace(/^@/, "").toLowerCase();
    if (normalizedInput.length > 0 && !SHARE_HANDLE_PATTERN.test(normalizedInput)) {
      setShareLinkDialogError("Use 3-30 lowercase letters, numbers, or underscores.");
      return;
    }

    const nextCustomSlug = normalizedInput.length > 0 ? normalizedInput : null;
    const currentCustomSlug = shareLink?.customSlug ?? null;
    if (nextCustomSlug === currentCustomSlug) {
      closeShareLinkDialog();
      return;
    }

    setShareLinkDialogError(null);
    setIsShareLinkSaving(true);
    try {
      if (nextCustomSlug) {
        const availability = await fetchSlugAvailability(nextCustomSlug);
        const reserved = availability.reserved === true;
        const ownedByMe = availability.ownedByMe === true || availability.owned_by_me === true;
        const available = availability.available === true;
        if (reserved) {
          const message = "That slug is reserved.";
          setShareLinkDialogError(message);
          showToast({
            title: "Slug unavailable",
            message,
            tone: "error",
          });
          return;
        }
        if (!available && !ownedByMe) {
          const message = "That slug is already taken.";
          setShareLinkDialogError(message);
          showToast({
            title: "Slug unavailable",
            message,
            tone: "error",
          });
          return;
        }
      }

      const response = await updateMyShareLink(nextCustomSlug);
      const normalized = normalizeShareLink(response);
      if (normalized) {
        setShareLink(normalized);
      }
      setIsShareLinkDialogOpen(false);
      showToast({
        title: nextCustomSlug ? "Profile link updated" : "Profile link reset",
        message: nextCustomSlug
          ? `Your profile link is now mylooped.app/u/${nextCustomSlug}.`
          : "Your profile link now uses your username.",
      });
    } catch (error) {
      const parsed = parseUserApiError(error);
      const message = messageForShareSlugError(parsed.code, parsed.message || "Couldn't update your profile link.");

      setShareLinkDialogError(message);
      showToast({
        title: "Couldn't update link",
        message,
        tone: "error",
      });
    } finally {
      setIsShareLinkSaving(false);
    }
  }, [closeShareLinkDialog, isCurrentUser, isShareLinkSaving, shareLink?.customSlug, shareLinkDraft, showToast]);

  const handleBlockUser = useCallback(async () => {
    if (!targetUserId || isCurrentUser || !canShowProfileMenu || isBlockingUser) return;

    setIsBlockingUser(true);
    try {
      await blockUser(targetUserId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("looped:content-refresh"));
      }
      setShowBlockPrompt(false);
      setIsProfileMenuOpen(false);
      handleBackNavigation();
    } catch (error) {
      showToast({
        title: "Couldn't block user",
        message: parseApiErrorMessage(error),
        tone: "error",
      });
    } finally {
      setIsBlockingUser(false);
    }
  }, [canShowProfileMenu, handleBackNavigation, isBlockingUser, isCurrentUser, showToast, targetUserId]);

  const rightRail = profile ? (
    <>
      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-strong">Profile snapshot</h3>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border/60 bg-bg px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Current highlighted community</p>
            <p className="mt-1 text-sm font-semibold text-strong">{profile.highlightedCommunity ?? "Not set yet"}</p>
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
            className="w-full rounded-full bg-bg-muted px-6 py-2.5 text-center text-[1.02rem] font-semibold text-text-secondary transition hover:text-strong"
            onClick={() => void handleShareProfile()}
          >
            Share profile
          </button>
          {isCurrentUser && profileShareDisplay ? (
            <div className="rounded-xl border border-border/70 bg-bg px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-strong">{profileShareDisplay}</p>
              <div className="mt-1 flex items-center gap-3 text-sm">
                <button
                  type="button"
                  className="font-semibold text-text-secondary underline-offset-2 transition hover:text-strong hover:underline"
                  onClick={() => void handleCopyProfileLink()}
                >
                  Copy link
                </button>
                <button
                  type="button"
                  className="font-semibold text-text-secondary underline-offset-2 transition hover:text-strong hover:underline disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={handleCustomizeShareLink}
                  disabled={isShareLinkSaving}
                >
                  {isShareLinkSaving ? "Saving..." : "Customize link"}
                </button>
              </div>
            </div>
          ) : null}
          {isCurrentUser ? (
            <button
              type="button"
              className="w-full rounded-full bg-bg-muted px-6 py-2.5 text-center text-[1.02rem] font-semibold text-text-secondary transition hover:text-strong"
              onClick={handleEditProfileNavigation}
            >
              Edit profile
            </button>
          ) : null}
        </div>
      </div>
    </>
  ) : null;

  const visibleTabs: Array<{ id: ProfileTabId; label: string }> = isCurrentUser
    ? [
        { id: "content", label: "Content" },
        { id: "saved", label: "Saved" },
        { id: "reposts", label: "Reposts" },
      ]
    : [
        { id: "content", label: "Content" },
        { id: "reposts", label: "Reposts" },
      ];

  const emptyLabel =
    activeTabId === "content"
      ? "No content yet."
      : activeTabId === "saved"
        ? "No saved posts yet."
        : "No reposts yet.";

  const loadingLabel =
    activeTabId === "content"
      ? "Loading content..."
      : activeTabId === "saved"
        ? "Loading saved posts..."
        : "Loading reposts...";

  return (
    <AppLayout activeNavId={isCurrentUser ? "profile" : ""} rightRail={rightRail}>
      <AppMobileHeader title="Profile" showAction={false} showBack={!isCurrentUser} backHref="/app" />

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
            <div className="relative flex items-start justify-between gap-4">
              <div className={`flex min-w-0 items-center gap-3 ${showOwnProfileSettingsShortcut ? "pr-12 lg:pr-0" : ""}`}>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary">
                  <img
                    src={profile.avatarUrl ?? defaultProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={handleAvatarImageError}
                  />
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-2xl font-semibold ${profile.isAnonymous ? "text-secondary" : "text-strong"}`}>
                    {profile.name}
                  </p>
                  <p className="truncate text-[1.1rem] text-text-secondary">{profile.handle}</p>
                </div>
              </div>
              {showOwnProfileSettingsShortcut ? (
                <Link
                  to="/app/settings"
                  className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong lg:hidden"
                  aria-label="Settings"
                >
                  <SettingsIcon className="h-6 w-6 bg-current" />
                </Link>
              ) : !isCurrentUser ? (
                canShowProfileMenu ? (
                  <div className="relative">
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center text-text-secondary transition hover:text-strong"
                      aria-label="Profile options"
                      aria-expanded={isProfileMenuOpen}
                      onClick={() => setIsProfileMenuOpen((value) => !value)}
                    >
                      <MenuDots className="h-6 w-6" />
                    </button>

                    {isProfileMenuOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-20 cursor-default"
                          aria-label="Close profile options"
                          onClick={() => setIsProfileMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-11 z-30 min-w-[170px] rounded-xl border border-border/70 bg-bg p-1 shadow-lg">
                          <button
                            type="button"
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => {
                              setShowBlockPrompt(true);
                              setIsProfileMenuOpen(false);
                            }}
                            disabled={isBlockingUser}
                          >
                            Block User
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null
              ) : null}
            </div>

            {profile.bio ? <p className="mt-3 text-[1.08rem] text-text-secondary">{profile.bio}</p> : null}

            <div className="mt-3 space-y-1.5 text-[1.08rem] text-text-secondary">
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
              <div className="mt-3 flex flex-wrap items-center gap-6 text-[1.08rem] text-text-secondary">
                {targetUserId ? (
                  <Link
                    to={`/app/profile/${targetUserId}/following`}
                    className="flex items-center gap-1.5 transition hover:text-strong"
                  >
                    <span className="font-semibold text-strong">{profile.followingCount}</span>
                    <span>Following</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-strong">{profile.followingCount}</span>
                    <span>Following</span>
                  </div>
                )}
                {targetUserId ? (
                  <Link
                    to={`/app/profile/${targetUserId}/followers`}
                    className="flex items-center gap-1.5 transition hover:text-strong"
                  >
                    <span className="font-semibold text-strong">{profile.followersCount}</span>
                    <span>Followers</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-strong">{profile.followersCount}</span>
                    <span>Followers</span>
                  </div>
                )}
              </div>
            ) : null}

            {isCurrentUser ? (
              <div className="mt-4 space-y-3 lg:hidden">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="min-w-[150px] cursor-pointer rounded-full bg-bg-muted px-6 py-2.5 text-center text-[1.02rem] font-semibold text-text-secondary transition hover:text-strong"
                    onClick={handleEditProfileNavigation}
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    className="min-w-[150px] cursor-pointer rounded-full bg-bg-muted px-6 py-2.5 text-center text-[1.02rem] font-semibold text-text-secondary transition hover:text-strong"
                    onClick={() => void handleShareProfile()}
                  >
                    Share profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isFollowing
                      ? "min-w-[150px] bg-bg-muted px-6 py-2.5 text-[1.02rem] text-text-secondary hover:text-strong"
                      : "min-w-[150px] bg-brand px-6 py-2.5 text-[1.02rem] text-white hover:bg-brand-hover"
                  }`}
                  onClick={() => void handleFollowToggle()}
                  disabled={isFollowLoading}
                >
                  {isFollowLoading ? "Updating..." : isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  type="button"
                  className="min-w-[150px] rounded-full bg-bg-muted px-6 py-2.5 text-center text-[1.02rem] font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={() => void handleMessageNavigation()}
                  disabled={isMessageLoading}
                >
                  {isMessageLoading ? "Opening..." : "Message"}
                </button>
              </div>
            )}
          </div>

          <div className={`grid ${visibleTabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`relative px-2 py-4 text-center text-sm transition ${
                  activeTabId === tab.id ? "font-bold text-brand" : "font-medium text-text-secondary hover:text-strong"
                }`}
                aria-current={activeTabId === tab.id ? "page" : undefined}
              >
                {tab.label}
                {activeTabId === tab.id ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 bg-brand" /> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showBlockPrompt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={isBlockingUser ? undefined : () => setShowBlockPrompt(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border/70 bg-bg p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-strong">Block user?</h2>
            <p className="mt-2 text-sm text-text-secondary">
              You won&apos;t see posts from {profileHandleLabel} anymore.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleBlockUser()}
                disabled={isBlockingUser}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBlockingUser ? "Blocking..." : "Block User"}
              </button>
              <button
                type="button"
                onClick={() => setShowBlockPrompt(false)}
                disabled={isBlockingUser}
                className="w-full rounded-xl border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isShareLinkDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={closeShareLinkDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/70 bg-bg p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-strong">Customize share link</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Use 3-30 lowercase letters, numbers, or underscores.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition hover:bg-bg-muted hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
                onClick={closeShareLinkDialog}
                disabled={isShareLinkSaving}
                aria-label="Close dialog"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveShareLink();
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-strong">Custom slug (optional)</span>
                <input
                  value={shareLinkDraft}
                  onChange={(event) => {
                    setShareLinkDraft(event.currentTarget.value.toLowerCase());
                    if (shareLinkDialogError) setShareLinkDialogError(null);
                  }}
                  placeholder={shareLink?.usernameSlug ?? "username"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand/50"
                />
                {shareLinkDialogError ? <p className="mt-1.5 text-xs text-brand">{shareLinkDialogError}</p> : null}
              </label>

              <p className="text-xs text-text-light">
                Link preview:{" "}
                <span className="font-semibold text-text-secondary">
                  mylooped.app/u/{(shareLinkDraft.trim().replace(/^@/, "").toLowerCase() || shareLink?.usernameSlug || "username")}
                </span>
              </p>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShareLinkDraft("")}
                  disabled={isShareLinkSaving}
                  className="w-full rounded-xl border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Reset to username
                </button>
                <button
                  type="submit"
                  disabled={isShareLinkSaving}
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isShareLinkSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="divide-y divide-border/70 bg-bg">
        {feedItems.map((item) =>
          item.kind === "post" ? <PostCard key={item.key} post={item.post} /> : <ReplyContentCard key={item.key} item={item.reply} />
        )}

        {feedStatus === "loading" && profileStatus !== "loading" ? (
          <div className="px-4 py-6 text-sm text-text-secondary">{loadingLabel}</div>
        ) : null}

        {feedItems.length === 0 && feedStatus === "idle" ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">{emptyLabel}</div>
        ) : null}

        {feedError ? (
          <div className="space-y-2 px-4 py-4">
            <p className="text-sm font-semibold text-strong">Unable to load items.</p>
            <p className="text-sm text-text-secondary">{feedError}</p>
          </div>
        ) : null}

        {nextCursor && feedStatus !== "loading-more" ? (
          <div className="flex justify-center px-4 py-5">
            <button
              type="button"
              onClick={() => void loadMoreFeed()}
              className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            >
              Load more
            </button>
          </div>
        ) : null}

        {feedStatus === "loading-more" ? (
          <div className="px-4 py-5 text-center text-sm text-text-secondary">Loading more...</div>
        ) : null}
      </div>
    </AppLayout>
  );
}
