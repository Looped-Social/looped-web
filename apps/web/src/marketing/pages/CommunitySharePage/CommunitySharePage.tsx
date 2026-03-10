import { type SyntheticEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { CommunityBanner } from "@/components/CommunityBanner/CommunityBanner";
import { useUserSession } from "@/hooks/useUserSession";
import {
  CommunityShareApiError,
  fetchSharedCommunityById,
  fetchSharedCommunityPosts,
} from "@/lib/communityShareApi";
import { Navbar } from "@/marketing/components/Navbar/Navbar";

type CommunitySharePageProps = {
  communityId: string;
};

type SharedCommunity = {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  bannerImageUrl?: string;
  iconUrl?: string;
  iconGlyph?: string;
  membersCount: number;
  kind?: string;
  specializationType?: string;
};

type SharedCommunityPost = {
  id: string;
  authorName: string;
  authorProfileImageUrl?: string;
  communityName?: string;
  content: string;
  createdAtLabel: string;
  likesCount: number;
  commentsCount: number;
};

const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
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

function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = getBoolean(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function asDate(value: unknown): Date | null {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatTimeAgo(value: unknown): string {
  const date = asDate(value);
  if (!date) return "";
  const diffSeconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${Math.max(1, diffMonths)}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${Math.max(1, diffYears)}y ago`;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return String(Math.max(0, value));
}

function formatKindLabel(value?: string): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized
    .split(/[_\-\s]+/)
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function handleAvatarError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

function normalizeSharedCommunity(payload: unknown, fallbackId: string): SharedCommunity | null {
  if (!isRecord(payload)) return null;
  const node = isRecord(payload.community) ? payload.community : payload;

  const id = pickString(node, ["id", "community_id", "communityId", "specialization_id", "specializationId"]) ?? fallbackId;
  const shortName = pickString(node, ["short_name", "shortName"]);
  const name = shortName ?? pickString(node, ["name", "display_name", "displayName", "title"]) ?? "Community";
  const iconPayload = isRecord(node.icon) ? node.icon : null;
  const bannerImageUrl =
    pickString(node, ["banner_image_url", "bannerImageUrl", "cover_image_url", "coverImageUrl", "header_image_url", "headerImageUrl"]) ??
    pickString(node, ["image_url", "imageUrl"]);
  const iconUrl =
    pickString(node, ["icon_url", "iconUrl", "logo_url", "logoUrl", "avatar_url", "avatarUrl"]) ??
    (iconPayload ? pickString(iconPayload, ["url", "image_url", "imageUrl"]) : undefined);
  const iconGlyph =
    pickString(node, ["emoji", "icon_emoji", "iconEmoji"]) ??
    (iconPayload ? pickString(iconPayload, ["value", "emoji", "label"]) : undefined);
  const kindRaw =
    pickString(node, ["kind", "community_kind", "communityKind", "type", "specialization_type", "specializationType"]) ??
    undefined;

  return {
    id,
    name,
    shortName,
    description: pickString(node, ["description", "about", "bio"]),
    bannerImageUrl,
    iconUrl,
    iconGlyph,
    membersCount:
      pickNumber(node, ["member_count", "memberCount", "members_count", "membersCount", "follower_count", "followers_count"]) ??
      0,
    kind: kindRaw ? kindRaw.toLowerCase() : undefined,
    specializationType: pickString(node, ["specialization_type", "specializationType"]),
  };
}

function normalizeSharedCommunityPost(payload: unknown): SharedCommunityPost | null {
  if (!isRecord(payload)) return null;
  const node =
    (isRecord(payload.post) ? payload.post : null) ??
    (isRecord(payload.original_post) ? payload.original_post : null) ??
    payload;
  const id = pickString(node, ["id", "post_id", "postId"]);
  if (!id) return null;

  const isAnonymous =
    pickBoolean(node, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ?? false;
  const authorName = isAnonymous
    ? "Anonymous"
    : pickString(node, ["author_display_name", "authorDisplayName", "author_name", "authorName", "author_handle", "authorHandle"]) ??
      "User";

  return {
    id,
    authorName,
    authorProfileImageUrl: pickString(node, ["author_profile_image_url", "authorProfileImageUrl"]),
    communityName: pickString(node, ["community_short_name", "communityShortName", "community_name", "communityName"]),
    content: pickString(node, ["content", "text", "body", "message"]) ?? "",
    createdAtLabel: formatTimeAgo(node.created_at ?? node.createdAt ?? node.timestamp ?? node.created),
    likesCount: pickNumber(node, ["likes_count", "likesCount", "like_count", "likeCount"]) ?? 0,
    commentsCount: pickNumber(node, ["comments_count", "commentsCount", "comment_count", "commentCount"]) ?? 0,
  };
}

function parseApiMessage(error: unknown, fallback: string): string {
  if (error instanceof CommunityShareApiError) {
    const body = (error.details ?? "").trim();
    if (body.length > 0) {
      try {
        const parsed = JSON.parse(body) as unknown;
        if (isRecord(parsed)) {
          const message = pickString(parsed, ["message"]);
          if (message) return message;
        }
      } catch {
        return body;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function CommunitySharePage({ communityId }: CommunitySharePageProps) {
  const navigate = useNavigate();
  const { status: sessionStatus } = useUserSession();

  const rawId = useMemo(() => communityId.trim().replace(/^\/+/, ""), [communityId]);
  const appDestination = useMemo(() => `/app/community/${encodeURIComponent(rawId)}`, [rawId]);

  const [community, setCommunity] = useState<SharedCommunity | null>(null);
  const [viewStatus, setViewStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKind, setErrorKind] = useState<"not-found" | "unavailable" | "generic" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [posts, setPosts] = useState<SharedCommunityPost[]>([]);
  const [postsStatus, setPostsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [postsError, setPostsError] = useState<string | null>(null);

  const kindLabel = useMemo(
    () => formatKindLabel(community?.kind ?? community?.specializationType),
    [community?.kind, community?.specializationType]
  );

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !rawId) return;
    navigate(appDestination, {
      replace: true,
      state: { fromCommunityShareRedirect: true },
    });
  }, [appDestination, navigate, rawId, sessionStatus]);

  useEffect(() => {
    if (!rawId) {
      setViewStatus("error");
      setErrorKind("generic");
      setErrorMessage("Invalid community link.");
      return;
    }

    let active = true;
    setViewStatus("loading");
    setErrorKind(null);
    setErrorMessage(null);
    setCommunity(null);
    setPosts([]);
    setPostsStatus("idle");
    setPostsError(null);

    void fetchSharedCommunityById(rawId)
      .then((response) => {
        if (!active) return;
        const normalized = normalizeSharedCommunity(response, rawId);
        if (!normalized) {
          setViewStatus("error");
          setErrorKind("generic");
          setErrorMessage("Community preview is unavailable.");
          return;
        }
        setCommunity(normalized);
        setViewStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof CommunityShareApiError && error.status === 404) {
          setErrorKind("not-found");
          setErrorMessage("Community not found.");
        } else if (error instanceof CommunityShareApiError && error.status === 410) {
          setErrorKind("unavailable");
          setErrorMessage("Community unavailable.");
        } else {
          setErrorKind("generic");
          setErrorMessage(parseApiMessage(error, "Unable to load this community."));
        }
        setViewStatus("error");
      });

    return () => {
      active = false;
    };
  }, [rawId]);

  useEffect(() => {
    if (viewStatus !== "ready" || !community) return;
    let active = true;
    setPostsStatus("loading");
    setPostsError(null);

    void fetchSharedCommunityPosts({
      communityId: community.id,
      limit: 8,
    })
      .then((response) => {
        if (!active) return;
        const items = Array.isArray(response.items) ? response.items : [];
        const normalized = items.map(normalizeSharedCommunityPost).filter((item): item is SharedCommunityPost => Boolean(item));
        setPosts(normalized);
        setPostsStatus("idle");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof CommunityShareApiError && error.status === 410) {
          setViewStatus("error");
          setErrorKind("unavailable");
          setErrorMessage("Community unavailable.");
          return;
        }
        if (error instanceof CommunityShareApiError && error.status === 404) {
          setPosts([]);
          setPostsStatus("idle");
          return;
        }
        setPostsStatus("error");
        setPostsError(parseApiMessage(error, "Unable to load shared posts."));
      });

    return () => {
      active = false;
    };
  }, [community, viewStatus]);

  return (
    <div className="min-h-screen bg-shell-bg text-text-primary">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl pb-16 pt-4 sm:pt-6">
        <div className="flex flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
          <p className="whitespace-nowrap text-[1.38rem] font-semibold leading-tight text-strong">Shared Community</p>
          {sessionStatus !== "authenticated" ? (
            <Link
              to={`/login?next=${encodeURIComponent(appDestination)}`}
              className="text-[0.95rem] text-text-secondary underline-offset-2 transition hover:text-strong hover:underline"
            >
              <span className="underline decoration-current underline-offset-2">Sign in</span> to follow, post, and view full community.
            </Link>
          ) : (
            <p className="text-[0.95rem] text-text-secondary">Opening full community...</p>
          )}
        </div>

        <section className="overflow-hidden border border-border/70 bg-bg sm:rounded-2xl">
          {viewStatus === "loading" ? (
            <div className="px-5 py-5">
              <div className="animate-pulse space-y-3">
                <div className="h-36 w-full rounded-2xl bg-bg-muted" />
                <div className="h-4 w-1/2 rounded-full bg-bg-muted" />
                <div className="h-4 w-2/3 rounded-full bg-bg-muted" />
                <div className="h-4 w-full rounded-full bg-bg-muted" />
              </div>
            </div>
          ) : null}

          {viewStatus === "error" ? (
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-strong">
                {errorKind === "not-found"
                  ? "Community not found"
                  : errorKind === "unavailable"
                    ? "Community unavailable"
                    : "Community preview unavailable"}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{errorMessage ?? "Try again later."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/login?next=${encodeURIComponent(appDestination)}`}
                  className="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
                >
                  Log in to open
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                >
                  Back home
                </Link>
              </div>
            </div>
          ) : null}

          {viewStatus === "ready" && community ? (
            <>
              <article className="bg-bg">
                <div className="px-4 py-5 sm:px-5">
                  {community.bannerImageUrl ? (
                    <div className="mb-4">
                      <CommunityBanner
                        src={community.bannerImageUrl}
                        kind={community.kind ?? community.specializationType}
                        height={120}
                        inset={6}
                      />
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <h1 className="truncate text-[1.8rem] leading-[1.15] font-semibold text-strong">{community.name}</h1>
                    <p className="mt-1 text-[1rem] text-text-secondary">
                      {formatCount(community.membersCount)} {community.membersCount === 1 ? "member" : "members"}
                      {kindLabel ? ` • ${kindLabel}` : ""}
                    </p>
                  </div>

                  {community.description ? (
                    <p className="mt-4 whitespace-pre-wrap text-[1.02rem] leading-[1.45] text-text-secondary">{community.description}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={`/login?next=${encodeURIComponent(appDestination)}`}
                      className="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
                    >
                      Open in Looped
                    </Link>
                    <a
                      href="https://apps.apple.com/us/app/looped-social/id6758413180"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                    >
                      Get iOS app
                    </a>
                  </div>
                </div>
              </article>

              <section className="border-t border-border/70">
                <div className="px-4 py-3 sm:px-5">
                  <h2 className="text-[1.03rem] font-semibold text-strong">Recent posts</h2>
                </div>

                {postsStatus === "loading" ? (
                  <div className="border-t border-border/70 px-4 py-5 text-sm text-text-secondary sm:px-5">Loading posts...</div>
                ) : null}

                {postsStatus === "error" ? (
                  <div className="border-t border-border/70 px-4 py-5 text-sm text-text-secondary sm:px-5">
                    {postsError ?? "Unable to load shared posts."}
                  </div>
                ) : null}

                {postsStatus === "idle" && posts.length === 0 ? (
                  <div className="border-t border-border/70 px-4 py-5 text-sm text-text-secondary sm:px-5">
                    Recent posts are available in the app.
                  </div>
                ) : null}

                {posts.length > 0 ? (
                  <div className="divide-y divide-border/70 border-t border-border/70">
                    {posts.map((post) => (
                      <article key={post.id} className="px-4 py-4 sm:px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex flex-1 items-start gap-3">
                            <img
                              src={post.authorProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-full object-cover"
                              loading="lazy"
                              onError={handleAvatarError}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[1.1rem] font-semibold leading-tight text-strong">{post.authorName}</p>
                              {post.communityName ? (
                                <p className="mt-0.5 text-[0.95rem] leading-tight text-text-secondary">Posted in {post.communityName}</p>
                              ) : null}
                            </div>
                          </div>
                          {post.createdAtLabel ? (
                            <p className="shrink-0 text-[0.95rem] text-text-light">{post.createdAtLabel}</p>
                          ) : null}
                        </div>

                        {post.content ? (
                          <p className="mt-3 whitespace-pre-wrap text-[1.05rem] leading-[1.42] text-text-primary">{post.content}</p>
                        ) : (
                          <p className="mt-3 text-[0.95rem] text-text-secondary">Post content is available in the app.</p>
                        )}

                        <p className="mt-3 text-[0.92rem] text-text-light">
                          {formatCount(post.likesCount)} likes · {formatCount(post.commentsCount)} comments
                        </p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
