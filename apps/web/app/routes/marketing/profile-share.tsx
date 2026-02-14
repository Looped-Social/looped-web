import type { Route } from "./+types/profile-share";
import { ProfileSharePage } from "@/marketing/pages/ProfileSharePage/ProfileSharePage";

export function meta({ params }: Route.MetaArgs) {
  const raw = params.username?.trim() ?? "profile";
  const normalized = raw.replace(/^@/, "").toLowerCase();
  const username = normalized || "profile";
  const canonicalUrl = `https://mylooped.app/u/${encodeURIComponent(username)}`;
  const title = `Looped — @${username}`;
  const description = `Check out @${username}'s public Looped profile. Sign in to follow, message, and interact.`;
  const previewImageUrl = "https://mylooped.app/main-logo.svg";
  const iosDeepLink = `looped://profile/${encodeURIComponent(username)}`;

  return [
    { title },
    {
      name: "description",
      content: description,
    },
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
  ];
}

export default function ProfileShareRoute({ params }: Route.ComponentProps) {
  return <ProfileSharePage username={params.username ?? ""} />;
}
