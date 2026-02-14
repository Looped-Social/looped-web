import type { Route } from "./+types/post-share";
import { extractMediaAssetIds } from "@/lib/postMediaIds";
import { PostSharePage } from "@/marketing/pages/PostSharePage/PostSharePage";

type PostShareMeta = {
  title: string;
  description: string;
  canonicalUrl: string;
  previewImageUrl: string;
  iosDeepLink: string;
};

const APP_STORE_ID = "6758413180";
const FALLBACK_IMAGE_URL = "https://mylooped.app/main-logo.svg";

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
  }
  return undefined;
}

function toAbsoluteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, "https://mylooped.app").toString();
  } catch {
    return undefined;
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function sanitizeMetaText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildFallbackMeta(postId: string, origin: string): PostShareMeta {
  const canonicalUrl = `${origin}/p/${encodeURIComponent(postId)}`;
  return {
    title: "Looped — Shared Post",
    description: "View a shared Looped post.",
    canonicalUrl,
    previewImageUrl: FALLBACK_IMAGE_URL,
    iosDeepLink: `looped://post/${encodeURIComponent(postId)}`,
  };
}

async function resolvePreviewImageFromMedia(apiBase: string, postPayload: Record<string, unknown>): Promise<string | undefined> {
  const mediaAssetIds = extractMediaAssetIds(postPayload);
  if (mediaAssetIds.length === 0) return undefined;

  const ids = mediaAssetIds.slice(0, 4).map((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  });

  try {
    const response = await fetch(`${apiBase}/v1/media/resolve`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as unknown;
    if (typeof payload !== "object" || payload === null) return undefined;
    const envelope = payload as Record<string, unknown>;
    if (!Array.isArray(envelope.items) || envelope.items.length === 0) return undefined;
    const firstItem = envelope.items.find(
      (item) => typeof item === "object" && item !== null
    ) as Record<string, unknown> | undefined;
    if (!firstItem) return undefined;
    return toAbsoluteUrl(
      pickString(firstItem, ["thumbnail_url", "thumbnailUrl", "cdn_url", "cdnUrl", "url", "download_url", "downloadUrl"])
    );
  } catch {
    return undefined;
  }
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const rawPostId = params.postId?.trim() ?? "";
  const postId = rawPostId || "post";
  const origin = new URL(request.url).origin;
  const fallback = buildFallbackMeta(postId, origin);

  const rawApiBase = import.meta.env.VITE_API_BASE_URL;
  if (typeof rawApiBase !== "string" || rawApiBase.trim().length === 0) {
    return fallback;
  }
  const apiBase = rawApiBase.replace(/\/$/, "");

  try {
    const response = await fetch(`${apiBase}/v1/public/posts/${encodeURIComponent(postId)}`, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      if (response.status === 404) {
        return {
          ...fallback,
          title: "Looped — Post Not Found",
          description: "This shared post could not be found.",
        } satisfies PostShareMeta;
      }
      if (response.status === 410) {
        return {
          ...fallback,
          title: "Looped — Post Unavailable",
          description: "This shared post is unavailable.",
        } satisfies PostShareMeta;
      }
      return fallback;
    }

    const payload = (await response.json()) as unknown;
    if (typeof payload !== "object" || payload === null) return fallback;
    const post = payload as Record<string, unknown>;

    const isAnonymous = pickBoolean(post, ["author_is_anonymous", "authorIsAnonymous", "is_anonymous", "isAnonymous"]) ?? false;
    const authorName = isAnonymous
      ? "Anonymous"
      : pickString(post, ["author_display_name", "authorDisplayName", "author_handle", "authorHandle"]) ?? "Looped member";
    const communityName =
      pickString(post, ["community_short_name", "communityShortName"]) ??
      pickString(post, ["community_name", "communityName"]);
    const content = pickString(post, ["content", "text", "body", "message"]) ?? "";

    const title = communityName ? `${authorName} on ${communityName} | Looped` : `${authorName} on Looped`;
    const description = sanitizeMetaText(
      content
        ? truncate(content, 180)
        : `View this shared post from ${authorName}${communityName ? ` in ${communityName}` : ""} on Looped.`
    );

    const directPreviewUrl = toAbsoluteUrl(
      pickString(post, [
        "thumbnail_url",
        "thumbnailUrl",
        "cdn_url",
        "cdnUrl",
        "media_url",
        "mediaUrl",
        "author_profile_image_url",
        "authorProfileImageUrl",
      ])
    );
    const resolvedPreviewUrl = directPreviewUrl ?? (await resolvePreviewImageFromMedia(apiBase, post));

    return {
      title,
      description,
      canonicalUrl: `${origin}/p/${encodeURIComponent(postId)}`,
      previewImageUrl: resolvedPreviewUrl ?? FALLBACK_IMAGE_URL,
      iosDeepLink: `looped://post/${encodeURIComponent(postId)}`,
    } satisfies PostShareMeta;
  } catch {
    return fallback;
  }
}

export function meta({ data }: Route.MetaArgs) {
  const shareMeta = data as PostShareMeta | undefined;
  const title = shareMeta?.title ?? "Looped — Shared Post";
  const description = shareMeta?.description ?? "View a shared Looped post.";
  const canonicalUrl = shareMeta?.canonicalUrl ?? "https://mylooped.app/p";
  const previewImageUrl = shareMeta?.previewImageUrl ?? FALLBACK_IMAGE_URL;
  const iosDeepLink = shareMeta?.iosDeepLink ?? "looped://post";

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: "Looped" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: previewImageUrl },
    { property: "og:image:alt", content: title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: previewImageUrl },
    { property: "al:ios:app_name", content: "Looped" },
    { property: "al:ios:url", content: iosDeepLink },
    { property: "al:web:url", content: canonicalUrl },
    { name: "apple-itunes-app", content: `app-id=${APP_STORE_ID}, app-argument=${canonicalUrl}` },
  ];
}

export default function PostShareRoute({ params }: Route.ComponentProps) {
  return <PostSharePage postId={params.postId ?? ""} />;
}
