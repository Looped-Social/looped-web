import type { Route } from "./+types/privacy";
import { buildMarketingPageMeta } from "@/lib/seo";
import { PrivacyPage } from "@/marketing/pages/PrivacyPage/PrivacyPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Privacy",
    description: "Learn how Looped protects pseudonymous identity on workplace and college communities.",
    path: "/privacy",
  });
}

export default function PrivacyPolicy() {
  return <PrivacyPage />;
}
