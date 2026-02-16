import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { normalizePostPoll } from "@/lib/postPoll";
import { extractViewerCapabilitiesFromPost } from "@/lib/postViewerCapabilities";
import { fetchHashtagPosts, PostReadApiError } from "@/lib/postReadApi";

type AppHashtagFeedPageProps = {
  hashtag: string;
};

type LoadStatus = "idle" | "loading" | "loading-more" | "error";

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

function normalizeHashtagPost(item: unknown): PostData | null {
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

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof PostReadApiError) {
    const raw = (error.details ?? "").trim();
    if (!raw) return error.message;

    try {
      const parsed = JSON.parse(raw) as unknown;
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
  return "Unable to load posts.";
}

export function AppHashtagFeedPage({ hashtag }: AppHashtagFeedPageProps) {
  const navigate = useNavigate();
  const normalizedHashtag = useMemo(() => hashtag.trim().replace(/^#/, ""), [hashtag]);

  const [posts, setPosts] = useState<PostData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      if (!normalizedHashtag) {
        setStatus("error");
        setError("Invalid hashtag.");
        return;
      }

      setError(null);
      setStatus(cursor ? "loading-more" : "loading");

      try {
        const response = await fetchHashtagPosts({
          name: normalizedHashtag,
          limit: 20,
          cursor,
        });
        const normalized = (response.items ?? [])
          .map(normalizeHashtagPost)
          .filter((item): item is PostData => Boolean(item));

        setPosts((previous) => (replace ? normalized : [...previous, ...normalized]));
        setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
        setStatus("idle");
      } catch (loadError) {
        setStatus("error");
        setError(parseApiErrorMessage(loadError));
      }
    },
    [normalizedHashtag]
  );

  useEffect(() => {
    setPosts([]);
    setNextCursor(null);
    setStatus("loading");
    setError(null);
    void loadPosts({ replace: true });
  }, [loadPosts]);

  return (
    <AppLayout activeNavId="search">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                navigate(-1);
                return;
              }
              navigate("/app/search", { replace: true });
            }}
            className="inline-flex h-10 w-10 items-center justify-center text-strong transition hover:text-strong/80"
            aria-label="Back"
          >
            <BackIcon className="h-7 w-7" />
          </button>

          <h1 className="truncate text-center text-[1.65rem] font-semibold leading-tight text-brand">#{normalizedHashtag}</h1>
          <div aria-hidden="true" />
        </div>
      </header>

      <div className="divide-y divide-border/70 bg-bg">
        {status === "loading" && posts.length === 0 ? (
          <div className="px-4 py-5 text-sm text-text-secondary">Loading posts...</div>
        ) : null}

        {error && posts.length === 0 ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm font-semibold text-strong">Unable to load hashtag posts.</p>
            <p className="text-sm text-text-secondary">{error}</p>
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

        {posts.length === 0 && status === "idle" && !error ? (
          <div className="px-4 py-5 text-sm text-text-secondary">No posts for this hashtag yet.</div>
        ) : null}

        {nextCursor && status !== "loading-more" ? (
          <div className="flex justify-center px-4 py-5">
            <button
              type="button"
              onClick={() =>
                void loadPosts({
                  cursor: nextCursor,
                  replace: false,
                })
              }
              className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            >
              Load more
            </button>
          </div>
        ) : null}

        {status === "loading-more" ? (
          <div className="px-4 py-5 text-center text-sm text-text-secondary">Loading more...</div>
        ) : null}
      </div>
    </AppLayout>
  );
}
