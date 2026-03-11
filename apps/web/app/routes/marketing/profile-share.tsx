import type { Route } from "./+types/profile-share";
import { ProfileSharePage } from "@/marketing/pages/ProfileSharePage/ProfileSharePage";
import { logShareMetaFailure, resolveShareApiBaseCandidates } from "./shareMeta";

type ProfileShareMeta = {
  title: string;
  description: string;
  canonicalUrl: string;
  previewImageUrl: string;
  iosDeepLink: string;
};

const APP_STORE_ID = "6758413180";
const FALLBACK_IMAGE_PATH = "/main-logo.svg";

function normalizeSlug(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  const normalized = value.replace(/^@/, "").toLowerCase();
  return normalized || "profile";
}

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

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function preferredDisplayName(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "object" || value === null) return undefined;
  return pickString(value as Record<string, unknown>, [
    "short_name",
    "shortName",
    "name",
    "display_name",
    "displayName",
    "label",
    "title",
  ]);
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

function buildFallbackMeta(username: string, origin: string): ProfileShareMeta {
  const canonicalUrl = `${origin}/u/${encodeURIComponent(username)}`;
  return {
    title: `Looped — @${username}`,
    description: `Check out @${username}'s public Looped profile.`,
    canonicalUrl,
    previewImageUrl: new URL(FALLBACK_IMAGE_PATH, origin).toString(),
    iosDeepLink: `looped://profile/${encodeURIComponent(username)}`,
  };
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const username = normalizeSlug(params.username);
  const origin = new URL(request.url).origin;
  const fallback = buildFallbackMeta(username, origin);

  const apiBases = resolveShareApiBaseCandidates(context);
  if (apiBases.length === 0) {
    logShareMetaFailure("profile-share", new Error("Missing API base for share metadata"), { username });
    return fallback;
  }

  for (const apiBase of apiBases) {
    try {
      const response = await fetch(`${apiBase}/v1/public/profiles/${encodeURIComponent(username)}`, {
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          return {
            ...fallback,
            title: "Looped — Profile Not Found",
            description: "This shared profile could not be found.",
          } satisfies ProfileShareMeta;
        }
        if (response.status === 410) {
          return {
            ...fallback,
            title: "Looped — Profile Unavailable",
            description: "This shared profile is unavailable.",
          } satisfies ProfileShareMeta;
        }
        logShareMetaFailure("profile-share", new Error(`Unexpected response status: ${response.status}`), {
          username,
          apiBase,
        });
        continue;
      }

      const payload = (await response.json()) as unknown;
      if (typeof payload !== "object" || payload === null) {
        logShareMetaFailure("profile-share", new Error("Profile payload was not an object"), { username, apiBase });
        continue;
      }
      const profile = payload as Record<string, unknown>;

      const publicUsername = normalizeSlug(pickString(profile, ["username", "handle"]) ?? username);
      const firstName = pickString(profile, ["first_name", "firstName"]);
      const lastName = pickString(profile, ["last_name", "lastName"]);
      const fullName = [normalizeOptional(firstName), normalizeOptional(lastName)]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .trim();
      const displayName = fullName || pickString(profile, ["display_name", "displayName", "name"]) || `@${publicUsername}`;
      const bio = pickString(profile, ["bio", "about", "description"]);
      const displayCommunity =
        pickString(profile, ["display_community_name", "displayCommunityName", "display_community", "displayCommunity"]) ??
        preferredDisplayName(profile.display_community ?? profile.displayCommunity);
      const displaySpecialization =
        pickString(profile, [
          "display_specialization_name",
          "displaySpecializationName",
          "display_specialization",
          "displaySpecialization",
        ]) ?? preferredDisplayName(profile.display_specialization ?? profile.displaySpecialization);
      const showFollowerCount = pickBoolean(profile, ["show_follower_count", "showFollowerCount"]) ?? true;
      const followers = pickNumber(profile, ["followers_count", "followersCount"]) ?? 0;
      const following = pickNumber(profile, ["following_count", "followingCount"]) ?? 0;

      const detailLine =
        displayCommunity && displaySpecialization
          ? `${displaySpecialization} @ ${displayCommunity}`
          : displayCommunity ?? displaySpecialization;
      const countsLine =
        showFollowerCount && (followers > 0 || following > 0) ? `${followers} followers · ${following} following` : "";
      const descriptionParts = [detailLine, bio, bio ? undefined : countsLine].filter(Boolean);
      const baseDescription = descriptionParts.join(" • ") || `Check out ${displayName}'s public Looped profile.`;
      const description = sanitizeMetaText(truncate(baseDescription, 180));

      return {
        title: `${displayName} (@${publicUsername}) | Looped`,
        description,
        canonicalUrl: `${origin}/u/${encodeURIComponent(publicUsername)}`,
        previewImageUrl:
          toAbsoluteUrl(
            pickString(profile, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url", "imageUrl"]),
            origin
          ) ??
          new URL(FALLBACK_IMAGE_PATH, origin).toString(),
        iosDeepLink: `looped://profile/${encodeURIComponent(publicUsername)}`,
      } satisfies ProfileShareMeta;
    } catch (error) {
      logShareMetaFailure("profile-share", error, { username, apiBase });
    }
  }

    return fallback;
}

export function meta({ params, data }: Route.MetaArgs) {
  const username = normalizeSlug(params.username);
  const shareMeta =
    (data as ProfileShareMeta | undefined) ??
    ({
      title: `Looped — @${username}`,
      description: `Check out @${username}'s public Looped profile.`,
      canonicalUrl: `/u/${encodeURIComponent(username)}`,
      previewImageUrl: FALLBACK_IMAGE_PATH,
      iosDeepLink: `looped://profile/${encodeURIComponent(username)}`,
    } satisfies ProfileShareMeta);
  const title = shareMeta.title;
  const description = shareMeta.description;
  const canonicalUrl = shareMeta.canonicalUrl;
  const previewImageUrl = shareMeta.previewImageUrl;
  const iosDeepLink = shareMeta.iosDeepLink;

  return [
    { title },
    {
      name: "description",
      content: description,
    },
    { name: "robots", content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:type", content: "profile" },
    { property: "og:site_name", content: "Looped" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: previewImageUrl },
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

export default function ProfileShareRoute({ params }: Route.ComponentProps) {
  return <ProfileSharePage username={params.username ?? ""} />;
}
