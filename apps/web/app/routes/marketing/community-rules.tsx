import type { Route } from "./+types/community-rules";
import { buildMarketingPageMeta } from "@/lib/seo";
import { CommunityRulesPage } from "@/marketing/pages/CommunityRulesPage/CommunityRulesPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped Content Policy",
    description: "Looped Content Policy defines what content is permitted, restricted, or prohibited on the platform.",
    path: "/community-rules",
  });
}

export default function CommunityRules() {
  return <CommunityRulesPage />;
}
