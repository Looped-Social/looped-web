import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import { useToast } from "@/app/components/AppToast/AppToast";
import { resolveCommunityLabel, usePreferCommunityShortNames } from "@/lib/communityDisplayPreference";
import { useContentPreferences } from "@/lib/contentPreferences";
import { normalizeSettingsError } from "@/lib/settingsHttp";
import {
  fetchSettingsLikedPosts,
  fetchSettingsSavedPosts,
  fetchSettingsUserPosts,
  fetchSettingsUserReplies,
} from "@/lib/settingsContentApi";
import { isPostSavedChangedEvent, POST_SAVED_CHANGED_EVENT } from "@/lib/postEvents";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { type PostReadApiError, fetchPostById } from "@/lib/postReadApi";
import { normalizePostPoll } from "@/lib/postPoll";
import { extractViewerCapabilitiesFromPost } from "@/lib/postViewerCapabilities";
import { useCurrentUserStore } from "@/stores/currentUserStore";

type ContentTabId = "posts" | "replies" | "liked" | "saved";
type ListStatus = "idle" | "loading" | "loading-more" | "error";

type ReplyItem = {
  id: string;
  postId?: string;
  parentId?: string;
  authorName: string;
  authorHandle?: string;
  content: string;
  likesCount: number;
  replyCount: number;
  createdAtLabel: string;
  isAnonymous: boolean;
};

const TABS: Array<{ id: ContentTabId; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "replies", label: "Replies" },
  { id: "liked", label: "Liked" },
  { id: "saved", label: "Saved" },
];

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

function normalizedOptional(value: unknown): string | undefined {
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

function formatTimeAgo(value: unknown): string {
  const date = asDate(value);
  if (!date) return "";
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

function capitalize(value: string): string {
  if (!value) return "";
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function normalizePostItem(item: unknown, preferCommunityShortNames: boolean): PostData | null {
  if (!isRecord(item)) return null;

  const post = isRecord(item.post) ? item.post : item;
  const id = pickString(post, ["id", "post_id", "postId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(post, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous", "is_anon", "isAnon"]) ??
    pickBoolean(post, ["anon", "anonymous"]) ??
    false;

  const communityId = pickString(post, ["community_id", "communityId"]);
  const communityName = resolveCommunityLabel({
    name: pickString(post, ["community_name", "communityName"]),
    shortName: pickString(post, ["community_short_name", "communityShortName"]),
    fallback: "Community",
    preferShortNames: preferCommunityShortNames,
  });

  const displaySpecializationSource =
    (isRecord(post.author_display_specialization) ? post.author_display_specialization : null) ??
    (isRecord(post.authorDisplaySpecialization) ? post.authorDisplaySpecialization : null);
  const displayCommunitySource =
    (isRecord(post.author_display_community) ? post.author_display_community : null) ??
    (isRecord(post.authorDisplayCommunity) ? post.authorDisplayCommunity : null);

  const displaySpecialization = displaySpecializationSource
    ? resolveCommunityLabel({
        name: pickString(displaySpecializationSource, ["name"]),
        shortName: pickString(displaySpecializationSource, ["short_name", "shortName"]),
        fallback: "Member",
        preferShortNames: preferCommunityShortNames,
      })
    : "Member";

  const displayCommunity = displayCommunitySource
    ? resolveCommunityLabel({
        name: pickString(displayCommunitySource, ["name"]),
        shortName: pickString(displayCommunitySource, ["short_name", "shortName"]),
        fallback: "Community",
        preferShortNames: preferCommunityShortNames,
      })
    : undefined;

  const firstName = pickString(post, ["author_first_name", "authorFirstName"]);
  const lastName = pickString(post, ["author_last_name", "authorLastName"]);
  const fullName = [normalizedOptional(firstName), normalizedOptional(lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  const author = isAnonymous
    ? "Anonymous"
    : fullName || pickString(post, ["author_display_name", "authorDisplayName", "author_name", "authorName"]) || "User";

  const communityKind = pickString(post, ["community_kind", "communityKind"]);
  const context = communityName
    ? `Posted in ${communityName}`
    : communityKind
      ? `Posted in ${capitalize(communityKind)}`
      : "";

  const subtitle = isAnonymous ? "" : displayCommunity ? `${displaySpecialization} @ ${displayCommunity}` : displaySpecialization;

  const content = pickString(post, ["content", "text", "body", "message"]) ?? "";
  const time =
    pickString(post, ["time_ago", "timeAgo", "created_at_human", "createdAtHuman"]) ??
    formatTimeAgo(post.created_at ?? post.createdAt ?? post.timestamp);

  const likes = pickNumber(post, ["likes_count", "likesCount", "like_count", "likeCount"]) ?? 0;
  const comments = pickNumber(post, ["comments_count", "commentsCount", "comment_count", "commentCount"]) ?? 0;
  const reposts = pickNumber(post, ["repost_count", "repostCount", "reposts_count", "repostsCount"]) ?? 0;
  const shares = pickNumber(post, ["share_count", "shareCount", "shares_count", "sharesCount"]) ?? 0;
  const saves = pickNumber(post, ["save_count", "saveCount", "saves_count", "savesCount"]) ?? 0;

  const authorId = pickString(post, ["author_id", "authorId"]);
  const anonProfileId =
    pickString(post, ["anon_profile_id", "anonProfileId", "author_anon_profile_id", "authorAnonProfileId"]) ?? undefined;

  return {
    id,
    communityId,
    author,
    subtitle,
    context,
    content,
    time,
    authorProfileImageUrl: pickString(post, ["author_profile_image_url", "authorProfileImageUrl"]),
    authorProfileHref: isAnonymous
      ? anonProfileId
        ? `/app/profile/anon/${anonProfileId}`
        : "/app/profile/anonymous"
      : authorId
        ? `/app/profile/${authorId}`
        : undefined,
    viewerLiked: pickBoolean(post, ["user_liked", "userLiked"]) ?? false,
    viewerSaved: pickBoolean(post, ["is_saved", "isSaved"]) ?? false,
    viewerHasReposted: pickBoolean(post, ["viewer_has_reposted", "viewerHasReposted"]) ?? false,
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

function normalizeReplyItem(item: unknown): ReplyItem | null {
  if (!isRecord(item)) return null;
  const id = pickString(item, ["id", "reply_id", "replyId", "comment_id", "commentId"]);
  if (!id) return null;

  const author =
    (isRecord(item.author) ? item.author : null) ??
    (isRecord(item.user) ? item.user : null) ??
    (isRecord(item.creator) ? item.creator : null);

  const authorName =
    (author ? pickString(author, ["displayName", "display_name", "name", "handle"]) : undefined) ??
    pickString(item, ["author_display_name", "authorDisplayName", "author_name", "authorName"]) ??
    "User";

  return {
    id,
    postId: pickString(item, ["postId", "post_id"]),
    parentId: pickString(item, ["parentId", "parent_id"]),
    authorName,
    authorHandle:
      (author ? pickString(author, ["handle", "username"]) : undefined) ?? pickString(item, ["author_handle", "authorHandle"]),
    content: pickString(item, ["content", "text", "body", "message"]) ?? "",
    likesCount: pickNumber(item, ["likesCount", "likes_count", "likeCount", "like_count"]) ?? 0,
    replyCount: pickNumber(item, ["replyCount", "reply_count", "repliesCount", "replies_count"]) ?? 0,
    createdAtLabel:
      pickString(item, ["time_ago", "timeAgo", "created_at_human", "createdAtHuman"]) ??
      formatTimeAgo(item.created_at ?? item.createdAt ?? item.timestamp),
    isAnonymous:
      (author
        ? pickBoolean(author, ["isAnonymous", "is_anonymous", "author_is_anonymous", "authorIsAnonymous"])
        : undefined) ??
      pickBoolean(item, ["isAnonymous", "is_anonymous", "author_is_anonymous", "authorIsAnonymous", "anon"]) ??
      false,
  };
}

function parseTab(value: string | null): ContentTabId {
  if (value === "replies") return "replies";
  if (value === "liked") return "liked";
  if (value === "saved") return "saved";
  return "posts";
}

function useInfiniteLoad({
  sentinelRef,
  enabled,
  canLoadMore,
  isLoading,
  onLoadMore,
}: {
  sentinelRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  canLoadMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  useEffect(() => {
    const node = sentinelRef.current;
    if (!enabled || !node || !canLoadMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        onLoadMore();
      },
      {
        root: null,
        rootMargin: "220px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, enabled, isLoading, onLoadMore, sentinelRef]);
}

function ReplyRow({ reply }: { reply: ReplyItem }) {
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "unavailable" | "error">("idle");
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!reply.postId) return;
    const postId = reply.postId;
    const node = ref.current;
    if (!node) return;

    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || previewStatus !== "idle") return;

        setPreviewStatus("loading");
        void fetchPostById(postId)
          .then((post) => {
            if (!active) return;
            if (!isRecord(post)) {
              setPreviewStatus("error");
              return;
            }
            const content = pickString(post, ["content", "text", "body", "message"]);
            if (content && content.trim().length > 0) {
              setPreviewContent(content.trim());
              setPreviewStatus("ready");
              return;
            }
            setPreviewStatus("unavailable");
          })
          .catch((error) => {
            if (!active) return;
            const apiError = error as PostReadApiError;
            if (apiError && typeof apiError === "object" && "status" in apiError && apiError.status === 404) {
              setPreviewStatus("unavailable");
              return;
            }
            setPreviewStatus("error");
          });
      },
      { rootMargin: "160px 0px", threshold: 0.01 }
    );

    observer.observe(node);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [previewStatus, reply.postId]);

  return (
    <article ref={ref} className="border-b border-border/60 bg-bg px-4 py-3 last:border-b-0">
      <p className="text-sm font-semibold text-strong">
        {reply.authorName}
        {reply.authorHandle ? <span className="font-normal text-text-secondary"> @{reply.authorHandle.replace(/^@/, "")}</span> : null}
      </p>
      {reply.content ? <p className="mt-1 text-sm text-strong">{reply.content}</p> : null}
      {reply.postId ? (
        <div className="mt-2 rounded-xl bg-bg-muted px-3 py-2 text-xs text-text-secondary">
          {previewStatus === "idle" || previewStatus === "loading" ? <p>Loading post preview…</p> : null}
          {previewStatus === "ready" ? <p className="line-clamp-2">{previewContent}</p> : null}
          {previewStatus === "unavailable" ? <p>Post unavailable</p> : null}
          {previewStatus === "error" ? <p>Unable to load post preview.</p> : null}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
        <span>{reply.likesCount} likes</span>
        <span>{reply.replyCount} replies</span>
        <span>{reply.createdAtLabel}</span>
      </div>
      {reply.postId ? (
        <Link to={`/app/post/${reply.postId}/comments`} className="mt-2 inline-flex text-xs font-semibold text-secondary">
          Open thread
        </Link>
      ) : null}
    </article>
  );
}

export function AppSettingsContentPage() {
  const { showToast } = useToast();
  const { user } = useCurrentUserStore({ autoLoad: true });
  const { hideAnonymousPosts } = useContentPreferences();
  const preferCommunityShortNames = usePreferCommunityShortNames();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  const [posts, setPosts] = useState<PostData[]>([]);
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
  const [postsStatus, setPostsStatus] = useState<ListStatus>("idle");
  const [postsError, setPostsError] = useState<string | null>(null);

  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [repliesNextCursor, setRepliesNextCursor] = useState<string | null>(null);
  const [repliesStatus, setRepliesStatus] = useState<ListStatus>("idle");
  const [repliesError, setRepliesError] = useState<string | null>(null);

  const [liked, setLiked] = useState<PostData[]>([]);
  const [likedNextCursor, setLikedNextCursor] = useState<string | null>(null);
  const [likedStatus, setLikedStatus] = useState<ListStatus>("idle");
  const [likedError, setLikedError] = useState<string | null>(null);

  const [saved, setSaved] = useState<PostData[]>([]);
  const [savedNextCursor, setSavedNextCursor] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<ListStatus>("idle");
  const [savedError, setSavedError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPosts = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      if (!user?.id) return;
      setPostsStatus(cursor ? "loading-more" : "loading");
      setPostsError(null);
      try {
        const response = await fetchSettingsUserPosts({ userId: user.id, limit: 20, cursor });
        const normalized = response.items
          .map((item) => normalizePostItem(item, preferCommunityShortNames))
          .filter((item): item is PostData => Boolean(item))
          .filter((item) => !hideAnonymousPosts || !item.isAnonymous);

        setPosts((current) => (replace ? normalized : [...current, ...normalized]));
        setPostsNextCursor(response.nextCursor);
        setPostsStatus("idle");
      } catch (error) {
        const normalized = normalizeSettingsError(error);
        setPostsError(normalized.message || "Unable to load posts.");
        setPostsStatus("error");
      }
    },
    [hideAnonymousPosts, preferCommunityShortNames, user?.id]
  );

  const loadReplies = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      if (!user?.id) return;
      setRepliesStatus(cursor ? "loading-more" : "loading");
      setRepliesError(null);
      try {
        const response = await fetchSettingsUserReplies({ userId: user.id, limit: 20, cursor });
        const normalized = response.items
          .map(normalizeReplyItem)
          .filter((item): item is ReplyItem => Boolean(item))
          .filter((item) => !hideAnonymousPosts || !item.isAnonymous);

        setReplies((current) => (replace ? normalized : [...current, ...normalized]));
        setRepliesNextCursor(response.nextCursor);
        setRepliesStatus("idle");
      } catch (error) {
        const normalized = normalizeSettingsError(error);
        setRepliesError(normalized.message || "Unable to load replies.");
        setRepliesStatus("error");
      }
    },
    [hideAnonymousPosts, user?.id]
  );

  const loadLiked = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      setLikedStatus(cursor ? "loading-more" : "loading");
      setLikedError(null);
      try {
        const response = await fetchSettingsLikedPosts({ limit: 20, cursor });
        const normalized = response.items
          .map((item) => normalizePostItem(item, preferCommunityShortNames))
          .filter((item): item is PostData => Boolean(item))
          .filter((item) => !hideAnonymousPosts || !item.isAnonymous)
          .map((item) => ({ ...item, viewerLiked: true }));

        setLiked((current) => (replace ? normalized : [...current, ...normalized]));
        setLikedNextCursor(response.nextCursor);
        setLikedStatus("idle");
      } catch (error) {
        const normalized = normalizeSettingsError(error);
        setLikedError(normalized.message || "Unable to load liked posts.");
        setLikedStatus("error");
      }
    },
    [hideAnonymousPosts, preferCommunityShortNames]
  );

  const loadSaved = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      setSavedStatus(cursor ? "loading-more" : "loading");
      setSavedError(null);
      try {
        const response = await fetchSettingsSavedPosts({ limit: 20, cursor });
        const normalized = response.items
          .map((item) => normalizePostItem(item, preferCommunityShortNames))
          .filter((item): item is PostData => Boolean(item))
          .filter((item) => !hideAnonymousPosts || !item.isAnonymous)
          .map((item) => ({ ...item, viewerSaved: true }));

        setSaved((current) => (replace ? normalized : [...current, ...normalized]));
        setSavedNextCursor(response.nextCursor);
        setSavedStatus("idle");
      } catch (error) {
        const normalized = normalizeSettingsError(error);
        setSavedError(normalized.message || "Unable to load saved posts.");
        setSavedStatus("error");
      }
    },
    [hideAnonymousPosts, preferCommunityShortNames]
  );

  const loadActiveTab = useCallback(
    ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      if (activeTab === "posts") {
        void loadPosts({ cursor, replace });
        return;
      }
      if (activeTab === "replies") {
        void loadReplies({ cursor, replace });
        return;
      }
      if (activeTab === "liked") {
        void loadLiked({ cursor, replace });
        return;
      }
      void loadSaved({ cursor, replace });
    },
    [activeTab, loadLiked, loadPosts, loadReplies, loadSaved]
  );

  useEffect(() => {
    if (!user?.id) return;

    if (activeTab === "posts") {
      setPosts([]);
      setPostsNextCursor(null);
    } else if (activeTab === "replies") {
      setReplies([]);
      setRepliesNextCursor(null);
    } else if (activeTab === "liked") {
      setLiked([]);
      setLikedNextCursor(null);
    } else {
      setSaved([]);
      setSavedNextCursor(null);
    }

    loadActiveTab({ replace: true });
  }, [activeTab, hideAnonymousPosts, loadActiveTab, preferCommunityShortNames, user?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!isPostSavedChangedEvent(event)) return;
      if (event.detail.saved) return;
      setSaved((current) => current.filter((post) => post.id !== event.detail.postId));
    };

    if (typeof window === "undefined") return;
    window.addEventListener(POST_SAVED_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(POST_SAVED_CHANGED_EVENT, handler);
    };
  }, []);

  const activeStatus =
    activeTab === "posts"
      ? postsStatus
      : activeTab === "replies"
        ? repliesStatus
        : activeTab === "liked"
          ? likedStatus
          : savedStatus;

  const activeError =
    activeTab === "posts"
      ? postsError
      : activeTab === "replies"
        ? repliesError
        : activeTab === "liked"
          ? likedError
          : savedError;

  const activeNextCursor =
    activeTab === "posts"
      ? postsNextCursor
      : activeTab === "replies"
        ? repliesNextCursor
        : activeTab === "liked"
          ? likedNextCursor
          : savedNextCursor;

  const activeCount =
    activeTab === "posts"
      ? posts.length
      : activeTab === "replies"
        ? replies.length
        : activeTab === "liked"
          ? liked.length
          : saved.length;

  const loadMore = useCallback(() => {
    if (!activeNextCursor) return;
    if (activeStatus === "loading" || activeStatus === "loading-more") return;
    loadActiveTab({ cursor: activeNextCursor, replace: false });
  }, [activeNextCursor, activeStatus, loadActiveTab]);

  useInfiniteLoad({
    sentinelRef,
    enabled: Boolean(activeNextCursor),
    canLoadMore: Boolean(activeNextCursor),
    isLoading: activeStatus === "loading" || activeStatus === "loading-more",
    onLoadMore: loadMore,
  });

  useEffect(() => {
    if (!activeError) return;
    showToast({
      kind: "error",
      title: "Couldn’t load content",
      message: activeError,
    });
  }, [activeError, showToast]);

  const emptyLabel =
    activeTab === "posts"
      ? "No posts yet."
      : activeTab === "replies"
        ? "No replies yet."
        : activeTab === "liked"
          ? "No liked posts yet."
          : "No saved posts yet.";

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Content" showAction={false} showBack={false} />
      <SettingsSubpageHeader backHref="/app/settings" />

      <div className="mx-auto w-full max-w-[560px] space-y-4 bg-bg">
        <header className="px-4 pt-4">
          <h1 className="text-xl font-semibold text-strong">Content</h1>
          <p className="mt-1 text-sm text-text-secondary">Posts, replies, liked, and saved collections.</p>
        </header>

        <div className="px-4">
          <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-border/60 bg-bg">
            {TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSearchParams((current) => {
                      const next = new URLSearchParams(current);
                      next.set("tab", tab.id);
                      return next;
                    });
                  }}
                  className={`px-2 py-2 text-xs font-semibold transition ${
                    active ? "bg-brand text-white" : "text-text-secondary hover:text-strong"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeStatus === "loading" && activeCount === 0 ? (
          <div className="space-y-3 px-4 pb-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={`content-skeleton-${index}`} className="animate-pulse rounded-2xl border border-border/60 bg-bg px-4 py-3">
                <div className="h-4 w-1/3 rounded-full bg-bg-muted" />
                <div className="mt-2 h-3 w-2/3 rounded-full bg-bg-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {activeStatus !== "loading" && activeCount === 0 ? (
          <p className="px-4 pb-4 text-sm text-text-secondary">{emptyLabel}</p>
        ) : null}

        {activeTab === "posts" ? (
          <div className="divide-y divide-border/60 bg-bg">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : null}

        {activeTab === "liked" ? (
          <div className="divide-y divide-border/60 bg-bg">
            {liked.map((post) => (
              <PostCard key={`liked-${post.id}`} post={post} />
            ))}
          </div>
        ) : null}

        {activeTab === "saved" ? (
          <div className="divide-y divide-border/60 bg-bg">
            {saved.map((post) => (
              <PostCard key={`saved-${post.id}`} post={post} />
            ))}
          </div>
        ) : null}

        {activeTab === "replies" ? (
          <div className="overflow-hidden border-y border-border/60 bg-bg">
            {replies.map((reply) => (
              <ReplyRow key={reply.id} reply={reply} />
            ))}
          </div>
        ) : null}

        {activeNextCursor ? <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" /> : null}

        {activeStatus === "loading-more" ? (
          <p className="px-4 pb-6 text-center text-sm text-text-secondary">Loading more…</p>
        ) : null}
      </div>
    </AppLayout>
  );
}
