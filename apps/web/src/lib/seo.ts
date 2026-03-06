import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Looped";
// Used for canonical URLs + OG tags on marketing pages.
// Override per-environment (e.g. new Cloudflare domain) with `VITE_SITE_URL`.
export const SITE_URL =
  (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SITE_URL : undefined)?.trim() || "https://looped-social.com";
export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "looped-social.com";
  }
})();
export const DEFAULT_SOCIAL_IMAGE_PATH = "/main-logo.svg";

type MarketingMetaInput = {
  title: string;
  description: string;
  path: string;
  imageUrl?: string;
  type?: "website" | "article" | "profile";
  robots?: string;
};

type AppNoIndexMetaInput = {
  title: string;
  description: string;
};

function sanitizeMetaText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0 || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function toSiteUrl(pathOrUrl: string): string {
  try {
    return new URL(pathOrUrl, SITE_URL).toString();
  } catch {
    return `${SITE_URL}${normalizePath(pathOrUrl)}`;
  }
}

export function buildMarketingPageMeta({
  title,
  description,
  path,
  imageUrl,
  type = "website",
  robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
}: MarketingMetaInput): MetaDescriptor[] {
  const cleanTitle = sanitizeMetaText(title);
  const cleanDescription = sanitizeMetaText(description);
  const canonicalUrl = toSiteUrl(normalizePath(path));
  const previewImageUrl = toSiteUrl(imageUrl ?? DEFAULT_SOCIAL_IMAGE_PATH);

  return [
    { title: cleanTitle },
    { name: "description", content: cleanDescription },
    { name: "robots", content: robots },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: cleanTitle },
    { property: "og:description", content: cleanDescription },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: previewImageUrl },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: cleanTitle },
    { name: "twitter:description", content: cleanDescription },
    { name: "twitter:image", content: previewImageUrl },
  ];
}

export function buildAppNoIndexMeta({ title, description }: AppNoIndexMetaInput): MetaDescriptor[] {
  const cleanTitle = sanitizeMetaText(title);
  const cleanDescription = sanitizeMetaText(description);

  return [
    { title: cleanTitle },
    { name: "description", content: cleanDescription },
    { name: "robots", content: "noindex,nofollow,noarchive" },
    { name: "googlebot", content: "noindex,nofollow,noarchive" },
  ];
}
