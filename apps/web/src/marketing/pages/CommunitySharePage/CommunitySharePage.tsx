import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

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
  iconUrl?: string;
  iconGlyph?: string;
  membersCount: number;
  kind?: string;
};

type SharedCommunityPost = {
  id: string;
  authorName: string;
  content: string;
  createdAtLabel: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
};

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

function normalizeSharedCommunity(payload: unknown, fallbackId: string): SharedCommunity | null {
  if (!isRecord(payload)) return null;
  const node = isRecord(payload.community) ? payload.community : payload;

  const id = pickString(node, ["id", "community_id", "communityId", "specialization_id", "specializationId"]) ?? fallbackId;
  const name = pickString(node, ["short_name", "shortName", "name", "display_name", "displayName", "title"]) ?? "Community";
  const iconPayload = isRecord(node.icon) ? node.icon : null;
  const iconUrl =
    pickString(node, ["image_url", "imageUrl", "icon_url", "iconUrl"]) ??
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
    shortName: pickString(node, ["short_name", "shortName"]),
    description: pickString(node, ["description", "about", "bio"]),
    iconUrl,
    iconGlyph,
    membersCount:
      pickNumber(node, ["member_count", "memberCount", "members_count", "membersCount", "follower_count", "followers_count"]) ??
      0,
    kind: kindRaw ? kindRaw.toLowerCase() : undefined,
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
    content: pickString(node, ["content", "text", "body", "message"]) ?? "",
    createdAtLabel: formatTimeAgo(node.created_at ?? node.createdAt ?? node.timestamp ?? node.created),
    likesCount: pickNumber(node, ["likes_count", "likesCount", "like_count", "likeCount"]) ?? 0,
    commentsCount: pickNumber(node, ["comments_count", "commentsCount", "comment_count", "commentCount"]) ?? 0,
    sharesCount: pickNumber(node, ["share_count", "shareCount", "shares_count", "sharesCount"]) ?? 0,
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
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        {viewStatus === "loading" ? (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-bg p-5 shadow-sm">
            <div className="h-6 w-2/3 animate-pulse rounded-full bg-bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-full bg-bg-muted" />
          </div>
        ) : null}

        {viewStatus === "error" ? (
          <section className="rounded-2xl border border-border/70 bg-bg p-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-strong">
              {errorKind === "not-found"
                ? "Community not found"
                : errorKind === "unavailable"
                  ? "Community unavailable"
                  : "Community preview unavailable"}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{errorMessage ?? "Try again later."}</p>
            <div className="mt-5 flex flex-wrap gap-2">
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
          </section>
        ) : null}

        {viewStatus === "ready" && community ? (
          <>
            <section className="rounded-2xl border border-border/70 bg-bg p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg-muted text-xl font-semibold text-brand">
                  {community.iconUrl ? (
                    <img src={community.iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : community.iconGlyph ? (
                    <span aria-hidden="true">{community.iconGlyph}</span>
                  ) : (
                    <span aria-hidden="true">#</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-2xl font-semibold text-strong">{community.name}</h1>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatCount(community.membersCount)} {community.membersCount === 1 ? "member" : "members"}
                    {community.kind ? ` • ${community.kind}` : ""}
                  </p>
                </div>
              </div>

              {community.description ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{community.description}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
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
            </section>

            <section className="mt-5 rounded-2xl border border-border/70 bg-bg shadow-sm">
              <div className="border-b border-border/70 px-5 py-3">
                <h2 className="text-sm font-semibold text-strong">Recent posts</h2>
              </div>

              {postsStatus === "loading" ? <p className="px-5 py-4 text-sm text-text-secondary">Loading posts...</p> : null}
              {postsStatus === "error" ? (
                <p className="px-5 py-4 text-sm text-text-secondary">{postsError ?? "Unable to load shared posts."}</p>
              ) : null}

              {postsStatus === "idle" && posts.length === 0 ? (
                <p className="px-5 py-4 text-sm text-text-secondary">Recent posts are available in the app.</p>
              ) : null}

              {posts.map((post, index) => (
                <article
                  key={post.id}
                  className={`px-5 py-4 ${index !== posts.length - 1 ? "border-b border-border/70" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-strong">{post.authorName}</p>
                    <p className="shrink-0 text-xs text-text-light">{post.createdAtLabel}</p>
                  </div>
                  {post.content ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{post.content}</p>
                  ) : null}
                  <p className="mt-3 text-xs text-text-light">
                    {formatCount(post.likesCount)} likes · {formatCount(post.commentsCount)} comments · {formatCount(post.sharesCount)} shares
                  </p>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
