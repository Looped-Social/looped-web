import type { Route } from "./+types/community-share";
import { CommunitySharePage } from "@/marketing/pages/CommunitySharePage/CommunitySharePage";

type CommunityShareMeta = {
  title: string;
  description: string;
  canonicalUrl: string;
  previewImageUrl: string;
  iosDeepLink: string;
};

const APP_STORE_ID = "6758413180";
const FALLBACK_IMAGE_PATH = "/main-logo.svg";

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function toAbsoluteUrl(value: string | undefined, origin: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, origin).toString();
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

function buildFallbackMeta(communityId: string, origin: string): CommunityShareMeta {
  const canonicalUrl = `${origin}/c/${encodeURIComponent(communityId)}`;
  return {
    title: "Looped — Community",
    description: "View this shared Looped community.",
    canonicalUrl,
    previewImageUrl: new URL(FALLBACK_IMAGE_PATH, origin).toString(),
    iosDeepLink: `looped://community/${encodeURIComponent(communityId)}`,
  };
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const rawCommunityId = params.communityId?.trim() ?? "";
  const communityId = rawCommunityId || "community";
  const origin = new URL(request.url).origin;
  const fallback = buildFallbackMeta(communityId, origin);

  const rawApiBase = import.meta.env.VITE_API_BASE_URL;
  if (typeof rawApiBase !== "string" || rawApiBase.trim().length === 0) {
    return fallback;
  }
  const apiBase = rawApiBase.replace(/\/$/, "");

  try {
    const response = await fetch(`${apiBase}/v1/public/communities/${encodeURIComponent(communityId)}`, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      if (response.status === 404) {
        return {
          ...fallback,
          title: "Looped — Community Not Found",
          description: "This shared community could not be found.",
        } satisfies CommunityShareMeta;
      }
      if (response.status === 410) {
        return {
          ...fallback,
          title: "Looped — Community Unavailable",
          description: "This shared community is unavailable.",
        } satisfies CommunityShareMeta;
      }
      return fallback;
    }

    const payload = (await response.json()) as unknown;
    if (typeof payload !== "object" || payload === null) return fallback;
    const community = payload as Record<string, unknown>;

    const node = typeof community.community === "object" && community.community !== null
      ? (community.community as Record<string, unknown>)
      : community;

    const name =
      pickString(node, ["short_name", "shortName", "name", "display_name", "displayName", "title"]) ?? "Community";
    const descriptionBase =
      pickString(node, ["description", "about", "bio"]) ??
      (() => {
        const members =
          pickNumber(node, ["member_count", "memberCount", "members_count", "membersCount", "followers_count"]) ?? 0;
        if (members > 0) return `${members} ${members === 1 ? "member" : "members"}`;
        return "View this shared Looped community.";
      })();
    const description = sanitizeMetaText(truncate(descriptionBase, 180));

    return {
      title: `${name} | Looped`,
      description,
      canonicalUrl: `${origin}/c/${encodeURIComponent(communityId)}`,
      previewImageUrl:
        toAbsoluteUrl(pickString(node, ["image_url", "imageUrl", "icon_url", "iconUrl"]), origin) ??
        new URL(FALLBACK_IMAGE_PATH, origin).toString(),
      iosDeepLink: `looped://community/${encodeURIComponent(communityId)}`,
    } satisfies CommunityShareMeta;
  } catch {
    return fallback;
  }
}

export function meta({ data }: Route.MetaArgs) {
  const shareMeta = data as CommunityShareMeta | undefined;
  const title = shareMeta?.title ?? "Looped — Community";
  const description = shareMeta?.description ?? "View this shared Looped community.";
  const canonicalUrl = shareMeta?.canonicalUrl ?? "/c";
  const previewImageUrl = shareMeta?.previewImageUrl ?? FALLBACK_IMAGE_PATH;
  const iosDeepLink = shareMeta?.iosDeepLink ?? "looped://community";

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:type", content: "website" },
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

export default function CommunityShareRoute({ params }: Route.ComponentProps) {
  return <CommunitySharePage communityId={params.communityId ?? ""} />;
}
